import { createHash } from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const VAULT_DIR = path.join(__dirname, '..', 'vault');
export const BASE_URL = 'http://localhost:3000';

/**
 * Simulates a sync client with its own sync state
 */
export class SyncClient {
  constructor(name, baseUrl = BASE_URL) {
    this.name = name;
    this.baseUrl = baseUrl;
    this.syncState = {}; // path -> { hash, revision }
  }

  log(message) {
    console.log(`   [${this.name}] ${message}`);
  }

  async upload(filePath, content) {
    const base64Content = Buffer.from(content).toString('base64');
    const clientRevision = this.syncState[filePath]?.revision ?? null;

    const response = await fetch(`${this.baseUrl}/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        path: filePath,
        content: base64Content,
        client_revision: clientRevision,
      }),
    });

    const data = await response.json();

    if (response.status === 409) {
      this.log(`Conflict uploading ${filePath} (server rev: ${data.server_revision})`);
      return { conflict: true, ...data };
    }

    if (!response.ok) {
      throw new Error(`Upload failed: ${response.status} - ${JSON.stringify(data)}`);
    }

    // Update local sync state
    this.syncState[filePath] = {
      hash: data.hash,
      revision: data.revision,
    };

    this.log(`Uploaded ${filePath} (rev: ${data.revision})`);
    return { success: true, ...data };
  }

  async download(filePath) {
    const response = await fetch(`${this.baseUrl}/file/${encodeURIComponent(filePath)}`);

    if (!response.ok) {
      if (response.status === 404) {
        this.log(`File not found: ${filePath}`);
        return null;
      }
      throw new Error(`Download failed: ${response.status}`);
    }

    const content = await response.arrayBuffer();
    const revision = parseInt(response.headers.get('X-File-Revision') || '1', 10);
    const hash = response.headers.get('X-File-Hash') || '';

    // Update local sync state
    this.syncState[filePath] = { hash, revision };

    this.log(`Downloaded ${filePath} (rev: ${revision})`);
    return {
      content: Buffer.from(content),
      revision,
      hash,
    };
  }

  async delete(filePath) {
    const response = await fetch(`${this.baseUrl}/file/${encodeURIComponent(filePath)}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      if (response.status === 404) {
        this.log(`File not found for deletion: ${filePath}`);
        return { notFound: true };
      }
      throw new Error(`Delete failed: ${response.status}`);
    }

    // Remove from local sync state
    delete this.syncState[filePath];

    this.log(`Deleted ${filePath}`);
    return { success: true };
  }

  async getManifest() {
    const response = await fetch(`${this.baseUrl}/manifest`);
    if (!response.ok) {
      throw new Error(`Get manifest failed: ${response.status}`);
    }
    return response.json();
  }

  /**
   * Sync local state with server manifest
   */
  async syncFromManifest() {
    const manifest = await this.getManifest();
    for (const file of manifest.files) {
      this.syncState[file.path] = {
        hash: file.hash,
        revision: file.revision,
      };
    }
    this.log(`Synced state from manifest (${manifest.files.length} files)`);
    return manifest;
  }
}

// Assertion helpers
export function assert(condition, message) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

export function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message}: expected "${expected}", got "${actual}"`);
  }
}

export function assertIncludes(array, item, message) {
  if (!array.includes(item)) {
    throw new Error(`${message}: ${item} not found in [${array.join(', ')}]`);
  }
}

// Utility functions
export function computeHash(content) {
  return createHash('sha256').update(content).digest('hex');
}

export function fileExistsInVault(filePath) {
  return fs.existsSync(path.join(VAULT_DIR, filePath));
}

export function readVaultFile(filePath) {
  return fs.readFileSync(path.join(VAULT_DIR, filePath));
}

// Test runner helper
export async function runTests(testName, tests) {
  console.log(`\n=== ${testName} ===\n`);
  let passed = 0;
  let failed = 0;

  for (const [name, testFn] of Object.entries(tests)) {
    try {
      await testFn();
      console.log(`✓ ${name}\n`);
      passed++;
    } catch (error) {
      console.error(`✗ ${name}`);
      console.error(`  Error: ${error.message}\n`);
      failed++;
    }
  }

  console.log(`\n${testName}: ${passed} passed, ${failed} failed`);
  return failed === 0;
}
