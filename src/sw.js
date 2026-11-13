const BUILD = '__BUILD_ID__';
const PREFIX = `svm-pwa-${encodeURIComponent(self.registration.scope)}-`;
const CACHE = PREFIX + BUILD;
const SHELL = __SHELL_FILES__;
const absolute = path => new URL(path, self.registration.scope).href;
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL.map(absolute))));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith(PREFIX) && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('message', event => { if (event.data?.type === 'SKIP_WAITING') self.skipWaiting(); });
self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  const scope = new URL(self.registration.scope);
  // Never cache external live feeds or intercept another site's files on this Pages origin.
  if (request.method !== 'GET' || url.origin !== scope.origin || !url.pathname.startsWith(scope.pathname) || request.headers.has('range')) return;
  const canonical = new URL(url); canonical.search = ''; canonical.hash = '';
  const relative = canonical.pathname.slice(scope.pathname.length);
  const isDocument = relative.startsWith('documents/') && relative.endsWith('.pdf');
  // Keep the cache write alive without delaying the response stream.
  let finishCacheWrite;
  let backgroundWrite = false;
  const cacheWrite = new Promise(resolve => { finishCacheWrite = resolve; });
  event.waitUntil(cacheWrite);
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    if (request.mode === 'navigate') {
      try {
        const response = await fetch(request);
        if (response.ok && (relative === '' || relative === 'index.html' || relative === 'widget.html')) await cache.put(canonical.href, response.clone());
        return response;
      } catch {
        return (await cache.match(canonical.href)) || (await cache.match(absolute('./index.html'))) || Response.error();
      }
    }
    const cached = await cache.match(canonical.href);
    if (cached) return cached;
    const response = await fetch(request);
    if (response.ok && (isDocument || relative.startsWith('vendor/') || SHELL.some(path => absolute(path) === canonical.href))) {
      // Do not make cache quota/storage restrictions prevent online reading.
      backgroundWrite = true;
      const copy = response.clone();
      cache.put(canonical.href, copy).catch(() => {}).finally(finishCacheWrite);
      return response;
    }
    return response;
  })().finally(() => {
    // For cache hits, navigations and failures there is no background write.
    if (!backgroundWrite) finishCacheWrite();
  }));
});