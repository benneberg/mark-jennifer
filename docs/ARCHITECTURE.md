ARCHITECTURE.md — Hedetangen AI Marketing Studio

Version: 1.0
Status: Draft for review
Companion documents: PRD.md v1.0, SCHEMAS.md v1.0, PROMPTS.md (next)
Deployment target: Static files on GitHub Pages

---

1. System Overview

The Studio is a single-page, client-only application. It has no backend, no build-time server, and no telemetry. All persistence is in the browser (IndexedDB + localStorage). All network traffic is direct from the browser to the user's chosen AI provider (Groq, OpenRouter, or OpenAI).

```
┌─────────────────────────────────────────────────────────────┐
│                        Browser (SPA)                        │
│                                                             │
│  ┌──────────┐   ┌───────────────┐   ┌──────────────────┐    │
│  │  UI      │◄─►│  Store        │◄─►│  Storage Layer   │    │
│  │ (views)  │   │ (state mgmt)  │   │ IndexedDB + LS   │    │
│  └────┬─────┘   └───────┬───────┘   └────────┬─────────┘    │
│       │                 │                    │              │
│       │         ┌───────▼────────┐   ┌───────▼─────────┐    │
│       │         │ Orchestrator   │   │ Crypto (WebCrypto)│  │
│       │         │ (Jennifer)     │   │ AES-GCM keys    │    │
│       │         └───────┬────────┘   └─────────────────┘    │
│       │                 │                                   │
│       │         ┌───────▼────────┐                          │
│       │         │ Provider Layer │                          │
│       │         │ (Groq/OR/OAI)  │                          │
│       │         └───────┬────────┘                          │
└───────┼─────────────────┼───────────────────────────────────┘
        │                 │  HTTPS (user's key)
        │                 ▼
        │         ┌────────────────┐
        │         │ AI Provider    │
        │         │ (external)     │
        │         └────────────────┘
        ▼
   ┌─────────┐
   │  User   │
   └─────────┘
```

---

2. Codebase Design Principles

· No framework lock-in. Vanilla ES modules + a tiny observable store. No bundler required for v1 (native ESM is fine for GitHub Pages). Optional: a build.sh that concatenates if you later want a single-file bundle.
· Provider-agnostic. All provider-specific logic lives behind one interface. Adding a fourth provider is a single new file.
· Schema-first persistence. Every stored entity validates against a JSON Schema before save and before use after load. Prevents silent corruption and makes imports safe.
· Deterministic orchestration. Jennifer's delegation decisions are parsed from a structured protocol, not inferred from prose. No "hope the model does what we said."
· Fail loud, fail friendly. A single error taxonomy; every failure surfaces as a Jennifer-authored, actionable message — never a raw stack trace.
· Progressive disclosure in UI. Advanced settings and internal tools live behind explicit toggles. Default surface is chat + composer only.

---

3. File Structure

