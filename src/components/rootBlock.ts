import { SPLASH, TOURNAMENT, TOURNAMENTS } from 'src/common/constants/routerConstants';
import { TOURNAMENTS_TABLE } from 'src/common/constants/elementConstants';
import { tournamentFramework } from 'src/pages/tournament/framework';

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

  const tournament = document.createElement('div');
  tournament.style.display = 'none';
  tournament.id = TOURNAMENT;
  tournament.appendChild(tournamentFramework());

  main.appendChild(tournaments);
  main.appendChild(tournament);
  main.appendChild(splash);

  return main;
}
