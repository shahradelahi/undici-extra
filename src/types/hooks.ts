import type { Request, Response } from 'undici';

import type { UndiciOptions } from './options';

/** Called before a request is sent. Can return a Request to override it or a Response to short-circuit. */
export type BeforeRequestHook = (
  request: Request,
  options: UndiciOptions
) => Request | Response | Promise<Request | Response> | void | Promise<void>;

/** Called after a response is received. Can return a Response to override it. */
export type AfterResponseHook = (
  request: Request,
  options: UndiciOptions,
  response: Response
) => Response | Promise<Response> | void | Promise<void>;

/** Called before a retry attempt. */
export type BeforeRetryHook = (options: {
  request: Request;
  options: UndiciOptions;
  error: Error;
  retryCount: number;
}) => void | Promise<void>;

export interface Hooks {
  /** Hooks to run before the request is sent. */
  beforeRequest?: BeforeRequestHook[];
  /** Hooks to run after the response is received. */
  afterResponse?: AfterResponseHook[];
  /** Hooks to run before each retry attempt. */
  beforeRetry?: BeforeRetryHook[];
}
