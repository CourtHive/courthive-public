export function profileFormatter(cell) {
  const data = cell.getRow().getData();
  if (!data.competitiveProfile?.competitiveness) return '';

  const { competitiveProfile, score } = data;

  const content = document.createElement('span');

  const colorMap = {
    COMPETITIVE: 'var(--chc-status-success)',
    DECISIVE: 'var(--chc-status-warning)',
    ROUTINE: 'var(--chc-status-info)',
  };

  if (score) {
    const { competitiveness } = competitiveProfile;
    content.style.fontSize = 'smaller';
    content.style.color = colorMap[competitiveness];
    content.textContent = competitiveness;
  }

  return content;
}
