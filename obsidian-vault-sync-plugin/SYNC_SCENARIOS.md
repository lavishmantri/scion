# Sync Scenarios Guide

This document explains how the Obsidian Vault Sync plugin handles different synchronization scenarios.

## Overview

The plugin is designed to work with **any combination** of vault and repository states:
- ✅ Empty vault + Empty repository
- ✅ Empty vault + Populated repository
- ✅ Populated vault + Empty repository
- ✅ Populated vault + Populated repository

## Detailed Scenarios

### Scenario 1: Empty Vault + Empty Repository

**Initial State:**
- Local vault: No files
- GitHub repo: No files (or just README)

**What Happens:**
- Plugin detects both are empty
- Waits for you to add files to either location
- First file added triggers sync in that direction

**Use Case:**
- Brand new setup
- Starting fresh

**Expected Behavior:**
- No sync action until files are added
- Status bar shows "✓ Synced" (nothing to sync)

---

### Scenario 2: Empty Vault + Populated Repository

**Initial State:**
- Local vault: No files (or just .obsidian folder)
- GitHub repo: Contains your vault files

**What Happens:**
1. Plugin fetches list of files from GitHub
2. Downloads all files to your local vault
3. Preserves directory structure
4. Respects excluded folders setting

**Use Case:**
- Setting up Obsidian on a new device
- You have vault backed up on GitHub
- Want to "clone" your vault

**Expected Behavior:**
- First sync downloads all files from GitHub
- Subsequent syncs only fetch changes
- Status bar shows "⟳ Syncing..." then "✓ Synced"

**Example:**
```
GitHub repo has:
  - notes/daily/2024-11-24.md
  - projects/obsidian-sync.md
  - README.md

After sync, local vault has:
  - notes/daily/2024-11-24.md  ← Downloaded
  - projects/obsidian-sync.md  ← Downloaded
  - README.md                   ← Downloaded
  - .obsidian/                  ← Your local settings (not synced)
```

---

### Scenario 3: Populated Vault + Empty Repository

**Initial State:**
- Local vault: Contains your notes and files
- GitHub repo: Empty (or just README)

**What Happens:**
1. Plugin lists all files in your vault
2. Uploads each file to GitHub
3. Creates directory structure on GitHub
4. Skips excluded folders (.obsidian, .trash, etc.)

**Use Case:**
- First-time backup to GitHub
- Existing vault, new sync setup
- Migrating from other sync solution

**Expected Behavior:**
- First sync uploads all vault files
- Creates commit with all files
- Subsequent syncs only push changes
- Status bar shows "⟳ Syncing..." then "✓ Synced"

**Example:**
```
Local vault has:
  - notes/daily/2024-11-24.md
  - projects/obsidian-sync.md
  - .obsidian/workspace.json     ← Excluded
  - .trash/deleted.md            ← Excluded

After sync, GitHub has:
  - notes/daily/2024-11-24.md    ← Uploaded
  - projects/obsidian-sync.md    ← Uploaded
  (Excluded folders not uploaded)
```

---

### Scenario 4: Populated Vault + Populated Repository (Different Files)

**Initial State:**
- Local vault: Has files A, B, C
- GitHub repo: Has files X, Y, Z

**What Happens:**
1. Plugin compares local and remote file lists
2. Downloads files that only exist remotely (X, Y, Z)
3. Uploads files that only exist locally (A, B, C)
4. Result: Both locations have all files (A, B, C, X, Y, Z)

**Use Case:**
- Merging two separate vaults
- You've been working on different devices without sync
- Consolidating scattered notes

**Expected Behavior:**
- First sync merges all files from both sources
- No data loss - all files preserved
- Status bar shows "⟳ Syncing..." then "✓ Synced"

**Example:**
```
Before sync:
  Local vault:       GitHub repo:
  - note-A.md        - note-X.md
  - note-B.md        - note-Y.md
  - note-C.md        - note-Z.md

After sync:
  Local vault:       GitHub repo:
  - note-A.md        - note-A.md  ← Uploaded
  - note-B.md        - note-B.md  ← Uploaded
  - note-C.md        - note-C.md  ← Uploaded
  - note-X.md ←      - note-X.md
  - note-Y.md ←      - note-Y.md
  - note-Z.md ←      - note-Z.md
```

---

### Scenario 5: Populated Vault + Populated Repository (Same Files)

**Initial State:**
- Local vault: Has files A, B, C
- GitHub repo: Has files A, B, C (same names)

**What Happens:**
1. Plugin compares file contents (SHA hashes)
2. For identical files: No action needed
3. For different files: Applies conflict resolution strategy

**Conflict Resolution Options:**

