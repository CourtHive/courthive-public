// Conference directory — every conference with published dual results, showing its competitive
// fingerprint at a glance. Vanilla DOM, --chc-* themed (light + dark). Client-side filter.

import { ConferenceIndexEntry, fetchConferenceIndex } from 'src/services/api/conferencesApi';
import { bandBar, message } from 'src/pages/conference/fingerprintView';
import 'src/styles/conference-pages.css';

export function renderConferencesPage(container: HTMLElement): void {
  container.innerHTML = '';
  message(container, 'Loading conferences…');

  fetchConferenceIndex()
    .then((index) => {
      container.innerHTML = '';
      renderDirectory(container, index.conferences, index.threshold);
    })
    .catch((e) => {
      console.warn('[conferences] fetch failed:', e);
      container.innerHTML = '';
      message(container, 'Could not load conference data. Please try again later.');
    });
}

function renderDirectory(container: HTMLElement, rows: ConferenceIndexEntry[], threshold: number): void {
  const root = document.createElement('div');
  root.className = 'chp-conf-root';

  const header = document.createElement('div');
  header.className = 'chp-conf-header';
  header.innerHTML = `
    <h1>Conferences</h1>
    <p class="chp-conf-sub">Competitive exposure across published dual results — how often each conference's
    players face a meaningfully stronger opponent (stretch), an even one, or play down (anchor).
    Threshold ±${threshold} WTN. Dual season only.</p>`;
  root.appendChild(header);

  const search = document.createElement('input');
  search.type = 'search';
  search.className = 'chp-conf-search';
  search.placeholder = 'Filter conferences…';
  search.setAttribute('aria-label', 'Filter conferences');
  root.appendChild(search);

  const list = document.createElement('div');
  list.className = 'chp-conf-list';
  root.appendChild(list);

  for (const row of rows) {
    const card = document.createElement('a');
    card.className = 'chp-conf-card';
    card.href = `#/conference/${row.slug}`;
    card.dataset.name = `${row.conference} ${row.divisions.join(' ')}`.toLowerCase();

    const top = document.createElement('div');
    top.className = 'chp-conf-card-top';
    top.innerHTML = `<span class="chp-conf-name">${escapeHtml(row.conference)}</span>
      <span class="chp-conf-meta">${row.divisions.join(' · ')} · ${row.programCount} programs</span>`;
    card.appendChild(top);

    card.appendChild(bandBar(row as any));

    const stats = document.createElement('div');
    stats.className = 'chp-conf-stats';
    stats.innerHTML = `
      <span><b>${row.stretchRate}%</b> stretch</span>
      <span><b>${row.anchorRate}%</b> anchor</span>
      <span><b>${row.breadth}</b> breadth</span>
      <span><b>${row.competitiveRatio ?? '—'}%</b> competitive</span>
      <span class="chp-conf-n">${row.matches.toLocaleString()} matches</span>`;
    card.appendChild(stats);
    list.appendChild(card);
  }

  search.addEventListener('input', () => {
    const q = search.value.trim().toLowerCase();
    for (const el of Array.from(list.children) as HTMLElement[]) {
      el.style.display = !q || (el.dataset.name ?? '').includes(q) ? '' : 'none';
    }
  });

  container.appendChild(root);
}

function escapeHtml(s: string): string {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}
