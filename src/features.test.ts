import { MockAgent, setGlobalDispatcher } from 'undici';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import undici from './index';

describe('undici-extra new features', () => {
  let mockAgent: MockAgent;
  let mockPool: any;

  beforeEach(() => {
    mockAgent = new MockAgent();
    mockAgent.disableNetConnect();
    setGlobalDispatcher(mockAgent);
    mockPool = mockAgent.get('http://example.com');
  });

  it('should dedup requests', async () => {
    mockPool.intercept({ path: '/dedup' }).reply(200, { ok: true }).delay(100);

    const p1 = undici('http://example.com/dedup', { dedup: true });
    const p2 = undici('http://example.com/dedup', { dedup: true });

    const [r1, r2] = await Promise.all([p1, p2]);

    expect(await r1.json()).toEqual({ ok: true });
    expect(await r2.json()).toEqual({ ok: true });

    // MockPool would throw if multiple requests were made to the same interceptor
    // without .times(2) or multiple intercepts.
  });

  it('should support ndjson', async () => {
    const ndjsonContent = '{"id":1}\n{"id":2}\n{"id":3}\n';
    mockPool.intercept({ path: '/ndjson' }).reply(200, ndjsonContent);

    const results = [];
    for await (const item of undici('http://example.com/ndjson').ndjson()) {
      results.push(item);
    }

    expect(results).toEqual([{ id: 1 }, { id: 2 }, { id: 3 }]);
  });

  it('should support pagination', async () => {
    mockPool
      .intercept({ path: '/page1' })
      .reply(200, { items: [1, 2], next: 'http://example.com/page2' });
    mockPool.intercept({ path: '/page2' }).reply(200, { items: [3, 4], next: null });

    const items = [];
    for await (const item of undici.paginate('http://example.com/page1', {
      pagination: {
        transform: (res) => res.json().then((data: any) => data.items),
        paginate: (res, _allItems, _currentItems) => res.json().then((data: any) => data.next),
      },
    })) {
      items.push(item);
    }

    expect(items).toEqual([1, 2, 3, 4]);
  });

  it('should log curl command when debug is enabled', async () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    mockPool.intercept({ path: '/debug' }).reply(200, { ok: true });

    await undici('http://example.com/debug', { debug: true });

    expect(spy).toHaveBeenCalledWith(expect.stringContaining('curl -X GET'));
    expect(spy).toHaveBeenCalledWith(expect.stringContaining('"http://example.com/debug"'));
    spy.mockRestore();
  });
});
