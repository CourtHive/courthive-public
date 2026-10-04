/**
 * /#/register/:tournamentId — public tournament registration page.
 *
 * Renders from a sanctioning **proposal** (via the AMS public read), so the page
 * works BEFORE the tournamentRecord exists. A signed-in person selects events and
 * submits a REGISTRATION declaration to the declarations service (off CFS); the
 * TD accepts later, which is the only CFS touch.
 *
 * A brand-new person onboards **inline** on this page (step 5): a consent notice +
 * checkbox FIRST (decision #4 — DOB/sex only after consent), then email/name/DOB/sex
 * → CFS signup carrying the tournament's `provider` so courthive-persons dedupes on
 * name+DOB+sex or MINTS a canonical person anchored to that provider. On success the
 * session is written, consent is recorded to the declarations service (keyed by the
 * new personId; a minor reveals a guardian step), and the person can register. The
 * embedded HiveID component also offers a "Log in" tab for returning users.
 */
import './register.css';

import { fetchProposalRegistration, type ProposalRegistrationView } from 'src/services/amsApi';
import { readHiveIDSession, writeHiveIDSession } from 'src/services/hiveidSession';
import { connectHiveIDSocket } from 'src/services/hiveidSocket';
import { buildHiveIDLogin } from 'courthive-components';
import { getCfsBaseUrl } from 'src/services/hiveidApi';
import {
  fetchMyRegistration,
  recordMyConsent,
  submitRegistration,
  withdrawRegistration,
  createPartnerInvite,
  type RegistrationSnapshot,
} from 'src/services/declarationsApi';

// The authoritative consent version is a legal deliverable; 'v1' is a placeholder
// until legal owns the policy text (COURTHIVE_PUBLIC_PRIVACY_AND_CONSENT).
const CONSENT_VERSION = 'v1';
const PARENTAL_CONSENT_REQUIRED = 'PARENTAL_CONSENT_REQUIRED';

export function renderProposalRegistration(container: HTMLElement, tournamentId: string): void {
  container.replaceChildren();
  const shell = document.createElement('div');
  shell.className = 'chp-reg-shell';
  const body = document.createElement('div');
  body.className = 'chp-reg-body';
  body.textContent = 'Loading…';
  shell.appendChild(body);
  container.appendChild(shell);
  void load(body, tournamentId);
}

async function load(body: HTMLElement, tournamentId: string): Promise<void> {
  let view: ProposalRegistrationView | null = null;
  try {
    view = await fetchProposalRegistration(tournamentId);
  } catch (err) {
    console.warn('[register] proposal fetch failed:', err);
  }
  body.replaceChildren();
  if (!view || !view.registration?.entriesOpen) {
    body.appendChild(buildEmpty('Registration is not open for this tournament.'));
    return;
  }
  body.appendChild(buildHeader(view));
  body.appendChild(buildInfo(view));
  await buildForm(body, view, tournamentId);
}

function buildHeader(view: ProposalRegistrationView): HTMLElement {
  const header = document.createElement('div');
  header.className = 'chp-reg-header';
  const title = document.createElement('h1');
  title.className = 'chp-reg-title';
  title.textContent = view.tournamentName;
  const dates = document.createElement('div');
  dates.className = 'chp-reg-dates';
  dates.textContent =
    view.proposedStartDate === view.proposedEndDate
      ? view.proposedStartDate
      : `${view.proposedStartDate} → ${view.proposedEndDate}`;
  header.append(title, dates);
  return header;
}

function buildInfo(view: ProposalRegistrationView): HTMLElement {
  const info = document.createElement('div');
  info.className = 'chp-reg-info';
  const r = view.registration;
  if (r.entriesClose) info.appendChild(infoLine('Entries close', r.entriesClose));
  if (r.entryMethod) info.appendChild(infoLine('Entry method', r.entryMethod));
  if (r.eligibilityNotes) info.appendChild(infoLine('Eligibility', r.eligibilityNotes));
  return info;
}

async function buildForm(body: HTMLElement, view: ProposalRegistrationView, tournamentId: string): Promise<void> {
  const provider = view.provider ?? '';

  if (!provider) {
    body.appendChild(buildEmpty('This tournament has no provider — registration is unavailable.'));
    return;
  }
  const session = readHiveIDSession();
  if (!session?.token) {
    buildCreateAccountPanel(body, view, tournamentId, provider);
    return;
  }
  await buildRegistrationForm(body, view, tournamentId, provider);
}

