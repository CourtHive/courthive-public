/**
 * /#/hiveid/magic/:code — magic-link consume landing page.
 *
 * Exchanges the single-use code for a HiveID session and redirects to
 * /me. On error renders a message and a link back to the splash.
 */
import { completeMagicLink } from 'courthive-components';

import { writeHiveIDSession } from 'src/services/hiveidSession';
import { connectHiveIDSocket } from 'src/services/hiveidSocket';
import { getCfsBaseUrl } from 'src/services/hiveidApi';
import { context } from 'src/common/context';

export function renderMagicLinkConsume(container: HTMLElement, code: string): void {
  container.replaceChildren();

  const shell = document.createElement('div');
  shell.className = 'chp-me-shell';
  const msg = document.createElement('p');
  msg.textContent = 'Signing you in…';
  msg.style.padding = '2rem';
  msg.style.textAlign = 'center';
  shell.appendChild(msg);
  container.appendChild(shell);

  if (!code) {
    msg.textContent = 'Missing sign-in code.';
    return;
  }

  completeMagicLink(getCfsBaseUrl(), code)
    .then((session) => {
      writeHiveIDSession(session);
      connectHiveIDSocket();
      context.router?.navigate('/me');
    })
    .catch((err) => {
      console.warn('[hiveid magic consume] failed:', err);
      msg.textContent = 'This sign-in link is invalid or has expired. Please request a new one.';
    });
}