#### Option A: Last-Write-Wins (Default)
- Compares file timestamps
- Keeps the newer version
- Overwrites the older version
- Simpler, faster, but may lose changes

#### Option B: Create Conflict File
- Keeps both versions
- Creates file with `.conflict-TIMESTAMP` suffix
- Allows manual review and merge
- Safer, but requires user intervention

**Use Case:**
- You've been editing on multiple devices
- Same file modified in both locations
- Need to reconcile changes

**Expected Behavior:**
- Plugin detects conflicts
- Applies chosen strategy
- Notifies you if conflicts found (if enabled)
- Status bar may show "⚠ Conflict" temporarily

**Example (Last-Write-Wins):**
```
Before sync:
  Local:  note-A.md (modified 11:00 AM)
  GitHub: note-A.md (modified 10:00 AM)

After sync:
  Local:  note-A.md (11:00 AM version kept)
  GitHub: note-A.md (11:00 AM version uploaded)
```

**Example (Create Conflict File):**
```
Before sync:
  Local:  note-A.md (modified 11:00 AM, content: "Hello")
  GitHub: note-A.md (modified 10:00 AM, content: "World")

After sync:
  Local:  note-A.md (your version: "Hello")
          note-A.conflict-20241124-110000.md (GitHub version: "World")

  GitHub: note-A.md (your version: "Hello")
          note-A.conflict-20241124-110000.md (uploaded)
```

---

## Special Cases

### Deleted Files

**Case 1: File deleted locally**
- Next sync: Deletes file from GitHub
- Applies deletion bidirectionally

**Case 2: File deleted on GitHub**
- Next sync: Deletes file from vault
- Moves to .trash folder first (safety)

**Case 3: File deleted in both places**
- Nothing to do
- Sync succeeds without action

### Large Files

**GitHub API Limitations:**
- Files > 100MB not recommended
- Files > 1MB may be slower
- Consider using Git LFS for large files (future enhancement)

### Binary Files

**Supported:**
- Images (PNG, JPG, etc.)
- PDFs
- Audio files
- Video files
- Any file type

**Encoding:**
- Binary files are base64 encoded by GitHub API
- Automatically handled by plugin
- No special configuration needed

### Excluded Folders

**Always Excluded (by default):**
- `.obsidian/` - Obsidian settings (device-specific)
- `.trash/` - Deleted files
- `.git/` - Git metadata (if using git separately)

**Customizable:**
- Add more excluded folders in settings
- Comma-separated list
- Useful for temporary folders, caches, etc.

---

## Troubleshooting Common Scenarios

### "Sync does nothing"

**Possible Causes:**
1. Both vault and repo are empty → Expected behavior
2. Files are identical → Nothing to sync
3. All files are in excluded folders → Check settings

**Solution:**
- Add a file to either location
- Check excluded folders setting
- Enable logging to see what plugin is checking

### "Files duplicated"

**Cause:**
- Conflict resolution created conflict files

**Solution:**
- Review conflict files
- Merge manually
- Delete conflict files after merging
- Consider using "last-write-wins" to avoid duplicates

### "Some files not syncing"

**Possible Causes:**
1. Files in excluded folders
2. Files exceed size limits
3. Special characters in filename

**Solution:**
- Check if file path matches excluded patterns
- Check file size (GitHub API limit: 100MB)
- Rename files with special characters
- Enable logging to see specific errors

---

## Best Practices

### For New Users
1. Start with empty vault + populated repo (Scenario 2)
2. Let plugin download everything
3. Then add/edit files normally

### For Existing Users
1. Back up your vault before first sync
2. Use "Create conflict file" strategy initially
3. Review conflicts carefully
4. Switch to "Last-write-wins" once comfortable

### For Multi-Device Users
1. Always sync before editing
2. Sync after editing
3. Don't edit same file on multiple devices simultaneously
4. Use auto-sync with short interval (1-2 minutes)

### For Team Vaults
1. Use conflict file strategy
2. Communicate about file edits
3. Review conflicts together
4. Consider file locking (future enhancement)

---

## Summary Table

| Scenario | Local Vault | GitHub Repo | Action | Result |
|----------|-------------|-------------|--------|--------|
| 1 | Empty | Empty | Wait | No action |
| 2 | Empty | Has files | Download all | Vault populated |
| 3 | Has files | Empty | Upload all | Repo populated |
| 4 | Different files | Different files | Merge | Both have all files |
| 5 | Same files | Same files | Check diffs | Sync changes only |

---

## Need Help?

- See [INSTALL.md](INSTALL.md) for setup instructions
- See [README.md](README.md) for general documentation
- See [TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md) for specific issues
- Enable logging in settings for detailed sync information

---

**Last Updated:** Day 1 Complete
**Coming in Day 2:** Actual implementation of all scenarios described above
