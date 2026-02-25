import { courtHiveLogoSVG } from 'src/components/courtHiveLogoSVG';
import { SPLASH } from 'src/common/constants/routerConstants';
import 'src/styles/default.css';

export function renderDefaultPage() {
  const splash = document.querySelector<HTMLDivElement>(`#${SPLASH}`)!;
  splash.innerHTML = '';

  const wrapper = document.createElement('div');

  const link = document.createElement('a');
  link.href = 'https://courthive.com';
  link.target = '_blank';

  const logo = courtHiveLogoSVG({ color: '#000000', maxWidth: '300px' });
  link.appendChild(logo);
  wrapper.appendChild(link);

  const heading = document.createElement('h1');
  heading.className = 'name';
  heading.textContent = 'CourtHive';
  wrapper.appendChild(heading);

  splash.appendChild(wrapper);
}
