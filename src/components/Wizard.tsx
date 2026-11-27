import { useEffect, useState } from 'react';
import { Loader2, Lock, Snowflake, Square, X } from 'lucide-react';
import { DELIVERABLE_TITLES } from '../campaign/engine';
import { buildWinterBookingsPreset } from '../campaign/presets';
import type {
  BusinessProfile,
  CampaignDeliverableKind,
  CampaignIntake,
  Guardrails,
  LanguagePref,
} from '../types';

interface WizardProps {
  guardrails: Guardrails;
  businessProfile: BusinessProfile;
  defaultLanguage: LanguagePref;
  initialDraft?: Partial<CampaignIntake> | null;
  isGenerating?: boolean;
  progressLabel?: string | null;
  onCancel: () => void;
  onStop?: () => void;
  onGeneratePackage: (intake: CampaignIntake) => void;
}

const GOALS = ['Bookings', 'Off-season', 'Awareness', 'Partnerships'] as const;

const AUDIENCES = [
  "Couples' reset",
  'Past guests & warm inquiries',
  'Winter sauna & ice bath',
  'Slow-travel road-trippers',
  'Gift & milestone stays',
] as const;

const LANGUAGES: Array<{ id: LanguagePref; label: string }> = [
  { id: 'auto', label: 'Auto' },
  { id: 'sv', label: 'Svenska' },
  { id: 'en', label: 'English' },
  { id: 'bilingual', label: 'Bilingual' },
];

const CHANNELS = ['Email', 'Instagram', 'Website', 'Facebook', 'Google Ads'] as const;

const DELIVERABLES: CampaignDeliverableKind[] = [
  'social',
  'email',
  'video',
  'calendar',
  'ad',
  'landing',
];

const BUDGET_PRESETS = [
  '0 SEK (owned channels only)',
  '1500 SEK max ad spend',
  '3000 SEK max ad spend',
];

const HOURS_PRESETS = ['2–4 hrs/week', '4–6 hrs/week', '6–10 hrs/week'];

