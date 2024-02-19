import { TOURNAMENTS_CONTROL } from 'src/common/constants/elementConstants';
import { LEFT } from 'src/common/constants/baseConstants';

import { createSearchFilter } from 'src/common/filters/createSearchFilter';
import { controlBar } from 'src/components/controlBar/controlBar';

export function tournamentsControls(table) {
  const setSearchFilter = createSearchFilter(table);

  const items = [
    {
      onKeyDown: (e) => e.keyCode === 8 && e.target.value.length === 1 && setSearchFilter(''),
      onChange: (e) => setSearchFilter(e.target.value),
      onKeyUp: (e) => setSearchFilter(e.target.value),
      clearSearch: () => setSearchFilter(''),
      placeholder: 'Search tournaments',
      location: LEFT,
      search: true
    }
  ];

  const target = document.getElementById(TOURNAMENTS_CONTROL);
  controlBar({ target, items });
}
