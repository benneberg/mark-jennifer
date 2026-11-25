# Hedetangen AI Marketing Studio

A client-side, mobile-first AI marketing workspace built for **Hedetangen** — a family-run eco-tourism sanctuary in Värmland, Sweden offering off-grid glamping in a floating AuroraHut on a private island, paired with wood-fired sauna and ice-bath experiences.

All persistence, orchestration, and Brand DNA enforcement run directly in your browser with zero backend servers and zero telemetry.

---

## Key Capabilities

- **Single Point of Contact (Jennifer)**: Conversational marketing partner that handles simple questions directly or deterministically delegates specialized tasks across six built-in experts (`Copywriter`, `Marketing Strategist`, `Social Media Strategist`, `Business & Pricing Analyst`, `Visual Director`, `Researcher`).
- **Immutable Brand DNA Guardrails**: Every AI call automatically inherits the Brand DNA and **Honesty Rule** (never invent or imply places, buildings, or amenities without a supplied reference; generate atmosphere-only visuals unless referenced). Editable Brand DNA attributes include 5-snapshot undo history.
- **Bring Your Own Key (BYOK) + Encrypted Local Storage**: Supports **Groq**, **OpenRouter** (free models highlighted), **OpenAI**, and an offline **Demo Mode** (`MockProvider`) that works immediately without an API key. API keys are encrypted at rest in IndexedDB via Web Crypto (`AES-GCM` 256-bit with a non-extractable `CryptoKey`), or held in session memory only.
- **Guided Campaign Builder (Wizard)**: 3-step structured flow (*Objective & Audience → Channels & Formats → Brand Guardrails Review*) to produce complete bilingual (SV/EN) campaign briefs and ad variants.
- **Content Library**: Save, search, tag, filter, copy, and export generated copy, campaigns, research briefs, and visual directions to JSON or Markdown.
- **Expert Role Manager (CRUD)**: Enable, disable, edit, create, or import/export specialist prompts with schema validation.
- **Full Studio Portability**: Export and import the entire workspace (experts, Brand DNA guardrails, content library, settings, and optional chat history) as a schema-validated JSON bundle — API keys are never exported.

---

## Project Structure

```
/
├── index.html                  # App entry point & font setup
├── README.md                   # This file
├── docs/                       # Canonical product & technical specs
│   ├── CONCEPT_NOTES.md
│   ├── PRD.md
│   ├── ARCHITECTURE.md
│   ├── SCHEMAS.md
│   ├── PROMPTS.md
│   └── UI_SPEC.md
├── schemas/                    # JSON Schema (draft-07 subset) definitions
│   ├── expert.schema.json
│   ├── guardrails.schema.json
│   ├── settings.schema.json
│   ├── library-item.schema.json
│   ├── message.schema.json
│   ├── chat.schema.json
│   └── export-package.schema.json
└── src/
    ├── constants.ts            # App version, storage keys, defaults
    ├── types.ts                # Core TypeScript domain types
    ├── data/                   # Seed experts, Brand DNA v4, curated model metadata
    ├── utils/                  # UUID, dates, JSON Schema validator, safe Markdown
    ├── storage/                # IndexedDB wrapper, Web Crypto AES-GCM, validated CRUD
    ├── providers/              # Groq, OpenRouter, OpenAI, Mock + AIError taxonomy
    ├── orchestration/          # Jennifer orchestrator loop, XML parser, prompt builders
    └── components/             # Mobile-first Scandinavian UI & drawers
```

---

## Getting Started

### Prerequisites

- Node.js 20+
- npm 10+

### Local Development

```bash
npm install
npm run dev
```

Open `http://localhost:3000` in your browser.

> **Secure Context Note**: Web Crypto API key encryption requires HTTPS or `localhost`. GitHub Pages serves over HTTPS by default.

### Try Without an API Key (Demo Mode)

1. Open the app and click **Try demo mode** on the welcome card (or open **Settings → Provider → Demo**).
2. Send any prompt or tap one of the starter chips to see Jennifer's full 3-step delegation, inline expert activity, Brand DNA check, and streaming synthesis.

### Using Live Providers (Groq / OpenRouter / OpenAI)

1. Open **Settings** from the header.
2. Choose your provider (**Groq** is recommended for fast free-tier testing).
3. Paste your API key and click **Validate & load models**.
4. Pick a model (free models are listed first with indicative rate-limit notes).
5. Your key is encrypted in your browser's IndexedDB and is only transmitted directly to your selected provider's API endpoint.

---

## Keyboard Shortcuts (Desktop)

| Shortcut | Action |
| :--- | :--- |
| `Enter` | Send message |
| `Shift + Enter` | Insert newline |
| `Esc` | Close active drawer/modal or stop active generation |
| `Cmd / Ctrl + K` | Focus message composer |
| `Cmd / Ctrl + Shift + L` | Toggle Content Library panel |

---

## Debug Panel

Append `?debug=1` to the URL or tap the app version label in **Settings → About** 7 times to inspect per-turn AI call counts, request durations, XML delegation parse warnings, and recent normalized errors.

---

## Building & Static Deployment (GitHub Pages)

```bash
npm run build
```

This generates static assets inside `dist/` that can be deployed directly to GitHub Pages or any static host without a backend server.

---

## Manual Verification Checklist

- [ ] **First-run**: Welcome card displays; Demo mode works without any API key.
- [ ] **Key Encryption & Model Load**: Entering a valid key encrypts it in IndexedDB `keys` store, loads provider models, and populates the grouped selector.
- [ ] **Direct Turn**: Simple conversational query ("Hi Jennifer, what can you do?") resolves in 1 AI call without delegation.
- [ ] **Delegated Turn**: Requesting Instagram captions triggers Jennifer planning → Copywriter execution → Jennifer synthesis with inline status strip.
- [ ] **Cancellation**: Clicking Stop (`■`) aborts the in-flight request and preserves partial text with a stopped marker.
- [ ] **Error Recovery**: Invalid key (`401`) or rate limit (`429`) renders an inline Jennifer recovery card with actionable buttons.
- [ ] **Brand Guardrails**: Honesty Rule remains locked at the top of Brand Guardrails; editable attributes save with undo history.
- [ ] **Library & Export/Import**: Save output to library, filter/search, export full studio JSON, and verify merge/replace import validation.
- [ ] **Mobile & Accessibility**: Verified at `375px` mobile width (`44×44px` touch targets, full-screen drawers) and `1440px` desktop width (two-column workspace with collapsible right rail).
