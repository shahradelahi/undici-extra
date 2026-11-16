import { rm } from 'node:fs/promises';
import { join } from 'node:path';
import { MockAgent, setGlobalDispatcher } from 'undici';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import undici, { CookieFile } from './index';

const TEST_DIR = join(process.cwd(), '.tmp-test-undici-cookies');

describe('undici-extra cookies feature', () => {
  let mockAgent: MockAgent;
  let mockPool: any;

  beforeEach(async () => {
    await rm(TEST_DIR, { recursive: true, force: true });
    mockAgent = new MockAgent();
    mockAgent.disableNetConnect();
    setGlobalDispatcher(mockAgent);
    mockPool = mockAgent.get('http://example.com');
  });

  afterEach(async () => {
    await rm(TEST_DIR, { recursive: true, force: true });
  });

  it('sends structured object cookies as Cookie header', async () => {
    mockPool
      .intercept({
        path: '/test',
        headers: (headers: Record<string, string>) => {
          return headers['cookie'] === 'session=abc; theme=dark';
        },
      })
      .reply(200, { ok: true });

    const res = await undici('http://example.com/test', {
      cookies: { session: 'abc', theme: 'dark' },
    });

    expect(await res.json()).toEqual({ ok: true });
  });

  it('persists and sends cookies using a CookieFile instance', async () => {
    const filePath = join(TEST_DIR, 'cookies.txt');
    const cookieFile = new CookieFile(filePath, { persistSessionCookies: true });

    mockPool
      .intercept({ path: '/login' })
      .reply(200, { ok: true }, { headers: { 'set-cookie': 'sid=xyz; Path=/' } });

    await undici('http://example.com/login', { cookies: cookieFile });

    expect(await cookieFile.getCookieHeader('http://example.com/api')).toBe('sid=xyz');

    mockPool
      .intercept({
        path: '/api',
        headers: (headers: Record<string, string>) => {
          return headers['cookie'] === 'sid=xyz';
        },
      })
      .reply(200, { authenticated: true });

    const client = undici.create({ cookies: cookieFile });
    const res = await client('http://example.com/api');
    expect(await res.json()).toEqual({ authenticated: true });
  });

  it('shares CookieFile when extended', async () => {
    const filePath = join(TEST_DIR, 'shared-cookies.txt');
    const baseClient = undici.create({ cookies: filePath });

    mockPool
      .intercept({ path: '/set' })
      .reply(200, { ok: true }, { headers: { 'set-cookie': 'token=secret; Path=/' } });

    await baseClient('http://example.com/set');

    const extendedClient = baseClient.extend({ headers: { 'x-custom': '1' } });

    mockPool
      .intercept({
        path: '/check',
        headers: (headers: Record<string, string>) => {
          return headers['cookie'] === 'token=secret' && headers['x-custom'] === '1';
        },
      })
      .reply(200, { ok: true });

    const res = await extendedClient('http://example.com/check');
    expect(await res.json()).toEqual({ ok: true });
  });
});
