# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What is Scion

Self-hosted Obsidian vault sync — a free replacement for Obsidian Sync. A Fastify server (typically on a Raspberry Pi) acts as source of truth; Obsidian plugins on each device sync via REST + WebSocket over Tailscale.

## Repository Structure

Two independent modules with separate `package.json`, `tsconfig.json`, and build systems:

- **`server/`** — Node.js Fastify backend (ES modules, `tsx` for dev)
- **`obsidian-plugin/`** — Obsidian plugin client (CommonJS bundle via esbuild)

Both share Yjs (CRDT library) for real-time collaborative editing but have no shared code directory.

## Commands

### Server (`cd server`)

```bash
npm run dev          # Hot-reload dev server (tsx watch)
npm run build        # TypeScript compile to dist/
npm run start        # Run compiled server (node dist/index.js)
npm test             # Run integration tests (basic + multi-client)
node test/rename.test.js    # Run single test file
node test/v2-sync.test.js   # Run V2 protocol tests
```

### Plugin (`cd obsidian-plugin`)

```bash
npm run dev          # Watch build (esbuild, outputs main.js)
npm run build        # Production build
```

To test the plugin: copy `main.js`, `manifest.json`, and `styles.css` into your Obsidian vault's `.obsidian/plugins/scion-sync/` directory and reload Obsidian.

## Architecture

### Storage Layers (Server)

Three layers work together per vault (each vault is isolated):

1. **Git repository** — Every file change is auto-committed. Provides full history for three-way merge (`git merge-file`) and disaster recovery. HEAD commit = server state.
2. **SQLite** (`better-sqlite3`, WAL mode) — Metadata at `.scion/metadata.db`. `files` table maps UUID `file_id` → `current_path`, `content_hash`, `git_commit`. `path_history` tracks renames.
3. **File system** — Raw vault files on disk at `VAULT_PATH`.

### Sync Protocol

Two versions coexist:

- **V1** (`POST /vault/:name/sync`) — Single file three-way merge. Client sends `path`, `content` (base64), `base_commit`. Server determines: fast-forward, clean merge, or conflict with markers (`<<<<<<< LOCAL` / `>>>>>>> REMOTE`).
- **V2** (`POST /vault/:name/sync/v2`) — Batch operations (`create`/`modify`/`rename`/`delete`) with optional `atomic: true` for all-or-nothing transactions.

### Real-Time Sync

- **WebSocket** (`/vault/:name/ws`) — Default. Server-side `WebSocketManager` broadcasts Yjs updates, structure changes, and binary diffs to all connected devices except sender. 30s heartbeat, 60s timeout.
- **Polling fallback** (`GET /vault/:name/status?since=commit`) — Client polls every 30s (configurable 5–120s). Returns changed files since given commit.

### CRDT Layer

- **Yjs** for text content — Per-file `Y.Doc` with `Y.Text('content')`. Incremental sync via state vectors.
- **Structure CRDT** — `Y.Map` tracking file/folder existence with tombstone deletions.
- Binary files use hash comparison instead of Yjs.

### Conflict Resolution

Configurable in plugin settings (`conflictMode`):
- `merge` — Three-way merge with conflict markers (default)
- `ask` — Show modal for each conflict
- `local` / `remote` — Always prefer one side

### Offline Support

Plugin's `OfflineQueue` persists operations to Obsidian plugin data. Deduplicates by file+type, retries up to 3 times with 5s intervals, processes oldest-first on reconnect.

### File Identity

Files are tracked by UUID (`file_id`) that survives renames. Rename detection: client reports missing file hash → server searches git history → returns old path + file_id → client confirms rename.

## Key Server Files

| File | Responsibility |
|------|---------------|
| `server.ts` | All REST/WebSocket route handlers |
| `db.ts` | Git operations, `commitFile`, `mergeFile`, `getChangesSince` |
| `metadata.ts` | SQLite schema, file UUID management, path history |
| `operations.ts` | V2 batch operation processing |
| `websocket.ts` | `WebSocketManager` — client lifecycle, broadcast, heartbeat |
| `yjs-sync.ts` / `yjs-store.ts` | Yjs document persistence and update handling |
| `structure-sync.ts` / `structure-crdt.ts` | File tree CRDT sync |
| `binary-sync.ts` | Binary file hash comparison and conflict handling |

## Key Plugin Files

| File | Responsibility |
|------|---------------|
| `main.ts` | Plugin lifecycle, settings UI, status bar, conflict/status modals |
| `sync-service.ts` | Core orchestrator — file watcher, upload/download, conflict detection |
| `websocket-client.ts` | WebSocket connection with auto-reconnect (exponential backoff, max 30s) |
| `offline-queue.ts` | Persistent offline operation queue |
| `yjs-manager.ts` | Per-file Y.Doc management |
| `structure-crdt.ts` | Client-side file tree CRDT (mirrors server) |

## Environment Variables

```
PORT=3000              # Server port
HOST=0.0.0.0           # Bind address
LOG_LEVEL=info         # info|debug|trace|warn|error
VAULT_PATH=./vault     # Where vaults are stored (Docker: /data/vault)
```

## Deployment

Docker multi-stage build (`server/Dockerfile` + `server/docker-compose.yml`). Node 20 Alpine, non-root user `scion:1001`, health check on `/health`. Designed for Raspberry Pi behind Tailscale.

## Multi-Vault Support

Each vault is fully isolated: own git repo, own SQLite database, own WebSocket connections. Vault names are validated against `/^[a-zA-Z0-9_\- ]+$/` to prevent path traversal.

## No Authentication

Security relies on Tailscale network isolation. CORS is open (intentional for self-hosted). No bearer tokens currently implemented.
