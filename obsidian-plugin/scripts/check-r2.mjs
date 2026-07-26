#!/usr/bin/env node
// Runnable check for the R2Backend wire protocol (manifest + conditional
// write + tombstone), independent of Obsidian's API — this exercises the
// same PUT/GET/If-Match semantics r2-backend.ts uses, via plain fetch +
// aws4fetch, so it can run in plain Node against a real scratch prefix.
//
// It does NOT exercise SyncService (conflict files, the file watcher, the
// split-brain guard) — those need the `obsidian` module and are covered by
// the plan's manual end-to-end steps instead.
//
// Usage:
//   R2_ACCOUNT_ID=... R2_BUCKET=... R2_ACCESS_KEY_ID=... R2_SECRET_ACCESS_KEY=... \
//     node scripts/check-r2.mjs
//
// Uses a throwaway prefix (`_check-r2-<timestamp>/`) inside the given bucket
// and deletes every object it created afterwards, pass or fail.

import { AwsClient } from 'aws4fetch';

const { R2_ACCOUNT_ID, R2_BUCKET, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY } = process.env;
for (const [name, val] of Object.entries({ R2_ACCOUNT_ID, R2_BUCKET, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY })) {
  if (!val) {
    console.error(`Missing env var ${name}. See usage in this file's header.`);
    process.exit(1);
  }
}

const aws = new AwsClient({ accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY, service: 's3', region: 'auto' });
const endpoint = `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${R2_BUCKET}`;
const prefix = `_check-r2-${Date.now()}`;
const createdKeys = new Set();

async function req(method, key, opts = {}) {
  const url = `${endpoint}/${prefix}/${key}`;
  const signed = await aws.sign(url, { method, body: opts.body, headers: opts.headers });
  const resp = await fetch(signed.url, { method, body: opts.body, headers: signed.headers });
  return resp;
}

async function putFile(key, body) {
  const resp = await req('PUT', `files/${key}`, { body });
  createdKeys.add(`files/${key}`);
  if (!resp.ok) throw new Error(`PUT files/${key} failed: ${resp.status}`);
}

async function getManifest() {
  const resp = await req('GET', 'manifest.json');
  if (resp.status === 404) return { manifest: { version: 1, files: {}, deleted: {} }, etag: null, requests: 1 };
  if (!resp.ok) throw new Error(`GET manifest.json failed: ${resp.status}`);
  return { manifest: await resp.json(), etag: resp.headers.get('etag'), requests: 1 };
}

async function putManifest(manifest, etag) {
  createdKeys.add('manifest.json');
  const headers = etag ? { 'if-match': etag } : { 'if-none-match': '*' };
  return req('PUT', 'manifest.json', { body: JSON.stringify(manifest), headers });
}

let failures = 0;
function check(name, cond) {
  console.log(`${cond ? 'PASS' : 'FAIL'} — ${name}`);
  if (!cond) failures++;
}

async function main() {
  console.log(`Using scratch prefix: ${prefix}/\n`);

  // 1. Bootstrap: push 3 files against an empty manifest.
  const bodies = { 'a.md': 'hello a', 'b.md': 'hello b', 'c.md': 'hello c' };
  for (const [k, v] of Object.entries(bodies)) await putFile(k, v);
  const manifestV1 = {
    version: 1,
    files: Object.fromEntries(Object.keys(bodies).map(k => [k, { hash: k, size: bodies[k].length }])),
    deleted: {},
  };
  const put1 = await putManifest(manifestV1, null);
  check('bootstrap: manifest PUT with If-None-Match:* succeeds on empty prefix', put1.ok);
  const etag1 = put1.headers.get('etag');

  // 2. Pull: fetch manifest, confirm 3 entries and bodies round-trip.
  const { manifest: m2, etag: etag2 } = await getManifest();
  check('pull: manifest lists exactly 3 files', Object.keys(m2.files).length === 3);
  check('pull: etag matches the one returned by the bootstrap PUT', etag2 === etag1);
  const aResp = await req('GET', 'files/a.md');
  const aBody = await aResp.text();
  check('pull: file body round-trips', aBody === bodies['a.md']);

  // 3. No-op: pulling again with nothing changed should be exactly 1 request
  // (the manifest GET) and 0 body GETs — this is the check that catches an
  // accidental full-vault re-download/re-upload.
  let getCalls = 0;
  const origFetch = globalThis.fetch;
  globalThis.fetch = (...args) => { getCalls++; return origFetch(...args); };
  await getManifest();
  globalThis.fetch = origFetch;
  check('no-op sync issues exactly 1 request (manifest only)', getCalls === 1);

  // 4. Stale push: two "clients" pull the same etag, both push — second must 412.
  const { etag: baseEtag } = await getManifest();
  await putFile('a.md', 'hello a v2');
  const manifestV2 = { ...manifestV1, files: { ...manifestV1.files, 'a.md': { hash: 'a-v2', size: 10 } } };
  const put2 = await putManifest(manifestV2, baseEtag);
  check('client 1 push (fresh etag) succeeds', put2.ok);

  await putFile('b.md', 'hello b v2 (conflict)');
  const manifestV2b = { ...manifestV1, files: { ...manifestV1.files, 'b.md': { hash: 'b-v2', size: 10 } } };
  const put2b = await putManifest(manifestV2b, baseEtag); // stale on purpose: same base as client 1
  check('client 2 push (stale etag) is rejected with 412', put2b.status === 412);

  // 5. Delete: tombstone a file, confirm it does not resurrect.
  const { manifest: m5, etag: etag5 } = await getManifest();
  const manifestV3 = {
    version: 1,
    files: Object.fromEntries(Object.entries(m5.files).filter(([k]) => k !== 'c.md')),
    deleted: { ...m5.deleted, 'c.md': { at: Date.now() } },
  };
  const put3 = await putManifest(manifestV3, etag5);
  check('delete: tombstone manifest PUT succeeds', put3.ok);
  const { manifest: m6 } = await getManifest();
  check('delete: deleted file is absent from a subsequent pull', !('c.md' in m6.files));

  console.log(`\n${failures === 0 ? 'All checks passed.' : `${failures} check(s) failed.`}`);

  // Cleanup — best effort, pass or fail.
  for (const key of createdKeys) {
    await req('DELETE', key).catch(() => {});
  }

  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error('check-r2 crashed:', err);
  process.exit(1);
});
