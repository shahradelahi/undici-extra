export interface RetryOptions {
  limit?: number;
  methods?: string[];
  statusCodes?: number[];
  errorCodes?: string[];
  backoffLimit?: number;
  delay?: (retryCount: number) => number;
}

export const DEFAULT_RETRY_OPTIONS: Required<RetryOptions> = {
  limit: 2,
  methods: ['get', 'put', 'head', 'delete', 'options', 'trace'],
  statusCodes: [408, 413, 429, 500, 502, 503, 504],
  errorCodes: [
    'ETIMEDOUT',
    'ECONNRESET',
    'EADDRINUSE',
    'ECONNREFUSED',
    'EPIPE',
    'ENOTFOUND',
    'ENETUNREACH',
    'EAI_AGAIN',
  ],
  backoffLimit: 1000 * 10, // 10 seconds
  delay: (retryCount) => 0.3 * 2 ** (retryCount - 1) * 1000,
};

export function normalizeRetryOptions(retry?: number | RetryOptions): RetryOptions {
  if (typeof retry === 'number') {
    return {
      ...DEFAULT_RETRY_OPTIONS,
      limit: retry,
    };
  }

  return {
    ...DEFAULT_RETRY_OPTIONS,
    ...retry,
  };
}
