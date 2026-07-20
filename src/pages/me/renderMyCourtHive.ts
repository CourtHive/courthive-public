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
  checkHiveIDSession,
  claimParticipant,
  fetchClaimable,
  fetchHiveIDMe,
  fetchMyParticipations,
  resendHiveIDVerification,
  setMyContactEmail,
  type ClaimableCandidate,
  type ParticipationRow,
  type RegistrationStatus,
} from 'src/services/hiveidApi';
import {
  clearHiveIDSession,
  getDisplayName,
  readHiveIDSession,
  writeHiveIDSession,
  type HiveIDSession,
} from 'src/services/hiveidSession';
import { disconnectHiveIDSocket, onPersonUpdate, type PersonUpdateEvent } from 'src/services/hiveidSocket';
import {
  fetchMyProviders,
  fetchMyRegistrations,
  withdrawRegistration,
  type RegistrationSnapshot,
} from 'src/services/declarationsApi';
import { context } from 'src/common/context';
import { t } from 'src/i18n/i18n';

const SECTION_CLASS = 'chp-me-section';
const BUTTON_CLASS = 'chp-me-button';
const INPUT_CLASS = 'chp-me-input';

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
    renderLoggedOut(container, 'Please log in to see your CourtHive identity.');
    return;
  }

  const loading = document.createElement('div');
  loading.className = 'chp-me-empty';
  loading.textContent = 'Loading your CourtHive…';
  container.appendChild(loading);

  void gateAndRenderShell(container, session);
}

function renderLoggedOut(container: HTMLElement, message: string): void {
  container.replaceChildren();
  const empty = document.createElement('div');
  empty.className = 'chp-me-empty';
  empty.textContent = message;
  container.appendChild(empty);
}

// A stored token is not proof of being logged in — the server is the authority. Verify it before
// rendering the shell, so a rejected (stale/expired) token is treated as logged-out rather than
// rendering a "logged in" page whose every authenticated panel then falls back to "Sign in…".
async function gateAndRenderShell(container: HTMLElement, session: HiveIDSession): Promise<void> {
  const check = await checkHiveIDSession();
  if (!container.isConnected) return;
  if (check.status === 'expired') {
    clearHiveIDSession();
    disconnectHiveIDSocket();
    renderLoggedOut(
      container,
      'Your session has expired. Please sign in again (top right) to see your CourtHive identity.',
    );
    return;
  }
  // 'valid' → render with a live token; 'unreachable' → CFS is temporarily down, keep the session
  // and render the shell (individual panels degrade to their own "could not load" messaging).
  renderShell(container, session);
}

function renderShell(container: HTMLElement, session: HiveIDSession): void {
  container.replaceChildren();

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

  const availabilityEntry = renderAvailabilityEntrySection();
  shell.appendChild(availabilityEntry.section);

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
  input.className = INPUT_CLASS;
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
    const email = me.contactEmail || me.email || t('me.verification.yourEmail');
    if (me.emailVerifiedAt) {
      body.appendChild(statusLine(t('me.verification.verified', { email }), 'success'));
      return;
    }

    body.appendChild(statusLine(t('me.verification.notVerified', { email }), 'warn'));

    const message = document.createElement('div');
    const editor = buildEmailEditor(email, message, () => void refresh());

    const actions = document.createElement('div');
    actions.className = 'chp-me-verification-actions';

    const resendBtn = document.createElement('button');
    resendBtn.type = 'button';
    resendBtn.className = BUTTON_CLASS;
    resendBtn.textContent = t('me.verification.resend');
    resendBtn.onclick = () => void doResendVerification(resendBtn, message, refresh);

    // A never-verified email can be corrected in place — the user may have mistyped
    // it at signup. Saving clears verified status server-side and re-sends the mail.
    const editBtn = document.createElement('button');
    editBtn.type = 'button';
    editBtn.className = BUTTON_CLASS;
    editBtn.textContent = 'Change email';
    editBtn.onclick = () => editor.toggle();

    actions.append(resendBtn, editBtn);
    body.append(actions, editor.root, message);
  }

  return { section, refresh };
}

const VERIFICATION_COLORS: Record<'success' | 'warn' | 'error', string> = {
  success: 'var(--chc-status-success)',
  warn: 'var(--chc-status-warning)',
  error: 'var(--chc-status-error)',
};

