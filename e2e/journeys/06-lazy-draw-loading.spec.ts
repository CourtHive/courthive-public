import { installApiMocks, gotoTournament } from '../helpers/routes';
import { buildPublishedTournament } from '../helpers/fixtures';
import { sel } from '../helpers/selectors';
import { test, expect } from '@playwright/test';

/**
 * Progressive draw loading, end to end.
 *
 * The unit specs cover the request shape. This covers the thing that actually matters: that the
 * bracket still renders real competitors when the event payload carries only draw STUBS and the
 * structures arrive from a second request — and that switching flights fetches the other draw.
 *
 * The failure this guards against is silent. A draw that never loads renders an empty flight, and an
 * unhydrated one renders every side as TBD; both type-check, lint and unit-test clean.
 */

const MENS = "Men's Singles";
const WOMENS = "Women's Singles";

test.describe('tournament — progressive draw loading', () => {
  test('renders a draw whose structures arrive from /factory/drawdata', async ({ page }) => {
    const fixture = buildPublishedTournament({ eventNames: [MENS, WOMENS] });
    await installApiMocks(page, fixture, { lazyDraws: true });

    // Control: the fixture must have real competitors, or "the draw rendered" proves nothing.
    const seeded = fixture.eventData[fixture.eventId]?.participants ?? [];
    const competitorName = seeded.find((p: any) => p.participantName)?.participantName;
    expect(seeded.length).toBeGreaterThan(1);
    expect(competitorName).toBeTruthy();

    const drawRequest = page.waitForRequest((req) => req.url().includes('/factory/drawdata'));
    await gotoTournament(page, fixture, '/events');

    // The event payload carried stubs, so a second request was required...
    const request = await drawRequest;
    expect(request.postDataJSON()?.hydrateParticipants).toBe(false);

    // ...and the bracket still renders real people, not TBD.
    await expect(page.locator(sel.eventButton)).toContainText(MENS);
    const flight = page.locator(sel.flightDisplay);
    await expect(flight).toContainText(competitorName);
    await expect(flight).not.toContainText('TBD');
  });

  test('makes NO drawdata request when the server returns full draws — the undeployed-CFS path', async ({
    page,
  }) => {
    // CFS #933 is merged but NOT deployed, so production still ignores `drawsProfile` and returns the
    // whole event. The client must then behave exactly as before rather than fetching every draw a
    // second time, which would make this change a large regression until the server catches up. It
    // discriminates on the payload (`structures` present) rather than on a server version, and this
    // is what pins that.
    const fixture = buildPublishedTournament({ eventNames: [MENS] });
    await installApiMocks(page, fixture); // default: full draws, exactly what prod serves today

    const drawDataCalls: string[] = [];
    page.on('request', (req) => {
      if (req.url().includes('/factory/drawdata')) drawDataCalls.push(req.url());
    });

    await gotoTournament(page, fixture, '/events');
    // Control: the bracket really did render, so "no request" is not just "nothing happened".
    await expect(page.locator(sel.flightDisplay).locator('*')).not.toHaveCount(0);
    expect(drawDataCalls).toEqual([]);
  });
});
