import { getTournamentInfo, getEventData, getServerFactoryVersion, getProviderCalendar } from './api/tournamentsApi';
import { context } from 'src/common/context';
import { baseApi } from './api/baseApi';

export function setDev() {
  if (!window['dev']) {
    console.log('%c dev initialized', 'color: yellow');
    window['dev'] = {};
  } else {
    return;
  }

  const logData = (fx) => (params) =>
    fx(params).then(
      (r) => console.log(r.data),
      (e) => console.log(e),
    );

  const fx = {
    getServerFactoryVersion: (params) => logData(getServerFactoryVersion)(params),
    getProviderCalendar: (params) => logData(getProviderCalendar)(params),
    getTournamentInfo: (params) => logData(getTournamentInfo)(params),
    getEventData: (params) => logData(getEventData(params)),
  };

  addDev({ ...fx, baseApi, context });
}

function addDev(variable) {
  if (typeof window?.['dev'] !== 'object') return;

  try {
    Object.keys(variable).forEach((key) => (window['dev'][key] = variable[key]));
  } catch {
    console.log('production environment');
  }
}
