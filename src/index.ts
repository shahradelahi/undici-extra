import type { Request } from 'undici';

import { createResponsePromise, type ResponsePromise } from './core/ResponsePromise';
import { Undici } from './core/Undici';
import type { UndiciOptions } from './types/options';
import { mergeOptions } from './utils/options';

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

  /** Returns the number of requests currently queued by the throttler. */
  readonly queueSize: number;

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

function createInstance(defaultOptions: UndiciOptions = {}): UndiciInstance {
  const client = new Undici(defaultOptions);

  const instance = (input: string | URL | Request, options?: UndiciOptions) => {
    return createResponsePromise(client.execute(input, options));
  };

  Object.defineProperty(instance, 'queueSize', {
    get: () => client.queueSize,
    configurable: true,
    enumerable: true,
  });

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
  instance.extend = (extendedOptions: UndiciOptions) => {
    const newOptions = mergeOptions(defaultOptions, extendedOptions);
    return createInstance(newOptions);
  };

  instance.paginate = <T = any>(input: string | URL | Request, options?: UndiciOptions) => {
    return client.paginate<T>(input, options);
  };

  return instance as UndiciInstance;
}

const undici = createInstance();

export default undici;
