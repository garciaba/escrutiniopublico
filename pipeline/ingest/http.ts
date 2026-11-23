/**
 * Polite HTTP client for the Congreso website: one request at a time, a minimum
 * interval between requests, a fixed User-Agent and retries with exponential backoff.
 * Clock, sleep and fetch are injectable so the behaviour is testable without network.
 */

export interface HttpOptions {
  userAgent: string;
  minIntervalMs: number;
  retries: number;
  backoffBaseMs: number;
  timeoutMs: number;
}

export interface HttpDeps {
  fetch: typeof fetch;
  sleep: (ms: number) => Promise<void>;
  now: () => number;
}

export interface HttpResponse {
  url: string;
  status: number;
  headers: Headers;
  body: Uint8Array;
}

export class HttpError extends Error {
  readonly url: string;
  readonly status: number | undefined;

  constructor(message: string, url: string, status?: number) {
    super(message);
    this.name = 'HttpError';
    this.url = url;
    this.status = status;
  }
}

const defaultDeps: HttpDeps = {
  fetch: (input, init) => fetch(input, init),
  sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  now: () => Date.now(),
};

/** Statuses worth retrying: rate limiting and transient server errors. */
function isRetryable(status: number): boolean {
  return status === 408 || status === 429 || status >= 500;
}

export class PoliteClient {
  private readonly options: HttpOptions;
  private readonly deps: HttpDeps;
  private lastRequestAt: number | undefined;

  constructor(options: HttpOptions, deps: Partial<HttpDeps> = {}) {
    this.options = options;
    this.deps = { ...defaultDeps, ...deps };
  }

  async get(url: string): Promise<HttpResponse> {
    return this.request(url, { method: 'GET' });
  }

  async postForm(url: string, form: Record<string, string>): Promise<HttpResponse> {
    return this.request(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
      body: new URLSearchParams(form).toString(),
    });
  }

  private async throttle(): Promise<void> {
    if (this.lastRequestAt !== undefined) {
      const wait = this.lastRequestAt + this.options.minIntervalMs - this.deps.now();
      if (wait > 0) await this.deps.sleep(wait);
    }
    this.lastRequestAt = this.deps.now();
  }

  private async request(
    url: string,
    init: { method: string; headers?: Record<string, string>; body?: string },
  ): Promise<HttpResponse> {
    let lastError: HttpError | undefined;
    for (let attempt = 0; attempt <= this.options.retries; attempt++) {
      if (attempt > 0) {
        await this.deps.sleep(this.options.backoffBaseMs * 2 ** (attempt - 1));
      }
      await this.throttle();
      try {
        const response = await this.deps.fetch(url, {
          ...init,
          headers: { ...init.headers, 'User-Agent': this.options.userAgent },
          redirect: 'follow',
          signal: AbortSignal.timeout(this.options.timeoutMs),
        });
        if (response.ok) {
          return {
            url: response.url || url,
            status: response.status,
            headers: response.headers,
            body: new Uint8Array(await response.arrayBuffer()),
          };
        }
        lastError = new HttpError(`HTTP ${response.status} for ${url}`, url, response.status);
        if (!isRetryable(response.status)) throw lastError;
      } catch (error) {
        if (error instanceof HttpError && error.status !== undefined && !isRetryable(error.status)) {
          throw error;
        }
        lastError =
          error instanceof HttpError ? error : new HttpError(`Network error for ${url}: ${String(error)}`, url);
      }
    }
    throw lastError ?? new HttpError(`Request failed for ${url}`, url);
  }
}
