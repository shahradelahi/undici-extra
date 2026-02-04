import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import type { Response } from 'undici';

/**
 * Converts a Web ReadableStream to a Node.js Readable stream.
 * Handles null bodies by returning an empty stream.
 */
export const toNodeStream = (body: any): Readable => {
  if (!body) {
    return Readable.from([]);
  }
  return Readable.fromWeb(body);
};

/**
 * Pipes a ResponsePromise body to a Node.js Writable stream.
 * Uses stream.pipeline for proper error propagation and cleanup.
 */
export async function pipelineResponse(
  responsePromise: Promise<Response>,
  destination: NodeJS.WritableStream
): Promise<void> {
  const response = await responsePromise;
  await pipeline(toNodeStream(response.body), destination);
}
