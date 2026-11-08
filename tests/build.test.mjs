import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolvePage, TEAMS } from '../src/config.js';

const dist = new URL('../dist/', import.meta.url);
test('built PWA includes valid manifest, offline shell and local PDF', async () => {
  const manifest = JSON.parse(await readFile(new URL('manifest.webmanifest', dist), 'utf8'));
  assert.equal(manifest.display, 'standalone');
  for (const icon of manifest.icons) await readFile(new URL(icon.src, dist));
  const worker = await readFile(new URL('sw.js', dist), 'utf8');
  assert.ok(!worker.includes('__BUILD_ID__'));
  assert.ok(!worker.includes('__SHELL_FILES__'));
  const pdf = await readFile(new URL('documents/stadionheft-2026-11-01.pdf', dist));
  assert.equal(pdf.subarray(0, 5).toString(), '%PDF-');
  await readFile(new URL('vendor/pdfjs/pdf.worker.mjs', dist));
});
test('all team destinations resolve and unknown routes return home', () => {
  for (const team of TEAMS) for (const kind of ['ticker', 'standings', 'matches']) {
    const page = resolvePage(`${team.id}-${kind}`);
    assert.equal(page.team.id, team.id);
    assert.equal(page.kind, kind);
  }
  assert.equal(resolvePage('unknown').id, 'home');
});

test('Pages manifest and complete offline shell stay within the repository path', async () => {
  const base = new URL('https://tm-creator1.github.io/SV-Mochenwangen-Web/');
  const manifest = JSON.parse(await readFile(new URL('manifest.webmanifest', dist), 'utf8'));
  for (const key of ['id', 'start_url', 'scope']) assert.equal(new URL(manifest[key], base).href, base.href);
  for (const entry of [...manifest.icons.map(icon => icon.src), ...manifest.shortcuts.map(shortcut => shortcut.url)]) {
    assert.ok(new URL(entry, base).href.startsWith(base.href));
  }
  const worker = await readFile(new URL('sw.js', dist), 'utf8');
  const shell = JSON.parse(worker.match(/^const SHELL = (.+);$/m)[1]);
  for (const path of shell) {
    assert.ok(new URL(path, base).href.startsWith(base.href), path);
    await readFile(new URL(path === './' ? 'index.html' : path, dist));
  }
  for (const path of ['./manifest.webmanifest', './widget.html', './icons/apple-touch-icon.png', './vendor/pdfjs/pdf.worker.mjs']) {
    assert.ok(shell.includes(path), path);
  }
});
