import {
  resolvePublishedComposition,
  renderContainer,
  renderStructure,
  InlineScoringManager,
} from 'courthive-components';
import {
  applyInlineScoringWrappers,
  buildInlineCrowdManager,
  getScoredMatchUpIds,
  loadSavedSessionsForTournament,
  markReadyMatchUpsInProgress,
  overlayLocalScores,
  unmarkReadyMatchUpsInProgress,
  withInlineScoringConfig,
} from 'src/services/inlineCrowdScoring';
import { buildRoundChips, isRoundSelectable, resolveInitialRoundNumber } from 'src/services/roundChips';
import { installMobileBracketLayout, type RoundSelection } from 'src/services/mobileBracketLayout';
import { filterRoundMatchUps, normalizeSearch } from 'src/common/filters/participantMatch';
import { createRoundsTable } from 'src/components/tables/roundsTable/createRoundsTable';
import { createStatsTable } from 'src/components/tables/statsTable/createStatsTable';
import { openScoringLaunchMenu } from 'src/components/scoringLaunchMenu';
import { openScorecard } from 'src/components/scorecard/openScorecard';
import { dropDownButton } from 'src/components/buttons/dropDownButton';
import { consumePendingMatchUpFocus } from 'src/services/matchUpFocus';
import { searchInput } from 'src/components/controlBar/searchInput';
import { prefetchScoringLaunch } from 'src/services/scoringLaunch';
import { drawsGovernor, drawDefinitionConstants, tools } from 'tods-competition-factory';
import { getDrawData, getEventData } from 'src/services/api/tournamentsApi';
import { getRoundDisplayOptions } from './renderRoundOptions';
import { context } from 'src/common/context';
import { t } from 'src/i18n/i18n';

// constants
import { LEFT } from 'src/common/constants/baseConstants';
import { updateRouteUrl } from 'src/router/router';

const { CONTAINER } = drawDefinitionConstants;

function getMatchUpFromPointer(matchUpsMap: Record<string, any>, props: any) {
  let el = props.pointerEvent?.target as HTMLElement;
  while (el && !el.classList?.contains('tmx-m')) el = el.parentElement as HTMLElement;
  return matchUpsMap[el?.getAttribute('id')];
}

function maybeOpenTeamScorecard(mu: any, display: any) {
  if (mu?.matchUpType === 'TEAM' && mu.tieMatchUps?.length) openScorecard({ matchUp: mu, display });
}

function isTeamScorecard(mu: any): boolean {
  return mu?.matchUpType === 'TEAM' && mu.tieMatchUps?.length;
}

function renderRoundsColumns({
  tournamentId,
  flightDisplay,
  matchUps,
  composition,
  drawId,
  structureId,
  display,
  inlineManager,
  liveScoring,
  initialRoundNumber,
  searchActive,
  roundSelection,
}: {
  tournamentId: string;
  flightDisplay: HTMLElement;
  matchUps: any[];
  composition: any;
  drawId: string;
  structureId: string;
  display: any;
  inlineManager?: InlineScoringManager;
  liveScoring?: { active: boolean; onChange: (next: boolean) => void };
  initialRoundNumber?: number;
  searchActive?: boolean;
  roundSelection?: RoundSelection;
}) {
  const matchUpsMap = Object.fromEntries(matchUps.map(toMatchUpEntry));
  const eventHandlers = {
    // Score area keeps the direct team-scorecard shortcut (no-op for singles).
    scoreClick: (props: any) => maybeOpenTeamScorecard(getMatchUpFromPointer(matchUpsMap, props), display),
    // Clicking the matchUp body opens the scoring-launch popover. For a TEAM
    // matchUp the scorecard is offered as the first item so it stays reachable.
    matchUpClick: (props: any) => {
      const mu = getMatchUpFromPointer(matchUpsMap, props);
      if (!mu?.matchUpId) return;
      const extraItems = isTeamScorecard(mu)
        ? [{ label: t('scoring.openScorecard'), onClick: () => openScorecard({ matchUp: mu, display }) }]
        : [];
      void openScoringLaunchMenu({ pointerEvent: props.pointerEvent, matchUp: mu, tournamentId, extraItems });
    },
  };

  if (inlineManager) markReadyMatchUpsInProgress(matchUps);

  const structureContent = renderStructure({
    context: { drawId, structureId },
    initialRoundNumber,
    searchActive,
    eventHandlers,
    matchUps,
    composition,
    structureId,
  });

  if (inlineManager) {
    applyInlineScoringWrappers({
      container: structureContent,
      matchUps,
      manager: inlineManager,
      composition,
    });
  }

  const content = renderContainer({
    content: structureContent,
    theme: composition.theme,
  });
  flightDisplay.appendChild(content);

  // Round nav bar (always visible) + mobile snap/stack layout below 768px.
  // Tear down any prior install before rebuilding so observers don't leak
  // across flight/structure switches.
  context.teardownMobileBracket?.();
  context.teardownMobileBracket = installMobileBracketLayout({
    flightDisplay,
    structureContent,
    matchUps,
    liveScoring,
    roundSelection,
  });

  // A matchUp arriving from the schedule's "view in draw" is scrolled to and
  // pulsed here — once the structure it lives in is actually in the DOM. Left
  // pending if this render is a different structure, so the render that does
  // carry it can still consume it.
  consumePendingMatchUpFocus(flightDisplay);
}

