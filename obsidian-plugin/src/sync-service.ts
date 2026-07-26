import { App, Notice, TFile, TFolder, Vault, EventRef } from 'obsidian';
import { SyncBackend, StatusResponse, ManifestResponse, PushOperation, PushResponse } from './backends/backend';
import { HttpBackend } from './backends/http-backend';
import { R2Backend } from './backends/r2-backend';

// --- Types ---

interface SyncStateEntry {
  hash: string;
  commit: string;
  file_id?: string;
}

interface SyncState {
  [path: string]: SyncStateEntry;
}

export interface ScionSyncSettings {
  backend: 'server' | 'r2'; // ponytail: per-vault, not per-device — see Risks in plan. Existing installs default to 'server'.
  serverUrl: string;
  r2AccountId: string;
  r2Bucket: string;
  r2AccessKeyId: string;
  r2SecretAccessKey: string;
  deviceName: string;
  pollInterval: number; // seconds (30-600, default 300)
  autoSync: boolean;
  syncOnStartup: boolean;
  debounceInterval: number; // seconds to wait after edit before syncing
}

export type SyncStatus = 'idle' | 'syncing' | 'success' | 'error';

const MAX_RETRY = 3;

// --- Helpers ---

async function computeHash(content: ArrayBuffer): Promise<string> {
  const hashBuffer = await crypto.subtle.digest('SHA-256', content);
  const hashArray = new Uint8Array(hashBuffer);
  return Array.from(hashArray).map(b => b.toString(16).padStart(2, '0')).join('');
}

function arrayBufferToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function makeConflictPath(originalPath: string): string {
  const lastDot = originalPath.lastIndexOf('.');
  if (lastDot === -1) return `${originalPath}.conflict`;
  return `${originalPath.slice(0, lastDot)}.conflict${originalPath.slice(lastDot)}`;
}

function shouldSyncFile(path: string): boolean {
  // Skip hidden files/folders, plugin data, and workspace files
  if (path.startsWith('.')) return false;
  if (path.startsWith('.obsidian/')) return false;
  return true;
}

export function createBackend(settings: ScionSyncSettings, vaultName: string): SyncBackend {
  if (settings.backend === 'r2') {
    return new R2Backend(
      {
        accountId: settings.r2AccountId,
        bucket: settings.r2Bucket,
        accessKeyId: settings.r2AccessKeyId,
        secretAccessKey: settings.r2SecretAccessKey,
      },
      vaultName
    );
  }
  return new HttpBackend(settings.serverUrl, settings.deviceName, vaultName);
}

// --- SyncService ---
//
// This class is transport-agnostic. All network I/O goes through `this.backend`
// (a SyncBackend — see backends/backend.ts). Nothing below this line should
// import from `obsidian`'s fetch/requestUrl or know about HTTP status codes,
// R2, or any other transport detail — that's HttpBackend's / R2Backend's job.

export class SyncService {
  private app: App;
  private vault: Vault;
  private settings: ScionSyncSettings;
  private vaultName: string;
  private backend: SyncBackend;
  private syncState: SyncState;
  private lastSyncedCommit: string | null = null;
  private lastBackend: 'server' | 'r2' | null;
  private syncLock: 'unlocked' | 'pulling' | 'pushing' = 'unlocked';
  private ignoringFileEvents = false;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private syncDebounceTimer: ReturnType<typeof setTimeout> | null = null;
  private eventRefs: EventRef[] = [];
  private saveDataFn: (data: unknown) => Promise<void>;
  private statusCallback: ((status: SyncStatus, message?: string) => void) | null = null;

  constructor(
    app: App,
    settings: ScionSyncSettings,
    vaultName: string,
    syncState: SyncState,
    lastSyncedCommit: string | null,
    saveDataFn: (data: unknown) => Promise<void>,
    lastBackend: 'server' | 'r2' | null = null
  ) {
    this.app = app;
    this.vault = app.vault;
    this.settings = settings;
    this.vaultName = vaultName;
    this.backend = createBackend(settings, vaultName);
    this.syncState = syncState || {};
    this.lastSyncedCommit = lastSyncedCommit;
    this.saveDataFn = saveDataFn;
    this.lastBackend = lastBackend;
  }

  setStatusCallback(cb: (status: SyncStatus, message?: string) => void) {
    this.statusCallback = cb;
  }

