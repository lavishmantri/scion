# iOS Setup Guide - Obsidian Sync with Synctrain

Complete step-by-step guide to set up Synctrain on iOS for Obsidian vault synchronization.

## Prerequisites

- [ ] iPhone or iPad with iOS 15 or later
- [ ] Tailscale app installed and connected
- [ ] Obsidian app installed from App Store
- [ ] macOS Syncthing already configured (see [SETUP_MACOS.md](SETUP_MACOS.md))
- [ ] macOS device powered on and connected to Tailnet

## Installation Steps

### Step 1: Install Synctrain

1. Open **App Store** on iOS
2. Search for "**Synctrain**"
3. Download and install (FREE, no in-app purchases)
4. Open Synctrain app

### Step 2: Pair with macOS Device

You have two methods to connect:

#### Method A: QR Code Pairing (Recommended - Easiest)

**On macOS:**
1. Open Syncthing web UI: http://localhost:8384
2. Click **Actions → Show ID**
3. QR code will display

**On iOS:**
1. In Synctrain app, tap **+** (top right)
2. Tap **Scan QR Code**
3. Grant camera permissions if prompted
4. Point camera at macOS QR code
5. Device will be added automatically

#### Method B: Manual Device ID Entry

**On macOS:**
1. Open Syncthing web UI
2. Go to **Actions → Settings → General**
3. Copy your Device ID (long alphanumeric string)

**On iOS:**
1. In Synctrain app, tap **+** (top right)
2. Tap **Enter Device ID**
3. Paste the Device ID from macOS
4. Enter a device name (e.g., "MacBook")
5. Tap **Add**

### Step 3: Accept Device Pairing on macOS

**On macOS:**
1. Syncthing web UI will show a notification: "New Device [iOS-device-name]"
2. Click **Add Device**
3. Verify the Device ID matches your iOS device
4. Check **Share Folders With Device** → Select "Obsidian" folder
5. Click **Save**

### Step 4: Accept Shared Folder on iOS

**On iOS:**
1. Synctrain will show notification: "New folder 'Obsidian' from [macOS-device]"
2. Tap the notification or go to **Folders** tab
3. Tap **Accept**
4. Choose sync location (see Step 5)

### Step 5: Configure Sync Location

When accepting the folder, you need to choose where to sync:

**Recommended Location:**
- **Files app → On My iPhone/iPad → Create new folder**

**Steps:**
1. Tap **Select Folder** in Synctrain
2. Navigate to **On My iPhone** (or On My iPad)
3. Tap **New Folder** (top right)
4. Name it: `ObsidianVault`
5. Select the newly created folder
6. Tap **Done**

**Important:**
- Do NOT use iCloud Drive (causes conflicts)
- Do NOT use app-specific storage
- Use "On My iPhone/iPad" for best compatibility with Obsidian

### Step 6: Wait for Initial Sync

1. Synctrain will start syncing
2. Progress bar shows sync status
3. Initial sync may take several minutes depending on vault size
4. Status will change to **"Up to Date"** when complete

**Monitoring Sync:**
- Tap folder name to see details
- View file count, size, and sync progress
- Check for any errors or warnings

### Step 7: Configure Obsidian iOS

1. Open **Obsidian** app on iOS
2. Tap **Open folder as vault**
3. Tap **Browse** (bottom left)
4. Navigate to **On My iPhone** → **ObsidianVault**
5. Tap folder to select
6. Tap **Open** (top right)
7. Your synced vault will open

### Step 8: Configure Synctrain Settings (Optional but Recommended)

**Enable Background App Refresh:**
1. iOS **Settings** → **Synctrain**
2. Enable **Background App Refresh**
3. This allows more frequent sync (still limited by iOS)

**Synctrain App Settings:**
1. Open Synctrain
2. Tap **Settings** (gear icon)
3. Recommended settings:
   - ✅ Enable notifications (to know when sync completes)
   - ✅ Auto-sync on app open
   - ⚠️ Disable "Only sync on Wi-Fi" (if using Tailscale over cellular)

### Step 9: Test Sync

**Test 1: macOS → iOS**
1. On macOS, create a new note in Obsidian
2. On iOS, open Synctrain (to trigger sync)
3. Open Obsidian iOS
4. Verify the new note appears

**Test 2: iOS → macOS**
1. On iOS, create a new note in Obsidian
2. Close Obsidian, open Synctrain (to trigger sync)
3. On macOS, check Syncthing web UI (should show sync activity)
4. Open Obsidian macOS
5. Verify the new note appears

## Verification Checklist

- [ ] Synctrain installed from App Store
- [ ] macOS device paired (shows "Connected" in Synctrain)
- [ ] "Obsidian" folder accepted and syncing
- [ ] Sync location: On My iPhone/iPad
- [ ] Initial sync completed (status: "Up to Date")
- [ ] Obsidian iOS opens synced vault successfully
- [ ] Test sync works both directions
- [ ] Background App Refresh enabled
- [ ] Notifications enabled

## Daily Usage Workflow

### Before Editing Notes

1. Open **Synctrain** app
2. Wait for sync to complete (status: "Up to Date")
3. Open **Obsidian**
4. Edit your notes

### After Editing Notes

1. Save and close notes in Obsidian
2. Switch to **Synctrain** app
3. Wait for sync to complete (status: "Up to Date")
4. Changes are now synced to macOS

### Pro Tips

**Tip 1: Use iOS Split View**
- Open Synctrain on left side
- Open Obsidian on right side
- Synctrain syncs in real-time while you edit

**Tip 2: Use Shortcuts for Automation**
- Create iOS Shortcut to open Synctrain, wait 10s, then open Obsidian
- Create Shortcut to close Obsidian, open Synctrain, wait 10s