function toMatchUpEntry(m: any) {
  return [m.matchUpId, m];
}

function isNotBye(matchUp: any): boolean {
  return matchUp?.matchUpStatus !== 'BYE';
}

function readLocalStorageFlag(key: string): boolean {
  try {
    return globalThis.localStorage?.getItem(key) === '1';
  } catch {
    return false;
  }
}

function writeLocalStorageFlag(key: string, value: boolean): void {
  try {
    globalThis.localStorage?.setItem(key, value ? '1' : '0');
  } catch {
    // Private mode or unavailable — preference resets per session.
  }
}

function buildStructureOption({
  tournamentId,
  eventId,
  drawId,
  initialStructureIndex,
  renderSelectedStructure,
}: {
  tournamentId: string;
  eventId: string;
  drawId: string;
  initialStructureIndex: number;
  renderSelectedStructure: (i: number) => void;
}) {
  return ({ structureName, structureId }: any, i: number) => ({
    onClick: () => {
      updateRouteUrl({ tournamentId, eventId, drawId, structureId });
      renderSelectedStructure(i);
    },
    isActive: i === initialStructureIndex,
    label: structureName,
    close: true,
  });
}

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
  const removeFlightButton = () => document.getElementById('flightButton')?.remove();
  const removeStructureButton = () => document.getElementById('structureButton')?.remove();
  const removeRoundDisplayButton = () => document.getElementById('roundDisplayButton')?.remove();
  const removeEventSearch = () => document.getElementById('eventSearch')?.remove();

  // Participant search over the rendered structure. TMX filters the structure's
  // roundMatchUps and tells `renderStructure` a search is active so the layout
  // keeps its shape with fewer matchUps in it; the public viewer does the same.
  // Held across flight/structure switches within one event — a spectator who
  // typed a name is looking for that person in every draw of the event.
  let participantFilter = '';
  // Round selected by a chip, per structure. Cleared on a structure switch so a
  // stale "SF" does not open an unrelated playoff collapsed.
  let selectedRoundNumber: number | undefined;
  let selectedRoundStructureId: string | undefined;

  // Store a refresh callback so live updates can re-fetch the current draw view.
  // Uses the params as passed — targetDrawId/targetStructureId are consumed on first render,
  // so subsequent refreshes will re-render the default (first) flight/structure.
  context.refreshEventView = () => renderEvent({ tournamentId, eventId, header, flightDisplay, displayFormat });

  const hydrateParticipants = false;
  // Warm the provider scoring-launch config so the per-matchUp "Score this
  // match" popover opens instantly on first click.
  prefetchScoringLaunch(tournamentId);
  // Kick off IndexedDB read in parallel with the network fetch so the user's
  // crowd sessions are available by the time we render the bracket.
  const savedSessionsPromise = loadSavedSessionsForTournament(tournamentId);
  getEventData({ tournamentId, eventId, hydrateParticipants }).then(async (data) => {
    const eventData = data?.data?.eventData || data?.data;
    const participants = data?.data?.participants || [];
    if (window?.['dev']) window['dev']['eventData'] = eventData;
    const savedSessions = await savedSessionsPromise;
    const structureMatchUps = (structure) => {
      return Object.values(structure.roundMatchUps || {}).flat();
    };
    const flightHasMatchUps = (flight) =>
      flight.structures?.some((structure) => structureMatchUps(structure).length > 0);

    // A STUB carries no `structures` key at all (factory `buildDrawStub`); a full draw always does.
    // That is the discriminator this whole path turns on — no server-version sniffing, no flag. A
    // server that does not understand `drawsProfile` returns full draws and every flight is simply
    // already loaded, which is exactly today's behaviour.
    const isLoaded = (flight) => Array.isArray(flight?.structures);

    // For a stub, the factory's own `drawGenerated` replaces counting matchUps we have not fetched.
    // NOT equivalent: `drawGenerated` reflects the drawDefinition, while `flightHasMatchUps` reflects
    // what survived publish-state filtering INSIDE getDrawData, which a stub never sees. So a published
    // draw whose structures are all unpublished passes here and would render empty — `dropEmptyFlight`
    // below removes it once loading proves it has nothing, rather than guessing up front.
    const flightIsOfferable = (flight) => (isLoaded(flight) ? flightHasMatchUps(flight) : flight.drawGenerated);

    const flightsData = (eventData?.drawsData || []).filter(flightIsOfferable);

    // Participant lookup — used for initial hydration and live update patching
    const mappedParticipants = new Map(participants.map((p) => [p.participantId, p]));

    const hydrateSideParticipants = (matchUp) => {
      for (const side of matchUp.sides || []) {
        if (side.participantId) {
          const participant: any = mappedParticipants.get(side.participantId);
          // MERGE rather than overwrite: an unhydrated side carries draw-scoped attributes
          // (entryStage, entryStatus, luckyAdvancement) that the tournament participant record does
          // not, and assigning over them silently discarded the difference.
          if (participant) side.participant = { ...(side.participant ?? {}), ...participant };
          if (side.participant?.individualParticipantIds) {
            side.participant.individualParticipants = side.participant.individualParticipantIds.map((id) =>
              mappedParticipants.get(id),
            );
          }
        }
      }
    };

    const hydrateStructures = (structures: any[]) => {
      for (const structure of structures || []) {
        Object.values(structure.roundMatchUps || {})
          .flat()
          .forEach((matchUp: any) => {
            hydrateSideParticipants(matchUp);
            matchUp.tieMatchUps?.forEach(hydrateSideParticipants);
          });
      }
    };

    if (!hydrateParticipants) {
      for (const flight of flightsData) if (isLoaded(flight)) hydrateStructures(flight.structures);
    }

    // Track current flight/structure indices for re-render after patch
    let currentFlightIndex = 0;
    let currentStructureIndex = 0;

    // One InlineScoringManager per event-render. Engines are pre-seeded from
    // the saved crowd sessions for this tournament so a refresh resumes the
    // user mid-game. The same manager is re-used across flight/structure
    // switches and across live-scoring toggle flips so engine state isn't
    // lost when the user switches tabs or turns the toggle off and back on.
    const allMatchUps: any[] = flightsData.flatMap((flight: any) =>
      (flight.structures || []).flatMap((s: any) => Object.values(s.roundMatchUps || {}).flat()),
    );
    const inlineManager = buildInlineCrowdManager({ tournamentId, savedSessions, matchUps: allMatchUps });

    // Build drawPosition → participant map per structure from hydrated matchUps.
    // Within a structure, drawPosition→participant is fixed at draw generation time.
    //
    // Declared here, and applied PER DRAW LOAD rather than once, because a lazily-loaded draw's
    // structures do not exist when the event payload arrives — indexing only at that moment would
    // leave every later draw without a map, and cross-structure advancement in patchEventMatchUps
    // silently unable to rehydrate a side.
    const dpParticipantMaps = new Map<string, Map<number, any>>(); // structureId → (drawPosition → participant)
    const indexDrawPositions = (structures: any[]) => {
      for (const structure of structures || []) {
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
    };

    // Load one draw's structures on demand and splice them into its stub IN PLACE, so everything
    // downstream — renderFlight, the stats/rounds tables, dpParticipantMaps, patchEventMatchUps —
    // keeps seeing exactly the shape it saw when the whole event arrived at once.
    //
    // Matchups from a lazily-loaded draw reach the inline scoring manager through
    // `applyInlineScoringWrappers`, which registers what it renders (courthive-public #498). Nothing
    // needs to register them here, and deliberately so: a rule the loader has to remember is a rule a
    // future loader will forget.
    const loading = new Map<string, Promise<void>>();
    const loadFlight = (flight: any): Promise<void> => {
      const existing = loading.get(flight.drawId);
      if (existing) return existing;

      const pending = getDrawData({ tournamentId, drawId: flight.drawId })
        .then((response) => {
          const structures = response?.data?.structures;
          // Absent structures means the fetch failed or the draw is gone. Assign [] rather than
          // leaving the key unset, or `isLoaded` stays false and every render retries forever.
          flight.structures = Array.isArray(structures) ? structures : [];
          hydrateStructures(flight.structures);
          indexDrawPositions(flight.structures);
        })
        .catch((err) => {
          console.warn('[renderEvent] draw load failed', flight.drawId, err);
          flight.structures = [];
        });

      loading.set(flight.drawId, pending);
      return pending;
    };

    // Live-scoring toggle — opt-in. Default is OFF so the bracket renders
    // with the TD's published composition unchanged. Per-(tournament, event)
    // preference persists in localStorage.
    const liveScoringKey = `chp.live-scoring.${tournamentId}.${eventId}`;
    let liveScoringActive = readLocalStorageFlag(liveScoringKey);
    const setLiveScoringActive = (next: boolean) => {
      liveScoringActive = next;
      writeLocalStorageFlag(liveScoringKey, next);
      renderFlight(currentFlightIndex);
    };

    const renderFlight = (index) => {
      const pendingFlight = flightsData[index];
      if (!pendingFlight) return;

      // SYNCHRONOUS whenever the flight is already loaded. patchEventMatchUps calls renderFlight and
      // then restores scroll positions inside a requestAnimationFrame; making this unconditionally
      // async would let the frame fire before the DOM was rebuilt and lose the scroll position on
      // every live update.
      if (!isLoaded(pendingFlight)) {
        void loadFlight(pendingFlight).then(() => renderLoadedFlight(index));
        return;
      }
      renderLoadedFlight(index);
    };

    const renderLoadedFlight = (index) => {
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
        // Chips describe the WHOLE structure, so they are built before the
        // search narrows it: a search that leaves one hit in the semifinals
        // must not collapse the bracket to a single chip.
        const allMatchUps = Object.values(structure.roundMatchUps || {}).flat() as any[];
        const searchActive = !!normalizeSearch(participantFilter);
        const matchUps = searchActive
          ? (Object.values(filterRoundMatchUps(structure.roundMatchUps, participantFilter)).flat() as any[])
          : allMatchUps;
        const isAdHoc = drawsGovernor.isAdHoc({ structure });
        if (isAdHoc) matchUps.sort(tools.matchUpScheduleSort);

        if (selectedRoundStructureId !== structureId) {
          selectedRoundStructureId = structureId;
          selectedRoundNumber = undefined;
        }
        const chips = buildRoundChips(allMatchUps);
        const isRoundRobin = structure?.structureType === CONTAINER;
        const roundSelectable = isRoundSelectable({ chips, isRoundRobin, isAdHoc });
        const initialRoundNumber = roundSelectable
          ? resolveInitialRoundNumber({ chips, selectedRoundNumber, searchActive })
          : 1;
        const roundSelection: RoundSelection | undefined = roundSelectable
          ? { chips, activeRoundNumber: initialRoundNumber, onSelect: selectRound }
          : undefined;

        flightDisplay.innerHTML = flight.drawName;
        removeAllChildNodes(flightDisplay);

        const display = { ...eventData?.eventInfo?.display, ...flight?.display, ...structure?.display };
        const baseComposition = resolvePublishedComposition(display);
        baseComposition.configuration.genderColor = true;
        // Live scoring layered in only when the visitor opted in via the
        // toggle on the round nav bar. Default = TD's published composition
        // is rendered unchanged.
        const composition = liveScoringActive ? withInlineScoringConfig(baseComposition) : baseComposition;
        const activeInlineManager = liveScoringActive ? inlineManager : undefined;
        const liveScoring = { active: liveScoringActive, onChange: setLiveScoringActive };

        // Toggle OFF: revert the IN_PROGRESS mutation written by a prior
        // toggle-ON render, except for matchUps that were actually scored
        // — those keep their [LIVE] badge so the visitor can still see
        // which matchUps they've engaged with locally.
        const scoredIds = getScoredMatchUpIds(inlineManager);
        if (!liveScoringActive) {
          unmarkReadyMatchUpsInProgress(matchUps, scoredIds);
        }
        // Overlay each scored matchUp's engine score onto matchUp.score so
        // the locally-entered score is visible in the bracket even when
        // Track is toggled off. Idempotent across renders.
        overlayLocalScores(matchUps, inlineManager, scoredIds);

        if (displayFormat === 'roundsColumns') {
          renderRoundsColumns({
            tournamentId,
            flightDisplay,
            matchUps,
            composition,
            drawId,
            structureId,
            display,
            inlineManager: activeInlineManager,
            liveScoring,
            initialRoundNumber,
            searchActive,
            roundSelection,
          });
        } else if (displayFormat === 'roundsStats') {
          createStatsTable({ drawId, structureId, eventData, participants });
        } else if (searchActive) {
          // The table builds its own rows from eventData when given no matchUps,
          // which would ignore the search — hand it the filtered set instead,
          // minus BYEs, which is what its internal path drops too.
          createRoundsTable({ drawId, structureId, eventData, matchUps: matchUps.filter(isNotBye) });
        } else {
          createRoundsTable({ drawId, structureId, eventData });
        }
      };

      // Declared beside `renderSelectedStructure` rather than inside it: an
      // arrow defined in there would sit five function levels deep, which the
      // ecosystem's nesting rule refuses. Re-renders the structure currently on
      // screen, so it stays correct across structure switches.
      const selectRound = (roundNumber: number) => {
        selectedRoundNumber = roundNumber;
        renderSelectedStructure(currentStructureIndex);
      };

      const initialStructureIndex = targetStructureId
        ? Math.max(flight.structures?.findIndex((s) => s.structureId === targetStructureId) ?? -1, 0)
        : currentStructureIndex;
      // consume after use so subsequent renders use currentStructureIndex
      targetStructureId = undefined;

      removeStructureButton();
      if (flight.structures?.length > 1) {
        const structureOptions = flight.structures.map(
          buildStructureOption({ tournamentId, eventId, drawId, initialStructureIndex, renderSelectedStructure }),
        );
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
    removeFlightButton();
    removeStructureButton();
    removeRoundDisplayButton();
    const elem = dropDownButton({ button: flightButton, stateChange: removeStructureButton });
    header.appendChild(elem);

    // Participant search. Appended once per event render and never rebuilt by a
    // flight / structure / round re-render, so typing keeps focus and the caret;
    // CSS `order` pins it to the end of the header whatever is appended later.
    removeEventSearch();
    header.appendChild(
      searchInput({
        onChange: (value) => {
          participantFilter = value;
          renderFlight(currentFlightIndex);
        },
        placeholder: t('search.participants'),
        value: participantFilter,
        id: 'eventSearch',
      }),
    );

    // Index whatever is loaded now. Draws that arrive later index themselves as they load.
    for (const flight of flightsData) if (isLoaded(flight)) indexDrawPositions(flight.structures);

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
