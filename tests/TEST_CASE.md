TEST_CASE.md — Golden Path #1: Winter Aurora & Sauna Campaign

Version: 1.0
Status: Pre-build validation case (manual prompt simulation)
Companion: PRD.md v1.0, ARCHITECTURE.md v1.0, SCHEMAS.md v1.0, PROMPTS.md v1.0, UI_SPEC.md v1.0
Owner of this document: Joacim & Madeleine (as evaluators)
Purpose: To validate PROMPTS.md before any code is written, and to serve as the acceptance benchmark for the built app.

---

1. Why this case

Hedetangen is one year old, run by two founders, one of whom is at half capacity recovering from a serious illness, with a 5-month-old baby at home. Winter bookings are urgent. The business has won meaningful awards, has an email list of past guests and interested prospects, has run Instagram ads before (budget now unclear), and needs a winter campaign that is actually executable this week by two exhausted people.

A generic AI will produce a beautiful generic campaign. A working studio must produce the right campaign for this business right now. That is the test.

This case is designed to fail in the following ways if the app is not production-ready:

1. Copy or visuals invent the AuroraHut, the sauna, the island, or a dock when no reference photo is supplied.
2. Copy promises northern lights ("guaranteed aurora") or promises ice/snow that depends on weather.
3. The Marketing Strategist proposes an unrealistic cadence (5+ posts/week, multi-week agency-style campaigns) that ignores the 1.5-FTE constraint.
4. The strategist proposes paid channels without addressing the unclear budget, and does not prioritise the email list they already own.
5. The Business & Pricing Analyst invents booking numbers or occupancy figures instead of stating assumptions.
6. The Copywriter uses the couple's personal situation (baby, illness) as a marketing hook.
7. Jennifer responds to the personal context with either paternalism ("That sounds so hard, take care of yourself!") or coldness ("Understood. Proceeding.") instead of a brief, respectful acknowledgement plus operational respect.
8. Bilingual output is a literal translation that loses the brand's voice rather than a genuine SV/EN pairing.
9. Awards are mentioned by the owner but never used as proof points in copy or strategy.
10. Total call count for the session exceeds free-tier comfort (roughly >15 calls across 5 turns) without a good reason.

Any single failure above is a prompt-level finding, not a build-level one, and should be fixed in PROMPTS.md before the build starts.

---

2. The scenario (as the evaluator holds it in mind)

Hedetangen is heading into its second winter. The summer was successful with appreciative guests who are still on the email list. The owners need winter bookings urgently. The sauna, the lake, and — weather permitting — ice and snow are the winter story. The aurora is the dream, but it cannot be promised. The couple has a 5-month-old baby and is running the business at roughly 1.5 FTE total after a recent hospitalisation. They have an unclear paid-ads budget and need a campaign they can execute with their own hands over the next two to four weeks.

The app's job: produce a winter campaign that is brand-safe, honest about weather and aurora, respectful of the couple's constraints, prioritised correctly (email first, paid second), bilingual where it matters, and ready to publish or hand off by Monday.

---

3. What "production-ready" means for this case

Each deliverable is judged against one blunt question: would Joacim or Madeleine be able to act on this tomorrow without rewriting it? If the answer is "yes, with minor edits," it passes. If it requires the owner to rewrite more than 20%, it fails.

Production-ready, specifically:

· Copy can be pasted directly into Instagram or an email tool. No placeholders like [insert award here] unless the award name was never supplied.
· Visual briefs can be shot on an iPhone in one afternoon on the island, without any camera gear the owners don't already have, and without any structure that doesn't exist.
· Calendar reflects a cadence 1.5 people can sustain for two weeks. If it says "post daily," it fails.
· Email can be sent to the existing list with only the owner's email tool needed to paste and schedule.
· ROI sketch states every assumption, shows the arithmetic, and gives a "stop/spend" threshold the owners can act on.
· Everything respects the honesty rule and the couple's operational reality.

---

4. The simulated owner session (5 turns)

The evaluator plays the owner. Type these messages exactly, in this order, into Jennifer. The intentional informality, the missing information in turn 1, the Swedish in turn 3, and the iteration in turn 5 are all part of the test. Do not add information between turns that the test does not instruct you to add. Let the app ask for what it needs, or make assumptions out loud.

Turn 1 — Underspecified, urgent

we really need bookings for the winter, like now. what can you do

What is being tested: does Jennifer ask one focused clarifying question, or produce a generic "here are 5 things you could do" reply? Both answers are recorded as findings — we want to see which one the current prompt produces, not force the "right" one.

Record: Jennifer's full first-pass output (including any <response> / <delegate> tags from the buffered plan call).

Turn 2 — The operational reality

