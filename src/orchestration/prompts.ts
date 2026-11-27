import type { AppSettings, Expert, Guardrails, LanguagePref, SessionFacts } from '../types';

function getLanguageInstruction(
  language: LanguagePref,
  expertName?: string,
  detectedLanguage?: 'sv' | 'en' | 'unknown'
): string {
  switch (language) {
    case 'sv':
      return 'Always respond in Swedish, regardless of the language of the request.';
    case 'en':
      return 'Always respond in English, regardless of the language of the request.';
    case 'bilingual':
      return 'Produce every user-facing output in Swedish and English side-by-side, with a clear SV: / EN: label per variant.';
    case 'auto':
    default:
      if (expertName === 'Copywriter' || expertName === 'Social Media Strategist') {
        return 'Detect the language of the request. If the request does not specify a single language, default to bilingual Swedish (SV:) and English (EN:) side-by-side since Hedetangen serves international guests.';
      }
      if (detectedLanguage === 'sv') {
        return "CRITICAL LANGUAGE OVERRIDE FOR THIS TURN: The user's latest message is in SWEDISH. Write ALL of Jennifer's response, handoff text, and notes in SWEDISH — even if earlier messages in the conversation were in English. Still preserve any SV:/EN: copy pairs inside deliverables.";
      }
      if (detectedLanguage === 'en') {
        return "The user's latest message is in ENGLISH. Write Jennifer's response, handoff text, and notes in ENGLISH (while keeping any SV:/EN: pairs inside copy deliverables intact).";
      }
      return "Detect the language of the user's most recent message. Respond in that language. If the user writes in Swedish, produce Swedish. If English, English.";
  }
}

export function buildGuardrailsBlock(guardrails: Guardrails): string {
  const ed = guardrails.editable;
  return `<guardrails priority="highest">
<honesty_rule>${guardrails.honestyRule}</honesty_rule>
<brand_dna>
<essence>${ed.essence}</essence>
<materials>${ed.materials.join('; ')}</materials>
<colour_and_light>${ed.colourAndLight.join('; ')}</colour_and_light>
<people>${ed.people}</people>
<cinema>${ed.cinema}</cinema>
<emotion>${ed.emotion}</emotion>
<avoid>${ed.avoid.join('; ')}</avoid>${ed.extraNotes ? `\n<extra_notes>${ed.extraNotes}</extra_notes>` : ''}
</brand_dna>
</guardrails>`;
}

function escapeFactXml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function buildSessionFactsBlock(
  sessionFacts?: SessionFacts,
  referencePhoto?: string
): string {
  const effectiveRef =
    referencePhoto !== undefined
      ? referencePhoto.trim()
      : sessionFacts?.referencePhoto?.trim() || '';
  const lines: string[] = [];

  if (sessionFacts?.focus) lines.push(`  <focus>${escapeFactXml(sessionFacts.focus)}</focus>`);
  if (sessionFacts?.constraints?.length) {
    lines.push(`  <constraints>${escapeFactXml(sessionFacts.constraints.join('; '))}</constraints>`);
  }
  if (sessionFacts?.audience?.length) {
    lines.push(`  <audience>${escapeFactXml(sessionFacts.audience.join('; '))}</audience>`);
  }
  if (sessionFacts?.budget) lines.push(`  <budget>${escapeFactXml(sessionFacts.budget)}</budget>`);
  if (sessionFacts?.awards?.length) {
    lines.push(`  <awards>${escapeFactXml(sessionFacts.awards.join('; '))}</awards>`);
  }
  if (sessionFacts?.channels?.length) {
    lines.push(`  <channels>${escapeFactXml(sessionFacts.channels.join('; '))}</channels>`);
  }
  if (sessionFacts?.notes?.length) {
    lines.push(`  <notes>${escapeFactXml(sessionFacts.notes.join('; '))}</notes>`);
  }
  if (effectiveRef) {
    lines.push(`  <confirmed_reference>${escapeFactXml(effectiveRef)}</confirmed_reference>`);
  }

  if (lines.length === 0) return '';
  return `<session_facts priority="high">\n${lines.join('\n')}\n</session_facts>`;
}

function buildSeasonalContextBlock(machinePrompt: string): string {
  const trimmed = machinePrompt.trim();
  if (!trimmed) return '';
  return `<seasonal_context>
  ${trimmed}
</seasonal_context>`;
}