```
/
├── index.html
├── README.md
├── docs/
│   ├── PRD.md
│   ├── ARCHITECTURE.md
│   ├── SCHEMAS.md
│   ├── PROMPTS.md            ← to write
│   └── UI_SPEC.md            ← to write
├── assets/
│   ├── styles.css
│   ├── icons/                 (SVG sprite)
│   └── fonts/                 (if custom; else system stack)
├── schemas/
│   ├── expert.schema.json
│   ├── guardrails.schema.json
│   ├── settings.schema.json
│   ├── library-item.schema.json
│   ├── message.schema.json
│   ├── chat.schema.json
│   └── export-package.schema.json
├── js/
│   ├── app.js                 (boot, wires everything)
│   ├── constants.js           (app-level constants, storage keys)
│   ├── store.js               (observable state store)
│   ├── data/
│   │   ├── seed-experts.js
│   │   ├── seed-guardrails.js
│   │   └── model-metadata.js  (curated free model hints for Groq/OR)
│   ├── storage/
│   │   ├── db.js              (IndexedDB wrapper, migrations)
│   │   ├── crypto.js          (Web Crypto helpers)
│   │   ├── experts.js         (CRUD + validation)
│   │   ├── guardrails.js
│   │   ├── library.js
│   │   ├── messages.js
│   │   ├── chats.js
│   │   └── settings.js
│   ├── providers/
│   │   ├── base.js            (interface + shared helpers)
│   │   ├── groq.js
│   │   ├── openrouter.js
│   │   ├── openai.js
│   │   ├── mock.js            (demo mode)
│   │   ├── errors.js          (AIError taxonomy + factory)
│   │   └── index.js           (provider registry / factory)
│   ├── orchestration/
│   │   ├── jennifer.js        (orchestrator loop)
│   │   ├── delegation.js      (parse + execute delegation directives)
│   │   ├── context.js         (context assembly: guardrails, history, expert)
│   │   └── prompts.js         (prompt templates; canonical seeds imported from data/)
│   ├── ui/
│   │   ├── chat.js            (message list, streaming render)
│   │   ├── composer.js        (input, wizard entry, send)
│   │   ├── wizard.js          (guided campaign builder)
│   │   ├── settings-panel.js
│   │   ├── expert-editor.js
│   │   ├── guardrails-editor.js
│   │   ├── library-panel.js
│   │   ├── import-export.js
│   │   ├── markdown.js        (minimal sanitized MD renderer)
│   │   ├── toast.js           (notifications)
│   │   └── components.js      (buttons, modals, inputs)
│   └── utils/
│       ├── id.js              (UUID v4 via crypto.randomUUID)
│       ├── dates.js
│       ├── validate.js        (tiny JSON Schema validator, or use ajv via CDN)
│       └── dom.js             (helpers: el(), on(), escapeHtml())
└── 404.html                   (redirect to index for SPA behavior)
```

Note on validate.js: Bundling a full JSON Schema validator adds weight. For v1, recommend a minimal validator (~100 lines) that supports only the subset of keywords we use: type, required, properties, items, enum, minLength, maxLength, minimum, maximum, pattern, additionalProperties, format (uuid/date-time). Documented in SCHEMAS.md. If scope creep demands more, switch to ajv via CDN.

---

4. Provider Layer

4.1 Interface

All providers implement:

```js
// js/providers/base.js
export class Provider {
  constructor({ apiKey, baseUrl }) {}
  async validateKey() { /* → true | throws AIError */ }
  async listModels() { /* → ModelInfo[] */ }
  async chat({ model, messages, temperature, maxTokens, signal }) { /* → ChatResult */ }
}

// ModelInfo
{
  id: string,
  name: string,
  contextWindow?: number,
  free?: boolean,          // true / false / undefined (unknown)
  supportsTools?: boolean, // reserved for future
  providerNotes?: string
}

// ChatResult
{
  content: string,
  usage?: { promptTokens, completionTokens, totalTokens },
  model: string,
  finishReason?: string
}
```

Streaming: chat() accepts an optional onToken(delta) callback. If provided and the provider supports SSE, tokens are streamed. If not, the full result is delivered at the end via onToken(fullContent) once — callers must handle both. Jennifer's orchestration calls use non-streaming; only the final synthesis call streams. See §6.

4.2 Provider implementations

Provider Base URL Auth header Model list endpoint Free filter
Groq https://api.groq.com/openai/v1 Authorization: Bearer <key> GET /models none (all free-tier; show curated metadata)
OpenRouter https://openrouter.ai/api/v1 Authorization: Bearer <key> + HTTP-Referer: <app-url> + X-Title: Hedetangen AI Studio GET /models pricing.prompt === "0" && pricing.completion === "0"
OpenAI https://api.openai.com/v1 Authorization: Bearer <key> GET /models none (mark all as paid)
Mock — — returns static list n/a

OpenRouter referer/title headers: These are required by OpenRouter's ToS and improve rate-limit fairness. Include them.

Groq model metadata: Groq's /models endpoint returns minimal info. Merge with data/model-metadata.js (curated context windows, recommended tasks, approximate free-tier RPM/RPD). Mark unknown fields as undefined in the UI — never fabricate.

OpenAI warning: Model list includes many non-chat models (embeddings, image, tts). Filter to known chat-completion families (gpt-*, o1-*, o3-*, o4-*). Show a persistent "Paid provider — you will be billed by OpenAI" banner when OpenAI is the active provider.

4.3 Error taxonomy

