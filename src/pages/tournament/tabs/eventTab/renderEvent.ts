import { createRoundsTable } from 'src/components/tables/roundsTable/createRoundsTable';
import { compositions, renderContainer, renderStructure } from 'courthive-components';
import { createStatsTable } from 'src/components/tables/statsTable/createStatsTable';
import { dropDownButton } from 'src/components/buttons/dropDownButton';
import { drawsGovernor, tools } from 'tods-competition-factory';
import { getEventData } from 'src/services/api/tournamentsApi';
import { getRoundDisplayOptions } from './renderRoundOptions';

// constants
import { LEFT } from 'src/common/constants/baseConstants';
import { updateRouteUrl } from 'src/router/router';

export function renderEvent({
  tournamentId,
  eventId,
  header,
  flightDisplay,
  displayFormat,
  drawId: targetDrawId,
  structureId: targetStructureId,
}: {
  tournamentId: string;
  eventId: string;
  header: HTMLElement;
  flightDisplay: HTMLElement;
  displayFormat: string;
  drawId?: string;
  structureId?: string;
}) {
  const removeStructureButton = () => document.getElementById('structureButton')?.remove();
  const removeRoundDisplayButton = () => document.getElementById('roundDisplayButton')?.remove();

  const hydrateParticipants = false;
  getEventData({ tournamentId, eventId, hydrateParticipants }).then((data) => {
    const eventData = data?.data?.eventData || data?.data;
    const participants = data?.data?.participants || [];
    if (window?.['dev']) window['dev']['eventData'] = eventData;
    const structureMatchUps = (structure) => {
      return Object.values(structure.roundMatchUps || {}).flat();
    };
    const flightHasMatchUps = (flight) =>
      flight.structures?.some((structure) => structureMatchUps(structure).length > 0);

    const flightsData = eventData?.drawsData.filter(flightHasMatchUps);

    if (!hydrateParticipants) {
      const mappedParticipants = new Map(participants.map((p) => [p.participantId, p]));
      const hydrateSideParticipants = (matchUp) => {
        for (const side of matchUp.sides || []) {
          if (side.participantId) {
            side.participant = mappedParticipants.get(side.participantId);
            if (side.participant?.individualParticipantIds) {
              side.participant.individualParticipants = side.participant.individualParticipantIds.map((id) =>
                mappedParticipants.get(id),
              );
            }
          }
        }
      };

      for (const flight of flightsData) {
        for (const structure of flight.structures) {
          Object.values(structure.roundMatchUps || {})
            .flat()
            .forEach((matchUp: any) => {
              hydrateSideParticipants(matchUp);
              matchUp.tieMatchUps?.forEach(hydrateSideParticipants);
            });
        }
      }
    }

    const renderFlight = (index) => {
      const flight = flightsData[index];
      if (!flight) return;
      const drawId = flight.drawId;
      const updateView = ({ view }) => {
        if (view) displayFormat = view;
        renderFlight(index);
      };

      const renderSelectedStructure = (index) => {
        const structure = flight.structures?.[index];
        removeRoundDisplayButton();
        const roundView = getRoundDisplayOptions({ callback: updateView, structure });
        const elem = dropDownButton({ button: roundView });
        header.appendChild(elem);

        const structureId = structure.structureId;
        const matchUps = Object.values(structure.roundMatchUps || {}).flat() as any[];
        const isAdHoc = drawsGovernor.isAdHoc({ structure });
        if (isAdHoc) matchUps.sort(tools.matchUpScheduleSort);
        flightDisplay.innerHTML = flight.drawName;
        removeAllChildNodes(flightDisplay);

        const display = { ...eventData?.eventInfo?.display, ...flight?.display, ...structure?.display };
        const compositionName = display?.compositionName;
        const configuration = display?.configuration;
        const composition = compositions[compositionName ?? 'National'];
        Object.assign(composition.configuration, configuration);
        composition.configuration.genderColor = true;

        if (displayFormat === 'roundsColumns') {
          const content = renderContainer({
            content: renderStructure({
              context: { drawId, structureId },
              // searchActive: participantFilter,
              matchUps,
              composition,
              structureId,
            }),
            theme: composition.theme,
          });
          flightDisplay.appendChild(content);
        } else if (displayFormat === 'roundsStats') {
          createStatsTable({ drawId, structureId, eventData, participants });
        } else {
          createRoundsTable({ drawId, structureId, eventData });
        }
      };

      const initialStructureIndex = targetStructureId
        ? Math.max(
            flight.structures?.findIndex((s) => s.structureId === targetStructureId) ?? -1,
            0,
          )
        : 0;
      // consume after use so subsequent renders default to first
      targetStructureId = undefined;

      if (flight.structures?.length > 1) {
        const structureOptions = flight.structures.map(({ structureName, structureId }, i) => ({
          onClick: () => {
            updateRouteUrl({ tournamentId, eventId, drawId, structureId });
            renderSelectedStructure(i);
          },
          isActive: i === initialStructureIndex,
          label: structureName,
          close: true,
        }));
        const structureButton = {
          label: flight.structures[initialStructureIndex].structureName,
          options: structureOptions,
          id: 'structureButton',
          modifyLabel: true,
          selection: true,
          location: LEFT,
        };
        const elem = dropDownButton({ button: structureButton });
        header.appendChild(elem);
      }

      const structure = flight.structures?.[initialStructureIndex];
      if (!structure) return;

      renderSelectedStructure(initialStructureIndex);
    };

    const initialFlightIndex = targetDrawId
      ? Math.max(
          flightsData.findIndex((f) => f.drawId === targetDrawId),
          0,
        )
      : 0;
    // consume after use so subsequent renders default to first
    targetDrawId = undefined;

    const flightOptions = flightsData.map(({ drawName, drawId }, i) => ({
      onClick: () => {
        updateRouteUrl({ tournamentId, eventId, drawId });
        renderFlight(i);
      },
      isActive: i === initialFlightIndex,
      label: drawName,
      close: true,
    }));
    const flightButton = {
      label: flightsData?.[initialFlightIndex]?.drawName,
      options: flightOptions,
      modifyLabel: true,
      id: 'flightButton',
      selection: true,
      location: LEFT,
    };
    const elem = dropDownButton({ button: flightButton, stateChange: removeStructureButton });
    header.appendChild(elem);

    renderFlight(initialFlightIndex);
  });
}

export function removeAllChildNodes(parent) {
  if (!parent) return;

  while (parent.firstChild) {
    parent.removeChild(parent.firstChild);
  }
}
