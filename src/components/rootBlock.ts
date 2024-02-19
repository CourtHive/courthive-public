import { TOURNAMENTS_CONTROL, TOURNAMENTS_TABLE } from 'src/common/constants/elementConstants';
import { SPLASH, TOURNAMENT, TOURNAMENTS } from 'src/common/constants/routerConstants';
import { tournamentFramework } from 'src/pages/tournament/framework';

export function rootBlock() {
  const main = document.createElement('div');
  main.className = 'main noselect';

  const nav = document.createElement('nav');
  nav.className = 'navbar';
  const navBrand = document.createElement('div');
  navBrand.className = 'navbar-brand';
  const navItem = document.createElement('div');
  navItem.onclick = () => window.history.back();
  navItem.className = 'navbar-item';
  navItem.innerHTML = '<<';
  navItem.id = 'back';

  navBrand.appendChild(navItem);
  nav.appendChild(navBrand);
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
  tournament.style.backgroundColor = 'white';
  tournament.style.display = 'none';
  tournament.id = TOURNAMENT;
  tournament.appendChild(tournamentFramework());

  main.appendChild(tournaments);
  main.appendChild(tournament);
  main.appendChild(splash);

  return main;
}
