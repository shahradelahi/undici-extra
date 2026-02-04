import type { Response } from 'undici';

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

  return promise as ResponsePromise;
}
