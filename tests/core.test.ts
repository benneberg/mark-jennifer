import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DIRECT_CHAT_MAX_TOKENS,
  EXPERT_MAX_TOKENS,
  HISTORY_MAX_EXPERT_MESSAGES,
  MAX_DELEGATES_PER_TURN,
  PLANNER_MAX_TOKENS,
  SYNTHESIS_MAX_TOKENS,
} from '../src/constants.ts';
import { createSeedExperts } from '../src/data/seed-experts.ts';
import { createSeedGuardrails } from '../src/data/seed-guardrails.ts';
import {
  extractDeterministicFacts,
  mergeSessionFacts,
  trimExpertHistory,
} from '../src/orchestration/context.ts';
import { parseDelegation } from '../src/orchestration/delegation.ts';
import { runJenniferTurn } from '../src/orchestration/jennifer.ts';
import {
  buildExpertPrompt,
  buildJenniferPrompt,
  buildSessionFactsBlock,
  buildSynthesisPrompt,
} from '../src/orchestration/prompts.ts';
import { AIError, humanizeAIError } from '../src/providers/errors.ts';
import { MockProvider } from '../src/providers/mock.ts';
import type { AppSettings, ChatMessage } from '../src/types.ts';
import {
  CHAT_SCHEMA,
  EXPERT_SCHEMA,
  GUARDRAILS_SCHEMA,
  MESSAGE_SCHEMA,
  validateSchema,
} from '../src/utils/validate.ts';

test('seed experts and guardrails validate against schemas and carry unique routing markers', () => {
  const experts = createSeedExperts();
  assert.equal(experts.length, 6);
  const markers = new Set<string>();
  for (const exp of experts) {
    const res = validateSchema(exp, EXPERT_SCHEMA);
    assert.equal(res.valid, true, `Expert ${exp.name} failed validation: ${JSON.stringify(res.errors)}`);
    const match = exp.systemPrompt.match(/<!--\s*expert:([a-z-]+)\s*-->/);
    assert.ok(match, `Expert ${exp.name} is missing unique marker comment`);
    assert.equal(markers.has(match[1]), false, `Duplicate marker ${match[1]}`);
    markers.add(match[1]);
  }

  const guardrails = createSeedGuardrails();
  const gRes = validateSchema(guardrails, GUARDRAILS_SCHEMA);
  assert.equal(gRes.valid, true, `Guardrails failed validation: ${JSON.stringify(gRes.errors)}`);
});

test('validateSchema catches missing required fields and supports CHAT_SCHEMA & MESSAGE_SCHEMA extensions', () => {
  const invalidRes = validateSchema({ name: '' }, EXPERT_SCHEMA);
  assert.equal(invalidRes.valid, false);
  assert.ok(invalidRes.errors.length > 0);

  const chatRes = validateSchema(
    {
      id: '11111111-1111-4111-8111-111111111111',
      title: 'Winter campaign',
      createdAt: '2026-11-24T12:00:00.000Z',
      updatedAt: '2026-11-24T12:05:00.000Z',
      sessionFacts: {
        constraints: ['1.5 FTE'],
        audience: ['200 previous guests'],
        budget: '3000 SEK max ad spend',
        awards: ['Visit Sweden hidden island escapes'],
      },
    },
    CHAT_SCHEMA
  );
  assert.equal(chatRes.valid, true, JSON.stringify(chatRes.errors));

  const msgRes = validateSchema(
    {
      id: '22222222-2222-4222-8222-222222222222',
      chatId: '11111111-1111-4111-8111-111111111111',
      role: 'jennifer',
      content: 'Draft ready.',
      handoffText: undefined,
      delegatedExperts: ['Copywriter'],
      timestamp: '2026-11-24T12:05:00.000Z',
      status: 'complete',
      savedToLibrary: false,
      turnId: '33333333-3333-4333-8333-333333333333',
    },
    MESSAGE_SCHEMA
  );
  assert.equal(msgRes.valid, true, JSON.stringify(msgRes.errors));
});

