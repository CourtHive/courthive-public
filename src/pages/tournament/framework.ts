import { TOURNAMENT_HERO } from 'src/common/constants/elementConstants';
import { displayTabContent, tabNames } from './helpers/tabDisplay';
import { getTabContentId, getTabId } from './helpers/tabIds';
import { t } from 'src/i18n/i18n';

export const tournamentFramework = () => {
  const container = document.createElement('div');
  container.className = 'container';

  // Stable mount point only. The identity band itself is data-driven and is
  // built by `buildTournamentHero` once tournamentInfo resolves, because its
  // layout depends on the artwork's aspect ratio.
  const hero = document.createElement('section');
  hero.id = TOURNAMENT_HERO;
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

  // Left-aligned, not centred: the tabs share the container edge with the hero
  // and the navbar. See the padding on `.tabs ul` in layout.css.
  tabs.className = 'tabs';
  const ul = document.createElement('ul');
  tabNames.forEach((tabName) => {
    const tab = document.createElement('li');
    tab.id = getTabId(tabName);
    tab.style.display = 'none';
    tab.className = 'menu';
    const tabLink = document.createElement('a');
    tabLink.textContent = t(`tabs.${tabName.toLowerCase()}`);
    tabLink.onclick = () => displayTabContent(tabName, { updateUrl: true });
    tab.appendChild(tabLink);
    ul.appendChild(tab);
  });
  tabs.appendChild(ul);

  return container;
};
