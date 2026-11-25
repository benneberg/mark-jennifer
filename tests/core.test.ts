import assert from 'node:assert/strict';
import test from 'node:test';
import { createSeedExperts } from '../src/data/seed-experts.ts';
import { createSeedGuardrails } from '../src/data/seed-guardrails.ts';
import { parseDelegation } from '../src/orchestration/delegation.ts';
import { AIError, humanizeAIError } from '../src/providers/errors.ts';
import { EXPERT_SCHEMA, GUARDRAILS_SCHEMA, validateSchema } from '../src/utils/validate.ts';

test('seed experts and guardrails validate against schemas', () => {
  const experts = createSeedExperts();
  assert.equal(experts.length, 6);
  for (const exp of experts) {
    const res = validateSchema(exp, EXPERT_SCHEMA);
    assert.equal(res.valid, true, `Expert ${exp.name} failed validation: ${JSON.stringify(res.errors)}`);
  }

  const guardrails = createSeedGuardrails();
  const gRes = validateSchema(guardrails, GUARDRAILS_SCHEMA);
  assert.equal(gRes.valid, true, `Guardrails failed validation: ${JSON.stringify(gRes.errors)}`);
});

test('validateSchema catches missing required fields and invalid values', () => {
  const res = validateSchema({ name: '' }, EXPERT_SCHEMA);
  assert.equal(res.valid, false);
  assert.ok(res.errors.length > 0);
});

test('parseDelegation handles prose fallback gracefully', () => {
  const plan = parseDelegation('Hej! Just a direct prose reply without tags.');
  assert.equal(plan.parseWarn, true);
  assert.equal(plan.delegates.length, 0);
  assert.ok(plan.response.includes('direct prose reply'));
});

test('humanizeAIError maps RATE_LIMIT with alternative model action', () => {
  const err = new AIError({
    code: 'RATE_LIMIT',
    message: 'Too many requests',
    provider: 'groq',
    status: 429,
    retryAfterMs: 12000,
  });
  const h = humanizeAIError(err, {
    modelId: 'llama-3.3-70b-versatile',
    altModelId: 'llama-3.1-8b-instant',
  });
  assert.ok(h.message.includes('rate-limited'));
  assert.ok(h.actions.some((a) => a.type === 'try_alt_model' && a.altModelId === 'llama-3.1-8b-instant'));
});
