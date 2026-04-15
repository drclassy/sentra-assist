// Ghost Protocols — Unified Auth Store
// Single source of truth for auth session across all extension contexts.
// Dual-layer: chrome.storage.session (RAM, secure) + chrome.storage.local (persist across browser restart).

import { createLogger } from '~/utils/logger';

const log = createLogger('AuthStore', 'background');

// ============================================================================
// KEYS
// ============================================================================

const SESSION_KEY = 'sentra:active-session';
const PERSIST_KEY = 'sentra:persisted-session';

// ============================================================================
// TYPES
// ============================================================================

export interface AuthUser {
  id: string;
  username: string;
  name: string;
  role: 'doctor' | 'nurse' | 'admin';
  facilityId: string;
  facilityName: string;
  poli?: string;
}

/**
 * AuthTokens interface
 * 
 * @remarks
 * TODO: Add type description and property documentation
 * Auto-generated on 2026-04-15
 */

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

/**
 * AuthSession interface
 * 
 * @remarks
 * TODO: Add type description and property documentation
 * Auto-generated on 2026-04-15
 */

export interface AuthSession {
  user: AuthUser;
  tokens: AuthTokens;
  serverBaseUrl: string;
}

// ============================================================================
// WRITE — dual-layer store
// ============================================================================

export async function storeSession(session: AuthSession): Promise<void> {
  try {
    await browser.storage.session.set({ [SESSION_KEY]: session });
  } catch (e) {
    log.warn('[AuthStore] session storage write failed (expected in content script)', e);
  }

  try {
    await browser.storage.local.set({ [PERSIST_KEY]: session });
  } catch (e) {
    log.warn('[AuthStore] local storage write failed', e);
  }

  log.debug('[AuthStore] Session stored for:', session.user.username);
}

// ============================================================================
// READ — session first (fast/secure), local fallback (persist)
// ============================================================================

export async function getSession(): Promise<AuthSession | null> {
  // Try in-memory session storage first
  try {
    const mem = await browser.storage.session.get(SESSION_KEY);
    const session = mem[SESSION_KEY] as AuthSession | undefined;

    if (session?.tokens?.accessToken) {
      return session;
    }
  } catch {
    // session storage not available in this context — fall through
  }

  // Fallback to persisted local storage
  try {
    const disk = await browser.storage.local.get(PERSIST_KEY);
    const persisted = disk[PERSIST_KEY] as AuthSession | undefined;

    if (persisted?.tokens?.accessToken) {
      // Re-promote to session storage for faster reads
      try {
        await browser.storage.session.set({ [SESSION_KEY]: persisted });
      } catch {
        // Best effort — session storage may not be available
      }
      return persisted;
    }
  } catch (e) {
    log.warn('[AuthStore] Failed to read persisted session', e);
  }

  return null;
}

// ============================================================================
// CLEAR
// ============================================================================

export async function clearSession(): Promise<void> {
  try {
    await browser.storage.session.remove(SESSION_KEY);
  } catch {
    // May not be available
  }

  try {
    await browser.storage.local.remove(PERSIST_KEY);
  } catch (e) {
    log.warn('[AuthStore] Failed to clear persisted session', e);
  }

  log.debug('[AuthStore] Session cleared');
}

// ============================================================================
// HELPERS
// ============================================================================

export async function isAuthenticated(): Promise<boolean> {
  const session = await getSession();
  if (!session) return false;

  // Check token expiration (with 1 min buffer)
  return session.tokens.expiresAt > Date.now() + 60_000;
}

/**
 * getAccessToken
 * 
 * @remarks
 * TODO: Add detailed description, parameters, and examples
 * Auto-generated on 2026-04-15
 */

export async function getAccessToken(): Promise<string | null> {
  const session = await getSession();
  return session?.tokens?.accessToken ?? null;
}

/**
 * getServerBaseUrl
 * 
 * @remarks
 * TODO: Add detailed description, parameters, and examples
 * Auto-generated on 2026-04-15
 */

export async function getServerBaseUrl(): Promise<string | null> {
  const session = await getSession();
  return session?.serverBaseUrl ?? null;
}

/** Storage key constants — used by background.ts to listen for changes */
export const AUTH_STORE_KEYS = {
  session: SESSION_KEY,
  persisted: PERSIST_KEY,
} as const;
