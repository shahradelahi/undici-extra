import { Agent, ProxyAgent, type Dispatcher } from 'undici';

export type ProxyInput = string | URL | ProxyAgent.Options;

// Cache agents to prevent memory leaks and maximize connection reuse
const agentCache = new Map<string, Dispatcher>();

export const getProxyDispatcher = (input: ProxyInput): ProxyAgent => {
  // Normalize input to ProxyAgent options object
  const options: ProxyAgent.Options =
    typeof input === 'string' || input instanceof URL ? { uri: input.toString() } : input;

  // Create a unique key for caching
  const key =
    typeof options.uri === 'string'
      ? options.uri
      : ((options.uri as any)?.toString() ?? JSON.stringify(options));

  if (!agentCache.has(key)) {
    agentCache.set(key, new ProxyAgent(options));
  }

  return agentCache.get(key) as ProxyAgent;
};

export const getUnixSocketDispatcher = (path: string): Agent => {
  const key = `unix:${path}`;

  if (!agentCache.has(key)) {
    agentCache.set(key, new Agent({ connect: { path } }));
  }

  return agentCache.get(key) as Agent;
};

export const resolveDispatcher = (
  customDispatcher?: Dispatcher,
  proxy?: ProxyInput,
  unixSocket?: string
): Dispatcher | undefined => {
  if (proxy) {
    return getProxyDispatcher(proxy);
  }
  if (unixSocket) {
    return getUnixSocketDispatcher(unixSocket);
  }
  return customDispatcher;
};
