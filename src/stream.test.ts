import { Readable, Writable } from 'node:stream';
import { MockAgent, Response, setGlobalDispatcher } from 'undici';
import { beforeEach, describe, expect, it } from 'vitest';

import undici from './index';
import { toNodeStream } from './utils/stream';

describe('stream features', () => {
  let mockAgent: MockAgent;
  let mockPool: any;

  beforeEach(() => {
    mockAgent = new MockAgent();
    mockAgent.disableNetConnect();
    setGlobalDispatcher(mockAgent);
    mockPool = mockAgent.get('http://example.com');
  });

  it('should return a Node.js Readable stream via .stream()', async () => {
    const content = 'hello stream';
    mockPool.intercept({ path: '/stream' }).reply(200, content);

    const stream = await undici('http://example.com/stream').stream();
    expect(stream).toBeInstanceOf(Readable);

    const chunks = [];
    for await (const chunk of stream) {
      chunks.push(chunk);
    }
    const result = Buffer.concat(chunks).toString('utf-8');
    expect(result).toBe(content);
  });

  it('should pipe response to a writable stream via .pipe()', async () => {
    const content = 'piped content';
    mockPool.intercept({ path: '/pipe' }).reply(200, content);

    let received = '';
    const destination = new Writable({
      write(chunk, _encoding, callback) {
        received += chunk.toString();
        callback();
      },
    });

    await undici('http://example.com/pipe').pipe(destination);
    expect(received).toBe(content);
  });

  it('should support "Passive Caching" (Teeing) via hooks', async () => {
    const content = 'cached content';
    mockPool.intercept({ path: '/cache' }).reply(200, content);

    let cachedData = '';

    // Create a client that caches to a variable (simulating disk)
    const cachingClient = undici.extend({
      hooks: {
        afterResponse: [
          async (_req, _opts, res) => {
            if (res.ok && res.body) {
              const [userStream, cacheStream] = res.body.tee();

              // Background "write to disk"
              const nodeStream = toNodeStream(cacheStream as any);
              const destination = new Writable({
                write(chunk, _encoding, callback) {
                  cachedData += chunk.toString();
                  callback();
                },
              });
              nodeStream.pipe(destination);

              // Return user stream
              return new Response(userStream, res);
            }
            return res;
          },
        ],
      },
    });

    const response = await cachingClient('http://example.com/cache');
    const userText = await response.text();

    expect(userText).toBe(content);
    // Wait a tick for the stream pipe to finish (since it's not awaited in the main flow)
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(cachedData).toBe(content);
  });

  it('should handle dedup with streams', async () => {
    mockPool.intercept({ path: '/dedup-stream' }).reply(200, 'dedup');

    // Make two requests with dedup: true
    const p1 = undici('http://example.com/dedup-stream', { dedup: true });
    const p2 = undici('http://example.com/dedup-stream', { dedup: true });

    // Both should get a valid stream
    const [s1, s2] = await Promise.all([p1.stream(), p2.stream()]);

    const read = async (s: Readable) => {
      let data = '';
      for await (const chunk of s) data += chunk;
      return data;
    };

    const [r1, r2] = await Promise.all([read(s1), read(s2)]);

    expect(r1).toBe('dedup');
    expect(r2).toBe('dedup');
  });
});
