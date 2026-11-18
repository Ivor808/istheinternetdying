import { describe, expect, it } from 'vitest';
import { badgeSvg, cardPng, cardSvg } from '@/share/card-image';

const card = {
  date: '2026-11-13',
  death: 31,
  delta: 22,
  band: [8, 10] as [number, number],
  services: [
    { slug: 'openai', name: 'ChatGPT' },
    { slug: 'att', name: 'AT&T <Fiber>' },
    { slug: 'cloudflare', name: 'Cloudflare' },
  ],
  servicesLabel: 'services having issues now',
  live: true,
};

describe('cardSvg', () => {
  it('shows the score, the change and escaped service names', () => {
    const svg = cardSvg(card);
    expect(svg).toContain('>31<');
    expect(svg).toContain('▲ 22 vs last week');
    expect(svg).toContain('AT&amp;T &lt;Fiber&gt;');
    expect(svg).toContain('3 SERVICES HAVING ISSUES NOW');
    // Cloudflare has a logo, ChatGPT doesn't
    expect(svg.match(/<path transform="translate\([\d.]+ 576\) scale/g)).toHaveLength(1);
  });

  it('collapses names that do not fit', () => {
    const many = Array.from({ length: 30 }, (_, i) => ({ slug: `s${i}`, name: `Service number ${i}` }));
    expect(cardSvg({ ...card, services: many })).toMatch(/\+\d+</);
  });

  it('renders a PNG with the bundled fonts', async () => {
    const png = await cardPng(card);
    expect(Buffer.from(png.slice(1, 4)).toString()).toBe('PNG');
  });
});

describe('badgeSvg', () => {
  it('is red above normal and green within it', () => {
    expect(badgeSvg(card)).toContain('#e05d44');
    expect(badgeSvg({ death: 9, band: [8, 10] })).toContain('#4c1');
    expect(badgeSvg(card)).toContain('31/100');
  });

  it('degrades when there is no data', () => {
    expect(badgeSvg(null)).toContain('n/a');
  });
});
