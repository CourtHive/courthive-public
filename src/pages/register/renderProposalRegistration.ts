/**
 * /#/register/:tournamentId — public tournament registration page.
 *
 * Renders from a sanctioning **proposal** (via the AMS public read), so the page
 * works BEFORE the tournamentRecord exists. A signed-in person selects events and
 * submits a REGISTRATION declaration to the declarations service (off CFS); the
 * TD accepts later, which is the only CFS touch. Inline create-account for a
 * brand-new person is a follow-up (onboarding step); today an unauthenticated
 * visitor is prompted to sign in.
 */
import './register.css';

import { fetchProposalRegistration, type ProposalRegistrationView } from 'src/services/amsApi';
import {
  fetchMyRegistration,
  submitRegistration,
  withdrawRegistration,
  type RegistrationSnapshot,
} from 'src/services/declarationsApi';
import { readHiveIDSession } from 'src/services/hiveidSession';

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
  const session = readHiveIDSession();
  const provider = view.provider ?? '';

  if (!session?.token) {
    body.appendChild(buildEmpty('Please sign in (top right) to register for this tournament.'));
    return;
  }
  if (!provider) {
    body.appendChild(buildEmpty('This tournament has no provider — registration is unavailable.'));
    return;
  }

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
    void doSubmit(provider, tournamentId, selected, status, submit);
  };
  body.appendChild(form);
}

function buildEventCheckbox(ev: ProposalRegistrationView['events'][number], selected: Set<string>): HTMLElement {
  const label = document.createElement('label');
  label.className = 'chp-reg-event';
  const input = document.createElement('input');
  input.type = 'checkbox';
  input.checked = selected.has(ev.eventName);
  input.onchange = () => {
    if (input.checked) selected.add(ev.eventName);
    else selected.delete(ev.eventName);
  };
  const text = document.createElement('span');
  const meta = [ev.eventType, ev.gender].filter(Boolean).join(' · ');
  text.textContent = meta ? `${ev.eventName} (${meta})` : ev.eventName;
  label.append(input, text);
  return label;
}

async function doSubmit(
  provider: string,
  tournamentId: string,
  selected: Set<string>,
  status: HTMLElement,
  submit: HTMLButtonElement,
): Promise<void> {
  const eventIds = [...selected];
  if (!eventIds.length) {
    showStatus(status, 'Select at least one event.', 'error');
    return;
  }
  submit.disabled = true;
  showStatus(status, 'Submitting…', 'saving');
  try {
    await submitRegistration(provider, tournamentId, { eventIds });
    showStatus(status, 'Registered — the tournament director will review your entry.', 'saved');
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

function showStatus(el: HTMLElement, text: string, kind: 'idle' | 'saving' | 'saved' | 'error'): void {
  el.textContent = text;
  el.dataset.kind = kind;
}
