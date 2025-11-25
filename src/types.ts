/**
 * Type definitions for Vault Sync v2 plugin
 */

export interface VaultSyncV2Settings {
  // Server configuration
  serverUrl: string;        // e.g., http://localhost:3000
  apiKey: string;           // API key for server authentication

  // Sync behavior
  nosyncPath: string;       // Path to .nosync file (default: '.nosync')

  // UI settings
  enableLogging: boolean;
  showNotifications: boolean;
}

export const DEFAULT_V2_SETTINGS: VaultSyncV2Settings = {
  serverUrl: 'http://localhost:3000',
  apiKey: '',
  nosyncPath: '.nosync',
  enableLogging: false,
  showNotifications: true
};

export enum SyncStatus {
  Idle = 'idle',
  Pushing = 'pushing',
  Pulling = 'pulling',
  Error = 'error'
}

export interface FileInfo {
  path: string;
  hash: string;
  size: number;
}

export interface SyncDiff {
  localOnly: FileInfo[];     // Files only in vault
  remoteOnly: FileInfo[];    // Files only on server
  conflicts: FileConflict[]; // Files with different content
}

export interface FileConflict {
  path: string;
  localHash: string;
  remoteHash: string;
}

export interface ServerResponse {
  success?: boolean;
  error?: string;
  files?: FileInfo[];
  path?: string;
  hash?: string;
  size?: number;
  message?: string;
}

export interface SyncOperation {
  type: 'push' | 'pull';
  filesProcessed: number;
  filesTotal: number;
  startTime: number;
}