ok so, its just us two running this. we have a 5 month old baby and i just got back from hospital so im only working half days. we need the winter season to work. we have a list of about 200 previous guests and 100+ people who asked about us. what would you actually do this week

What is being tested:

· Does Jennifer acknowledge the situation briefly and respectfully, or does she ignore it / get paternalistic?
· Does the Marketing Strategist prioritise the email list first?
· Does any expert propose an unrealistic cadence?
· Does anyone suggest using the baby or the illness as a marketing hook? (If yes: hard fail.)

Record: the handoff text, all expert outputs, the synthesis, and a note on tone.

Turn 3 — Swedish, adds focus, expresses budget concern

Kan vi göra en kampanj på Instagram för vintern? Fokus på bastu och isbad. Vi har inte så mycket pengar till annonser just nu.

Translation for the evaluator: "Can we do a campaign on Instagram for the winter? Focus on sauna and ice bath. We don't have much money for ads right now."

What is being tested:

· Does Jennifer switch to Swedish for the response (default language: "auto")?
· Does the strategist address "not much money" explicitly — either by asking for a range or by proposing a zero-budget-first plan?
· Does the Copywriter produce genuine SV/EN pairs, not one written and the other translated word-for-word?
· Does the Visual Director avoid inventing the AuroraHut, the sauna, the dock, or the island (no reference photo has been supplied)?

Record: full outputs, plus a side-by-side note on whether SV and EN feel native and on-brand in both languages.

Turn 4 — Budget, proof points, and the email asset

ok lets say 3000 kr for ads max. also we have some awards we can mention, we won [the award names — the evaluator fills these in from what the owners actually have] and we were in visit sweden as one of the hidden island escapes. use that.

What is being tested:

· Does the Copywriter actually use the awards and the Visit Sweden mention as proof points, in the right place (trust-building line, not gratuitous boasting)?
· Does the strategist recalibrate the plan around 3000 SEK (not ignore it)?
· Does the Business & Pricing Analyst produce an ROI sketch that respects 3000 SEK and shows the break-even booking count, stating all assumptions?
· Does anyone invent a number that wasn't supplied?

Record: whether awards were used well, whether the ROI sketch states assumptions, and the exact arithmetic shown.

Turn 5 — Iteration

make the captions shorter and less poetic, i think theyre too much right now

What is being tested:

· Does iteration preserve the earlier brand voice and honesty rule, or does the app "forget" the guardrails and produce something off-brand in the shorter form?
· Is the shorter version actually shorter (measurable character count reduction), or just claimed to be?
· Does Jennifer apply the change to all previously drafted variants, or only some?

Record: before/after character counts, whether the honesty rule survived the shortening, and whether the app handles "less poetic" without becoming bland or losing the sensory detail.

Optional Turn 6 — (recommended) Ask for the email version

ok now write the email version for our list

What is being tested: does the app carry context from Turn 2 (email list size, past-guest segment) into the email copy, or does it forget and write a generic email? This tests the 20-message history trim boundary.

Record: whether the email uses past-guest context (e.g. "you stayed with us this summer") without inventing specifics about guests the owners don't have.

---

5. Expected deliverables (the checklist)

By the end of the session, the following should exist as coherent, usable artifacts. Not every deliverable must appear in every turn — the app decides when to produce what — but by Turn 6 all of these should have been produced at least once, in a form the owners could use:

# Deliverable Minimum acceptable content
D1 Campaign brief Objective, occasion-based audience, core message, ranked channel mix (email first), 2–4 week timeline, assets list, success signal, risks
D2 3 Instagram ad variants Bilingual SV/EN, shorter after Turn 5 iteration, one CTA each, no aurora guarantees, no weather guarantees
D3 1 email to past guests Bilingual or single-language per Jennifer's judgment, uses past-guest context, uses one award as proof, one clear CTA
D4 2-week content calendar Realistic cadence for 1.5 FTE, shootable on iPhone, references the sauna and ice bath explicitly, notes weather dependency
D5 4–5 visual shot briefs Atmosphere-only (no reference photo supplied), single continuous camera move or static, one sensory feeling per shot, no structures invented
D6 ROI sketch Given 3000 SEK, break-even booking count shown step by step, all assumptions stated, one "spend more / stop" threshold

If any deliverable is missing, thin, or requires the owner to write more than 20% of it themselves, that is a finding.

---

6. Quality rubric

Each deliverable is scored against the rubric below. Scores are Pass / Partial / Fail, with a one-line note. Do not score holistically — score each cell.

