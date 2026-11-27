import assert from 'node:assert/strict';
import test from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { SafeMarkdown } from '../src/utils/markdown.tsx';

const render = (markdown: string) => renderToStaticMarkup(SafeMarkdown({ content: markdown }));

test('SafeMarkdown never emits raw HTML from model output', () => {
  const html = render('<script>alert(1)</script>\n\n<img src=x onerror="alert(1)">');
  assert.ok(!html.includes('<script'), 'script tags must be escaped');
  assert.ok(!html.includes('<img'), 'img tags must be escaped');
  assert.ok(html.includes('&lt;script&gt;'), 'raw markup should be shown as text');
});

test('SafeMarkdown blocks dangerous link protocols but keeps safe ones', () => {
  const js = render('[click me](javascript:alert(1))');
  assert.ok(!/href="javascript:/i.test(js), 'javascript: URLs must not become links');
  assert.ok(js.includes('click me'), 'the label stays visible as text');

  const data = render('[x](data:text/html;base64,PHNjcmlwdD4=)');
  assert.ok(!/href="data:/i.test(data), 'data: URLs must not become links');

  const safe = render('[Hedetangen](https://hedetangen.se)');
  assert.ok(safe.includes('href="https://hedetangen.se"'));
  assert.ok(safe.includes('rel="noopener noreferrer"'));
  assert.ok(safe.includes('target="_blank"'));
});

test('SafeMarkdown renders the formatting the prompts actually ask for', () => {
  const html = render(
    ['# Heading', '', '**Bold SV:** and *italic* with `code`', '', '- one', '- two', '', '| a | b |', '| --- | --- |', '| 1 | 2 |'].join(
      '\n'
    )
  );
  assert.ok(html.includes('<h3'), 'h1 maps to h3 to keep heading order');
  assert.ok(html.includes('<strong'));
  assert.ok(html.includes('<em'));
  assert.ok(html.includes('<code'));
  assert.ok(html.includes('<ul'));
  assert.ok(html.includes('<table'));
});
