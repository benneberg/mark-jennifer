import type { BusinessProfile, CampaignIntake } from '../types';

export interface CampaignRouteSuggestion {
  label: string;
  summary: string;
  prefill: Partial<CampaignIntake>;
}

export function detectCampaignIntent(
  userMessage: string,
  businessProfile?: BusinessProfile
): CampaignRouteSuggestion | null {
  const text = userMessage.trim();
  if (!text) return null;

  const isBookingOrCampaign =
    /\b(bookings?|bokningar|fill\s+(?:the\s+)?(?:nights|weekends|calendar)|winter\s+is\s+(?:dead|slow|quiet)|need\s+guests|launch\s+(?:a\s+)?campaign|kampanj|off[- ]?season\s+push|summer\s+push)\b/i.test(
      text
    );

  if (!isBookingOrCampaign) return null;

  const lower = text.toLowerCase();
  const seasonWindow = /(winter|vinter|december|january|february|januari|februari)/i.test(lower)
    ? 'Winter season (next 4–6 weeks)'
    : /(spring|vår|april|may|maj)/i.test(lower)
      ? 'Spring shoulder season'
      : /(summer|sommar|june|july|august|juni|juli|augusti)/i.test(lower)
        ? 'Summer peak season'
        : 'Next 4–6 weeks';

  const channels: string[] = [];
  if (/\b(email|e-?mail|mejl|list|lista|guests?)\b/i.test(lower)) channels.push('Email');
  if (/instagram/i.test(lower)) channels.push('Instagram');
  if (/facebook/i.test(lower)) channels.push('Facebook');
  if (channels.length === 0) {
    channels.push('Email', 'Instagram');
  }

  const budgetMatch = text.match(/\b(\d[\d\s]{1,8})\s*(?:kr|sek)\b/i);
  const budgetCeiling = budgetMatch
    ? `${budgetMatch[1].replace(/\s+/g, '')} SEK`
    : /(not much money|no budget|zero budget|inte så mycket pengar)/i.test(lower)
      ? '0 SEK (owned channels first)'
      : '0–3000 SEK (owned channels first)';

  const hoursPerWeek = /(half days?|halvdagar|limited|busy|inte mycket tid)/i.test(lower)
    ? '3–5 hrs/week'
    : '5–8 hrs/week';

  const defaultOffer =
    /(sauna|bastu|ice bath|isbad|winter|vinter)/i.test(lower)
      ? 'Wood-fired sauna, cold lake plunge & private overnight stay'
      : businessProfile?.offerings.slice(0, 2).join(' + ') || 'Private island overnight stay';

  return {
    label: `Build ${seasonWindow.split(' ')[0]} Campaign Package`,
    summary:
      'Open the guided Campaign Package Builder pre-filled from your message to generate strategy, phased checklist, copy, and calendar.',
    prefill: {
      goal: /(off[- ]?season|dead|slow|quiet)/i.test(lower) ? 'Off-season' : 'Bookings',
      dateWindow: seasonWindow,
      coreOffer: defaultOffer,
      channels,
      budgetCeiling,
      hoursPerWeek,
      deliverables: ['social', 'email', 'calendar'],
    },
  };
}
