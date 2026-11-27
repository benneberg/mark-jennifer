import type { ChatResult, ModelInfo } from '../types';
import type { AIProvider, ChatRequestOptions } from './base';

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Aborted', 'AbortError'));
      return;
    }
    const timer = globalThis.setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      globalThis.clearTimeout(timer);
      reject(new DOMException('Aborted', 'AbortError'));
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

async function streamText(
  text: string,
  onToken: ((delta: string) => void) | undefined,
  signal?: AbortSignal
): Promise<void> {
  if (!onToken) return;
  const words = text.split(/(\s+)/);
  for (let i = 0; i < words.length; i++) {
    if (signal?.aborted) {
      throw new DOMException('Aborted', 'AbortError');
    }
    onToken(words[i]);
    if (i % 4 === 0) {
      await sleep(16, signal);
    }
  }
}

export class MockProvider implements AIProvider {
  readonly id = 'mock' as const;

  async validateKey(): Promise<boolean> {
    return true;
  }

  async listModels(): Promise<ModelInfo[]> {
    return [
      {
        id: 'hedetangen-demo-v1',
        name: 'Hedetangen Demo Model (Offline)',
        contextWindow: 128000,
        free: true,
        bestFor: ['demo', 'captions', 'strategy'],
        providerNotes: 'Simulated responses grounded in Hedetangen Brand DNA v4.',
      },
    ];
  }

  async chat(options: ChatRequestOptions): Promise<ChatResult> {
    const sys = options.messages.find((m) => m.role === 'system')?.content ?? '';
    const lastUser = [...options.messages].reverse().find((m) => m.role === 'user')?.content ?? '';
    const lowerUser = lastUser.toLowerCase();

    await sleep(options.responseFormat === 'json_object' ? 140 : 280, options.signal);

    // Structured JSON Campaign Engine steps
    if (options.responseFormat === 'json_object') {
      const jsonContent = this.structuredJsonResponse(sys, lastUser);
      return { content: jsonContent, model: options.model || 'hedetangen-demo-v1', finishReason: 'stop' };
    }

    // Prefer the explicit stage from the orchestrator; fall back to sniffing the
    // prompt for older callers/tests.
    const stage =
      options.stage ??
      (sys.includes('<delegation_protocol>')
        ? 'planner'
        : sys.includes('<handoff>')
          ? 'expert'
          : 'synthesis');

    // Stage 1: Jennifer orchestration planner
    if (stage === 'planner') {
      const hasHistory = options.messages.some((m) => m.role === 'assistant');
      const content = this.planResponse(lowerUser, lastUser, sys, hasHistory);
      return { content, model: options.model || 'hedetangen-demo-v1', finishReason: 'stop' };
    }

    // Stage 2: Specialist expert execution
    if (stage === 'expert') {
      const content = this.expertResponse(sys, lowerUser, lastUser);
      return { content, model: options.model || 'hedetangen-demo-v1', finishReason: 'stop' };
    }

    // Stage 3/4: Jennifer synthesis or direct answer (streams to UI)
    const expertOutputsBlock =
      options.messages.find((m) => m.content.includes('<expert_outputs>'))?.content ?? '';
    const synthesized = this.synthesizeResponse(expertOutputsBlock, lowerUser, sys);
    await streamText(synthesized, options.onToken, options.signal);
    return { content: synthesized, model: options.model || 'hedetangen-demo-v1', finishReason: 'stop' };
  }

