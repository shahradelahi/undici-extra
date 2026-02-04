import { Agent, ProxyAgent } from 'undici';
import { describe, expect, it } from 'vitest';

import { resolveDispatcher } from './utils/proxy';

describe('resolveDispatcher', () => {
  it('should return undefined if no proxy or unixSocket', () => {
    expect(resolveDispatcher()).toBeUndefined();
  });

  it('should return ProxyAgent for proxy', () => {
    const dispatcher = resolveDispatcher(undefined, 'http://proxy.com');
    expect(dispatcher).toBeInstanceOf(ProxyAgent);
  });

  it('should return Agent for unixSocket', () => {
    const dispatcher = resolveDispatcher(undefined, undefined, '/tmp/test.sock');
    expect(dispatcher).toBeInstanceOf(Agent);
  });

  it('should prefer proxy over unixSocket', () => {
    const dispatcher = resolveDispatcher(undefined, 'http://proxy.com', '/tmp/test.sock');
    expect(dispatcher).toBeInstanceOf(ProxyAgent);
  });
});
