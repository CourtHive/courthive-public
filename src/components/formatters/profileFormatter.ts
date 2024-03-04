export function profileFormatter(cell) {
  const data = cell.getRow().getData();
  if (!data.competitiveProfile?.competitiveness) return '';

  const { competitiveProfile, score } = data;

  const content = document.createElement('span');

  const colorMap = {
    COMPETITIVE: 'green',
    DECISIVE: 'magenta',
    ROUTINE: 'blue'
  };

  if (score) {
    const { competitiveness } = competitiveProfile;
    content.style.fontSize = 'smaller';
    content.style.color = colorMap[competitiveness];
    content.innerHTML = competitiveness;
  }

  return content;
}
