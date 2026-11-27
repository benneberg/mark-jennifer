import assert from 'node:assert/strict';
import test from 'node:test';
import {
  EXPERT_SCHEMA,
  GUARDRAILS_SCHEMA,
  type JsonSchemaNode,
  validateSchema,
} from '../src/utils/validate.ts';

test('schemas using unimplemented keywords fail loudly instead of silently passing', () => {
  const schemaWithAnyOf: JsonSchemaNode = {
    type: 'object',
    properties: { value: { anyOf: [{ type: 'string' }, { type: 'number' }] } as JsonSchemaNode },
  };
  const res = validateSchema({ value: 123 }, schemaWithAnyOf);
  assert.equal(res.valid, false, 'anyOf must not be silently ignored');
  assert.match(res.errors[0].message, /unsupported schema keyword/);

  const schemaWithRef: JsonSchemaNode = { $ref: 'other.schema.json' } as unknown as JsonSchemaNode;
  assert.equal(validateSchema({}, schemaWithRef).valid, false);
});

test('metadata keywords are allowed and do not affect validation', () => {
  const schema: JsonSchemaNode = {
    $schema: 'https://json-schema.org/draft-07/schema#',
    $id: 'https://hedetangen.app/schemas/x.json',
    title: 'X',
    type: 'object',
    required: ['a'],
    properties: { a: { type: 'string' } },
    additionalProperties: false,
  } as unknown as JsonSchemaNode;
  const res = validateSchema({ a: 'ok' }, schema);
  assert.equal(res.valid, true, JSON.stringify(res.errors));
});

test('strippedFields reports nested fields that relaxAdditionalProperties removed', () => {
  const value = {
    id: 'default',
    version: 1,
    honestyRule: 'x'.repeat(60),
    updatedAt: '2026-11-24T12:00:00.000Z',
    editable: { essence: 'ok', unknownNested: true },
    unknownTopLevel: 'nope',
  };

  const res = validateSchema(value, GUARDRAILS_SCHEMA, '$', { relaxAdditionalProperties: true });
  assert.equal(res.valid, true, JSON.stringify(res.errors));
  assert.deepEqual(
    [...res.strippedFields ?? []].sort(),
    ['$.editable.unknownNested', '$.unknownTopLevel'],
    'nested strips must be reported, not just top-level ones'
  );
  assert.equal('unknownNested' in (value.editable as Record<string, unknown>), false);
  assert.equal('unknownTopLevel' in value, false);
});

test('relaxed validation of experts keeps valid records and flags bad ones', () => {
  const good = {
    id: '11111111-1111-4111-8111-111111111111',
    name: 'Copywriter',
    role: 'Writes copy',
    systemPrompt: 'A'.repeat(30),
    enabled: true,
    tags: ['copy'],
    createdAt: '2026-11-24T12:00:00.000Z',
    updatedAt: '2026-11-24T12:00:00.000Z',
    legacyField: 'from an older export',
  };
  const relaxed = validateSchema(good, EXPERT_SCHEMA, '$', { relaxAdditionalProperties: true });
  assert.equal(relaxed.valid, true, JSON.stringify(relaxed.errors));
  assert.deepEqual(relaxed.strippedFields, ['$.legacyField']);

  // relaxed validation mutates the object it was given (it strips), so use a fresh copy
  const strict = validateSchema({ ...good, legacyField: 'from an older export' }, EXPERT_SCHEMA);
  assert.equal(strict.valid, false, 'strict mode must reject unknown properties');
});
