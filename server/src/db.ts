import { execFileSync } from 'child_process';
import path from 'path';
import fse from 'fs-extra';
import { createHash } from 'crypto';
import { config } from './config.js';
import {
  getDatabase,
  ensureFileId,
  getFileByPath,
  getFileById,
  updateFileRecord,
  recordPathChange,
  softDeleteFile,
  getAllPreviousPaths,
  detectRenameByHash,
  updateGitManifest,
  isVaultBootstrapped,
} from './metadata.js';

// Support absolute paths or resolve relative paths from cwd
export const VAULT_ROOT = path.isAbsolute(config.vaultPath)
  ? config.vaultPath
  : path.resolve(process.cwd(), config.vaultPath);

export interface FileRecord {
  file_id: string;  // UUID - persistent identity that survives renames
  path: string;
  hash: string;
  commit: string;
  updated_at: number;
}

export interface FileChange {
  path: string;
  status: 'added' | 'modified' | 'deleted' | 'renamed';
  old_path?: string;
}

// Vault name validation regex: alphanumeric, dashes, underscores, spaces
const VALID_VAULT_NAME = /^[a-zA-Z0-9_\- ]+$/;

/**
 * Validate vault name to prevent path traversal attacks
 */
export function validateVaultName(vaultName: string): boolean {
  if (!vaultName || vaultName.length === 0 || vaultName.length > 100) {
    return false;
  }
  if (!VALID_VAULT_NAME.test(vaultName)) {
    return false;
  }
  if (vaultName.includes('..') || vaultName.includes('/') || vaultName.includes('\\')) {
    return false;
  }
  return true;
}

/**
 * Validate a file path to prevent path traversal and access to internal files
 */
export function validateFilePath(filePath: string): boolean {
  if (!filePath || filePath.length === 0 || filePath.length > 500) {
    return false;
  }
  // Reject null bytes
  if (filePath.includes('\0')) {
    return false;
  }
  // Reject absolute paths
  if (filePath.startsWith('/') || filePath.startsWith('\\')) {
    return false;
  }
  // Reject backslashes
  if (filePath.includes('\\')) {
    return false;
  }
  // Reject .. segments (path traversal)
  const segments = filePath.split('/');
  for (const seg of segments) {
    if (seg === '..') {
      return false;
    }
  }
  // Reject .git/ and .scion/ prefixes
  if (filePath === '.git' || filePath.startsWith('.git/')) {
    return false;
  }
  if (filePath === '.scion' || filePath.startsWith('.scion/')) {
    return false;
  }
  return true;
}

/**
 * Get the file storage path for a vault (this is the git repo root)
 */
export function getVaultPath(vaultName: string): string {
  return path.join(VAULT_ROOT, vaultName);
}

/**
 * Execute a git command in the vault directory (shell-injection safe)
 */
