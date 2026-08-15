import { buildVenueCard, mapVenueToCardData, resolveCourtSport, sportFromMatchUpFormat } from 'courthive-components';
import type { CourtSport } from 'courthive-components';
import './renderVenues.css';

const WEBSITE_NAME = 'venueWebsite';

/**
 * `buildVenueCard` fills its image zone in order: a `venueImage` onlineResource,
 * then an OpenStreetMap preview when the venue's address carries coordinates,
 * then a court SVG, then a striped placeholder.
 *
 * The court SVG only fires when a sport is supplied, and courthive-public was
 * calling `mapVenueToCardData(venue)` with no options — so venues with neither
 * an image nor coordinates fell all the way through to the placeholder, which
 * is 137px of diagonal stripes above 61px of content.
 *
 * A production sweep found this is the common case rather than an edge case:
 * of the seven distinct venues measurable across provider calendars, **none**
 * carried a `venueImage` and three carried no coordinates either.
 */
const DEFAULT_COURT_SPORT: CourtSport = 'tennis';

/**
 * Resolve a sport for the court-SVG fallback.
 *
 * Two passes, so a **declared** format always beats a **surveyed** one:
 *
 * 1. `resolveCourtSport` — the event's own `competitionFormat.sport`, else its
 *    own `matchUpFormat`.
 * 2. `eventInfo.matchUpFormats` — every distinct code declared on the event,
 *    its drawDefinitions, or their structures.
 *
 * The second pass must not outrank the first. `matchUpFormats` is a survey, not
 * a resolution: the factory collects codes from wherever they sit without
 * implying precedence, because the effective-format hierarchy runs
 * `matchUp > structure > drawDefinition > event` — specificity flows downward.
 * So a code found somewhere inside the event never overrides one the event
 * declares for itself.
 *
 * In practice the survey is what fires. A live tournament declared no format on
 * its event and `SET3-S:6/TB7` on its drawDefinition, which is a tennis code;
 * a pickleball event carrying `@RALLY` resolves to pickleball instead.
 *
 * Tennis remains the last resort, matching the hero's `tennisCourt()` fallback.
 */
export function resolveVenueSport(eventInfo?: any[]): CourtSport {
  const events = eventInfo ?? [];

  for (const event of events) {
    const sport = resolveCourtSport(event);
    if (sport) return sport;
  }

  for (const event of events) {
    for (const matchUpFormat of event?.matchUpFormats ?? []) {
      const sport = sportFromMatchUpFormat(matchUpFormat);
      if (sport) return sport;
    }
  }

  return DEFAULT_COURT_SPORT;
}

function findWebsite(venue: any): string | undefined {
  const resource = venue?.onlineResources?.find((r: any) => r?.name === WEBSITE_NAME);
  const id = resource?.identifier;
  if (!id) return undefined;
  if (id.startsWith('http://') || id.startsWith('https://')) return id;
  return `https://${id}`;
}

function buildWebsiteLink(url: string, venueName: string): HTMLElement {
  const link = document.createElement('a');
  link.href = url;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.className = 'venue-website-link';
  link.textContent = `${venueName} website`;
  return link;
}

export function renderVenues(venues: any[] | undefined, eventInfo?: any[]): HTMLElement | null {
  if (!venues?.length) return null;

  const sport = resolveVenueSport(eventInfo);

  const section = document.createElement('section');
  section.className = 'tournament-venues';

  const grid = document.createElement('div');
  grid.className = 'tournament-venues__grid';
  // A one- or two-venue tournament was getting one 246px card and four empty
  // slots, because auto-fill keeps generating tracks across the full width.
  grid.dataset.count = venues.length > 2 ? 'many' : String(venues.length);

  for (const venue of venues) {
    const cardData = mapVenueToCardData(venue, { sport });
    const card = buildVenueCard(cardData);
    grid.appendChild(card);

    const websiteUrl = findWebsite(venue);
    if (websiteUrl) {
      card.appendChild(buildWebsiteLink(websiteUrl, venue.venueName || 'Venue'));
    }
  }

  section.appendChild(grid);
  return section;
}
