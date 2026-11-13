import { getDocument, GlobalWorkerOptions } from './vendor/pdfjs/pdf.mjs';
import { CLUB } from './config.js';
GlobalWorkerOptions.workerSrc = new URL('./vendor/pdfjs/pdf.worker.mjs', import.meta.url).href;

export async function mountMagazine(root) {
  let disposed = false;
  let document;
  let rendering = false;
  let activeRender;
  let resizeTimer;
  const nearby = new Set();
  const rendered = new Map();
  const rootElement = documentElement('div', 'magazine');
  const info = documentElement('div', 'magazine-info');
  const description = documentElement('p');
  const issue = decodeURIComponent(CLUB.magazineSource).match(/\d{2}\.\d{2}\.\d{4}/)?.[0];
  description.textContent = 'Stadionheft - ' + (issue || 'Aktuelle Ausgabe') + ' - Alle Seiten untereinander. Zum Lesen nach unten scrollen.';
  const download = documentElement('a'); download.href = CLUB.magazine; download.download = 'SVM-Stadionheft.pdf'; download.textContent = 'PDF herunterladen';
  const original = documentElement('a'); original.href = CLUB.magazineSource; original.target = '_blank'; original.rel = 'noopener noreferrer'; original.textContent = 'Original öffnen ↗';
  info.append(description, download, original);
  const progress = documentElement('div', 'magazine-progress'); progress.setAttribute('role', 'status'); progress.textContent = 'Stadionheft wird geladen …';
  const list = documentElement('div', 'pdf-list'); list.setAttribute('aria-label', 'Stadionheft, fortlaufende Seiten');
  rootElement.append(info, progress, list); root.replaceChildren(rootElement);
  const task = getDocument({
    url: new URL(CLUB.magazine, location.href).href,
    cMapUrl: new URL('./vendor/pdfjs/cmaps/', import.meta.url).href, cMapPacked: true,
    standardFontDataUrl: new URL('./vendor/pdfjs/standard_fonts/', import.meta.url).href,
    wasmUrl: new URL('./vendor/pdfjs/wasm/', import.meta.url).href,
    iccUrl: new URL('./vendor/pdfjs/iccs/', import.meta.url).href,
    // A full same-origin request can be cached reliably for offline reading.
    disableRange: true,
  });
  task.onProgress = ({ loaded, total }) => {
    if (!disposed && total) progress.textContent = `Stadionheft wird geladen … ${Math.min(100, Math.round(loaded / total * 100))} %`;
  };
  const observer = new IntersectionObserver(entries => {
    for (const entry of entries) {
      const page = Number(entry.target.dataset.page);
      if (entry.isIntersecting) nearby.add(page); else nearby.delete(page);
    }
    pump();
  }, { root: rootElement, rootMargin: '700px 0px' });
  const releaseObserver = new IntersectionObserver(entries => {
    for (const entry of entries) if (!entry.isIntersecting) release(Number(entry.target.dataset.page));
  }, { root: rootElement, rootMargin: '1800px 0px' });
  function release(number) {
    const canvas = rendered.get(number);
    if (canvas) { canvas.width = 0; canvas.height = 0; canvas.remove(); rendered.delete(number); }
    const element = list.children[number - 1];
    if (element) element.dataset.rendered = 'false';
  }
  async function pump() {
    if (disposed || rendering || !document) return;
    const number = [...nearby].find(page => !rendered.has(page));
    if (!number) return;
    rendering = true;
    let canvas;
    try {
      const page = await document.getPage(number);
      if (disposed || !nearby.has(number)) return;
      const element = list.children[number - 1];
      const normal = page.getViewport({ scale: 1 });
      element.style.setProperty('--page-ratio', `${normal.width} / ${normal.height}`);
      const width = Math.min(1600, element.clientWidth * Math.min(devicePixelRatio || 1, 2));
      const viewport = page.getViewport({ scale: width / normal.width });
      canvas = documentElement('canvas');
      canvas.width = Math.ceil(viewport.width); canvas.height = Math.ceil(viewport.height);
      canvas.setAttribute('aria-hidden', 'true');
      activeRender = page.render({ canvasContext: canvas.getContext('2d', { alpha: false }), viewport, background: '#fff' });
      await activeRender.promise;
      if (disposed || !nearby.has(number)) { canvas.width = 0; return; }
      element.prepend(canvas); element.dataset.rendered = 'true'; rendered.set(number, canvas);
      page.cleanup();
    } catch (error) {
      if (!disposed && error.name !== 'RenderingCancelledException') {
        const element = list.children[number - 1];
        if (element) { element.dataset.rendered = 'error'; element.querySelector('.page-label').textContent = `Seite ${number} konnte nicht geladen werden. Bitte oben neu laden.`; }
        nearby.delete(number);
      }
      if (canvas) canvas.width = 0;
    } finally { activeRender = null; rendering = false; if (!disposed) setTimeout(pump, 0); }
  }
  task.promise.then(async pdf => {
    if (disposed) return;
    document = pdf;
    const first = await pdf.getPage(1);
    if (disposed) return;
    const size = first.getViewport({ scale: 1 });
    const fragment = window.document.createDocumentFragment();
    for (let number = 1; number <= pdf.numPages; number++) {
      const page = documentElement('section', 'pdf-page');
      page.dataset.page = number; page.dataset.rendered = 'false';
      page.setAttribute('aria-label', `Stadionheft, Seite ${number} von ${pdf.numPages}`);
      page.style.setProperty('--page-ratio', `${size.width} / ${size.height}`);
      const label = documentElement('span', 'page-label'); label.textContent = `${number} / ${pdf.numPages}`; page.append(label); fragment.append(page);
    }
    list.append(fragment); progress.hidden = true;
    for (const page of list.children) { observer.observe(page); releaseObserver.observe(page); }
  }).catch(error => {

    if (!disposed) { progress.className = 'magazine-error'; progress.textContent = 'Das Stadionheft konnte nicht geladen werden. Bitte Internetverbindung prüfen und oben erneut laden. Alternativ „Original öffnen“ nutzen.'; console.warn('PDF:', error.message); }
  });
  const resize = new ResizeObserver(() => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => { if (disposed) return; for (const number of [...rendered.keys()]) release(number); pump(); }, 250);
  });
  resize.observe(list);
  return () => { disposed = true; clearTimeout(resizeTimer); observer.disconnect(); releaseObserver.disconnect(); resize.disconnect(); activeRender?.cancel(); for (const number of [...rendered.keys()]) release(number); task.destroy().catch(() => {}); };
}
function documentElement(tag, className) {
  const element = document.createElement(tag); if (className) element.className = className; return element;
}