js/providers/errors.js defines:

```js
class AIError extends Error {
  constructor({ code, message, provider, status, retryAfterMs, raw }) {}
}

// Codes:
// AUTH_INVALID        401/403 — invalid or revoked key
// RATE_LIMIT          429 — with retryAfterMs if available
// QUOTA_EXCEEDED      402 / 429 with quota signal
// MODEL_NOT_FOUND     404 — model deprecated/removed
// MODEL_UNSUPPORTED   400 — model doesn't support chat
// CONTEXT_TOO_LONG    400 — prompt exceeds model context
// NETWORK             fetch rejected (offline, DNS, CORS)
// TIMEOUT             AbortController fired
// PROVIDER_ERROR      5xx
// PARSE_ERROR         response body not valid JSON / unexpected shape
// VALIDATION_ERROR    input failed schema
// UNKNOWN             anything else
```

The orchestrator maps each code to a Jennifer-authored recovery message (see §9).

---

5. Storage Layer

5.1 IndexedDB schema

Database name: hedetangen-studio
Version: 1
Object stores:

Store Key Indexes Purpose
experts id name, enabled Expert CRUD
guardrails id ("default" for v1) — Brand DNA (single record)
chats id updatedAt Chat sessions
messages id chatId+timestamp (compound), timestamp Chat messages
library id type, createdAt, tags (multiEntry) Saved content
settings key — App settings as key-value
keys provider — Encrypted API keys
crypto id ("master") — Non-extractable CryptoKey for API-key encryption
meta key — Schema version, seed state, first-run flag

Migrations: db.js maintains a meta.schemaVersion. Each version bump requires a migration function. For v1, only v1 exists; write the migration harness now so v2 is trivial.

IndexedDB library choice: Use raw IndexedDB via a small promise-based wrapper (~150 lines). Avoids a dependency (idb, Dexie) and keeps the bundle tiny. The wrapper needs only get, put, delete, getAll, getAllByIndex, transaction, and openWithMigrations.

5.2 API key encryption

Threat model & honest scope: Encryption at rest here defends against casual inspection (devtools, IndexedDB dump) and accidental exfiltration via copy/paste of storage. It does not defend against XSS (which can call our own decrypt function), malicious extensions, or a compromised browser. Those are mitigated separately via CSP and by never rendering keys in the DOM. This must be documented in the UI, not glossed over.

Implementation:

1. First-run: Generate a non-extractable AES-GCM 256 key.
   ```js
   const masterKey = await crypto.subtle.generateKey(
     { name: "AES-GCM", length: 256 },
     /* extractable */ false,
     ["encrypt", "decrypt"]
   );
   await idb.put("crypto", { id: "master", key: masterKey });
   ```
   CryptoKey objects are structured-cloneable and persist in IndexedDB across sessions in all evergreen browsers.
2. Saving an API key:
   ```js
   const iv = crypto.getRandomValues(new Uint8Array(12));
   const ct = await crypto.subtle.encrypt(
     { name: "AES-GCM", iv },
     masterKey,
     new TextEncoder().encode(apiKey)
   );
   await idb.put("keys", {
     provider,
     iv: Array.from(iv),
     ciphertext: Array.from(new Uint8Array(ct)),
     createdAt: new Date().toISOString()
   });
   ```
3. Using an API key: decrypt in memory immediately before a fetch, then drop the reference. Never store the plaintext in the store, never render it, never log it.
4. Deleting the master key (via "Clear all data") makes all stored keys permanently unrecoverable. This is the intended behavior.

Browser caveat: If crypto.subtle is unavailable (non-HTTPS context), the app must refuse to save keys and show a message: "API keys require a secure context (HTTPS or localhost). Please open the app over HTTPS." GitHub Pages is HTTPS by default, so this is only a local-dev concern.

Session option (recommended UX): Add a checkbox in Settings — "Remember key on this device" (default on). If unchecked, the key is held in memory only for the session and never written to IndexedDB. This gives privacy-conscious users an opt-out without abandoning the app.

5.3 localStorage usage

Only non-sensitive, non-critical UI state:

· hedetangen.theme ("light" | "dark")
· hedetangen.lastProvider (string)
· hedetangen.lastModel (string)
· hedetangen.onboarded ("true" once first-run completes)

