import { createTournamentsTable } from 'src/pages/tournaments/createTournamentsTable';
import { renderTournament } from 'src/pages/tournament/renderTournament';
import { destroyCurrentShell, renderTrackPage } from 'src/pages/track/renderTrackPage';
import { connectAndJoinRoom, leaveRoom } from 'src/services/liveUpdates';
import { renderMagicLinkConsume } from 'src/pages/me/renderMagicLinkConsume';
import { renderVerifyEmail } from 'src/pages/me/renderVerifyEmail';
import { getTournamentInfo } from 'src/services/api/tournamentsApi';
import { renderMyCourtHive } from 'src/pages/me/renderMyCourtHive';
import { renderAvailability } from 'src/pages/me/renderAvailability';
import { renderRankingsLanding } from 'src/pages/rankings/renderRankingsLanding';
import { renderRankingsPage } from 'src/pages/rankings/renderRankingsPage';
import { renderDefaultPage } from 'src/pages/courthive/default';
import { setDisplay } from 'src/services/transistions';
import Navigo from 'navigo';

// constants
import { HIVEID_MAGIC, HIVEID_ME, RANKINGS, SPLASH, TOURNAMENT, TOURNAMENTS, TRACK } from 'src/common/constants/routerConstants';
import { context } from 'src/common/context';

function navigateToTournament({
  tournamentId,
  eventId,
  drawId,
  structureId,
  tab,
}: {
  tournamentId: string;
  eventId?: string;
  drawId?: string;
  structureId?: string;
  tab?: string;
}) {
  // Clean up any active track page shell before switching views
  destroyCurrentShell();

  const back = document.getElementById('back');
  if (context.providerAbbr) {
    back.textContent = context.providerAbbr;
    back.style.display = 'block';
  } else {
    back.style.display = 'none';
  }

  context.tournamentId = tournamentId;
  delete context.tab;

  setDisplay(TOURNAMENT);
  connectAndJoinRoom(tournamentId);
  getTournamentInfo({ tournamentId }).then((result) => renderTournament(result, { eventId, drawId, structureId, tab }));
}

export function updateRouteUrl({
  tournamentId,
  eventId,
  drawId,
  structureId,
  tab,
}: {
  tournamentId: string;
  eventId?: string;
  drawId?: string;
  structureId?: string;
  tab?: string;
}) {
  let path = `/tournament/${tournamentId}`;
  if (tab === 'Schedule') {
    path += `/schedule`;
  } else if (tab === 'Events') {
    path += `/events`;
  } else if (tab === 'Players') {
    path += `/participants`;
  } else {
    if (eventId) path += `/event/${eventId}`;
    if (drawId) path += `/draw/${drawId}`;
    if (structureId) path += `/structure/${structureId}`;
  }
  // Use pushState directly to update URL without triggering any router handlers.
  history.pushState(null, '', `#${path}`);
}

