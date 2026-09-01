import { renderMenu } from 'courthive-components';

/**
 * A small floating menu anchored at a click point.
 *
 * Extracted from `scoringLaunchMenu.ts` when the schedule grid grew a cell
 * popover of its own: two popovers with the same dismissal semantics (single
 * instance, outside-click, Escape, viewport clamping) is one popover with two
 * callers. The `id` is supplied by the caller so each surface keeps its own
 * stable hook for tests and styling.
 *
 * Colours come entirely from the `--chc-*` theme tokens (defined for both light
 * and dark in styles/darkMode.css) — no hardcoded light-mode fallbacks.
 */

const STYLE_ID = 'chp-floating-menu-style';
const MENU_CLASS = 'chp-floating-menu';
const VIEWPORT_MARGIN_PX = 8;

export interface FloatingMenuItem {
  label?: string;
  heading?: string;
  onClick?: () => void;
  disabled?: boolean;
  divider?: boolean;
}

export interface FloatingMenuSection {
  text?: string;
  items: FloatingMenuItem[];
}

function ensureStyles(): void {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    .${MENU_CLASS} {
      position: fixed;
      z-index: 9999;
      min-width: 12rem;
      max-width: min(20rem, calc(100vw - 1rem));
      padding: 0.25rem;
      border-radius: 0.5rem;
      background: var(--chc-bg-elevated);
      border: 1px solid var(--chc-border-primary);
      box-shadow: 0 0.5rem 1.5rem rgba(0, 0, 0, 0.18);
      color: var(--chc-text-primary);
    }
    .${MENU_CLASS} .menu-list { list-style: none; margin: 0; padding: 0; }
    .${MENU_CLASS} .menu-label {
      padding: 0.35rem 0.75rem 0.15rem;
      margin: 0;
      font-size: 0.7rem;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      color: var(--chc-text-secondary);
    }
    .${MENU_CLASS} .menu-list a {
      display: block;
      padding: 0.5rem 0.75rem;
      border-radius: 0.375rem;
      color: var(--chc-text-primary);
      cursor: pointer;
    }
    .${MENU_CLASS} .menu-list a:hover { background: var(--chc-hover-bg); }
  `;
  document.head.appendChild(style);
}

/**
 * Clamp the menu inside the viewport. Exported for unit test — the DOM
 * positioning around it is not testable in this repo's no-DOM vitest setup,
 * but the arithmetic that decides whether a menu falls off-screen is.
 */
export function clampToViewport({
  x,
  y,
  width,
  height,
  viewportWidth,
  viewportHeight,
  margin = VIEWPORT_MARGIN_PX,
}: {
  x: number;
  y: number;
  width: number;
  height: number;
  viewportWidth: number;
  viewportHeight: number;
  margin?: number;
}): { x: number; y: number } {
  let left = x;
  let top = y;
  if (left + width > viewportWidth - margin) left = Math.max(margin, viewportWidth - width - margin);
  if (top + height > viewportHeight - margin) top = Math.max(margin, viewportHeight - height - margin);
  return { x: left, y: top };
}

/**
 * `renderMenu` assigns section labels and item labels with `innerHTML` (TMX
 * passes Font Awesome markup in labels, so it cannot escape them itself). The
 * section label here is the one piece of the menu built from tournament data —
 * an event or round name a TD typed — so it is escaped at this boundary.
 */
const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => HTML_ESCAPES[char]);
}

function positionMenu(menu: HTMLElement, pointerEvent: MouseEvent): void {
  const rect = menu.getBoundingClientRect();
  const { x, y } = clampToViewport({
    x: pointerEvent.clientX,
    y: pointerEvent.clientY,
    width: rect.width,
    height: rect.height,
    viewportWidth: globalThis.innerWidth,
    viewportHeight: globalThis.innerHeight,
  });
  menu.style.left = `${x}px`;
  menu.style.top = `${y}px`;
}

/**
 * Open a floating menu at the pointer. Returns a `close` function; the menu
 * also closes on Escape, on an outside pointerdown, and whenever another
 * floating menu opens.
 */
export function openFloatingMenu({
  pointerEvent,
  sections,
  id,
}: {
  pointerEvent: MouseEvent;
  sections: FloatingMenuSection[];
  id: string;
}): () => void {
  // Single popover at a time — across ids, so the schedule menu closes the
  // launch menu and vice versa.
  for (const open of Array.from(document.querySelectorAll(`.${MENU_CLASS}`))) open.remove();
  ensureStyles();

  const menu = document.createElement('div');
  menu.id = id;
  menu.className = MENU_CLASS;

  let removed = false;
  const onOutside = (e: Event) => {
    if (!menu.contains(e.target as Node)) close();
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') close();
  };
  function close() {
    if (removed) return;
    removed = true;
    document.removeEventListener('pointerdown', onOutside, true);
    document.removeEventListener('keydown', onKey, true);
    menu.remove();
  }

  const safeSections = sections.map((section) => ({
    ...section,
    text: section.text ? escapeHtml(section.text) : undefined,
  }));
  renderMenu(menu, safeSections as any, close);

  document.body.appendChild(menu);
  positionMenu(menu, pointerEvent);

  // Escape is wired IMMEDIATELY. It cannot be the gesture that opened the menu,
  // so it needs no deferral — and deferring it left a window in which a fast
  // Escape did nothing at all. That window is small but real: it was observed
  // as an intermittent failure of the "Escape dismisses the launch popover"
  // journey, roughly once in eighty runs.
  document.addEventListener('keydown', onKey, true);

  // The outside-click listener still defers by one task, so the click that
  // opened the menu does not immediately close it.
  setTimeout(() => {
    if (removed) return;
    document.addEventListener('pointerdown', onOutside, true);
  }, 0);

  return close;
}