  private structuredJsonResponse(sys: string, userPrompt: string): string {
    const schemaMatch = `${sys}\n${userPrompt}`.match(/"schema_type"\s*:\s*"([a-z]+)"/i);
    const schemaType = schemaMatch?.[1]?.toLowerCase() ?? 'strategy';

    const offerMatch = userPrompt.match(/coreOffer["']?\s*:\s*"([^"]+)"/i);
    const windowMatch = userPrompt.match(/dateWindow["']?\s*:\s*"([^"]+)"/i);
    const budgetMatch = userPrompt.match(/budgetCeiling["']?\s*:\s*"([^"]+)"/i);
    const hoursMatch = userPrompt.match(/hoursPerWeek["']?\s*:\s*"([^"]+)"/i);
    const refMatch = userPrompt.match(/referencePhoto["']?\s*:\s*"([^"]*)"/i);

    const coreOffer = offerMatch?.[1] || 'Wood-fired sauna and cold-lake stay';
    const dateWindow = windowMatch?.[1] || 'Upcoming 4-week window';
    const budgetCeiling = budgetMatch?.[1] || '0 SEK (owned channels only)';
    const hoursPerWeek = hoursMatch?.[1] || '4–6 hrs/week';
    const hasRef = Boolean(refMatch?.[1]?.trim());

    if (schemaType === 'strategy') {
      return JSON.stringify({
        headline: `${coreOffer} — Lean Direct-Booking Plan (${dateWindow})`,
        positioning:
          'Lead with sensory warmth and unhurried nature rather than luxury clichés. Prioritize owned guest relationships first, then low-effort authentic social.',
        rankedChannels: [
          {
            channel: 'Email',
            priority: 1,
            rationale: 'Warmest audience with zero media spend and immediate booking intent.',
          },
          {
            channel: 'Instagram',
            priority: 2,
            rationale: 'Atmospheric reels and carousels shot in one afternoon on an iPhone.',
          },
          {
            channel: 'Website',
            priority: 3,
            rationale: 'Clear seasonal dates, sauna/ice-bath offer details, and direct booking link.',
          },
        ],
        phases: [
          {
            title: 'Phase 1: Owned Outreach & Booking Page Check',
            timing: 'Days 1–3',
            tasks: [
              'Confirm open nights on the booking calendar and verify booking link works on mobile',
              'Send direct email invite to past guests and prior inquiries',
              'Capture 4 short atmospheric iPhone clips in one 45-minute session',
            ],
          },
          {
            title: 'Phase 2: Organic Cadence & Proof',
            timing: 'Weeks 1–2',
            tasks: [
              'Publish Instagram Post 1 (SV/EN) highlighting warmth and lake stillness',
              'Publish Instagram Post 2 with verified Visit Sweden press line',
              'Check direct booking inquiries after 7 days before spending any ad budget',
            ],
          },
        ],
        assumptions: [
          `Owner workload capped at ${hoursPerWeek}`,
          `Budget ceiling: ${budgetCeiling}`,
          'Weather, snow, ice, and northern lights remain conditional and never promised',
        ],
        risks: [
          'Weather variability may affect ice/aurora expectations — keep copy conditional',
          'Limited capacity requires answering booking inquiries promptly on open days',
        ],
        stopSpendThreshold:
          'Do not activate paid ads unless owned email outreach leaves open target nights; if running paid ads, pause at 50% of budget if cost per qualified inquiry exceeds expectations.',
      });
    }

    if (schemaType === 'social') {
      return JSON.stringify({
        posts: [
          {
            platform: 'Instagram',
            format: 'Reel',
            hook: 'Bastu och frostig sjöluft. / Wood-fired warmth against crisp lake air.',
            bodySv:
              'Vedeldad bastu vid vattnet, tystnad i skogen och ett lugnt andetag långt bort från vardagen. Klara vinterkvällar visar sig ibland norrskenet ovanför trädtopparna.',
            bodyEn:
              'Wood-fired sauna warmth by the lake, quiet forest air, and time to slow down. On clear nights, northern lights sometimes appear above the treeline.',
            ctaSv: 'Se lediga datum på hedetangen.com',
            ctaEn: 'View open dates at hedetangen.com',
            hashtags: ['#hedetangen', '#värmland', '#bastu', '#slowtravel', '#unlockyoursenses'],
            visualDirection: hasRef
              ? `Frame anchored to confirmed reference (${refMatch?.[1]}), single slow camera move in soft natural light.`
              : 'Close-up of steam rising off warm birch embers and dark water ripples at blue hour (atmosphere only, no structures).',
          },
          {
            platform: 'Instagram',
            format: 'Carousel',
            hook: 'Två platser. En stilla kväll. / Two spots. One quiet night.',
            bodySv:
              'Enkelt, varmt och stilla — bastu och kallt dopp i egen takt i Värmland. Uppmärksammad av Visit Sweden som en av Sveriges nio "hidden island escapes".',
            bodyEn:
              'Simple, warm, unhurried — sauna and cold water at your own pace in Värmland. Featured by Visit Sweden as one of Sweden\'s nine "hidden island escapes."',
            ctaSv: 'Boka din vistelse via länken',
            ctaEn: 'Reserve your stay via link',
            hashtags: ['#hedetangen', '#värmland', '#swedishnature', '#winterreset'],
            visualDirection:
              'Three static tactile frames: frosted pine needles, lantern light on dark lake stones, hands lifting a stoneware mug (atmosphere only).',
          },
        ],
      });
    }

    if (schemaType === 'email') {
      return JSON.stringify({
        subjectSv: 'Varm vedeldad bastu och lugna nätter vid sjön — lediga datum',
        subjectEn: 'Wood-fired sauna and quiet nights by the lake — open dates',
        previewText: `${coreOffer} · ${dateWindow}`,
        bodySv:
          'Hej!\n\nVi öppnar nu några lugna datum vid sjön för er som längtar efter vedeldad bastu, krispig luft och stillhet i Värmland. Under klara kvällar öppnar sig stjärnhimlen över vattnet — och ibland även norrskenet.\n\nUppmärksammad av Visit Sweden som en av Sveriges nio "hidden island escapes". Hör gärna av er om ett datum passar er.',
        bodyEn:
          'Hello again,\n\nWe are opening a small set of quiet nights by the lake for guests seeking wood-fired sauna warmth, crisp air, and unhurried stillness in Värmland. On clear evenings the sky opens wide above the water — with northern lights appearing when conditions allow.\n\nFeatured by Visit Sweden as one of Sweden\'s nine "hidden island escapes." Reply directly or check open nights below.',
        ctaSv: 'Se lediga datum på hedetangen.com',
        ctaEn: 'Explore open dates at hedetangen.com',
        sendNotes: 'Send first to past guests and warm inquiries before running any paid promotion.',
      });
    }

    if (schemaType === 'ad') {
      return JSON.stringify({
        variants: [
          {
            angle: 'Sensory stillness',
            headlineSv: 'Bastu. Kallt vatten. Stillhet.',
            headlineEn: 'Sauna. Cold water. Stillness.',
            primaryTextSv:
              'Varm vedeldad bastu vid sjön och lugna kvällar i Värmland. För två gäster åt gången.',
            primaryTextEn:
              'Wood-fired sauna by the lake and quiet nights in Värmland. Strictly two guests at a time.',
            cta: 'Check open dates',
            visualDirection:
              'Slow static close-up of lantern glow reflecting on dark water ripples at dusk (atmosphere only).',
          },
          {
            angle: 'Editorial trust',
            headlineSv: 'Stillhet i Värmland',
            headlineEn: 'Quiet nights in Värmland',
            primaryTextSv:
              'Uppmärksammad av Visit Sweden som en av nio "hidden island escapes". Klara nätter syns ibland norrsken över vattnet.',
            primaryTextEn:
              'Featured by Visit Sweden as one of nine "hidden island escapes." On clear nights, northern lights sometimes drift above the trees.',
            cta: 'Learn more',
            visualDirection:
              'Tactile frame of glowing birch logs and rising steam in cool blue-hour light (atmosphere only).',
          },
        ],
      });
    }

    if (schemaType === 'calendar') {
      const start = new Date();
      const fmtDate = (offsetDays: number) => {
        const d = new Date(start.getTime() + offsetDays * 86400000);
        return d.toISOString().slice(0, 10);
      };
      return JSON.stringify({
        summary: `Lean schedule matched to ${hoursPerWeek}, starting with owned email and 1–2 atmospheric social posts per week.`,
        items: [
          {
            date: fmtDate(1),
            channel: 'Email',
            item: 'Send past-guest & inquiry email',
            notes: 'Highlight open dates and core sauna/lake experience; single clear booking link.',
            cta: 'Check open nights',
          },
          {
            date: fmtDate(3),
            channel: 'Instagram',
            item: 'Reel: Warm embers & crisp lake air (SV/EN)',
            notes: '12s static iPhone clip of steam and firelight — atmosphere only.',
            cta: 'Link in bio',
          },
          {
            date: fmtDate(7),
            channel: 'Instagram',
            item: 'Carousel: Visit Sweden press & winter ritual',
            notes: '3 tactile atmosphere stills shot in one afternoon.',
            cta: 'Save or book',
          },
          {
            date: fmtDate(10),
            channel: 'Website',
            item: 'Check inquiry volume & open calendar slots',
            notes: 'Review responses before committing additional time or budget.',
            cta: 'Update availability',
          },
        ],
      });
    }

    if (schemaType === 'video') {
      return JSON.stringify({
        shots: [
          {
            shotNumber: 1,
            durationSec: 6,
            scene: hasRef
              ? `Anchored to confirmed reference (${refMatch?.[1]}), gentle breeze across surrounding reeds in twilight.`
              : 'Close-up of glowing birch embers and drifting sparks against cool twilight air.',
            feeling: 'Quiet warmth against crisp cold',
            camera: '1x lens, static frame, shallow depth of field',
            lightAndColor: 'Amber firelight against muted charcoal and blue hour',
            referenceRequired: hasRef,
          },
          {
            shotNumber: 2,
            durationSec: 5,
            scene: 'Steam rising slowly over dark cold water with frosted pine needles in soft foreground.',
            feeling: 'Crisp stillness before dusk',
            camera: 'Continuous slow pan right, natural water motion only',
            lightAndColor: 'Soft blue-hour sidelight, moss and slate tones',
            referenceRequired: false,
          },
          {
            shotNumber: 3,
            durationSec: 6,
            scene: 'Hands in thick wool cuffs lifting a warm stoneware mug in soft morning light.',
            feeling: 'Unhurried comfort at dawn',
            camera: 'Macro tactile close-up, static',
            lightAndColor: 'Golden-hour warmth, cream and natural wood tones',
            referenceRequired: false,
          },
        ],
      });
    }

    if (schemaType === 'landing') {
      return JSON.stringify({
        heroHeadlineSv: 'Lugna nätter vid vattnet i Värmland',
        heroHeadlineEn: 'Quiet nights by the water in Värmland',
        subheadlineSv: 'Vedeldad bastu, kallt sjövatten och tid att bara vara — för två gäster åt gången.',
        subheadlineEn: 'Wood-fired sauna, cold lake water, and unhurried stillness — strictly two guests at a time.',
        sections: [
          {
            title: 'The Experience',
            bodySv: 'En avskild vistelse med vedeldad bastu, sjö och skog precis utanför. Under klara nätter syns ibland stjärnhimmel och norrsken över vattnet.',
            bodyEn: 'An unhurried stay with a wood-fired sauna, lake, and forest at your doorstep. On clear nights, open stars and occasional northern lights appear.',
          },
          {
            title: 'Editorial Recognition',
            bodySv: 'Uppmärksammad av Visit Sweden som en av Sveriges nio "hidden island escapes".',
            bodyEn: 'Featured by Visit Sweden as one of Sweden\'s nine "hidden island escapes."',
          },
        ],
        ctaSv: 'Se lediga datum',
        ctaEn: 'View open dates',
      });
    }

    // research
    return JSON.stringify({
      title: `Positioning & Channel Brief — ${coreOffer}`,
      question: `How can ${coreOffer} convert high-intent guests within ${hoursPerWeek}?`,
      findings: [
        {
          point: 'Direct outreach to past guests consistently outperforms cold ads for low-capacity nature stays.',
          confidence: 'high',
          dateContext: '2025–2026 Nordic micro-hospitality baseline',
        },
        {
          point: 'Bilingual SV/EN communication captures both domestic weekenders and European road-trippers.',
          confidence: 'high',
          dateContext: 'Ongoing regional travel behavior',
        },
        {
          point: 'Honest weather expectations (never guaranteeing aurora or ice) reduce refund friction and protect reviews.',
          confidence: 'high',
          dateContext: 'Seasonal eco-tourism practice',
        },
      ],
      implications: [
        'Lead every seasonal push with owned email before allocating paid ad budget.',
        'Keep visual framing grounded in genuine sensory atmosphere rather than staged luxury.',
      ],
      toVerify: [
        'Current regional event dates on Visit Värmland',
        'Mobile checkout load time on your booking page',
      ],
      freshnessNote: 'Demo Mode offline synthesis — verify live seasonal listings and local dates directly.',
    });
  }

  private planResponse(lower: string, original: string, sys: string, hasHistory: boolean): string {
    const isGreeting =
      /^(hej|hi|hello|hey|tack|thanks|thank you|who are you|what can you do)/i.test(original.trim()) &&
      original.trim().length < 60;

    if (isGreeting) {
      return `<response>
Hej! I'm Jennifer, your marketing partner for Hedetangen.

Tell me what you're working on — Instagram captions, a seasonal booking campaign, pricing scenarios, or atmospheric visual briefs — and I'll handle it while keeping every word aligned with your Brand DNA and honesty rule.

*You're currently in Demo Mode, so you can explore the full workflow without an API key.*
</response>`;
    }

    // Underspecified first turn ("we really need bookings for the winter, like now. what can you do")
    if (
      !hasHistory &&
      original.trim().length < 110 &&
      /(bookings|bokningar)/i.test(lower) &&
      !/(sek|kr|list|lista|email|mejl|instagram)/i.test(lower)
    ) {
      return `<response>
I can help you build a focused winter plan right away, but I want to match it to what you can realistically execute this week.

Before I draft anything: **how many hours/people do you have available right now, do you have an existing guest list or ad budget in mind, and which winter experience (sauna, ice bath, or AuroraHut stays) do you want to push first?**
</response>`;
    }

    // Email request (EN / SV)
    if (/\b(email|e-?mail|mejl|epost|nyhetsbrev|our list)\b/i.test(lower)) {
      return `<response>
I'll draft a ready-to-send email tailored to your past guests and inquiries, weaving in your verified proof points and Brand DNA. One moment.
</response>
<delegate expert="Copywriter">
  <task>Write an email campaign version for the past-guest and inquiry list (${original}).</task>
  <context>Carry forward confirmed session facts (200 previous guests + inquiries, wood-fired sauna & ice bath winter experience, and verified awards/Visit Sweden mention). Do not mention personal family/health details.</context>
  <constraints>Ready to paste into an email tool, one clear CTA, weather/aurora conditional, bilingual or crisp EN/SV per context.</constraints>
</delegate>`;
    }

    // Refinement / shorten / less poetic (EN / SV)
    if (/(shorter|kortare|less poetic|mindre poetisk|tighten|simplify)/i.test(lower)) {
      return `<response>
I'll tighten all the drafted variants so they are shorter and more direct while keeping your Brand DNA, proof points, and weather honesty intact.
</response>
<delegate expert="Copywriter">
  <task>Refine and shorten all prior caption variants (${original}).</task>
  <context>Preserve every verified award/Visit Sweden proof point and keep aurora/weather phrasing conditional. No personal family/health hooks.</context>
  <constraints>Bilingual SV and EN pairs, noticeably shorter and less poetic, one CTA per variant, atmosphere-only visual direction.</constraints>
</delegate>`;
    }

    // Pricing / budget / ROI (EN / SV including kr/sek)
    if (/(pricing|roi|price|budget|\d+\s*(?:kr|sek))/i.test(lower)) {
      const alsoAwards = /(award|visit sweden|utmärkelse)/i.test(lower);
      if (alsoAwards) {
        return `<response>
I'll recalibrate the plan around your stated ad budget, run the break-even math with a clear stop/spend threshold, and weave your awards into fresh bilingual ad copy.
</response>
<delegate expert="Marketing Strategist">
  <task>Update the winter campaign mix around the stated ad budget and proof points (${original}).</task>
  <context>Respect 1.5 FTE capacity and prioritize owned email list before paid ads.</context>
  <constraints>Ranked channels (email first), realistic 2-week timeline.</constraints>
</delegate>
<delegate expert="Business & Pricing Analyst">
  <task>Calculate break-even booking math and a stop/spend threshold for the stated ad budget (${original}).</task>
  <context>Capacity 2 guests per hut, summer anchor 1750 SEK/person/night.</context>
  <constraints>Show step-by-step arithmetic, all assumptions, and one concrete stop/spend threshold.</constraints>
</delegate>
<delegate expert="Copywriter">
  <task>Draft Instagram ad variants using the verified awards and Visit Sweden mention sparingly as trust proof.</task>
  <context>Sauna & ice bath winter focus, bilingual SV + EN.</context>
  <constraints>Bilingual SV + EN, atmosphere-only visuals, no invented structures, no aurora promises.</constraints>
</delegate>`;
      }

      return `<response>
I'll run the numbers on that pricing and ROI scenario and verify every assumption against your two-guest capacity. One moment.
</response>
<delegate expert="Business & Pricing Analyst">
  <task>${original}</task>
  <context>Hedetangen operates one floating AuroraHut (capacity 2 guests). Summer 2026 rate is 1750 SEK per person per night.</context>
  <constraints>Show step-by-step arithmetic, explicit assumptions, break-even bookings, and a stop/spend threshold.</constraints>
</delegate>`;
    }

    // Operational plan / capacity / weekly action ("what would you actually do this week", calendar, post this week)
    if (
      /(what would you actually do|this week|half days?|fte|post this week|calendar|content plan|veckoplan|innehållskalender)/i.test(
        lower
      )
    ) {
      return `<response>
Thank you for sharing your capacity upfront — keeping things manageable comes first. I'll prioritize high-return, low-effort steps starting with your existing list.
</response>
<delegate expert="Marketing Strategist">
  <task>${original}</task>
  <context>Small owner team operating at limited capacity. Existing email list of past guests and inquiries. Never use personal circumstances as ad copy.</context>
  <constraints>Rank owned email list #1, low-effort iPhone social #2, paid ads only after budget is clear.</constraints>
</delegate>
<delegate expert="Social Media Strategist">
  <task>Propose a minimal 2-week iPhone-friendly cadence matching limited owner capacity.</task>
  <context>1–2 posts per week max, winter sauna & ice bath atmosphere only unless reference supplied.</context>
  <constraints>Realistic lean cadence, atmosphere-only shoot notes, max 8 hashtags.</constraints>
</delegate>`;
    }

    // Campaign (EN + SV "kampanj")
    if (/(campaign|kampanj|spring|summer|winter|vinter|bookings|bokningar|wizard|bastu|isbad)/i.test(lower)) {
      const hasPaidCaution = /(not much money|inte så mycket pengar|tight budget)/i.test(lower);
      return `<response>
${
  /kampanj|bastu|isbad|vintern|inte så mycket/i.test(lower)
    ? 'Jag tar fram en fokuserad plan som utgår från låg annonsbudget och kombinerar den med tvåspråkiga utkast och atmosfäriska bildförslag.'
    : "I'll structure a focused campaign plan tailored to Hedetangen's capacity and budget, paired with bilingual copy and atmosphere-only visual directions."
}
</response>
<delegate expert="Marketing Strategist">
  <task>${original}</task>
  <context>Single floating AuroraHut on a private island in Värmland, winter sauna & ice bath. ${hasPaidCaution ? 'Budget is tight — lead with zero-budget owned channels.' : ''}</context>
  <constraints>Prioritize owned email list first, organic iPhone social second, paid ads third.</constraints>
</delegate>
<delegate expert="Copywriter">
  <task>Draft bilingual SV + EN Instagram variants for winter sauna and ice bath.</task>
  <context>Use understated Scandinavian voice, conditional weather/aurora language.</context>
  <constraints>Native SV and EN pairs, atmosphere-only visual directions, zero generic luxury clichés.</constraints>
</delegate>
<delegate expert="Visual Director">
  <task>Create iPhone-shootable atmospheric visual briefs for winter sauna and ice bath.</task>
  <context>${sys.includes('<confirmed_reference>') ? 'Confirmed reference supplied in session facts.' : 'No reference photo supplied — atmosphere only (steam, water, frost, firelight, hands).'}</context>
  <constraints>Single continuous slow move or static, one sensory feeling per shot, no invented structures.</constraints>
</delegate>`;
    }

    if (lower.includes('visual') || lower.includes('video') || lower.includes('shot') || lower.includes('image prompt')) {
      return `<response>
I'll craft atmospheric visual directions with single slow camera moves that strictly honor your Brand DNA honesty rule.
</response>
<delegate expert="Visual Director">
  <task>${original}</task>
  <context>No reference photo supplied — restrict scenes to water, light, fire, wood textures, hands, and natural details.</context>
  <constraints>One sensory feeling per shot, no invented buildings or structures, warm earth tones and natural light only.</constraints>
</delegate>`;
    }

    if (lower.includes('research') || lower.includes('competitor') || lower.includes('trend')) {
      return `<response>
I'll compile a concise research brief noting confidence levels and exactly what to verify locally.
</response>
<delegate expert="Researcher">
  <task>${original}</task>
  <context>Small eco-tourism glamping operator in Värmland, Sweden.</context>
  <constraints>State freshness caveats clearly; never fabricate sources or statistics.</constraints>
</delegate>`;
    }

    // Default: Copywriter
    return `<response>
I'll draft bilingual Swedish and English options in Hedetangen's understated voice, then verify every line against your Brand DNA.
</response>
<delegate expert="Copywriter">
  <task>${original}</task>
  <context>Hedetangen floating AuroraHut, wood-fired sauna, ice bath, Värmland lake and forest.</context>
  <constraints>Bilingual SV + EN variants, atmosphere-only visual direction, zero generic luxury clichés.</constraints>
</delegate>`;
  }

  private expertResponse(sys: string, lower: string, taskBlock: string): string {
    const isAnalyst =
      sys.includes('<!-- expert:business-analyst -->') ||
      sys.includes('You are the Business & Pricing Analyst');
    const isSocial =
      sys.includes('<!-- expert:social-media-strategist -->') ||
      sys.includes('You are the Social Media Strategist');
    const isStrategist =
      sys.includes('<!-- expert:marketing-strategist -->') ||
      sys.includes('You are the Marketing Strategist');
    const isVisual =
      sys.includes('<!-- expert:visual-director -->') ||
      sys.includes('You are the Visual Director');
    const isResearcher =
      sys.includes('<!-- expert:researcher -->') ||
      sys.includes('You are the Researcher');

    if (isAnalyst) {
      const has3000 = /3000/.test(taskBlock) || /3000/.test(sys);
      return `QUESTION RESTATED: ${
        has3000
          ? 'Break-even and ROI sketch for a 3,000 SEK winter ad test.'
          : 'Evaluating package and pricing sensitivity around the 1750 SEK/person/night anchor.'
      }

ASSUMPTIONS:
- Capacity: 2 guests per AuroraHut (source: Hedetangen baseline).
- Nightly rate: 1,750 SEK/person/night = 3,500 SEK/night for two guests (assumed winter anchor from summer 2026 rate — replace if winter rate differs).
- Average stay length: 2 nights = 7,000 SEK gross per booking (assumed).
- Variable turnover cost (firewood, linen, cleaning, provisions): 650 SEK/stay (assumed) → ~6,350 SEK contribution per 2-night booking.
${
  has3000
    ? `- Paid ad budget: 3,000 SEK max (owner-supplied).
- Estimated CPC / click-to-inquiry / close rate: 4–8 SEK CPC → 375–750 clicks; at 2–3% inquiry rate and 25% close rate → ~2–5 bookings (assumed range — replace after Week 1).`
    : ''
}

ANALYSIS:
${
  has3000
    ? `- Break-even on ad spend: 3,000 SEK ÷ 6,350 SEK contribution per 2-night stay = 0.47 bookings (1 confirmed 2-night stay covers the entire 3,000 SEK ad test and leaves ~3,350 SEK net contribution).
- Break-even on a single 1-night stay (3,500 SEK gross − 650 SEK variable = 2,850 SEK): 3,000 ÷ 2,850 = 1.05 bookings (~1–2 nights).`
    : `- A 2-night stay at 1750 SEK/person = 7000 SEK gross revenue, ~6350 SEK contribution before fixed overhead.
- Bundling a wood-fired sauna + ice-bath evening with local grill provisions priced at +450 SEK/person adds 900 SEK per booking without needing an extra night.`
}

RECOMMENDATION:
1. ${
        has3000
          ? 'Run a capped 3,000 SEK test split across 2 weeks (~215 SEK/day) ONLY after sending your past-guest email.'
          : 'Hold base rate and test a midweek "Sauna & Stillness" value-add bundle instead of discounting.'
      }
2. Spend more / stop threshold: **Stop or pause ads if you spend 1,500 SEK with fewer than 2 qualified booking inquiries or >8 SEK CPC; spend more only if 1+ confirmed winter stay books within 14 days.**

WHAT TO WATCH: Cost per qualified booking inquiry and direct booking inquiries referencing winter dates.
DATA GAPS: Exact winter nightly rate, historical inquiry-to-booking close rate, and actual variable turnover cost.`;
    }

    if (isSocial) {
      return `WEEK | DAY | PILLAR | FORMAT | HOOK | CAPTION | HASHTAGS | SHOOT NOTE | CTA
1 | Tue | The Ritual | Reel | Steg från hetta till iskallt vatten. | SV: Bastuvärme mot frostig sjöluft. Ett lugnt andetag innan kvällen faller i Värmland.\nEN: Wood-fired sauna warmth against crisp lake air. One unhurried breath before dusk in Värmland. | #hedetangen #värmland #bastu #isbad #slowtravel | iPhone 12s static clip of birch embers and steam rising — no buildings or structures shown. | Boka vinterdatum via länk i bio.
1 | Fri | The Place | Carousel | Tystnaden över sjön i blå timmen. | SV: Inget filter, inget brus — bara kylan i luften och vatten som stillnar.\nEN: No rush, no noise — just crisp air and water settling at dusk. | #värmland #swedishnature #unlockyoursenses #winterreset | 3 iPhone shots in one afternoon: frosted pine needles, lantern light on wood grain, steaming stoneware mug. | Save for your winter reset.

SUMMARY: Minimal 2-post/week cadence designed for ~1.5 FTE capacity — shootable in one afternoon on an iPhone with pure atmosphere scenes.`;
    }

    if (isStrategist) {
      return `OBJECTIVE: Generate winter bookings quickly within a ~1.5 FTE owner capacity and capped budget without discounting brand trust.
AUDIENCE: Repeat summer guests (gifting/winter return), nearby Swedish couples needing a quiet sauna + ice-bath reset, and winter slow-travelers.
CORE MESSAGE: Simple meets luxury in raw Swedish winter — wood-fired sauna warmth, cold lake water, and quiet evenings away from everyday noise (with northern lights when clear skies allow).
CHANNEL MIX:
1. Owned email list (~200 past guests + ~100 inquiries) — highest trust, zero media cost, fastest path to bookings this week.
2. Organic Instagram (1–2 iPhone posts/week) — maintains presence for warm leads at zero ad spend.
3. Paid Instagram ads (only within stated 3,000 SEK ceiling, paused if email fills open weekends first).
TIMELINE: Days 1–2 send past-guest email + shoot 4 atmospheric iPhone clips in one afternoon; Weeks 1–2 publish 2 organic posts/week and run capped retargeting/cold test.
ASSETS NEEDED: 1 past-guest email, 3 shorter bilingual IG ad/post variants, 4 atmosphere-only shot briefs, verified awards + Visit Sweden proof line.
SUCCESS SIGNAL: Direct booking inquiries or bookings from the email list within 7 days of send.
RISKS: Weather dependency (ice/snow/aurora cannot be promised), founder time ceiling (~1.5 FTE), and 2-guest nightly capacity.`;
    }

    if (isVisual) {
      return `SHOT 1 | 6s | Close-up of glowing birch logs and rising sparks beside dark winter water at blue hour | Quiet warmth against winter air | 1x iPhone slow static frame | Amber firelight against cool blue dusk
SHOT 2 | 5s | Steam rising off cold lake surface with frosted pine needles in soft foreground | Crisp winter stillness | Continuous slow pan right | Soft morning light, muted charcoal and moss
SHOT 3 | 6s | Hands in thick wool cuffs lifting a stoneware mug of black coffee | Unhurried warmth at dawn | Shallow depth close-up, static | Golden hour sidelight, warm cream and earth tones
SHOT 4 | 5s | Ice crystals and dark rippling water catching warm lantern reflection on shore stones | Sensory contrast of cold and light | Slow push-in, natural water motion only | Warm lantern glow on dark slate tones

Reference required? no (pure atmosphere — no structures depicted).`;
    }

    if (isResearcher) {
      return `BRIEF TITLE: Nordic Eco-Glamping & Slow Travel Positioning Context
QUESTION: How should Hedetangen position off-grid island stays relative to regional glamping options?
FINDINGS:
- Travellers in Scandinavia increasingly filter for low-capacity, owner-hosted stays over multi-unit glamping parks (confidence: medium, 2025–2026 travel trend).
- Transparency around seasonal realities (weather, off-grid simplicity) reduces expectation mismatch and improves review scores (confidence: high).
- Bilingual English/Swedish booking paths remain essential for capturing German, Dutch, and UK road-trip guests visiting Värmland (confidence: high).
IMPLICATIONS FOR HEDETANGEN:
- Lead with private-island solitude and verified editorial credibility rather than generic luxury amenities.
- Highlight bundled winter rituals (wood-fired sauna, ice bath, grilling) clearly.
WHAT TO VERIFY: Current seasonal rates on Visit Värmland partner listings and local Värmland tourism event dates.
SOURCES / FRESHNESS: Synthesized from baseline domain knowledge (Demo Mode — no live web search performed). Task context: ${taskBlock.slice(0, 80)}`;
    }

    // Copywriter branches: email, shorten/revise, or standard bilingual variants
    if (/(email|mejl|epost)/i.test(lower)) {
      const hasAward = /(award|visit sweden|eco)/i.test(sys + taskBlock);
      return `SUBJECT LINE:
SV: Bastu och vinterstillhet vid sjön — några lediga nätter kvar
EN: Wood-fired sauna and winter stillness — open nights this season

BODY:
SV: Hej! Efter sommaren hos oss vill vi bjuda in er tillbaka till Värmland när kylan lägger sig. Vår vedeldade bastu står varm vid vattnet, och för den som vågar väntar isbad under stjärnorna — ibland, under klara nätter, även norrsken.${hasAward ? ' (Tack för att ni är en del av resan som Visit Sweden kallat en av Sveriges nio "hidden island escapes".)' : ''}

EN: Hello again — following summer on the lake, we're opening quiet winter nights by the wood-fired sauna and ice bath. When skies clear, the night sky opens wide above the trees — unhurried and simple.${hasAward ? ' Highlighted by Visit Sweden as one of Sweden\'s nine "hidden island escapes."' : ''}

CTA:
SV: Se lediga vinterdatum på hedetangen.com
EN: View open winter dates at hedetangen.com`;
    }

    if (/(shorten|shorter|kortare|less poetic|mindre poetisk)/i.test(lower)) {
      return `VARIANT 1
Headline / hook: Bastu. Isbad. Vinterstillhet. / Sauna. Ice bath. Winter stillness.
Body:
SV: Vedeldad bastu vid sjön, ett kallt dopp och lugna kvällar i Värmland. Klara nätter syns ibland norrsken över vattnet.
EN: Wood-fired sauna by the lake, a cold plunge, and quiet winter nights in Värmland. On clear nights, northern lights sometimes appear.
CTA: SV: Se lediga datum på hedetangen.com | EN: Book winter nights at hedetangen.com
Visual direction: Close-up of lantern light reflecting on dark ripples at dusk (atmosphere only).

VARIANT 2
Headline / hook: Vinter för två vid vattnet. / Winter for two by the water.
Body:
SV: Enkelt, varmt och stilla — bastu och isbad i egen takt. Uppmärksammad av Visit Sweden som en av nio "hidden island escapes".
EN: Simple, warm, unhurried — sauna and ice bath at your own pace. Named by Visit Sweden as one of nine "hidden island escapes".
CTA: SV: Boka din vistelse | EN: Reserve your stay
Visual direction: Steam rising from a stoneware mug beside glowing birch embers (atmosphere only).

VARIANT 3
Headline / hook: Två platser. En stilla vinterkväll. / Two spots. One quiet winter night.
Body:
SV: Ved i ugnen, frost i luften och tid att bara vara — bara två gäster åt gången.
EN: Birch on the fire, frost in the air, and time to slow down — strictly two guests at a time.
CTA: SV: Kolla lediga nätter | EN: Check winter dates
Visual direction: Hands in wool cuffs warming over birch embers at blue hour (atmosphere only).`;
    }

    // Default: Copywriter standard 3 variants
    const hasVisitSweden = /visit\s+sweden/i.test(sys + taskBlock);
    return `VARIANT 1
Headline / hook: Tystnaden börjar där vägen tar slut. / Silence begins where the road ends.
Body:
SV: Bastuvärme mot kall sjöluft. Sprakande björkved och en stjärnklar himmel över vattnet i Värmland — för två gäster åt gången, långt bort från vardagens tempo.${hasVisitSweden ? ' Uppmärksammad av Visit Sweden som en av Sveriges nio "hidden island escapes".' : ''}
EN: Wood-fired sauna warmth against crisp lake air. Crackling birch and an open night sky in Värmland — strictly two guests at a time, far from everyday noise.${hasVisitSweden ? ' Highlighted by Visit Sweden as one of nine "hidden island escapes".' : ''}
CTA: SV: Se lediga nätter på hedetangen.com | EN: View open nights at hedetangen.com
Visual direction: Slow close-up of warm lantern glow reflecting on dark ripples at dusk, with pine silhouettes in soft focus (atmosphere only).

VARIANT 2
Headline / hook: Kalla dopp. Varma samtal. / Cold water. Warm light.
Body:
SV: Kliv upp ur isbadet och rakt in i doften av varmt trä. Under klara vinterkvällar visar sig ibland norrskenet ovanför trädtopparna, helt utan brådska eller löften.
EN: Step out of the ice bath and into the scent of warm cedar. On clear winter nights, northern lights sometimes drift above the treeline — unhurried and never rushed.
CTA: SV: Boka er vintervistelse | EN: Reserve your winter stay
Visual direction: Tactile close-up of thick wool and a steaming stoneware mug beside glowing embers at twilight (atmosphere only).

VARIANT 3
Headline / hook: Enkelt möter stillhet i Värmland. / Simple meets stillness in Värmland.
Body:
SV: När frosten lägger sig över sjön väntar vedeldad bastu, värmande glöd och mörka skogar. En liten vintervistelse för er som söker lugn framför allt annat.
EN: As frost settles along the lake, wood-fired sauna warmth, quiet forest dark, and glowing birch coals await. An unhurried winter stay built for stillness.
CTA: SV: Utforska lediga datum | EN: Explore winter dates
Visual direction: Slow static frame of steam drifting across icy shore stones in early morning sidelight (atmosphere only).`;
  }

  private synthesizeResponse(expertOutputsBlock: string, lowerUser: string, _sys: string): string {
    const clean = expertOutputsBlock
      .replace(/<\/?expert_outputs>/g, '')
      .replace(/<expert name="[^"]+">/g, '\n')
      .replace(/<\/expert>/g, '\n')
      .replace(/<orchestrator_note>[\s\S]*?<\/orchestrator_note>/g, '')
      .trim();

    if (!clean) {
      return `Here is a grounded starting point for Hedetangen.\n\nEverything stays within your Brand DNA — warm Swedish nature, understated luxury, and atmosphere-only visuals where no reference photo is provided. Would you like me to refine this for Instagram or email next?`;
    }

    const isSwedish = /kampanj|bastu|isbad|vintern|inte så mycket|kortare|mejl/i.test(lowerUser);
    const hasCapacityConstraint = /half day|halvdag|limited capacity|reduced capacity|just us two|fte/i.test(
      lowerUser
    );

    const intro = hasCapacityConstraint
      ? 'I’ve kept the plan tightly scoped to what you can realistically handle right now — starting with your own guest list before spending on ads.\n\n'
      : isSwedish
        ? 'Här är en fokuserad plan och tvåspråkigt material utifrån er låga budget och nuvarande kapacitet.\n\n'
        : '';

    const note = isSwedish
      ? 'Jag har behållit både svenska och engelska varianter (SV/EN), hållit norrsken/väder villkorat ("under klara kvällar"), och enbart använt rena atmosfärsbilder.'
      : 'All copy preserves native SV/EN pairs, keeps weather and northern lights conditional, and limits visual directions to pure atmosphere (no invented structures).';

    return `${intro}${clean}

---

**Brand DNA Notes**
- ${note}
- Want me to save these deliverables to your Content Library, or adjust the tone next?`;
  }
}
