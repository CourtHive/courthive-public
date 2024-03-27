import { setDisplay } from 'src/services/transistions';
import { setDev } from 'src/services/setDev';
import { setWindow } from './setWindow';
import { version } from './version';
import hotkeys from 'hotkeys-js';

import { SPLASH } from 'src/common/constants/routerConstants';

import 'src/styles/tournamentSchedule.css';
import 'node_modules/bulma/css/bulma.css';
import 'src/styles/tabulator.css';
import 'src/styles/default.css';

const keysPressed = [];

export function setInitialState() {
  console.log(`%cversion: ${version}`, 'color: lightblue');
  hotkeys('shift+1,shift+3,esc,/', (event, handler: any) => {
    event.preventDefault();
    const shifted = hotkeys.shift;
    const value = shifted ? handler.key.split(handler.splitKey)[1] : handler.key;
    if (value === '/') keysPressed.splice(0, keysPressed.length);
    keysPressed.push(value);
    if (keysPressed.join('') === 'esc13') setDev();
  });
  setDisplay(SPLASH);
  setWindow();
}