function showVerificationMessage(el: HTMLElement, text: string, kind: 'success' | 'warn' | 'error'): void {
  el.replaceChildren();
  const p = document.createElement('p');
  p.textContent = text;
  p.style.margin = '0.5rem 0 0';
  p.style.fontSize = '0.9rem';
  p.style.color = VERIFICATION_COLORS[kind];
  el.appendChild(p);
}

async function doResendVerification(
  btn: HTMLButtonElement,
  message: HTMLElement,
  refresh: () => Promise<void>,
): Promise<void> {
  btn.disabled = true;
  try {
    const res = await resendHiveIDVerification();
    if (res?.status === 'already_verified') {
      await refresh();
      return;
    }
    showVerificationMessage(message, t('me.verification.sent'), 'success');
  } catch (err) {
    console.warn('[hiveid verification] resend failed:', err);
    showVerificationMessage(message, t('me.verification.sendFailed'), 'error');
    btn.disabled = false;
  }
}

// Inline editor for a never-verified email. Hidden until the user chooses to change
// it; saving delegates to the CFS hiveid endpoint (re-sends verification) and refreshes.
function buildEmailEditor(
  currentEmail: string,
  message: HTMLElement,
  onSaved: () => void,
): { root: HTMLElement; toggle: () => void } {
  const root = document.createElement('form');
  root.className = 'chp-me-email-editor';
  root.hidden = true;

  const input = document.createElement('input');
  input.type = 'email';
  input.className = INPUT_CLASS;
  input.value = currentEmail;
  input.placeholder = 'you@example.com';

  const save = document.createElement('button');
  save.type = 'submit';
  save.className = BUTTON_CLASS;
  save.textContent = 'Save email';

  root.append(input, save);
  root.onsubmit = (e) => {
    e.preventDefault();
    void saveContactEmail(input, save, message, onSaved);
  };

  return {
    root,
    toggle: () => {
      root.hidden = !root.hidden;
      if (!root.hidden) input.focus();
    },
  };
}

async function saveContactEmail(
  input: HTMLInputElement,
  save: HTMLButtonElement,
  message: HTMLElement,
  onSaved: () => void,
): Promise<void> {
  const email = input.value.trim();
  if (!email) {
    showVerificationMessage(message, 'Enter an email address.', 'error');
    return;
  }
  save.disabled = true;
  try {
    const res = await setMyContactEmail(email);
    if (!res || res.error) {
      showVerificationMessage(message, res?.error ?? 'Could not update your email. Please try again.', 'error');
      save.disabled = false;
      return;
    }
    onSaved();
  } catch (err) {
    console.warn('[hiveid verification] email update failed:', err);
    showVerificationMessage(message, 'Could not update your email. Please try again.', 'error');
    save.disabled = false;
  }
}

// Availability entry point. The /me hub isn't provider-scoped, but availability
// is keyed per person+provider — so the player picks a provider (prefilled from
// the last one they browsed) and we navigate to the provider-scoped page. A
// richer server-driven "my providers" list is a follow-up.
function renderAvailabilityEntrySection(): { section: HTMLElement } {
  const section = document.createElement('section');
  section.className = SECTION_CLASS;
  const sectionTitle = document.createElement('h2');
  sectionTitle.textContent = 'Availability';
  section.appendChild(sectionTitle);

  const intro = document.createElement('p');
  intro.className = 'chp-me-intro';
  intro.textContent = 'Tell a provider which days you can play, so they can schedule your matches around you.';
  section.appendChild(intro);

  const form = document.createElement('form');
  form.className = 'chp-me-claim-form';

  // The field starts as a text input (so it works even if the directory is empty
  // or unreachable) and upgrades to a name-based dropdown once providers load —
  // end users shouldn't have to know or type a provider's abbreviation.
  const fieldHost = document.createElement('span');
  fieldHost.className = 'chp-me-provider-field';
  const fallback = document.createElement('input');
  fallback.type = 'text';
  fallback.required = true;
  fallback.className = INPUT_CLASS;
  fallback.placeholder = 'Search or type a provider';
  if (context.providerAbbr) fallback.value = context.providerAbbr;
  fieldHost.appendChild(fallback);

  const submit = document.createElement('button');
  submit.type = 'submit';
  submit.className = BUTTON_CLASS;
  submit.textContent = 'Set availability';
  form.append(fieldHost, submit);

  let readProvider = () => fallback.value.trim().toUpperCase();
  form.onsubmit = (e) => {
    e.preventDefault();
    const provider = readProvider();
    if (provider) context.router?.navigate(`/me/availability/${encodeURIComponent(provider)}`);
  };
  section.appendChild(form);

  // "My providers" come from the declarations service (off CFS) — the providers the
  // person already has registrations / availability / consent with. Empty (or the
  // service is unreachable) → keep the text input.
  void fetchMyProviders().then((providers) => {
    if (!providers.length) return;
    const select = buildProviderSelect(providers, context.providerAbbr);
    fieldHost.replaceChildren(select);
    readProvider = () => select.value.trim().toUpperCase();
  });

  return { section };
}

