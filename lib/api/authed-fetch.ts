// Ghost Protocols — Authenticated Fetch
// Single wrapper for ALL API calls to Crew Dashboard.
// Reads token from auth-store, handles refresh at point-of-use.

import { createLogger } from '~/utils/logger';
import { getSession, storeSession, clearSession, type AuthSession } from './auth-store';

const log = createLogger('AuthedFetch', 'background');

// ============================================================================
// ERRORS
// ============================================================================

export class AuthRequiredError extends Error {
  constructor(message = 'Login diperlukan. Silakan login ulang.') {
    super(message);
    this.name = 'AuthRequiredError';
  }
}

export class BridgeApiError extends Error {
  status: number;

  constructor(status: number, body: string) {
    const message = parseBridgeErrorMessage(body, `Bridge API error ${status}`);
    super(message);
    this.name = 'BridgeApiError';
    this.status = status;
  }
}

function parseBridgeErrorMessage(text: string, fallback: string): string {
  if (!text.trim()) return fallback;

  try {
    const parsed = JSON.parse(text) as { error?: string; message?: string; code?: string };
    if (typeof parsed.error === 'string' && parsed.error.trim()) return parsed.error.trim();
    if (typeof parsed.message === 'string' && parsed.message.trim()) return parsed.message.trim();
    if (typeof parsed.code === 'string' && parsed.code.trim()) return parsed.code.trim();
  } catch {
    // Not JSON — use text
  }

  const capped = text.length > 500 ? `${text.slice(0, 497)}...` : text;
  return capped;
}

// ============================================================================
// TOKEN REFRESH (point-of-use, serialized)
// ============================================================================

let refreshPromise: Promise<string> | null = null;

async function refreshTokenIfNeeded(session: AuthSession): Promise<string> {
  const bufferMs = 5 * 60 * 1000; // 5 min before expiry

  if (session.tokens.expiresAt > Date.now() + bufferMs) {
    return session.tokens.accessToken; // Still valid
  }

  // Serialize concurrent refresh attempts
  if (refreshPromise) return refreshPromise;

  refreshPromise = doRefresh(session).finally(() => {
    refreshPromise = null;
  });

  return refreshPromise;
}

async function doRefresh(session: AuthSession): Promise<string> {
  // Re-read — another context may have refreshed already
  const current = await getSession();
  if (current && current.tokens.expiresAt > Date.now() + 60_000) {
    return current.tokens.accessToken;
  }

  log.debug('[AuthedFetch] Refreshing token...');

  const url = `${session.serverBaseUrl.replace(/\/$/, '')}/api/auth/refresh`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken: session.tokens.refreshToken }),
  });

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      log.warn('[AuthedFetch] Refresh rejected — clearing session');
      await clearSession();
      throw new AuthRequiredError('Sesi kedaluwarsa. Silakan login ulang.');
    }
    throw new Error(`Token refresh failed: ${response.status}`);
  }

  const data = (await response.json()) as { tokens: AuthSession['tokens'] };

  const updated: AuthSession = {
    ...session,
    tokens: data.tokens,
  };

  await storeSession(updated);
  log.debug('[AuthedFetch] Token refreshed successfully');

  return updated.tokens.accessToken;
}

// ============================================================================
// MAIN FETCH WRAPPER
// ============================================================================

export async function authedFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const session = await getSession();
  if (!session) {
    throw new AuthRequiredError();
  }

  const token = await refreshTokenIfNeeded(session);
  const baseUrl = session.serverBaseUrl.replace(/\/$/, '');
  const url = `${baseUrl}${path}`;
  const correlationId = `ghost-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

  log.debug(`[AuthedFetch] >>> ${options.method || 'GET'} ${url}`, { correlationId });

  let response: Response;

  try {
    response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'X-Crew-Access-Token': token,
        'X-Correlation-Id': correlationId,
        ...options.headers,
      },
    });
  } catch (e) {
    log.error('[AuthedFetch] Network error:', e);
    throw new Error('Tidak dapat terhubung ke server. Periksa koneksi internet.');
  }

  log.debug(`[AuthedFetch] <<< ${response.status} ${url}`, { correlationId, ok: response.ok });

  // Token rejected — attempt one refresh then retry
  if (response.status === 401) {
    log.warn('[AuthedFetch] 401 received — attempting token refresh');
    try {
      const freshSession = await getSession();
      if (freshSession) {
        const newToken = await doRefresh(freshSession);
        const retryResponse = await fetch(url, {
          ...options,
          headers: {
            'Content-Type': 'application/json',
            'X-Crew-Access-Token': newToken,
            'X-Correlation-Id': `${correlationId}-retry`,
            ...options.headers,
          },
        });

        if (retryResponse.ok) {
          return retryResponse.json() as Promise<T>;
        }
      }
    } catch {
      // Refresh failed
    }

    await clearSession();
    throw new AuthRequiredError('Sesi tidak valid. Silakan login ulang.');
  }

  if (!response.ok) {
    const errorBody = await response.text().catch(() => '');
    log.error(`[AuthedFetch] FAIL ${response.status}: ${errorBody.slice(0, 200)}`, {
      correlationId,
    });
    throw new BridgeApiError(response.status, errorBody);
  }

  return response.json() as Promise<T>;
}
