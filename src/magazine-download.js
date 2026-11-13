// Report received response bytes, never an estimated loading timer.
export async function downloadMagazine(url, { signal, onProgress = () => {} } = {}) {
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error('PDF HTTP ' + response.status);
  // Content-Length describes compressed transfer bytes when encoding is present.
  const encoding = response.headers.get('content-encoding');
  const size = Number(response.headers.get('content-length'));
  const total = (!encoding || encoding === 'identity') && Number.isFinite(size) && size > 0 ? size : 0;
  let loaded = 0;
  onProgress({ loaded, total, done: false });
  if (!response.body) {
    const data = new Uint8Array(await response.arrayBuffer());
    onProgress({ loaded: data.length, total: data.length, done: true });
    return data;
  }
  const reader = response.body.getReader();
  const chunks = [];
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value); loaded += value.length;
      onProgress({ loaded, total: total >= loaded ? total : 0, done: false });
    }
  } catch (error) {
    await reader.cancel().catch(() => {});
    throw error;
  } finally { reader.releaseLock(); }
  const data = new Uint8Array(loaded);
  let offset = 0;
  for (const chunk of chunks) { data.set(chunk, offset); offset += chunk.length; }
  onProgress({ loaded, total: loaded, done: true });
  return data;
}
