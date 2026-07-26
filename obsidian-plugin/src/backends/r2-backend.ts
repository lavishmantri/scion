import { requestUrl } from 'obsidian';
import { AwsClient } from 'aws4fetch';
import {
  SyncBackend,
  ManifestResponse,
  RemoteFile,
  StatusResponse,
  FileRecord,
  PushOperation,
  PushResponse,
  PushOperationResult,
} from './backend';

export interface R2Config {
  accountId: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
}

interface Manifest {
  version: 1;
  files: Record<string, { hash: string; size: number }>;
  deleted: Record<string, { at: number }>;
}

const EMPTY_MANIFEST: Manifest = { version: 1, files: {}, deleted: {} };

/**
 * Talks directly to a Cloudflare R2 bucket via the S3 API — no server, no
 * running process. `manifest.json` plays the role the Pi's git+SQLite
 * plays: it is the one object every client reconciles against, and its
 * ETag is the "base_commit" for optimistic-concurrency pushes (PUT ... If-Match).
 *
 * Object layout: <vault>/manifest.json, <vault>/files/<path>.
 *
 * ponytail: no LIST call anywhere in this file, on purpose — LIST is a
 * billed Class A op and the manifest exists specifically so this backend
 * never needs one. Do not add one to "double check" state; trust the manifest.
 */
export class R2Backend implements SyncBackend {
  private aws: AwsClient;
  private endpoint: string;

  constructor(private config: R2Config, private vaultName: string) {
    this.aws = new AwsClient({
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
      service: 's3',
      region: 'auto',
    });
    this.endpoint = `https://${config.accountId}.r2.cloudflarestorage.com/${config.bucket}`;
  }

  private key(...parts: string[]): string {
    return `${this.vaultName}/${parts.join('/')}`;
  }

  // --- Signed request helper ---
  //
  // Signs with aws4fetch (SigV4, Web Crypto — works on iOS), then dispatches
  // via Obsidian's requestUrl rather than fetch. requestUrl runs outside the
  // webview's fetch sandbox, so it isn't subject to CORS — R2 needs no CORS
  // policy for this plugin to work. If requestUrl is ever found to mutate
  // headers (breaking the SigV4 signature), fall back to plain fetch() plus
  // a CORS policy on the bucket exposing ETag.
  private async signedRequest(
    method: string,
    key: string,
    opts: { body?: ArrayBuffer | string; headers?: Record<string, string> } = {}
  ) {
    const url = `${this.endpoint}/${key}`;
    const signed = await this.aws.sign(url, {
      method,
      body: opts.body,
      headers: opts.headers,
    });
    const headers: Record<string, string> = {};
    signed.headers.forEach((v, k) => (headers[k] = v));

    return requestUrl({
      url: signed.url,
      method,
      headers,
      body: opts.body as any,
      throw: false,
    });
  }

  private async getManifest(): Promise<{ manifest: Manifest; etag: string | null }> {
    const resp = await this.signedRequest('GET', this.key('manifest.json'));
    if (resp.status === 404) {
      return { manifest: EMPTY_MANIFEST, etag: null };
    }
    if (resp.status < 200 || resp.status >= 300) {
      throw new Error(`R2 manifest fetch failed: ${resp.status}`);
    }
    const etag = resp.headers['etag'] || resp.headers['ETag'] || null;
    return { manifest: JSON.parse(resp.text) as Manifest, etag };
  }

  async fetchManifest(): Promise<ManifestResponse> {
    const { manifest, etag } = await this.getManifest();
    const files: FileRecord[] = Object.entries(manifest.files).map(([path, entry]) => ({
      path,
      hash: entry.hash,
      commit: etag || '',
      updated_at: 0,
    }));
    return { files, head_commit: etag || '' };
  }

  async fetchFile(filePath: string): Promise<RemoteFile | null> {
    const resp = await this.signedRequest('GET', this.key('files', filePath));
    if (resp.status < 200 || resp.status >= 300) {
      console.warn(`R2Backend: Failed to download ${filePath}: ${resp.status}`);
      return null;
    }
    return { content: resp.arrayBuffer, commit: resp.headers['etag'] || '' };
  }

