import {
  DIRECT_CHAT_MAX_TOKENS,
  EXPERT_MAX_TOKENS,
  PLANNER_MAX_TOKENS,
  SYNTHESIS_MAX_TOKENS,
} from '../constants';
import { createProvider } from '../providers';
import { AIError } from '../providers/errors';
import type {
  AppSettings,
  BusinessProfile,
  CampaignPackage,
  ChatCompletionMessage,
  ChatMessage,
  Expert,
  Guardrails,
  SessionFacts,
} from '../types';
import defaultBusinessJson from '../data/business.json';
import {
  detectMessageLanguage,
  extractDeterministicFacts,
  isActionableMarketingRequest,
  mergeSessionFacts,
  resolveExpert,
  trimChatHistory,
  trimExpertHistory,
} from './context';
import { type DelegationDirective, parseDelegation } from './delegation';
import {
  buildDirectTeamPrompt,
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

function isAbortSignalError(err: unknown, signal: AbortSignal): boolean {
  return signal.aborted || (err instanceof DOMException && err.name === 'AbortError');
}

function clampHandoff(text?: string): string | undefined {
  const clean = text?.trim();
  if (!clean) return undefined;
  return clean.slice(0, 1900);
}

function buildFallbackDirectives(
  userMessage: string,
  facts: SessionFacts,
  experts: Expert[],
  detectedLanguage: 'sv' | 'en' | 'unknown',
  businessProfile: BusinessProfile
): { response: string; delegates: DelegationDirective[] } {
  const lower = userMessage.toLowerCase();
  const pick = (name: string) => Boolean(resolveExpert(name, experts));
  const delegates: DelegationDirective[] = [];
  const isSwedish = detectedLanguage === 'sv';

  const hasBudgetOrPricing = /(pricing|roi|price|budget|\d+\s*(?:kr|sek))/i.test(lower);
  const hasAwardsOrSample = /(award|visit sweden|utmärkelse|sample)/i.test(lower);
  const hasEmail = /\b(email|e-?mail|mejl|epost|nyhetsbrev|our list|guest list)\b/i.test(lower);
  const hasShorten = /(shorter|kortare|less poetic|mindre poetisk|tighten|simplify)/i.test(lower);
  const hasWeeklyOrPlan =
    /(what would you actually do|this week|half days?|fte|calendar|content plan|veckoplan|innehållskalender)/i.test(
      lower
    );
  const hasCampaign = /(campaign|kampanj|instagram|facebook|bastu|isbad|sauna|ice bath|winter|vinter)/i.test(
    lower
  );

  const audienceNote = facts.audience?.join('; ') || 'existing guest & inquiry list';
  const pressNote =
    facts.awards?.join('; ') || businessProfile.verifiedPress.join('; ') || 'verified press in business profile';
  const capacityNote = facts.constraints?.join('; ') || 'lean small-team capacity';
  const baselineRateNote =
    businessProfile.defaultRatePerPersonNightSek > 0
      ? `Baseline rate ${businessProfile.defaultRatePerPersonNightSek} SEK/person/night; unit capacity ${businessProfile.unitCapacityGuests} guests.`
      : `Unit capacity ${businessProfile.unitCapacityGuests} guests.`;

  if (hasEmail) {
    if (pick('Copywriter')) {
      delegates.push({
        expert: 'Copywriter',
        task: `Draft a ready-to-send email for ${businessProfile.businessName}'s audience based on: ${userMessage}`,
        context: `Use session facts (${audienceNote}; ${pressNote}). Do not use personal circumstances as marketing copy.`,
        constraints: 'Ready to paste into an email tool, one clear CTA, aurora/weather strictly conditional.',
      });
    }
  } else if (hasShorten) {
    if (pick('Copywriter')) {
      delegates.push({
        expert: 'Copywriter',
        task: `Revise and shorten all prior caption variants per user feedback: ${userMessage}`,
        context: 'See recent messages in conversation history and preserve verified proof points and conditional weather language.',
        constraints: 'Bilingual SV: and EN: pairs, noticeably shorter and less poetic, one CTA each, atmosphere-only visual directions.',
      });
    }
  } else if (hasBudgetOrPricing) {
    if (pick('Marketing Strategist')) {
      delegates.push({
        expert: 'Marketing Strategist',
        task: `Update the campaign plan using the stated budget and constraints: ${userMessage}`,
        context: `Respect team capacity (${capacityNote}) and prioritize owned channels before paid ads.`,
        constraints: 'Ranked channels (owned list first), realistic timeline scaled to owner hours.',
      });
    }
    if (pick('Business & Pricing Analyst')) {
      delegates.push({
        expert: 'Business & Pricing Analyst',
        task: `Calculate break-even booking math and a concrete spend more / stop threshold: ${userMessage}`,
        context: `Budget: ${facts.budget ?? 'stated in user message'}. ${baselineRateNote}`,
        constraints: 'State all assumptions explicitly, show step-by-step arithmetic, give one concrete stop/spend threshold.',
      });
    }
    if (hasAwardsOrSample && pick('Copywriter')) {
      delegates.push({
        expert: 'Copywriter',
        task: `Draft 3 bilingual SV/EN ad variants using verified trust proof: ${userMessage}`,
        context: `Verified press/awards: ${pressNote}. Never invent fake awards; use [INSERT AWARD NAME] only if unnamed.`,
        constraints: 'Bilingual SV: and EN: pairs, one CTA each, atmosphere-only visuals, conditional aurora/weather.',
      });
    }
  } else if (hasAwardsOrSample) {
    if (pick('Copywriter')) {
      delegates.push({
        expert: 'Copywriter',
        task: `Draft 3 bilingual SV/EN variants using verified proof and placeholder if awards are unnamed: ${userMessage}`,
        context: `Use verified press (${pressNote}) and bracket [INSERT AWARD NAME] if awards are unnamed — never invent award names.`,
        constraints: 'Bilingual SV: and EN: pairs, atmosphere-only visual direction, one CTA per variant.',
      });
    }
  } else if (hasWeeklyOrPlan) {
    if (pick('Marketing Strategist')) {
      delegates.push({
        expert: 'Marketing Strategist',
        task: `Create a prioritized action plan for this week within operational constraints: ${userMessage}`,
        context: `Team constraints: ${capacityNote}. Audience: ${audienceNote}. Never use personal circumstances as copy.`,
        constraints: 'Prioritize owned email list #1, organic iPhone social #2, paid ads only after budget clarity.',
      });
    }
    if (pick('Social Media Strategist')) {
      delegates.push({
        expert: 'Social Media Strategist',
        task: 'Create a minimal iPhone-shootable content cadence matching stated owner capacity.',
        context: '1–2 posts/week maximum when capacity is limited; pure atmosphere unless reference photo supplied.',
        constraints: 'Realistic lean cadence, atmosphere-only shoot notes, max 8 hashtags.',
      });
    }
  } else if (hasCampaign) {
    if (pick('Marketing Strategist')) {
      delegates.push({
        expert: 'Marketing Strategist',
        task: `Build a focused campaign plan respecting stated budget and capacity: ${userMessage}`,
        context: `Constraints: ${capacityNote}. Audience: ${audienceNote}.`,
        constraints: 'Zero-budget-first owned channels ranked #1, practical timeline.',
      });
    }
    if (pick('Copywriter')) {
      delegates.push({
        expert: 'Copywriter',
        task: `Draft 3 bilingual SV/EN campaign variants: ${userMessage}`,
        context: `Focus: ${facts.focus ?? businessProfile.offerings.slice(0, 3).join(', ')}. Conditional aurora/weather language only.`,
        constraints: 'Native SV: and EN: pairs, one CTA each, atmosphere-only visual direction.',
      });
    }
    if (pick('Visual Director')) {
      delegates.push({
        expert: 'Visual Director',
        task: 'Create 4 iPhone-shootable atmospheric visual briefs aligned with Brand DNA.',
        context: facts.referencePhoto ? `Confirmed reference: ${facts.referencePhoto}` : 'No reference photo supplied — atmosphere only (no invented structures).',
        constraints: 'Single slow camera move or static frame, one sensory feeling per shot.',
      });
    }
  }

  if (delegates.length === 0) {
    const fallbackExpert = resolveExpert('Copywriter', experts) ?? experts.find((e) => e.enabled);
    if (fallbackExpert) {
      delegates.push({
        expert: fallbackExpert.name,
        task: userMessage,
        context: 'Use pinned session facts, business profile, and Brand DNA guardrails; state assumptions for any missing details.',
        constraints: 'Actionable, ready-to-use output honoring Honesty Rule.',
      });
    }
  }

  const response = isSwedish
    ? 'Jag sätter specialisterna i arbete direkt utifrån er situation och era mål. Ett ögonblick.'
    : 'I’m routing this straight to the right specialists with your constraints and Brand DNA intact. One moment.';

  return { response, delegates: delegates.slice(0, 3) };
}

function assembleFallbackExpertOutput(
  outputs: Array<{ expert: string; content?: string; error?: string }>
): string {
  const sections = outputs
    .filter((o) => Boolean(o.content?.trim()))
    .map((o) => o.content!.trim());
  return sections.join('\n\n---\n\n');
}

export async function runJenniferTurn(params: {
  userMessage: string;
  history: ChatMessage[];
  sessionFacts?: SessionFacts;
  referencePhoto?: string;
  settings: AppSettings;
  guardrails: Guardrails;
  experts: Expert[];
  businessProfile?: BusinessProfile;
  activePackage?: CampaignPackage | null;
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
    businessProfile,
    activePackage,
    signal,
    callbacks,
  } = params;
  const resolvedProfile = businessProfile ?? (defaultBusinessJson as BusinessProfile);
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
  const hasPriorJennifer = history.some((m) => m.role === 'jennifer' && m.status !== 'error');
  const detectedLanguage = detectMessageLanguage(userMessage);
  const allowClarifying = !hasPriorJennifer;

  const runDirectStreaming = async (): Promise<TurnResult> => {
    callbacks.onStatus('Jennifer is writing…');
    const directMessages: ChatCompletionMessage[] = [
      {
        role: 'system',
        content: buildDirectTeamPrompt({
          guardrails,
          experts,
          settings,
          businessProfile: resolvedProfile,
          activePackage,
          sessionFacts: prePlanFacts,
          referencePhoto,
          allowClarifying,
          detectedLanguage,
        }),
      },
      ...trimmedHistory,
      { role: 'user', content: userMessage },
    ];

    callCount++;
    const directRes = await provider.chat({
      model: modelId,
      messages: directMessages,
      temperature: settings.temperature,
      maxTokens: DIRECT_CHAT_MAX_TOKENS,
      signal,
      onToken: callbacks.onToken,
      onRetryWait: (waitMs) =>
        callbacks.onStatus(`Rate-limit pause — resuming in ${Math.ceil(waitMs / 1000)}s…`),
    });

    const content = directRes.content.trim();
    if (!content) {
      throw new AIError({
        code: 'PROVIDER_ERROR',
        message: 'The model returned an empty response. Please try again or pick another model.',
        provider: settings.provider,
      });
    }

    callbacks.onStatus(null);
    return {
      content,
      delegatedExperts: [],
      updatedFacts: prePlanFacts,
      callCount,
      durationMs: Math.round(performance.now() - startTime),
    };
  };

  // Default for live providers: reliable 1-call streaming chat unless Team mode explicitly selected
  const useMultiStep = settings.provider === 'mock' || settings.responseMode === 'team';
  if (!useMultiStep) {
    return runDirectStreaming();
  }

  // Pass 1: Jennifer planning call (internal streaming on live providers to prevent idle proxy timeouts)
  callbacks.onStatus('Jennifer is thinking…');
  const planMessages: ChatCompletionMessage[] = [
    {
      role: 'system',
      content: buildJenniferPrompt({
        guardrails,
        experts,
        settings,
        businessProfile: resolvedProfile,
        activePackage,
        sessionFacts: prePlanFacts,
        referencePhoto,
        allowClarifying,
        detectedLanguage,
      }),
    },
    ...trimmedHistory,
    { role: 'user', content: userMessage },
  ];

  let firstPassContent = '';
  try {
    callCount++;
    const firstPass = await provider.chat({
      model: modelId,
      messages: planMessages,
      temperature: 0.4,
      maxTokens: PLANNER_MAX_TOKENS,
      streamInternal: settings.provider !== 'mock',
      signal,
      onRetryWait: (waitMs) =>
        callbacks.onStatus(`Rate-limit pause — resuming in ${Math.ceil(waitMs / 1000)}s…`),
    });
    firstPassContent = firstPass.content;
  } catch (err) {
    if (isAbortSignalError(err, signal)) throw err;
    if (settings.provider !== 'mock') {
      callbacks.onStatus('Switching to direct response…');
      return runDirectStreaming();
    }
    throw err;
  }

  if (!firstPassContent.trim() && settings.provider !== 'mock') {
    callbacks.onStatus('Switching to direct response…');
    return runDirectStreaming();
  }

  const plan = parseDelegation(firstPassContent);
  if (plan.parseWarn) {
    callbacks.onParseWarn?.(firstPassContent);
  }

  const updatedFacts = mergeSessionFacts(prePlanFacts, plan.facts);

  // Anti-loop safeguard: if Jennifer already replied earlier and the user asked an actionable question/task,
  // never let the model stall in a repeated clarifying-question loop.
  if (plan.delegates.length === 0 && hasPriorJennifer && isActionableMarketingRequest(userMessage)) {
    const fallback = buildFallbackDirectives(
      userMessage,
      updatedFacts,
      experts,
      detectedLanguage,
      resolvedProfile
    );
    if (fallback.delegates.length > 0) {
      plan.response = fallback.response;
      plan.delegates = fallback.delegates;
    }
  }

  // Direct answer (no delegation)
  if (plan.delegates.length === 0) {
    callbacks.onStatus(null);
    const directText = (plan.response || firstPassContent).trim();
    if (!directText) {
      if (settings.provider !== 'mock') {
        return runDirectStreaming();
      }
      throw new AIError({
        code: 'PROVIDER_ERROR',
        message: 'The model returned an empty response.',
        provider: settings.provider,
      });
    }
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
  const handoffText = clampHandoff(plan.response) ?? 'Working on this with your Brand DNA guardrails.';
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
      expertOutputs.some((o) => Boolean(o.content))
        ? `Prior specialist notes in this turn:\n${expertOutputs
            .filter((o) => Boolean(o.content))
            .map((o) => `[${o.expert}]: ${o.content!.slice(0, 1200)}`)
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
          businessProfile: resolvedProfile,
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

    try {
      callCount++;
      const expertResult = await provider.chat({
        model: modelId,
        messages: expertMessages,
        temperature: expert.temperature ?? settings.temperature,
        maxTokens: EXPERT_MAX_TOKENS,
        streamInternal: settings.provider !== 'mock',
        signal,
        onRetryWait: (waitMs) =>
          callbacks.onStatus(
            `${expert.name}: rate-limit pause — resuming in ${Math.ceil(waitMs / 1000)}s…`
          ),
      });

      if (expertResult.content.trim()) {
        expertOutputs.push({
          expert: expert.name,
          content: expertResult.content,
        });
      } else {
        expertOutputs.push({
          expert: expert.name,
          error: `${expert.name} returned an empty response.`,
        });
      }
    } catch (err) {
      if (isAbortSignalError(err, signal)) throw err;
      const msg = err instanceof Error ? err.message : 'Specialist step interrupted';
      expertOutputs.push({
        expert: expert.name,
        error: msg,
      });
      // If an expert got rate-limited/timed out, break early and synthesize what we already have
      if (err instanceof AIError && (err.code === 'RATE_LIMIT' || err.code === 'TIMEOUT')) {
        break;
      }
    }
  }

  const succeededExperts = expertOutputs.filter((o) => Boolean(o.content?.trim()));
  if (succeededExperts.length === 0) {
    if (settings.provider !== 'mock') {
      callbacks.onStatus('Switching to direct response…');
      return runDirectStreaming();
    }
    throw new AIError({
      code: 'PROVIDER_ERROR',
      message: expertOutputs[0]?.error || 'Specialists could not complete this request.',
      provider: settings.provider,
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
        businessProfile: resolvedProfile,
        activePackage,
        sessionFacts: updatedFacts,
        referencePhoto,
        detectedLanguage,
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

  try {
    callCount++;
    const synthesisResult = await provider.chat({
      model: modelId,
      messages: synthesisMessages,
      temperature: settings.temperature,
      maxTokens: SYNTHESIS_MAX_TOKENS,
      signal,
      onToken: callbacks.onToken,
      onRetryWait: (waitMs) =>
        callbacks.onStatus(`Rate-limit pause — finalizing in ${Math.ceil(waitMs / 1000)}s…`),
    });

    const finalContent = synthesisResult.content.trim();
    if (!finalContent) {
      const assembled = assembleFallbackExpertOutput(expertOutputs);
      if (assembled) {
        callbacks.onToken(assembled);
        callbacks.onStatus(null);
        return {
          content: assembled,
          handoffText,
          delegatedExperts: succeededExperts.map((e) => e.expert),
          updatedFacts,
          truncatedDelegates: plan.truncatedCount || undefined,
          callCount,
          durationMs: Math.round(performance.now() - startTime),
        };
      }
    }

    callbacks.onStatus(null);
    return {
      content: finalContent,
      handoffText,
      delegatedExperts: plannedNames,
      updatedFacts,
      truncatedDelegates: plan.truncatedCount || undefined,
      callCount,
      durationMs: Math.round(performance.now() - startTime),
    };
  } catch (err) {
    if (isAbortSignalError(err, signal)) throw err;
    // Preserve partial synthesis OR fall back cleanly to assembled completed expert outputs
    if (err instanceof AIError && err.partialContent?.trim()) {
      throw err;
    }
    const assembled = assembleFallbackExpertOutput(expertOutputs);
    if (assembled && settings.provider !== 'mock') {
      callbacks.onToken(assembled);
      callbacks.onStatus(null);
      return {
        content: assembled,
        handoffText,
        delegatedExperts: succeededExperts.map((e) => e.expert),
        updatedFacts,
        truncatedDelegates: plan.truncatedCount || undefined,
        callCount,
        durationMs: Math.round(performance.now() - startTime),
      };
    }
    throw err;
  }
}
