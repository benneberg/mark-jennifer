import type {
  BusinessProfile,
  CampaignDeliverableKind,
  CampaignIntake,
  HonestyLintIssue,
} from '../types';

const VISUAL_STRUCTURE_PATTERN =
  /\b(aurora\s*hut|floating\s+hut|glamping\s+hut|cabin|stuga|sauna\s+building|sauna\s+cabin|bastubyggnad|dock|pier|jetty|brygga|boat|båt|island\s+silhouette|exterior\s+of\s+the)\b/gi;

const WEATHER_GUARANTEE_PATTERNS: RegExp[] = [
  /\b(guaranteed|guarantee|garanterat|garanti|säkert|always\s+visible|every\s+night|every\s+evening|varje\s+kväll|varje\s+natt|promise\s+of|100%)\s+(?:the\s+)?(northern\s+lights|aurora|norrsken|snow|snö|ice|is|clear\s+skies)\b/gi,
  /\b(northern\s+lights|aurora|norrsken|snow|snö|ice|is)\s+(?:are|is|will\s+be|är)\s+(guaranteed|certain|garanterat|säkert|promised)\b/gi,
];

const DISCOUNT_PATTERN =
  /\b(\d+\s*%\s*(?:off|rabatt)|discount|rabatt|half\s*price|halva\s*priset|2[- ]for[- ]1|free\s+night|gratis\s+natt)\b/gi;

const PRICE_PATTERN = /\b(\d[\d\s.,]{0,10})\s*(sek|kr|eur|usd)\b|[€$]\s*(\d[\d\s.,]{0,10})/gi;

function isNegatedContext(text: string, matchIndex: number): boolean {
  const prefix = text.slice(Math.max(0, matchIndex - 32), matchIndex).toLowerCase();
  return /\b(no|without|never|not|avoid|inget|inga|utan|ej)\s+(?:\w+\s+){0,2}$/.test(prefix);
}

function extractVisualSegments(structured: unknown, fallbackMarkdown: string): string[] {
  const segments: string[] = [];
  if (structured && typeof structured === 'object') {
    const obj = structured as Record<string, unknown>;
    if (Array.isArray(obj.posts)) {
      for (const p of obj.posts) {
        if (p && typeof p === 'object' && typeof (p as Record<string, unknown>).visualDirection === 'string') {
          segments.push((p as Record<string, string>).visualDirection);
        }
      }
    }
    if (Array.isArray(obj.variants)) {
      for (const v of obj.variants) {
        if (v && typeof v === 'object' && typeof (v as Record<string, unknown>).visualDirection === 'string') {
          segments.push((v as Record<string, string>).visualDirection);
        }
      }
    }
    if (Array.isArray(obj.shots)) {
      for (const s of obj.shots) {
        if (s && typeof s === 'object') {
          const rec = s as Record<string, unknown>;
          if (typeof rec.scene === 'string') segments.push(rec.scene);
          if (typeof rec.camera === 'string') segments.push(rec.camera);
        }
      }
    }
    if (Array.isArray(obj.items)) {
      for (const it of obj.items) {
        if (it && typeof it === 'object' && typeof (it as Record<string, unknown>).notes === 'string') {
          segments.push((it as Record<string, string>).notes);
        }
      }
    }
  }
  if (segments.length === 0 && fallbackMarkdown) {
    segments.push(fallbackMarkdown);
  }
  return segments;
}

function collectAllowedNumericTokens(
  intake: Pick<CampaignIntake, 'priceAnchor' | 'budgetCeiling' | 'coreOffer' | 'notes'>,
  businessProfile?: BusinessProfile
): Set<string> {
  const sources = [
    intake.priceAnchor ?? '',
    intake.budgetCeiling ?? '',
    intake.coreOffer ?? '',
    intake.notes ?? '',
  ];
  if (businessProfile?.defaultRatePerPersonNightSek) {
    sources.push(String(businessProfile.defaultRatePerPersonNightSek));
    sources.push(String(businessProfile.defaultRatePerPersonNightSek * businessProfile.unitCapacityGuests));
  }
  const nums = new Set<string>();
  for (const src of sources) {
    const matches = src.match(/\d[\d\s.,]*/g) ?? [];
    for (const m of matches) {
      const normalized = m.replace(/[\s.,]/g, '');
      if (normalized) nums.add(normalized);
    }
  }
  return nums;
}

