import { CLUB, TEAMS, KINDS, resolvePage } from './config.js';
const $ = (id) => document.getElementById(id);
const menu = $('menu-dialog');
const screens = new Map();
let destination = 'home';
let homeTab = 'home';
let installPrompt;
let registration;
const paths = {
  home: '<path d="m3 10 9-7 9 7v11h-6v-7H9v7H3z"/>',
  magazine: '<path d="M4 3h16v18H4zM8 7h8M8 11h8M8 15h5"/>',
  standings: '<path d="M9 5h12M9 12h12M9 19h12M3 4h1v3M3 11h2l-2 3h2M3 18h2v3H3"/>',
  matches: '<path d="M4 5h16v16H4zM8 3v4M16 3v4M4 10h16"/>',
  youth: '<circle cx="12" cy="7" r="3"/><path d="M6 21v-3a6 6 0 0 1 12 0v3M4 9a3 3 0 0 0-1 6M20 9a3 3 0 0 1 1 6"/>',
};
function menuButton(id, title, icon) {
  const button = document.createElement('button');
  button.className = 'menu-row';
  button.dataset.page = id;
  button.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">${paths[icon]}</svg><span>${title}</span><span class="check" aria-hidden="true"></span>`;
  button.addEventListener('click', () => { menu.close(); navigate(id, true); });
  return button;
}
function group(title, buttons) {
  const section = document.createElement('section');
  section.className = 'menu-group';
  if (title) { const heading = document.createElement('h3'); heading.textContent = title; section.append(heading); }
  const list = document.createElement('div'); list.className = 'menu-group-list'; list.append(...buttons); section.append(list);
  return section;
}
$('club-menu').append(group('', [menuButton('home', 'Home', 'home'), menuButton('magazine', 'Stadionheft', 'magazine')]));
for (const team of TEAMS) $('club-menu').append(group(team.name, [
  menuButton(`${team.id}-standings`, 'Tabelle', 'standings'), menuButton(`${team.id}-matches`, 'Spiele', 'matches'),
]));
$('club-menu').append(group('Jugend', [menuButton('youth', 'JSG BMW', 'youth')]));
for (const [id, title] of [['home', 'Home'], ...TEAMS.map(team => [`${team.id}-ticker`, team.ticker])]) {
  const button = document.createElement('button'); button.textContent = title; button.dataset.tab = id;
  button.addEventListener('click', () => navigate(id)); $('home-tabs').append(button);
}
function navigate(id, fromMenu = false) {
  const page = resolvePage(id);
  if (fromMenu || (page.type !== 'widget' || page.kind !== 'ticker')) { destination = page.id; homeTab = 'home'; }
  if (page.type === 'widget' && page.kind === 'ticker') { destination = 'home'; homeTab = page.id; }
  const nextHash = `#${page.id}`;
  if (location.hash !== nextHash) { location.hash = page.id; } else { showPage(); }
}
function syncHash() {
  const page = resolvePage(location.hash.slice(1));
  if (page.type === 'widget' && page.kind === 'ticker') { destination = 'home'; homeTab = page.id; }
  else { destination = page.id; homeTab = 'home'; }
  showPage();
}
function showPage() {
  const id = destination === 'home' ? homeTab : destination;
  const page = resolvePage(id);
  $('page-title').textContent = destination === 'home' ? 'Home' : page.title;
  $('page-subtitle').hidden = !page.subtitle || destination === 'home';
  $('page-subtitle').textContent = page.subtitle || '';
  $('home-tabs').hidden = destination !== 'home';
  $('source-label').textContent = page.type === 'widget' ? 'FuPa · Saison 2026/27' : page.type === 'magazine' ? 'Ausgabe ' + (decodeURIComponent(CLUB.magazineSource).match(/\d{2}\.\d{2}\.\d{4}/)?.[0] || 'Aktuell') : page.id === 'youth' ? 'Jugend · JSG BMW' : 'Vereinswebsite';
  $('source-link').href = page.url;
  $('source-link').textContent = page.type === 'widget' ? 'Auf FuPa öffnen ↗' : 'Extern öffnen ↗';
  document.querySelectorAll('[data-tab]').forEach(button => {
    if (button.dataset.tab === homeTab) button.setAttribute('aria-current', 'page'); else button.removeAttribute('aria-current');
  });
  $('club-menu').querySelectorAll('[data-page]').forEach(button => {
    const selected = button.dataset.page === destination;
    button.querySelector('.check').textContent = selected ? '✓' : '';
    if (selected) button.setAttribute('aria-current', 'page'); else button.removeAttribute('aria-current');
  });
  for (const [key, screen] of screens) screen.root.hidden = key !== id;
  if (!screens.has(id)) screens.set(id, createScreen(page));
  screens.get(id).root.hidden = false;
  screens.get(id).visited = Date.now();
  // Limit background views on phones.
  if (screens.size > 4) {
    const oldest = [...screens.entries()].filter(([key]) => key !== id).sort((a, b) => a[1].visited - b[1].visited)[0];
    removeScreen(oldest[0]);
  }
  document.title = `${page.title}${page.subtitle ? ` · ${page.subtitle}` : ''} | ${CLUB.name}`;
}
function removeScreen(id) {
  const screen = screens.get(id); if (!screen) return;
  screen.dispose?.(); clearTimeout(screen.timeout); screen.root.remove(); screens.delete(id);
}
function createScreen(page) {
  const root = document.createElement('section'); root.className = 'screen'; root.dataset.screen = page.id; root.hidden = true;
  const screen = { root, url: page.url, visited: Date.now() };
  $('content').append(root);
  if (page.type === 'magazine') {
    root.innerHTML = '<div class="magazine-progress" role="status">Stadionheft wird geladen …</div>';
    import('./magazine.js').then(async ({ mountMagazine }) => {
      if (!root.isConnected) return;
      const dispose = await mountMagazine(root);
      if (!root.isConnected) dispose(); else screen.dispose = dispose;
    }).catch(() => { root.innerHTML = '<p class="magazine-error">Die PDF-Anzeige konnte nicht geladen werden. Bitte erneut laden oder die PDF über „Extern öffnen“ aufrufen.</p>'; });
    return screen;
  }
  if (page.type === 'external') {

    root.innerHTML = '<div class="external-page"><div class="external-card"><img src="./icons/club-emblem.png" alt=""><h2>Unsere Jugend. JSG BMW.</h2><p>Alle Mannschaften, Neuigkeiten und Termine der Jugendspielgemeinschaft Blitzenreute, Mochenwangen und Wolpertswende.</p><p>Die Jugendwebsite öffnet sich in einem eigenen Browserfenster, da sie die Anzeige innerhalb anderer Websites blockiert.</p><a class="primary-button" href="https://jsg-bmw.de/" target="_blank" rel="noopener noreferrer">JSG BMW öffnen ↗</a></div></div>';
    return screen;
  }
  const status = document.createElement('div'); status.className = 'frame-status'; status.setAttribute('role', 'status');
  status.dataset.state = 'loading'; status.textContent = page.type === 'widget' ? 'FuPa wird geladen …' : 'Vereinswebsite wird geladen …';
  const iframe = document.createElement('iframe'); iframe.title = page.type === 'widget' ? `${page.title} · ${page.subtitle}` : 'SV Mochenwangen Vereinswebsite';
  iframe.referrerPolicy = 'strict-origin-when-cross-origin';
  if (page.type === 'widget') {
    iframe.src = `./widget.html?team=${page.team.id}&kind=${page.kind}`;
    iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox');
  } else { iframe.src = page.url; iframe.allow = 'fullscreen'; }
  screen.iframe = iframe; screen.status = status;
  root.append(status, iframe);
  iframe.addEventListener('load', () => { if (page.type !== 'widget') { clearTimeout(screen.timeout); status.hidden = true; } });
  screen.timeout = setTimeout(() => {

    status.hidden = false; status.dataset.state = 'error';
    status.textContent = 'Der Inhalt konnte nicht bestätigt werden. Bitte erneut laden oder über „Extern öffnen“ direkt aufrufen.';
  }, 35000);
  return screen;
}
window.addEventListener('message', (event) => {
  if (event.origin !== location.origin || event.data?.type !== 'svm-widget') return;
  const screen = [...screens.values()].find(item => item.iframe?.contentWindow === event.source);
  if (!screen) return;
  clearTimeout(screen.timeout);

  screen.status.hidden = event.data.state === 'ready';
  screen.status.dataset.state = event.data.state;
  screen.status.textContent = event.data.state === 'activation'
    ? `FuPa hat diese Website (${location.host}) noch nicht für Widgets freigeschaltet. Die Mannschaft ist direkt auf FuPa erreichbar.`
    : event.data.state === 'offline' ? 'FuPa benötigt eine Internetverbindung.' : 'FuPa konnte nicht geladen werden. Bitte erneut laden oder „Auf FuPa öffnen“ nutzen.';
  if (event.data.state === 'activation') {
    const link = document.createElement('a');
    link.href = screen.url;
    link.textContent = 'Auf FuPa öffnen';
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    screen.status.append(' ', link);
  }
});
$('open-menu').addEventListener('click', () => menu.showModal());
$('close-menu').addEventListener('click', () => menu.close());
for (const dialog of [menu, $('install-dialog')]) dialog.addEventListener('click', (event) => { if (event.target === dialog) { const bounds = dialog.getBoundingClientRect(); if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) dialog.close(); } });
$('reload').addEventListener('click', () => { const id = destination === 'home' ? homeTab : destination; removeScreen(id); showPage(); });
function networkStatus() { $('offline-notice').hidden = navigator.onLine; }
window.addEventListener('online', networkStatus); window.addEventListener('offline', networkStatus); networkStatus();
window.addEventListener('hashchange', syncHash);
window.addEventListener('beforeinstallprompt', event => { event.preventDefault(); installPrompt = event; });
window.addEventListener('appinstalled', () => { installPrompt = null; $('install-dialog').close(); });
$('install-app').addEventListener('click', () => {
  menu.close();
  const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  $('install-instructions').textContent = standalone ? 'Die App ist bereits als eigenständige Web-App geöffnet.'
    : ios ? 'Öffne diese Seite in Safari. Tippe auf „Teilen“ und dann auf „Zum Home-Bildschirm“. Bestätige mit „Hinzufügen“.'
    : installPrompt ? 'Installiere die Vereins-App auf deinem Startbildschirm. Sie öffnet sich anschließend ohne Browserleiste.'
    : 'Öffne im Browsermenü „App installieren“ oder „Zum Startbildschirm hinzufügen“. Falls die Option fehlt, nutze Chrome auf Android oder Safari auf dem iPhone. Die veröffentlichte App benötigt HTTPS.';
  $('native-install').hidden = !installPrompt || standalone;
  $('install-dialog').showModal();
});
$('native-install').addEventListener('click', async () => { if (!installPrompt) return; await installPrompt.prompt(); await installPrompt.userChoice; installPrompt = null; $('install-dialog').close(); });
$('close-install').addEventListener('click', () => $('install-dialog').close());
if ('serviceWorker' in navigator && window.isSecureContext) {
  const wasControlled = Boolean(navigator.serviceWorker.controller);
  navigator.serviceWorker.register('./sw.js', { scope: './' }).then(result => {
    registration = result;
    const showUpdate = () => { if (registration.waiting && navigator.serviceWorker.controller) $('update-notice').hidden = false; };
    showUpdate();
    registration.addEventListener('updatefound', () => { const worker = registration.installing; worker?.addEventListener('statechange', showUpdate); });
  }).catch(error => console.warn('Offline-Unterstützung nicht verfügbar:', error.message));
  let refreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    // Initial activation can claim the page without interrupting a running PDF
    // download. Reload only when replacing an existing app version.
    if (wasControlled && !refreshing) { refreshing = true; location.reload(); }
  });
}
$('apply-update').addEventListener('click', () => registration?.waiting?.postMessage({ type: 'SKIP_WAITING' }));
syncHash();

function startLauncher() {
  const launcher = document.createElement('div');
  launcher.id = 'launcher';
  launcher.innerHTML = '<img src="./icons/club-emblem.png" width="128" height="128" alt=""><h1>SV Mochenwangen</h1><span class="launcher-spinner" role="status" aria-label="App startet"></span>';
  document.body.append(launcher);
  const app = document.querySelector('.app');
  app.inert = true;
  setTimeout(() => { launcher.remove(); app.inert = false; }, 2000);
}
startLauncher();
