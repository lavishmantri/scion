import { execFileSync } from 'child_process';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import fse from 'fs-extra';
import { config } from './config.js';
import {
  VAULT_ROOT,
  getManifest,
  getFileRecord,
  commitFile,
  deleteFile,
  computeHash,
  validateVaultName,
  getVaultPath,
  initVaultGit,
  getHeadCommit,
  getCurrentFile,
  getChangesSince,
  detectRename,
  renameFile,
  validateFilePath,
  gitGcAuto,
} from './db.js';
import {
  getFileByPath,
  getFileById,
  ensureFileId,
  softDeleteFile,
} from './metadata.js';
import { vaultLock } from './vault-lock.js';
import {
  processPushCreate,
  processPushModify,
  processPushRename,
  processPushDelete,
  type PushOperation,
  type PushOperationResult,
} from './push-operations.js';

export const server = Fastify({
  logger: {
    level: config.logLevel,
  },
  bodyLimit: 50 * 1024 * 1024, // 50MB
});

// Register CORS plugin (allow all origins for self-hosted use)
await server.register(cors, {
  origin: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
});

// Ensure vault root directory exists
await fse.ensureDir(VAULT_ROOT);

// Type definitions for route params
interface VaultParams {
  vaultName: string;
}

interface VaultFileParams extends VaultParams {
  '*': string;
}

// Health check (global)
server.get('/health', async () => {
  return { status: 'ok' };
});

// GET /vault/:vaultName/manifest - Return all files with their metadata
server.get<{ Params: VaultParams }>('/vault/:vaultName/manifest', async (request, reply) => {
  const { vaultName } = request.params;

  if (!validateVaultName(vaultName)) {
    return reply.status(400).send({ error: 'Invalid vault name' });
  }

  console.log(`Server: GET /vault/${vaultName}/manifest`);
  initVaultGit(vaultName);
  const files = getManifest(vaultName);
  const headCommit = getHeadCommit(vaultName);

  // Debug logging for sync troubleshooting
  console.log(`[SYNC DEBUG] vault="${vaultName}" endpoint="/manifest"
  server_head="${headCommit}" file_count=${files.length}`);

  return { files, head_commit: headCommit };
});

// GET /vault/:vaultName/debug - Debug endpoint to check vault state
server.get<{ Params: VaultParams }>('/vault/:vaultName/debug', async (request, reply) => {
  const { vaultName } = request.params;

  if (!validateVaultName(vaultName)) {
    return reply.status(400).send({ error: 'Invalid vault name' });
  }

  initVaultGit(vaultName);
  const files = getManifest(vaultName);
  const headCommit = getHeadCommit(vaultName);

  // Get the latest file update time
  let lastModified: number | null = null;
  for (const file of files) {
    if (!lastModified || file.updated_at > lastModified) {
      lastModified = file.updated_at;
    }
  }

  return {
    vault_name: vaultName,
    head_commit: headCommit,
    file_count: files.length,
    last_modified: lastModified ? new Date(lastModified * 1000).toISOString() : null,
  };
});

// GET /vault/:vaultName/status - Get changes since a commit (for polling)
interface StatusQuery {
  since?: string;
}

server.get<{ Params: VaultParams; Querystring: StatusQuery }>(
  '/vault/:vaultName/status',
  async (request, reply) => {
    const { vaultName } = request.params;
    const { since } = request.query;

    if (!validateVaultName(vaultName)) {
      return reply.status(400).send({ error: 'Invalid vault name' });
    }

    console.log(`Server: GET /vault/${vaultName}/status?since=${since || 'null'}`);
    initVaultGit(vaultName);

    const { headCommit, changes } = getChangesSince(vaultName, since || null);

    // Debug logging for sync troubleshooting
    console.log(`[SYNC DEBUG] vault="${vaultName}" endpoint="/status"
  client_since="${since || 'null'}" server_head="${headCommit}"
  commits_match=${since === headCommit} changes=${changes.length}`);

    return {
      head_commit: headCommit,
      changes,
      has_changes: changes.length > 0,
    };
  }
);

