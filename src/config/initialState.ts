import { highlightTeam, removeTeamHighlight } from 'src/services/dom/teamHighlight';
import { eventManager } from 'src/services/dom/eventManager';
import { setDisplay } from 'src/services/transistions';
import { initTheme } from 'src/services/themeService';
import { setDev } from 'src/services/setDev';
import { setWindow } from './setWindow';
import { version } from './version';
import hotkeys from 'hotkeys-js';

// constants
import { SPLASH } from 'src/common/constants/routerConstants';

import 'courthive-components/dist/courthive-components.css';
import 'src/styles/components/layout.css';
import 'src/styles/tabulator.css';
import 'src/styles/tournamentSchedule.css';
import 'src/styles/default.css';
import 'src/styles/darkMode.css';

const keysPressed = [];

export function setInitialState() {
  initTheme();
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

  eventManager.register('tmx-tm', 'mouseover', highlightTeam);
  eventManager.register('tmx-tm', 'mouseout', removeTeamHighlight);
}
