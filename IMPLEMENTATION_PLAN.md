# Implementation Plan: Rename Plugin from "Vault Sync v2" to "Scion"

## Overview

Rename the Obsidian plugin from "obsidian-vault-sync-v2"/"Vault Sync v2" to "Scion", removing all "v2" suffixes from branding while preserving functional terminology like "sync" and "vault" where they describe features.

**Current State:**
- Repository: `/Users/lavishmantri/Projects/scion/`
- Git status: `manifest.json` is modified (partially renamed but incomplete)
- 12 files require changes total

**Key Constraints:**
- Each stage must compile and pass any existing tests
- Must maintain functional code at each commit
- Generic descriptive terms (sync, vault, server) remain unchanged when describing functionality
- Installation path changes: `.obsidian/plugins/obsidian-vault-sync-v2` → `.obsidian/plugins/scion`

---

## Stage 1: Fix Configuration Files (manifest.json & package.json)
**Goal**: Complete the branding rename in configuration files to establish "scion" as the plugin identity

**Success Criteria**: 
- Plugin ID is "scion" (not "obsidian-vault-sync")
- Display name is "Scion" (not "Vault Sync v2" or "Vault Sync")
- Plugin compiles with `npm run build`
- No TypeScript errors

**Files to Modify**: 2 files
1. `/Users/lavishmantri/Projects/scion/manifest.json`
   - Change `id: "obsidian-vault-sync"` → `"scion"`
   - Change `name: "Vault Sync"` → `"Scion"`
   - Keep description (may update "sync your vault" to be more generic if desired)
   - Keep version, author, and other metadata unchanged

2. `/Users/lavishmantri/Projects/scion/package.json`
   - Change `name: "obsidian-vault-sync-v2"` → `"scion"`
   - Keep description or update to match manifest
   - Keep all dependencies and scripts unchanged

**Tests**:
- Run `npm run build` - should succeed
- Check `main.js` is generated
- No TypeScript compilation errors

**Why This Stage**:
- Establishes the new identity at the configuration level
- These files control how Obsidian identifies the plugin
- No code changes yet, so minimal risk
- Fixes the partially modified manifest.json from git status

**Status**: Not Started

---

## Stage 2: Rename Core Type Definitions (types.ts)
**Goal**: Update TypeScript interfaces and constants to remove "V2" suffix and use "Scion" branding

**Success Criteria**:
- All type names updated from `VaultSyncV2*` to `Scion*`
- Constant names updated from `DEFAULT_V2_SETTINGS` to `DEFAULT_SETTINGS`
- Project still compiles (though will have errors in other files until Stage 3)
- Type definitions are consistent and clear

**Files to Modify**: 1 file
1. `/Users/lavishmantri/Projects/scion/src/types.ts`
   - Rename interface: `VaultSyncV2Settings` → `ScionSettings`
   - Rename constant: `DEFAULT_V2_SETTINGS` → `DEFAULT_SETTINGS`
   - Update file header comment: "Type definitions for Vault Sync v2 plugin" → "Type definitions for Scion plugin"
   - Keep all property names unchanged (serverUrl, apiKey, nosyncPath, etc.)
   - Keep all other interfaces unchanged (FileInfo, SyncDiff, etc. are generic)

