// Stored scores are health (100 = all fine). Everything public shows the Death Index: higher is worse.
export function toDeath(health: number): number;
export function toDeath(health: number | undefined): number | undefined;
export function toDeath(health: number | undefined): number | undefined {
  return health === undefined ? undefined : 100 - health;
}

function quantile(sorted: number[], q: number): number {
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

// Middle half of past values: the "normal" band. Null until there's enough history.
export function normalBand(values: Array<number | undefined>): [number, number] | null {
  const v = values.filter((x): x is number => typeof x === 'number').sort((a, b) => a - b);
  if (v.length < 8) return null;
  return [quantile(v, 0.25), quantile(v, 0.75)];
}

// Names people know, and who to mention first
const FAMILIAR: Record<string, string> = { openai: 'ChatGPT', anthropic: 'Claude' };
const FAME = [
  'openai',
  'github',
  'discord',
  'zoom',
  'reddit',
  'anthropic',
  'shopify',
  'cloudflare',
  'dropbox',
  'canva',
  'figma',
  'pinterest',
  'epicgames',
  'atlassian',
  'square',
  '1password',
];

export function displayName(slug: string, name: string): string {
  return FAMILIAR[slug] ?? name;
}

export function fameRank(slug: string): number {
  const i = FAME.indexOf(slug);
  return i === -1 ? FAME.length : i;
}

// "▲ 22" / "▼ 3" / "no change"
export function formatDelta(delta: number): string {
  if (delta === 0) return 'no change';
  return `${delta > 0 ? '▲' : '▼'} ${Math.abs(delta)}`;
}
