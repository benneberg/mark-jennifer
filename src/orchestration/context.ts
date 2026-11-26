import {
  HISTORY_MAX_EXPERT_MESSAGES,
  HISTORY_MAX_MESSAGES,
  HISTORY_MAX_TOKENS_APPROX,
} from '../constants';
import type { ChatCompletionMessage, ChatMessage, Expert, SessionFacts } from '../types';

export function resolveExpert(nameOrId: string, experts: Expert[]): Expert | null {
  const target = nameOrId.trim().toLowerCase();
  if (!target) return null;
  const byName = experts.find((e) => e.enabled && e.name.toLowerCase() === target);
  if (byName) return byName;
  const byId = experts.find((e) => e.enabled && e.id.toLowerCase() === target);
  return byId ?? null;
}

export function trimChatHistory(
  messages: ChatMessage[],
  maxMessages = HISTORY_MAX_MESSAGES
): ChatCompletionMessage[] {
  // Only include user and jennifer complete/stopped messages; exclude expert internals & error cards
  const eligible = messages.filter(
    (m) =>
      (m.role === 'user' || m.role === 'jennifer') &&
      m.status !== 'error' &&
      m.content.trim().length > 0
  );

  const recent = eligible.slice(-maxMessages);
  const result: ChatCompletionMessage[] = [];
  let approxTokens = 0;

  // Walk backwards so most recent messages are always kept first
  for (let i = recent.length - 1; i >= 0; i--) {
    const m = recent[i];
    const msgTokens = Math.ceil(m.content.length / 4) + 8;
    if (approxTokens + msgTokens > HISTORY_MAX_TOKENS_APPROX && result.length > 0) {
      break;
    }
    approxTokens += msgTokens;
    result.unshift({
      role: m.role === 'user' ? 'user' : 'assistant',
      content: m.content,
    });
  }

  return result;
}

export function trimExpertHistory(messages: ChatMessage[]): ChatCompletionMessage[] {
  const recent = trimChatHistory(messages, HISTORY_MAX_EXPERT_MESSAGES);
  return recent.map((m) => ({
    role: m.role,
    content: m.content.length > 1400 ? `${m.content.slice(0, 1400)}\n… [trimmed]` : m.content,
  }));
}

function uniqueItems(items: Array<string | undefined>, max = 12): string[] | undefined {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of items) {
    const clean = raw?.trim();
    if (!clean) continue;
    const key = clean.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(clean.slice(0, 280));
    if (out.length >= max) break;
  }
  return out.length > 0 ? out : undefined;
}

