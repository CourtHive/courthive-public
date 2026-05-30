import { TOURNAMENT_EVENTS, TOURNAMENT_LOGO, TOURNAMENT_TITLE_BLOCK } from 'src/common/constants/elementConstants';
import { tennisCourt, createCourtSvg, COURT_SVG_RESOURCE_SUB_TYPE } from 'courthive-components';
import { getProviderBrandingByTournament } from 'src/services/api/tournamentsApi';
import { renderRegistrationProfile } from './tabs/infoTab/renderRegistrationProfile';
import { removeAllChildNodes, renderEvent } from './tabs/eventTab/renderEvent';
import { applyProviderBranding } from 'src/services/providerBranding';
import { renderVenues } from './tabs/infoTab/renderVenues';
import { displayTab, displayTabContent, hideTab } from './helpers/tabDisplay';
import { dropDownButton } from 'src/components/buttons/dropDownButton';
import i18next, { hasStoredLanguage, t } from 'src/i18n/i18n';
import { ensureLocaleCurrent } from 'src/i18n/runtime-loader';
import { LEFT } from 'src/common/constants/baseConstants';
import { updateRouteUrl } from 'src/router/router';
import { getTabContentId } from './helpers/tabIds';
import { dateString } from './helpers/dateString';
import { context } from 'src/common/context';

export function isFullyUnpublished(tournamentInfo: any): boolean {
  if (!tournamentInfo) return true;
  const hasEvents = !!tournamentInfo.eventInfo?.length;
  const hasSchedule = !!tournamentInfo.publishState?.orderOfPlay?.published;
  const hasParticipants = !!tournamentInfo.publishState?.participants?.published;
  return !hasEvents && !hasSchedule && !hasParticipants;
}

export async function renderTournament(
  result,
  deepLink?: { eventId?: string; drawId?: string; structureId?: string; tab?: string },
) {
  const tournamentInfo = result?.data?.tournamentInfo ?? {};

  // Fire-and-forget: fetch the owning provider's branding and apply it
  // as soon as it lands. Defaults stay in place if the lookup fails or
  // the tournament has no provider mapping.
  if (tournamentInfo.tournamentId) {
    getProviderBrandingByTournament({ tournamentId: tournamentInfo.tournamentId })
      .then((response) => applyProviderBranding(response?.data?.branding))
      .catch(() => applyProviderBranding(undefined));
  }

  if (isFullyUnpublished(tournamentInfo)) {
    const providerAbbr = context.providerAbbr;
    context.router?.navigate(providerAbbr ? `/tournaments/${providerAbbr}` : '/');
    return;
  }

  const te = document.getElementById(TOURNAMENT_EVENTS);
  removeAllChildNodes(te);

  // Apply tournament default language if user hasn't explicitly chosen one.
  // Locale resources may not be loaded yet (only `en` is bundled), so make
  // sure the bundle is in i18next before swapping the active language — the
  // background ensureLocaleCurrent call here populates from cache or
  // fetches from CFS as needed.
  const publishLanguage = tournamentInfo.publishState?.language;
  if (publishLanguage && !hasStoredLanguage() && publishLanguage !== i18next.language) {
    try {
      await ensureLocaleCurrent(publishLanguage);
    } catch {
      // Fetch failed — changeLanguage will fall back to English keys,
      // which is the same behaviour as before this change.
    }
    i18next.changeLanguage(publishLanguage);
  }

  // Store participants publish config on context for use in createPlayersTable
  context.participantsPublishConfig = tournamentInfo.publishState?.participants;

  const tournamentImage = tournamentInfo.onlineResources?.find((resource) => resource.name === 'tournamentImage');
  const imageUrl = tournamentImage?.identifier;
  const isValidUrl =
    imageUrl && (imageUrl.startsWith('http://') || imageUrl.startsWith('https://') || imageUrl.startsWith('data:'));
  const isCourtSvgResource = tournamentImage?.resourceSubType === COURT_SVG_RESOURCE_SUB_TYPE;
  const tl = document.getElementById(TOURNAMENT_LOGO);
  if (isValidUrl) {
    const alt = tournamentInfo.tournamentName || '';
    tl.innerHTML = `<img src="${imageUrl}" alt="${alt}" style="max-height: 20em" />`;
  } else {
    removeAllChildNodes(tl);
    const publishedCourtSvg = isCourtSvgResource ? createCourtSvg(tournamentImage?.identifier, 'court-fallback') : undefined;
    const courtSvg = publishedCourtSvg ?? tennisCourt('court-fallback');
    courtSvg.style.maxHeight = '16em';
    courtSvg.style.padding = '1em';
    courtSvg.style.opacity = '0.6';
    tl.appendChild(courtSvg);
  }

  if (tournamentInfo.tournamentName) {
    const el = document.getElementById(TOURNAMENT_TITLE_BLOCK);
    const tournamentName = `<h1>${tournamentInfo.tournamentName}</h1>`;
    const dates = `<h2>${dateString(tournamentInfo)}</h2>`;
    el.innerHTML = `${tournamentName}${dates}`;
  }

  const info = document.getElementById(getTabContentId('Info'));
  removeAllChildNodes(info);
  const profileBlock = renderRegistrationProfile(tournamentInfo.registrationProfile, t);
  if (profileBlock) info.appendChild(profileBlock);
  if (tournamentInfo.notes) {
    const notesBlock = document.createElement('div');
    notesBlock.className = 'tournament-notes';
    notesBlock.innerHTML = tournamentInfo.notes;
    info.appendChild(notesBlock);
  }
  const venuesBlock = renderVenues(tournamentInfo.venues);
  if (venuesBlock) info.appendChild(venuesBlock);
  const hasInfo = !!(profileBlock || tournamentInfo.notes || venuesBlock);
  if (hasInfo) displayTab('Info');
  else hideTab('Info');

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

    const teamsGrid = document.createElement('div');
    teamsGrid.id = 'teamsGrid';
    // Hidden by default until `createTeamsGrid` confirms the tournament has
    // any TEAM participants. Avoids a flash of empty whitespace on the
    // INDIVIDUAL-only path that all current public tournaments are on.
    teamsGrid.style.display = 'none';
    players.appendChild(teamsGrid);

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
  } else if (hasInfo) {
    targetTab = 'Info';
  } else if (hasEvents) {
    targetTab = 'Events';
  }

  if (targetTab) {
    displayTabContent(targetTab);
  }
}
