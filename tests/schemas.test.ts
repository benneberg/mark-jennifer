import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import {
  CHAT_SCHEMA,
  EXPERT_SCHEMA,
  GUARDRAILS_SCHEMA,
  LIBRARY_ITEM_SCHEMA,
  MESSAGE_SCHEMA,
  SETTINGS_SCHEMA,
  type JsonSchemaNode,
  validateSchema,
} from '../src/utils/validate.ts';

const SCHEMA_DIR = path.resolve(import.meta.dirname, '..', 'schemas');

function readSchema(file: string): JsonSchemaNode {
  return JSON.parse(fs.readFileSync(path.join(SCHEMA_DIR, file), 'utf8')) as JsonSchemaNode;
}

const sortedKeys = (record: Record<string, unknown> | undefined) => Object.keys(record ?? {}).sort();
const sortedList = (list: string[] | undefined) => [...(list ?? [])].sort();

/**
 * The app validates with inline schemas (src/utils/validate.ts) while the repo
 * publishes JSON Schema files under schemas/. Nothing enforced that they stay in
 * sync, which is how `responseMode` went missing from settings.schema.json.
 */
test('published JSON schemas match the inline schemas the app actually uses', () => {
  const pairs: Array<[string, JsonSchemaNode]> = [
    ['expert.schema.json', EXPERT_SCHEMA],
    ['guardrails.schema.json', GUARDRAILS_SCHEMA],
    ['settings.schema.json', SETTINGS_SCHEMA],
    ['library-item.schema.json', LIBRARY_ITEM_SCHEMA],
    ['chat.schema.json', CHAT_SCHEMA],
    ['message.schema.json', MESSAGE_SCHEMA],
  ];

  for (const [file, inline] of pairs) {
    const published = readSchema(file);
    assert.deepEqual(
      sortedList(published.required),
      sortedList(inline.required),
      `${file}: required fields drifted`
    );
    assert.deepEqual(
      sortedKeys(published.properties as Record<string, unknown>),
      sortedKeys(inline.properties as Record<string, unknown>),
      `${file}: property list drifted`
    );
    assert.equal(
      published.additionalProperties,
      inline.additionalProperties,
      `${file}: additionalProperties drifted`
    );
  }
});

test('guardrails.editable schema stays in sync too', () => {
  const published = readSchema('guardrails.schema.json');
  const publishedEditable = (published.properties as Record<string, JsonSchemaNode>).editable;
  const inlineEditable = (GUARDRAILS_SCHEMA.properties as Record<string, JsonSchemaNode>).editable;
  assert.deepEqual(
    sortedKeys(publishedEditable.properties as Record<string, unknown>),
    sortedKeys(inlineEditable.properties as Record<string, unknown>)
  );
});

test('a settings object as the app exports it validates against the published schema', () => {
  const settings = {
    provider: 'groq',
    model: 'llama-3.3-70b-versatile',
    temperature: 0.7,
    language: 'auto',
    machinePrompt: '',
    theme: 'light',
    strictMode: true,
    debug: false,
    responseMode: 'team',
  };
  const res = validateSchema(settings, readSchema('settings.schema.json'));
  assert.equal(res.valid, true, JSON.stringify(res.errors));
});
