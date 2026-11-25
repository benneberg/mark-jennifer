import type { Guardrails } from '../types';

export const IMMUTABLE_HONESTY_RULE =
  'Honesty Rule (highest priority): Never depict, invent, or imply the real Hedetangen place, AuroraHut, sauna, island, dock, boat, or accommodation unless a reference photo is supplied. Without a reference, generate only generic atmosphere scenes: water, light, fire, textures, hands, natural details, food and drink. Never overpromise weather-dependent phenomena such as northern lights.';

export function createSeedGuardrails(timestamp = '2026-01-15T10:00:00.000Z'): Guardrails {
  return {
    id: 'default',
    version: 4,
    honestyRule: IMMUTABLE_HONESTY_RULE,
    editable: {
      essence:
        'Genuine, understated luxury in raw Swedish nature. Rustic luxury, never glamorous luxury. Simple meets luxury. Nothing staged.',
      materials: [
        'Solid wood with visible grain',
        'Stone',
        'Rope',
        'Leather',
        'Linen',
        'Wool',
        'Sheepskin',
        'Glass',
        'Weathered bronze and copper',
      ],
      colourAndLight: [
        'Warm earth tones (deep wood, forest green, moss, bronze, copper, cream, charcoal, soft gold)',
        'Natural cool tones in winter, dusk, and water',
        'Golden hour, blue hour, firelight, lantern glow, mist, reflections',
        'Soft natural light only',
      ],
      people:
        'At most one person, relaxed and real, often just hands or feet. Never posed, never model-like. Faces not required.',
      cinema:
        'High-end Scandinavian nature cinematography, photorealistic. Single continuous slow camera move or static, shallow depth of field, tactile close-ups, natural motion. Each shot expresses one sensory feeling.',
      emotion: 'Serenity, presence, warmth, discovery. Authenticity over perfection.',
      avoid: [
        'Invented structures or locations',
        'Generic luxury clichés (marble, champagne buckets, paradise, world-class)',
        'Plastic, neon, oversaturated look',
        'Urban settings, crowds',
        'Fast cuts, music, text, logos, watermarks, zoom loops',
      ],
      extraNotes:
        'Hedetangen is a family-run eco-tourism business in Värmland, Sweden (Joacim & Madeleine). Tagline: "Unlock Your Senses." Visit Sweden named it one of nine hidden island escapes in Sweden.',
    },
    editedBy: 'Brand DNA v4',
    updatedAt: timestamp,
    history: [],
  };
}
