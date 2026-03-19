import { resolvePublishedComposition, renderContainer, renderStructure } from 'courthive-components';
import { createRoundsTable } from 'src/components/tables/roundsTable/createRoundsTable';
import { createStatsTable } from 'src/components/tables/statsTable/createStatsTable';
import { dropDownButton } from 'src/components/buttons/dropDownButton';
import { drawsGovernor, tools } from 'tods-competition-factory';
import { getEventData } from 'src/services/api/tournamentsApi';
import { getRoundDisplayOptions } from './renderRoundOptions';
import { context } from 'src/common/context';

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

  // Store a refresh callback so live updates can re-fetch the current draw view.
  // Uses the params as passed — targetDrawId/targetStructureId are consumed on first render,
  // so subsequent refreshes will re-render the default (first) flight/structure.
  context.refreshEventView = () => renderEvent({ tournamentId, eventId, header, flightDisplay, displayFormat });

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

    // Participant lookup — used for initial hydration and live update patching
    const mappedParticipants = new Map(participants.map((p) => [p.participantId, p]));

    if (!hydrateParticipants) {
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

    // Track current flight/structure indices for re-render after patch
    let currentFlightIndex = 0;
    let currentStructureIndex = 0;

    const renderFlight = (index) => {
      currentFlightIndex = index;
      const flight = flightsData[index];
      if (!flight) return;
      const drawId = flight.drawId;
      const updateView = ({ view }) => {
        if (view) displayFormat = view;
        renderFlight(index);
      };

      const renderSelectedStructure = (index) => {
        currentStructureIndex = index;
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
        const composition = resolvePublishedComposition(display);
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
        ? Math.max(flight.structures?.findIndex((s) => s.structureId === targetStructureId) ?? -1, 0)
        : currentStructureIndex;
      // consume after use so subsequent renders use currentStructureIndex
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

    // Build drawPosition → participant map per structure from existing hydrated matchUps.
    // Within a structure, drawPosition→participant is fixed at draw generation time.
    const dpParticipantMaps = new Map<string, Map<number, any>>(); // structureId → (drawPosition → participant)
    for (const flight of flightsData) {
      for (const structure of flight.structures || []) {
        const dpMap = new Map<number, any>();
        for (const roundMatchUps of Object.values(structure.roundMatchUps || {})) {
          for (const matchUp of roundMatchUps as any[]) {
            for (const side of matchUp.sides || []) {
              if (side.drawPosition && side.participant) {
                dpMap.set(side.drawPosition, side.participant);
              }
            }
          }
        }
        dpParticipantMaps.set(structure.structureId, dpMap);
      }
    }

    // Expose a callback that patches matchUps in-memory and re-renders the current structure.
    // This avoids re-fetching from the server (which may serve stale cached data).
    context.patchEventMatchUps = (updatedMatchUps: any[], positionAssignments?: any[]) => {
      const updatedById = new Map(updatedMatchUps.map((m) => [m.matchUpId, m]));

      // Update position assignment maps for cross-structure advancement (e.g. consolation)
      if (positionAssignments?.length) {
        for (const pa of positionAssignments) {
          if (!pa.structureId || !pa.assignments) continue;
          const dpMap = dpParticipantMaps.get(pa.structureId) || new Map();
          for (const assignment of pa.assignments) {
            if (assignment.drawPosition && assignment.participantId) {
              // Look up participant from our master map
              const participant = mappedParticipants.get(assignment.participantId);
              if (participant) {
                dpMap.set(assignment.drawPosition, participant);
              }
            }
          }
          dpParticipantMaps.set(pa.structureId, dpMap);
        }
      }

      let patched = 0;
      for (const flight of flightsData) {
        for (const structure of flight.structures || []) {
          const dpMap = dpParticipantMaps.get(structure.structureId);
          for (const roundMatchUps of Object.values(structure.roundMatchUps || {})) {
            for (const matchUp of roundMatchUps as any[]) {
              const update = updatedById.get(matchUp.matchUpId);
              if (update) {
                if (update.score !== undefined) matchUp.score = update.score;
                if (update.matchUpStatus !== undefined) matchUp.matchUpStatus = update.matchUpStatus;
                if (update.winningSide !== undefined) matchUp.winningSide = update.winningSide;
                // Re-hydrate sides from drawPositions using the position→participant map
                if (update.drawPositions && dpMap) {
                  matchUp.drawPositions = update.drawPositions;
                  // Ensure sides array exists with correct length
                  if (!matchUp.sides) matchUp.sides = [];
                  for (let i = 0; i < update.drawPositions.length; i++) {
                    const dp = update.drawPositions[i];
                    if (!dp) continue;
                    const sideNumber = i + 1;
                    let side = matchUp.sides.find((s) => s.sideNumber === sideNumber);
                    if (!side) {
                      side = { sideNumber };
                      matchUp.sides.push(side);
                    }
                    side.drawPosition = dp;
                    const participant = dpMap.get(dp);
                    if (participant) {
                      side.participantId = participant.participantId;
                      side.participant = participant;
                    }
                  }
                }
                patched++;
              }
              // Also check tieMatchUps
              for (const tie of matchUp.tieMatchUps || []) {
                const tieUpdate = updatedById.get(tie.matchUpId);
                if (tieUpdate) {
                  if (tieUpdate.score !== undefined) tie.score = tieUpdate.score;
                  if (tieUpdate.matchUpStatus !== undefined) tie.matchUpStatus = tieUpdate.matchUpStatus;
                  if (tieUpdate.winningSide !== undefined) tie.winningSide = tieUpdate.winningSide;
                  patched++;
                }
              }
            }
          }
        }
      }

      console.log(`[renderEvent] patched ${patched} matchUp(s) in-memory, re-rendering structure`);

      // Save scroll positions for all scrollable ancestors + window
      const scrollPositions: { el: Element; top: number; left: number }[] = [];
      let el: Element | null = flightDisplay;
      while (el) {
        if (el.scrollTop || el.scrollLeft) {
          scrollPositions.push({ el, top: el.scrollTop, left: el.scrollLeft });
        }
        el = el.parentElement;
      }
      const winScrollX = window.scrollX;
      const winScrollY = window.scrollY;

      renderFlight(currentFlightIndex);

      // Restore after DOM is updated
      requestAnimationFrame(() => {
        for (const { el, top, left } of scrollPositions) {
          el.scrollTop = top;
          el.scrollLeft = left;
        }
        window.scrollTo(winScrollX, winScrollY);
      });
    };

    renderFlight(initialFlightIndex);
  });
}

export function removeAllChildNodes(parent) {
  if (!parent) return;

  while (parent.firstChild) {
    parent.firstChild.remove();
  }
}
