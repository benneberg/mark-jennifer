import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Archive,
  Bookmark,
  Calendar,
  Check,
  CheckCircle2,
  Copy,
  FileText,
  MessageSquare,
  Plus,
  Trash2,
} from 'lucide-react';
import {
  buildCompletePackageZip,
  buildPackageHandbookMarkdown,
  calendarToICS,
  extractCalendarItems,
} from '../campaign/exportPackage';
import type {
  BusinessProfile,
  CampaignDeliverable,
  CampaignDeliverableKind,
  CampaignPackage,
  LibraryItemType,
} from '../types';
import { formatDateTime } from '../utils/dates';
import { SafeMarkdown } from '../utils/markdown';
import { ConfirmModal } from './ConfirmModal';

interface PackageViewProps {
  packages: CampaignPackage[];
  activePackageId: string | null;
  businessProfile: BusinessProfile;
  onSelectPackage: (id: string) => void;
  onNewPackage: () => void;
  onToggleChecklistTask: (pkgId: string, taskId: string) => Promise<void>;
  onToggleDeliverableApprove: (pkgId: string, deliverableId: string) => Promise<void>;
  onSaveDeliverableToLibrary: (
    pkg: CampaignPackage,
    deliverable: CampaignDeliverable,
    type: LibraryItemType
  ) => Promise<void>;
  onAskJenniferRevise: (pkg: CampaignPackage) => void;
  onDeletePackage: (id: string) => Promise<void>;
  onCopy: (text: string) => void;
  onNotify: (msg: string, variant?: 'info' | 'success' | 'danger') => void;
}

