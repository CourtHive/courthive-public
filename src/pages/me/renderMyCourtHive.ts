/**
 * /#/me — My CourtHive shell.
 *
 * Phase 1 scope: render the cached canonical profile + logout button.
 * Participations + claim-a-Participant sections are stubbed as
 * "Coming soon" because they require a new CFS `GET /me/participations`
 * endpoint (queued as PR-J.5).
 */
import './me.css';

import { clearHiveIDSession, getDisplayName, readHiveIDSession, writeHiveIDSession } from 'src/services/hiveidSession';
import { disconnectHiveIDSocket } from 'src/services/hiveidSocket';
import { fetchHiveIDMe } from 'src/services/hiveidApi';
import { context } from 'src/common/context';

export function renderMyCourtHive(container: HTMLElement): void {
  container.replaceChildren();

  const session = readHiveIDSession();
  if (!session?.token) {
    const empty = document.createElement('div');
    empty.className = 'chp-me-empty';
    empty.textContent = 'Please log in to see your CourtHive identity.';
    container.appendChild(empty);
    return;
  }

  const shell = document.createElement('div');
  shell.className = 'chp-me-shell';

  const header = document.createElement('div');
  header.className = 'chp-me-header';
  const title = document.createElement('h1');
  title.className = 'chp-me-title';
  title.textContent = 'My CourtHive';
  header.appendChild(title);

  const logout = document.createElement('button');
  logout.className = 'chp-me-logout';
  logout.type = 'button';
  logout.textContent = 'Sign out';
  logout.onclick = () => {
    clearHiveIDSession();
    disconnectHiveIDSocket();
    context.router?.navigate('/');
  };
  header.appendChild(logout);
  shell.appendChild(header);

  const profile = document.createElement('section');
  profile.className = 'chp-me-section';
  const profileTitle = document.createElement('h2');
  profileTitle.textContent = 'Profile';
  profile.appendChild(profileTitle);

  const profileBody = document.createElement('dl');
  profileBody.className = 'chp-me-dl';
  appendField(profileBody, 'Name', getDisplayName(session) || '—');
  appendField(profileBody, 'Date of birth', session.cached.birthDate ?? '—');
  appendField(profileBody, 'Sex', session.cached.sex ?? '—');
  appendField(profileBody, 'Nationality', session.cached.nationalityCode ?? '—');
  appendField(profileBody, 'CourtHive person ID', session.personId ?? 'Not yet linked');
  profile.appendChild(profileBody);
  shell.appendChild(profile);

  const participations = document.createElement('section');
  participations.className = 'chp-me-section chp-me-section--stub';
  const partTitle = document.createElement('h2');
  partTitle.textContent = 'Tournaments you have played';
  participations.appendChild(partTitle);
  const partBody = document.createElement('p');
  partBody.textContent = 'Coming soon — your tournament history will appear here once the registry lookup is live.';
  participations.appendChild(partBody);
  shell.appendChild(participations);

  const claim = document.createElement('section');
  claim.className = 'chp-me-section chp-me-section--stub';
  const claimTitle = document.createElement('h2');
  claimTitle.textContent = 'Claim a participant';
  claim.appendChild(claimTitle);
  const claimBody = document.createElement('p');
  claimBody.textContent =
    'Coming soon — link a tournament participant record to your CourtHive identity. Requires the participations endpoint and the registry search UI.';
  claim.appendChild(claimBody);
  shell.appendChild(claim);

  container.appendChild(shell);

  // Best-effort: refresh cached fields from /auth/hiveid/me so the
  // display picks up any personMerged-driven rewrites since the
  // session was minted. Silent fail — the cached session is the
  // source of truth for the rest of the page on failure.
  fetchHiveIDMe()
    .then((me) => {
      if (!me) return;
      const refreshed = readHiveIDSession();
      if (!refreshed) return;
      writeHiveIDSession({
        token: refreshed.token,
        refreshToken: refreshed.refreshToken,
        personId: me.personId,
        cached: {
          standardFamilyName: me.cached.standardFamilyName,
          standardGivenName: me.cached.standardGivenName,
          birthDate: me.cached.birthDate,
          sex: me.cached.sex,
          nationalityCode: me.cached.nationalityCode,
        },
      });
      // Re-render to reflect the freshest data.
      renderMyCourtHive(container);
    })
    .catch((err) => {
      console.warn('[hiveid /me] refresh failed:', err);
    });
}

function appendField(dl: HTMLDListElement, label: string, value: string): void {
  const dt = document.createElement('dt');
  dt.textContent = label;
  const dd = document.createElement('dd');
  dd.textContent = value;
  dl.appendChild(dt);
  dl.appendChild(dd);
}
