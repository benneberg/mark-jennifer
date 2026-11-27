---
metadata:
  analysis_date: "2026-11-27T12:55:00-08:00"
  analysis_version: "1.0.0"
  analyzed_by: "Project Intelligence Agent"
  analysis_scope: "Repository root, build/CI configuration, docs summary, schemas, src/ architecture overview, and test/typecheck verification"
  repository_access: "FULL_LOCAL_WORKSPACE_NO_REMOTE_RUNTIME_VERIFICATION"
  files_inspected:
    - "package.json"
    - "metadata.json"
    - "README.md"
    - "SECURITY.md"
    - "index.html"
    - "vite.config.ts"
    - "tsconfig.json"
    - ".gitignore"
    - ".nvmrc"
    - ".github/workflows/deploy.yml"
    - "docs/ARCHITECTURE.md (lines 1-120)"
    - "docs/CI_WORKFLOW.md"
    - "docs/CONCEPT_NOTES.md"
    - "src/constants.ts"
    - "src/types.ts"
    - "src/data/business.json"
    - "src/storage/db.ts"
    - "src/storage/crypto.ts"
    - "src/utils/validate.ts (lines 1-60)"
    - "src/campaign/engine.ts"
    - "src/campaign/honestyLint.ts"
    - "src/campaign/exportPackage.ts"
    - "src/orchestration/jennifer.ts (lines 1-120)"
    - "src/orchestration/router.ts"
    - "src/providers/base.ts (lines 1-45)"
    - "src/providers/mock.ts (lines 1-90)"
    - "src/components/BusinessProfileEditor.tsx"
    - "src/components/ChatList.tsx"
    - "src/components/Composer.tsx"
    - "src/components/GuardrailsEditor.tsx"
    - "src/components/ModulesView.tsx"
    - "src/components/PackageView.tsx"
    - "src/components/SettingsPanel.tsx"
    - "src/components/Wizard.tsx"
    - "src/App.tsx"
    - "tests/core.test.ts"
    - "tests/schemas.test.ts"
    - "tests/providers.test.ts"
    - "tests/storage.test.ts (lines 1-45)"
  directories_inspected:
    - "/"
    - "/.github"
    - "/.github/workflows"
    - "/docs"
    - "/schemas"
    - "/src"
    - "/src/campaign"
    - "/src/components"
    - "/src/data"
    - "/src/orchestration"
    - "/src/providers"
    - "/src/storage"
    - "/src/utils"
    - "/tests"
    - "/variants"
  commands_or_tools_used:
    - "list_dir"
    - "view_file"
    - "run_command: npm run lint (tsc --noEmit)"
    - "run_command: npm test (tsx --test \"tests/**/*.test.ts\" \"tests/**/*.test.tsx\")"
  limitations:
    - "Did not inspect all files inside /variants, /public, /docs/PRD.md, /docs/PROMPTS.md, /docs/SCHEMAS.md, /docs/UI_SPEC.md, tests/markdown.test.tsx, tests/validate.test.ts, or remaining provider/storage/component modules beyond those listed."
    - "Did not execute `npm run build` in this session to avoid modifying/creating dist/ artifacts."
    - "No access to live external AI provider responses (Groq, OpenRouter, OpenAI), GitHub Actions execution logs, live GitHub Pages deployment reachability, or real user analytics/adoption metrics."

repository_context:
  repository_name: "hedetangen-ai-studio"
  repository_url: "https://github.com/benneberg/mark-jennifer"
  primary_language: "TypeScript"
  frameworks:
    - "React 19"
    - "Vite 8"
    - "Tailwind CSS v4 (@tailwindcss/vite)"
  package_manager: "npm scripts declared in package.json; bun.lock present at root (no package-lock.json)"
  build_system: "Vite (vite build) + TypeScript strict typecheck (tsc --noEmit)"
  deployment_target: "GitHub Pages static SPA (dist/ via .github/workflows/deploy.yml)"
  detected_tools:
    - "tsx (unit test runner via node:test)"
    - "fake-indexeddb (IndexedDB test harness)"
    - "lucide-react (UI icons)"
    - "Web Crypto API (AES-GCM 256 key storage)"
    - "GitHub Actions (actions/deploy-pages@v4)"

