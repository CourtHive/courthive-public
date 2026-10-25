import { applyThemePalette, getThemePalettes, resolveThemePalette, type ThemeMode } from 'courthive-components';
import { t } from 'src/i18n/i18n';

type ThemePreference = 'light' | 'dark' | 'system';

const THEME_STORAGE_KEY = 'chp_theme';
// One stored palette per mode: the user keeps a light and a dark choice, and the mode decides which shows.
const PALETTE_STORAGE_KEYS: Record<ThemeMode, string> = { light: 'chp_palette_light', dark: 'chp_palette_dark' };

let mediaQuery: MediaQueryList | null = null;

function resolveTheme(pref: ThemePreference): ThemeMode {
  if (pref === 'system') {
    return globalThis.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return pref;
}

export function getPalettePreference(mode: ThemeMode): string {
  return resolveThemePalette(mode, localStorage.getItem(PALETTE_STORAGE_KEYS[mode]));
}

export function applyTheme(pref: ThemePreference): void {
  const theme = resolveTheme(pref);
  document.documentElement.dataset.theme = theme;
  applyThemePalette(theme, getPalettePreference(theme));
  localStorage.setItem(THEME_STORAGE_KEY, pref);
}

export function setPalettePreference(mode: ThemeMode, paletteId: string): void {
  localStorage.setItem(PALETTE_STORAGE_KEYS[mode], resolveThemePalette(mode, paletteId));
  applyTheme(getThemePreference());
}

export function initTheme(): void {
  const pref = getThemePreference();
  applyTheme(pref);

  mediaQuery = globalThis.matchMedia('(prefers-color-scheme: dark)');
  mediaQuery.addEventListener('change', () => {
    if (getThemePreference() === 'system') {
      applyTheme('system');
    }
  });
}

export function toggleTheme(): void {
  const current = resolveTheme(getThemePreference());
  applyTheme(current === 'light' ? 'dark' : 'light');
}

export function getThemePreference(): ThemePreference {
  return (localStorage.getItem(THEME_STORAGE_KEY) as ThemePreference) ?? 'light';
}

let activeDropdown: HTMLElement | null = null;
let outsideClickHandler: ((e: MouseEvent) => void) | null = null;

function closeDropdown(): void {
  activeDropdown?.remove();
  activeDropdown = null;
  if (outsideClickHandler) {
    document.removeEventListener('click', outsideClickHandler);
    outsideClickHandler = null;
  }
}

function dropdownItem(label: string, active: boolean, onSelect: () => void): HTMLButtonElement {
  const item = document.createElement('button');
  item.className = 'language-dropdown-item';
  item.classList.toggle('active', active);
  item.textContent = label;
  item.addEventListener('click', (e) => {
    e.stopPropagation();
    onSelect();
    closeDropdown();
  });
  return item;
}

function dropdownHeading(label: string): HTMLElement {
  const heading = document.createElement('div');
  heading.className = 'theme-dropdown-heading';
  heading.textContent = label;
  return heading;
}

/**
 * The theme picker, styled like the language picker: the mode, then the palette for each mode. Palette names
 * are proper names and are not translated.
 */
export function toggleThemeDropdown(anchor: HTMLElement, onChange: () => void): void {
  if (activeDropdown) {
    closeDropdown();
    return;
  }

  const dropdown = document.createElement('div');
  dropdown.className = 'language-dropdown theme-dropdown';

  const pref = getThemePreference();
  dropdown.appendChild(dropdownHeading(t('theme.mode')));
  for (const mode of ['light', 'dark', 'system'] as ThemePreference[]) {
    dropdown.appendChild(
      dropdownItem(t(`theme.${mode}`), pref === mode, () => {
        applyTheme(mode);
        onChange();
      }),
    );
  }

  for (const mode of ['light', 'dark'] as ThemeMode[]) {
    dropdown.appendChild(dropdownHeading(t(mode === 'dark' ? 'theme.darkPalette' : 'theme.lightPalette')));
    const current = getPalettePreference(mode);
    for (const { id, name } of getThemePalettes(mode)) {
      dropdown.appendChild(
        dropdownItem(name, current === id, () => {
          setPalettePreference(mode, id);
          onChange();
        }),
      );
    }
  }

  anchor.style.position = 'relative';
  anchor.appendChild(dropdown);
  activeDropdown = dropdown;

  outsideClickHandler = (e: MouseEvent) => {
    if (!anchor.contains(e.target as Node)) closeDropdown();
  };
  // Defer to avoid immediate trigger from the current click
  setTimeout(() => document.addEventListener('click', outsideClickHandler as (e: MouseEvent) => void), 0);
}
