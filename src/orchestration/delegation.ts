import { MAX_DELEGATES_PER_TURN } from '../constants';
import type { SessionFacts } from '../types';

export interface DelegationDirective {
  expert: string;
  task: string;
  context: string;
  constraints: string;
}

export interface ParsedPlan {
  response: string;
  delegates: DelegationDirective[];
  facts?: Partial<SessionFacts>;
  truncatedCount: number;
  parseWarn: boolean;
}

function stripXmlFences(raw: string): string {
  let text = raw.trim();
  if (text.startsWith('```xml')) {
    text = text.slice(6);
  } else if (text.startsWith('```')) {
    text = text.slice(3);
  }
  if (text.endsWith('```')) {
    text = text.slice(0, -3);
  }
  return text.trim();
}

function escapeXmlTextNode(text: string): string {
  return text
    .replace(/&(?!(?:amp|lt|gt|quot|apos|#\d+|#x[0-9a-fA-F]+);)/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

const PROTOCOL_TAGS = new Set([
  'response',
  'delegate',
  'task',
  'context',
  'constraints',
  'facts',
  'audience',
  'budget',
  'awards',
  'channels',
  'focus',
  'notes',
]);

/**
 * Escapes bare &, <, and > inside text segments between known protocol tags
 * so expressions like "budget < 3000 kr" never break XML parsing.
 */
function sanitizeProtocolXml(xml: string): string {
  const tagRegex = /<\/?([a-zA-Z_][\w-]*)(\s+expert="[^"]*")?\s*>/g;
  let result = '';
  let lastIdx = 0;
  let match: RegExpExecArray | null;

  while ((match = tagRegex.exec(xml)) !== null) {
    const tagName = match[1].toLowerCase();
    const rawBetween = xml.slice(lastIdx, match.index);
    result += escapeXmlTextNode(rawBetween);

    if (PROTOCOL_TAGS.has(tagName)) {
      const fullTag = match[0];
      if (match[2]) {
        const attrEscaped = match[2].replace(
          /&(?!(?:amp|lt|gt|quot|apos|#\d+|#x[0-9a-fA-F]+);)/g,
          '&amp;'
        );
        result += fullTag.replace(match[2], attrEscaped);
      } else {
        result += fullTag;
      }
    } else {
      result += escapeXmlTextNode(match[0]);
    }
    lastIdx = match.index + match[0].length;
  }

  result += escapeXmlTextNode(xml.slice(lastIdx));
  return result;
}

function tryParseXml(xmlText: string): Document | null {
  if (typeof DOMParser === 'undefined') return null;
  const parser = new DOMParser();
  const doc = parser.parseFromString(`<root>${xmlText}</root>`, 'text/xml');
  if (doc.querySelector('parsererror')) {
    return null;
  }
  return doc;
}

function splitListText(raw: string | null | undefined): string[] | undefined {
  const clean = raw?.trim();
  if (!clean) return undefined;
  const items = clean
    .split(/\s*[;\n]\s*/)
    .map((s) => s.replace(/^[-*•]\s*/, '').trim())
    .filter(Boolean);
  return items.length > 0 ? items : undefined;
}

function extractFactsFromDoc(doc: Document): Partial<SessionFacts> | undefined {
  const factsEl = doc.querySelector('facts');
  if (!factsEl) return undefined;

  const patch: Partial<SessionFacts> = {};
  const constraints = splitListText(factsEl.querySelector('constraints')?.textContent);
  const audience = splitListText(factsEl.querySelector('audience')?.textContent);
  const budget = factsEl.querySelector('budget')?.textContent?.trim();
  const awards = splitListText(factsEl.querySelector('awards')?.textContent);
  const channels = splitListText(factsEl.querySelector('channels')?.textContent);
  const focus = factsEl.querySelector('focus')?.textContent?.trim();
  const notes = splitListText(factsEl.querySelector('notes')?.textContent);

  if (constraints) patch.constraints = constraints;
  if (audience) patch.audience = audience;
  if (budget) patch.budget = budget;
  if (awards) patch.awards = awards;
  if (channels) patch.channels = channels;
  if (focus) patch.focus = focus;
  if (notes) patch.notes = notes;

  return Object.keys(patch).length > 0 ? patch : undefined;
}

function stripRawControlBlocks(raw: string): string {
  const responseMatch = raw.match(/<response>([\s\S]*?)<\/response>/i);
  if (responseMatch?.[1]?.trim()) {
    return responseMatch[1].trim();
  }
  return raw
    .replace(/<delegate\b[\s\S]*?<\/delegate>/gi, '')
    .replace(/<facts\b[\s\S]*?<\/facts>/gi, '')
    .replace(/<\/?response>/gi, '')
    .trim();
}

function unescapeXmlEntities(text: string): string {
  return text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

function extractFactsFromString(raw: string): Partial<SessionFacts> | undefined {
  const factsMatch = raw.match(/<facts>([\s\S]*?)<\/facts>/i);
  if (!factsMatch) return undefined;
  const inner = factsMatch[1];
  const patch: Partial<SessionFacts> = {};

  const constraints = splitListText(
    unescapeXmlEntities(inner.match(/<constraints>([\s\S]*?)<\/constraints>/i)?.[1] ?? '')
  );
  const audience = splitListText(
    unescapeXmlEntities(inner.match(/<audience>([\s\S]*?)<\/audience>/i)?.[1] ?? '')
  );
  const budget = unescapeXmlEntities(inner.match(/<budget>([\s\S]*?)<\/budget>/i)?.[1] ?? '').trim();
  const awards = splitListText(
    unescapeXmlEntities(inner.match(/<awards>([\s\S]*?)<\/awards>/i)?.[1] ?? '')
  );
  const channels = splitListText(
    unescapeXmlEntities(inner.match(/<channels>([\s\S]*?)<\/channels>/i)?.[1] ?? '')
  );
  const focus = unescapeXmlEntities(inner.match(/<focus>([\s\S]*?)<\/focus>/i)?.[1] ?? '').trim();
  const notes = splitListText(
    unescapeXmlEntities(inner.match(/<notes>([\s\S]*?)<\/notes>/i)?.[1] ?? '')
  );

  if (constraints) patch.constraints = constraints;
  if (audience) patch.audience = audience;
  if (budget) patch.budget = budget;
  if (awards) patch.awards = awards;
  if (channels) patch.channels = channels;
  if (focus) patch.focus = focus;
  if (notes) patch.notes = notes;

  return Object.keys(patch).length > 0 ? patch : undefined;
}

function regexFallbackParse(trimmed: string): ParsedPlan | null {
  const respMatch = trimmed.match(/<response>([\s\S]*?)<\/response>/i);
  const delRegex = /<delegate\s+expert="([^"]+)">([\s\S]*?)<\/delegate>/gi;
  const allDelegates: DelegationDirective[] = [];
  let dm: RegExpExecArray | null;

  while ((dm = delRegex.exec(trimmed)) !== null) {
    const expert = unescapeXmlEntities(dm[1]).trim();
    const inner = dm[2];
    const task = unescapeXmlEntities(inner.match(/<task>([\s\S]*?)<\/task>/i)?.[1] ?? '').trim();
    const context = unescapeXmlEntities(inner.match(/<context>([\s\S]*?)<\/context>/i)?.[1] ?? '').trim();
    const constraints = unescapeXmlEntities(
      inner.match(/<constraints>([\s\S]*?)<\/constraints>/i)?.[1] ?? ''
    ).trim();
    if (expert && task) {
      allDelegates.push({ expert, task, context, constraints });
    }
  }

  const response = respMatch?.[1] ? unescapeXmlEntities(respMatch[1]).trim() : '';
  const facts = extractFactsFromString(trimmed);
  if (!response && allDelegates.length === 0) return null;

  const delegates = allDelegates.slice(0, MAX_DELEGATES_PER_TURN);
  const truncatedCount = Math.max(0, allDelegates.length - delegates.length);

  return {
    response,
    delegates,
    facts,
    truncatedCount,
    parseWarn: false,
  };
}

export function parseDelegation(rawOutput: string): ParsedPlan {
  const trimmed = stripXmlFences(rawOutput);
  if (!trimmed) {
    return { response: '', delegates: [], truncatedCount: 0, parseWarn: true };
  }

  if (!trimmed.includes('<response>') && !trimmed.includes('<delegate')) {
    return {
      response: stripRawControlBlocks(trimmed) || trimmed,
      delegates: [],
      truncatedCount: 0,
      parseWarn: true,
    };
  }

  const sanitized = sanitizeProtocolXml(trimmed);
  let doc = tryParseXml(sanitized);
  if (!doc) {
    doc = tryParseXml(trimmed);
  }

  if (!doc) {
    // Handles both Node environments without DOMParser and severely broken XML
    const regexResult = regexFallbackParse(trimmed);
    if (regexResult) {
      return regexResult;
    }
    return {
      response: stripRawControlBlocks(trimmed) || 'Here is my update.',
      delegates: [],
      truncatedCount: 0,
      parseWarn: true,
    };
  }

  const responseEl = doc.querySelector('root > response') ?? doc.querySelector('response');
  const response = responseEl?.textContent?.trim() ?? '';

  const delegateEls = Array.from(doc.querySelectorAll('delegate'));
  const allDelegates: DelegationDirective[] = [];

  for (const el of delegateEls) {
    const expert = el.getAttribute('expert')?.trim() ?? '';
    const task = el.querySelector('task')?.textContent?.trim() ?? '';
    const context = el.querySelector('context')?.textContent?.trim() ?? '';
    const constraints = el.querySelector('constraints')?.textContent?.trim() ?? '';
    if (expert && task) {
      allDelegates.push({ expert, task, context, constraints });
    }
  }

  const delegates = allDelegates.slice(0, MAX_DELEGATES_PER_TURN);
  const truncatedCount = Math.max(0, allDelegates.length - delegates.length);
  const facts = extractFactsFromDoc(doc);

  if (!response && delegates.length === 0) {
    return {
      response: stripRawControlBlocks(trimmed) || 'Here is my update.',
      delegates: [],
      facts,
      truncatedCount: 0,
      parseWarn: true,
    };
  }

  return {
    response,
    delegates,
    facts,
    truncatedCount,
    parseWarn: false,
  };
}