export function Wizard({
  guardrails,
  businessProfile,
  defaultLanguage,
  initialDraft,
  isGenerating = false,
  progressLabel = null,
  onCancel,
  onStop,
  onGeneratePackage,
}: WizardProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [goal, setGoal] = useState<string>(initialDraft?.goal ?? 'Bookings');
  const [dateWindow, setDateWindow] = useState<string>(
    initialDraft?.dateWindow ?? 'Next 4–6 weeks'
  );
  const [openNightsOrCapacity, setOpenNightsOrCapacity] = useState<string>(
    initialDraft?.openNightsOrCapacity ??
      `Private ${businessProfile.unitCapacityGuests}-guest stay · open weekends & weekdays`
  );
  const [coreOffer, setCoreOffer] = useState<string>(
    initialDraft?.coreOffer ??
      (businessProfile.offerings.slice(0, 2).join(' + ') || 'Private island overnight stay')
  );
  const [priceAnchor, setPriceAnchor] = useState<string>(
    initialDraft?.priceAnchor ??
      (businessProfile.defaultRatePerPersonNightSek > 0
        ? `${businessProfile.defaultRatePerPersonNightSek} SEK per person / night`
        : '')
  );
  const [referencePhoto, setReferencePhoto] = useState<string>(
    initialDraft?.referencePhoto ?? ''
  );

  const [audiences, setAudiences] = useState<string[]>(
    initialDraft?.audiences?.length ? initialDraft.audiences : ["Couples' reset"]
  );
  const [language, setLanguage] = useState<LanguagePref>(
    initialDraft?.language ?? defaultLanguage
  );
  const [channels, setChannels] = useState<string[]>(
    initialDraft?.channels?.length
      ? initialDraft.channels
      : businessProfile.defaultChannels.slice(0, 3)
  );
  const [deliverables, setDeliverables] = useState<CampaignDeliverableKind[]>(
    initialDraft?.deliverables?.length
      ? initialDraft.deliverables
      : ['social', 'email', 'video', 'calendar']
  );
  const [budgetCeiling, setBudgetCeiling] = useState<string>(
    initialDraft?.budgetCeiling ?? '0 SEK (owned channels only)'
  );
  const [hoursPerWeek, setHoursPerWeek] = useState<string>(
    initialDraft?.hoursPerWeek ?? '3–5 hrs/week'
  );
  const [notes, setNotes] = useState<string>(initialDraft?.notes ?? '');

  const applyDraft = (draft: Partial<CampaignIntake>) => {
    if (draft.goal !== undefined) setGoal(draft.goal);
    if (draft.dateWindow !== undefined) setDateWindow(draft.dateWindow);
    if (draft.openNightsOrCapacity !== undefined)
      setOpenNightsOrCapacity(draft.openNightsOrCapacity);
    if (draft.coreOffer !== undefined) setCoreOffer(draft.coreOffer);
    if (draft.priceAnchor !== undefined) setPriceAnchor(draft.priceAnchor);
    if (draft.referencePhoto !== undefined) setReferencePhoto(draft.referencePhoto);
    if (draft.audiences?.length) setAudiences(draft.audiences);
    if (draft.language !== undefined) setLanguage(draft.language);
    if (draft.channels?.length) setChannels(draft.channels);
    if (draft.deliverables?.length) setDeliverables(draft.deliverables);
    if (draft.budgetCeiling !== undefined) setBudgetCeiling(draft.budgetCeiling);
    if (draft.hoursPerWeek !== undefined) setHoursPerWeek(draft.hoursPerWeek);
    if (draft.notes !== undefined) setNotes(draft.notes);
  };

  useEffect(() => {
    if (!initialDraft) return;
    applyDraft(initialDraft);
  }, [initialDraft]);

  const handleLoadWinterPreset = () => {
    const preset = buildWinterBookingsPreset(businessProfile, language);
    applyDraft(preset);
  };

  const toggleStr = (list: string[], setList: (v: string[]) => void, item: string) => {
    setList(list.includes(item) ? list.filter((i) => i !== item) : [...list, item]);
  };

  const toggleDeliverable = (kind: CampaignDeliverableKind) => {
    setDeliverables((prev) =>
      prev.includes(kind) ? prev.filter((k) => k !== kind) : [...prev, kind]
    );
  };

  const canNextStep1 =
    Boolean(goal) && Boolean(dateWindow.trim()) && Boolean(coreOffer.trim());
  const canNextStep2 =
    audiences.length > 0 && channels.length > 0 && deliverables.length > 0;

  const buildIntake = (): CampaignIntake => ({
    goal,
    audiences,
    language,
    channels,
    deliverables,
    dateWindow: dateWindow.trim(),
    openNightsOrCapacity: openNightsOrCapacity.trim() || 'Standard unit availability',
    coreOffer: coreOffer.trim(),
    priceAnchor: priceAnchor.trim() || undefined,
    budgetCeiling: budgetCeiling.trim() || '0 SEK (owned channels only)',
    hoursPerWeek: hoursPerWeek.trim() || '3–5 hrs/week',
    referencePhoto: referencePhoto.trim() || undefined,
    notes: notes.trim() || undefined,
  });

  const fieldCls =
    'w-full min-h-[42px] px-3.5 py-2 text-sm rounded-[14px] bg-[var(--surface-muted)] border border-[var(--border)] text-[var(--text)] focus:border-[var(--text)] focus:outline-none';

  return (
    <div
      className="fixed inset-0 z-40 bg-[rgba(24,24,23,0.45)] backdrop-blur-[4px] flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isGenerating) onCancel();
      }}
    >
      <div className="w-full max-w-[780px] max-h-[92dvh] flex flex-col rounded-t-[28px] sm:rounded-[28px] bg-[var(--bg)] border border-[var(--border)] shadow-[var(--shadow-md)] overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-[var(--border)] flex items-center justify-between gap-3 shrink-0">
          <div>
            <h2 className="text-base font-semibold tracking-tight text-[var(--text)]">
              Campaign Package Builder
            </h2>
            <p className="text-xs text-[var(--text-muted)]">
              Step <span className="font-mono-tabular">{step}</span> of 3 · Checked against your
              Brand DNA &amp; Honesty Rules
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5" aria-hidden="true">
              {[1, 2, 3].map((dot) => (
                <span
                  key={dot}
                  className={`h-2 w-2 rounded-full transition-colors ${
                    dot <= step ? 'bg-[var(--tangerine)]' : 'bg-[var(--border-strong)]'
                  }`}
                />
              ))}
            </div>
            <button
              type="button"
              disabled={isGenerating}
              onClick={onCancel}
              aria-label="Close Campaign Builder"
              className="min-h-[38px] min-w-[38px] flex items-center justify-center rounded-full border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text)] disabled:opacity-40"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {step === 1 && (
            <div className="space-y-4">
              <div className="p-3.5 rounded-[18px] bg-[var(--surface-muted)] border border-[var(--border)] flex flex-wrap items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <div className="text-xs font-semibold text-[var(--text)]">
                    Low winter bookings?
                  </div>
                  <p className="text-[11px] text-[var(--text-muted)]">
                    Pre-fill a ready-to-launch winter campaign with social posts, email, video
                    prompts &amp; schedule.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleLoadWinterPreset}
                  className="min-h-[36px] inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-full glass-surface border border-[var(--border)] text-[var(--text)] hover:border-[var(--border-strong)] shrink-0"
                >
                  <Snowflake className="w-3.5 h-3.5 text-[var(--tangerine)]" />
                  <span>Load Winter Bookings Preset</span>
                </button>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--text-muted)] mb-2">
                  Primary Goal
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1 p-1 rounded-full bg-[var(--surface-muted)] border border-[var(--border)]">
                  {GOALS.map((g) => (
                    <button
                      key={g}
                      type="button"
                      onClick={() => setGoal(g)}
                      className={`min-h-[38px] px-3 py-1 text-xs font-semibold rounded-full transition-all whitespace-nowrap ${
                        goal === g
                          ? 'bg-[var(--lime)] text-[#181817] shadow-sm'
                          : 'text-[var(--text-muted)] hover:text-[var(--text)]'
                      }`}
                    >
                      {g}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1">
                    Campaign Dates / Window
                  </label>
                  <input
                    type="text"
                    value={dateWindow}
                    onChange={(e) => setDateWindow(e.target.value)}
                    placeholder="e.g. Jan–Feb 2027 (next 6 weeks)"
                    className={fieldCls}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1">
                    Open Nights / Capacity
                  </label>
                  <input
                    type="text"
                    value={openNightsOrCapacity}
                    onChange={(e) => setOpenNightsOrCapacity(e.target.value)}
                    placeholder="e.g. 12 open weekend nights"
                    className={fieldCls}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1">
                  Core Offer
                </label>
                <input
                  type="text"
                  value={coreOffer}
                  onChange={(e) => setCoreOffer(e.target.value)}
                  placeholder="e.g. Wood-fired sauna, cold lake plunge & private overnight stay"
                  className={fieldCls}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1">
                    Price / Anchor (optional — blank omits prices)
                  </label>
                  <input
                    type="text"
                    value={priceAnchor}
                    onChange={(e) => setPriceAnchor(e.target.value)}
                    placeholder="e.g. 1750 SEK per person / night"
                    className={fieldCls}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1">
                    Confirmed Reference Photo (optional)
                  </label>
                  <input
                    type="text"
                    value={referencePhoto}
                    onChange={(e) => setReferencePhoto(e.target.value)}
                    placeholder="Blank = atmosphere-only shots (no invented cabins)"
                    className={fieldCls}
                  />
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1">
                    Budget Ceiling
                  </label>
                  <input
                    type="text"
                    value={budgetCeiling}
                    onChange={(e) => setBudgetCeiling(e.target.value)}
                    className={fieldCls}
                  />
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    {BUDGET_PRESETS.map((b) => (
                      <button
                        key={b}
                        type="button"
                        onClick={() => setBudgetCeiling(b)}
                        className="text-[11px] px-2.5 py-1 rounded-full border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text)]"
                      >
                        {b}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1">
                    Owner Capacity (hours/week)
                  </label>
                  <input
                    type="text"
                    value={hoursPerWeek}
                    onChange={(e) => setHoursPerWeek(e.target.value)}
                    className={fieldCls}
                  />
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    {HOURS_PRESETS.map((h) => (
                      <button
                        key={h}
                        type="button"
                        onClick={() => setHoursPerWeek(h)}
                        className="text-[11px] px-2.5 py-1 rounded-full border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text)]"
                      >
                        {h}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--text-muted)] mb-2">
                  Language
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1 p-1 rounded-full bg-[var(--surface-muted)] border border-[var(--border)]">
                  {LANGUAGES.map((l) => (
                    <button
                      key={l.id}
                      type="button"
                      onClick={() => setLanguage(l.id)}
                      className={`min-h-[38px] px-3 py-1 text-xs font-semibold rounded-full transition-all whitespace-nowrap ${
                        language === l.id
                          ? 'bg-[var(--lime)] text-[#181817] shadow-sm'
                          : 'text-[var(--text-muted)] hover:text-[var(--text)]'
                      }`}
                    >
                      {l.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--text-muted)] mb-2">
                  Channels
                </label>
                <div className="flex flex-wrap gap-2">
                  {CHANNELS.map((ch) => {
                    const active = channels.includes(ch);
                    return (
                      <button
                        key={ch}
                        type="button"
                        onClick={() => toggleStr(channels, setChannels, ch)}
                        className={`min-h-[38px] px-3.5 py-1.5 text-xs font-semibold rounded-full border transition-all ${
                          active
                            ? 'bg-[var(--lime)] border-transparent text-[#181817]'
                            : 'bg-[var(--surface-muted)] border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text)]'
                        }`}
                      >
                        {ch}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--text-muted)] mb-2">
                  Included in Your Campaign Package
                </label>
                <div className="flex flex-wrap gap-2">
                  {DELIVERABLES.map((kind) => {
                    const active = deliverables.includes(kind);
                    return (
                      <button
                        key={kind}
                        type="button"
                        onClick={() => toggleDeliverable(kind)}
                        className={`min-h-[38px] px-3.5 py-1.5 text-xs font-semibold rounded-full border transition-all ${
                          active
                            ? 'bg-[var(--lime)] border-transparent text-[#181817]'
                            : 'bg-[var(--surface-muted)] border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text)]'
                        }`}
                      >
                        {DELIVERABLE_TITLES[kind]}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--text-muted)] mb-2">
                  Audience Occasions
                </label>
                <div className="flex flex-wrap gap-2">
                  {AUDIENCES.map((a) => {
                    const active = audiences.includes(a);
                    return (
                      <button
                        key={a}
                        type="button"
                        onClick={() => toggleStr(audiences, setAudiences, a)}
                        className={`min-h-[38px] px-3.5 py-1.5 text-xs font-semibold rounded-full border transition-all ${
                          active
                            ? 'bg-[var(--lime)] border-transparent text-[#181817]'
                            : 'bg-[var(--surface-muted)] border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text)]'
                        }`}
                      >
                        {a}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1">
                  Extra Operational Notes (optional)
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Mention 200 past guests and 100 warm email inquiries"
                  className={fieldCls}
                />
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-3">
              <div className="p-4 rounded-[18px] bg-[var(--surface-muted)] border border-[var(--border)] text-xs space-y-1.5">
                <div className="font-semibold text-[var(--text)] text-sm">
                  {goal} · {dateWindow}
                </div>
                <p className="text-[var(--text-muted)]">
                  <strong>Offer:</strong> {coreOffer}
                </p>
                <p className="text-[var(--text-muted)]">
                  <strong>Capacity &amp; Anchor:</strong> {openNightsOrCapacity}
                  {priceAnchor.trim() ? ` · ${priceAnchor.trim()}` : ' · No promotional pricing'}
                </p>
                <p className="text-[var(--text-muted)]">
                  <strong>Budget &amp; Time:</strong> {budgetCeiling} · {hoursPerWeek}
                </p>
                <p className="text-[var(--text-muted)]">
                  <strong>Channels:</strong> {channels.join(', ')}
                </p>
                <p className="text-[var(--text-muted)]">
                  <strong>Deliverables:</strong>{' '}
                  {deliverables.map((d) => DELIVERABLE_TITLES[d]).join(', ')}
                </p>
                <p className="text-[var(--text-muted)]">
                  <strong>Visual mode:</strong>{' '}
                  {referencePhoto.trim()
                    ? `Confirmed reference: ${referencePhoto.trim()}`
                    : 'Atmosphere-only (no cabins/structures allowed)'}
                </p>
              </div>

              <div className="p-4 rounded-[18px] bg-[var(--sand)] dark:bg-[#1C1C1A] border border-[var(--border)] text-xs space-y-1.5 text-[#181817] dark:text-[#F4EFE4]">
                <div className="flex items-center gap-1.5 font-semibold">
                  <Lock className="w-3.5 h-3.5 text-[var(--tangerine)]" />
                  <span>Brand Honesty Guardrails (Checked Automatically)</span>
                </div>
                <p className="leading-relaxed opacity-85">{guardrails.honestyRule}</p>
                <p className="opacity-70">
                  Every item in your package is checked against your honesty rules so no invented
                  buildings, weather guarantees, or unapproved discounts slip into your copy.
                </p>
              </div>

              {isGenerating && progressLabel && (
                <div className="flex items-center justify-between gap-3 p-3.5 rounded-[16px] bg-[var(--surface-muted)] border border-[var(--border)]">
                  <div className="flex items-center gap-2.5 text-xs font-medium text-[var(--text)]">
                    <Loader2 className="w-4 h-4 animate-spin text-[var(--tangerine)] shrink-0" />
                    <span>{progressLabel}</span>
                  </div>
                  {onStop && (
                    <button
                      type="button"
                      onClick={onStop}
                      className="min-h-[34px] inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-full bg-[var(--tangerine)] text-[#181817]"
                    >
                      <Square className="w-3 h-3 fill-current" />
                      <span>Stop</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 border-t border-[var(--border)] flex items-center justify-between gap-2 shrink-0">
          <button
            type="button"
            disabled={isGenerating}
            onClick={step === 1 ? onCancel : () => setStep((s) => (s === 3 ? 2 : 1))}
            className="min-h-[42px] px-4 py-2 text-sm font-medium rounded-full border border-[var(--border)] text-[var(--text)] hover:bg-[var(--surface-muted)] disabled:opacity-40"
          >
            {step === 1 ? 'Cancel' : 'Back'}
          </button>

          {step < 3 ? (
            <button
              type="button"
              disabled={(step === 1 && !canNextStep1) || (step === 2 && !canNextStep2)}
              onClick={() => setStep((s) => (s === 1 ? 2 : 3))}
              className="min-h-[42px] px-5 py-2 text-sm font-semibold rounded-full bg-[var(--lime)] hover:bg-[var(--lime-hover)] text-[#181817] disabled:opacity-40"
            >
              Next
            </button>
          ) : (
            <button
              type="button"
              disabled={isGenerating}
              onClick={() => onGeneratePackage(buildIntake())}
              className="min-h-[42px] px-5 py-2 text-sm font-semibold rounded-full bg-[var(--lime)] hover:bg-[var(--lime-hover)] text-[#181817] disabled:opacity-50"
            >
              {isGenerating ? 'Building Package…' : 'Build Campaign Package'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}