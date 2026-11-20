export function getTabContentId(tabName) {
  return `tournament_${tabName.toLowerCase()}`;
}

export function getTabId(tabName) {
  return `tab_tournament_${tabName.toLowerCase()}`;
}

/** framework.ts builds a tab and a section for every name in tabNames; missing means it never ran. */
function builtElement(id: string): HTMLElement {
  const elem = document.getElementById(id);
  if (!elem) throw new Error(`tournament framework not built: no #${id}`);
  return elem;
}

export function getTabContent(tabName: string): HTMLElement {
  return builtElement(getTabContentId(tabName));
}

export function getTab(tabName: string): HTMLElement {
  return builtElement(getTabId(tabName));
}