project_identity:
  project_name:
    value: "Hedetangen AI Marketing Studio (also titled 'Mark & Jennifer' in README.md)"
    evidence_state: OBSERVED
    confidence: HIGH
    evidence: "metadata.json, src/constants.ts, index.html ('Hedetangen AI Marketing Studio'); README.md ('Mark & Jennifer — AI Marketing Studio for small and medium sized businesses')."
    notes: "Naming transition between 'Hedetangen AI Marketing Studio' and 'Mark & Jennifer' is partially reflected across docs and repo URL."
  suggested_names:
    value:
      - "Mark & Jennifer"
      - "Hedetangen AI Marketing Studio"
    evidence_state: SUGGESTED
    confidence: MEDIUM
    evidence: "README.md uses 'Mark & Jennifer' for broader SMB framing while codebase/metadata uses 'Hedetangen AI Marketing Studio'."
    notes: "Clarify whether the product is Hedetangen-specific internal tooling or a white-label SMB product ('Mark & Jennifer')."
  short_description:
    value: "Client-side, browser-only AI marketing studio and deterministic campaign package builder for Hedetangen AB with Brand DNA guardrails, Honesty Lint, multi-provider BYOK, and encrypted local key storage."
    evidence_state: OBSERVED
    confidence: HIGH
    evidence: "package.json, metadata.json, README.md, src/App.tsx, src/campaign/engine.ts, src/storage/crypto.ts."
    notes: ""
  one_sentence_pitch:
    value: "A zero-backend, privacy-first browser marketing studio that turns small-hospitality business facts and Brand DNA guardrails into verified campaign packages, bilingual copy, and importable calendars using your own AI API key."
    evidence_state: INFERRED
    confidence: HIGH
    evidence: "Derived from README.md, src/data/business.json, src/campaign/engine.ts, and src/campaign/honestyLint.ts."
    notes: ""
  category:
    value: "AI Marketing Workspace / Campaign Generation Tool"
    evidence_state: OBSERVED
    confidence: HIGH
    evidence: "package.json description, src/App.tsx workspace views (chat, campaigns, modules)."
    notes: ""
  project_type:
    value: "Client-side Single Page Application (SPA)"
    evidence_state: OBSERVED
    confidence: HIGH
    evidence: "index.html, vite.config.ts, zero backend server files, IndexedDB persistence."
    notes: ""
  domain:
    value: "Hospitality / Eco-tourism Marketing & Small-Business Content Operations"
    evidence_state: OBSERVED
    confidence: HIGH
    evidence: "src/data/business.json, README.md, src/campaign/honestyLint.ts."
    notes: ""
  technology_tags:
    value:
      - "TypeScript"
      - "React 19"
      - "Vite 8"
      - "Tailwind CSS v4"
      - "IndexedDB"
      - "Web Crypto API"
      - "BYOK LLM Integration"
      - "JSON Schema Validation"
    evidence_state: OBSERVED
    confidence: HIGH
    evidence: "package.json, vite.config.ts, src/storage/db.ts, src/storage/crypto.ts, src/utils/validate.ts."
    notes: ""
  audience_tags:
    value:
      - "Small hospitality & eco-tourism owners (specifically Hedetangen AB)"
      - "Small and medium-sized business marketers (secondary framing in README.md)"
    evidence_state: OBSERVED
    confidence: HIGH
    evidence: "src/data/business.json ('Joacim', 'Madeleine'), README.md."
    notes: ""

project_classification:
  project_intent:
    value: "Operational marketing production tool built initially for Hedetangen AB, with emerging productization intent as 'Mark & Jennifer'."
    evidence_state: INFERRED
    confidence: HIGH
    evidence: "Deep Hedetangen defaults in src/data/business.json, src/data/seed-guardrails.ts, and src/data/seed-experts.ts paired with editable profiles and 'Mark & Jennifer' branding in README.md."
    notes: ""
  intent_score:
    value: 0.85
    evidence_state: INFERRED
    confidence: HIGH
    evidence: "Defined domain models, schema validation, CI/CD workflow, security policy, and end-to-end UI workflows show strong product/tool intent beyond an experiment."
    notes: "Heuristic score (0.0-1.0); not a probability of commercial success."
  class:
    value: "INTERNAL_TOOL"
    evidence_state: INFERRED
    confidence: MEDIUM
    evidence: "Seeded business profile, brand DNA, and honesty rules are tailored specifically to Hedetangen's floating AuroraHut / Värmland eco-tourism business, though README.md frames 'Mark & Jennifer' for SMBs (secondary class: PRODUCT)."
    notes: "Primary class INTERNAL_TOOL; secondary potential as PRODUCT if multi-tenant onboarding/templates are generalized."

project_purpose:
  problem_solved:
    value: "Helps lean small-business operators generate grounded, bilingual (SV/EN) marketing campaigns and daily content without leaking secrets to third-party servers, paying SaaS subscriptions, or letting LLMs hallucinate physical structures, unapproved prices, or weather guarantees."
    evidence_state: OBSERVED
    confidence: HIGH
    evidence: "docs/CONCEPT_NOTES.md, src/campaign/honestyLint.ts, src/storage/crypto.ts, src/campaign/engine.ts."
    notes: ""
  target_users:
    value: "Observed primary target: Hedetangen AB owners (Joacim & Madeleine). Broad target described in README.md: small and medium-sized businesses. Real external user adoption is UNKNOWN."
    evidence_state: OBSERVED
    confidence: HIGH
    evidence: "src/data/business.json, README.md."
    notes: ""
  main_use_case:
    value: "Generating structured campaign packages (strategy, phased checklist, bilingual social/email/ad/landing copy, atmospheric video prompts, `.ics` calendars, and `.zip`/`.md` exports) plus conversational marketing assistance via BYOK LLMs or offline Demo Mode."
    evidence_state: OBSERVED
    confidence: HIGH
    evidence: "src/App.tsx, src/components/Wizard.tsx, src/components/PackageView.tsx, src/components/ModulesView.tsx."
    notes: ""
  core_value:
    value: "Deterministic Brand DNA and Honesty Lint enforcement over client-side BYOK LLM workflows with offline Demo Mode and portable JSON/ZIP/ICS outputs."
    evidence_state: INFERRED
    confidence: HIGH
    evidence: "src/campaign/engine.ts, src/campaign/honestyLint.ts, src/campaign/exportPackage.ts, src/storage/crypto.ts."
    notes: ""

