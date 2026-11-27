import { useRef, useState } from 'react';
import { Bookmark, Calendar, Check, Copy, Loader2, Square } from 'lucide-react';
import { generateSingleDeliverableModule } from '../campaign/engine';
import { calendarToICS, extractCalendarItems } from '../campaign/exportPackage';
import type {
  AppSettings,
  BusinessProfile,
  CampaignDeliverable,
  CampaignIntake,
  CampaignPackage,
  Guardrails,
  LanguagePref,
  LibraryItemType,
} from '../types';
import { SafeMarkdown } from '../utils/markdown';

type ModuleTab = 'video' | 'calendar' | 'research';

interface ModulesViewProps {
  settings: AppSettings;
  guardrails: Guardrails;
  businessProfile: BusinessProfile;
  packages: CampaignPackage[];
  isConfigured: boolean;
  onOpenSettings: () => void;
  onEnableDemoMode: () => Promise<void>;
  onSaveToLibrary: (deliverable: CampaignDeliverable, type: LibraryItemType) => Promise<void>;
  onCopy: (text: string) => void;
  onNotify: (msg: string, variant?: 'info' | 'success' | 'danger') => void;
}

export function ModulesView({
  settings,
  guardrails,
  businessProfile,
  packages,
  isConfigured,
  onOpenSettings,
  onEnableDemoMode,
  onSaveToLibrary,
  onCopy,
  onNotify,
}: ModulesViewProps) {
  const [tab, setTab] = useState<ModuleTab>('video');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CampaignDeliverable | null>(null);
  const [copied, setCopied] = useState(false);

  // Video state
  const [videoMood, setVideoMood] = useState('Wood-fired sauna steam & winter lake stillness');
  const [videoRefPhoto, setVideoRefPhoto] = useState('');
  const [videoLang, setVideoLang] = useState<LanguagePref>(settings.language);

  // Calendar state
  const [linkedPkgId, setLinkedPkgId] = useState<string>(packages[0]?.id ?? '');
  const [calWindow, setCalWindow] = useState('Next 2 weeks');
  const [calChannels, setCalChannels] = useState('Email, Instagram, Website');
  const [calOffer, setCalOffer] = useState(
    businessProfile.offerings.slice(0, 2).join(' + ') || 'Private island overnight stay'
  );

  // Research state
  const [researchQuestion, setResearchQuestion] = useState(
    'How do Nordic boutique micro-stays convert past guests and warm leads without paid ads?'
  );
  const [researchNotes, setResearchNotes] = useState('');

  const abortRef = useRef<AbortController | null>(null);

  const handleRun = async () => {
    if (!isConfigured || loading) return;
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);

    try {
      const linkedPkg = packages.find((p) => p.id === linkedPkgId);

      let intake: CampaignIntake;
      let extraContext: string | undefined;

      if (tab === 'video') {
        intake = {
          goal: 'Atmospheric Video Shot List',
          audiences: ["Couples' reset"],
          language: videoLang,
          channels: ['Instagram'],
          deliverables: ['video'],
          dateWindow: 'Current season',
          openNightsOrCapacity: `${businessProfile.unitCapacityGuests} guests`,
          coreOffer: videoMood.trim() || 'Sauna and private island stillness',
          budgetCeiling: '0 SEK',
          hoursPerWeek: '3–5 hrs/week',
          referencePhoto: videoRefPhoto.trim() || undefined,
        };
      } else if (tab === 'calendar') {
        intake = linkedPkg
          ? { ...linkedPkg.intake, deliverables: ['calendar'] }
          : {
              goal: 'Bookings',
              audiences: ['Past guests & warm inquiries'],
              language: settings.language,
              channels: calChannels
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean),
              deliverables: ['calendar'],
              dateWindow: calWindow.trim() || 'Next 2 weeks',
              openNightsOrCapacity: `${businessProfile.unitCapacityGuests} guests`,
              coreOffer: calOffer.trim() || 'Private island stay',
              budgetCeiling: '0 SEK (owned channels first)',
              hoursPerWeek: '3–5 hrs/week',
            };
        if (linkedPkg) {
          extraContext = `Aligned with campaign strategy: ${linkedPkg.strategy.headline}`;
        }
      } else {
        intake = {
          goal: 'Research Brief',
          audiences: ["Couples' reset"],
          language: settings.language,
          channels: businessProfile.defaultChannels,
          deliverables: ['research'],
          dateWindow: 'Current planning cycle',
          openNightsOrCapacity: `${businessProfile.unitCapacityGuests} guests`,
          coreOffer: researchQuestion.trim(),
          budgetCeiling: 'Unspecified',
          hoursPerWeek: '3–5 hrs/week',
          notes: researchNotes.trim() || undefined,
        };
        extraContext = `Research question: ${researchQuestion.trim()}`;
      }

      const generated = await generateSingleDeliverableModule({
        kind: tab,
        intake,
        settings,
        guardrails,
        businessProfile,
        extraContext,
        signal: controller.signal,
      });

      setResult(generated);
    } catch (err) {
      if (!(err instanceof DOMException && err.name === 'AbortError')) {
        onNotify(err instanceof Error ? err.message : 'Module generation failed.', 'danger');
      }
    } finally {
      setLoading(false);
      abortRef.current = null;
    }
  };

  const calItems = result?.kind === 'calendar' ? extractCalendarItems([result]) : [];

  const fieldCls =
    'w-full min-h-[42px] px-3.5 py-2 text-sm rounded-[14px] bg-[var(--surface-muted)] border border-[var(--border)] text-[var(--text)] focus:border-[var(--text)] focus:outline-none';

  return (
    <div className="flex-1 overflow-y-auto px-4 sm:px-8 py-6">
      <div className="max-w-[820px] mx-auto space-y-6">
        <div className="space-y-3">
          <h1 className="text-2xl sm:text-[28px] font-light tracking-[-0.02em] text-[var(--text)]">
            Studio Modules
          </h1>
          <p className="text-sm text-[var(--text-muted)]">
            Standalone tools running on the same structured JSON &amp; Honesty Lint engine.
          </p>

          <div className="inline-grid grid-cols-3 gap-1 p-1 rounded-full bg-[var(--surface-muted)] border border-[var(--border)]">
            {(
              [
                { id: 'video', label: 'Video Prompts' },
                { id: 'calendar', label: 'Content Calendar' },
                { id: 'research', label: 'Research Brief' },
              ] as Array<{ id: ModuleTab; label: string }>
            ).map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  setTab(t.id);
                  setResult(null);
                }}
                className={`min-h-[38px] px-4 py-1.5 text-xs sm:text-sm font-semibold rounded-full transition-all whitespace-nowrap ${
                  tab === t.id
                    ? 'bg-[var(--lime)] text-[#181817] shadow-sm'
                    : 'text-[var(--text-muted)] hover:text-[var(--text)]'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Inputs */}
        <section className="p-5 rounded-[22px] glass-surface border border-[var(--border)] shadow-[var(--shadow)] space-y-4">
          {tab === 'video' && (
            <>
              <div>
                <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1">
                  Theme / Atmosphere
                </label>
                <input
                  type="text"
                  value={videoMood}
                  onChange={(e) => setVideoMood(e.target.value)}
                  className={fieldCls}
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1">
                    Confirmed Reference Photo (blank = atmosphere-only)
                  </label>
                  <input
                    type="text"
                    value={videoRefPhoto}
                    onChange={(e) => setVideoRefPhoto(e.target.value)}
                    placeholder="Optional photo description"
                    className={fieldCls}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1">
                    Language
                  </label>
                  <select
                    value={videoLang}
                    onChange={(e) => setVideoLang(e.target.value as LanguagePref)}
                    className={fieldCls}
                  >
                    <option value="auto">Auto</option>
                    <option value="sv">Svenska</option>
                    <option value="en">English</option>
                    <option value="bilingual">Bilingual</option>
                  </select>
                </div>
              </div>
            </>
          )}

          {tab === 'calendar' && (
            <>
              {packages.length > 0 && (
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1">
                    Link to Campaign Package (optional)
                  </label>
                  <select
                    value={linkedPkgId}
                    onChange={(e) => setLinkedPkgId(e.target.value)}
                    className={fieldCls}
                  >
                    <option value="">Custom schedule</option>
                    {packages.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {!linkedPkgId && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1">
                      Window
                    </label>
                    <input
                      type="text"
                      value={calWindow}
                      onChange={(e) => setCalWindow(e.target.value)}
                      className={fieldCls}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1">
                      Channels
                    </label>
                    <input
                      type="text"
                      value={calChannels}
                      onChange={(e) => setCalChannels(e.target.value)}
                      className={fieldCls}
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1">
                      Focus Offer
                    </label>
                    <input
                      type="text"
                      value={calOffer}
                      onChange={(e) => setCalOffer(e.target.value)}
                      className={fieldCls}
                    />
                  </div>
                </div>
              )}
            </>
          )}

          {tab === 'research' && (
            <>
              <div>
                <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1">
                  Research Question
                </label>
                <textarea
                  rows={2}
                  value={researchQuestion}
                  onChange={(e) => setResearchQuestion(e.target.value)}
                  className="w-full p-3 text-sm rounded-[14px] bg-[var(--surface-muted)] border border-[var(--border)] text-[var(--text)] focus:border-[var(--text)] focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1">
                  Context / Constraints (optional)
                </label>
                <input
                  type="text"
                  value={researchNotes}
                  onChange={(e) => setResearchNotes(e.target.value)}
                  placeholder="e.g. Zero ad budget, winter shoulder months"
                  className={fieldCls}
                />
              </div>
            </>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            {!isConfigured ? (
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={onOpenSettings}
                  className="min-h-[42px] px-4 py-2 text-xs font-semibold rounded-full bg-[var(--lime)] text-[#181817]"
                >
                  Open Settings
                </button>
                <button
                  type="button"
                  onClick={onEnableDemoMode}
                  className="min-h-[42px] px-4 py-2 text-xs font-medium rounded-full border border-[var(--border)] text-[var(--text)]"
                >
                  Try Demo Mode
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={loading}
                  onClick={handleRun}
                  className="min-h-[42px] inline-flex items-center gap-2 px-5 py-2 text-sm font-semibold rounded-full bg-[var(--lime)] hover:bg-[var(--lime-hover)] text-[#181817] disabled:opacity-50"
                >
                  {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>
                    {loading
                      ? 'Generating…'
                      : tab === 'video'
                        ? 'Generate Shot List'
                        : tab === 'calendar'
                          ? 'Generate Calendar'
                          : 'Generate Research Brief'}
                  </span>
                </button>

                {loading && (
                  <button
                    type="button"
                    onClick={() => abortRef.current?.abort()}
                    className="min-h-[42px] inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-full bg-[var(--tangerine)] text-[#181817]"
                  >
                    <Square className="w-3 h-3 fill-current" />
                    <span>Stop</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </section>

        {/* Output */}
        {result && (
          <section className="p-5 rounded-[22px] glass-surface border border-[var(--border)] shadow-[var(--shadow)] space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-[var(--border)]">
              <div>
                <h2 className="text-base font-medium text-[var(--text)]">{result.title}</h2>
                <p className="text-[11px] font-mono-tabular text-[var(--text-muted)]">
                  {result.lintIssues.length === 0
                    ? 'Honesty Lint Passed'
                    : `${result.lintIssues.length} lint issue(s)`}
                  {result.repaired ? ' · Auto-repaired' : ''}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                {calItems.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      const ics = calendarToICS(calItems, 'Hedetangen Content Calendar');
                      const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = 'hedetangen-calendar.ics';
                      document.body.appendChild(a);
                      a.click();
                      a.remove();
                      URL.revokeObjectURL(url);
                      onNotify('Downloaded calendar (.ics).', 'success');
                    }}
                    className="min-h-[36px] inline-flex items-center gap-1 px-3 py-1 text-xs font-semibold rounded-full bg-[var(--lime)] text-[#181817]"
                  >
                    <Calendar className="w-3.5 h-3.5" />
                    <span>Download .ics</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => {
                    onCopy(result.markdown);
                    setCopied(true);
                    window.setTimeout(() => setCopied(false), 1500);
                  }}
                  className="min-h-[36px] inline-flex items-center gap-1 px-3 py-1 text-xs font-medium rounded-full border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text)]"
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-[var(--success)]" />
                      <span>Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() =>
                    onSaveToLibrary(
                      result,
                      tab === 'video' ? 'visual-brief' : tab === 'research' ? 'research' : 'campaign'
                    )
                  }
                  className="min-h-[36px] inline-flex items-center gap-1 px-3 py-1 text-xs font-medium rounded-full border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text)]"
                >
                  <Bookmark className="w-3.5 h-3.5" />
                  <span>Save to Library</span>
                </button>
              </div>
            </div>

            <SafeMarkdown content={result.markdown} />
          </section>
        )}
      </div>
    </div>
  );
}
