/**
 * Bracket header bar — runtime helper.
 *
 * Renders a sticky bar above the published structure with two
 * responsibilities:
 *
 *  1. **Round chips** — one chip per round, in one of two modes:
 *
 *     - **Selector mode** (`roundSelection` supplied — an elimination
 *       structure with 3+ rounds). Chips are visible at every viewport
 *       and pick the round the bracket STARTS at, exactly as TMX's
 *       `initialRoundTabs` do. A 64-draw opens on the quarters instead
 *       of asking a phone to pan across six columns.
 *     - **Scroll mode** (no `roundSelection` — round robin, ad hoc, or
 *       a two-round structure). Chips are mobile-only and smooth-scroll
 *       the matching round into view, with an IntersectionObserver
 *       highlighting the active one. Collapsing rounds would hide
 *       results in these structures rather than noise, so they keep the
 *       original behaviour.
 *  2. **Live-scoring toggle** (always visible) — opt-in switch the
 *     consumer wires to swap between the published TD composition
 *     and the inline-scoring overlay.
 *
 * Below 768px the bar also drives one of two CSS modifier classes
 * on the structure container so the bracket itself becomes
 * touch-friendly:
 *
 *  - non-RR: `.chp-mobile-bracket--snap` (horizontal scroll-snap,
 *            one round per viewport-width).
 *  - RR    : `.chp-mobile-bracket--stack` (full-width vertical card
 *            stack).
 *
 * Returns a teardown so the consumer can detach observers and DOM
 * when the structure is re-rendered (which happens on flight /
 * structure switches and when the live-scoring toggle flips).
 */

const MOBILE_QUERY = '(max-width: 768px)';
const SNAP_CLASS = 'chp-mobile-bracket--snap';
const STACK_CLASS = 'chp-mobile-bracket--stack';
const ARIA_CURRENT = 'aria-current';
const TOGGLE_ACTIVE_CLASS = 'chp-round-nav__toggle--active';
const SELECTOR_CHIP_CLASS = 'chp-round-nav__chip--selector';

interface LiveScoringControl {
  active: boolean;
  onChange(next: boolean): void;
  label?: string;
  hint?: string;
}

/** Selector-mode chips: which rounds exist, which is open, and how to change it. */
export interface RoundSelection {
  chips: { roundNumber: number; label: string }[];
  activeRoundNumber: number;
  onSelect(roundNumber: number): void;
}

interface InstallParams {
  flightDisplay: HTMLElement;
  structureContent: HTMLElement;
  matchUps: any[];
  liveScoring?: LiveScoringControl;
  roundSelection?: RoundSelection;
}

