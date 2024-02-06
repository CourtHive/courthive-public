import { getTournamentInfo, getEventData, getServerFactoryVersion } from './api/tournamentsApi';
import { baseApi } from './api/baseApi';

export function setDev() {
  if (!window['dev']) {
    // eslint-disable-next-line no-console
    console.log('%c dev initialized', 'color: yellow');
    window['dev'] = {};
  } else {
    return;
  }

  addDev({ getTournamentInfo, getEventData, getServerFactoryVersion, baseApi });
}

function addDev(variable) {
  if (typeof window?.['dev'] !== 'object') return;

  try {
    Object.keys(variable).forEach((key) => (window['dev'][key] = variable[key]));
  } catch (err) {
    // eslint-disable-next-line no-console
    console.log('production environment');
  }
}
