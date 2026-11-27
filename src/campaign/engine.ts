import { DELIVERABLE_MAX_TOKENS, STRATEGY_MAX_TOKENS } from '../constants';
import { buildBusinessProfileBlock, buildGuardrailsBlock } from '../orchestration/prompts';
import { createProvider } from '../providers';
import { AIError } from '../providers/errors';
import type {
  AppSettings,
  BusinessProfile,
  CampaignChecklistTask,
  CampaignDeliverable,
  CampaignDeliverableKind,
  CampaignIntake,
  CampaignPackage,
  CampaignStrategy,
  ChatCompletionMessage,
  Guardrails,
  HonestyLintIssue,
} from '../types';
import { nowIso } from '../utils/dates';
import { generateId } from '../utils/id';
import { type JsonSchemaNode } from '../utils/validate';
import { lintCampaignOutput } from './honestyLint';
import {
  extractJsonObject,
  formatDeliverableMarkdown,
  formatStrategyMarkdown,
  getDeliverableSchema,
  STRATEGY_JSON_SCHEMA,
  validateParsedPayload,
} from './schemas';

export const DELIVERABLE_TITLES: Record<CampaignDeliverableKind, string> = {
  social: 'Social Posts (SV & EN)',
  email: 'Past-Guest & Inquiry Email',
  ad: 'Ad Copy Variants',
  calendar: 'Content Calendar',
  video: 'Atmospheric Video Shot List',
  landing: 'Landing Page Copy',
  research: 'Market & Competitor Brief',
};

function buildSchemaShapeInstruction(kind: 'strategy' | CampaignDeliverableKind): string {
  switch (kind) {
    case 'strategy':
      return `{
  "schema_type": "strategy",
  "headline": "string",
  "positioning": "string",
  "rankedChannels": [{"channel": "string", "priority": 1, "rationale": "string"}],
  "phases": [{"title": "string", "timing": "string", "tasks": ["string"]}],
  "assumptions": ["string"],
  "risks": ["string"],
  "stopSpendThreshold": "string"
}`;
    case 'social':
      return `{
  "schema_type": "social",
  "posts": [{
    "platform": "Instagram",
    "format": "Reel | Carousel | Static",
    "hook": "string",
    "bodySv": "string",
    "bodyEn": "string",
    "ctaSv": "string",
    "ctaEn": "string",
    "hashtags": ["#tag1"],
    "visualDirection": "string"
  }]
}`;
    case 'email':
      return `{
  "schema_type": "email",
  "subjectSv": "string",
  "subjectEn": "string",
  "previewText": "string",
  "bodySv": "string",
  "bodyEn": "string",
  "ctaSv": "string",
  "ctaEn": "string",
  "sendNotes": "string"
}`;
    case 'ad':
      return `{
  "schema_type": "ad",
  "variants": [{
    "angle": "string",
    "headlineSv": "string",
    "headlineEn": "string",
    "primaryTextSv": "string",
    "primaryTextEn": "string",
    "cta": "string",
    "visualDirection": "string"
  }]
}`;
    case 'calendar':
      return `{
  "schema_type": "calendar",
  "summary": "string",
  "items": [{
    "date": "YYYY-MM-DD",
    "channel": "Email | Instagram | Website",
    "item": "string",
    "notes": "string",
    "cta": "string"
  }]
}`;
    case 'video':
      return `{
  "schema_type": "video",
  "shots": [{
    "shotNumber": 1,
    "durationSec": 6,
    "scene": "string",
    "feeling": "string",
    "camera": "string",
    "lightAndColor": "string",
    "referenceRequired": false
  }]
}`;
    case 'landing':
      return `{
  "schema_type": "landing",
  "heroHeadlineSv": "string",
  "heroHeadlineEn": "string",
  "subheadlineSv": "string",
  "subheadlineEn": "string",
  "sections": [{"title": "string", "bodySv": "string", "bodyEn": "string"}],
  "ctaSv": "string",
  "ctaEn": "string"
}`;
    case 'research':
      return `{
  "schema_type": "research",
  "title": "string",
  "question": "string",
  "findings": [{"point": "string", "confidence": "high | medium | low", "dateContext": "string"}],
  "implications": ["string"],
  "toVerify": ["string"],
  "freshnessNote": "string"
}`;
  }
}