Everything else is IndexedDB.

5.4 Export / import

Export produces a single JSON file matching export-package.schema.json:

· schemaVersion
· exportedAt
· app ({ name, version })
· experts (array)
· guardrails (object, current)
· library (array)
· settings (object excluding API keys and remember-key preference)
· modelMetadataOverrides (optional; user-annotated free-model notes)

Never export: API keys, encrypted key blobs, master CryptoKey, chat messages (chats are session artifacts and can be large; offer a separate optional "include chat history" checkbox if the user wants full backup).

Import validates against the schema, produces a diff preview (counts of experts/library items, guardrails changed yes/no), and offers Merge (by id; newer updatedAt wins) or Replace (wipe and load). On any validation failure, the import aborts with a line-numbered error summary.

---

6. Orchestration Engine

This is the heart of the product. The design favors deterministic, protocol-based delegation over "hope the model interprets the instructions."

6.1 The delegation protocol (v1: XML-tagged)

Jennifer's first-pass response is buffered (not streamed to the user), then parsed. Her system prompt instructs her to produce exactly one of two shapes:

Shape A — Direct answer:

```
<response>...</response>
```

Shape B — Delegate, then synthesize:

```
<response>Short message to user explaining the handoff.</response>
<delegate expert="Copywriter">
  <task>...</task>
  <context>...</context>
  <constraints>...</constraints>
</delegate>
```

Multiple <delegate> blocks are allowed; they execute in parallel if independent, sequentially if the second depends on the first (Jennifer must include dependsOn="<expert-name-1>"). For v1, execute sequentially in document order — simpler and safe. Parallelism is a v1.1 optimization.

Why XML over tool-calling for v1: Free-tier and free-model tool-calling support is inconsistent across Groq and OpenRouter today. XML-tagged delegation works with any chat-completion model, is trivially parseable, and is easy to inspect in devtools. Tool-calling can be added later behind the same interface.

Parsing robustness: Use DOMParser to parse the buffered text as XML (wrapped in a root). If parsing fails, or neither <response> nor <delegate> is found, treat the entire raw text as a direct response and log a PARSE_ERROR warning to a debug panel (hidden by default). Never surface a parse failure to the user as an error — degrade to "Jennifer replied in prose," which is acceptable.

6.2 The orchestrator loop

```js
// js/orchestration/jennifer.js  (pseudocode)
async function runTurn({ userMessage, chat, settings, signal, onStatus, onToken }) {
  // 1. Persist user message
  // 2. Assemble context: guardrails + expert registry summary + last N messages
  // 3. First pass — Jennifer decides
  onStatus("Jennifer is thinking…");
  const firstPass = await provider.chat({
    model: settings.model,
    messages: buildJenniferMessages(context, userMessage),
    temperature: 0.4,           // low for structured output reliability
    signal
  });
  const plan = parseDelegation(firstPass.content);

  // 4a. Direct answer
  if (!plan.delegates.length) {
    onStatus(null);
    onToken(plan.response);      // fake-stream from buffer, or display instantly
    return persistAndDone(plan.response);
  }

  // 4b. Show handoff text, then run experts
  onStatus(plan.response || "Working on it…");
  const expertOutputs = [];
  for (const d of plan.delegates) {
    const expert = resolveExpert(d.expert);
    if (!expert) {
      expertOutputs.push({ expert: d.expert, error: `Expert "${d.expert}" not found or disabled.` });
      continue;
    }
    onStatus(`${expert.name} is working…`);
    const out = await provider.chat({
      model: settings.model,
      messages: buildExpertMessages(expert, d, expertOutputs),
      temperature: expert.temperature ?? settings.temperature,
      signal
    });
    expertOutputs.push({ expert: expert.name, content: out.content });
  }

  // 5. Synthesis — Jennifer reviews expert output against guardrails and streams
  onStatus("Jennifer is finalizing…");
  const synthesis = provider.chat({
    model: settings.model,
    messages: buildSynthesisMessages(context, userMessage, expertOutputs),
    temperature: settings.temperature,
    signal,
    onToken                    // ← only this call streams to UI
  });
  return persistAndDone(await synthesis);
}
```

