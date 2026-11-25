# Product Requirements Document  
## Lena — Campaign Studio

**Version:** 1.0  
**Status:** MVP delivered (single-page web app)  
**Last updated:** 2026-11-25  
**Owner:** Product / Engineering  

---

## 1. Overview

### 1.1 Product summary

**Lena** is a mobile-first, single-page campaign content generation and automation studio. Users work with a personified AI strategist (“Lena”) to turn business goals into full marketing campaigns: plans, channel content, schedules, and exportable packages.

The product is built for operators who need speed and control—glamping hosts, café owners, SaaS marketers, and similar—without locking them into a single LLM vendor (**BYOK**: Bring Your Own Key).

### 1.2 Problem

Small businesses and solo marketers often:

- Know they need “more bookings / awareness / launches” but lack time to produce a coherent multi-channel plan.
- Juggle chat tools, docs, and calendars with no single place to review, edit, and accept campaign artifacts.
- Depend on platform-locked AI or opaque automation with little control over model, prompts, or data.

### 1.3 Solution

A clean chat + showroom experience where:

1. The user describes a goal (text, voice, or images).
2. Lena asks focused follow-ups and proposes a plan.
3. On acceptance, Lena creates a **project**, uses configurable **skills**, and produces **artifacts** (plan, social, email, ads, landing, calendar, etc.).
4. The user inspects, **inline-edits**, accepts, or asks Lena to revise.
5. When ready, the user **exports** the full campaign (JSON, HTML report, Markdown).

### 1.4 Goals (MVP)

| Goal | Measure |
|------|---------|
| Time-to-first-plan | User can get a structured campaign plan in one conversation |
| Artifact ownership | User can view, edit, accept, and export every generated asset |
| Provider freedom | Real Groq API integration via user-supplied key; model selectable |
| Mobile-first UX | Primary flows usable on phone; dense settings behind toggles/overlays |
| Local privacy | Keys, chats, and projects stored only in the browser unless user exports |

### 1.5 Non-goals (MVP)

- Live publishing to social/ad platforms  
- Multi-user / team workspaces or server-side key vault  
- Guaranteed model availability beyond what Groq exposes  
- Full CMS or design tool (copy and structure only)  
- Native mobile apps  

---

## 2. Personas & primary use case

### 2.1 Primary persona

**Alex — small hospitality operator**  
Runs a glamping hut. Wants higher occupancy December–March. Comfortable with phone and simple tools; not a full-time marketer.

### 2.2 Primary scenario

1. Alex opens Lena and (optionally) adds a Groq API key in Settings.  
2. Asks: *“What can we do to increase bookings for my glamping hut December–March?”*  
3. Lena asks follow-ups (budget, channels, existing assets) and may invite reference images or URLs.  
4. Alex accepts a suggested marketing campaign plan.  
5. Lena creates a **project**, applies relevant **skills**, and produces plan, social posts, email sequence, ads, landing copy, and a content calendar.  
6. Alex reviews items in **Showroom**, inline-edits copy, accepts assets, or asks Lena for revisions.  
7. Alex exports the full campaign package for execution offline or with freelancers.

### 2.3 Secondary scenarios

- SaaS product launch content pack  
- Local café monthly social calendar  
- Any multi-artifact campaign planned through conversation  

---

## 3. Product principles

1. **Lena is a person, not a form** — Named AI, warm tone, proactive questions, clear ownership of plan → artifacts.  
2. **Chat for intent, Showroom for control** — Conversation generates; panel owns inspect / edit / accept.  
3. **Hide complexity** — API keys, models, temperature, system prompts, and skills live behind Settings / Skills; main UI stays calm.  
4. **BYOK first** — User brings Groq key; no forced cloud account for the app itself.  
5. **Mobile-first, minimal light UI** — Large tap targets, bottom nav, overlays; optional dark mode.  
6. **Artifacts are first-class** — Structured, selectable, editable, exportable, with status (draft / ready).  

---

## 4. Information architecture

