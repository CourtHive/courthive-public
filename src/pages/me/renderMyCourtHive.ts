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
  fetchMyRegistrations,
  resendHiveIDVerification,
  withdrawRegistration,
  type ClaimableCandidate,
  type ParticipationRow,
  type RegistrationEntry,
  type RegistrationStatus,
} from 'src/services/hiveidApi';
import { clearHiveIDSession, getDisplayName, readHiveIDSession, writeHiveIDSession } from 'src/services/hiveidSession';
import { disconnectHiveIDSocket, onPersonUpdate, type PersonUpdateEvent } from 'src/services/hiveidSocket';
import { context } from 'src/common/context';
import { t } from 'src/i18n/i18n';

const SECTION_CLASS = 'chp-me-section';
const BUTTON_CLASS = 'chp-me-button';

// Module-scoped unsub for the personUpdate listener so a re-render of
// /me cleans up the previous registration before installing the new one.
// When the user navigates away (e.g. to /tournament/X), the listener
// itself notices `container.isConnected === false` on the next event and
// self-cleans-up — see the merged-event handler below.
let currentPersonUpdateUnsub: (() => void) | undefined;

// Re-entrance guard. A burst of `personMerged` events arriving while a
// previous `fetchHiveIDMe()` is still pending used to fire a fresh
// fetch for each event — and if the personId changed, each fetch ended
// in a recursive `renderMyCourtHive(container)` call. The final /me
// state reflects the latest server truth anyway, so dropping reactor
// events while a refresh is in flight is loss-less.
let identityRefreshInFlight = false;

/**
 * Internal — exposed for tests. Returns whether the merged-event
 * handler should proceed with a /me refresh against this container,
 * given the in-flight guard. False outcomes:
 *  - container is detached → user navigated away; caller should also
 *    unsubscribe to stop background work.
 *  - a refresh is already in flight → drop, the in-flight call will
 *    pick up the latest server state on its own.
 */
export function __shouldProcessMergedEvent(container: HTMLElement, inFlight: boolean): boolean {
  if (!container.isConnected) return false;
  if (inFlight) return false;
  return true;
}

