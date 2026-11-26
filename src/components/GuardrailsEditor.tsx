import React, { useEffect, useState } from 'react';
import { Lock, RotateCcw } from 'lucide-react';
import { createSeedGuardrails } from '../data/seed-guardrails';
import type { Guardrails, GuardrailsEditable } from '../types';
import { formatDateTime, nowIso } from '../utils/dates';
import { ConfirmModal } from './ConfirmModal';

interface GuardrailsEditorProps {
  guardrails: Guardrails;
  onSaveGuardrails: (next: Guardrails) => Promise<void>;
  onNotify: (msg: string, variant?: 'info' | 'success' | 'danger') => void;
}

export function GuardrailsEditor({
  guardrails,
  onSaveGuardrails,
  onNotify,
}: GuardrailsEditorProps) {
  const [draft, setDraft] = useState<GuardrailsEditable>(guardrails.editable);
  const [materialsText, setMaterialsText] = useState(guardrails.editable.materials.join('\n'));
  const [colourText, setColourText] = useState(guardrails.editable.colourAndLight.join('\n'));
  const [avoidText, setAvoidText] = useState(guardrails.editable.avoid.join('\n'));
  const [resetOpen, setResetOpen] = useState(false);

  useEffect(() => {
    setDraft(guardrails.editable);
    setMaterialsText(guardrails.editable.materials.join('\n'));
    setColourText(guardrails.editable.colourAndLight.join('\n'));
    setAvoidText(guardrails.editable.avoid.join('\n'));
  }, [guardrails]);

  const toLines = (val: string) =>
    val
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 30);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const nextEditable: GuardrailsEditable = {
      essence: draft.essence.trim(),
      materials: toLines(materialsText),
      colourAndLight: toLines(colourText),
      people: draft.people.trim(),
      cinema: draft.cinema.trim(),
      emotion: draft.emotion.trim(),
      avoid: toLines(avoidText),
      extraNotes: draft.extraNotes?.trim() || undefined,
    };

    const prevHistory = guardrails.history ?? [];
    const nextHistory = [
      { snapshot: guardrails.editable, savedAt: nowIso() },
      ...prevHistory,
    ].slice(0, 5);

    try {
      await onSaveGuardrails({
        ...guardrails,
        editable: nextEditable,
        history: nextHistory,
      });
      onNotify('Brand DNA guardrails saved.', 'success');
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Failed to save guardrails', 'danger');
    }
  };

  const handleRestoreSnapshot = async (snapshot: GuardrailsEditable) => {
    await onSaveGuardrails({
      ...guardrails,
      editable: snapshot,
    });
    onNotify('Restored Brand DNA snapshot.', 'success');
  };

  const handleResetDefault = async () => {
    const seed = createSeedGuardrails(nowIso());
    await onSaveGuardrails({
      ...guardrails,
      editable: seed.editable,
      history: [{ snapshot: guardrails.editable, savedAt: nowIso() }, ...(guardrails.history ?? [])].slice(
        0,
        5
      ),
    });
    setResetOpen(false);
    onNotify('Reset Brand DNA to canonical v4 defaults.', 'info');
  };

  const fieldCls =
    'w-full p-3 text-sm rounded-[16px] bg-[var(--surface-muted)] border border-[var(--border)] text-[var(--text)] focus:border-[var(--text)] focus:outline-none';

  return (
    <form onSubmit={handleSave} className="space-y-4 pb-8">
      {/* Immutable Honesty Rule */}
      <div className="p-4 rounded-[22px] bg-[var(--sand)] dark:bg-[#1C1C1A] border border-[var(--border)] shadow-[var(--shadow)] space-y-1.5 text-[#181817] dark:text-[#F4EFE4]">
        <div className="flex items-center gap-1.5 text-xs font-semibold">
          <Lock className="w-3.5 h-3.5 text-[var(--tangerine)]" />
          <span>Honesty Rule (Immutable)</span>
        </div>
        <p className="text-xs leading-relaxed opacity-90">{guardrails.honestyRule}</p>
        <p className="text-[11px] opacity-70">
          This rule is always applied and cannot be edited. It protects your brand from AI
          inventing places or structures.
        </p>
      </div>

      <div className="p-4 rounded-[22px] glass-surface border border-[var(--border)] shadow-[var(--shadow)] space-y-4">
        <div>
          <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1">Essence</label>
          <textarea
            rows={2}
            maxLength={400}
            value={draft.essence}
            onChange={(e) => setDraft({ ...draft, essence: e.target.value })}
            className={fieldCls}
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1">
            Materials (one per line)
          </label>
          <textarea
            rows={4}
            value={materialsText}
            onChange={(e) => setMaterialsText(e.target.value)}
            className={fieldCls}
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1">
            Colour &amp; Light (one per line)
          </label>
          <textarea
            rows={4}
            value={colourText}
            onChange={(e) => setColourText(e.target.value)}
            className={fieldCls}
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1">People</label>
          <textarea
            rows={2}
            maxLength={400}
            value={draft.people}
            onChange={(e) => setDraft({ ...draft, people: e.target.value })}
            className={fieldCls}
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1">
            Cinematography
          </label>
          <textarea
            rows={3}
            maxLength={600}
            value={draft.cinema}
            onChange={(e) => setDraft({ ...draft, cinema: e.target.value })}
            className={fieldCls}
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1">Emotion</label>
          <input
            type="text"
            maxLength={300}
            value={draft.emotion}
            onChange={(e) => setDraft({ ...draft, emotion: e.target.value })}
            className={`min-h-[44px] ${fieldCls}`}
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1">
            Avoid list (one per line)
          </label>
          <textarea
            rows={4}
            value={avoidText}
            onChange={(e) => setAvoidText(e.target.value)}
            className={fieldCls}
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1">
            Extra notes (optional)
          </label>
          <textarea
            rows={2}
            maxLength={2000}
            value={draft.extraNotes ?? ''}
            onChange={(e) => setDraft({ ...draft, extraNotes: e.target.value })}
            className={fieldCls}
          />
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 pt-1">
        <button
          type="button"
          onClick={() => setResetOpen(true)}
          className="min-h-[44px] inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-full glass-surface border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text)]"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Reset to default</span>
        </button>

        <button
          type="submit"
          className="min-h-[44px] px-5 py-2 text-sm font-semibold rounded-full bg-[var(--lime)] hover:bg-[var(--lime-hover)] text-[#181817] shadow-[var(--shadow)]"
        >
          Save Brand DNA
        </button>
      </div>

      {guardrails.history && guardrails.history.length > 0 && (
        <div className="pt-4 border-t border-[var(--border)] space-y-2">
          <h4 className="text-xs font-semibold text-[var(--text-muted)]">
            Recent snapshots (last 5)
          </h4>
          <div className="space-y-1.5">
            {guardrails.history.map((snap, idx) => (
              <div
                key={`${snap.savedAt}-${idx}`}
                className="flex items-center justify-between gap-2 px-3.5 py-2 rounded-full glass-surface border border-[var(--border)] text-xs"
              >
                <span className="font-mono-tabular text-[var(--text-muted)]">
                  {formatDateTime(snap.savedAt)}
                </span>
                <button
                  type="button"
                  onClick={() => handleRestoreSnapshot(snap.snapshot)}
                  className="font-semibold text-[var(--text)] hover:text-[var(--tangerine)]"
                >
                  Restore
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <ConfirmModal
        open={resetOpen}
        title="Reset Brand DNA to defaults?"
        description="Your current edits will be saved in snapshot history before restoring the canonical Brand DNA v4 values."
        confirmLabel="Reset"
        onConfirm={handleResetDefault}
        onCancel={() => setResetOpen(false)}
      />
    </form>
  );
}
