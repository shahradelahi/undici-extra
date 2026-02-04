import type { RequestInit, Response } from 'undici';

import type { RetryOptions } from '../core/retry';
import type { ProxyInput } from '../utils/proxy';
import type { Hooks } from './hooks';

export interface UndiciOptions extends RequestInit {
  /**
   * HTTP/HTTPS Proxy URL or Options.
   * Automatically creates and caches an `undici.ProxyAgent`.
   */
  proxy?: ProxyInput;

  /** Lifecycle hooks. */
  hooks?: Hooks;

  /**
   * Retry configuration.
   * @default 2
   */
  retry?: number | RetryOptions;

  /** Base URL for the request. */
  prefixUrl?: string | URL;

  /** Shortcut for sending JSON body. Sets 'content-type' to 'application/json'. */
  json?: unknown;

  /** Search parameters to append to the URL. */
  searchParams?:
    | string
    | Record<string, string | number | boolean | undefined | null>
    | URLSearchParams;

  /** Request timeout in milliseconds. */
  timeout?: number;

  /** Throw HTTPError for non-2xx responses. @default true */
  throwHttpErrors?: boolean;

  /** Path to a Unix domain socket. */
  unixSocket?: string;

  /** Log equivalent cURL command. */
  debug?: boolean;

  /** Coalesce concurrent requests to the same URL/method. */
  dedup?: boolean;

  /** Pagination configuration for `.paginate()`. */
  pagination?: {
    /** Transform response into an array of items. */
    transform?: (response: Response) => any | Promise<any>;
    /** Return next URL or false to stop. */
    paginate?: (
      response: Response,
      allItems: any[],
      currentItems: any[]
    ) => string | URL | false | Promise<string | URL | false>;
  };
}
