import { compositions, renderContainer, renderStructure } from 'courthive-components';
import { dropDownButton } from 'src/components/buttons/dropDownButton';
import { getEventData } from 'src/services/api/tournamentsApi';
import { LEFT } from 'src/common/constants/baseConstants';

export function renderEvent({ tournamentId, eventId, header, flightDisplay }) {
  const composition = compositions['National'];

  const removeStructureButton = () => document.getElementById('structureButton')?.remove();

  getEventData({ tournamentId, eventId }).then((eventData) => {
    if (window?.['dev']) {
      window['dev']['eventData'] = eventData.data.drawsData;
    }
    const structureMatchUps = (structure) => Object.values(structure.roundMatchUps || {}).flat();
    const flightHasMatchUps = (flight) =>
      flight.structures?.some((structure) => structureMatchUps(structure).length > 0);

    const flightsData = eventData?.data?.drawsData.filter(flightHasMatchUps);
    const renderFlight = (index) => {
      const flight = flightsData[index];
      if (!flight) return;
      const drawId = flight.drawId;

      const renderSelectedStructure = (index) => {
        const structure = flight.structures?.[index];
        const structureId = structure.structureId;
        const filteredMatchUps = Object.values(structure.roundMatchUps || {}).flat();
        flightDisplay.innerHTML = flight.drawName;
        const content = renderContainer({
          content: renderStructure({
            context: { drawId, structureId },
            // searchActive: participantFilter,
            matchUps: filteredMatchUps,
            // initialRoundNumber: 3,
            // eventHandlers,
            composition,
            structure
          }),
          theme: composition.theme
        });
        removeAllChildNodes(flightDisplay);
        flightDisplay.appendChild(content);
      };

      if (flight.structures?.length > 1) {
        const structureOptions = flight.structures.map(({ structureName }, i) => ({
          onClick: () => renderSelectedStructure(i),
          label: structureName,
          close: true
        }));
        const structureButton = {
          label: flight.structures[0].structureName,
          options: structureOptions,
          id: 'structureButton',
          modifyLabel: true,
          selection: true,
          location: LEFT
        };
        const elem = dropDownButton({ button: structureButton });
        header.appendChild(elem);
      }

      const structure = flight.structures?.[0];
      if (!structure) return;

      renderSelectedStructure(0);
    };

    const flightOptions = flightsData.map(({ drawName }, i) => ({
      onClick: () => renderFlight(i),
      label: drawName,
      close: true
    }));
    const flightButton = {
      label: flightsData?.[0]?.drawName,
      options: flightOptions,
      id: 'flightButton',
      modifyLabel: true,
      selection: true,
      location: LEFT
    };
    const elem = dropDownButton({ button: flightButton, stateChange: removeStructureButton });
    header.appendChild(elem);

    renderFlight(0);
  });
}

export function removeAllChildNodes(parent) {
  if (!parent) return;

  while (parent.firstChild) {
    parent.removeChild(parent.firstChild);
  }
}