function git(vaultName: string, args: string[]): string {
  const vaultPath = getVaultPath(vaultName);
  try {
    const result = execFileSync('git', args, {
      cwd: vaultPath,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return result.trim();
  } catch (error: unknown) {
    const execError = error as { stderr?: string; message?: string };
    const stderr = execError.stderr || execError.message || 'Unknown git error';
    throw new Error(`Git command failed: git ${args.join(' ')}\n${stderr}`);
  }
}

/**
 * Initialize git repo for a vault if not already initialized
 */
export function initVaultGit(vaultName: string): void {
  if (!validateVaultName(vaultName)) {
    throw new Error(`Invalid vault name: ${vaultName}`);
  }

  const vaultPath = getVaultPath(vaultName);
  fse.ensureDirSync(vaultPath);

  const gitDir = path.join(vaultPath, '.git');
  if (fse.existsSync(gitDir)) {
    console.log(`Git: Vault "${vaultName}" already initialized`);
    return;
  }

  // Initialize git repo
  execFileSync('git', ['init'], { cwd: vaultPath, stdio: 'pipe' });

  // Configure git user for this repo
  execFileSync('git', ['config', 'user.email', 'scion-sync@local'], { cwd: vaultPath, stdio: 'pipe' });
  execFileSync('git', ['config', 'user.name', 'Scion Sync'], { cwd: vaultPath, stdio: 'pipe' });

  // Create .gitignore
  // Note: .scion/manifest.json is tracked for disaster recovery
  // SQLite database and WAL files are ignored
  const gitignore = `.DS_Store
Thumbs.db
.scion/metadata.db
.scion/metadata.db-wal
.scion/metadata.db-shm
`;
  fse.writeFileSync(path.join(vaultPath, '.gitignore'), gitignore);

  // Initial commit
  execFileSync('git', ['add', '.gitignore'], { cwd: vaultPath, stdio: 'pipe' });
  execFileSync('git', ['commit', '-m', 'Initialize vault'], { cwd: vaultPath, stdio: 'pipe' });

  console.log(`Git: Initialized vault "${vaultName}" at ${vaultPath}`);
}

/**
 * Get the current HEAD commit hash
 */
export function getHeadCommit(vaultName: string): string | null {
  try {
    return git(vaultName, ['rev-parse', 'HEAD']);
  } catch {
    return null;
  }
}

/**
 * Commit a file to the vault
 * Returns the new commit hash
 */
export function commitFile(
  vaultName: string,
  filePath: string,
  content: Buffer,
  message: string
): string {
  initVaultGit(vaultName); // Ensure git is initialized

  const vaultPath = getVaultPath(vaultName);
  const fullPath = path.join(vaultPath, filePath);

  // Ensure parent directory exists
  fse.ensureDirSync(path.dirname(fullPath));

  // Write file
  fse.writeFileSync(fullPath, content);

  // Stage and commit
  git(vaultName, ['add', filePath]);

  try {
    git(vaultName, ['commit', '-m', message]);
  } catch (error: unknown) {
    // Check if it's "nothing to commit" error
    const execError = error as { message?: string };
    if (execError.message?.includes('nothing to commit')) {
      // File unchanged, return current HEAD
      return getHeadCommit(vaultName) || '';
    }
    throw error;
  }

  return getHeadCommit(vaultName) || '';
}

/**
 * Get file content at a specific commit
 */
export function getFileAtCommit(
  vaultName: string,
  filePath: string,
  commitHash: string
): Buffer | null {
  try {
    const content = execFileSync('git', ['show', `${commitHash}:${filePath}`], {
      cwd: getVaultPath(vaultName),
      encoding: 'buffer',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return content;
  } catch {
    return null;
  }
}

/**
 * Get current file content from working directory
 */
export function getCurrentFile(vaultName: string, filePath: string): Buffer | null {
  const fullPath = path.join(getVaultPath(vaultName), filePath);
  if (!fse.existsSync(fullPath)) {
    return null;
  }
  return fse.readFileSync(fullPath);
}

/**
 * Check if a file exists in the vault
 */
export function fileExists(vaultName: string, filePath: string): boolean {
  const fullPath = path.join(getVaultPath(vaultName), filePath);
  return fse.existsSync(fullPath);
}

/**
 * Delete a file from the vault
 */
export function deleteFile(vaultName: string, filePath: string): boolean {
  const vaultPath = getVaultPath(vaultName);
  const fullPath = path.join(vaultPath, filePath);

  if (!fse.existsSync(fullPath)) {
    return false;
  }

  fse.removeSync(fullPath);

  try {
    git(vaultName, ['add', filePath]);
    git(vaultName, ['commit', '-m', `Delete ${filePath}`]);
  } catch {
    // File might not be tracked
  }

  return true;
}

/**
 * Bootstrap vault metadata - generates UUIDs for all existing files
 * Called automatically during getManifest if metadata doesn't exist
 */
export function bootstrapVaultMetadata(vaultName: string): void {
  console.log(`Bootstrapping metadata for vault "${vaultName}"...`);

  const vaultPath = getVaultPath(vaultName);

  // Get list of tracked files
  let files: string[];
  try {
    const output = git(vaultName, ['ls-files']);
    files = output.split('\n').filter((f) => f && f !== '.gitignore' && !f.startsWith('.scion/'));
  } catch {
    files = [];
  }

  // Initialize the database (creates tables)
  getDatabase(vaultName);

  for (const filePath of files) {
    const fullPath = path.join(vaultPath, filePath);
    if (!fse.existsSync(fullPath)) continue;

    const content = fse.readFileSync(fullPath);
    const hash = computeHash(content);

    let commit: string | null = null;
    try {
      commit = git(vaultName, ['log', '-1', '--format=%H', '--', filePath]);
    } catch {
      // File might not be committed yet
    }

    // This will create a new UUID if one doesn't exist
    ensureFileId(vaultName, filePath, hash, commit);
  }

  // Persist UUID mapping to Git for disaster recovery
  updateGitManifest(vaultName);

  // Commit the manifest file
  try {
    git(vaultName, ['add', '.scion/manifest.json']);
    git(vaultName, ['commit', '-m', 'Initialize Scion metadata']);
  } catch {
    // Might already be committed or nothing to commit
  }

  console.log(`Bootstrapped ${files.length} files for vault "${vaultName}"`);
}

/**
 * Get manifest of all files in the vault
 */
export function getManifest(vaultName: string): FileRecord[] {
  initVaultGit(vaultName);

  const vaultPath = getVaultPath(vaultName);
  const headCommit = getHeadCommit(vaultName);

  if (!headCommit) {
    return [];
  }

  // Get list of tracked files
  let files: string[];
  try {
    const output = git(vaultName, ['ls-files']);
    files = output.split('\n').filter((f) => f && f !== '.gitignore' && !f.startsWith('.scion/'));
  } catch {
    return [];
  }

  // Check if we need to bootstrap metadata (only once per vault)
  if (files.length > 0 && !isVaultBootstrapped(vaultName)) {
    bootstrapVaultMetadata(vaultName);
  }

  const records: FileRecord[] = [];

  for (const filePath of files) {
    const fullPath = path.join(vaultPath, filePath);
    if (!fse.existsSync(fullPath)) continue;

    // Get file hash
    const content = fse.readFileSync(fullPath);
    const hash = computeHash(content);

    // Get last commit time for this file
    let updatedAt: number;
    try {
      const timestamp = git(vaultName, ['log', '-1', '--format=%ct', '--', filePath]);
      updatedAt = parseInt(timestamp, 10);
    } catch {
      updatedAt = Math.floor(Date.now() / 1000);
    }

    // Get last commit hash for this file
    let commit: string;
    try {
      commit = git(vaultName, ['log', '-1', '--format=%H', '--', filePath]);
    } catch {
      commit = headCommit;
    }

    // Get or create file_id from metadata store
    const fileId = ensureFileId(vaultName, filePath, hash, commit);

    records.push({
      file_id: fileId,
      path: filePath,
      hash,
      commit,
      updated_at: updatedAt,
    });
  }

  return records;
}

/**
 * Get files changed since a specific commit (structured)
 */
export function getChangesSince(
  vaultName: string,
  sinceCommit: string | null
): { headCommit: string; changes: FileChange[] } {
  initVaultGit(vaultName);

  const headCommit = getHeadCommit(vaultName);
  if (!headCommit) {
    return { headCommit: '', changes: [] };
  }

  if (!sinceCommit || sinceCommit === headCommit) {
    return { headCommit, changes: [] };
  }

  try {
    const output = git(vaultName, ['diff', '--name-status', sinceCommit, headCommit]);
    const changes: FileChange[] = [];
    for (const line of output.split('\n')) {
      if (!line) continue;
      const parts = line.split('\t');
      const statusCode = parts[0];
      const filePath = parts[1];
      if (!filePath || filePath === '.gitignore' || filePath.startsWith('.scion/')) continue;

      if (statusCode === 'A') {
        changes.push({ path: filePath, status: 'added' });
      } else if (statusCode === 'M') {
        changes.push({ path: filePath, status: 'modified' });
      } else if (statusCode === 'D') {
        changes.push({ path: filePath, status: 'deleted' });
      } else if (statusCode.startsWith('R')) {
        const newPath = parts[2];
        if (newPath && !newPath.startsWith('.scion/')) {
          changes.push({ path: newPath, status: 'renamed', old_path: filePath });
        }
      }
    }
    return { headCommit, changes };
  } catch {
    // If sinceCommit doesn't exist, return all files as added
    const manifest = getManifest(vaultName);
    return {
      headCommit,
      changes: manifest.map((f) => ({ path: f.path, status: 'added' as const })),
    };
  }
}

/**
 * Get file record for a specific file
 */
export function getFileRecord(vaultName: string, filePath: string): FileRecord | undefined {
  const vaultPath = getVaultPath(vaultName);
  const fullPath = path.join(vaultPath, filePath);

  if (!fse.existsSync(fullPath)) {
    return undefined;
  }

  const content = fse.readFileSync(fullPath);
  const hash = computeHash(content);

  let commit: string;
  try {
    commit = git(vaultName, ['log', '-1', '--format=%H', '--', filePath]);
  } catch {
    commit = getHeadCommit(vaultName) || '';
  }

  let updatedAt: number;
  try {
    const timestamp = git(vaultName, ['log', '-1', '--format=%ct', '--', filePath]);
    updatedAt = parseInt(timestamp, 10);
  } catch {
    updatedAt = Math.floor(Date.now() / 1000);
  }

  // Get or create file_id from metadata store
  const fileId = ensureFileId(vaultName, filePath, hash, commit);

  return {
    file_id: fileId,
    path: filePath,
    hash,
    commit,
    updated_at: updatedAt,
  };
}

/**
 * Compute SHA-256 hash of content
 */
export function computeHash(content: Buffer): string {
  return createHash('sha256').update(content).digest('hex');
}

/**
 * Detect if a missing file was renamed
 * Returns the new location if found
 */
export function detectRename(
  vaultName: string,
  missingPath: string,
  contentHash: string,
  fileId?: string
): { found: boolean; newPath?: string; fileId?: string; method?: string } {
  // Strategy 1: If file_id provided, check metadata for current path
  if (fileId) {
    const metadata = getFileById(vaultName, fileId);
    if (metadata && metadata.current_path !== missingPath && !metadata.deleted_at) {
      return {
        found: true,
        newPath: metadata.current_path,
        fileId: metadata.file_id,
        method: 'file_id',
      };
    }
  }

  // Strategy 2: Check hash index for exact content match
  const matchedFile = detectRenameByHash(vaultName, missingPath, contentHash);
  if (matchedFile) {
    return {
      found: true,
      newPath: matchedFile.current_path,
      fileId: matchedFile.file_id,
      method: 'hash_match',
    };
  }

  // Strategy 3: Check path history (file might have been renamed multiple times)
  const vaultPath = getVaultPath(vaultName);

  // First get all files and check their path history
  const allFiles = getManifest(vaultName);
  for (const file of allFiles) {
    const previousPaths = getAllPreviousPaths(vaultName, file.file_id);
    if (previousPaths.includes(missingPath)) {
      return {
        found: true,
        newPath: file.path,
        fileId: file.file_id,
        method: 'path_history',
      };
    }
  }

  return { found: false };
}

/**
 * Rename a file atomically using git mv
 * Returns the new commit hash and updated file record
 */
export function renameFile(
  vaultName: string,
  fileId: string,
  oldPath: string,
  newPath: string,
  newContent?: Buffer
): { success: boolean; commit: string; error?: string } {
  initVaultGit(vaultName);

  const vaultPath = getVaultPath(vaultName);
  const oldFullPath = path.join(vaultPath, oldPath);
  const newFullPath = path.join(vaultPath, newPath);

  // Verify the file exists at old path
  if (!fse.existsSync(oldFullPath)) {
    return { success: false, commit: '', error: 'File not found at old path' };
  }

  // Verify file_id matches
  const metadata = getFileById(vaultName, fileId);
  if (!metadata) {
    return { success: false, commit: '', error: 'File ID not found in metadata' };
  }

  if (metadata.current_path !== oldPath) {
    return { success: false, commit: '', error: 'File ID does not match old path' };
  }

  try {
    // Ensure parent directory of new path exists
    fse.ensureDirSync(path.dirname(newFullPath));

    // Use git mv for proper rename tracking
    git(vaultName, ['mv', oldPath, newPath]);

    // If new content provided, write it
    if (newContent) {
      fse.writeFileSync(newFullPath, newContent);
      git(vaultName, ['add', newPath]);
    }

    // Commit the rename
    git(vaultName, ['commit', '-m', `Rename ${oldPath} to ${newPath}`]);

    const commit = getHeadCommit(vaultName) || '';
    const hash = newContent
      ? computeHash(newContent)
      : computeHash(fse.readFileSync(newFullPath));

    // Update metadata
    recordPathChange(vaultName, fileId, oldPath, newPath);
    updateFileRecord(vaultName, fileId, {
      current_path: newPath,
      content_hash: hash,
      git_commit: commit,
    });

    // Update Git manifest for disaster recovery
    updateGitManifest(vaultName);

    // Commit the updated manifest
    try {
      git(vaultName, ['add', '.scion/manifest.json']);
      git(vaultName, ['commit', '--amend', '--no-edit']);
    } catch {
      // Might fail if manifest unchanged
    }

    return { success: true, commit };
  } catch (error: unknown) {
    const execError = error as { message?: string };
    return { success: false, commit: '', error: execError.message || 'Unknown error' };
  }
}

/**
 * Get file at a commit, searching through path history if needed
 * Useful for three-way merge when file has been renamed
 */
export function getFileAtCommitWithHistory(
  vaultName: string,
  fileId: string,
  commitHash: string,
  currentPath: string
): Buffer | null {
  // First try the current path
  const content = getFileAtCommit(vaultName, currentPath, commitHash);
  if (content) {
    return content;
  }

  // Try all previous paths
  const previousPaths = getAllPreviousPaths(vaultName, fileId);
  for (const prevPath of previousPaths) {
    const prevContent = getFileAtCommit(vaultName, prevPath, commitHash);
    if (prevContent) {
      return prevContent;
    }
  }

  return null;
}