  async fetchStatus(sinceCommit: string | null, localHashes: Record<string, string>): Promise<StatusResponse> {
    // R2 has no git history to diff against, unlike the Pi server's
    // `?since=<commit>`. Instead: pull the (small — this vault is well
    // under 1MB) manifest and diff its file hashes against `localHashes`
    // (SyncService's syncState). This is one GET regardless of vault size,
    // and — critically — it's the ONLY GET on a no-op sync: when nothing
    // changed, every hash matches, `changes` comes back empty, and
    // head_commit === sinceCommit short-circuits the incremental-pull loop
    // in SyncService before it can touch a single file body.
    const { manifest, etag } = await this.getManifest();
    const head_commit = etag || '';

    const changes: StatusResponse['changes'] = [];
    for (const [path, entry] of Object.entries(manifest.files)) {
      if (localHashes[path] !== entry.hash) {
        changes.push({ path, status: localHashes[path] ? 'modified' : 'added' });
      }
    }
    for (const path of Object.keys(localHashes)) {
      if (!(path in manifest.files)) {
        changes.push({ path, status: 'deleted' });
      }
    }

    return { head_commit, has_changes: changes.length > 0, changes };
  }

  async push(baseCommit: string | null, operations: PushOperation[]): Promise<PushResponse | 'stale'> {
    const { manifest, etag } = await this.getManifest();
    if ((etag || '') !== (baseCommit || '')) {
      return 'stale';
    }

    const nextManifest: Manifest = {
      version: 1,
      files: { ...manifest.files },
      deleted: { ...manifest.deleted },
    };
    const results: PushOperationResult[] = [];

    // 1. Write bodies first, manifest last — a crash mid-push leaves at
    // worst an orphaned object (harmless, storage is free), never a
    // manifest that points at a body that isn't there yet.
    for (let i = 0; i < operations.length; i++) {
      const op = operations[i];
      if (op.type === 'delete') {
        delete nextManifest.files[op.path];
        nextManifest.deleted[op.path] = { at: 0 };
        results.push({ index: i, success: true });
        continue;
      }

      const body = base64ToArrayBuffer(op.content || '');
      const hash = await sha256Hex(body);
      const putResp = await this.signedRequest('PUT', this.key('files', op.path), { body });
      if (putResp.status < 200 || putResp.status >= 300) {
        results.push({ index: i, success: false, error: `PUT failed: ${putResp.status}` });
        continue;
      }
      delete nextManifest.deleted[op.path];
      nextManifest.files[op.path] = { hash, size: body.byteLength };
      results.push({ index: i, success: true, hash });
    }

    // 2. Conditional manifest write — this is the optimistic-concurrency
    // check. If-None-Match: '*' on first-ever write (etag === null), else
    // If-Match against the etag we read at the top of this function.
    const manifestBody = JSON.stringify(nextManifest);
    const headers: Record<string, string> = { 'content-type': 'application/json' };
    if (etag) {
      headers['if-match'] = etag;
    } else {
      headers['if-none-match'] = '*';
    }
    const putManifestResp = await this.signedRequest('PUT', this.key('manifest.json'), {
      body: manifestBody,
      headers,
    });

    if (putManifestResp.status === 412) {
      return 'stale';
    }
    if (putManifestResp.status < 200 || putManifestResp.status >= 300) {
      throw new Error(`R2 manifest push failed: ${putManifestResp.status}`);
    }

    const newEtag = putManifestResp.headers['etag'] || putManifestResp.headers['ETag'] || '';

    // 3. Best-effort delete of tombstoned bodies. The tombstone in the
    // manifest is already durable at this point — an orphaned object here
    // costs storage (free at this scale), so failure is not fatal.
    for (const op of operations) {
      if (op.type === 'delete') {
        await this.signedRequest('DELETE', this.key('files', op.path)).catch(() => {});
      }
    }

    return { success: true, head_commit: newEtag, results };
  }
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

async function sha256Hex(content: ArrayBuffer): Promise<string> {
  const hashBuffer = await crypto.subtle.digest('SHA-256', content);
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
}
