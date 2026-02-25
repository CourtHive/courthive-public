import { CENTER } from 'src/common/constants/baseConstants';

export function getControlColumn() {
  function controlColumnFormatter(cell) {
    cell.getElement().style.backgroundColor = 'white';
    const content = document.createElement('span');
    const data = cell.getRow().getData();
    content.innerHTML = data.rowNumber;
    return content;
  }

  return {
    formatter: controlColumnFormatter,
    headerSort: false,
    resizable: false,
    hozAlign: CENTER,
    frozen: true,
    width: 55,
  };
}
