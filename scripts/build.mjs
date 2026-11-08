import { cp, mkdir, readFile, readdir, rm, writeFile, stat } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { createHash } from 'node:crypto';
const root = resolve(import.meta.dirname, '..');
const output = resolve(root, 'dist');
if (output !== resolve(root, 'dist') || !output.startsWith(root)) throw new Error('Invalid build output');
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
await cp(resolve(root, 'public'), output, { recursive: true, filter: path => !path.endsWith('-original.png') });
for (const file of await readdir(resolve(root, 'src'))) {
  if (file !== 'sw.js') await cp(resolve(root, 'src', file), resolve(output, file));
}
const pdfjs = resolve(root, 'node_modules/pdfjs-dist');
const vendor = resolve(output, 'vendor/pdfjs');
await mkdir(vendor, { recursive: true });
for (const file of ['pdf.mjs', 'pdf.worker.mjs']) await cp(resolve(pdfjs, 'legacy/build', file), resolve(vendor, file));
for (const folder of ['cmaps', 'standard_fonts', 'wasm', 'iccs']) {
  try { await cp(resolve(pdfjs, folder), resolve(vendor, folder), { recursive: true }); } catch (error) { if (error.code !== 'ENOENT') throw error; }
}
await cp(resolve(pdfjs, 'LICENSE'), resolve(vendor, 'LICENSE'));
await writeFile(resolve(output, '.nojekyll'), '');
await writeFile(resolve(output, 'build-info.json'), JSON.stringify({ app: 'SV Mochenwangen', version: '1.0.0', builtAt: new Date().toISOString() }, null, 2));
const shell = ['./', './index.html', './widget.html', './manifest.webmanifest', './app.js', './config.js', './magazine.js', './styles.css', './widget.js', './widget.css', './icons/club-emblem.png', './icons/icon-192.png', './icons/icon-512.png', './icons/icon-maskable-512.png', './icons/apple-touch-icon.png', './vendor/pdfjs/pdf.mjs', './vendor/pdfjs/pdf.worker.mjs'];
const hash = createHash('sha256');
// PDF.js loads these lazily. Keep color conversion available on the first
// offline visit even if the initial online request preceded worker activation.
shell.push('./vendor/pdfjs/wasm/qcms_bg.wasm', './vendor/pdfjs/iccs/CGATS001Compat-v2-micro.icc');
for (const file of shell.filter(file => file !== './')) hash.update(await readFile(resolve(output, file)));
// Changing the magazine also invalidates the per-version document cache.
hash.update(await readFile(resolve(output, 'documents/stadionheft-2026-11-01.pdf')));
const id = hash.digest('hex').slice(0, 16);
const template = await readFile(resolve(root, 'src/sw.js'), 'utf8');
await writeFile(resolve(output, 'sw.js'), template.replace('__BUILD_ID__', id).replace('__SHELL_FILES__', JSON.stringify(shell)));
const pdf = await readFile(resolve(output, 'documents/stadionheft-2026-11-01.pdf'));
if (pdf.subarray(0, 5).toString() !== '%PDF-') throw new Error('Missing or invalid stadium magazine PDF');
console.log(`PWA built: ${output}\nCache version: ${id}\nPDF: ${(pdf.length / 1024 / 1024).toFixed(1)} MiB, same-origin`);
