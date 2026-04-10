// Ghost Protocols — Auth Client
// Backend authentication integration for Sentra Assist
// Uses unified auth-store as single source of truth for session.

import { createLogger } from '~/utils/logger';
import {
  isAuthenticated as checkAuthenticated,
  clearSession as clearAuthStore,
  getSession,
  storeSession,
  type AuthSession,
  type AuthTokens,
  type AuthUser,
} from './auth-store';

const log = createLogger('AuthClient', 'background');

// ============================================================================
// TYPES (re-export from auth-store for backwards compatibility)
// ============================================================================

export type { AuthSession, AuthTokens, AuthUser };

export interface AuthCredentials {
  username: string;
  password: string;
}

export interface AuthResponse {
  success: boolean;
  session?: AuthSession;
  error?: {
    code: string;
    message: string;
  };
}

// ============================================================================
// CONFIG
// ============================================================================

const AUTH_CONFIG_KEY = 'sentra:auth-config';

// Primary: Crew Dashboard API
const DEFAULT_AUTH_BASE_URL = 'https://crew.puskesmasbalowerti.com';
const COOKIE_SESSION_ACCESS_TOKEN = 'cookie-session';
const COOKIE_SESSION_REFRESH_TOKEN = 'cookie-session';

interface AuthConfig {
  baseUrl: string;
  automationToken: string;
}

type DashboardSessionResponse = {
  ok: boolean;
  user?: {
    username?: string;
    displayName?: string;
    role?: string;
    institution?: string;
    profession?: string;
  };
  expiresAt?: string | number;
  error?: string;
};

const DEFAULT_CONFIG: AuthConfig = {
  baseUrl: DEFAULT_AUTH_BASE_URL,
  automationToken: '',
};

function isSyntheticLocalSession(session: AuthSession): boolean {
  const accessToken = session.tokens.accessToken;
  return (
    accessToken.startsWith('dev-token-') ||
    accessToken.startsWith('offline-token-') ||
    accessToken.startsWith('fallback-token-')
  );
}

// ============================================================================
// CONFIG MANAGEMENT
// ============================================================================

export async function getAuthConfig(): Promise<AuthConfig> {
  try {
    const raw = await browser.storage.local.get(AUTH_CONFIG_KEY);
    const stored = raw[AUTH_CONFIG_KEY] as Partial<AuthConfig> | undefined;
    if (!stored) return DEFAULT_CONFIG;

    return {
      baseUrl: stored.baseUrl?.trim() || DEFAULT_CONFIG.baseUrl,
      automationToken: stored.automationToken?.trim() || DEFAULT_CONFIG.automationToken,
    };
  } catch (e) {
    log.warn('[AuthClient] Failed to load config:', e);
    return DEFAULT_CONFIG;
  }
}

export async function saveAuthConfig(config: Partial<AuthConfig>): Promise<AuthConfig> {
  const current = await getAuthConfig();
  const updated = {
    ...current,
    ...config,
    baseUrl: config.baseUrl?.trim() || current.baseUrl,
    automationToken: config.automationToken?.trim() || '',
  };
  await browser.storage.local.set({ [AUTH_CONFIG_KEY]: updated });
  const existingSession = await getSession();
  if (existingSession) {
    await storeSession({
      ...existingSession,
      serverBaseUrl: updated.baseUrl,
    });
  }
  return updated;
}

// ============================================================================
// SESSION MANAGEMENT — delegates to unified auth-store
// ============================================================================

export async function getStoredSession(): Promise<AuthSession | null> {
  const session = await getSession();
  if (!session) return null;

  // Check token expiration (with 5 min buffer)
  if (session.tokens.expiresAt < Date.now() + 5 * 60 * 1000) {
    log.debug('[AuthClient] Session expired');
    await clearAuthStore();
    return null;
  }

  if (isSyntheticLocalSession(session)) {
    log.warn('[AuthClient] Rejecting legacy synthetic local session');
    await clearAuthStore();
    return null;
  }

  // Cookie-backed sessions: skip re-verification via Dashboard ping.
  // verifyDashboardSession() calls /api/auth/session with credentials:include,
  // which does not work cross-origin from a Chrome extension context —
  // cookies are not forwarded and the check always fails, clearing valid sessions.
  // The session was already verified at login time; expiry check above is sufficient.

  return session;
}

export async function saveSession(session: AuthSession): Promise<void> {
  await storeSession(session);
  log.debug('[AuthClient] Session saved for user:', session.user.username);
}

export async function clearSession(): Promise<void> {
  await clearAuthStore();
  log.debug('[AuthClient] Session cleared');
}

export async function isAuthenticated(): Promise<boolean> {
  const session = await getStoredSession();
  if (!session) return false;
  return checkAuthenticated();
}

