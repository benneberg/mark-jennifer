import { useState } from 'react';
import { Lock, X } from 'lucide-react';
import type { Guardrails, LanguagePref } from '../types';

interface WizardProps {
  guardrails: Guardrails;
  defaultLanguage: LanguagePref;
  onCancel: () => void;
  onGenerate: (prompt: string) => void;
}

const GOALS = ['Awareness', 'Bookings', 'Off-season', 'Partnerships'] as const;
const AUDIENCES = [
  "Couples' reset",
  'Milestone celebration',
  'Winter aurora & sauna',
  'International road-trippers',
  'Locals gifting',
] as const;
const LANGUAGES: Array<{ id: LanguagePref; label: string }> = [
  { id: 'auto', label: 'Auto' },
  { id: 'sv', label: 'Svenska' },
  { id: 'en', label: 'English' },
  { id: 'bilingual', label: 'Bilingual' },
];
const CHANNELS = ['Instagram', 'Facebook', 'Email', 'Website', 'Google Ads'] as const;
const OUTPUTS = [
  'Captions',
  'Ad variants',
  'Email sequence',
  'Landing page sections',
  'Visual brief',
  'Content calendar',
] as const;

export function Wizard({ guardrails, defaultLanguage, onCancel, onGenerate }: WizardProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [goal, setGoal] = useState<string>('Bookings');
  const [audiences, setAudiences] = useState<string[]>(["Couples' reset"]);
  const [language, setLanguage] = useState<LanguagePref>(defaultLanguage);
  const [channels, setChannels] = useState<string[]>(['Instagram']);
  const [outputs, setOutputs] = useState<string[]>(['Captions']);
  const [notes, setNotes] = useState('');

  const toggleItem = (list: string[], setList: (v: string[]) => void, item: string) => {
    setList(list.includes(item) ? list.filter((i) => i !== item) : [...list, item]);
  };

  const canNextStep1 = Boolean(goal) && audiences.length > 0;
  const canNextStep2 = channels.length > 0 && outputs.length > 0;

  const handleSubmit = () => {
    const langLabel = LANGUAGES.find((l) => l.id === language)?.label ?? language;
    const prompt = [
      `Campaign Builder Brief:`,
      `- Objective: ${goal}`,
      `- Audience occasion(s): ${audiences.join(', ')}`,
      `- Language: ${langLabel}`,
      `- Channel(s): ${channels.join(', ')}`,
      `- Deliverables requested: ${outputs.join(', ')}`,
      notes.trim() ? `- Additional context: ${notes.trim()}` : '',
      ``,
      `Please create a cohesive campaign plan and ready-to-use deliverables following Hedetangen's Brand DNA and honesty rule.`,
    ]
      .filter(Boolean)
      .join('\n');
    onGenerate(prompt);
  };

  return (
    <div className="sticky bottom-0 z-20 px-3 sm:px-6 pb-[max(1rem,env(safe-area-inset-bottom))] pt-2">
      <div className="max-w-[780px] mx-auto rounded-[28px] glass-surface border border-[var(--border)] shadow-[var(--shadow-md)] p-4 sm:p-5">
        <div className="flex items-center justify-between gap-3 pb-3 border-b border-[var(--border)]">
          <div>
            <h2 className="text-base font-semibold tracking-tight text-[var(--text)]">
              Campaign Builder
            </h2>
            <p className="text-xs text-[var(--text-muted)]">Step {step} of 3</p>
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
              onClick={onCancel}
              aria-label="Close Campaign Builder"
              className="min-h-[38px] min-w-[38px] flex items-center justify-center rounded-full border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text)] hover:border-[var(--border-strong)]"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {step === 1 && (
          <div className="mt-4 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-[var(--text-muted)] mb-2">
                Primary goal
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

            <div>
              <label className="block text-xs font-semibold text-[var(--text-muted)] mb-2">
                Audience occasion
              </label>
              <div className="flex flex-wrap gap-2">
                {AUDIENCES.map((a) => {
                  const active = audiences.includes(a);
                  return (
                    <button
                      key={a}
                      type="button"
                      onClick={() => toggleItem(audiences, setAudiences, a)}
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
          </div>
        )}

        {step === 2 && (
          <div className="mt-4 space-y-4">
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
                      onClick={() => toggleItem(channels, setChannels, ch)}
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
                Deliverables
              </label>
              <div className="flex flex-wrap gap-2">
                {OUTPUTS.map((out) => {
                  const active = outputs.includes(out);
                  return (
                    <button
                      key={out}
                      type="button"
                      onClick={() => toggleItem(outputs, setOutputs, out)}
                      className={`min-h-[38px] px-3.5 py-1.5 text-xs font-semibold rounded-full border transition-all ${
                        active
                          ? 'bg-[var(--lime)] border-transparent text-[#181817]'
                          : 'bg-[var(--surface-muted)] border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text)]'
                      }`}
                    >
                      {out}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1.5">
                Seasonal focus or dates (optional)
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Late August weekends, 1750 SEK/person"
                className="w-full px-3.5 py-2.5 text-sm rounded-[16px] bg-[var(--surface-muted)] border border-[var(--border)] text-[var(--text)] focus:border-[var(--text)] focus:outline-none"
              />
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="mt-4 space-y-3">
            <div className="p-3.5 rounded-[18px] bg-[var(--surface-muted)] border border-[var(--border)] text-xs space-y-1.5">
              <div className="font-semibold text-[var(--text)]">Campaign Summary</div>
              <p className="text-[var(--text-muted)]">
                {goal} · {audiences.join(', ')} · {channels.join(', ')}
              </p>
              <p className="text-[var(--text-muted)]">Deliverables: {outputs.join(', ')}</p>
              {notes.trim() && <p className="text-[var(--text-muted)]">Notes: {notes.trim()}</p>}
            </div>

            <div className="p-3.5 rounded-[18px] bg-[var(--sand)] dark:bg-[#1C1C1A] border border-[var(--border)] text-xs space-y-1.5 text-[#181817] dark:text-[#F4EFE4]">
              <div className="flex items-center gap-1.5 font-semibold">
                <Lock className="w-3.5 h-3.5 text-[var(--tangerine)]" />
                <span>Brand Guardrails (always applied)</span>
              </div>
              <p className="leading-relaxed opacity-85">{guardrails.honestyRule}</p>
              <p className="opacity-65">
                Avoid: {guardrails.editable.avoid.slice(0, 4).join(' · ')}
              </p>
            </div>
          </div>
        )}

        <div className="mt-5 flex items-center justify-between gap-2 pt-3 border-t border-[var(--border)]">
          <button
            type="button"
            onClick={step === 1 ? onCancel : () => setStep((s) => (s === 3 ? 2 : 1))}
            className="min-h-[42px] px-4 py-2 text-sm font-medium rounded-full border border-[var(--border)] text-[var(--text)] hover:bg-[var(--surface-muted)] transition-colors"
          >
            {step === 1 ? 'Cancel' : 'Back'}
          </button>

          {step < 3 ? (
            <button
              type="button"
              disabled={(step === 1 && !canNextStep1) || (step === 2 && !canNextStep2)}
              onClick={() => setStep((s) => (s === 1 ? 2 : 3))}
              className="min-h-[42px] px-5 py-2 text-sm font-semibold rounded-full bg-[var(--lime)] hover:bg-[var(--lime-hover)] text-[#181817] disabled:opacity-40 transition-colors"
            >
              Next
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              className="min-h-[42px] px-5 py-2 text-sm font-semibold rounded-full bg-[var(--lime)] hover:bg-[var(--lime-hover)] text-[#181817] transition-colors"
            >
              Generate
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