test('parseDelegation handles prose fallback gracefully and strips stray control blocks', () => {
  const plan = parseDelegation('Hej! Just a direct prose reply without tags.');
  assert.equal(plan.parseWarn, true);
  assert.equal(plan.delegates.length, 0);
  assert.ok(plan.response.includes('direct prose reply'));

  const brokenXml =
    '<response>Quick reply</response><delegate expert="Copywriter"><task>Unclosed';
  const brokenPlan = parseDelegation(brokenXml);
  assert.equal(brokenPlan.response, 'Quick reply');
  assert.equal(brokenPlan.delegates.length, 0);
});

test('parseDelegation caps delegates at MAX_DELEGATES_PER_TURN and extracts <facts>', () => {
  const raw = `<response>Working across specialists.</response>
<delegate expert="Marketing Strategist"><task>Plan budget &lt; 3000 kr</task><context>A</context><constraints>B</constraints></delegate>
<delegate expert="Copywriter"><task>Draft SV & EN copy</task><context>A</context><constraints>B</constraints></delegate>
<delegate expert="Business &amp; Pricing Analyst"><task>ROI</task><context>A</context><constraints>B</constraints></delegate>
<delegate expert="Visual Director"><task>Shots</task><context>A</context><constraints>B</constraints></delegate>
<facts>
  <budget>3000 SEK</budget>
  <awards>Visit Sweden hidden island escapes; Eco Award</awards>
</facts>`;

  const plan = parseDelegation(raw);
  assert.equal(plan.parseWarn, false);
  assert.equal(plan.delegates.length, MAX_DELEGATES_PER_TURN);
  assert.equal(plan.truncatedCount, 1);
  assert.equal(plan.delegates[0].task, 'Plan budget < 3000 kr');
  assert.equal(plan.facts?.budget, '3000 SEK');
  assert.deepEqual(plan.facts?.awards, ['Visit Sweden hidden island escapes', 'Eco Award']);
});

test('extractDeterministicFacts and mergeSessionFacts retain generic business facts without leaking personal health details', () => {
  const turn2Patch = extractDeterministicFacts(
    "Just us two running this, working half days recovering from hospital and we have a 5 month old baby. We don't have much money for ads, maybe Instagram + our list of 200 previous guests and 100+ inquiries."
  );
  const afterTurn2 = mergeSessionFacts(undefined, turn2Patch);
  assert.ok(afterTurn2.constraints?.some((c) => /limited owner capacity/i.test(c)));
  assert.ok(!JSON.stringify(afterTurn2).toLowerCase().includes('hospital'));
  assert.ok(!JSON.stringify(afterTurn2).toLowerCase().includes('baby'));
  assert.ok(afterTurn2.audience?.some((a) => a.includes('200 previous guests')));
  assert.ok(afterTurn2.audience?.some((a) => a.includes('100+')));

  const turn4Patch = extractDeterministicFacts(
    'Max 3000 kr in ad spend. We won Best Micro Stay.',
    'Wide shot of our floating AuroraHut on snow-covered lake at blue hour'
  );
  const afterTurn4 = mergeSessionFacts(afterTurn2, turn4Patch);
  assert.equal(afterTurn4.budget, '3000 SEK max ad spend');
  assert.ok(afterTurn4.awards?.some((a) => a.includes('Best Micro Stay')));
  assert.ok(afterTurn4.referencePhoto?.includes('AuroraHut'));

  const clearedPatch = extractDeterministicFacts('Make captions shorter', '');
  const afterTurn5 = mergeSessionFacts(afterTurn4, clearedPatch);
  assert.equal(afterTurn5.referencePhoto, undefined);
  assert.equal(afterTurn5.budget, '3000 SEK max ad spend');
});

