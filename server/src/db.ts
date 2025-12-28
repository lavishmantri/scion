import Database from 'better-sqlite3';
import { createHash } from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export interface FileRecord {
  path: string;
  hash: string;
  updated_at: number;
  revision: number;
}

let db: Database.Database;

export function initDb(): void {
  const dbPath = path.join(__dirname, '..', 'sync.db');
  db = new Database(dbPath);

  db.exec(`
    CREATE TABLE IF NOT EXISTS files (
      path TEXT PRIMARY KEY,
      hash TEXT NOT NULL,
      updated_at INTEGER NOT NULL,
      revision INTEGER NOT NULL DEFAULT 1
    )
  `);
}

export function getManifest(): FileRecord[] {
  const stmt = db.prepare('SELECT path, hash, updated_at, revision FROM files');
  return stmt.all() as FileRecord[];
}

export function getFileRecord(filePath: string): FileRecord | undefined {
  const stmt = db.prepare('SELECT path, hash, updated_at, revision FROM files WHERE path = ?');
  return stmt.get(filePath) as FileRecord | undefined;
}

export function upsertFile(filePath: string, hash: string): FileRecord {
  const now = Math.floor(Date.now() / 1000);
  const existing = getFileRecord(filePath);

  if (existing) {
    const stmt = db.prepare(`
      UPDATE files
      SET hash = ?, updated_at = ?, revision = revision + 1
      WHERE path = ?
    `);
    stmt.run(hash, now, filePath);
  } else {
    const stmt = db.prepare(`
      INSERT INTO files (path, hash, updated_at, revision)
      VALUES (?, ?, ?, 1)
    `);
    stmt.run(filePath, hash, now);
  }

  return getFileRecord(filePath)!;
}

export function deleteFile(filePath: string): boolean {
  const stmt = db.prepare('DELETE FROM files WHERE path = ?');
  const result = stmt.run(filePath);
  return result.changes > 0;
}

export function computeHash(content: Buffer): string {
  return createHash('sha256').update(content).digest('hex');
}