async function runStructuredJsonWithRepair<T>(params: {
  providerId: AppSettings['provider'];
  modelId: string;
  systemPrompt: string;
  userPrompt: string;
  schema: JsonSchemaNode;
  temperature: number;
  maxTokens: number;
  signal: AbortSignal;
  lintFn?: (parsed: T) => HonestyLintIssue[];
  onRetryWait?: (waitMs: number) => void;
}): Promise<{ data: T; lintIssues: HonestyLintIssue[]; repaired: boolean }> {
  const provider = await createProvider(params.providerId);
  const messages: ChatCompletionMessage[] = [
    { role: 'system', content: params.systemPrompt },
    { role: 'user', content: params.userPrompt },
  ];

  let lastErrors: string[] = [];
  let lastRaw = '';
  let repaired = false;

  for (let attempt = 0; attempt < 2; attempt++) {
    if (params.signal.aborted) {
      throw new DOMException('Aborted', 'AbortError');
    }

    const attemptMessages: ChatCompletionMessage[] =
      attempt === 0
        ? messages
        : [
            ...messages,
            { role: 'assistant', content: lastRaw || '{}' },
            {
              role: 'user',
              content: `Your previous JSON failed validation or Brand Honesty checks:\n- ${lastErrors.join(
                '\n- '
              )}\n\nReturn ONLY a corrected valid JSON object fixing every error above.`,
            },
          ];

    const res = await provider.chat({
      model: params.modelId,
      messages: attemptMessages,
      temperature: attempt === 0 ? params.temperature : 0.2,
      maxTokens: params.maxTokens,
      responseFormat: 'json_object',
      signal: params.signal,
      onRetryWait: (waitMs) => params.onRetryWait?.(waitMs),
    });

    lastRaw = res.content;
    const extracted = extractJsonObject(res.content);
    if (!extracted.parsed) {
      lastErrors = [extracted.error || 'Could not parse JSON object.'];
      repaired = true;
      continue;
    }

    const check = validateParsedPayload(extracted.parsed, params.schema);
    if (!check.valid) {
      lastErrors = check.errors;
      repaired = true;
      continue;
    }

    const typed = extracted.parsed as T;
    const lintIssues = params.lintFn ? params.lintFn(typed) : [];
    const lintErrors = lintIssues.filter((i) => i.severity === 'error');

    if (lintErrors.length > 0 && attempt === 0) {
      lastErrors = lintErrors.map((e) => `${e.code}: ${e.message}`);
      repaired = true;
      continue;
    }

    return {
      data: typed,
      lintIssues,
      repaired,
    };
  }

  throw new AIError({
    code: 'VALIDATION_ERROR',
    message: `Could not produce valid structured output after repair retry: ${lastErrors.join('; ')}`,
    provider: params.providerId,
  });
}

function buildEngineSystemPrompt(params: {
  guardrails: Guardrails;
  businessProfile: BusinessProfile;
  intake: CampaignIntake;
}): string {
  const { guardrails, businessProfile, intake } = params;
  const hasRef = Boolean(intake.referencePhoto?.trim());

  return `You are a structured marketing campaign engine for ${businessProfile.businessName}.
Return ONLY a valid JSON object matching the exact requested schema. No prose outside JSON, no markdown code fences.

${buildGuardrailsBlock(guardrails)}

${buildBusinessProfileBlock(businessProfile)}

STRICT HONESTY & COPY RULES:
- Visual directions & video scenes: ${
    hasRef
      ? `Confirmed reference supplied: "${intake.referencePhoto?.trim()}". Only depict what that reference establishes plus atmospheric details.`
      : 'NO reference photo supplied. Visuals and video shots MUST describe ONLY atmosphere (water, steam, embers, frost, natural light, hands, stoneware). NEVER mention huts, cabins, buildings, docks, boats, or island silhouettes.'
  }
- Weather & northern lights: NEVER promise or guarantee aurora, northern lights, snow, or ice ("guaranteed", "every night", "always visible" are banned). Keep seasonal phenomena conditional ("on clear nights", "when conditions allow").
- Pricing & discounts: ONLY mention prices or discounts explicitly supplied in the intake or <business_profile>. NEVER invent "% off", discounts, or arbitrary currency figures.
- Privacy: Never include private personal, family, or health situations in marketing copy.
- Language preference: "${intake.language}". Whenever bilingual or auto is selected for customer-facing copy, fill BOTH Swedish (Sv) and English (En) fields natively.`;
}

