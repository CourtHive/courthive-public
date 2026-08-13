// A single conference's competitive fingerprint.
//
// The page is deliberately DESCRIPTIVE. Narrow deltas achieved by stratified scheduling are
// level-based play working as intended — not a defect — so nothing here frames a conference's
// profile as a problem or recommends a remedy. It reports what happened; governance decides what,
// if anything, should follow.

import { ConferenceDoc, ConferenceMember, Fingerprint, fetchConference } from 'src/services/api/conferencesApi';
import { bandBar, bandLegend, message } from 'src/pages/conference/fingerprintView';
import 'src/styles/conference-pages.css';

export function renderConferencePage(container: HTMLElement, slug: string): void {
  container.innerHTML = '';
  if (!slug) {
    message(container, 'No conference specified.');
    return;
  }
  message(container, 'Loading conference…');

  fetchConference(slug)
    .then((doc) => {
      container.innerHTML = '';
      render(container, doc);
    })
    .catch((e) => {
      console.warn('[conference] fetch failed:', e);
      container.innerHTML = '';
      message(container, 'Could not load this conference.');
    });
}

const num = (v: number | null | undefined, suffix = '') => (v === null || v === undefined ? '—' : `${v}${suffix}`);

function statBlock(label: string, value: string, hint?: string): HTMLElement {
  const el = document.createElement('div');
  el.className = 'chp-stat';
  el.innerHTML = `<span class="chp-stat-value">${value}</span><span class="chp-stat-label">${label}</span>`;
  if (hint) el.title = hint;
  return el;
}

function fingerprintRow(label: string, fp: Fingerprint, hint?: string): HTMLElement {
  const row = document.createElement('div');
  row.className = 'chp-fp-row';
  const name = document.createElement('div');
  name.className = 'chp-fp-label';
  name.textContent = label;
  if (hint) name.title = hint;
  row.appendChild(name);
  row.appendChild(bandBar(fp));
  const n = document.createElement('div');
  n.className = 'chp-fp-n';
  n.textContent = fp.matches ? fp.matches.toLocaleString() : '—';
  row.appendChild(n);
  return row;
}

function render(container: HTMLElement, doc: ConferenceDoc): void {
  const root = document.createElement('div');
  root.className = 'chp-conf-root';

  const back = document.createElement('a');
  back.className = 'chp-conf-back';
  back.href = '#/conferences';
  back.textContent = '← All conferences';
  root.appendChild(back);

  const header = document.createElement('div');
  header.className = 'chp-conf-header';
  header.innerHTML = `<h1>${escapeHtml(doc.conference)}</h1>
    <p class="chp-conf-sub">${doc.divisions.join(' · ')} · ${doc.programCount} programs ·
    seasons ${doc.seasons.join(', ')} · dual play only</p>`;
  root.appendChild(header);

  const o = doc.fingerprint.overall;
  const stats = document.createElement('div');
  stats.className = 'chp-stat-row';
  stats.appendChild(statBlock('stretch', num(o.stretchRate, '%'), 'Share of matches against a meaningfully stronger opponent'));
  stats.appendChild(statBlock('anchor', num(o.anchorRate, '%'), 'Share of matches against a meaningfully weaker opponent'));
  stats.appendChild(statBlock('breadth', String(o.breadth), 'Spread across all five bands (0 = one band only, 1 = perfectly even)'));
  stats.appendChild(statBlock('competitive', num(o.competitiveRatio, '%'), 'Share of matches that were genuine contests by scoreline'));
  stats.appendChild(statBlock('matches', o.matches.toLocaleString(), 'Player-perspectives in published dual singles'));
  root.appendChild(stats);

  root.appendChild(bandLegend());

  const fpSection = document.createElement('section');
  fpSection.className = 'chp-conf-section';
  fpSection.innerHTML = '<h2>Competitive exposure</h2>';
  fpSection.appendChild(fingerprintRow('Overall', o));
  fpSection.appendChild(fingerprintRow('In conference', doc.fingerprint.inConference, 'Matches against fellow members'));
  fpSection.appendChild(fingerprintRow('Non-conference', doc.fingerprint.nonConference, 'Matches outside the conference'));
  fpSection.appendChild(fingerprintRow('All college (baseline)', doc.baseline, 'Every published dual across all divisions'));
  root.appendChild(fpSection);

  // in- vs non-conference contrast, stated neutrally
  const g = doc.stretchGap;
  const gap = document.createElement('section');
  gap.className = 'chp-conf-section chp-conf-gap';
  let contrast = 'no difference';
  if (g.delta > 0) contrast = '<b>more</b> outside the conference';
  else if (g.delta < 0) contrast = '<b>less</b> outside the conference';
  gap.innerHTML = `<h2>Where the stretch comes from</h2>
    <p>Members face a meaningfully stronger opponent in <b>${g.inConference}%</b> of in-conference matches and
    <b>${g.nonConference}%</b> of non-conference matches — ${contrast}.
    Non-conference play is <b>${g.nonConferenceShare}%</b> of all matches.</p>`;
  root.appendChild(gap);

  // members
  const membersSection = document.createElement('section');
  membersSection.className = 'chp-conf-section';
  membersSection.innerHTML = '<h2>Programs</h2>';
  const table = document.createElement('div');
  table.className = 'chp-member-table';
  const head = document.createElement('div');
  head.className = 'chp-member-row chp-member-head';
  head.innerHTML = `<span>Program</span><span>Exposure</span><span>Stretch</span><span>Anchor</span><span>Breadth</span><span>Competitive</span><span>Matches</span>`;
  table.appendChild(head);

  const members = [...doc.members].sort((a, b) => b.stretchRate - a.stretchRate);
  for (const m of members) table.appendChild(memberRow(m));
  membersSection.appendChild(table);
  root.appendChild(membersSection);

  const note = document.createElement('p');
  note.className = 'chp-conf-note';
  note.textContent =
    'Exposure is measured programme-to-programme: in a dual, line N always faces the opponent’s line N, so the level difference is the difference between the two lineups. It is not an individual player rating. Fall individual events are not included.';
  root.appendChild(note);

  container.appendChild(root);
}

function memberRow(m: ConferenceMember): HTMLElement {
  const row = document.createElement('div');
  row.className = 'chp-member-row';
  const name = document.createElement('span');
  name.className = 'chp-member-name';
  const genderSuffix = m.gender ? ` (${m.gender})` : '';
  name.textContent = `${m.name}${genderSuffix}`;
  row.appendChild(name);
  const bar = document.createElement('span');
  bar.appendChild(bandBar(m));
  row.appendChild(bar);
  for (const v of [num(m.stretchRate, '%'), num(m.anchorRate, '%'), String(m.breadth), num(m.competitiveRatio, '%'), m.matches.toLocaleString()]) {
    const cell = document.createElement('span');
    cell.textContent = v;
    row.appendChild(cell);
  }
  return row;
}

function escapeHtml(s: string): string {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}
