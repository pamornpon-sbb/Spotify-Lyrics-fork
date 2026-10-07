import { afterEach, describe, expect, test, vi } from 'vitest';

import { request } from './request';

const mockFetch = (...statuses: number[]) => {
  const fn = vi.fn(async () => {
    const status = statuses.length > 1 ? statuses.shift()! : statuses[0];
    return new Response(status === 200 ? '{"ok":1}' : '', {
      status,
      headers: { 'retry-after': '1' },
    });
  });
  vi.stubGlobal('fetch', fn);
  return fn;
};

describe('request', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  test('retry when server is busy', async () => {
    vi.useFakeTimers();
    const fn = mockFetch(503, 429, 200);
    const result = request('https://lrclib.net/api/search');
    await vi.advanceTimersByTimeAsync(2000);
    await expect(result).resolves.toEqual({ ok: 1 });
    expect(fn).toHaveBeenCalledTimes(3);
  });

  test('give up after 2 retries', async () => {
    vi.useFakeTimers();
    const fn = mockFetch(503);
    const result = request('https://lrclib.net/api/search');
    const assertion = expect(result).rejects.toThrow('HTTP 503');
    await vi.advanceTimersByTimeAsync(10000);
    await assertion;
    expect(fn).toHaveBeenCalledTimes(3);
  });
});
