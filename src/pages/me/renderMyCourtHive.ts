/**
 * /#/me — My CourtHive shell.
 *
 * Cached canonical profile, participations list (server-fetched
 * from `/auth/hiveid/me/participations`), and a tournament-scoped
 * claim UI that calls `/auth/hiveid/me/claimable/:tournamentId`
 * to surface matching Participants, then `/auth/hiveid/me/claim`
 * to fire the `addPersonOtherId` factory mutation.
 */
import './me.css';

import {
  claimParticipant,
  fetchClaimable,
  fetchHiveIDMe,
  fetchMyParticipations,
  type ClaimableCandidate,
  type ParticipationRow,
} from 'src/services/hiveidApi';
import { clearHiveIDSession, getDisplayName, readHiveIDSession, writeHiveIDSession } from 'src/services/hiveidSession';
import { disconnectHiveIDSocket } from 'src/services/hiveidSocket';
import { context } from 'src/common/context';

const SECTION_CLASS = 'chp-me-section';

export function renderMyCourtHive(container: HTMLElement): void {
  container.replaceChildren();

  const session = readHiveIDSession();
  if (!session?.token) {
    const empty = document.createElement('div');
    empty.className = 'chp-me-empty';
    empty.textContent = 'Please log in to see your CourtHive identity.';
    container.appendChild(empty);
    return;
  }

  const shell = document.createElement('div');
  shell.className = 'chp-me-shell';

  const header = document.createElement('div');
  header.className = 'chp-me-header';
  const title = document.createElement('h1');
  title.className = 'chp-me-title';
  title.textContent = 'My CourtHive';
  header.appendChild(title);

  const logout = document.createElement('button');
  logout.className = 'chp-me-logout';
  logout.type = 'button';
  logout.textContent = 'Sign out';
  logout.onclick = () => {
    clearHiveIDSession();
    disconnectHiveIDSocket();
    context.router?.navigate('/');
  };
  header.appendChild(logout);
  shell.appendChild(header);

  const profile = document.createElement('section');
  profile.className = SECTION_CLASS;
  const profileTitle = document.createElement('h2');
  profileTitle.textContent = 'Profile';
  profile.appendChild(profileTitle);

  const profileBody = document.createElement('dl');
  profileBody.className = 'chp-me-dl';
  appendField(profileBody, 'Name', getDisplayName(session) || '—');
  appendField(profileBody, 'Date of birth', session.cached.birthDate ?? '—');
  appendField(profileBody, 'Sex', session.cached.sex ?? '—');
  appendField(profileBody, 'Nationality', session.cached.nationalityCode ?? '—');
  appendField(profileBody, 'CourtHive person ID', session.personId ?? 'Not yet linked');
  profile.appendChild(profileBody);
  shell.appendChild(profile);

  const participations = renderParticipationsSection();
  shell.appendChild(participations.section);

  const claim = renderClaimSection({
    onClaimed: () => {
      void participations.refresh();
    },
  });
  shell.appendChild(claim.section);

  container.appendChild(shell);

  void participations.refresh();

  // Best-effort: refresh cached fields from /auth/hiveid/me so the
  // display picks up any personMerged-driven rewrites since the
  // session was minted. Silent fail — the cached session is the
  // source of truth for the rest of the page on failure.
  fetchHiveIDMe()
    .then((me) => {
      if (!me) return;
      const refreshed = readHiveIDSession();
      if (!refreshed) return;
      const samePerson = refreshed.personId === me.personId;
      const sameCached =
        refreshed.cached.standardFamilyName === me.cached.standardFamilyName &&
        refreshed.cached.standardGivenName === me.cached.standardGivenName &&
        refreshed.cached.birthDate === me.cached.birthDate &&
        refreshed.cached.sex === me.cached.sex &&
        refreshed.cached.nationalityCode === me.cached.nationalityCode;
      if (samePerson && sameCached) return;
      writeHiveIDSession({
        token: refreshed.token,
        refreshToken: refreshed.refreshToken,
        personId: me.personId,
        cached: {
          standardFamilyName: me.cached.standardFamilyName,
          standardGivenName: me.cached.standardGivenName,
          birthDate: me.cached.birthDate,
          sex: me.cached.sex,
          nationalityCode: me.cached.nationalityCode,
        },
      });
      renderMyCourtHive(container);
    })
    .catch((err) => {
      console.warn('[hiveid /me] refresh failed:', err);
    });
}

function renderParticipationsSection(): { section: HTMLElement; refresh: () => Promise<void> } {
  const section = document.createElement('section');
  section.className = SECTION_CLASS;
  const sectionTitle = document.createElement('h2');
  sectionTitle.textContent = 'Tournaments you have played';
  section.appendChild(sectionTitle);

  const body = document.createElement('div');
  body.className = 'chp-me-participations';
  body.textContent = 'Loading…';
  section.appendChild(body);

  async function refresh(): Promise<void> {
    body.replaceChildren();
    body.textContent = 'Loading…';
    try {
      const result = await fetchMyParticipations();
      if (!result) {
        body.textContent = 'Sign in to see your tournaments.';
        return;
      }
      if (!result.personId) {
        body.textContent = 'No CourtHive identity link yet — claim a participant below to start your history.';
        return;
      }
      if (!result.participations.length) {
        body.textContent = 'No tournaments yet — once you claim a participant the matches will appear here.';
        return;
      }
      body.replaceChildren();
      const list = document.createElement('ul');
      list.className = 'chp-me-list';
      for (const row of result.participations) {
        list.appendChild(buildParticipationRow(row));
      }
      body.appendChild(list);
    } catch (err) {
      console.warn('[hiveid participations] fetch failed:', err);
      body.textContent = 'Could not load your tournament history. Please try again later.';
    }
  }

  return { section, refresh };
}

