import type { Request } from 'undici';

import { createResponsePromise, type ResponsePromise } from './core/ResponsePromise';
import { Undici } from './core/Undici';
import type { UndiciOptions } from './types/options';

export { Undici } from './core/Undici';
export { HTTPError } from './core/errors';
export * from './types/hooks';
export * from './types/options';
export * from './core/retry';
export type { ResponsePromise } from './core/ResponsePromise';

export type UndiciInstance = {
  /**
   * Make an HTTP request with extra features.
   * @example await undici('https://api.com/users').json()
   */
  (input: string | URL | Request, options?: UndiciOptions): ResponsePromise;

  /** Make a GET request. */
  get(input: string | URL | Request, options?: UndiciOptions): ResponsePromise;

  /** Make a POST request. */
  post(input: string | URL | Request, options?: UndiciOptions): ResponsePromise;

  /** Make a PUT request. */
  put(input: string | URL | Request, options?: UndiciOptions): ResponsePromise;

  /** Make a PATCH request. */
  patch(input: string | URL | Request, options?: UndiciOptions): ResponsePromise;

  /** Make a DELETE request. */
  delete(input: string | URL | Request, options?: UndiciOptions): ResponsePromise;

  /** Make a HEAD request. */
  head(input: string | URL | Request, options?: UndiciOptions): ResponsePromise;

  /** Create a new instance with default options. */
  create(defaultOptions: UndiciOptions): UndiciInstance;

  /** Create a new instance by merging options with the current instance. */
  extend(extendedOptions: UndiciOptions): UndiciInstance;

  /**
   * Paginate through an API.
   * @example
   * for await (const item of undici.paginate('events', {
   *   pagination: {
   *     paginate: (res) => res.json().then(data => data.next_url)
   *   }
   * })) { ... }
   */
  paginate<T = any>(input: string | URL | Request, options?: UndiciOptions): AsyncIterable<T>;
};

function mergeOptions(base: UndiciOptions, extended: UndiciOptions): UndiciOptions {
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

  return {
    ...base,
    ...extended,
    headers,
    hooks,
    retry,
    searchParams,
    signal,
    dispatcher: extended.dispatcher ?? base.dispatcher,
  };
}

function createInstance(defaultOptions: UndiciOptions = {}): UndiciInstance {
  const instance = (input: string | URL | Request, options?: UndiciOptions) => {
    const combinedOptions = mergeOptions(defaultOptions, options || {});
    const extra = new Undici(input, combinedOptions);
    return createResponsePromise(extra.execute());
  };

  instance.get = (input: string | URL | Request, options?: UndiciOptions) =>
    instance(input, { ...options, method: 'GET' });
  instance.post = (input: string | URL | Request, options?: UndiciOptions) =>
    instance(input, { ...options, method: 'POST' });
  instance.put = (input: string | URL | Request, options?: UndiciOptions) =>
    instance(input, { ...options, method: 'PUT' });
  instance.patch = (input: string | URL | Request, options?: UndiciOptions) =>
    instance(input, { ...options, method: 'PATCH' });
  instance.delete = (input: string | URL | Request, options?: UndiciOptions) =>
    instance(input, { ...options, method: 'DELETE' });
  instance.head = (input: string | URL | Request, options?: UndiciOptions) =>
    instance(input, { ...options, method: 'HEAD' });

  instance.create = (newOptions: UndiciOptions) => createInstance(newOptions);
  instance.extend = (extendedOptions: UndiciOptions) =>
    createInstance(mergeOptions(defaultOptions, extendedOptions));

  instance.paginate = <T = any>(input: string | URL | Request, options?: UndiciOptions) => {
    const combinedOptions = mergeOptions(defaultOptions, options || {});
    const extra = new Undici(input, combinedOptions);
    return extra.paginate<T>();
  };

  return instance as UndiciInstance;
}

const undici = createInstance();

export default undici;