  private emitStatus(status: SyncStatus, message?: string) {
    this.statusCallback?.(status, message);
  }

  // --- Lifecycle ---

  async initialize() {
    this.setupFileWatcher();

    if (this.settings.syncOnStartup) {
      // Delay slightly to let Obsidian finish loading
      setTimeout(() => this.syncAll(), 1000);
    }

    if (this.settings.autoSync) {
      this.startPolling();
    }
  }

  destroy() {
    this.stopPolling();
    if (this.syncDebounceTimer) clearTimeout(this.syncDebounceTimer);
    for (const ref of this.eventRefs) {
      this.vault.offref(ref);
    }
    this.eventRefs = [];
  }

  updateSettings(settings: ScionSyncSettings) {
    const backendChanged =
      settings.backend !== this.settings.backend ||
      settings.serverUrl !== this.settings.serverUrl ||
      settings.r2AccountId !== this.settings.r2AccountId ||
      settings.r2Bucket !== this.settings.r2Bucket;

    this.settings = settings;
    if (backendChanged) {
      this.backend = createBackend(settings, this.vaultName);
    }

    this.stopPolling();
    if (settings.autoSync) {
      this.startPolling();
    }
  }

  /** Wipes all local sync bookkeeping so the next syncAll() bootstraps
   * fresh — used when switching backends (see the split-brain guard above)
   * or to recover from a corrupted local state. Touches nothing remote. */
  async resetSyncState() {
    this.syncState = {};
    this.lastSyncedCommit = null;
    // saveSyncState() below stamps lastBackend = current settings.backend,
    // which is exactly right: this device now has a clean, empty history
    // against whichever backend is currently selected.
    await this.saveSyncState();
  }

  getStats() {
    return {
      trackedFiles: Object.keys(this.syncState).length,
      lastCommit: this.lastSyncedCommit,
      backend: this.settings.backend,
    };
  }

  // --- Polling ---

  private startPolling() {
    this.stopPolling();
    const ms = this.settings.pollInterval * 1000;
    this.pollTimer = setInterval(() => this.syncAll(), ms);
  }

