export type EventCategory = 'outage' | 'model' | 'tool' | 'industry';

export interface TimelineEvent {
  date: string;
  label: string;
  category: EventCategory;
  // Major events get an on-chart text label; the rest are unlabelled markers
  major?: boolean;
  description?: string;
  url?: string;
}

export const EVENTS: TimelineEvent[] = [
  // Outages — internet-wide incidents
  {
    date: '2024-03-05',
    label: 'Meta outage',
    category: 'outage',
    description: 'Facebook, Instagram and Threads down for ~2 hours; users logged out en masse.',
    url: 'https://fortune.com/2024/03/05/facebook-instagram-outage-march-2024/',
  },
  {
    date: '2024-07-19',
    label: 'CrowdStrike BSOD',
    category: 'outage',
    major: true,
    description: 'Faulty Falcon sensor update crashed ~8.5M Windows machines; airlines, banks and hospitals hit.',
    url: 'https://techcrunch.com/2024/07/19/faulty-crowdstrike-update-causes-major-global-it-outage-taking-out-banks-airlines-and-businesses-globally',
  },
  {
    date: '2024-12-11',
    label: 'ChatGPT 4h outage',
    category: 'outage',
    description: 'New telemetry service overloaded Kubernetes control planes; all OpenAI services down ~4 hours.',
    url: 'https://status.openai.com/incidents/ctrsv3lwd797/write-up',
  },
  {
    date: '2025-06-10',
    label: 'ChatGPT 10h+ outage',
    category: 'outage',
    description: 'Elevated errors across ChatGPT, Sora and the API for over 10 hours.',
    url: 'https://www.techradar.com/news/live/chatgpt-down-june-10',
  },
  {
    date: '2025-07-09',
    label: 'Outlook outage',
    category: 'outage',
    description: 'Mailboxes unreachable on every Outlook client; resolved the next afternoon.',
    url: 'https://www.theregister.com/2025/07/10/outlook_microsoft_email_outage/',
  },
  {
    date: '2025-06-12',
    label: 'Google Cloud outage',
    category: 'outage',
    major: true,
    description: 'Service Control/IAM failure took down GCP APIs and cascaded into Cloudflare Workers KV.',
    url: 'https://www.thousandeyes.com/blog/google-cloud-outage-analysis-june-12-2025',
  },
  {
    date: '2025-10-20',
    label: 'AWS us-east-1 outage',
    category: 'outage',
    major: true,
    description: 'DynamoDB DNS race condition in us-east-1 cascaded across AWS for ~15 hours.',
    url: 'https://www.infoq.com/news/2025/11/aws-dynamodb-outage-postmortem',
  },
  {
    date: '2025-10-29',
    label: 'Azure Front Door outage',
    category: 'outage',
    major: true,
    description: 'Config change broke Azure Front Door globally; Microsoft 365, Xbox and Azure customers down ~8 hours.',
    url: 'https://www.thousandeyes.com/blog/microsoft-azure-front-door-outage-analysis-october-29-2025',
  },
  {
    date: '2025-11-18',
    label: 'Cloudflare outage',
    category: 'outage',
    major: true,
    description: 'Oversized Bot Management feature file crashed the proxy; X, ChatGPT and much of the web down for hours.',
    url: 'https://www.thousandeyes.com/blog/cloudflare-outage-analysis-november-18-2025',
  },
  {
    date: '2025-12-05',
    label: 'Cloudflare 25m outage',
    category: 'outage',
    description: 'WAF buffer change broke ~28% of Cloudflare HTTP traffic for 25 minutes.',
    url: 'https://blog.cloudflare.com/5-december-2025-outage/',
  },
  {
    date: '2026-02-20',
    label: 'Cloudflare BYOIP outage',
    category: 'outage',
    description: 'Buggy cleanup task withdrew ~1,100 customer BYOIP prefixes from BGP.',
    url: 'https://blog.cloudflare.com/cloudflare-outage-february-20-2026/',
  },
  {
    date: '2026-05-07',
    label: 'AWS us-east-1 overheating',
    category: 'outage',
    major: true,
    description: 'Cooling failure in one us-east-1 AZ impaired EC2/EBS for over a day; Coinbase and FanDuel down.',
    url: 'https://www.itpro.com/infrastructure/aws-outage-explained-may-2026-data-center-overheating',
  },
  {
    date: '2026-09-16',
    label: 'Salesforce outage',
    category: 'outage',
    description: 'Global Salesforce disruption across hundreds of instances during Dreamforce.',
    url: 'https://www.theregister.com/2026/09/16/salesforce-staggers-back-to-feet-after-global-outage/5296800',
  },
  {
    date: '2026-11-12',
    label: 'Microsoft 365 outage',
    category: 'outage',
    major: true,
    description: 'Outlook, Teams and Copilot down in 74+ countries; some users out for over 18 hours.',
    url: 'https://www.cnn.com/2026/11/12/tech/microsoft-outage-cripples-office-workers-nationwide',
  },
  {
    date: '2026-11-13',
    label: 'FAA ground stop',
    category: 'outage',
    major: true,
    description: 'Air traffic control telecom failure grounded US flights for ~4 hours; ~8,000 cancellations.',
    url: 'https://www.npr.org/2026/11/13/nx-s1-6040403/faa-nationwide-groundstop-airports',
  },

  // 2024 — Models
  { date: '2024-05-13', label: 'GPT-4o', category: 'model', major: true },
  { date: '2024-06-20', label: 'Claude 3.5 Sonnet', category: 'model', major: true },
  { date: '2024-07-23', label: 'Llama 3.1', category: 'model' },
  { date: '2024-10-22', label: 'Claude 3.5 Sonnet v2', category: 'model' },
  { date: '2024-12-11', label: 'Gemini 2.0', category: 'model' },

  // 2024 — Tools
  { date: '2024-03-12', label: 'Devin AI', category: 'tool' },
  { date: '2024-04-18', label: 'Meta AI', category: 'tool' },
  { date: '2024-05-14', label: 'Google AI Overviews', category: 'tool' },
  { date: '2024-10-28', label: 'Apple Intelligence', category: 'tool' },
  {
    date: '2024-10-31',
    label: 'ChatGPT Search',
    category: 'tool',
    url: 'https://techcrunch.com/2024/10/31/openai-launches-its-google-challenger-chatgpt-search/',
  },
  { date: '2024-12-09', label: 'Sora', category: 'tool' },

  // 2024 — Industry
  {
    date: '2024-08-01',
    label: 'EU AI Act',
    category: 'industry',
    description: 'EU AI Act enters into force.',
    url: 'https://commission.europa.eu/news/ai-act-enters-force-2024-08-01_en',
  },

  // 2025 — Models
  { date: '2025-01-20', label: 'DeepSeek R1', category: 'model', major: true },
  { date: '2025-02-24', label: 'Claude 3.7 Sonnet', category: 'model' },
  { date: '2025-02-27', label: 'GPT-4.5', category: 'model' },
  { date: '2025-03-25', label: 'Gemini 2.5 Pro', category: 'model' },
  { date: '2025-04-05', label: 'Llama 4', category: 'model' },
  { date: '2025-05-22', label: 'Claude 4', category: 'model' },
  { date: '2025-08-07', label: 'GPT-5', category: 'model', major: true },
  { date: '2025-09-29', label: 'Claude Sonnet 4.5', category: 'model' },
  { date: '2025-11-24', label: 'Claude Opus 4.5', category: 'model' },

  // 2025 — Tools
  {
    date: '2025-01-23',
    label: 'OpenAI Operator',
    category: 'tool',
    url: 'https://openai.com/index/introducing-operator/',
  },
  { date: '2025-02-24', label: 'Claude Code', category: 'tool' },

  // 2026 — Models
  { date: '2026-02-05', label: 'Claude Opus 4.6', category: 'model' },
  { date: '2026-02-17', label: 'Claude Sonnet 4.6', category: 'model' },
  {
    date: '2026-03-05',
    label: 'GPT-5.4',
    category: 'model',
    url: 'https://techcrunch.com/2026/03/05/openai-launches-gpt-5-4-with-pro-and-thinking-versions',
  },
  {
    date: '2026-04-16',
    label: 'Claude Opus 4.7',
    category: 'model',
    url: 'https://platform.claude.com/docs/en/release-notes/overview',
  },
  {
    date: '2026-04-23',
    label: 'GPT-5.5',
    category: 'model',
    major: true,
    url: 'https://axios.com/2026/04/23/openai-releases-spud-gpt-model',
  },
  {
    date: '2026-05-19',
    label: 'Gemini 3.5 Flash',
    category: 'model',
    url: 'https://techcrunch.com/2026/05/19/with-gemini-3-5-flash-google-bets-its-next-ai-wave-on-agents-not-chatbots/',
  },
  {
    date: '2026-06-09',
    label: 'Claude Fable 5',
    category: 'model',
    major: true,
    description: 'First Mythos-class model opened to general customers.',
    url: 'https://www.cnbc.com/2026/06/09/anthropic-mythos-claude-fable-5.html',
  },
  {
    date: '2026-07-09',
    label: 'GPT-5.6',
    category: 'model',
    description: 'Sol, Terra and Luna tiers reach general availability.',
    url: 'https://techcrunch.com/2026/07/09/openai-launches-its-new-family-of-models-with-gpt-5-6/',
  },
  {
    date: '2026-07-24',
    label: 'Claude Opus 5',
    category: 'model',
    url: 'https://www.axios.com/2026/07/24/anthropic-releases-new-model-opus-5',
  },
  {
    date: '2026-09-03',
    label: 'GPT-6 Astra',
    category: 'model',
    major: true,
    url: 'https://9to5mac.com/2026/09/03/openai-releasing-major-upgrade-to-chatgpt-and-codex-with-gpt-6-astra-details-here/',
  },
  {
    date: '2026-09-22',
    label: 'Claude Opus 5.5',
    category: 'model',
    url: 'https://platform.claude.com/docs/en/release-notes/overview',
  },
  {
    date: '2026-11-09',
    label: 'Claude Fable 5.2',
    category: 'model',
    url: 'https://platform.claude.com/docs/en/release-notes/overview',
  },
];

export const EVENT_CATEGORIES: EventCategory[] = ['outage', 'model', 'tool', 'industry'];

export const EVENT_CATEGORY_COLORS: Record<EventCategory, string> = {
  outage: '#ef4444',
  model: '#a855f7',
  tool: '#3b82f6',
  industry: '#94a3b8',
};

export const EVENT_CATEGORY_LABELS: Record<EventCategory, string> = {
  outage: 'Major Outages',
  model: 'Model Releases',
  tool: 'Tool Launches',
  industry: 'Industry Events',
};

export function eventId(e: TimelineEvent): string {
  return `${e.date}:${e.label}`;
}
