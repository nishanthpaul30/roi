/**
 * JSON fetch with a bounded retry, for the metrics endpoints.
 *
 * The app is served from Cloudflare Workers, where there is no filesystem and
 * no isolate-to-isolate state: a request that lands on a cold isolate re-parses
 * the embedded CSV and serialises the whole result set, which we've measured at
 * ~10s versus under 2s warm. Such a request can fail outright, or — observed
 * against the deployment — come back as a 200 whose body is truncated part-way
 * through. Without a retry the hook that called it is left permanently empty
 * and the user has to reload the page by hand to get a second attempt.
 *
 * The body is therefore parsed *inside* the retry loop: a truncated response
 * only reveals itself at JSON.parse time, and it is exactly as transient as a
 * dropped connection, so it deserves the same second chance.
 */

class NonRetryableHttpError extends Error {
  constructor(public status: number) {
    super(`Server returned status ${status}`);
    this.name = 'NonRetryableHttpError';
  }
}

export async function fetchJsonWithRetry<T = any>(
  url: string,
  { attempts = 3, baseDelayMs = 600, signal }: { attempts?: number; baseDelayMs?: number; signal?: AbortSignal } = {}
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt < attempts; attempt++) {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');

    try {
      const res = await fetch(url, { signal });

      // 4xx is a request we got wrong — retrying just repeats the mistake.
      if (!res.ok && res.status < 500) throw new NonRetryableHttpError(res.status);
      if (!res.ok) throw new Error(`Server returned status ${res.status}`);

      // Reading and parsing the body can still fail on a response that arrived
      // with a 200 — a connection cut mid-stream looks exactly like this.
      return (await res.json()) as T;
    } catch (err) {
      if ((err as Error)?.name === 'AbortError') throw err;
      if (err instanceof NonRetryableHttpError) throw err;
      lastError = err;
    }

    if (attempt < attempts - 1) {
      // Back off so a genuinely overloaded isolate gets room, not a retry storm.
      await new Promise((resolve) => setTimeout(resolve, baseDelayMs * 2 ** attempt));
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Request failed');
}
