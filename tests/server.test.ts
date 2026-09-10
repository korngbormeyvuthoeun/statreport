import test from 'node:test';
import assert from 'node:assert/strict';
import { z } from 'zod';
import {
  OpenAIProvider,
  ServiceError,
  mapProviderError,
} from '../lib/server/provider';
import { getConfig, publicConfig } from '../lib/server/config';
import { readBody, errorResponse } from '../lib/server/http';
import { demoReport } from '../lib/demo';
import { ReportSchema } from '../lib/domain';
const config = {
  ...getConfig({}),
  apiKey: 'test-placeholder-key',
  timeoutMs: 30,
};
const mock = (body: unknown, status = 200) =>
  (async () =>
    new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    })) as typeof fetch;
test('missing credentials expose setup status, never secret values', async () => {
  assert.equal(publicConfig({}).configured, false);
  assert.equal(
    publicConfig({ OPENAI_API_KEY: 'private-key' }).configured,
    false,
  );
  assert.equal(
    publicConfig({
      OPENAI_API_KEY: 'private-key',
      STATREPORT_SIGNING_SECRET: 'a'.repeat(32),
    }).configured,
    true,
  );
  assert.ok(
    !JSON.stringify(publicConfig({ OPENAI_API_KEY: 'private-key' })).includes(
      'private-key',
    ),
  );
  await assert.rejects(
    () =>
      new OpenAIProvider(getConfig({})).generate(
        'test',
        z.object({ value: z.string() }),
        'test',
        {},
      ),
    /OPENAI_API_KEY/,
  );
});
test('Responses request uses server Authorization, store:false, and strict structured output', async () => {
  let request: Record<string, unknown> | undefined;
  let headers: HeadersInit | undefined;
  const provider = new OpenAIProvider(config, (async (url, init) => {
    assert.equal(url, 'https://api.openai.com/v1/responses');
    assert.equal(typeof init?.body, 'string');
    request = JSON.parse(init!.body as string);
    headers = init?.headers;
    return new Response(
      JSON.stringify({
        status: 'completed',
        output: [
          {
            type: 'message',
            content: [
              { type: 'output_text', text: JSON.stringify(demoReport) },
            ],
          },
        ],
      }),
    );
  }) as typeof fetch);
  await provider.generate('report', ReportSchema, 'fixed instructions', {
    answer: 'student content',
  });
  assert.equal(request?.store, false);
  assert.equal(
    (request!.text as { format: { strict: boolean } }).format.strict,
    true,
  );
  assert.equal(
    new Headers(headers).get('Authorization'),
    'Bearer test-placeholder-key',
  );
});
for (const [status, code] of [
  [429, 'RATE_LIMIT'],
  [401, 'PROVIDER_AUTH'],
  [403, 'PROVIDER_AUTH'],
  [404, 'MODEL_UNAVAILABLE'],
  [500, 'PROVIDER_UNAVAILABLE'],
] as const)
  test(`provider HTTP ${status} has an actionable error`, async () => {
    const p = new OpenAIProvider(config, mock({}, status));
    await assert.rejects(
      () => p.generate('test', z.object({ ok: z.boolean() }), '', {}),
      (e: unknown) => e instanceof ServiceError && e.code === code,
    );
    assert.equal(mapProviderError(status).code, code);
  });
test('incomplete, refused, empty, malformed, and structurally invalid responses never become reports', async () => {
  for (const body of [
    { status: 'incomplete' },
    {
      status: 'completed',
      output: [{ type: 'message', content: [{ type: 'refusal' }] }],
    },
    { status: 'completed', output: [] },
    {
      status: 'completed',
      output: [
        {
          type: 'message',
          content: [{ type: 'output_text', text: 'bad json' }],
        },
      ],
    },
    {
      status: 'completed',
      output: [
        { type: 'message', content: [{ type: 'output_text', text: '{}' }] },
      ],
    },
  ])
    await assert.rejects(() =>
      new OpenAIProvider(config, mock(body)).generate(
        'report',
        ReportSchema,
        '',
        {},
      ),
    );
});
test('provider timeout is bounded and recoverable', async () => {
  const fetcher = ((_url: unknown, init: RequestInit) =>
    new Promise((_resolve, reject) => {
      init.signal?.addEventListener(
        'abort',
        () => reject(new Error('aborted')),
        { once: true },
      );
    })) as typeof fetch;
  await assert.rejects(
    () =>
      new OpenAIProvider(config, fetcher).generate(
        'test',
        z.object({ ok: z.boolean() }),
        '',
        {},
      ),
    (e: unknown) => e instanceof ServiceError && e.code === 'TIMEOUT',
  );
});
test('request validation handles JSON, media type, origin and body limits', async () => {
  const req = (body: string, headers: Record<string, string> = {}) =>
    new Request('http://localhost:3000/api/prepare', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body,
    });
  assert.deepEqual(await readBody(req('{"question":"hello"}')), {
    question: 'hello',
  });
  await assert.rejects(() => readBody(req('{')));
  await assert.rejects(() =>
    readBody(req('{}', { 'Content-Type': 'text/plain' })),
  );
  await assert.rejects(() =>
    readBody(req('{}', { Origin: 'https://unrelated.example' })),
  );
  await assert.rejects(() => readBody(req('a'.repeat(250001))));
});
test('unknown error responses do not leak private diagnostic content', async () => {
  const response = errorResponse(
    new Error('API key secret-key student private answer'),
  );
  assert.ok(!(await response.text()).includes('secret-key'));
  assert.equal(response.status, 500);
});
