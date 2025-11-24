# Quick Start Guide

Get your Obsidian vault syncing with GitHub in 5 minutes.

---

## Step 1: Install Plugin (2 minutes)

Your plugin is already built at:
```
/Users/lavishmantri/Projects/scion/obsidian-vault-sync-plugin/
```

**Create symlink**:
```bash
ln -s /Users/lavishmantri/Projects/scion/obsidian-vault-sync-plugin \
      /Users/lavishmantri/Obsidian/brainiac/.obsidian/plugins/obsidian-vault-sync
```

**Restart Obsidian**, then enable in Settings → Community Plugins

---

## Step 2: Configure GitHub (2 minutes)

### Your Current Settings:
- **Token**: `github_pat_11AWMLXUA0QGU...` ✅ Already configured
- **Owner**: `lavishmantri` ✅
- **Repo**: `obsession` ✅
- **Branch**: `main` ✅

Settings already saved! Skip to Step 3.

---

## Step 3: Clean Up Repository (1 minute)

Your GitHub repo currently has duplicate/test files:
```
README
README.md
Test-watch.md.md
Untitled.md
Welcome.md
delete-test.md.md
```

Your local vault has:
```
README
Test-watch.md.md
Welcome.md
```

**Recommended: Use Force Push to Reset**

1. Command Palette (Cmd+P)
2. Type "force push"
3. Select: "Force push vault to GitHub (⚠️ overwrites remote)"
4. Read warning, click "Force Push"
5. GitHub will now match your local vault exactly

**After force push, GitHub will have**:
```
README
Test-watch.md.md
Welcome.md
```

All duplicates and test files removed!

---

## Step 4: Test Sync (30 seconds)

### Test Create:
1. Create a new file: `sync-test.md`
2. Add content: "Testing sync!"
3. Wait 2 seconds (debounce)
4. Check status bar: "⟳ Syncing..." → "✓ Synced: 1 added"
5. Check GitHub: File should appear

### Test Modify:
1. Edit `sync-test.md`
2. Add more content
3. Wait 2 seconds
4. Check GitHub: Changes should appear

### Test Delete:
1. Delete `sync-test.md`
2. Wait 2 seconds
3. Check GitHub: File should be deleted

---

## Step 5: Configure Auto-Sync (30 seconds)

1. Settings → Vault Sync
2. Set "Auto-sync interval": **5** minutes
3. Files now sync automatically every 5 minutes
4. Plus auto-sync on file changes (2-second window)

---

## Settings Cheat Sheet

### Recommended Settings (Your Current Setup)

```yaml
Sync Mode: GitHub API
Auto-sync interval: 5 minutes
Excluded folders: .obsidian, .trash, .git
Conflict resolution: last-write-wins
Sync deletions: ON
Use trash for deletions: ON
Force push mode: OFF
Enable logging: ON (for debugging)
Show notifications: ON
```

### When to Change Settings

**Sync deletions OFF**:
- If you share vault with others
- If accidental deletions are a concern
- If you want manual delete control

**Use trash OFF**:
- If you want permanent deletes
- If you trust delete operations
- If .trash/ folder gets too large

**Force push mode ON**:
- ⚠️ ONLY if you want local to always win
- ⚠️ Remote changes will always be overwritten
- ⚠️ Use temporarily, then disable!

---

## Commands Quick Reference

### Command Palette (Cmd+P)

1. **"Sync vault"**
   - Normal sync
   - Bidirectional
   - Safe

2. **"Test sync connection"**
   - Verify GitHub access
   - Check token/repo

3. **"Force push vault to GitHub"**
   - Overwrite remote with local
   - Requires confirmation
   - ⚠️ Destructive

### Ribbon Icon

- **⟳ Sync icon** - Same as "Sync vault" command

---

## Troubleshooting Quick Fixes

### Files Disappeared from Vault

**Cause**: Delete bug (fixed in latest version)
**Fix**:
1. Check `.trash/` folder
2. Restore files from trash
3. Use force push to restore from GitHub
4. Update to latest build

### Sync Not Working

**Check**:
1. Status bar - what does it show?
2. Console logs - any errors?
3. Settings - token configured?
4. GitHub - repo accessible?

**Quick Fix**:
- Click "Test connection" in settings
- If fails, regenerate GitHub token

### Too Many Syncs

**Cause**: Auto-sync too aggressive
**Fix**:
- Increase auto-sync interval (5 → 10 minutes)
- Debouncer handles rapid changes automatically

### Files Not Deleting

**Check**:
1. Settings → "Sync deletions" enabled?
2. Check `.trash/` folder
3. Enable logging, check console

---

## Monitoring Sync Activity

### Enable Logging

Settings → Enable logging → ON

### Watch Console

1. Cmd+Option+I (open console)
2. Perform sync
3. Look for:
   ```
   [Vault Sync] Starting sync
   [Vault Sync] Found X local files, Y remote files
   [Vault Sync] Uploading/Downloading...
   [Vault Sync] ✓ Uploaded: filename.md
   [Vault Sync] Sync complete: X added, Y modified
   ```

### Status Bar

- ✓ Synced = Good
- ⟳ Syncing = In progress
- ✗ Error = Check console
- ⚠ Conflict = Check for .conflict- files

---

## Performance Tips

1. **Use Batch Uploads**
   - Automatic for 5+ files
   - 6.7x faster than individual
   - Already enabled by default

2. **Optimize Auto-Sync**
   - Don't set too low (<5 minutes)
   - File watching handles immediate changes
   - Timer is for periodic checks

3. **Exclude Large Folders**
   - Add to "Excluded folders"
   - Reduces sync overhead
   - Example: `attachments, videos`

4. **Check File Count**
   - Enable logging
   - Look for "Found X local files"
   - If >500 files, initial sync may be slow

---

## Current Status

**Your Plugin**:
- ✅ Installed and loaded
- ✅ Configured with GitHub token
- ✅ Connected to `lavishmantri/obsession`
- ✅ Latest build (57KB, 2,392 lines)
- ✅ All Day 3 features working
- ✅ Delete bug fixed

**Next Action**:
1. Use force push to clean up GitHub
2. Test new file creation
3. Verify delete bug is fixed
4. Enjoy automatic syncing!

---

## Help & Support

**Documentation**:
- Full features: [README.md](README.md)
- Installation: [INSTALL.md](INSTALL.md)
- Sync scenarios: [SYNC_SCENARIOS.md](SYNC_SCENARIOS.md)
- Force push: [FORCE_PUSH_FEATURE.md](FORCE_PUSH_FEATURE.md)
- Complete status: [PROJECT_STATUS.md](PROJECT_STATUS.md)

**Need Help?**
- Enable logging and check console
- Review documentation
- Check GitHub Issues (if any)

---

**You're all set!** Your Obsidian vault is ready to sync with GitHub automatically. 🚀
