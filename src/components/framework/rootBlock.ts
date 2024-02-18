import { TOURNAMENTS_TABLE } from 'src/common/constants/elementConstants';
import { SPLASH, TOURNAMENTS } from 'src/common/constants/routerConstants';

export function rootBlock() {
  const main = document.createElement('div');
  main.className = 'main noselect';

  const splash = document.createElement('div');
  splash.style.display = 'none';
  splash.id = SPLASH;

  const tournaments = document.createElement('div');
  tournaments.style.display = 'none';
  tournaments.id = TOURNAMENTS;

  const tTable = document.createElement('div');
  tTable.className = 'flexcol flexgrow flexcenter box';
  tTable.id = TOURNAMENTS_TABLE;
  tournaments.appendChild(tTable);

  main.appendChild(tournaments);
  main.appendChild(splash);

  return main;
}
