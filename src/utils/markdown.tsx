import React from 'react';

function isSafeUrl(raw: string): boolean {
  try {
    const parsed = new URL(raw.trim(), 'https://hedetangen.invalid');
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' || parsed.protocol === 'mailto:';
  } catch {
    return false;
  }
}

function renderInline(text: string, keyPrefix: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  // Matches `code`, **bold**, *italic*, and [label](url)
  const tokenRegex = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*\n]+\*|\[[^\]]+\]\([^)]+\))/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let idx = 0;

  while ((match = tokenRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }
    const token = match[0];
    const key = `${keyPrefix}-${idx++}`;

    if (token.startsWith('`') && token.endsWith('`')) {
      nodes.push(
        <code
          key={key}
          className="font-mono-tabular text-[0.85em] px-1.5 py-0.5 rounded-md bg-[var(--surface-muted)] text-[var(--text)]"
        >
          {token.slice(1, -1)}
        </code>
      );
    } else if (token.startsWith('**') && token.endsWith('**')) {
      nodes.push(
        <strong key={key} className="font-semibold text-[var(--text)]">
          {renderInline(token.slice(2, -2), `${key}-b`)}
        </strong>
      );
    } else if (token.startsWith('*') && token.endsWith('*')) {
      nodes.push(
        <em key={key} className="italic">
          {renderInline(token.slice(1, -1), `${key}-i`)}
        </em>
      );
    } else if (token.startsWith('[')) {
      const linkMatch = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(token);
      if (linkMatch && isSafeUrl(linkMatch[2])) {
        nodes.push(
          <a
            key={key}
            href={linkMatch[2].trim()}
            target="_blank"
            rel="noopener noreferrer"
            className="underline decoration-[var(--tangerine)] underline-offset-2 text-[var(--text)] hover:text-[var(--tangerine)] transition-colors"
          >
            {linkMatch[1]}
          </a>
        );
      } else {
        nodes.push(token);
      }
    }

    lastIndex = match.index + token.length;
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }

  return nodes;
}

export function SafeMarkdown({ content }: { content: string }) {
  const lines = content.replace(/\r\n/g, '\n').split('\n');
  const elements: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Fenced code block
    if (line.trimStart().startsWith('```')) {
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trimStart().startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // consume closing fence
      elements.push(
        <pre
          key={`code-${i}`}
          className="my-3 p-3 rounded-lg bg-[var(--surface-muted)] border border-[var(--border)] overflow-x-auto text-xs font-mono-tabular leading-relaxed text-[var(--text)]"
        >
          <code>{codeLines.join('\n')}</code>
        </pre>
      );
      continue;
    }

    // Blank line
    if (!line.trim()) {
      i++;
      continue;
    }

    // Headings (render as h3/h4 to preserve page heading hierarchy)
    const headingMatch = /^(#{1,4})\s+(.+)$/.exec(line);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const text = headingMatch[2];
      if (level <= 2) {
        elements.push(
          <h3 key={`h-${i}`} className="mt-4 mb-1.5 text-base font-semibold text-[var(--text)]">
            {renderInline(text, `h-${i}`)}
          </h3>
        );
      } else {
        elements.push(
          <h4 key={`h-${i}`} className="mt-3 mb-1 text-sm font-semibold text-[var(--text)]">
            {renderInline(text, `h-${i}`)}
          </h4>
        );
      }
      i++;
      continue;
    }

    // Horizontal rule
    if (/^---+$/.test(line.trim())) {
      elements.push(<hr key={`hr-${i}`} className="my-3 border-t border-[var(--border)]" />);
      i++;
      continue;
    }

    // Blockquote
    if (line.startsWith('> ')) {
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i].startsWith('> ')) {
        quoteLines.push(lines[i].slice(2));
        i++;
      }
      elements.push(
        <blockquote
          key={`bq-${i}`}
          className="my-2.5 px-3 py-2 rounded-lg bg-[var(--surface-muted)] border border-[var(--border)] text-sm text-[var(--text-muted)]"
        >
          {quoteLines.map((ql, idx) => (
            <p key={idx} className={idx > 0 ? 'mt-1' : ''}>
              {renderInline(ql, `bq-${i}-${idx}`)}
            </p>
          ))}
        </blockquote>
      );
      continue;
    }

    // Unordered list
    if (/^\s*[-*•]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*•]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*[-*•]\s+/, ''));
        i++;
      }
      elements.push(
        <ul key={`ul-${i}`} className="my-2 pl-5 list-disc space-y-1 text-[var(--text)]">
          {items.map((item, idx) => (
            <li key={idx} className="leading-relaxed">
              {renderInline(item, `ul-${i}-${idx}`)}
            </li>
          ))}
        </ul>
      );
      continue;
    }

    // Ordered list
    if (/^\s*\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*\d+\.\s+/, ''));
        i++;
      }
      elements.push(
        <ol key={`ol-${i}`} className="my-2 pl-5 list-decimal space-y-1 text-[var(--text)]">
          {items.map((item, idx) => (
            <li key={idx} className="leading-relaxed">
              {renderInline(item, `ol-${i}-${idx}`)}
            </li>
          ))}
        </ol>
      );
      continue;
    }

    // Markdown table (pipe separated)
    if (line.includes('|') && i + 1 < lines.length && /^\s*\|?[\s:-]+\|/.test(lines[i + 1])) {
      const parseRow = (row: string) =>
        row
          .replace(/^\|/, '')
          .replace(/\|$/, '')
          .split('|')
          .map((c) => c.trim());
      const headers = parseRow(line);
      i += 2; // skip header + separator
      const rows: string[][] = [];
      while (i < lines.length && lines[i].includes('|') && lines[i].trim() !== '') {
        rows.push(parseRow(lines[i]));
        i++;
      }
      elements.push(
        <div key={`tbl-${i}`} className="my-3 overflow-x-auto rounded-lg border border-[var(--border)]">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-[var(--surface-muted)] text-[var(--text)]">
              <tr>
                {headers.map((h, idx) => (
                  <th key={idx} className="px-3 py-2 font-semibold border-b border-[var(--border)]">
                    {renderInline(h, `th-${i}-${idx}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, rIdx) => (
                <tr key={rIdx} className="border-b last:border-b-0 border-[var(--border)]">
                  {headers.map((_, cIdx) => (
                    <td key={cIdx} className="px-3 py-2 align-top text-[var(--text)]">
                      {renderInline(row[cIdx] ?? '', `td-${i}-${rIdx}-${cIdx}`)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      continue;
    }

    // Paragraph (collect consecutive plain lines)
    const paraLines: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() !== '' &&
      !lines[i].trimStart().startsWith('```') &&
      !/^(#{1,4})\s+/.test(lines[i]) &&
      !lines[i].startsWith('> ') &&
      !/^\s*[-*•]\s+/.test(lines[i]) &&
      !/^\s*\d+\.\s+/.test(lines[i]) &&
      !/^---+$/.test(lines[i].trim())
    ) {
      paraLines.push(lines[i]);
      i++;
    }
    elements.push(
      <p key={`p-${i}`} className="my-2 first:mt-0 last:mb-0 leading-relaxed">
        {paraLines.map((pl, idx) => (
          <React.Fragment key={idx}>
            {idx > 0 && <br />}
            {renderInline(pl, `p-${i}-${idx}`)}
          </React.Fragment>
        ))}
      </p>
    );
  }

  return <div className="space-y-1 text-[0.95rem] break-words">{elements}</div>;
}
