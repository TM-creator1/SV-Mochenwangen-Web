import { test, expect } from '@playwright/test';
import { TEAMS, KINDS } from '../../src/config.js';

test.beforeEach(async ({ context, baseURL }) => {
  // Only the local preview may reach the network. Providers are simulated.
  await context.route('**/*', route => {
    const url = new URL(route.request().url());
    if (url.origin === new URL(baseURL).origin) return route.continue();
    if (url.origin === 'https://sv-mochenwangen.de') return route.fulfill({ contentType: 'text/html', body: '<h1>Vereinswebsite</h1>' });
    return route.abort();
  });
});

test('navigation, browser history, installation instructions and provider errors', async ({ page }) => {
  await page.goto('./');
  await expect(page.locator('#page-title')).toHaveText('Home');
  await page.getByRole('button', { name: '1. Liveticker', exact: true }).click();
  await expect(page).toHaveURL(/#first-ticker$/);
  await expect(page.locator('[data-screen="first-ticker"] .frame-status')).toHaveAttribute('data-state', 'error');
  await page.locator('#open-menu').click();
  await page.locator('[data-page="second-standings"]').click();
  await expect(page.locator('#page-title')).toHaveText('Tabelle');
  await expect(page.locator('#page-subtitle')).toHaveText('2. Mannschaft');
  await expect(page.locator('#home-tabs')).toBeHidden();
  await page.goBack();
  await expect(page.locator('#home-tabs')).toBeVisible();
  await page.locator('#open-menu').click();
  await page.locator('[data-page="youth"]').click();
  await expect(page.getByRole('link', { name: /JSG BMW öffnen/ })).toHaveAttribute('href', 'https://jsg-bmw.de/');
  await page.locator('#open-menu').click();
  await page.locator('#install-app').click();
  await expect(page.locator('#install-dialog')).toBeVisible();
  await expect(page.locator('#install-instructions')).not.toBeEmpty();
  await page.locator('#close-install').click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('loaded magazine can be left through the menu and revisited with browser history', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('./#magazine');
  const magazine = page.locator('[data-screen="magazine"]');
  await expect(magazine.locator('.pdf-page canvas').first()).toBeVisible();
  await page.locator('#open-menu').click();
  await page.locator('[data-page="youth"]').click();
  await expect(page).toHaveURL(/#youth$/);
  await expect(magazine).toBeHidden();
  await expect(page.locator('[data-screen="youth"]')).toBeVisible();
  await expect(page.locator('.screen:visible')).toHaveCount(1);
  await page.goBack();
  await expect(magazine).toBeVisible();
  await expect(magazine.locator('.pdf-page canvas').first()).toBeVisible();
  await page.locator('#open-menu').click();
  await page.locator('[data-page="first-standings"]').click();
  await expect(magazine).toBeHidden();
  await expect(page.locator('[data-screen="first-standings"]')).toBeVisible();
  await page.locator('#open-menu').click();
  await page.locator('[data-page="home"]').click();
  await expect(page.locator('[data-screen="home"]')).toBeVisible();
  await page.getByRole('button', { name: '1. Liveticker', exact: true }).click();
  await expect(page.locator('[data-screen="first-ticker"]')).toBeVisible();
  await expect(page.locator('.screen:visible')).toHaveCount(1);
  expect(errors).toEqual([]);
});

test.describe('offline support', () => {
test.use({ serviceWorkers: 'allow' });
test('stadium magazine renders, scrolls and remains available offline', async ({ page, context }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('./#magazine');
  await expect(page.locator('.pdf-page').first().locator('canvas')).toBeVisible();
  const count = await page.locator('.pdf-page').count();
  expect(count).toBeGreaterThan(1);
  await page.locator('.pdf-page').last().scrollIntoViewIfNeeded();
  await expect(page.locator('.pdf-page').last().locator('canvas')).toBeVisible();
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller) await new Promise(resolve => navigator.serviceWorker.addEventListener('controllerchange', resolve, { once: true }));
    const pdf = new URL('./documents/stadionheft-2026-11-01.pdf', location.href);
    await fetch(pdf);
    // Fetch completion can precede the worker's cache write.
    for (let i = 0; i < 100; i++) {
      if (await caches.match(pdf)) return;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    throw new Error('Magazine was not cached');
  });
  await context.setOffline(true);
  await page.reload();
  await expect(page.locator('#offline-notice')).toBeVisible();
  await expect(page.locator('.pdf-page').first().locator('canvas')).toBeVisible();
  const offlinePwa = await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.ready;
    const manifest = await (await fetch('./manifest.webmanifest')).json();
    const icons = await Promise.all(manifest.icons.map(async icon => {
      const response = await fetch(icon.src);
      return { ok: response.ok, type: response.headers.get('content-type') };
    }));
    return { scope: new URL(registration.scope).pathname, script: new URL(registration.active.scriptURL).pathname, start: manifest.start_url, icons };
  });
  expect(offlinePwa.scope).toBe('/SV-Mochenwangen-Web/');
  expect(offlinePwa.script).toBe('/SV-Mochenwangen-Web/sw.js');
  expect(offlinePwa.start).toBe('/SV-Mochenwangen-Web/');
  expect(offlinePwa.icons.every(icon => icon.ok && icon.type === 'image/png')).toBe(true);
  expect(errors).toEqual([]);
});
});

