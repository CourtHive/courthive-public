import { setDev } from 'src/services/setDev';
import { setWindow } from './setWindow';
import { version } from './version';

import 'src/styles/tabulator.css';
import 'bulma/css/bulma.css';
import 'src/styles/tmx.css';

export function setInitialState() {
  console.log(`%cversion: ${version}`, 'color: lightblue');
  setWindow();
  setDev();
}
