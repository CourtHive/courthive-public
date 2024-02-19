import { TOURNAMENT_LOGO, TOURNAMENT_TITLE_BLOCK } from 'src/common/constants/elementConstants';
import { displayTabContent, tabNames } from './helpers/tabDisplay';
import { getTabContentId, getTabId } from './helpers/tabIds';

export const tournamentFramework = () => {
  const container = document.createElement('div');
  container.className = 'container';
  const hero = document.createElement('section');
  hero.className = 'hero';
  const heroBody = document.createElement('div');
  heroBody.className = 'hero-body';
  heroBody.id = 'tournament-hero';

  const heroColumns = document.createElement('div');
  heroColumns.className = 'columns';
  const columnOne = document.createElement('div');
  columnOne.className = 'column is-one-quarter has-text-centered';
  columnOne.id = TOURNAMENT_LOGO;
  heroColumns.appendChild(columnOne);
  const columnTwo = document.createElement('div');
  columnTwo.className = 'column has-text-centered';
  columnTwo.id = TOURNAMENT_TITLE_BLOCK;
  heroColumns.appendChild(columnTwo);

  heroBody.appendChild(heroColumns);
  hero.appendChild(heroBody);
  container.appendChild(hero);

  const tabs = document.createElement('div');
  const sections = document.createElement('div');

  container.appendChild(tabs);
  container.appendChild(sections);

  // sections come after tabs in the DOM, but generate them first so they can be referenced in onclick actions
  tabNames.forEach((tabName) => {
    const section = document.createElement('section');
    section.className = 'section is-fluid is-centered';
    section.style.display = 'none';
    section.style.width = '100%';
    section.id = getTabContentId(tabName);
    // section.innerHTML = `<h1>${tabName}</h1>`;
    sections.appendChild(section);
  });

  tabs.className = 'tabs is-centered';
  const ul = document.createElement('ul');
  tabNames.forEach((tabName) => {
    const tab = document.createElement('li');
    tab.id = getTabId(tabName);
    tab.style.display = 'none';
    tab.className = 'menu';
    const tabLink = document.createElement('a');
    tabLink.textContent = tabName;
    tabLink.onclick = () => displayTabContent(tabName);
    tab.appendChild(tabLink);
    ul.appendChild(tab);
  });
  tabs.appendChild(ul);

  return container;
};