test('trimExpertHistory bounds expert history to HISTORY_MAX_EXPERT_MESSAGES', () => {
  const msgs: ChatMessage[] = Array.from({ length: 12 }, (_, idx) => ({
    id: `00000000-0000-4000-8000-${String(idx + 1).padStart(12, '0')}`,
    chatId: '11111111-1111-4111-8111-111111111111',
    role: idx % 2 === 0 ? 'user' : 'jennifer',
    content: `Message ${idx + 1}`,
    timestamp: '2026-11-24T12:00:00.000Z',
    status: 'complete',
  }));
  const trimmed = trimExpertHistory(msgs);
  assert.equal(trimmed.length, HISTORY_MAX_EXPERT_MESSAGES);
  assert.equal(trimmed[0].content, 'Message 11');
  assert.equal(trimmed[trimmed.length - 1].content, 'Message 12');
});

test('prompts enforce sensitivity rules, bilingual SV/EN preservation, and session facts injection', () => {
  const guardrails = createSeedGuardrails();
  const experts = createSeedExperts();
  const settings: AppSettings = {
    provider: 'mock',
    model: 'hedetangen-demo-v1',
    temperature: 0.5,
    language: 'auto',
    machinePrompt: '',
    theme: 'light',
    rememberKey: false,
    strictMode: false,
    debug: false,
  };
  const facts = { budget: '3000 SEK max ad spend', referencePhoto: 'Lantern on frozen dock' };

  const jPrompt = buildJenniferPrompt({ guardrails, experts, settings, sessionFacts: facts, referencePhoto: '' });
  assert.ok(jPrompt.includes('<tone_and_sensitivity>'));
  assert.ok(jPrompt.includes('NEVER address or greet the user as "Jennifer"'));
  assert.ok(!jPrompt.includes('<confirmed_reference>Lantern on frozen dock</confirmed_reference>'));

  const sPrompt = buildSynthesisPrompt({ guardrails, settings, sessionFacts: facts });
  assert.ok(
    sPrompt.replace(/\s+/g, ' ').includes("preserve BOTH languages regardless of the 'auto' language setting")
  );
  assert.ok(sPrompt.includes('<confirmed_reference>Lantern on frozen dock</confirmed_reference>'));

  const emptyBlock = buildSessionFactsBlock({ referencePhoto: 'Old photo' }, '');
  assert.equal(emptyBlock, '');
});

test('MockProvider routes Strategist cleanly without colliding with Analyst and handles Swedish + stages', async () => {
  const provider = new MockProvider();
  const experts = createSeedExperts();
  const guardrails = createSeedGuardrails();
  const settings: AppSettings = {
    provider: 'mock',
    model: 'hedetangen-demo-v1',
    temperature: 0.5,
    language: 'auto',
    machinePrompt: '',
    theme: 'light',
    rememberKey: false,
    strictMode: false,
    debug: false,
  };

  assert.equal(PLANNER_MAX_TOKENS, 750);
  assert.equal(EXPERT_MAX_TOKENS, 1200);
  assert.equal(SYNTHESIS_MAX_TOKENS, 2400);
  assert.equal(DIRECT_CHAT_MAX_TOKENS, 3200);

  // Underspecified Turn 1 should ask a clarifying question directly (1 call)
  const turn1 = await runJenniferTurn({
    userMessage: 'we really need bookings for the winter, like now. what can you do',
    history: [],
    settings,
    guardrails,
    experts,
    signal: new AbortController().signal,
    callbacks: {
      onStatus: () => {},
      onHandoff: () => {},
      onExpertActive: () => {},
      onToken: () => {},
    },
  });
  assert.equal(turn1.callCount, 1);
  assert.equal(turn1.delegatedExperts.length, 0);

  // Swedish Turn 3 should trigger campaign experts (not pricing/analyst) & preserve bilingual SV/EN
  const turn3 = await runJenniferTurn({
    userMessage: 'Vi behöver en kampanj för bastu och isbad i vinter, vi har inte så mycket pengar',
    history: [],
    sessionFacts: { audience: ['200 previous guests'], constraints: ['1.5 FTE'] },
    settings,
    guardrails,
    experts,
    signal: new AbortController().signal,
    callbacks: {
      onStatus: () => {},
      onHandoff: () => {},
      onExpertActive: () => {},
      onToken: () => {},
    },
  });
  assert.ok(turn3.delegatedExperts.includes('Marketing Strategist'));
  assert.ok(turn3.delegatedExperts.includes('Copywriter'));
  assert.ok(!turn3.delegatedExperts.includes('Business & Pricing Analyst'));
  assert.ok(turn3.content.includes('SV:') && turn3.content.includes('EN:'));
  assert.ok(!turn3.content.includes('1750 SEK/person = 7000 SEK'));

  // Test Strategist prompt doesn't accidentally match Business & Pricing Analyst inside MockProvider
  const strategist = experts.find((e) => e.name === 'Marketing Strategist')!;
  const strategistRes = await provider.chat({
    model: 'hedetangen-demo-v1',
    messages: [
      { role: 'system', content: buildExpertPrompt({ expert: strategist, guardrails, settings }) },
      { role: 'user', content: '<task>Plan winter channels</task>' },
    ],
  });
  assert.ok(strategistRes.content.includes('CHANNEL MIX:'));
});

