/**
 * /#/me/availability/:providerAbbr — player availability collection surface.
 *
 * jim.tennis-shaped: a rolling ~4-week per-day grid, 4-state toggle
 * (Not set / Available / If needed / Unavailable), auto-saved to the
 * courthive-declarations service. Gated on consent — a person (and, for a
 * minor, their guardian) must consent before availability is saved.
 *
 * Provider is explicit in the route (availability is keyed per person+provider).
 */
import './availability.css';

import {
  fetchMyAvailability,
  fetchMyConsent,
  recordMyConsent,
  saveMyAvailability,
  type ConsentRecord,
  type DayState,
} from 'src/services/declarationsApi';
import { buildAvailabilityPayload, buildSpan, cycleDayState, enumerateSpanDates, groupIntoWeeks } from './availabilityGrid';
import { readHiveIDSession } from 'src/services/hiveidSession';
import { context } from 'src/common/context';

// The authoritative consent version is a legal deliverable; 'v1' is a
// placeholder until legal owns the policy text (COURTHIVE_PUBLIC_PRIVACY_AND_CONSENT).
const CONSENT_VERSION = 'v1';
const PARENTAL_CONSENT_REQUIRED = 'PARENTAL_CONSENT_REQUIRED';
const AUTOSAVE_DELAY_MS = 600;

const STATE_LABELS: Record<string, string> = {
  NOT_SET: 'Not set',
  AVAILABLE: 'Available',
  IF_NEEDED: 'If needed',
  UNAVAILABLE: 'Unavailable',
};

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function renderAvailability(container: HTMLElement, providerAbbr: string): void {
  container.replaceChildren();
  const provider = (providerAbbr || context.providerAbbr || '').toUpperCase();

  const session = readHiveIDSession();
  if (!session?.token) {
    container.appendChild(buildEmpty('Please log in to set your availability.'));
    return;
  }
  if (!provider) {
    container.appendChild(buildEmpty('No provider selected — open availability from a provider’s page.'));
    return;
  }

  const shell = document.createElement('div');
  shell.className = 'chp-avail-shell';
  const header = document.createElement('div');
  header.className = 'chp-avail-header';
  const title = document.createElement('h1');
  title.className = 'chp-avail-title';
  title.textContent = `Availability · ${provider}`;
  header.appendChild(title);
  shell.appendChild(header);

  const body = document.createElement('div');
  body.className = 'chp-avail-body';
  body.textContent = 'Loading…';
  shell.appendChild(body);
  container.appendChild(shell);

  void gateThenRender(body, provider, session.cached?.birthDate ?? undefined);
}

async function gateThenRender(body: HTMLElement, provider: string, birthDate?: string): Promise<void> {
  let consent: ConsentRecord | null = null;
  try {
    consent = await fetchMyConsent(provider);
  } catch (err) {
    console.warn('[availability] consent check failed:', err);
  }

  if (!consentSatisfied(consent)) {
    renderConsentForm(body, provider, birthDate, () => void gateThenRender(body, provider, birthDate));
    return;
  }
  await renderGrid(body, provider);
}

function consentSatisfied(consent: ConsentRecord | null): boolean {
  if (!consent || consent.revokedAt) return false;
  if (consent.isMinor && !consent.guardian?.email) return false;
  return true;
}

// ---------------------------------------------------------------------------
//  Consent gate
// ---------------------------------------------------------------------------

function renderConsentForm(body: HTMLElement, provider: string, birthDate: string | undefined, onGranted: () => void): void {
  body.replaceChildren();
  const form = document.createElement('form');
  form.className = 'chp-avail-consent';

  const notice = document.createElement('p');
  notice.className = 'chp-avail-notice';
  notice.textContent =
    'To collect your availability we need your consent. Your availability is shared with the tournament provider ' +
    'only to help schedule your matches. If you are under age, a parent or guardian must consent on your behalf.';
  form.appendChild(notice);

  const guardianWrap = buildGuardianFields();
  const agree = buildCheckbox('I consent to the collection of my availability for scheduling.');
  const message = document.createElement('div');
  message.className = 'chp-avail-message';
  message.hidden = true;

  const submit = document.createElement('button');
  submit.type = 'submit';
  submit.className = 'chp-avail-button';
  submit.textContent = 'Give consent';

  form.append(agree.wrap, guardianWrap.wrap, message, submit);

  form.onsubmit = async (e) => {
    e.preventDefault();
    message.hidden = true;
    if (!agree.input.checked) {
      showMessage(message, 'Please confirm consent to continue.', 'error');
      return;
    }
    submit.disabled = true;
    try {
      await recordMyConsent(provider, {
        consentVersion: CONSENT_VERSION,
        birthDate,
        guardian: guardianWrap.value(),
      });
      onGranted();
    } catch (err) {
      const code = err instanceof Error ? err.message : String(err);
      if (code === PARENTAL_CONSENT_REQUIRED) {
        guardianWrap.reveal();
        showMessage(message, 'You appear to be under age — a parent/guardian email is required.', 'error');
      } else {
        showMessage(message, `Could not record consent: ${code}`, 'error');
      }
      submit.disabled = false;
    }
  };

  body.appendChild(form);
}

function buildGuardianFields(): { wrap: HTMLElement; value: () => { name?: string; email?: string } | undefined; reveal: () => void } {
  const wrap = document.createElement('fieldset');
  wrap.className = 'chp-avail-guardian';
  const legend = document.createElement('legend');
  legend.textContent = 'Parent / guardian (required if under age)';
  const name = buildTextInput('Guardian name');
  const email = buildTextInput('Guardian email');
  email.input.type = 'email';
  wrap.append(legend, name.wrap, email.wrap);
  return {
    wrap,
    reveal: () => wrap.classList.add('is-required'),
    value: () => {
      const g = { name: name.input.value.trim(), email: email.input.value.trim() };
      return g.name || g.email ? g : undefined;
    },
  };
}

