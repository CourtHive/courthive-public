/**
 * Public-side registration submit button + modal.
 *
 * Renders inside the Entry & Eligibility block of the Info tab. Decides
 * which CTA to show via `resolveEligibility`, then drives the modal
 * that collects event picks + optional partner and submits to
 * `POST /me/registrations` via the existing `applyForTournament`
 * helper.
 *
 * Phase 1 scope (deliberate omissions):
 *   - No fee calculator. The fees panel is already displayed
 *     server-side; the submit doesn't compute totals.
 *   - No payment hook. Payment lives in Phase 3.
 *   - Partner picker is a free-form email field — no HiveID lookup
 *     or invite roundtrip. If the user knows their partner's HiveID
 *     userId they paste it; otherwise leave blank and the director
 *     pairs manually on the TMX side.
 *   - No eligibility predicates (gender / age category). Server-side
 *     validation will eventually surface these; today the form lets
 *     the user submit and the server is the truth source.
 */
import './registrationButton.css';

import { cModal } from 'courthive-components';

import {
  applyForTournament,
  fetchMyRegistrations,
  type RegistrationEntry,
} from 'src/services/hiveidApi';
import { context } from 'src/common/context';
import { getDisplayName, isAuthenticated, readHiveIDSession } from 'src/services/hiveidSession';
import { resolveEligibility, type EligibilityOutcome } from './registrationEligibility';

interface TournamentEventInfo {
  eventId?: string;
  eventName?: string;
  eventType?: string;
  gender?: string;
}

interface RenderInput {
  tournamentId: string;
  tournamentName?: string;
  registrationProfile?: {
    entriesOpen?: string | null;
    entriesClose?: string | null;
  } | null;
  eventInfo?: TournamentEventInfo[];
}

export async function renderRegisterButton(input: RenderInput): Promise<HTMLElement | null> {
  if (!input.tournamentId) return null;
  if (!input.registrationProfile?.entriesOpen) return null;

  const existing = await safelyFetchExisting(input.tournamentId);
  const outcome = resolveEligibility({
    registrationProfile: input.registrationProfile,
    eventInfo: input.eventInfo,
    isAuthenticated: isAuthenticated(),
    existingRegistration: existing,
  });

  if (outcome === 'hidden') return null;
  return buildButton(input, outcome, existing);
}

async function safelyFetchExisting(tournamentId: string): Promise<RegistrationEntry | null> {
  if (!isAuthenticated()) return null;
  try {
    const all = await fetchMyRegistrations();
    if (!all) return null;
    return all.find((r) => r.tournamentId === tournamentId) ?? null;
  } catch (err) {
    console.warn('[registrationButton] fetchMyRegistrations failed:', err);
    return null;
  }
}

function buildButton(
  input: RenderInput,
  outcome: EligibilityOutcome,
  existing: RegistrationEntry | null,
): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'chp-register-cta';

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'chp-register-button';

  switch (outcome) {
    case 'sign-in-required':
      btn.textContent = 'Sign in to register';
      btn.disabled = true;
      wrap.appendChild(btn);
      appendHint(wrap, 'Use the user icon in the navbar to sign in with HiveID.');
      return wrap;

    case 'not-yet-open':
      btn.textContent = 'Entries not yet open';
      btn.disabled = true;
      wrap.appendChild(btn);
      return wrap;

    case 'closed':
      btn.textContent = 'Entries closed';
      btn.disabled = true;
      wrap.appendChild(btn);
      return wrap;

    case 'already-registered':
      btn.textContent = existing ? `Registered (${existing.status})` : 'Already registered';
      btn.disabled = false;
      btn.onclick = () => context.router?.navigate('/me');
      wrap.appendChild(btn);
      appendHint(wrap, 'Click to manage your registration at My CourtHive.');
      return wrap;

    case 'open':
    default:
      btn.textContent = 'Register for this tournament';
      btn.onclick = () => openRegistrationModal(input);
      wrap.appendChild(btn);
      return wrap;
  }
}

function appendHint(wrap: HTMLElement, text: string): void {
  const hint = document.createElement('div');
  hint.className = 'chp-register-hint';
  hint.textContent = text;
  wrap.appendChild(hint);
}

interface FormState {
  selectedEventIds: Set<string>;
  partnerUserId: string;
}

