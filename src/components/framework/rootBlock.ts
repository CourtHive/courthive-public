import { TOURNAMENTS_TABLE } from 'src/common/constants/elementConstants';

export function rootBlock() {
  const main = document.createElement('div');
  main.className = 'main noselect';

  const tournaments = document.createElement('div');
  const tTable = document.createElement('div');
  tTable.className = 'flexcol flexgrow flexcenter box';
  tTable.id = TOURNAMENTS_TABLE;
  tournaments.appendChild(tTable);

  main.appendChild(tournaments);

  return main;
}