test('humanizeAIError maps RATE_LIMIT with alternative model action and parses Groq retry-after text', () => {
  const err = new AIError({
    code: 'RATE_LIMIT',
    message: 'Too many requests',
    provider: 'groq',
    status: 429,
    retryAfterMs: 12000,
  });
  const h = humanizeAIError(err, {
    modelId: 'llama-3.3-70b-versatile',
    altModelId: 'llama-3.1-8b-instant',
  });
  assert.ok(h.message.includes('rate-limited'));
  assert.ok(h.actions.some((a) => a.type === 'try_alt_model' && a.altModelId === 'llama-3.1-8b-instant'));
});

test('detectMessageLanguage identifies Turn 3 Swedish and disables repeat clarifying loops', async () => {
  const { detectMessageLanguage } = await import('../src/orchestration/context.ts');
  const { mapHttpError } = await import('../src/providers/errors.ts');

  assert.equal(
    detectMessageLanguage(
      'Kan vi göra en kampanj på Instagram för vintern? Fokus på bastu och isbad. Vi har inte så mycket pengar till annonser just nu.'
    ),
    'sv'
  );
  assert.equal(
    detectMessageLanguage('ok now write the email version for our list'),
    'en'
  );

  const experts = createSeedExperts();
  const guardrails = createSeedGuardrails();
  const settings: AppSettings = {
    provider: 'mock',
    model: 'hedetangen-demo-v1',
    temperature: 0.5,
    language: 'auto',
    machinePrompt: '',
    theme: 'light',
    rememberKey: false,
    strictMode: false,
    debug: false,
  };

  const svPrompt = buildJenniferPrompt({
    guardrails,
    experts,
    settings,
    allowClarifying: false,
    detectedLanguage: 'sv',
  });
  assert.ok(svPrompt.includes('CLARIFYING QUESTIONS ARE DISABLED FOR THIS TURN'));
  assert.ok(svPrompt.includes('SWEDISH'));

  // Simulate Turn 2 with prior Jennifer turn in history so Turn 2 always delegates rather than stalling
  const priorHistory: ChatMessage[] = [
    {
      id: '00000000-0000-4000-8000-000000000001',
      chatId: '11111111-1111-4111-8111-111111111111',
      role: 'user',
      content: 'we really need bookings for the winter, like now. what can you do',
      timestamp: '2026-11-24T12:00:00.000Z',
      status: 'complete',
    },
    {
      id: '00000000-0000-4000-8000-000000000002',
      chatId: '11111111-1111-4111-8111-111111111111',
      role: 'jennifer',
      content: 'Could you share your budget and preferred channels?',
      timestamp: '2026-11-24T12:00:10.000Z',
      status: 'complete',
    },
  ];
  const turn2 = await runJenniferTurn({
    userMessage:
      'ok so, its just us two running this. we have a 5 month old baby and i just got back from hospital so im only working half days. we have 200 previous guests. what would you actually do this week',
    history: priorHistory,
    settings,
    guardrails,
    experts,
    signal: new AbortController().signal,
    callbacks: {
      onStatus: () => {},
      onHandoff: () => {},
      onExpertActive: () => {},
      onToken: () => {},
    },
  });
  assert.ok(turn2.delegatedExperts.length >= 1, 'Turn 2 must delegate when Turn 1 already clarified');

  const groq429 = mapHttpError(
    'groq',
    429,
    JSON.stringify({
      error: { message: 'Rate limit reached for model llama-3.3-70b-versatile. Please try again in 4.32s.' },
    }),
    null
  );
  assert.equal(groq429.code, 'RATE_LIMIT');
  assert.equal(groq429.retryAfterMs, 4320);
});

