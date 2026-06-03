// Rankings page — renders provider rankings (default points policy).
//
// Data flow: fetch /api/rankings/bundle through the CFS rankings-proxy
// (courthive-net → CFS → loopback rankings:3110/rankings/bundle). The
// baked-in static JSON survives as a fallback for local dev + as a last-
// resort when the proxy can't reach rankings.
//
// Pattern intentionally mirrors createTournamentsTable.ts in this repo:
// vanilla DOM, no framework, --sp-* / --chc-* themed.

import { buildLadderChart, LadderChartDatum } from 'courthive-components';

import bobocaRankings from './data/boboca-rankings.json';
import 'src/styles/rankings.css';

const BUNDLE_URL = '/api/rankings/bundle';

// BASIC policy points → rung label (top of finishing-position range).
// 100 → W, 70 → F, 50 → SF, 30 → QF, 15 → R16, 8 → R32, 4 → R64, 1 → R128.
const RUNG_LABELS = ['R128', 'R64', 'R32', 'R16', 'QF', 'SF', 'F', 'W'];
function pointsToRungIndex(points: number): number {
  if (points >= 100) return 7; // W
  if (points >= 70) return 6; // F
  if (points >= 50) return 5; // SF
  if (points >= 30) return 4; // QF
  if (points >= 15) return 3; // R16
  if (points >= 8) return 2; // R32
  if (points >= 4) return 1; // R64
  return 0; // R128
}

interface TournamentBreakdownEntry {
  tournamentId: string;
  name: string;
  endDate: string;
  points: number;
}

interface RankingEntry {
  rank: number;
  personId: string;
  name: string;
  totalPoints: number;
  contributingResults: number;
  tournaments: TournamentBreakdownEntry[];
}

interface RankingsBundle {
  provider: { name: string; abbreviation: string };
  policy: { name: string; version: string; source: string };
  asOfDate: string;
  generatedAt: string;
  tournaments: { id: string; name: string; endDate: string }[];
  rankings: {
    men: { gender: string; entries: RankingEntry[] };
    women: { gender: string; entries: RankingEntry[] };
  };
}

// Last-resort fallback when the proxy can't reach rankings. Bundled at
// build time; refreshed manually via the export script when needed.
const FALLBACK: RankingsBundle = bobocaRankings as unknown as RankingsBundle;

