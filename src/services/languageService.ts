import i18next, { setStoredLanguage } from 'src/i18n/i18n';
import { ensureLocaleCurrent, fetchManifest } from 'src/i18n/runtime-loader';

/** Last-resort label when CFS is unreachable and a locale we don't know about
 *  somehow lingers in i18next's loaded resources. */
const FALLBACK_NATIVE_LABEL: Record<string, string> = {
  en: 'English',
};

interface LanguageDropdownItem {
  code: string;
  label: string;
}

let activeDropdown: HTMLElement | null = null;
let outsideClickHandler: ((e: MouseEvent) => void) | null = null;

function closeDropdown() {
  if (activeDropdown) {
    activeDropdown.remove();
    activeDropdown = null;
  }
  if (outsideClickHandler) {
    document.removeEventListener('click', outsideClickHandler);
    outsideClickHandler = null;
  }
}

/** Build the dropdown items from the live CFS manifest. Falls back to whatever
 *  i18next already has loaded so the picker isn't empty when CFS is offline. */
async function buildLanguageList(): Promise<LanguageDropdownItem[]> {
  // force:true — the picker is user-initiated, low-frequency, and the user
  // expects to see whatever's currently available, not a 5-min stale cache.
  const manifest = await fetchManifest({ force: true });
  const seen = new Set<string>();
  const out: LanguageDropdownItem[] = [];

  for (const entry of manifest?.locales ?? []) {
    if (seen.has(entry.code)) continue;
    seen.add(entry.code);
    // Prefer the speaker's own script ("Čeština", "العربية") so people can
    // recognise their own language without translating mentally.
    out.push({ code: entry.code, label: entry.nativeLabel || entry.label || entry.code });
  }

  for (const code of Object.keys(i18next.options?.resources || {})) {
    if (seen.has(code)) continue;
    seen.add(code);
    out.push({ code, label: FALLBACK_NATIVE_LABEL[code] || code });
  }

  return out;
}

export async function toggleLanguageDropdown(anchor: HTMLElement): Promise<void> {
  if (activeDropdown) {
    closeDropdown();
    return;
  }

  const items = await buildLanguageList();
  if (!items.length) return;

  const dropdown = document.createElement('div');
  dropdown.className = 'language-dropdown';

  for (const lang of items) {
    const item = document.createElement('button');
    item.className = 'language-dropdown-item';
    if (i18next.language === lang.code) item.classList.add('active');
    item.textContent = lang.label;
    item.addEventListener('click', async (e) => {
      e.stopPropagation();
      // Fetch + cache the new locale BEFORE reload so the next boot's
      // sync-load (initialState.ts) finds it in localStorage and the
      // first paint renders the right language. Without this prefetch,
      // the first reload after picking a new language shows English
      // fallbacks until ensureLocaleCurrent's background fetch lands.
      setStoredLanguage(lang.code);
      try {
        await ensureLocaleCurrent(lang.code);
      } catch {
        // Fetch failure — proceed with reload anyway; boot path will
        // retry the fetch. User gets English fallback meanwhile.
      }
      closeDropdown();
      globalThis.location.reload();
    });
    dropdown.appendChild(item);
  }

  anchor.style.position = 'relative';
  anchor.appendChild(dropdown);
  activeDropdown = dropdown;

  outsideClickHandler = (e: MouseEvent) => {
    if (!anchor.contains(e.target as Node)) {
      closeDropdown();
    }
  };
  // Defer to avoid immediate trigger from the current click
  setTimeout(() => {
    document.addEventListener('click', outsideClickHandler);
  }, 0);
}
