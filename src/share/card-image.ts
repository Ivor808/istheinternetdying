import { join } from 'node:path';
import type { CardData } from '../data/card';
import { formatDelta } from '../data/death';
import { SKULL_PATH, logoPath } from '../data/logos';
import { formatDate } from '../data/chart';
import { SITE_URL } from '../data/site';

// The share image (1200x630, the Open Graph size) and the README badge, drawn as SVG.
// Fonts are bundled so the image looks the same on any server.

const W = 1200;
const H = 630;
const PAD = 72;

const C = {
  bg: '#0a0a0f',
  text: '#ececf1',
  muted: '#8b8b96',
  faint: '#2a2a33',
  track: '#1c1c24',
  bad: '#ff4d4d',
};
const SANS = 'Inter';
const MONO = 'JetBrains Mono';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

type Measure = (text: string, size: number) => number;

// Rough advance widths; cardPng swaps in real measurements from the font
const estimateWidth: Measure = (s, size) => s.length * size * 0.5;

const LOGO = 30;
const LOGO_GAP = 10;
const ITEM_GAP = 36;
const MAX_MEASURED = 8;

// Logo + name for as many services as fit on one line, then "+N"
function servicesRow(
  services: CardData['services'],
  x0: number,
  baseline: number,
  maxWidth: number,
  size: number,
  measure: Measure
): string {
  // Only a handful ever fit, so only measure those
  const items = services.slice(0, MAX_MEASURED).map((s) => {
    const d = logoPath(s.slug);
    const textWidth = measure(s.name, size);
    return { ...s, d, textWidth, width: (d ? LOGO + LOGO_GAP : 0) + textWidth };
  });
  const plusWidth = (n: number) => measure(`+${n}`, size);
  let used = 0;
  let shown = 0;
  for (const item of items) {
    const rest = services.length - shown - 1;
    const need = (shown > 0 ? ITEM_GAP : 0) + item.width + (rest > 0 ? ITEM_GAP + plusWidth(rest) : 0);
    if (shown > 0 && used + need > maxWidth) break;
    used += (shown > 0 ? ITEM_GAP : 0) + item.width;
    shown += 1;
  }

  let x = x0;
  const parts: string[] = [];
  for (const item of items.slice(0, shown)) {
    if (item.d) {
      const scale = LOGO / 24;
      parts.push(`<path transform="translate(${x} ${baseline - LOGO + 4}) scale(${scale})" d="${item.d}" fill="${C.text}"/>`);
      x += LOGO + LOGO_GAP;
    }
    parts.push(`<text x="${x}" y="${baseline}" font-family="${SANS}" font-weight="500" font-size="${size}" fill="${C.text}">${esc(item.name)}</text>`);
    x += item.textWidth + ITEM_GAP;
  }
  const rest = services.length - shown;
  if (rest > 0) {
    parts.push(`<text x="${x}" y="${baseline}" font-family="${SANS}" font-weight="500" font-size="${size}" fill="${C.muted}">+${rest}</text>`);
  }
  return parts.join('\n  ');
}

export function isAboveNormal(card: Pick<CardData, 'death' | 'band'>): boolean {
  return card.band !== null && card.death > card.band[1];
}

