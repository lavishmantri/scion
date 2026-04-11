import { App, Notice, TFile, TFolder, Vault, EventRef } from 'obsidian';

// --- Types ---

interface SyncStateEntry {
  hash: string;
  commit: string;
  file_id?: string;
}

interface SyncState {
  [path: string]: SyncStateEntry;
}

interface FileChange {
  path: string;
  status: 'added' | 'modified' | 'deleted' | 'renamed';
  old_path?: string;
}

interface StatusResponse {
  head_commit: string;
  changes: FileChange[];
  has_changes: boolean;
}

interface FileRecord {
  path: string;
  hash: string;
  commit: string;
  updated_at: number;
  file_id?: string;
}

interface ManifestResponse {
  files: FileRecord[];
  head_commit: string;
}

type PushOperationType = 'create' | 'modify' | 'rename' | 'delete';

interface PushOperation {
  type: PushOperationType;
  path: string;
  content?: string; // base64
  file_id?: string;
  old_path?: string;
}

interface PushResult {
  index: number;
  success: boolean;
  file_id?: string;
  hash?: string;
  error?: string;
}

interface PushResponse {
  success: boolean;
  head_commit: string;
  results: PushResult[];
}

export interface ScionSyncSettings {
  serverUrl: string;
  pollInterval: number; // seconds (30-600, default 300)
  autoSync: boolean;
  syncOnStartup: boolean;
  debounceInterval: number; // seconds to wait after edit before syncing
}

export type SyncStatus = 'idle' | 'syncing' | 'success' | 'error';

const FETCH_TIMEOUT_MS = 30_000;
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

// --- SyncService ---

export class SyncService {
  private app: App;
  private vault: Vault;
  private settings: ScionSyncSettings;
  private vaultName: string;
  private syncState: SyncState;
  private lastSyncedCommit: string | null = null;
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
    saveDataFn: (data: unknown) => Promise<void>
  ) {
    this.app = app;
    this.vault = app.vault;
    this.settings = settings;
    this.vaultName = vaultName;
    this.syncState = syncState || {};
    this.lastSyncedCommit = lastSyncedCommit;
    this.saveDataFn = saveDataFn;
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
    this.settings = settings;
    this.stopPolling();
    if (settings.autoSync) {
      this.startPolling();
    }
  }

  getStats() {
    return {
      trackedFiles: Object.keys(this.syncState).length,
      lastCommit: this.lastSyncedCommit,
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

    const onRename = (file: TFile | TFolder, oldPath: string) => {
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

  async syncAll(retryCount = 0): Promise<void> {
    if (this.syncLock !== 'unlocked') return;

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

      const pushResult = await this.push(operations);

      if (pushResult === 'stale') {
        this.syncLock = 'unlocked';
        if (retryCount < MAX_RETRY) {
          console.log(`SyncService: Stale push, retrying (${retryCount + 1}/${MAX_RETRY})`);
          return this.syncAll(retryCount + 1);
        }
        this.emitStatus('error', 'Push failed: server changed. Try again.');
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
    const resp = await this.fetchWithTimeout(
      `${this.settings.serverUrl}/vault/${encodeURIComponent(this.vaultName)}/manifest`
    );
    if (!resp.ok) throw new Error(`Manifest fetch failed: ${resp.status}`);
    const data: ManifestResponse = await resp.json();

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

    // Download server version
    const resp = await this.fetchWithTimeout(
      `${this.settings.serverUrl}/vault/${encodeURIComponent(this.vaultName)}/file/${encodeURIComponent(filePath)}`
    );
    if (!resp.ok) {
      console.warn(`SyncService: Failed to download ${filePath}: ${resp.status}`);
      return;
    }

    const serverContent = await resp.arrayBuffer();
    const serverHash = resp.headers.get('X-File-Hash') || computeHash(serverContent);
    const serverCommit = resp.headers.get('X-File-Commit') || '';

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
      commit: serverCommit,
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
        new Notice(`Server deleted ${filePath} but local has changes. Keeping local.`);
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

  private async push(operations: PushOperation[]): Promise<PushResponse | 'stale'> {
    const resp = await this.fetchWithTimeout(
      `${this.settings.serverUrl}/vault/${encodeURIComponent(this.vaultName)}/push`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          base_commit: this.lastSyncedCommit,
          operations,
        }),
      }
    );

    if (resp.status === 409) {
      return 'stale';
    }

    if (!resp.ok) {
      const body = await resp.text();
      throw new Error(`Push failed (${resp.status}): ${body}`);
    }

    return await resp.json();
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
    const since = this.lastSyncedCommit ? `?since=${this.lastSyncedCommit}` : '';
    const resp = await this.fetchWithTimeout(
      `${this.settings.serverUrl}/vault/${encodeURIComponent(this.vaultName)}/status${since}`
    );
    if (!resp.ok) throw new Error(`Status fetch failed: ${resp.status}`);
    return await resp.json();
  }

  private async fetchWithTimeout(url: string, options?: RequestInit): Promise<Response> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      return await fetch(url, { ...options, signal: controller.signal });
    } finally {
      clearTimeout(timeout);
    }
  }

  // --- Persistence ---

  private async saveSyncState() {
    await this.saveDataFn({
      syncState: this.syncState,
      lastSyncedCommit: this.lastSyncedCommit,
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
