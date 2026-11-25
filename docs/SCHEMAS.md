SCHEMAS.md — Hedetangen AI Marketing Studio

Version: 1.0
Companion: ARCHITECTURE.md §5, §6, §10
Format: JSON Schema (draft-07 subset) — matches the in-house validator defined in §10 of this document

---

1. How schemas are used

Every persisted entity, every import payload, and every seed data file is validated against a schema:

· On save — a form submission validates before writing to IndexedDB. Invalid input is rejected with a field-level error message.
· On load — records read from IndexedDB are validated; corrupt or outdated records are logged and skipped (with a toast: "One item couldn't be loaded and was skipped. Export your data to back up what's readable.").
· On import — the entire payload is validated first, then the per-record schemas are re-checked individually. Any failure aborts the import with a line-numbered summary.
· On seed — the bundled seed experts and guardrails are validated at app boot; a failure here is a build defect and must be caught in manual testing.

Validator subset support (from utils/validate.js): type, required, properties, additionalProperties, items, enum, const, minLength, maxLength, minimum, maximum, pattern, format (uuid, date-time, uri), anyOf, oneOf (limited). No $ref, no if/then/else, no dependencies. If a schema needs more, split it or add support to the validator.

---

2. expert.schema.json

The canonical shape of an expert role. This is both the persisted record and the import/export unit.

```json
{
  "$schema": "https://json-schema.org/draft-07/schema#",
  "$id": "https://hedetangen.app/schemas/expert.schema.json",
  "title": "Expert",
  "type": "object",
  "additionalProperties": false,
  "required": ["id", "name", "role", "systemPrompt", "enabled", "tags", "createdAt", "updatedAt"],
  "properties": {
    "id": {
      "type": "string",
      "format": "uuid"
    },
    "name": {
      "type": "string",
      "minLength": 1,
      "maxLength": 60,
      "pattern": "^[\\p{L}0-9 _&'./-]+$"
    },
    "role": {
      "type": "string",
      "minLength": 1,
      "maxLength": 200
    },
    "systemPrompt": {
      "type": "string",
      "minLength": 20,
      "maxLength": 8000
    },
    "temperature": {
      "type": "number",
      "minimum": 0,
      "maximum": 1.5
    },
    "enabled": {
      "type": "boolean"
    },
    "tags": {
      "type": "array",
      "items": { "type": "string", "minLength": 1, "maxLength": 40 },
      "maxItems": 20,
      "uniqueItems": true
    },
    "isSeed": {
      "type": "boolean",
      "description": "True for bundled seed experts; false for user-created. Used only for UI hints."
    },
    "createdAt": { "type": "string", "format": "date-time" },
    "updatedAt": { "type": "string", "format": "date-time" }
  }
}
```

Notes:

· temperature is optional; if absent, the global setting applies.
· systemPrompt is the expert-specific instruction. The Brand DNA guardrails block and the handoff-to-Jennifer instruction are injected by the app at call time — they are not stored in systemPrompt. This means the owner can edit an expert's prompt without accidentally weakening the guardrails, and a future guardrails update applies everywhere instantly.
· isSeed is informational only — seed experts are fully editable and deletable.
· The name pattern allows Unicode letters so Swedish names (e.g. "Översättare") work.

---

3. guardrails.schema.json

The Brand DNA record. Exactly one exists (id "default" in v1).

