import { tournamentEngine, drawDefinitionConstants } from 'tods-competition-factory';
import { isFunction } from 'src/functions/typeof';

import { RIGHT, ROUNDS_COLUMNS, ROUNDS_STATS, ROUNDS_TABLE } from 'src/common/constants/baseConstants';
const { CONTAINER } = drawDefinitionConstants;

type GetDisplayOptions = {
  existingView?: string;
  callback?: (any) => void;
  structure: any;
};

export function getRoundDisplayOptions(params: GetDisplayOptions) {
  const { callback, structure, existingView } = params;
  const displayUpdate = (view) => existingView !== view && isFunction(callback) && callback({ refresh: true, view });
  const isRoundRobin = structure?.structureType === CONTAINER;
  const isAdHoc = tournamentEngine.isAdHoc({ structure });

  const actionOptions = [];

  existingView !== ROUNDS_COLUMNS &&
    actionOptions.push({
      onClick: () => displayUpdate(ROUNDS_COLUMNS),
      label: isAdHoc ? 'Columns' : 'Draw',
      close: true
    });

  existingView !== ROUNDS_TABLE &&
    actionOptions.push({
      onClick: () => displayUpdate(ROUNDS_TABLE),
      label: 'Table view',
      close: true
    });

  if ((isAdHoc || isRoundRobin) && existingView !== ROUNDS_STATS)
    actionOptions.push({
      onClick: () => displayUpdate(ROUNDS_STATS),
      label: 'Statistics',
      close: true
    });

  return {
    label: 'Display', // also toggle between finishing positions and matches
    options: actionOptions,
    selection: false,
    location: RIGHT,
    align: RIGHT
  };
}