async function buildRegistrationForm(
  body: HTMLElement,
  view: ProposalRegistrationView,
  tournamentId: string,
  provider: string,
): Promise<void> {
  let existing: RegistrationSnapshot | null = null;
  try {
    existing = await fetchMyRegistration(provider, tournamentId);
  } catch (err) {
    console.warn('[register] existing registration fetch failed:', err);
  }
  const alreadyRegistered = !!existing && existing.status !== 'WITHDRAWN';
  const selected = new Set<string>(alreadyRegistered ? (existing?.payload?.eventIds ?? []) : []);

  const form = document.createElement('form');
  form.className = 'chp-reg-form';

  const eventsWrap = document.createElement('fieldset');
  eventsWrap.className = 'chp-reg-events';
  const legend = document.createElement('legend');
  legend.textContent = 'Events';
  eventsWrap.appendChild(legend);
  for (const ev of view.events) {
    eventsWrap.appendChild(buildEventCheckbox(ev, selected));
  }
  form.appendChild(eventsWrap);

  // Doubles partner nomination — for a selected doubles event, invite a partner by
  // email (creates a PARTNER_INVITE + links partnerInviteId). One pairing per
  // registration; shown only when the proposal has a doubles event.
  const partnerState = { email: '' };
  if (view.events.some((e) => e.eventType === 'DOUBLES')) {
    form.appendChild(buildPartnerField(partnerState));
  }

  const status = document.createElement('div');
  status.className = 'chp-reg-status';
  status.dataset.kind = 'idle';
  if (alreadyRegistered) {
    status.textContent = `Registered (${existing?.status?.toLowerCase()}).`;
    status.dataset.kind = 'saved';
  }

  const actions = document.createElement('div');
  actions.className = 'chp-reg-actions';
  const submit = document.createElement('button');
  submit.type = 'submit';
  submit.className = 'chp-reg-button';
  submit.textContent = alreadyRegistered ? 'Update registration' : 'Register';
  actions.appendChild(submit);
  if (alreadyRegistered) actions.appendChild(buildWithdrawButton(provider, tournamentId, status, body, view));

  form.append(status, actions);
  form.onsubmit = (e) => {
    e.preventDefault();
    void doSubmit({ provider, tournamentId, selected, status, submit, events: view.events, partnerState });
  };
  body.appendChild(form);
}

// ---------------------------------------------------------------------------
//  Inline create-account (onboarding step 5) — consent-first, then mint-on-signup
// ---------------------------------------------------------------------------

function buildCreateAccountPanel(
  body: HTMLElement,
  view: ProposalRegistrationView,
  tournamentId: string,
  provider: string,
): void {
  const panel = document.createElement('div');
  panel.className = 'chp-reg-create';

  const intro = document.createElement('p');
  intro.className = 'chp-reg-create-intro';
  intro.textContent =
    'New to CourtHive? Create your player identity to register. Already have an account? Use the “Log in” tab below.';
  panel.appendChild(intro);

  // Consent notice + checkbox FIRST — decision #4: DOB/sex are collected only after
  // the collection notice is acknowledged. The persisted consent record is written
  // after signup (it is keyed by the personId the mint returns).
  const notice = document.createElement('p');
  notice.className = 'chp-reg-consent-notice';
  notice.textContent =
    `To create your player record we collect your name, email, date of birth, and sex. Your date of birth ` +
    `and sex are used to find or create your unique player identity and are shared with ${provider} to manage ` +
    `your entry. If you are under age, a parent or guardian must consent on your behalf.`;
  panel.appendChild(notice);

  const consent = buildCheckbox('I have read the notice and consent to CourtHive collecting this information.');
  panel.appendChild(consent.wrap);

  const shellHost = document.createElement('div');
  shellHost.className = 'chp-reg-create-shell';
  shellHost.hidden = true;

  const gate = document.createElement('p');
  gate.className = 'chp-reg-create-gate';
  gate.textContent = 'Please acknowledge the notice above to continue.';

  const message = document.createElement('div');
  message.className = 'chp-reg-message';
  message.hidden = true;

  panel.append(shellHost, gate, message);

  let mounted = false;
  consent.input.onchange = () => {
    const ok = consent.input.checked;
    shellHost.hidden = !ok;
    gate.hidden = ok;
    if (ok && !mounted) {
      mountCreateAccountShell(shellHost, view, tournamentId, provider, body, message);
      mounted = true;
    }
  };

  body.appendChild(panel);
}

function mountCreateAccountShell(
  host: HTMLElement,
  view: ProposalRegistrationView,
  tournamentId: string,
  provider: string,
  body: HTMLElement,
  message: HTMLElement,
): void {
  const shell = buildHiveIDLogin({
    cfsBaseUrl: getCfsBaseUrl(),
    mode: 'signup',
    provider,
    dobSexCapture: {
      note: 'Your date of birth and sex help us find or create your player record.',
    },
    federationIdCapture: {
      providers: [{ value: provider, label: provider }],
      idLabel: `${provider} Player ID (optional)`,
      note: `Already have a ${provider} player ID? Enter it to link your existing record instead.`,
    },
  });
  host.appendChild(shell.root);
  shell.onAuthenticated((detail) => {
    writeHiveIDSession(detail);
    connectHiveIDSocket();
    void afterSignupConsent(body, view, tournamentId, provider, detail.cached?.birthDate ?? undefined, message);
  });
}

