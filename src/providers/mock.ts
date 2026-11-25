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

    await sleep(280, options.signal);

    // Stage 1: Jennifer orchestration planner
    if (sys.includes('<delegation_protocol>')) {
      const hasHistory = options.messages.some((m) => m.role === 'assistant');
      const content = this.planResponse(lowerUser, lastUser, sys, hasHistory);
      return { content, model: options.model || 'hedetangen-demo-v1', finishReason: 'stop' };
    }

    // Stage 2: Specialist expert execution
    if (sys.includes('<handoff>')) {
      const content = this.expertResponse(sys, lowerUser, lastUser);
      return { content, model: options.model || 'hedetangen-demo-v1', finishReason: 'stop' };
    }

    // Stage 3: Jennifer synthesis (streams to UI)
    const expertOutputsBlock =
      options.messages.find((m) => m.content.includes('<expert_outputs>'))?.content ?? '';
    const synthesized = this.synthesizeResponse(expertOutputsBlock, lowerUser, sys);
    await streamText(synthesized, options.onToken, options.signal);
    return { content: synthesized, model: options.model || 'hedetangen-demo-v1', finishReason: 'stop' };
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
Thank you for sharing your capacity upfront — keeping things manageable for the two of you comes first. I'll prioritize high-return, low-effort steps starting with your existing list.
</response>
<delegate expert="Marketing Strategist">
  <task>${original}</task>
  <context>Two founders at ~1.5 FTE (half days). Existing email list of previous guests and inquiries. Never use personal/family context as ad copy.</context>
  <constraints>Rank owned email list #1, low-effort iPhone social #2, paid ads only after budget is clear.</constraints>
</delegate>
<delegate expert="Social Media Strategist">
  <task>Propose a minimal 2-week iPhone-friendly cadence matching ~1.5 FTE capacity.</task>
  <context>1–2 posts per week max, winter sauna & ice bath atmosphere only unless reference supplied.</context>
  <constraints>Realistic 1.5 FTE cadence, atmosphere-only shoot notes, max 8 hashtags.</constraints>
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
    const hasPersonalConstraint = /baby|hospital|half day|bebis|sjukhus|halvdag/i.test(lowerUser);

    const intro = hasPersonalConstraint
      ? 'I’ve kept the plan tightly scoped to what the two of you can realistically handle right now — starting with your own guest list before spending on ads.\n\n'
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
