import i18next, { setStoredLanguage } from 'src/i18n/i18n';

export const SUPPORTED_LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'fr', label: 'Français' },
  { code: 'es', label: 'Español' },
  { code: 'pt-BR', label: 'Português' },
  { code: 'de', label: 'Deutsch' },
  { code: 'ar', label: 'العربية' },
];

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

export function toggleLanguageDropdown(anchor: HTMLElement): void {
  if (activeDropdown) {
    closeDropdown();
    return;
  }

  const dropdown = document.createElement('div');
  dropdown.className = 'language-dropdown';

  for (const lang of SUPPORTED_LANGUAGES) {
    const item = document.createElement('button');
    item.className = 'language-dropdown-item';
    if (i18next.language === lang.code) item.classList.add('active');
    item.textContent = lang.label;
    item.addEventListener('click', (e) => {
      e.stopPropagation();
      setStoredLanguage(lang.code);
      i18next.changeLanguage(lang.code);
      closeDropdown();
      window.location.reload();
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
