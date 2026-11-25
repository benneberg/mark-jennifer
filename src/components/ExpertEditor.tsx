import React, { useRef, useState } from 'react';
import { Download, Lock, Pencil, Plus, Trash2, Upload } from 'lucide-react';
import type { Expert } from '../types';
import { nowIso } from '../utils/dates';
import { generateId } from '../utils/id';
import { EXPERT_SCHEMA, validateSchema } from '../utils/validate';
import { ConfirmModal } from './ConfirmModal';

interface ExpertEditorProps {
  experts: Expert[];
  onSaveExpert: (expert: Expert) => Promise<void>;
  onDeleteExpert: (id: string) => Promise<void>;
  onImportExperts: (experts: Expert[]) => Promise<void>;
  onNotify: (msg: string, variant?: 'info' | 'success' | 'danger') => void;
}

export function ExpertEditor({
  experts,
  onSaveExpert,
  onDeleteExpert,
  onImportExperts,
  onNotify,
}: ExpertEditorProps) {
  const [editing, setEditing] = useState<Expert | null>(null);
  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [systemPrompt, setSystemPrompt] = useState('');
  const [temperature, setTemperature] = useState<string>('0.7');
  const [tagsText, setTagsText] = useState('');
  const [enabled, setEnabled] = useState(true);
  const [formErrors, setFormErrors] = useState<string[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<Expert | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const openNew = () => {
    const ts = nowIso();
    setEditing({
      id: generateId(),
      name: '',
      role: '',
      systemPrompt: '',
      temperature: 0.7,
      enabled: true,
      tags: [],
      isSeed: false,
      createdAt: ts,
      updatedAt: ts,
    });
    setName('');
    setRole('');
    setSystemPrompt('');
    setTemperature('0.7');
    setTagsText('');
    setEnabled(true);
    setFormErrors([]);
  };

  const openEdit = (exp: Expert) => {
    setEditing(exp);
    setName(exp.name);
    setRole(exp.role);
    setSystemPrompt(exp.systemPrompt);
    setTemperature(exp.temperature !== undefined ? String(exp.temperature) : '0.7');
    setTagsText(exp.tags.join(', '));
    setEnabled(exp.enabled);
    setFormErrors([]);
  };

  const handleSaveForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    const parsedTemp = temperature.trim() === '' ? undefined : Number(temperature);
    const tags = Array.from(
      new Set(
        tagsText
          .split(',')
          .map((t) => t.trim().toLowerCase())
          .filter(Boolean)
      )
    );

    const candidate: Expert = {
      ...editing,
      name: name.trim(),
      role: role.trim(),
      systemPrompt: systemPrompt.trim(),
      temperature: Number.isFinite(parsedTemp) ? parsedTemp : undefined,
      enabled,
      tags,
      updatedAt: nowIso(),
    };

    const check = validateSchema(candidate, EXPERT_SCHEMA);
    if (!check.valid) {
      setFormErrors(check.errors.map((err) => `${err.path.replace('$.', '')}: ${err.message}`));
      return;
    }

    await onSaveExpert(candidate);
    setEditing(null);
    onNotify(`Saved expert "${candidate.name}".`, 'success');
  };

  const handleExportExperts = () => {
    const blob = new Blob([JSON.stringify(experts, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `hedetangen-experts-${nowIso().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    onNotify(`Exported ${experts.length} experts.`, 'success');
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      if (!Array.isArray(parsed)) {
        onNotify('Expert import file must be a JSON array.', 'danger');
        return;
      }
      const valid: Expert[] = [];
      for (let i = 0; i < parsed.length; i++) {
        const res = validateSchema(parsed[i], EXPERT_SCHEMA);
        if (!res.valid) {
          onNotify(`Expert #${i + 1} invalid: ${res.errors[0]?.message}`, 'danger');
          return;
        }
        valid.push(parsed[i] as Expert);
      }
      await onImportExperts(valid);
      onNotify(`Imported ${valid.length} experts.`, 'success');
    } catch {
      onNotify('Could not parse experts JSON file.', 'danger');
    }
  };

  const enabledCount = experts.filter((x) => x.enabled).length;

  if (editing) {
    return (
      <form onSubmit={handleSaveForm} className="space-y-4 pb-8">
        <div className="flex items-center justify-between gap-2 pb-2 border-b border-[var(--border)]">
          <h3 className="text-sm font-semibold text-[var(--text)]">
            {experts.some((x) => x.id === editing.id) ? `Edit ${editing.name}` : 'New Expert'}
          </h3>
          <button
            type="button"
            onClick={() => setEditing(null)}
            className="text-xs text-[var(--text-muted)] hover:text-[var(--text)]"
          >
            Back to list
          </button>
        </div>

        <div className="flex items-start gap-2 p-3 rounded-lg bg-[var(--surface-muted)] border border-[var(--border)] text-xs text-[var(--text-muted)]">
          <Lock className="w-3.5 h-3.5 text-[var(--accent)] shrink-0 mt-0.5" />
          <span>
            Hedetangen Brand DNA &amp; Honesty Rule are injected automatically at call time — you do
            not need to paste them here.
          </span>
        </div>

        {formErrors.length > 0 && (
          <div className="p-3 rounded-lg bg-[var(--danger-soft)] border border-[var(--danger)] text-xs text-[var(--danger)] space-y-1">
            {formErrors.map((err) => (
              <div key={err}>{err}</div>
            ))}
          </div>
        )}

        <div>
          <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={60}
            required
            className="w-full min-h-[44px] px-3 py-2 text-sm rounded-lg bg-[var(--bg)] border border-[var(--border)] text-[var(--text)]"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">
            Short role description
          </label>
          <input
            type="text"
            value={role}
            onChange={(e) => setRole(e.target.value)}
            maxLength={200}
            required
            className="w-full min-h-[44px] px-3 py-2 text-sm rounded-lg bg-[var(--bg)] border border-[var(--border)] text-[var(--text)]"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">
            System prompt (min 20 chars)
          </label>
          <textarea
            rows={8}
            value={systemPrompt}
            onChange={(e) => setSystemPrompt(e.target.value)}
            maxLength={8000}
            required
            className="w-full p-3 text-xs font-mono-tabular rounded-lg bg-[var(--bg)] border border-[var(--border)] text-[var(--text)] leading-relaxed"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">
              Temperature (0–1.5)
            </label>
            <input
              type="number"
              step="0.1"
              min="0"
              max="1.5"
              value={temperature}
              onChange={(e) => setTemperature(e.target.value)}
              className="w-full min-h-[44px] px-3 py-2 text-sm rounded-lg bg-[var(--bg)] border border-[var(--border)] text-[var(--text)]"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">
              Tags (comma-separated)
            </label>
            <input
              type="text"
              value={tagsText}
              onChange={(e) => setTagsText(e.target.value)}
              placeholder="copy, social"
              className="w-full min-h-[44px] px-3 py-2 text-sm rounded-lg bg-[var(--bg)] border border-[var(--border)] text-[var(--text)]"
            />
          </div>
        </div>

        <label className="flex items-center gap-2.5 text-sm text-[var(--text)] cursor-pointer">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            className="w-4 h-4 accent-[var(--accent)]"
          />
          <span>Enabled for Jennifer delegation</span>
        </label>

        <div className="flex items-center justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={() => setEditing(null)}
            className="min-h-[44px] px-4 py-2 text-sm font-medium rounded-lg border border-[var(--border)] text-[var(--text)]"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="min-h-[44px] px-5 py-2 text-sm font-medium rounded-lg bg-[var(--accent)] text-white hover:opacity-90"
          >
            Save Expert
          </button>
        </div>
      </form>
    );
  }

  return (
    <div className="space-y-4 pb-8">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          onClick={openNew}
          className="min-h-[44px] inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-lg bg-[var(--accent)] text-white hover:opacity-90"
        >
          <Plus className="w-4 h-4" />
          <span>Add expert</span>
        </button>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleExportExperts}
            className="min-h-[40px] inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-[var(--border)] text-[var(--text)] hover:bg-[var(--surface-muted)]"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export</span>
          </button>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="min-h-[40px] inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-[var(--border)] text-[var(--text)] hover:bg-[var(--surface-muted)]"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Import</span>
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            onChange={handleImportFile}
            className="hidden"
          />
        </div>
      </div>

      {enabledCount === 0 && (
        <div className="p-3 rounded-lg bg-[var(--surface-muted)] border border-[var(--border)] text-xs text-[var(--text-muted)]">
          You have no experts enabled. Jennifer will answer directly without specialist delegation.
        </div>
      )}

      <div className="divide-y divide-[var(--border)] border border-[var(--border)] rounded-xl bg-[var(--bg)]">
        {experts.map((exp) => (
          <div key={exp.id} className="p-3.5 flex items-start justify-between gap-3">
            <div className="min-w-0 space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-[var(--text)] truncate">{exp.name}</span>
                {!exp.enabled && (
                  <span className="text-[11px] text-[var(--text-faint)]">Disabled</span>
                )}
              </div>
              <p className="text-xs text-[var(--text-muted)] leading-snug">{exp.role}</p>
              {exp.tags.length > 0 && (
                <p className="text-[11px] text-[var(--text-faint)]">{exp.tags.join(' · ')}</p>
              )}
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <input
                type="checkbox"
                checked={exp.enabled}
                aria-label={`Enable ${exp.name}`}
                onChange={() =>
                  onSaveExpert({ ...exp, enabled: !exp.enabled, updatedAt: nowIso() })
                }
                className="w-4 h-4 mr-1 accent-[var(--accent)] cursor-pointer"
              />
              <button
                type="button"
                onClick={() => openEdit(exp)}
                aria-label={`Edit ${exp.name}`}
                className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface-muted)]"
              >
                <Pencil className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setDeleteTarget(exp)}
                aria-label={`Delete ${exp.name}`}
                className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg text-[var(--text-muted)] hover:text-[var(--danger)] hover:bg-[var(--danger-soft)]"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      <ConfirmModal
        open={Boolean(deleteTarget)}
        title={`Delete ${deleteTarget?.name ?? 'expert'}?`}
        description={
          deleteTarget?.isSeed
            ? 'This is a built-in seed expert. Removing it may limit Jennifer’s specialist capabilities.'
            : 'This permanently removes this expert from your studio.'
        }
        confirmLabel="Delete"
        danger
        onConfirm={async () => {
          if (deleteTarget) {
            await onDeleteExpert(deleteTarget.id);
            onNotify(`Deleted "${deleteTarget.name}".`, 'info');
          }
          setDeleteTarget(null);
        }}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
