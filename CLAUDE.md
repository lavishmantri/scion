# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This project implements Obsidian vault synchronization across macOS and iOS devices using Syncthing over Tailscale network.

**Solution Architecture:**
- **macOS**: Syncthing (open source, free)
- **iOS**: Synctrain (open source, free, App Store)
- **Network**: Tailscale for secure peer-to-peer connection
- **Sync Protocol**: Syncthing (peer-to-peer, no server required)

**Key Benefits:**
- Zero custom code required
- Completely free (no subscriptions)
- Battle-tested sync technology
- Handles offline queuing automatically
- Private sync over Tailnet
- No cloud services required

## Architecture

```
┌─────────────────────────┐
│   macOS Obsidian Vault  │
│   + Syncthing           │
│   ~/Documents/Vault     │
└──────────┬──────────────┘
           │
           │ Syncthing Protocol
           │ via Tailscale (encrypted)
           │ Direct peer-to-peer
           │
           ▼
┌─────────────────────────┐
│   iOS Obsidian Vault    │
│   + Synctrain App       │
│   Files: On My iPhone   │
└─────────────────────────┘
```

## Setup Instructions

### Prerequisites

1. **Tailscale Account** (free tier works)
   - Install Tailscale on macOS
   - Install Tailscale on iOS
   - Ensure both devices are connected to same tailnet

2. **Obsidian** installed on both devices
   - macOS: https://obsidian.md
   - iOS: App Store

### macOS Setup

#### 1. Install Syncthing

```bash
# Using Homebrew (recommended)
brew install syncthing

# Start Syncthing
syncthing

# Or install as a service to run at startup
brew services start syncthing
```

#### 2. Configure Syncthing

