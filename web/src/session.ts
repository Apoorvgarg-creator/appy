import { RequestError } from './api.ts';
import type { ControllerSession, PairBrowser } from './generated/api.ts';

export type SessionRequest = <T>(path: string, body?: unknown, options?: { ephemeral?: boolean }) => Promise<T>;

/** A lost response may still have installed the cookie. Read status before asking for another code. */
export async function pairBrowser(request: SessionRequest, body: PairBrowser): Promise<ControllerSession> {
  try {
    return await request<ControllerSession>('/api/v1/session', body, { ephemeral: true });
  } catch (cause) {
    if (cause instanceof RequestError && cause.uncertain) {
      try {
        const current = await request<ControllerSession>('/api/v1/session');
        if (current.authenticated) return current;
      } catch { /* Preserve the original uncertainty; never repeat the pairing mutation. */ }
      throw new RequestError('Connection interrupted. Check the connection, then check your access before requesting a new code.');
    }
    throw cause;
  }
}
