import { installApiMocks, gotoTournament } from '../helpers/routes';
import { buildPublishedTournament } from '../helpers/fixtures';
import { test, expect, type Page } from '@playwright/test';

/**
 * Journey 29 — record data renders as text for every spectator.
 *
 * Everything this viewer shows comes from tournament records that a provider, an integrator or an
 * imported file wrote. A name holding `<img src=x onerror=…>` must render as that literal text, and
 * rich-text notes must be sanitized: otherwise one hostile record runs script for every anonymous
 * spectator who opens the tournament.
 *
 * Name fields carry a payload tagged by field (an element left in the DOM means it was parsed as
 * HTML). The two rich-text fields (tournament notes, registration-profile notes) carry an untagged
 * handler, because a sanitizer may keep the <img> but must drop its handler: there only execution
 * counts.
 */

const payload = (field: string) =>
  `<img src=x class="xss-${field}" onerror="globalThis.__xss=(globalThis.__xss||[]).concat('${field}')">`;
const richPayload = (field: string) =>
  `<p>${field}</p><img src=x onerror="globalThis.__xss=(globalThis.__xss||[]).concat('${field}')">` +
  `<svg><a href="javascript:globalThis.__xss=['${field}-svg-link']"><text>link</text></a></svg>`;

function hostileRecord(record: any): void {
  const set = (field: string, prefix: string) => `${prefix} ${payload(field)}`;
  record.tournamentName = set('tournamentName', 'T');
  record.promotionalName = set('promotionalName', 'PN');
  record.notes = richPayload('notes');
  for (const event of record.events ?? []) {
    event.eventName = set('eventName', 'E');
    for (const draw of event.drawDefinitions ?? []) {
      draw.drawName = set('drawName', 'D');
      for (const structure of draw.structures ?? []) structure.structureName = set('structureName', 'S');
    }
  }
  for (const venue of record.venues ?? []) {
    venue.venueName = set('venueName', 'V');
    venue.venueAbbreviation = set('venueAbbreviation', 'VA');
    for (const court of venue.courts ?? []) court.courtName = set('courtName', 'C');
  }
  for (const participant of record.participants ?? []) {
    participant.participantName = set('participantName', 'P');
    if (participant.person) {
      participant.person.standardGivenName = set('givenName', 'G');
      participant.person.standardFamilyName = set('familyName', 'F');
      participant.person.addresses = [{ city: set('city', 'City') }];
    }
  }
}

async function leaks(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const parsed = [...document.querySelectorAll('img[class^="xss-"]')].map((el) => el.className.slice(4));
    const ran: string[] = (globalThis as any).__xss ?? [];
    (globalThis as any).__xss = [];
    for (const el of document.querySelectorAll('img[class^="xss-"]')) el.remove();
    return [...new Set([...parsed, ...ran])].sort((a, b) => a.localeCompare(b));
  });
}

/**
 * The table views are not the draw view: the rounds table writes each score with a cell formatter and
 * groups rows under Tabulator group headers, and the statistics table groups participants by their
 * round robin group. Tabulator writes a header callback's returned string as HTML, so a group or
 * structure name there is a sink even though no file of ours assigns innerHTML for it.
 */
function hostileTables(record: any): void {
  for (const event of record.events ?? []) {
    for (const draw of event.drawDefinitions ?? []) {
      for (const structure of draw.structures ?? []) {
        for (const matchUp of structure.matchUps ?? []) hostileScore(matchUp);
        (structure.structures ?? []).forEach((group: any, i: number) => {
          const field = `groupName${i + 1}`;
          group.structureName = `Group ${i + 1} ${payload(field)}`;
          for (const matchUp of group.matchUps ?? []) hostileScore(matchUp);
        });
      }
    }
  }
}

function hostileScore(matchUp: any): void {
  if (matchUp.score?.scoreStringSide1) matchUp.score.scoreStringSide1 = `6-0 ${payload('score')}`;
}

