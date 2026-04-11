/**
 * Push operations — simple file operations with no merge logic.
 * All operations stage files via git add. The caller commits once at the end.
 */

import { execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import fse from 'fs-extra';
import { getVaultPath, computeHash, validateFilePath } from './db.js';
import { ensureFileId, getFileByPath, getFileById, softDeleteFile } from './metadata.js';
import { vaultLogger } from './logger.js';

export type PushOperationType = 'create' | 'modify' | 'rename' | 'delete';

export interface PushOperation {
  type: PushOperationType;
  path: string;
  content?: string; // base64
  file_id?: string;
  old_path?: string;
}

export interface PushOperationResult {
  index: number;
  success: boolean;
  file_id?: string;
  hash?: string;
  error?: string;
}

function writeFileWithSync(filePath: string, content: Buffer): void {
  fs.writeFileSync(filePath, content);
  const fd = fs.openSync(filePath, 'r');
  fs.fsyncSync(fd);
  fs.closeSync(fd);
}

function gitAdd(vaultPath: string, filePath: string): void {
  execFileSync('git', ['add', filePath], {
    cwd: vaultPath,
    encoding: 'utf-8',
    stdio: ['pipe', 'pipe', 'pipe'],
  });
}

export function processPushCreate(
  vaultName: string,
  op: PushOperation,
  index: number
): PushOperationResult {
  const log = vaultLogger(vaultName, 'push:create');

  if (!op.content) {
    log.warn({ index, path: op.path }, 'content missing');
    return { index, success: false, error: 'Content required for create' };
  }
  if (!validateFilePath(op.path)) {
    log.warn({ index, path: op.path }, 'invalid path');
    return { index, success: false, error: 'Invalid file path' };
  }

  const vaultPath = getVaultPath(vaultName);
  const fullPath = path.join(vaultPath, op.path);

  if (fse.existsSync(fullPath)) {
    log.warn({ index, path: op.path }, 'file already exists');
    return { index, success: false, error: `File already exists: ${op.path}` };
  }

  const content = Buffer.from(op.content, 'base64');
  const hash = computeHash(content);

  fse.ensureDirSync(path.dirname(fullPath));
  writeFileWithSync(fullPath, content);
  gitAdd(vaultPath, op.path);

  log.debug({ index, path: op.path, hash: hash.slice(0, 12), size: content.length }, 'file created');
  return { index, success: true, hash };
}

export function processPushModify(
  vaultName: string,
  op: PushOperation,
  index: number
): PushOperationResult {
  const log = vaultLogger(vaultName, 'push:modify');

  if (!op.content) {
    log.warn({ index, path: op.path }, 'content missing');
    return { index, success: false, error: 'Content required for modify' };
  }
  if (!validateFilePath(op.path)) {
    log.warn({ index, path: op.path }, 'invalid path');
    return { index, success: false, error: 'Invalid file path' };
  }

  const vaultPath = getVaultPath(vaultName);
  const fullPath = path.join(vaultPath, op.path);

  if (!fse.existsSync(fullPath)) {
    log.warn({ index, path: op.path }, 'file not found');
    return { index, success: false, error: `File not found: ${op.path}` };
  }

  const content = Buffer.from(op.content, 'base64');
  const hash = computeHash(content);

  writeFileWithSync(fullPath, content);
  gitAdd(vaultPath, op.path);

  log.debug({ index, path: op.path, hash: hash.slice(0, 12), size: content.length }, 'file modified');
  return { index, success: true, hash };
}

export function processPushRename(
  vaultName: string,
  op: PushOperation,
  index: number
): PushOperationResult {
  const log = vaultLogger(vaultName, 'push:rename');

  if (!op.old_path) {
    log.warn({ index, path: op.path }, 'old_path missing');
    return { index, success: false, error: 'old_path required for rename' };
  }
  if (!validateFilePath(op.path) || !validateFilePath(op.old_path)) {
    log.warn({ index, oldPath: op.old_path, newPath: op.path }, 'invalid path');
    return { index, success: false, error: 'Invalid file path' };
  }

  const vaultPath = getVaultPath(vaultName);
  const oldFullPath = path.join(vaultPath, op.old_path);
  const newFullPath = path.join(vaultPath, op.path);

  if (!fse.existsSync(oldFullPath)) {
    log.warn({ index, path: op.old_path }, 'file not found');
    return { index, success: false, error: `File not found: ${op.old_path}` };
  }

  fse.ensureDirSync(path.dirname(newFullPath));
  execFileSync('git', ['mv', op.old_path, op.path], {
    cwd: vaultPath,
    encoding: 'utf-8',
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  // Optional content update after rename
  if (op.content) {
    const content = Buffer.from(op.content, 'base64');
    writeFileWithSync(newFullPath, content);
    gitAdd(vaultPath, op.path);
  }

  const finalContent = fse.readFileSync(newFullPath);
  const hash = computeHash(finalContent);

  log.debug({ index, oldPath: op.old_path, newPath: op.path, hash: hash.slice(0, 12) }, 'file renamed');
  return { index, success: true, hash };
}

export function processPushDelete(
  vaultName: string,
  op: PushOperation,
  index: number
): PushOperationResult {
  const log = vaultLogger(vaultName, 'push:delete');

  if (!validateFilePath(op.path)) {
    log.warn({ index, path: op.path }, 'invalid path');
    return { index, success: false, error: 'Invalid file path' };
  }

  const vaultPath = getVaultPath(vaultName);
  const fullPath = path.join(vaultPath, op.path);

  if (!fse.existsSync(fullPath)) {
    log.warn({ index, path: op.path }, 'file not found');
    return { index, success: false, error: `File not found: ${op.path}` };
  }

  // Mark as deleted in metadata
  const meta = getFileByPath(vaultName, op.path);
  if (meta) {
    softDeleteFile(vaultName, meta.file_id);
  }

  fse.removeSync(fullPath);
  gitAdd(vaultPath, op.path);

  log.debug({ index, path: op.path }, 'file deleted');
  return { index, success: true, file_id: meta?.file_id };
}
