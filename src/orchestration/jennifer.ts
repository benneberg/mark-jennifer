import {
  EXPERT_MAX_TOKENS,
  PLANNER_MAX_TOKENS,
  SYNTHESIS_MAX_TOKENS,
} from '../constants';
import { createProvider } from '../providers';
import { AIError } from '../providers/errors';
import type {
  AppSettings,
  ChatCompletionMessage,
  ChatMessage,
  Expert,
  Guardrails,
  SessionFacts,
} from '../types';
import {
  extractDeterministicFacts,
  mergeSessionFacts,
  resolveExpert,
  trimChatHistory,
  trimExpertHistory,
} from './context';
import { parseDelegation } from './delegation';
import {
  buildExpertPrompt,
  buildJenniferPrompt,
  buildSynthesisPrompt,
} from './prompts';

export interface TurnCallbacks {
  onStatus: (status: string | null) => void;
  onHandoff: (handoffText: string, expertNames: string[]) => void;
  onExpertActive: (expertName: string) => void;
  onToken: (delta: string) => void;
  onParseWarn?: (rawOutput: string) => void;
}

export interface TurnResult {
  content: string;
  handoffText?: string;
  delegatedExperts: string[];
  updatedFacts: SessionFacts;
  truncatedDelegates?: number;
  callCount: number;
  durationMs: number;
  stopped?: boolean;
}