// ============================================================================
// HTTP CLIENT
// ============================================================================

async function authFetch<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<
  { success: true; data: T } | { success: false; error: { code: string; message: string } }
> {
  const config = await getAuthConfig();
  const url = `${config.baseUrl.replace(/\/$/, '')}${endpoint}`;

  const correlationId = `auth-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

  log.debug(`[AuthFetch] ${options.method || 'GET'} ${url}`, { correlationId });

  try {
    const response = await fetch(url, {
      ...options,
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'X-Correlation-Id': correlationId,
        ...options.headers,
      },
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      log.error(`[AuthFetch] ${response.status}: ${errorText}`, { correlationId });

      return {
        success: false,
        error: {
          code: `HTTP_${response.status}`,
          message: parseErrorMessage(response.status, errorText),
        },
      };
    }

    const data = await response.json();
    return { success: true, data };
  } catch (error) {
    log.error('[AuthFetch] Network error:', error);
    return {
      success: false,
      error: {
        code: 'NETWORK_ERROR',
        message: 'Tidak dapat terhubung ke server. Periksa koneksi internet Anda.',
      },
    };
  }
}

function normalizeRole(role: unknown): AuthUser['role'] {
  const normalized = String(role ?? '')
    .trim()
    .toLowerCase();
  if (normalized === 'admin') return 'admin';
  if (normalized === 'nurse' || normalized === 'perawat') return 'nurse';
  return 'doctor';
}

function toExpiryTimestamp(expiresAt: string | number | undefined): number {
  if (typeof expiresAt === 'number' && Number.isFinite(expiresAt)) {
    // Unix seconds (< 1e10) → convert to ms. Already-ms values pass through.
    return expiresAt < 1e10 ? expiresAt * 1000 : expiresAt;
  }
  if (typeof expiresAt === 'string') {
    const parsed = Date.parse(expiresAt);
    if (!Number.isNaN(parsed)) return parsed;
  }
  return Date.now() + 12 * 60 * 60 * 1000;
}

function createCookieBackedSession(
  payload: NonNullable<DashboardSessionResponse['user']>,
  baseUrl: string,
  expiresAt: string | number | undefined
): AuthSession {
  const username = String(payload.username ?? '')
    .trim()
    .toLowerCase();
  const facilityName = String(payload.institution ?? 'Crew Dashboard').trim() || 'Crew Dashboard';
  const profession = String(payload.profession ?? '').trim() || 'Umum';

  return {
    user: {
      id: username || `crew-${Date.now()}`,
      username: username || 'crew',
      name: String(payload.displayName ?? username).trim() || username || 'Crew',
      role: normalizeRole(payload.role),
      facilityId: facilityName.toUpperCase().replace(/\s+/g, '_'),
      facilityName,
      poli: profession,
    },
    tokens: {
      accessToken: COOKIE_SESSION_ACCESS_TOKEN,
      refreshToken: COOKIE_SESSION_REFRESH_TOKEN,
      expiresAt: toExpiryTimestamp(expiresAt),
    },
    serverBaseUrl: baseUrl,
  };
}

function parseErrorMessage(status: number, text: string): string {
  try {
    const parsed = JSON.parse(text);
    if (parsed.message) return parsed.message;
    if (parsed.error) return parsed.error;
  } catch {
    // Not JSON, use text as-is
  }

  switch (status) {
    case 401:
      return 'Username atau password salah';
    case 403:
      return 'Akun tidak memiliki akses';
    case 429:
      return 'Terlalu banyak percobaan. Silakan coba lagi nanti.';
    case 500:
      return 'Terjadi kesalahan server. Silakan coba lagi.';
    default:
      return text || `Error ${status}`;
  }
}

export interface ApiBaseUrlProbeResult {
  ok: boolean;
  status: number;
  message: string;
}

export async function probeApiBaseUrl(baseUrl: string): Promise<ApiBaseUrlProbeResult> {
  const sanitizedBaseUrl = baseUrl.trim().replace(/\/$/, '');
  if (!sanitizedBaseUrl) {
    return { ok: false, status: 0, message: 'Base URL kosong.' };
  }

  const url = `${sanitizedBaseUrl}/api/auth/login`;
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: '__probe__', password: '__probe__' }),
    });

    const contentType = response.headers.get('content-type') || '';
    const rawBody = await response.text().catch(() => '');
    const body = rawBody.trim().toLowerCase();
    const htmlResponse = contentType.includes('text/html') || body.startsWith('<!doctype html');

    if (htmlResponse) {
      return {
        ok: false,
        status: response.status,
        message: 'URL ini membalas HTML (web page), bukan API JSON. Gunakan host API backend.',
      };
    }

    if (response.status === 404) {
      return {
        ok: false,
        status: response.status,
        message: 'Endpoint /api/auth/login tidak ditemukan di host ini (404).',
      };
    }

    if (response.status === 401 || response.status === 400 || response.ok) {
      return {
        ok: true,
        status: response.status,
        message: `API terjangkau (status ${response.status}).`,
      };
    }

    return {
      ok: false,
      status: response.status,
      message: `Host merespons status ${response.status}. Periksa gateway/API route.`,
    };
  } catch {
    return {
      ok: false,
      status: 0,
      message: 'Tidak dapat menjangkau host API. Periksa URL/jaringan.',
    };
  }
}

// ============================================================================
// AUTH API
// ============================================================================

/**
 * Login with credentials against Dashboard server auth.
 */
export async function login(credentials: AuthCredentials): Promise<AuthResponse> {
  const normalizedCredentials: AuthCredentials = {
    username: credentials.username.trim(),
    password: credentials.password,
  };

  const config = await getAuthConfig();

  const result = await authFetch<{
    ok?: boolean;
    user?: DashboardSessionResponse['user'];
    tokens?: AuthTokens;
    expiresAt?: string | number;
  }>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify(normalizedCredentials),
  });

  if (!result.success) return { success: false, error: result.error };

  const dashboardUser = result.data.user;
  if (!dashboardUser) {
    return {
      success: false,
      error: {
        code: 'INVALID_LOGIN_RESPONSE',
        message: 'Respons login server tidak memuat profil pengguna.',
      },
    };
  }

  const session = createCookieBackedSession(dashboardUser, config.baseUrl, result.data.expiresAt);

  await saveSession(session);

  return { success: true, session };
}

/**
 * Logout - clear session and optionally invalidate token on server
 */
export async function logout(): Promise<void> {
  const session = await getStoredSession();

  if (session) {
    try {
      await fetch(`${session.serverBaseUrl.replace(/\/$/, '')}/api/auth/logout`, {
        method: 'POST',
        credentials: 'include',
      });
    } catch {
      // Ignore errors during logout
    }
  }

  await clearSession();
}

/**
 * Refresh access token using refresh token
 */
export async function refreshToken(): Promise<AuthResponse> {
  const session = await getStoredSession();
  if (!session) {
    return {
      success: false,
      error: { code: 'NO_SESSION', message: 'Tidak ada sesi aktif' },
    };
  }

  if (
    session.tokens.accessToken === COOKIE_SESSION_ACCESS_TOKEN &&
    session.tokens.refreshToken === COOKIE_SESSION_REFRESH_TOKEN
  ) {
    try {
      const response = await fetch(`${session.serverBaseUrl.replace(/\/$/, '')}/api/auth/session`, {
        method: 'GET',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        await clearSession();
        return {
          success: false,
          error: {
            code: 'NO_SESSION',
            message: 'Sesi Dashboard tidak aktif. Login ulang diperlukan.',
          },
        };
      }

      const data = (await response.json()) as DashboardSessionResponse;
      if (!data.ok || !data.user) {
        await clearSession();
        return {
          success: false,
          error: {
            code: 'INVALID_SESSION_RESPONSE',
            message: 'Respons sesi Dashboard tidak valid.',
          },
        };
      }

      const refreshedSession = createCookieBackedSession(
        data.user,
        session.serverBaseUrl,
        data.expiresAt
      );
      await saveSession(refreshedSession);
      return { success: true, session: refreshedSession };
    } catch {
      return {
        success: false,
        error: {
          code: 'NETWORK_ERROR',
          message: 'Tidak dapat memverifikasi sesi Dashboard. Periksa koneksi.',
        },
      };
    }
  }

  const result = await authFetch<{
    tokens: AuthTokens;
  }>('/api/auth/refresh', {
    method: 'POST',
    body: JSON.stringify({ refreshToken: session.tokens.refreshToken }),
  });

  if (!result.success) {
    // Clear invalid session
    await clearSession();
    return { success: false, error: result.error };
  }

  const refreshedSession: AuthSession = {
    user: session.user,
    tokens: result.data.tokens,
    serverBaseUrl: session.serverBaseUrl || (await getAuthConfig()).baseUrl,
  };

  await saveSession(refreshedSession);

  return { success: true, session: refreshedSession };
}

/**
 * Get current authenticated user
 */
export async function getCurrentUser(): Promise<AuthUser | null> {
  const session = await getStoredSession();
  return session?.user || null;
}

// ============================================================================
// AUTH PROVIDER FOR REACT
// ============================================================================

export const AuthClient = {
  login,
  logout,
  refreshToken,
  getCurrentUser,
  isAuthenticated,
  getStoredSession,
  saveSession,
  clearSession,
  getAuthConfig,
  saveAuthConfig,
};

export default AuthClient;
