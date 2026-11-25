export interface DelegationDirective {
  expert: string;
  task: string;
  context: string;
  constraints: string;
}

export interface ParsedPlan {
  response: string;
  delegates: DelegationDirective[];
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

function escapeBareAmpersands(xml: string): string {
  return xml.replace(/&(?!(?:amp|lt|gt|quot|apos|#\d+|#x[0-9a-fA-F]+);)/g, '&amp;');
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

export function parseDelegation(rawOutput: string): ParsedPlan {
  const trimmed = stripXmlFences(rawOutput);
  if (!trimmed) {
    return { response: '', delegates: [], parseWarn: true };
  }

  if (!trimmed.includes('<response>') && !trimmed.includes('<delegate')) {
    return {
      response: trimmed,
      delegates: [],
      parseWarn: true,
    };
  }

  let doc = tryParseXml(trimmed);
  if (!doc) {
    doc = tryParseXml(escapeBareAmpersands(trimmed));
  }

  if (!doc) {
    return {
      response: trimmed,
      delegates: [],
      parseWarn: true,
    };
  }

  const responseEl = doc.querySelector('root > response') ?? doc.querySelector('response');
  const response = responseEl?.textContent?.trim() ?? '';

  const delegateEls = Array.from(doc.querySelectorAll('delegate'));
  const delegates: DelegationDirective[] = [];

  for (const el of delegateEls) {
    const expert = el.getAttribute('expert')?.trim() ?? '';
    const task = el.querySelector('task')?.textContent?.trim() ?? '';
    const context = el.querySelector('context')?.textContent?.trim() ?? '';
    const constraints = el.querySelector('constraints')?.textContent?.trim() ?? '';
    if (expert && task) {
      delegates.push({ expert, task, context, constraints });
    }
  }

  if (!response && delegates.length === 0) {
    return {
      response: trimmed,
      delegates: [],
      parseWarn: true,
    };
  }

  return {
    response,
    delegates,
    parseWarn: false,
  };
}
