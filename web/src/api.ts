import type { Error as APIError } from './generated/api';

export class RequestError extends Error {
  readonly status: number;
  readonly uncertain: boolean;

  constructor(message: string, status = 0) {
    super(message);
    this.name = 'RequestError';
    this.status = status;
    this.uncertain = status === 0 || status >= 500;
  }
}

/** Retain the exact operation key after an uncertain response. Never auto-retry a mutation. */
export const SESSION_EXPIRED_EVENT = 'appy:session-expired';

export function createClient(fetcher: typeof fetch = fetch, keyFactory: () => string = () => crypto.randomUUID(), onUnauthorized: () => void = () => {}) {
  const pending = new Map<string, string>();
  let generation = 0;

  async function request<T>(path: string, body?: unknown, options: { ephemeral?: boolean } = {}): Promise<T> {
    const stamp = generation;
    const encoded = body === undefined ? undefined : JSON.stringify(body);
    const fingerprint = `${path}\n${encoded ?? ''}`;
    let key: string | undefined;
    if (encoded !== undefined && !options.ephemeral) {
      key = pending.get(fingerprint) ?? keyFactory();
      pending.set(fingerprint, key);
    }
    let response: Response;
    try {
      response = await fetcher(path, {
        method: encoded === undefined ? 'GET' : 'POST',
        headers: encoded === undefined ? undefined : { 'Content-Type': 'application/json', ...(key ? { 'Idempotency-Key': key } : {}) },
        body: encoded,
        cache: 'no-store',
        credentials: 'same-origin',
        signal: AbortSignal.timeout(8000),
      });
    } catch {
      throw new RequestError(encoded === undefined
        ? 'Can’t reach your Mac. Check your connection and that Appy is running.'
        : 'The server did not confirm this action. Retry to check the same request safely.');
    }
    if (response.status === 401 && stamp === generation && !path.startsWith('/api/v1/session')) {
      generation += 1;
      pending.clear();
      onUnauthorized();
    }
    let result: T | APIError;
    try {
      result = await response.json() as T | APIError;
    } catch {
      // A lost or malformed successful response is still an uncertain mutation.
      throw new RequestError('The server returned an unreadable response. Retry the same request.');
    }
    if (!response.ok) {
      if (response.status < 500 && stamp === generation && pending.get(fingerprint) === key) pending.delete(fingerprint);
      const error = result as APIError;
      throw new RequestError(error.error?.message ?? 'The request could not be completed.', response.status);
    }
    if (stamp === generation && pending.get(fingerprint) === key) pending.delete(fingerprint);
    return result as T;
  }

  return { request, clearPending: () => { generation += 1; pending.clear(); } };
}

export const api = createClient(fetch, () => crypto.randomUUID(), () => {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
});
