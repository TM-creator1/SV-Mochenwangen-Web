import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
const root = resolve(import.meta.dirname, '../dist');
const portArg = process.argv.find(arg => arg.startsWith('--port='));
const baseArg = process.argv.find(arg => arg.startsWith('--base='));
const hostArg = process.argv.find(arg => arg.startsWith('--host='));
const host = hostArg?.slice('--host='.length) || '127.0.0.1';
const port = Number(portArg?.split('=')[1] || 4173);
const base = baseArg?.split('=')[1] || '/';
if (!base.startsWith('/') || !base.endsWith('/')) throw new Error('Base must start and end with /');
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.pdf': 'application/pdf', '.wasm': 'application/wasm', '.bcmap': 'application/octet-stream' };
const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url, 'http://localhost');
    if (!url.pathname.startsWith(base)) { response.writeHead(404); response.end('Not found'); return; }
    const relative = decodeURIComponent(url.pathname.slice(base.length)) || 'index.html';
    const file = resolve(root, relative);
    if (!file.startsWith(root + sep)) { response.writeHead(403); response.end(); return; }
    if (!(await stat(file)).isFile()) throw new Error('Not a file');
    const data = await readFile(file);
    response.writeHead(200, { 'Content-Type': types[extname(file)] || 'application/octet-stream', 'Content-Length': data.length, 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff' });
    response.end(request.method === 'HEAD' ? undefined : data);
  } catch { response.writeHead(404); response.end('Not found'); }
});
server.listen(port, host, () => console.log(`PWA preview: http://${host}:${port}${base}`));
for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => server.close(() => process.exit(0)));
