import { TOURNAMENT_LOGO, TOURNAMENT_TITLE_BLOCK } from 'src/common/constants/elementConstants';
import { displayTab, displayTabContent } from './helpers/tabDisplay';
import { removeAllChildNodes, renderEvent } from './renderEvent';
import { dropDownButton } from 'src/components/dropDownButton';
import { LEFT } from 'src/common/constants/tableConstants';
import { getTabContentId } from './helpers/tabIds';
import { dateString } from './helpers/dateString';

export async function renderTournament(result) {
  const tournamentInfo = result?.data?.tournamentInfo;

  const tournamentImage = tournamentInfo.onlineResources?.find((resource) => resource.name === 'tournamentImage');
  if (tournamentImage.identifier) {
    const el = document.getElementById(TOURNAMENT_LOGO);
    el.innerHTML = `<img src="${tournamentImage?.identifier}" alt="${tournamentInfo.name}" style="max-height: 20em" />`;
  }

  if (tournamentInfo.tournamentName) {
    const el = document.getElementById(TOURNAMENT_TITLE_BLOCK);
    const tournamentName = `<h1>${tournamentInfo.tournamentName}</h1>`;
    const dates = `<h2>${dateString(tournamentInfo)}</h2>`;
    el.innerHTML = `${tournamentName}${dates}`;
  }

  if (tournamentInfo.notes) {
    const el = document.getElementById(getTabContentId('Info'));
    el.innerHTML = tournamentInfo.notes;
    displayTabContent('Info');
    displayTab('Info');
  }

  if (tournamentInfo.eventInfo?.length) {
    const tournamentId: string = tournamentInfo.tournamentId;

    const el = document.getElementById(getTabContentId('Events'));
    removeAllChildNodes(el);

    const header = document.createElement('div');
    const flightDisplay = document.createElement('div');

    const eventOptions = tournamentInfo.eventInfo.map(({ eventId, eventName }) => ({
      onClick: () => renderEvent({ tournamentId, eventId, header, flightDisplay }),
      label: eventName,
      close: true
    }));
    const eventButton = {
      label: tournamentInfo.eventInfo[0].eventName,
      options: eventOptions,
      id: 'eventButton',
      modifyLabel: true,
      selection: true,
      location: LEFT
    };
    const removeFlightButtons = () => {
      document.getElementById('structureButton')?.remove();
      document.getElementById('flightButton')?.remove();
    };
    const elem = dropDownButton({ button: eventButton, stateChange: removeFlightButtons });
    const eventId: string = tournamentInfo.eventInfo[0].eventId;
    header.className = 'block';
    header.appendChild(elem);
    el.appendChild(header);
    el.appendChild(flightDisplay);
    renderEvent({ tournamentId, eventId, header, flightDisplay });

    displayTab('Events');
  }
}
