import { createPlayersTable } from 'src/components/tables/playersTable/createPlayersTable';
import { createScheduleTable } from 'src/components/tables/scheduleTable/createScheduleTable';
import { getScheduledMatchUps, getParticipants } from 'src/services/api/tournamentsApi';
import { updateRouteUrl } from 'src/router/router';
import { getTabContentId, getTabId } from './tabIds';
import { context } from 'src/common/context';

// constants
import { NONE } from 'src/common/constants/baseConstants';

export const tabNames = ['Info', 'Events', 'Schedule', 'Matches', 'Players', 'Stats'];

// Guard against phantom clicks caused by layout shift when sections show/hide
let _tabSwitching = false;

export function displayTabContent(tabName, options?: { updateUrl?: boolean }) {
  if (options?.updateUrl) {
    if (_tabSwitching) return;
    _tabSwitching = true;
    requestAnimationFrame(() => {
      _tabSwitching = false;
    });
  }

  if (tabName === 'Schedule') {
    const hydrateParticipants = false;
    getScheduledMatchUps({ tournamentId: context.tournamentId, hydrateParticipants }).then((result) => {
      createScheduleTable({ data: result?.data });
    });
  } else if (tabName === 'Players') {
    getParticipants({ tournamentId: context.tournamentId }).then((result) => {
      createPlayersTable({ participants: result?.data?.participants || [] });
    });
  }
  context.tab = tabName;
  tabNames.forEach((name) => {
    const section = document.getElementById(getTabContentId(name));
    section.style.display = name === tabName ? 'block' : 'none';
  });

  if (options?.updateUrl) {
    const tournamentId = context.tournamentId;
    if (tabName === 'Schedule') {
      updateRouteUrl({ tournamentId, tab: 'Schedule' });
    } else if (tabName === 'Events') {
      updateRouteUrl({ tournamentId, tab: 'Events' });
    } else if (tabName === 'Players') {
      updateRouteUrl({ tournamentId, tab: 'Players' });
    } else {
      updateRouteUrl({ tournamentId });
    }
  }
}

export function displayTab(tabName) {
  const tab = document.getElementById(getTabId(tabName));
  tab.style.display = 'block';
}

export function hideTab(tabName) {
  const tab = document.getElementById(getTabId(tabName));
  tab.style.display = NONE;
}
