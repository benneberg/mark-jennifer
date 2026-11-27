# Mark & Jennifer — AI Marketing Studio for small and medium sized businesses

A client-side, mobile-first AI marketing workspace built for **Hedetangen** — a family-run eco-tourism sanctuary in Värmland, Sweden offering off-grid glamping in a floating AuroraHut on a private island, paired with wood-fired sauna and ice-bath experiences.

All persistence, orchestration, and Brand DNA enforcement run directly in your browser with zero backend servers and zero telemetry.

Live build: <https://benneberg.github.io/mark-jennifer/>

---

## Key Capabilities

- **Single Point of Contact (Jennifer)**: conversational marketing partner with two response modes (see below). In **Team** mode Jennifer plans, delegates to six built-in experts (`Copywriter`, `Marketing Strategist`, `Social Media Strategist`, `Business & Pricing Analyst`, `Visual Director`, `Researcher`), then synthesizes their drafts into one answer.
- **Two response modes** (Settings → Response Mode):
  - **Direct (default, 1 AI call)**: one streaming response that applies all specialist disciplines inline. Cheapest and fast, which matters on free tiers.
  - **Team (3–5 calls)**: planner → specialist experts → synthesis. This is the full orchestration path described above. Demo Mode always runs Team mode so the whole pipeline can be inspected without an API key.
- **Immutable Brand DNA Guardrails**: every AI call inherits the Brand DNA and the **Honesty Rule** (never invent or imply places, buildings, or amenities without a supplied reference; atmosphere-only visuals unless referenced). Editable attributes include a 5-snapshot undo history.
- **Bring Your Own Key (BYOK) + local key storage**: supports **Groq**, **OpenRouter** (free models highlighted), **OpenAI**, plus an offline **Demo Mode** that works immediately without a key. Keys are AES-GCM 256 encrypted in IndexedDB with a non-extractable `CryptoKey`, or kept in session memory only.
- **Guided Campaign Builder (Wizard)**: 3-step flow (*Objective & Audience → Channels & Formats → Brand Guardrails Review*) producing bilingual (SV/EN) campaign briefs and ad variants.
- **Content Library**: save, search, tag, filter, copy, and export generated copy, campaigns, research briefs, and visual directions to JSON or Markdown.
- **Expert Role Manager (CRUD)**: enable, disable, edit, create, or import/export specialist prompts with schema validation.
- **Full Studio Portability**: export and import the entire workspace (experts, Brand DNA, library, settings, optional chat history) as a schema-validated JSON bundle — API keys are never exported, and an import is applied atomically.

---

## Security & Privacy Model (stated plainly)

- Keys never leave the device except as `Authorization` headers to the provider you selected. They are never rendered in the DOM and are excluded from exports.
- Encryption at rest defends against casual inspection of IndexedDB. The non-extractable AES key lives in the **same origin**, so it does **not** defend against XSS, a malicious extension, or a compromised browser. That is an honest limitation, not a guarantee.
- The app is built with a `Content-Security-Policy` (injected at build time by `vite.config.ts`) that restricts `script-src` to the app itself and `connect-src` to the three provider hosts.
- The only third-party request is the two web fonts, loaded from Google Fonts. Nothing about your chats or keys is included in that request.
- If a stored key can no longer be decrypted (browser storage cleared, secure context changed), the app says so and asks you to paste it again instead of failing every turn with "key rejected".

---

## Project Structure

```
/
├── index.html                  # App entry point & font setup
├── docs/                       # Product & technical specs (see "Docs & design intent")
├── schemas/                    # JSON Schema (draft-07 subset) definitions
├── public/                     # Static files served as-is
├── tests/                      # node:test suites (orchestration, storage, validation, providers, markdown)
└── src/
    ├── App.tsx                 # Shell: chat lifecycle, streaming, panels, persistence
    ├── constants.ts            # App version, storage keys, limits, privacy notice
    ├── types.ts                # Core TypeScript domain types
    ├── components/             # Mobile-first Scandinavian UI & drawers
    ├── data/                   # Seed experts, Brand DNA v4, curated model metadata
    ├── orchestration/          # Jennifer orchestrator loop, XML parser, prompt builders
    ├── providers/              # Groq, OpenRouter, OpenAI, Mock + AIError taxonomy
    ├── storage/                # IndexedDB wrapper, Web Crypto AES-GCM, validated CRUD
    └── utils/                  # IDs, dates, JSON Schema validator, safe Markdown, downloads
```

