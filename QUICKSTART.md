# 🚀 Quick Start - Get Syncing in 1 Hour

The absolute fastest path from zero to syncing Obsidian vault between macOS and iOS.

## ⏱️ Time Estimate

- **macOS**: 30 minutes
- **iOS**: 35 minutes (includes TestFlight setup)
- **Total**: 1 hour 5 minutes

## 📋 Before You Start

Make sure you have:

- [ ] macOS computer (10.15+)
- [ ] iPhone or iPad (iOS 15+)
- [ ] Tailscale account (free) - [Sign up here](https://login.tailscale.com/start)
- [ ] Existing Obsidian vault or ready to create one
- [ ] 15 minutes of uninterrupted time for each device

---

## Part 1: macOS Setup (30 minutes)

### Step 1: Install Tailscale (5 min)

1. Download: https://tailscale.com/download/mac
2. Install and run Tailscale
3. Sign in when prompted
4. Verify: Menu bar should show Tailscale icon

### Step 2: Install Syncthing (5 min)

```bash
# Open Terminal and run:
brew install syncthing
brew services start syncthing
```

Wait 30 seconds, then open: http://localhost:8384

### Step 3: Get Device ID (2 min)

In Syncthing web UI (http://localhost:8384):
1. Click **Actions** → **Show ID**
2. QR code appears
3. **Leave this window open** (you'll need it for iOS)

### Step 4: Add Tailscale IP (5 min)

```bash
# In Terminal, get your Tailscale IP:
tailscale ip -4
```

Copy the IP (looks like `100.x.x.x`)

In Syncthing web UI:
1. **Actions** → **Settings** → **Connections**
2. Find "Sync Protocol Listen Addresses"
3. Add a new line: `tcp://100.x.x.x:22000` (replace with your IP)
4. Click **Save**
5. Restart Syncthing:
   ```bash
   brew services restart syncthing
   ```

### Step 5: Add Vault Folder (5 min)

In Syncthing web UI:
1. Click **Add Folder** (bottom right)
2. **Folder Path**: Browse to your Obsidian vault
3. **Folder Label**: `Obsidian`
4. ✅ Check "Watch for Changes"
5. Click **Save**

### Step 6: Create .stignore (3 min)

```bash
# Replace path with your vault location:
cd /Users/YOUR_USERNAME/Documents/ObsidianVault

# Create .stignore file:
cat > .stignore << 'EOF'
.obsidian/workspace.json
.obsidian/workspace-mobile.json
.obsidian/app.json
.obsidian/appearance.json
.obsidian/cache/
.trash/
.DS_Store
EOF

# Verify:
cat .stignore
```

### ✅ macOS Complete!

Syncthing should show your folder with status "Idle" or "Scanning".

**Keep the QR code window open for iOS setup!**

---

## Part 2: iOS Setup (35 minutes)

### Step 1: Install Apps (10 min)

**Important:** Synctrain is not in the regular App Store. Use TestFlight (Apple's official beta platform) instead.

#### Part A: Install TestFlight (2 min)
1. Open **App Store** on iOS
2. Search for "**TestFlight**"
3. Download and install (FREE, by Apple)
4. Open TestFlight app once installed

#### Part B: Join Synctrain Beta (3 min)
1. On your iPhone/iPad, open this link: **https://testflight.apple.com/join/2f54I4CM**
2. Link will open in TestFlight app
3. Tap "**Accept**" to join Synctrain beta
4. Tap "**Install**" to download Synctrain
5. Wait for installation (~1 min)
6. Synctrain icon appears on home screen

#### Part C: Install Other Apps (5 min)
From App Store, install:
1. **Tailscale** (if not already installed)
2. **Obsidian** (if not already installed)

**Why TestFlight?** Synctrain isn't available in regular App Store in many regions due to cryptography regulations. TestFlight has no regional restrictions.

### Step 2: Connect Tailscale (2 min)

1. Open **Tailscale** app
2. Tap **Sign In**
3. Use same account as macOS
4. Verify: Status shows "Connected"

### Step 3: Pair with macOS (5 min)

1. Open **Synctrain** app
2. Tap **+** (top right)
3. Tap **Scan QR Code**
4. Grant camera permission
5. Point at macOS QR code (from Step 3 of macOS setup)
6. Device added automatically!

### Step 4: Accept on Both Sides (3 min)

**On macOS** (Syncthing web UI):
- Notification: "New Device [Your-iPhone]"
- Click **Add Device**
- Check "Share Folders With Device" → Select "Obsidian"
- Click **Save**

**On iOS** (Synctrain):
- Notification: "New folder 'Obsidian'"
- Tap notification
- Tap **Accept**

### Step 5: Choose Sync Location (3 min)

When accepting folder:
1. Tap **Select Folder**
2. Navigate to **On My iPhone** (or On My iPad)
3. Tap **New Folder** icon
4. Name: `ObsidianVault`
5. Select the folder
6. Tap **Done**

### Step 6: Wait for Sync (5-10 min)

- Synctrain shows progress bar
- Wait until status: **"Up to Date"**
- Time depends on vault size

### Step 7: Open in Obsidian (2 min)

1. Open **Obsidian** app
2. Tap **Open folder as vault**
3. Navigate to: **On My iPhone** → **ObsidianVault**
4. Tap folder to select
5. Tap **Open**
6. Your synced vault opens!

### Step 8: Enable Settings (2 min)

**iOS Settings:**
1. **Settings** → **Synctrain**
2. Enable **Background App Refresh**
3. **Settings** → **Obsidian**
4. Enable **Files and Folders** access

**Synctrain Settings:**
1. Open Synctrain → Tap **Settings** (gear icon)
2. Enable notifications

### ✅ iOS Complete!

---

## Part 3: Test Sync (5 minutes)

### Test 1: macOS → iOS

1. **macOS**: Open Obsidian, create note "Test from Mac"
2. **iOS**: Open Synctrain, wait for "Up to Date"
3. **iOS**: Open Obsidian
4. **✅ Verify**: "Test from Mac" note appears

### Test 2: iOS → macOS

1. **iOS**: In Obsidian, create note "Test from iPhone"
2. **iOS**: Close Obsidian, open Synctrain, wait for "Up to Date"
3. **macOS**: Open Obsidian
4. **✅ Verify**: "Test from iPhone" note appears

### 🎉 Success!

Both tests passed? You're all set!

---

## 📱 Daily Usage

### On iOS (Important!)

**Before editing:**
1. Open **Synctrain** app
2. Wait for status: "Up to Date"
3. Open **Obsidian**

**After editing:**
1. Close Obsidian
2. Open **Synctrain**
3. Wait for status: "Up to Date"

**Why?** iOS limits background sync. Opening Synctrain triggers sync manually.

### On macOS

Nothing special! Syncthing runs automatically. Just use Obsidian normally.

---

## 🆘 Something Not Working?

### Devices Won't Connect

```bash
# macOS Terminal:
tailscale status    # Verify connected
tailscale ping [your-iphone-name]  # Test connectivity
```

**iOS**: Check Tailscale app shows "Connected"

### Folder Won't Sync

**macOS**: Syncthing web UI → Folder → **Rescan**
**iOS**: Synctrain → Tap folder → **Scan**

### Obsidian Can't Open Vault

**iOS**: Settings → Obsidian → Enable "Files and Folders"

### Synctrain Not Showing Up?

If TestFlight link doesn't work or Synctrain won't install:
- **Alternative**: Möbius Sync ($5) - Search in App Store
- **Check**: Your iOS version (needs iOS 15+)
- **Try**: Closing TestFlight and reopening the link

### Still Stuck?

📖 See [TROUBLESHOOTING.md](TROUBLESHOOTING.md) for detailed help.

---

## 💡 Pro Tips

### iPad Split View

1. Open **Synctrain** on left (25% width)
2. Open **Obsidian** on right (75% width)
3. Synctrain stays active and syncs in real-time!

### iOS Shortcuts

Create Shortcut to automate:
```
Open Synctrain → Wait 10s → Open Obsidian
```

### Monitor Sync

Add Synctrain widget to iOS home screen for quick status check.

---

## 📚 Next Steps

Now that you're syncing:

1. **Read full docs**: [README.md](README.md)
2. **Customize**: Edit `.stignore` for your needs
3. **Optimize**: Adjust sync frequency and settings
4. **Backup**: Set up Time Machine (macOS) and device backups

---

## 🎓 Learning Resources

- **Syncthing Basics**: https://docs.syncthing.net/intro/getting-started.html
- **Synctrain GitHub**: https://github.com/pixelspark/sushitrain
- **Obsidian Help**: https://help.obsidian.md/

---

## ✅ Final Checklist

- [ ] macOS: Syncthing running and showing vault
- [ ] macOS: .stignore file created in vault
- [ ] iOS: Synctrain shows "Connected" to macOS
- [ ] iOS: Folder status "Up to Date"
- [ ] iOS: Obsidian opens synced vault
- [ ] Test sync: macOS → iOS ✓
- [ ] Test sync: iOS → macOS ✓
- [ ] Understand iOS sync workflow
- [ ] Know where to get help

---

**🎊 Congratulations!** You now have free, private, secure Obsidian sync!

**Questions?** Check [TROUBLESHOOTING.md](TROUBLESHOOTING.md) or ask the [Syncthing community](https://forum.syncthing.net/).

**Enjoying this setup?** Star the Synctrain project on [GitHub](https://github.com/pixelspark/sushitrain)!
