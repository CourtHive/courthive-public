import { installApiMocks, gotoTournament } from '../helpers/routes';
import { buildPublishedTournament } from '../helpers/fixtures';
import { test, expect } from '@playwright/test';
import { sel } from '../helpers/selectors';

/**
 * An event's playing days. The factory publishes `eventInfo.playingDates` only for an event whose
 * own dates narrow the tournament's, so an event playing every day shows nothing. The fixture runs
 * Wednesday 1 July to Sunday 5 July 2026; the women's event plays the weekend only.
 */

const MENS = "Men's Singles";
const WOMENS = "Women's Singles";
const WEEKEND = 'Sat 4 · Sun 5';
const PLAYING_DAYS = '#eventPlayingDays';

function weekendWomens() {
  return buildPublishedTournament({
    eventNames: [MENS, WOMENS],
    mutateRecord: (tournamentRecord) => {
      const womens = tournamentRecord.events.find((event: any) => event.eventName === WOMENS);
      womens.weekdays = ['SAT', 'SUN'];
    },
  });
}

test.describe('event playing days', () => {
  test('the published payload carries playingDates only for the narrowed event', () => {
    const fixture = weekendWomens();
    const eventInfo = fixture.tournamentInfo.tournamentInfo.eventInfo;
    expect(eventInfo.find((event: any) => event.eventName === WOMENS).playingDates).toEqual([
      '2026-07-04',
      '2026-07-05',
    ]);
    expect(eventInfo.find((event: any) => event.eventName === MENS).playingDates).toBeUndefined();
  });

  test('the hero lists the narrowed event with its playing days', async ({ page }) => {
    const fixture = weekendWomens();
    await installApiMocks(page, fixture);
    await gotoTournament(page, fixture);

    const items = page.locator('.chp-hero__playing-days li');
    await expect(items).toHaveCount(1);
    await expect(items.first()).toHaveText(`${WOMENS}: ${WEEKEND}`);
  });

  test('the event tab header shows the playing days of the selected event only', async ({ page }) => {
    const fixture = weekendWomens();
    await installApiMocks(page, fixture);
    await gotoTournament(page, fixture, '/events');

    const eventButton = page.locator(sel.eventButton);
    await expect(eventButton).toContainText(MENS);
    await expect(page.locator(PLAYING_DAYS)).toBeHidden();

    await eventButton.click();
    await page.locator(`${sel.eventButton} .dropdown-item`, { hasText: WOMENS }).click();
    await expect(eventButton).toContainText(WOMENS);
    await expect(page.locator(PLAYING_DAYS)).toBeVisible();
    await expect(page.locator(PLAYING_DAYS)).toHaveText(`Plays: ${WEEKEND}`);
  });

  test('a tournament with no narrowed event shows no playing days anywhere', async ({ page }) => {
    const fixture = buildPublishedTournament({ eventNames: [MENS, WOMENS] });
    await installApiMocks(page, fixture);
    await gotoTournament(page, fixture, '/events');

    await expect(page.locator(sel.eventButton)).toContainText(MENS);
    await expect(page.locator('.chp-hero__playing-days')).toHaveCount(0);
    await expect(page.locator(PLAYING_DAYS)).toBeHidden();
  });
});