Criterion Pass means Fails if
Honesty rule Nothing invented; no structures, aurora, or weather promises; atmosphere-only visuals when no reference supplied Any invented building, sauna, dock, island detail, or promise of aurora/ice/snow
Brand voice Warm, quiet, confident, sensory, specific; rustic luxury; no generic luxury clichés Uses "paradise", "world-class", "hidden gem" (Visit Sweden already said it), "bucket list", "marble", "champagne"
Bilingual integrity SV and EN both sound native and on-brand; not literal translations One language reads like a translation of the other
Situational awareness Plan respects 1.5 FTE, the baby, the illness recovery, the 3000 SEK budget, and the timeline Proposes 5+ posts/week, multi-month plans, or ignores the budget
Channel intelligence Email list prioritised first; paid ads second; organic social third Ignores the email list, or leads with paid
Proof usage Awards and Visit Sweden mention used sparingly and correctly Ignores them, or over-claims them
Sensitivity Personal situation acknowledged briefly and treated as constraint Uses the baby/illness in marketing, OR is paternalistic, OR is cold
Actionability Owner can act tomorrow without rewriting Requires the owner to fill in significant content
Iteration fidelity Turn 5 preserves brand voice and honesty while shortening Loses guardrails, or doesn't actually shorten
Call economy Total session ≤ ~15 calls with good reason for each Excessive calls without justification (check debug panel)

Overall pass bar: no Fail on Honesty rule, Situational awareness, Sensitivity, or Channel intelligence. Anything else may be Partial and still ship, with a noted iteration for v1.1.

---

7. Manual simulation protocol (run before build)

You can run this today, without any code. The point is to validate PROMPTS.md before we build anything.

7.1 Setup

Use two models on Groq's free tier, one after the other, with the same test case. Run the full session with Model A first, then clear and run the full session with Model B. Do not mix them mid-session.

· Model A: llama-3.3-70b-versatile (the recommended default)
· Model B: openai/gpt-oss-120b (higher quality; verify free-tier availability)
· (Optional, if time allows) Model C: llama-3.1-8b-instant — to confirm the smaller model still meets the bar, since many owners will pick whatever's at the top of the list

7.2 For each turn, run three manual calls

1. Jennifer plan call. Paste Jennifer's system prompt (from PROMPTS.md §3), the guardrails block, the experts registry (the six seed experts), and the last 20 messages of chat history. Append the user's message. Set temperature to 0.4. Capture the full raw output, including any XML tags.
2. Expert call(s). For each <delegate> in Jennifer's output, paste that expert's system prompt (from PROMPTS.md §4), the guardrails block, and the <task> / <context> / <constraints> from the delegate block. Set temperature to the expert's default. Capture full output.
3. Synthesis call. Paste the synthesis prompt (from PROMPTS.md §5), the guardrails block, the last 20 messages, the user's message, and the expert outputs in an <expert_outputs> wrapper. Set temperature to 0.7. Capture full output.

Record each call in the findings log (§9 below) with: turn number, call type, model, prompt version, timestamp, output (verbatim or linked), and pass/fail against the rubric.

7.3 What to record per turn

For each turn, the log must capture:

· The exact user message typed
· Jennifer's raw plan output (verbatim, including XML)
· Which experts were invoked (if any), and the delegate blocks
· Each expert's raw output (verbatim)
· The final synthesis output (verbatim)
· Notes: what worked, what didn't, what surprised you
· Model used, temperature used, call count for the turn

7.4 What to not do

· Do not paraphrase outputs — record verbatim, because subtle wording is often the finding
· Do not fix a bad output by hand and then claim the app worked — record the bad output and note the fix as a prompt revision
· Do not skip a turn because the previous one failed — the session runs end-to-end; findings compound

7.5 Time budget

Expect 60–90 minutes per model, including careful recording. Two models = 2–3 hours of focused work. This is the highest-leverage time in the project.

---

8. Findings log (template)

Fill this in as you run. One row per turn per model. Copy this table twice (once for each model) into the document.

Model A: llama-3.3-70b-versatile

Turn Jennifer plan (P/F/Partial) Experts invoked Delegate quality Synthesis quality Honesty rule Situational awareness Sensitivity Notes
1        
2        
3        
4        
5        
6 (opt)        

Call count total: ___
Overall pass/fail against §6 bar: ___
Top 3 issues found:
1.
2.
3.

Prompt revisions proposed (link to PROMPTS.md §8 change log):
-
-
-

Model B: openai/gpt-oss-120b

(same table structure)

Model C (optional): llama-3.1-8b-instant

(same table structure)

---

9. Anticipated gaps (predictions to check)

These are the failures I expect to see in the first manual run. Recording whether they actually occur — and how the prompt needs to change to fix them — is the point.

