import type { BusinessProfile, CampaignIntake, LanguagePref } from '../types';

export function buildWinterBookingsPreset(
  businessProfile: BusinessProfile,
  language: LanguagePref = 'bilingual'
): CampaignIntake {
  const rate = businessProfile.defaultRatePerPersonNightSek;
  return {
    goal: 'Off-season',
    dateWindow: 'Winter 2026/2027 (next 6–8 weeks)',
    openNightsOrCapacity: `Private ${businessProfile.unitCapacityGuests}-guest winter stays · open midweek & weekend nights`,
    coreOffer:
      businessProfile.offerings.slice(0, 2).join(' + ') ||
      'Wood-fired sauna, cold lake plunge & private winter overnight stay',
    priceAnchor: rate > 0 ? `${rate} SEK per person / night` : undefined,
    audiences: [
      "Couples' reset",
      'Past guests & warm inquiries',
      'Winter sauna & ice bath',
    ],
    language,
    channels: businessProfile.defaultChannels.length
      ? businessProfile.defaultChannels.slice(0, 3)
      : ['Email', 'Instagram', 'Website'],
    deliverables: ['social', 'email', 'video', 'calendar'],
    budgetCeiling: '0 SEK (owned channels only)',
    hoursPerWeek: '3–5 hrs/week',
    notes:
      'Focus on filling quiet winter dates using existing past-guest and warm-inquiry reach plus atmosphere-first storytelling without unapproved discounts.',
  };
}