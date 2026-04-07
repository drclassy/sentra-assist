// Ghost Protocols — Auth Client
// Backend authentication integration for Sentra Assist
// Uses unified auth-store as single source of truth for session.

import { createLogger } from '~/utils/logger';
import {
  storeSession,
  getSession,
  clearSession as clearAuthStore,
  isAuthenticated as checkAuthenticated,
  type AuthUser,
  type AuthTokens,
  type AuthSession,
} from './auth-store';

const log = createLogger('AuthClient', 'background');

// ============================================================================
// TYPES (re-export from auth-store for backwards compatibility)
// ============================================================================

export type { AuthUser, AuthTokens, AuthSession };

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
// Fallback: Local storage auth (development)
const DEFAULT_AUTH_BASE_URL = 'https://crew.puskesmasbalowerti.com';

interface AuthConfig {
  baseUrl: string;
  enableOfflineMode: boolean;
}

const DEFAULT_CONFIG: AuthConfig = {
  baseUrl: DEFAULT_AUTH_BASE_URL,
  enableOfflineMode: false,
};

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
      enableOfflineMode: typeof stored.enableOfflineMode === 'boolean' 
        ? stored.enableOfflineMode 
        : DEFAULT_CONFIG.enableOfflineMode,
    };
  } catch (e) {
    log.warn('[AuthClient] Failed to load config:', e);
    return DEFAULT_CONFIG;
  }
}

export async function saveAuthConfig(config: Partial<AuthConfig>): Promise<AuthConfig> {
  const current = await getAuthConfig();
  const updated = { ...current, ...config };
  await browser.storage.local.set({ [AUTH_CONFIG_KEY]: updated });
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
    return null;
  }

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
  return checkAuthenticated();
}

// ============================================================================
// HTTP CLIENT
// ============================================================================

async function authFetch<T>(
  endpoint: string, 
  options: RequestInit = {}
): Promise<{ success: true; data: T } | { success: false; error: { code: string; message: string } }> {
  const config = await getAuthConfig();
  const url = `${config.baseUrl.replace(/\/$/, '')}${endpoint}`;
  
  const correlationId = `auth-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  
  log.debug(`[AuthFetch] ${options.method || 'GET'} ${url}`, { correlationId });
  
  try {
    const response = await fetch(url, {
      ...options,
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

function parseErrorMessage(status: number, text: string): string {
  try {
    const parsed = JSON.parse(text);
    if (parsed.message) return parsed.message;
    if (parsed.error) return parsed.error;
  } catch {
    // Not JSON, use text as-is
  }
  
  switch (status) {
    case 401: return 'Username atau password salah';
    case 403: return 'Akun tidak memiliki akses';
    case 429: return 'Terlalu banyak percobaan. Silakan coba lagi nanti.';
    case 500: return 'Terjadi kesalahan server. Silakan coba lagi.';
    default: return text || `Error ${status}`;
  }
}

// ============================================================================
// AUTH API
// ============================================================================

/**
 * Login with credentials
 * Supports both online (Crew Dashboard) and offline (development) modes
 */
export async function login(credentials: AuthCredentials): Promise<AuthResponse> {
  const config = await getAuthConfig();
  
  // Offline mode for development
  if (config.enableOfflineMode) {
    return handleOfflineLogin(credentials);
  }
  
  // Online mode - call Crew Dashboard API
  const result = await authFetch<{
    user: AuthUser;
    tokens: AuthTokens;
  }>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify(credentials),
  });
  
  if (!result.success) {
    return { success: false, error: result.error };
  }

  const session: AuthSession = {
    user: result.data.user,
    tokens: result.data.tokens,
    serverBaseUrl: config.baseUrl,
  };

  await saveSession(session);

  return { success: true, session };
}

/**
 * Logout - clear session and optionally invalidate token on server
 */
export async function logout(): Promise<void> {
  const session = await getStoredSession();
  
  if (session) {
    // Try to invalidate token on server (best effort)
    const config = await getAuthConfig();
    if (!config.enableOfflineMode) {
      try {
        await fetch(`${config.baseUrl}/api/auth/logout`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.tokens.accessToken}`,
          },
        });
      } catch {
        // Ignore errors during logout
      }
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
  
  const config = await getAuthConfig();
  
  if (config.enableOfflineMode) {
    // In offline mode, just extend the session
    const extendedSession: AuthSession = {
      ...session,
      serverBaseUrl: session.serverBaseUrl || config.baseUrl,
      tokens: {
        ...session.tokens,
        expiresAt: Date.now() + 24 * 60 * 60 * 1000, // +24 hours
      },
    };
    await saveSession(extendedSession);
    return { success: true, session: extendedSession };
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
// OFFLINE MODE (Development)
// ============================================================================

const DEV_USERS: Record<string, { password: string; user: AuthUser }> = {
  'admin': {
    password: 'sentra123',
    user: {
      id: 'dev-admin-001',
      username: 'admin',
      name: 'Administrator Sentra',
      role: 'admin',
      facilityId: 'PUSKESMAS_BALOWERTI',
      facilityName: 'Puskesmas Balowerti',
    },
  },
  'dr.ferdi': {
    password: 'sentra123',
    user: {
      id: 'dev-doc-001',
      username: 'dr.ferdi',
      name: 'dr. Ferdi Iskandar',
      role: 'doctor',
      facilityId: 'PUSKESMAS_BALOWERTI',
      facilityName: 'Puskesmas Balowerti',
      poli: 'Umum',
    },
  },
  'perawat': {
    password: 'sentra123',
    user: {
      id: 'dev-nurse-001',
      username: 'perawat',
      name: 'Perawat Sentra',
      role: 'nurse',
      facilityId: 'PUSKESMAS_BALOWERTI',
      facilityName: 'Puskesmas Balowerti',
    },
  },
};

async function handleOfflineLogin(credentials: AuthCredentials): Promise<AuthResponse> {
  const devUser = DEV_USERS[credentials.username.toLowerCase()];
  
  if (!devUser || devUser.password !== credentials.password) {
    // Add small delay to simulate network
    await new Promise(r => setTimeout(r, 500));
    
    return {
      success: false,
      error: { code: 'INVALID_CREDENTIALS', message: 'Username atau password salah' },
    };
  }
  
  const config = await getAuthConfig();
  const session: AuthSession = {
    user: devUser.user,
    tokens: {
      accessToken: `dev-token-${Date.now()}`,
      refreshToken: `dev-refresh-${Date.now()}`,
      expiresAt: Date.now() + 24 * 60 * 60 * 1000, // 24 hours
    },
    serverBaseUrl: config.baseUrl,
  };

  await saveSession(session);
  
  return { success: true, session };
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
