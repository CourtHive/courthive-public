import { TOURNAMENT_LOGO, TOURNAMENT_TITLE_BLOCK } from 'src/common/constants/elementConstants';
import { dateString } from './helpers/dateString';
import './tournament-hero.css';

type TFunction = (key: string, options?: Record<string, unknown>) => string;

export type HeroVariant = 'banner' | 'mark';

/**
 * Aspect ratio alone does not separate a poster from a logo: the live Battle
 * of Boca artwork is 1659x906, a ratio of 1.83, while a wide wordmark logo can
 * sit at 3:1 or beyond. Absolute width is what actually distinguishes them —
 * poster art is authored large, wordmarks are not. Artwork must clear BOTH
 * thresholds to be laid out as a banner.
 */
export const BANNER_MIN_ASPECT = 1.6;
export const BANNER_MIN_WIDTH = 640;

/** Reveal the artwork even if neither `load` nor `error` ever fires. */
const ART_REVEAL_FALLBACK_MS = 2000;

export function heroVariantForArtwork(naturalWidth?: number, naturalHeight?: number): HeroVariant {
  const width = Number(naturalWidth);
  const height = Number(naturalHeight);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return 'mark';
  return width / height >= BANNER_MIN_ASPECT && width >= BANNER_MIN_WIDTH ? 'banner' : 'mark';
}

const normalize = (value?: string): string =>
  String(value ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

/**
 * The owning organisation is shown as an eyebrow above the title — but only
 * when it adds information. "Battle of Boca" over "Battle of Boca - August 15"
 * is noise, so either name containing the other suppresses it.
 */
export function shouldShowEyebrow(organisationName?: string, tournamentName?: string): boolean {
  const organisation = normalize(organisationName);
  if (!organisation) return false;
  const tournament = normalize(tournamentName);
  if (!tournament) return true;
  return !tournament.includes(organisation) && !organisation.includes(tournament);
}

/**
 * The facts worth carrying in the hero, in priority order. Deliberately counts
 * ENTRIES rather than players: `entriesCount` is per-event, so a competitor in
 * both singles and doubles is two entries and calling the sum "players" would
 * overstate the field.
 */
export function heroMetaItems(tournamentInfo: any, t: TFunction): string[] {
  const items: string[] = [];

  const dates = dateString(tournamentInfo ?? {});
  if (dates) items.push(dates);

  const venueNames: string[] = (tournamentInfo?.venues ?? []).map((venue: any) => venue?.venueName).filter(Boolean);
  if (venueNames.length && venueNames.length <= 2) items.push(venueNames.join(' & '));
  else if (venueNames.length) items.push(t('hero.venues', { count: venueNames.length }));

  const eventInfo: any[] = tournamentInfo?.eventInfo ?? [];
  if (eventInfo.length) items.push(t('hero.events', { count: eventInfo.length }));

  const entries = eventInfo.reduce((total, event) => total + (Number(event?.entriesCount) || 0), 0);
  if (entries) items.push(t('hero.entries', { count: entries }));

  return items;
}

function buildIdentity(tournamentInfo: any, t: TFunction): HTMLElement {
  const identity = document.createElement('div');
  identity.className = 'chp-hero__identity';

  const organisationName = tournamentInfo?.parentOrganisation?.organisationName;
  const tournamentName = tournamentInfo?.tournamentName;

  if (shouldShowEyebrow(organisationName, tournamentName)) {
    const eyebrow = document.createElement('p');
    eyebrow.className = 'chp-hero__eyebrow';
    eyebrow.textContent = organisationName;
    identity.appendChild(eyebrow);
  }

  const title = document.createElement('h1');
  title.className = 'chp-hero__title';
  title.textContent = tournamentName ?? '';
  identity.appendChild(title);

  const metaItems = heroMetaItems(tournamentInfo, t);
  if (metaItems.length) {
    const meta = document.createElement('ul');
    meta.className = 'chp-hero__meta';
    for (const item of metaItems) {
      const entry = document.createElement('li');
      entry.textContent = item;
      meta.appendChild(entry);
    }
    identity.appendChild(meta);
  }

  return identity;
}

/**
 * Builds the tournament identity band.
 *
 * The artwork's natural aspect ratio decides the layout, so it can only be
 * settled once the image has decoded. Until then the art is held at zero
 * opacity over a reserved box — measuring first and revealing once avoids the
 * mark→banner size pop that resizing after paint would produce.
 *
 * `fallbackArt` is injected rather than imported so this module stays free of
 * `courthive-components`, which touches `document` at import time.
 */
export function buildTournamentHero({
  tournamentInfo,
  fallbackArt,
  t,
}: {
  fallbackArt: () => SVGElement | HTMLElement;
  tournamentInfo: any;
  t: TFunction;
}): HTMLElement {
  const hero = document.createElement('header');
  hero.className = 'chp-hero chp-hero--mark';

  const art = document.createElement('div');
  art.className = 'chp-hero__art';
  art.id = TOURNAMENT_LOGO;

  const identity = buildIdentity(tournamentInfo, t);
  identity.id = TOURNAMENT_TITLE_BLOCK;

  const reveal = () => hero.classList.remove('chp-hero--measuring');
  const applyVariant = (variant: HeroVariant) => {
    hero.classList.toggle('chp-hero--banner', variant === 'banner');
    hero.classList.toggle('chp-hero--mark', variant === 'mark');
  };

  const showFallback = () => {
    art.replaceChildren(fallbackArt());
    applyVariant('mark');
    reveal();
  };

  const image = tournamentInfo?.onlineResources?.find((resource: any) => resource?.name === 'tournamentImage');
  const imageUrl: string | undefined = image?.identifier;
  const isValidUrl =
    !!imageUrl && (imageUrl.startsWith('https://') || imageUrl.startsWith('http://') || imageUrl.startsWith('data:'));

  if (isValidUrl) {
    const img = document.createElement('img');
    img.className = 'chp-hero__image';
    img.alt = tournamentInfo?.tournamentName ?? '';
    img.decoding = 'async';

    const measure = () => {
      const { naturalWidth, naturalHeight } = img;
      if (naturalWidth && naturalHeight) {
        // Cap the banner at its intrinsic width so a narrow poster is never
        // upscaled to fill a 1344px container.
        art.style.setProperty('--chp-hero-art-width', `${naturalWidth}px`);
        applyVariant(heroVariantForArtwork(naturalWidth, naturalHeight));
      }
      reveal();
    };

    hero.classList.add('chp-hero--measuring');
    img.addEventListener('load', measure);
    img.addEventListener('error', showFallback);
    setTimeout(reveal, ART_REVEAL_FALLBACK_MS);

    art.appendChild(img);
    img.src = imageUrl;
    if (img.complete) measure();
  } else {
    art.appendChild(fallbackArt());
  }

  hero.appendChild(art);
  hero.appendChild(identity);
  return hero;
}
