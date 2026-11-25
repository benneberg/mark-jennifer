UI_SPEC.md — Hedetangen AI Marketing Studio

Version: 1.0
Companion: PRD.md §5, §9; ARCHITECTURE.md §8, §10

---

1. Design tokens

Defined as CSS custom properties on :root and overridden on [data-theme="dark"]. The dark theme is a warm dark (charcoal-brown, not blue-black), matching the brand's evening firelight mood.

```css
:root {
  /* surface */
  --bg:            #f7f4ef;   /* warm off-white */
  --surface:       #fffdf9;   /* card / drawer */
  --surface-muted: #efeae2;   /* secondary panels */
  --border:        #ddd5c8;
  --border-strong: #c4b8a6;

  /* text */
  --text:          #2b2620;
  --text-muted:    #6f665b;
  --text-faint:    #9a9082;

  /* accent — soft bronze/copper */
  --accent:        #a8724a;
  --accent-soft:   #e8d9c9;
  --accent-text:   #5c3a22;

  /* semantic */
  --danger:        #a4453b;
  --success:       #4f6b4a;

  /* structure */
  --radius:        10px;
  --radius-sm:     6px;
  --space-1:       4px;
  --space-2:       8px;
  --space-3:       12px;
  --space-4:       16px;
  --space-5:       24px;
  --space-6:       32px;
  --shadow-drawer: 0 8px 32px rgba(43, 38, 32, 0.12);

  /* type */
  --font-body: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto,
               "Helvetica Neue", Arial, sans-serif;
  --font-mono: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  --text-xs: 0.75rem; --text-sm: 0.875rem; --text-md: 1rem;
  --text-lg: 1.125rem; --text-xl: 1.375rem;
  --leading: 1.55;
}

[data-theme="dark"] {
  --bg:            #1c1916;
  --surface:       #252019;
  --surface-muted: #2f2820;
  --border:        #3d352b;
  --border-strong: #55493b;
  --text:          #f0e9de;
  --text-muted:    #b3a89a;
  --text-faint:    #7d7266;
  --accent:        #c98a5c;
  --accent-soft:   #3a2c20;
  --accent-text:   #f0c9a8;
  --danger:        #d47a6f;
  --success:       #8aab84;
  --shadow-drawer: 0 8px 32px rgba(0, 0, 0, 0.45);
}
```

Typography rules: body at --text-md (16px) on mobile, --text-sm for metadata, --text-xl for the app title only. No font weights below 400 or above 600. No letter-spacing tricks. No display fonts in v1 — the brand's restraint is the design.

No gradients, no glassmorphism, no neumorphism. Separation is by border and background tint only. This is the Scandinavian restraint the brand asks for.

---

2. Layout

2.1 Mobile (< 720px) — primary target

```
┌──────────────────────────────┐
│ ☰  Hedetangen        ⋯      │  ← header (56px, sticky)
├──────────────────────────────┤
│                              │
│   chat message list          │  ← scrollable, flex-1
│   (append-only)              │
│                              │
│                              │
├──────────────────────────────┤
│ [ + ]  [ composer…   ] [ ↑ ] │  ← composer (sticky, safe-area)
└──────────────────────────────┘
```

· Header: hamburger (opens primary drawer), title, overflow menu (new chat, library, settings).
· Composer: + button (wizard entry), auto-growing textarea (max 5 rows), send button that becomes stop (■) during a turn.
· Drawers (settings, library, experts, guardrails) are full-screen overlays sliding up from the bottom, with a visible close (×) and a back-swipe gesture.
· Safe areas: composer sits above env(safe-area-inset-bottom); header respects env(safe-area-inset-top).

2.2 Tablet / desktop (≥ 720px)

```
┌──────────────────────────────────────────────────────┐
│ Hedetangen AI Studio          [Library] [Settings]   │
├──────────────────────────┬───────────────────────────┤
│                          │                           │
│   chat message list      │   right rail (collapsible)│
│                          │   default: collapsed      │
│                          │   expanded: library or    │
│                          │   active panel            │
│                          │                           │
├──────────────────────────┤                           │
│ [ + ] [ composer… ] [↑]  │                           │
└──────────────────────────┴───────────────────────────┘
```

· Chat column: minmax(0, 1fr), max content width 760px, centered.
· Right rail: 360px when open, 0 when collapsed, 260ms ease transition (disabled under prefers-reduced-motion).
· Header actions are text buttons, not icons, above 720px — clearer for a non-technical owner.
· At ≥ 1100px, the rail can be pinned open via a toggle; state persists in localStorage.

2.3 Chat message anatomy

```
┌──────────────────────────────────────────┐
│ You                            14:02     │  ← role + time (metadata, muted)
│ I need three Instagram captions…        │
└──────────────────────────────────────────┘

┌──────────────────────────────────────────┐
│ Jennifer                       14:02     │
│ I'll have our Copywriter draft three…    │
│ ┌──────────────────────────────────────┐ │
│ │ Copywriter is working…               │ │  ← inline delegation strip
│ └──────────────────────────────────────┘ │
│ [final synthesis streams here]           │
│                                          │
│ [Copy] [Save to library]                 │  ← actions, hover/tap reveal
└──────────────────────────────────────────┘
```