export function installMobileBracketLayout({
  flightDisplay,
  structureContent,
  matchUps,
  liveScoring,
  roundSelection,
}: InstallParams): () => void {
  if (typeof globalThis.matchMedia !== 'function') return () => undefined;

  const mql = globalThis.matchMedia(MOBILE_QUERY);
  const isRoundRobin = (matchUps || []).some((m: any) => m?.isRoundRobin);

  // Find the chc-structure node — it's structureContent itself for
  // courthive-public's renderRoundsColumns path, but defensively look it up.
  const structure = locateStructure(structureContent);
  if (!structure) return () => undefined;

  // Selector mode reads the round model the caller computed from the matchUps,
  // NOT the rendered containers: with an initial round set, the containers for
  // the earlier rounds do not exist, and chips built from the DOM would delete
  // the very rounds the viewer needs to get back to.
  const roundContainers = collectRoundContainers(structure);
  const rounds = roundSelection
    ? buildSelectorRoundsModel(roundSelection, roundContainers)
    : buildRoundsModel(roundContainers);
  // Render the bar even when no rounds were found, so the live-scoring
  // toggle is always reachable. Chips only render when there are rounds.
  const navContainer = buildNavBar({ rounds, structure, liveScoring, roundSelection });

  // Mount the nav as the first child of flightDisplay so it sits above
  // the structure visually. structureContent itself isn't a direct child
  // — it's nested inside the renderContainer wrapper — so we anchor on
  // flightDisplay's firstChild (null is fine; appends to end).
  flightDisplay.insertBefore(navContainer, flightDisplay.firstChild);

  let observer: IntersectionObserver | undefined;

  const apply = () => {
    structure.classList.remove(SNAP_CLASS, STACK_CLASS);
    if (mql.matches && rounds.length > 0) {
      structure.classList.add(isRoundRobin ? STACK_CLASS : SNAP_CLASS);
      observer?.disconnect();
      // Selector mode owns `aria-current` — it marks the round the bracket was
      // rendered from. Letting the scroll observer also write it would flip the
      // highlight to whatever happens to be on screen and contradict what the
      // bracket is actually showing.
      observer = roundSelection ? undefined : buildActiveRoundObserver({ structure, isRoundRobin, rounds });
    } else {
      observer?.disconnect();
      observer = undefined;
      // Clear any chip highlight when leaving mobile width (scroll mode only —
      // the selector's highlight is state, not a scroll position).
      if (!roundSelection) for (const r of rounds) r.chip.removeAttribute(ARIA_CURRENT);
    }
  };

  apply();
  const onChange = () => apply();
  // Safari < 14 only supports addListener / removeListener
  if (typeof mql.addEventListener === 'function') mql.addEventListener('change', onChange);
  else mql.addListener(onChange);

  return () => {
    observer?.disconnect();
    if (typeof mql.removeEventListener === 'function') mql.removeEventListener('change', onChange);
    else mql.removeListener(onChange);
    structure.classList.remove(SNAP_CLASS, STACK_CLASS);
    navContainer.remove();
  };
}

function locateStructure(node: HTMLElement): HTMLElement | null {
  if (node.classList.contains('chc-structure')) return node;
  return node.querySelector<HTMLElement>('.chc-structure');
}

function collectRoundContainers(structure: HTMLElement): HTMLElement[] {
  return Array.from(structure.querySelectorAll<HTMLElement>(':scope > .chc-round-container'));
}

interface RoundModel {
  index: number;
  roundNumber: number;
  container?: HTMLElement;
  label: string;
  chip: HTMLButtonElement;
}

function buildChipElement(label: string, index: number): HTMLButtonElement {
  const chip = document.createElement('button');
  chip.type = 'button';
  chip.className = 'chp-round-nav__chip';
  chip.textContent = label;
  chip.dataset.roundIndex = String(index);
  return chip;
}

/**
 * Selector-mode model. The container lookup is best-effort — a round earlier
 * than the active one is not rendered, and its chip does not need one because
 * clicking it re-renders rather than scrolls.
 */
function buildSelectorRoundsModel(roundSelection: RoundSelection, containers: HTMLElement[]): RoundModel[] {
  const byRoundNumber = new Map<number, HTMLElement>();
  for (const container of containers) {
    const roundNumber = Number(container.getAttribute('roundNumber'));
    if (Number.isFinite(roundNumber)) byRoundNumber.set(roundNumber, container);
  }

  return roundSelection.chips.map(({ roundNumber, label }, index) => {
    const chip = buildChipElement(label, index);
    chip.classList.add(SELECTOR_CHIP_CLASS);
    chip.dataset.roundNumber = String(roundNumber);
    if (roundNumber === roundSelection.activeRoundNumber) chip.setAttribute(ARIA_CURRENT, 'true');
    return { index, roundNumber, container: byRoundNumber.get(roundNumber), label, chip };
  });
}

function buildRoundsModel(containers: HTMLElement[]): RoundModel[] {
  const total = containers.length;
  return containers.map((container, index) => {
    const roundNumber = Number(container.getAttribute('roundNumber')) || index + 1;
    const label = resolveRoundLabel(container, index, total);
    return { index, roundNumber, container, label, chip: buildChipElement(label, index) };
  });
}

/**
 * Prefer the existing `.chc-round-header` text content (short version —
 * just the first text node, since the header may include round-visibility
 * icons). Fall back to short generated labels: R1, R2, ..., with QF/SF/F
 * for the last three rounds when the structure has 3+ rounds.
 */
