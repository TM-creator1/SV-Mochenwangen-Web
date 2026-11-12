import { readFile, writeFile, rename } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const source = 'https://sv-mochenwangen.de/';

export function findMagazine(html) {
  const links = [...html.matchAll(/href\s*=\s*["']([^"']+)["']/gi)]
    .map(match => new URL(match[1].replaceAll('&amp;', '&'), source))
    .filter(url => url.origin === new URL(source).origin &&
      url.pathname.startsWith('/fileadmin/user_upload/') && /stadionheft.*\.pdf$/i.test(url.pathname));
  const date = url => {
    const match = decodeURIComponent(url.pathname).match(/(\d{2})\.(\d{2})\.(\d{4})/);
    return match ? `${match[3]}${match[2]}${match[1]}` : '';
  };
  links.sort((a, b) => date(b).localeCompare(date(a)));
  if (!links.length) throw new Error('Kein Stadionheft auf der Vereinsseite gefunden');
  return links[0].href;
}

async function load(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(60000), cache: 'no-store' });
  if (!response.ok) throw new Error(`${response.status}: ${url}`);
  return response;
}

export async function updateMagazine() {
  const url = findMagazine(await (await load(source)).text());
  const pdf = Buffer.from(await (await load(url)).arrayBuffer());
  if (pdf.subarray(0, 5).toString() !== '%PDF-') throw new Error('Ungültiges Stadionheft');
  const configPath = resolve(root, 'src/config.js');
  const config = (await readFile(configPath, 'utf8')).replace(/magazineSource: '[^']*'/, `magazineSource: '${url}'`);
  // Keep the same-origin document path so PDF.js and offline caching keep working.
  const path = resolve(root, 'public/documents/stadionheft-2026-11-01.pdf');
  await writeFile(`${path}.tmp`, pdf);
  await rename(`${path}.tmp`, path);
  await writeFile(configPath, config);
  console.log(`Stadionheft aktualisiert: ${url} (${pdf.length} Bytes)`);
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename)) await updateMagazine();