project_state:
  current_focus:
    value: "Transition from pure multi-agent chat orchestration toward a deterministic structured-JSON Campaign Package Engine with editable BusinessProfile, Honesty Lint, and thin studio modules."
    evidence_state: OBSERVED
    confidence: HIGH
    evidence: "src/campaign/*, src/data/business.json, src/components/PackageView.tsx, src/components/ModulesView.tsx, src/components/BusinessProfileEditor.tsx, tests/core.test.ts."
    notes: ""
  active_work:
    value: "Campaign Package Engine and standalone modules are implemented in src/, but typecheck and legacy/storage/provider test suites currently have unresolved failures."
    evidence_state: OBSERVED
    confidence: HIGH
    evidence: "Observed `npm run lint` failure in src/providers/mock.ts(76,15) and 10/41 failing subtests in `npm test`."
    notes: ""
  blocked_by:
    value:
      - "TypeScript compile failure: `src/providers/mock.ts(76,15)` references `options.stage`, which is missing from `ChatRequestOptions` in `src/providers/base.ts`."
      - "Test suite failures: 8 failures in `tests/storage.test.ts` (7 from `localStorage is not defined` in Node + 1 `updateChat` rejection assertion) and 1 failure in `tests/providers.test.ts` (string error code taxonomy test), blocking CI `validate` job."
    evidence_state: OBSERVED
    confidence: HIGH
    evidence: "Direct command execution output of `npm run lint` and `npm test` on 2026-11-27."
    notes: ""
  next_milestone:
    value: "Restore green `npm run lint` (`tsc --noEmit`), resolve all 10 failing tests in `npm test`, and verify `npm run build` + CSP output cleanly."
    evidence_state: SUGGESTED
    confidence: HIGH
    evidence: "Required by `.github/workflows/deploy.yml` before any GitHub Pages deployment can succeed."
    notes: ""
  lifecycle:
    value: "FUNCTIONAL_CORE_LOOP"
    evidence_state: OBSERVED
    confidence: HIGH
    evidence: "End-to-end chat orchestration, Campaign Package Engine, Honesty Lint, ZIP/ICS export, and IndexedDB storage are implemented and 31/41 tests pass (including all 17 tests in tests/core.test.ts), while failing `tsc --noEmit` and 10 failing tests prevent SHIPPABLE status."
    notes: "Although README.md lists a GitHub Pages URL and deploy.yml exists, current codebase fails CI validation gates and live deployment state is unverified."
  status:
    value: "Core workflows implemented; quality gates currently red (1 TypeScript error, 10/41 test failures)."
    evidence_state: OBSERVED
    confidence: HIGH
    evidence: "Output of `npm run lint` and `npm test`."
    notes: ""

recommendations:
  primary_direction:
    value: "Fix the TypeScript `ChatRequestOptions.stage` mismatch and the 10 failing unit tests in `tests/storage.test.ts` and `tests/providers.test.ts`, then run `npm run check` (`typecheck && test && build`) to unblock CI/CD deployment."
    evidence_state: SUGGESTED
    confidence: HIGH
    evidence: "Directly addresses the observed blockers in `.github/workflows/deploy.yml`."
    notes: ""
  alternatives:
    value:
      - "Commit a canonical `package-lock.json` aligned with Vite 8 / peer dependencies so CI uses deterministic `npm ci` rather than `npm install --legacy-peer-deps`."
      - "Add published JSON Schema files under `schemas/` for `BusinessProfile` and `CampaignPackage` (matching `tests/schemas.test.ts` pattern) and validate live Groq/OpenRouter behavior against `tests/TEST_CASE.md`."
    evidence_state: SUGGESTED
    confidence: MEDIUM
    evidence: "Observed `bun.lock` without `package-lock.json`, `.github/workflows/deploy.yml` fallback, and `schemas/` coverage gaps."
    notes: ""
  next_action:
    value: "Add/restore `stage?: 'planner' | 'expert' | 'synthesis'` on `ChatRequestOptions` (or remove stale `options.stage` reference in `src/providers/mock.ts`), investigate why `localStorage` is called directly in `src/storage/entities.ts` without `safe-storage.ts` or Node test mock, and fix the 200-body error mapping test mismatch in `tests/providers.test.ts`."
    evidence_state: SUGGESTED
    confidence: HIGH
    evidence: "Directly maps to exact stack traces from `npm run lint` and `npm test`."
    notes: ""

scores:
  effort_required:
    value: "LOW (to fix current red gates); MEDIUM (to generalize beyond Hedetangen)"
    evidence_state: INFERRED
    confidence: MEDIUM
    evidence: "1 TS error and localized Node test environment / error-mapper issues vs. broader productization work."
    notes: "Heuristic estimate."
  technical_complexity:
    value: "MEDIUM"
    evidence_state: INFERRED
    confidence: HIGH
    evidence: "Multi-stage LLM orchestration, SSE streaming parser, schema-validated IndexedDB v2 migrations, Web Crypto AES-GCM, custom zero-dependency ZIP/ICS generators, and deterministic lint/repair loop."
    notes: ""
  potential_value:
    value: "HIGH (for Hedetangen AB's niche marketing workflow); UNKNOWN (for broader SMB market)"
    evidence_state: INFERRED
    confidence: MEDIUM
    evidence: "Directly targets real constraints of a 2-person eco-tourism operator; broader market demand has no evidence in repo."
    notes: "Heuristic assessment; not a prediction."
  opportunity_score:
    value: 74
    evidence_state: SUGGESTED
    confidence: MEDIUM
    evidence: "Well-defined problem space, clean browser-only BYOK privacy model, and differentiated domain guardrails (Honesty Lint), offset by narrow single-brand seed assumptions and unvalidated external demand."
    notes: "Heuristic score (0-100); not a probability of success."
  priority_score:
    value: 82
    evidence_state: SUGGESTED
    confidence: HIGH
    evidence: "Active development is near-complete for core capabilities and blocked primarily by small, concrete verification defects."
    notes: "Heuristic score (0-100)."

