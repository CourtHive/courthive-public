import { createScheduleTable } from 'src/components/tables/scheduleTable/createScheduleTable';
import { getScheduledMatchUps } from 'src/services/api/tournamentsApi';
import { getTabContentId, getTabId } from './tabIds';
import { context } from 'src/common/context';

// constants
import { NONE } from 'src/common/constants/baseConstants';

export const tabNames = ['Info', 'Events', 'Schedule', 'Matches', 'Players', 'Stats'];

export function displayTabContent(tabName) {
  // TODO: determine if content needs to be fetched or is already present

  if (tabName === 'Schedule') {
    const hydrateParticipants = false;
    getScheduledMatchUps({ tournamentId: context.tournamentId, hydrateParticipants }).then((result) => {
      createScheduleTable({ data: result?.data });
    });
  }
  context.tab = tabName;
  tabNames.forEach((name) => {
    const section = document.getElementById(getTabContentId(name));
    section.style.display = name === tabName ? 'block' : 'none';
  });
}

export function displayTab(tabName) {
  const tab = document.getElementById(getTabId(tabName));
  tab.style.display = 'block';
}

export function hideTab(tabName) {
  const tab = document.getElementById(getTabId(tabName));
  tab.style.display = NONE;
}
