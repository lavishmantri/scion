import {
  SyncBackend,
  ManifestResponse,
  RemoteFile,
  StatusResponse,
  PushOperation,
  PushResponse,
} from './backend';

const FETCH_TIMEOUT_MS = 30_000;

/**
 * Talks to the scion Fastify server (git + SQLite on the Pi). This is the
 * original transport, unchanged in behavior — every request, header, and
 * status code below is identical to what SyncService did inline before the
 * backend split. If this backend's behavior ever drifts from the pre-split
 * plugin, that's a regression, not a feature.
 */
export class HttpBackend implements SyncBackend {
  constructor(private serverUrl: string, private deviceName: string, private vaultName: string) {}

  async fetchManifest(): Promise<ManifestResponse> {
    const resp = await this.fetchWithTimeout(
      `${this.serverUrl}/vault/${encodeURIComponent(this.vaultName)}/manifest`
    );
    if (!resp.ok) throw new Error(`Manifest fetch failed: ${resp.status}`);
    return await resp.json();
  }

  async fetchFile(filePath: string): Promise<RemoteFile | null> {
    const resp = await this.fetchWithTimeout(
      `${this.serverUrl}/vault/${encodeURIComponent(this.vaultName)}/file/${encodeURIComponent(filePath)}`
    );
    if (!resp.ok) {
      console.warn(`HttpBackend: Failed to download ${filePath}: ${resp.status}`);
      return null;
    }
    const content = await resp.arrayBuffer();
    const commit = resp.headers.get('X-File-Commit') || '';
    return { content, commit };
  }

  async fetchStatus(sinceCommit: string | null, _localHashes: Record<string, string>): Promise<StatusResponse> {
    const since = sinceCommit ? `?since=${sinceCommit}` : '';
    const resp = await this.fetchWithTimeout(
      `${this.serverUrl}/vault/${encodeURIComponent(this.vaultName)}/status${since}`
    );
    if (!resp.ok) throw new Error(`Status fetch failed: ${resp.status}`);
    return await resp.json();
  }

  async push(baseCommit: string | null, operations: PushOperation[]): Promise<PushResponse | 'stale'> {
    const resp = await this.fetchWithTimeout(
      `${this.serverUrl}/vault/${encodeURIComponent(this.vaultName)}/push`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          base_commit: baseCommit,
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

  private async fetchWithTimeout(url: string, options?: RequestInit): Promise<Response> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    const headers = new Headers(options?.headers);
    if (this.deviceName) {
      headers.set('X-Scion-Device', this.deviceName);
    }
    try {
      return await fetch(url, { ...options, headers, signal: controller.signal });
    } finally {
      clearTimeout(timeout);
    }
  }
}
