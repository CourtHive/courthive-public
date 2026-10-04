// Shared rendering atoms for the competitive fingerprint.
//
// The five-segment band bar is the visual atom of this whole workstream — the same grammar is
// reused at conference, program and (later) player scope so the reader learns to read it once.
// Order is deliberately ordinal: STRETCH → UP → EVEN → DOWN → ANCHOR, i.e. hardest to easiest,
// so a bar's centre of mass is directly interpretable.

import { BandKey } from 'src/services/api/conferencesApi';

export const BAND_ORDER: BandKey[] = ['STRETCH', 'UP', 'EVEN', 'DOWN', 'ANCHOR'];

export const BAND_LABEL: Record<BandKey, string> = {
  STRETCH: 'Stretch',
  UP: 'Up',
  EVEN: 'Even',
  DOWN: 'Down',
  ANCHOR: 'Anchor',
};

export const BAND_HELP: Record<BandKey, string> = {
  STRETCH: 'Faced a meaningfully stronger opponent',
  UP: 'Faced a stronger opponent, within the competitive band',
  EVEN: 'Faced a peer',
  DOWN: 'Faced a weaker opponent, within the competitive band',
  ANCHOR: 'Faced a meaningfully weaker opponent — supplied a competitive match to someone below',
};

export function message(parent: HTMLElement, text: string): void {
  const el = document.createElement('div');
  el.className = 'chp-conf-message';
  el.textContent = text;
  parent.appendChild(el);
}

/** Five-segment proportional bar. Accepts anything carrying `bandPct`. */
export function bandBar(source: { bandPct?: Record<BandKey, number> }): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'chp-band-bar';
  const pct = source.bandPct;
  if (!pct) return wrap;
  for (const band of BAND_ORDER) {
    const value = pct[band] ?? 0;
    if (value <= 0) continue;
    const seg = document.createElement('span');
    seg.className = `chp-band chp-band--${band.toLowerCase()}`;
    seg.style.width = `${value}%`;
    seg.title = `${BAND_LABEL[band]} ${value}% — ${BAND_HELP[band]}`;
    if (value >= 8) seg.textContent = `${Math.round(value)}`;
    wrap.appendChild(seg);
  }
  return wrap;
}

export function bandLegend(): HTMLElement {
  const el = document.createElement('div');
  el.className = 'chp-band-legend';
  for (const band of BAND_ORDER) {
    const item = document.createElement('span');
    item.className = 'chp-band-legend-item';
    item.innerHTML = `<i class="chp-band chp-band--${band.toLowerCase()}"></i>${BAND_LABEL[band]}`;
    item.title = BAND_HELP[band];
    el.appendChild(item);
  }
  return el;
}
