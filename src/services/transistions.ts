import { views } from 'src/common/constants/routerConstants';

export function setDisplay(which) {
  views.forEach((view) => {
    const el: any = document.querySelector(`#${view}`);
    if (el) el.style.display = view === which ? 'block' : 'none';
  });
}
