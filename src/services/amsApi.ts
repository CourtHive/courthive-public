/**
 * Client for courthive-ams (the sanctioning/associate service). courthive-public
 * uses only the public registration read: a sanctioning proposal's registration
 * view by the tournamentId assigned at open-registration — so a registration page
 * can render BEFORE the tournamentRecord exists. Base URL resolves localhost-aware
 * with a `window.dev.amsURL` override for local runs (AMS server on :3130).
 */

export interface ProposalRegistrationEvent {
  eventName: string;
  eventType: string;
  gender?: string | null;
  category?: any;
}

export interface ProposalRegistrationView {
  tournamentId: string;
  tournamentName: string;
  proposedStartDate: string;
  proposedEndDate: string;
  hostCountryCode?: string | null;
  localTimeZone?: string | null;
  provider: string | null;
  sanctioningStatus: string;
  events: ProposalRegistrationEvent[];
  registration: {
    entriesOpen: string;
    entriesClose?: string | null;
    withdrawalDeadline?: string | null;
    entryMethod?: string | null;
    entryUrl?: string | null;
    entryFees?: any[];
    eligibilityNotes?: string | null;
  };
}

export function getAmsBaseUrl(): string {
  const win = globalThis as any;
  const loc = win.location;
  const host = loc?.host ?? '';
  const local = host.includes('localhost') || loc?.hostname === '127.0.0.1';
  return win.dev?.amsURL || (local ? 'http://localhost:3130' : 'https://courthive.net/ams');
}

/**
 * The public registration view for a proposal, by tournamentId. Returns null
 * when no proposal carries the id or registration is not open (the AMS endpoint
 * returns null in both cases).
 */
export async function fetchProposalRegistration(tournamentId: string): Promise<ProposalRegistrationView | null> {
  const res = await fetch(`${getAmsBaseUrl()}/sanctioning/registration/${encodeURIComponent(tournamentId)}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`fetchProposalRegistration failed: HTTP ${res.status}`);
  const body = await res.json().catch(() => null);
  return body && typeof body === 'object' ? (body as ProposalRegistrationView) : null;
}
