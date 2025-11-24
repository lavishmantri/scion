# Obsidian Vault Sync - Syncthing + Tailscale

Free, open-source, private synchronization solution for Obsidian vaults across macOS and iOS devices using Syncthing over Tailscale network.

## 🎯 Overview

This solution provides **completely free, private, and reliable sync** for your Obsidian vault between macOS and iOS without any cloud services or monthly subscriptions.

### ✨ Features

- ✅ **100% Free** - No subscriptions, no paid apps
- ✅ **Open Source** - Syncthing and Synctrain are both open source
- ✅ **Private** - Your data never touches third-party servers
- ✅ **Secure** - Encrypted over Tailscale WireGuard VPN
- ✅ **Offline First** - Edit offline, syncs when connected
- ✅ **Battle-Tested** - Syncthing used by thousands for years
- ✅ **Zero Code** - No custom development required

### 🏗️ Architecture

```
┌─────────────────────────┐
│   macOS Obsidian Vault  │
│   + Syncthing (free)    │
└──────────┬──────────────┘
           │
           │ Syncthing Protocol
           │ via Tailscale VPN
           │ (Encrypted P2P)
           │
           ▼
┌─────────────────────────┐
│   iOS Obsidian Vault    │
│   + Synctrain (free)    │
└─────────────────────────┘
```

**No server required!** Syncthing is peer-to-peer.

## 📦 What's Included

This repository contains comprehensive documentation:

- **[CLAUDE.md](CLAUDE.md)** - Complete project documentation for Claude Code
- **[SETUP_MACOS.md](SETUP_MACOS.md)** - Step-by-step macOS setup guide
- **[SETUP_IOS.md](SETUP_IOS.md)** - Step-by-step iOS setup guide
- **[TROUBLESHOOTING.md](TROUBLESHOOTING.md)** - Comprehensive troubleshooting guide
- **[.stignore.template](.stignore.template)** - Template for excluding device-specific files

## 🚀 Quick Start

### Prerequisites

