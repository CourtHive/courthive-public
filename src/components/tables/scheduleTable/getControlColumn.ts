import { CENTER } from 'src/common/constants/baseConstants';

export function getControlColumn() {
  function controlTitleFormatter(cell) {
    const elem = cell.getElement();
    elem.classList.add('tag');
    elem.classList.add('is-info');
    elem.classList.add('is-light');
    return `<i class="fa-regular fa-note-sticky"></i>`;
  }
  function controlColumnFormatter(cell) {
    cell.getElement().style.backgroundColor = 'white';
    const content = document.createElement('span');
    const data = cell.getRow().getData();
    content.innerHTML = data.rowNumber;
    return content;
  }

  return {
    titleFormatter: controlTitleFormatter,
    formatter: controlColumnFormatter,
    headerSort: false,
    resizable: false,
    hozAlign: CENTER,
    frozen: true,
    width: 55
  };
}