function openRegistrationModal(input: RenderInput): void {
  const session = readHiveIDSession();
  if (!session) return;

  const state: FormState = {
    selectedEventIds: new Set(),
    partnerUserId: '',
  };

  let messageEl: HTMLElement | null = null;
  let submitButton: HTMLButtonElement | null = null;

  const content = (elem: HTMLElement) => {
    const form = document.createElement('form');
    form.className = 'chp-register-form';
    form.noValidate = true;

    appendIdentityBlock(form, session);
    appendEventCheckboxes(form, input.eventInfo ?? [], state);
    appendPartnerInput(form, state);

    const message = document.createElement('div');
    message.className = 'chp-register-message';
    message.hidden = true;
    form.appendChild(message);
    messageEl = message;

    const actions = document.createElement('div');
    actions.className = 'chp-register-actions';
    const submit = document.createElement('button');
    submit.type = 'submit';
    submit.className = 'chp-register-submit';
    submit.textContent = 'Submit registration';
    actions.appendChild(submit);
    submitButton = submit;
    form.appendChild(actions);

    form.onsubmit = (ev) => {
      ev.preventDefault();
      void submitRegistration({ input, state, messageEl, submitButton });
    };

    elem.appendChild(form);
  };

  cModal.open({
    title: `Register — ${input.tournamentName ?? input.tournamentId}`,
    content,
    buttons: [{ label: 'Cancel', close: true }],
    config: { maxWidth: 520 },
  });
}

function appendIdentityBlock(form: HTMLElement, session: ReturnType<typeof readHiveIDSession>): void {
  if (!session) return;
  const block = document.createElement('div');
  block.className = 'chp-register-identity';
  const name = document.createElement('div');
  name.className = 'chp-register-identity-name';
  name.textContent = getDisplayName(session) || 'HiveID user';
  block.appendChild(name);
  if (session.cached.birthDate || session.cached.nationalityCode) {
    const meta = document.createElement('div');
    meta.className = 'chp-register-identity-meta';
    const parts = [
      session.cached.birthDate ? `DOB ${session.cached.birthDate}` : '',
      session.cached.sex,
      session.cached.nationalityCode,
    ].filter(Boolean);
    meta.textContent = parts.join(' · ');
    block.appendChild(meta);
  }
  form.appendChild(block);
}

function appendEventCheckboxes(
  form: HTMLElement,
  events: TournamentEventInfo[],
  state: FormState,
): void {
  const fieldset = document.createElement('fieldset');
  fieldset.className = 'chp-register-fieldset';
  const legend = document.createElement('legend');
  legend.textContent = 'Events';
  fieldset.appendChild(legend);

  for (const ev of events) {
    if (!ev.eventId) continue;
    const row = document.createElement('label');
    row.className = 'chp-register-event-row';
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.value = ev.eventId;
    cb.onchange = () => {
      if (cb.checked) state.selectedEventIds.add(ev.eventId!);
      else state.selectedEventIds.delete(ev.eventId!);
    };
    const label = document.createElement('span');
    label.textContent = formatEventLabel(ev);
    row.append(cb, label);
    fieldset.appendChild(row);
  }
  form.appendChild(fieldset);
}

function appendPartnerInput(form: HTMLElement, state: FormState): void {
  const wrap = document.createElement('div');
  wrap.className = 'chp-register-field';
  const lbl = document.createElement('label');
  lbl.htmlFor = 'chp-register-partner';
  lbl.textContent = 'Doubles partner (optional)';
  wrap.appendChild(lbl);
  const input = document.createElement('input');
  input.id = 'chp-register-partner';
  input.type = 'text';
  input.placeholder = "Partner's CourtHive userId or leave blank";
  input.oninput = () => {
    state.partnerUserId = input.value.trim();
  };
  wrap.appendChild(input);
  form.appendChild(wrap);
}

function formatEventLabel(ev: TournamentEventInfo): string {
  const parts: string[] = [];
  if (ev.eventName) parts.push(ev.eventName);
  if (ev.eventType) parts.push(`(${ev.eventType})`);
  if (ev.gender) parts.push(`[${ev.gender}]`);
  return parts.join(' ') || ev.eventId || '(unnamed event)';
}

async function submitRegistration(args: {
  input: RenderInput;
  state: FormState;
  messageEl: HTMLElement | null;
  submitButton: HTMLButtonElement | null;
}): Promise<void> {
  const { input, state, messageEl, submitButton } = args;
  if (!messageEl || !submitButton) return;

  if (state.selectedEventIds.size === 0) {
    showMessage(messageEl, 'Pick at least one event to enter.', 'error');
    return;
  }

  submitButton.disabled = true;
  showMessage(messageEl, 'Submitting registration…', 'info');

  try {
    const result = await applyForTournament({
      tournamentId: input.tournamentId,
      eventIds: Array.from(state.selectedEventIds),
      partnerUserId: state.partnerUserId || null,
    });
    if (!result) {
      showMessage(messageEl, 'Please sign in before submitting.', 'error');
      submitButton.disabled = false;
      return;
    }
    showMessage(messageEl, 'Registration submitted! Track its status at My CourtHive.', 'success');
    submitButton.textContent = 'Submitted';
  } catch (err) {
    const text = err instanceof Error ? err.message : String(err);
    showMessage(messageEl, `Could not submit: ${text}`, 'error');
    submitButton.disabled = false;
  }
}

function showMessage(el: HTMLElement, text: string, kind: 'info' | 'error' | 'success'): void {
  el.textContent = text;
  el.dataset.kind = kind;
  el.hidden = !text;
}
