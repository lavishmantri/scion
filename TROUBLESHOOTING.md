# Troubleshooting Guide - Obsidian Sync with Syncthing

Comprehensive troubleshooting guide for common issues with Syncthing + Synctrain + Obsidian sync setup.

## Quick Diagnostics Checklist

Before deep troubleshooting, verify these basics:

- [ ] Tailscale connected on both devices
- [ ] Syncthing running on macOS (`ps aux | grep syncthing`)
- [ ] Synctrain shows macOS device as "Connected"
- [ ] Folder status shows "Up to Date" or "Syncing"
- [ ] Both devices can ping each other via Tailscale
- [ ] Sufficient storage space on both devices
- [ ] No firewall blocking ports 22000 or 8384

## Common Issues and Solutions

### 1. Devices Not Discovering Each Other

**Symptoms:**
- Synctrain shows macOS device as "Disconnected"
- No sync activity
- Devices don't appear in each other's device list

**Solutions:**

#### Check Tailscale Connection

**macOS:**
```bash
# Check Tailscale status
tailscale status

# Verify your IP
tailscale ip -4

# Ping iOS device
tailscale ping [ios-device-name]
```

**iOS:**
1. Open Tailscale app
2. Status should show "Connected"
3. Tap your macOS device to see its status

#### Verify Syncthing is Running on macOS

```bash
# Check if Syncthing is running
ps aux | grep syncthing

# If not running, start it
brew services start syncthing

# Or start manually
syncthing
```

#### Manually Configure Device Address

**On macOS (Syncthing Web UI):**
1. Go to iOS device settings
2. Under **Addresses**, add:
   ```
   dynamic
   tcp://[ios-tailscale-ip]:22000
   ```

**On iOS (Synctrain):**
1. Tap macOS device
2. Tap **Addresses**
3. Add: `tcp://[macos-tailscale-ip]:22000`
4. Replace `[macos-tailscale-ip]` with macOS Tailscale IP (format: `100.x.x.x`)

#### Re-pair Devices

If still not connecting:
1. Remove device on both sides
2. Re-pair using QR code method
3. Accept device on both sides
4. Share folder again

---

### 2. Folder Not Syncing

**Symptoms:**
- Files don't appear on other device
- Status shows "Out of Sync" or "Error"
- Sync stuck at 0% or specific percentage

**Solutions:**

#### Check Folder Status

**macOS:**
- Syncthing Web UI → Folder card → Check status and error messages

**iOS:**
- Synctrain → Folders tab → Tap folder → View details

#### Force Rescan

**macOS:**
```bash
# Via Web UI
# Folder card → Rescan button

# Via API
curl -X POST http://localhost:8384/rest/db/scan?folder=obsidian
```

**iOS:**
1. Synctrain → Tap folder
2. Tap **Actions** → **Scan**

#### Check Folder Paused

**macOS:**
- Web UI → Folder card → Ensure not paused
- If paused, click **Resume**

**iOS:**
- Synctrain → Folder should not show "Paused"
- If paused, tap folder → Resume

#### Verify Folder Paths

**macOS:**
```bash
# Check vault location is correct
ls -la /path/to/your/vault

# Verify .stignore exists
cat /path/to/your/vault/.stignore
```

**iOS:**
1. Files app → On My iPhone → ObsidianVault
2. Verify folder exists and has files
3. Check Synctrain is pointing to correct location

#### Check Permissions

**macOS:**
```bash
# Verify Syncthing has read/write access
ls -la /path/to/your/vault

# Fix permissions if needed
chmod -R 755 /path/to/your/vault
```

---

### 3. Sync Conflicts

**Symptoms:**
- Files named `filename.sync-conflict-20250101-123456.md` appear
- Multiple versions of same file

**Understanding Conflicts:**
Conflicts occur when the same file is modified on both devices while disconnected, and then devices reconnect.

**How to Resolve:**

1. **Identify Conflict Files:**
   ```bash
   # macOS: Find all conflict files
   find /path/to/vault -name "*.sync-conflict-*"
   ```

2. **Compare Versions:**
   - Open original file: `filename.md`
   - Open conflict file: `filename.sync-conflict-20250101-123456.md`
   - Compare content to see differences

3. **Merge Changes:**
   - Manually merge important changes from conflict into original
   - Or keep conflict version if it's better

4. **Delete Conflict File:**
   ```bash
   # After merging, delete conflict file
   rm "filename.sync-conflict-20250101-123456.md"
   ```

5. **Sync Again:**
   - Deletion will sync
   - Conflict resolved

