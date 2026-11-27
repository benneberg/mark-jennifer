import type {
  CampaignCalendarItem,
  CampaignDeliverableKind,
  CampaignStrategy,
} from '../types';
import { type JsonSchemaNode, validateSchema } from '../utils/validate';

export interface SocialPostItem {
  platform: string;
  format: string;
  hook: string;
  bodySv: string;
  bodyEn: string;
  ctaSv: string;
  ctaEn: string;
  hashtags: string[];
  visualDirection: string;
}

export interface EmailDeliverableData {
  subjectSv: string;
  subjectEn: string;
  previewText: string;
  bodySv: string;
  bodyEn: string;
  ctaSv: string;
  ctaEn: string;
  sendNotes: string;
}

export interface AdVariantItem {
  angle: string;
  headlineSv: string;
  headlineEn: string;
  primaryTextSv: string;
  primaryTextEn: string;
  cta: string;
  visualDirection: string;
}

export interface VideoShotItem {
  shotNumber: number;
  durationSec: number;
  scene: string;
  feeling: string;
  camera: string;
  lightAndColor: string;
  referenceRequired: boolean;
}

export interface LandingDeliverableData {
  heroHeadlineSv: string;
  heroHeadlineEn: string;
  subheadlineSv: string;
  subheadlineEn: string;
  sections: Array<{ title: string; bodySv: string; bodyEn: string }>;
  ctaSv: string;
  ctaEn: string;
}

export interface ResearchDeliverableData {
  title: string;
  question: string;
  findings: Array<{ point: string; confidence: string; dateContext: string }>;
  implications: string[];
  toVerify: string[];
  freshnessNote: string;
}

export const STRATEGY_JSON_SCHEMA: JsonSchemaNode = {
  type: 'object',
  required: [
    'headline',
    'positioning',
    'rankedChannels',
    'phases',
    'assumptions',
    'risks',
    'stopSpendThreshold',
  ],
  properties: {
    headline: { type: 'string', minLength: 5, maxLength: 240 },
    positioning: { type: 'string', minLength: 10, maxLength: 1200 },
    rankedChannels: {
      type: 'array',
      maxItems: 8,
      items: {
        type: 'object',
        required: ['channel', 'priority', 'rationale'],
        properties: {
          channel: { type: 'string', minLength: 1, maxLength: 80 },
          priority: { type: 'integer', minimum: 1, maximum: 10 },
          rationale: { type: 'string', minLength: 4, maxLength: 400 },
        },
      },
    },
    phases: {
      type: 'array',
      maxItems: 6,
      items: {
        type: 'object',
        required: ['title', 'timing', 'tasks'],
        properties: {
          title: { type: 'string', minLength: 2, maxLength: 160 },
          timing: { type: 'string', minLength: 1, maxLength: 80 },
          tasks: { type: 'array', maxItems: 12, items: { type: 'string', minLength: 3, maxLength: 280 } },
        },
      },
    },
    assumptions: { type: 'array', maxItems: 10, items: { type: 'string', minLength: 3, maxLength: 300 } },
    risks: { type: 'array', maxItems: 10, items: { type: 'string', minLength: 3, maxLength: 300 } },
    stopSpendThreshold: { type: 'string', minLength: 5, maxLength: 500 },
  },
};

export const SOCIAL_JSON_SCHEMA: JsonSchemaNode = {
  type: 'object',
  required: ['posts'],
  properties: {
    posts: {
      type: 'array',
      maxItems: 8,
      items: {
        type: 'object',
        required: ['platform', 'format', 'hook', 'bodySv', 'bodyEn', 'ctaSv', 'ctaEn', 'hashtags', 'visualDirection'],
        properties: {
          platform: { type: 'string', minLength: 2, maxLength: 60 },
          format: { type: 'string', minLength: 2, maxLength: 60 },
          hook: { type: 'string', minLength: 3, maxLength: 240 },
          bodySv: { type: 'string', minLength: 5, maxLength: 2000 },
          bodyEn: { type: 'string', minLength: 5, maxLength: 2000 },
          ctaSv: { type: 'string', minLength: 2, maxLength: 200 },
          ctaEn: { type: 'string', minLength: 2, maxLength: 200 },
          hashtags: { type: 'array', maxItems: 8, items: { type: 'string', minLength: 2, maxLength: 50 } },
          visualDirection: { type: 'string', minLength: 5, maxLength: 500 },
        },
      },
    },
  },
};