// GET /vault/:vaultName/file/* - Download file content
server.get<{ Params: VaultFileParams }>('/vault/:vaultName/file/*', async (request, reply) => {
  const { vaultName } = request.params;
  const filePath = request.params['*'];

  if (!validateVaultName(vaultName)) {
    return reply.status(400).send({ error: 'Invalid vault name' });
  }

  if (!validateFilePath(filePath)) {
    return reply.status(400).send({ error: 'Invalid file path' });
  }

  console.log(`Server: GET /vault/${vaultName}/file/${filePath}`);
  const record = getFileRecord(vaultName, filePath);

  if (!record) {
    console.log(`[SYNC DEBUG] vault="${vaultName}" endpoint="/file" path="${filePath}" status="not_found"`);
    return reply.status(404).send({ error: 'File not found' });
  }

  const content = getCurrentFile(vaultName, filePath);

  if (!content) {
    console.log(`[SYNC DEBUG] vault="${vaultName}" endpoint="/file" path="${filePath}" status="not_on_disk"`);
    return reply.status(404).send({ error: 'File not found on disk' });
  }

  // Debug logging for sync troubleshooting
  console.log(`[SYNC DEBUG] vault="${vaultName}" endpoint="/file" path="${filePath}"
  commit="${record.commit}" hash="${record.hash}" size=${content.length}`);

  return reply
    .header('Content-Type', 'application/octet-stream')
    .header('X-File-Commit', record.commit)
    .header('X-File-Hash', record.hash)
    .send(content);
});

// DELETE /vault/:vaultName/file/* - Delete a file
server.delete<{ Params: VaultFileParams }>(
  '/vault/:vaultName/file/*',
  async (request, reply) => {
    const { vaultName } = request.params;
    const filePath = request.params['*'];

    if (!validateVaultName(vaultName)) {
      return reply.status(400).send({ error: 'Invalid vault name' });
    }

    if (!validateFilePath(filePath)) {
      return reply.status(400).send({ error: 'Invalid file path' });
    }

    console.log(`Server: DELETE /vault/${vaultName}/file/${filePath}`);

    // Get file_id before deletion for metadata tracking
    const metadata = getFileByPath(vaultName, filePath);
    if (metadata) {
      softDeleteFile(vaultName, metadata.file_id);
    }

    const deleted = deleteFile(vaultName, filePath);

    if (!deleted) {
      return reply.status(404).send({ error: 'File not found' });
    }

    return { success: true, commit: getHeadCommit(vaultName) };
  }
);

// POST /vault/:vaultName/detect-rename - Detect if a file was renamed
interface DetectRenameBody {
  missing_path: string;
  missing_hash: string;
  file_id?: string;
}

server.post<{ Params: VaultParams; Body: DetectRenameBody }>(
  '/vault/:vaultName/detect-rename',
  async (request, reply) => {
    const { vaultName } = request.params;
    const { missing_path, missing_hash, file_id } = request.body;

    if (!validateVaultName(vaultName)) {
      return reply.status(400).send({ error: 'Invalid vault name' });
    }

    if (!missing_path || !missing_hash) {
      return reply.status(400).send({ error: 'Missing required fields: missing_path, missing_hash' });
    }

    if (!validateFilePath(missing_path)) {
      return reply.status(400).send({ error: 'Invalid file path' });
    }

    console.log(`Server: POST /vault/${vaultName}/detect-rename - ${missing_path}`);

    const result = detectRename(vaultName, missing_path, missing_hash, file_id);

    return {
      found: result.found,
      new_path: result.newPath,
      file_id: result.fileId,
      detection_method: result.method,
    };
  }
);

// POST /vault/:vaultName/rename - Rename a file atomically
interface RenameBody {
  file_id: string;
  old_path: string;
  new_path: string;
  content?: string; // base64 encoded (optional - if content also changed)
}

server.post<{ Params: VaultParams; Body: RenameBody }>(
  '/vault/:vaultName/rename',
  async (request, reply) => {
    const { vaultName } = request.params;
    const { file_id, old_path, new_path, content } = request.body;

    if (!validateVaultName(vaultName)) {
      return reply.status(400).send({ error: 'Invalid vault name' });
    }

    if (!file_id || !old_path || !new_path) {
      return reply.status(400).send({ error: 'Missing required fields: file_id, old_path, new_path' });
    }

    if (!validateFilePath(old_path) || !validateFilePath(new_path)) {
      return reply.status(400).send({ error: 'Invalid file path' });
    }

    console.log(`Server: POST /vault/${vaultName}/rename - ${old_path} -> ${new_path}`);

    const newContent = content ? Buffer.from(content, 'base64') : undefined;
    const result = renameFile(vaultName, file_id, old_path, new_path, newContent);

    if (!result.success) {
      return reply.status(400).send({ error: result.error });
    }

    const record = getFileRecord(vaultName, new_path);

    return {
      success: true,
      commit: result.commit,
      file_id: record?.file_id,
      hash: record?.hash,
    };
  }
);

// POST /vault/:vaultName/push - Push batch of operations (pull-before-push protocol)
interface PushBody {
  base_commit: string;
  operations: PushOperation[];
}

