import { drawDefinitionConstants, mocksEngine, tournamentEngine } from 'tods-competition-factory';
import { ROUNDS_COLUMNS, ROUNDS_STATS, ROUNDS_TABLE } from 'src/common/constants/baseConstants';
import { hasStatsView, resolveStructureView } from './structureViews';
import { describe, expect, it } from 'vitest';

const { AD_HOC, ROUND_ROBIN_WITH_PLAYOFF } = drawDefinitionConstants;

function structuresOf(drawProfile: any) {
  const {
    drawIds: [drawId],
  } = mocksEngine.generateTournamentRecord({ drawProfiles: [drawProfile], setState: true });
  return tournamentEngine.getEvent({ drawId }).drawDefinition.structures;
}

describe('structure views', () => {
  const [groups, playoff] = structuresOf({ drawType: ROUND_ROBIN_WITH_PLAYOFF, drawSize: 16 });
  const [adHoc] = structuresOf({ drawType: AD_HOC, drawSize: 8, roundsCount: 1 });

  it('offers statistics for round robin and ad hoc structures only', () => {
    expect(hasStatsView(groups)).toBe(true);
    expect(hasStatsView(adHoc)).toBe(true);
    expect(hasStatsView(playoff)).toBe(false);
    expect(hasStatsView(undefined)).toBe(false);
  });

  it('renders the draw when statistics are kept for a structure that has none', () => {
    expect(resolveStructureView({ displayFormat: ROUNDS_STATS, structure: playoff })).toBe(ROUNDS_COLUMNS);
  });

  it('keeps the chosen view wherever it applies', () => {
    expect(resolveStructureView({ displayFormat: ROUNDS_STATS, structure: groups })).toBe(ROUNDS_STATS);
    expect(resolveStructureView({ displayFormat: ROUNDS_STATS, structure: adHoc })).toBe(ROUNDS_STATS);
    expect(resolveStructureView({ displayFormat: ROUNDS_TABLE, structure: playoff })).toBe(ROUNDS_TABLE);
    expect(resolveStructureView({ displayFormat: ROUNDS_COLUMNS, structure: playoff })).toBe(ROUNDS_COLUMNS);
  });
});
