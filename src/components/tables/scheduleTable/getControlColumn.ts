import { CENTER } from 'src/common/constants/baseConstants';

function controlColumnFormatter(cell) {
  cell.getElement().style.backgroundColor = 'var(--chc-bg-primary)';
  const content = document.createElement('span');
  const data = cell.getRow().getData();
  content.innerHTML = data.rowNumber;
  return content;
}

export function getControlColumn() {
  return {
    formatter: controlColumnFormatter,
    headerSort: false,
    resizable: false,
    hozAlign: CENTER,
    frozen: true,
    width: 55,
  };
}
