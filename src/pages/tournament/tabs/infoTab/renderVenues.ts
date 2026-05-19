import { buildVenueCard, mapVenueToCardData } from 'courthive-components';
import './renderVenues.css';

const WEBSITE_NAME = 'venueWebsite';

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

export function renderVenues(venues: any[] | undefined): HTMLElement | null {
  if (!venues?.length) return null;

  const section = document.createElement('section');
  section.className = 'tournament-venues';

  const grid = document.createElement('div');
  grid.className = 'tournament-venues__grid';

  for (const venue of venues) {
    const cardData = mapVenueToCardData(venue);
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
