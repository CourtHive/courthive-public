import { fetchScoringLaunch, launchScoring } from 'src/services/scoringLaunch';
import { renderMenu } from 'courthive-components';

/**
 * A small floating popover, anchored at the click point, offering a
 * "Score this match" action that launches the provider's configured scoring
 * app (Epixodic by default; EMBEDDED /track or an EXTERNAL app — e.g. IONSport
 * — when the provider declares it). Consumers may inject `extraItems` (e.g.
 * "Open scorecard" for TEAM matchUps).
 *
 * Colours are driven entirely from the `--chc-*` theme tokens (defined for both
 * light and dark in styles/darkMode.css) — no hardcoded light-mode fallbacks.
 */

const POPOVER_ID = 'scoring-launch-popover';
const STYLE_ID = 'scoring-launch-popover-style';

function ensureStyles(): void {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    #${POPOVER_ID} {
      position: fixed;
      z-index: 9999;
      min-width: 12rem;
      padding: 0.25rem;
      border-radius: 0.5rem;
      background: var(--chc-bg-elevated);
      border: 1px solid var(--chc-border-primary);
      box-shadow: 0 0.5rem 1.5rem rgba(0, 0, 0, 0.18);
      color: var(--chc-text-primary);
    }
    #${POPOVER_ID} .menu-list { list-style: none; margin: 0; padding: 0; }
    #${POPOVER_ID} .menu-list a {
      display: block;
      padding: 0.5rem 0.75rem;
      border-radius: 0.375rem;
      color: var(--chc-text-primary);
      cursor: pointer;
    }
    #${POPOVER_ID} .menu-list a:hover { background: var(--chc-hover-bg); }
  `;
  document.head.appendChild(style);
}

function positionPopover(popover: HTMLElement, pointerEvent: MouseEvent): void {
  const { innerWidth, innerHeight } = globalThis;
  const rect = popover.getBoundingClientRect();
  const margin = 8;
  let x = pointerEvent.clientX;
  let y = pointerEvent.clientY;
  if (x + rect.width > innerWidth - margin) x = Math.max(margin, innerWidth - rect.width - margin);
  if (y + rect.height > innerHeight - margin) y = Math.max(margin, innerHeight - rect.height - margin);
  popover.style.left = `${x}px`;
  popover.style.top = `${y}px`;
}

export interface ScoringMenuItem {
  label: string;
  onClick: () => void;
}

export async function openScoringLaunchMenu({
  pointerEvent,
  matchUp,
  tournamentId,
  extraItems = [],
}: {
  pointerEvent: MouseEvent;
  matchUp: any;
  tournamentId: string;
  extraItems?: ScoringMenuItem[];
}): Promise<void> {
  if (!matchUp?.matchUpId || !tournamentId) return;

  // Single popover at a time.
  document.getElementById(POPOVER_ID)?.remove();
  ensureStyles();

  const config = await fetchScoringLaunch(tournamentId);
  const ctx = {
    tournamentId,
    matchUpId: matchUp.matchUpId,
    eventId: matchUp.eventId,
    drawId: matchUp.drawId,
  };

  const popover = document.createElement('div');
  popover.id = POPOVER_ID;

  let removed = false;
  const onOutside = (e: Event) => {
    if (!popover.contains(e.target as Node)) close();
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') close();
  };
  function close() {
    if (removed) return;
    removed = true;
    document.removeEventListener('pointerdown', onOutside, true);
    document.removeEventListener('keydown', onKey, true);
    popover.remove();
  }

  const items = [
    ...extraItems.map((item) => ({ label: item.label, onClick: item.onClick })),
    { label: 'Score this match', onClick: () => launchScoring(config, ctx) },
  ];
  renderMenu(popover, [{ items }], close);

  document.body.appendChild(popover);
  positionPopover(popover, pointerEvent);

  // Defer outside-click wiring so the opening click doesn't immediately dismiss.
  setTimeout(() => {
    if (removed) return;
    document.addEventListener('pointerdown', onOutside, true);
    document.addEventListener('keydown', onKey, true);
  }, 0);
}
