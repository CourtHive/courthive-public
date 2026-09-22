import { describe, expect, it } from 'vitest';

import { isFullyUnpublished } from './publishVisibility';

/**
 * The visitor-facing publish gate. A `true` here redirects the visitor off the tournament page, so a
 * wrong answer either hides a public tournament or shows a private one.
 *
 * The case this exists for: factory 7.0.0's tournament-INFORMATION publish makes a tournament public
 * during its registration phase, with no draw, no order of play and no participant list. The previous
 * component-by-component test could not express that and redirected those visitors away.
 */

const rollUp = (published: boolean, rest: any = {}) => ({
  publishState: { status: { published }, ...rest },
  eventInfo: [],
});

describe('isFullyUnpublished', () => {
  it('treats a missing response as unpublished', () => {
    expect(isFullyUnpublished(undefined)).toBe(true);
    expect(isFullyUnpublished(null)).toBe(true);
  });

  it('follows the factory roll-up when it is present', () => {
    expect(isFullyUnpublished(rollUp(true))).toBe(false);
    expect(isFullyUnpublished(rollUp(false))).toBe(true);
  });

  it('shows a tournament published for its registration phase — no draw, no schedule, no entries', () => {
    const registrationPhase = {
      publishState: { status: { published: true, publishedEventIds: [] }, info: { published: true } },
      eventInfo: [{ eventId: 'e1', eventName: 'Open Singles' }],
    };
    expect(isFullyUnpublished(registrationPhase)).toBe(false);
  });

  it('shows one published before any event exists — the case the component rule got wrong', () => {
    // information published, no events created yet: every component test reads false, the roll-up true
    const announcedOnly = {
      publishState: { status: { published: true, publishedEventIds: [] }, info: { published: true } },
      eventInfo: [],
    };
    expect(isFullyUnpublished(announcedOnly)).toBe(false);
  });

  it('hides a tournament the roll-up calls unpublished even when events are listed', () => {
    // the roll-up is the authority: a listed event without it is not a publish
    const listedButUnpublished = {
      publishState: { status: { published: false } },
      eventInfo: [{ eventId: 'e1' }],
    };
    expect(isFullyUnpublished(listedButUnpublished)).toBe(true);
  });

  describe('fallback, for a response carrying no roll-up', () => {
    it('reads the components, as before', () => {
      expect(isFullyUnpublished({ eventInfo: [{ eventId: 'e1' }] })).toBe(false);
      expect(isFullyUnpublished({ publishState: { orderOfPlay: { published: true } } })).toBe(false);
      expect(isFullyUnpublished({ publishState: { participants: { published: true } } })).toBe(false);
    });

    it('withholds when nothing at all says published', () => {
      expect(isFullyUnpublished({})).toBe(true);
      expect(isFullyUnpublished({ publishState: {}, eventInfo: [] })).toBe(true);
    });
  });
});
