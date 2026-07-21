/**
 * Partner-invite confirm landing (`/#/register/partner/:token`). The invitee arrives
 * from the email link, sees the doubles event they were invited to, and confirms —
 * which stamps the PARTNER_INVITE ACCEPTED and submits THEIR registration referencing
 * it, completing the pair for TD acceptance.
 *
 * Re-entrant: if the invite is already ACCEPTED (e.g. a consent gate interrupted the
 * first attempt, or a return visit), it offers "complete registration" (the register
 * upsert is idempotent). Consent applies at submit (decision #5); a CONSENT_REQUIRED
 * response points the user at the full `/register` page to record it.
 */
import { acceptPartnerInvite, fetchPartnerInvite, submitRegistration, type PartnerInviteView } from 'src/services/declarationsApi';
import { isAuthenticated } from 'src/services/hiveidSession';
import { context } from 'src/common/context';

const CONSENT_CODES = new Set(['CONSENT_REQUIRED', 'PARENTAL_CONSENT_REQUIRED']);

export async function renderPartnerConfirm(container: HTMLElement, token: string): Promise<void> {
  container.replaceChildren();
  const shell = document.createElement('div');
  shell.className = 'chp-reg-shell';
  container.appendChild(shell);

  if (!token) {
    shell.appendChild(note('Missing invitation token.'));
    return;
  }

  let invite: PartnerInviteView | null;
  try {
    invite = await fetchPartnerInvite(token);
  } catch {
    shell.appendChild(note('Could not load this invitation — please try again later.'));
    return;
  }
  if (!invite) {
    shell.appendChild(note('This invitation was not found.'));
    return;
  }

  const title = document.createElement('h2');
  title.className = 'chp-reg-title';
  title.textContent = 'Doubles partner invitation';
  const summary = document.createElement('p');
  summary.className = 'chp-reg-summary';
  summary.textContent = `You've been invited to partner for ${invite.event ?? 'a doubles event'}.`;
  shell.append(title, summary);

  const status = invite.expired ? 'EXPIRED' : invite.status;
  if (status !== 'INVITED' && status !== 'ACCEPTED') {
    shell.appendChild(note(statusMessage(status)));
    return;
  }

  if (!isAuthenticated()) {
    shell.appendChild(note('Sign in with HiveID (the user icon, top-right) to accept this invitation.'));
    return;
  }

  const message = document.createElement('div');
  message.className = 'chp-reg-status';
  message.hidden = true;

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'chp-reg-submit';
  // ACCEPTED = the pairing was confirmed but registration may not have finished.
  button.textContent = status === 'ACCEPTED' ? 'Complete registration' : 'Accept & register';
  button.onclick = () => void confirm(token, invite as PartnerInviteView, status, message, button);

  shell.append(button, message);
}

async function confirm(
  token: string,
  invite: PartnerInviteView,
  status: string,
  message: HTMLElement,
  button: HTMLButtonElement,
): Promise<void> {
  const eventKey = invite.eventId ?? invite.event;
  if (!invite.providerId || !invite.tournamentId || !eventKey) {
    show(message, 'This invitation is missing tournament details.', 'error');
    return;
  }
  button.disabled = true;
  show(message, 'Confirming…', 'saving');
  try {
    if (status === 'INVITED') await acceptPartnerInvite(token);
    await submitRegistration(invite.providerId, invite.tournamentId, {
      eventIds: [eventKey],
      partnerInviteId: invite.declarationId,
    });
    show(message, 'Confirmed — you and your partner are registered for this event.', 'saved');
    button.textContent = 'Confirmed';
  } catch (err) {
    const code = err instanceof Error ? err.message : String(err);
    if (CONSENT_CODES.has(code)) {
      showConsentRedirect(message, invite.tournamentId);
    } else {
      show(message, `Could not confirm: ${code}`, 'error');
    }
    button.disabled = false;
  }
}

function statusMessage(status: string): string {
  switch (status) {
    case 'ACCEPTED':
      return 'You have already accepted this invitation.';
    case 'DECLINED':
      return 'This invitation was declined.';
    case 'WITHDRAWN':
      return 'This invitation was withdrawn by the person who sent it.';
    case 'EXPIRED':
      return 'This invitation has expired.';
    default:
      return `This invitation is ${status.toLowerCase()}.`;
  }
}

function showConsentRedirect(message: HTMLElement, tournamentId: string | null): void {
  message.hidden = false;
  message.dataset.kind = 'error';
  message.textContent = 'You need to record consent for this provider before registering. ';
  if (tournamentId) {
    const link = document.createElement('button');
    link.type = 'button';
    link.className = 'chp-reg-link';
    link.textContent = 'Complete consent';
    link.onclick = () => context.router?.navigate(`/register/${tournamentId}`);
    message.appendChild(link);
  }
}

function note(text: string): HTMLElement {
  const el = document.createElement('p');
  el.className = 'chp-reg-note';
  el.textContent = text;
  return el;
}

function show(el: HTMLElement, text: string, kind: 'saving' | 'saved' | 'error'): void {
  el.textContent = text;
  el.dataset.kind = kind;
  el.hidden = !text;
}
