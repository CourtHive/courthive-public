// NOTE: the e2e dev server runs at base '/', so these DO NOT exercise the deployed '/pub/' prefix —
// the path bug fixed on 2026-08-13 (root-absolute data URL 404ing under /pub/) would pass here.
// Conference data URLs are resolved against document.baseURI precisely so the prefix case works;
// verify that against a prefixed server or the deployed URL, not this spec.
import { expect, test } from '@playwright/test';

test('conference page loads its document and renders the fingerprint', async ({ page }) => {
  const failed: string[] = [];
  page.on('response', (r) => { if (r.url().includes('/data/conferences/') && !r.ok()) failed.push(`${r.status()} ${r.url()}`); });
  await page.goto('/#/conference/big-12-conference');
  await expect(page.locator('.chp-conf-root h1')).toHaveText('Big 12 Conference', { timeout: 15000 });
  await expect(page.locator('.chp-conf-message')).toHaveCount(0);
  await expect(page.locator('.chp-band-bar').first()).toBeVisible();
  await expect(page.locator('.chp-member-row').first()).toBeVisible();
  expect(failed, `failed data requests: ${failed.join(', ')}`).toEqual([]);
});

test('conference directory lists conferences', async ({ page }) => {
  await page.goto('/#/conferences');
  await expect(page.locator('.chp-conf-card').first()).toBeVisible({ timeout: 15000 });
});