export function cardSvg(card: CardData, measure: Measure = estimateWidth): string {
  const bad = isAboveNormal(card);
  const x = (v: number) => PAD + ((W - 2 * PAD) * Math.max(0, Math.min(100, v))) / 100;

  // Clock: hand sweeps from six o'clock (0) to midnight (100)
  const cx = 186;
  const cy = 286;
  const r = 104;
  const angle = ((180 + (card.death / 100) * 180) * Math.PI) / 180;
  const hand = bad ? C.bad : C.text;

  const numX = 340;
  const deltaText = card.delta === null ? '' : `${formatDelta(card.delta)} ${card.live ? 'vs last week' : 'vs week before'}`;
  const deltaColor = card.delta !== null && card.delta > 0 ? C.bad : C.muted;

  const servicesHead =
    card.services.length > 0 ? `${card.services.length} ${card.servicesLabel}` : card.live ? 'nothing reporting issues now' : 'no incidents';

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="${C.bg}"/>
  <text x="${PAD}" y="112" font-family="${SANS}" font-weight="800" font-size="56" letter-spacing="-1.5" fill="${C.text}">Is the internet dying<tspan fill="${C.bad}">?</tspan></text>
  <text x="${W - PAD}" y="106" text-anchor="end" font-family="${MONO}" font-size="24" fill="${C.muted}">${esc(formatDate(card.date))}</text>

  <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${C.faint}" stroke-width="6"/>
  <line x1="${cx}" y1="${cy - r + 2}" x2="${cx}" y2="${cy - r + 22}" stroke="${C.bad}" stroke-width="8"/>
  <line x1="${cx}" y1="${cy}" x2="${(cx + 76 * Math.sin(angle)).toFixed(1)}" y2="${(cy - 76 * Math.cos(angle)).toFixed(1)}" stroke="${hand}" stroke-width="9" stroke-linecap="round"/>
  <circle cx="${cx}" cy="${cy}" r="9" fill="${hand}"/>

  <text x="${numX}" y="200" font-family="${MONO}" font-size="22" letter-spacing="3" fill="${C.muted}">DEATH INDEX</text>
  <text x="${numX - 8}" y="350" font-family="${MONO}" font-weight="700" font-size="170" fill="${bad ? C.bad : C.text}">${card.death}<tspan font-weight="400" font-size="48" fill="${C.muted}" dx="10">/100</tspan></text>
  <text x="${numX}" y="398" font-family="${MONO}" font-size="30" fill="${deltaColor}">${esc(deltaText)}</text>

  ${card.band ? `<text x="${((x(card.band[0]) + x(card.band[1])) / 2).toFixed(1)}" y="446" text-anchor="middle" font-family="${MONO}" font-size="18" fill="${C.muted}">normal</text>` : ''}
  <rect x="${PAD}" y="458" width="${W - 2 * PAD}" height="10" rx="5" fill="${C.track}"/>
  ${card.band ? `<rect x="${x(card.band[0]).toFixed(1)}" y="458" width="${Math.max(6, x(card.band[1]) - x(card.band[0])).toFixed(1)}" height="10" rx="5" fill="#ffffff" fill-opacity="0.18"/>` : ''}
  <rect x="${(x(card.death) - 3).toFixed(1)}" y="448" width="6" height="30" rx="3" fill="${bad ? C.bad : C.text}"/>
  <text x="${PAD}" y="504" font-family="${MONO}" font-size="18" fill="${C.muted}">0</text>
  <text x="${W - PAD - 32}" y="504" text-anchor="end" font-family="${MONO}" font-size="18" fill="${C.muted}">100</text>
  <path transform="translate(${W - PAD - 24} 484) scale(1)" d="${SKULL_PATH}" fill-rule="evenodd" fill="${bad ? C.bad : C.muted}"/>

  <text x="${PAD}" y="560" font-family="${MONO}" font-size="18" letter-spacing="2" fill="${C.muted}">${esc(servicesHead.toUpperCase())}</text>
  ${servicesRow(card.services, PAD, 602, 760, 30, measure)}
  <text x="${W - PAD}" y="600" text-anchor="end" font-family="${MONO}" font-size="20" fill="${C.muted}">${esc(new URL(SITE_URL).host)}</text>
</svg>`;
}

const FONT_DIR = join(process.cwd(), 'assets', 'fonts');
const FONT_FILES = ['Inter-ExtraBold.otf', 'Inter-Medium.otf', 'JetBrainsMono-Bold.ttf', 'JetBrainsMono-Regular.ttf'].map((f) =>
  join(FONT_DIR, f)
);

export async function cardPng(card: CardData): Promise<Uint8Array> {
  // Native module: load only when an image is actually requested
  const { Resvg } = await import('@resvg/resvg-js');
  const font = { fontFiles: FONT_FILES, loadSystemFonts: false, defaultFontFamily: SANS };
  const measure: Measure = (text, size) => {
    const probe = new Resvg(
      `<svg xmlns="http://www.w3.org/2000/svg" width="2000" height="${size * 2}"><text x="0" y="${size * 1.5}" font-family="${SANS}" font-weight="500" font-size="${size}">${esc(text)}</text></svg>`,
      { font }
    );
    return probe.getBBox()?.width ?? estimateWidth(text, size);
  };
  return new Resvg(cardSvg(card, measure), { font }).render().asPng();
}

// Shields-style flat badge. Widths approximate Verdana 11px, which is what renders it.
const verdanaWidth = (s: string) => [...s].reduce((w, ch) => w + (/[0-9]/.test(ch) ? 7 : ch === ' ' ? 3.6 : ch === '/' ? 5 : 6.2), 0);

export function badgeSvg(card: Pick<CardData, 'death' | 'band'> | null): string {
  const label = 'death index';
  const value = card ? `${card.death}/100` : 'n/a';
  const color = !card ? '#9f9f9f' : isAboveNormal(card) ? '#e05d44' : '#4c1';
  const lw = Math.round(verdanaWidth(label) + 12);
  const vw = Math.round(verdanaWidth(value) + 12);
  const w = lw + vw;
  const text = (s: string, cx: number, tw: number) =>
    `<text x="${cx * 10}" y="150" fill="#010101" fill-opacity=".3" transform="scale(.1)" textLength="${tw * 10}">${esc(s)}</text>` +
    `<text x="${cx * 10}" y="140" transform="scale(.1)" fill="#fff" textLength="${tw * 10}">${esc(s)}</text>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="20" role="img" aria-label="${label}: ${value}"><title>${label}: ${value}</title><linearGradient id="s" x2="0" y2="100%"><stop offset="0" stop-color="#bbb" stop-opacity=".1"/><stop offset="1" stop-opacity=".1"/></linearGradient><clipPath id="r"><rect width="${w}" height="20" rx="3" fill="#fff"/></clipPath><g clip-path="url(#r)"><rect width="${lw}" height="20" fill="#555"/><rect x="${lw}" width="${vw}" height="20" fill="${color}"/><rect width="${w}" height="20" fill="url(#s)"/></g><g fill="#fff" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" text-rendering="geometricPrecision" font-size="110">${text(label, lw / 2, lw - 12)}${text(value, lw + vw / 2, vw - 12)}</g></svg>`;
}
