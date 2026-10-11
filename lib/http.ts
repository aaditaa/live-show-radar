/** Shared fetch helpers: per-request timeouts, 429/5xx backoff, bounded concurrency. */

export const DEFAULT_TIMEOUT_MS = 10_000;

export class HttpError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

function retryDelayMs(attempt: number, retryAfterHeader: string | null): number {
  // Honour Retry-After when the server sends one, otherwise exponential backoff.
  if (retryAfterHeader) {
    const seconds = Number(retryAfterHeader);
    if (Number.isFinite(seconds) && seconds >= 0) return Math.min(seconds * 1000, 20_000);
    const date = Date.parse(retryAfterHeader);
    if (!Number.isNaN(date)) return Math.min(Math.max(date - Date.now(), 0), 20_000);
  }
  return Math.min(500 * 2 ** attempt, 8_000);
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Fetch with a hard timeout. Retries on 429 and 5xx with backoff; a 4xx other
 * than 429 is returned to the caller rather than retried, since it will not fix
 * itself (bad key, bad query).
 */
export async function fetchWithRetry(
  url: string,
  init: RequestInit = {},
  options: { timeoutMs?: number; retries?: number; label?: string } = {},
): Promise<Response> {
  const { timeoutMs = DEFAULT_TIMEOUT_MS, retries = 2, label = url } = options;

  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const response = await fetch(url, {
        ...init,
        signal: AbortSignal.timeout(timeoutMs),
      });

      if (response.status === 429 || response.status >= 500) {
        if (attempt === retries) {
          throw new HttpError(`${label}: HTTP ${response.status}`, response.status);
        }
        await sleep(retryDelayMs(attempt, response.headers.get('retry-after')));
        continue;
      }

      return response;
    } catch (error) {
      lastError = error;
      const isTimeout = error instanceof Error && error.name === 'TimeoutError';
      const isHttp = error instanceof HttpError;
      if (attempt === retries) break;
      // Network blips and timeouts are worth one more try; hard HTTP errors are not.
      if (isHttp && error.status && error.status < 500 && error.status !== 429) break;
      if (!isTimeout && !isHttp && !(error instanceof TypeError)) break;
      await sleep(retryDelayMs(attempt, null));
    }
  }

  if (lastError instanceof Error) throw lastError;
  throw new HttpError(`${label}: request failed`);
}

/**
 * Run tasks with at most `limit` in flight. Rejections are returned as results
 * so one bad source can never reject the whole batch.
 */
export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<PromiseSettledResult<R>[]> {
  const results: PromiseSettledResult<R>[] = new Array(items.length);
  let cursor = 0;

  async function run(): Promise<void> {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      try {
        results[index] = { status: 'fulfilled', value: await worker(items[index], index) };
      } catch (reason) {
        results[index] = { status: 'rejected', reason };
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run));
  return results;
}

export function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}
