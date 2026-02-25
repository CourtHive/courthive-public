export function highlightTeam(element) {
  for (const team of Array.from(document.querySelectorAll('.tmx-tm')).filter(
    (x) => x.innerHTML === element.innerHTML,
  )) {
    const teamElement = team as HTMLElement;
    teamElement.style.fontWeight = 'bold';
    teamElement.style.color = '#ed0c76';
  }
}

export function removeTeamHighlight(element) {
  for (const team of Array.from(document.querySelectorAll('.tmx-tm')).filter(
    (x) => x.innerHTML === element.innerHTML,
  )) {
    const teamElement = team as HTMLElement;
    teamElement.style.fontWeight = '';
    teamElement.style.color = '';
  }
}
