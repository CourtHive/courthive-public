import { buildVenueCard, mapVenueToCardData, resolveCourtSport } from 'courthive-components';
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
 * `resolveCourtSport` reads `competitionFormat.sport` or `matchUpFormat`, and
 * the public `eventInfo` projection carries neither today — so in practice this
 * falls back to tennis. That default matches the tournament hero, which already
 * renders `tennisCourt()` when a tournament publishes no artwork. It is an
 * assumption, not a fact: on a sport-agnostic platform a non-racquet event with
 * no format data will show a tennis court. Publishing `matchUpFormat` on
 * `eventInfo` would make this resolve properly.
 */
export function resolveVenueSport(eventInfo?: any[]): CourtSport {
  for (const event of eventInfo ?? []) {
    const sport = resolveCourtSport(event);
    if (sport) return sport;
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