**Prevent Conflicts:**
- Stick to "one writer at a time" practice
- Always sync before switching devices
- Open Synctrain before editing on iOS

---

### 4. iOS Sync Delayed or Not Happening

**Symptoms:**
- Changes on macOS don't appear on iOS
- Changes on iOS don't sync to macOS
- Synctrain shows "Up to Date" but files are old

**Understanding iOS Limitations:**

iOS restricts background app activity for battery preservation. Synctrain can only sync when:
- App is in foreground (open and visible)
- iOS grants Background App Refresh (infrequent and not guaranteed)

This is an iOS platform limitation affecting ALL sync apps except iCloud (Apple's own service).

**Solutions:**

#### Establish Sync Workflow

**Before using Obsidian on iOS:**
1. Open Synctrain
2. Wait for status: "Up to Date"
3. Then open Obsidian

**After editing in Obsidian on iOS:**
1. Close or minimize Obsidian
2. Open Synctrain
3. Wait for status: "Up to Date"
4. Changes now synced

#### Enable Background App Refresh

1. iOS Settings → **General** → **Background App Refresh**
2. Ensure it's enabled globally
3. iOS Settings → **Synctrain** → **Background App Refresh** → Enable

**Note:** This helps but doesn't guarantee frequent background sync.

#### Use iOS Split View

For iPad or large iPhones:
1. Open Synctrain on left side (25% width)
2. Open Obsidian on right side (75% width)
3. Both apps active simultaneously
4. Synctrain syncs in real-time while you edit

#### Create iOS Shortcuts

Automate the workflow:

**Shortcut 1: "Start Obsidian Sync"**
```
1. Open Synctrain
2. Wait 10 seconds
3. Open Obsidian
```

**Shortcut 2: "End Obsidian Sync"**
```
1. Open Synctrain
2. Wait 10 seconds
3. Show notification "Sync Complete"
```

---

### 5. Syncthing High CPU or Memory Usage on macOS

**Symptoms:**
- Fan running constantly
- System slow
- Activity Monitor shows Syncthing using high resources

**Solutions:**

#### Disable Watch for Changes

If vault has many files:
1. Web UI → Folder Settings → **Edit**
2. Uncheck **Watch for Changes**
3. Set **Rescan Interval** to 300-600 seconds
4. Click **Save**

#### Optimize Scan Interval

```bash
# Web UI → Settings → Folders → Advanced
# Increase "Scan Interval Minutes" from default
```

#### Add More to .stignore

Exclude unnecessary files:
```bash
# Add to .stignore
.obsidian/cache/
.obsidian/plugins/*/cache/
*.log
temp-*
```

#### Check for File System Issues

```bash
# Verify vault integrity
cd /path/to/vault
find . -type f | wc -l  # Count files

# Check for permission issues
find . -type f ! -readable
```

#### Restart Syncthing

```bash
# Stop
brew services stop syncthing

# Wait 10 seconds

# Start
brew services start syncthing
```

---

### 6. Obsidian Can't Open Vault on iOS

**Symptoms:**
- Obsidian shows "Can't open vault"
- Vault appears empty in Obsidian
- "Permission denied" error

**Solutions:**

#### Grant File Access Permissions

1. iOS Settings → **Obsidian**
2. **Files and Folders** → Enable
3. Grant access to "On My iPhone"

#### Verify Vault Location

1. Files app → On My iPhone → ObsidianVault
2. Confirm folder exists and has .md files
3. In Obsidian, ensure you selected the correct folder

#### Re-open Vault

1. In Obsidian, close current vault (Settings → About → Close)
2. Tap **Open folder as vault**
3. Navigate to Files → On My iPhone → ObsidianVault
4. Select folder and open

#### Check Sync Completed

1. Open Synctrain
2. Ensure folder shows "Up to Date"
3. Check file count matches macOS
4. Then try opening in Obsidian again

---

### 7. Files Missing or Incomplete

**Symptoms:**
- Some files sync, others don't
- Files exist on macOS but not iOS (or vice versa)
- Folder shows "Up to Date" but files are missing

**Solutions:**

#### Check .stignore Patterns

**macOS:**
```bash
# View .stignore
cat /path/to/vault/.stignore

# Test if file is ignored
# Web UI → Folder → Edit → Ignore Patterns
# Enter test file path to see if it's ignored
```

Common mistakes:
- Pattern too broad: `*.md` (ignores ALL markdown!)
- Wrong syntax: `/folder` instead of `folder/`

#### Check Selective Sync on iOS

1. Synctrain → Tap folder
2. **Selective Sync**
3. Ensure files/folders you need are checked
4. Tap **Save**

#### Verify Storage Space

**macOS:**
```bash
df -h /path/to/vault
```

**iOS:**
1. Settings → General → iPhone Storage
2. Ensure sufficient free space for vault

If low space, Synctrain may skip large files.

#### Force Full Rescan

**macOS:**
```bash
# API method
curl -X POST http://localhost:8384/rest/db/scan?folder=obsidian&sub=
```

**iOS:**
1. Synctrain → Folder → Actions → **Override Changes**
2. Choose "Download from remote" (re-downloads everything)
3. **Warning:** This will overwrite local changes!

---

### 8. Tailscale Connection Issues

**Symptoms:**
- Devices can't reach each other
- Ping fails
- Sync works on same Wi-Fi but not when apart

**Solutions:**

#### Verify Tailscale Running

**macOS:**
```bash
# Check status
tailscale status

# Should show: "[your-network] connected"

# If not connected
sudo tailscale up
```

**iOS:**
1. Open Tailscale app
2. Tap to connect if disconnected

#### Check Tailnet Membership

**Both devices:**
1. Verify both are in same tailnet
2. Tailscale admin panel: https://login.tailscale.com/admin/machines
3. Ensure both devices listed and active

#### Test Connectivity

**macOS:**
```bash
# Get iOS device's Tailscale IP
tailscale status | grep ios

# Ping iOS device
tailscale ping [ios-device-name]

# Should show: "pong from [ip] ..."
```

#### Enable Tailscale on Cellular (iOS)

If using cellular data:
1. iOS Settings → **Tailscale**
2. **Cellular Data** → Enable
3. iOS Settings → **Synctrain**
4. **Cellular Data** → Enable

#### Restart Tailscale

**macOS:**
```bash
sudo tailscale down
sudo tailscale up
```

**iOS:**
1. Tailscale app → Settings → Log out
2. Log back in

---

### 9. Syncthing Web UI Not Accessible

**Symptoms:**
- Can't access http://localhost:8384
- Browser shows "Connection refused"
- Syncthing seems to be running

**Solutions:**

#### Verify Syncthing is Running

```bash
# Check process
ps aux | grep syncthing

# Check port
lsof -i :8384
```

Expected output: `syncthing ... TCP localhost:8384 (LISTEN)`

#### Check Port Conflicts

```bash
# Check what's using port 8384
lsof -i :8384

# If another process, kill it or change Syncthing port
# Edit config: ~/Library/Application Support/Syncthing/config.xml
```

#### Restart Syncthing

```bash
# Stop
killall syncthing
# Or if using brew services
brew services stop syncthing

# Wait 5 seconds

# Start
syncthing
# Or
brew services start syncthing
```

#### Try Different Browser

- Chrome might block localhost in some configurations
- Try Safari or Firefox
- Try private/incognito mode

#### Check Firewall

```bash
# macOS Firewall settings
# System Settings → Network → Firewall

# Ensure Syncthing is allowed
```

---

### 10. Synctrain Not Installing or Crashing on iOS

**Symptoms:**
- Can't download from App Store
- App crashes on launch
- App shows blank screen

**Solutions:**

#### Update iOS

1. Settings → General → Software Update
2. Install latest iOS version
3. Synctrain requires iOS 15+

#### Reinstall Synctrain

1. Delete Synctrain app (long press → Remove App)
2. Restart iPhone
3. App Store → Search "Synctrain"
4. Install again

#### Check iOS Storage

1. Settings → General → iPhone Storage
2. Ensure at least 1GB free
3. Delete unused apps if needed

#### Report Bug

If crashes persist:
1. Capture crash logs: Settings → Privacy → Analytics & Improvements
2. Report issue on GitHub: https://github.com/pixelspark/sushitrain/issues

---

## Advanced Troubleshooting

### Enable Debug Logging

**macOS Syncthing:**
```bash
# Stop Syncthing
brew services stop syncthing

# Start with verbose logging
syncthing -verbose

# Logs will print to terminal
```

**View Logs:**
```bash
# Main log file
tail -f ~/Library/Application\ Support/Syncthing/syncthing.log

# Search for errors
grep -i error ~/Library/Application\ Support/Syncthing/syncthing.log
```

### Check Syncthing Version Compatibility

```bash
# macOS: Check version
syncthing --version

# Update Syncthing
brew upgrade syncthing
```

**iOS: Update Synctrain**
- App Store → Updates → Check for Synctrain update

Ensure both are recent versions for best compatibility.

### Reset Syncthing Database (Nuclear Option)

**Warning:** This will rescan entire vault. Only do if other solutions failed.

```bash
# Stop Syncthing
brew services stop syncthing

# Backup config
cp -r ~/Library/Application\ Support/Syncthing ~/syncthing-backup

# Remove database (keeps config)
rm -rf ~/Library/Application\ Support/Syncthing/index-v*

# Restart Syncthing (will rebuild database)
brew services start syncthing
```

### Check Network Bandwidth

```bash
# Monitor Syncthing traffic
nettop | grep syncthing

# Check Tailscale bandwidth
tailscale netcheck
```

If slow:
- Check Wi-Fi/cellular signal strength
- Restart router
- Try different network

---

## Getting Help

### Check Syncthing Status Page

Web UI → Actions → **Show System Status**
- Provides useful diagnostics
- CPU, memory, storage info
- Connection statistics

### Generate Support Bundle

**macOS:**
1. Web UI → Actions → **Generate Support Bundle**
2. Save .zip file
3. Share when asking for help

**iOS:**
1. Synctrain → Settings → **Generate Support Package**
2. Save and share

### Community Resources

- **Syncthing Forum**: https://forum.syncthing.net/
- **Synctrain GitHub Issues**: https://github.com/pixelspark/sushitrain/issues
- **Reddit r/Syncthing**: https://reddit.com/r/Syncthing
- **Reddit r/ObsidianMD**: https://reddit.com/r/ObsidianMD

### Useful Diagnostic Commands

```bash
# === macOS Diagnostics ===

# Syncthing status
ps aux | grep syncthing
lsof -i :8384
lsof -i :22000

# Tailscale status
tailscale status
tailscale netcheck
tailscale ping [device]

# Vault health
cd /path/to/vault
find . -type f | wc -l          # File count
du -sh .                         # Total size
find . -name "*.sync-conflict-*" # List conflicts

# Syncthing config location
ls -la ~/Library/Application\ Support/Syncthing/

# View recent logs
tail -50 ~/Library/Application\ Support/Syncthing/syncthing.log

# Check for errors
grep -i error ~/Library/Application\ Support/Syncthing/syncthing.log | tail -20
```

---

## Prevention Best Practices

To avoid future issues:

1. **Sync Habit on iOS:**
   - Always open Synctrain before Obsidian
   - Always sync after editing before switching devices

2. **Regular Maintenance:**
   - Monthly: Update Syncthing and Synctrain
   - Weekly: Check for conflict files
   - Monitor storage space

3. **Backup Strategy:**
   - Sync is not backup!
   - Use Time Machine on macOS
   - Consider Git for version control

4. **Network Stability:**
   - Keep Tailscale connected
   - Use reliable Wi-Fi when possible
   - Monitor cellular data usage

5. **Vault Hygiene:**
   - Keep .stignore updated
   - Don't sync unnecessary files
   - Organize files in folders

---

## Still Having Issues?

If you've tried everything and still have problems:

1. **Document the issue:**
   - Exact steps to reproduce
   - Error messages (screenshots helpful)
   - Device types and OS versions
   - Syncthing/Synctrain versions

2. **Gather diagnostics:**
   - Syncthing logs
   - Support bundles from both devices
   - Network status

3. **Ask for help:**
   - Syncthing Forum (very helpful community)
   - GitHub Issues (for Synctrain-specific bugs)
   - Include all documentation and diagnostics

4. **Consider alternatives:**
   - If Syncthing doesn't work for your use case
   - See CLAUDE.md for alternative approaches considered
   - GitHub API approach might suit better

---

## Emergency: Complete Reset

If everything is broken and you need to start fresh:

### macOS Reset

```bash
# 1. Backup your vault!
cp -r /path/to/vault ~/vault-backup-$(date +%Y%m%d)

# 2. Stop Syncthing
brew services stop syncthing
killall syncthing

# 3. Remove Syncthing config
rm -rf ~/Library/Application\ Support/Syncthing/

# 4. Restart Syncthing (creates fresh config)
brew services start syncthing

# 5. Re-configure from scratch using SETUP_MACOS.md
```

### iOS Reset

1. Delete Synctrain app
2. Delete ObsidianVault folder from Files app (after backing up!)
3. Restart iPhone
4. Reinstall Synctrain
5. Re-configure from scratch using SETUP_IOS.md

### Post-Reset

1. Follow [SETUP_MACOS.md](SETUP_MACOS.md) completely
2. Follow [SETUP_IOS.md](SETUP_IOS.md) completely
3. Test with small vault first before syncing full vault
4. Monitor closely for first few days

---

**Remember:** Most issues are configuration problems, not bugs. Carefully review setup guides and this troubleshooting doc. The Syncthing community is very helpful if you need support!
