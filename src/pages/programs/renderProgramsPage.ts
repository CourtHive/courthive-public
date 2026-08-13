// Program directory — a searchable list of every college program (TEAM) with published duals,
// each linking to its /#/program/:teamId season. Vanilla DOM, --chc-* themed (light + dark).
// Rows render once; the search box filters client-side by toggling visibility (fast at ~2.5k rows).

import { fetchPrograms, ProgramSummary } from 'src/services/api/programsApi';
import 'src/styles/programs-directory.css';

function renderMessage(parent: HTMLElement, text: string): void {
  const msg = document.createElement('div');
  msg.className = 'chp-programs-message';
  msg.textContent = text;
  parent.appendChild(msg);
}

export function renderProgramsPage(container: HTMLElement): void {
  container.innerHTML = '';

  const loading = document.createElement('div');
  loading.className = 'chp-programs-message';
  loading.textContent = 'Loading programs…';
  container.appendChild(loading);

  fetchPrograms()
    .then((programs) => {
      container.innerHTML = '';
      renderDirectory(container, programs);
    })
    .catch((e) => {
      console.warn('[programs] fetch failed:', e);
      container.innerHTML = '';
      renderMessage(container, 'Could not load the program directory. Please try again later.');
    });
}

function renderDirectory(container: HTMLElement, programs: ProgramSummary[]): void {
  const root = document.createElement('div');
  root.className = 'chp-programs-root';

  const header = document.createElement('div');
  header.className = 'chp-programs-header';
  const title = document.createElement('h1');
  title.className = 'chp-programs-title';
  title.textContent = 'Programs';
  header.appendChild(title);
  const subtitle = document.createElement('div');
  subtitle.className = 'chp-programs-subtitle';
  header.appendChild(subtitle);
  root.appendChild(header);

  if (!programs.length) {
    renderMessage(root, 'No programs with published duals yet.');
    container.appendChild(root);
    return;
  }

  const search = document.createElement('input');
  search.type = 'search';
  search.className = 'chp-programs-search';
  search.placeholder = 'Search programs…';
  search.setAttribute('aria-label', 'Search programs');
  root.appendChild(search);

  const list = document.createElement('ul');
  list.className = 'chp-programs-list';
  const rows: { el: HTMLElement; name: string }[] = [];
  for (const p of programs) {
    const li = document.createElement('li');
    li.className = 'chp-programs-item';

    const link = document.createElement('a');
    link.className = 'chp-programs-name';
    link.href = `#/program/${encodeURIComponent(p.teamId)}`;
    link.textContent = p.teamName || p.teamId;
    li.appendChild(link);

    const count = document.createElement('span');
    count.className = 'chp-programs-count';
    count.textContent = `${p.dualCount} dual${p.dualCount === 1 ? '' : 's'}`;
    li.appendChild(count);

    list.appendChild(li);
    rows.push({ el: li, name: (p.teamName || '').toLowerCase() });
  }
  root.appendChild(list);
  container.appendChild(root);

  const setSubtitle = (shown: number) => {
    subtitle.textContent =
      shown === programs.length ? `${programs.length} programs` : `${shown} of ${programs.length} programs`;
  };
  setSubtitle(programs.length);

  let raf = 0;
  search.addEventListener('input', () => {
    if (raf) cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => {
      const q = search.value.trim().toLowerCase();
      let shown = 0;
      for (const r of rows) {
        const match = !q || r.name.includes(q);
        r.el.classList.toggle('chp-hidden', !match);
        if (match) shown++;
      }
      setSubtitle(shown);
    });
  });
}