Call count per turn:

Scenario Calls
Direct answer 1
Single delegation 2 (plan → expert → synthesis = 3? No: 3)

Correction — single delegation is 3 calls: Jennifer-plan, Expert, Jennifer-synthesis. Direct is 1. Two independent delegations = 4 calls. This matters for free-tier limits. Two mitigations:

1. Merge plan + synthesis where possible. For simple delegations, Jennifer's prompt can be told: "If your handoff message fully answers the user after the expert's work, you may skip synthesis by using <finalSynthesis>false</finalSynthesis> in the delegate block, in which case the expert's output is shown directly, lightly wrapped." Use sparingly.
2. Show a small "Uses N AI calls" hint in the debug panel per turn, so the owners learn which requests are expensive.

Default for v1: keep the 3-call pattern. It produces the best results. Optimize later.

Cancellation: The composer's send button becomes a stop button during a turn. Cancellation aborts the current AbortController, which propagates to any in-flight fetch. Partial output is preserved in the chat with a "stopped" marker.

Concurrency guard: One turn at a time. Disable composer while a turn is running.

6.3 Context assembly (context.js)

Jennifer-plan messages:

```
[system]  prompts.jennifer({ guardrails, experts, language, machinePrompt })
[history] last 20 messages (roles normalized: user | jennifer | expert-result)
[user]    userMessage
```

Expert messages:

```
[system]  prompts.expert({ expert, guardrails, language, machinePrompt })
[context] prior expert outputs in this turn (if dependsOn)
[user]    <task>...</task>\n<context>...</context>\n<constraints>...</constraints>
```

Synthesis messages:

```
[system]  prompts.synthesis({ guardrails, language })
[history] last 20 messages
[user]    userMessage
[context] expert outputs (clearly delimited)
[user]    "Compose the final answer for the user. Apply the Brand DNA guardrails. Do not mention internal expert names."
```

History trimming: Hard cap at 20 messages or ~8,000 tokens (whichever hits first), always preserving the system message and the current user message. For free-tier models with 128K context this is conservative; keeps latency low and avoids blowing the per-minute token budget.

Guardrail injection: prompts.* always prepend the guardrails block first, before any other instruction. This is both a functional requirement (honesty rule is highest priority) and a defense against prompt injection in later context.

6.4 Expert resolution

resolveExpert(name) looks up by case-insensitive exact match on name, then by id. If the model emits expert="copywriter" and the stored expert is named "Copywriter", it must resolve. If no match, or the expert is enabled: false, return null and let synthesis acknowledge the gap gracefully.

If the user has deleted all experts, Jennifer's system prompt still includes the capability description ("you can delegate") but the registry is empty — Jennifer will fall back to answering directly. This is acceptable; the UI should warn when the expert list is empty: "You have no experts enabled. Jennifer will answer directly without specialist delegation."

---

7. State Management

Single observable store, plain object, partial updates.

```js
// js/store.js
export function createStore(initial) {
  let state = Object.freeze({ ...initial });
  const subs = new Set();
  return {
    get: () => state,
    set(patch) {
      state = Object.freeze({ ...state, ...patch });
      for (const fn of subs) fn(state);
    },
    subscribe(fn) {
      subs.add(fn);
      return () => subs.delete(fn);
    }
  };
}
```

Top-level state shape:

```js
{
  ready: false,
  provider: "groq",
  model: null,
  models: [],                    // ModelInfo[]
  settings: { temperature, language, machinePrompt, theme, rememberKey, strictMode },
  guardrails: null,
  experts: [],
  activeChatId: null,
  messages: [],                  // current chat's messages
  streaming: { active: false, buffer: "", status: null, expertLabel: null },
  panels: { settings: false, library: false, experts: false, guardrails: false },
  wizard: { active: false, step: 0, data: {} },
  toasts: [],
  errors: [],                    // recent AIErrors for the debug panel
  debug: false
}
```

UI components subscribe to the store and re-render only what they own. Chat is the one append-only list; everything else is bounded (settings form, expert list, library) and safe to full-re-render on change.

