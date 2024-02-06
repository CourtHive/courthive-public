import { setDev } from 'src/services/setDev';
import { setWindow } from './setWindow';
import { version } from './version';

export function setInitialState() {
  console.log(`%cversion: ${version}`, 'color: lightblue');
  setWindow();
  setDev();
}
