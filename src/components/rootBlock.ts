import 'src/pages/track/track-page.css';
import { buildHiveIDLogin, cModal } from 'courthive-components';
import { TOURNAMENTS_TABLE } from 'src/common/constants/elementConstants';
import { HIVEID_MAGIC, HIVEID_ME, RANKINGS, SPLASH, TOURNAMENT, TOURNAMENTS, TRACK } from 'src/common/constants/routerConstants';
import { isAuthenticated, writeHiveIDSession } from 'src/services/hiveidSession';
import { connectHiveIDSocket } from 'src/services/hiveidSocket';
import { toggleLanguageDropdown } from 'src/services/languageService';
import { tournamentFramework } from 'src/pages/tournament/framework';
import { toggleTheme } from 'src/services/themeService';
import { getCfsBaseUrl } from 'src/services/hiveidApi';
import { context } from 'src/common/context';
import { t } from 'src/i18n/i18n';

export function rootBlock() {
  const main = document.createElement('div');
  main.className = 'main noselect';

  const nav = document.createElement('nav');
  nav.className = 'navbar';
  const navBrand = document.createElement('div');
  navBrand.className = 'navbar-brand';
  const navItem = document.createElement('div');
  navItem.onclick = () => {
    if (context.providerAbbr) {
      context.router.navigate(`/tournaments/${context.providerAbbr}`);
    }
  };
  navItem.className = 'navbar-item provider-back';
  navItem.id = 'back';

  const navEnd = document.createElement('div');
  navEnd.className = 'navbar-end';

  const themeToggle = document.createElement('button');
  themeToggle.className = 'navbar-item theme-toggle';
  themeToggle.title = t('theme.toggleDark');
  const updateIcon = () => {
    const isDark = document.documentElement.dataset.theme === 'dark';
    themeToggle.textContent = isDark ? '\u2600' : '\u263E';
  };
  updateIcon();
  themeToggle.onclick = () => {
    toggleTheme();
    updateIcon();
  };
  navEnd.appendChild(themeToggle);

  const langButton = document.createElement('button');
  langButton.className = 'navbar-item language-toggle';
  langButton.title = t('language.select');
  langButton.textContent = '\uD83C\uDF10';
  langButton.onclick = () => toggleLanguageDropdown(langButton);
  navEnd.appendChild(langButton);

  const userButton = document.createElement('button');
  userButton.className = 'navbar-item user-login';
  userButton.title = t('Login');
  userButton.textContent = '\uD83D\uDC64';
  userButton.onclick = () => {
    if (isAuthenticated()) {
      context.router?.navigate('/me');
      return;
    }
    const shell = buildHiveIDLogin({
      cfsBaseUrl: getCfsBaseUrl(),
      mode: 'login',
      // Optional federation-id capture on signup: a person who quotes an existing
      // trusted-provider id (e.g. their BOBOCA player id) is RESOLVED to their
      // canonical person at signup — the only way the name-only signup fragment can
      // acquire a personId. Without this, a fresh signup returns `incomplete`.
      // Provider list is the backfill's trusted-provider set; can later come from a
      // providers endpoint.
      federationIdCapture: {
        providers: [
          { value: 'BOBOCA', label: 'BOBOCA' },
          { value: 'HTS', label: 'HTS' },
          { value: 'CTS', label: 'CTS' },
        ],
        idLabel: 'Player ID',
        note: 'Already have a player ID from your club or federation? Enter it to link your existing record.',
      },
    });
    cModal.open({
      title: 'Sign in to CourtHive',
      content: (elem: HTMLElement) => {
        elem.appendChild(shell.root);
        return elem;
      },
      buttons: [{ label: 'Close' }],
    });
    shell.onAuthenticated((detail) => {
      writeHiveIDSession(detail);
      connectHiveIDSocket();
      cModal.close();
      context.router?.navigate('/me');
    });
  };
  navEnd.appendChild(userButton);
  // Re-connect the HiveID socket on app boot if the session survived a reload.
  if (isAuthenticated()) connectHiveIDSocket();

  navBrand.appendChild(navItem);
  nav.appendChild(navBrand);
  nav.appendChild(navEnd);
  main.appendChild(nav);

  const splash = document.createElement('div');
  splash.style.display = 'none';
  splash.id = SPLASH;

  const tournaments = document.createElement('div');
  tournaments.style.display = 'none';
  tournaments.id = TOURNAMENTS;

  const tTable = document.createElement('div');
  tTable.id = TOURNAMENTS_TABLE;
  tournaments.appendChild(tTable);

  const tournament = document.createElement('div');
  tournament.style.display = 'none';
  tournament.id = TOURNAMENT;
  tournament.appendChild(tournamentFramework());

  const track = document.createElement('div');
  track.style.display = 'none';
  track.id = TRACK;

  const hiveidMe = document.createElement('div');
  hiveidMe.style.display = 'none';
  hiveidMe.id = HIVEID_ME;

  const hiveidMagic = document.createElement('div');
  hiveidMagic.style.display = 'none';
  hiveidMagic.id = HIVEID_MAGIC;

  const rankings = document.createElement('div');
  rankings.style.display = 'none';
  rankings.id = RANKINGS;

  main.appendChild(tournaments);
  main.appendChild(tournament);
  main.appendChild(track);
  main.appendChild(splash);
  main.appendChild(hiveidMe);
  main.appendChild(hiveidMagic);
  main.appendChild(rankings);

  return main;
}
