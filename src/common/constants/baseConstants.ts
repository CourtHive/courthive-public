import { factoryConstants } from 'tods-competition-factory';

const { AFTER_REST, FOLLOWED_BY, NEXT_AVAILABLE, NOT_BEFORE, TO_BE_ANNOUNCED } = factoryConstants.timeItemConstants;
// control areas
export const OVERLAY = 'overlay';
export const CENTER = 'center';
export const HEADER = 'header';
export const RIGHT = 'right';
export const LEFT = 'left';

export const BOTTOM = 'bottom';
export const TOP = 'top';

// dom
export const EMPTY_STRING = '';
export const FLEX = 'flex';
export const NONE = 'none';

export const CONTROL_BAR = 'controlBar';
export const BUTTON_BAR = 'buttonBar';

// DISPLAY
export const TOURNAMENT_SCHEDULE = 'Schedule';
export const ROUNDS_COLUMNS = 'roundsColumns';
export const MINIMUM_SCHEDULE_COLUMNS = 8;
export const ROUNDS_STATS = 'roundsStats';
export const ROUNDS_TABLE = 'roundsTable';
export const DRAWS_VIEW = 'drawsView';

export const timeModifierDisplay = {
  [AFTER_REST]: 'After rest',
  [FOLLOWED_BY]: 'Followed by',
  [TO_BE_ANNOUNCED]: 'TBA',
  [NEXT_AVAILABLE]: 'Next available',
  [NOT_BEFORE]: 'NB',
};