health:
  health_score:
    value: 58
    evidence_state: INFERRED
    confidence: HIGH
    evidence: "Strong architecture, strict TS config, CSP injection, Web Crypto, and thorough domain validation, lowered by failing `tsc --noEmit`, 10 failing tests in `npm test`, missing `package-lock.json`, and documentation drift across `README.md`/`docs/`."
    notes: "Heuristic score (0-100) reflecting current observed repository state."
  health_status:
    value: "NEEDS_ATTENTION"
    evidence_state: OBSERVED
    confidence: HIGH
    evidence: "Typecheck and 10 unit tests currently fail."
    notes: ""

ai_suitability:
  workflow:
    value: "ASSISTED"
    evidence_state: INFERRED
    confidence: HIGH
    evidence: "Modular TypeScript codebase with deterministic tests, schema contracts, and clear architectural boundaries suits AI-assisted development, while prompt quality, brand voice, security boundaries, and live LLM behavior require human judgment."
    notes: ""
  automation_potential:
    value: 78
    evidence_state: INFERRED
    confidence: HIGH
    evidence: "High testability for orchestration, schema validation, Honesty Lint, ZIP/ICS export, and UI wiring; lower automation for live external LLM quality tuning and real-world deployment checks."
    notes: "Heuristic score (0-100)."

project_memory:
  important_decisions:
    value:
      - "Browser-only SPA architecture with zero backend servers; API keys stay client-side and go directly to Groq, OpenRouter, or OpenAI."
      - "API keys encrypted at rest in IndexedDB via Web Crypto AES-GCM 256 with a non-extractable CryptoKey (with session-memory fallback when 'Remember key' is off or outside secure context)."
      - "Build-time Content-Security-Policy meta tag injection in `vite.config.ts` restricting `connect-src` strictly to self + Groq/OpenRouter/OpenAI."
      - "Pivot from unstructured free-text chat/XML delegation alone to a deterministic Campaign Package Engine (`src/campaign/`) using JSON mode (with HTTP 400 fallback), low temperatures (0.25-0.35), JSON schema validation, deterministic Honesty Lint, and 1 automatic repair retry."
      - "Factual business details extracted out of hardcoded prompts into `src/data/business.json` + IndexedDB-persisted `BusinessProfile`, keeping personal health/family stories out of prompt context."
      - "Zero-dependency RFC 5545 `.ics` calendar and CRC32 STORE `.zip` package generators (`src/campaign/exportPackage.ts`)."
    evidence_state: OBSERVED
    confidence: HIGH
    evidence: "Observed across vite.config.ts, src/storage/crypto.ts, src/campaign/*, src/data/business.json, and src/orchestration/context.ts."
    notes: ""
  architectural_constraints:
    value:
      - "No backend server exists: all provider requests must remain CORS-compatible browser calls and adhere to `CONTENT_SECURITY_POLICY` in `vite.config.ts`."
      - "IndexedDB schema changes require bumping `DB_VERSION` and adding a migration branch in `src/storage/db.ts` (`DB_VERSION` is currently 2 with `packages` store)."
      - "Build-time CSP restricts external assets to Google Fonts (`fonts.googleapis.com`, `fonts.gstatic.com`); adding new external APIs or CDNs requires updating `vite.config.ts`."
      - "Immutable Honesty Rule: visuals/video prompts cannot reference physical structures unless a reference photo is supplied, weather/aurora claims cannot be guaranteed, and prices/discounts cannot be invented."
      - "Published `schemas/*.json` are tested for parity against inline schemas in `src/utils/validate.ts` by `tests/schemas.test.ts`."
    evidence_state: OBSERVED
    confidence: HIGH
    evidence: "vite.config.ts, src/storage/db.ts, src/campaign/honestyLint.ts, tests/schemas.test.ts."
    notes: ""
  known_limitations:
    value:
      - "AES-GCM master key resides in the same origin as ciphertext in IndexedDB (protects against casual inspection, not XSS or malicious browser extensions, as documented in SECURITY.md)."
      - "No `package-lock.json` is committed (`bun.lock` exists instead), causing CI in `.github/workflows/deploy.yml` to fall back to `npm install --legacy-peer-deps`."
      - "Current `npm run lint` fails on `src/providers/mock.ts(76,15)` (`options.stage` not in `ChatRequestOptions`)."
      - "Current `npm test` fails 8 tests in `tests/storage.test.ts` (Node lacks `localStorage` global used by `src/storage/entities.ts`, plus `updateChat` rejection check) and 1 test in `tests/providers.test.ts`."
      - "`README.md` and `docs/` lag behind the React + Vite + Campaign Package Engine implementation in places (e.g., README still cites 36 tests and original Wizard prose flow; `docs/ARCHITECTURE.md` says v1 migrations only and `.js` layout; `docs/CI_WORKFLOW.md` mentions a committed `package-lock.json`)."
      - "Live AI provider quality and rate-limit behavior depend on external user-supplied API keys and are not verified in automated tests."
    evidence_state: OBSERVED
    confidence: HIGH
    evidence: "SECURITY.md, /, npm run lint, npm test, README.md, docs/ARCHITECTURE.md, docs/CI_WORKFLOW.md."
    notes: ""
  future_ideas:
    value:
      - "Align `schemas/` with `BUSINESS_PROFILE_SCHEMA` and `CAMPAIGN_PACKAGE_SCHEMA`."
      - "Generalize onboarding templates beyond Hedetangen AB if pursuing broader 'Mark & Jennifer' SMB productization."
      - "Run full end-to-end validation of `tests/TEST_CASE.md` against live Groq / OpenRouter keys."
      - "Apply the `docs/CI_WORKFLOW.md` improvements (single install/build, cached Node from `.nvmrc`, CSP check) once workflow push permissions are available."
    evidence_state: SUGGESTED
    confidence: MEDIUM
    evidence: "Inferred from docs/CI_WORKFLOW.md, tests/TEST_CASE.md, README.md, and schemas/."
    notes: ""
  lessons_learned:
    value:
      - "Baking golden test-case facts and regexes directly into orchestration code creates brittle prompt drift and leaks sensitive personal details; isolating factual baselines in `business.json` and extracting generic constraints avoids this."
      - "Free-text XML delegation without structured JSON schemas causes fragile parsing and lost deliverables; schema-validated JSON + deterministic linting with 1 repair retry produces predictable campaign artifacts."
      - "Keeping inline TypeScript schemas synced with `schemas/*.json` via `tests/schemas.test.ts` prevents silent schema drift."
    evidence_state: OBSERVED
    confidence: HIGH
    evidence: "src/orchestration/context.ts, src/campaign/engine.ts, src/campaign/honestyLint.ts, tests/schemas.test.ts."
    notes: ""