1. Open web UI: http://localhost:8384
2. Go to **Actions → Settings → Connections**
   - Note your Device ID (you'll need this for iOS)
3. Go to **Actions → Show ID** to display QR code (easier for iOS pairing)
4. Add your Obsidian vault:
   - Click **Add Folder**
   - Folder Path: `/Users/YOUR_USERNAME/Documents/ObsidianVault` (adjust to your vault location)
   - Folder Label: `Obsidian`
   - Click **Save**

#### 3. Configure Tailscale Integration

1. In Syncthing web UI → **Actions → Settings → Connections**
2. Sync Protocol Listen Addresses: Add your Tailscale IP
   - Format: `tcp://100.x.x.x:22000` (replace with your Tailscale IP)
   - Find your Tailscale IP: `tailscale ip -4`
3. Restart Syncthing

### iOS Setup

#### 1. Install Apps

```
App Store Downloads:
- Synctrain (free, open source)
- Tailscale (if not already installed)
- Obsidian (if not already installed)
```

#### 2. Configure Synctrain

1. Open Synctrain app
2. Tap **+** to add device
3. Scan QR code from macOS Syncthing web UI (Actions → Show ID)
   - OR manually enter Device ID from macOS
4. Accept the device pairing on both sides
5. On iOS: Accept the shared folder "Obsidian" when prompted
6. Choose sync location:
   - Files app → On My iPhone → Create "ObsidianVault" folder
   - Select this location in Synctrain
7. Wait for initial sync to complete

#### 3. Configure Obsidian iOS

1. Open Obsidian on iOS
2. Tap **Open folder as vault**
3. Navigate to Files → On My iPhone → ObsidianVault
4. Open the synced vault

### Configuration Files

#### .stignore File

Create this file in your vault root to exclude device-specific Obsidian settings:

```
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

# Git files (if using Git separately)
.git/
.gitignore
```

To create in macOS terminal:
```bash
cd ~/Documents/ObsidianVault  # Adjust to your vault path
cat > .stignore << 'EOF'
.obsidian/workspace.json
.obsidian/workspace-mobile.json
.obsidian/workspace.json.bak
.obsidian/app.json
.obsidian/appearance.json
.obsidian/cache/
.trash/
.DS_Store
Thumbs.db
EOF
```

## Usage Workflow

### Daily Usage

**macOS:**
- Syncthing runs in background continuously
- Changes sync automatically when files are saved
- No manual action required

**iOS:**
1. Open Synctrain app (syncs in foreground)
2. Wait a few seconds for sync to complete
3. Open Obsidian to view/edit notes
4. After editing, switch back to Synctrain to sync changes
5. Optionally: Keep Synctrain open while using Obsidian (use split view)

**Important iOS Note:** iOS restricts background sync for battery preservation. Synctrain syncs when:
- App is in foreground
- iOS Background App Refresh triggers (not guaranteed)
- Best practice: Open Synctrain before and after using Obsidian

### Offline Editing

**Both platforms:**
- Edit notes while offline (no connection required)
- Changes queue locally
- When connection restored, Syncthing automatically syncs
- Conflicts are rare with "one writer at a time" practice
- If conflicts occur, Syncthing creates `.sync-conflict-*` files

## Troubleshooting

### Sync Not Working

**macOS:**
```bash
# Check if Syncthing is running
ps aux | grep syncthing

# Restart Syncthing
killall syncthing
syncthing

# Check Syncthing logs
~/Library/Application\ Support/Syncthing/syncthing.log

# Verify Tailscale connection
tailscale status
```

**iOS:**
1. Check Tailscale is connected (Tailscale app → should show "Connected")
2. Open Synctrain → Check device shows as "Connected"
3. Check folder status → should show "Up to Date"
4. If stuck: Remove device, re-pair using QR code

### Devices Not Discovering Each Other

1. **Verify Tailscale:**
   - Both devices on same tailnet
   - Both show "Connected" in Tailscale app
   - Can ping each other: `tailscale ping [device-name]`

2. **Check Syncthing Configuration:**
   - macOS: Web UI → Connections → verify Tailscale IP is listed
   - iOS: Synctrain → Devices → verify macOS device shows correct IP

3. **Manual Device Addition:**
   - macOS Web UI → Add Device → Enter iOS device ID
   - iOS Synctrain → Add Device → Enter macOS device ID

### Files Not Syncing / Out of Sync

1. **Check .stignore:**
   - Verify .stignore file exists in vault root
   - Check patterns aren't too broad

2. **Force Rescan:**
   - macOS Web UI → Folder → Rescan
   - iOS Synctrain → Folder → Pull/Scan

3. **Check Folder Paused:**
   - Ensure folder is not paused on either device
   - macOS Web UI → Folder card should show "Up to Date"
   - iOS Synctrain → Folder should show "Up to Date"

4. **Conflict Files:**
   - Look for `.sync-conflict-*` files
   - Review and merge manually if needed
   - Delete conflict files after resolving

### iOS Sync Delayed

**Expected Behavior:** iOS restricts background app activity. Synctrain syncs when:
- App is opened (foreground)
- Background App Refresh triggers (infrequent)

**Workarounds:**
1. Open Synctrain before using Obsidian
2. Use iOS Split View (Synctrain + Obsidian side-by-side)
3. Enable Background App Refresh for Synctrain:
   - Settings → Synctrain → Background App Refresh → ON
4. Keep Synctrain open while editing (iOS will pause it, but refresh more frequently)

## Technical Details

### Syncthing Features Used

- **Block Exchange Protocol**: Efficient delta sync (only changed blocks transferred)
- **Conflict Resolution**: `.sync-conflict-*` files (rare with one-writer pattern)
- **Versioning**: Disabled (can enable in Syncthing settings if desired)
- **Ignore Patterns**: `.stignore` file for device-specific exclusions
- **Discovery**: Tailscale handles device discovery via static IPs

### Security

- **Transport**: TLS encrypted (Syncthing default)
- **Network**: Tailscale WireGuard VPN (encrypted tunnel)
- **Authentication**: Device ID pairing (public key cryptography)
- **No Cloud**: Direct peer-to-peer, no third-party servers

### File System Access

**macOS:**
- Syncthing has full file system access
- Vault location: Any directory (typically `~/Documents/`)

**iOS:**
- Synctrain accesses "On My iPhone" directory
- Obsidian reads from same location
- iOS sandboxing applies (apps can share via Files app)

## Resources

### Documentation
- **Syncthing Docs**: https://docs.syncthing.net/
- **Synctrain GitHub**: https://github.com/pixelspark/sushitrain
- **Tailscale Docs**: https://tailscale.com/kb/

### Community
- **Syncthing Forum**: https://forum.syncthing.net/
- **r/Syncthing**: https://reddit.com/r/Syncthing
- **r/ObsidianMD**: https://reddit.com/r/ObsidianMD

### Useful Commands

```bash
# macOS: Check Syncthing version
syncthing --version

# macOS: View Syncthing config location
echo ~/Library/Application\ Support/Syncthing/

# macOS: Monitor sync activity
tail -f ~/Library/Application\ Support/Syncthing/syncthing.log

# Tailscale: Check connection status
tailscale status

# Tailscale: Get your IP
tailscale ip -4

# Tailscale: Ping other device
tailscale ping [device-name]
```

## Maintenance

### Regular Tasks
- **Monthly**: Check for Syncthing updates (`brew upgrade syncthing`)
- **Monthly**: Check for Synctrain updates (App Store)
- **As Needed**: Review `.sync-conflict-*` files if any appear

### Backup Strategy
While Syncthing provides sync, it's not backup. Consider:
- Time Machine for macOS vault
- iCloud backup for iOS device (optional)
- Git repository for version control (optional, separate from sync)

## Alternative Approaches Considered

During planning, we evaluated several approaches:

1. **Git + Working Copy** ❌ - Working Copy folder sync broken on latest iOS
2. **Custom Server + SQLite** ❌ - Unnecessary complexity, reinvents Syncthing
3. **Yjs/CRDT** ❌ - Overkill for one-writer-at-a-time use case
4. **GitHub API + iOS App** ⚠️ - Viable but requires custom iOS app development (1 week)
5. **Syncthing + Synctrain** ✅ - Chosen: Free, open source, zero code, works today

## Future Enhancements (Optional)

If you want to add custom code later:

1. **macOS Menu Bar App**: Syncthing status indicator
2. **iOS Shortcuts**: Auto-open Synctrain before Obsidian
3. **Automation**: Launch Syncthing on macOS startup
4. **Monitoring**: Script to alert if sync falls behind
5. **Git Integration**: Optional version control layer on top of sync

## Notes for Claude Code

- This is a zero-code solution using existing tools
- Focus any development on documentation and automation helpers
- Do not rebuild sync functionality - Syncthing handles it
- If customization needed, extend via scripts, not by replacing Syncthing
- Test changes in a separate vault before applying to main vault