```
App shell
├── Header (Lena identity, active project name, theme / skills / settings)
├── Project banner (when a project is active → Export)
├── Tabs
│   ├── Chat          — conversation with Lena
│   ├── Showroom      — artifacts list + preview / inline edit
│   └── Projects      — multi-project list (create / open / rename / delete)
├── Overlays
│   ├── Settings      — BYOK, model, temperature, stream, system prompt, theme, data reset
│   └── Skills        — CRUD for reusable AI capabilities
└── Modals
    ├── Skill editor
    ├── New project
    └── Export (JSON / HTML / Markdown)
```

---

## 5. Functional requirements

### 5.1 Chat (Tab A)

| ID | Requirement | Priority |
|----|-------------|----------|
| C-1 | Text chat with Lena, Enter to send, Shift+Enter for newline | P0 |
| C-2 | Streaming responses (SSE) with live bubble; toggleable in Settings | P0 |
| C-3 | Suggestion chips for common starts (incl. glamping scenario) | P1 |
| C-4 | Voice input via Web Speech API where available | P1 |
| C-5 | Image attach (preview + send); multimodal when model supports vision (e.g. Qwen 3.8 27B) | P1 |
| C-6 | Typing indicator / streaming cursor; error messages when API fails | P0 |
| C-7 | Conversation scoped to **active project** | P0 |
| C-8 | Clear conversation (keep artifacts) from Settings | P1 |

**Lena system behavior (P0):**

- Personified as Lena; practical, warm, asks follow-ups.  
- On plan acceptance: confirm goals, outline phases/channels/timeline, invoke skills, emit artifacts.  
- Artifacts emitted via markers:  
  `[[ARTIFACT:type|title]]` … content … `[[/ARTIFACT]]`  
  Types: `plan`, `social`, `email`, `ad`, `landing`, `calendar`, `other`.  
- Calendar content should prefer lines: `YYYY-MM-DD | Channel | Asset | Notes` for UI parsing.

### 5.2 Showroom (Tab B)

| ID | Requirement | Priority |
|----|-------------|----------|
| S-1 | Selectable list of project artifacts | P0 |
| S-2 | Preview with title, type, status, timestamps | P0 |
| S-3 | **Inline edit**: title + body; Save / Cancel; ⌘/Ctrl+S, Esc | P0 |
| S-4 | Copy content to clipboard | P0 |
| S-5 | **Ask Lena** — jump to Chat with revise prompt prefilled | P1 |
| S-6 | Accept artifact → status `ready` (re-edit resets to `draft`) | P0 |
| S-7 | Calendar view for `calendar` type (grid by date) + text toggle | P1 |
| S-8 | Badge on nav showing artifact count | P2 |

### 5.3 Projects

| ID | Requirement | Priority |
|----|-------------|----------|
| P-1 | Multiple projects; each has messages, artifacts, name, goal, status | P0 |
| P-2 | Create / open / rename / delete | P0 |
| P-3 | Active project reflected in header and banner | P0 |
| P-4 | Auto-create project when user starts working if none active | P1 |
| P-5 | Optional auto-name from first plan artifact title | P2 |

### 5.4 Skills (CRUD)

| ID | Requirement | Priority |
|----|-------------|----------|
| K-1 | Default skills: Social, Email sequence, Ad copy, Landing copy, Content calendar | P0 |
| K-2 | Create / edit / delete skills (name, description, instructions for Lena) | P0 |
| K-3 | Skill definitions injected into system context so Lena can use them | P0 |

### 5.5 Settings (BYOK & generation)

| ID | Requirement | Priority |
|----|-------------|----------|
| T-1 | Groq API key stored only in `localStorage` | P0 |
| T-2 | Model select from current Groq chat models (e.g. GPT-OSS 20B / 120B, Qwen 3.8 27B) | P0 |
| T-3 | Temperature control | P1 |
| T-4 | Optional extra system prompt (“machine prompt”) | P1 |
| T-5 | Stream on/off | P1 |
| T-6 | Dark / light theme, persisted | P1 |
| T-7 | Clear chat / reset all data | P1 |

### 5.6 Export

| ID | Requirement | Priority |
|----|-------------|----------|
| E-1 | Export active project as **JSON** package (project meta, conversation, artifacts) | P0 |
| E-2 | Export **HTML** readable report | P1 |
| E-3 | Export **Markdown** document | P1 |

