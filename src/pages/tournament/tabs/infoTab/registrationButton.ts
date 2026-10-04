/**
 * Public-side registration CTA on the Info tab.
 *
 * Renders inside the Entry & Eligibility block. `resolveEligibility`
 * decides which CTA to show; the actionable "Register" state navigates
 * to `/#/register/:tournamentId` — the canonical registration page that
 * owns event selection, consent, and inline account creation.
 *
 * The existing-registration check reads the person's snapshot from the
 * courthive-declarations service (NOT the mutation server), scoped by the
 * tournament's owning provider (`parentOrganisation.organisationId`).
 * Registration itself never touches CFS pre-acceptance.
 */
import './registrationButton.css';

import { fetchMyRegistration, type RegistrationSnapshot } from 'src/services/declarationsApi';
import { resolveEligibility, type EligibilityOutcome } from './registrationEligibility';
import { isAuthenticated } from 'src/services/hiveidSession';
import { context } from 'src/common/context';

interface TournamentEventInfo {
  eventId?: string;
}

interface RenderInput {
  tournamentId: string;
  provider?: string;
  registrationProfile?: {
    entriesOpen?: string | null;
    entriesClose?: string | null;
  } | null;
  eventInfo?: TournamentEventInfo[];
}

// courthive-declarations REGISTRATION statuses → the display statuses the
// eligibility gate understands. SUBMITTED/ACCEPTED/WAITLISTED are non-terminal
// (→ "already registered"); REJECTED/WITHDRAWN are terminal, so the applicant
// may register again (→ "open"). A withdrawn/rejected snapshot is still
// returned by the service, so this mapping — not a bare truthiness check —
// preserves the re-registration path.
const DECLARATION_STATUS_LABELS: Record<string, string> = {
  SUBMITTED: 'applied',
  ACCEPTED: 'accepted',
  WAITLISTED: 'waitlisted',
  REJECTED: 'rejected',
  WITHDRAWN: 'withdrawn',
};

function displayStatus(snapshot: RegistrationSnapshot | null): string | null {
  if (!snapshot) return null;
  return DECLARATION_STATUS_LABELS[snapshot.status] ?? 'applied';
}

export async function renderRegisterButton(input: RenderInput): Promise<HTMLElement | null> {
  if (!input.tournamentId) return null;
  if (!input.registrationProfile?.entriesOpen) return null;

  const existing = await safelyFetchExisting(input.provider, input.tournamentId);
  const status = displayStatus(existing);
  const outcome = resolveEligibility({
    registrationProfile: input.registrationProfile,
    eventInfo: input.eventInfo,
    isAuthenticated: isAuthenticated(),
    existingRegistration: status ? { status } : null,
  });

  if (outcome === 'hidden') return null;
  return buildButton(input, outcome, status);
}

async function safelyFetchExisting(
  provider: string | undefined,
  tournamentId: string,
): Promise<RegistrationSnapshot | null> {
  if (!isAuthenticated()) return null;
  if (!provider) return null;
  try {
    return await fetchMyRegistration(provider, tournamentId);
  } catch (err) {
    console.warn('[registrationButton] fetchMyRegistration failed:', err);
    return null;
  }
}

function buildButton(input: RenderInput, outcome: EligibilityOutcome, status: string | null): HTMLElement {
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
      btn.textContent = status ? `Registered (${status})` : 'Already registered';
      btn.onclick = () => context.router?.navigate('/me');
      wrap.appendChild(btn);
      appendHint(wrap, 'Click to manage your registration at My CourtHive.');
      return wrap;

    case 'open':
    default:
      btn.textContent = 'Register for this tournament';
      btn.onclick = () => context.router?.navigate(`/register/${input.tournamentId}`);
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
