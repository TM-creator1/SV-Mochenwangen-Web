export const CLUB = {
  name: 'SV Mochenwangen', color: '#db0f0f',
  home: 'https://sv-mochenwangen.de/', youth: 'https://jsg-bmw.de/',
  magazine: './documents/stadionheft-2026-11-01.pdf',
  magazineSource: 'https://sv-mochenwangen.de/fileadmin/user_upload/flado/SVM_Stadionheft_01.11.2026_klein.pdf',
};
export const TEAMS = [
  { id: 'first', name: '1. Mannschaft', ticker: '1. Liveticker', fupaId: '1465070', slug: 'sv-mochenwangen-m1-2026-27' },
  { id: 'second', name: '2. Mannschaft', ticker: '2. Liveticker', fupaId: '1465016', slug: 'sg-blitzenreute-mochenwangen-m1-2026-27' },
  { id: 'reserve', name: '2. Reserve', ticker: 'Reserve Liveticker', fupaId: '1465112', slug: 'sg-blitzenreute-mochenwangen-m2-2026-27' },
];
export const KINDS = {
  ticker: { title: 'Liveticker', value: 'liveticker' },
  standings: { title: 'Tabelle', value: 'tabelle' },
  matches: { title: 'Spiele', value: 'spielplan' },
};
export function resolvePage(id) {
  if (id === 'magazine') return { id, title: 'Stadionheft', url: CLUB.magazineSource, type: 'magazine' };
  if (id === 'youth') return { id, title: 'Jugend', subtitle: 'JSG BMW', url: CLUB.youth, type: 'external' };
  for (const team of TEAMS) for (const [kind, data] of Object.entries(KINDS)) {
    if (id === `${team.id}-${kind}`) return {
      id, team, kind, title: data.title, subtitle: team.name,
      url: `https://www.fupa.net/team/${team.slug}`, type: 'widget',
    };
  }
  return { id: 'home', title: 'Home', url: CLUB.home, type: 'website' };
}