// After signup the session carries a personId, so consent can be recorded. A minor
// (service replies PARENTAL_CONSENT_REQUIRED) is routed to a guardian step; anything
// else lets them proceed to the registration form.
async function afterSignupConsent(
  body: HTMLElement,
  view: ProposalRegistrationView,
  tournamentId: string,
  provider: string,
  birthDate: string | undefined,
  message: HTMLElement,
): Promise<void> {
  try {
    await recordMyConsent(provider, { consentVersion: CONSENT_VERSION, birthDate });
    await buildForm(clearBody(body, view), view, tournamentId);
  } catch (err) {
    const code = err instanceof Error ? err.message : String(err);
    if (code === PARENTAL_CONSENT_REQUIRED) {
      renderGuardianStep(body, view, tournamentId, provider, birthDate);
    } else {
      showMessage(message, `Account created, but consent could not be recorded: ${code}`, 'error');
    }
  }
}

function renderGuardianStep(
  body: HTMLElement,
  view: ProposalRegistrationView,
  tournamentId: string,
  provider: string,
  birthDate: string | undefined,
): void {
  const region = clearBody(body, view);
  const form = document.createElement('form');
  form.className = 'chp-reg-guardian';

  const notice = document.createElement('p');
  notice.className = 'chp-reg-consent-notice';
  notice.textContent =
    'You appear to be under age. A parent or guardian must provide their email to consent on your behalf ' +
    'before you can register.';

  const name = buildTextInput('Guardian name');
  const email = buildTextInput('Guardian email');
  email.input.type = 'email';

  const message = document.createElement('div');
  message.className = 'chp-reg-message';
  message.hidden = true;

  const submit = document.createElement('button');
  submit.type = 'submit';
  submit.className = 'chp-reg-button';
  submit.textContent = 'Confirm guardian consent';

  form.append(notice, name.wrap, email.wrap, message, submit);
  form.onsubmit = (e) => {
    e.preventDefault();
    void submitGuardianConsent({
      provider,
      tournamentId,
      view,
      body,
      birthDate,
      guardian: { name: name.input.value.trim(), email: email.input.value.trim() },
      message,
      submit,
    });
  };
  region.appendChild(form);
}

async function submitGuardianConsent(args: {
  provider: string;
  tournamentId: string;
  view: ProposalRegistrationView;
  body: HTMLElement;
  birthDate: string | undefined;
  guardian: { name?: string; email?: string };
  message: HTMLElement;
  submit: HTMLButtonElement;
}): Promise<void> {
  const { provider, tournamentId, view, body, birthDate, guardian, message, submit } = args;
  if (!guardian.email) {
    showMessage(message, 'A guardian email is required.', 'error');
    return;
  }
  submit.disabled = true;
  try {
    await recordMyConsent(provider, { consentVersion: CONSENT_VERSION, birthDate, guardian });
    await buildForm(clearBody(body, view), view, tournamentId);
  } catch (err) {
    const code = err instanceof Error ? err.message : String(err);
    showMessage(message, `Could not record consent: ${code}`, 'error');
    submit.disabled = false;
  }
}

function buildEventCheckbox(ev: ProposalRegistrationView['events'][number], selected: Set<string>): HTMLElement {
  const label = document.createElement('label');
  label.className = 'chp-reg-event';
  // Store the stable eventId when present (id-join at accept); fall back to the event name for
  // proposals opened before eventId threading. CFS resolveAcceptedEventIds accepts either.
  const eventKey = ev.eventId ?? ev.eventName;
  const input = document.createElement('input');
  input.type = 'checkbox';
  input.checked = selected.has(eventKey);
  input.onchange = () => {
    if (input.checked) selected.add(eventKey);
    else selected.delete(eventKey);
  };
  const text = document.createElement('span');
  const meta = [ev.eventType, ev.gender].filter(Boolean).join(' · ');
  text.textContent = meta ? `${ev.eventName} (${meta})` : ev.eventName;
  label.append(input, text);
  return label;
}

function buildPartnerField(partnerState: { email: string }): HTMLElement {
  const wrap = document.createElement('fieldset');
  wrap.className = 'chp-reg-partner';
  const legend = document.createElement('legend');
  legend.textContent = 'Doubles partner (optional)';
  const hint = document.createElement('p');
  hint.className = 'chp-reg-hint';
  hint.textContent = 'For a doubles event, invite your partner by email — they confirm and register from a link.';
  const input = document.createElement('input');
  input.type = 'email';
  input.className = 'chp-reg-input';
  input.placeholder = "partner's email";
  input.oninput = () => {
    partnerState.email = input.value.trim();
  };
  wrap.append(legend, hint, input);
  return wrap;
}

