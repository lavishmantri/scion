# Scion

Self-hosted Obsidian vault sync. A free replacement for [Obsidian Sync](https://obsidian.md/sync).

A Fastify server (typically on a Raspberry Pi) acts as source of truth. Obsidian plugins on each device sync via REST over [Tailscale](https://tailscale.com). No cloud, no subscription, no port forwarding.

## How It Works

```
Mac (Obsidian)  ──┐
                   │   pull-before-push
iPhone (Obsidian) ─┼──── REST/HTTP ────── Scion Server (RPi 4)
                   │                       ├── git (history)
CLI / Bot ────────┘                       ├── SQLite (metadata)
                                           └── filesystem (files)
      All traffic over Tailscale (encrypted, private)
```

**Pull-before-push protocol**: clients pull the server manifest, diff locally, then push changes as a batch. The server rejects stale pushes (optimistic concurrency via git commit hashes). No merge logic on the server — clients resolve conflicts before pushing.

## Repository Structure

```
scion/
├── server/              # Node.js Fastify backend (ES modules)
│   ├── src/
│   │   ├── server.ts    # REST route handlers
│   │   ├── db.ts        # Git operations, file identity, rename detection
│   │   ├── metadata.ts  # SQLite schema, UUID management, manifest
│   │   ├── push-operations.ts  # Batch create/modify/rename/delete
│   │   ├── vault-lock.ts      # Per-vault mutex for concurrent pushes
│   │   ├── config.ts    # Environment variable config
│   │   └── index.ts     # Entrypoint, graceful shutdown
│   ├── test/            # Integration tests
│   ├── Dockerfile       # Multi-stage Node 20 Alpine
│   └── docker-compose.yml
├── obsidian-plugin/     # Obsidian plugin client (CommonJS via esbuild)
│   └── src/
│       ├── main.ts      # Plugin lifecycle, settings UI, status bar
│       └── sync-service.ts  # Pull/push orchestration, file watching
├── CLAUDE.md            # AI assistant context
└── HARDWARE.md          # Raspberry Pi 4 setup guide (SSD, cooling, UPS)
```

## Quick Start

### 1. Server Setup

**Prerequisites**: Node.js 20+, git

```bash
cd server
npm install
```

**Development** (hot-reload):

```bash
npm run dev
```

The server starts on `http://localhost:3000`. Vaults are stored in `./vault/` by default.

**Production** (compiled):

```bash
npm run build
npm start
```

### 2. Plugin Setup

**Prerequisites**: Node.js 20+

```bash
cd obsidian-plugin
npm install
npm run build
```

This produces `main.js`. Copy it along with `manifest.json` and `styles.css` into your Obsidian vault:

```bash
# Replace <vault> with your Obsidian vault path
mkdir -p <vault>/.obsidian/plugins/scion-sync
cp main.js manifest.json styles.css <vault>/.obsidian/plugins/scion-sync/
```

Restart Obsidian, enable "Scion Sync" in Settings > Community Plugins.

### 3. Configure the Plugin

In Obsidian Settings > Scion Sync:

| Setting | Default | Description |
|---------|---------|-------------|
| Server URL | `http://localhost:3000` | Your Scion server address. Use Tailscale IP for remote access. |
| Poll interval | 300s | How often to check for remote changes (30-600s) |
| Edit debounce | 3s | Wait time after editing before syncing (1-10s) |
| Auto-sync | On | Sync changes automatically in background |
| Sync on startup | On | Full sync when Obsidian opens |

### 4. Docker Deployment (Recommended for Raspberry Pi)

```bash
cd server

# Edit .env or set environment variables
export VAULT_HOST_PATH=/mnt/ssd/scion-vault

docker compose build
docker compose up -d
```

See [HARDWARE.md](HARDWARE.md) for the complete Raspberry Pi 4 setup guide: SSD mounting, cooling, UPS, Tailscale, backups.

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | Server port |
| `HOST` | `0.0.0.0` | Bind address |
| `LOG_LEVEL` | `info` | `trace`, `debug`, `info`, `warn`, `error` |
| `VAULT_PATH` | `./vault` | Where vaults are stored (Docker: `/data/vault`) |

## API

All endpoints are under `/vault/:vaultName/`.

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/health` | Health check |
| `GET` | `/vault/:name/manifest` | List all files with hashes, commit, file_id |
| `GET` | `/vault/:name/status?since=<commit>` | Changes since a commit (for polling) |
| `GET` | `/vault/:name/file/*` | Download file content by path |
| `GET` | `/vault/:name/file-by-id/:fileId` | Download file content by UUID |
| `DELETE` | `/vault/:name/file/*` | Delete a file |
| `POST` | `/vault/:name/push` | Push batch operations (create/modify/rename/delete) |
| `POST` | `/vault/:name/detect-rename` | Check if a missing file was renamed |
| `POST` | `/vault/:name/rename` | Rename a file atomically via git mv |
| `GET` | `/vault/:name/debug` | Debug vault state |

### Push Request

```json
{
  "base_commit": "abc123...",
  "operations": [
    { "type": "create", "path": "notes/new.md", "content": "<base64>" },
    { "type": "modify", "path": "notes/existing.md", "content": "<base64>" },
    { "type": "rename", "path": "notes/renamed.md", "old_path": "notes/old.md" },
    { "type": "delete", "path": "notes/removed.md" }
  ]
}
```

Returns `409` if `base_commit` doesn't match server HEAD (client must re-pull).

## Testing

```bash
cd server
npm test                        # All integration tests
node test/basic.test.js         # Basic CRUD operations
node test/multi-client.test.js  # Concurrent client scenarios
node test/rename.test.js        # Rename detection
node test/v2-sync.test.js       # V2 protocol tests
```

Tests start a real server instance and run HTTP requests against it.

## Architecture

### Storage Layers

Each vault is fully isolated with three storage layers:

1. **Git** — Every file change is auto-committed. HEAD = server state. Provides full history and disaster recovery.
2. **SQLite** (`better-sqlite3`, WAL mode, `synchronous=FULL`) — Metadata at `.scion/metadata.db`. Maps UUID `file_id` to `current_path`, `content_hash`, `git_commit`. Tracks rename history.
3. **Filesystem** — Raw vault files on disk.

### Durability (RPi Hardening)

- SQLite: `synchronous=FULL` (fsync every commit), integrity check on startup, auto-rebuild from `manifest.json` on corruption
- Files: fsync after every write before git staging
- Manifest: atomic write-then-rename (never half-written)
- Git: dirty state cleanup on startup (crash recovery), `gc --auto` after pushes
- Docker: 10s graceful shutdown window, 2s startup delay for filesystem settle

### File Identity

Files are tracked by UUID (`file_id`) that survives renames. Rename detection uses three strategies:
1. UUID lookup (if client provides `file_id`)
2. Content hash matching (same content at different path)
3. Path history search (file renamed multiple times)

### Multi-Vault

Vault names validated against `/^[a-zA-Z0-9_\- ]+$/` to prevent path traversal. Each vault has its own git repo, SQLite database, and lock.

### Security

No authentication — security relies on Tailscale network isolation. CORS is open (intentional for self-hosted). All traffic stays within your Tailscale network.

## Plugin Commands

| Command | Description |
|---------|-------------|
| `Scion Sync: Sync Now` | Trigger full pull + push |
| `Scion Sync: Toggle Auto-Sync` | Enable/disable background sync |
| `Scion Sync: Show Sync Status` | Show server connection and sync stats |
| `Scion Sync: Show Conflict Files` | List files with `.conflict.` in the name |

## License

MIT