**Tip 3: Monitor Folder Status**
- Add Synctrain widget to home screen
- Shows sync status without opening app

## Troubleshooting

### Devices Not Connecting

**Check Tailscale:**
1. Open **Tailscale** app
2. Verify status shows "Connected"
3. Check macOS device is listed and online

**Check Synctrain:**
1. Open Synctrain → **Devices** tab
2. macOS device should show "Connected"
3. If "Disconnected", tap device → **Edit** → verify IP address

**Manual IP Configuration:**
1. On macOS, find Tailscale IP: `tailscale ip -4`
2. On iOS Synctrain:
   - Tap macOS device
   - Tap **Addresses**
   - Add: `tcp://100.x.x.x:22000` (your Tailscale IP)
   - Save

### Folder Not Syncing

**Check Folder Status:**
1. Synctrain → **Folders** tab
2. Tap "Obsidian" folder
3. Check status and error messages

**Common Issues:**
- **"Out of Sync"**: Conflicts detected
  - Check for `.sync-conflict-*` files
  - Resolve manually and sync again
- **"Scanning"**: Normal, wait for completion
- **"Stopped"**: Tap folder → Resume
- **"Error"**: Tap for details, check permissions

**Force Rescan:**
1. Tap folder → **Actions** → **Scan**
2. Or: Tap folder → **Override Changes** (nuclear option, use carefully)

### Obsidian Can't Open Vault

**Permissions Issue:**
1. iOS Settings → **Obsidian**
2. Check **Files and Folders** access is enabled
3. Grant access to "On My iPhone"

**Wrong Folder Selected:**
1. Obsidian → Settings → **About**
2. Check vault path
3. Should point to: On My iPhone/ObsidianVault
4. If wrong, close vault and reopen correct folder

### Sync Is Very Slow

**iOS Limitations:**
- iOS restricts background processes
- Sync only happens when Synctrain is active
- This is iOS platform limitation, not app bug

**Improve Sync Speed:**
1. Keep Synctrain open while syncing
2. Use iOS Split View (Synctrain visible = active)
3. Connect to same Wi-Fi network as macOS (faster than Tailscale over cellular)
4. Disable other network-intensive apps

### Files Missing on iOS

**Check Selective Sync:**
1. Synctrain → Tap folder → **Selective Sync**
2. Ensure files/folders aren't excluded
3. Check .stignore patterns on macOS

**Check Storage Space:**
1. iOS Settings → **General** → **iPhone Storage**
2. Ensure enough free space for vault
3. If low, Synctrain may skip large files

### Conflicts Appearing

**Why Conflicts Happen:**
- Same file edited on both devices while offline
- Rare with "one writer at a time" practice

**How to Resolve:**
1. Files appear as: `filename.sync-conflict-20250101-123456.ext`
2. Review both versions
3. Merge changes manually
4. Delete conflict file
5. Sync again

## iOS Limitations (Important)

### Background Sync Restrictions

**iOS Platform Restrictions:**
- Apps can't run continuously in background (battery preservation)
- Background App Refresh is **not guaranteed** to run frequently
- No way to force continuous background sync (Apple policy)

**What This Means:**
- Synctrain syncs when: app is open, or iOS decides to run background refresh
- Best practice: Open Synctrain before and after using Obsidian
- Not as seamless as macOS, but workable with habit

**This Affects ALL iOS Sync Apps:**
- Synctrain, Möbius Sync, any custom app
- Even if you build custom solution, same iOS limitations apply
- iCloud Drive is exception (Apple's own service has special privileges)

### Cellular Data Usage

If using Tailscale over cellular:
1. iOS Settings → **Synctrain** → **Cellular Data** → Enable
2. iOS Settings → **Tailscale** → **Cellular Data** → Enable
3. Monitor data usage if on limited plan
4. Consider enabling "Only sync on Wi-Fi" in Synctrain if data is concern

## Advanced Configuration

### Selective Sync (Save Storage)

Don't sync certain folders to iOS:
1. Synctrain → Tap folder → **Selective Sync**
2. Uncheck folders to exclude
3. Example: Exclude large "Attachments" folder
4. Tap **Save**

### Conflict Resolution Settings

1. Synctrain → **Settings** → **Sync**
2. Choose conflict strategy:
   - Create conflict files (default, recommended)
   - Override local changes
   - Override remote changes

### Notification Preferences

1. iOS Settings → **Synctrain** → **Notifications**
2. Customize alert style
3. Recommended: Enable for sync completion

### Battery Optimization

If Synctrain drains battery:
1. Don't keep app open continuously
2. Open only before/after Obsidian use
3. Reduce sync frequency (if option available in future versions)

## Next Steps

Once iOS setup is complete:
1. **Test sync thoroughly** (create notes on both sides)
2. **Establish sync habit** (open Synctrain before/after Obsidian)
3. **Monitor for conflicts** (rare but check occasionally)
4. **Refer to** [TROUBLESHOOTING.md](TROUBLESHOOTING.md) if issues arise

## Useful App Locations

```
Synctrain Data:
- App Container: Files app → On My iPhone → Synctrain

Obsidian Vault:
- Files app → On My iPhone → ObsidianVault

System Settings:
- Settings → Synctrain
- Settings → Obsidian
- Settings → Tailscale
```

## Resources

- Synctrain App Store: https://apps.apple.com/app/synctrain/id6553985316
- Synctrain GitHub (Sushitrain): https://github.com/pixelspark/sushitrain
- Syncthing Docs: https://docs.syncthing.net/
- iOS Files App Guide: https://support.apple.com/guide/iphone/files-iphf35eba6e7/ios
