import type { Request, Response } from 'undici';

/** Thrown when a request fails with a non-2xx status code. */
export class HTTPError extends Error {
  public readonly response: Response;
  public readonly request: Request;

  constructor(response: Response, request: Request) {
    const code =
      response.status || response.statusText
        ? `${response.status} ${response.statusText}`
        : 'Unknown Status';
    super(`Request failed with status code ${code}`);

    this.name = 'HTTPError';
    this.response = response;
    this.request = request;
  }
}
