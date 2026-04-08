// Designed and constructed by Claudesy.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DiagnosisRequestContext } from '@/types/api';
import type { Encounter } from '~/utils/types';

const handlers: Record<string, (message: { data: unknown }) => Promise<unknown>> = {};

const mockOnMessage = vi.fn((type: string, handler: (message: { data: unknown }) => Promise<unknown>) => {
  handlers[type] = handler;
});
const mockSendMessage = vi.fn();
const mockSendMessageToTabWithTimeout = vi.fn();

const mockGetEncounter = vi.fn();
const mockSaveEncounter = vi.fn();
const mockCreateEmptyEncounter = vi.fn();
const mockUpdateEncounter = vi.fn();

const mockRunGetSuggestionsFlow = vi.fn();
const mockInitCDSSEngine = vi.fn(async () => true);
const mockGetCDSSEngineStatus = vi.fn(async () => ({
  ready: true,
  icd10_count: 1,
  model: 'sentra-inference-v3.0.0',
  audit_entries: 0,
}));

vi.mock('~/utils/messaging', () => ({
  onMessage: mockOnMessage,
  sendMessage: mockSendMessage,
  sendMessageToTabWithTimeout: mockSendMessageToTabWithTimeout,
  MESSAGE_TIMEOUTS: {
    default: 10000,
    fill: 8000,
    scrape: 5000,
    visitFetch: 15000,
    ai: 30000,
  },
  classifyTabMessageError: vi.fn(() => 'UNKNOWN'),
  parseAnamnesaData: vi.fn((data: unknown) => ({ ok: true, reasons: [], value: data })),
  parseDiagnosaData: vi.fn((data: unknown) => ({ ok: true, reasons: [], value: data })),
  parseResepData: vi.fn((data: unknown) => ({ ok: true, reasons: [], value: data })),
}));

vi.mock('~/utils/storage', () => ({
  getEncounter: mockGetEncounter,
  saveEncounter: mockSaveEncounter,
  createEmptyEncounter: mockCreateEmptyEncounter,
  updateEncounter: mockUpdateEncounter,
}));

vi.mock('@/lib/api/sentra-api', () => ({
  SentraAPI: {
    recommendPrescription: vi.fn(),
    checkDrugInteractions: vi.fn(),
    checkAllergies: vi.fn(),
    calculatePediatricDose: vi.fn(),
  },
}));

vi.mock('@/lib/iskandar-diagnosis-engine/get-suggestions-flow', () => ({
  runGetSuggestionsFlow: mockRunGetSuggestionsFlow,
}));

vi.mock('@/lib/iskandar-diagnosis-engine', () => ({
  initCDSSEngine: mockInitCDSSEngine,
  getCDSSEngineStatus: mockGetCDSSEngineStatus,
}));

const buildEncounter = (): Encounter => ({
  id: 'enc-bg-1',
  patient_id: 'pat-bg-1',
  timestamp: new Date().toISOString(),
  dokter: { id: 'doc-1', nama: 'Dr Test' },
  perawat: { id: 'nurse-1', nama: 'Ns Test' },
  anamnesa: {
    keluhan_utama: 'Demam tinggi',
    keluhan_tambahan: 'Lemas',
    lama_sakit: { thn: 0, bln: 0, hr: 2 },
    riwayat_penyakit: null,
    alergi: { obat: [], makanan: [], udara: [], lainnya: [] },
  },
  diagnosa: {
    icd_x: '',
    nama: '',
    jenis: 'PRIMER',
    kasus: 'BARU',
    prognosa: '',
    penyakit_kronis: [],
  },
  resep: [],
});

const context: DiagnosisRequestContext = {
  keluhan_utama: 'Demam tinggi',
  patient_age: 30,
  patient_gender: 'F',
};

async function bootBackgroundAndGetSuggestionsHandler() {
  vi.resetModules();
  for (const key of Object.keys(handlers)) delete handlers[key];

  (globalThis as { defineBackground?: (cb: () => void) => unknown }).defineBackground = (cb) => cb();
  (globalThis as { browser?: unknown }).browser = {
    tabs: {
      query: vi.fn(async () => []),
      sendMessage: vi.fn(),
    },
    runtime: {
      onMessage: {
        addListener: vi.fn(),
      },
    },
    storage: {
      local: {
        get: vi.fn(async () => ({})),
        set: vi.fn(async () => undefined),
      },
    },
  };

  await import('@/entrypoints/background');
  return handlers.getSuggestions;
}