server.post<{ Params: VaultParams; Body: PushBody }>(
  '/vault/:vaultName/push',
  async (request, reply) => {
    const { vaultName } = request.params;
    const { base_commit, operations } = request.body;

    if (!validateVaultName(vaultName)) {
      return reply.status(400).send({ error: 'Invalid vault name' });
    }

    if (!base_commit) {
      return reply.status(400).send({ error: 'base_commit is required' });
    }

    if (!operations || !Array.isArray(operations) || operations.length === 0) {
      return reply.status(400).send({ error: 'operations array is required' });
    }

    console.log(`Server: POST /vault/${vaultName}/push - ${operations.length} op(s), base=${base_commit.slice(0, 8)}`);
    initVaultGit(vaultName);

    const release = await vaultLock.acquire(vaultName);
    try {
      const head = getHeadCommit(vaultName);

      // Reject stale pushes
      if (base_commit !== head) {
        return reply.status(409).send({
          error: 'stale',
          head_commit: head,
        });
      }

      const results: PushOperationResult[] = [];

      for (let i = 0; i < operations.length; i++) {
        const op = operations[i];
        let result: PushOperationResult;

        switch (op.type) {
          case 'create':
            result = processPushCreate(vaultName, op, i);
            break;
          case 'modify':
            result = processPushModify(vaultName, op, i);
            break;
          case 'rename':
            result = processPushRename(vaultName, op, i);
            break;
          case 'delete':
            result = processPushDelete(vaultName, op, i);
            break;
          default:
            result = { index: i, success: false, error: `Unknown operation type: ${(op as PushOperation).type}` };
        }

        results.push(result);

        if (!result.success) {
          // Rollback all staged changes
          try {
            execFileSync('git', ['reset', '--hard', head!], {
              cwd: getVaultPath(vaultName),
              encoding: 'utf-8',
              stdio: ['pipe', 'pipe', 'pipe'],
            });
          } catch {
            // best effort
          }
          return reply.status(400).send({
            success: false,
            results,
            head_commit: head,
            error: `Operation ${i} failed: ${result.error}`,
          });
        }
      }

      // Single atomic commit for all operations
      const vaultPath = getVaultPath(vaultName);
      const opSummary = operations.map(op => `${op.type} ${op.path}`).join(', ');
      try {
        execFileSync('git', ['commit', '-m', `Push: ${opSummary}`], {
          cwd: vaultPath,
          encoding: 'utf-8',
          stdio: ['pipe', 'pipe', 'pipe'],
        });
      } catch (error: unknown) {
        const execError = error as { message?: string };
        if (!execError.message?.includes('nothing to commit')) {
          throw error;
        }
      }

      const newHead = getHeadCommit(vaultName);

      // Trigger auto gc to prevent unbounded .git/objects growth
      gitGcAuto(vaultName);

      // Update metadata for created/modified files
      for (let i = 0; i < operations.length; i++) {
        const op = operations[i];
        if (op.type === 'create' || op.type === 'modify') {
          const fileId = ensureFileId(vaultName, op.path, results[i].hash || null, newHead);
          results[i].file_id = fileId;
        } else if (op.type === 'rename' && op.old_path) {
          const meta = getFileByPath(vaultName, op.path) || getFileByPath(vaultName, op.old_path!);
          if (meta) {
            results[i].file_id = meta.file_id;
          }
        }
      }

      return {
        success: true,
        head_commit: newHead,
        results,
      };
    } finally {
      release();
    }
  }
);

// GET /vault/:vaultName/file-by-id/:fileId - Download file by UUID
interface FileByIdParams extends VaultParams {
  fileId: string;
}

server.get<{ Params: FileByIdParams }>('/vault/:vaultName/file-by-id/:fileId', async (request, reply) => {
  const { vaultName, fileId } = request.params;

  if (!validateVaultName(vaultName)) {
    return reply.status(400).send({ error: 'Invalid vault name' });
  }

  console.log(`Server: GET /vault/${vaultName}/file-by-id/${fileId}`);

  // Look up current path from metadata
  const fileMeta = getFileById(vaultName, fileId);

  if (!fileMeta || fileMeta.deleted_at) {
    return reply.status(404).send({ error: 'File not found' });
  }

  const record = getFileRecord(vaultName, fileMeta.current_path);
  if (!record) {
    return reply.status(404).send({ error: 'File not found on disk' });
  }

  const content = getCurrentFile(vaultName, fileMeta.current_path);
  if (!content) {
    return reply.status(404).send({ error: 'File content not found' });
  }

  return reply
    .header('Content-Type', 'application/octet-stream')
    .header('X-File-Id', record.file_id)
    .header('X-File-Path', record.path)
    .header('X-File-Commit', record.commit)
    .header('X-File-Hash', record.hash)
    .send(content);
});

