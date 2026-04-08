// Designed and constructed by Claudesy.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Encounter } from '~/utils/types';

const handlers: Record<string, (message: { data: unknown }) => Promise<unknown>> = {};

const mockOnMessage = vi.fn((type: string, handler: (message: { data: unknown }) => Promise<unknown>) => {
  handlers[type] = handler;
});
const mockSendMessage = vi.fn();
const mockSendMessageToTabWithTimeout = vi.fn();
const mockClassifyTabMessageError = vi.fn(() => 'UNKNOWN');
const mockParseAnamnesaData = vi.fn();
const mockParseDiagnosaData = vi.fn();
const mockParseResepData = vi.fn();

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
  classifyTabMessageError: mockClassifyTabMessageError,
  parseAnamnesaData: mockParseAnamnesaData,
  parseDiagnosaData: mockParseDiagnosaData,
  parseResepData: mockParseResepData,
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

vi.mock('@/lib/cdss/get-suggestions-flow', () => ({
  runGetSuggestionsFlow: mockRunGetSuggestionsFlow,
}));

vi.mock('@/lib/cdss', () => ({
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
    keluhan_utama: 'Demam',
    keluhan_tambahan: '',
    lama_sakit: { thn: 0, bln: 0, hr: 1 },
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

async function bootBackgroundAndGetScrapeHandler() {
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
  return handlers.scrapeResult;
}

describe('background scrapeResult validation integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetEncounter.mockResolvedValue(buildEncounter());
    mockParseDiagnosaData.mockReturnValue({ ok: false, reasons: ['unused in this test'] });
    mockParseResepData.mockReturnValue({ ok: false, reasons: ['unused in this test'] });
  });

  it('updates encounter when anamnesa payload passes parser', async () => {
    const normalized = {
      keluhan_utama: 'Demam tinggi',
      keluhan_tambahan: '',
      lama_sakit: { thn: 0, bln: 0, hr: 2 },
      riwayat_penyakit: null,
      alergi: { obat: [], makanan: [], udara: [], lainnya: [] },
    };
    mockParseAnamnesaData.mockReturnValue({ ok: true, reasons: [], value: normalized });

    const handler = await bootBackgroundAndGetScrapeHandler();
    await handler({
      data: {
        pageType: 'anamnesa',
        data: { keluhan_utama: 'Demam tinggi' },
        timestamp: new Date().toISOString(),
      },
    });

    expect(mockUpdateEncounter).toHaveBeenCalledTimes(1);
    expect(mockUpdateEncounter).toHaveBeenCalledWith({ anamnesa: normalized });
  });

  it('does not update encounter when parser rejects payload', async () => {
    mockParseAnamnesaData.mockReturnValue({
      ok: false,
      reasons: ['keluhan_utama is required'],
    });

    const handler = await bootBackgroundAndGetScrapeHandler();
    await handler({
      data: {
        pageType: 'anamnesa',
        data: { keluhan_tambahan: 'Batuk' },
        timestamp: new Date().toISOString(),
      },
    });

    expect(mockUpdateEncounter).not.toHaveBeenCalled();
  });
});
