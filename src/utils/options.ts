import type { UndiciOptions } from '../types/options';

export function mergeOptions(base: UndiciOptions, extended: UndiciOptions): UndiciOptions {
  const headers = new Headers(base.headers as any);
  if (extended.headers) {
    const extendedHeaders = new Headers(extended.headers as any);
    for (const [key, value] of extendedHeaders) {
      headers.set(key, value);
    }
  }

  const hooks = { ...base.hooks };
  if (extended.hooks) {
    for (const key of Object.keys(extended.hooks) as Array<keyof typeof hooks>) {
      hooks[key] = [...(hooks[key] || []), ...(extended.hooks[key] || [])] as any;
    }
  }

  let { retry } = extended;
  if (typeof base.retry === 'object' && typeof extended.retry === 'object') {
    retry = { ...base.retry, ...extended.retry };
  }

  let { searchParams } = extended;
  if (base.searchParams && extended.searchParams) {
    const baseParams = new URLSearchParams(base.searchParams as any);
    const extendedParams = new URLSearchParams(extended.searchParams as any);
    for (const [key, value] of extendedParams) {
      baseParams.set(key, value);
    }
    searchParams = baseParams;
  } else if (base.searchParams) {
    searchParams = new URLSearchParams(base.searchParams as any);
  } else if (extended.searchParams) {
    searchParams = new URLSearchParams(extended.searchParams as any);
  }

  let { signal } = extended;
  if (base.signal && extended.signal) {
    signal = AbortSignal.any([base.signal, extended.signal]);
  } else if (base.signal) {
    signal = base.signal;
  }

  const { throttle: _baseThrottle, ...restBase } = base;

  return {
    ...restBase,
    ...extended,
    headers,
    hooks,
    retry,
    searchParams,
    signal,
    dispatcher: extended.dispatcher ?? base.dispatcher,
  };
}
