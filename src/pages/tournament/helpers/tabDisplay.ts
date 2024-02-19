import { getTabContentId, getTabId } from './tabIds';

export const tabNames = ['Info', 'Events', 'Schedule', 'Matches', 'Players', 'Stats'];

export function displayTabContent(tabName) {
  tabNames.forEach((name) => {
    const section = document.getElementById(getTabContentId(name));
    section.style.display = name === tabName ? 'block' : 'none';
  });
}

export function displayTab(tabName) {
  const tab = document.getElementById(getTabId(tabName));
  tab.style.display = 'block';
}