export function renderMyCourtHive(container: HTMLElement): void {
  // Tear down any previous listener + in-flight flag before re-rendering.
  currentPersonUpdateUnsub?.();
  currentPersonUpdateUnsub = undefined;
  identityRefreshInFlight = false;

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

  const verification = renderVerificationSection();
  shell.appendChild(verification.section);

  const registrations = renderRegistrationsSection();
  shell.appendChild(registrations.section);

  const participations = renderParticipationsSection();
  shell.appendChild(participations.section);

  const claim = renderClaimSection({
    onClaimed: () => {
      void participations.refresh();
    },
  });
  shell.appendChild(claim.section);

  container.appendChild(shell);

  void verification.refresh();
  void registrations.refresh();
  void participations.refresh();

  // HiveID Phase 4.0 — listen for personUpdate broadcasts so the page
  // reflects identity-changing server events without a manual refresh.
  // Today the only emitted kind is `merged` (CFS PersonsClient fans
  // personMerged out to both survivor + deprecated rooms). Future
  // phases extend this to roster/schedule/result events; we add new
  // branches as those producers land.
  currentPersonUpdateUnsub = onPersonUpdate((event: PersonUpdateEvent) => {
    if (event.kind !== 'merged') return;

    // Detached container — the user navigated away from /me since this
    // listener was installed. Self-clean-up so background tabs stop
    // refetching /me on every server-side merge from now until reload.
    if (!container.isConnected) {
      currentPersonUpdateUnsub?.();
      currentPersonUpdateUnsub = undefined;
      return;
    }
    // De-duplicate concurrent refreshes — the in-flight fetch will
    // pick up the latest /me state, so dropping the reactor here is
    // loss-less and avoids the recursive re-render storm a burst of
    // merges would otherwise produce.
    if (identityRefreshInFlight) return;
    identityRefreshInFlight = true;
    console.log('[me] personUpdate merged — refreshing identity + lists');

    void fetchHiveIDMe()
      .then((me) => {
        if (!me) return;
        const refreshed = readHiveIDSession();
        if (!refreshed) return;
        const samePerson = refreshed.personId === me.personId;
        if (!samePerson) {
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
          // Guard the recursive re-render against a container that has
          // become detached during the in-flight fetch — render against
          // a stale DOM node would be a silent no-op + a wasted listener.
          if (container.isConnected) renderMyCourtHive(container);
          return;
        }
        void registrations.refresh();
        void participations.refresh();
      })
      .catch((err) => {
        console.warn('[me] personUpdate refresh failed:', err);
      })
      .finally(() => {
        identityRefreshInFlight = false;
      });
  });

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
  submit.className = BUTTON_CLASS;
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
  btn.className = BUTTON_CLASS;
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

function renderVerificationSection(): { section: HTMLElement; refresh: () => Promise<void> } {
  const section = document.createElement('section');
  section.className = SECTION_CLASS;
  const sectionTitle = document.createElement('h2');
  sectionTitle.textContent = t('me.verification.title');
  section.appendChild(sectionTitle);

  const body = document.createElement('div');
  body.className = 'chp-me-verification';
  body.textContent = t('me.verification.checking');
  section.appendChild(body);

  function statusLine(text: string, kind: 'success' | 'warn' | 'error'): HTMLElement {
    const p = document.createElement('p');
    p.textContent = text;
    p.style.margin = '0 0 0.75rem';
    p.style.fontSize = '0.9rem';
    const tokenByKind = {
      success: 'var(--chc-status-success)',
      warn: 'var(--chc-status-warning)',
      error: 'var(--chc-status-error)',
    };
    p.style.color = tokenByKind[kind];
    return p;
  }

  async function refresh(): Promise<void> {
    body.replaceChildren();
    body.textContent = t('me.verification.checking');
    const me = await fetchHiveIDMe().catch(() => null);
    body.replaceChildren();
    if (!me) {
      body.textContent = t('me.verification.signInToManage');
      return;
    }
    const email = me.email || t('me.verification.yourEmail');
    if (me.emailVerifiedAt) {
      body.appendChild(statusLine(t('me.verification.verified', { email }), 'success'));
      return;
    }

    body.appendChild(statusLine(t('me.verification.notVerified', { email }), 'warn'));
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = BUTTON_CLASS;
    btn.textContent = t('me.verification.resend');
    btn.onclick = async () => {
      btn.disabled = true;
      try {
        const res = await resendHiveIDVerification();
        if (res?.status === 'already_verified') {
          await refresh();
          return;
        }
        body.appendChild(statusLine(t('me.verification.sent'), 'success'));
      } catch (err) {
        console.warn('[hiveid verification] resend failed:', err);
        body.appendChild(statusLine(t('me.verification.sendFailed'), 'error'));
        btn.disabled = false;
      }
    };
    body.appendChild(btn);
  }

  return { section, refresh };
}

function renderRegistrationsSection(): { section: HTMLElement; refresh: () => Promise<void> } {
  const section = document.createElement('section');
  section.className = SECTION_CLASS;
  const sectionTitle = document.createElement('h2');
  sectionTitle.textContent = 'Your registrations';
  section.appendChild(sectionTitle);

  const body = document.createElement('div');
  body.className = 'chp-me-registrations';
  body.textContent = 'Loading…';
  section.appendChild(body);

  async function refresh(): Promise<void> {
    body.replaceChildren();
    body.textContent = 'Loading…';
    try {
      const entries = await fetchMyRegistrations();
      if (!entries) {
        body.textContent = 'Sign in to see your registrations.';
        return;
      }
      if (!entries.length) {
        body.textContent = 'You have no tournament registrations yet.';
        return;
      }
      body.replaceChildren();
      const list = document.createElement('ul');
      list.className = 'chp-me-list';
      for (const entry of entries) {
        list.appendChild(buildRegistrationRow(entry, refresh));
      }
      body.appendChild(list);
    } catch (err) {
      console.warn('[hiveid registrations] fetch failed:', err);
      body.textContent = 'Could not load your registrations. Please try again later.';
    }
  }

  return { section, refresh };
}

function buildRegistrationRow(entry: RegistrationEntry, refresh: () => Promise<void>): HTMLElement {
  const li = document.createElement('li');
  li.className = 'chp-me-list-item';

  const main = document.createElement('div');
  main.className = 'chp-me-list-main';

  const titleRow = document.createElement('div');
  titleRow.style.display = 'flex';
  titleRow.style.alignItems = 'center';
  titleRow.style.gap = '0.5rem';
  const nameLink = document.createElement('a');
  nameLink.className = 'chp-me-list-title';
  nameLink.href = `#/tournament/${encodeURIComponent(entry.tournamentId)}`;
  nameLink.textContent = entry.tournamentId;
  titleRow.appendChild(nameLink);
  titleRow.appendChild(buildStatusPill(entry.status));
  main.appendChild(titleRow);

  const meta = document.createElement('div');
  meta.className = 'chp-me-list-meta';
  meta.appendChild(makeMetaSpan(`Applied ${entry.appliedAt.slice(0, 10)}`));
  if (entry.eventIds.length) {
    meta.appendChild(makeMetaSpan(`${entry.eventIds.length} event${entry.eventIds.length === 1 ? '' : 's'}`));
  }
  if (entry.statusReason) meta.appendChild(makeMetaSpan(entry.statusReason));
  main.appendChild(meta);
  li.appendChild(main);

  if (canWithdraw(entry.status)) {
    const withdraw = document.createElement('button');
    withdraw.type = 'button';
    withdraw.className = BUTTON_CLASS;
    withdraw.textContent = 'Withdraw';
    withdraw.onclick = async () => {
      withdraw.disabled = true;
      try {
        await withdrawRegistration(entry.registrationId);
        await refresh();
      } catch (err) {
        console.warn('[hiveid registrations] withdraw failed:', err);
        withdraw.disabled = false;
      }
    };
    li.appendChild(withdraw);
  }

  return li;
}

function canWithdraw(status: RegistrationStatus): boolean {
  return status === 'applied' || status === 'accepted' || status === 'seeded' || status === 'waitlisted';
}

function buildStatusPill(status: RegistrationStatus): HTMLElement {
  const pill = document.createElement('span');
  pill.className = 'chp-me-status-pill';
  pill.dataset.status = status;
  pill.textContent = status;
  return pill;
}

function appendField(dl: HTMLDListElement, label: string, value: string): void {
  const dt = document.createElement('dt');
  dt.textContent = label;
  const dd = document.createElement('dd');
  dd.textContent = value;
  dl.appendChild(dt);
  dl.appendChild(dd);
}