· User messages: right-aligned on desktop, full-width on mobile with a subtle left border accent (--accent-soft). Never a colored bubble that competes with the AI content.
· Jennifer messages: full-width, no bubble, left-aligned. The content is the hero.
· Expert inline strip: a small --surface-muted block inside Jennifer's message showing {Expert} is working… with a pulsing dot. It resolves into the final synthesis in place. This is the only visual signal of delegation — no separate expert chat panes.
· Actions (Copy, Save to library) appear on hover on desktop and on tap on mobile (below the message, not floating).

---

3. Component inventory & states

Every component below must implement empty, loading, populated, error, and disabled states where applicable. The build should not ship a component with only the happy path.

3.1 Chat list (ui/chat.js)

State Rendering
Empty (new chat) Welcome card: one-sentence value prop + three suggestion chips (see §4.2)
Populated Message list, append-only; auto-scroll only if user is within 80px of bottom
Streaming Current Jennifer bubble shows tokens; a subtle caret; aria-live="polite"
Stopped Partial content + — stopped marker in --text-faint
Error Error card inside the message flow (not a modal), authored in Jennifer's voice, with recovery buttons
Loading history Skeleton rows (3) on chat open while IndexedDB loads

Virtualization: none in v1. Cap rendered messages at the last 500 per chat; “Load older” button at the top when truncated.

3.2 Composer (ui/composer.js)

State Behavior
Idle Placeholder: “Ask Jennifer anything about marketing, copy, campaigns, or pricing…”
Focused Border → --accent; send button enables when non-empty
Sending / streaming Textarea disabled; send → stop (■); helper line: “Jennifer is working — tap ■ to stop.”
No key / no model Composer disabled; inline banner above it: “Add an API key in Settings to start.” + button
Wizard active Composer hidden; wizard takes its place (see §5)

Behaviors: Enter sends, Shift+Enter newline. Auto-grow to 5 rows. Draft text persists in memory per chat (lost on reload in v1 — acceptable; flagged for v1.1 localStorage draft).

3.3 Settings drawer (ui/settings-panel.js)

Sections, in order:

1. Provider — segmented control: Groq / OpenRouter / OpenAI / Demo. Changing provider clears the model selection and shows the key field for that provider.
2. API key — password input, paste-friendly, “Validate & load models” button. States: empty, validating (spinner), valid (green check + model count), invalid (error in --danger with recovery text). Checkbox: “Remember key on this device” (default on; off = session-only).
3. Model — searchable select, grouped “Free” first then “Paid”. Each option shows name + context window + a Free / Paid badge. A muted line below: “Free-tier limits are set by the provider and change without notice.” “Refresh” link with last-refreshed timestamp.
4. Temperature — slider 0.0–1.5, step 0.1, with a live label (Precise ↔ Creative). Default 0.7.
5. Language — segmented: Auto / Svenska / English / Bilingual.
6. Machine prompt — collapsible textarea, maxlength=4000, helper: “Optional seasonal context, e.g. ‘Summer 2026 campaign, bookings open in March.’ Applied to every reply.”
7. Data — Export / Import buttons; “Clear all data” in --danger with typed confirmation.
8. About — app version, links to PRD/Architecture (optional), and the privacy notice (verbatim from PRD §10).

Every field shows a save confirmation (subtle check that fades) — no global “Save” button. Changes persist immediately.

3.4 Expert editor (ui/expert-editor.js)

· List view: rows with name, role, enabled toggle, edit/delete. “Add expert” at top. Import/export buttons in the header.
· Edit form: Name, Role (short), System prompt (large textarea with a “Insert guardrails placeholder” hint — not actual guardrails; those are injected automatically and the UI says so), Temperature (optional override), Tags (chips), Enabled toggle.
· Delete: confirmation modal that names the expert and warns if it is currently referenced by a recent chat.
· Validation: inline, field-level, driven by expert.schema.json.

3.5 Guardrails editor (ui/guardrails-editor.js)

· Read-only block at the top: the honesty rule, visually distinct (--surface-muted, a small lock icon), with the line “This rule is always applied and cannot be edited. It protects your brand from AI inventing places or structures.”
· Editable fields below: essence, materials (tag input), colour & light (tag input), people, cinema, emotion, avoid (tag input), extra notes. All validated against guardrails.schema.json.
· Reset to default button with confirmation.
· History (last 5 snapshots): a collapsed list with “Restore” per entry.

3.6 Library panel (ui/library-panel.js)

· Filter bar: type chips (All / Copy / Campaign / Research / Visual brief / Note) + tag filter + search input.
· Item cards: title, type badge, snippet (2 lines), date, actions (Copy, Export, Delete).
· Empty state: “Nothing saved yet. Tap ‘Save to library’ under any reply from Jennifer.”
· Bulk actions: select mode → Export selected (JSON) / Delete.