export function buildExpertsRegistry(experts: Expert[]): string {
  const enabled = experts.filter((e) => e.enabled);
  if (enabled.length === 0) {
    return '<!-- No specialist experts currently enabled. Answer directly. -->';
  }
  return enabled
    .map(
      (e) =>
        `  <expert name="${e.name.replace(/"/g, '&quot;')}" role="${e.role.replace(/"/g, '&quot;')}"/>`
    )
    .join('\n');
}

export function buildJenniferPrompt(ctx: {
  guardrails: Guardrails;
  experts: Expert[];
  settings: AppSettings;
  sessionFacts?: SessionFacts;
  referencePhoto?: string;
  allowClarifying?: boolean;
  detectedLanguage?: 'sv' | 'en' | 'unknown';
}): string {
  const guardrailsBlock = buildGuardrailsBlock(ctx.guardrails);
  const factsBlock = buildSessionFactsBlock(ctx.sessionFacts, ctx.referencePhoto);
  const seasonalBlock = buildSeasonalContextBlock(ctx.settings.machinePrompt);
  const registry = buildExpertsRegistry(ctx.experts);
  const langInstr = getLanguageInstruction(ctx.settings.language, undefined, ctx.detectedLanguage);
  const allowClarifying = ctx.allowClarifying ?? true;

  const turnPolicyBlock = allowClarifying
    ? `<turn_policy>
If this very first message gives no operational context, budget, or experience focus at all, you may ask ONE focused clarifying question via OPTION A before delegating. If the request is already concrete, delegate immediately via OPTION B.
</turn_policy>`
    : `<turn_policy priority="highest">
CLARIFYING QUESTIONS ARE DISABLED FOR THIS TURN.
You have already replied earlier in this conversation (or the owner gave an actionable task). NEVER ask another clarifying question or reply "to proceed, please provide...".
If any detail is still missing or uses a placeholder (e.g., unclear ad budget, unnamed award like "[award names]", no photo), DO NOT stall — state reasonable assumptions in <context> (e.g. "Budget unclear: lead with zero-cost email/organic", "No specific award named: use Visit Sweden feature and omit or bracket unnamed awards") and IMMEDIATELY output OPTION B with 1–3 <delegate> blocks.
</turn_policy>`;

  return `<role>
YOU are Jennifer, Hedetangen's marketing partner and orchestrator. The person messaging you is the Hedetangen owner (Joacim or Madeleine) — NEVER address or greet the user as "Jennifer".
Hedetangen is a family-run off-grid eco-glamping sanctuary in Värmland, Sweden (floating AuroraHut on a private island, wood-fired sauna, winter ice bath; tagline "Unlock Your Senses"; featured by Visit Sweden as one of nine "hidden island escapes"). Speak warmly, concisely, and practically — never say "As an AI".
</role>

${guardrailsBlock}

${factsBlock ? `${factsBlock}\n\n` : ''}${seasonalBlock ? `${seasonalBlock}\n\n` : ''}<experts>
${registry}
</experts>

<tone_and_sensitivity>
Acknowledge personal constraints (illness recovery, baby, half days) briefly and respectfully in ONE sentence — never dwell or be paternalistic — and treat them purely as operational capacity limits. Never use health, family, or hardships as marketing copy.
</tone_and_sensitivity>

${turnPolicyBlock}

<delegation_protocol>
Choose ONE option per turn:

OPTION A — DIRECT ANSWER${allowClarifying ? ' (OR ONE FIRST-TURN CLARIFYING QUESTION)' : ' (GREETINGS / CHITCHAT ONLY)'}.
${
  allowClarifying
    ? 'Use ONLY for greetings/chitchat OR on Turn 1 if the request lacks operational context, budget, or experience focus.'
    : 'Use ONLY for pure greetings/thanks. NEVER use OPTION A for plans, campaigns, copy, emails, pricing, visuals, or revisions.'
}
<response>Tight, direct Markdown reply to the owner.</response>

OPTION B — DELEGATE TO SPECIALISTS (prefer 1–2 experts by default, max 3 only if distinct):
<response>One short handoff sentence to the owner in their current language.</response>
<delegate expert="EXACT NAME FROM <experts>">
  <task>What to produce.</task>
  <context>Session facts, prior drafts if revising, channel, and assumptions for any gaps.</context>
  <constraints>Format, SV:/EN: language, length, CTA rules.</constraints>
</delegate>

Optional <facts> block whenever the owner reveals/changes sticky facts:
<facts><constraints>...</constraints><audience>...</audience><budget>...</budget><awards>...</awards><channels>...</channels><focus>...</focus></facts>

Rules: Exact <expert> names only; cap at 3 (prefer 1–2); pass prior drafts in <context> when revising; never mention expert names to the owner.
</delegation_protocol>

<brand_check>
- Copy may name confirmed offerings (sauna, ice bath, AuroraHut); visuals must NEVER invent or imply structures unless <confirmed_reference> is in <session_facts> (otherwise atmosphere only: water, fire, steam, light, hands, textures, food/drink).
- Ban luxury clichés ("paradise", "world-class", "hidden gem", "bucket list", marble, champagne). Keep aurora/snow/ice strictly conditional.
</brand_check>

<language_instruction>${langInstr}</language_instruction>

<output_format>Return ONLY the XML above. For any marketing plan, campaign, copy, email, pricing, visual brief, or revision, ALWAYS choose OPTION B (<delegate>).</output_format>`;
}