test('runOpenAICompatibleChat preserves partialContent on mid-stream SSE error and handles clean user aborts', async () => {
  const { runOpenAICompatibleChat, fetchWithTimeout } = await import('../src/providers/base.ts');

  // 1. User abort must throw AbortError (not NETWORK) even when signal is already aborted
  const abortedCtrl = new AbortController();
  abortedCtrl.abort();
  await assert.rejects(
    () => fetchWithTimeout('groq', 'https://example.invalid', { method: 'GET' }, abortedCtrl.signal),
    (err: unknown) => err instanceof DOMException && err.name === 'AbortError'
  );

  // 2. Mid-stream CRLF SSE chunks followed by mid-stream SSE error preserves partialContent
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = (async () => {
      const encoder = new TextEncoder();
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(
            encoder.encode(
              'data: {"choices":[{"delta":{"content":"Hello "}}]}\r\n\r\n' +
                'data: {"choices":[{"delta":{"content":"from Hedetangen"}}]}\r\n\r\n'
            )
          );
          controller.enqueue(
            encoder.encode('data: {"error":{"message":"Upstream stream interrupted","code":503}}\r\n\r\n')
          );
          controller.close();
        },
      });
      return new Response(stream, {
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
      });
    }) as typeof fetch;

    const streamedChunks: string[] = [];
    await assert.rejects(
      () =>
        runOpenAICompatibleChat(
          'openrouter',
          'https://example.test/v1',
          { Authorization: 'Bearer test' },
          {
            model: 'test-model',
            messages: [{ role: 'user', content: 'hi' }],
            onToken: (d) => streamedChunks.push(d),
          }
        ),
      (err: unknown) =>
        err instanceof AIError &&
        err.code === 'PROVIDER_ERROR' &&
        err.partialContent === 'Hello from Hedetangen'
    );
    assert.equal(streamedChunks.join(''), 'Hello from Hedetangen');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('buildDirectTeamPrompt includes Brand DNA, active experts, and SV/EN copy preservation', async () => {
  const { buildDirectTeamPrompt } = await import('../src/orchestration/prompts.ts');
  const guardrails = createSeedGuardrails();
  const experts = createSeedExperts();
  const settings: AppSettings = {
    provider: 'groq',
    model: 'llama-3.3-70b-versatile',
    temperature: 0.7,
    language: 'auto',
    machinePrompt: '',
    theme: 'light',
    rememberKey: true,
    strictMode: true,
    debug: false,
    responseMode: 'direct',
  };

  const prompt = buildDirectTeamPrompt({
    guardrails,
    experts,
    settings,
    sessionFacts: { budget: '3000 SEK max ad spend' },
    allowClarifying: false,
    detectedLanguage: 'sv',
  });
  assert.ok(prompt.includes('<honesty_rule>'));
  assert.ok(prompt.includes('Copywriter:'));
  assert.ok(prompt.includes('3000 SEK max ad spend'));
  assert.ok(prompt.includes('SV:'));
  assert.ok(prompt.includes('CLARIFYING QUESTIONS ARE DISABLED FOR THIS TURN'));
});

