# Installation Guide

## Quick Start (5 minutes)

### Step 1: Install Plugin

Choose one of the following methods:

#### Method A: Symlink (Recommended for Development)

```bash
# Navigate to your Obsidian vault's plugin folder
cd ~/Documents/ObsidianVault/.obsidian/plugins  # Adjust path to your vault

# Create symlink to plugin source
ln -s /Users/lavishmantri/Projects/scion/obsidian-vault-sync-plugin vault-sync
```

**Advantages**:
- Changes to source code immediately available in Obsidian (after reload)
- No need to copy files repeatedly
- Easy to update

#### Method B: Copy Plugin

```bash
# Navigate to your Obsidian vault's plugin folder
cd ~/Documents/ObsidianVault/.obsidian/plugins  # Adjust path to your vault

# Copy the plugin
cp -r /Users/lavishmantri/Projects/scion/obsidian-vault-sync-plugin vault-sync
```

**Note**: You'll need to copy again after any code changes.

### Step 2: Enable Plugin in Obsidian

1. Open Obsidian
2. Open Settings (`Cmd+,` or `Ctrl+,`)
3. Go to **Community Plugins**
4. If prompted, turn off **Safe mode**
5. Click **Reload plugins** (or restart Obsidian)
6. Find **Vault Sync** in the list
7. Toggle it **ON**

You should see:
- Sync icon (⟳) in the left ribbon
- "✓ Synced" in the status bar at bottom

### Step 3: Configure GitHub Sync

#### 3.1 Create or Use Existing GitHub Repository

**Option A: Create New Repository**

