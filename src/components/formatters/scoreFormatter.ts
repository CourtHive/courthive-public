export function scoreFormatter(cell) {
  const data = cell.getRow().getData();
  if (!data.readyToScore) return '';

  const isWalkover = data.matchUp.matchUpStatus === 'WALKOVER';

  const content = document.createElement('span');
  content.classList.add('scoreCell');
  if (data.score) {
    content.style.fontSize = 'smaller';
    content.textContent = data.score;
  } else if (isWalkover) {
    content.textContent = 'WO';
  } else {
    content.style.fontSize = 'smaller';
    content.style.color = 'var(--chc-text-muted)';
    content.textContent = '--- --- ---';
  }

  return content;
}