test.describe('Journey 29 — stored XSS: record data renders as text', () => {
  test('no view parses a record name as HTML or runs a notes handler', async ({ page }) => {
    const fixture = buildPublishedTournament({ mutateRecord: hostileRecord, drawSize: 8 });
    // The mock's publish-state query omits the profile; CFS delivers it once published.
    // Logistics notes are the profile's rich-text fields.
    fixture.tournamentInfo.tournamentInfo.registrationProfile = {
      entriesOpen: '2026-06-01',
      accommodation: { notes: richPayload('accommodationNotes') },
      transportation: { notes: richPayload('transportationNotes') },
      // Structured links are not rich text: DOM assignment keeps the markup but not the scheme.
      entryUrl: "javascript:globalThis.__xss=['entryUrl']",
      sponsors: [{ name: 'Sponsor', websiteUrl: "javascript:globalThis.__xss=['sponsorUrl']" }],
    };
    await installApiMocks(page, fixture);

    const views: Record<string, string> = {
      info: '',
      events: '/events',
      event: `/event/${fixture.eventId}`,
      draw: `/event/${fixture.eventId}/draw/${fixture.drawId}`,
      structure: `/event/${fixture.eventId}/draw/${fixture.drawId}/structure/${fixture.structureId}`,
      schedule: '/schedule',
      participants: '/participants',
    };

    const found: Record<string, string[]> = {};
    for (const [view, subPath] of Object.entries(views)) {
      await gotoTournament(page, fixture, subPath);
      await page.waitForTimeout(1500);
      const leaked = await leaks(page);
      if (leaked.length) found[view] = leaked;
    }

    expect(found, 'views that parsed record data as HTML (view: fields)').toEqual({});
    // Guard the guard: the rich-text payloads must actually have rendered for their check to mean anything.
    await gotoTournament(page, fixture);
    await expect(page.locator('body')).toContainText('accommodationNotes');
    await expect(page.locator('body')).toContainText('transportationNotes');
    await expect(page.locator('body')).toContainText('notes');
    // A javascript: link needs a click, so it is checked by presence: none may survive sanitizing.
    const scriptLinks = await page.evaluate(
      () =>
        [...document.querySelectorAll('[href], [*|href]')].filter((el) =>
          /^\s*javascript:/i.test(el.getAttribute('href') ?? el.getAttribute('xlink:href') ?? ''),
        ).length,
    );
    expect(scriptLinks, 'javascript: links left in rendered notes or registration links').toBe(0);
    await expect(page.locator('body')).toContainText('Sponsor');
  });

  test('the rounds table and grouped statistics show scores and group names as text', async ({ page }) => {
    const fixture = buildPublishedTournament({
      drawType: 'ROUND_ROBIN_WITH_PLAYOFF',
      mutateRecord: hostileTables,
      eventNames: ['Tables'],
      drawSize: 16,
    });
    const [groups] = fixture.eventData[fixture.eventId].eventData.drawsData[0].structures;
    expect(groups.structureType).toBe('CONTAINER');
    await installApiMocks(page, fixture);
    await gotoTournament(page, fixture, '/events');

    const flight = page.locator('#flightDisplay');
    const groupHeader = '.tabulator-group';
    const pickView = async (label: string) => {
      await page.locator('#roundDisplayButton button').click();
      await page.locator('#roundDisplayButton .dropdown-item', { hasText: label }).click();
    };

    // Leaks are read first, so a parsed payload is reported by field rather than as a missing text guard.
    await pickView('Table view');
    await expect(flight.locator(groupHeader).first()).toBeVisible();
    await expect(flight.locator('.scoreCell').first()).toBeVisible();
    const tableLeaks = await leaks(page);
    // Guard the guard: the hostile values must reach both sinks as literal text.
    await expect.soft(flight.locator('.scoreCell', { hasText: 'class="xss-score"' }).first()).toBeVisible();
    await expect.soft(flight.locator(groupHeader, { hasText: 'class="xss-groupName1"' }).first()).toBeAttached();

    await pickView('Statistics');
    await expect(page.getByRole('columnheader', { name: 'Match W/L' })).toBeVisible();
    await expect(flight.locator(groupHeader).first()).toBeVisible();
    const statsLeaks = await leaks(page);
    await expect.soft(flight.locator(groupHeader, { hasText: 'class="xss-groupName2"' }).first()).toBeAttached();

    expect({ table: tableLeaks, stats: statsLeaks }, 'table views that parsed record data as HTML').toEqual({
      table: [],
      stats: [],
    });
  });
});
