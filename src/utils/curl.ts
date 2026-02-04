import type { Request } from 'undici';

/**
 * Generates a curl command from a Request object.
 */
export function generateCurlCommand(request: Request): string {
  const parts = ['curl'];

  parts.push(`-X ${request.method}`);

  const headers = request.headers;
  for (const [key, value] of headers.entries()) {
    parts.push(`-H "${key}: ${value}"`);
  }

  // undici.Request doesn't easily expose body for reading if it's already a stream or blob
  // but we might be able to get it if it was passed as string/json in options.
  // For now, let's just do URL and headers.

  parts.push(`"${request.url}"`);

  return parts.join(' ');
}
