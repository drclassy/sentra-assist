import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CANONICAL_CLINICAL_ENGINE_OUTPUT_SCHEMA,
  CANONICAL_DIFFERENTIAL_OUTPUT_SCHEMA,
  BRIDGE_AUTH_REQUIRED_HINT,
  filterDoctorsForDisplay,
  getBridgeRuntimeStatus,
  getOnlineDoctors,
  isAnamnesisExtractionResult,
  isBridgeReady,
  isCanonicalClinicalEngineOutput,
  isCanonicalDifferentialOutput,
  type OnlineDoctor,
} from './bridge-client';

const browserStorageGet = vi.fn();
const fetchMock = vi.fn();

const sessionStorageGet = vi.fn().mockResolvedValue({});

function getErrorText(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

beforeEach(() => {
  browserStorageGet.mockReset();
  fetchMock.mockReset();
  sessionStorageGet.mockReset().mockResolvedValue({});
  (
    globalThis as typeof globalThis & {
      browser?: {
        storage: {
          local: { get: typeof browserStorageGet };
          session: Record<string, ReturnType<typeof vi.fn>>;
        };
      };
    }
  ).browser = {
    storage: {
      local: {
        get: browserStorageGet,
      },
      session: {
        get: sessionStorageGet,
        set: vi.fn().mockResolvedValue(undefined),
        remove: vi.fn().mockResolvedValue(undefined),
      },
    },
  };
  globalThis.fetch = fetchMock as typeof fetch;
});

function isUUIDv4(str: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(str);
}

describe('event_id generation', () => {
  it('crypto.randomUUID() produces valid UUID v4', () => {
    const id = crypto.randomUUID();
    expect(isUUIDv4(id)).toBe(true);
  });

  it('two calls to crypto.randomUUID() produce different IDs', () => {
    const a = crypto.randomUUID();
    const b = crypto.randomUUID();
    expect(a).not.toBe(b);
  });

  it('isUUIDv4 rejects non-UUIDs', () => {
    expect(isUUIDv4('not-a-uuid')).toBe(false);
    expect(isUUIDv4('')).toBe(false);
  });
});

describe('ConsultPayload screening_result type contract', () => {
  it('accepts screening_result with all fields', () => {
    const result: {
      status: 'positive' | 'negative' | 'inconclusive';
      score?: number;
      risk_level?: 'low' | 'medium' | 'high' | 'critical';
      summary?: string;
    } = {
      status: 'positive',
      score: 85,
      risk_level: 'high',
      summary: 'HTN Crisis',
    };
    expect(result.status).toBe('positive');
    expect(result.score).toBe(85);
  });
});

describe('canonical contract guards', () => {
  it('exports canonical schema artifacts with expected required keys', () => {
    expect(CANONICAL_CLINICAL_ENGINE_OUTPUT_SCHEMA.required).toEqual(
      expect.arrayContaining(['request_id', 'processed_at', 'source', 'alerts', 'recommendations'])
    );
    expect(CANONICAL_DIFFERENTIAL_OUTPUT_SCHEMA.required).toEqual(
      expect.arrayContaining(['diagnosis_suggestions', 'alerts', 'meta'])
    );
  });

  it('accepts valid canonical clinical engine output shape', () => {
    const payload = {
      request_id: 'req-1',
      processed_at: new Date().toISOString(),
      source: { engine: 'dashboard-clinical-engine', engine_version: '1.0.0', mode: 'canonical' },
      scoring: {},
      alerts: [],
      recommendations: {
        immediate_actions: ['A'],
        monitoring_actions: ['B'],
        referral_actions: ['C'],
        next_best_questions: ['D'],
      },
      governance: {
        disclaimer: 'clinical support only',
        review_required: true,
        authoritative_engine: 'dashboard',
      },
    };

    expect(isCanonicalClinicalEngineOutput(payload)).toBe(true);
  });

  it('rejects invalid canonical clinical engine output shape', () => {
    const payload = {
      request_id: 'req-2',
      processed_at: new Date().toISOString(),
      source: { engine: 'dashboard-clinical-engine' },
      alerts: 'not-array',
      recommendations: {},
      governance: { disclaimer: 'x', review_required: true },
    };

    expect(isCanonicalClinicalEngineOutput(payload)).toBe(false);
  });

  it('accepts valid canonical differential output shape', () => {
    const payload = {
      diagnosis_suggestions: [],
      alerts: [],
      meta: {
        processing_time_ms: 120,
        source: 'dashboard-canonical-differential',
        model_version: 'v1',
      },
    };

    expect(isCanonicalDifferentialOutput(payload)).toBe(true);
  });

  it('rejects invalid canonical differential output shape', () => {
    const payload = {
      diagnosis_suggestions: [],
      alerts: [],
      meta: {
        processing_time_ms: '120',
        source: 'dashboard-canonical-differential',
        model_version: 'v1',
      },
    };

    expect(isCanonicalDifferentialOutput(payload)).toBe(false);
  });

  it('enforces canonical source constants in schema artifacts', () => {
    expect(CANONICAL_CLINICAL_ENGINE_OUTPUT_SCHEMA.properties.source.properties.engine.const).toBe(
      'dashboard-clinical-engine'
    );
    expect(CANONICAL_DIFFERENTIAL_OUTPUT_SCHEMA.properties.meta.properties.source.const).toBe(
      'dashboard-canonical-differential'
    );
  });
});

describe('hybrid anamnesis extraction contract guard', () => {
  it('accepts valid extraction result shape', () => {
    const payload = {
      keluhan_utama: 'nyeri dada',
      onset: 'sejak kemarin',
      lokasi: 'dada kiri',
      kualitas: 'tertindih',
      keparahan: 7,
      faktor_pemicu: ['aktivitas'],
      faktor_peredam: ['istirahat'],
      chronology_summary: 'sejak kemarin setelah aktivitas berat',
      associated_symptoms: ['sesak', 'keringat dingin'],
      pertinent_negatives: ['sinkop'],
      functional_impact: 'aktivitas fisik ringan',
      red_flag_signs: ['nyeri menjalar ke lengan kiri'],
      clinician_questions: ['apakah keluhan dipicu aktivitas'],
      data_belum_lengkap: ['faktor_peredam'],
    };

    expect(isAnamnesisExtractionResult(payload)).toBe(true);
  });

  it('rejects extraction result with unknown missing-field key', () => {
    const payload = {
      keluhan_utama: 'nyeri dada',
      onset: null,
      lokasi: null,
      kualitas: null,
      keparahan: null,
      faktor_pemicu: [],
      faktor_peredam: [],
      data_belum_lengkap: ['unknown_key'],
    };

    expect(isAnamnesisExtractionResult(payload)).toBe(false);
  });

  it('rejects extraction result with invalid optional rich fields', () => {
    const payload = {
      keluhan_utama: 'nyeri dada',
      onset: null,
      lokasi: null,
      kualitas: null,
      keparahan: null,
      faktor_pemicu: [],
      faktor_peredam: [],
      associated_symptoms: 'sesak',
      data_belum_lengkap: [],
    };

    expect(isAnamnesisExtractionResult(payload)).toBe(false);
  });
});

describe('PatientSyncResult type contract', () => {
  it('success result has ok: true and optional id', () => {
    const result: { ok: boolean; error?: string; id?: string } = {
      ok: true,
      id: 'sync-123',
    };
    expect(result.ok).toBe(true);
    expect(result.id).toBe('sync-123');
  });

  it('failure result has ok: false and error message', () => {
    const result: { ok: boolean; error?: string; id?: string } = {
      ok: false,
      error: 'Network timeout',
    };
    expect(result.ok).toBe(false);
    expect(result.error).toBe('Network timeout');
  });
});

describe('bridge readiness guard', () => {
  it('returns false when bridge is enabled but automation token is empty', async () => {
    browserStorageGet.mockImplementation(async (key: string) => {
      if (key === 'sentra:bridge-config') {
        return { 'sentra:bridge-config': { enabled: true, pollIntervalMinutes: 0.5 } };
      }
      if (key === 'sentra:auth-config') {
        return {
          'sentra:auth-config': {
            baseUrl: 'https://crew.puskesmasbalowerti.com',
            automationToken: '',
          },
        };
      }
      return {};
    });

    await expect(isBridgeReady()).resolves.toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns true when bridge is enabled and cookie-backed dashboard session exists', async () => {
    browserStorageGet.mockImplementation(async (key: string) => {
      if (key === 'sentra:bridge-config') {
        return { 'sentra:bridge-config': { enabled: true, pollIntervalMinutes: 0.5 } };
      }
      if (key === 'sentra:auth-config') {
        return {
          'sentra:auth-config': {
            baseUrl: 'https://crew.puskesmasbalowerti.com',
            automationToken: '',
          },
        };
      }
      if (key === 'sentra:persisted-session') {
        return {
          'sentra:persisted-session': {
            user: {
              id: 'nurse-1',
              username: 'perawat',
              name: 'Perawat',
              role: 'nurse',
              facilityId: 'PUSKESMAS_BALOWERTI',
              facilityName: 'Puskesmas Balowerti',
              poli: 'Umum',
            },
            tokens: {
              accessToken: 'cookie-session',
              refreshToken: 'cookie-session',
              expiresAt: Date.now() + 10 * 60_000,
            },
            serverBaseUrl: 'https://crew.puskesmasbalowerti.com',
          },
        };
      }
      return {};
    });
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url.endsWith('/api/auth/session')) {
        return new Response(JSON.stringify({ ok: true, user: { username: 'perawat' } }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({ ok: true, doctors: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });

    await expect(isBridgeReady()).resolves.toBe(true);
  });

  it('returns true when bridge is enabled and automation token exists', async () => {
    browserStorageGet.mockImplementation(async (key: string) => {
      if (key === 'sentra:bridge-config') {
        return { 'sentra:bridge-config': { enabled: true, pollIntervalMinutes: 0.5 } };
      }
      if (key === 'sentra:auth-config') {
        return {
          'sentra:auth-config': {
            baseUrl: 'https://crew.puskesmasbalowerti.com',
            automationToken: 'token-crew-valid',
          },
        };
      }
      return {};
    });
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ ok: true, doctors: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    await expect(isBridgeReady()).resolves.toBe(true);
  });

  it('returns false when auth exists but protected server probe fails', async () => {
    browserStorageGet.mockImplementation(async (key: string) => {
      if (key === 'sentra:bridge-config') {
        return { 'sentra:bridge-config': { enabled: true, pollIntervalMinutes: 0.5 } };
      }
      if (key === 'sentra:auth-config') {
        return {
          'sentra:auth-config': {
            baseUrl: 'https://crew.puskesmasbalowerti.com',
            automationToken: 'token-crew-valid',
          },
        };
      }
      return {};
    });
    fetchMock.mockRejectedValue(
      new Error('Tidak dapat terhubung ke server. Periksa koneksi internet.')
    );

    await expect(isBridgeReady()).resolves.toBe(false);
  });
});

describe('bridge runtime status', () => {
  it('returns auth_required when bridge has no valid auth source', async () => {
    browserStorageGet.mockImplementation(async (key: string) => {
      if (key === 'sentra:bridge-config') {
        return { 'sentra:bridge-config': { enabled: true, pollIntervalMinutes: 0.5 } };
      }
      if (key === 'sentra:auth-config') {
        return {
          'sentra:auth-config': {
            baseUrl: 'https://crew.puskesmasbalowerti.com',
            automationToken: '',
          },
        };
      }
      return {};
    });

    await expect(getBridgeRuntimeStatus()).resolves.toMatchObject({
      readiness: 'auth_required',
      authSource: 'none',
      serverReachable: false,
      serverAuthorized: false,
      message: BRIDGE_AUTH_REQUIRED_HINT,
    });
  });

  it('returns server_unreachable when protected probe cannot reach the server', async () => {
    browserStorageGet.mockImplementation(async (key: string) => {
      if (key === 'sentra:bridge-config') {
        return { 'sentra:bridge-config': { enabled: true, pollIntervalMinutes: 0.5 } };
      }
      if (key === 'sentra:auth-config') {
        return {
          'sentra:auth-config': {
            baseUrl: 'https://crew.puskesmasbalowerti.com',
            automationToken: 'token-crew-valid',
          },
        };
      }
      return {};
    });
    fetchMock.mockRejectedValue(
      new Error('Tidak dapat terhubung ke server. Periksa koneksi internet.')
    );

    await expect(getBridgeRuntimeStatus()).resolves.toMatchObject({
      readiness: 'server_unreachable',
      authSource: 'automation-token',
      serverReachable: false,
      serverAuthorized: false,
    });
  });
});

describe('doctor loading must be server-backed', () => {
  it('throws auth hint instead of returning fallback doctors when bridge auth is missing', async () => {
    browserStorageGet.mockImplementation(async (key: string) => {
      if (key === 'sentra:auth-config') {
        return {
          'sentra:auth-config': {
            baseUrl: 'https://crew.puskesmasbalowerti.com',
            automationToken: '',
          },
        };
      }
      if (key === 'sentra:bridge-config') {
        return { 'sentra:bridge-config': { enabled: true, pollIntervalMinutes: 0.5 } };
      }
      return {};
    });

    let caughtError: unknown;
    try {
      await getOnlineDoctors();
    } catch (e) {
      caughtError = e;
    }
    expect(caughtError).toBeDefined();
    expect(caughtError).toBeInstanceOf(Error);
    expect(getErrorText(caughtError)).toBe(BRIDGE_AUTH_REQUIRED_HINT);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('filterDoctorsForDisplay', () => {
  it('filters out non-dokter roles', () => {
    const doctors: OnlineDoctor[] = [
      { id: '1', name: 'dr. Ferdi Iskandar', role: 'dokter' },
      { id: '2', name: 'Claudesy', role: 'administrator' },
      { id: '3', name: 'Admin Bot', role: 'automation' },
    ];
    const result = filterDoctorsForDisplay(doctors);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('dr. Ferdi Iskandar');
  });

  it('prefers professional_name over name', () => {
    const doctors: OnlineDoctor[] = [
      { id: '1', name: 'ferdi', role: 'dokter', professional_name: 'dr. Ferdi Iskandar' },
    ];
    const result = filterDoctorsForDisplay(doctors);
    expect(result[0].name).toBe('dr. Ferdi Iskandar');
  });

  it('deduplicates by normalized name', () => {
    const doctors: OnlineDoctor[] = [
      { id: '1', name: 'dr. Ferdi Iskandar', role: 'dokter' },
      { id: '2', name: 'dr. Ferdi Iskandar', role: 'dokter' },
    ];
    const result = filterDoctorsForDisplay(doctors);
    expect(result).toHaveLength(1);
  });

  it('excludes fallback IDs when real doctors exist', () => {
    const doctors: OnlineDoctor[] = [
      { id: 'fallback-ferdi', name: 'dr. Ferdi Iskandar', role: 'dokter' },
      { id: 'real-1', name: 'dr. Ferdi Iskandar', role: 'dokter' },
    ];
    const result = filterDoctorsForDisplay(doctors);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('real-1');
  });

  it('returns empty array for empty input', () => {
    expect(filterDoctorsForDisplay([])).toEqual([]);
  });

  it('keeps fallback doctors when no real doctors exist', () => {
    const doctors: OnlineDoctor[] = [
      { id: 'fallback-ferdi', name: 'dr. Ferdi Iskandar', role: 'dokter' },
      { id: 'fallback-josep', name: 'dr. Josep Ariyanto S.Gz', role: 'dokter' },
    ];
    const result = filterDoctorsForDisplay(doctors);
    expect(result).toHaveLength(2);
  });
});