test('BusinessProfile defaults validate against BUSINESS_PROFILE_SCHEMA', async () => {
  const { getDefaultBusinessProfile } = await import('../src/storage/entities.ts');
  const { BUSINESS_PROFILE_SCHEMA } = await import('../src/utils/validate.ts');
  const profile = getDefaultBusinessProfile();
  const res = validateSchema(profile, BUSINESS_PROFILE_SCHEMA);
  assert.equal(res.valid, true, JSON.stringify(res.errors));
  assert.equal(profile.businessName, 'Hedetangen');
  assert.ok(profile.offerings.length >= 2);
});

test('lintCampaignOutput flags invented structures, weather guarantees, and unapproved discounts/prices cleanly', async () => {
  const { lintCampaignOutput } = await import('../src/campaign/honestyLint.ts');
  const { getDefaultBusinessProfile } = await import('../src/storage/entities.ts');
  const profile = getDefaultBusinessProfile();

  const baseIntake = {
    goal: 'Bookings',
    audiences: ["Couples' reset"],
    language: 'en' as const,
    channels: ['Instagram', 'Email'],
    deliverables: ['video' as const],
    dateWindow: 'Jan–Feb 2027',
    openNightsOrCapacity: '12 nights',
    coreOffer: 'Sauna and overnight stay',
    budgetCeiling: '0 SEK',
    hoursPerWeek: '3–5 hrs/week',
  };

  // 1. Invented structure without reference photo + weather guarantee + invented discount
  const badIssues = lintCampaignOutput({
    kind: 'video',
    markdown:
      'Wide shot of our floating AuroraHut and dock. Guaranteed northern lights every night! Book now for 20% off or 999 SEK.',
    intake: baseIntake,
    businessProfile: profile,
  });
  assert.ok(badIssues.some((i) => i.code === 'INVENTED_STRUCTURE'));
  assert.ok(badIssues.some((i) => i.code === 'WEATHER_GUARANTEE'));
  assert.ok(badIssues.some((i) => i.code === 'UNSUPPLIED_PRICE_OR_DISCOUNT'));

  // 2. Clean atmosphere-only + supplied 1750 SEK + negated instruction passes cleanly
  const cleanIssues = lintCampaignOutput({
    kind: 'video',
    markdown:
      'Steam rises across dark winter water (no buildings or huts shown). Standard stay from 1750 SEK per person on clear nights.',
    intake: { ...baseIntake, priceAnchor: '1750 SEK per person / night' },
    businessProfile: profile,
  });
  assert.equal(cleanIssues.length, 0, JSON.stringify(cleanIssues));

  // 3. Structure words allowed when reference photo explicitly provided
  const withPhotoIssues = lintCampaignOutput({
    kind: 'video',
    markdown: 'Slow zoom into our floating AuroraHut from the confirmed reference photo.',
    intake: { ...baseIntake, referencePhoto: 'Wide shot of AuroraHut at blue hour' },
    businessProfile: profile,
  });
  assert.equal(
    withPhotoIssues.some((i) => i.code === 'INVENTED_STRUCTURE'),
    false
  );
});

