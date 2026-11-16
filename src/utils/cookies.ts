import type { CookiesOption, CookiesRecord, CookieStore } from '../types/options';

export type { CookiesOption };

/**
 * Checks if a value implements the `CookieStore` interface.
 */
export function isCookieStore(value: unknown): value is CookieStore {
  return (
    typeof value === 'object' &&
    value !== null &&
    'getCookieHeader' in value &&
    typeof (value as any).getCookieHeader === 'function' &&
    'setFromResponse' in value &&
    typeof (value as any).setFromResponse === 'function'
  );
}

/**
 * Checks if a value represents a cookie file path (`string | URL`).
 */
export function isCookieFilePath(value: unknown): value is string | URL {
  return typeof value === 'string' || value instanceof URL;
}

/**
 * Checks if a value is a key-value object of cookie pairs.
 */
export function isCookiesRecord(value: unknown): value is CookiesRecord {
  return (
    typeof value === 'object' && value !== null && !isCookieStore(value) && !(value instanceof URL)
  );
}

/**
 * Serializes a structured key-value cookie object into a `Cookie` header string.
 *
 * @example
 * ```ts
 * const header = serializeCookiesRecord({ session: '123', theme: 'dark' });
 * // -> "session=123; theme=dark"
 * ```
 */
export function serializeCookiesRecord(record: CookiesRecord): string {
  const pairs: string[] = [];
  for (const [name, value] of Object.entries(record)) {
    if (value === undefined || value === null) continue;
    pairs.push(`${name}=${String(value)}`);
  }
  return pairs.join('; ');
}

/**
 * Merges multiple `Cookie` header strings, overriding duplicate cookie names.
 *
 * @example
 * ```ts
 * const header = mergeCookieHeaders('a=1; b=2', 'b=3; c=4');
 * // -> "a=1; b=3; c=4"
 * ```
 */
export function mergeCookieHeaders(
  ...sources: Array<string | undefined | null>
): string | undefined {
  const map = new Map<string, string>();

  for (const source of sources) {
    if (!source) continue;
    for (const part of source.split(';')) {
      const trimmed = part.trim();
      if (!trimmed) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx === -1) continue;
      const name = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim();
      if (name) {
        map.set(name, val);
      }
    }
  }

  if (map.size === 0) return undefined;
  return Array.from(map.entries(), ([name, val]) => `${name}=${val}`).join('; ');
}
