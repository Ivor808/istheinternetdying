export interface AIEvent {
  date: string;
  label: string;
  category: 'model' | 'tool' | 'industry';
}

export const AI_EVENTS: AIEvent[] = [
  // 2024 — Models
  { date: '2024-05-13', label: 'GPT-4o', category: 'model' },
  { date: '2024-06-20', label: 'Claude 3.5 Sonnet', category: 'model' },
  { date: '2024-07-23', label: 'Llama 3.1', category: 'model' },
  { date: '2024-10-22', label: 'Claude 3.5 Sonnet v2', category: 'model' },
  { date: '2024-12-11', label: 'Gemini 2.0', category: 'model' },

  // 2024 — Tools
  { date: '2024-03-12', label: 'Devin AI', category: 'tool' },
  { date: '2024-04-18', label: 'Meta AI', category: 'tool' },
  { date: '2024-05-14', label: 'Google AI Overviews', category: 'tool' },
  { date: '2024-10-28', label: 'Apple Intelligence', category: 'tool' },
  { date: '2024-12-09', label: 'Sora', category: 'tool' },
  { date: '2024-12-16', label: 'ChatGPT Search', category: 'tool' },

  // 2024 — Industry
  { date: '2024-08-02', label: 'EU AI Act', category: 'industry' },
  { date: '2024-12-11', label: 'ChatGPT 4.5h outage', category: 'industry' },

  // 2025 — Models
  { date: '2025-01-20', label: 'DeepSeek R1', category: 'model' },
  { date: '2025-02-24', label: 'Claude 3.7 Sonnet', category: 'model' },
  { date: '2025-02-27', label: 'GPT-4.5', category: 'model' },
  { date: '2025-03-25', label: 'Gemini 2.5 Pro', category: 'model' },
  { date: '2025-04-05', label: 'Llama 4', category: 'model' },
  { date: '2025-05-22', label: 'Claude 4', category: 'model' },
  { date: '2025-08-07', label: 'GPT-5', category: 'model' },
  { date: '2025-09-29', label: 'Claude Sonnet 4.5', category: 'model' },
  { date: '2025-11-24', label: 'Claude Opus 4.5', category: 'model' },

  // 2025 — Tools
  { date: '2025-02-01', label: 'OpenAI Operator', category: 'tool' },
  { date: '2025-02-24', label: 'Claude Code', category: 'tool' },

  // 2025 — Industry
  { date: '2025-06-10', label: 'ChatGPT 15h outage', category: 'industry' },

  // 2026 — Models
  { date: '2026-02-05', label: 'Claude Opus 4.6', category: 'model' },
  { date: '2026-02-17', label: 'Claude Sonnet 4.6', category: 'model' },
  { date: '2026-03-05', label: 'GPT-5.4', category: 'model' },
];

export const EVENT_CATEGORY_COLORS: Record<AIEvent['category'], string> = {
  model: '#a855f7',
  tool: '#3b82f6',
  industry: '#ef4444',
};

export const EVENT_CATEGORY_LABELS: Record<AIEvent['category'], string> = {
  model: 'Model Releases',
  tool: 'Tool Launches',
  industry: 'Industry Events',
};
