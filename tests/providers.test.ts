import assert from 'node:assert/strict';
import test from 'node:test';
import { runOpenAICompatibleChat } from '../src/providers/base.ts';
import { AIError, mapHttpError } from '../src/providers/errors.ts';

interface CapturedRequest {
  url: string;
  body: Record<string, unknown> | null;
}

function stubJsonFetch(payload: unknown, captured: CapturedRequest[]): () => void {
  const original = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    captured.push({
      url: String(input),
      body: typeof init?.body === 'string' ? JSON.parse(init.body) : null,
    });
    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }) as typeof fetch;
  return () => {
    globalThis.fetch = original;
  };
}

const okPayload = {
  model: 'test-model',
  choices: [{ message: { content: 'hello' }, finish_reason: 'stop' }],
  usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
};

test('reasoning models get max_completion_tokens and no temperature', async () => {
  const captured: CapturedRequest[] = [];
  const restore = stubJsonFetch(okPayload, captured);
  try {
    await runOpenAICompatibleChat(
      'openai',
      'https://api.openai.com/v1',
      { Authorization: 'Bearer test' },
      {
        model: 'o3-mini',
        messages: [{ role: 'user', content: 'hi' }],
        temperature: 0.6,
        maxTokens: 256,
      }
    );
  } finally {
    restore();
  }

  const body = captured[0].body!;
  assert.equal(body.max_completion_tokens, 256);
  assert.equal('temperature' in body, false, 'o-series rejects a custom temperature');
  assert.equal('max_tokens' in body, false, 'o-series requires max_completion_tokens');
});

test('classic chat models keep temperature and max_tokens', async () => {
  const captured: CapturedRequest[] = [];
  const restore = stubJsonFetch(okPayload, captured);
  try {
    await runOpenAICompatibleChat(
      'openai',
      'https://api.openai.com/v1',
      { Authorization: 'Bearer test' },
      {
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: 'hi' }],
        temperature: 0.6,
        maxTokens: 256,
      }
    );
  } finally {
    restore();
  }

  const body = captured[0].body!;
  assert.equal(body.temperature, 0.6);
  assert.equal(body.max_tokens, 256);
  assert.equal('max_completion_tokens' in body, false);
});

test('Groq keeps classic parameters even for gpt-oss model ids', async () => {
  const captured: CapturedRequest[] = [];
  const restore = stubJsonFetch(okPayload, captured);
  try {
    await runOpenAICompatibleChat(
      'groq',
      'https://api.groq.com/openai/v1',
      { Authorization: 'Bearer test' },
      {
        model: 'openai/gpt-oss-120b',
        messages: [{ role: 'user', content: 'hi' }],
        temperature: 0.5,
        maxTokens: 512,
      }
    );
  } finally {
    restore();
  }

  const body = captured[0].body!;
  assert.equal(body.temperature, 0.5);
  assert.equal(body.max_tokens, 512);
});

test('string error codes in a 200 body map to the right taxonomy', async () => {
  const captured: CapturedRequest[] = [];
  const restore = stubJsonFetch(
    { error: { message: 'Rate limit reached for model', code: 'rate_limit_exceeded' } },
    captured
  );
  try {
    await assert.rejects(
      () =>
        runOpenAICompatibleChat(
          'groq',
          'https://api.groq.com/openai/v1',
          { Authorization: 'Bearer test' },
          { model: 'llama-3.3-70b-versatile', messages: [{ role: 'user', content: 'hi' }] }
        ),
      (err: unknown) => err instanceof AIError && err.code === 'RATE_LIMIT'
    );
  } finally {
    restore();
  }

  const contextError = mapHttpError(
    'groq',
    400,
    JSON.stringify({ error: { message: 'context_length_exceeded', code: 'context_length_exceeded' } })
  );
  assert.equal(contextError.code, 'CONTEXT_TOO_LONG');
});

test('Retry-After header is converted to milliseconds on rate limits', () => {
  const err = mapHttpError('groq', 429, '{}', '7');
  assert.equal(err.code, 'RATE_LIMIT');
  assert.equal(err.retryAfterMs, 7000);
});