async function fetchBundle(): Promise<{ bundle: RankingsBundle; isLive: boolean }> {
  try {
    const res = await fetch(BUNDLE_URL, { headers: { accept: 'application/json' } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const live = (await res.json()) as RankingsBundle;
    if (live?.rankings?.men && live?.rankings?.women) {
      return { bundle: live, isLive: true };
    }
    throw new Error('bundle shape unrecognized');
  } catch (e) {
    console.warn('[rankings] live fetch failed — using static fallback:', e);
    return { bundle: FALLBACK, isLive: false };
  }
}

export function renderRankingsPage(container: HTMLElement, providerAbbr: string) {
  container.innerHTML = '';

  // Brief loading state while the live fetch resolves.
  const loading = document.createElement('div');
  loading.className = 'rk-not-found';
  loading.textContent = 'Loading rankings…';
  container.appendChild(loading);

  fetchBundle().then(({ bundle, isLive }) => {
    container.innerHTML = '';

    if (bundle.provider.abbreviation.toUpperCase() !== providerAbbr.toUpperCase()) {
      const msg = document.createElement('div');
      msg.className = 'rk-not-found';
      msg.textContent = `No rankings available for "${providerAbbr}".`;
      container.appendChild(msg);
      return;
    }

    renderBundle(container, bundle, isLive);
  });
}

function renderBundle(container: HTMLElement, bundle: RankingsBundle, isLive: boolean) {
  const root = document.createElement('div');
  root.className = 'rk-root';

  root.appendChild(buildHeader(bundle, isLive));
  root.appendChild(buildMetaBar(bundle));
  root.appendChild(buildTableSection(bundle));
  root.appendChild(buildMethodologyFooter(bundle));

  container.appendChild(root);
}

function buildHeader(bundle: RankingsBundle, isLive: boolean): HTMLElement {
  const header = document.createElement('div');
  header.className = 'rk-header';

  const title = document.createElement('h1');
  title.className = 'rk-title';
  title.textContent = `${bundle.provider.name} — Rankings`;
  header.appendChild(title);

  const subtitle = document.createElement('div');
  subtitle.className = 'rk-subtitle';
  const liveTag = isLive ? ' · live' : ' · static fallback';
  subtitle.textContent = `Default points policy · As of ${bundle.asOfDate}${liveTag}`;
  header.appendChild(subtitle);

  return header;
}

function buildMetaBar(bundle: RankingsBundle): HTMLElement {
  const bar = document.createElement('div');
  bar.className = 'rk-meta-bar';

  const items: { label: string; value: string }[] = [
    { label: 'Tournaments', value: String(bundle.tournaments.length) },
    { label: 'Men ranked', value: String(bundle.rankings.men.entries.length) },
    { label: 'Women ranked', value: String(bundle.rankings.women.entries.length) },
    { label: 'Policy', value: `${bundle.policy.name} v${bundle.policy.version}` },
  ];
  for (const it of items) {
    const cell = document.createElement('div');
    cell.className = 'rk-meta-cell';
    const label = document.createElement('div');
    label.className = 'rk-meta-label';
    label.textContent = it.label;
    const value = document.createElement('div');
    value.className = 'rk-meta-value';
    value.textContent = it.value;
    cell.appendChild(label);
    cell.appendChild(value);
    bar.appendChild(cell);
  }
  return bar;
}

function buildTableSection(bundle: RankingsBundle): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'rk-tables';
  wrap.appendChild(buildOneTable("Men's Singles & Doubles", bundle.rankings.men.entries));
  wrap.appendChild(buildOneTable("Women's Singles & Doubles", bundle.rankings.women.entries));
  return wrap;
}

function buildOneTable(label: string, entries: RankingEntry[]): HTMLElement {
  const panel = document.createElement('section');
  panel.className = 'rk-panel';

  const heading = document.createElement('h2');
  heading.className = 'rk-panel-title';
  heading.textContent = label;
  panel.appendChild(heading);

  if (!entries.length) {
    const empty = document.createElement('div');
    empty.className = 'rk-empty';
    empty.textContent = 'No entries.';
    panel.appendChild(empty);
    return panel;
  }

  const table = document.createElement('table');
  table.className = 'rk-table';

  const thead = document.createElement('thead');
  thead.innerHTML = `
    <tr>
      <th class="rk-col-rank">Rank</th>
      <th class="rk-col-name">Player</th>
      <th class="rk-col-pts">Points</th>
      <th class="rk-col-res">Results</th>
      <th class="rk-col-events">Tournaments</th>
    </tr>
  `;
  table.appendChild(thead);

  const tbody = document.createElement('tbody');
  for (const e of entries) {
    tbody.appendChild(buildRow(e));
  }
  table.appendChild(tbody);
  panel.appendChild(table);

  return panel;
}

function buildRow(e: RankingEntry): HTMLElement {
  const tr = document.createElement('tr');
  tr.className = 'rk-row';

  const rank = document.createElement('td');
  rank.className = 'rk-col-rank';
  rank.textContent = String(e.rank);
  tr.appendChild(rank);

  const name = document.createElement('td');
  name.className = 'rk-col-name';
  name.textContent = e.name;
  tr.appendChild(name);

  const pts = document.createElement('td');
  pts.className = 'rk-col-pts';
  pts.textContent = String(e.totalPoints);
  tr.appendChild(pts);

  const res = document.createElement('td');
  res.className = 'rk-col-res';
  res.textContent = String(e.contributingResults);
  tr.appendChild(res);

  const events = document.createElement('td');
  events.className = 'rk-col-events';
  const btn = document.createElement('button');
  btn.className = 'rk-detail-toggle';
  btn.type = 'button';
  btn.textContent = `${e.tournaments.length} ▾`;
  events.appendChild(btn);
  tr.appendChild(events);

  // Expansion row — hidden by default, click toggles.
  const detail = document.createElement('tr');
  detail.className = 'rk-detail-row';
  detail.style.display = 'none';
  const detailCell = document.createElement('td');
  detailCell.colSpan = 5;
  detailCell.appendChild(buildDetailContent(e));
  detail.appendChild(detailCell);

  btn.addEventListener('click', () => {
    const open = detail.style.display !== 'none';
    detail.style.display = open ? 'none' : 'table-row';
    btn.textContent = `${e.tournaments.length} ${open ? '▾' : '▴'}`;
  });

  // Append the detail row AFTER the parent row is appended by the caller;
  // we use a wrapper fragment so insertion order is preserved.
  const frag = document.createDocumentFragment();
  frag.appendChild(tr);
  frag.appendChild(detail);
  // We return the wrapper element via an HTMLElement façade — tbody.appendChild
  // accepts a DocumentFragment and unfolds it.
  return frag as unknown as HTMLElement;
}

function buildDetailContent(e: RankingEntry): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'rk-detail-content';

  const header = document.createElement('div');
  header.className = 'rk-detail-header';
  header.textContent = `${e.name} · contributing tournaments`;
  wrap.appendChild(header);

  // Ladder chart: per-tournament finishing rung over time. Marks are
  // sized by `points` so deeper runs visually carry more weight than
  // early exits.
  if (e.tournaments.length > 0) {
    const chartHost = document.createElement('div');
    chartHost.className = 'rk-ladder-host';
    wrap.appendChild(chartHost);

    const data: LadderChartDatum[] = e.tournaments.map((t) => ({
      date: t.endDate,
      rung: pointsToRungIndex(t.points),
      label: t.name,
      detail: `${RUNG_LABELS[pointsToRungIndex(t.points)]} · ${t.points} pts`,
      radius: 5 + Math.min(8, Math.sqrt(t.points)),
    }));

    // Defer mount one frame so chartHost has its layout width before the
    // chart reads container.clientWidth.
    requestAnimationFrame(() => {
      buildLadderChart(chartHost, {
        rungs: RUNG_LABELS,
        data,
        height: 220,
        title: `${e.name} — finishing rung per tournament`,
        showConnector: true,
      });
    });
  }

  const list = document.createElement('table');
  list.className = 'rk-detail-table';
  list.innerHTML = `
    <thead>
      <tr>
        <th>Tournament</th>
        <th>End date</th>
        <th>Rung</th>
        <th>Points</th>
      </tr>
    </thead>
  `;
  const body = document.createElement('tbody');
  for (const t of e.tournaments) {
    const rungLabel = RUNG_LABELS[pointsToRungIndex(t.points)];
    const r = document.createElement('tr');
    r.innerHTML = `
      <td>${escape(t.name)}</td>
      <td>${escape(t.endDate)}</td>
      <td>${escape(rungLabel)}</td>
      <td class="rk-col-pts">${t.points}</td>
    `;
    body.appendChild(r);
  }
  list.appendChild(body);
  wrap.appendChild(list);
  return wrap;
}

