# Scion Sync — Obsidian Plugin

Self-hosted vault sync plugin for [Obsidian](https://obsidian.md). Works on desktop (macOS/Windows/Linux) and mobile (iOS/Android).

Syncs your vault to a [Scion server](../README.md) over REST. Designed for use over [Tailscale](https://tailscale.com) — no cloud, no subscription.

## Installation

### Via BRAT (recommended)

1. Install the [BRAT](https://github.com/TfTHacker/obsidian42-brat) community plugin
2. Add `lavishmantri/scion` as a beta plugin
3. Enable "Scion Sync" in Settings > Community Plugins

### Manual

```bash
npm install
npm run build
```

Copy `main.js`, `manifest.json`, and `styles.css` to `<vault>/.obsidian/plugins/scion-sync/`.

## Settings

| Setting | Default | Description |
|---------|---------|-------------|
| Server URL | `http://localhost:3000` | Scion server address. Use your Tailscale hostname for remote devices (e.g. `https://rpi.tail1234.ts.net`). |
| Poll interval | 300s | How often to check for remote changes (30–600s) |
| Edit debounce | 3s | Wait after editing before syncing (1–10s) |
| Auto-sync | On | Sync changes automatically in background |
| Sync on startup | On | Full sync when Obsidian opens |

## Commands

| Command | Description |
|---------|-------------|
| `Scion Sync: Sync Now` | Trigger full pull + push |
| `Scion Sync: Toggle Auto-Sync` | Enable/disable background sync |
| `Scion Sync: Show Sync Status` | Server connection info and sync stats |
| `Scion Sync: Show Conflict Files` | List `.conflict.*` files for manual resolution |

## How Sync Works

1. **Pull**: Plugin polls `GET /vault/:name/status` for changes. On first sync or when behind, it fetches the full manifest and downloads missing/updated files.
2. **Push**: After pulling, the plugin compares local files against its sync state (SHA-256 hashes). Changed files are pushed as a batch via `POST /vault/:name/push`.
3. **Conflicts**: If both local and server changed the same file, the server version wins and the local version is saved as `filename.conflict.ext`.
4. **Renames**: File renames are detected as delete + create and pushed accordingly.

The server rejects stale pushes (409) if another client pushed in the meantime. The plugin automatically re-pulls and retries (up to 3 times).

## Architecture

```
src/
├── main.ts          # Plugin lifecycle, settings tab, status bar, modals
└── sync-service.ts  # Core sync engine
```

### `main.ts`

- Registers commands, ribbon icon, and settings tab
- Manages plugin data persistence (`syncState`, `lastSyncedCommit`)
- Status bar shows sync state: Ready / Syncing / Synced / Error

### `sync-service.ts`

- **`syncAll()`** — Main sync loop: pull phase then push phase
- **`pullFullManifest()`** — First-time sync: download all files from server
- **`handlePulledFile()`** — Write server file locally, handle conflicts
- **`collectLocalChanges()`** — Diff local files against sync state
- **`push()`** — POST batch operations to server
- **File watcher** — Debounced sync on create/modify/delete/rename events

### Mobile Compatibility

The plugin uses only Web APIs — no Node.js `crypto` or `Buffer`:
- **Hashing**: `crypto.subtle.digest('SHA-256', ...)` (Web Crypto API)
- **Base64**: `Uint8Array` + `btoa()`
- **Fetch**: Standard `fetch()` with `AbortController` timeout

## Development

```bash
npm run dev    # Watch mode (rebuilds on file changes)
npm run build  # Production build
```

The build output is `main.js` (CommonJS bundle via esbuild). To test locally, symlink or copy to your vault's plugin directory:

```bash
ln -sf "$(pwd)/main.js" "<vault>/.obsidian/plugins/scion-sync/main.js"
```

Then reload Obsidian (Cmd+R / Ctrl+R) to pick up changes.