function escapeXmlValue(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escapeXmlAttr(value: string): string {
  return escapeXmlValue(value).replace(/"/g, '&quot;');
}

export async function runJenniferTurn(params: {
  userMessage: string;
  history: ChatMessage[];
  sessionFacts?: SessionFacts;
  referencePhoto?: string;
  settings: AppSettings;
  guardrails: Guardrails;
  experts: Expert[];
  signal: AbortSignal;
  callbacks: TurnCallbacks;
}): Promise<TurnResult> {
  const startTime = performance.now();
  const {
    userMessage,
    history,
    sessionFacts,
    referencePhoto,
    settings,
    guardrails,
    experts,
    signal,
    callbacks,
  } = params;
  const provider = await createProvider(settings.provider);
  const modelId = settings.provider === 'mock' ? 'hedetangen-demo-v1' : settings.model;

  if (!modelId) {
    throw new AIError({
      code: 'MODEL_NOT_FOUND',
      message: 'No model selected.',
      provider: settings.provider,
    });
  }

  let callCount = 0;
  const trimmedHistory = trimChatHistory(history);
  const expertHistory = trimExpertHistory(history);
  const deterministicPatch = extractDeterministicFacts(userMessage, referencePhoto);
  const prePlanFacts = mergeSessionFacts(sessionFacts, deterministicPatch);

  // Pass 1: Jennifer planning call (buffered)
  callbacks.onStatus('Jennifer is thinking…');
  const planMessages: ChatCompletionMessage[] = [
    {
      role: 'system',
      content: buildJenniferPrompt({
        guardrails,
        experts,
        settings,
        sessionFacts: prePlanFacts,
        referencePhoto,
      }),
    },
    ...trimmedHistory,
    { role: 'user', content: userMessage },
  ];

  callCount++;
  const firstPass = await provider.chat({
    model: modelId,
    messages: planMessages,
    temperature: 0.4,
    maxTokens: PLANNER_MAX_TOKENS,
    signal,
  });

  const plan = parseDelegation(firstPass.content);
  if (plan.parseWarn) {
    callbacks.onParseWarn?.(firstPass.content);
  }

  const updatedFacts = mergeSessionFacts(prePlanFacts, plan.facts);

  // Direct answer (no delegation)
  if (plan.delegates.length === 0) {
    callbacks.onStatus(null);
    const directText = plan.response || firstPass.content;
    callbacks.onToken(directText);
    return {
      content: directText,
      delegatedExperts: [],
      updatedFacts,
      callCount,
      durationMs: Math.round(performance.now() - startTime),
    };
  }

  // Pass 2: Execute delegated experts sequentially (capped at MAX_DELEGATES_PER_TURN = 3)
  const plannedNames = plan.delegates.map((d) => d.expert);
  const handoffText = plan.response || 'Working on this with your Brand DNA guardrails.';
  callbacks.onHandoff(handoffText, plannedNames);

  const expertOutputs: Array<{ expert: string; content?: string; error?: string }> = [];

  for (const directive of plan.delegates) {
    if (signal.aborted) {
      throw new DOMException('Aborted', 'AbortError');
    }

    const expert = resolveExpert(directive.expert, experts);
    if (!expert) {
      expertOutputs.push({
        expert: directive.expert,
        error: `Expert '${directive.expert}' was requested but is not enabled or available.`,
      });
      continue;
    }

    callbacks.onExpertActive(expert.name);
    callbacks.onStatus(`${expert.name} is working…`);

    const priorBlock =
      expertOutputs.length > 0
        ? `Prior specialist outputs in this turn:\n${expertOutputs
            .map((o) => `[${o.expert}]: ${o.content ?? o.error}`)
            .join('\n\n')}\n\n`
        : '';

    const refXml = referencePhoto?.trim()
      ? `\n<confirmed_reference>${escapeXmlValue(referencePhoto.trim())}</confirmed_reference>`
      : '';

    const expertMessages: ChatCompletionMessage[] = [
      {
        role: 'system',
        content: buildExpertPrompt({
          expert,
          guardrails,
          settings,
          sessionFacts: updatedFacts,
          referencePhoto,
        }),
      },
      ...expertHistory,
      {
        role: 'user',
        content: `${priorBlock}<task>${escapeXmlValue(directive.task)}</task>\n<context>${escapeXmlValue(directive.context)}</context>\n<constraints>${escapeXmlValue(directive.constraints)}</constraints>${refXml}`,
      },
    ];

    callCount++;
    const expertResult = await provider.chat({
      model: modelId,
      messages: expertMessages,
      temperature: expert.temperature ?? settings.temperature,
      maxTokens: EXPERT_MAX_TOKENS,
      signal,
    });

    expertOutputs.push({
      expert: expert.name,
      content: expertResult.content,
    });
  }

  // Pass 3: Synthesis (streams to UI)
  callbacks.onStatus('Jennifer is finalizing…');

  const truncationNote =
    plan.truncatedCount > 0
      ? `\n<orchestrator_note>${plan.truncatedCount} extra delegation block(s) were omitted because turns are capped at 3 specialists.</orchestrator_note>`
      : '';

  const expertOutputsXml = `<expert_outputs>\n${expertOutputs
    .map((o) =>
      o.content
        ? `<expert name="${escapeXmlAttr(o.expert)}">\n${escapeXmlValue(o.content)}\n</expert>`
        : `<expert name="${escapeXmlAttr(o.expert)}" status="unavailable">${escapeXmlValue(o.error ?? '')}</expert>`
    )
    .join('\n')}${truncationNote}\n</expert_outputs>`;

  const synthesisMessages: ChatCompletionMessage[] = [
    {
      role: 'system',
      content: buildSynthesisPrompt({
        guardrails,
        settings,
        sessionFacts: updatedFacts,
        referencePhoto,
      }),
    },
    ...trimmedHistory,
    { role: 'user', content: userMessage },
    { role: 'user', content: expertOutputsXml },
    {
      role: 'user',
      content:
        'Compose the final answer for the owner using the rules above. Apply the Brand DNA guardrails, preserve any bilingual SV:/EN: pairs, and do not mention internal expert names.',
    },
  ];

  callCount++;
  const synthesisResult = await provider.chat({
    model: modelId,
    messages: synthesisMessages,
    temperature: settings.temperature,
    maxTokens: SYNTHESIS_MAX_TOKENS,
    signal,
    onToken: callbacks.onToken,
  });

  callbacks.onStatus(null);
  return {
    content: synthesisResult.content,
    handoffText,
    delegatedExperts: plannedNames,
    updatedFacts,
    truncatedDelegates: plan.truncatedCount || undefined,
    callCount,
    durationMs: Math.round(performance.now() - startTime),
  };
}