function buildParticipationRow(row: ParticipationRow): HTMLElement {
  const li = document.createElement('li');
  li.className = 'chp-me-list-item';

  const main = document.createElement('div');
  main.className = 'chp-me-list-main';

  const nameLink = document.createElement('a');
  nameLink.className = 'chp-me-list-title';
  nameLink.href = `#/tournament/${encodeURIComponent(row.tournamentId)}`;
  nameLink.textContent = row.tournamentName || row.tournamentId;
  main.appendChild(nameLink);

  const meta = document.createElement('div');
  meta.className = 'chp-me-list-meta';
  const dates = formatDateRange(row.startDate, row.endDate);
  if (dates) meta.appendChild(makeMetaSpan(dates));
  meta.appendChild(makeMetaSpan(`${row.eventCount} event${row.eventCount === 1 ? '' : 's'}`));
  if (row.participantName) meta.appendChild(makeMetaSpan(`as ${row.participantName}`));
  main.appendChild(meta);

  li.appendChild(main);
  return li;
}

function formatDateRange(start: string | null, end: string | null): string {
  if (!start && !end) return '';
  if (start && end && start !== end) return `${start} → ${end}`;
  return start ?? end ?? '';
}

function makeMetaSpan(text: string): HTMLElement {
  const span = document.createElement('span');
  span.className = 'chp-me-list-meta-item';
  span.textContent = text;
  return span;
}

function renderClaimSection(opts: { onClaimed: () => void }): { section: HTMLElement } {
  const section = document.createElement('section');
  section.className = SECTION_CLASS;
  const sectionTitle = document.createElement('h2');
  sectionTitle.textContent = 'Claim a participant';
  section.appendChild(sectionTitle);

  const intro = document.createElement('p');
  intro.textContent =
    'Paste a tournament ID below. We will surface participants matching your name so you can link them to your CourtHive identity.';
  intro.style.fontSize = '0.875rem';
  intro.style.opacity = '0.8';
  intro.style.margin = '0 0 0.75rem';
  section.appendChild(intro);

  const form = document.createElement('form');
  form.className = 'chp-me-claim-form';

  const input = document.createElement('input');
  input.type = 'text';
  input.placeholder = 'tournament-uuid';
  input.required = true;
  input.className = 'chp-me-input';
  form.appendChild(input);

  const submit = document.createElement('button');
  submit.type = 'submit';
  submit.textContent = 'Find me';
  submit.className = 'chp-me-button';
  form.appendChild(submit);

  section.appendChild(form);

  const results = document.createElement('div');
  results.className = 'chp-me-claim-results';
  section.appendChild(results);

  const message = document.createElement('div');
  message.className = 'chp-me-claim-message';
  message.hidden = true;
  section.appendChild(message);

  function setMessage(text: string, kind: 'info' | 'error' | 'success' = 'info'): void {
    message.textContent = text;
    message.dataset.kind = kind;
    message.hidden = !text;
  }

  form.onsubmit = async (e) => {
    e.preventDefault();
    const tid = input.value.trim();
    setMessage('');
    results.replaceChildren();
    if (!tid) return;
    submit.disabled = true;
    try {
      const data = await fetchClaimable(tid);
      if (!data) {
        setMessage('Please sign in to use the claim tool.', 'error');
        return;
      }
      if (!data.candidates.length) {
        setMessage('No matching participants found in that tournament.', 'info');
        return;
      }
      for (const c of data.candidates) {
        results.appendChild(buildClaimableRow(c, tid, opts.onClaimed, setMessage));
      }
    } catch (err) {
      const text = err instanceof Error ? err.message : String(err);
      setMessage(`Could not look up that tournament: ${text}`, 'error');
    } finally {
      submit.disabled = false;
    }
  };

  return { section };
}

function buildClaimableRow(
  candidate: ClaimableCandidate,
  tournamentId: string,
  onClaimed: () => void,
  setMessage: (text: string, kind?: 'info' | 'error' | 'success') => void,
): HTMLElement {
  const li = document.createElement('div');
  li.className = 'chp-me-claim-row';

  const meta = document.createElement('div');
  meta.className = 'chp-me-claim-meta';
  const title = document.createElement('div');
  title.className = 'chp-me-claim-name';
  title.textContent = candidate.participantName || candidate.participantId;
  meta.appendChild(title);

  const sub = document.createElement('div');
  sub.className = 'chp-me-claim-sub';
  const parts = [candidate.sex, candidate.nationalityCode, candidate.birthDate].filter(Boolean);
  sub.textContent = parts.join(' · ');
  meta.appendChild(sub);

  li.appendChild(meta);

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'chp-me-button';
  btn.textContent = candidate.alreadyLinkedTo ? 'Already linked' : 'This is me';
  btn.disabled = !!candidate.alreadyLinkedTo;
  btn.onclick = async () => {
    btn.disabled = true;
    try {
      const result = await claimParticipant(tournamentId, candidate.participantId);
      if (!result?.success) {
        setMessage('Claim failed. Please try again.', 'error');
        btn.disabled = false;
        return;
      }
      setMessage(`Linked ${candidate.participantName} to your CourtHive identity.`, 'success');
      btn.textContent = 'Linked';
      onClaimed();
    } catch (err) {
      const text = err instanceof Error ? err.message : String(err);
      setMessage(`Claim failed: ${text}`, 'error');
      btn.disabled = false;
    }
  };
  li.appendChild(btn);
  return li;
}

function appendField(dl: HTMLDListElement, label: string, value: string): void {
  const dt = document.createElement('dt');
  dt.textContent = label;
  const dd = document.createElement('dd');
  dd.textContent = value;
  dl.appendChild(dt);
  dl.appendChild(dd);
}