function resolveRoundLabel(container: HTMLElement, index: number, total: number): string {
  const header = container.querySelector<HTMLElement>('.chc-round-header, .tmx-rh');
  const headerText = header?.textContent?.trim();
  if (headerText) return headerText;

  // Generated fallbacks
  const fromEnd = total - index;
  if (total >= 3) {
    if (fromEnd === 1) return 'F';
    if (fromEnd === 2) return 'SF';
    if (fromEnd === 3) return 'QF';
  }
  return `R${index + 1}`;
}

function buildNavBar({
  rounds,
  structure,
  liveScoring,
  roundSelection,
}: {
  rounds: RoundModel[];
  structure: HTMLElement;
  liveScoring?: LiveScoringControl;
  roundSelection?: RoundSelection;
}): HTMLElement {
  const nav = document.createElement('nav');
  nav.className = 'chp-round-nav';
  nav.setAttribute('aria-label', 'Bracket controls');

  for (const round of rounds) {
    round.chip.addEventListener('click', () => {
      if (roundSelection) {
        roundSelection.onSelect(round.roundNumber);
        return;
      }
      if (round.container) scrollRoundIntoView(round.container, structure);
    });
    nav.appendChild(round.chip);
  }

  if (liveScoring) {
    nav.appendChild(buildLiveScoringToggle(liveScoring));
  }

  return nav;
}

function buildLiveScoringToggle(control: LiveScoringControl): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'chp-round-nav__toggle';
  button.dataset.role = 'live-scoring-toggle';
  button.textContent = control.label ?? 'Track';
  button.title = control.hint ?? 'Score this draw locally on your device. Nothing is sent to the tournament.';
  button.setAttribute('aria-pressed', control.active ? 'true' : 'false');
  if (control.active) button.classList.add(TOGGLE_ACTIVE_CLASS);
  button.addEventListener('click', () => {
    control.onChange(!control.active);
  });
  return button;
}

function scrollRoundIntoView(target: HTMLElement, structure: HTMLElement): void {
  // Snap mode: structure scrolls horizontally — use scrollTo on the
  // structure so we don't fight with vertical page scroll.
  if (structure.classList.contains(SNAP_CLASS)) {
    structure.scrollTo({ left: target.offsetLeft, behavior: 'smooth' });
    return;
  }
  // Stack mode (or non-mobile): vertical scrollIntoView.
  target.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function buildActiveRoundObserver({
  structure,
  isRoundRobin,
  rounds,
}: {
  structure: HTMLElement;
  isRoundRobin: boolean;
  rounds: RoundModel[];
}): IntersectionObserver | undefined {
  if (typeof IntersectionObserver === 'undefined') return undefined;

  const observer = new IntersectionObserver(
    (entries) => {
      // Pick the round-container with the largest intersection ratio
      let best: { ratio: number; index: number } | undefined;
      for (const entry of entries) {
        const target = entry.target as HTMLElement;
        const idx = Number(target.dataset.roundIndex ?? -1);
        if (idx < 0) continue;
        if (!best || entry.intersectionRatio > best.ratio) {
          best = { ratio: entry.intersectionRatio, index: idx };
        }
      }
      if (best && best.ratio > 0) markActive(rounds, best.index);
    },
    {
      // Snap mode: observe within the structure scroller.
      // Stack mode: observe within the page.
      root: isRoundRobin ? null : structure,
      threshold: [0.25, 0.5, 0.75],
    },
  );

  for (const r of rounds) {
    if (!r.container) continue;
    r.container.dataset.roundIndex = String(r.index);
    observer.observe(r.container);
  }
  return observer;
}

function markActive(rounds: RoundModel[], activeIndex: number): void {
  for (const r of rounds) {
    if (r.index === activeIndex) r.chip.setAttribute(ARIA_CURRENT, 'true');
    else r.chip.removeAttribute(ARIA_CURRENT);
  }
}

/**
 * Test seam — exposed for vitest only.
 */
export const __test__ = {
  resolveRoundLabel,
  MOBILE_QUERY,
  SNAP_CLASS,
  STACK_CLASS,
  TOGGLE_ACTIVE_CLASS,
};