technical_assessment:
  architecture:
    value: "Clean modular client-side SPA separated into UI (`src/components`), domain campaign engine (`src/campaign`), LLM orchestration (`src/orchestration`), provider adapters & error taxonomy (`src/providers`), encrypted/schema-validated IndexedDB storage (`src/storage`), and schema/markdown/export utilities (`src/utils`)."
    evidence_state: OBSERVED
    confidence: HIGH
    evidence: "Inspected directory layout and key modules across src/."
    notes: ""
  complexity:
    value: "MEDIUM"
    evidence_state: INFERRED
    confidence: HIGH
    evidence: "Dual-path execution (conversational Jennifer Direct/Team chat + structured Campaign Package Engine), SSE streaming with partial recovery, and client-side crypto/DB migrations."
    notes: ""
  maturity:
    value: "PROTOTYPE_TO_EARLY_PRODUCT"
    evidence_state: INFERRED
    confidence: HIGH
    evidence: "Rich feature set and security posture exist, but failing CI quality gates (`tsc --noEmit` and 10 failing tests) and doc drift indicate active stabilization is still needed."
    notes: ""
  scalability_potential:
    value: "HIGH (for single-tenant static distribution via GitHub Pages); LOW (for multi-user collaboration, server-side secrets, or shared team persistence without adding a backend)"
    evidence_state: INFERRED
    confidence: HIGH
    evidence: "Client-only IndexedDB + BYOK design scales trivially across static CDN visits but intentionally lacks multi-user backend sync."
    notes: ""
  security_sensitivity:
    value: "MEDIUM_HIGH"
    evidence_state: OBSERVED
    confidence: HIGH
    evidence: "Handles user LLM API keys in browser storage and renders LLM-generated Markdown; mitigated via Web Crypto AES-GCM, build-time CSP, SafeMarkdown, and explicit threat-model notes in SECURITY.md."
    notes: "Actual runtime security posture against XSS across all UI components was not audited line-by-line."

ai_context:
  preferred_workflow:
    value: "Read affected modules first, make small modular TypeScript edits, keep `src/utils/validate.ts` and `schemas/*.json` aligned, and run `npm run lint && npm test && npm run build` (`npm run check`) before finishing."
    evidence_state: INFERRED
    confidence: HIGH
    evidence: "package.json (`check` script), tests/schemas.test.ts, tsconfig.json strict flags."
    notes: ""
  coding_preferences:
    value:
      - "Strict TypeScript (`strict: true`, `noUnusedLocals`, `noUnusedParameters`, `noImplicitOverride`)."
      - "Tailwind CSS v4 styling (`@tailwindcss/vite`)."
      - "Functional React 19 components and hooks."
      - "Schema-first persistence (`validateSchema`) before saving or trusting loaded/imported IndexedDB records."
    evidence_state: OBSERVED
    confidence: HIGH
    evidence: "tsconfig.json, package.json, src/storage/entities.ts, src/components/*.tsx."
    notes: ""
  architectural_rules:
    value:
      - "Do not introduce backend servers or telemetry unless explicitly requested."
      - "Never export API keys in workspace export bundles (`ExportPackage`)."
      - "Never bypass the immutable Honesty Rule or `lintCampaignOutput` checks in campaign/module generation."
      - "Bump `DB_VERSION` and add a migration branch in `src/storage/db.ts` whenever changing IndexedDB stores."
      - "Update `vite.config.ts` CSP `connect-src` if adding a new AI provider."
    evidence_state: OBSERVED
    confidence: HIGH
    evidence: "vite.config.ts, src/storage/db.ts, src/storage/entities.ts, src/campaign/honestyLint.ts, SECURITY.md."
    notes: ""
  forbidden_actions:
    value:
      - "Do not hardcode API keys or secrets."
      - "Do not bake personal health/family stories or single-use test-case anecdotes into production prompts/extractors."
      - "Do not weaken CSP or render unsanitized LLM HTML."
    evidence_state: OBSERVED
    confidence: HIGH
    evidence: "SECURITY.md, vite.config.ts, src/orchestration/context.ts."
    notes: ""

