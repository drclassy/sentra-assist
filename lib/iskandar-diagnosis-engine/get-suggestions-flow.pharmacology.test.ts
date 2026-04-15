// Designed and constructed by Claudesy.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DiagnosisRequestContext } from '@/types/api';
import type { Encounter } from '~/utils/types';
import { runGetSuggestionsFlow } from './get-suggestions-flow';

const runDiagnosisEngineMock = vi.fn();
const getICD10DetailsMock = vi.fn();
const searchForDiagnosisSuggestionsMock = vi.fn();

vi.mock('./engine', () => ({
  runDiagnosisEngine: (...args: unknown[]) => runDiagnosisEngineMock(...args),
}));

vi.mock('@/lib/rag', () => ({
  getICD10Details: (...args: unknown[]) => getICD10DetailsMock(...args),
  searchForDiagnosisSuggestions: (...args: unknown[]) => searchForDiagnosisSuggestionsMock(...args),
}));

const encounter: Encounter = {
  id: 'enc-pharm-1',
  patient_id: 'pat-pharm-1',
  timestamp: new Date().toISOString(),
  dokter: { id: 'doc-1', nama: 'Dr Test' },
  perawat: { id: 'nurse-1', nama: 'Ns Test' },
  anamnesa: {
    keluhan_utama: 'Sakit kepala',
    keluhan_tambahan: '',
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
};

const context: DiagnosisRequestContext = {
  keluhan_utama: 'Sakit kepala',
  patient_age: 40,
  patient_gender: 'M',
};

describe('runGetSuggestionsFlow pharmacology enrichment', () => {
  beforeEach(() => {
    runDiagnosisEngineMock.mockReset();
    getICD10DetailsMock.mockReset();
    searchForDiagnosisSuggestionsMock.mockReset();
    searchForDiagnosisSuggestionsMock.mockResolvedValue([]);
  });

  it('maps ICD therapy into medication recommendations', async () => {
    runDiagnosisEngineMock.mockResolvedValue({
      suggestions: [
        {
          rank: 1,
          diagnosis_name: 'Hipertensi Esensial',
          icd10_code: 'I10',
          confidence: 0.71,
          reasoning: 'Tekanan darah meningkat konsisten.',
          red_flags: [],
          recommended_actions: [],
        },
      ],
      red_flags: [],
      alerts: [],
      processing_time_ms: 9,
      source: 'local',
      model_version: 'sentra-inference-v3.0.0',
      validation_summary: {
        total_raw: 1,
        total_validated: 1,
        unverified_codes: [],
        warnings: [],
      },
    });

    getICD10DetailsMock.mockResolvedValue([
      {
        code: 'I10',
        name_en: 'Essential (primary) hypertension',
        name_id: 'Hipertensi esensial',
        chapter: 'I00-I99',
        category: 'I10',
        block: 'I10-I15',
        keywords: ['hipertensi'],
        commonality: 0.8,
        is_leaf: true,
        terapi: [{ obat: 'Amlodipine 5mg', dosis: '5mg', frek: '1x1' }],
      },
    ]);

    const result = await runGetSuggestionsFlow(encounter, context);

    expect(result.success).toBe(true);
    expect(result.data?.medication_recommendations).toHaveLength(1);
    expect(result.data?.medication_recommendations[0]?.nama_obat).toBe('Amlodipine 5mg');
    expect(result.data?.medication_recommendations[0]?.dosis).toBe('1x1');
    expect(result.data?.medication_recommendations[0]?.safety_check).toBe('safe');
  });

  it('fails safe to empty medication recommendations when ICD lookup fails', async () => {
    runDiagnosisEngineMock.mockResolvedValue({
      suggestions: [
        {
          rank: 1,
          diagnosis_name: 'Hipertensi Esensial',
          icd10_code: 'I10',
          confidence: 0.71,
          reasoning: 'Tekanan darah meningkat konsisten.',
          red_flags: [],
          recommended_actions: [],
        },
      ],
      red_flags: [],
      alerts: [],
      processing_time_ms: 9,
      source: 'local',
      model_version: 'sentra-inference-v3.0.0',
      validation_summary: {
        total_raw: 1,
        total_validated: 1,
        unverified_codes: [],
        warnings: [],
      },
    });

    getICD10DetailsMock.mockRejectedValue(new Error('db unavailable'));

    const result = await runGetSuggestionsFlow(encounter, context);

    expect(result.success).toBe(true);
    expect(result.data?.medication_recommendations).toEqual([]);
  });

  it('uses complaint-based DB fallback when primary ICD has no therapy', async () => {
    runDiagnosisEngineMock.mockResolvedValue({
      suggestions: [
        {
          rank: 1,
          diagnosis_name: 'Suspek Sepsis',
          icd10_code: 'A41.9',
          confidence: 0.69,
          reasoning: 'Demam dan takipnea.',
          red_flags: [],
          recommended_actions: [],
        },
      ],
      red_flags: [],
      alerts: [],
      processing_time_ms: 10,
      source: 'local',
      model_version: 'sentra-inference-v3.0.0',
      validation_summary: {
        total_raw: 1,
        total_validated: 1,
        unverified_codes: [],
        warnings: [],
      },
    });

    getICD10DetailsMock.mockResolvedValue([
      {
        code: 'A41.9',
        name_en: 'Sepsis, unspecified',
        name_id: 'Sepsis',
        chapter: 'A00-B99',
        category: 'A41',
        block: 'A40-A41',
        keywords: ['sepsis'],
        commonality: 0.4,
        is_leaf: true,
        terapi: [],
      },
    ]);

    searchForDiagnosisSuggestionsMock.mockResolvedValue([
      {
        entry: {
          code: 'J06.9',
          name_en: 'Acute upper respiratory infection, unspecified',
          name_id: 'Infeksi saluran napas akut',
          chapter: 'J00-J99',
          category: 'J06',
          block: 'J00-J06',
          keywords: ['batuk', 'demam'],
          commonality: 0.8,
          is_leaf: true,
          terapi: [{ obat: 'Paracetamol 500mg', dosis: '500mg', frek: '3x1' }],
        },
        relevance_score: 0.68,
        match_type: 'keyword',
      },
    ]);

    const result = await runGetSuggestionsFlow(encounter, context);

    expect(result.success).toBe(true);
    expect(result.data?.medication_recommendations).toHaveLength(1);
    expect(result.data?.medication_recommendations[0]?.nama_obat).toBe('Paracetamol 500mg');
    expect(result.data?.medication_recommendations[0]?.dosis).toBe('3x1');
  });
});
