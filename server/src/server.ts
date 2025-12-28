import Fastify from 'fastify';
import path from 'path';
import { fileURLToPath } from 'url';
import fse from 'fs-extra';
import {
  getManifest,
  getFileRecord,
  upsertFile,
  deleteFile,
  computeHash,
} from './db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const VAULT_DIR = path.join(__dirname, '..', 'vault');

export const server = Fastify({
  logger: true,
});

// Ensure vault directory exists
await fse.ensureDir(VAULT_DIR);

// Health check
server.get('/health', async () => {
  return { status: 'ok' };
});

// GET /manifest - Return all files with their metadata
server.get('/manifest', async () => {
  const files = getManifest();
  return { files };
});

// GET /file/:path - Download file content
server.get<{ Params: { '*': string } }>('/file/*', async (request, reply) => {
  const filePath = request.params['*'];
  const record = getFileRecord(filePath);

  if (!record) {
    return reply.status(404).send({ error: 'File not found' });
  }

  const fullPath = path.join(VAULT_DIR, filePath);

  if (!(await fse.pathExists(fullPath))) {
    return reply.status(404).send({ error: 'File not found on disk' });
  }

  const content = await fse.readFile(fullPath);
  return reply
    .header('Content-Type', 'application/octet-stream')
    .header('X-File-Revision', record.revision)
    .header('X-File-Hash', record.hash)
    .send(content);
});

// POST /sync - Upload/sync a file
interface SyncBody {
  path: string;
  content: string; // base64 encoded
  client_revision: number | null;
}

server.post<{ Body: SyncBody }>('/sync', async (request, reply) => {
  const { path: filePath, content: base64Content, client_revision } = request.body;

  if (!filePath || base64Content === undefined) {
    return reply.status(400).send({ error: 'Missing path or content' });
  }

  // Decode base64 content
  const content = Buffer.from(base64Content, 'base64');
  const hash = computeHash(content);

  // Check for conflicts
  const existing = getFileRecord(filePath);

  if (existing && client_revision !== null && existing.revision > client_revision) {
    return reply.status(409).send({
      error: 'conflict',
      server_revision: existing.revision,
      server_hash: existing.hash,
    });
  }

  // Write file to disk
  const fullPath = path.join(VAULT_DIR, filePath);
  await fse.ensureDir(path.dirname(fullPath));
  await fse.writeFile(fullPath, content);

  // Update database
  const record = upsertFile(filePath, hash);

  return {
    success: true,
    revision: record.revision,
    hash: record.hash,
  };
});

// DELETE /file/:path - Delete a file
server.delete<{ Params: { '*': string } }>('/file/*', async (request, reply) => {
  const filePath = request.params['*'];

  const deleted = deleteFile(filePath);

  if (!deleted) {
    return reply.status(404).send({ error: 'File not found' });
  }

  // Remove from disk
  const fullPath = path.join(VAULT_DIR, filePath);
  await fse.remove(fullPath);

  return { success: true };
});
