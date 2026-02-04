import { fetch, Request, Response } from 'undici';

import type { UndiciOptions } from '../types/options';
import { generateCurlCommand } from '../utils/curl';
import { delay } from '../utils/delay';
import { resolveDispatcher } from '../utils/proxy';
import { HTTPError } from './errors';
import { normalizeRetryOptions } from './retry';

export class Undici {
  static #pendingRequests = new Map<string, Promise<Response>>();

  #input: string | URL | Request;
  #options: UndiciOptions;

  constructor(input: string | URL | Request, options: UndiciOptions = {}) {
    this.#input = input;
    this.#options = { ...options };
  }

  async #prepareRequest(): Promise<Request> {
    let { input } = this;
    const { prefixUrl, json, headers, searchParams, ...rest } = this.#options;

    if (prefixUrl && typeof input === 'string') {
      input = new URL(input, prefixUrl).toString();
    }

    if (searchParams) {
      const url = new URL(input as string | URL);
      const params = new URLSearchParams(searchParams as any);
      for (const [key, value] of params) {
        url.searchParams.append(key, value);
      }
      input = url.toString();
    }

    const normalizedHeaders = new Headers(headers as any);
    const fetchOptions: any = { ...rest, headers: normalizedHeaders };

    if (json !== undefined) {
      fetchOptions.body = JSON.stringify(json);
      if (!normalizedHeaders.has('content-type')) {
        normalizedHeaders.set('content-type', 'application/json');
      }
    }

    return new Request(input, fetchOptions);
  }

  get input(): string | URL | Request {
    return this.#input;
  }

  async execute(): Promise<Response> {
    const request = await this.#prepareRequest();
    const { dedup } = this.#options;

    if (dedup) {
      const key = `${request.method}:${request.url}`;
      const pending = Undici.#pendingRequests.get(key);
      if (pending) {
        const response = await pending;
        return response.clone();
      }

      const promise = this.#execute(request);
      Undici.#pendingRequests.set(key, promise);
      try {
        const response = await promise;
        return response.clone();
      } finally {
        Undici.#pendingRequests.delete(key);
      }
    }

    return this.#execute(request);
  }

  async #execute(request: Request): Promise<Response> {
    let activeRequest = request;
    const {
      retry,
      hooks,
      throwHttpErrors = true,
      timeout,
      proxy,
      dispatcher: customDispatcher,
      unixSocket,
    } = this.#options;
    const retryConfig = normalizeRetryOptions(retry);
    let retryCount = 0;

    const dispatcher = resolveDispatcher(customDispatcher as any, proxy, unixSocket);

    if (this.#options.debug) {
      // eslint-disable-next-line no-console
      console.log(generateCurlCommand(activeRequest));
    }

    // 1. Hook: beforeRequest
    if (hooks?.beforeRequest) {
      for (const hook of hooks.beforeRequest) {
        const result = await hook(activeRequest, this.#options);
        if (result instanceof Response) return result;
        if (result instanceof Request) activeRequest = result;
      }
    }

    const makeRequest = async (req: Request) => {
      const finalRequest = retryCount > 0 ? req.clone() : req;

      if (timeout) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        try {
          const signals = [controller.signal];
          if (this.#options.signal) {
            signals.push(this.#options.signal);
          }

          return await fetch(finalRequest, {
            dispatcher,
            signal: AbortSignal.any(signals),
          } as any);
        } finally {
          clearTimeout(timeoutId);
        }
      }

      return fetch(finalRequest, {
        dispatcher,
        signal: this.#options.signal,
      } as any);
    };

    while (true) {
      try {
        let response = await makeRequest(activeRequest);

        // 2. Hook: afterResponse
        if (hooks?.afterResponse) {
          for (const hook of hooks.afterResponse) {
            const modified = await hook(activeRequest, this.#options, response);
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
              await hook({ request: activeRequest, options: this.#options, error, retryCount });
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

  async *paginate<T = any>(): AsyncIterable<T> {
    const { pagination } = this.#options;
    if (!pagination || !pagination.paginate) {
      throw new Error('Pagination options must be provided to use paginate()');
    }

    let currentInput = this.#input;
    const allItems: T[] = [];

    while (true) {
      const extra = new Undici(currentInput, { ...this.#options, pagination: undefined });
      const response = await extra.execute();

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