1. Go to [GitHub](https://github.com/new)
2. Create a new repository:
   - **Name**: Choose a name (e.g., `obsidian-vault`)
   - **Visibility**: Private (recommended) or Public
   - **Initialize**: Can be empty or with README - both work!
3. Click "Create repository"

**Option B: Use Existing Repository**

1. Use any existing GitHub repository
2. Can already contain files - plugin will merge intelligently
3. Works with repositories that have your vault content already

In both cases, note the repository owner (your username) and repository name.

#### 3.2 Create GitHub Personal Access Token

1. Go to [GitHub Settings → Personal access tokens → Fine-grained tokens](https://github.com/settings/tokens?type=beta)
2. Click **"Generate new token"**
3. Configure:
   - **Token name**: `Obsidian Vault Sync`
   - **Expiration**: 1 year (your choice)
   - **Repository access**: "Only select repositories"
     - Select your vault repository
   - **Permissions** → Repository permissions:
     - **Contents**: Read and write ✅
     - (All others can stay default/none)
4. Click **"Generate token"**
5. **Copy the token** (starts with `ghp_...`)
   - ⚠️ Save it somewhere - you won't be able to see it again!

#### 3.3 Configure Plugin Settings

1. In Obsidian, go to **Settings → Vault Sync**
2. Enter your GitHub details:
   - **Personal Access Token**: Paste your `ghp_...` token
   - **Repository owner**: Your GitHub username
   - **Repository name**: The repo you created (e.g., `obsidian-vault`)
   - **Branch**: `main` (or `master` for older repos)
3. Click **"Test connection"**
4. Should show: **"✓ Success"**

If test fails, see [Troubleshooting](#troubleshooting) below.

### Step 4: Configure Sync Behavior

1. **Auto-sync interval**: How often to sync automatically
   - Default: 5 minutes
   - Set to 0 to disable auto-sync (manual only)

2. **Excluded folders**: Folders to skip during sync
   - Default: `.obsidian, .trash, .git`
   - Add more if needed (comma-separated)

3. **Conflict resolution**:
   - **Last write wins**: Newer file overwrites older (simpler)
   - **Create conflict file**: Keeps both versions for manual merge (safer)

4. **Show notifications**: Toggle sync event notifications
5. **Enable logging**: Enable for debugging (shows in developer console)

### Step 5: Understand Sync Behavior

The plugin intelligently handles all scenarios:

**Scenario 1: Empty Vault + Populated GitHub Repo**
- ✅ Downloads all files from GitHub to your vault
- Perfect for setting up on a new device

**Scenario 2: Populated Vault + Empty GitHub Repo**
- ✅ Uploads all your vault files to GitHub
- Perfect for initial backup

**Scenario 3: Both Have Files**
- ✅ Merges intelligently:
  - Downloads files only on GitHub
  - Uploads files only in vault
  - For files in both: uses conflict resolution strategy

**Scenario 4: Both Empty**
- ✅ Waits for you to add files to either location

### Step 6: Test Manual Sync

1. Click the **sync icon (⟳)** in left ribbon
   - OR use Command Palette: `Ctrl+P` → "Sync vault"
2. Watch status bar change:
   - "⟳ Syncing..." while in progress
   - "✓ Synced" when complete
3. Check your GitHub repository:
   - Should see your vault files uploaded
   - (Day 1: This is a placeholder; actual sync coming Day 2)

---

## Verification Checklist

After installation, verify these work:

- [ ] Plugin appears in Settings → Community Plugins
- [ ] Sync icon (⟳) visible in left ribbon
- [ ] Status bar shows "✓ Synced" at bottom
- [ ] Command Palette has "Sync vault" command
- [ ] Settings → Vault Sync opens configuration
- [ ] GitHub connection test shows "✓ Success"

---

## Troubleshooting

### Plugin doesn't appear in Obsidian

**Cause**: Plugin not in correct folder or Obsidian hasn't detected it

**Solution**:
```bash
# Verify plugin is in correct location
ls ~/.../YourVault/.obsidian/plugins/vault-sync

# Should show: manifest.json, main.js, etc.
```

If files are missing:
1. Rebuild plugin: `npm run build` in plugin source folder
2. Verify `main.js` exists
3. Restart Obsidian

### "Test connection" fails with 401 Unauthorized

**Cause**: Invalid or expired GitHub token

**Solution**:
1. Verify token is copied correctly (no extra spaces)
2. Check token hasn't expired
3. Generate new token if needed

### "Test connection" fails with 403 Forbidden

**Cause**: Token lacks required permissions

**Solution**:
1. Go to GitHub → Settings → Personal access tokens
2. Find your token
3. Click "Edit"
4. Under Permissions → Repository permissions:
   - Ensure **Contents** is set to **Read and write**
5. Save changes

### "Test connection" fails with 404 Not Found

**Cause**: Repository doesn't exist or name is incorrect

**Solution**:
1. Verify repository owner (your username)
2. Verify repository name (exact match, case-sensitive)
3. Check repository exists on GitHub
4. Ensure token has access to this repository

### Status bar shows nothing

**Cause**: Plugin might not be fully loaded

**Solution**:
1. Restart Obsidian
2. Check developer console for errors:
   - Mac: `Cmd+Option+I`
   - Windows/Linux: `Ctrl+Shift+I`
3. Look for red error messages
4. Enable logging in plugin settings

### Sync button does nothing

**Expected for Day 1**: Sync functionality is a placeholder

**Coming in Day 2**: Actual file synchronization

---

## Updating the Plugin

### If using symlink (Method A):

```bash
# Navigate to plugin source
cd /Users/lavishmantri/Projects/scion/obsidian-vault-sync-plugin

# Pull latest changes (if using git)
git pull

# Rebuild
npm run build

# Reload in Obsidian (Settings → Community Plugins → Reload plugins)
```

### If using copy (Method B):

```bash
# Navigate to plugin source
cd /Users/lavishmantri/Projects/scion/obsidian-vault-sync-plugin

# Pull latest changes (if using git)
git pull

# Rebuild
npm run build

# Copy to vault
rm -rf ~/Documents/ObsidianVault/.obsidian/plugins/vault-sync
cp -r . ~/Documents/ObsidianVault/.obsidian/plugins/vault-sync

# Reload in Obsidian
```

---

## Uninstallation

### Remove Plugin

1. In Obsidian: Settings → Community Plugins
2. Find "Vault Sync"
3. Toggle **OFF**
4. Click trash icon to delete

### OR manually:

```bash
rm -rf ~/Documents/ObsidianVault/.obsidian/plugins/vault-sync
```

### Remove Settings

Plugin settings are stored in:
```
~/Documents/ObsidianVault/.obsidian/plugins/vault-sync/data.json
```

Deleted automatically when plugin is removed.

---

## Development Workflow

If you're developing the plugin:

### 1. Start Development Mode

```bash
cd /Users/lavishmantri/Projects/scion/obsidian-vault-sync-plugin
npm run dev
```

This watches for file changes and rebuilds automatically.

### 2. Make Changes

Edit source files in `src/`

### 3. Test in Obsidian

After each change:
1. Save file
2. Wait for rebuild (watch console)
3. In Obsidian: Settings → Community Plugins → Reload plugins
4. Test changes

### 4. Check Console

Mac: `Cmd+Option+I`
Windows/Linux: `Ctrl+Shift+I`

Enable logging in plugin settings to see detailed logs.

---

## Next Steps

Once installed and configured:

1. **Day 1**: Test GitHub connection, explore settings
2. **Day 2**: Actual file sync implementation
3. **Day 3**: Auto-sync and conflict resolution
4. **Day 4**: Testing and polish

---

## Support

- **GitHub Issues**: [Report problems](https://github.com/lavishmantri/obsidian-vault-sync/issues)
- **Documentation**: See `README.md` for full documentation
- **Implementation Plan**: See `PLAN.md` for development roadmap
