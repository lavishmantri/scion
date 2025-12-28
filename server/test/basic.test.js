import {
  SyncClient,
  assert,
  assertEqual,
  computeHash,
  fileExistsInVault,
  readVaultFile,
  runTests,
} from './helpers.js';

const tests = {
  'Upload file via POST /sync': async () => {
    const client = new SyncClient('BasicClient');
    const filePath = 'basic-test/upload.md';
    const content = 'Hello from basic test!';

    const result = await client.upload(filePath, content);

    assert(result.success, 'Upload should succeed');
    assert(result.revision === 1, 'First upload should have revision 1');
    assert(result.hash === computeHash(Buffer.from(content)), 'Hash should match');

    // Cleanup
    await client.delete(filePath);
  },

  'Verify file exists in vault after upload': async () => {
    const client = new SyncClient('BasicClient');
    const filePath = 'basic-test/vault-check.md';
    const content = 'Check vault content';

    await client.upload(filePath, content);

    assert(fileExistsInVault(filePath), 'File should exist in vault');
    const vaultContent = readVaultFile(filePath).toString();
    assertEqual(vaultContent, content, 'Vault content');

    // Cleanup
    await client.delete(filePath);
  },

  'Verify manifest contains uploaded file with correct hash': async () => {
    const client = new SyncClient('BasicClient');
    const filePath = 'basic-test/manifest-check.md';
    const content = 'Manifest test content';

    await client.upload(filePath, content);

    const manifest = await client.getManifest();
    const fileRecord = manifest.files.find((f) => f.path === filePath);

    assert(fileRecord, 'File should be in manifest');
    assertEqual(fileRecord.hash, computeHash(Buffer.from(content)), 'Manifest hash');
    assertEqual(fileRecord.revision, 1, 'Manifest revision');

    // Cleanup
    await client.delete(filePath);
  },

  'Download file via GET /file/:path': async () => {
    const client = new SyncClient('BasicClient');
    const filePath = 'basic-test/download.md';
    const content = 'Download test content';

    await client.upload(filePath, content);

    // Create a new client to simulate fresh download
    const client2 = new SyncClient('BasicClient2');
    const downloaded = await client2.download(filePath);

    assert(downloaded, 'Download should return content');
    assertEqual(downloaded.content.toString(), content, 'Downloaded content');
    assertEqual(downloaded.revision, 1, 'Downloaded revision');

    // Cleanup
    await client.delete(filePath);
  },

  'Delete file via DELETE /file/:path': async () => {
    const client = new SyncClient('BasicClient');
    const filePath = 'basic-test/delete.md';
    const content = 'Delete test content';

    await client.upload(filePath, content);
    assert(fileExistsInVault(filePath), 'File should exist before delete');

    const result = await client.delete(filePath);
    assert(result.success, 'Delete should succeed');
    assert(!fileExistsInVault(filePath), 'File should not exist after delete');

    // Verify not in manifest
    const manifest = await client.getManifest();
    const fileRecord = manifest.files.find((f) => f.path === filePath);
    assert(!fileRecord, 'File should not be in manifest after delete');
  },

  'Update existing file increments revision': async () => {
    const client = new SyncClient('BasicClient');
    const filePath = 'basic-test/update.md';

    // Upload v1
    const result1 = await client.upload(filePath, 'Version 1');
    assertEqual(result1.revision, 1, 'First revision');

    // Upload v2
    const result2 = await client.upload(filePath, 'Version 2');
    assertEqual(result2.revision, 2, 'Second revision');

    // Verify vault has v2
    const vaultContent = readVaultFile(filePath).toString();
    assertEqual(vaultContent, 'Version 2', 'Vault should have v2');

    // Cleanup
    await client.delete(filePath);
  },
};

// Run tests
const success = await runTests('Basic CRUD Tests', tests);
process.exit(success ? 0 : 1);
