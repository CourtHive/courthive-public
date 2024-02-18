import { setDisplay } from 'src/services/transistions';
import { setDev } from 'src/services/setDev';
import { setWindow } from './setWindow';
import { version } from './version';

import { SPLASH } from 'src/common/constants/routerConstants';

import 'src/styles/tabulator.css';
import 'bulma/css/bulma.css';
import 'src/styles/tmx.css';

export function setInitialState() {
  console.log(`%cversion: ${version}`, 'color: lightblue');
  setDisplay(SPLASH);
  setWindow();
  setDev();
}
