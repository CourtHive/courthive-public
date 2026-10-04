// Program view — a college program's (TEAM's) published season of dual matches, grouped by year,
// each dual linking to its existing /tournament/:id scorecard. Vanilla DOM, --chc-* themed
// (light + dark). Data comes from courthive-query's public by-team endpoint via programsApi.
//
// Ownership vs visibility is decoupled server-side: an away dual is stored ONCE under the host
// provider but still surfaces here for the visiting team, so no record is duplicated.

import { fetchProgramDuals, ProgramDual } from 'src/services/api/programsApi';
import 'src/styles/program.css';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Parse a 'YYYY-MM-DD' calendar date WITHOUT `new Date()` so a UTC parse can't shift the day
// (the calendar-day off-by-one that bites date rendering across the ecosystem).
function formatDate(iso: string | null): string {
  if (!iso) return '';
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso;
  const [, y, mo, d] = m;
  return `${MONTHS[Number(mo) - 1] ?? mo} ${Number(d)}, ${y}`;
}

function yearOf(iso: string | null): string {
  const m = iso && /^(\d{4})/.exec(iso);
  return m ? m[1] : 'Undated';
}

function renderMessage(parent: HTMLElement, text: string): void {
  const msg = document.createElement('div');
  msg.className = 'chp-program-message';
  msg.textContent = text;
  parent.appendChild(msg);
}

export function renderProgramPage(container: HTMLElement, teamId: string): void {
  container.innerHTML = '';
  if (!teamId) {
    renderMessage(container, 'No program specified.');
    return;
  }

  const loading = document.createElement('div');
  loading.className = 'chp-program-message';
  loading.textContent = 'Loading season…';
  container.appendChild(loading);

  fetchProgramDuals(teamId)
    .then((duals) => {
      container.innerHTML = '';
      renderSeason(container, teamId, duals);
    })
    .catch((e) => {
      console.warn('[program] fetch failed:', e);
      container.innerHTML = '';
      renderMessage(container, 'Could not load this program’s season. Please try again later.');
    });
}

function renderSeason(container: HTMLElement, teamId: string, duals: ProgramDual[]): void {
  if (!duals.length) {
    renderMessage(container, 'No published dual matches found for this program yet.');
    return;
  }

  const root = document.createElement('div');
  root.className = 'chp-program-root';

  const programName = duals.find((d) => d.teamName)?.teamName || teamId;

  const header = document.createElement('div');
  header.className = 'chp-program-header';
  const title = document.createElement('h1');
  title.className = 'chp-program-title';
  title.textContent = programName;
  header.appendChild(title);
  const subtitle = document.createElement('div');
  subtitle.className = 'chp-program-subtitle';
  subtitle.textContent = `${duals.length} dual match${duals.length === 1 ? '' : 'es'}`;
  header.appendChild(subtitle);
  root.appendChild(header);

  // The service returns duals newest-dated first; grouping preserves that order per year.
  const groups = new Map<string, ProgramDual[]>();
  for (const d of duals) {
    const y = yearOf(d.startDate);
    if (!groups.has(y)) groups.set(y, []);
    groups.get(y)!.push(d);
  }

  for (const [year, rows] of groups) {
    const section = document.createElement('section');
    section.className = 'chp-program-season';

    const seasonTitle = document.createElement('h2');
    seasonTitle.className = 'chp-program-season-title';
    seasonTitle.textContent = year === 'Undated' ? 'Undated' : `${year} season`;
    section.appendChild(seasonTitle);

    const list = document.createElement('ul');
    list.className = 'chp-program-list';
    for (const d of rows) list.appendChild(buildDualRow(d));
    section.appendChild(list);

    root.appendChild(section);
  }

  container.appendChild(root);
}

function buildDualRow(d: ProgramDual): HTMLElement {
  const li = document.createElement('li');
  li.className = 'chp-program-item';

  const date = document.createElement('span');
  date.className = 'chp-program-date';
  date.textContent = formatDate(d.startDate);
  li.appendChild(date);

  const link = document.createElement('a');
  link.className = 'chp-program-name';
  link.href = `#/tournament/${encodeURIComponent(d.tournamentId)}`;
  link.textContent = d.tournamentName || d.tournamentId;
  li.appendChild(link);

  return li;
}