// ---------------------------------------------------------------------------
//  Availability grid
// ---------------------------------------------------------------------------

async function renderGrid(body: HTMLElement, provider: string): Promise<void> {
  body.replaceChildren();
  const span = buildSpan(new Date());
  const dayStates: Record<string, DayState | undefined> = {};

  try {
    const existing = await fetchMyAvailability(provider);
    if (existing?.payload?.days) Object.assign(dayStates, existing.payload.days);
  } catch (err) {
    console.warn('[availability] load failed:', err);
  }

  body.appendChild(buildLegend());

  const status = document.createElement('div');
  status.className = 'chp-avail-status';
  status.dataset.kind = 'idle';

  let saveTimer: ReturnType<typeof setTimeout> | undefined;
  const scheduleSave = () => {
    if (saveTimer) clearTimeout(saveTimer);
    status.textContent = 'Saving…';
    status.dataset.kind = 'saving';
    saveTimer = setTimeout(() => void persist(provider, span, dayStates, status), AUTOSAVE_DELAY_MS);
  };

  const grid = document.createElement('div');
  grid.className = 'chp-avail-grid';
  const weeks = groupIntoWeeks(enumerateSpanDates(span.from, span.to));
  for (const week of weeks) {
    grid.appendChild(buildWeekRow(week, dayStates, scheduleSave));
  }
  body.append(grid, status);
}

async function persist(
  provider: string,
  span: { from: string; to: string },
  dayStates: Record<string, DayState | undefined>,
  status: HTMLElement,
): Promise<void> {
  try {
    await saveMyAvailability(provider, buildAvailabilityPayload(span, dayStates));
    status.textContent = 'Saved';
    status.dataset.kind = 'saved';
  } catch (err) {
    const code = err instanceof Error ? err.message : String(err);
    status.textContent = `Could not save: ${code}`;
    status.dataset.kind = 'error';
  }
}

function buildWeekRow(week: string[], dayStates: Record<string, DayState | undefined>, onChange: () => void): HTMLElement {
  const row = document.createElement('div');
  row.className = 'chp-avail-week';
  for (const date of week) {
    row.appendChild(buildDayCell(date, dayStates, onChange));
  }
  return row;
}

function buildDayCell(date: string, dayStates: Record<string, DayState | undefined>, onChange: () => void): HTMLElement {
  const cell = document.createElement('button');
  cell.type = 'button';
  cell.className = 'chp-avail-day';
  const weekday = new Date(`${date}T00:00:00Z`).getUTCDay();
  applyDayState(cell, date, dayStates[date], weekday);
  cell.onclick = () => {
    const next = cycleDayState(dayStates[date]);
    if (next) dayStates[date] = next;
    else delete dayStates[date];
    applyDayState(cell, date, dayStates[date], weekday);
    onChange();
  };
  return cell;
}

function applyDayState(cell: HTMLElement, date: string, state: DayState | undefined, weekday: number): void {
  cell.dataset.state = state ?? 'NOT_SET';
  cell.setAttribute('aria-label', `${date} — ${STATE_LABELS[state ?? 'NOT_SET']}`);
  cell.replaceChildren();
  const dow = document.createElement('span');
  dow.className = 'chp-avail-day-dow';
  dow.textContent = WEEKDAY_LABELS[weekday];
  const num = document.createElement('span');
  num.className = 'chp-avail-day-num';
  num.textContent = date.slice(8, 10);
  cell.append(dow, num);
}

function buildLegend(): HTMLElement {
  const legend = document.createElement('div');
  legend.className = 'chp-avail-legend';
  for (const state of ['AVAILABLE', 'IF_NEEDED', 'UNAVAILABLE', 'NOT_SET']) {
    const item = document.createElement('span');
    item.className = 'chp-avail-legend-item';
    const swatch = document.createElement('span');
    swatch.className = 'chp-avail-legend-swatch';
    swatch.dataset.state = state;
    const label = document.createElement('span');
    label.textContent = STATE_LABELS[state];
    item.append(swatch, label);
    legend.appendChild(item);
  }
  const hint = document.createElement('span');
  hint.className = 'chp-avail-legend-hint';
  hint.textContent = 'Tap a day to cycle through states. Changes save automatically.';
  legend.appendChild(hint);
  return legend;
}

// ---------------------------------------------------------------------------
//  Small DOM helpers
// ---------------------------------------------------------------------------

function buildEmpty(text: string): HTMLElement {
  const empty = document.createElement('div');
  empty.className = 'chp-avail-empty';
  empty.textContent = text;
  return empty;
}

function buildCheckbox(labelText: string): { wrap: HTMLElement; input: HTMLInputElement } {
  const wrap = document.createElement('label');
  wrap.className = 'chp-avail-check';
  const input = document.createElement('input');
  input.type = 'checkbox';
  const span = document.createElement('span');
  span.textContent = labelText;
  wrap.append(input, span);
  return { wrap, input };
}

function buildTextInput(placeholder: string): { wrap: HTMLElement; input: HTMLInputElement } {
  const wrap = document.createElement('div');
  wrap.className = 'chp-avail-field';
  const input = document.createElement('input');
  input.type = 'text';
  input.placeholder = placeholder;
  input.className = 'chp-avail-input';
  wrap.appendChild(input);
  return { wrap, input };
}

function showMessage(el: HTMLElement, text: string, kind: 'info' | 'error' | 'success'): void {
  el.textContent = text;
  el.dataset.kind = kind;
  el.hidden = !text;
}
