/**
 * /#/verify-email/:token — email-verification landing page.
 *
 * POSTs the single-use token from the verification email to the shared
 * @Public `/auth/verify-email` CFS endpoint. On success, refreshes the /me
 * cached fields (if already signed in) and routes to /me; otherwise tells the
 * visitor their email is verified and they can sign in.
 */
import { consumeEmailVerification, fetchHiveIDMe } from 'src/services/hiveidApi';
import { readHiveIDSession } from 'src/services/hiveidSession';
import { context } from 'src/common/context';

export function renderVerifyEmail(container: HTMLElement, token: string): void {
  container.replaceChildren();

  const shell = document.createElement('div');
  shell.className = 'chp-me-shell';
  const msg = document.createElement('p');
  msg.style.padding = '2rem';
  msg.style.textAlign = 'center';
  msg.textContent = 'Verifying your email…';
  shell.appendChild(msg);
  container.appendChild(shell);

  if (!token) {
    msg.textContent = 'Missing verification token.';
    return;
  }

  consumeEmailVerification(token)
    .then(() => {
      const session = readHiveIDSession();
      if (session?.token) {
        msg.textContent = 'Your email is verified. Taking you to My CourtHive…';
        // Best-effort cache refresh; navigation does not depend on it.
        void fetchHiveIDMe().catch(() => undefined);
        context.router?.navigate('/me');
      } else {
        msg.textContent = 'Your email is verified. You can now sign in.';
      }
    })
    .catch((err) => {
      console.warn('[hiveid verify-email] failed:', err);
      msg.textContent =
        'This verification link is invalid or has expired. Sign in to My CourtHive to request a new one.';
    });
}