export const EMAIL_JSON_SCHEMA: JsonSchemaNode = {
  type: 'object',
  required: ['subjectSv', 'subjectEn', 'previewText', 'bodySv', 'bodyEn', 'ctaSv', 'ctaEn', 'sendNotes'],
  properties: {
    subjectSv: { type: 'string', minLength: 4, maxLength: 200 },
    subjectEn: { type: 'string', minLength: 4, maxLength: 200 },
    previewText: { type: 'string', minLength: 2, maxLength: 240 },
    bodySv: { type: 'string', minLength: 20, maxLength: 4000 },
    bodyEn: { type: 'string', minLength: 20, maxLength: 4000 },
    ctaSv: { type: 'string', minLength: 2, maxLength: 200 },
    ctaEn: { type: 'string', minLength: 2, maxLength: 200 },
    sendNotes: { type: 'string', minLength: 2, maxLength: 400 },
  },
};

export const AD_JSON_SCHEMA: JsonSchemaNode = {
  type: 'object',
  required: ['variants'],
  properties: {
    variants: {
      type: 'array',
      maxItems: 6,
      items: {
        type: 'object',
        required: ['angle', 'headlineSv', 'headlineEn', 'primaryTextSv', 'primaryTextEn', 'cta', 'visualDirection'],
        properties: {
          angle: { type: 'string', minLength: 2, maxLength: 100 },
          headlineSv: { type: 'string', minLength: 3, maxLength: 180 },
          headlineEn: { type: 'string', minLength: 3, maxLength: 180 },
          primaryTextSv: { type: 'string', minLength: 5, maxLength: 1500 },
          primaryTextEn: { type: 'string', minLength: 5, maxLength: 1500 },
          cta: { type: 'string', minLength: 2, maxLength: 100 },
          visualDirection: { type: 'string', minLength: 5, maxLength: 500 },
        },
      },
    },
  },
};

export const CALENDAR_JSON_SCHEMA: JsonSchemaNode = {
  type: 'object',
  required: ['summary', 'items'],
  properties: {
    summary: { type: 'string', minLength: 5, maxLength: 600 },
    items: {
      type: 'array',
      maxItems: 24,
      items: {
        type: 'object',
        required: ['date', 'channel', 'item', 'notes'],
        properties: {
          date: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
          channel: { type: 'string', minLength: 2, maxLength: 60 },
          item: { type: 'string', minLength: 3, maxLength: 200 },
          notes: { type: 'string', minLength: 3, maxLength: 500 },
          cta: { type: 'string', maxLength: 160 },
        },
      },
    },
  },
};

export const VIDEO_JSON_SCHEMA: JsonSchemaNode = {
  type: 'object',
  required: ['shots'],
  properties: {
    shots: {
      type: 'array',
      maxItems: 10,
      items: {
        type: 'object',
        required: ['shotNumber', 'durationSec', 'scene', 'feeling', 'camera', 'lightAndColor', 'referenceRequired'],
        properties: {
          shotNumber: { type: 'integer', minimum: 1, maximum: 20 },
          durationSec: { type: 'integer', minimum: 2, maximum: 60 },
          scene: { type: 'string', minLength: 8, maxLength: 600 },
          feeling: { type: 'string', minLength: 3, maxLength: 180 },
          camera: { type: 'string', minLength: 3, maxLength: 240 },
          lightAndColor: { type: 'string', minLength: 3, maxLength: 240 },
          referenceRequired: { type: 'boolean' },
        },
      },
    },
  },
};

export const LANDING_JSON_SCHEMA: JsonSchemaNode = {
  type: 'object',
  required: ['heroHeadlineSv', 'heroHeadlineEn', 'subheadlineSv', 'subheadlineEn', 'sections', 'ctaSv', 'ctaEn'],
  properties: {
    heroHeadlineSv: { type: 'string', minLength: 4, maxLength: 200 },
    heroHeadlineEn: { type: 'string', minLength: 4, maxLength: 200 },
    subheadlineSv: { type: 'string', minLength: 5, maxLength: 400 },
    subheadlineEn: { type: 'string', minLength: 5, maxLength: 400 },
    sections: {
      type: 'array',
      maxItems: 6,
      items: {
        type: 'object',
        required: ['title', 'bodySv', 'bodyEn'],
        properties: {
          title: { type: 'string', minLength: 2, maxLength: 140 },
          bodySv: { type: 'string', minLength: 5, maxLength: 1500 },
          bodyEn: { type: 'string', minLength: 5, maxLength: 1500 },
        },
      },
    },
    ctaSv: { type: 'string', minLength: 2, maxLength: 160 },
    ctaEn: { type: 'string', minLength: 2, maxLength: 160 },
  },
};

