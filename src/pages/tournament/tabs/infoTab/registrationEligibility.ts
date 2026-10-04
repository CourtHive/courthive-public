/**
 * Pure-logic helpers that decide whether the public-side Register
 * button should render, and if so in what state. Extracted from
 * `registrationButton.ts` so the rules are testable without standing
 * up the DOM.
 *
 * Five outcomes:
 *
 *   - 'hidden'                — registrationProfile not published OR
 *                                no published events to register into.
 *                                Button is not rendered at all.
 *   - 'sign-in-required'      — entries open but caller has no HiveID
 *                                session. Render disabled "Sign in to
 *                                register" button.
 *   - 'not-yet-open'          — entriesOpen is in the future.
 *   - 'closed'                — entriesClose is in the past.
 *   - 'already-registered'    — caller's HiveID already has a
 *                                non-terminal entry for this tournament
 *                                (applied / accepted / seeded /
 *                                waitlisted).
 *   - 'open'                  — full "Register" CTA. Navigates to /register.
 */

export type EligibilityOutcome =
  | 'hidden'
  | 'sign-in-required'
  | 'not-yet-open'
  | 'closed'
  | 'already-registered'
  | 'open';

export interface EligibilityInput {
  registrationProfile?: {
    entriesOpen?: string | null;
    entriesClose?: string | null;
  } | null;
  eventInfo?: Array<{ eventId?: string }> | null;
  isAuthenticated: boolean;
  existingRegistration: { status: string } | null;
  now?: Date;
}

const NON_TERMINAL_STATUSES = new Set(['applied', 'accepted', 'seeded', 'waitlisted']);

export function resolveEligibility(input: EligibilityInput): EligibilityOutcome {
  const profile = input.registrationProfile;
  if (!profile?.entriesOpen) return 'hidden';
  const hasEvents = !!input.eventInfo?.some((e) => !!e.eventId);
  if (!hasEvents) return 'hidden';

  // Already-registered check fires regardless of window state — once the
  // applicant has an entry the action is "track at /me", not "register".
  if (input.existingRegistration && NON_TERMINAL_STATUSES.has(input.existingRegistration.status)) {
    return 'already-registered';
  }

  const now = input.now ?? new Date();
  if (new Date(profile.entriesOpen) > now) return 'not-yet-open';
  if (profile.entriesClose && new Date(profile.entriesClose) < now) return 'closed';

  if (!input.isAuthenticated) return 'sign-in-required';
  return 'open';
}
