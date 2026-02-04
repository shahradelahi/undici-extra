import type { Readable } from 'node:stream';
import type { Response } from 'undici';

import { pipelineResponse, toNodeStream } from '../utils/stream';

export interface ResponsePromise extends Promise<Response> {
  /** Parse response as JSON. */
  json<T = unknown>(): Promise<T>;
  /** Parse response as text. */
  text(): Promise<string>;
  /** Parse response as Blob. */
  blob(): Promise<Blob>;
  /** Parse response as ArrayBuffer. */
  arrayBuffer(): Promise<ArrayBuffer>;
  /** Parse response as FormData. */
  formData(): Promise<FormData>;
  /**
   * Iterate over Newline-Delimited JSON (NDJSON) stream.
   * @example
   * for await (const item of undici('...').ndjson()) { ... }
   */
  ndjson<T = unknown>(): AsyncIterable<T>;

  /**
   * Returns the response body as a Node.js Readable stream.
   * @example
   * const stream = await undici('...').stream();
   * stream.pipe(fs.createWriteStream('file.txt'));
   */
  stream(): Promise<Readable>;

  /**
   * Pipes the response body to a Node.js Writable stream.
   * Resolves when the stream finishes or rejects on error.
   * @example
   * await undici('...').pipe(fs.createWriteStream('file.txt'));
   */
  pipe(destination: NodeJS.WritableStream): Promise<void>;
}

export function createResponsePromise(promise: Promise<Response>): ResponsePromise {
  const bodyMethods = ['json', 'text', 'blob', 'arrayBuffer', 'formData'] as const;

  for (const method of bodyMethods) {
    (promise as any)[method] = async () => {
      const response = await promise;
      return (response as any)[method]();
    };
  }

  (promise as any).ndjson = async function* <T = unknown>() {
    const response = await promise;
    if (!response.body) return;

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        if (line.trim()) {
          yield JSON.parse(line) as T;
        }
      }
    }

    if (buffer.trim()) {
      yield JSON.parse(buffer) as T;
    }
  };

  (promise as any).stream = async () => {
    const response = await promise;
    return toNodeStream(response.body);
  };

  (promise as any).pipe = async (destination: NodeJS.WritableStream) => {
    return pipelineResponse(promise, destination);
  };

  return promise as ResponsePromise;
}