  private stopPolling() {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  // --- File Watcher ---

  private setupFileWatcher() {
    const onFileEvent = () => {
      if (this.ignoringFileEvents) return;
      this.debouncedSync();
    };

    const onRename = (_file: TFile | TFolder, _oldPath: string) => {
      if (this.ignoringFileEvents) return;
      // Don't move syncState entry — let collectLocalChanges detect it
      // as delete(oldPath) + create(newPath) so the rename gets pushed
      this.debouncedSync();
    };

    this.eventRefs.push(this.vault.on('modify', onFileEvent));
    this.eventRefs.push(this.vault.on('create', onFileEvent));
    this.eventRefs.push(this.vault.on('delete', onFileEvent));
    this.eventRefs.push(this.vault.on('rename', onRename));
  }

  private debouncedSync() {
    if (this.syncDebounceTimer) clearTimeout(this.syncDebounceTimer);
    const ms = (this.settings.debounceInterval || 3) * 1000;
    this.syncDebounceTimer = setTimeout(() => this.syncAll(), ms);
  }

  // --- Core Sync ---
  // Unchanged from the pre-backend version: this orchestration only ever
  // talks to `this.backend`, so it does not know or care whether that's the
  // Pi server or R2. Both backends return the same StatusResponse /
  // ManifestResponse / PushResponse shapes.

  async syncAll(retryCount = 0): Promise<void> {
    if (this.syncLock !== 'unlocked') return;

    // ponytail: cheap split-brain guard, not a real merge of the two
    // backends' state (see plan Risks). The Pi server and R2 evolve
    // independently; if this device's local state was last written while
    // synced to the *other* backend, silently continuing would let the two
    // diverge without ever raising a conflict. Refuse and say so instead.
    if (
      this.lastBackend !== null &&
      this.lastBackend !== this.settings.backend &&
      Object.keys(this.syncState).length > 0
    ) {
      this.emitStatus(
        'error',
        `This device last synced via "${this.lastBackend}"; settings now say "${this.settings.backend}". ` +
          `Move ALL devices for this vault to the new backend together, or switch back. ` +
          `To force a fresh start on this backend, clear this device's sync state in plugin settings.`
      );
      return;
    }

    this.emitStatus('syncing');

    try {
      // --- PULL PHASE ---
      this.syncLock = 'pulling';
      this.ignoringFileEvents = true;

      const status = await this.fetchStatus();

      if (this.lastSyncedCommit === null) {
        // First sync: pull full manifest
        await this.pullFullManifest();
      } else if (status.head_commit !== this.lastSyncedCommit) {
        // Incremental pull
        for (const change of status.changes) {
          if (change.status === 'deleted') {
            await this.handlePulledDeletion(change.path);
          } else if (change.status === 'renamed' && change.old_path) {
            await this.handlePulledRename(change.old_path, change.path);
          } else {
            await this.handlePulledFile(change.path);
          }
          // iOS crash-safe: persist after each file
          await this.saveSyncState();
        }
        this.lastSyncedCommit = status.head_commit;
        await this.saveSyncState();
      }

      this.ignoringFileEvents = false;
      this.syncLock = 'unlocked';

      // --- PUSH PHASE ---
      this.syncLock = 'pushing';

      const operations = await this.collectLocalChanges();
      if (operations.length === 0) {
        this.syncLock = 'unlocked';
        this.emitStatus('success');
        return;
      }

      const pushResult = await this.backend.push(this.lastSyncedCommit, operations);

      if (pushResult === 'stale') {
        this.syncLock = 'unlocked';
        if (retryCount < MAX_RETRY) {
          console.log(`SyncService: Stale push, retrying (${retryCount + 1}/${MAX_RETRY})`);
          return this.syncAll(retryCount + 1);
        }
        this.emitStatus('error', 'Push failed: remote changed. Try again.');
        return;
      }

      this.lastSyncedCommit = pushResult.head_commit;
      this.updateSyncStateFromPush(operations, pushResult);
      await this.saveSyncState();
      this.emitStatus('success');
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('SyncService: syncAll failed:', message);
      this.emitStatus('error', message);
    } finally {
      this.ignoringFileEvents = false;
      this.syncLock = 'unlocked';
    }
  }

  // --- Pull: Full Manifest ---

  private async pullFullManifest() {
    const data: ManifestResponse = await this.backend.fetchManifest();

    for (const file of data.files) {
      await this.handlePulledFile(file.path);
      await this.saveSyncState();
    }

    this.lastSyncedCommit = data.head_commit;
    await this.saveSyncState();
  }

  // --- Pull: Incremental ---

  private async handlePulledFile(filePath: string) {
    if (!shouldSyncFile(filePath)) return;

    const localFile = this.vault.getAbstractFileByPath(filePath);
    const localEntry = this.syncState[filePath];

    // Check if local was modified since last sync
    let localModified = false;
    if (localFile instanceof TFile && localEntry) {
      const localContent = await this.vault.readBinary(localFile);
      const localHash = await computeHash(localContent);
      if (localHash !== localEntry.hash) {
        localModified = true;
      }
    }

    // Download remote version
    const remoteFile = await this.backend.fetchFile(filePath);
    if (!remoteFile) {
      console.warn(`SyncService: Failed to download ${filePath}`);
      return;
    }
    const { content: serverContent, commit: serverCommit } = remoteFile;

    if (localModified && localFile instanceof TFile) {
      // CONFLICT: both sides changed
      const localContent = await this.vault.readBinary(localFile);
      const conflictPath = makeConflictPath(filePath);

      // Write server version to original path
      await this.vault.modifyBinary(localFile, serverContent);

      // Write local version to .conflict path
      const existingConflict = this.vault.getAbstractFileByPath(conflictPath);
      if (existingConflict instanceof TFile) {
        await this.vault.modifyBinary(existingConflict, localContent);
      } else {
        await this.vault.createBinary(conflictPath, localContent);
      }

      new Notice(`Conflict: local copy saved as ${conflictPath}`);
    } else {
      // No conflict: write server version
      if (localFile instanceof TFile) {
        await this.vault.modifyBinary(localFile, serverContent);
      } else {
        // Ensure parent folder exists
        const parentPath = filePath.split('/').slice(0, -1).join('/');
        if (parentPath) {
          await this.ensureFolder(parentPath);
        }
        await this.vault.createBinary(filePath, serverContent);
      }
    }

    // Update sync state with locally-computed hash (matches what collectLocalChanges computes)
    const localHash = await computeHash(serverContent);
    this.syncState[filePath] = {
      hash: localHash,
      commit: serverCommit || '',
    };
  }

  private async handlePulledDeletion(filePath: string) {
    if (!shouldSyncFile(filePath)) return;

    const localFile = this.vault.getAbstractFileByPath(filePath);
    const localEntry = this.syncState[filePath];

    if (localFile instanceof TFile && localEntry) {
      const localContent = await this.vault.readBinary(localFile);
      const localHash = await computeHash(localContent);

      if (localHash === localEntry.hash) {
        // Local unchanged: safe to delete
        await this.vault.delete(localFile);
      } else {
        // Local modified: keep local file, notify user
        new Notice(`Remote deleted ${filePath} but local has changes. Keeping local.`);
      }
    }

    delete this.syncState[filePath];
  }

  private async handlePulledRename(oldPath: string, newPath: string) {
    if (!shouldSyncFile(newPath)) return;

    const localFile = this.vault.getAbstractFileByPath(oldPath);
    if (localFile instanceof TFile) {
      // Ensure parent folder exists
      const parentPath = newPath.split('/').slice(0, -1).join('/');
      if (parentPath) {
        await this.ensureFolder(parentPath);
      }
      await this.vault.rename(localFile, newPath);
    }

    // Move sync state
    const entry = this.syncState[oldPath];
    if (entry) {
      this.syncState[newPath] = entry;
      delete this.syncState[oldPath];
    }

    // Also download in case content changed
    await this.handlePulledFile(newPath);
  }

  // --- Push ---

  private async collectLocalChanges(): Promise<PushOperation[]> {
    const ops: PushOperation[] = [];
    const localFiles = this.vault.getFiles().filter(f => shouldSyncFile(f.path));
    const localPaths = new Set(localFiles.map(f => f.path));

    // Creates and modifies
    for (const file of localFiles) {
      const content = await this.vault.readBinary(file);
      const hash = await computeHash(content);
      const entry = this.syncState[file.path];

      if (!entry) {
        // New file
        ops.push({
          type: 'create',
          path: file.path,
          content: arrayBufferToBase64(content),
        });
      } else if (hash !== entry.hash) {
        // Modified
        ops.push({
          type: 'modify',
          path: file.path,
          content: arrayBufferToBase64(content),
          file_id: entry.file_id,
        });
      }
    }

    // Deletes: files in syncState that no longer exist locally
    for (const syncPath of Object.keys(this.syncState)) {
      if (!localPaths.has(syncPath) && shouldSyncFile(syncPath)) {
        ops.push({
          type: 'delete',
          path: syncPath,
          file_id: this.syncState[syncPath].file_id,
        });
      }
    }

    return ops;
  }

  private updateSyncStateFromPush(operations: PushOperation[], result: PushResponse) {
    for (let i = 0; i < operations.length; i++) {
      const op = operations[i];
      const r = result.results[i];
      if (!r?.success) continue;

      if (op.type === 'delete') {
        delete this.syncState[op.path];
      } else {
        this.syncState[op.path] = {
          hash: r.hash || '',
          commit: result.head_commit,
          file_id: r.file_id,
        };
      }
    }
  }

  // --- Network ---

  private async fetchStatus(): Promise<StatusResponse> {
    const localHashes: Record<string, string> = {};
    for (const [path, entry] of Object.entries(this.syncState)) {
      localHashes[path] = entry.hash;
    }
    return this.backend.fetchStatus(this.lastSyncedCommit, localHashes);
  }

  // --- Persistence ---

  private async saveSyncState() {
    this.lastBackend = this.settings.backend;
    await this.saveDataFn({
      syncState: this.syncState,
      lastSyncedCommit: this.lastSyncedCommit,
      lastBackend: this.lastBackend,
    });
  }

  // --- Utilities ---

  private async ensureFolder(folderPath: string) {
    const existing = this.vault.getAbstractFileByPath(folderPath);
    if (existing) return;

    // Create parent folders recursively
    const parts = folderPath.split('/');
    let current = '';
    for (const part of parts) {
      current = current ? `${current}/${part}` : part;
      const folder = this.vault.getAbstractFileByPath(current);
      if (!folder) {
        await this.vault.createFolder(current);
      }
    }
  }
}