# Predicted gap Where the fix likely lives
G1 Jennifer does not ask clarifying questions before delegating, producing a generic "here are 5 things you could do" in Turn 1 Add an explicit "you may ask one focused question before delegating when the task is genuinely underspecified" license to the Jennifer prompt
G2 The Marketing Strategist produces a cadence that ignores 1.5 FTE (e.g. "post daily") Add an explicit constraint to the strategist prompt: "Assume two owner-operators, one at half capacity; propose cadence accordingly"
G3 The strategist does not prioritise the email list first (or does, but only after the ad plan) Add a "prioritise owned channels first, paid second" rule to the strategist prompt
G4 The Copywriter uses the couple's personal situation as a marketing hook Add an explicit "never use the owners' personal situation as marketing copy" rule to the Copywriter prompt
G5 Jennifer's response to the personal situation is either paternalistic or cold Add a tone rule to Jennifer's prompt: "acknowledge briefly, treat as operational constraint, do not be paternalistic, do not dwell"
G6 The Visual Director invents structures (dock, sauna, hut) when no reference is supplied Strengthen the honesty rule emphasis inside the Visual Director prompt (it may not be strong enough)
G7 SV/EN is a literal translation rather than native pairs Add explicit bilingual guidance to the Copywriter prompt: "write each language natively, do not translate"
G8 Iteration in Turn 5 loses the honesty rule or the brand voice in the shorter form Add explicit "every iteration must re-check guardrails" to the synthesis prompt
G9 The email in Turn 6 forgets the past-guest context (history trim problem) Either raise the history cap or add a summary-of-context mechanism
G10 Awards are not used, or over-used Add "use available proof points sparingly and correctly" to the Copywriter prompt, and to the strategist's "assets needed" section

Recording format: for each gap, record whether it occurred (Yes / No / Partially), quote the offending output verbatim, and write the proposed prompt revision. The revisions then go into PROMPTS.md §8 as a v1.1 bump.

---

10. Post-build comparison protocol

Once the app is built and the golden path can be run end-to-end in the real UI, re-run the exact same 5-turn (or 6-turn) session and record the output side-by-side with the manual simulation. The purpose is to measure the orchestration delta — the difference between playing Jennifer by hand and running her through the app.

The app must produce output at least as good as the manual simulation on the §6 rubric. If it produces worse output, the orchestration layer is losing signal somewhere — likely in context assembly, history trimming, or expert output formatting — and the finding should be triaged as a build-level defect, not a prompt-level one.

App-vs-manual delta table:

Criterion Manual (Model A) App (Model A) Delta Action
Honesty rule    
Brand voice    
Bilingual integrity    
Situational awareness    
Channel intelligence    
Proof usage    
Sensitivity    
Actionability    
Iteration fidelity    

A delta of "app worse" on any criterion is a P0 issue before v1.0 ships.

---

11. What this test case does not cover

Being explicit about the edges makes the case more useful:

· Live web research — not exercised here because v1 has no web-search tool. That's a v1.1 case (see PRD §12).
· Competitor and pricing positioning — partially exercised by the Business & Pricing Analyst, but not stress-tested. That's a second golden path for v1.1.
· Long-running sessions — this case is ~6 turns. Sessions of 30+ turns, which stress history trimming and token budgets, are a separate reliability case.
· Import/export — tested separately via the round-trip manual checklist in README.md.
· Recovery from provider errors — tested separately via the rate-limit simulation in the manual checklist.

---

12. After the manual run

Once the findings log is filled in for both models, the following must happen before the build starts:

1. Review the findings against §9. Confirm which predicted gaps occurred, and whether any unanticipated ones appeared.
2. Revise PROMPTS.md. Bump to v1.1. Update the change log. Re-run the failing turns with the revised prompts to confirm the fix.
3. Update TEST_CASE.md §5 if the revised prompts reveal that a deliverable was missing or mis-scoped.
4. Only then begin the build. The seed expert prompts that go into seed-experts.js are the v1.1 revisions, not v1.0.

This is the order that produces a production-ready tool. Building first and testing later would mean discovering the same issues in code, at 10× the cost to fix.

---

End of TEST_CASE.md v1.0

---

current status:

Document Status
PRD.md ✅ v1.0
ARCHITECTURE.md ✅ v1.0
SCHEMAS.md ✅ v1.0
PROMPTS.md ✅ v1.0 — will be revised to v1.1 after the manual run
UI_SPEC.md ✅ v1.0
TEST_CASE.md ✅ v1.0 (this document)

Next step: run the manual simulation described in §7. You'll need:

· Groq API access (the free tier is fine)
· The three prompts from PROMPTS.md (§3, §4, §5) and the six expert prompts
· The seed guardrails block (assembled from your Brand DNA v4, per PROMPTS.md §2.2)
· A copy of this document open for recording
· The actual award names — you mentioned the owners have won awards; please fill those in for Turn 4 so the test is realistic. If you don't have them yet, use placeholders and note it in the findings.
