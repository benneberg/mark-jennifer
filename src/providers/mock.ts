import type { ChatResult, ModelInfo } from '../types';
import type { AIProvider, ChatRequestOptions } from './base';

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Aborted', 'AbortError'));
      return;
    }
    const timer = window.setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      window.clearTimeout(timer);
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
      const content = this.planResponse(lowerUser, lastUser);
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
    const synthesized = this.synthesizeResponse(expertOutputsBlock, lowerUser);
    await streamText(synthesized, options.onToken, options.signal);
    return { content: synthesized, model: options.model || 'hedetangen-demo-v1', finishReason: 'stop' };
  }

  private planResponse(lower: string, original: string): string {
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

    if (lower.includes('pricing') || lower.includes('sek') || lower.includes('roi') || lower.includes('price')) {
      return `<response>
I'll run the numbers on that pricing and occupancy scenario and verify the assumptions against your two-guest capacity. One moment.
</response>
<delegate expert="Business & Pricing Analyst">
  <task>${original}</task>
  <context>Hedetangen operates one floating AuroraHut (capacity 2 guests). Summer 2026 rate is 1750 SEK per person per night.</context>
  <constraints>Show step-by-step arithmetic, explicit assumptions, and data gaps.</constraints>
</delegate>`;
    }

    if (lower.includes('post this week') || lower.includes('calendar') || lower.includes('content plan')) {
      return `<response>
I'll put together a realistic, iPhone-shootable content plan for this week that fits two owner-operators, and check every visual note against your Brand DNA.
</response>
<delegate expert="Social Media Strategist">
  <task>${original}</task>
  <context>Two-person family team in Värmland. Bilingual SV/EN audience.</context>
  <constraints>2-3 posts max, iPhone-friendly, atmosphere-only visuals unless a real photo is supplied, max 8 hashtags.</constraints>
</delegate>`;
    }

    if (lower.includes('campaign') || lower.includes('spring') || lower.includes('summer') || lower.includes('bookings') || lower.includes('wizard')) {
      return `<response>
I'll structure a focused campaign plan tailored to Hedetangen's capacity and booking window, then pair it with on-brand messaging.
</response>
<delegate expert="Marketing Strategist">
  <task>${original}</task>
  <context>Single floating AuroraHut on a private island in Värmland, plus winter sauna & ice bath. Tagline: Unlock Your Senses.</context>
  <constraints>Prioritize owner-run channels (Instagram, Facebook, past-guest email, hedetangen.com, Visit Värmland).</constraints>
</delegate>
<delegate expert="Copywriter">
  <task>Draft two bilingual launch variants supporting this campaign brief.</task>
  <context>Use the Marketing Strategist's occasion-based focus in rustic Scandinavian voice.</context>
  <constraints>Bilingual SV and EN, atmosphere-only visual directions, no generic luxury clichés.</constraints>
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

  private expertResponse(sys: string, _lower: string, taskBlock: string): string {
    if (sys.includes('Business & Pricing Analyst')) {
      return `QUESTION RESTATED: Evaluating package and pricing sensitivity around the 1750 SEK/person/night anchor.

ASSUMPTIONS:
- Capacity: 2 guests per night (3500 SEK gross nightly revenue at full hut rate; source: Hedetangen baseline).
- Variable turnover cost (linen, firewood, cleaning, local breakfast basics): 650 SEK per stay (assumed — replace with your actual figure).
- Average stay length: 2 nights (assumed).

ANALYSIS:
- A 2-night stay at 1750 SEK/person = 7000 SEK gross revenue, ~6350 SEK contribution before fixed overhead.
- Bundling a guided wood-fired sauna + ice-bath evening with local grill provisions priced at +450 SEK/person adds 900 SEK per booking without needing an extra night.
- Discounting the nightly rate by 15% (to 1487 SEK/person) costs 1050 SEK on a 2-night stay, requiring 18% higher occupancy just to break even on contribution.

RECOMMENDATION:
1. Hold the 1750 SEK base rate and test a midweek "Sauna & Stillness" value-add bundle instead of discounting.
2. Track booking lead time per season to spot when shoulder-month gaps actually open.

WHAT TO WATCH: Inquiry-to-booking conversion rate and midweek fill rate over the next 30 days.
DATA GAPS: Actual variable cost per turnover and historical off-season inquiry volume.`;
    }

    if (sys.includes('Social Media Strategist')) {
      return `WEEK | DAY | PILLAR | FORMAT | HOOK | CAPTION | HASHTAGS | SHOOT NOTE | CTA
1 | Tue | The Ritual | Reel | The sound before the water stills. | SV: Elden tar fart innan skymningen lägger sig över sjön. Enkelhet möter stillhet i Värmland.\nEN: The fire catches before dusk settles over the lake. Simple meets stillness in Värmland. | #hedetangen #värmland #bastu #nordicnature #slowtravel | iPhone 15s static clip of birch embers and steam rising — no structures shown. | Link in bio for open dates.
1 | Thu | The Place | Carousel | Blue hour on the lake lasts twenty quiet minutes. | SV: Inget filter, inget brus — bara kylan i luften och spegelblankt vatten.\nEN: No filter, no rush — just crisp air and mirror-still water. | #värmland #swedishnature #unlockyoursenses #offgrid | 3 vertical photos: frosted pine, lantern glow, wool blanket texture. | Save for your next reset.
1 | Sun | The Ritual | Story | Morning coffee by the water. | SV: Varm kaffe i kalla händer. Det räcker.\nEN: Warm coffee in cold hands. That is enough. | #hedetangen | Close-up of weathered enamel mug and steam at dawn. | Reply with your favorite season.

SUMMARY: Three low-effort, iPhone-native posts pacing rhythm across warmth, quiet winter landscape, and morning ritual without requiring a shoot crew.`;
    }

    if (sys.includes('Marketing Strategist')) {
      return `OBJECTIVE: Fill shoulder and early-summer 2-night stays at 1750 SEK/person/night without discounting.
AUDIENCE: Couples seeking an unhurried reset and international travelers planning a slow Sweden road trip.
CORE MESSAGE: Off-grid stillness on a private island in Värmland — where wood smoke, lake water, and 360° night skies replace the noise of everyday schedules.
CHANNEL MIX:
1. Past-guest email — highest trust and lowest acquisition cost for repeat stays and gift referrals.
2. Instagram Reels & Carousels — strongest sensory discovery for couples and Nordic travel planners.
3. Visit Värmland / Visit Sweden listings — captures high-intent international searchers.
TIMELINE: Weeks 1–2 capture raw atmospheric clips; Week 3 send email + launch 3-post sequence; Weeks 4–6 respond to inquiries and share seasonal availability updates.
ASSETS NEEDED: 2 bilingual copy variants, 3 atmospheric visual prompts (no invented structures), 1 short past-guest email.
SUCCESS SIGNAL: Direct booking inquiries referencing summer or shoulder-season dates within 14 days of email send.
RISKS: Weather dependency (never promise northern lights) and strict 2-guest capacity ceiling.`;
    }

    if (sys.includes('Visual Director')) {
      return `PROMPT 1
Scene: Close-up of weathered birch firewood catching orange flame beside dark lake water at blue hour, gentle mist drifting across the surface, linen and wool edge in foreground.
Feeling: Quiet warmth against crisp evening air.
Camera: 50mm lens, shallow depth of field, single continuous slow push-in over 6 seconds.
Light & colour: Blue hour cool lake tones balanced with warm amber firelight, deep wood and charcoal.
Reference required? no (pure atmosphere — no structures depicted).

PROMPT 2
Scene: Two weathered hands holding a stoneware mug of black coffee, soft morning light catching rising steam against blurred pine forest.
Feeling: Unhurried presence at dawn.
Camera: 35mm, static tripod frame, natural steam motion only.
Light & colour: Soft golden hour sidelight, muted forest green, cream, and warm earth tones.
Reference required? no.`;
    }

    if (sys.includes('Researcher')) {
      return `BRIEF TITLE: Nordic Eco-Glamping & Slow Travel Positioning Context
QUESTION: How should Hedetangen position off-grid island stays relative to regional glamping options?
FINDINGS:
- Travellers in Scandinavia increasingly filter for low-capacity, owner-hosted stays over multi-unit glamping parks (confidence: medium, 2025–2026 travel trend).
- Transparency around seasonal realities (weather, off-grid simplicity) reduces expectation mismatch and improves review scores (confidence: high).
- Bilingual English/Swedish booking paths remain essential for capturing German, Dutch, and UK road-trip guests visiting Värmland (confidence: high).
IMPLICATIONS FOR HEDETANGEN:
- Lead with private-island solitude and the real founders (Joacim & Madeleine) rather than generic luxury amenities.
- Highlight bundled local rituals (wood-fired sauna, ice bath, grilling) as the core value at 1750 SEK/person.
WHAT TO VERIFY: Current seasonal rates on Visit Värmland partner listings and local Värmland tourism event dates.
SOURCES / FRESHNESS: Synthesized from baseline domain knowledge (Demo Mode — no live web search performed). Task context: ${taskBlock.slice(0, 80)}`;
    }

    // Default: Copywriter
    return `VARIANT 1
Headline / hook: Tystnaden börjar där vägen tar slut. / Silence begins where the road ends.
Body:
SV: Bastuvärme mot kall sjöluft. Sprakande björkved och stjärnklar himmel över vattnet. Enkelhet möter lyx på Hedetangen i Värmland — för två gäster åt gången.
EN: Wood-fired sauna warmth against crisp lake air. Crackling birch and an open night sky over the water. Simple meets luxury at Hedetangen in Värmland — for two guests at a time.
CTA: SV: Se lediga nätter på hedetangen.com | EN: View open nights at hedetangen.com
Visual direction: Slow close-up of warm lantern glow reflecting on dark ripples at dusk, with pine silhouettes in soft focus (atmosphere only).

VARIANT 2
Headline / hook: Kalla dopp. Varma samtal. / Cold water. Warm light.
Body:
SV: Kliv upp ur isvaken och in i doften av varmt trä. Under klara vinterkvällar dansar ibland norrskenet ovanför trädtopparna, helt utan brådska.
EN: Step out of the ice bath and into the scent of warm cedar. On clear winter nights, northern lights sometimes drift above the treeline, unhurried.
CTA: SV: Boka er vintervistelse | EN: Reserve your winter stay
Visual direction: Tactile close-up of wool blanket and steaming stoneware mug beside glowing embers at twilight (atmosphere only).`;
  }

  private synthesizeResponse(expertOutputsBlock: string, lowerUser: string): string {
    const clean = expertOutputsBlock
      .replace(/<\/?expert_outputs>/g, '')
      .replace(/<expert name="[^"]+">/g, '\n')
      .replace(/<\/expert>/g, '\n')
      .trim();

    if (!clean) {
      return `Here is a grounded starting point for Hedetangen.\n\nEverything stays within your Brand DNA — warm Swedish nature, understated luxury, and atmosphere-only visuals where no reference photo is provided. Would you like me to refine this for Instagram or email next?`;
    }

    const note = lowerUser.includes('aurora') || lowerUser.includes('winter')
      ? 'I kept northern lights phrasing cautious ("on clear winter nights") and restricted visual directions to pure atmosphere so nothing unverified is implied.'
      : 'All copy and visual directions follow your Brand DNA guardrails — warm earth tones, tactile natural materials, and zero invented structures.';

    return `${clean}

---

**Brand DNA Notes**
- ${note}
- Want me to save this to your Content Library, or adapt a version for email?`;
  }
}