---

## Getting Started

### Prerequisites

- Node.js 22 (see `.nvmrc`)
- npm 10+

### Local Development

```bash
npm ci
npm run dev
```

Open `http://localhost:3000`.

> **Secure Context Note**: Web Crypto key encryption requires HTTPS or `localhost`. Testing from a phone over plain `http://<lan-ip>` will fall back to session-only keys.

### Quality Gates

```bash
npm run typecheck   # tsc --noEmit, strict mode
npm test            # node:test via tsx (36 tests)
npm run build       # production bundle + CSP check in CI
npm run check       # all three, in order
```

### Try Without an API Key (Demo Mode)

1. Open the app and click **Try demo mode** on the welcome card (or open **Settings → Provider → Demo**).
2. Send any prompt or tap a starter chip to see the full 3-step delegation: handoff, inline expert activity, Brand DNA check, and streaming synthesis.

### Using Live Providers (Groq / OpenRouter / OpenAI)

1. Open **Settings** from the header.
2. Choose your provider (**Groq** is recommended for fast free-tier testing).
3. Paste your API key and click **Validate & load models**.
4. Pick a model (free models are listed first with indicative rate-limit notes).
5. Optional: switch **Response Mode** to **Team** to enable specialist delegation on live providers.
6. Your key is encrypted in this browser's IndexedDB and is only transmitted directly to your selected provider's API endpoint.

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

This generates static assets inside `dist/` that can be deployed to GitHub Pages or any static host without a backend. `.github/workflows/deploy.yml` installs from the committed lockfile, runs typecheck + tests + build, asserts that the built HTML carries a Content-Security-Policy, then publishes `dist/`.

---

## Manual Verification Checklist

- [ ] **First-run**: Welcome card displays; Demo mode works without any API key.
- [ ] **Key Encryption & Model Load**: entering a valid key encrypts it in IndexedDB `keys`, loads provider models, and populates the grouped selector.
- [ ] **Direct Turn**: with Response Mode = Direct, a simple query ("Hi Jennifer, what can you do?") resolves in 1 AI call without delegation.
- [ ] **Delegated Turn**: with Response Mode = Team (or in Demo mode), requesting Instagram captions triggers planning → Copywriter execution → synthesis with an inline status strip.
- [ ] **Cancellation**: clicking Stop (`■`) aborts the in-flight request and preserves partial text with a stopped marker.
- [ ] **Error Recovery**: invalid key (`401`) or rate limit (`429`) renders an inline Jennifer recovery card with actionable buttons.
- [ ] **Unreadable key**: clearing site data in devtools while a key is stored shows "paste the key again" rather than repeating auth errors.
- [ ] **Brand Guardrails**: Honesty Rule remains locked at the top of Brand DNA; editable attributes save with undo history.
- [ ] **Delete safety**: deleting a conversation asks for confirmation; "Clear all data" requires typing `DELETE` and also drops session-only keys.
- [ ] **Library & Export/Import**: save output to library, filter/search, export full studio JSON, and verify merge/replace import validation (importing a package without chats keeps local conversations).
- [ ] **Mobile & Accessibility**: verified at `375px` and `1440px` widths (`44×44px` touch targets, full-screen drawers, focus trapped inside modals).

---

## Docs & design intent

`docs/` contains the original product/technical specifications (PRD, architecture, schemas, prompts, UI spec, test case). They were written **before** the build and describe the intended vanilla-ES design; the shipped app is React 19 + Vite + TypeScript. Where they disagree with the code, the code and `tests/` are authoritative. Concrete known divergences are listed at the top of `docs/ARCHITECTURE.md`.
