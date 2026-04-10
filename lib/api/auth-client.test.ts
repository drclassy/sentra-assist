import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getSessionMock, clearSessionMock, isAuthenticatedMock, storeSessionMock } = vi.hoisted(
  () => ({
    getSessionMock: vi.fn(),
    clearSessionMock: vi.fn(),
    isAuthenticatedMock: vi.fn(async () => true),
    storeSessionMock: vi.fn(),
  })
);

vi.mock('./auth-store', () => ({
  getSession: getSessionMock,
  clearSession: clearSessionMock,
  isAuthenticated: isAuthenticatedMock,
  storeSession: storeSessionMock,
}));

import { getStoredSession } from './auth-client';

const browserStorageGet = vi.fn();
const fetchMock = vi.fn();

beforeEach(() => {
  getSessionMock.mockReset();
  clearSessionMock.mockReset();
  isAuthenticatedMock.mockReset();
  isAuthenticatedMock.mockResolvedValue(true);
  storeSessionMock.mockReset();
  browserStorageGet.mockReset();
  fetchMock.mockReset();

  (
    globalThis as typeof globalThis & {
      browser?: {
        storage: {
          local: {
            get: typeof browserStorageGet;
          };
        };
      };
    }
  ).browser = {
    storage: {
      local: {
        get: browserStorageGet,
      },
    },
  };

  globalThis.fetch = fetchMock as typeof fetch;
});

describe('getStoredSession bootstrap hardening', () => {
  it('rejects synthetic fallback session because server auth is the only accepted source', async () => {
    getSessionMock.mockResolvedValue({
      user: {
        id: 'fallback-offline',
        username: 'offline',
        name: 'offline',
        role: 'doctor',
        facilityId: 'PUSKESMAS_BALOWERTI',
        facilityName: 'Puskesmas Balowerti',
        poli: 'Umum',
      },
      tokens: {
        accessToken: 'fallback-token-1',
        refreshToken: 'fallback-refresh-1',
        expiresAt: Date.now() + 60 * 60 * 1000,
      },
      serverBaseUrl: 'https://crew.puskesmasbalowerti.com',
    });
    browserStorageGet.mockResolvedValue({
      'sentra:auth-config': {
        baseUrl: 'https://crew.puskesmasbalowerti.com',
        automationToken: '',
      },
    });

    await expect(getStoredSession()).resolves.toBeNull();
    expect(clearSessionMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('accepts cookie-backed session without dashboard re-verification', async () => {
    getSessionMock.mockResolvedValue({
      user: {
        id: 'dr-ferdi',
        username: 'dr.ferdi',
        name: 'dr. Ferdi Iskandar',
        role: 'doctor',
        facilityId: 'PUSKESMAS_BALOWERTI',
        facilityName: 'Puskesmas Balowerti',
        poli: 'Umum',
      },
      tokens: {
        accessToken: 'cookie-session',
        refreshToken: 'cookie-session',
        expiresAt: Date.now() + 60 * 60 * 1000,
      },
      serverBaseUrl: 'https://crew.puskesmasbalowerti.com',
    });

    await expect(getStoredSession()).resolves.toMatchObject({
      user: { username: 'dr.ferdi' },
      tokens: { accessToken: 'cookie-session' },
    });
    expect(clearSessionMock).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('clears cookie-backed session when it has expired', async () => {
    getSessionMock.mockResolvedValue({
      user: {
        id: 'dr-ferdi',
        username: 'dr.ferdi',
        name: 'dr. Ferdi Iskandar',
        role: 'doctor',
        facilityId: 'PUSKESMAS_BALOWERTI',
        facilityName: 'Puskesmas Balowerti',
        poli: 'Umum',
      },
      tokens: {
        accessToken: 'cookie-session',
        refreshToken: 'cookie-session',
        expiresAt: Date.now() - 1000,
      },
      serverBaseUrl: 'https://crew.puskesmasbalowerti.com',
    });

    await expect(getStoredSession()).resolves.toBeNull();
    expect(clearSessionMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