export async function generateCampaignPackage(params: {
  intake: CampaignIntake;
  settings: AppSettings;
  guardrails: Guardrails;
  businessProfile: BusinessProfile;
  sourceChatId?: string;
  signal: AbortSignal;
  onProgress?: (stepLabel: string, current: number, total: number) => void;
}): Promise<CampaignPackage> {
  const { intake, settings, guardrails, businessProfile, sourceChatId, signal, onProgress } = params;
  const modelId = settings.provider === 'mock' ? 'hedetangen-demo-v1' : settings.model;

  if (!modelId) {
    throw new AIError({
      code: 'MODEL_NOT_FOUND',
      message: 'No model selected in Settings.',
      provider: settings.provider,
    });
  }

  const deliverablesList = intake.deliverables.length > 0 ? intake.deliverables : (['social', 'email'] as CampaignDeliverableKind[]);
  const totalSteps = 1 + deliverablesList.length;
  const systemPrompt = buildEngineSystemPrompt({ guardrails, businessProfile, intake });
  const intakeJson = JSON.stringify(intake, null, 2);

  // Step 1: Strategy
  onProgress?.('Building strategy & phased checklist…', 1, totalSteps);
  const strategyRes = await runStructuredJsonWithRepair<CampaignStrategy>({
    providerId: settings.provider,
    modelId,
    systemPrompt,
    userPrompt: `Build the campaign strategy JSON for this intake:\n${intakeJson}\n\nRequired JSON schema shape:\n${buildSchemaShapeInstruction('strategy')}\n\nKeep channel ranking realistic for ${intake.hoursPerWeek} and budget "${intake.budgetCeiling}" (owned channels #1 if budget is tight or zero).`,
    schema: STRATEGY_JSON_SCHEMA,
    temperature: 0.25,
    maxTokens: STRATEGY_MAX_TOKENS,
    signal,
    lintFn: (s) =>
      lintCampaignOutput({
        kind: 'strategy',
        markdown: formatStrategyMarkdown(s),
        structured: s,
        intake,
        businessProfile,
      }),
    onRetryWait: (waitMs) =>
      onProgress?.(`Rate-limit pause — resuming in ${Math.ceil(waitMs / 1000)}s…`, 1, totalSteps),
  });

  const strategy = strategyRes.data;
  const checklist: CampaignChecklistTask[] = [];
  for (const phase of strategy.phases) {
    for (const taskText of phase.tasks) {
      checklist.push({
        id: generateId(),
        phase: `${phase.title} (${phase.timing})`,
        text: taskText,
        done: false,
      });
    }
  }

  // Step 2..N: Each requested deliverable
  const deliverables: CampaignDeliverable[] = [];
  const todayIso = nowIso().slice(0, 10);

  for (let idx = 0; idx < deliverablesList.length; idx++) {
    const kind = deliverablesList[idx];
    const stepNum = idx + 2;
    onProgress?.(`Generating ${DELIVERABLE_TITLES[kind]}…`, stepNum, totalSteps);

    const extraRule =
      kind === 'calendar'
        ? `\nStart dates on or after ${todayIso} in YYYY-MM-DD format, aligned with ${intake.hoursPerWeek}.`
        : kind === 'video'
          ? '\nEach shot must use one continuous slow move or static frame, one sensory feeling, and obey the reference-photo rule strictly.'
          : '';

    const delivRes = await runStructuredJsonWithRepair<Record<string, unknown>>({
      providerId: settings.provider,
      modelId,
      systemPrompt,
      userPrompt: `Generate the "${kind}" deliverable JSON grounded in this intake and strategy.\n\nIntake:\n${intakeJson}\n\nStrategy summary:\nHeadline: ${strategy.headline}\nPositioning: ${strategy.positioning}\nTop channels: ${strategy.rankedChannels
        .map((c) => `${c.priority}. ${c.channel}`)
        .join(', ')}${extraRule}\n\nRequired JSON schema shape:\n${buildSchemaShapeInstruction(kind)}`,
      schema: getDeliverableSchema(kind),
      temperature: kind === 'calendar' || kind === 'research' ? 0.25 : 0.35,
      maxTokens: DELIVERABLE_MAX_TOKENS,
      signal,
      lintFn: (parsed) => {
        const md = formatDeliverableMarkdown(kind, parsed);
        return lintCampaignOutput({
          kind,
          markdown: md,
          structured: parsed,
          intake,
          businessProfile,
        });
      },
      onRetryWait: (waitMs) =>
        onProgress?.(`Rate-limit pause — resuming in ${Math.ceil(waitMs / 1000)}s…`, stepNum, totalSteps),
    });

    const markdown = formatDeliverableMarkdown(kind, delivRes.data);
    deliverables.push({
      id: generateId(),
      kind,
      title: DELIVERABLE_TITLES[kind],
      markdown,
      structured: delivRes.data,
      lintIssues: delivRes.lintIssues,
      repaired: delivRes.repaired,
      status: 'draft',
      createdAt: nowIso(),
    });
  }

  const allIssues = [...strategyRes.lintIssues, ...deliverables.flatMap((d) => d.lintIssues)];
  const errorCount = allIssues.filter((i) => i.severity === 'error').length;
  const warningCount = allIssues.filter((i) => i.severity === 'warning').length;
  const ts = nowIso();

  return {
    id: generateId(),
    name: `${intake.goal} — ${intake.coreOffer.slice(0, 44)}`,
    status: 'ready',
    intake,
    strategy,
    checklist,
    deliverables,
    lintSummary: {
      passed: errorCount === 0,
      errorCount,
      warningCount,
    },
    ...(sourceChatId ? { sourceChatId } : {}),
    createdAt: ts,
    updatedAt: ts,
  };
}

