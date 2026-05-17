import { highlightTeam, removeTeamHighlight } from 'src/services/dom/teamHighlight';
import { eventManager } from 'src/services/dom/eventManager';
import { setDisplay } from 'src/services/transistions';
import { initTheme } from 'src/services/themeService';
import { setDev } from 'src/services/setDev';
import { setWindow } from './setWindow';
import { version } from './version';
import hotkeys from 'hotkeys-js';

// Initialize i18n (side-effect import triggers i18next.init with bundled en)
import i18next, { getStoredLanguage, hasStoredLanguage } from 'src/i18n/i18n';
import { ensureLocaleCurrent, getCachedLocale } from 'src/i18n/runtime-loader';

// constants
import { SPLASH } from 'src/common/constants/routerConstants';

import 'courthive-components/dist/courthive-components.css';
import 'src/styles/components/layout.css';
import 'src/styles/tabulator.css';
import 'src/styles/tournamentSchedule.css';
import 'src/styles/mobileBracket.css';
import 'src/styles/default.css';
import 'src/styles/darkMode.css';
import 'src/styles/tournaments.css';

const keysPressed = [];

export function setInitialState() {
  // Sync-load any cached non-en locale before the first render so t() calls
  // use the right strings on first paint. Background ensureLocaleCurrent
  // below upgrades the cache if CFS has a newer SHA.
  if (hasStoredLanguage()) {
    const stored = getStoredLanguage();
    if (stored && stored !== 'en') {
      const cached = getCachedLocale(stored);
      if (cached) {
        i18next.addResourceBundle(stored, 'translation', cached.content, true, true);
      }
      i18next.changeLanguage(stored);
    }
  }

  // Background: pull a fresher copy if available. No await — the first paint
  // already happened with the cached content (or English fallback if nothing
  // was cached). When CFS responds, the bundle updates in place.
  queueMicrotask(() => {
    void ensureLocaleCurrent(i18next.language).catch((err) => {
      console.warn('i18n background upgrade failed:', err);
    });
  });

  initTheme();
  console.log(`%cversion: ${version}`, 'color: lightblue');
  hotkeys('shift+1,shift+3,esc,/', (event, handler: any) => {
    event.preventDefault();
    const shifted = hotkeys.shift;
    const value = shifted ? handler.key.split(handler.splitKey)[1] : handler.key;
    if (value === '/') keysPressed.splice(0, keysPressed.length);
    keysPressed.push(value);
    if (keysPressed.join('') === 'esc13') setDev();
  });
  setDisplay(SPLASH);
  setWindow();

  eventManager.register('tmx-tm', 'mouseover', highlightTeam);
  eventManager.register('tmx-tm', 'mouseout', removeTeamHighlight);
}