### 5.7 Cross-cutting

| ID | Requirement | Priority |
|----|-------------|----------|
| X-1 | Mobile-first layout; safe-area aware; max width for large screens | P0 |
| X-2 | Persistence of settings, skills, projects in browser storage | P0 |
| X-3 | Migration path from prior storage key (`lena_campaign_v1` → `v2`) | P2 |
| X-4 | No server required for MVP; pure static HTML/JS | P0 |

---

## 6. UX requirements

- **Minimal chrome:** Bottom nav (Chat / Showroom / Projects); secondary actions in header icons.  
- **Overlays** for Settings and Skills (not separate routes).  
- **Light default**, optional dark mode.  
- **Toasts** for short feedback (saved, exported, errors).  
- **Empty states** with guidance on Chat, Showroom, and Projects.  
- **Accessibility baseline:** Labels on icon buttons, focusable controls, readable contrast in both themes.

---

## 7. Technical approach (MVP)

| Layer | Choice |
|-------|--------|
| Delivery | Single self-contained HTML file (CSS + JS inline) |
| LLM | Groq OpenAI-compatible API (`https://api.groq.com/openai/v1`) |
| Auth | User API key in `Authorization: Bearer` |
| Streaming | `stream: true` + SSE parse of `chat/completions` |
| Vision | Image data URLs in multimodal message content when model supports it |
| State | `localStorage` key `lena_campaign_v2` |
| Speech | `SpeechRecognition` / `webkitSpeechRecognition` when present |
| Export | Client-side `Blob` downloads (JSON / HTML / Markdown) |

**Out of scope for MVP host:** backend, auth service, DB, live channel connectors.

---

## 8. Success metrics (post-MVP)

- % of sessions that produce ≥1 artifact  
- % of artifacts accepted or inline-edited  
- Export completion rate  
- Time from first message to first accepted plan  
- Error rate on API calls (key/model issues vs. product bugs)  

---

## 9. Risks & mitigations

| Risk | Mitigation |
|------|------------|
| Groq model list / free tier changes | Document models in Settings; allow user to pick; keep IDs configurable |
| Vision only on some models | Tip user to switch to vision-capable model when images attached |
| localStorage limits / loss | Clear export path; warn on reset; future optional backup |
| Marker parsing failures | Strip markers for display; still show raw reply if parse empty |
| Scope creep into “publish everywhere” | Explicit non-goal; export is the handoff |

---

## 10. Roadmap (suggested)

### Phase 1 — Done (this MVP)

- Chat + streaming + BYOK Groq  
- Skills CRUD  
- Projects + artifacts + inline edit + accept  
- Calendar view, multimodal attach, export trio, dark mode  

### Phase 2

- Stop/abort generation control  
- ZIP export (e.g. JSZip) bundling JSON + HTML + assets  
- Per-project brand voice / system prompt  
- Stronger offline / PWA install shell  

### Phase 3

- Optional connectors (scheduling tools, email ESP) via user OAuth  
- Team workspace + server-side key vault (still BYOK-capable)  
- Template library of campaign types beyond free-form chat  

---

## 11. Open decisions

- Whether calendar parsing should support more flexible date formats.  
- Whether “Accept all” / bulk export of only `ready` artifacts is needed.  
- Formal content moderation vs. relying on model + user responsibility.  

---

## 12. Appendix — Original product brief (condensed)

> Single-page HTML app for campaign content generation and automation. Settings with BYOK for Groq; model select; temperature and machine prompts. CRUD for skills the AI can use. Tab A: chat (text/audio/upload). Tab B: showroom for generated artifacts. Mobile-first, minimal light UX. Personify the LLM as **Lena**. Scenario: glamping hut bookings Dec–Mar → follow-ups → marketing campaign → project space, plan, skills, artifacts, scheduling → inspect/edit/accept in display panel → export full campaign.

This PRD is the formalization of that brief plus the capabilities delivered in the current Lena Campaign Studio build.

---

## 13. Deliverable reference

| Artifact | Location |
|----------|----------|
| Application | `lena-campaign-app.html` (single-page app) |
| This PRD | `PRD.md` |