// If a partner email was supplied and a doubles event is selected, create the invite
// for the FIRST selected doubles event and return its id to link on the registration.
async function maybeCreatePartnerInvite(args: {
  provider: string;
  tournamentId: string;
  events: ProposalRegistrationView['events'];
  selected: Set<string>;
  partnerState: { email: string };
}): Promise<string | undefined> {
  const { provider, tournamentId, events, selected, partnerState } = args;
  if (!partnerState.email) return undefined;
  const doubles = events.find((e) => e.eventType === 'DOUBLES' && selected.has(e.eventId ?? e.eventName));
  if (!doubles) return undefined;
  const invite = await createPartnerInvite(provider, {
    tournamentId,
    event: doubles.eventName,
    eventId: doubles.eventId ?? null,
    inviteeEmail: partnerState.email,
  });
  return invite.declarationId;
}

async function doSubmit(args: {
  provider: string;
  tournamentId: string;
  selected: Set<string>;
  status: HTMLElement;
  submit: HTMLButtonElement;
  events: ProposalRegistrationView['events'];
  partnerState: { email: string };
}): Promise<void> {
  const { provider, tournamentId, selected, status, submit, events, partnerState } = args;
  const eventIds = [...selected];
  if (!eventIds.length) {
    showStatus(status, 'Select at least one event.', 'error');
    return;
  }
  submit.disabled = true;
  showStatus(status, 'Submitting…', 'saving');
  try {
    const partnerInviteId = await maybeCreatePartnerInvite({ provider, tournamentId, events, selected, partnerState });
    await submitRegistration(provider, tournamentId, partnerInviteId ? { eventIds, partnerInviteId } : { eventIds });
    showStatus(
      status,
      partnerInviteId
        ? "Registered — we've emailed your partner to confirm the pairing."
        : 'Registered — the tournament director will review your entry.',
      'saved',
    );
  } catch (err) {
    const code = err instanceof Error ? err.message : String(err);
    showStatus(status, `Could not register: ${code}`, 'error');
    submit.disabled = false;
  }
}

function buildWithdrawButton(
  provider: string,
  tournamentId: string,
  status: HTMLElement,
  body: HTMLElement,
  view: ProposalRegistrationView,
): HTMLElement {
  const withdraw = document.createElement('button');
  withdraw.type = 'button';
  withdraw.className = 'chp-reg-button chp-reg-button-secondary';
  withdraw.textContent = 'Withdraw';
  withdraw.onclick = async () => {
    withdraw.disabled = true;
    try {
      await withdrawRegistration(provider, tournamentId);
      await buildForm(clearBody(body, view), view, tournamentId);
    } catch (err) {
      const code = err instanceof Error ? err.message : String(err);
      showStatus(status, `Could not withdraw: ${code}`, 'error');
      withdraw.disabled = false;
    }
  };
  return withdraw;
}

// Rebuild the form region after a withdraw (keep header + info).
function clearBody(body: HTMLElement, view: ProposalRegistrationView): HTMLElement {
  body.replaceChildren();
  body.appendChild(buildHeader(view));
  body.appendChild(buildInfo(view));
  return body;
}

function infoLine(label: string, value: string): HTMLElement {
  const line = document.createElement('div');
  line.className = 'chp-reg-info-line';
  const k = document.createElement('span');
  k.className = 'chp-reg-info-label';
  k.textContent = label;
  const v = document.createElement('span');
  v.textContent = value;
  line.append(k, v);
  return line;
}

function buildEmpty(text: string): HTMLElement {
  const empty = document.createElement('div');
  empty.className = 'chp-reg-empty';
  empty.textContent = text;
  return empty;
}

function buildCheckbox(labelText: string): { wrap: HTMLElement; input: HTMLInputElement } {
  const wrap = document.createElement('label');
  wrap.className = 'chp-reg-check';
  const input = document.createElement('input');
  input.type = 'checkbox';
  const span = document.createElement('span');
  span.textContent = labelText;
  wrap.append(input, span);
  return { wrap, input };
}

function buildTextInput(placeholder: string): { wrap: HTMLElement; input: HTMLInputElement } {
  const wrap = document.createElement('div');
  wrap.className = 'chp-reg-field';
  const input = document.createElement('input');
  input.type = 'text';
  input.placeholder = placeholder;
  input.className = 'chp-reg-input';
  wrap.appendChild(input);
  return { wrap, input };
}

function showMessage(el: HTMLElement, text: string, kind: 'info' | 'error' | 'success'): void {
  el.textContent = text;
  el.dataset.kind = kind;
  el.hidden = !text;
}

function showStatus(el: HTMLElement, text: string, kind: 'idle' | 'saving' | 'saved' | 'error'): void {
  el.textContent = text;
  el.dataset.kind = kind;
}
