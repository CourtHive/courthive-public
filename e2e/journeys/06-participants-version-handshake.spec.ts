import { installApiMocks, gotoTournament } from '../helpers/routes';
import { buildPublishedTournament } from '../helpers/fixtures';
import { sel } from '../helpers/selectors';
import { test, expect } from '@playwright/test';

/**
 * The payload-decomposition handshake, end to end through the real browser.
 *
 * The unit specs prove the API layer in isolation. This proves the thing that actually matters: that
 * `renderEvent` still hydrates every bracket side when the server omits participants, because it
 * hydrates from the top-level participant list and a missing one renders every side as TBD. That
 * failure is silent — it type-checks, lints and unit-tests clean — so it needs a rendering assertion
 * on a seeded, non-empty value.
 */

const MENS = "Men's Singles";
const WOMENS = "Women's Singles";
const VERSION = 'p1-e2e-handshake';

test.describe('tournament — participantsVersion handshake', () => {
  test('the second event omits participants over the wire and still renders its draw', async ({ page }) => {
    const fixture = buildPublishedTournament({ eventNames: [MENS, WOMENS] });
    const womens = fixture.events.find((e) => e.eventName === WOMENS);
    await installApiMocks(page, fixture, { participantsVersion: VERSION });

    // Control: the fixture must be non-degenerate, or "the draw rendered" proves nothing.
    const seededParticipants = fixture.eventData[fixture.eventId]?.participants ?? [];
    expect(seededParticipants.length).toBeGreaterThan(1);
    const competitorName = seededParticipants.find((p: any) => p.participantName)?.participantName;
    expect(competitorName).toBeTruthy();

    await gotoTournament(page, fixture, '/events');
    await expect(page.locator(sel.eventButton)).toContainText(MENS);
    // The first fetch holds nothing, so it must carry the full set — the cold half of the handshake.
    await expect(page.locator(sel.flightDisplay)).toContainText(competitorName);

    const womensResponse = page.waitForResponse(
      (res) => res.url().includes('/factory/eventdata') && res.request().postDataJSON()?.eventId === womens.eventId,
    );
    await page.locator(sel.eventButton).click();
    await page.locator(`${sel.eventButton} .dropdown-item`, { hasText: WOMENS }).click();
    const response = await womensResponse;

    // The client proved what it holds...
    expect(response.request().postDataJSON()?.participantsVersion).toEqual(VERSION);
    // ...the server really did omit the participants...
    const payload = await response.json();
    expect(payload.participants).toBeUndefined();
    expect(payload.participantsVersion).toEqual(VERSION);

    // ...and the draw still renders real competitors rather than a bracket of TBD.
    await expect(page.locator(sel.eventButton)).toContainText(WOMENS);
    const flight = page.locator(sel.flightDisplay);
    await expect(flight.locator('*')).not.toHaveCount(0);
    await expect(flight).not.toContainText('TBD');
  });
});