```json
{
  "$schema": "https://json-schema.org/draft-07/schema#",
  "$id": "https://hedetangen.app/schemas/guardrails.schema.json",
  "title": "Brand Guardrails",
  "type": "object",
  "additionalProperties": false,
  "required": ["id", "version", "editable", "honestyRule", "updatedAt"],
  "properties": {
    "id": { "type": "string", "const": "default" },
    "version": { "type": "integer", "minimum": 1 },
    "editable": {
      "type": "object",
      "description": "The parts of the Brand DNA the owner may edit.",
      "additionalProperties": false,
      "properties": {
        "essence":       { "type": "string", "maxLength": 400 },
        "materials":     { "type": "array", "items": { "type": "string", "maxLength": 120 }, "maxItems": 30 },
        "colourAndLight":{ "type": "array", "items": { "type": "string", "maxLength": 160 }, "maxItems": 30 },
        "people":        { "type": "string", "maxLength": 400 },
        "cinema":        { "type": "string", "maxLength": 600 },
        "emotion":       { "type": "string", "maxLength": 300 },
        "avoid":         { "type": "array", "items": { "type": "string", "maxLength": 120 }, "maxItems": 30 },
        "extraNotes":    { "type": "string", "maxLength": 2000 }
      }
    },
    "honestyRule": {
      "type": "string",
      "description": "Immutable. Appended by the app to every expert call. Cannot be edited by the user.",
      "minLength": 50,
      "maxLength": 1200
    },
    "editedBy": { "type": "string", "maxLength": 120 },
    "updatedAt": { "type": "string", "format": "date-time" },
    "history": {
      "type": "array",
      "description": "Last N snapshots of the editable block for undo. Managed by the app.",
      "maxItems": 5,
      "items": {
        "type": "object",
        "required": ["snapshot", "savedAt"],
        "properties": {
          "snapshot": { "type": "object" },
          "savedAt":  { "type": "string", "format": "date-time" }
        }
      }
    }
  }
}
```