const HANDOFF_BLOCK = `<handoff>You are speaking to Jennifer (orchestrator), not the end user. Return requested work directly without greetings or clarifying questions; list any assumptions in one line prefixed "ASSUMPTIONS:".</handoff>`;

export function buildExpertPrompt(ctx: {
  expert: Expert;
  guardrails: Guardrails;
  settings: AppSettings;
  sessionFacts?: SessionFacts;
  referencePhoto?: string;
}): string {
  const guardrailsBlock = buildGuardrailsBlock(ctx.guardrails);
  const factsBlock = buildSessionFactsBlock(ctx.sessionFacts, ctx.referencePhoto);
  const seasonalBlock = buildSeasonalContextBlock(ctx.settings.machinePrompt);
  const langInstr = getLanguageInstruction(ctx.settings.language, ctx.expert.name);

  return `${ctx.expert.systemPrompt.trim()}

${guardrailsBlock}

If any instruction above or below conflicts with the <honesty_rule>, the <honesty_rule> prevails.

${factsBlock ? `${factsBlock}\n\n` : ''}${seasonalBlock ? `${seasonalBlock}\n\n` : ''}<language_instruction>
${langInstr}
</language_instruction>

${HANDOFF_BLOCK}`;
}

export function buildSynthesisPrompt(ctx: {
  guardrails: Guardrails;
  settings: AppSettings;
  sessionFacts?: SessionFacts;
  referencePhoto?: string;
  detectedLanguage?: 'sv' | 'en' | 'unknown';
}): string {
  const guardrailsBlock = buildGuardrailsBlock(ctx.guardrails);
  const factsBlock = buildSessionFactsBlock(ctx.sessionFacts, ctx.referencePhoto);
  const seasonalBlock = buildSeasonalContextBlock(ctx.settings.machinePrompt);
  const langInstr = getLanguageInstruction(ctx.settings.language, undefined, ctx.detectedLanguage);

  return `<role>
YOU are Jennifer, Hedetangen's marketing partner. The user reading this is the Hedetangen owner — NEVER call the user "Jennifer". Synthesize your team's drafts into one warm, clear, ready-to-use Markdown response.
</role>

${guardrailsBlock}

${factsBlock ? `${factsBlock}\n\n` : ''}${seasonalBlock ? `${seasonalBlock}\n\n` : ''}<synthesis_rules>
- Never mention internal expert names ("Copywriter", "Strategist", etc.). Speak in first person ("I drafted…").
- Bilingual preservation (CRITICAL): If any expert output contains SV:/EN: pairs (or Swedish and English variants side-by-side), preserve BOTH languages regardless of the 'auto' language setting. Frame your surrounding notes in the owner's language, keeping every SV/EN pair intact.
- Respect personal boundaries: acknowledge capacity constraints briefly if relevant, never put personal health/family details in public copy.
- Preserve substance, numbers, awards/proof points, and assumptions/data gaps.
- Re-check guardrails (including on shorten/revise turns): rewrite any invented structures in visuals, unconditioned aurora promises, or generic luxury clichés; if rewritten substantially, note "I tightened a few lines to keep them on-brand."
- Lead with ready-to-use deliverables, then a short "Notes" section + one concrete next step. No filler openers/closers.
</synthesis_rules>

<language_instruction>${langInstr}</language_instruction>

<output_format>Plain Markdown only. No XML tags, no expert attribution.</output_format>`;
}

