type ThemePreference = 'light' | 'dark' | 'system';

const THEME_STORAGE_KEY = 'chp_theme';

let mediaQuery: MediaQueryList | null = null;

function resolveTheme(pref: ThemePreference): 'light' | 'dark' {
  if (pref === 'system') {
    return globalThis.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return pref;
}

export function applyTheme(pref: ThemePreference): void {
  const theme = resolveTheme(pref);
  document.documentElement.dataset.theme = theme;
  localStorage.setItem(THEME_STORAGE_KEY, pref);
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
