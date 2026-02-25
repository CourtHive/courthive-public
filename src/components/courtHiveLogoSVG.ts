import { create as d3Create } from 'd3-selection';

export interface CourtHiveLogoOptions {
  maxWidth?: string;
  color?: string;
  strokeWidth?: number;
  lineWidth?: number;
  fill?: string;
  className?: string;
  serviceLinePosition?: number;
  centerMarkLength?: number;
}

export function courtHiveLogoSVG(options: CourtHiveLogoOptions = {}): SVGSVGElement {
  const {
    maxWidth = '450px',
    color = '#000000',
    strokeWidth = 5,
    lineWidth = 5,
    fill = 'none',
    className = 'courthive-logo',
    serviceLinePosition = 0.3,
    centerMarkLength = 12,
  } = options;

  // Internal court markings are thinner than the hex outline
  const courtLine = lineWidth ?? strokeWidth;

  // Hexagon circumradius — defines unit geometry for the viewBox
  const R = 100;
  const sqrt3 = Math.sqrt(3);
  const RS3h = (R * sqrt3) / 2; // R * √3/2 ≈ 86.60
  const RS3 = R * sqrt3; //         R * √3  ≈ 173.21
  const Rh = R / 2; //              R / 2   = 50

  const pad = strokeWidth;

  // Open hex paths — 5 edges each, excluding the shared center edge
  // so the "net" can be drawn and faded independently.
  // Left hex: upper shared vertex → around the left side → lower shared vertex
  const leftHexPath =
    `M 0,${-Rh}` + ` L ${-RS3h},${-R}` + ` L ${-RS3},${-Rh}` + ` L ${-RS3},${Rh}` + ` L ${-RS3h},${R}` + ` L 0,${Rh}`;

  // Right hex: upper shared vertex → around the right side → lower shared vertex
  const rightHexPath =
    `M 0,${-Rh}` + ` L ${RS3h},${-R}` + ` L ${RS3},${-Rh}` + ` L ${RS3},${Rh}` + ` L ${RS3h},${R}` + ` L 0,${Rh}`;

  // Service lines: vertical lines offset from hex center toward flat edge
  const sLineOffset = serviceLinePosition * RS3h;
  const leftSLineX = -RS3h - sLineOffset;
  const rightSLineX = RS3h + sLineOffset;

  // Service line endpoints: intersect the hex's outer diagonal edges
  const sLineYTop = -R + sLineOffset / sqrt3;
  const sLineYBot = R - sLineOffset / sqrt3;

  const svg = d3Create('svg')
    .attr('viewBox', `${-RS3 - pad} ${-R - pad} ${2 * RS3 + 2 * pad} ${2 * R + 2 * pad}`)
    .attr('xmlns', 'http://www.w3.org/2000/svg')
    .attr('class', className)
    .style('width', '100%')
    .style('max-width', maxWidth);

  const g = svg.append('g').attr('class', 'logo-group');

  const STROKE_WIDTH = 'stroke-width';
  const COURT_MARKING = 'court-marking';

  // --- Hex outlines (open paths, thick boundary strokes) ---
  g.append('path')
    .attr('d', leftHexPath)
    .attr('fill', fill)
    .attr('stroke', color)
    .attr(STROKE_WIDTH, strokeWidth)
    .attr('stroke-linejoin', 'miter')
    .attr('stroke-linecap', 'round');

  g.append('path')
    .attr('d', rightHexPath)
    .attr('fill', fill)
    .attr('stroke', color)
    .attr(STROKE_WIDTH, strokeWidth)
    .attr('stroke-linejoin', 'miter')
    .attr('stroke-linecap', 'round');

  // --- Net line (shared center edge, fades with court markings) ---
  g.append('line')
    .attr('class', COURT_MARKING)
    .attr('x1', 0)
    .attr('y1', -Rh)
    .attr('x2', 0)
    .attr('y2', Rh)
    .attr('stroke', color)
    .attr(STROKE_WIDTH, strokeWidth);

  // --- Court markings (thinner lines, classed for animation) ---

  // Left service line (vertical)
  g.append('line')
    .attr('class', COURT_MARKING)
    .attr('x1', leftSLineX)
    .attr('y1', sLineYTop)
    .attr('x2', leftSLineX)
    .attr('y2', sLineYBot)
    .attr('stroke', color)
    .attr(STROKE_WIDTH, courtLine);

  // Right service line (vertical)
  g.append('line')
    .attr('class', COURT_MARKING)
    .attr('x1', rightSLineX)
    .attr('y1', sLineYTop)
    .attr('x2', rightSLineX)
    .attr('y2', sLineYBot)
    .attr('stroke', color)
    .attr(STROKE_WIDTH, courtLine);

  // Center horizontal line between the two service lines
  g.append('line')
    .attr('class', COURT_MARKING)
    .attr('x1', leftSLineX)
    .attr('y1', 0)
    .attr('x2', rightSLineX)
    .attr('y2', 0)
    .attr('stroke', color)
    .attr(STROKE_WIDTH, courtLine);

  // Center marks: short dashes on the inside of each flat edge
  g.append('line')
    .attr('class', COURT_MARKING)
    .attr('x1', -RS3)
    .attr('y1', 0)
    .attr('x2', -RS3 + centerMarkLength)
    .attr('y2', 0)
    .attr('stroke', color)
    .attr(STROKE_WIDTH, courtLine);

  g.append('line')
    .attr('class', COURT_MARKING)
    .attr('x1', RS3 - centerMarkLength)
    .attr('y1', 0)
    .attr('x2', RS3)
    .attr('y2', 0)
    .attr('stroke', color)
    .attr(STROKE_WIDTH, courtLine);

  return svg.node() as SVGSVGElement;
}
