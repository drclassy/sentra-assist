// Designed and constructed by Claudesy.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PharmacotherapyPlan } from '@/lib/iskandar-diagnosis-engine/pharmacotherapy-reasoner';
import type { CDSSResponse, PrescriptionRequestContext } from '@/types/api';

const callOrder: string[] = [];

const mockGetICD10Details = vi.fn();
const mockSearchForDiagnosisSuggestions = vi.fn();
const mockSearchICD10 = vi.fn();
const mockGeneratePharmacotherapyPlan = vi.fn();
const mockBuildMockPrescriptionResponse = vi.fn();
const mockGenerateAllergyAlerts = vi.fn(() => []);

vi.mock('@/lib/rag', () => ({
  getICD10Details: mockGetICD10Details,
  searchForDiagnosisSuggestions: mockSearchForDiagnosisSuggestions,
  searchICD10: mockSearchICD10,
}));

vi.mock('@/lib/iskandar-diagnosis-engine/pharmacotherapy-reasoner', () => ({
  generatePharmacotherapyPlan: mockGeneratePharmacotherapyPlan,
}));

vi.mock('./mocks', () => ({
  buildMockDiagnosisResponse: vi.fn(),
  buildMockPrescriptionResponse: mockBuildMockPrescriptionResponse,
  checkMockDDI: vi.fn(() => []),
  generateAllergyAlerts: mockGenerateAllergyAlerts,
  generateVitalSignAlerts: vi.fn(() => []),
  generateSepsisAlert: vi.fn(() => null),
  generateChronicDiseaseAlerts: vi.fn(() => []),
  generatePediatricAlert: vi.fn(() => null),
  generateGeriatricAlert: vi.fn(() => null),
  combineAndSortAlerts: vi.fn((alerts) => alerts),
}));

function context(icd: string): PrescriptionRequestContext {
  return {
    icd_x: icd,
    patient_age: 52,
    alergi: [],
    penyakit_kronis: [],
    current_medications: [],
  };
}

function reasonerPlan(overrides: Partial<PharmacotherapyPlan> = {}): PharmacotherapyPlan {
  return {
    medications: [
      {
        nama_obat: 'Amlodipine 5mg',
        dosis: '1x1',
        aturan_pakai: 'Sesudah makan',
        durasi: '30 hari',
        rationale: 'Reasoner candidate',
        safety_check: 'safe',
        contraindications: [],
      },
    ],
    alerts: [],
    guidelines: ['Reasoner guideline'],
    confidence: 78,
    drivers: ['reasoner-driver'],
    missingData: [],
    riskTier: 'urgent',
    reviewWindow: '24h',
    syndrome: 'hypertension',
    ...overrides,
  };
}

function knowledgeEntryWithTherapy() {
  return [
    {
      code: 'I10',
      name_id: 'Hipertensi esensial',
      terapi: [{ obat: 'Amlodipine 5mg', frek: '1x1', dosis: '1x1' }],
    },
  ];
}