test('FuPa activation and successful loading are reported to the app', async ({ page, context, baseURL }) => {
  await context.route(/^https:\/\/(?:www\.fupa\.net\/fupa\/widget\/fupa_widget\.js|widget-api\.fupa\.net\/vendor\/widget\.js\?v1)$/, route => route.fulfill({
    contentType: 'text/javascript',
    body: "document.getElementById('widget-content').textContent = 'Website nicht aktiviert';",
  }));
  await page.goto('./#first-matches');
  await expect(page.locator('[data-screen="first-matches"] .frame-status')).toHaveAttribute('data-state', 'activation');
  await expect(page.locator('[data-screen="first-matches"] .frame-status')).toContainText(new URL(baseURL).host);
  const widget = page.frameLocator('[data-screen="first-matches"] iframe');
  await expect(widget.getByRole('link', { name: 'FuPa-Vereinsverwaltung öffnen ↗' })).toHaveAttribute('href', 'https://www.fupa.net/fupa/admin');
  await expect(widget.locator('script[src="https://widget-api.fupa.net/vendor/widget.js?v1"]')).toHaveCount(1);
  expect(await widget.locator('script[src="https://widget-api.fupa.net/vendor/widget.js?v1"]').getAttribute('crossorigin')).toBeNull();
  await context.route(/^https:\/\/(?:www\.fupa\.net\/fupa\/widget\/fupa_widget\.js|widget-api\.fupa\.net\/vendor\/widget\.js\?v1)$/, route => route.fulfill({
    contentType: 'text/javascript',
    body: "document.querySelector('[id^=\"fp-widget_root-\"]').innerHTML = '<div>Spielplan</div>';",
  }));
  await page.locator('#reload').click();
  await expect(page.locator('[data-screen="first-matches"] .frame-status')).toBeHidden();
  await expect(page.frameLocator('[data-screen="first-matches"] iframe').getByText('Spielplan', { exact: true })).toBeVisible();
});

test('FuPa activation offers the correct external team for all nine destinations', async ({ page, context }) => {
  await context.route(/^https:\/\/(?:www\.fupa\.net\/fupa\/widget\/fupa_widget\.js|widget-api\.fupa\.net\/vendor\/widget\.js\?v1)$/, route => route.fulfill({
    contentType: 'text/javascript',
    body: "document.getElementById('widget-content').innerHTML = '<div>Website nicht aktiviert. Die Domain muss erst in der FuPa Vereinsverwaltung eingetragen werden.</div>';",
  }));
  await context.route('https://www.fupa.net/team/**', route => route.fulfill({ contentType: 'text/html', body: '<h1>FuPa-Mannschaft</h1>' }));
  for (const team of TEAMS) for (const kind of Object.keys(KINDS)) {
    const id = `${team.id}-${kind}`;
    await page.goto(`./#${id}`);
    const status = page.locator(`[data-screen="${id}"] .frame-status`);
    await expect(status).toHaveAttribute('data-state', 'activation');
    await expect(status).toContainText('noch nicht für Widgets freigeschaltet');
    const link = status.getByRole('link', { name: 'Auf FuPa öffnen', exact: true });
    const url = `https://www.fupa.net/team/${team.slug}`;
    await expect(link).toHaveAttribute('href', url);
    await expect(link).toHaveAttribute('target', '_blank');
    await expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    const widget = page.frameLocator(`[data-screen="${id}"] iframe`);
    await expect(widget.getByRole('link', { name: 'Auf FuPa öffnen', exact: true })).toHaveAttribute('href', url);
    await expect(widget.locator('#widget-content')).toBeHidden();
  }
  const popupPromise = page.waitForEvent('popup');
  await page.locator('[data-screen="reserve-matches"] .frame-status').getByRole('link', { name: 'Auf FuPa öffnen', exact: true }).click();
  const popup = await popupPromise;
  await expect(popup).toHaveURL(`https://www.fupa.net/team/${TEAMS[2].slug}`);
  await expect(popup.getByRole('heading')).toHaveText('FuPa-Mannschaft');
  await popup.close();
});
