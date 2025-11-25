/**
 * Sync engine for push/pull operations
 */

import { VaultUtils } from './vault-utils';
import { ServerAPI } from './server-api';
import { FileInfo, SyncDiff, FileConflict } from './types';
import { calculateHash } from './utils';

export class SyncEngine {
  private vaultUtils: VaultUtils;
  private serverApi: ServerAPI;

  constructor(vaultUtils: VaultUtils, serverApi: ServerAPI) {
    this.vaultUtils = vaultUtils;
    this.serverApi = serverApi;
  }

  /**
   * Detect changes between local and remote
   */
  async detectChanges(): Promise<SyncDiff> {
    const localFiles = await this.vaultUtils.listVaultFiles();
    const remoteFiles = await this.serverApi.listFiles();

    const localMap = new Map(localFiles.map(f => [f.path, f]));
    const remoteMap = new Map(remoteFiles.map(f => [f.path, f]));

    const localOnly: FileInfo[] = [];
    const remoteOnly: FileInfo[] = [];
    const conflicts: FileConflict[] = [];

    // Find local-only and conflicts
    for (const [path, localFile] of localMap) {
      const remoteFile = remoteMap.get(path);

      if (!remoteFile) {
        localOnly.push(localFile);
      } else if (localFile.hash !== remoteFile.hash) {
        conflicts.push({
          path,
          localHash: localFile.hash,
          remoteHash: remoteFile.hash
        });
      }
    }

    // Find remote-only
    for (const [path, remoteFile] of remoteMap) {
      if (!localMap.has(path)) {
        remoteOnly.push(remoteFile);
      }
    }

    return { localOnly, remoteOnly, conflicts };
  }

  /**
   * Perform push operation (upload local changes)
   */
  async performPush(): Promise<{ uploaded: number; deleted: number; conflicts: FileConflict[] }> {
    const diff = await this.detectChanges();

    // Check for conflicts
    if (diff.conflicts.length > 0) {
      throw new Error(`Conflicts detected:\n${diff.conflicts.map(c => c.path).join('\n')}\n\nPlease resolve manually and retry.`);
    }

    let uploaded = 0;
    let deleted = 0;

    // Upload local-only files
    for (const file of diff.localOnly) {
      try {
        const content = await this.vaultUtils.readFileAsBuffer(file.path);
        await this.serverApi.uploadFile(file.path, content);
        uploaded++;
      } catch (err) {
        console.error(`Failed to upload ${file.path}:`, err);
        throw err;
      }
    }

    // Delete remote-only files
    for (const file of diff.remoteOnly) {
      try {
        await this.serverApi.deleteFile(file.path);
        deleted++;
      } catch (err) {
        console.error(`Failed to delete ${file.path}:`, err);
        throw err;
      }
    }

    return { uploaded, deleted, conflicts: [] };
  }

  /**
   * Perform pull operation (download remote changes)
   */
  async performPull(): Promise<{ downloaded: number; deleted: number; conflicts: FileConflict[] }> {
    const diff = await this.detectChanges();

    // Check for conflicts
    if (diff.conflicts.length > 0) {
      throw new Error(`Conflicts detected:\n${diff.conflicts.map(c => c.path).join('\n')}\n\nPlease resolve manually and retry.`);
    }

    let downloaded = 0;
    let deleted = 0;

    // Ensure directory structure for new files
    for (const file of diff.remoteOnly) {
      await this.vaultUtils.ensureDirectory(file.path);
    }

    // Download remote-only files
    for (const file of diff.remoteOnly) {
      try {
        const content = await this.serverApi.downloadFile(file.path);
        await this.vaultUtils.writeFileFromBuffer(file.path, content);
        downloaded++;
      } catch (err) {
        console.error(`Failed to download ${file.path}:`, err);
        throw err;
      }
    }

    // Delete local-only files
    for (const file of diff.localOnly) {
      try {
        await this.vaultUtils.deleteFile(file.path);
        deleted++;
      } catch (err) {
        console.error(`Failed to delete ${file.path}:`, err);
        throw err;
      }
    }

    return { downloaded, deleted, conflicts: [] };
  }

  /**
   * Get current diff without performing sync
   */
  async getDiff(): Promise<SyncDiff> {
    return this.detectChanges();
  }
}