risks:
  critical:
    value: []
    evidence_state: OBSERVED
    confidence: MEDIUM
    evidence: "No critical runtime data-loss or exposed-secret vulnerability observed in inspected files."
    notes: "Security posture of uninspected UI files and live provider payloads remains UNKNOWN."
  high:
    value:
      - "CI/CD pipeline blocked: `npm run lint` (`tsc --noEmit`) fails and 10/41 unit tests fail, preventing clean automated deployment."
      - "Vite 8 / esbuild peer dependency conflict with `npm install` when `package-lock.json` is absent (mitigated via `--legacy-peer-deps` in `.github/workflows/deploy.yml`, creating non-deterministic installs)."
    evidence_state: OBSERVED
    confidence: HIGH
    evidence: "`npm run lint`, `npm test`, `.github/workflows/deploy.yml`, root listing."
    notes: ""
  medium:
    value:
      - "Same-origin AES-GCM master key storage cannot defend against XSS or malicious browser extensions (accepted limitation in SECURITY.md)."
      - "Documentation drift across `README.md`, `docs/ARCHITECTURE.md`, and `docs/CI_WORKFLOW.md` vs. current codebase."
      - "Free-tier LLM rate limits (429) and JSON schema adherence variability on smaller open models."
    evidence_state: OBSERVED
    confidence: HIGH
    evidence: "SECURITY.md, README.md, docs/ARCHITECTURE.md, src/providers/errors.ts."
    notes: ""
  low:
    value:
      - "Google Fonts stylesheet/font requests represent the only third-party network traffic (`index.html`, `src/constants.ts`)."
      - "Large `/variants` prototype directory remains in repo alongside active `src/`."
    evidence_state: OBSERVED
    confidence: HIGH
    evidence: "index.html, src/constants.ts, /variants directory listing."
    notes: ""

portfolio_position:
  value: "FLAGSHIP_PROJECT"
  evidence_state: SUGGESTED
  confidence: MEDIUM
  evidence: "Substantial multi-module implementation, dedicated security/architecture docs, test suite, and live GitHub Pages deployment setup indicate a primary active project rather than a throwaway experiment."
  notes: "Portfolio context outside this single repository is UNKNOWN."

tags:
  primary:
    value:
      - "ai-marketing-studio"
      - "byok"
      - "client-side-spa"
      - "campaign-engine"
    evidence_state: OBSERVED
    confidence: HIGH
    evidence: "package.json, src/campaign/*, src/providers/*."
    notes: ""
  secondary:
    value:
      - "hedetangen"
      - "brand-guardrails"
      - "indexeddb"
      - "web-crypto"
      - "github-pages"
    evidence_state: OBSERVED
    confidence: HIGH
    evidence: "src/data/business.json, src/storage/*, .github/workflows/deploy.yml."
    notes: ""

evidence_summary:
  overall_confidence: "HIGH"
  evidence_coverage: "HIGH — Inspected repository manifests, build/CI configs, security policy, core orchestration, campaign engine, storage/crypto, UI components, and executed live TypeScript check and test suite."
  uncertainty_areas:
    - "Live GitHub Pages deployment state and GitHub Actions run history (external to local workspace)."
    - "Real-world user adoption, usage metrics, and live Groq/OpenRouter/OpenAI output quality."
    - "Production bundle build (`npm run build`) was not executed in this read-only analysis pass."
    - "Contents of `variants/` prototypes and detailed prose inside uninspected `docs/` specs (`PRD.md`, `PROMPTS.md`, `SCHEMAS.md`, `UI_SPEC.md`)."
---

# Project Profile

## Quick Summary

| Field | Value |
| :--- | :--- |
| Name | Hedetangen AI Marketing Studio / Mark & Jennifer |
| Stage | `FUNCTIONAL_CORE_LOOP` (OBSERVED) |
| Status | Core features built; quality gates currently failing (`1` TS error, `10/41` tests failing) (OBSERVED) |
| Priority | `82 / 100` (SUGGESTED heuristic) |
| Opportunity | `74 / 100` (SUGGESTED heuristic) |
| Health | `58 / 100` (`NEEDS_ATTENTION`, INFERRED heuristic) |
| AI Suitability | `ASSISTED` (`78 / 100` automation potential, INFERRED) |

## Overview

**Hedetangen AI Marketing Studio** (also titled **Mark & Jennifer** in `README.md`) is a client-side React 19 + Vite 8 + TypeScript single-page application designed to run completely inside the user's browser with zero backend servers or telemetry.

**Directly observed capabilities in `src/`:**
- **Conversational Marketing Partner ("Jennifer")** supporting **Direct** (single-call streaming) and **Team** (planner → up to 3 specialist experts → synthesis) modes, plus an offline **Demo Mode** (`MockProvider`).
- **Deterministic Campaign Package Engine** (`src/campaign/engine.ts`) that converts structured campaign intakes (`Wizard.tsx`) into strategy JSON, a phased execution checklist, typed deliverables (`social`, `email`, `ad`, `calendar`, `video`, `landing`, `research`), deterministic **Honesty Lint** verification (`src/campaign/honestyLint.ts`) with 1 automatic repair retry, and `.zip` / `.md` / `.ics` downloads (`src/campaign/exportPackage.ts`).
- **Standalone Studio Modules** (`ModulesView.tsx`) for Video Prompts, Content Calendar (`.ics`), and Research Briefs built on the same JSON + Honesty Lint pipeline.
- **Editable Business Profile & Brand DNA Guardrails** (`src/data/business.json`, `BusinessProfileEditor.tsx`, `GuardrailsEditor.tsx`) with an immutable Honesty Rule and 5-snapshot undo history.
- **BYOK Persistence & Security** (`src/storage/crypto.ts`, `vite.config.ts`) using Web Crypto AES-GCM 256 encryption in IndexedDB v2 and build-time CSP injection restricting `connect-src` to `self`, Groq, OpenRouter, and OpenAI.

