import { throttle } from '@se-oss/throttle';
import { Request, Response, fetch as undiciFetch } from 'undici';

import type { UndiciOptions } from '../types/options';
import { generateCurlCommand } from '../utils/curl';
import { delay } from '../utils/delay';
import { mergeOptions } from '../utils/options';
import { resolveDispatcher } from '../utils/proxy';
import { HTTPError } from './errors';
import { normalizeRetryOptions } from './retry';

export class Undici {
  static #pendingRequests = new Map<string, Promise<Response>>();

  #options: UndiciOptions;
  #throttler?: any;

  constructor(options: UndiciOptions = {}) {
    this.#options = { ...options };

    if (options.throttle) {
      this.#throttler = throttle(undiciFetch, options.throttle);
    }
  }

  get options(): UndiciOptions {
    return this.#options;
  }

  get queueSize(): number {
    return this.#throttler?.queueSize ?? 0;
  }

  async #prepareRequest(input: string | URL | Request, options: UndiciOptions): Promise<Request> {
    let finalInput = input;
    const { prefixUrl, json, headers, searchParams, ...rest } = options;

    if (prefixUrl && typeof finalInput === 'string') {
      finalInput = new URL(finalInput, prefixUrl).toString();
    }

    if (searchParams) {
      const url = new URL(finalInput as string | URL);
      const params = new URLSearchParams(searchParams as any);
      for (const [key, value] of params) {
        url.searchParams.append(key, value);
      }
      finalInput = url.toString();
    }

    const normalizedHeaders = new Headers(headers as any);
    const fetchOptions: any = { ...rest, headers: normalizedHeaders };

    if (json !== undefined) {
      fetchOptions.body = JSON.stringify(json);
      if (!normalizedHeaders.has('content-type')) {
        normalizedHeaders.set('content-type', 'application/json');
      }
    }

    return new Request(finalInput, fetchOptions);
  }

  async execute(input: string | URL | Request, options: UndiciOptions = {}): Promise<Response> {
    const combinedOptions = mergeOptions(this.#options, options);
    const request = await this.#prepareRequest(input, combinedOptions);
    const { dedup } = combinedOptions;

    if (dedup) {
      const key = `${request.method}:${request.url}`;
      const pending = Undici.#pendingRequests.get(key);
      if (pending) {
        const response = await pending;
        return response.clone();
      }

      const promise = this.#execute(request, combinedOptions);
      Undici.#pendingRequests.set(key, promise);
      try {
        const response = await promise;
        return response.clone();
      } finally {
        Undici.#pendingRequests.delete(key);
      }
    }

    return this.#execute(request, combinedOptions);
  }

  async #execute(request: Request, options: UndiciOptions): Promise<Response> {
    let activeRequest = request;
    const {
      retry,
      hooks,
      throwHttpErrors = true,
      timeout,
      proxy,
      dispatcher: customDispatcher,
      unixSocket,
      debug,
    } = options;
    const retryConfig = normalizeRetryOptions(retry);
    let retryCount = 0;

    const dispatcher = resolveDispatcher(customDispatcher as any, proxy, unixSocket);

    // 1. Hook: beforeRequest
    if (hooks?.beforeRequest) {
      for (const hook of hooks.beforeRequest) {
        const result = await hook(activeRequest, options);
        if (result instanceof Response) return result;
        if (result instanceof Request) activeRequest = result;
      }
    }

    let performRequest = this.#throttler || undiciFetch;
    if (options.throttle && options.throttle !== this.#options.throttle) {
      performRequest = throttle(undiciFetch, options.throttle);
    }

    const makeRequest = async (req: Request) => {
      const finalRequest = retryCount > 0 ? req.clone() : req;

      if (debug) {
        // eslint-disable-next-line no-console
        console.log(generateCurlCommand(finalRequest));
      }

      const fetchOptions: any = {
        dispatcher,
        signal: options.signal,
      };

      if (timeout) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        try {
          const signals = [controller.signal];
          if (options.signal) {
            signals.push(options.signal);
          }
          fetchOptions.signal = AbortSignal.any(signals);

          return await performRequest(finalRequest, fetchOptions);
        } finally {
          clearTimeout(timeoutId);
        }
      }

      return performRequest(finalRequest, fetchOptions);
    };

    while (true) {
      try {
        let response = await makeRequest(activeRequest);

        // 2. Hook: afterResponse
        if (hooks?.afterResponse) {
          for (const hook of hooks.afterResponse) {
            const modified = await hook(activeRequest, options, response);
            if (modified instanceof Response) response = modified;
          }
        }

        if (!response.ok && throwHttpErrors) {
          throw new HTTPError(response, activeRequest);
        }

        return response;
      } catch (error: any) {
        const shouldRetry = this.#shouldRetry(error, retryCount, retryConfig);

        if (shouldRetry) {
          retryCount++;

          // 3. Hook: beforeRetry
          if (hooks?.beforeRetry) {
            for (const hook of hooks.beforeRetry) {
              await hook({ request: activeRequest, options, error, retryCount });
            }
          }

          const backoff = retryConfig.delay!(retryCount);
          await delay(Math.min(backoff, retryConfig.backoffLimit!));
          continue;
        }

        throw error;
      }
    }
  }

  async *paginate<T = any>(
    input: string | URL | Request,
    options: UndiciOptions = {}
  ): AsyncIterable<T> {
    const combinedOptions = mergeOptions(this.#options, options);
    const { pagination } = combinedOptions;

    if (!pagination || !pagination.paginate) {
      throw new Error('Pagination options must be provided to use paginate()');
    }

    let currentInput = input;
    const allItems: T[] = [];

    while (true) {
      const response = await this.execute(currentInput, { ...options, pagination: undefined });

      const currentItems = pagination.transform
        ? await pagination.transform(response.clone())
        : await response.clone().json();

      if (Array.isArray(currentItems)) {
        for (const item of currentItems) {
          yield item as T;
          allItems.push(item);
        }
      } else {
        yield currentItems as T;
        allItems.push(currentItems);
      }

      const nextInput = await pagination.paginate(response, allItems, currentItems);
      if (!nextInput) break;
      currentInput = nextInput;
    }
  }

  #shouldRetry(error: any, retryCount: number, retryConfig: any): boolean {
    if (retryCount >= retryConfig.limit) {
      return false;
    }

    if (error instanceof HTTPError) {
      return retryConfig.statusCodes.includes(error.response.status);
    }

    if (error.code && retryConfig.errorCodes.includes(error.code)) {
      return true;
    }

    return false;
  }
}
