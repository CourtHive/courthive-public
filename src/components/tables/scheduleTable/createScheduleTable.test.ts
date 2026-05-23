import { describe, it, expect, vi } from 'vitest';

// courthive-components touches `document` at module-import time. Mock it so
// this test runs in courthive-public's no-DOM vitest environment — the pure
// helpers under test never call into the mocked exports.
vi.mock('courthive-components', () => ({
  buildActiveStripPanel: () => ({ element: null, setData: () => undefined, update: () => undefined }),
  buildScheduleGridCell: () => null,
  mapMatchUpToCellData: (m: any) => m,
  DEFAULT_SCHEDULE_CELL_CONFIG: {},
}));

import { __test__ } from './createScheduleTable';

const { collectScheduleDates, courtsForDate, gridTemplate, extractParticipantIds, buildStripData } = __test__;

const DATE_A = '2026-05-23';
const DATE_B = '2026-05-24';

const dayMatchUp = (matchUpId: string, scheduledDate: string) => ({
  matchUpId,
  schedule: { scheduledDate },
});

describe('collectScheduleDates', () => {
  it('returns unique scheduled dates sorted ascending', () => {
    const matchUps = [
      dayMatchUp('m1', DATE_A),
      dayMatchUp('m2', '2026-05-21'),
      dayMatchUp('m3', DATE_A),
      { matchUpId: 'm4' }, // unscheduled — ignored
    ];
    expect(collectScheduleDates(matchUps)).toEqual(['2026-05-21', DATE_A]);
  });

  it('returns an empty array when nothing is scheduled', () => {
    expect(collectScheduleDates([{ matchUpId: 'm1' }])).toEqual([]);
  });
});

describe('courtsForDate (auto-hide empty courts)', () => {
  const data = {
    mappedParticipants: {},
    courtsData: [
      { courtId: 'c1', courtName: 'Court 1', matchUps: [dayMatchUp('m1', DATE_A)] },
      { courtId: 'c2', courtName: 'Court 2', matchUps: [dayMatchUp('m2', DATE_B)] },
      { courtId: 'c3', courtName: 'Court 3', matchUps: [] },
    ],
  };

  it('keeps only courts with matchUps on the selected date', () => {
    const courts = courtsForDate(data, DATE_A);
    expect(courts.map((c) => c.courtId)).toEqual(['c1']);
    expect(courts[0].matchUps).toHaveLength(1);
  });

  it('drops courts whose matchUps are all on other dates', () => {
    const courts = courtsForDate(data, DATE_B);
    expect(courts.map((c) => c.courtId)).toEqual(['c2']);
  });

  it('hydrates side participants from the participant map', () => {
    const withSides = {
      mappedParticipants: { p1: { participantId: 'p1', participantName: 'Alice' } },
      courtsData: [
        {
          courtId: 'c1',
          courtName: 'Court 1',
          matchUps: [{ ...dayMatchUp('m1', DATE_A), sides: [{ participantId: 'p1' }] }],
        },
      ],
    };
    const courts = courtsForDate(withSides, DATE_A);
    expect(courts[0].matchUps[0].sides[0].participant.participantName).toBe('Alice');
  });
});

describe('gridTemplate', () => {
  it('pads to the minimum column count when few courts are present', () => {
    const { totalColumns, gridTemplateColumns, minWidth } = gridTemplate(3);
    expect(totalColumns).toBe(8); // 3 courts + 5 placeholder columns (MINIMUM_SCHEDULE_COLUMNS = 8)
    expect(gridTemplateColumns).toContain('repeat(8,');
    expect(minWidth).toBe(`${50 + 8 * 110}px`);
  });

  it('always leaves at least one placeholder column when courts exceed the minimum', () => {
    const { totalColumns } = gridTemplate(10);
    expect(totalColumns).toBe(11);
  });
});

describe('extractParticipantIds', () => {
  it('flattens individual participant ids for doubles/team sides', () => {
    const matchUp = {
      sides: [
        { participant: { individualParticipantIds: ['a', 'b'] } },
        { participant: { participantId: 'c' } },
        { participantId: 'd' },
      ],
    };
    expect(extractParticipantIds(matchUp)).toEqual(['a', 'b', 'c', 'd']);
  });

  it('returns an empty array for a matchUp without sides', () => {
    expect(extractParticipantIds({})).toEqual([]);
  });
});

describe('buildStripData', () => {
  it('maps grid rows into per-court active-strip columns', () => {
    const courtsData = [{ courtId: 'c1', courtName: 'Court 1' }];
    const rows = [
      {
        'C|0': {
          matchUpId: 'm1',
          drawId: 'd1',
          roundNumber: 2,
          matchUpStatus: 'IN_PROGRESS',
          score: { scoreStringSide1: '6-3' },
          sides: [{ participant: { participantId: 'p1' } }],
        },
      },
      { 'C|0': undefined },
    ];

    const { grid, courts } = buildStripData(courtsData, rows);
    expect(courts).toEqual([{ courtId: 'c1', label: 'Court 1' }]);
    expect(grid.columns).toHaveLength(1);

    const cells = grid.columns[0].cells;
    expect(cells[1]).toBeNull();
    expect(cells[0]).toMatchObject({
      matchUpId: 'm1',
      matchUpStatus: 'IN_PROGRESS',
      hasScore: true,
      participantIds: ['p1'],
    });
    // raw factory matchUp is carried as opaque payload for the cell renderer
    expect((cells[0] as any).payload.matchUpId).toBe('m1');
  });
});