describe('background getSuggestions handler integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateEmptyEncounter.mockImplementation(() => {
      const generated = buildEncounter();
      generated.id = `generated-${Date.now()}`;
      generated.anamnesa.keluhan_utama = '';
      generated.anamnesa.keluhan_tambahan = '';
      return generated;
    });
    mockSaveEncounter.mockResolvedValue(true);
  });

  it('routes to runGetSuggestionsFlow when encounter exists', async () => {
    const encounter = buildEncounter();
    mockGetEncounter.mockResolvedValueOnce(encounter);
    mockRunGetSuggestionsFlow.mockResolvedValueOnce({
      success: true,
      data: {
        diagnosis_suggestions: [],
        medication_recommendations: [],
        alerts: [],
        meta: {
          processing_time_ms: 10,
          model_version: 'sentra-inference-v3.0.0',
          timestamp: new Date().toISOString(),
          is_mock: false,
        },
      },
    });

    const handler = await bootBackgroundAndGetSuggestionsHandler();
    const response = await handler({ data: context });

    expect(mockRunGetSuggestionsFlow).toHaveBeenCalledWith(encounter, context);
    expect(response).toEqual(expect.objectContaining({ success: true }));
  });

  it('creates transient encounter and routes to v3 flow when no active encounter', async () => {
    mockGetEncounter.mockResolvedValueOnce(null);
    mockRunGetSuggestionsFlow.mockResolvedValueOnce({
      success: true,
      data: {
        diagnosis_suggestions: [],
        medication_recommendations: [],
        alerts: [],
        meta: {
          processing_time_ms: 1,
          model_version: 'sentra-inference-v3.0.0',
          timestamp: new Date().toISOString(),
          is_mock: false,
        },
      },
    });

    const handler = await bootBackgroundAndGetSuggestionsHandler();
    const response = await handler({ data: context });

    expect(mockCreateEmptyEncounter).toHaveBeenCalledTimes(1);
    expect(mockSaveEncounter).toHaveBeenCalledTimes(1);
    expect(mockRunGetSuggestionsFlow).toHaveBeenCalledWith(
      expect.objectContaining({
        anamnesa: expect.objectContaining({ keluhan_utama: context.keluhan_utama }),
      }),
      context,
    );
    expect(response).toEqual(expect.objectContaining({ success: true }));
  });

  it('injects missing keluhan_utama from context and persists encounter before flow', async () => {
    const encounter = buildEncounter();
    encounter.anamnesa.keluhan_utama = '';
    mockGetEncounter.mockResolvedValueOnce(encounter);
    mockRunGetSuggestionsFlow.mockResolvedValueOnce({
      success: false,
      error: { code: 'MISSING_DATA', message: 'x' },
    });

    const handler = await bootBackgroundAndGetSuggestionsHandler();
    await handler({ data: context });

    expect(mockSaveEncounter).toHaveBeenCalledTimes(1);
    expect(mockSaveEncounter).toHaveBeenCalledWith(
      expect.objectContaining({
        anamnesa: expect.objectContaining({ keluhan_utama: context.keluhan_utama }),
      }),
    );
    expect(mockRunGetSuggestionsFlow).toHaveBeenCalledWith(
      expect.objectContaining({
        anamnesa: expect.objectContaining({ keluhan_utama: context.keluhan_utama }),
      }),
      context,
    );
  });

  it('returns ENGINE_ERROR when downstream flow throws', async () => {
    mockGetEncounter.mockResolvedValueOnce(buildEncounter());
    mockRunGetSuggestionsFlow.mockRejectedValueOnce(new Error('flow crashed'));

    const handler = await bootBackgroundAndGetSuggestionsHandler();
    const response = await handler({ data: context });

    expect(response).toEqual({
      success: false,
      error: {
        code: 'ENGINE_ERROR',
        message: 'flow crashed',
      },
    });
  });
});
