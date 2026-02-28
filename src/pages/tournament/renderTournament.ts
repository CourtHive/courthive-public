import { TOURNAMENT_EVENTS, TOURNAMENT_LOGO, TOURNAMENT_TITLE_BLOCK } from 'src/common/constants/elementConstants';
import { removeAllChildNodes, renderEvent } from './tabs/eventTab/renderEvent';
import { displayTab, displayTabContent, hideTab } from './helpers/tabDisplay';
import { dropDownButton } from 'src/components/buttons/dropDownButton';
import i18next, { hasStoredLanguage } from 'src/i18n/i18n';
import { updateRouteUrl } from 'src/router/router';
import { LEFT } from 'src/common/constants/baseConstants';
import { context } from 'src/common/context';
import { getTabContentId } from './helpers/tabIds';
import { dateString } from './helpers/dateString';

export async function renderTournament(
  result,
  deepLink?: { eventId?: string; drawId?: string; structureId?: string; tab?: string },
) {
  const te = document.getElementById(TOURNAMENT_EVENTS);
  removeAllChildNodes(te);

  const tournamentInfo = result?.data?.tournamentInfo ?? {};

  // Apply tournament default language if user hasn't explicitly chosen one
  const publishLanguage = tournamentInfo.publishState?.language;
  if (publishLanguage && !hasStoredLanguage()) {
    i18next.changeLanguage(publishLanguage);
  }

  // Store participants publish config on context for use in createPlayersTable
  context.participantsPublishConfig = tournamentInfo.publishState?.participants;

  const tournamentImage = tournamentInfo.onlineResources?.find((resource) => resource.name === 'tournamentImage');
  const tl = document.getElementById(TOURNAMENT_LOGO);
  if (tournamentImage?.identifier) {
    tl.innerHTML = `<img src="${tournamentImage.identifier}" alt="${tournamentInfo.name}" style="max-height: 20em" />`;
  } else {
    removeAllChildNodes(tl);
  }

  if (tournamentInfo.tournamentName) {
    const el = document.getElementById(TOURNAMENT_TITLE_BLOCK);
    const tournamentName = `<h1>${tournamentInfo.tournamentName}</h1>`;
    const dates = `<h2>${dateString(tournamentInfo)}</h2>`;
    el.innerHTML = `${tournamentName}${dates}`;
  }

  const notes = document.getElementById(getTabContentId('Info'));
  const hasNotes = !!tournamentInfo.notes;
  if (hasNotes) {
    notes.innerHTML = tournamentInfo.notes;
    displayTab('Info');
  } else {
    removeAllChildNodes(notes);
    hideTab('Info');
  }

  const hasEvents = !!tournamentInfo.eventInfo?.length;
  if (hasEvents) {
    const tournamentId: string = tournamentInfo.tournamentId;

    const et = document.getElementById(getTabContentId('Events'));
    removeAllChildNodes(et);

    const header = document.createElement('div');
    const flightDisplay = document.createElement('div');
    flightDisplay.id = 'flightDisplay';

    const targetEventId = deepLink?.eventId;

    const initialIndex = targetEventId
      ? Math.max(
          tournamentInfo.eventInfo.findIndex((e) => e.eventId === targetEventId),
          0,
        )
      : 0;

    const eventOptions = tournamentInfo.eventInfo.map(({ eventId, eventName }, i) => ({
      onClick: () => {
        updateRouteUrl({ tournamentId, eventId });
        renderEvent({ tournamentId, eventId, header, flightDisplay, displayFormat: 'roundsColumns' });
      },
      isActive: i === initialIndex,
      label: eventName,
      close: true,
    }));
    const eventButton = {
      label: tournamentInfo.eventInfo[initialIndex].eventName,
      options: eventOptions,
      id: 'eventButton',
      modifyLabel: true,
      selection: true,
      location: LEFT,
    };
    const removeFlightButtons = () => {
      document.getElementById('structureButton')?.remove();
      document.getElementById('flightButton')?.remove();
    };
    const elem = dropDownButton({ button: eventButton, stateChange: removeFlightButtons });
    const eventId: string = tournamentInfo.eventInfo[initialIndex].eventId;
    header.className = 'block';
    header.appendChild(elem);
    et.appendChild(header);
    et.appendChild(flightDisplay);
    renderEvent({
      tournamentId,
      eventId,
      header,
      flightDisplay,
      displayFormat: 'roundsColumns',
      drawId: deepLink?.drawId,
      structureId: deepLink?.structureId,
    });

    displayTab('Events');
  } else {
    hideTab('Events');
  }

  const hasSchedule = !!tournamentInfo.publishState?.orderOfPlay?.published;
  if (hasSchedule) {
    const schedule = document.getElementById(getTabContentId('Schedule'));

    const scheduleHeader = document.createElement('div');
    scheduleHeader.style.width = '100%';
    scheduleHeader.className = 'block';
    scheduleHeader.id = 'scheduleHeader';
    schedule.appendChild(scheduleHeader);

    const scheduleDisplay = document.createElement('div');
    scheduleDisplay.id = 'tournamentSchedule';
    schedule.appendChild(scheduleDisplay);
    displayTab('Schedule');
  } else {
    hideTab('Schedule');
  }

  const hasParticipants = !!tournamentInfo.publishState?.participants?.published;
  if (hasParticipants) {
    const players = document.getElementById(getTabContentId('Players'));
    removeAllChildNodes(players);

    const playersHeader = document.createElement('div');
    playersHeader.style.width = '100%';
    playersHeader.className = 'block';
    players.appendChild(playersHeader);

    const playersDisplay = document.createElement('div');
    playersDisplay.id = 'playersTable';
    players.appendChild(playersDisplay);

    displayTab('Players');
  } else {
    hideTab('Players');
  }

  // Determine target tab — priority: deep-link tab > deep-link event > info default > events fallback
  let targetTab: string;
  if (deepLink?.tab === 'Players' && hasParticipants) {
    targetTab = 'Players';
  } else if (deepLink?.tab === 'Schedule' && hasSchedule) {
    targetTab = 'Schedule';
  } else if (deepLink?.tab === 'Events' && hasEvents) {
    targetTab = 'Events';
  } else if (deepLink?.eventId && hasEvents) {
    targetTab = 'Events';
  } else if (hasNotes) {
    targetTab = 'Info';
  } else if (hasEvents) {
    targetTab = 'Events';
  }

  if (targetTab) {
    displayTabContent(targetTab);
  }
}