Persistence sync: The store is memory-only for transient UI state (streaming, panels, toasts). Storage-backed entities (experts, guardrails, settings, messages, library) write through: the storage module is the source of truth on load; the store mirrors it; mutations go store → storage → store confirmation. If a storage write fails, the store rolls back and shows a toast.

---

8. UI Layer

Rendering approach: Template-literal HTML + small helper el(tag, attrs, children) + event delegation. No virtual DOM. Full re-render of bounded components (settings panel, expert list); append-only for chat messages; targeted DOM updates for streaming tokens (write to a <span> and let the browser handle it).

Chat streaming render: On each onToken(delta), append delta to the current assistant bubble's text node. Throttle DOM writes to once per animation frame. Auto-scroll only if the user is already near the bottom (respect manual scroll-up).

Markdown: ui/markdown.js is a minimal, escaping-first renderer supporting: paragraphs, line breaks, **bold**, *italic*, `code`, # ## ### headings (h3+ only, to avoid layout breakage), -  lists, 1.  lists, >  blockquote, and [text](url) links (with rel="noopener noreferrer" and target="_blank"). Anything not recognized is escaped and shown as text. No raw HTML pass-through. This is the primary XSS vector in the app — the renderer must escape first, then apply formatting to the escaped output.

Panels: Settings, Library, Experts, and Guardrails are drawers that slide in from the right on desktop (or bottom on mobile). Only one open at a time. The chat remains visible behind the drawer on desktop, giving the sense of a persistent workspace.

Mobile-first breakpoints:

· < 720px — single column, panels are full-screen overlays, composer pinned to bottom with safe-area inset.
· ≥ 720px — two-column: chat main, collapsible right rail for library (default collapsed; expanded on demand).
· ≥ 1100px — right rail persistent.

Accessibility minimums: Keyboard-only operation of chat, composer, and all panels. aria-live="polite" on the streaming bubble. Focus trap inside open drawers. prefers-reduced-motion disables drawer slide and typing animations.

Design tokens: CSS custom properties defined in styles.css (--bg, --surface, --text, --muted, --accent, --border, --radius, --space-*). Theme = swap the token set on <html data-theme>. This is the whole "design system" for v1.

---

9. Error Handling (user-facing)

Every AIError code maps to a Jennifer-authored recovery message. Central mapping in providers/errors.js exports humanize(error, context):

Code Jennifer says (paraphrase) Recovery action shown
AUTH_INVALID "The API key was rejected by {provider}. It may have been revoked or pasted incorrectly." Button: Open Settings
RATE_LIMIT "The selected model is rate-limited right now (retry in ~{s}s). I can try a different model or wait." Buttons: Try {altModel} / Retry
QUOTA_EXCEEDED "{provider} reports your free quota is used up for today/this minute." Button: Switch provider / Wait
MODEL_NOT_FOUND "The model '{id}' isn't available anymore. It may have been retired." Button: Refresh model list
MODEL_UNSUPPORTED "That model doesn't support chat completions." Button: Pick another model
CONTEXT_TOO_LONG "The conversation is longer than this model can hold. Start a new chat, or I can summarize the relevant part first." Buttons: New chat / Summarize
NETWORK "I couldn't reach {provider}. Check your connection." Button: Retry
TIMEOUT "The model took too long to respond." Button: Retry
PROVIDER_ERROR "{provider} returned an error ({status}). This is on their side." Button: Retry
PARSE_ERROR (never user-facing; logs to debug panel, degrades to prose) —
VALIDATION_ERROR Shows the specific field error in the form. —

Retry policy: RATE_LIMIT, NETWORK, PROVIDER_ERROR, TIMEOUT allow a one-click retry that reuses the last request. No automatic retries in v1 (surprise retries can burn free-tier quota).

Debug panel: Hidden behind ?debug=1 in the URL or a 7-tap easter egg on the app version label. Shows: last error objects, per-turn call counts, provider request durations, model metadata source. Not part of the normal UI.

---

10. Security Architecture

