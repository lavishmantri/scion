# Vault Sync v2 - Installation Guide

## Prerequisites

- Obsidian (any recent version)
- Node.js 16+ (for running server)
- A computer or server to run the sync server on

## Option 1: Quick Start (Local Network)

### Step 1: Start the Server

```bash
cd vault-sync-server
npm install
cp .env.example .env

# Generate secure API key
openssl rand -hex 32

# Edit .env and set the API key
nano .env

# Start server
npm start
```

Server runs on `http://localhost:3000`

### Step 2: Install Plugin

1. **Via Symlink (Recommended for Development)**
```bash
# Replace paths with your actual paths
ln -s ~/Projects/scion/v2 ~/.obsidian/plugins/obsidian-vault-sync-v2
# Restart Obsidian
```

2. **Or Copy Folder**
```bash
cp -r v2 ~/.obsidian/plugins/obsidian-vault-sync-v2
# Restart Obsidian
```

### Step 3: Configure

1. Obsidian Settings → Community Plugins → Enable "Vault Sync v2"
2. Settings → Vault Sync v2
3. Enter:
   - Server URL: `http://localhost:3000`
   - API Key: (the key from step 1)
4. Click "Test Connection"

### Step 4: Use

- Click ↑ button to push (upload local changes)
- Click ↓ button to pull (download remote changes)

## Option 2: Tailscale (Recommended for Mobile)

Great for syncing between phone and computer over secure network.

### Step 1: Install Tailscale

- macOS: `brew install tailscale && brew services start tailscale`
- iOS: Install from App Store
- https://tailscale.com/download

### Step 2: Connect Devices

1. Run `tailscale up` on each device
2. Authorize the devices
3. Both should show as connected

### Step 3: Find Your IP

```bash
tailscale ip -4
# Example: 100.64.123.45
```

### Step 4: Start Server

```bash
npm start
# Server listens on all IPs including Tailscale IP
```

### Step 5: Configure Plugin

- Server URL: `http://100.64.123.45:3000` (use your actual IP)
- Other settings same as Option 1

### Step 6: Use from Phone

1. Install Obsidian on iOS
2. Install Vault Sync v2 plugin
3. Configure with Tailscale IP
4. Use push/pull commands

## Option 3: VPS (For Always-On Sync)

Good for having always-accessible sync from anywhere.

### Step 1: Create VPS

- Digital Ocean, Linode, AWS, etc.
- Minimum: 512MB RAM, 1GB storage
- Cost: ~$3-5/month

### Step 2: Install Node.js

```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
```

### Step 3: Clone and Setup

```bash
git clone <your-repo>
cd vault-sync-server
npm install
cp .env.example .env
# Edit .env with API key
```

### Step 4: Install PM2 (Keep Running)

```bash
npm install -g pm2
pm2 start server.js --name vault-sync
pm2 startup
pm2 save
```

### Step 5: Setup HTTPS

```bash
sudo apt-get install -y nginx certbot python3-certbot-nginx

# Create nginx config pointing to localhost:3000
# Then run certbot for automatic HTTPS
```

### Step 6: Configure Plugin

- Server URL: `https://vault-sync.yourserver.com`
- API Key: from .env

## Development Setup

### Build the Plugin

```bash
cd v2
npm install

# Watch mode (auto rebuild on changes)
npm run dev

# Production build
npm run build:prod
```

### Test Locally

```bash
# Terminal 1: Start server
cd vault-sync-server
npm start

# Terminal 2: Watch plugin build
cd v2
npm run dev

# Terminal 3: Symlink to your vault
ln -s ~/Projects/scion/v2 ~/.obsidian/plugins/obsidian-vault-sync-v2
# Restart Obsidian
```

### API Testing

```bash
# List files
curl -H "Authorization: Bearer your-key" \
  http://localhost:3000/api/files

# Upload file
curl -X POST \
  -H "Authorization: Bearer your-key" \
  --data-binary @test.txt \
  http://localhost:3000/api/files/test.txt

# Download file
curl -H "Authorization: Bearer your-key" \
  http://localhost:3000/api/files/test.txt

# Delete file
curl -X DELETE \
  -H "Authorization: Bearer your-key" \
  http://localhost:3000/api/files/test.txt
```

## Troubleshooting Installation

### Plugin doesn't appear in settings

1. Check symlink or copy worked: `ls ~/.obsidian/plugins/obsidian-vault-sync-v2/`
2. Restart Obsidian completely (quit and reopen)
3. Check for build errors: `npm run build` in v2 folder
4. Check Obsidian console (Cmd+Option+I) for errors

### "Cannot reach server" error

1. Check server is running: `npm start` in vault-sync-server
2. Test manually: `curl http://localhost:3000/health`
3. Check port: default is 3000, change in .env if needed
4. Check firewall isn't blocking port

### Build fails

1. Delete node_modules: `rm -rf node_modules`
2. Reinstall: `npm install`
3. Check Node.js version: `node -v` (should be 16+)
4. Check TypeScript errors: `npm run build`

### Settings don't save

1. Check plugin loaded correctly
2. Try closing and reopening settings
3. Check browser console for JavaScript errors
4. Try reloading Obsidian

## Uninstall

### Remove Plugin

1. Settings → Community Plugins → Vault Sync v2 → Uninstall
2. Or delete folder: `rm -rf ~/.obsidian/plugins/obsidian-vault-sync-v2/`

### Stop Server

1. Press Ctrl+C in terminal
2. Or: `pm2 stop vault-sync` (if using PM2)

## Next Steps

1. Read README.md for usage guide
2. Check .nosync file patterns in vault root
3. Test sync with a few files first
4. Enable logging for debugging

## Support

- Check console logs: Settings → Enable Logging, then Cmd+Option+I
- Run "Show sync diff" command to see what will change
- Test connection: "Test server connection" command
- Read vault-sync-server README for server issues
