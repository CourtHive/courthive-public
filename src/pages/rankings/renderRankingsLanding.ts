// Rankings landing page — provider-agnostic entry point at /#/rankings.
//
// Lists the ranking bundles currently available so visitors can pick a
// provider before drilling into the per-provider table at
// /#/rankings/:providerAbbr (renderRankingsPage). Today the rankings
// service returns a single bundle (BOBOCA only — see
// courthive-rankings/src/modules/bundle/bundle.controller.ts); this view
// surfaces that one bundle as a single link and is ready to grow when
// the service exposes a list endpoint.
//
// Sibling to renderRankingsPage.ts. Same data source (/api/rankings/bundle
// through the CFS RankingsProxy), same --sp-* / --chc-* theme tokens, no
// framework.

import 'src/styles/rankings.css';

const BUNDLE_URL = '/api/rankings/bundle';

interface BundleSummary {
  provider: { name: string; abbreviation: string };
  asOfDate: string;
  tournaments: { id: string; name: string; endDate: string }[];
  rankings: { men: { entries: unknown[] }; women: { entries: unknown[] } };
}

async function fetchAvailableBundles(): Promise<BundleSummary[]> {
  try {
    const res = await fetch(BUNDLE_URL, { headers: { accept: 'application/json' } });
    if (!res.ok) return [];
    const bundle = (await res.json()) as BundleSummary;
    if (!bundle?.provider?.abbreviation) return [];
    return [bundle];
  } catch (e) {
    console.warn('[rankings-landing] bundle fetch failed:', e);
    return [];
  }
}

export function renderRankingsLanding(container: HTMLElement) {
  container.innerHTML = '';

  const loading = document.createElement('div');
  loading.className = 'rk-not-found';
  loading.textContent = 'Loading available rank lists…';
  container.appendChild(loading);

  fetchAvailableBundles().then((bundles) => {
    container.innerHTML = '';
    container.appendChild(buildLandingRoot(bundles));
  });
}

function buildLandingRoot(bundles: BundleSummary[]): HTMLElement {
  const root = document.createElement('div');
  root.className = 'rk-root';

  const header = document.createElement('div');
  header.className = 'rk-header';

  const title = document.createElement('h1');
  title.className = 'rk-title';
  title.textContent = 'Rankings';
  header.appendChild(title);

  const subtitle = document.createElement('div');
  subtitle.className = 'rk-subtitle';
  subtitle.textContent = 'Provider rank lists computed from CourtHive tournament results.';
  header.appendChild(subtitle);

  root.appendChild(header);

  if (bundles.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'rk-not-found';
    empty.textContent =
      'No rank lists are currently published. The rankings service was unreachable, ' +
      'or no provider has ingested results yet. Try again in a moment, or contact the operator.';
    root.appendChild(empty);
  } else {
    root.appendChild(buildAvailableSection(bundles));
  }

  root.appendChild(buildMethodologyFooter());

  return root;
}

function buildAvailableSection(bundles: BundleSummary[]): HTMLElement {
  const section = document.createElement('section');
  section.className = 'rk-panel';

  const heading = document.createElement('h2');
  heading.className = 'rk-panel-title';
  heading.textContent = `Available rank lists (${bundles.length})`;
  section.appendChild(heading);

  const list = document.createElement('ul');
  list.className = 'rk-landing-list';
  for (const b of bundles) {
    const li = document.createElement('li');
    li.className = 'rk-landing-item';

    const link = document.createElement('a');
    link.className = 'rk-landing-link';
    link.href = `#/rankings/${b.provider.abbreviation}`;
    link.textContent = `${b.provider.name} (${b.provider.abbreviation})`;
    li.appendChild(link);

    const meta = document.createElement('div');
    meta.className = 'rk-landing-meta';
    const men = b.rankings?.men?.entries?.length ?? 0;
    const women = b.rankings?.women?.entries?.length ?? 0;
    const tournaments = b.tournaments?.length ?? 0;
    meta.textContent =
      `As of ${b.asOfDate} · ${tournaments} tournament${tournaments === 1 ? '' : 's'}` +
      ` · ${men} men ranked · ${women} women ranked`;
    li.appendChild(meta);

    list.appendChild(li);
  }
  section.appendChild(list);

  return section;
}

function buildMethodologyFooter(): HTMLElement {
  const foot = document.createElement('div');
  foot.className = 'rk-footer';

  const title = document.createElement('div');
  title.className = 'rk-footer-title';
  title.textContent = 'About these rankings';
  foot.appendChild(title);

  const text = document.createElement('div');
  text.className = 'rk-footer-text';
  text.innerHTML = `
    Points are awarded by finishing position using the
    <strong>BASIC</strong> ranking-points policy bundled with
    <code>tods-competition-factory</code>. Each list pulls live data
    from the rankings service via <code>/api/rankings/bundle</code>;
    deeper per-tournament breakdowns appear inside each provider's list.
    More providers will appear here as they ingest results into the
    rankings service.
  `;
  foot.appendChild(text);

  return foot;
}