export function extractDeterministicFacts(
  userMessage: string,
  referencePhoto?: string
): Partial<SessionFacts> {
  const patch: Partial<SessionFacts> = {};
  const text = userMessage.trim();
  const lower = text.toLowerCase();

  const constraints: string[] = [];
  if (/(just us two|two of us|two founders|bara vi två|1\.5\s*fte)/i.test(text)) {
    constraints.push('Two-person team operating at reduced capacity (~1.5 FTE)');
  }
  if (/(half days?|halvdagar|recovering|hospital|sjukhus)/i.test(text)) {
    constraints.push('One founder working half days while recovering');
  }
  if (/(baby|månaders|month old|newborn|bebis)/i.test(text)) {
    constraints.push('Founders caring for an infant at home (keep cadence minimal and practical)');
  }
  if (/(not much money|inte så mycket pengar|tight budget|låg budget|liten budget)/i.test(text)) {
    constraints.push('Tight ad budget — prioritize zero-cost owned channels first');
  }
  if (constraints.length > 0) patch.constraints = constraints;

  const audience: string[] = [];
  const guestMatch = text.match(/(\d+\+?)\s+(?:previous|past)\s+guests/i);
  if (guestMatch) {
    audience.push(`${guestMatch[1]} previous guests (email list)`);
  }
  const leadMatch = text.match(/(\d+\+?)\s+(?:people who asked|leads|prospects|inquir)/i);
  if (leadMatch) {
    audience.push(`${leadMatch[1]} interested inquiries (email list)`);
  }
  if (/tidigare gäster|epostlista|email list|our list/i.test(lower) && audience.length === 0) {
    audience.push('Existing past-guest & inquiry email list');
  }
  if (audience.length > 0) patch.audience = audience;

  const budgetMatch = text.match(/\b(\d[\d\s]{1,8})\s*(?:kr|sek)\b/i);
  if (budgetMatch) {
    const amount = budgetMatch[1].replace(/\s+/g, '');
    patch.budget = `${amount} SEK max ad spend`;
  }

  const awards: string[] = [];
  if (/visit\s+sweden/i.test(text)) {
    awards.push('Featured by Visit Sweden as one of Sweden\'s "hidden island escapes"');
  }
  const wonMatch =
    text.match(/\b(?:we won|we've won|won)\s+([^.!?\n]{3,100})/i) ??
    text.match(/\baward(?:s)?\s*[:\-]\s*([^.!?\n]{3,100})/i);
  if (wonMatch) {
    const rawWon = wonMatch[1]
      .replace(/\band we were in\b.*$/i, '')
      .replace(/\bthat we can mention\b/gi, '')
      .trim();
    if (rawWon && !/^\[.*\]/.test(rawWon) && !/the award names/i.test(rawWon)) {
      awards.push(`Award: ${rawWon}`);
    }
  }
  if (awards.length > 0) patch.awards = awards;

  const channels: string[] = [];
  if (/instagram/i.test(lower)) channels.push('Instagram');
  if (/facebook/i.test(lower)) channels.push('Facebook');
  if (/\b(email|e-?mail|mejl|nyhetsbrev|list)\b/i.test(lower)) channels.push('Email list');
  if (channels.length > 0) patch.channels = channels;

  if (/(sauna|bastu).*(ice\s*bath|isbad)|(ice\s*bath|isbad).*(sauna|bastu)/i.test(lower)) {
    patch.focus = 'Winter sauna and ice bath campaign';
  } else if (/(winter|vinter)/i.test(lower) && /(aurora|norrsken|sauna|bastu)/i.test(lower)) {
    patch.focus = 'Winter campaign (sauna, ice bath, weather-conditional aurora)';
  }

  if (referencePhoto !== undefined) {
    patch.referencePhoto = referencePhoto.trim();
  }

  return patch;
}

export function detectMessageLanguage(text: string): 'sv' | 'en' | 'unknown' {
  const trimmed = text.trim();
  if (!trimmed) return 'unknown';

  const svDiacritics = (trimmed.match(/[åäöÅÄÖ]/g) ?? []).length;
  const svWords = (
    trimmed.match(
      /\b(kan|vi|ska|och|för|med|till|inte|så|mycket|pengar|kampanj|bastu|isbad|vintern|vinter|kortare|mindre|mejl|epost|gäster|annonser|just nu|vad|gör|behöver|skriva|skriv|hej|tack)\b/gi
    ) ?? []
  ).length;
  const enWords = (
    trimmed.match(
      /\b(the|and|we|what|would|you|can|make|shorter|write|email|for|our|list|winter|bookings|ads|budget|awards|use|that|ok|now|please|some|sample|how|this|week)\b/gi
    ) ?? []
  ).length;

  const svScore = svDiacritics * 2 + svWords * 2;
  const enScore = enWords * 2;

  if (svScore >= 2 && svScore >= enScore) return 'sv';
  if (enScore >= 2) return 'en';
  return 'unknown';
}

export function isActionableMarketingRequest(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;
  const isSimpleGreeting =
    /^(hej|hi|hello|hey|tack|thanks|thank you|who are you|vem är du|what can you do)[!.?\s]*$/i.test(
      trimmed
    );
  if (isSimpleGreeting) return false;

  return /(what would you|this week|plan|strategy|campaign|kampanj|caption|copy|rewrite|shorten|kortare|less poetic|email|mejl|epost|nyhetsbrev|newsletter|post|instagram|facebook|calendar|kalender|budget|3000|kr|sek|pricing|price|roi|break.?even|award|sample|visit sweden|visual|shot|video|photo|research|competitor|trend|sauna|bastu|ice bath|isbad|bookings|bokningar)/i.test(
    trimmed
  );
}

export function mergeSessionFacts(
  existing: SessionFacts | undefined,
  ...patches: Array<Partial<SessionFacts> | undefined>
): SessionFacts {
  const merged: SessionFacts = { ...(existing ?? {}) };

  for (const p of patches) {
    if (!p) continue;
    if (p.constraints?.length) {
      merged.constraints = uniqueItems([...(merged.constraints ?? []), ...p.constraints]);
    }
    if (p.audience?.length) {
      merged.audience = uniqueItems([...(merged.audience ?? []), ...p.audience]);
    }
    if (p.budget?.trim()) {
      merged.budget = p.budget.trim().slice(0, 200);
    }
    if (p.awards?.length) {
      merged.awards = uniqueItems([...(merged.awards ?? []), ...p.awards]);
    }
    if (p.channels?.length) {
      merged.channels = uniqueItems([...(merged.channels ?? []), ...p.channels]);
    }
    if (p.focus?.trim()) {
      merged.focus = p.focus.trim().slice(0, 400);
    }
    if (p.referencePhoto !== undefined) {
      const cleanRef = p.referencePhoto.trim();
      if (cleanRef) {
        merged.referencePhoto = cleanRef.slice(0, 1000);
      } else {
        delete merged.referencePhoto;
      }
    }
    if (p.notes?.length) {
      merged.notes = uniqueItems([...(merged.notes ?? []), ...p.notes]);
    }
  }

  return merged;
}