Design note (addresses Open Question #1 in ARCHITECTURE.md §15): The honesty rule is immutable and app-appended. Only the editable block is exposed in the Guardrails Editor. This closes the door on an owner accidentally removing the brand's single most important safeguard, while still letting them refine materials, colours, and avoid-lists over time.

---

4. settings.schema.json

Persisted (excluding API keys, which live in their own store).

```json
{
  "$schema": "https://json-schema.org/draft-07/schema#",
  "$id": "https://hedetangen.app/schemas/settings.schema.json",
  "title": "Settings",
  "type": "object",
  "additionalProperties": false,
  "required": ["provider", "model", "temperature", "language", "theme"],
  "properties": {
    "provider": {
      "type": "string",
      "enum": ["groq", "openrouter", "openai", "mock"]
    },
    "model": {
      "type": "string",
      "minLength": 1,
      "maxLength": 200
    },
    "temperature": {
      "type": "number",
      "minimum": 0,
      "maximum": 1.5
    },
    "language": {
      "type": "string",
      "enum": ["auto", "sv", "en", "bilingual"]
    },
    "machinePrompt": {
      "type": "string",
      "maxLength": 4000
    },
    "theme": {
      "type": "string",
      "enum": ["light", "dark"]
    },
    "rememberKey": {
      "type": "boolean",
      "description": "If false, API keys are held in memory only for the session."
    },
    "strictMode": {
      "type": "boolean",
      "description": "Reserved. Always true in v1; the honesty rule is not user-toggleable."
    },
    "debug": {
      "type": "boolean"
    }
  }
}
```

strictMode is included in the schema for forward compatibility but is not exposed in v1 UI (per ARCHITECTURE.md Open Question #4 recommendation). It always validates as true in v1. Remove in v1.1 if unused.

---

5. chat.schema.json and message.schema.json

5.1 Chat

A container for messages.

```json
{
  "$schema": "https://json-schema.org/draft-07/schema#",
  "$id": "https://hedetangen.app/schemas/chat.schema.json",
  "title": "Chat",
  "type": "object",
  "additionalProperties": false,
  "required": ["id", "title", "createdAt", "updatedAt"],
  "properties": {
    "id": { "type": "string", "format": "uuid" },
    "title": { "type": "string", "minLength": 1, "maxLength": 120 },
    "createdAt": { "type": "string", "format": "date-time" },
    "updatedAt": { "type": "string", "format": "date-time" }
  }
}
```

title is auto-generated by the app from the first user message (truncated to ~60 chars). The user can rename a chat later.

5.2 Message

```json
{
  "$schema": "https://json-schema.org/draft-07/schema#",
  "$id": "https://hedetangen.app/schemas/message.schema.json",
  "title": "Message",
  "type": "object",
  "additionalProperties": false,
  "required": ["id", "chatId", "role", "content", "timestamp"],
  "properties": {
    "id": { "type": "string", "format": "uuid" },
    "chatId": { "type": "string", "format": "uuid" },
    "role": {
      "type": "string",
      "enum": ["user", "jennifer", "expert", "system"]
    },
    "expertName": {
      "type": "string",
      "maxLength": 60,
      "description": "Present iff role is 'expert'."
    },
    "content": {
      "type": "string",
      "minLength": 1,
      "maxLength": 60000
    },
    "timestamp": { "type": "string", "format": "date-time" },
    "status": {
      "type": "string",
      "enum": ["complete", "streaming", "stopped", "error"]
    },
    "savedToLibrary": { "type": "boolean" },
    "turnId": {
      "type": "string",
      "format": "uuid",
      "description": "Groups the user message, expert calls, and synthesis from a single turn."
    }
  }
}
```

turnId is essential: it lets the UI group a delegated turn's expert outputs under the Jennifer bubble that orchestrated them, and lets export filter or summarize by turn. Do not omit it.

---

6. library-item.schema.json

```json
{
  "$schema": "https://json-schema.org/draft-07/schema#",
  "$id": "https://hedetangen.app/schemas/library-item.schema.json",
  "title": "Library Item",
  "type": "object",
  "additionalProperties": false,
  "required": ["id", "title", "content", "type", "tags", "createdAt"],
  "properties": {
    "id": { "type": "string", "format": "uuid" },
    "title": { "type": "string", "minLength": 1, "maxLength": 160 },
    "content": { "type": "string", "minLength": 1, "maxLength": 100000 },
    "type": {
      "type": "string",
      "enum": ["copy", "campaign", "research", "visual-brief", "note"]
    },
    "tags": {
      "type": "array",
      "items": { "type": "string", "minLength": 1, "maxLength": 40 },
      "maxItems": 20,
      "uniqueItems": true
    },
    "sourceChatId": { "type": "string", "format": "uuid" },
    "sourceMessageId": { "type": "string", "format": "uuid" },
    "createdAt": { "type": "string", "format": "date-time" },
    "updatedAt": { "type": "string", "format": "date-time" }
  }
}
```

---

7. export-package.schema.json

The single file the user can export and re-import.

```json
{
  "$schema": "https://json-schema.org/draft-07/schema#",
  "$id": "https://hedetangen.app/schemas/export-package.schema.json",
  "title": "Export Package",
  "type": "object",
  "additionalProperties": false,
  "required": ["schemaVersion", "exportedAt", "app", "experts", "guardrails", "library", "settings"],
  "properties": {
    "schemaVersion": { "type": "integer", "const": 1 },
    "exportedAt": { "type": "string", "format": "date-time" },
    "app": {
      "type": "object",
      "additionalProperties": false,
      "required": ["name", "version"],
      "properties": {
        "name": { "type": "string", "const": "Hedetangen AI Marketing Studio" },
        "version": { "type": "string", "pattern": "^\\d+\\.\\d+\\.\\d+$" }
      }
    },
    "experts": {
      "type": "array",
      "items": { "$ref": "expert.schema.json" }
    },
    "guardrails": { "$ref": "guardrails.schema.json" },
    "library": {
      "type": "array",
      "items": { "$ref": "library-item.schema.json" }
    },
    "settings": { "$ref": "settings.schema.json" },
    "chats": {
      "type": "array",
      "description": "Optional. Present only when the user opts in to including chat history.",
      "items": {
        "type": "object",
        "required": ["chat", "messages"],
        "properties": {
          "chat": { "$ref": "chat.schema.json" },
          "messages": {
            "type": "array",
            "items": { "$ref": "message.schema.json" }
          }
        }
      }
    }
  }
}
```

Validator note: The in-house validator must resolve $ref for export-package validation, or the import path must manually validate each sub-array against the corresponding schema. Recommendation: manual validation per-array, which is simpler and gives clearer error messages ("Expert #3: name missing"). Document this in import-export.js — do not silently rely on a $ref-resolving validator that doesn't exist.

Explicitly absent: API keys, encrypted key blobs, the CryptoKey, and the rememberKey flag. These are never exported. Import must reject any payload containing these keys to guard against malicious hand-crafted files.

---

8. Seed data (structure only)

The actual seed prompt content is the subject of PROMPTS.md — this section only defines the shape of the seeded records.

8.1 Seed experts (6)

Each is a full expert.schema.json record with:

· A stable UUID generated once and hardcoded (so importing seed data does not duplicate if the user already has the seed expert).
· isSeed: true.
· A systemPrompt in the structure defined in PRD Appendix A (role identity → task boundaries → output format → handoff instruction). Guardrails are not embedded — they're injected at call time.
· A temperature tuned to the expert's task (Copywriter 0.7, Marketing Strategist 0.6, Social Media Strategist 0.7, Business & Pricing Analyst 0.3, Visual Director 0.6, Researcher 0.3).

Seed expert IDs (stable, to be hardcoded in seed-experts.js):

Name ID
Copywriter 0b5e0f0e-2f0a-4f5b-9a1c-000000000001
Marketing Strategist 0b5e0f0e-2f0a-4f5b-9a1c-000000000002
Social Media Strategist 0b5e0f0e-2f0a-4f5b-9a1c-000000000003
Business & Pricing Analyst 0b5e0f0e-2f0a-4f5b-9a1c-000000000004
Visual Director 0b5e0f0e-2f0a-4f5b-9a1c-000000000005
Researcher 0b5e0f0e-2f0a-4f5b-9a1c-000000000006

8.2 Seed guardrails

A single guardrails.schema.json record with id: "default", version: 1, the full honestyRule string (from Brand DNA v4), and the editable block pre-filled with the Brand DNA sections (essence, materials, colour & light, people, cinema, emotion, avoid). history: [].

8.3 Seed settings

Created on first run only if none exist:

```json
{
  "provider": "groq",
  "model": "",
  "temperature": 0.7,
  "language": "auto",
  "machinePrompt": "",
  "theme": "light",
  "rememberKey": true,
  "strictMode": true,
  "debug": false
}
```

model is empty until the user adds an API key and selects a model. The app blocks sending until model is non-empty and a key exists for the selected provider (except in Mock mode).

---

9. Model metadata hints (data/model-metadata.js)

Not a schema in the same sense — a curated lookup table the provider layer merges into listModels() results. Format:

```js
export const MODEL_METADATA = {
  groq: {
    "llama-3.3-70b-versatile": {
      contextWindow: 131072,
      free: true,
      bestFor: ["copy", "strategy", "research-synthesis"],
      approxRpm: 30,
      approxRpd: 1000,
      notes: "Recommended default. Strong at brand-voice copy."
    },
    "llama-3.1-8b-instant": {
      contextWindow: 131072,
      free: true,
      bestFor: ["quick-drafts", "low-latency"],
      approxRpm: 30,
      approxRpd: 14400,
      notes: "Fastest; lower quality for nuanced copy."
    },
    "openai/gpt-oss-120b": {
      contextWindow: 131072,
      free: true,
      bestFor: ["copy", "reasoning"],
      approxRpm: 30,
      approxRpd: 1000,
      notes: "Highest quality copy on Groq free tier."
    },
    "moonshotai/kimi-k2-instruct": {
      contextWindow: 131072,
      free: true,
      bestFor: ["long-context", "research"],
      approxRpm: 60,
      approxRpd: 1000,
      notes: "Best for long research briefs."
    }
  },
  openrouter: {
    // Not hardcoded — OpenRouter's free list changes frequently.
    // Merge only stable hints by model family prefix.
    "deepseek/":    { free: true, bestFor: ["reasoning", "research"] },
    "meta-llama/":  { free: true, bestFor: ["copy", "general"] },
    "qwen/":        { free: true, bestFor: ["reasoning", "multilingual"] }
  },
  openai: {
    // All paid. No free-tier metadata.
    "gpt-4o":       { free: false, contextWindow: 128000, bestFor: ["copy", "reasoning"] },
    "gpt-4o-mini":  { free: false, contextWindow: 128000, bestFor: ["copy", "fast"] },
    "gpt-4.1":      { free: false, contextWindow: 1000000, bestFor: ["long-context"] }
  }
};
```

Ground rules for this table:

· Every entry must have a "last verified" comment with a date. Entries older than 90 days must be reviewed.
· approx* fields must be prefixed approx to avoid implying guaranteed limits — free-tier limits change without notice and are not contractual.
· The UI must display a disclaimer wherever these figures are shown: "Free-tier limits are indicative and set by the provider. They change without notice."

---

10. Validator implementation notes

utils/validate.js needs to support exactly the keyword subset listed in §1. Implementation sketch:

```js
export function validate(value, schema, path = "$") {
  const errors = [];
  // type
  // enum / const
  // required (for objects)
  // properties + additionalProperties (for objects)
  // items (for arrays)
  // minLength / maxLength / pattern (for strings)
  // minimum / maximum (for numbers)
  // format: uuid | date-time | uri
  // anyOf / oneOf (limited, for future)
  return { valid: errors.length === 0, errors };
}
```

Format checks:

· uuid — regex ^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$ (accept v4 and v1–v5 for imported data)
· date-time — Date.parse() returning a finite number, plus a toISOString() round-trip check
· uri — new URL(value) succeeds

Error format: { path: "$.experts[2].name", message: "must be at least 1 character" }. The import UI groups by path prefix so the user sees "Expert #3: name is required" rather than raw JSONPath.

---

11. Versioning strategy

· schemaVersion is a single integer, incremented on breaking changes only.
· Additive changes (new optional field) do not bump the version; the validator's additionalProperties: false must be relaxed for forward compatibility on import only — the app should accept unknown optional properties during import, strip them, and warn the user ("Some fields in this file aren't recognized and were ignored"). Save-time validation remains strict.
· Breaking changes (field renamed, removed, or type changed) bump schemaVersion and require a migration function in storage/db.js for existing IndexedDB data, and in import-export.js for imported files.
· Migration order on import: file's schemaVersion → chain of migrate_vN_to_vN+1 functions → validate against current schema → apply.

---

12. What is not in a schema (intentionally)

· API keys and crypto material — deliberately outside the exportable schema universe. Stored only in keys and crypto stores, never validated against a public schema, never exported.
· Chat message streaming state — the status: "streaming" value is transient; on crash recovery, all messages with status: "streaming" are rewritten to status: "stopped" on next boot.
· UI-only state — panel open/closed, wizard step, scroll position, draft composer text. If draft preservation is desired in v1.1, it goes in localStorage under a hedetangen.draft.<chatId> key, not in IndexedDB and not in any schema.

---

13. Summary table

Schema Store Exported Seed record(s)
expert.schema.json experts Yes 6 stable UUIDs
guardrails.schema.json guardrails Yes 1 ("default")
settings.schema.json settings (key/value) Yes (minus keys, minus rememberKey) 1
chat.schema.json chats Optional —
message.schema.json messages Optional —
library-item.schema.json library Yes —
export-package.schema.json — n/a (it is the export) n/a
