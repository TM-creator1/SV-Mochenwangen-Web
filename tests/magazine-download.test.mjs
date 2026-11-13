import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { downloadMagazine } from '../src/magazine-download.js';

test('download reports actual chunks and completes only after the stream ends', async t => {
  const original = globalThis.fetch; t.after(() => { globalThis.fetch = original; });
  globalThis.fetch = async () => new Response(new ReadableStream({ start(controller) {
    controller.enqueue(new Uint8Array(25)); controller.enqueue(new Uint8Array(75)); controller.close();
  } }), { headers: { 'content-length': '100' } });
  const updates = [];
  const data = await downloadMagazine('/magazine.pdf', { onProgress: update => updates.push(update) });
  assert.equal(data.length, 100);
  assert.deepEqual(updates.map(update => update.loaded), [0, 25, 100, 100]);
  assert.equal(updates[1].total, 100);
  assert.equal(updates[2].done, false);
  assert.equal(updates.at(-1).done, true);
});

test('unknown and encoded lengths do not produce invented percentages', async t => {
  const original = globalThis.fetch; t.after(() => { globalThis.fetch = original; });
  for (const headers of [{}, { 'content-length': '3', 'content-encoding': 'gzip' }]) {
    globalThis.fetch = async () => new Response('hello', { headers });
    const updates = [];
    await downloadMagazine('/magazine.pdf', { onProgress: update => updates.push(update) });
    assert.ok(updates.filter(update => !update.done).every(update => update.total === 0));
    assert.deepEqual(updates.at(-1), { loaded: 5, total: 5, done: true });
  }
});

test('download errors do not report a completed document', async t => {
  const original = globalThis.fetch; t.after(() => { globalThis.fetch = original; });
  globalThis.fetch = async () => new Response('', { status: 503 });
  const updates = [];
  await assert.rejects(downloadMagazine('/magazine.pdf', { onProgress: update => updates.push(update) }), /503/);
  assert.equal(updates.length, 0);
});

test('service worker returns the PDF while the offline cache write is still pending', async () => {
  const listeners = {};
  let release;
  let written = false;
  const gate = new Promise(resolve => { release = resolve; });
  const cache = { match: async () => undefined, put: async () => { await gate; written = true; } };
  const source = await readFile(new URL('../src/sw.js', import.meta.url), 'utf8');
  vm.runInNewContext(source, {
    URL, __SHELL_FILES__: [],
    self: { registration: { scope: 'https://example.com/club/' }, addEventListener: (type, listener) => { listeners[type] = listener; } },
    caches: { open: async () => cache }, fetch: async () => new Response('pdf'),
  });
  let responsePromise; let lifetime;
  listeners.fetch({ request: new Request('https://example.com/club/documents/issue.pdf'),
    respondWith: promise => { responsePromise = promise; }, waitUntil: promise => { lifetime = promise; } });
  let timer;
  try {
    const response = await Promise.race([responsePromise, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Response blocked by cache write')), 1000); })]);
    assert.equal(await response.text(), 'pdf');
    assert.equal(written, false);
  } finally { clearTimeout(timer); release(); await lifetime; }
  assert.equal(written, true);
});