export const RESEARCH_JSON_SCHEMA: JsonSchemaNode = {
  type: 'object',
  required: ['title', 'question', 'findings', 'implications', 'toVerify', 'freshnessNote'],
  properties: {
    title: { type: 'string', minLength: 4, maxLength: 200 },
    question: { type: 'string', minLength: 4, maxLength: 300 },
    findings: {
      type: 'array',
      maxItems: 8,
      items: {
        type: 'object',
        required: ['point', 'confidence', 'dateContext'],
        properties: {
          point: { type: 'string', minLength: 5, maxLength: 500 },
          confidence: { type: 'string', minLength: 2, maxLength: 40 },
          dateContext: { type: 'string', minLength: 2, maxLength: 120 },
        },
      },
    },
    implications: { type: 'array', maxItems: 8, items: { type: 'string', minLength: 4, maxLength: 400 } },
    toVerify: { type: 'array', maxItems: 8, items: { type: 'string', minLength: 4, maxLength: 300 } },
    freshnessNote: { type: 'string', minLength: 4, maxLength: 400 },
  },
};

export function getDeliverableSchema(kind: CampaignDeliverableKind): JsonSchemaNode {
  switch (kind) {
    case 'social':
      return SOCIAL_JSON_SCHEMA;
    case 'email':
      return EMAIL_JSON_SCHEMA;
    case 'ad':
      return AD_JSON_SCHEMA;
    case 'calendar':
      return CALENDAR_JSON_SCHEMA;
    case 'video':
      return VIDEO_JSON_SCHEMA;
    case 'landing':
      return LANDING_JSON_SCHEMA;
    case 'research':
      return RESEARCH_JSON_SCHEMA;
  }
}

export function extractJsonObject(raw: string): { parsed?: unknown; error?: string } {
  const withoutThinking = raw
    .replace(/<(?:think|thinking)>[\s\S]*?<\/(?:think|thinking)>/gi, '')
    .trim();
  if (!withoutThinking) {
    if (/<(?:think|thinking)>/i.test(raw)) {
      return { error: 'Model spent its response inside a thinking block without outputting JSON.' };
    }
    return { error: 'Empty response from model.' };
  }

  const fenceMatch = withoutThinking.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenceMatch ? fenceMatch[1].trim() : withoutThinking;

  try {
    return { parsed: JSON.parse(candidate) };
  } catch {
    let lastSyntaxError: string | undefined;
    for (let start = candidate.indexOf('{'); start !== -1; start = candidate.indexOf('{', start + 1)) {
      let depth = 0;
      let inString = false;
      let escaped = false;
      for (let i = start; i < candidate.length; i++) {
        const ch = candidate[i];
        if (inString) {
          if (escaped) {
            escaped = false;
          } else if (ch === '\\') {
            escaped = true;
          } else if (ch === '"') {
            inString = false;
          }
          continue;
        }
        if (ch === '"') {
          inString = true;
        } else if (ch === '{') {
          depth++;
        } else if (ch === '}') {
          depth--;
          if (depth === 0) {
            try {
              const parsed = JSON.parse(candidate.slice(start, i + 1));
              if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
                return { parsed };
              }
            } catch (err) {
              lastSyntaxError = err instanceof Error ? err.message : 'Invalid JSON syntax.';
            }
            break;
          }
        }
      }
    }
    return { error: lastSyntaxError ?? 'Response did not contain a valid JSON object.' };
  }
}

export function validateParsedPayload(
  parsed: unknown,
  schema: JsonSchemaNode
): { valid: boolean; errors: string[] } {
  const res = validateSchema(parsed, schema, '$', { relaxAdditionalProperties: true });
  if (!res.valid) {
    return {
      valid: false,
      errors: res.errors.map((e) => `${e.path}: ${e.message}`),
    };
  }
  // Ensure non-empty top-level arrays
  const obj = parsed as Record<string, unknown>;
  for (const key of ['posts', 'variants', 'items', 'shots', 'sections', 'findings', 'phases', 'rankedChannels']) {
    if (Array.isArray(obj[key]) && (obj[key] as unknown[]).length === 0) {
      return { valid: false, errors: [`$.${key}: must contain at least 1 item`] };
    }
  }
  return { valid: true, errors: [] };
}

export function formatStrategyMarkdown(strategy: CampaignStrategy): string {
  const lines: string[] = [
    `## ${strategy.headline}`,
    '',
    strategy.positioning,
    '',
    '### Ranked Channels',
    ...strategy.rankedChannels
      .slice()
      .sort((a, b) => a.priority - b.priority)
      .map((c) => `${c.priority}. **${c.channel}** — ${c.rationale}`),
    '',
    '### Execution Plan',
  ];

  for (const ph of strategy.phases) {
    lines.push(`#### ${ph.title} (${ph.timing})`);
    for (const task of ph.tasks) {
      lines.push(`- [ ] ${task}`);
    }
    lines.push('');
  }

  if (strategy.stopSpendThreshold) {
    lines.push(`### Spend / Stop Threshold`, strategy.stopSpendThreshold, '');
  }
  if (strategy.assumptions.length) {
    lines.push('### Assumptions', ...strategy.assumptions.map((a) => `- ${a}`), '');
  }
  if (strategy.risks.length) {
    lines.push('### Risks & Safeguards', ...strategy.risks.map((r) => `- ${r}`));
  }

  return lines.join('\n').trim();
}