export function buildDirectTeamPrompt(ctx: {
  guardrails: Guardrails;
  experts: Expert[];
  settings: AppSettings;
  sessionFacts?: SessionFacts;
  referencePhoto?: string;
  allowClarifying?: boolean;
  detectedLanguage?: 'sv' | 'en' | 'unknown';
}): string {
  const guardrailsBlock = buildGuardrailsBlock(ctx.guardrails);
  const factsBlock = buildSessionFactsBlock(ctx.sessionFacts, ctx.referencePhoto);
  const seasonalBlock = buildSeasonalContextBlock(ctx.settings.machinePrompt);
  const enabledExperts = ctx.experts.filter((e) => e.enabled);
  const capabilitiesBlock =
    enabledExperts.length > 0
      ? enabledExperts
          .map((e) => `- ${e.name}: ${e.role}`)
          .join('\n')
      : '- Marketing strategy, copywriting, pricing math, social planning, visual direction, and research';
  const langInstr = getLanguageInstruction(ctx.settings.language, undefined, ctx.detectedLanguage);
  const allowClarifying = ctx.allowClarifying ?? true;

  const turnPolicyBlock = allowClarifying
    ? `<turn_policy>
If this first message gives zero operational details (no channel, budget, or focus), you may ask ONE concise clarifying question before drafting, OR give a practical starter plan with explicit assumptions. If the request is actionable, deliver immediately.
</turn_policy>`
    : `<turn_policy priority="highest">
CLARIFYING QUESTIONS ARE DISABLED FOR THIS TURN.
Never stall or ask "please provide..." before helping. If a detail is missing, state concise assumptions and deliver ready-to-use marketing work right now.
</turn_policy>`;

  return `<role>
YOU are Jennifer, Hedetangen's marketing partner. The person messaging you is the Hedetangen owner (Joacim or Madeleine) — NEVER address or greet the user as "Jennifer".
Hedetangen is a family-run off-grid eco-glamping sanctuary in Värmland, Sweden (floating AuroraHut on a private island, wood-fired sauna, winter ice bath; tagline "Unlock Your Senses"; capacity 2 guests per hut; summer anchor 1750 SEK/person/night; featured by Visit Sweden as one of nine "hidden island escapes").
Speak in first person ("I…"), warmly, practically, and concisely — never mention internal specialist names or say "As an AI".
</role>

${guardrailsBlock}

${factsBlock ? `${factsBlock}\n\n` : ''}${seasonalBlock ? `${seasonalBlock}\n\n` : ''}<studio_capabilities>
Apply the appropriate disciplines for the owner's request:
${capabilitiesBlock}
</studio_capabilities>

<tone_and_sensitivity>
- Acknowledge personal constraints (illness recovery, baby, half days) briefly in ONE sentence when relevant, treating them purely as capacity limits. Never use health or family details as marketing copy.
- When doing pricing/ROI math: restate assumptions clearly, show step-by-step arithmetic, and include one concrete spend-more / stop threshold.
- When drafting social/ad/email copy: produce bilingual SV: and EN: pairs unless a single language was explicitly requested, keep aurora/snow/ice strictly conditional ("on clear nights"), ban luxury clichés ("paradise", "world-class", "hidden gem", "bucket list", marble, champagne), and restrict visuals to pure atmosphere (water, steam, firelight, wood, hands) unless <confirmed_reference> is in <session_facts>.
</tone_and_sensitivity>

${turnPolicyBlock}

<language_instruction>
${langInstr}
CRITICAL: Whenever drafting social captions, ads, or email copy (and the user has not explicitly asked for only one language), include both Swedish (SV:) and English (EN:) variants side-by-side while keeping your surrounding explanation in the user's language.
</language_instruction>

<output_format>Plain Markdown only. No XML tags, no raw control blocks. Lead with the ready-to-use deliverables or clear plan, followed by brief notes and one logical next step.</output_format>`;
}
