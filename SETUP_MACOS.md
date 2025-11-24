# macOS Setup Guide - Obsidian Sync with Syncthing

Complete step-by-step guide to set up Syncthing on macOS for Obsidian vault synchronization.

## Prerequisites

- [ ] macOS 10.15 (Catalina) or later
- [ ] Homebrew installed ([https://brew.sh](https://brew.sh))
- [ ] Tailscale installed and connected
- [ ] Obsidian vault location identified

## Installation Steps

### Step 1: Install Syncthing

Open Terminal and run:

```bash
# Install Syncthing via Homebrew
brew install syncthing

# Verify installation
syncthing --version
```

Expected output: `syncthing v1.x.x ...`

### Step 2: Start Syncthing

**Option A: Run Manually (Testing)**
```bash
# Start Syncthing in foreground
syncthing
```

**Option B: Run as Service (Recommended)**
```bash
# Start Syncthing as background service
brew services start syncthing

# Verify it's running
brew services list | grep syncthing
```

Expected output: `syncthing started ...`

### Step 3: Access Syncthing Web UI

1. Open browser: http://localhost:8384
2. If prompted, set up username/password (optional but recommended)
3. You should see the Syncthing dashboard

### Step 4: Get Your Device ID

Two methods:

**Method A: QR Code (Easier for iOS pairing)**
1. In web UI: **Actions → Show ID**
2. QR code will display
3. Keep this window open for iOS setup

**Method B: Copy Device ID**
1. In web UI: **Actions → Settings → General**
2. Copy the Device ID (long alphanumeric string)
3. Save it for iOS pairing

### Step 5: Configure Tailscale Integration

1. Find your Tailscale IP:
```bash
tailscale ip -4
```
Note the IP (format: `100.x.x.x`)

2. In Syncthing web UI:
   - Go to **Actions → Settings → Connections**
   - Find "Sync Protocol Listen Addresses"
   - Add your Tailscale IP: `tcp://100.x.x.x:22000`
   - Keep existing `default` entry
   - Click **Save**

3. Restart Syncthing:
```bash
# If running as service
brew services restart syncthing

# If running manually
# Stop (Ctrl+C) and restart: syncthing
```

### Step 6: Add Your Obsidian Vault as Shared Folder

1. In web UI, click **Add Folder** (bottom right)

2. **General Tab:**
   - Folder Label: `Obsidian` (or your preferred name)
   - Folder Path: Click **Browse** and select your vault
     - Example: `/Users/yourname/Documents/ObsidianVault`
   - ✅ Enable "Watch for Changes"

3. **Sharing Tab:**
   - Leave empty for now (will share with iOS device after pairing)

4. **File Versioning Tab:**
   - Leave as "No File Versioning" (or configure if desired)

5. **Ignore Patterns Tab:**
   - Leave default for now (will add `.stignore` file later)

6. Click **Save**

### Step 7: Create .stignore File

This excludes device-specific Obsidian settings from sync:

```bash
# Navigate to your vault
cd /Users/yourname/Documents/ObsidianVault  # Adjust path

# Create .stignore file
cat > .stignore << 'EOF'
# Device-specific workspace settings
.obsidian/workspace.json
.obsidian/workspace-mobile.json
.obsidian/workspace.json.bak

# Device-specific app settings
.obsidian/app.json
.obsidian/appearance.json

# Cache and temporary files
.obsidian/cache/
.trash/

# System files
.DS_Store
Thumbs.db

# Conflict files (optional - uncomment to hide)
# *.sync-conflict-*
EOF

# Verify file was created
cat .stignore
```

### Step 8: Verify Folder Configuration

In web UI:
1. Your "Obsidian" folder should appear in the dashboard
2. Status should show "Idle" or "Scanning"
3. File count and size should be displayed

### Step 9: Prepare for iOS Pairing

Keep the following ready:
1. ✅ Syncthing web UI open at http://localhost:8384
2. ✅ QR code displayed (Actions → Show ID)
3. ✅ Your folder is configured and scanning
4. ✅ Tailscale is connected

**You're ready to set up iOS!** Proceed to [SETUP_IOS.md](SETUP_IOS.md)

## Verification Checklist

- [ ] Syncthing installed and running
- [ ] Web UI accessible at localhost:8384
- [ ] Tailscale IP added to listen addresses
- [ ] Obsidian vault added as shared folder
- [ ] .stignore file created in vault root
- [ ] Folder shows "Idle" or "Up to Date" status
- [ ] Device ID or QR code ready for iOS pairing

## Troubleshooting

### Syncthing Won't Start

```bash
# Check if already running
ps aux | grep syncthing

# Kill existing process
killall syncthing

# Check for port conflicts
lsof -i :8384
lsof -i :22000

# Start with verbose logging
syncthing -verbose
```

### Can't Access Web UI

1. Check Syncthing is running:
```bash
ps aux | grep syncthing
```

2. Try alternative ports:
   - Default: http://localhost:8384
   - Check config: `~/Library/Application Support/Syncthing/config.xml`

3. Restart browser or try different browser

### Tailscale IP Not Working

```bash
# Verify Tailscale is running
tailscale status

# Check IP address
tailscale ip -4

# Test connectivity
tailscale ping [your-ios-device-name]
```

If ping fails:
- Ensure Tailscale is connected on both devices
- Check tailnet is the same on both devices
- Restart Tailscale: `sudo tailscale down && sudo tailscale up`

### Folder Not Scanning

1. Check folder path is correct in Syncthing settings
2. Verify permissions:
```bash
ls -la /path/to/your/vault
```

3. Force rescan:
   - Web UI → Folder card → Rescan

### High CPU Usage

If Syncthing uses high CPU:
1. Disable "Watch for Changes" temporarily
2. Increase scan interval: Settings → Folders → Advanced → Scan Interval
3. Add more patterns to .stignore (exclude large files/dirs)

## Advanced Configuration

### Run Syncthing on Startup (Auto-start)

Already done if using `brew services start syncthing`.

To verify:
```bash
brew services list | grep syncthing
```

Should show: `syncthing started`

### Custom Configuration

Edit config file:
```bash
# Location
~/Library/Application\ Support/Syncthing/config.xml

# Edit with nano
nano ~/Library/Application\ Support/Syncthing/config.xml

# Restart after editing
brew services restart syncthing
```

### View Logs

```bash
# Tail logs in real-time
tail -f ~/Library/Application\ Support/Syncthing/syncthing.log

# View recent errors
grep -i error ~/Library/Application\ Support/Syncthing/syncthing.log | tail -20
```

### Set Up Web UI Authentication (Recommended)

1. Web UI → Actions → Settings → GUI
2. Enable "Use HTTPS for GUI"
3. Set GUI Authentication User/Password
4. Save and restart

### Monitor Sync Status

```bash
# Check folder status via API
curl -X GET http://localhost:8384/rest/db/status?folder=obsidian

# Check device connections
curl -X GET http://localhost:8384/rest/system/connections
```

## Next Steps

Once macOS setup is complete:
1. **Proceed to iOS setup**: [SETUP_IOS.md](SETUP_IOS.md)
2. After both devices are configured, test sync by:
   - Creating a note on macOS
   - Verifying it appears on iOS
   - Creating a note on iOS
   - Verifying it appears on macOS

## Useful Commands Reference

```bash
# Syncthing
syncthing --version          # Check version
syncthing -help             # View help
brew services start syncthing    # Start as service
brew services stop syncthing     # Stop service
brew services restart syncthing  # Restart service
killall syncthing           # Force stop

# Tailscale
tailscale status            # Check connection
tailscale ip -4            # Get IPv4 address
tailscale ping [device]    # Test connectivity
tailscale netcheck         # Network diagnostics

# Logs and Diagnostics
tail -f ~/Library/Application\ Support/Syncthing/syncthing.log
brew services list
ps aux | grep syncthing
lsof -i :8384
lsof -i :22000
```

## Resources

- Syncthing Documentation: https://docs.syncthing.net/
- Syncthing Forum: https://forum.syncthing.net/
- Tailscale KB: https://tailscale.com/kb/
- Homebrew: https://brew.sh