function buildProviderSelect(providers: string[], preselect?: string): HTMLSelectElement {
  const select = document.createElement('select');
  select.required = true;
  select.className = INPUT_CLASS;
  const placeholder = document.createElement('option');
  placeholder.value = '';
  placeholder.textContent = 'Select a provider…';
  select.appendChild(placeholder);
  const wanted = (preselect ?? '').toUpperCase();
  for (const providerId of [...providers].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))) {
    const opt = document.createElement('option');
    opt.value = providerId;
    opt.textContent = providerId;
    if (providerId.toUpperCase() === wanted) opt.selected = true;
    select.appendChild(opt);
  }
  return select;
}

// courthive-declarations REGISTRATION statuses → the panel's display statuses.
const REGISTRATION_STATUS_MAP: Record<string, RegistrationStatus> = {
  SUBMITTED: 'applied',
  ACCEPTED: 'accepted',
  WAITLISTED: 'waitlisted',
  REJECTED: 'rejected',
  WITHDRAWN: 'withdrawn',
};

interface MeRegistrationRow {
  provider: string;
  tournamentId: string;
  status: RegistrationStatus;
  eventIds: string[];
  appliedAt: string;
}

function toRow(snap: RegistrationSnapshot): MeRegistrationRow {
  return {
    provider: snap.providerId,
    tournamentId: snap.tournamentId ?? '',
    status: REGISTRATION_STATUS_MAP[snap.status] ?? 'applied',
    eventIds: Array.isArray(snap.payload?.eventIds) ? snap.payload.eventIds : [],
    appliedAt: snap.updatedAt,
  };
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
      // Registrations live in the declarations service (off the mutation server),
      // keyed per person+provider — aggregate across the person's providers.
      const providers = await fetchMyProviders();
      const perProvider = await Promise.all(providers.map((p) => fetchMyRegistrations(p).catch(() => [])));
      const rows = perProvider.flat().map(toRow).filter((r) => r.tournamentId);
      if (!rows.length) {
        body.textContent = 'You have no tournament registrations yet.';
        return;
      }
      body.replaceChildren();
      const list = document.createElement('ul');
      list.className = 'chp-me-list';
      for (const row of rows) {
        list.appendChild(buildRegistrationRow(row, refresh));
      }
      body.appendChild(list);
    } catch (err) {
      console.warn('[registrations] fetch failed:', err);
      body.textContent = 'Could not load your registrations. Please try again later.';
    }
  }

  return { section, refresh };
}

function buildRegistrationRow(row: MeRegistrationRow, refresh: () => Promise<void>): HTMLElement {
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
  nameLink.href = `#/tournament/${encodeURIComponent(row.tournamentId)}`;
  nameLink.textContent = row.tournamentId;
  titleRow.appendChild(nameLink);
  titleRow.appendChild(buildStatusPill(row.status));
  main.appendChild(titleRow);

  const meta = document.createElement('div');
  meta.className = 'chp-me-list-meta';
  meta.appendChild(makeMetaSpan(`Applied ${row.appliedAt.slice(0, 10)}`));
  if (row.eventIds.length) {
    meta.appendChild(makeMetaSpan(`${row.eventIds.length} event${row.eventIds.length === 1 ? '' : 's'}`));
  }
  main.appendChild(meta);
  li.appendChild(main);

  if (canWithdraw(row.status)) {
    const withdraw = document.createElement('button');
    withdraw.type = 'button';
    withdraw.className = BUTTON_CLASS;
    withdraw.textContent = 'Withdraw';
    withdraw.onclick = async () => {
      withdraw.disabled = true;
      try {
        await withdrawRegistration(row.provider, row.tournamentId);
        await refresh();
      } catch (err) {
        console.warn('[registrations] withdraw failed:', err);
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
