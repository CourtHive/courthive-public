import chLogo from 'src/assets/images/courthive-transparent-logo.png';
import 'src/styles/default.css';

export function renderDefaultPage() {
  document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <div>
    <a href="https://courthive.com" target="_blank">
      <img src="${chLogo}" class="logo" alt="Vite logo" />
    </a>
    <h1 class="name">CourtHive</h1>
  </div>
`;
}
