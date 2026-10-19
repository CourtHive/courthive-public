import { ROUNDS_COLUMNS, ROUNDS_STATS } from 'src/common/constants/baseConstants';
import { drawDefinitionConstants, drawsGovernor } from 'tods-competition-factory';

const { CONTAINER } = drawDefinitionConstants;

/**
 * Statistics are a tally, and a tally describes a round robin or an ad hoc structure. The factory does not tally an
 * elimination structure, whose places come from its bracket, so it has no statistics to show.
 */
export function hasStatsView(structure: any): boolean {
  return structure?.structureType === CONTAINER || !!drawsGovernor.isAdHoc({ structure });
}

/**
 * The view a structure is rendered in. The chosen view is kept across structure switches, so a visitor who opened
 * Statistics on a round robin and then picks its playoff gets the draw, and gets Statistics back on returning.
 */
export function resolveStructureView({ displayFormat, structure }: { displayFormat: string; structure: any }): string {
  return displayFormat === ROUNDS_STATS && !hasStatsView(structure) ? ROUNDS_COLUMNS : displayFormat;
}
