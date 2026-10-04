// Rankings landing page — provider-agnostic entry point at /#/rankings.
//
// Lists the providers that currently have rankings so visitors can pick one
// before drilling into the per-provider table at /#/rankings/:providerAbbr
// (renderRankingsPage). Reads the providers directory from
// /api/rankings/providers (courthive-rankings' list endpoint) through the
// CFS RankingsProxy.
//
// Sibling to renderRankingsPage.ts. Same --sp-* / --chc-* theme tokens, no
// framework.

import 'src/styles/rankings.css';

const PROVIDERS_URL = '/api/rankings/providers';

interface ProviderSummary {
  name: string;
  abbreviation: string;
}

async function fetchProviders(): Promise<ProviderSummary[]> {
  try {
    const res = await fetch(PROVIDERS_URL, { headers: { accept: 'application/json' } });
    if (!res.ok) return [];
    const providers = (await res.json()) as ProviderSummary[];
    if (!Array.isArray(providers)) return [];
    return providers.filter((p) => p?.abbreviation);
  } catch (e) {
    console.warn('[rankings-landing] providers fetch failed:', e);
    return [];
  }
}

export function renderRankingsLanding(container: HTMLElement) {
  container.innerHTML = '';

  const loading = document.createElement('div');
  loading.className = 'rk-not-found';
  loading.textContent = 'Loading available rank lists…';
  container.appendChild(loading);

  fetchProviders().then((providers) => {
    container.innerHTML = '';
    container.appendChild(buildLandingRoot(providers));
  });
}

function buildLandingRoot(providers: ProviderSummary[]): HTMLElement {
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

  if (providers.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'rk-not-found';
    empty.textContent =
      'No rank lists are currently published. The rankings service was unreachable, ' +
      'or no provider has ingested results yet. Try again in a moment, or contact the operator.';
    root.appendChild(empty);
  } else {
    root.appendChild(buildAvailableSection(providers));
  }

  // Intentionally NO methodology footer here. Each provider chooses its
  // own ranking-points policy (today: BOBOCA uses BASIC; future providers
  // may use USTA / ITF / NATIONAL / custom). Methodology lives on the
  // per-provider detail page (renderRankingsPage.buildMethodologyFooter),
  // which reads policy.name from the bundle so the description always
  // reflects the policy that produced the numbers shown. The landing is
  // just a directory.

  return root;
}

function buildAvailableSection(providers: ProviderSummary[]): HTMLElement {
  const section = document.createElement('section');
  section.className = 'rk-panel';

  const heading = document.createElement('h2');
  heading.className = 'rk-panel-title';
  heading.textContent = `Available rank lists (${providers.length})`;
  section.appendChild(heading);

  const list = document.createElement('ul');
  list.className = 'rk-landing-list';
  for (const p of providers) {
    const li = document.createElement('li');
    li.className = 'rk-landing-item';

    const link = document.createElement('a');
    link.className = 'rk-landing-link';
    link.href = `#/rankings/${p.abbreviation}`;
    link.textContent = `${p.name} (${p.abbreviation})`;
    li.appendChild(link);

    list.appendChild(li);
  }
  section.appendChild(list);

  return section;
}

// (buildMethodologyFooter removed 2026-06-08 — see comment in
// buildLandingRoot. Methodology is per-provider and lives on the detail
// page, which reads policy.name from the bundle.)
