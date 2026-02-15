import { MockAgent, setGlobalDispatcher } from 'undici';
import { beforeEach, describe, expect, it } from 'vitest';

import undici from './index';

describe('throttling', () => {
  let mockAgent: MockAgent;
  let mockPool: any;

  beforeEach(() => {
    mockAgent = new MockAgent();
    mockAgent.disableNetConnect();
    setGlobalDispatcher(mockAgent);
    mockPool = mockAgent.get('http://example.com');
  });

  it('should throttle requests', async () => {
    const limit = 2;
    const interval = 500;
    const client = undici.create({
      throttle: { limit, interval },
    });

    let activeRequests = 0;
    let maxConcurrent = 0;

    mockPool
      .intercept({ path: '/' })
      .reply(200, () => {
        activeRequests++;
        maxConcurrent = Math.max(maxConcurrent, activeRequests);
        return new Promise((resolve) => {
          setTimeout(() => {
            activeRequests--;
            resolve({ hello: 'world' });
          }, 100);
        });
      })
      .times(5);

    const start = Date.now();
    await Promise.all([
      client('http://example.com/'),
      client('http://example.com/'),
      client('http://example.com/'),
      client('http://example.com/'),
      client('http://example.com/'),
    ]);
    const duration = Date.now() - start;

    // With limit 2 and interval 500ms:
    // T+0: Req 1, 2 started
    // T+500: Req 3, 4 started
    // T+1000: Req 5 started
    // Total duration should be at least 1000ms
    expect(duration).toBeGreaterThanOrEqual(1000);
    expect(maxConcurrent).toBeLessThanOrEqual(limit);
  });

  it('should not inherit throttler in extended client', async () => {
    const client = undici.create({
      throttle: { limit: 1, interval: 500 },
    });
    const extended = client.extend({ headers: { 'x-foo': 'bar' } });

    mockPool.intercept({ path: '/' }).reply(200, { ok: true }).times(2);

    const start = Date.now();
    await Promise.all([client('http://example.com/'), extended('http://example.com/')]);
    const duration = Date.now() - start;

    // They don't share or inherit the throttle, so they run concurrently
    expect(duration).toBeLessThan(500);
  });

  it('should allow overriding throttle in extended client', async () => {
    const client = undici.create({
      throttle: { limit: 1, interval: 1000 },
    });
    // This should create a NEW throttler
    const extended = client.extend({ throttle: { limit: 1, interval: 100 } });

    mockPool.intercept({ path: '/' }).reply(200, { ok: true }).times(2);

    const start = Date.now();
    // They don't share the bucket, so they can run concurrently (or one after another if they were shared)
    // Actually, since they have different buckets, if we fire them at the same time:
    // Req 1 (client) starts immediately.
    // Req 2 (extended) starts immediately.
    await Promise.all([client('http://example.com/'), extended('http://example.com/')]);
    const duration = Date.now() - start;

    expect(duration).toBeLessThan(500);
  });

  it('should expose queueSize', async () => {
    const client = undici.create({
      throttle: { limit: 1, interval: 1000 },
    });

    mockPool.intercept({ path: '/' }).reply(200, { ok: true }).times(3);

    const p1 = client('http://example.com/');
    const p2 = client('http://example.com/');
    const p3 = client('http://example.com/');

    // Wait for the async preparation to complete and reach the throttler
    await new Promise((resolve) => setTimeout(resolve, 50));

    // p1 is running, p2 and p3 are queued
    expect(client.queueSize).toBe(2);

    await Promise.all([p1, p2, p3]);
    expect(client.queueSize).toBe(0);
  });
});
