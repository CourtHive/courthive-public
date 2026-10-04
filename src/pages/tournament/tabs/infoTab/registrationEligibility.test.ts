import { describe, expect, it } from 'vitest';

import { resolveEligibility } from './registrationEligibility';

const NOW = new Date('2026-06-15T12:00:00Z');
const TOMORROW = new Date('2026-06-16T12:00:00Z');
const LAST_WEEK = new Date('2026-06-08T12:00:00Z');
const NEXT_WEEK = new Date('2026-06-22T12:00:00Z');
const PUBLISHED_EVENTS = [{ eventId: 'e-1' }, { eventId: 'e-2' }];

describe('resolveEligibility', () => {
  it('hidden when registrationProfile has no entriesOpen', () => {
    expect(
      resolveEligibility({
        registrationProfile: { entriesClose: NEXT_WEEK.toISOString() },
        eventInfo: PUBLISHED_EVENTS,
        isAuthenticated: true,
        existingRegistration: null,
        now: NOW,
      }),
    ).toBe('hidden');
  });

  it('hidden when there are no published events', () => {
    expect(
      resolveEligibility({
        registrationProfile: { entriesOpen: LAST_WEEK.toISOString() },
        eventInfo: [],
        isAuthenticated: true,
        existingRegistration: null,
        now: NOW,
      }),
    ).toBe('hidden');
  });

  it('not-yet-open when entriesOpen is in the future', () => {
    expect(
      resolveEligibility({
        registrationProfile: { entriesOpen: TOMORROW.toISOString() },
        eventInfo: PUBLISHED_EVENTS,
        isAuthenticated: true,
        existingRegistration: null,
        now: NOW,
      }),
    ).toBe('not-yet-open');
  });

  it('closed when entriesClose is in the past', () => {
    expect(
      resolveEligibility({
        registrationProfile: {
          entriesOpen: '2026-05-01T00:00:00Z',
          entriesClose: LAST_WEEK.toISOString(),
        },
        eventInfo: PUBLISHED_EVENTS,
        isAuthenticated: true,
        existingRegistration: null,
        now: NOW,
      }),
    ).toBe('closed');
  });

  it('sign-in-required when window is open but caller is not authenticated', () => {
    expect(
      resolveEligibility({
        registrationProfile: {
          entriesOpen: LAST_WEEK.toISOString(),
          entriesClose: NEXT_WEEK.toISOString(),
        },
        eventInfo: PUBLISHED_EVENTS,
        isAuthenticated: false,
        existingRegistration: null,
        now: NOW,
      }),
    ).toBe('sign-in-required');
  });

  it('already-registered when caller has a non-terminal entry', () => {
    for (const status of ['applied', 'accepted', 'seeded', 'waitlisted'] as const) {
      expect(
        resolveEligibility({
          registrationProfile: {
            entriesOpen: LAST_WEEK.toISOString(),
            entriesClose: NEXT_WEEK.toISOString(),
          },
          eventInfo: PUBLISHED_EVENTS,
          isAuthenticated: true,
          existingRegistration: { status } as any,
          now: NOW,
        }),
      ).toBe('already-registered');
    }
  });

  it('open (terminal) — withdrawn/rejected does NOT block re-registration', () => {
    for (const status of ['withdrawn', 'rejected'] as const) {
      expect(
        resolveEligibility({
          registrationProfile: {
            entriesOpen: LAST_WEEK.toISOString(),
            entriesClose: NEXT_WEEK.toISOString(),
          },
          eventInfo: PUBLISHED_EVENTS,
          isAuthenticated: true,
          existingRegistration: { status } as any,
          now: NOW,
        }),
      ).toBe('open');
    }
  });

  it('open — happy path (window open, authenticated, no existing)', () => {
    expect(
      resolveEligibility({
        registrationProfile: {
          entriesOpen: LAST_WEEK.toISOString(),
          entriesClose: NEXT_WEEK.toISOString(),
        },
        eventInfo: PUBLISHED_EVENTS,
        isAuthenticated: true,
        existingRegistration: null,
        now: NOW,
      }),
    ).toBe('open');
  });

  it('already-registered wins over not-yet-open + closed', () => {
    // Already-applied users see "Registered" even outside the window.
    expect(
      resolveEligibility({
        registrationProfile: {
          entriesOpen: TOMORROW.toISOString(),
        },
        eventInfo: PUBLISHED_EVENTS,
        isAuthenticated: true,
        existingRegistration: { status: 'applied' } as any,
        now: NOW,
      }),
    ).toBe('already-registered');
  });
});
