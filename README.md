# Vault Sync v2

Manual push/pull synchronization for Obsidian vaults using a custom HTTP server.

## Features

- **Manual Sync**: Push and pull buttons for complete control
- **Custom Server**: Use your own HTTP server for file storage
- **Conflict Detection**: Detects conflicts and asks you to resolve manually
- **.nosync Support**: Exclude files using gitignore-style patterns
- **Simple & Focused**: No auto-sync, no complexity, just what you need
- **Cross-Platform**: Works on macOS, Windows, Linux, iOS, and Android

## Quick Start

### 1. Set Up Server

Install and run the Vault Sync Server:

```bash
cd vault-sync-server
npm install
cp .env.example .env
# Edit .env with your API key
npm start
```

Server runs on `http://localhost:3000` by default.

### 2. Install Plugin

1. Copy `v2` folder to your vault's `.obsidian/plugins/` directory:
```bash
cp -r v2 /path/to/vault/.obsidian/plugins/obsidian-vault-sync-v2
```

2. Or create a symlink for development:
```bash
ln -s /path/to/scion/v2 /path/to/vault/.obsidian/plugins/obsidian-vault-sync-v2
```

3. Restart Obsidian
4. Enable "Vault Sync v2" in Settings → Community Plugins

### 3. Configure Plugin

1. Open Settings → Vault Sync v2
2. Enter Server URL: `http://localhost:3000`
3. Enter API Key (from .env file)
4. Click "Test Connection"

### 4. Use It

- **Push**: Upload your local changes to server (↑ button)
- **Pull**: Download server changes to your vault (↓ button)
- **Test**: Verify server connection anytime

## How It Works

### Push Operation
1. Compares local files with remote files using SHA-256 hashes
2. Detects conflicts (same file, different content)
3. If conflicts found: stops and shows list for you to resolve
4. If no conflicts: uploads new/modified files and deletes remote-only files
5. Shows result notification

### Pull Operation
1. Compares remote files with local files using SHA-256 hashes
2. Detects conflicts (same file, different content)
3. If conflicts found: stops and shows list for you to resolve
4. If no conflicts: downloads new/modified files and deletes local-only files
5. Shows result notification

### Conflict Resolution

When conflicts are detected, you must manually resolve them:

1. Check which files are in conflict (listed in notice)
2. Edit the files to your desired state locally or remotely
3. Retry the push/pull operation

Example: If `notes.md` exists both locally and remotely with different content:
- Keep local version: Delete the remote copy and push again
- Keep remote version: Delete your local copy and pull again
- Keep both: Rename one (e.g., `notes-local.md`) and push, then pull

## Configuration

