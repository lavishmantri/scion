import {
  SyncClient,
  assert,
  assertEqual,
  readVaultFile,
  runTests,
} from './helpers.js';

const tests = {
  'Client A uploads, Client B downloads': async () => {
    const clientA = new SyncClient('ClientA');
    const clientB = new SyncClient('ClientB');
    const filePath = 'multi-test/share.md';
    const content = 'Shared content from A';

    // A uploads
    await clientA.upload(filePath, content);

    // B downloads
    const downloaded = await clientB.download(filePath);

    assert(downloaded, 'B should download the file');
    assertEqual(downloaded.content.toString(), content, 'Content should match');
    assertEqual(downloaded.revision, 1, 'Revision should be 1');

    // Both clients should have same sync state
    assertEqual(
      clientA.syncState[filePath].revision,
      clientB.syncState[filePath].revision,
      'Both clients should have same revision'
    );

    // Cleanup
    await clientA.delete(filePath);
  },

  'Conflict: Client B has stale revision when uploading': async () => {
    const clientA = new SyncClient('ClientA');
    const clientB = new SyncClient('ClientB');
    const filePath = 'multi-test/conflict.md';

    // A uploads first
    const resultA = await clientA.upload(filePath, 'Content from A v1');
    assertEqual(resultA.revision, 1, 'A should get revision 1');

    // B syncs to get revision 1
    await clientB.syncFromManifest();

    // A updates to v2
    await clientA.upload(filePath, 'Content from A v2');

    // B tries to upload with stale revision 1 (server now at 2)
    const resultB = await clientB.upload(filePath, 'Content from B');

    // B should get conflict because server revision (2) > client revision (1)
    assert(resultB.conflict, 'B should get conflict');
    assertEqual(resultB.server_revision, 2, 'Server revision should be 2');

    // Vault should still have A's v2 content
    const vaultContent = readVaultFile(filePath).toString();
    assertEqual(vaultContent, 'Content from A v2', 'Vault should have A\'s v2 content');

    // Cleanup
    await clientA.delete(filePath);
  },

  'Client B uploads with correct revision after A': async () => {
    const clientA = new SyncClient('ClientA');
    const clientB = new SyncClient('ClientB');
    const filePath = 'multi-test/sequential.md';

    // A uploads v1
    await clientA.upload(filePath, 'Version 1 from A');

    // B syncs from manifest to get current state
    await clientB.syncFromManifest();

    // B now has correct revision, uploads v2
    const resultB = await clientB.upload(filePath, 'Version 2 from B');

    assert(resultB.success, 'B should succeed with correct revision');
    assertEqual(resultB.revision, 2, 'Should be revision 2');

    // Vault should have B's content
    const vaultContent = readVaultFile(filePath).toString();
    assertEqual(vaultContent, 'Version 2 from B', 'Vault should have B\'s content');

    // Cleanup
    await clientA.delete(filePath);
  },

  'Client A deletes, Client B tries to update': async () => {
    const clientA = new SyncClient('ClientA');
    const clientB = new SyncClient('ClientB');
    const filePath = 'multi-test/delete-race.md';

    // A uploads
    await clientA.upload(filePath, 'Original content');

    // B syncs to get revision
    await clientB.syncFromManifest();

    // A deletes
    await clientA.delete(filePath);

    // B tries to update (has stale revision 1)
    // This should succeed as a new file (server doesn't have it)
    const resultB = await clientB.upload(filePath, 'B\'s update after delete');

    // Since file was deleted, B's upload creates a new file with revision 1
    assert(resultB.success, 'B should succeed (creates new file)');
    assertEqual(resultB.revision, 1, 'Should be revision 1 (new file)');

    // Cleanup
    await clientB.delete(filePath);
  },

  'Multiple sequential updates from different clients': async () => {
    const clientA = new SyncClient('ClientA');
    const clientB = new SyncClient('ClientB');
    const clientC = new SyncClient('ClientC');
    const filePath = 'multi-test/round-robin.md';

    // A creates file
    await clientA.upload(filePath, 'A creates');

    // B syncs and updates
    await clientB.syncFromManifest();
    await clientB.upload(filePath, 'B updates');

    // C syncs and updates
    await clientC.syncFromManifest();
    await clientC.upload(filePath, 'C updates');

    // A syncs and updates
    await clientA.syncFromManifest();
    const finalResult = await clientA.upload(filePath, 'A final update');

    assertEqual(finalResult.revision, 4, 'Should be revision 4');

    // Verify final content
    const vaultContent = readVaultFile(filePath).toString();
    assertEqual(vaultContent, 'A final update', 'Final content');

    // Cleanup
    await clientA.delete(filePath);
  },

  'Concurrent uploads without sync cause conflicts': async () => {
    const clientA = new SyncClient('ClientA');
    const clientB = new SyncClient('ClientB');
    const filePath = 'multi-test/concurrent.md';

    // A uploads
    await clientA.upload(filePath, 'A initial');

    // B gets current state
    await clientB.syncFromManifest();

    // A updates to v2
    await clientA.upload(filePath, 'A version 2');

    // B tries to update (has stale revision 1)
    const resultB = await clientB.upload(filePath, 'B version 2');

    // B should conflict because server is at revision 2, B has revision 1
    assert(resultB.conflict, 'B should conflict (stale revision)');
    assertEqual(resultB.server_revision, 2, 'Server should be at revision 2');

    // Cleanup
    await clientA.delete(filePath);
  },
};

// Run tests
const success = await runTests('Multi-Client Tests', tests);
process.exit(success ? 0 : 1);
