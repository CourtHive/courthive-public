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
import { t } from 'src/i18n/i18n';

export function renderVerifyEmail(container: HTMLElement, token: string): void {
  container.replaceChildren();

  const shell = document.createElement('div');
  shell.className = 'chp-me-shell';
  const msg = document.createElement('p');
  msg.style.padding = '2rem';
  msg.style.textAlign = 'center';
  msg.textContent = t('verifyEmail.verifying');
  shell.appendChild(msg);
  container.appendChild(shell);

  if (!token) {
    msg.textContent = t('verifyEmail.missingToken');
    return;
  }

  consumeEmailVerification(token)
    .then(() => {
      const session = readHiveIDSession();
      if (session?.token) {
        msg.textContent = t('verifyEmail.verifiedRedirect');
        // Best-effort cache refresh; navigation does not depend on it.
        void fetchHiveIDMe().catch(() => undefined);
        context.router?.navigate('/me');
      } else {
        msg.textContent = t('verifyEmail.verifiedSignIn');
      }
    })
    .catch((err) => {
      console.warn('[hiveid verify-email] failed:', err);
      msg.textContent = t('verifyEmail.invalidOrExpired');
    });
}