function buildMethodologyFooter(bundle: RankingsBundle): HTMLElement {
  const foot = document.createElement('div');
  foot.className = 'rk-footer';

  const title = document.createElement('div');
  title.className = 'rk-footer-title';
  title.textContent = 'Methodology';
  foot.appendChild(title);

  const text = document.createElement('div');
  text.className = 'rk-footer-text';
  text.innerHTML = `
    Points are awarded by finishing position using the
    <strong>BASIC</strong> ranking-points policy bundled with
    tods-competition-factory (1st: 100, 2nd: 70, 3-4: 50, 5-8: 30,
    9-16: 15, 17-32: 8, 33-64: 4, 65+: 1). Each player's total is
    the sum of points across all qualifying results in the
    ${bundle.tournaments.length} tournaments below. Doubles points
    are credited in full to each partner.
  `;
  foot.appendChild(text);

  const tlistTitle = document.createElement('div');
  tlistTitle.className = 'rk-footer-title rk-footer-spaced';
  tlistTitle.textContent = `Tournaments included (${bundle.tournaments.length})`;
  foot.appendChild(tlistTitle);

  const tlist = document.createElement('ul');
  tlist.className = 'rk-tournament-list';
  for (const t of bundle.tournaments) {
    const li = document.createElement('li');
    li.textContent = `${t.endDate} — ${t.name}`;
    tlist.appendChild(li);
  }
  foot.appendChild(tlist);

  const generated = document.createElement('div');
  generated.className = 'rk-footer-generated';
  generated.textContent = `Generated ${bundle.generatedAt}`;
  foot.appendChild(generated);

  return foot;
}

const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

function escape(s: string): string {
  return s.replace(/[&<>"']/g, (c) => HTML_ESCAPES[c] ?? c);
}