function triggerBlobDownload(filename: string, data: BlobPart, mime: string) {
  const blob = new Blob([data], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function deliverableKindToLibraryType(kind: CampaignDeliverableKind): LibraryItemType {
  if (kind === 'research') return 'research';
  if (kind === 'video') return 'visual-brief';
  if (kind === 'calendar') return 'campaign';
  return 'copy';
}

export function PackageView({
  packages,
  activePackageId,
  businessProfile,
  onSelectPackage,
  onNewPackage,
  onToggleChecklistTask,
  onToggleDeliverableApprove,
  onSaveDeliverableToLibrary,
  onAskJenniferRevise,
  onDeletePackage,
  onCopy,
  onNotify,
}: PackageViewProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CampaignPackage | null>(null);

  const activePkg = useMemo(
    () => packages.find((p) => p.id === activePackageId) ?? packages[0] ?? null,
    [packages, activePackageId]
  );

  const calItems = useMemo(
    () => (activePkg ? extractCalendarItems(activePkg.deliverables) : []),
    [activePkg]
  );

  const groupedChecklist = useMemo(() => {
    if (!activePkg) return [];
    const groups = new Map<string, typeof activePkg.checklist>();
    for (const task of activePkg.checklist) {
      const existing = groups.get(task.phase) ?? [];
      existing.push(task);
      groups.set(task.phase, existing);
    }
    return Array.from(groups.entries());
  }, [activePkg]);

  const handleCopy = (id: string, text: string) => {
    onCopy(text);
    setCopiedId(id);
    window.setTimeout(() => setCopiedId((c) => (c === id ? null : c)), 1500);
  };

  if (packages.length === 0 || !activePkg) {
    return (
      <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-12">
        <div className="max-w-xl mx-auto text-center space-y-4">
          <h1 className="text-[28px] font-light tracking-[-0.025em] text-[var(--text)]">
            Campaign Packages
          </h1>
          <p className="text-sm text-[var(--text-muted)] leading-relaxed">
            Build finished, ready-to-launch marketing packages — strategy, phased action
            checklist, bilingual copy, `.ics` content calendar, and verified visual prompts —
            validated against Hedetangen&apos;s Honesty Rule.
          </p>
          <div className="pt-2">
            <button
              type="button"
              onClick={onNewPackage}
              className="min-h-[44px] inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-full bg-[var(--lime)] hover:bg-[var(--lime-hover)] text-[#181817] shadow-[var(--shadow)]"
            >
              <Plus className="w-4 h-4" />
              <span>Build First Campaign Package</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  const doneCount = activePkg.checklist.filter((c) => c.done).length;
  const totalCount = activePkg.checklist.length;
  const progressPct = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;

  return (
    <div className="flex-1 min-h-0 flex flex-col lg:flex-row">
      {/* Saved Packages List */}
      <aside className="lg:w-[290px] xl:w-[320px] shrink-0 border-b lg:border-b-0 lg:border-r border-[var(--border)] p-4 overflow-y-auto space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-xs font-semibold uppercase tracking-[0.06em] text-[var(--text-muted)]">
            Packages ({packages.length})
          </h2>
          <button
            type="button"
            onClick={onNewPackage}
            className="min-h-[36px] inline-flex items-center gap-1 px-3 py-1 text-xs font-semibold rounded-full bg-[var(--lime)] hover:bg-[var(--lime-hover)] text-[#181817]"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New</span>
          </button>
        </div>

        <div className="flex lg:flex-col gap-2 overflow-x-auto lg:overflow-x-visible pb-1 lg:pb-0">
          {packages.map((pkg) => {
            const isSelected = pkg.id === activePkg.id;
            const pkgDone = pkg.checklist.filter((c) => c.done).length;
            return (
              <button
                key={pkg.id}
                type="button"
                onClick={() => onSelectPackage(pkg.id)}
                className={`min-w-[220px] lg:min-w-0 w-full text-left p-3.5 rounded-[18px] border transition-colors ${
                  isSelected
                    ? 'glass-surface border-[var(--text)] shadow-[var(--shadow)]'
                    : 'bg-[var(--surface-muted)] border-[var(--border)] hover:border-[var(--border-strong)]'
                }`}
              >
                <div className="text-sm font-medium text-[var(--text)] truncate">{pkg.name}</div>
                <div className="mt-1 text-[11px] font-mono-tabular text-[var(--text-faint)]">
                  {pkg.intake.dateWindow} · {pkgDone}/{pkg.checklist.length} done
                </div>
              </button>
            );
          })}
        </div>
      </aside>

      {/* Active Package Workspace */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-8 py-6">
        <div className="max-w-[880px] mx-auto space-y-6">
          {/* Header + Unboxed Typographic Metadata */}
          <div className="space-y-3 pb-5 border-b border-[var(--border)]">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-1">
                <h1 className="text-2xl sm:text-[28px] font-light tracking-[-0.02em] text-[var(--text)]">
                  {activePkg.name}
                </h1>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-mono-tabular text-[var(--text-muted)]">
                  <span>{activePkg.intake.dateWindow}</span>
                  <span aria-hidden="true">·</span>
                  <span>{activePkg.intake.budgetCeiling}</span>
                  <span aria-hidden="true">·</span>
                  <span>{activePkg.intake.hoursPerWeek}</span>
                  <span aria-hidden="true">·</span>
                  <span>Updated {formatDateTime(activePkg.updatedAt)}</span>
                </div>
              </div>

              <div className="flex items-center gap-1.5 text-xs font-medium">
                {activePkg.lintSummary.passed ? (
                  <span className="inline-flex items-center gap-1.5 text-[var(--success)]">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Honesty Lint Passed</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-[var(--danger)]">
                    <AlertTriangle className="w-4 h-4" />
                    <span>
                      {activePkg.lintSummary.errorCount} Honesty Warning(s)
                    </span>
                  </span>
                )}
              </div>
            </div>

            {/* Delivery Actions */}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  const zip = buildCompletePackageZip(activePkg, businessProfile);
                  triggerBlobDownload(zip.filename, new Uint8Array(zip.bytes), 'application/zip');
                  onNotify(`Downloaded ${zip.filename}.`, 'success');
                }}
                className="min-h-[42px] inline-flex items-center gap-1.5 px-4 py-2 text-xs sm:text-sm font-semibold rounded-full bg-[var(--lime)] hover:bg-[var(--lime-hover)] text-[#181817] shadow-[var(--shadow)]"
              >
                <Archive className="w-4 h-4" />
                <span>Download Complete Package (.zip)</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  const md = buildPackageHandbookMarkdown(activePkg, businessProfile);
                  triggerBlobDownload(
                    `${activePkg.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'handbook'}.md`,
                    md,
                    'text/markdown;charset=utf-8'
                  );
                  onNotify('Downloaded campaign handbook (.md).', 'success');
                }}
                className="min-h-[42px] inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-full glass-surface border border-[var(--border)] text-[var(--text)] hover:border-[var(--border-strong)]"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Handbook (.md)</span>
              </button>

              {calItems.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    const ics = calendarToICS(calItems, activePkg.name);
                    triggerBlobDownload('hedetangen-campaign.ics', ics, 'text/calendar;charset=utf-8');
                    onNotify('Downloaded calendar (.ics).', 'success');
                  }}
                  className="min-h-[42px] inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-full glass-surface border border-[var(--border)] text-[var(--text)] hover:border-[var(--border-strong)]"
                >
                  <Calendar className="w-3.5 h-3.5" />
                  <span>Calendar (.ics)</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => onAskJenniferRevise(activePkg)}
                className="min-h-[42px] inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-full glass-surface border border-[var(--border)] text-[var(--text)] hover:border-[var(--border-strong)]"
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span>Ask Jennifer to Revise</span>
              </button>

              <button
                type="button"
                onClick={() => setDeleteTarget(activePkg)}
                aria-label="Delete campaign package"
                className="min-h-[42px] inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-full border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--danger)] hover:border-[var(--danger)]"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete</span>
              </button>
            </div>
          </div>

          {/* Strategy Summary */}
          <section className="p-5 rounded-[22px] glass-surface border border-[var(--border)] shadow-[var(--shadow)] space-y-4">
            <div className="space-y-1">
              <div className="text-xs font-semibold uppercase tracking-[0.06em] text-[var(--text-muted)]">
                Strategy
              </div>
              <h2 className="text-lg font-medium text-[var(--text)]">
                {activePkg.strategy.headline}
              </h2>
              <p className="text-sm text-[var(--text-muted)] leading-relaxed">
                {activePkg.strategy.positioning}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-[var(--border)]">
              <div className="space-y-2">
                <div className="text-xs font-semibold text-[var(--text-muted)]">
                  Ranked Channels
                </div>
                <ol className="space-y-1.5 text-sm">
                  {activePkg.strategy.rankedChannels.map((ch) => (
                    <li key={`${ch.priority}-${ch.channel}`} className="text-[var(--text)]">
                      <span className="font-mono-tabular font-semibold">{ch.priority}.</span>{' '}
                      <span className="font-medium">{ch.channel}</span> —{' '}
                      <span className="text-[var(--text-muted)] text-xs">{ch.rationale}</span>
                    </li>
                  ))}
                </ol>
              </div>

              <div className="space-y-2 text-xs text-[var(--text-muted)]">
                <div>
                  <span className="font-semibold text-[var(--text)] block mb-0.5">
                    Stop / Pause Spend Threshold
                  </span>
                  <span>{activePkg.strategy.stopSpendThreshold}</span>
                </div>
                {activePkg.strategy.risks.length > 0 && (
                  <div>
                    <span className="font-semibold text-[var(--text)] block mb-0.5">
                      Key Risks
                    </span>
                    <ul className="list-disc pl-4 space-y-0.5">
                      {activePkg.strategy.risks.map((r, i) => (
                        <li key={i}>{r}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* Phased Action Checklist */}
          <section className="p-5 rounded-[22px] glass-surface border border-[var(--border)] shadow-[var(--shadow)] space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.06em] text-[var(--text-muted)]">
                  Execution Checklist
                </div>
                <p className="text-xs font-mono-tabular text-[var(--text-muted)] mt-0.5">
                  {doneCount}/{totalCount} tasks completed ({progressPct}%)
                </p>
              </div>
              <div className="w-40 h-2 rounded-full bg-[var(--surface-muted)] overflow-hidden">
                <div
                  className="h-full bg-[var(--lime)] transition-all"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </div>

            <div className="space-y-4">
              {groupedChecklist.map(([phase, tasks]) => (
                <div key={phase} className="space-y-2">
                  <h3 className="text-xs font-semibold text-[var(--text)]">{phase}</h3>
                  <div className="space-y-1.5">
                    {tasks.map((task) => (
                      <label
                        key={task.id}
                        className="flex items-start gap-2.5 p-2.5 rounded-[14px] bg-[var(--surface-muted)] border border-[var(--border)] cursor-pointer select-none"
                      >
                        <input
                          type="checkbox"
                          checked={task.done}
                          onChange={() => onToggleChecklistTask(activePkg.id, task.id)}
                          className="mt-0.5 w-4 h-4 accent-[#181817] dark:accent-[#EBEE2C] shrink-0"
                        />
                        <span
                          className={`text-sm leading-snug ${
                            task.done ? 'line-through text-[var(--text-faint)]' : 'text-[var(--text)]'
                          }`}
                        >
                          {task.text}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Deliverables */}
          <section className="space-y-4">
            <div className="text-xs font-semibold uppercase tracking-[0.06em] text-[var(--text-muted)]">
              Deliverables ({activePkg.deliverables.length})
            </div>

            {activePkg.deliverables.map((d) => {
              const calRows =
                d.kind === 'calendar' &&
                d.structured &&
                typeof d.structured === 'object' &&
                Array.isArray((d.structured as { items?: unknown[] }).items)
                  ? ((d.structured as { items: Array<{ date: string; channel: string; item: string; notes: string; cta?: string }> }).items)
                  : null;

              return (
                <article
                  key={d.id}
                  className="p-5 rounded-[22px] glass-surface border border-[var(--border)] shadow-[var(--shadow)] space-y-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-[var(--border)]">
                    <div>
                      <h3 className="text-base font-medium text-[var(--text)]">{d.title}</h3>
                      <div className="text-[11px] font-mono-tabular text-[var(--text-muted)] mt-0.5">
                        {d.status === 'approved' ? 'Approved' : 'Draft'}
                        {d.repaired ? ' · Auto-repaired for compliance' : ''}
                        {d.lintIssues.length === 0
                          ? ' · Honesty Lint Passed'
                          : ` · ${d.lintIssues.length} lint issue(s)`}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => onToggleDeliverableApprove(activePkg.id, d.id)}
                        className={`min-h-[36px] inline-flex items-center gap-1 px-3 py-1 text-xs font-semibold rounded-full border transition-colors ${
                          d.status === 'approved'
                            ? 'bg-[var(--lime)] border-transparent text-[#181817]'
                            : 'border-[var(--border)] text-[var(--text)] hover:border-[var(--border-strong)]'
                        }`}
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>{d.status === 'approved' ? 'Approved' : 'Approve'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleCopy(d.id, d.markdown)}
                        className="min-h-[36px] inline-flex items-center gap-1 px-3 py-1 text-xs font-medium rounded-full border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text)]"
                      >
                        {copiedId === d.id ? (
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
                          onSaveDeliverableToLibrary(
                            activePkg,
                            d,
                            deliverableKindToLibraryType(d.kind)
                          )
                        }
                        className="min-h-[36px] inline-flex items-center gap-1 px-3 py-1 text-xs font-medium rounded-full border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text)]"
                      >
                        <Bookmark className="w-3.5 h-3.5" />
                        <span>Save to Library</span>
                      </button>
                    </div>
                  </div>

                  {d.lintIssues.length > 0 && (
                    <div className="p-3 rounded-[14px] bg-[var(--surface-muted)] border border-[var(--danger)] text-xs text-[var(--text)] space-y-1">
                      {d.lintIssues.map((issue, idx) => (
                        <div key={idx}>
                          <strong>{issue.code}:</strong> {issue.message}
                        </div>
                      ))}
                    </div>
                  )}

                  {calRows ? (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="border-b border-[var(--border)] text-[var(--text-muted)]">
                            <th className="py-2 pr-3 font-semibold">Date</th>
                            <th className="py-2 pr-3 font-semibold">Channel</th>
                            <th className="py-2 pr-3 font-semibold">Item</th>
                            <th className="py-2 font-semibold">Notes / CTA</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--border)]">
                          {calRows.map((row, idx) => (
                            <tr key={`${row.date}-${idx}`}>
                              <td className="py-2.5 pr-3 font-mono-tabular whitespace-nowrap text-[var(--text)]">
                                {row.date}
                              </td>
                              <td className="py-2.5 pr-3 whitespace-nowrap font-medium text-[var(--text)]">
                                {row.channel}
                              </td>
                              <td className="py-2.5 pr-3 text-[var(--text)]">{row.item}</td>
                              <td className="py-2.5 text-[var(--text-muted)]">
                                {row.notes}
                                {row.cta ? ` (${row.cta})` : ''}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <SafeMarkdown content={d.markdown} />
                  )}
                </article>
              );
            })}
          </section>
        </div>
      </div>

      <ConfirmModal
        open={Boolean(deleteTarget)}
        title="Delete this campaign package?"
        description="This removes the strategy, checklist, and deliverables from this browser."
        confirmLabel="Delete package"
        danger
        onConfirm={async () => {
          if (deleteTarget) {
            await onDeletePackage(deleteTarget.id);
          }
          setDeleteTarget(null);
        }}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