describe('SentraAPI recommendPrescription local runtime', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    callOrder.length = 0;
    vi.stubEnv('VITE_USE_MOCK', 'true');
    vi.stubEnv('VITE_FEATURE_PRESCRIPTION_AI', 'true');
    mockSearchForDiagnosisSuggestions.mockResolvedValue([]);
    mockSearchICD10.mockResolvedValue([]);
  });

  it('runs knowledge pathway first, then syndrome-intent reasoner', async () => {
    mockGetICD10Details.mockImplementation(async () => {
      callOrder.push('knowledge');
      return knowledgeEntryWithTherapy();
    });
    mockGeneratePharmacotherapyPlan.mockImplementation(async () => {
      callOrder.push('reasoner');
      return reasonerPlan();
    });
    mockBuildMockPrescriptionResponse.mockReturnValue({
      diagnosis_suggestions: [],
      medication_recommendations: [],
      alerts: [],
      clinical_guidelines: [],
    } satisfies CDSSResponse);

    const { SentraAPI } = await import('./sentra-api');
    const result = await SentraAPI.recommendPrescription(context('I10'));

    expect(result.success).toBe(true);
    expect(callOrder).toEqual(['knowledge', 'reasoner']);
    expect(result.data?.pharmacotherapy_explainability?.pathway).toBe('knowledge+syndrome-intent');
    expect(mockBuildMockPrescriptionResponse).not.toHaveBeenCalled();
  });

  it('uses legacy fallback only after knowledge + reasoner fail', async () => {
    mockGetICD10Details.mockImplementation(async () => {
      callOrder.push('knowledge');
      return [{ code: 'R69', name_id: 'Unknown', terapi: [] }];
    });
    mockGeneratePharmacotherapyPlan.mockImplementation(async () => {
      callOrder.push('reasoner');
      return reasonerPlan({
        medications: [],
        confidence: 15,
        riskTier: 'routine',
        reviewWindow: '48h',
      });
    });
    mockBuildMockPrescriptionResponse.mockReturnValue({
      diagnosis_suggestions: [],
      medication_recommendations: [
        {
          nama_obat: 'Legacy Drug 10mg',
          dosis: '1x1',
          aturan_pakai: 'Sesudah makan',
          durasi: '3 hari',
          rationale: 'legacy fallback',
          safety_check: 'safe',
          contraindications: [],
        },
      ],
      alerts: [],
      clinical_guidelines: ['legacy guideline'],
    } satisfies CDSSResponse);

    const { SentraAPI } = await import('./sentra-api');
    const result = await SentraAPI.recommendPrescription(context('R69'));

    expect(result.success).toBe(true);
    expect(callOrder).toEqual(['knowledge', 'reasoner']);
    expect(result.data?.medication_recommendations[0]?.nama_obat).toContain('Legacy Drug');
    expect(result.data?.pharmacotherapy_explainability?.pathway).toBe('legacy-fallback');
  });

  it('applies hypotension-vs-nitrate safety filter while keeping ACS escalation alert', async () => {
    mockGetICD10Details.mockResolvedValue([{ code: 'I20.9', name_id: 'Angina', terapi: [] }]);
    mockGeneratePharmacotherapyPlan.mockResolvedValue(
      reasonerPlan({
        medications: [
          {
            nama_obat: 'Nitroglycerin SL 0.4mg',
            dosis: '1 tablet SL',
            aturan_pakai: 'Jika diperlukan',
            durasi: 'Saat nyeri dada akut',
            rationale: 'ACS bridge',
            safety_check: 'caution',
            contraindications: ['SBP < 90 mmHg'],
          },
        ],
        alerts: [
          {
            id: 'acs-escalation',
            type: 'red_flag',
            severity: 'emergency',
            title: 'Suspek ACS: Stabilize and Refer',
            message: 'Escalate emergency referral.',
          },
        ],
        riskTier: 'emergency',
        reviewWindow: '6h',
        syndrome: 'ischemic_cardiac',
      })
    );
    mockBuildMockPrescriptionResponse.mockReturnValue({
      diagnosis_suggestions: [],
      medication_recommendations: [],
      alerts: [],
      clinical_guidelines: [],
    } satisfies CDSSResponse);

    const { SentraAPI } = await import('./sentra-api');
    const result = await SentraAPI.recommendPrescription({
      ...context('I20.9'),
      vital_signs: { systolic: 80, diastolic: 50 },
    });

    expect(result.success).toBe(true);
    expect(
      result.data?.medication_recommendations.some((med) =>
        med.nama_obat.toLowerCase().includes('nitro')
      )
    ).toBe(false);
    expect(
      result.data?.alerts.some(
        (alert) =>
          alert.type === 'red_flag' && alert.severity === 'emergency' && alert.title.includes('ACS')
      )
    ).toBe(true);
    expect(result.data?.pharmacotherapy_explainability?.risk_tier).toBe('emergency');
    expect(result.data?.pharmacotherapy_explainability?.review_window).toBe('6h');
  });

  it('blocks beta-blocker under severe bradycardia even when recommendation comes from knowledge path', async () => {
    mockGetICD10Details.mockResolvedValue([
      {
        code: 'I10',
        name_id: 'Hipertensi',
        terapi: [{ obat: 'Bisoprolol 5mg', frek: '1x1', dosis: '1x1' }],
      },
    ]);
    mockGeneratePharmacotherapyPlan.mockResolvedValue(
      reasonerPlan({ medications: [], alerts: [], confidence: 58 })
    );
    mockBuildMockPrescriptionResponse.mockReturnValue({
      diagnosis_suggestions: [],
      medication_recommendations: [],
      alerts: [],
      clinical_guidelines: [],
    } satisfies CDSSResponse);

    const { SentraAPI } = await import('./sentra-api');
    const result = await SentraAPI.recommendPrescription({
      ...context('I10'),
      vital_signs: { heart_rate: 45, systolic: 160, diastolic: 96 },
    });

    expect(result.success).toBe(true);
    expect(
      result.data?.medication_recommendations.some((med) =>
        med.nama_obat.toLowerCase().includes('bisoprolol')
      )
    ).toBe(false);
    expect(
      result.data?.alerts.some(
        (alert) => alert.title.includes('Safety Filter') && alert.message.includes('< 50')
      )
    ).toBe(true);
  });

  it('blocks ACE inhibitor or ARB in pregnancy context even when recommendation comes from knowledge path', async () => {
    mockGetICD10Details.mockResolvedValue([
      {
        code: 'I10',
        name_id: 'Hipertensi',
        terapi: [{ obat: 'Captopril 12.5mg', frek: '2x1', dosis: '2x1' }],
      },
    ]);
    mockGeneratePharmacotherapyPlan.mockResolvedValue(
      reasonerPlan({ medications: [], alerts: [], confidence: 52 })
    );
    mockBuildMockPrescriptionResponse.mockReturnValue({
      diagnosis_suggestions: [],
      medication_recommendations: [],
      alerts: [],
      clinical_guidelines: [],
    } satisfies CDSSResponse);

    const { SentraAPI } = await import('./sentra-api');
    const result = await SentraAPI.recommendPrescription({
      ...context('I10'),
      is_pregnant: true,
      penyakit_kronis: ['Kehamilan trimester 2'],
      selected_diagnosis_name: 'Hipertensi dalam kehamilan',
    });

    expect(result.success).toBe(true);
    expect(
      result.data?.medication_recommendations.some((med) =>
        med.nama_obat.toLowerCase().includes('captopril')
      )
    ).toBe(false);
    expect(
      result.data?.alerts.some(
        (alert) =>
          alert.title.includes('Safety Filter') && alert.message.toLowerCase().includes('kehamilan')
      )
    ).toBe(true);
  });

  it('uses explicit is_pregnant=false to bypass keyword-only pregnancy inference', async () => {
    mockGetICD10Details.mockResolvedValue([
      {
        code: 'I10',
        name_id: 'Hipertensi',
        terapi: [{ obat: 'Captopril 12.5mg', frek: '2x1', dosis: '2x1' }],
      },
    ]);
    mockGeneratePharmacotherapyPlan.mockResolvedValue(
      reasonerPlan({ medications: [], alerts: [], confidence: 52 })
    );
    mockBuildMockPrescriptionResponse.mockReturnValue({
      diagnosis_suggestions: [],
      medication_recommendations: [],
      alerts: [],
      clinical_guidelines: [],
    } satisfies CDSSResponse);

    const { SentraAPI } = await import('./sentra-api');
    const result = await SentraAPI.recommendPrescription({
      ...context('I10'),
      is_pregnant: false,
      penyakit_kronis: ['Kehamilan trimester 2'],
      selected_diagnosis_name: 'Hipertensi dalam kehamilan',
    });

    expect(result.success).toBe(true);
    expect(
      result.data?.medication_recommendations.some((med) =>
        med.nama_obat.toLowerCase().includes('captopril')
      )
    ).toBe(true);
    expect(
      result.data?.alerts.some(
        (alert) =>
          alert.title.includes('Safety Filter') &&
          alert.message.toLowerCase().includes('ace inhibitor/arb')
      )
    ).toBe(false);
  });

  it('expands FKTP priority knowledge coverage before using legacy fallback', async () => {
    mockGetICD10Details.mockImplementation(async (codes: string[]) => {
      callOrder.push('knowledge');
      if (codes.includes('I20.9')) {
        return [
          {
            code: 'I20.9',
            name_id: 'Angina pectoris',
            terapi: [{ obat: 'Aspirin 160-325mg', frek: 'loading', dosis: 'loading' }],
          },
        ];
      }
      return [];
    });
    mockGeneratePharmacotherapyPlan.mockImplementation(async () => {
      callOrder.push('reasoner');
      return reasonerPlan({ medications: [], alerts: [] });
    });
    mockBuildMockPrescriptionResponse.mockReturnValue({
      diagnosis_suggestions: [],
      medication_recommendations: [],
      alerts: [],
      clinical_guidelines: [],
    } satisfies CDSSResponse);

    const { SentraAPI } = await import('./sentra-api');
    const result = await SentraAPI.recommendPrescription({
      ...context('I21.9'),
      selected_diagnosis_name: 'Infark miokard akut',
      keluhan_utama: 'nyeri dada',
    });

    expect(result.success).toBe(true);
    expect(callOrder).toEqual(['knowledge', 'reasoner']);
    expect(result.data?.medication_recommendations.length).toBeGreaterThan(0);
    expect(mockBuildMockPrescriptionResponse).not.toHaveBeenCalled();
    expect(result.data?.pharmacotherapy_explainability?.pathway).toBe('knowledge+syndrome-intent');
  });

  it('enriches regimen to minimal 3 components (utama + adjuvant + vitamin)', async () => {
    mockGetICD10Details.mockResolvedValue([
      {
        code: 'I10',
        name_id: 'Hipertensi',
        terapi: [{ obat: 'Amlodipine 5mg', frek: '1x1', dosis: '1x1' }],
      },
    ]);
    mockGeneratePharmacotherapyPlan.mockResolvedValue(
      reasonerPlan({ medications: [], alerts: [], confidence: 60 })
    );
    mockBuildMockPrescriptionResponse.mockReturnValue({
      diagnosis_suggestions: [],
      medication_recommendations: [],
      alerts: [],
      clinical_guidelines: [],
    } satisfies CDSSResponse);

    const { SentraAPI } = await import('./sentra-api');
    const result = await SentraAPI.recommendPrescription(context('I10'));

    expect(result.success).toBe(true);
    expect((result.data?.medication_recommendations.length || 0) >= 3).toBe(true);
    expect(
      result.data?.medication_recommendations.some((med) =>
        med.nama_obat.toLowerCase().includes('vitamin')
      )
    ).toBe(true);
    expect(
      result.data?.medication_recommendations.some((med) =>
        med.nama_obat.toLowerCase().includes('paracetamol')
      )
    ).toBe(true);
  });

  it('does not fabricate triad when all pathways return empty regimen', async () => {
    mockGetICD10Details.mockResolvedValue([{ code: 'R69', name_id: 'Unknown', terapi: [] }]);
    mockGeneratePharmacotherapyPlan.mockResolvedValue(
      reasonerPlan({ medications: [], confidence: 12, riskTier: 'routine', reviewWindow: '48h' })
    );
    mockBuildMockPrescriptionResponse.mockReturnValue({
      diagnosis_suggestions: [],
      medication_recommendations: [],
      alerts: [],
      clinical_guidelines: [],
    } satisfies CDSSResponse);

    const { SentraAPI } = await import('./sentra-api');
    const result = await SentraAPI.recommendPrescription(context('R69'));

    expect(result.success).toBe(true);
    expect(result.data?.medication_recommendations).toEqual([]);
    expect(
      result.data?.alerts.some(
        (alert) =>
          alert.type === 'guideline' &&
          alert.title.includes('Komposisi Regimen Klinis') &&
          alert.message.toLowerCase().includes('regimen kosong')
      )
    ).toBe(true);
  });
});
