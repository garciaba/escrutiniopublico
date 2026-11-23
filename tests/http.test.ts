import { describe, expect, it } from 'vitest';

import { HttpError, PoliteClient, type HttpOptions } from '../pipeline/ingest/http.ts';

const options: HttpOptions = {
  userAgent: 'EscrutinioPublico/test',
  minIntervalMs: 1000,
  retries: 3,
  backoffBaseMs: 2000,
  timeoutMs: 5000,
};

/** Fake clock: sleep advances time instantly and records each wait. */
function fakeTime() {
  let now = 0;
  const sleeps: number[] = [];
  return {
    sleeps,
    now: () => now,
    sleep: async (ms: number) => {
      sleeps.push(ms);
      now += ms;
    },
  };
}

function fakeFetch(statuses: (number | Error)[]) {
  const calls: { url: string; init: RequestInit | undefined }[] = [];
  const fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init });
    const next = statuses.shift();
    if (next instanceof Error) throw next;
    return new Response(`body ${calls.length}`, { status: next ?? 200 });
  }) as typeof globalThis.fetch;
  return { calls, fetch };
}

describe('PoliteClient', () => {
  it('sends the configured User-Agent', async () => {
    const time = fakeTime();
    const { calls, fetch } = fakeFetch([200]);
    const client = new PoliteClient(options, { ...time, fetch });
    const response = await client.get('https://example.org/a');
    expect(new TextDecoder().decode(response.body)).toBe('body 1');
    expect((calls[0]?.init?.headers as Record<string, string>)['User-Agent']).toBe('EscrutinioPublico/test');
  });

  it('waits the minimum interval between consecutive requests', async () => {
    const time = fakeTime();
    const { fetch } = fakeFetch([200, 200]);
    const client = new PoliteClient(options, { ...time, fetch });
    await client.get('https://example.org/a');
    await client.get('https://example.org/b');
    expect(time.sleeps).toEqual([1000]);
  });

  it('retries server errors with exponential backoff and then succeeds', async () => {
    const time = fakeTime();
    const { calls, fetch } = fakeFetch([503, 500, 200]);
    const client = new PoliteClient(options, { ...time, fetch });
    await client.get('https://example.org/a');
    expect(calls).toHaveLength(3);
    expect(time.sleeps).toEqual([2000, 4000]);
  });

  it('retries network errors', async () => {
    const time = fakeTime();
    const { calls, fetch } = fakeFetch([new TypeError('fetch failed'), 200]);
    const client = new PoliteClient(options, { ...time, fetch });
    await client.get('https://example.org/a');
    expect(calls).toHaveLength(2);
  });

  it('gives up after the configured retries', async () => {
    const time = fakeTime();
    const { calls, fetch } = fakeFetch([500, 500, 500, 500, 500]);
    const client = new PoliteClient(options, { ...time, fetch });
    await expect(client.get('https://example.org/a')).rejects.toBeInstanceOf(HttpError);
    expect(calls).toHaveLength(4);
  });

  it('does not retry a 403 (the firewall rejection seen in discovery)', async () => {
    const time = fakeTime();
    const { calls, fetch } = fakeFetch([403, 200]);
    const client = new PoliteClient(options, { ...time, fetch });
    await expect(client.get('https://example.org/a')).rejects.toMatchObject({ status: 403 });
    expect(calls).toHaveLength(1);
  });

  it('posts URL-encoded forms', async () => {
    const time = fakeTime();
    const { calls, fetch } = fakeFetch([200]);
    const client = new PoliteClient(options, { ...time, fetch });
    await client.postForm('https://example.org/a', { _organos_fileType: 'json', x: 'á b' });
    expect(calls[0]?.init?.method).toBe('POST');
    expect(calls[0]?.init?.body).toBe('_organos_fileType=json&x=%C3%A1+b');
  });
});