## Purpose

- **Problem solved (OBSERVED):** Enables lean hospitality operators to produce structured, bilingual (Swedish/English) marketing packages without SaaS lock-in, backend key exposure, or unverified AI hallucinations (invented buildings, unapproved prices/discounts, or guaranteed aurora/weather claims).
- **Target users (OBSERVED / UNKNOWN):** Explicitly configured around Hedetangen AB's owners (`Joacim`, `Madeleine`) in `src/data/business.json`; `README.md` also frames the product as "Mark & Jennifer" for small and medium-sized businesses. Real external user count or adoption is **UNKNOWN**.
- **Main use case (OBSERVED):** Planning and exporting multi-channel hospitality campaigns and weekly content under tight budget and owner-capacity constraints.
- **Core value (INFERRED):** Predictable, brand-safe marketing outputs with strict client-side privacy.

## Current State

- **Current lifecycle stage:** `FUNCTIONAL_CORE_LOOP` (OBSERVED). End-to-end orchestration, Campaign Package Engine, Honesty Lint, ZIP/ICS export, and UI workspaces are implemented in `src/`.
- **Current status:** **Quality gates are currently red** (OBSERVED):
  - `npm run lint` (`tsc --noEmit`) exits with code `1`: `src/providers/mock.ts(76,15): error TS2339: Property 'stage' does not exist on type 'ChatRequestOptions'`.
  - `npm test` runs `41` subtests across `tests/`: `31` pass (including `tests/core.test.ts` and `tests/schemas.test.ts`), while **`10` fail**: `8` in `tests/storage.test.ts` (7 `ReferenceError: localStorage is not defined` inside `src/storage/entities.ts`, plus 1 `updateChat` rejection check) and `1` in `tests/providers.test.ts` (line 108, string error code mapping in a 200 body) [plus 1 additional subtest count variance].
- **Missing requirements before release readiness (OBSERVED / INFERRED):**
  - Clean `tsc --noEmit` build and `100%` passing unit test suite so `.github/workflows/deploy.yml` `validate` job passes.
  - Committed `package-lock.json` for reproducible `npm ci` installs (`bun.lock` is present instead).
  - Live-provider verification against `tests/TEST_CASE.md` (not verifiable offline).

## Recommended Direction

- **Recommended next action (SUGGESTED):** Resolve the TypeScript error in `src/providers/mock.ts` / `src/providers/base.ts` and the 10 failing tests in `tests/storage.test.ts` and `tests/providers.test.ts`, then run `npm run check`.
- **Why:** GitHub Actions (`.github/workflows/deploy.yml`) gates Pages builds and deployments behind `npm run lint` and `npm test`.
- **Expected value:** Restores CI green status and ensures storage, error-mapping, and mock-provider contracts match automated tests before further UI or prompt iteration.

## Technical Assessment

- **Architecture observations (OBSERVED):** Clean browser-only SPA layered across `components/`, `campaign/`, `orchestration/`, `providers/`, `storage/`, and `utils/`. IndexedDB uses `DB_VERSION = 2` with explicit migration (`packages` store added in v2) and draft-07 subset schema validation (`validateSchema`).
- **Complexity (INFERRED):** `MEDIUM` — Combines streaming SSE chat orchestration, multi-step JSON repair loops, browser cryptography, schema validation, and binary `.zip` / `.ics` serialization with minimal runtime dependencies (`react`, `react-dom`, `lucide-react`).
- **Scalability (INFERRED):** Static hosting scales effortlessly for single-owner browser sessions; collaboration, cross-device auto-sync, or server-managed billing/keys would require introducing a backend (not currently present).
- **Technical risks (OBSERVED):** Broken TypeScript check (`options.stage`), Node-vs-browser `localStorage` coupling in `src/storage/entities.ts`, missing `package-lock.json` (`--legacy-peer-deps` workaround for Vite 8 / esbuild peer conflict), and schema sync coverage gaps for newly added Campaign/Profile schemas.

## AI Development Strategy

- **How AI can assist development (INFERRED — `ASSISTED`):** Well-suited for fixing type/test regressions, extending Campaign Engine deliverables, synchronizing `schemas/*.json`, and refining UI components. Human review remains essential for Brand DNA tone, live LLM prompt tuning, and security-sensitive crypto/CSP changes.
- **Recommended AI workflow (SUGGESTED):**
  1. Read target modules and `src/types.ts` / `src/utils/validate.ts` before editing.
  2. Maintain strict parity between `src/utils/validate.ts` and `schemas/*.json`.
  3. Run `npm run lint && npm test && npm run build` after changes and verify `dist/index.html` retains its CSP `<meta>` tag.

## Risks

