// One stored ranking list, in full — the destination of every "View list" link
// in a player's ranking history.
//
// This is the artifact, not the live view. `/rankings/:providerAbbr` renders
// the bundle, which is recomputed per request and describes only right now.
// This page renders `ranking_snapshots` + `ranking_entries` for one dated
// instance: what the list actually said on the day it was published, which is
// the only thing a historical rank can be checked against.
//
// PAGED, BECAUSE A REAL LIST IS NOT SMALL. A USTA Boys' 18 National Standings
// List is 20,805 entries. The service caps a page at 1,000 and reports the true
// total in the header's `entryCount`, so this page walks it rather than asking
// for the whole thing.

import {
  describeRankingList,
  fetchSnapshot,
  RankingEntry,
  RankingSnapshot,
} from 'src/services/api/rankingsApi';
import 'src/styles/rankings.css';

const PAGE_SIZE = 200;

export function renderRankingListPage(container: HTMLElement, snapshotId: string) {
  container.innerHTML = '';

  const root = document.createElement('div');
  root.className = 'rk-root';
  container.appendChild(root);

  const loading = document.createElement('div');
  loading.className = 'rk-not-found';
  loading.textContent = 'Loading ranking list…';
  root.appendChild(loading);

  let offset = 0;
  const collected: RankingEntry[] = [];

  const fail = (message: string) => {
    root.innerHTML = '';
    const msg = document.createElement('div');
    msg.className = 'rk-not-found';
    msg.textContent = message;
    root.appendChild(msg);
  };

  fetchSnapshot(snapshotId, { limit: PAGE_SIZE, offset })
    .then(({ snapshot, entries, pagination }) => {
      collected.push(...entries);
      offset += entries.length;
      root.innerHTML = '';
      root.appendChild(buildHeader(snapshot));

      const panel = document.createElement('section');
      panel.className = 'rk-panel';
      root.appendChild(panel);

      const table = buildTable(collected);
      panel.appendChild(table);

      // `total` is the header's own entryCount, written in the same transaction
      // as the body — so it is the size of the list, not the size of the page.
      const total = pagination.total || snapshot.entryCount;
      if (total > collected.length) {
        panel.appendChild(buildMoreButton(snapshotId, table, collected, () => offset, (n) => (offset = n), total));
      }
    })
    .catch(() => fail('That ranking list could not be found.'));
}

function buildHeader(snapshot: RankingSnapshot): HTMLElement {
  const header = document.createElement('div');
  header.className = 'rk-header';

  const title = document.createElement('h1');
  title.className = 'rk-title';
  title.textContent = describeRankingList(snapshot);
  header.appendChild(title);

  const subtitle = document.createElement('div');
  subtitle.className = 'rk-subtitle';
  // The as-of date is the identity of this instance; generatedAt is when the
  // materialisation last ran. They are different facts and both matter — a
  // regeneration replaces a snapshot in place, so generatedAt can move while
  // asOfDate does not.
  subtitle.textContent =
    `As of ${snapshot.asOfDate} · ${snapshot.entryCount.toLocaleString()} ranked · ` +
    `${snapshot.policyName} v${snapshot.policyVersion} · generated ${snapshot.generatedAt}`;
  header.appendChild(subtitle);

  return header;
}

function buildTable(entries: RankingEntry[]): HTMLTableElement {
  const table = document.createElement('table');
  table.className = 'rk-table';
  table.innerHTML = `
    <thead>
      <tr>
        <th class="rk-col-rank">Rank</th>
        <th class="rk-col-name">Player</th>
        <th class="rk-col-pts">Points</th>
        <th class="rk-col-res">Results</th>
      </tr>
    </thead>
  `;
  const body = document.createElement('tbody');
  body.className = 'rk-list-body';
  for (const entry of entries) body.appendChild(buildRow(entry));
  table.appendChild(body);
  return table;
}

function buildRow(entry: RankingEntry): HTMLElement {
  const tr = document.createElement('tr');
  tr.className = 'rk-row';

  const rank = document.createElement('td');
  rank.className = 'rk-col-rank';
  rank.textContent = String(entry.rank);
  tr.appendChild(rank);

  const name = document.createElement('td');
  name.className = 'rk-col-name';
  // A stored entry carries `person_id`, not a name — the entries table holds
  // identity, and names belong to courthive-persons. Showing the id is honest
  // until this page resolves names; inventing a placeholder name would not be.
  name.textContent = entry.personId;
  tr.appendChild(name);

  const points = document.createElement('td');
  points.className = 'rk-col-pts';
  points.textContent = String(entry.totalPoints);
  tr.appendChild(points);

  const results = document.createElement('td');
  results.className = 'rk-col-res';
  results.textContent = String(entry.countingResults);
  tr.appendChild(results);

  return tr;
}

function buildMoreButton(
  snapshotId: string,
  table: HTMLTableElement,
  collected: RankingEntry[],
  getOffset: () => number,
  setOffset: (n: number) => void,
  total: number,
): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'rk-list-more';

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'rk-detail-toggle';
  const label = () => `Show more · ${collected.length.toLocaleString()} of ${total.toLocaleString()}`;
  button.textContent = label();

  button.addEventListener('click', () => {
    button.disabled = true;
    button.textContent = 'Loading…';
    fetchSnapshot(snapshotId, { limit: PAGE_SIZE, offset: getOffset() })
      .then(({ entries }) => {
        const body = table.querySelector('tbody');
        for (const entry of entries) body?.appendChild(buildRow(entry));
        collected.push(...entries);
        setOffset(getOffset() + entries.length);
        if (collected.length >= total || !entries.length) {
          wrap.remove();
          return;
        }
        button.disabled = false;
        button.textContent = label();
      })
      .catch(() => {
        button.disabled = false;
        button.textContent = 'Retry';
      });
  });

  wrap.appendChild(button);
  return wrap;
}