### Server URL
- Local: `http://localhost:3000`
- Local network: `http://192.168.1.100:3000` (your computer's IP)
- Tailscale: `http://100.x.x.x:3000` (your Tailscale IP)
- Remote VPS: `https://vault-sync.example.com` (if HTTPS is set up)

### API Key
- Generate a secure key: `openssl rand -hex 32`
- Store in `.env` file on server
- Use same key in plugin settings

### .nosync File
- Default location: `.nosync` in vault root
- Format: One pattern per line (gitignore style)
- Examples:
  ```
  # Device-specific settings
  .obsidian/workspace*.json
  .obsidian/cache/

  # Local files not to sync
  *.tmp
  *.temp
  private/
  drafts/
  ```

## Deployment Options

### Local Network
Run server on your computer, access from same network:
```bash
npm start
# Find your IP: ipconfig getifaddr en0 (macOS) or hostname -I (Linux)
# Use in plugin: http://your-ip:3000
```

### Tailscale (Recommended for Remote)
```bash
# Install Tailscale on both devices
# Find your Tailscale IP: tailscale ip -4
# Use in plugin: http://your-tailscale-ip:3000
```

### VPS (Digital Ocean, Linode, etc.)
See vault-sync-server README for full deployment guide.

## Troubleshooting

### "Connection refused"
- Check server is running: `npm start` in vault-sync-server
- Check port is correct (default 3000)
- Check firewall isn't blocking port
- Test: curl http://localhost:3000/health

### "Invalid API key"
- Check API key in settings matches .env file
- Verify there are no extra spaces
- Settings → Vault Sync v2 → re-enter API key

### "Conflicts detected"
- Manual conflicts must be resolved manually
- Edit conflicted files to match desired state
- Delete files on either side if needed
- Retry push/pull when resolved

### Files not syncing
- Run "Show sync diff" command to see what changed
- Check .nosync file isn't excluding needed files
- Try "Test Connection" to verify server access
- Check console for error messages (Settings → Enable Logging)

### Performance slow
- Large vaults may take time on first sync
- Check network connection
- Check server doesn't have disk issues
- Monitor server with: `npm start` (shows requests)

## Commands

Access from Command Palette (Cmd+P):

- **Push to server** - Upload local changes
- **Pull from server** - Download remote changes
- **Test server connection** - Verify access
- **Show sync diff** - Preview what will change

## Keyboard Shortcuts

- Click ribbon icons or use commands
- No default shortcuts (customize in Obsidian settings)

## Security

### Local Use
- Basic API key authentication
- Good enough for personal use on local network
- Don't expose server to public internet

### Remote Use
- Use HTTPS (Let's Encrypt is free)
- Use strong, unique API key
- Restrict firewall to your IPs
- Consider database backup strategy

### Never
- Share API key
- Run without HTTPS on public internet
- Use simple password as API key
- Store in version control

## Build from Source

```bash
# Install dependencies
npm install

# Development build (with source maps)
npm run dev

# Production build
npm run build:prod

# Watch for changes
npm run dev  # Ctrl+C to stop
```

## File Structure

```
v2/
├── manifest.json           # Plugin metadata
├── package.json            # Dependencies
├── tsconfig.json           # TypeScript config
├── esbuild.config.mjs      # Build config
├── main.js                 # Built plugin
├── src/
│   ├── main.ts             # Plugin entry point
│   ├── types.ts            # Type definitions
│   ├── server-api.ts       # REST client
│   ├── sync-engine.ts      # Push/pull logic
│   ├── vault-utils.ts      # Vault operations
│   ├── ignore-patterns.ts  # .nosync support
│   ├── settings.ts         # Settings UI
│   └── utils.ts            # Helpers
└── README.md               # This file
```

## FAQ

**Q: Why manual push/pull instead of auto-sync?**
A: More predictable, easier to understand what's changing, less prone to data loss during conflicts.

**Q: Can I use a different server?**
A: Yes, but it needs to implement the API endpoints. See vault-sync-server for reference.

**Q: What if both files change on same device?**
A: No conflict - push uploads both changes.

**Q: What if I'm offline?**
A: Push/pull won't work, but you can edit files offline. Sync when back online.

**Q: Can I exclude sensitive files?**
A: Yes, add patterns to `.nosync` file.

**Q: Do you store my data?**
A: No, you control the server. We don't have access to anything.

**Q: Is it safe?**
A: As safe as your server setup. Use HTTPS and strong API key for remote access.

## Limitations

- Manual sync only (no automatic)
- Conflicts must be resolved manually
- No versioning or history
- No rollback functionality
- File size limited by server (increase via configuration)

## Alternative Solutions

- **Obsidian Sync**: Official solution, $4/month, proprietary
- **Git + Working Copy**: Good for versioning, but iOS sync is limited
- **Syncthing**: Automatic peer-to-peer, but more complex setup

## License

MIT

## Support

Open issues on GitHub or check documentation in vault-sync-server README.

## Changelog

### v2.0.0 (Initial Release)
- Manual push/pull operations
- Conflict detection
- .nosync pattern support
- Custom server support
- Minimal metadata tracking
- Works on desktop and mobile
