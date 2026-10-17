import { installApiMocks, gotoTournament } from '../helpers/routes';
import { buildPublishedTournament } from '../helpers/fixtures';
import { test, expect } from '@playwright/test';
import { sel } from '../helpers/selectors';

/**
 * Statistics follow the structure, not the visitor's last choice.
 *
 * The chosen view is kept across structure switches. Statistics are offered only for round robin and ad hoc
 * structures, because only those are tallied, but a visitor who opened Statistics on the round robin groups and then
 * picked the playoff was shown a stats table for an elimination structure. The factory no longer tallies elimination
 * structures, so that table would be all zeroes. The playoff renders its draw instead, and returning to the groups
 * brings Statistics back.
 */
test('statistics on round robin groups give way to the draw on their playoff, and come back', async ({ page }) => {
  const fixture = buildPublishedTournament({ drawType: 'ROUND_ROBIN_WITH_PLAYOFF', drawSize: 16 });
  const [groups, playoff] = fixture.eventData[fixture.eventId].eventData.drawsData[0].structures;
  expect(groups.structureType).toBe('CONTAINER');
  expect(playoff.structureType).not.toBe('CONTAINER');

  await installApiMocks(page, fixture);
  await gotoTournament(page, fixture, '/events');

  const flight = page.locator(sel.flightDisplay);
  const statsTable = page.getByRole('columnheader', { name: 'Match W/L' });
  const pickStructure = async (structureName: string) => {
    await page.locator('#structureButton button').click();
    await page.locator('#structureButton .dropdown-item', { hasText: structureName }).click();
  };

  await page.locator('#roundDisplayButton button').click();
  await page.locator('#roundDisplayButton .dropdown-item', { hasText: 'Statistics' }).click();
  await expect(statsTable).toBeVisible();

  await pickStructure(playoff.structureName);
  await expect(flight.locator('.chc-round-container').first()).toBeVisible();
  await expect(statsTable).toHaveCount(0);

  await pickStructure(groups.structureName);
  await expect(statsTable).toBeVisible();
});
