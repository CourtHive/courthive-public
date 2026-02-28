import { TOURNAMENTS_CONTROL, TOURNAMENTS_TABLE } from 'src/common/constants/elementConstants';
import { SPLASH, TOURNAMENT, TOURNAMENTS } from 'src/common/constants/routerConstants';
import { toggleLanguageDropdown } from 'src/services/languageService';
import { tournamentFramework } from 'src/pages/tournament/framework';
import { toggleTheme } from 'src/services/themeService';
import { t } from 'src/i18n/i18n';

export function rootBlock() {
  const main = document.createElement('div');
  main.className = 'main noselect';

  const nav = document.createElement('nav');
  nav.className = 'navbar';
  const navBrand = document.createElement('div');
  navBrand.className = 'navbar-brand';
  const navItem = document.createElement('div');
  navItem.onclick = () => globalThis.history.back();
  navItem.className = 'navbar-item';
  navItem.innerHTML = '<<';
  navItem.id = 'back';

  const navEnd = document.createElement('div');
  navEnd.className = 'navbar-end';

  const langButton = document.createElement('button');
  langButton.className = 'navbar-item language-toggle';
  langButton.title = t('language.select');
  langButton.textContent = '\uD83C\uDF10';
  langButton.onclick = () => toggleLanguageDropdown(langButton);
  navEnd.appendChild(langButton);

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

  const tControl = document.createElement('div');
  tControl.className = 'controlBar flexcol flexgrow flexcenter';
  tControl.id = TOURNAMENTS_CONTROL;
  tournaments.appendChild(tControl);

  const tTable = document.createElement('div');
  tTable.className = 'flexcol flexgrow flexcenter box';
  tTable.id = TOURNAMENTS_TABLE;
  tournaments.appendChild(tTable);

  const tournament = document.createElement('div');
  tournament.style.display = 'none';
  tournament.id = TOURNAMENT;
  tournament.appendChild(tournamentFramework());

  main.appendChild(tournaments);
  main.appendChild(tournament);
  main.appendChild(splash);

  return main;
}
