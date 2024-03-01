import { TabulatorFull as Tabulator } from 'tabulator-tables';

export function destroyTable({ anchorId }) {
  const previousRender = Tabulator.findTable(`#${anchorId}`)[0];
  if (previousRender) previousRender.destroy();
}