export function formatDeliverableMarkdown(kind: CampaignDeliverableKind, data: unknown): string {
  if (kind === 'social') {
    const posts = ((data as { posts?: SocialPostItem[] }).posts ?? []);
    return posts
      .map(
        (p, idx) =>
          `### Post ${idx + 1}: ${p.platform} (${p.format})\n**Hook:** ${p.hook}\n\n**SV:** ${p.bodySv}\n\n**EN:** ${p.bodyEn}\n\n**CTA:** SV: ${p.ctaSv} | EN: ${p.ctaEn}\n\n**Hashtags:** ${p.hashtags.slice(0, 8).join(' ')}\n\n**Visual direction:** ${p.visualDirection}`
      )
      .join('\n\n---\n\n');
  }

  if (kind === 'email') {
    const e = data as EmailDeliverableData;
    return [
      `### Email Campaign`,
      `**Subject (SV):** ${e.subjectSv}`,
      `**Subject (EN):** ${e.subjectEn}`,
      `**Preview:** ${e.previewText}`,
      '',
      `**SV:**\n${e.bodySv}`,
      '',
      `**EN:**\n${e.bodyEn}`,
      '',
      `**CTA:** SV: ${e.ctaSv} | EN: ${e.ctaEn}`,
      '',
      `**Send notes:** ${e.sendNotes}`,
    ].join('\n');
  }

  if (kind === 'ad') {
    const variants = ((data as { variants?: AdVariantItem[] }).variants ?? []);
    return variants
      .map(
        (v, idx) =>
          `### Ad Variant ${idx + 1} — ${v.angle}\n**Headline (SV):** ${v.headlineSv}\n**Headline (EN):** ${v.headlineEn}\n\n**SV:** ${v.primaryTextSv}\n\n**EN:** ${v.primaryTextEn}\n\n**CTA:** ${v.cta}\n\n**Visual direction:** ${v.visualDirection}`
      )
      .join('\n\n---\n\n');
  }

  if (kind === 'calendar') {
    const cal = data as { summary: string; items: CampaignCalendarItem[] };
    const rows = cal.items.map(
      (i) => `| ${i.date} | ${i.channel} | ${i.item} | ${i.notes}${i.cta ? ` (${i.cta})` : ''} |`
    );
    return [
      cal.summary,
      '',
      '| Date | Channel | Item | Notes |',
      '| --- | --- | --- | --- |',
      ...rows,
    ].join('\n');
  }

  if (kind === 'video') {
    const shots = ((data as { shots?: VideoShotItem[] }).shots ?? []);
    return shots
      .map(
        (s) =>
          `### Shot ${s.shotNumber} (${s.durationSec}s)\n- **Scene:** ${s.scene}\n- **Feeling:** ${s.feeling}\n- **Camera:** ${s.camera}\n- **Light & colour:** ${s.lightAndColor}\n- **Reference required:** ${s.referenceRequired ? 'yes' : 'no (atmosphere only)'}`
      )
      .join('\n\n');
  }

  if (kind === 'landing') {
    const l = data as LandingDeliverableData;
    const sections = l.sections
      .map((sec) => `### ${sec.title}\n**SV:** ${sec.bodySv}\n\n**EN:** ${sec.bodyEn}`)
      .join('\n\n');
    return [
      `## SV: ${l.heroHeadlineSv}\n## EN: ${l.heroHeadlineEn}`,
      `**SV:** ${l.subheadlineSv}\n**EN:** ${l.subheadlineEn}`,
      '',
      sections,
      '',
      `**CTA:** SV: ${l.ctaSv} | EN: ${l.ctaEn}`,
    ].join('\n\n');
  }

  // research
  const r = data as ResearchDeliverableData;
  return [
    `## ${r.title}`,
    `**Question:** ${r.question}`,
    '',
    '### Findings',
    ...r.findings.map((f) => `- ${f.point} *(confidence: ${f.confidence} · ${f.dateContext})*`),
    '',
    '### Implications',
    ...r.implications.map((i) => `- ${i}`),
    '',
    '### What to Verify',
    ...r.toVerify.map((v) => `- [ ] ${v}`),
    '',
    `**Freshness:** ${r.freshnessNote}`,
  ].join('\n');
}
