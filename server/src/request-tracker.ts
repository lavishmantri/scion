/**
 * In-memory ring buffer tracking last N requests per client.
 * Exposed via GET /admin/clients endpoint.
 */

const MAX_ENTRIES_PER_CLIENT = 50;

export interface RequestEntry {
  timestamp: string;
  method: string;
  operation: string;
  vault: string | null;
  statusCode: number;
  responseTimeMs: number;
  detail?: string;
}

interface ClientState {
  lastSeen: string;
  requestCount: number;
  recent: RequestEntry[];
}

export interface ClientActivity extends ClientState {
  client: string;
}

const clients = new Map<string, ClientState>();

export function recordRequest(client: string, entry: RequestEntry): void {
  let state = clients.get(client);
  if (!state) {
    state = { lastSeen: entry.timestamp, requestCount: 0, recent: [] };
    clients.set(client, state);
  }
  state.lastSeen = entry.timestamp;
  state.requestCount++;
  state.recent.unshift(entry);
  if (state.recent.length > MAX_ENTRIES_PER_CLIENT) {
    state.recent.length = MAX_ENTRIES_PER_CLIENT;
  }
}

export function getClients(): ClientActivity[] {
  const result: ClientActivity[] = [];
  for (const [client, state] of clients) {
    result.push({ client, ...state });
  }
  // Most recently active first
  result.sort((a, b) => b.lastSeen.localeCompare(a.lastSeen));
  return result;
}

/**
 * Classify a request into a human-readable operation name.
 */
export function classifyOperation(method: string, url: string): string {
  if (url === '/health') return 'health';
  if (url.startsWith('/admin/')) return 'admin';

  if (method === 'POST') {
    if (url.includes('/push')) return 'push';
    if (url.includes('/detect-rename')) return 'detect-rename';
    if (url.includes('/rename')) return 'rename';
  }
  if (method === 'DELETE' && url.includes('/file/')) return 'delete';
  if (method === 'GET') {
    if (url.includes('/status')) return 'pull:status';
    if (url.includes('/manifest')) return 'pull:manifest';
    if (url.includes('/file-by-id/')) return 'pull:file-by-id';
    if (url.includes('/file/')) return 'pull:file';
    if (url.includes('/debug')) return 'debug';
  }
  return `${method.toLowerCase()}:unknown`;
}