test('generateCampaignPackage builds valid CampaignPackage, validates schema, and exports .ics + .zip', async () => {
  const { generateCampaignPackage } = await import('../src/campaign/engine.ts');
  const { buildCompletePackageZip, calendarToICS, extractCalendarItems } = await import(
    '../src/campaign/exportPackage.ts'
  );
  const { getDefaultBusinessProfile } = await import('../src/storage/entities.ts');
  const { CAMPAIGN_PACKAGE_SCHEMA } = await import('../src/utils/validate.ts');

  const guardrails = createSeedGuardrails();
  const profile = getDefaultBusinessProfile();
  const settings: AppSettings = {
    provider: 'mock',
    model: 'hedetangen-demo-v1',
    temperature: 0.3,
    language: 'bilingual',
    machinePrompt: '',
    theme: 'light',
    rememberKey: false,
    strictMode: true,
    debug: false,
  };

  const pkg = await generateCampaignPackage({
    intake: {
      goal: 'Bookings',
      audiences: ['Past guests & warm inquiries'],
      language: 'bilingual',
      channels: ['Email', 'Instagram'],
      deliverables: ['social', 'email', 'calendar', 'video'],
      dateWindow: 'Next 6 weeks',
      openNightsOrCapacity: '10 weekend nights',
      coreOffer: 'Wood-fired sauna, cold lake plunge & private overnight stay',
      priceAnchor: '1750 SEK per person / night',
      budgetCeiling: '0 SEK (owned channels only)',
      hoursPerWeek: '3–5 hrs/week',
    },
    settings,
    guardrails,
    businessProfile: profile,
    signal: new AbortController().signal,
  });

  const pkgValidation = validateSchema(pkg, CAMPAIGN_PACKAGE_SCHEMA);
  assert.equal(pkgValidation.valid, true, JSON.stringify(pkgValidation.errors));
  assert.equal(pkg.deliverables.length, 4);
  assert.ok(pkg.checklist.length >= 3);
  assert.equal(pkg.lintSummary.passed, true, JSON.stringify(pkg.deliverables.map((d) => d.lintIssues)));

  const calItems = extractCalendarItems(pkg.deliverables);
  assert.ok(calItems.length >= 1);
  const ics = calendarToICS(calItems, pkg.name);
  assert.ok(ics.includes('BEGIN:VCALENDAR') && ics.includes('BEGIN:VEVENT'));

  const zip = buildCompletePackageZip(pkg, profile);
  assert.ok(zip.filename.endsWith('-package.zip'));
  // PK\x03\x04 local file header magic bytes
  assert.equal(zip.bytes[0], 0x50);
  assert.equal(zip.bytes[1], 0x4b);
  assert.equal(zip.bytes[2], 0x03);
  assert.equal(zip.bytes[3], 0x04);
});

test('runOpenAICompatibleChat retries without response_format if provider returns HTTP 400', async () => {
  const { runOpenAICompatibleChat } = await import('../src/providers/base.ts');
  const originalFetch = globalThis.fetch;
  let calls = 0;

  try {
    globalThis.fetch = (async (_url: RequestInfo | URL, init?: RequestInit) => {
      calls += 1;
      const body = JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>;
      if (calls === 1) {
        assert.deepEqual(body.response_format, { type: 'json_object' });
        return new Response(
          JSON.stringify({ error: { message: 'response_format json_object is not supported' } }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }
      assert.equal(body.response_format, undefined);
      return new Response(
        JSON.stringify({
          choices: [{ message: { content: '{"ok":true}' }, finish_reason: 'stop' }],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }) as typeof fetch;

    const res = await runOpenAICompatibleChat(
      'groq',
      'https://example.test/v1',
      { Authorization: 'Bearer test' },
      {
        model: 'test-model',
        messages: [{ role: 'user', content: 'Return JSON' }],
        responseFormat: 'json_object',
      }
    );
    assert.equal(calls, 2);
    assert.equal(res.content, '{"ok":true}');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('detectCampaignIntent detects booking requests and pre-fills intake safely', async () => {
  const { detectCampaignIntent } = await import('../src/orchestration/router.ts');
  const { getDefaultBusinessProfile } = await import('../src/storage/entities.ts');
  const profile = getDefaultBusinessProfile();

  const hit = detectCampaignIntent(
    'We need bookings for winter sauna stays, max 3000 kr budget, Instagram and email list',
    profile
  );
  assert.ok(hit);
  assert.equal(hit.prefill.goal, 'Bookings');
  assert.equal(hit.prefill.budgetCeiling, '3000 SEK');
  assert.ok(hit.prefill.channels?.includes('Email'));
  assert.ok(hit.prefill.channels?.includes('Instagram'));

  const miss = detectCampaignIntent('Can you rewrite that caption shorter?', profile);
  assert.equal(miss, null);
});