export async function generateSingleDeliverableModule(params: {
  kind: CampaignDeliverableKind;
  intake: CampaignIntake;
  settings: AppSettings;
  guardrails: Guardrails;
  businessProfile: BusinessProfile;
  extraContext?: string;
  signal: AbortSignal;
}): Promise<CampaignDeliverable> {
  const { kind, intake, settings, guardrails, businessProfile, extraContext, signal } = params;
  const modelId = settings.provider === 'mock' ? 'hedetangen-demo-v1' : settings.model;
  if (!modelId) {
    throw new AIError({
      code: 'MODEL_NOT_FOUND',
      message: 'No model selected in Settings.',
      provider: settings.provider,
    });
  }

  const systemPrompt = buildEngineSystemPrompt({ guardrails, businessProfile, intake });
  const todayIso = nowIso().slice(0, 10);

  const res = await runStructuredJsonWithRepair<Record<string, unknown>>({
    providerId: settings.provider,
    modelId,
    systemPrompt,
    userPrompt: `Generate a focused "${kind}" module JSON.\nIntake:\n${JSON.stringify(
      intake,
      null,
      2
    )}\n${extraContext ? `Additional context:\n${extraContext}\n` : ''}${
      kind === 'calendar' ? `Use YYYY-MM-DD dates starting on or after ${todayIso}.\n` : ''
    }\nRequired JSON schema shape:\n${buildSchemaShapeInstruction(kind)}`,
    schema: getDeliverableSchema(kind),
    temperature: kind === 'calendar' || kind === 'research' ? 0.25 : 0.35,
    maxTokens: DELIVERABLE_MAX_TOKENS,
    signal,
    lintFn: (parsed) =>
      lintCampaignOutput({
        kind,
        markdown: formatDeliverableMarkdown(kind, parsed),
        structured: parsed,
        intake,
        businessProfile,
      }),
  });

  return {
    id: generateId(),
    kind,
    title: DELIVERABLE_TITLES[kind],
    markdown: formatDeliverableMarkdown(kind, res.data),
    structured: res.data,
    lintIssues: res.lintIssues,
    repaired: res.repaired,
    status: 'draft',
    createdAt: nowIso(),
  };
}