3.7 Wizard (ui/wizard.js)

Three steps, one card at a time, progress dots at the top, Back/Next at the bottom (Next disabled until required fields are set).

Step 1 — Objective & audience

· Goal: segmented (Awareness / Bookings / Off-season / Partnerships).
· Audience: occasion chips (Couples’ reset, Milestone, Winter aurora, International road-trippers, Locals gifting).
· Language: Auto / SV / EN / Bilingual.

Step 2 — Channel & format

· Channels: multi-select chips (Instagram, Facebook, Email, Website, Google Ads).
· Output: multi-select (Captions, Ad variants, Email sequence, Landing page sections, Visual brief, Content calendar).

Step 3 — Review & generate

· Read-only summary of steps 1–2.
· A compact card of the guardrails that will apply (honesty rule + key avoid-list items), with a note: “These are always applied.”
· “Generate” button → wizard closes, inputs are posted as a user message into the chat, Jennifer runs the turn normally.

Wizard cancel: returns to chat with no side effects. Wizard state is not persisted across reloads in v1.

3.8 Toasts (ui/toast.js)

Bottom-center on mobile, bottom-right on desktop. Max 3 visible, 4s auto-dismiss, manual dismiss. Used for: saved to library, settings saved, export complete, import complete, storage write failed. Never used for AI errors — those live inline in the chat.

3.9 Modals (confirmations only)

Used only for destructive actions: delete expert, clear all data, replace on import. Centered, focus-trapped, Esc to close. No other modals.

---

4. Interaction specs

4.1 Sending a message

1. User taps send (or Enter).
2. Composer disables; user message appends immediately with status: "complete".
3. Jennifer’s planning call runs (no visible output yet); a status line appears: “Jennifer is thinking…”.
4. On delegation: the handoff <response> is shown as Jennifer’s message with the expert strip underneath.
5. Synthesis streams into the same bubble.
6. Composer re-enables; send button returns; a subtle “done” check appears for 1s.

Cancellation: tapping stop aborts the fetch, marks the current message status: "stopped", keeps partial text, re-enables the composer. A toast confirms: “Stopped. You can edit your message and try again.”

4.2 Empty-chat suggestions

Three chips, tappable to prefill the composer:

· “Draft three Instagram captions for a winter sauna campaign.”
· “Plan a spring campaign to fill summer bookings.”
· “What should I post this week?”

4.3 Save to library

Tapping “Save to library” on a Jennifer message opens a small inline popover (not a modal): title (pre-filled from the first line, editable), type selector, tags input, Save. On save: toast + the action button changes to a filled check. The savedToLibrary flag is set on the message.

4.4 Import / export

· Export: builds the JSON in memory, triggers a download named hedetangen-studio-YYYY-MM-DD.json. A toast confirms with the item count.
· Import: file picker → parse → validate → preview modal (counts + guardrails changed yes/no) → Merge / Replace / Cancel. Validation errors are listed with paths like experts[2].name: required. No partial imports.

4.5 Keyboard shortcuts (desktop)

Keys Action
Enter Send
Shift+Enter Newline
Esc Close drawer / stop streaming (if active)
Cmd/Ctrl+K Focus composer
Cmd/Ctrl+Shift+L Open library

Shortcuts are not advertised in the UI in v1 (avoid overwhelm); they are documented in the README.

---

5. Accessibility minimums

· Focus: every interactive element reachable by Tab, visible focus ring using --accent at 2px offset. Drawers focus-trap on open and restore focus on close.
· Live regions: streaming bubble has aria-live="polite" and aria-atomic="false". Error cards use role="alert".
· Labels: all icon-only buttons have aria-label. The send button announces “Send” / “Stop”.
· Motion: @media (prefers-reduced-motion: reduce) disables drawer slide, typing caret blink, and pulsing dot (replaced by static text).
· Contrast: all text pairs meet WCAG AA against their background in both themes. The --text-faint token is used only for non-essential metadata and is verified at ≥ 4.5:1 on --surface.
· Touch targets: minimum 44×44px for all tappable elements on mobile.

---

6. Responsive breakpoints (summary)

Range Layout Drawers Composer
< 720px Single column Full-screen, slide-up Sticky bottom, safe-area
720–1099px Chat + collapsible rail Right slide-in over chat Sticky bottom of chat column
≥ 1100px Chat + pinnable rail Right slide-in, chat stays visible Sticky bottom

---

7. What is not in the UI (v1)

· No chat list sidebar (single active chat; “New chat” resets). Multi-chat browsing is v1.1.
· No model comparison or A/B view.
· No onboarding tour beyond the welcome card and the settings prompt.
· No analytics, no usage dashboard, no cost tracker. The debug panel (hidden behind ?debug=1) shows per-turn call counts only.
· No drag-and-drop reordering of experts. Alphabetical + enabled-first sort only.

These are deliberate omissions to keep the surface calm for a two-person business. Each is a clean addition later without restructuring the layout.

---

End of UI_SPEC.md v1.0