export function router() {
  const useHash = true;
  const router = new Navigo('/', { hash: useHash });

  // make accessible
  context.router = router;

  const back = document.getElementById('back');

  router.on('/', () => {
    console.log('[router] matched: / (splash)');
    back.style.display = 'none';
    delete context.providerAbbr;
    destroyCurrentShell();
    leaveRoom();
    setDisplay(SPLASH);
    renderDefaultPage();
  });
  router.on('/tournaments/:providerAbbr', (match) => {
    console.log('[router] matched: /tournaments/:providerAbbr', match?.data);
    back.style.display = 'none';
    leaveRoom();
    const providerAbbr = match?.data?.providerAbbr?.toUpperCase();
    context.providerAbbr = providerAbbr;
    setDisplay(TOURNAMENTS);
    createTournamentsTable({ providerAbbr });
  });

  // Provider-agnostic landing — lists what's available so /services and
  // other surfaces don't have to deep-link a specific provider abbreviation.
  router.on('/rankings', () => {
    console.log('[router] matched: /rankings (landing)');
    back.style.display = 'none';
    destroyCurrentShell();
    leaveRoom();
    setDisplay(RANKINGS);
    const container = document.getElementById(RANKINGS);
    if (container) renderRankingsLanding(container);
  });

  router.on('/rankings/:providerAbbr', (match) => {
    console.log('[router] matched: /rankings/:providerAbbr', match?.data);
    back.style.display = 'none';
    destroyCurrentShell();
    leaveRoom();
    const providerAbbr = match?.data?.providerAbbr?.toUpperCase() ?? '';
    context.providerAbbr = providerAbbr;
    setDisplay(RANKINGS);
    const container = document.getElementById(RANKINGS);
    if (container) renderRankingsPage(container, providerAbbr);
  });

  router.on('/tournament/:tournamentId/event/:eventId/draw/:drawId/structure/:structureId', (match) => {
    console.log('[router] matched: /tournament/.../structure/:structureId', match?.data);
    navigateToTournament({
      tournamentId: match?.data?.tournamentId,
      eventId: match?.data?.eventId,
      drawId: match?.data?.drawId,
      structureId: match?.data?.structureId,
    });
  });
  router.on('/tournament/:tournamentId/event/:eventId/draw/:drawId', (match) => {
    console.log('[router] matched: /tournament/.../draw/:drawId', match?.data);
    navigateToTournament({
      tournamentId: match?.data?.tournamentId,
      eventId: match?.data?.eventId,
      drawId: match?.data?.drawId,
    });
  });
  router.on('/tournament/:tournamentId/event/:eventId', (match) => {
    console.log('[router] matched: /tournament/.../event/:eventId', match?.data);
    navigateToTournament({
      tournamentId: match?.data?.tournamentId,
      eventId: match?.data?.eventId,
    });
  });

  router.on('/tournament/:tournamentId/events', (match) => {
    navigateToTournament({
      tournamentId: match?.data?.tournamentId,
      tab: 'Events',
    });
  });

  router.on('/tournament/:tournamentId/schedule', (match) => {
    navigateToTournament({
      tournamentId: match?.data?.tournamentId,
      tab: 'Schedule',
    });
  });

  router.on('/tournament/:tournamentId/participants', (match) => {
    navigateToTournament({
      tournamentId: match?.data?.tournamentId,
      tab: 'Players',
    });
  });

  router.on('/tournament/:tournamentId', (match) => {
    navigateToTournament({
      tournamentId: match?.data?.tournamentId,
    });
  });

  // Register the more specific availability route before /me so the exact-match
  // /me handler never shadows it.
  router.on('/me/availability/:providerAbbr', (match) => {
    console.log('[router] matched: /me/availability/:providerAbbr', match?.data);
    back.style.display = 'none';
    destroyCurrentShell();
    leaveRoom();
    setDisplay(HIVEID_ME);
    const container = document.getElementById(HIVEID_ME);
    if (container) renderAvailability(container, match?.data?.providerAbbr ?? '');
  });

  router.on('/me', () => {
    console.log('[router] matched: /me (HiveID profile)');
    back.style.display = 'none';
    destroyCurrentShell();
    leaveRoom();
    setDisplay(HIVEID_ME);
    const container = document.getElementById(HIVEID_ME);
    if (container) renderMyCourtHive(container);
  });

  router.on('/hiveid/magic/:code', (match) => {
    const code = match?.data?.code;
    console.log('[router] matched: /hiveid/magic/:code');
    back.style.display = 'none';
    destroyCurrentShell();
    leaveRoom();
    setDisplay(HIVEID_MAGIC);
    const container = document.getElementById(HIVEID_MAGIC);
    if (container) renderMagicLinkConsume(container, code ?? '');
  });

  // Email-verification landing — reuses the transient HIVEID_MAGIC container
  // (both are short-lived landing pages, never shown simultaneously).
  router.on('/verify-email/:token', (match) => {
    const token = match?.data?.token;
    console.log('[router] matched: /verify-email/:token');
    back.style.display = 'none';
    destroyCurrentShell();
    leaveRoom();
    setDisplay(HIVEID_MAGIC);
    const container = document.getElementById(HIVEID_MAGIC);
    if (container) renderVerifyEmail(container, token ?? '');
  });

  // Phase 2 — interactive tracking sandbox. Local-only, no server writes.
  router.on('/track/:tournamentId/:matchUpId', (match) => {
    const tournamentId = match?.data?.tournamentId;
    const matchUpId = match?.data?.matchUpId;
    if (!tournamentId || !matchUpId) {
      router.navigate('/');
      return;
    }
    console.log('[router] matched: /track/:tournamentId/:matchUpId', match?.data);
    back.style.display = 'block';
    back.textContent = 'Back';
    leaveRoom();
    setDisplay(TRACK);
    const container = document.getElementById(TRACK);
    if (container) {
      void renderTrackPage({ container, tournamentId, matchUpId });
    }
  });

  router.notFound((match) => {
    console.log('[router] notFound — url:', match?.url, 'hashString:', match?.hashString, 'data:', match?.data);
    router.navigate('/');
  });
  router.resolve();

  // Navigo listens for popstate (back/forward) but not hashchange;
  // re-resolve when the user edits the URL hash directly in the address bar
  globalThis.addEventListener('hashchange', () => router.resolve());

  return router;
}