- **Technical risks (OBSERVED):** Failing `tsc --noEmit` (`mock.ts` `options.stage`), failing `storage.test.ts` (`localStorage` in Node) and `providers.test.ts`, and `npm` lockfile absence (`bun.lock` only).
- **Maintenance risks (OBSERVED):** Documentation drift — `README.md`, `docs/ARCHITECTURE.md`, and `docs/CI_WORKFLOW.md` contain stale statements relative to the shipped React/Campaign Engine codebase.
- **Adoption risks (UNKNOWN):** No usage telemetry, user feedback data, or conversion analytics exist in the repository; broader SMB positioning ("Mark & Jennifer") vs. Hedetangen-specific defaults is unresolved.
- **Dependency risks (OBSERVED):** Vite 8 + `@tailwindcss/vite` + `esbuild` peer dependency conflict noted in `.github/workflows/deploy.yml` (`--legacy-peer-deps` workaround) and React 19 / TypeScript 7 (`"typescript": "^7.0.2"`) bleeding-edge toolchain versions.

## Evidence & Uncertainty

- **Evidence coverage:** `HIGH` for local codebase, config, CI, schemas, and automated checks; `NONE` for live production environment, live LLM API responses, and user adoption.
- **High-confidence findings:** Tech stack (`React 19`, `Vite 8`, `Tailwind CSS v4`, `TypeScript`), zero-backend IndexedDB + Web Crypto architecture, Campaign Package Engine + Honesty Lint implementation, current `tsc --noEmit` failure (`src/providers/mock.ts:76`), and `31/41` test pass rate (`10` failures).
- **Important unknowns:** Whether `https://benneberg.github.io/mark-jennifer/` currently hosts an earlier build and how well live Groq/OpenRouter/OpenAI models perform on `tests/TEST_CASE.md` end-to-end.
- **Assumptions or inferences:** Classification as `INTERNAL_TOOL` (with `PRODUCT` potential), `ASSISTED` AI suitability, and heuristic scores (`opportunity_score: 74`, `priority_score: 82`, `health_score: 58`).
- **Analysis limitations:** Did not execute `npm run build` (to keep workspace untouched), did not read all files in `variants/` or all `docs/` spec files, and have no external runtime/CI logs.

## Next Actions

1. **Fix TypeScript compilation (`src/providers/mock.ts` & `src/providers/base.ts`)** so `npm run lint` (`tsc --noEmit`) passes cleanly.
2. **Fix the 10 failing tests in `tests/storage.test.ts` and `tests/providers.test.ts`** (route `localStorage` access safely for Node tests / `safe-storage.ts`, inspect `updateChat` validation rejection, and align `runOpenAICompatibleChat` 200-body error taxonomy handling).
3. **Run `npm run check` (`typecheck && test && build`) and align `package-lock.json` / `docs/`** if aiming for deterministic GitHub Pages CI deployment.

---

## Project Memory

### Important Decisions

- **Client-side BYOK + Web Crypto AES-GCM:** Zero backend server; provider keys encrypted with non-extractable AES-GCM 256 key in IndexedDB (`src/storage/crypto.ts`), with session-only memory fallback when `rememberKey` is false or context is non-HTTPS.
- **Build-time CSP Enforcement:** `vite.config.ts` injects a strict `<meta http-equiv="Content-Security-Policy">` on production builds restricting `connect-src` to `'self'`, `api.groq.com`, `openrouter.ai`, and `api.openai.com`.
- **Campaign Package Engine over Free-Text Chat:** Added structured JSON generation (`responseFormat: 'json_object'` with HTTP 400 fallback), schema validation, deterministic Honesty Lint + 1 repair retry, and `.zip`/`.md`/`.ics` export (`src/campaign/`).
- **Decoupled Business Profile:** Factual business baseline lives in `src/data/business.json` + IndexedDB (`BusinessProfile`), rather than hardcoded in orchestration regexes or fallback directives.

### Architectural Constraints

- **No backend / strict CSP:** New external API hosts must be added to `CONTENT_SECURITY_POLICY` in `vite.config.ts`.
- **IndexedDB migrations:** `DB_VERSION = 2` (`src/storage/db.ts`). Any new object store or shape change requires bumping `DB_VERSION` and adding a migration branch.
- **Schema parity:** `tests/schemas.test.ts` enforces exact parity between `schemas/*.json` and core inline schemas in `src/utils/validate.ts`.
- **Honesty Rule:** Automated checks (`src/campaign/honestyLint.ts`) reject unreferenced physical structures, unconditioned aurora/snow/ice guarantees, and unsupplied prices/discounts.

### Known Limitations

- Same-origin AES-GCM encryption does not defend against XSS or compromised browser extensions (`SECURITY.md`).
- `npm run lint` and `10/41` tests in `npm test` currently fail in the inspected workspace state.
- `package-lock.json` is absent while `bun.lock` exists, forcing `npm install --legacy-peer-deps` in GitHub Actions.
- `README.md` and `docs/` lag behind recent React + Campaign Package Engine changes.

### Future Ideas

- Add `schemas/business-profile.schema.json` and `schemas/campaign-package.schema.json` with parity tests.
- Apply `.nvmrc` + npm caching + CSP assertion updates proposed in `docs/CI_WORKFLOW.md`.
- Evaluate generalizing `business.json` / `seed-guardrails.ts` presets if pursuing multi-business "Mark & Jennifer" productization.

### Lessons Learned

- Baking golden-test details (e.g., personal health circumstances or fixed prices) into prompt heuristics causes brittle behavior and privacy leaks; separating business profile facts into structured data solves both.
- Unstructured XML delegation degrades unpredictably on smaller/free LLMs; deterministic JSON contracts with code-owned workflows and automated linting make outputs testable and reliable.
