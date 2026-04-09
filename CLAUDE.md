# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What is Scion

Self-hosted Obsidian vault sync — a free replacement for Obsidian Sync. A Fastify server (typically on a Raspberry Pi) acts as source of truth; Obsidian plugins on each device sync via REST over Tailscale.

## Repository Structure

Two independent modules with separate `package.json`, `tsconfig.json`, and build systems:

- **`server/`** — Node.js Fastify backend (ES modules, `tsx` for dev)
- **`obsidian-plugin/`** — Obsidian plugin client (CommonJS bundle via esbuild)

No shared code directory. Both use the same pull-before-push REST protocol.

## Commands

### Server (`cd server`)

```bash
npm run dev          # Hot-reload dev server (tsx watch)
npm run build        # TypeScript compile to dist/
npm run start        # Run compiled server (node dist/index.js)
npm test             # Run 2 of 4 test files (basic + multi-client only)
node test/rename.test.js    # Rename tests (not in npm test)
node test/v2-sync.test.js   # V2 protocol tests (not in npm test)
```

Tests use plain Node.js (`node:assert` style) with a custom `SyncClient` helper in `test/helpers.js` — no jest/mocha/vitest. `helpers.js` exports `SyncClient`, `runTests`, `assert`, `assertEqual`, `computeHash`.

> **Known issue**: `test/helpers.js` still calls the removed V1 `POST /sync` endpoint (line 33). All tests fail until it's updated to use the V2 `POST /vault/:name/push` endpoint.

### Plugin (`cd obsidian-plugin`)

```bash
npm run dev          # Watch build (esbuild, outputs main.js)
npm run build        # Production build
```

To test the plugin: copy `main.js`, `manifest.json`, and `styles.css` into your Obsidian vault's `.obsidian/plugins/scion-sync/` directory and reload Obsidian.

## Architecture

### Storage Layers (Server)

Three layers work together per vault (each vault is isolated):

1. **Git repository** — Every file change is auto-committed. HEAD commit = server state. Provides full history and disaster recovery.
2. **SQLite** (`better-sqlite3`, WAL mode, `synchronous=FULL`) — Metadata at `.scion/metadata.db`. `files` table maps UUID `file_id` → `current_path`, `content_hash`, `git_commit`. `path_history` tracks renames. Integrity-checked on startup with auto-rebuild from manifest.
3. **File system** — Raw vault files on disk at `VAULT_PATH`. All writes are fsynced before git staging.

### Sync Protocol (Pull-Before-Push)

Single protocol:

1. Client pulls server manifest (`GET /vault/:name/manifest`) or polls for changes (`GET /vault/:name/status?since=commit`)
2. Client diffs locally against its sync state
3. Client downloads any server-side changes (`GET /vault/:name/file/*`)
4. Client pushes local changes as a batch (`POST /vault/:name/push`) with `base_commit`
5. Server rejects stale pushes (409) if `base_commit` != HEAD — client must re-pull

All push operations (create/modify/rename/delete) are applied atomically in a single git commit. A per-vault mutex (`VaultLock`) serializes concurrent pushes.

### File Identity

Files are tracked by UUID (`file_id`) that survives renames. Rename detection uses three strategies:
1. UUID lookup (if client provides `file_id`)
2. Content hash matching (same content at different path)
3. Path history search (file renamed multiple times)

### Durability (RPi Hardening)

- SQLite: `synchronous=FULL`, integrity check on startup, auto-rebuild from `manifest.json` on corruption
- Files: fsync after every write before git staging
- Manifest: atomic write-then-rename (never half-written)
- Git: dirty state cleanup on startup (crash recovery), `gc --auto` after pushes
- Docker: 10s graceful shutdown, 2s startup delay for filesystem settle

## Key Server Files (`server/src/`)

| File | Responsibility |
|------|---------------|
| `server.ts` | All REST route handlers |
| `db.ts` | Git operations, `commitFile`, `getChangesSince`, `detectRename`, `gitGcAuto` |
| `metadata.ts` | SQLite schema, file UUID management, path history, manifest, `rebuildFromManifest` |
| `push-operations.ts` | Batch operation processing (create/modify/rename/delete) with fsync |
| `vault-lock.ts` | Per-vault mutex to serialize write operations |
| `config.ts` | Environment variable configuration |
| `index.ts` | Entrypoint, graceful shutdown handlers |

## Key Plugin Files (`obsidian-plugin/src/`)

| File | Responsibility |
|------|---------------|
| `main.ts` | Plugin lifecycle, settings UI, status bar, sync status modal, conflict list modal |
| `sync-service.ts` | Core orchestrator — pull manifest, diff, download changes, push local changes, file watcher |

## Environment Variables

```
PORT=3000              # Server port
HOST=0.0.0.0           # Bind address
LOG_LEVEL=info         # info|debug|trace|warn|error
VAULT_PATH=./vault     # Where vaults are stored (Docker: /data/vault)
```

## Deployment

Docker multi-stage build (`server/Dockerfile` + `server/docker-compose.yml`). Node 20 Alpine, non-root user `scion:1001`, health check on `/health`. Designed for Raspberry Pi behind Tailscale. See `HARDWARE.md` for full RPi 4 setup guide.

## Multi-Vault Support

Each vault is fully isolated: own git repo, own SQLite database. Vault names are validated against `/^[a-zA-Z0-9_\- ]+$/` to prevent path traversal.

## No Authentication

Security relies on Tailscale network isolation. CORS is open (intentional for self-hosted). No bearer tokens currently implemented.
