import type { ProviderConfig } from './types';

// Only providers confirmed to use Atlassian Statuspage (/api/v2/incidents.json)
// Providers that use custom status pages (Slack, Stripe, GitLab, Fastly,
// Hugging Face, Notion, Heroku) are excluded until custom parsers are added.
export const providerConfigs: ProviderConfig[] = [
  // Cloud Infra
  { name: 'Cloudflare', slug: 'cloudflare', category: 'cloud-infra', providerType: 'atlassian', statusPageUrl: 'https://www.cloudflarestatus.com' },
  { name: 'DigitalOcean', slug: 'digitalocean', category: 'cloud-infra', providerType: 'atlassian', statusPageUrl: 'https://status.digitalocean.com' },
  { name: 'Vercel', slug: 'vercel', category: 'cloud-infra', providerType: 'atlassian', statusPageUrl: 'https://www.vercel-status.com' },

  // AI
  { name: 'OpenAI', slug: 'openai', category: 'ai', providerType: 'atlassian', statusPageUrl: 'https://status.openai.com' },
  { name: 'Anthropic', slug: 'anthropic', category: 'ai', providerType: 'atlassian', statusPageUrl: 'https://status.claude.com' },

  // Dev Tools
  { name: 'GitHub', slug: 'github', category: 'dev-tools', providerType: 'atlassian', statusPageUrl: 'https://www.githubstatus.com' },
  { name: 'Atlassian', slug: 'atlassian', category: 'dev-tools', providerType: 'atlassian', statusPageUrl: 'https://status.atlassian.com' },
  { name: 'CircleCI', slug: 'circleci', category: 'dev-tools', providerType: 'atlassian', statusPageUrl: 'https://status.circleci.com' },
  { name: 'Datadog', slug: 'datadog', category: 'dev-tools', providerType: 'atlassian', statusPageUrl: 'https://status.datadoghq.com' },

  // Productivity
  { name: 'Figma', slug: 'figma', category: 'productivity', providerType: 'atlassian', statusPageUrl: 'https://status.figma.com' },
  { name: 'Canva', slug: 'canva', category: 'productivity', providerType: 'atlassian', statusPageUrl: 'https://www.canvastatus.com' },
  { name: 'Zoom', slug: 'zoom', category: 'productivity', providerType: 'atlassian', statusPageUrl: 'https://status.zoom.us' },

  // Comms
  { name: 'Twilio', slug: 'twilio', category: 'comms', providerType: 'atlassian', statusPageUrl: 'https://status.twilio.com' },
  { name: 'SendGrid', slug: 'sendgrid', category: 'comms', providerType: 'atlassian', statusPageUrl: 'https://status.sendgrid.com' },
  { name: 'Discord', slug: 'discord', category: 'comms', providerType: 'atlassian', statusPageUrl: 'https://discordstatus.com' },

  // Fintech
  { name: 'Plaid', slug: 'plaid', category: 'fintech', providerType: 'atlassian', statusPageUrl: 'https://status.plaid.com' },
  { name: 'Square', slug: 'square', category: 'fintech', providerType: 'atlassian', statusPageUrl: 'https://issquareup.com' },
];
