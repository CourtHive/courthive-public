export function tournamentFormatter(cell) {
  const content = document.createElement('span');
  const rowTable = document.createElement('table');
  const values = cell.getValue();
  rowTable.style.width = '400px';

  const imageSize = '4em';
  const rowTabletr = document.createElement('tr');
  const tournamentImageURL =
    values.tournamentImageURL ||
    values.onlineResources?.find(({ name, resourceType }) => name === 'tournamentImage' && resourceType === 'URL')
      ?.identifier;
  const img = tournamentImageURL ? `<img src='${tournamentImageURL}' style='width: ${imageSize}' alt=''>` : '';
  const cellContents =
    `<td style='min-width: ${imageSize}'>${img}</td>` +
    `<td>` +
    `<div style='margin-left: 1em'><strong style='font-size: 1.5em'>${values.tournamentName}</strong></div>` +
    `<div style='margin-left: 1em'>${values.startDate} / ${values.endDate}</div>` +
    `</td>`;

  rowTabletr.innerHTML = cellContents;
  rowTable.appendChild(rowTabletr);
  content.appendChild(rowTable);

  return content;
}
