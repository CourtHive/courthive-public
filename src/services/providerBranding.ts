/**
 * Provider branding side-effects layer for the public viewer.
 *
 * Applies a `ProviderBranding` payload (fetched from the CFS public
 * branding endpoint, keyed by tournamentId) to the running page —
 * themeTokens become inline CSS custom-property writes on
 * `document.documentElement`; `stylesheetUrl` becomes a single
 * `<link id="chp-provider-theme">` appended to `<head>` that cascades
 * over the bundled CSS.
 *
 * Idempotent on tournament switch: re-applying with a new branding
 * clears the prior token set and updates the stylesheet href in
 * place; passing `undefined` resets to bundled defaults.
 */

import type { ProviderBranding } from '@courthive/provider-config';

const PROVIDER_THEME_LINK_ID = 'chp-provider-theme';
const PROVIDER_TOKEN_ATTR = 'data-chp-provider-tokens';

export function applyProviderBranding(branding?: ProviderBranding): void {
  if (typeof document === 'undefined') return;

  if (branding?.appName) {
    document.title = branding.appName;
  }
  if (branding?.accentColor) {
    document.documentElement.style.setProperty('--chc-text-link', branding.accentColor);
  }
  applyThemeTokens(branding?.themeTokens);
  applyProviderStylesheet(branding?.stylesheetUrl);
}

function applyThemeTokens(tokens?: Record<string, string>): void {
  const root = document.documentElement;

  const priorList = root.getAttribute(PROVIDER_TOKEN_ATTR);
  if (priorList) {
    for (const prior of priorList.split(' ')) {
      if (prior) root.style.removeProperty(prior);
    }
    root.removeAttribute(PROVIDER_TOKEN_ATTR);
  }

  if (!tokens) return;

  const applied: string[] = [];
  for (const [token, value] of Object.entries(tokens)) {
    root.style.setProperty(token, value);
    applied.push(token);
  }
  if (applied.length > 0) {
    root.setAttribute(PROVIDER_TOKEN_ATTR, applied.join(' '));
  }
}

function applyProviderStylesheet(url?: string): void {
  const existing = document.getElementById(PROVIDER_THEME_LINK_ID) as HTMLLinkElement | null;

  if (!url) {
    if (existing) existing.remove();
    return;
  }

  if (existing) {
    if (existing.getAttribute('href') !== url) existing.setAttribute('href', url);
    return;
  }

  const link = document.createElement('link');
  link.id = PROVIDER_THEME_LINK_ID;
  link.rel = 'stylesheet';
  link.href = url;
  document.head.appendChild(link);
}