1. **Tailscale** account (free tier) - [tailscale.com](https://tailscale.com)
2. **Obsidian** installed on both devices - [obsidian.md](https://obsidian.md)
3. **macOS** 10.15+ and **iOS** 15+
4. **TestFlight** app on iOS (free, by Apple) - Required for Synctrain installation

**Note:** Synctrain is not available in the regular App Store in many regions due to cryptography regulations. Use TestFlight (Apple's official beta platform) instead.

### Setup Time

- macOS: 30 minutes
- iOS: 35 minutes (includes TestFlight setup)
- Total: ~1 hour 5 minutes

### Installation Steps

1. **macOS Setup**
   ```bash
   # Install Syncthing
   brew install syncthing
   brew services start syncthing

   # Open web UI
   open http://localhost:8384
   ```
   📖 Full instructions: [SETUP_MACOS.md](SETUP_MACOS.md)

2. **iOS Setup**
   - Install **TestFlight** from App Store (Apple's beta platform)
   - Join **Synctrain** beta: https://testflight.apple.com/join/2f54I4CM
   - Pair with macOS using QR code
   - Configure sync location

   📖 Full instructions: [SETUP_IOS.md](SETUP_IOS.md)

3. **Test Sync**
   - Create note on macOS → verify on iOS
   - Create note on iOS → verify on macOS

## 📱 Daily Usage

### macOS
- Syncthing runs automatically in background
- Changes sync immediately when saved
- No manual action required

### iOS
1. Open **Synctrain** app (syncs in foreground)
2. Wait for status: "Up to Date"
3. Open **Obsidian** to edit
4. After editing, switch back to **Synctrain** to sync

**Tip:** Use iPad Split View to keep both apps open simultaneously.

## 🔧 Components

### Technology Stack

| Component | Purpose | Cost | License |
|-----------|---------|------|---------|
| [Syncthing](https://syncthing.net/) | macOS sync engine | Free | MPL-2.0 |
| [Synctrain](https://testflight.apple.com/join/2f54I4CM) | iOS sync client | Free (TestFlight) | MPL-2.0 |
| [Tailscale](https://tailscale.com/) | VPN network | Free tier | Proprietary |
| [Obsidian](https://obsidian.md/) | Note-taking app | Free | Proprietary |

### Why These Tools?

- **Syncthing**: Industry-standard P2P sync, proven reliability
- **Synctrain**: Free open-source iOS client via TestFlight (not in App Store due to regional restrictions)
- **Tailscale**: Easiest WireGuard VPN setup, secure peer-to-peer
- **Obsidian**: Best markdown-based note-taking app

## ⚠️ Important Notes

### iOS Background Sync Limitations

iOS restricts background app activity for battery preservation. This affects **ALL** sync solutions:

- Synctrain syncs when app is open or iOS grants background refresh
- Best practice: Open Synctrain before/after using Obsidian
- This is iOS platform limitation, not app limitation

### One Writer at a Time

This setup assumes you follow "one writer at a time" practice:
- Edit on one device at a time
- Sync before switching devices
- Conflicts are rare with this practice

If conflicts occur, Syncthing creates `.sync-conflict-*` files for manual resolution.

## 🆚 Alternatives Considered

During planning, we evaluated multiple approaches:

| Solution | Cost | Time | Verdict |
|----------|------|------|---------|
| **Syncthing + Synctrain** | Free | 1 hour | ✅ **Chosen** |
| iCloud Drive | Free | 15 min | ❌ User can't use cloud |
| Obsidian Sync | $10/mo | 15 min | ❌ User wants free |
| Möbius Sync | $5 | 1 hour | ❌ User wants free |
| Git + Working Copy | $20 | 3 days | ❌ Working Copy broken on iOS |
| Custom Server | Free | 1-2 weeks | ❌ Unnecessary complexity |
| GitHub API + iOS App | Free | 1 week | ⚠️ Viable but more work |

**Winner:** Syncthing + Synctrain provides the best balance of cost (free), reliability (battle-tested), and setup time (1 hour).

## 🐛 Troubleshooting

Common issues and solutions:

### Devices Not Connecting
- Verify Tailscale connected on both devices
- Check Syncthing running on macOS: `ps aux | grep syncthing`
- Manually add Tailscale IPs in device settings

### Folder Not Syncing
- Force rescan in Syncthing/Synctrain
- Check .stignore patterns not too broad
- Verify sufficient storage space

### iOS Sync Delayed
- This is expected due to iOS limitations
- Open Synctrain before using Obsidian
- Use Split View on iPad to keep Synctrain visible

### Synctrain Not Available in App Store
- Synctrain requires TestFlight due to regional restrictions
- Install TestFlight from App Store (free, by Apple)
- Join beta: https://testflight.apple.com/join/2f54I4CM
- Alternative: Möbius Sync ($5) if TestFlight doesn't work

📖 Full troubleshooting guide: [TROUBLESHOOTING.md](TROUBLESHOOTING.md)

## 📚 Documentation

- **For Users:**
  - [README.md](README.md) (you are here) - Overview
  - [SETUP_MACOS.md](SETUP_MACOS.md) - macOS setup guide
  - [SETUP_IOS.md](SETUP_IOS.md) - iOS setup guide
  - [TROUBLESHOOTING.md](TROUBLESHOOTING.md) - Problem solving

- **For Developers:**
  - [CLAUDE.md](CLAUDE.md) - Complete technical documentation
  - [.stignore.template](.stignore.template) - Sync exclusion patterns

## 🔐 Security

### What's Encrypted?

- ✅ **Transport**: Syncthing uses TLS encryption
- ✅ **Network**: Tailscale uses WireGuard VPN (military-grade)
- ✅ **Authentication**: Public key cryptography for device pairing

### What's NOT Encrypted?

- ❌ **At-rest**: Files stored unencrypted on both devices
- ❌ **Backups**: Device backups are unencrypted (unless using encrypted backups)

If you need at-rest encryption, consider:
- macOS: FileVault full-disk encryption
- iOS: Enable device encryption (default on modern iOS)
- Vault-level: Cryptomator or similar tools

## 🛠️ Maintenance

### Regular Tasks

- **Monthly**: Update Syncthing (`brew upgrade syncthing`)
- **Monthly**: Update Synctrain (TestFlight updates)
- **Every 90 days**: Renew TestFlight beta (one-tap renewal when notified)
- **Weekly**: Check for conflict files (`.sync-conflict-*`)
- **Daily**: Monitor sync status

### Backup Strategy

**Important:** Sync ≠ Backup

Syncthing syncs changes, including deletions. It's not a backup solution.

Recommended backup strategy:
- macOS: Time Machine
- iOS: iCloud backup (device backup, not iCloud Drive sync)
- Optional: Git repository for version control

## 📖 Resources

### Official Documentation
- Syncthing Docs: https://docs.syncthing.net/
- Synctrain GitHub: https://github.com/pixelspark/sushitrain
- Tailscale KB: https://tailscale.com/kb/

### Community
- Syncthing Forum: https://forum.syncthing.net/
- r/Syncthing: https://reddit.com/r/Syncthing
- r/ObsidianMD: https://reddit.com/r/ObsidianMD

### Useful Commands

```bash
# Syncthing
syncthing --version                      # Check version
brew services start syncthing            # Start service
tail -f ~/Library/Application\ Support/Syncthing/syncthing.log  # View logs

# Tailscale
tailscale status                         # Check connection
tailscale ip -4                         # Get your IP
tailscale ping [device-name]            # Test connectivity
```

## 🤝 Contributing

This is a documentation repository. Contributions welcome:

- Improve setup instructions
- Add troubleshooting scenarios
- Report issues with guides
- Share tips and tricks

## 📄 License

This documentation is released into the public domain (CC0).

The tools used (Syncthing, Synctrain, Tailscale, Obsidian) have their own licenses.

## 🙏 Acknowledgments

- **Syncthing team** - For creating robust P2P sync
- **Tommy van der Vorst** ([pixelspark](https://github.com/pixelspark)) - For Synctrain/Sushitrain iOS app
- **Tailscale team** - For making VPN setup trivial
- **Obsidian team** - For the best note-taking app

## ⚡ Quick Reference

### Setup Checklist

- [ ] Tailscale installed and connected
- [ ] macOS: Syncthing installed and running
- [ ] macOS: Vault added as shared folder
- [ ] macOS: .stignore file created
- [ ] iOS: Synctrain installed
- [ ] iOS: Devices paired via QR code
- [ ] iOS: Folder accepted and synced
- [ ] iOS: Obsidian opens synced vault
- [ ] Test sync: macOS → iOS ✓
- [ ] Test sync: iOS → macOS ✓

### Getting Help

1. Check [TROUBLESHOOTING.md](TROUBLESHOOTING.md)
2. Search [Syncthing Forum](https://forum.syncthing.net/)
3. Post question with:
   - Exact steps to reproduce
   - Error messages/screenshots
   - Device types and OS versions
   - Syncthing/Synctrain versions

### Emergency Contacts

- Syncthing Issues: https://github.com/syncthing/syncthing/issues
- Synctrain Issues: https://github.com/pixelspark/sushitrain/issues
- Tailscale Support: https://tailscale.com/contact/support

---

**Ready to get started?** Jump to [SETUP_MACOS.md](SETUP_MACOS.md) to begin!
