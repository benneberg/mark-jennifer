import React, { useRef, useState } from 'react';
import { Download, Upload, X } from 'lucide-react';
import {
  applyImportPackage,
  buildExportPackage,
  type ImportValidationResult,
  validateImportPackage,
} from '../storage/entities';
import { todaySlug } from '../utils/dates';

interface ImportExportModalProps {
  open: boolean;
  onClose: () => void;
  onImportComplete: () => Promise<void>;
  onNotify: (msg: string, variant?: 'info' | 'success' | 'danger') => void;
}

export function ImportExportModal({
  open,
  onClose,
  onImportComplete,
  onNotify,
}: ImportExportModalProps) {
  const [includeChats, setIncludeChats] = useState(false);
  const [validation, setValidation] = useState<ImportValidationResult | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  if (!open) return null;

  const handleExport = async () => {
    const pkg = await buildExportPackage(includeChats);
    const blob = new Blob([JSON.stringify(pkg, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `hedetangen-studio-${todaySlug()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    onNotify(
      `Exported ${pkg.experts.length} experts and ${pkg.library.length} library items (API keys excluded).`,
      'success'
    );
  };

  const handlePickFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const text = await file.text();
    const res = await validateImportPackage(text);
    setValidation(res);
  };

  const handleApply = async (mode: 'merge' | 'replace') => {
    if (!validation?.valid || !validation.parsed) return;
    await applyImportPackage(validation.parsed, mode);
    await onImportComplete();
    setValidation(null);
    onClose();
    onNotify(`Studio imported (${mode} mode).`, 'success');
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[rgba(24,24,23,0.52)] backdrop-blur-[4px]"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          setValidation(null);
          onClose();
        }
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Export and Import Studio"
        className="w-full max-w-lg rounded-[28px] bg-[var(--bg)] border border-[var(--border)] shadow-[var(--shadow-md)] p-5 sm:p-6 space-y-4 text-[var(--text)] max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-light tracking-[-0.015em]">Export &amp; Import Studio</h2>
          <button
            type="button"
            onClick={() => {
              setValidation(null);
              onClose();
            }}
            aria-label="Close"
            className="min-h-[38px] min-w-[38px] flex items-center justify-center rounded-full border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text)] hover:border-[var(--border-strong)]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Export */}
        <section className="p-4 rounded-[22px] glass-surface border border-[var(--border)] shadow-[var(--shadow)] space-y-3">
          <h3 className="text-sm font-semibold">Export Workspace</h3>
          <p className="text-xs text-[var(--text-muted)] leading-relaxed">
            Downloads one JSON file with your experts, Brand DNA guardrails, content library, and
            settings. API keys are never exported.
          </p>
          <label className="flex items-center gap-2 text-xs text-[var(--text-muted)] cursor-pointer">
            <input
              type="checkbox"
              checked={includeChats}
              onChange={(e) => setIncludeChats(e.target.checked)}
              className="w-4 h-4 accent-[#181817] dark:accent-[#EBEE2C]"
            />
            <span>Include chat history</span>
          </label>
          <button
            type="button"
            onClick={handleExport}
            className="min-h-[42px] inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-full bg-[var(--lime)] hover:bg-[var(--lime-hover)] text-[#181817]"
          >
            <Download className="w-4 h-4" />
            <span>Download JSON backup</span>
          </button>
        </section>

        {/* Import */}
        <section className="p-4 rounded-[22px] glass-surface border border-[var(--border)] shadow-[var(--shadow)] space-y-3">
          <h3 className="text-sm font-semibold">Import Workspace</h3>
          <p className="text-xs text-[var(--text-muted)] leading-relaxed">
            Choose a previously exported studio JSON file to validate and preview before applying.
          </p>

          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="min-h-[42px] inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-full border border-[var(--border)] bg-[var(--surface-muted)] text-[var(--text)] hover:border-[var(--border-strong)]"
          >
            <Upload className="w-4 h-4" />
            <span>Select JSON file</span>
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            onChange={handlePickFile}
            className="hidden"
          />

          {validation && !validation.valid && (
            <div className="p-3 rounded-[16px] bg-[var(--danger-soft)] border border-[var(--danger)] text-xs text-[var(--danger)] space-y-1">
              <div className="font-semibold">Import rejected — schema errors found:</div>
              {validation.errors.slice(0, 8).map((err, i) => (
                <div key={i}>{err}</div>
              ))}
            </div>
          )}

          {validation && validation.valid && validation.summary && (
            <div className="p-3.5 rounded-[18px] bg-[var(--surface-muted)] border border-[var(--border)] space-y-3 text-xs">
              <div className="font-semibold text-[var(--text)]">Import Preview</div>
              <ul className="space-y-1 text-[var(--text-muted)]">
                <li>Experts: {validation.summary.expertsCount}</li>
                <li>Library items: {validation.summary.libraryCount}</li>
                <li>
                  Brand DNA changed: {validation.summary.guardrailsChanged ? 'Yes' : 'No'}
                </li>
                {validation.summary.chatsCount > 0 && (
                  <li>Chats included: {validation.summary.chatsCount}</li>
                )}
              </ul>
              {validation.warnings.length > 0 && (
                <p className="text-[var(--text-faint)]">{validation.warnings.join(' ')}</p>
              )}
              <div className="flex flex-wrap gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => handleApply('merge')}
                  className="min-h-[40px] px-4 py-1.5 rounded-full bg-[var(--lime)] hover:bg-[var(--lime-hover)] text-[#181817] font-semibold"
                >
                  Merge (newer wins)
                </button>
                <button
                  type="button"
                  onClick={() => handleApply('replace')}
                  className="min-h-[40px] px-4 py-1.5 rounded-full bg-[var(--tangerine)] text-[#181817] font-semibold hover:opacity-90"
                >
                  Replace workspace
                </button>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
