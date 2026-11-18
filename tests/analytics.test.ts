import { describe, expect, it } from 'vitest';
import { aiAgent, serverEvent, via } from '../analytics.js';

const IMESSAGE = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_11_1) AppleWebKit/601.2.4 (KHTML, like Gecko) Version/9.0.1 Safari/601.2.4 facebookexternalhit/1.1 Facebot Twitterbot/1.0';
const CHROME = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';
const CHATGPT_USER = 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; ChatGPT-User/1.0; +https://openai.com/bot';

describe('via', () => {
  it('names link previewers, with iMessage before the bots it imitates', () => {
    expect(via(IMESSAGE)).toBe('imessage');
    expect(via('Twitterbot/1.0')).toBe('x');
    expect(via('Mozilla/5.0 (compatible; Discordbot/2.0; +https://discordapp.com)')).toBe('discord');
    expect(via('github-camo (876de43e)')).toBe('github');
  });

  it('falls back to AI agents, other bots, then browsers', () => {
    expect(via(CHATGPT_USER)).toBe('chatgpt');
    expect(via('python-requests/2.31')).toBe('other bot');
    expect(via(CHROME)).toBe('browser');
  });
});

describe('aiAgent', () => {
  it('tells live answer fetches from crawlers', () => {
    expect(aiAgent(CHATGPT_USER)).toEqual({ bot: 'chatgpt', kind: 'answer' });
    expect(aiAgent('Mozilla/5.0 (compatible; GPTBot/1.2; +https://openai.com/gptbot)')).toEqual({ bot: 'openai', kind: 'training' });
    expect(aiAgent(CHROME)).toBeNull();
  });
});

describe('serverEvent', () => {
  it('counts share images, badges and the API', () => {
    expect(serverEvent('/card/today.png', 'Twitterbot/1.0')).toEqual({ name: 'card image', data: { card: 'today', via: 'x' } });
    expect(serverEvent('/card/2026-11-13.png', CHROME)?.data.card).toBe('day');
    expect(serverEvent('/badge.svg', 'github-camo (1)')).toEqual({ name: 'badge', data: { via: 'github' } });
    expect(serverEvent('/api/day/2026-11-13.json', CHROME)?.data.path).toBe('/api/day');
    expect(serverEvent('/llms.txt', CHATGPT_USER)).toEqual({ name: 'api', data: { path: '/llms.txt', via: 'chatgpt' } });
  });

  it('counts pages only when an AI agent reads them', () => {
    expect(serverEvent('/day/2026-11-13', CHATGPT_USER)).toEqual({
      name: 'ai fetch',
      data: { bot: 'chatgpt', kind: 'answer', path: '/day/2026-11-13' },
    });
    expect(serverEvent('/', CHROME)).toBeNull();
    expect(serverEvent('/assets/index.js', CHATGPT_USER)).toBeNull();
  });
});
