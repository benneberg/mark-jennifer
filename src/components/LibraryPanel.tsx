import { useMemo, useState } from 'react';
import { Check, Copy, Download, Trash2 } from 'lucide-react';
import type { LibraryItem, LibraryItemType } from '../types';
import { formatShortDate, todaySlug } from '../utils/dates';

interface LibraryPanelProps {
  items: LibraryItem[];
  onDeleteItem: (id: string) => Promise<void>;
  onBulkDelete: (ids: string[]) => Promise<void>;
  onCopy: (text: string) => void;
  onNotify: (msg: string, variant?: 'info' | 'success' | 'danger') => void;
}

const TYPE_FILTERS: Array<{ id: 'all' | LibraryItemType; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'copy', label: 'Copy' },
  { id: 'campaign', label: 'Campaign' },
  { id: 'research', label: 'Research' },
  { id: 'visual-brief', label: 'Visual brief' },
  { id: 'note', label: 'Note' },
];

export function LibraryPanel({
  items,
  onDeleteItem,
  onBulkDelete,
  onCopy,
  onNotify,
}: LibraryPanelProps) {
  const [typeFilter, setTypeFilter] = useState<'all' | LibraryItemType>('all');
  const [tagFilter, setTagFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const allTags = useMemo(() => {
    const set = new Set<string>();
    items.forEach((it) => it.tags.forEach((t) => set.add(t)));
    return Array.from(set).sort();
  }, [items]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((item) => {
      if (typeFilter !== 'all' && item.type !== typeFilter) return false;
      if (tagFilter !== 'all' && !item.tags.includes(tagFilter)) return false;
      if (q) {
        const hay = `${item.title}\n${item.content}\n${item.tags.join(' ')}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [items, typeFilter, tagFilter, search]);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const downloadFile = (filename: string, content: string, mime: string) => {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportItems = (targetItems: LibraryItem[], format: 'json' | 'md') => {
    if (targetItems.length === 0) return;
    if (format === 'json') {
      downloadFile(
        `hedetangen-library-${todaySlug()}.json`,
        JSON.stringify(targetItems, null, 2),
        'application/json'
      );
    } else {
      const md = targetItems
        .map(
          (it) =>
            `# ${it.title}\n\n- Type: ${it.type}\n- Tags: ${it.tags.join(', ') || 'none'}\n- Saved: ${it.createdAt}\n\n${it.content}\n\n---\n`
        )
        .join('\n');
      downloadFile(`hedetangen-library-${todaySlug()}.md`, md, 'text/markdown');
    }
    onNotify(`Exported ${targetItems.length} item(s).`, 'success');
  };

  return (
    <div className="space-y-4 pb-8">
      <div className="space-y-2.5">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search saved copy, briefs, tags…"
          className="w-full min-h-[42px] px-3 py-2 text-sm rounded-lg bg-[var(--bg)] border border-[var(--border)] text-[var(--text)]"
        />

        <div className="flex flex-wrap gap-1 p-1 rounded-lg bg-[var(--surface-muted)]">
          {TYPE_FILTERS.map((tf) => (
            <button
              key={tf.id}
              type="button"
              onClick={() => setTypeFilter(tf.id)}
              className={`min-h-[36px] px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                typeFilter === tf.id
                  ? 'bg-[var(--surface)] text-[var(--text)] border border-[var(--border)]'
                  : 'text-[var(--text-muted)] hover:text-[var(--text)]'
              }`}
            >
              {tf.label}
            </button>
          ))}
        </div>

        <div className="flex items-center justify-between gap-2">
          {allTags.length > 0 ? (
            <select
              value={tagFilter}
              onChange={(e) => setTagFilter(e.target.value)}
              aria-label="Filter by tag"
              className="min-h-[38px] px-2.5 py-1 text-xs rounded-lg bg-[var(--bg)] border border-[var(--border)] text-[var(--text)]"
            >
              <option value="all">All tags</option>
              {allTags.map((t) => (
                <option key={t} value={t}>
                  #{t}
                </option>
              ))}
            </select>
          ) : (
            <span />
          )}

          {items.length > 0 && (
            <button
              type="button"
              onClick={() => {
                setSelectMode((s) => !s);
                setSelectedIds([]);
              }}
              className="min-h-[38px] px-3 py-1 text-xs font-medium rounded-lg border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text)]"
            >
              {selectMode ? 'Done selecting' : 'Select'}
            </button>
          )}
        </div>
      </div>

      {selectMode && selectedIds.length > 0 && (
        <div className="p-2.5 rounded-lg bg-[var(--surface-muted)] border border-[var(--border)] flex flex-wrap items-center justify-between gap-2 text-xs">
          <span className="font-medium text-[var(--text)]">{selectedIds.length} selected</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() =>
                exportItems(
                  items.filter((i) => selectedIds.includes(i.id)),
                  'json'
                )
              }
              className="px-2.5 py-1.5 rounded-md border border-[var(--border)] bg-[var(--surface)] text-[var(--text)]"
            >
              Export JSON
            </button>
            <button
              type="button"
              onClick={() =>
                exportItems(
                  items.filter((i) => selectedIds.includes(i.id)),
                  'md'
                )
              }
              className="px-2.5 py-1.5 rounded-md border border-[var(--border)] bg-[var(--surface)] text-[var(--text)]"
            >
              Export MD
            </button>
            <button
              type="button"
              onClick={async () => {
                await onBulkDelete(selectedIds);
                setSelectedIds([]);
                setSelectMode(false);
              }}
              className="px-2.5 py-1.5 rounded-md bg-[var(--danger)] text-white"
            >
              Delete
            </button>
          </div>
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="p-6 rounded-xl bg-[var(--bg)] border border-[var(--border)] text-center text-sm text-[var(--text-muted)]">
          {items.length === 0
            ? "Nothing saved yet. Tap 'Save to library' under any reply from Jennifer."
            : 'No saved items match your current filter.'}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((item) => {
            const isSelected = selectedIds.includes(item.id);
            return (
              <div
                key={item.id}
                className="p-3.5 rounded-xl bg-[var(--bg)] border border-[var(--border)] space-y-2"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2.5 min-w-0">
                    {selectMode && (
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelect(item.id)}
                        aria-label={`Select ${item.title}`}
                        className="mt-1 w-4 h-4 accent-[var(--accent)]"
                      />
                    )}
                    <div className="min-w-0">
                      <h4 className="text-sm font-semibold text-[var(--text)] leading-snug">
                        {item.title}
                      </h4>
                      <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                        <span className="capitalize">{item.type}</span>
                        {item.tags.length > 0 && (
                          <>
                            <span aria-hidden="true"> · </span>
                            <span>{item.tags.join(', ')}</span>
                          </>
                        )}
                        <span aria-hidden="true"> · </span>
                        <span className="font-mono-tabular">{formatShortDate(item.createdAt)}</span>
                      </p>
                    </div>
                  </div>
                </div>

                <p className="text-xs text-[var(--text-muted)] line-clamp-3 whitespace-pre-wrap leading-relaxed">
                  {item.content}
                </p>

                <div className="flex items-center gap-1 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      onCopy(item.content);
                      setCopiedId(item.id);
                      window.setTimeout(() => setCopiedId((c) => (c === item.id ? null : c)), 1500);
                    }}
                    className="min-h-[36px] inline-flex items-center gap-1 px-2.5 py-1 text-xs text-[var(--text-muted)] hover:text-[var(--text)] rounded-md hover:bg-[var(--surface-muted)]"
                  >
                    {copiedId === item.id ? (
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
                    onClick={() => exportItems([item], 'md')}
                    className="min-h-[36px] inline-flex items-center gap-1 px-2.5 py-1 text-xs text-[var(--text-muted)] hover:text-[var(--text)] rounded-md hover:bg-[var(--surface-muted)]"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Export</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onDeleteItem(item.id)}
                    aria-label={`Delete ${item.title}`}
                    className="min-h-[36px] inline-flex items-center gap-1 px-2.5 py-1 text-xs text-[var(--text-muted)] hover:text-[var(--danger)] rounded-md hover:bg-[var(--danger-soft)] ml-auto"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