Concern Mitigation
XSS via AI output Markdown renderer escapes before formatting; no innerHTML with untrusted content except the escaped-then-formatted pipeline; CSP via meta tag blocks inline scripts and remote scripts
XSS via user input (expert names, etc.) All user-entered strings escape on render; forms use textContent not innerHTML
API key leakage Encrypted at rest (AES-GCM, non-extractable master key); never rendered in DOM; never logged; never in export files; dropped from memory after use; session-only option available
Prompt injection via web/URL content v1 does not fetch arbitrary web content into prompts. If/when it does, content must be clearly delimited as untrusted and Jennifer's system prompt must instruct ignoring embedded instructions
Prompt injection via user-supplied guardrails The honesty rule is appended to user guardrails by the app, not part of the editable text; user cannot remove it, only add to it. Explicitly documented
Supply chain No third-party JS in v1 except (optionally) ajv via CDN with SRI hash. Prefer the in-house validator to avoid the dependency entirely
CSP <meta http-equiv="Content-Security-Policy" content="default-src 'self'; connect-src 'self' https://api.groq.com https://openrouter.ai https://api.openai.com; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; font-src 'self';"> — loosen only with a documented reason
HTTPS-only features Web Crypto requires a secure context; app detects and warns

---

11. Performance

· First load: Target < 100 KB gzipped total (HTML + CSS + JS + assets). No framework. Icons as inline SVG sprite. System font stack for body; one optional display font only if it earns its weight.
· Model list caching: Cache listModels() results in IndexedDB (meta.models.<provider>) with a 24-hour TTL and a visible "last refreshed" timestamp. Refresh on demand.
· Chat virtualization: Not needed for v1. Cap displayed messages at the last 500 per chat; offer "load older" if the user scrolls up.
· Debounce form inputs that trigger re-renders (expert editor, guardrails editor). 150 ms is fine.
· Streaming throttled to animation frame.

---

12. Testing Strategy (lightweight, v1)

Not a full test suite, but enough to protect the critical paths:

· Manual test checklist in README.md covering: first-run, key save/load, model list fetch, direct answer turn, delegated turn, rate-limit simulation (bad key), import/export round-trip, mobile layout.
· Unit tests (optional, via node --test): parseDelegation() (the parser is the riskiest single piece of logic), schema validators, humanize() error mapping.
· Mock provider allows testing the whole orchestration loop without any real API calls. Ship it as "Demo mode" and use it in every UI test.

---

13. Deployment

· Push to main; GitHub Pages serves / (or /docs if preferred).
· 404.html redirects to index.html (SPA behavior if any hash routes are added later).
· No environment variables, no build step required. Optional build.sh produces a dist/ with minified CSS/JS if desired later.
· Cache-busting via query strings (?v=<git-sha>) on styles.css and app.js — cheap and reliable on GitHub Pages.

---

14. Decisions Locked for v1

1. Orchestration protocol: XML-tagged delegation. Tool-calling deferred.
2. Single-pass planning + synthesis is 3 calls for a delegated turn. Accepted; UI hints at cost in debug mode.
3. Streaming: only the final synthesis call streams; other calls buffer.
4. API keys: encrypted with non-extractable AES-GCM key in IndexedDB; session-only option offered.
5. No framework, no bundler. Native ESM, native IndexedDB, native Web Crypto.
6. In-house minimal JSON Schema validator, not ajv.
7. One turn at a time, cancellable.
8. Expert resolution: case-insensitive name match, then id, then fail gracefully.

---

15. Open Questions (to resolve before build starts)

1. Guardrails editing model: Is the honesty rule inside the editable guardrails text (user can remove, with a strong warning) or appended by the app and immutable? Recommendation: appended and immutable, with the editable block containing only the non-honesty brand attributes. Needs a final call.
2. Chat history in export: Include by default (bigger file, full backup) or opt-in (smaller file)? Recommendation: opt-in, default off.
3. Wizard outputs: Do wizard results post into the chat as normal Jennifer messages, or get saved straight to the library with a summary message? Recommendation: post as chat messages first, save-to-library as a follow-up action.
4. "Strict mode" toggle: Does it exist as a user-facing setting, or is the honesty rule always enforced? Recommendation: always enforced, no toggle. Simpler, safer, on-brand.
5. Language auto-detection: If the user writes in Swedish, should all outputs default to Swedish? Recommendation: yes, with an explicit override in Settings.

These should be answered in the PROMPTS.md / UI_SPEC.md pass, since both depend on them.
