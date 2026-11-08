import { TEAMS, KINDS } from './config.js';
const params = new URLSearchParams(location.search);
const team = TEAMS.find(item => item.id === params.get('team'));
const kind = KINDS[params.get('kind')];
const status = document.getElementById('widget-state');
let timeout;
let observer;
let finished = false;
function notify(state) {
  if (finished) return;
  finished = true;
  clearTimeout(timeout);
  observer?.disconnect();
  document.documentElement.dataset.state = state;
  window.fupaLoadState = state;
  status.hidden = state === 'ready';
  status.textContent = state === 'activation' ? `FuPa hat diese Website (${location.host}) noch nicht für Widgets freigeschaltet. Spiele, Tabelle und Liveticker kannst du direkt auf FuPa ansehen.`
    : state === 'offline' ? 'FuPa benötigt eine Internetverbindung. Bitte später erneut laden.'
    : 'FuPa konnte nicht geladen werden. Bitte die Mannschaft direkt auf FuPa öffnen.';
  if (state === 'activation') {
    // Keep the provider response intact, but replace its technical message for visitors.
    document.getElementById('widget-content')?.setAttribute('hidden', '');
    const admin = document.createElement('a');
    admin.href = 'https://www.fupa.net/fupa/admin';
    admin.textContent = ' FuPa-Vereinsverwaltung öffnen ↗';
    admin.target = '_blank';
    admin.rel = 'noopener noreferrer';
    status.append(admin);
  }
  parent.postMessage({ type: 'svm-widget', state }, location.origin);
}
if (!team || !kind) { notify('error'); }
else {
  const widget = document.createElement('div');
  widget.className = 'fupa_widget';
  widget.dataset.widget = JSON.stringify({ type: 'team_widget', type_values: [kind.value], value: team.fupaId, selected_tab: 1 });
  const content = document.createElement('div'); content.id = 'widget-content'; widget.append(content);
  for (const [href, text, className] of [[`https://www.fupa.net/team/${team.slug}`, 'Auf FuPa öffnen', 'widget_link'], ['https://www.fupa.net/widget.html', '© FuPa-Widget', 'widget_copy']]) {
    const link = document.createElement('a'); link.href = href; link.textContent = text; link.className = className; link.target = '_blank'; link.rel = 'noopener noreferrer'; widget.append(link);
  }
  document.getElementById('widget-host').append(widget);
  const updateLinks = () => content.querySelectorAll('a').forEach(link => { link.target = '_blank'; link.rel = 'noopener noreferrer'; });
  observer = new MutationObserver(() => {
    updateLinks();
    const text = content.textContent;
    if (/Website nicht aktiviert|muss erst.*Vereinsverwaltung|Domain.*eingetragen werden/i.test(text)) notify('activation');
    else if (content.querySelector('[class^="widget_team_widget_"], [class*="widget_team_widget_"], .widget_team_widget')) notify('ready');
  });
  observer.observe(content, { childList: true, subtree: true });
  timeout = setTimeout(() => notify(navigator.onLine ? 'error' : 'offline'), 30000);
  if (!navigator.onLine) notify('offline');
  else {
    // Classic script embed, like iOS: no fetch(), module type or crossorigin.
    // FuPa then requests widget HTML using document.location.host for activation.
    const script = document.createElement('script'); script.src = 'https://www.fupa.net/fupa/widget/fupa_widget.js';
    script.addEventListener('error', () => notify('error')); document.head.append(script);
  }
  // Keep future dynamically inserted widget links out of the sandboxed frame.
  document.addEventListener('click', event => { const link = event.target.closest('a'); if (link) { link.target = '_blank'; link.rel = 'noopener noreferrer'; } }, true);
}
