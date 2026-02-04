import { MockAgent, Request, setGlobalDispatcher } from 'undici';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import undici, { HTTPError } from './index';

describe('undici-extra', () => {
  let mockAgent: MockAgent;
  let mockPool: any;

  beforeEach(() => {
    mockAgent = new MockAgent();
    mockAgent.disableNetConnect();
    setGlobalDispatcher(mockAgent);
    mockPool = mockAgent.get('http://example.com');
  });

  it('should make a simple request', async () => {
    mockPool.intercept({ path: '/' }).reply(200, { hello: 'world' });

    const response = await undici('http://example.com/');
    const data = await response.json();

    expect(data).toEqual({ hello: 'world' });
  });

  it('should support ResponsePromise shortcut (.json())', async () => {
    mockPool.intercept({ path: '/json' }).reply(200, { shortcut: true });

    const data = await undici('http://example.com/json').json();

    expect(data).toEqual({ shortcut: true });
  });

  it('should handle prefixUrl', async () => {
    mockPool.intercept({ path: '/api/test' }).reply(200, { ok: true });

    const response = await undici('test', { prefixUrl: 'http://example.com/api/' });
    const data = await response.json();

    expect(data).toEqual({ ok: true });
  });

  it('should support .extend()', async () => {
    mockPool
      .intercept({
        path: '/extended',
        headers: (headers: any) => headers['x-custom'] === 'foo' && headers['x-extended'] === 'bar',
      })
      .reply(200, { extended: true });

    const client = undici.extend({
      headers: { 'x-custom': 'foo' },
    });

    const extendedClient = client.extend({
      headers: { 'x-extended': 'bar' },
    });

    const data = await extendedClient('http://example.com/extended').json();
    expect(data).toEqual({ extended: true });
  });

  it('should handle json body', async () => {
    mockPool
      .intercept({
        path: '/',
        method: 'POST',
        body: JSON.stringify({ foo: 'bar' }),
      })
      .reply(200, { received: true });

    const response = await undici('http://example.com/', {
      method: 'POST',
      json: { foo: 'bar' },
    });
    const data = await response.json();

    expect(data).toEqual({ received: true });
  });

  it('should throw HTTPError for non-2xx responses by default', async () => {
    mockPool.intercept({ path: '/404' }).reply(404, 'Not Found');

    await expect(undici('http://example.com/404')).rejects.toThrow(HTTPError);
  });

  it('should support beforeRequest hook', async () => {
    mockPool.intercept({ path: '/hooked' }).reply(200, { hooked: true });

    const beforeRequest = vi.fn().mockImplementation((_request) => {
      // Change the URL
      return new Request('http://example.com/hooked');
    });

    await undici('http://example.com/original', {
      hooks: {
        beforeRequest: [beforeRequest],
      },
    });

    expect(beforeRequest).toHaveBeenCalled();
  });

  it('should handle searchParams', async () => {
    mockPool.intercept({ path: '/?foo=bar&baz=qux' }).reply(200, { ok: true });

    const response = await undici('http://example.com/', {
      searchParams: { foo: 'bar', baz: 'qux' },
    });
    const data = await response.json();

    expect(data).toEqual({ ok: true });
  });

  it('should retry on failure', async () => {
    mockPool.intercept({ path: '/retry' }).reply(500, 'Error').times(2);
    mockPool.intercept({ path: '/retry' }).reply(200, 'Success');

    const beforeRetry = vi.fn();

    const response = await undici('http://example.com/retry', {
      retry: 2,
      hooks: {
        beforeRetry: [beforeRetry],
      },
    });

    expect(response.status).toBe(200);
    expect(beforeRetry).toHaveBeenCalledTimes(2);
  });
});