function collectSuppliedDiscountsText(
  intake: Pick<CampaignIntake, 'priceAnchor' | 'coreOffer' | 'notes'>
): string {
  return `${intake.priceAnchor ?? ''} ${intake.coreOffer ?? ''} ${intake.notes ?? ''}`.toLowerCase();
}

export function lintCampaignOutput(params: {
  kind: CampaignDeliverableKind | 'strategy';
  markdown: string;
  structured?: unknown;
  intake: Pick<
    CampaignIntake,
    'priceAnchor' | 'budgetCeiling' | 'coreOffer' | 'notes' | 'referencePhoto'
  >;
  businessProfile?: BusinessProfile;
}): HonestyLintIssue[] {
  const { kind, markdown, structured, intake, businessProfile } = params;
  const issues: HonestyLintIssue[] = [];
  const hasReferencePhoto = Boolean(intake.referencePhoto?.trim());

  // 1. Invented physical structures in visual prompts/directions when no reference photo is supplied
  if (!hasReferencePhoto && (kind === 'video' || kind === 'social' || kind === 'ad' || kind === 'calendar')) {
    const visualSegments =
      kind === 'video' ? extractVisualSegments(structured, markdown) : extractVisualSegments(structured, '');
    for (const seg of visualSegments) {
      const rx = new RegExp(VISUAL_STRUCTURE_PATTERN.source, 'gi');
      let m: RegExpExecArray | null;
      while ((m = rx.exec(seg)) !== null) {
        if (isNegatedContext(seg, m.index)) continue;
        issues.push({
          code: 'INVENTED_STRUCTURE',
          severity: 'error',
          message: `Visual direction mentions "${m[0]}" without a supplied reference photo. Use atmosphere-only imagery (water, fire, steam, light, hands, textures).`,
          snippet: seg.slice(Math.max(0, m.index - 24), m.index + m[0].length + 24),
        });
        break;
      }
    }
  }

  // 2. Unconditioned weather / aurora guarantees
  for (const pattern of WEATHER_GUARANTEE_PATTERNS) {
    const rx = new RegExp(pattern.source, 'gi');
    const match = rx.exec(markdown);
    if (match) {
      issues.push({
        code: 'WEATHER_GUARANTEE',
        severity: 'error',
        message: `Contains unconditioned weather/aurora claim ("${match[0]}"). Keep northern lights, snow, and ice strictly conditional.`,
        snippet: match[0],
      });
    }
  }

  // 3. Unsupplied discounts or invented prices
  const suppliedDiscountText = collectSuppliedDiscountsText(intake);
  const discRx = new RegExp(DISCOUNT_PATTERN.source, 'gi');
  let discMatch: RegExpExecArray | null;
  while ((discMatch = discRx.exec(markdown)) !== null) {
    const token = discMatch[0].toLowerCase().trim();
    if (isNegatedContext(markdown, discMatch.index)) continue;
    if (!suppliedDiscountText.includes(token)) {
      issues.push({
        code: 'UNSUPPLIED_PRICE_OR_DISCOUNT',
        severity: 'error',
        message: `Mentions discount "${discMatch[0]}" that was not provided in the offer/intake.`,
        snippet: discMatch[0],
      });
      break;
    }
  }

  const allowedNums = collectAllowedNumericTokens(intake, businessProfile);
  const priceRx = new RegExp(PRICE_PATTERN.source, 'gi');
  let priceMatch: RegExpExecArray | null;
  while ((priceMatch = priceRx.exec(markdown)) !== null) {
    const rawNum = (priceMatch[1] || priceMatch[3] || '').replace(/[\s.,]/g, '');
    if (!rawNum) continue;
    if (!allowedNums.has(rawNum)) {
      issues.push({
        code: 'UNSUPPLIED_PRICE_OR_DISCOUNT',
        severity: 'error',
        message: `Introduces unsupplied price "${priceMatch[0].trim()}". Only cite prices provided in the intake or business profile.`,
        snippet: priceMatch[0].trim(),
      });
      break;
    }
  }

  return issues;
}