**Tests**:
- File should have no syntax errors
- TypeScript compilation will show errors in other files (expected - they'll be fixed in Stage 3)

**Why This Stage**:
- Types are imported by all other source files
- Doing this in isolation makes Stage 3 cleaner
- We can verify the type definitions are correct before propagating changes

**Status**: Not Started

---

## Stage 3: Update Main Plugin and Settings Files
**Goal**: Rename plugin class, update imports, and fix all branding references in core plugin files

**Success Criteria**:
- All TypeScript compilation errors resolved
- Plugin compiles successfully with `npm run build`
- Class names use "Scion" prefix instead of "VaultSyncV2"
- No runtime errors when loading plugin in Obsidian
- Log messages use "[Scion]" prefix
- UI displays "Scion" branding

**Files to Modify**: 2 files
1. `/Users/lavishmantri/Projects/scion/src/main.ts`
   - Update file header: "Vault Sync v2 - Obsidian Plugin" → "Scion - Obsidian Plugin"
   - Update imports: `VaultSyncV2Settings` → `ScionSettings`, `DEFAULT_V2_SETTINGS` → `DEFAULT_SETTINGS`, `VaultSyncV2SettingTab` → `ScionSettingTab`
   - Rename class: `VaultSyncV2Plugin` → `ScionPlugin`
   - Update property type: `settings: VaultSyncV2Settings` → `settings: ScionSettings`
   - Update log messages: `'Vault Sync v2 plugin loaded'` → `'Scion plugin loaded'`, `'Vault Sync v2 plugin unloaded'` → `'Scion plugin unloaded'`
   - Update status bar text: `'Vault Sync: ${statusText[...]}'` → `'Scion: ${statusText[...]}'`
   - Update log prefix: `console.log(\`[Vault Sync v2] ${message}\`)` → `console.log(\`[Scion] ${message}\`)`
   - Keep all command descriptions unchanged (they describe functionality: "Push to server", "Pull from server", etc.)

2. `/Users/lavishmantri/Projects/scion/src/settings.ts`
   - Update file header: "Settings UI for Vault Sync v2 plugin" → "Settings UI for Scion plugin"
   - Update imports: `VaultSyncV2Settings` → `ScionSettings`, `VaultSyncV2Plugin` → `ScionPlugin`
   - Rename class: `VaultSyncV2SettingTab` → `ScionSettingTab`
   - Update property type: `plugin: VaultSyncV2Plugin` → `plugin: ScionPlugin`
   - Update constructor parameter: `plugin: VaultSyncV2Plugin` → `plugin: ScionPlugin`
   - Update heading: `'Vault Sync v2 Settings'` → `'Scion Settings'`
   - Update server URL description: Remove "Vault Sync server" reference, use generic "your sync server"
   - Keep CSS class name `'vault-sync-links'` (or update to `'scion-links'` for consistency)

**Tests**:
- Run `npm run build` - should succeed with no errors
- Run `npm run dev` to verify watch mode works
- Load in Obsidian test vault:
  - Plugin appears as "Scion" in Community Plugins
  - Settings page shows "Scion Settings"
  - Status bar shows "Scion: ✓ Ready"
  - Push/pull commands work
  - Console logs show "[Scion]" prefix when logging is enabled

**Why This Stage**:
- These are the core files that directly reference the renamed types
- Fixing them together resolves all compilation errors
- Plugin becomes fully functional with new branding
- This is the critical stage where everything must work

**Status**: Not Started

---

## Stage 4: Update Utility Files (Comments and Headers)
**Goal**: Update file headers and documentation comments in utility files for consistency

**Success Criteria**:
- All file headers reflect "Scion" branding
- Comments are consistent and accurate
- No functional changes to code
- Project still compiles and works identically

**Files to Modify**: 5 files (only comments/headers, no code logic)
1. `/Users/lavishmantri/Projects/scion/src/utils.ts`
   - Update header: "Utility functions for Vault Sync v2 plugin" → "Utility functions for Scion plugin"
   - No other changes needed (functions are generic utilities)

2. `/Users/lavishmantri/Projects/scion/src/server-api.ts`
   - Update header: "REST API client for Vault Sync Server" → "REST API client for Sync Server"
   - No other changes needed (class name `ServerAPI` is appropriately generic)

3. `/Users/lavishmantri/Projects/scion/src/sync-engine.ts`
   - Header already generic: "Sync engine for push/pull operations" (no change needed)
   - Verify no "Vault Sync v2" references in comments

4. `/Users/lavishmantri/Projects/scion/src/vault-utils.ts`
   - Header already generic: "Vault file operations" (no change needed)
   - Verify no "Vault Sync v2" references in comments

5. `/Users/lavishmantri/Projects/scion/src/ignore-patterns.ts`
   - Header already generic: ".nosync pattern support (gitignore-style)" (no change needed)
   - Verify no "Vault Sync v2" references in comments

**Tests**:
- Run `npm run build` - should succeed
- Quick visual verification in Obsidian (should work identically to Stage 3)

**Why This Stage**:
- Cleanup stage for consistency
- Low risk since only comments change
- Makes codebase properly branded throughout

**Status**: Not Started

---

## Stage 5: Update Documentation Files
**Goal**: Rebrand all user-facing documentation from "Vault Sync v2" to "Scion"

**Success Criteria**:
- README and INSTALL docs use "Scion" consistently
- Installation paths updated to use "scion" plugin directory
- Server references remain generic ("sync server" not "Vault Sync Server")
- Examples and commands updated
- Documentation is clear and consistent

**Files to Modify**: 2 files
1. `/Users/lavishmantri/Projects/scion/README.md`
   - Update title: "# Vault Sync v2" → "# Scion"
   - Update tagline: Keep functionality description but use "Scion" for branding
   - Update all references: "Vault Sync v2" → "Scion", "Vault Sync" → "Scion"
   - Update installation paths: `.obsidian/plugins/obsidian-vault-sync-v2` → `.obsidian/plugins/scion`
   - Update symlink examples: `obsidian-vault-sync-v2` → `scion`
   - Update settings section: "Settings → Vault Sync v2" → "Settings → Scion"
   - Update enabled plugin name: "Enable 'Vault Sync v2'" → "Enable 'Scion'"
   - Keep server references generic: "Vault Sync server" → "sync server" or "your server"
   - Keep folder structure section accurate (still shows "v2/" if that's the actual structure, or update if renamed)
   - Update changelog version notes appropriately

2. `/Users/lavishmantri/Projects/scion/INSTALL.md`
   - Update title: "# Vault Sync v2 - Installation Guide" → "# Scion - Installation Guide"
   - Update all plugin name references: "Vault Sync v2" → "Scion"
   - Update installation paths: `.obsidian/plugins/obsidian-vault-sync-v2` → `.obsidian/plugins/scion`
   - Update symlink examples: `ln -s ~/Projects/scion/v2 ~/.obsidian/plugins/obsidian-vault-sync-v2` → `ln -s ~/Projects/scion ~/.obsidian/plugins/scion` (assuming folder structure)
   - Update settings navigation: "Settings → Vault Sync v2" → "Settings → Scion"
   - Update enable instruction: "'Vault Sync v2'" → "'Scion'"
   - Keep server references generic: "Vault Sync Server" → "sync server"
   - Verify folder paths in examples match actual project structure

**Tests**:
- Read through both docs for consistency
- Verify all paths and examples are accurate
- Check links and references are updated
- Test a sample installation command to ensure it's correct

**Why This Stage**:
- User-facing documentation is last since code must work first
- Documentation doesn't affect compilation
- Can be reviewed and refined after technical changes are proven working
- Completes the full rebranding process

**Status**: Not Started

---

## Testing Checklist (All Stages Complete)

After completing all stages, perform comprehensive testing:

### Build Tests
- [ ] `npm run build` succeeds with no errors
- [ ] `npm run build:prod` succeeds with no errors  
- [ ] `npm run dev` watch mode works
- [ ] No TypeScript compilation errors
- [ ] No linter warnings

### Functional Tests (in Obsidian test vault)
- [ ] Plugin appears as "Scion" in Community Plugins list
- [ ] Plugin can be enabled/disabled
- [ ] Settings page opens and shows "Scion Settings"
- [ ] Server URL and API key can be configured
- [ ] Test Connection works
- [ ] Push operation works
- [ ] Pull operation works
- [ ] Show sync diff command works
- [ ] Ribbon icons display and function
- [ ] Status bar shows "Scion: ✓ Ready"
- [ ] Console logs show "[Scion]" prefix when logging enabled
- [ ] Conflict detection works
- [ ] .nosync patterns are respected

### Documentation Tests
- [ ] README is clear and accurate
- [ ] INSTALL guide is clear and accurate
- [ ] Installation paths work correctly
- [ ] No broken references or old names
- [ ] Examples are correct and testable

### Git Status
- [ ] All changes committed in logical stages
- [ ] Each commit compiles and works
- [ ] Commit messages are clear and descriptive
- [ ] No unintended files modified

---

## Rollback Plan

If issues are discovered:

1. **During Stage 1-2**: Use `git reset --hard` to revert changes, these are configuration-only
2. **During Stage 3**: This is critical stage - if it fails, fix immediately or revert the commit
3. **During Stage 4-5**: Safe to revert individual commits as they're non-functional changes

Each stage can be reverted independently since they're separate commits.

---

## Notes

- **Generic vs. Branded Terms**: 
  - "Scion" = the product/plugin name (branding)
  - "sync", "vault", "server" = functional descriptions (keep these)
  - Example: "Scion syncs your vault" is correct

- **Installation Path**: Users will need to rename their plugin folder from `obsidian-vault-sync-v2` to `scion` when upgrading

- **CSS Classes**: The class `vault-sync-links` in settings.ts can be renamed to `scion-links` for consistency (included in Stage 3)

- **Backward Compatibility**: This is a breaking change for existing users - they'll need to:
  1. Disable old plugin
  2. Remove old plugin folder
  3. Install new "scion" plugin
  4. Reconfigure settings (API keys, etc.)

- **File Structure Note**: If the project has a "v2" folder, that should be renamed to match the new structure or removed from documentation references.
