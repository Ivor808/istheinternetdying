import type { ProviderConfig } from './types';

// Only providers confirmed to use Atlassian Statuspage (/api/v2/incidents.json)
// Providers that use custom status pages (Slack, Stripe, GitLab, Fastly,
// Hugging Face, Notion, Heroku) are excluded until custom parsers are added.
export const providerConfigs: ProviderConfig[] = [
  // Cloud Infra
  { name: 'Cloudflare', slug: 'cloudflare', category: 'cloud-infra', providerType: 'atlassian', statusPageUrl: 'https://www.cloudflarestatus.com' },
  { name: 'DigitalOcean', slug: 'digitalocean', category: 'cloud-infra', providerType: 'atlassian', statusPageUrl: 'https://status.digitalocean.com' },
  { name: 'Vercel', slug: 'vercel', category: 'cloud-infra', providerType: 'atlassian', statusPageUrl: 'https://www.vercel-status.com' },
  { name: 'Render', slug: 'render', category: 'cloud-infra', providerType: 'atlassian', statusPageUrl: 'https://status.render.com' },
  { name: 'Supabase', slug: 'supabase', category: 'cloud-infra', providerType: 'atlassian', statusPageUrl: 'https://status.supabase.com' },
  { name: 'MongoDB', slug: 'mongodb', category: 'cloud-infra', providerType: 'atlassian', statusPageUrl: 'https://status.mongodb.com' },
  { name: 'Elastic', slug: 'elastic', category: 'cloud-infra', providerType: 'atlassian', statusPageUrl: 'https://status.elastic.co' },
  { name: 'Squarespace', slug: 'squarespace', category: 'cloud-infra', providerType: 'atlassian', statusPageUrl: 'https://status.squarespace.com' },
  { name: 'Netlify', slug: 'netlify', category: 'cloud-infra', providerType: 'atlassian', statusPageUrl: 'https://netlifystatus.com' },
  { name: 'Fly.io', slug: 'flyio', category: 'cloud-infra', providerType: 'atlassian', statusPageUrl: 'https://status.flyio.net' },
  { name: 'Linode', slug: 'linode', category: 'cloud-infra', providerType: 'atlassian', statusPageUrl: 'https://status.linode.com' },

  // AI
  { name: 'OpenAI', slug: 'openai', category: 'ai', providerType: 'atlassian', statusPageUrl: 'https://status.openai.com' },
  { name: 'Anthropic', slug: 'anthropic', category: 'ai', providerType: 'atlassian', statusPageUrl: 'https://status.claude.com' },

  // Dev Tools
  { name: 'GitHub', slug: 'github', category: 'dev-tools', providerType: 'atlassian', statusPageUrl: 'https://www.githubstatus.com' },
  { name: 'Atlassian', slug: 'atlassian', category: 'dev-tools', providerType: 'atlassian', statusPageUrl: 'https://status.atlassian.com' },
  { name: 'CircleCI', slug: 'circleci', category: 'dev-tools', providerType: 'atlassian', statusPageUrl: 'https://status.circleci.com' },
  { name: 'Datadog', slug: 'datadog', category: 'dev-tools', providerType: 'atlassian', statusPageUrl: 'https://status.datadoghq.com' },
  { name: 'npm', slug: 'npm', category: 'dev-tools', providerType: 'atlassian', statusPageUrl: 'https://status.npmjs.org' },
  { name: 'Sentry', slug: 'sentry', category: 'dev-tools', providerType: 'atlassian', statusPageUrl: 'https://status.sentry.io' },
  { name: 'HashiCorp', slug: 'hashicorp', category: 'dev-tools', providerType: 'atlassian', statusPageUrl: 'https://status.hashicorp.com' },
  { name: 'LaunchDarkly', slug: 'launchdarkly', category: 'dev-tools', providerType: 'atlassian', statusPageUrl: 'https://status.launchdarkly.com' },
  { name: 'New Relic', slug: 'newrelic', category: 'dev-tools', providerType: 'atlassian', statusPageUrl: 'https://status.newrelic.com' },
  { name: 'Retool', slug: 'retool', category: 'dev-tools', providerType: 'atlassian', statusPageUrl: 'https://status.retool.com' },
  { name: 'Segment', slug: 'segment', category: 'dev-tools', providerType: 'atlassian', statusPageUrl: 'https://status.segment.com' },
  { name: 'Amplitude', slug: 'amplitude', category: 'dev-tools', providerType: 'atlassian', statusPageUrl: 'https://status.amplitude.com' },
  { name: '1Password', slug: '1password', category: 'dev-tools', providerType: 'atlassian', statusPageUrl: 'https://status.1password.com' },
  { name: 'Linear', slug: 'linear', category: 'dev-tools', providerType: 'atlassian', statusPageUrl: 'https://linearstatus.com' },
  { name: 'Opsgenie', slug: 'opsgenie', category: 'dev-tools', providerType: 'atlassian', statusPageUrl: 'https://opsgenie.status.atlassian.com' },

  // Productivity
  { name: 'Figma', slug: 'figma', category: 'productivity', providerType: 'atlassian', statusPageUrl: 'https://status.figma.com' },
  { name: 'Canva', slug: 'canva', category: 'productivity', providerType: 'atlassian', statusPageUrl: 'https://www.canvastatus.com' },
  { name: 'Zoom', slug: 'zoom', category: 'productivity', providerType: 'atlassian', statusPageUrl: 'https://status.zoom.us' },
  { name: 'Dropbox', slug: 'dropbox', category: 'productivity', providerType: 'atlassian', statusPageUrl: 'https://status.dropbox.com' },
  { name: 'Box', slug: 'box', category: 'productivity', providerType: 'atlassian', statusPageUrl: 'https://status.box.com' },
  { name: 'Asana', slug: 'asana', category: 'productivity', providerType: 'atlassian', statusPageUrl: 'https://status.asana.com' },
  { name: 'Monday.com', slug: 'monday', category: 'productivity', providerType: 'atlassian', statusPageUrl: 'https://status.monday.com' },
  { name: 'Typeform', slug: 'typeform', category: 'productivity', providerType: 'atlassian', statusPageUrl: 'https://status.typeform.com' },
  { name: 'Miro', slug: 'miro', category: 'productivity', providerType: 'atlassian', statusPageUrl: 'https://status.miro.com' },
  { name: 'Airtable', slug: 'airtable', category: 'productivity', providerType: 'atlassian', statusPageUrl: 'https://status.airtable.com' },

  // Comms
  { name: 'Twilio', slug: 'twilio', category: 'comms', providerType: 'atlassian', statusPageUrl: 'https://status.twilio.com' },
  { name: 'SendGrid', slug: 'sendgrid', category: 'comms', providerType: 'atlassian', statusPageUrl: 'https://status.sendgrid.com' },
  { name: 'Discord', slug: 'discord', category: 'comms', providerType: 'atlassian', statusPageUrl: 'https://discordstatus.com' },
  { name: 'Reddit', slug: 'reddit', category: 'comms', providerType: 'atlassian', statusPageUrl: 'https://www.redditstatus.com' },
  { name: 'Intercom', slug: 'intercom', category: 'comms', providerType: 'atlassian', statusPageUrl: 'https://www.intercomstatus.com' },
  { name: 'HubSpot', slug: 'hubspot', category: 'comms', providerType: 'atlassian', statusPageUrl: 'https://status.hubspot.com' },
  { name: 'Mailgun', slug: 'mailgun', category: 'comms', providerType: 'atlassian', statusPageUrl: 'https://status.mailgun.com' },
  { name: 'Epic Games', slug: 'epicgames', category: 'comms', providerType: 'atlassian', statusPageUrl: 'https://status.epicgames.com' },
  { name: 'Pinterest', slug: 'pinterest', category: 'comms', providerType: 'atlassian', statusPageUrl: 'https://www.pintereststatus.com' },

  // Fintech
  { name: 'Plaid', slug: 'plaid', category: 'fintech', providerType: 'atlassian', statusPageUrl: 'https://status.plaid.com' },
  { name: 'Square', slug: 'square', category: 'fintech', providerType: 'atlassian', statusPageUrl: 'https://issquareup.com' },
  { name: 'Shopify', slug: 'shopify', category: 'fintech', providerType: 'atlassian', statusPageUrl: 'https://www.shopifystatus.com' },
];
