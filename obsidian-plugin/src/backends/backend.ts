// Transport-agnostic wire types shared by every backend. SyncService only
// ever sees these shapes — it does not know whether they came from the Pi's
// HTTP API or from an R2 manifest diff.

export type PushOperationType = 'create' | 'modify' | 'delete';
// Note: the client never emits 'rename' — collectLocalChanges() in
// sync-service.ts always reports a rename as delete(old) + create(new).
// 'renamed' only appears in a *pulled* StatusResponse, produced by the
// server's own git history (HttpBackend). R2Backend never produces it,
// since there's no git — a rename over R2 is a tombstone + a new object,
// which shows up as ordinary 'deleted' + 'added' changes.

export interface PushOperation {
  type: PushOperationType;
  path: string;
  content?: string; // base64
  file_id?: string;
}

export interface PushOperationResult {
  index: number;
  success: boolean;
  file_id?: string;
  hash?: string;
  error?: string;
}

export interface PushResponse {
  success: boolean;
  head_commit: string;
  results: PushOperationResult[];
}

export interface FileChange {
  path: string;
  status: 'added' | 'modified' | 'deleted' | 'renamed';
  old_path?: string;
}

export interface StatusResponse {
  head_commit: string;
  changes: FileChange[];
  has_changes: boolean;
}

export interface FileRecord {
  path: string;
  hash: string;
  commit: string;
  updated_at: number;
  file_id?: string;
}

export interface ManifestResponse {
  files: FileRecord[];
  head_commit: string;
}

export interface RemoteFile {
  content: ArrayBuffer;
  commit?: string;
}

/** Thrown by push() when the remote changed underneath the client (HTTP 409 / R2 412). */
export class StaleWriteError extends Error {
  constructor() {
    super('Remote changed since last pull');
  }
}

/**
 * A SyncBackend is the only thing in the plugin allowed to know about
 * transport: HTTP verbs, status codes, request signing, etc. SyncService
 * drives the sync algorithm (conflict detection, deletion safety, retry)
 * purely against this interface.
 */
export interface SyncBackend {
  fetchManifest(): Promise<ManifestResponse>;
  fetchFile(path: string): Promise<RemoteFile | null>;
  /**
   * `localHashes` (path -> content hash, from SyncService's syncState) is
   * only consumed by backends with no server-side diff of their own — see
   * R2Backend. HttpBackend ignores it: the Pi server already computes the
   * change list from git history via `since`, which is unaffected by this
   * parameter's existence.
   */
  fetchStatus(sinceCommit: string | null, localHashes: Record<string, string>): Promise<StatusResponse>;
  push(baseCommit: string | null, operations: PushOperation[]): Promise<PushResponse | 'stale'>;
}
