// Designed and constructed by Claudesy.
import {
  runDiagnosisAlgorithm,
  type RankedDiagnosis,
} from '@/lib/iskandar-diagnosis-engine/diagnosis-algorithm';
import { classifyChronicDisease } from '@/lib/iskandar-diagnosis-engine/chronic-disease-classifier';
import type { DifferentialVitals } from '@/lib/iskandar-diagnosis-engine/differential-diagnosis';
import {
  evaluateCanonicalDifferential,
  type CanonicalClinicalEngineOutput,
} from '@/lib/api/bridge-client';
import { buildRMETransferPayload } from '@/lib/rme/payload-mapper';
import { sendMessage } from '@/utils/messaging';
import type {
  CDSSAlert,
  DiagnosisSuggestion,
  MedicationRecommendation,
  PharmacotherapyExplainability,
} from '@/types/api';
import type {
  RMETransferProgressEvent,
  RMETransferReasonCode,
  RMETransferResult,
  RMETransferStepStatus,
} from '@/utils/types';
import React, { useEffect, useMemo, useState } from 'react';
import { CTHeader } from './CTHeader';

interface ClinicalDifferentialProps {
  keluhanUtama: string;
  keluhanTambahan?: string;
  patientAge: number;
  patientGender: 'L' | 'P';
  patientRM: string;
  allergies?: string[];
  confirmedPregnancyStatus?: boolean | null;
  vitals: DifferentialVitals;
  trajectory?: import('@/lib/iskandar-diagnosis-engine/trajectory-analyzer').TrajectoryAnalysis;
  canonicalOutput?: CanonicalClinicalEngineOutput | null;
  hasVisitHistory?: boolean;
  onBack: () => void;
  onDiagnosisChange?: (diagnosis: { icd_x: string; nama: string } | null) => void;
  onMedicationsChange?: (medications: MedicationRecommendation[]) => void;
}

type LoadState = 'loading' | 'error' | 'ready';
type TherapyState = 'idle' | 'loading' | 'ready' | 'error';
type TransferUiState = 'idle' | 'running' | 'partial' | 'success' | 'failed';
const MAX_DIAGNOSIS_SELECTION = 2;
const MANUAL_ATURAN_PAKAI_OPTIONS: MedicationRecommendation['aturan_pakai'][] = [
  'Sebelum makan',
  'Sesudah makan',
  'Pemakaian luar',
  'Jika diperlukan',
  'Saat makan',
];

interface ManualMedicationDraft {
  nama_obat: string;
  dosis: string;
  aturan_pakai: MedicationRecommendation['aturan_pakai'];
  durasi: string;
  rationale: string;
}

interface SelectedDiagnosis {
  icd_x: string;
  nama: string;
  source: 'suggested' | 'manual';
  rank?: number;
}

interface DiagnosisTherapyResult {
  diagnosis: SelectedDiagnosis;
  medications: MedicationRecommendation[];
  alerts: CDSSAlert[];
  guidelines: string[];
  explainability?: PharmacotherapyExplainability;
  error?: string;
}

function humanize(value: string): string {
  return value.replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
}

const ICD_PATTERN = /^[A-Z][0-9]{2}(?:\.[0-9A-Z]{1,2})?$/;
const ICD_EMERGENCY_HEAD_MAP: Record<string, string> = {
  '0': 'O',
  '1': 'I',
  '5': 'S',
  '8': 'B',
};

export function normalizeIcdCode(value: string | undefined): string {
  const raw = String(value || '')
    .toUpperCase()
    .replace(/\s+/g, '')
    .trim();
  if (!raw) return '';

  const direct = raw.match(/[A-Z][0-9]{2}(?:\.[0-9A-Z]{1,2})?/);
  if (direct?.[0]) return direct[0];

  const compact = raw.replace(/[^A-Z0-9.]/g, '');
  if (!compact) return '';

  const mappedHead = ICD_EMERGENCY_HEAD_MAP[compact[0]];
  if (mappedHead) {
    const candidate = `${mappedHead}${compact.slice(1)}`;
    const recovered = candidate.match(/^[A-Z][0-9]{2}(?:\.[0-9A-Z]{1,2})?/);
    if (recovered?.[0]) return recovered[0];
  }

  return compact;
}

export function isReadableDiagnosisName(value: string | undefined): boolean {
  const cleaned = (value || '').trim();
  if (!cleaned) return false;
  if (cleaned.length < 3) return false;
  if (/^\d+$/.test(cleaned)) return false;
  if (!/[A-Za-z]/.test(cleaned)) return false;
  return true;
}

function isCodeLikeDiagnosisName(value: string | undefined): boolean {
  const cleaned = (value || '').toUpperCase().replace(/\s+/g, ' ').trim();
  if (!cleaned) return false;
  if (/^DIAGNOSIS\s+[A-Z][0-9]{2}(?:\.[0-9A-Z]{1,2})?$/.test(cleaned)) return true;
  return /^[A-Z][0-9]{2}(?:\.[0-9A-Z]{1,2})?$/.test(cleaned);
}

export function isLikelyIcdCode(value: string | undefined): boolean {
  const normalized = normalizeIcdCode(value);
  return ICD_PATTERN.test(normalized);
}

function resolveDiagnosisDisplayName(icd_x: string, nama: string | undefined): string {
  const normalizedIcd = normalizeIcdCode(icd_x);
  const cleaned = (nama || '').replace(/\s+/g, ' ').trim();
  if (isReadableDiagnosisName(cleaned) && !isCodeLikeDiagnosisName(cleaned)) {
    return cleaned;
  }
  const classification = classifyChronicDisease(normalizedIcd);
  if (classification) return classification.fullName;
  if (normalizedIcd) return `Diagnosis ${normalizedIcd}`;
  return 'Diagnosis belum terklasifikasi';
}

type PregnancyStatus = boolean;

function pregnancyStatusLabel(status: PregnancyStatus): string {
  if (status === true) return 'Confirmed: Pregnant';
  return 'Confirmed: Not Pregnant';
}

export function buildConfirmedChronicSuggestion(diagnosis: {
  icd_x: string;
  nama: string;
}): DiagnosisSuggestion {
  return {
    rank: 0,
    icd_x: diagnosis.icd_x,
    nama: diagnosis.nama,
    confidence: 0.98,
    rationale:
      'Diagnosis kronis terkonfirmasi dari riwayat kunjungan pasien. Prioritaskan sebagai differential utama.',
    red_flags: [],
    recommended_actions: [
      'Verifikasi status diagnosis kronis terkonfirmasi pada kunjungan berjalan',
    ],
  };
}

export function buildUiFallbackDiagnoses(
  keluhanUtama: string,
  vitals: DifferentialVitals
): DiagnosisSuggestion[] {
  const text = keluhanUtama.toLowerCase().trim();
  const hasChestPain =
    text.includes('nyeri dada') || text.includes('chest pain') || text === 'dada';
  const chestRisk = vitals.sbp >= 180 || vitals.sbp < 90 || vitals.hr >= 120 || vitals.rr >= 24;

  if (hasChestPain) {
    return [
      {
        rank: 1,
        icd_x: 'I20.9',
        nama: 'Suspek Angina / Rule-Out ACS',
        confidence: chestRisk ? 0.52 : 0.41,
        rationale: 'Nyeri dada harus menyingkirkan kondisi kardiak akut terlebih dahulu.',
        red_flags: chestRisk ? ['Instabilitas hemodinamik atau distress respirasi'] : [],
        recommended_actions: [
          'Lakukan EKG 12 sadapan',
          'Monitoring serial tanda vital',
          'Rujuk emergensi bila nyeri menetap/memberat',
        ],
      },
      {
        rank: 2,
        icd_x: 'M94.0',
        nama: 'Nyeri Dinding Dada Muskuloskeletal',
        confidence: 0.33,
        rationale:
          'Diagnosis banding non-kardiak yang sering pada nyeri dada setelah red flag tersingkirkan.',
        red_flags: [],
        recommended_actions: ['Evaluasi nyeri tekan lokal', 'Eksklusi red flag kardiopulmoner'],
      },
    ];
  }

  return [
    {
      rank: 1,
      icd_x: 'R69',
      nama: 'Differential Belum Spesifik',
      confidence: 0.25,
      rationale:
        'Data klinis belum cukup untuk differential spesifik, perlu anamnesis dan pemeriksaan lanjutan.',
      red_flags: [],
      recommended_actions: [
        'Lengkapi keluhan utama terstruktur',
        'Ulangi pemeriksaan tanda vital serial',
      ],
    },
  ];
}

function toNeedStyle(level: 'required' | 'recommended' | 'optional'): {
  color: string;
  bg: string;
  border: string;
  label: string;
} {
  if (level === 'required') {
    return {
      color: '#EF4444',
      bg: 'rgba(239,68,68,0.12)',
      border: 'rgba(239,68,68,0.35)',
      label: 'REQUIRED',
    };
  }
  if (level === 'recommended') {
    return {
      color: '#F59E0B',
      bg: 'rgba(245,158,11,0.12)',
      border: 'rgba(245,158,11,0.35)',
      label: 'RECOMMENDED',
    };
  }
  return {
    color: '#6B9B8A',
    bg: 'rgba(16,185,129,0.12)',
    border: 'rgba(16,185,129,0.35)',
    label: 'OPTIONAL',
  };
}

function riskTierUi(riskTier: PharmacotherapyExplainability['risk_tier']): {
  label: string;
  badgeClass: string;
} {
  if (riskTier === 'emergency') {
    return { label: 'EMERGENCY', badgeClass: 'border-red-600/35 text-red-400 bg-red-600/10' };
  }
  if (riskTier === 'urgent') {
    return { label: 'URGENT', badgeClass: 'border-amber-600/35 text-amber-400 bg-amber-600/10' };
  }
  return {
    label: 'ROUTINE',
    badgeClass: 'border-emerald-600/35 text-emerald-400 bg-emerald-600/10',
  };
}

function pathwayUi(pathway: PharmacotherapyExplainability['pathway']): string {
  if (pathway === 'knowledge+syndrome-intent') return 'Knowledge + Syndrome-Intent';
  if (pathway === 'knowledge-only') return 'Knowledge Only';
  if (pathway === 'syndrome-intent-only') return 'Syndrome-Intent Only';
  return 'Legacy Fallback';
}

function canonicalSeverityWeight(
  severity?: CanonicalClinicalEngineOutput['alerts'][number]['severity']
): number {
  if (severity === 'emergency') return 45;
  if (severity === 'urgent') return 30;
  if (severity === 'warning') return 15;
  return 0;
}

const TRANSFER_STEP_ORDER: RMETransferStepStatus[] = ['anamnesa', 'diagnosa', 'resep'];

const REASON_CODE_LABELS: Record<RMETransferReasonCode, string> = {
  DUPLICATE_SUPPRESSED: 'Transfer duplikat diblok dalam window idempotency.',
  USER_CANCELLED: 'Transfer dibatalkan oleh pengguna.',
  NO_ACTIVE_TAB: 'Tab ePuskesmas tidak ditemukan.',
  PAGE_NOT_READY: 'Halaman belum siap, coba reload halaman ePuskesmas.',
  STEP_TIMEOUT: 'Waktu eksekusi step habis.',
  FIELD_NOT_FOUND: 'Field target RME tidak ditemukan.',
  NO_FIELDS_FILLED: 'Tidak ada field yang berhasil diisi.',
  RETRY_EXHAUSTED: 'Retry habis sebelum step berhasil.',
  DIAGNOSA_PAYLOAD_EMPTY: 'Payload diagnosa kosong.',
  RESEP_PAYLOAD_EMPTY: 'Payload resep kosong.',
  RESEP_EMPTY_AFTER_SAFETY: 'Semua kandidat resep diblok safety filter.',
  RESEP_TRIAD_INCOMPLETE: 'Komponen triad regimen belum lengkap.',
  PREGNANCY_UNKNOWN_DEFAULT_FALSE: 'Status kehamilan tidak diketahui, default ke tidak hamil.',
  UNKNOWN_STEP_FAILURE: 'Step gagal tanpa klasifikasi spesifik.',
};

function filterReasonCodesForStep(
  reasonCodes: RMETransferReasonCode[],
  step: RMETransferStepStatus
): RMETransferReasonCode[] {
  return reasonCodes.filter((code) => {
    if (step !== 'diagnosa' && code === 'DIAGNOSA_PAYLOAD_EMPTY') return false;
    if (
      step !== 'resep' &&
      (code === 'RESEP_PAYLOAD_EMPTY' ||
        code === 'RESEP_EMPTY_AFTER_SAFETY' ||
        code === 'RESEP_TRIAD_INCOMPLETE')
    ) {
      return false;
    }
    return true;
  });
}

function mapTransferStateToUi(state: RMETransferResult['state']): TransferUiState {
  if (state === 'success') return 'success';
  if (state === 'partial') return 'partial';
  return 'failed';
}

function stepLabel(step: RMETransferStepStatus): string {
  if (step === 'anamnesa') return 'Anamnesa';
  if (step === 'diagnosa') return 'Diagnosa';
  return 'Resep';
}

function makeInitialTransferSteps(): RMETransferResult['steps'] {
  return {
    anamnesa: {
      step: 'anamnesa',
      state: 'pending',
      attempt: 0,
      latencyMs: 0,
      successCount: 0,
      failedCount: 0,
      skippedCount: 0,
    },
    diagnosa: {
      step: 'diagnosa',
      state: 'pending',
      attempt: 0,
      latencyMs: 0,
      successCount: 0,
      failedCount: 0,
      skippedCount: 0,
    },
    resep: {
      step: 'resep',
      state: 'pending',
      attempt: 0,
      latencyMs: 0,
      successCount: 0,
      failedCount: 0,
      skippedCount: 0,
    },
  };
}

function medicationSelectionKey(med: MedicationRecommendation): string {
  const namaObat = med.nama_obat.toLowerCase().trim();
  const dosis = med.dosis.toLowerCase().trim();
  const aturanPakai = med.aturan_pakai.toLowerCase().trim();
  const durasi = (med.durasi || '').toLowerCase().trim();
  return `${namaObat}|${dosis}|${aturanPakai}|${durasi}`;
}

export const ClinicalDifferential: React.FC<ClinicalDifferentialProps> = ({
  keluhanUtama,
  keluhanTambahan,
  patientAge,
  patientGender,
  patientRM,
  allergies = [],
  confirmedPregnancyStatus,
  vitals,
  trajectory,
  canonicalOutput,
  hasVisitHistory,
  onBack,
  onDiagnosisChange,
  onMedicationsChange,
}) => {
  const [phase, setPhase] = useState<LoadState>('loading');
  const [errorMsg, setErrorMsg] = useState('');
  const [suggestions, setSuggestions] = useState<DiagnosisSuggestion[]>([]);
  const [selectedDiagnoses, setSelectedDiagnoses] = useState<SelectedDiagnosis[]>([]);
  const [manualIcd, setManualIcd] = useState('');
  const [manualName, setManualName] = useState('');
  const [showManualDiagnosisInput, setShowManualDiagnosisInput] = useState(false);
  const [therapyState, setTherapyState] = useState<TherapyState>('idle');
  const [therapyError, setTherapyError] = useState('');
  const [therapyByDiagnosis, setTherapyByDiagnosis] = useState<DiagnosisTherapyResult[]>([]);
  const [showManualMedicationInput, setShowManualMedicationInput] = useState(true);
  const [manualMedications, setManualMedications] = useState<MedicationRecommendation[]>([]);
  const [manualMedicationDraft, setManualMedicationDraft] = useState<ManualMedicationDraft>({
    nama_obat: '',
    dosis: '',
    aturan_pakai: 'Sesudah makan',
    durasi: '',
    rationale: 'Input manual operator',
  });
  const [selectedMedicationKeys, setSelectedMedicationKeys] = useState<string[]>([]);
  const [processingTimeMs, setProcessingTimeMs] = useState<number | null>(null);
  const [transferUiState, setTransferUiState] = useState<TransferUiState>('idle');
  const [transferRunId, setTransferRunId] = useState<string | null>(null);
  const [transferReasonCodes, setTransferReasonCodes] = useState<RMETransferReasonCode[]>([]);
  const [transferSteps, setTransferSteps] = useState<RMETransferResult['steps']>(
    makeInitialTransferSteps()
  );
  const [transferError, setTransferError] = useState('');
  const [transferResult, setTransferResult] = useState<RMETransferResult | null>(null);
  const [lastTriggeredStep, setLastTriggeredStep] = useState<RMETransferStepStatus>('anamnesa');
  const [tenagaMedis, setTenagaMedis] = useState<{
    dokterNama: string;
    perawatNama: string;
    source: string[];
    capturedAt: string;
  }>({
    dokterNama: '',
    perawatNama: '',
    source: [],
    capturedAt: '',
  });
  const [pregnancyStatus, setPregnancyStatus] = useState<PregnancyStatus>(
    patientGender === 'L'
      ? false
      : typeof confirmedPregnancyStatus === 'boolean'
        ? confirmedPregnancyStatus
        : false
  );

  useEffect(() => {
    if (patientGender === 'L') {
      setPregnancyStatus(false);
      return;
    }
    if (typeof confirmedPregnancyStatus === 'boolean') {
      setPregnancyStatus(confirmedPregnancyStatus);
      return;
    }
    setPregnancyStatus(false);
  }, [patientGender, confirmedPregnancyStatus]);

  const confirmedChronicDiagnoses = useMemo(
    () =>
      (trajectory?.confirmed_chronic_diagnoses || [])
        .map((item) => {
          const icd_x = normalizeIcdCode(item.icd_x);
          const classification = classifyChronicDisease(icd_x);
          if (!classification) return null;

          return {
            icd_x,
            nama: isReadableDiagnosisName(item.nama) ? item.nama.trim() : classification.fullName,
          };
        })
        .filter((item): item is { icd_x: string; nama: string } => Boolean(item?.icd_x)),
    [trajectory]
  );

  useEffect(() => {
    let cancelled = false;

    const bootstrapTenagaMedis = async (): Promise<void> => {
      try {
        const response = await sendMessage('resolveTenagaMedis', undefined);
        if (cancelled || !response.success || !response.tenagaMedis) return;
        setTenagaMedis({
          dokterNama: response.tenagaMedis.dokterNama || '',
          perawatNama: response.tenagaMedis.perawatNama || '',
          source: response.tenagaMedis.source || [],
          capturedAt: response.tenagaMedis.capturedAt || '',
        });
      } catch {
        // Non-blocking: fallback will happen at transfer time.
      }
    };

    void bootstrapTenagaMedis();
    return () => {
      cancelled = true;
    };
  }, [patientRM]);

  useEffect(() => {
    let cancelled = false;

    const fetchDifferential = async () => {
      setPhase('loading');
      setErrorMsg('');
      setSelectedDiagnoses([]);
      setManualIcd('');
      setManualName('');
      setShowManualDiagnosisInput(false);
      setTherapyState('idle');
      setTherapyError('');
      setTherapyByDiagnosis([]);
      setShowManualMedicationInput(true);
      setManualMedications([]);
      setManualMedicationDraft({
        nama_obat: '',
        dosis: '',
        aturan_pakai: 'Sesudah makan',
        durasi: '',
        rationale: 'Input manual operator',
      });
      setSelectedMedicationKeys([]);

      try {
        let canonicalFallbackNote = '';

        try {
          const canonicalResponse = await evaluateCanonicalDifferential({
            request_id: `assist-diff-${patientRM || 'anon'}-${Date.now()}`,
            patient: {
              age: patientAge > 0 ? patientAge : 30,
              gender: patientGender,
            },
            narrative: {
              keluhan_utama: keluhanUtama,
              keluhan_tambahan: keluhanTambahan || '',
            },
            vitals: {
              sbp: vitals.sbp || undefined,
              dbp: vitals.dbp || undefined,
              hr: vitals.hr || undefined,
              rr: vitals.rr || undefined,
              temp: vitals.temp || undefined,
              glucose: vitals.glucose || undefined,
            },
            context: {
              allergies: allergies.filter((item) => item.toLowerCase() !== 'tidak ada'),
              chronic_diseases: confirmedChronicDiagnoses.map((item) => item.nama),
              is_pregnant: patientGender === 'P' ? pregnancyStatus === true : undefined,
            },
            canonical_clinical: canonicalOutput?.trajectory?.raw_context
              ? {
                  trajectory_context: canonicalOutput.trajectory.raw_context.trajectory_context,
                  deterioration_summary_text:
                    canonicalOutput.trajectory.raw_context.deterioration_summary_text,
                }
              : undefined,
          });

          if (cancelled) return;

          const canonicalSuggestions: DiagnosisSuggestion[] = [];
          for (const item of (canonicalResponse.diagnosis_suggestions || []).slice(0, 5)) {
            const normalizedCode = normalizeIcdCode(item.icd_x || item.icd10_code);
            if (!isLikelyIcdCode(normalizedCode)) continue;

            canonicalSuggestions.push({
                rank: item.rank,
                icd_x: normalizedCode,
                nama: resolveDiagnosisDisplayName(
                  normalizedCode,
                  item.nama || item.diagnosis_name || normalizedCode
                ),
                diagnosis_name: item.diagnosis_name,
                icd10_code: item.icd10_code,
                confidence: item.confidence,
                rationale: item.rationale || item.reasoning || 'Differential canonical aktif',
                reasoning: item.reasoning,
                red_flags: item.red_flags || [],
                recommended_actions: item.recommended_actions || [],
            });
          }

          if (canonicalSuggestions.length > 0) {
            setErrorMsg('');
            setSuggestions(canonicalSuggestions);
            setProcessingTimeMs(canonicalResponse.meta?.processing_time_ms ?? null);
            setPhase('ready');
            return;
          }

          canonicalFallbackNote =
            'Differential canonical kosong, fallback differential lokal digunakan.';
        } catch (canonicalError) {
          canonicalFallbackNote =
            canonicalError instanceof Error
              ? `${canonicalError.message} (fallback differential lokal digunakan)`
              : 'Differential canonical gagal, fallback differential lokal digunakan.';
        }

        const response = await sendMessage('getSuggestions', {
          keluhan_utama: keluhanUtama,
          keluhan_tambahan: keluhanTambahan || '',
          patient_age: patientAge > 0 ? patientAge : 30,
          patient_gender: patientGender === 'P' ? 'F' : 'M',
          vital_signs: {
            systolic: vitals.sbp || undefined,
            diastolic: vitals.dbp || undefined,
            heart_rate: vitals.hr || undefined,
            respiratory_rate: vitals.rr || undefined,
            temperature: vitals.temp || undefined,
          },
        });

        if (cancelled) return;

        if (!response.success || !response.data) {
          setErrorMsg(
            canonicalFallbackNote ||
              response.error?.message ||
              'Engine tidak merespons, fallback differential lokal digunakan.'
          );
          setSuggestions(buildUiFallbackDiagnoses(keluhanUtama, vitals));
          setPhase('ready');
          return;
        }

        const incomingSuggestions = (response.data.diagnosis_suggestions || []).slice(0, 5);
        if (incomingSuggestions.length === 0) {
          setErrorMsg(
            canonicalFallbackNote ||
              'Differential dari engine kosong, fallback differential lokal digunakan.'
          );
          setSuggestions(buildUiFallbackDiagnoses(keluhanUtama, vitals));
        } else {
          setErrorMsg(canonicalFallbackNote);
          setSuggestions(incomingSuggestions);
        }
        setProcessingTimeMs(response.data.meta?.processing_time_ms ?? null);
        setPhase('ready');
      } catch (error) {
        if (cancelled) return;
        setErrorMsg(
          error instanceof Error
            ? `${error.message} (fallback differential lokal digunakan)`
            : 'Unknown error (fallback differential lokal digunakan)'
        );
        setSuggestions(buildUiFallbackDiagnoses(keluhanUtama, vitals));
        setPhase('ready');
      }
    };

    fetchDifferential();
    return () => {
      cancelled = true;
    };
  }, [
    keluhanUtama,
    keluhanTambahan,
    patientAge,
    patientGender,
    patientRM,
    allergies,
    canonicalOutput,
    vitals.dbp,
    vitals.glucose,
    vitals.hr,
    vitals.rr,
    vitals.sbp,
    vitals.temp,
    confirmedChronicDiagnoses,
    pregnancyStatus,
  ]);

  const normalizedSuggestions = useMemo<DiagnosisSuggestion[]>(() => {
    const baseSuggestions =
      Array.isArray(suggestions) && suggestions.length > 0
        ? suggestions
        : buildUiFallbackDiagnoses(keluhanUtama, vitals);
    const sanitizedBaseSuggestions = baseSuggestions
      .map((item) => {
        const normalizedCode = normalizeIcdCode(item.icd_x);
        if (!isLikelyIcdCode(normalizedCode)) return null;
        return {
          ...item,
          icd_x: normalizedCode,
          nama: resolveDiagnosisDisplayName(normalizedCode, item.nama),
        };
      })
      .filter((item): item is DiagnosisSuggestion => Boolean(item));

    const mergedByIcd = new Map<string, DiagnosisSuggestion>();

    for (const chronic of confirmedChronicDiagnoses) {
      const key = chronic.icd_x;
      if (!key) continue;
      mergedByIcd.set(key, buildConfirmedChronicSuggestion(chronic));
    }

    for (const suggestion of sanitizedBaseSuggestions) {
      const key = suggestion.icd_x?.trim().toUpperCase();
      if (!key || !isLikelyIcdCode(key)) continue;

      const existing = mergedByIcd.get(key);
      if (!existing) {
        mergedByIcd.set(key, suggestion);
        continue;
      }

      mergedByIcd.set(key, {
        ...suggestion,
        confidence: Math.max(existing.confidence, suggestion.confidence),
        rationale: existing.rationale || suggestion.rationale,
      });
    }

    return Array.from(mergedByIcd.values()).map((item, index) => ({
      ...item,
      rank: index + 1,
    }));
  }, [suggestions, keluhanUtama, vitals, confirmedChronicDiagnoses]);

  const rankedDiagnoses: RankedDiagnosis[] = useMemo(
    () =>
      runDiagnosisAlgorithm({
        suggestions: normalizedSuggestions,
        keluhanUtama,
        keluhanTambahan,
        vitals,
        trajectory, // SPRINT 1 P0-2: Pass trajectory data
        maxResults: 5,
      }),
    [normalizedSuggestions, keluhanUtama, keluhanTambahan, vitals, trajectory]
  );
  const displayedDiagnoses = useMemo(() => {
    if (!canonicalOutput) {
      return rankedDiagnoses;
    }

    const immediateActions = canonicalOutput.recommendations.immediate_actions.map((item) =>
      item.toLowerCase()
    );
    const maxSeverity = canonicalOutput.alerts.reduce<
      CanonicalClinicalEngineOutput['alerts'][number]['severity'] | undefined
    >((current, alert) => {
      const currentWeight = canonicalSeverityWeight(current);
      const nextWeight = canonicalSeverityWeight(alert.severity);
      return nextWeight > currentWeight ? alert.severity : current;
    }, undefined);
    const globalSeverityBoost = canonicalSeverityWeight(maxSeverity);

    return [...rankedDiagnoses]
      .map((item) => {
        const redFlagBoost =
          (item.suggestion.red_flags?.length || 0) * (globalSeverityBoost > 0 ? 8 : 2);
        const requiresExamBoost =
          item.insight.supportingExamPlan.needLevel === 'required'
            ? globalSeverityBoost > 0
              ? 18
              : 6
            : item.insight.supportingExamPlan.needLevel === 'recommended'
              ? 6
              : 0;
        const actionText = (item.suggestion.recommended_actions || []).join(' ').toLowerCase();
        const matchesImmediateAction = immediateActions.some((action) => {
          const [firstToken] = action.split(' ');
          return firstToken ? actionText.includes(firstToken) : false;
        });
        const canonicalActionBoost = matchesImmediateAction ? 20 : 0;
        const canonicalScore =
          item.diagnosisScore + redFlagBoost + requiresExamBoost + canonicalActionBoost;

        return {
          ...item,
          diagnosisScore: canonicalScore,
        };
      })
      .sort((left, right) => {
        if (right.diagnosisScore !== left.diagnosisScore) {
          return right.diagnosisScore - left.diagnosisScore;
        }
        if (right.adjustedConfidence !== left.adjustedConfidence) {
          return right.adjustedConfidence - left.adjustedConfidence;
        }
        return left.rank - right.rank;
      })
      .map((item, index) => ({
        ...item,
        rank: index + 1,
      }));
  }, [canonicalOutput, rankedDiagnoses]);
  const canonicalTrajectory = canonicalOutput?.trajectory;
  const canonicalNews2 = canonicalOutput?.scoring.news2;
  const canonicalSourceLabel = canonicalOutput ? 'CANONICAL ENGINE' : 'PREVIEW LOKAL';
  const canonicalTrendLabel = canonicalTrajectory?.overall_trend
    ? humanize(canonicalTrajectory.overall_trend).toUpperCase()
    : trajectory
      ? humanize(trajectory.overallTrend).toUpperCase()
      : 'TIDAK TERSEDIA';
  const canonicalRiskLabel = canonicalTrajectory?.overall_risk
    ? humanize(canonicalTrajectory.overall_risk).toUpperCase()
    : trajectory
      ? humanize(trajectory.overallRisk).toUpperCase()
      : 'TIDAK TERSEDIA';

  const diagnosisKey = (diagnosis: SelectedDiagnosis): string =>
    diagnosis.source === 'manual'
      ? `manual:${diagnosis.icd_x}`
      : `suggested:${diagnosis.rank ?? 0}:${diagnosis.icd_x}`;

  const isDiagnosisSelected = (diagnosis: SelectedDiagnosis): boolean =>
    selectedDiagnoses.some((item) => diagnosisKey(item) === diagnosisKey(diagnosis));

  useEffect(() => {
    let cancelled = false;

    const loadPharmacotherapy = async () => {
      if (selectedDiagnoses.length === 0) {
        setTherapyByDiagnosis([]);
        setTherapyState('idle');
        setTherapyError('');
        return;
      }

      setTherapyState('loading');
      setTherapyError('');

      try {
        const results = await Promise.all(
          selectedDiagnoses.map(async (diagnosis): Promise<DiagnosisTherapyResult> => {
            try {
              const response = await sendMessage('getRecommendations', {
                icd_x: diagnosis.icd_x,
                patient_age: patientAge > 0 ? patientAge : 30,
                alergi: allergies.filter((item) => item.toLowerCase() !== 'tidak ada'),
                penyakit_kronis: [],
                current_medications: [],
                keluhan_utama: keluhanUtama,
                selected_diagnosis_name: diagnosis.nama,
                is_pregnant: pregnancyStatus === true,
                vital_signs: {
                  systolic: vitals.sbp,
                  diastolic: vitals.dbp,
                  heart_rate: vitals.hr,
                  respiratory_rate: vitals.rr,
                  temperature: vitals.temp,
                },
              });

              if (!response.success || !response.data) {
                return {
                  diagnosis,
                  medications: [],
                  alerts: [],
                  guidelines: [],
                  error: response.error?.message || 'Gagal mengambil rekomendasi farmakoterapi.',
                };
              }

              return {
                diagnosis,
                medications: response.data.medication_recommendations || [],
                alerts: response.data.alerts || [],
                guidelines: response.data.clinical_guidelines || [],
                explainability: response.data.pharmacotherapy_explainability,
              };
            } catch (error) {
              return {
                diagnosis,
                medications: [],
                alerts: [],
                guidelines: [],
                error:
                  error instanceof Error
                    ? error.message
                    : 'Gagal mengambil rekomendasi farmakoterapi.',
              };
            }
          })
        );

        if (cancelled) return;

        setTherapyByDiagnosis(results);

        if (results.some((result) => Boolean(result.error))) {
          setTherapyState('error');
          setTherapyError('Sebagian diagnosis gagal dimuat farmakoterapinya.');
          return;
        }

        setTherapyState('ready');
      } catch (error) {
        if (cancelled) return;
        setTherapyByDiagnosis([]);
        setTherapyState('error');
        setTherapyError(
          error instanceof Error ? error.message : 'Gagal mengambil rekomendasi farmakoterapi.'
        );
      }
    };

    loadPharmacotherapy();
    return () => {
      cancelled = true;
    };
  }, [
    selectedDiagnoses,
    patientAge,
    allergies,
    keluhanUtama,
    keluhanTambahan,
    patientGender,
    pregnancyStatus,
    vitals.sbp,
    vitals.dbp,
    vitals.hr,
    vitals.rr,
    vitals.temp,
  ]);

  useEffect(() => {
    const chromeGlobal = (globalThis as unknown as { chrome?: typeof chrome }).chrome;
    if (!chromeGlobal?.runtime?.onMessage) return;

    const listener = (message: unknown) => {
      const payload = message as { type?: string; data?: unknown };
      if (payload.type !== 'RME_TRANSFER_PROGRESS') return;

      const progress = payload.data as RMETransferProgressEvent;
      if (transferRunId && progress.runId !== transferRunId) return;

      setTransferRunId(progress.runId);
      setTransferSteps(progress.steps);
      setTransferReasonCodes(progress.reasonCodes);

      if (progress.state === 'running') {
        setTransferUiState('running');
        return;
      }

      if (progress.transferState === 'cancelled') {
        setTransferUiState('failed');
        setTransferError(REASON_CODE_LABELS.USER_CANCELLED);
        return;
      }

      setTransferUiState(
        progress.transferState === 'success'
          ? 'success'
          : progress.transferState === 'partial'
            ? 'partial'
            : 'failed'
      );
    };

    chromeGlobal.runtime.onMessage.addListener(listener);
    return () => {
      chromeGlobal.runtime.onMessage.removeListener(listener);
    };
  }, [transferRunId]);

  const selectedDiagnosisForTransfer = selectedDiagnoses[0] || null;
  const candidateTransferMedications = useMemo(() => {
    const combined: MedicationRecommendation[] = [];
    if (selectedDiagnoses.length > 0) {
      const selectedKeys = new Set(selectedDiagnoses.map((item) => diagnosisKey(item)));
      combined.push(
        ...therapyByDiagnosis
          .filter((item) => selectedKeys.has(diagnosisKey(item.diagnosis)))
          .flatMap((item) => item.medications)
      );
    }
    combined.push(...manualMedications);

    const deduped = new Map<string, MedicationRecommendation>();
    for (const med of combined) {
      const key = medicationSelectionKey(med);
      if (!deduped.has(key)) deduped.set(key, med);
    }
    return Array.from(deduped.values());
  }, [selectedDiagnoses, therapyByDiagnosis, manualMedications]);

  const selectedMedicationKeySet = useMemo(
    () => new Set(selectedMedicationKeys),
    [selectedMedicationKeys]
  );

  const selectedTransferMedications = useMemo(
    () =>
      candidateTransferMedications.filter((med) =>
        selectedMedicationKeySet.has(medicationSelectionKey(med))
      ),
    [candidateTransferMedications, selectedMedicationKeySet]
  );

  useEffect(() => {
    const availableMedicationKeys = new Set(
      candidateTransferMedications.map((med) => medicationSelectionKey(med))
    );
    setSelectedMedicationKeys((prev) => prev.filter((key) => availableMedicationKeys.has(key)));
  }, [candidateTransferMedications]);

  // Lift selected diagnosis and medications to parent (for uplink from TTVInferenceUI)
  useEffect(() => {
    const first = selectedDiagnoses[0];
    onDiagnosisChange?.(first ? { icd_x: first.icd_x, nama: first.nama } : null);
  }, [selectedDiagnoses, onDiagnosisChange]);

  useEffect(() => {
    onMedicationsChange?.(selectedTransferMedications);
  }, [selectedTransferMedications, onMedicationsChange]);

  const toggleMedicationSelection = (med: MedicationRecommendation): void => {
    const key = medicationSelectionKey(med);
    setSelectedMedicationKeys((prev) =>
      prev.includes(key) ? prev.filter((item) => item !== key) : [...prev, key]
    );
    setTransferError('');
  };

  const selectAllRecommendedMedications = (): void => {
    const allKeys = Array.from(
      new Set(candidateTransferMedications.map((med) => medicationSelectionKey(med)))
    );
    setSelectedMedicationKeys(allKeys);
    setTransferError('');
  };

  const clearSelectedMedications = (): void => {
    setSelectedMedicationKeys([]);
    setTransferError('');
  };

  const updateManualMedicationDraft = <TField extends keyof ManualMedicationDraft>(
    field: TField,
    value: ManualMedicationDraft[TField]
  ): void => {
    setManualMedicationDraft((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const addManualMedication = (): void => {
    const namaObat = manualMedicationDraft.nama_obat.trim();
    const dosis = manualMedicationDraft.dosis.trim();

    if (!namaObat || !dosis) {
      setTherapyState('error');
      setTherapyError('Obat manual butuh minimal Nama Obat dan Dosis.');
      return;
    }

    const manualMedication: MedicationRecommendation = {
      nama_obat: namaObat,
      dosis,
      aturan_pakai: manualMedicationDraft.aturan_pakai,
      durasi: manualMedicationDraft.durasi.trim() || undefined,
      rationale: manualMedicationDraft.rationale.trim() || 'Input manual operator',
      safety_check: 'caution',
      contraindications: [],
    };

    const medKey = medicationSelectionKey(manualMedication);
    const hasDuplicate = manualMedications.some((item) => medicationSelectionKey(item) === medKey);
    if (hasDuplicate) {
      setTherapyState('error');
      setTherapyError('Obat manual dengan regimen yang sama sudah ada.');
      return;
    }

    setManualMedications((prev) => [...prev, manualMedication]);
    setSelectedMedicationKeys((prev) => (prev.includes(medKey) ? prev : [...prev, medKey]));
    setManualMedicationDraft((prev) => ({
      ...prev,
      nama_obat: '',
      dosis: '',
      durasi: '',
      rationale: 'Input manual operator',
    }));
    setTherapyError('');
  };

  const removeManualMedication = (medication: MedicationRecommendation): void => {
    const medKey = medicationSelectionKey(medication);
    setManualMedications((prev) => prev.filter((item) => medicationSelectionKey(item) !== medKey));
    setSelectedMedicationKeys((prev) => prev.filter((item) => item !== medKey));
    setTherapyError('');
  };

  const selectedMedicationCount = selectedTransferMedications.length;
  const candidateMedicationCount = candidateTransferMedications.length;

  const hasDiagnosisForTransfer = Boolean(selectedDiagnosisForTransfer);
  const hasCandidateResepMedication = candidateMedicationCount > 0;
  const hasResepPayloadReady =
    hasDiagnosisForTransfer &&
    therapyState !== 'loading' &&
    selectedMedicationCount > 0 &&
    (therapyState === 'ready' || therapyByDiagnosis.length > 0);

  const handleTransferToRME = async (
    targetStep: RMETransferStepStatus,
    forceRun = false
  ): Promise<void> => {
    if (targetStep === 'diagnosa' && !selectedDiagnosisForTransfer) {
      setTransferUiState('failed');
      setTransferError('Pilih diagnosis terlebih dahulu sebelum uplink Diagnosa.');
      return;
    }

    if (targetStep === 'resep') {
      if (!selectedDiagnosisForTransfer) {
        setTransferUiState('failed');
        setTransferError('Pilih diagnosis terlebih dahulu sebelum uplink Resep.');
        return;
      }
      if (therapyState === 'loading') {
        setTransferUiState('failed');
        setTransferError('Farmakoterapi masih diproses. Tunggu sampai selesai lalu uplink Resep.');
        return;
      }
      if (!hasCandidateResepMedication) {
        setTransferUiState('failed');
        setTransferError(
          'Resep belum siap. Muat rekomendasi farmakologi dulu agar uplink Resep tidak kosong.'
        );
        return;
      }
      if (selectedMedicationCount === 0) {
        setTransferUiState('failed');
        setTransferError('Pilih minimal 1 obat (proposal/manual) sebelum uplink Resep.');
        return;
      }
    }

    let resolvedTenagaMedis = tenagaMedis;
    try {
      const tenagaMedisResponse = await sendMessage('resolveTenagaMedis', undefined);
      if (tenagaMedisResponse.success && tenagaMedisResponse.tenagaMedis) {
        resolvedTenagaMedis = {
          dokterNama: tenagaMedisResponse.tenagaMedis.dokterNama || '',
          perawatNama: tenagaMedisResponse.tenagaMedis.perawatNama || '',
          source: tenagaMedisResponse.tenagaMedis.source || [],
          capturedAt: tenagaMedisResponse.tenagaMedis.capturedAt || '',
        };
        setTenagaMedis(resolvedTenagaMedis);
      }
    } catch {
      // Keep last known value in state.
    }

    const mapped = buildRMETransferPayload({
      keluhanUtama,
      keluhanTambahan,
      patientGender,
      pregnancyStatus,
      allergies,
      vitalSigns: {
        sbp: vitals.sbp,
        dbp: vitals.dbp,
        hr: vitals.hr,
        rr: vitals.rr,
        temp: vitals.temp,
        glucose: vitals.glucose,
      },
      diagnosis: {
        icd_x: selectedDiagnosisForTransfer.icd_x,
        nama: selectedDiagnosisForTransfer.nama,
        jenis:
          selectedDiagnoses.indexOf(selectedDiagnosisForTransfer) === 0 ? 'PRIMER' : 'SEKUNDER',
        // kasus, prognosa, penyakit_kronis auto-detected by payload-mapper
      },
      medications: selectedTransferMedications,
      tenagaMedis:
        resolvedTenagaMedis.dokterNama || resolvedTenagaMedis.perawatNama
          ? {
              dokterNama: resolvedTenagaMedis.dokterNama || undefined,
              perawatNama: resolvedTenagaMedis.perawatNama || undefined,
              ruangan: 'POLI UMUM',
            }
          : undefined,
      trajectory,
      hasVisitHistory,
    });

    const scopedReasonCodes = filterReasonCodesForStep(mapped.reasonCodes, targetStep);

    const requestId = `rme-${Date.now()}`;
    setTransferRunId(requestId);
    setLastTriggeredStep(targetStep);
    setTransferUiState('running');
    setTransferError('');
    setTransferResult(null);
    setTransferSteps(makeInitialTransferSteps());
    setTransferReasonCodes(scopedReasonCodes);

    try {
      const scopedPayload = {
        ...mapped.payload,
        options: {
          ...mapped.payload.options,
          requestId,
          forceRun,
          startFromStep: targetStep,
          onlyStep: targetStep,
        },
        meta: {
          ...mapped.payload.meta,
          reasonCodes: scopedReasonCodes,
        },
      };

      const result = await sendMessage('transferRME', {
        ...scopedPayload,
      });
      setTransferResult(result);
      setTransferRunId(result.runId);
      setTransferSteps(result.steps);
      setTransferReasonCodes(result.reasonCodes);
      setTransferUiState(mapTransferStateToUi(result.state));
      if (result.state !== 'success') {
        const firstReason = result.reasonCodes[0];
        setTransferError(
          firstReason ? REASON_CODE_LABELS[firstReason] : 'Transfer RME tidak sepenuhnya berhasil.'
        );
      }
    } catch (error) {
      setTransferUiState('failed');
      setTransferError(error instanceof Error ? error.message : 'Transfer RME gagal.');
    }
  };

  const handleAutoFillAll = async (forceRun = false): Promise<void> => {
    let resolvedTenagaMedis = tenagaMedis;
    try {
      const tenagaMedisResponse = await sendMessage('resolveTenagaMedis', undefined);
      if (tenagaMedisResponse.success && tenagaMedisResponse.tenagaMedis) {
        resolvedTenagaMedis = {
          dokterNama: tenagaMedisResponse.tenagaMedis.dokterNama || '',
          perawatNama: tenagaMedisResponse.tenagaMedis.perawatNama || '',
          source: tenagaMedisResponse.tenagaMedis.source || [],
          capturedAt: tenagaMedisResponse.tenagaMedis.capturedAt || '',
        };
        setTenagaMedis(resolvedTenagaMedis);
      }
    } catch {
      // Keep last known value in state.
    }

    const diagnosisInput = selectedDiagnosisForTransfer
      ? {
          icd_x: selectedDiagnosisForTransfer.icd_x,
          nama: selectedDiagnosisForTransfer.nama,
          jenis: (selectedDiagnoses.indexOf(selectedDiagnosisForTransfer) === 0
            ? 'PRIMER'
            : 'SEKUNDER') as 'PRIMER' | 'SEKUNDER',
        }
      : undefined;

    const mapped = buildRMETransferPayload({
      keluhanUtama,
      keluhanTambahan,
      patientGender,
      pregnancyStatus,
      allergies,
      vitalSigns: {
        sbp: vitals.sbp,
        dbp: vitals.dbp,
        hr: vitals.hr,
        rr: vitals.rr,
        temp: vitals.temp,
        glucose: vitals.glucose,
      },
      diagnosis: diagnosisInput,
      medications: selectedTransferMedications,
      tenagaMedis:
        resolvedTenagaMedis.dokterNama || resolvedTenagaMedis.perawatNama
          ? {
              dokterNama: resolvedTenagaMedis.dokterNama || undefined,
              perawatNama: resolvedTenagaMedis.perawatNama || undefined,
              ruangan: 'POLI UMUM',
            }
          : undefined,
      trajectory,
      hasVisitHistory,
    });

    const requestId = `rme-auto-${Date.now()}`;
    setTransferRunId(requestId);
    setLastTriggeredStep('anamnesa');
    setTransferUiState('running');
    setTransferError('');
    setTransferResult(null);
    setTransferSteps(makeInitialTransferSteps());
    setTransferReasonCodes(mapped.reasonCodes);

    try {
      const result = await sendMessage('transferRME', {
        ...mapped.payload,
        options: {
          ...mapped.payload.options,
          requestId,
          forceRun,
        },
        meta: {
          ...mapped.payload.meta,
          reasonCodes: mapped.reasonCodes,
        },
      });
      setTransferResult(result);
      setTransferRunId(result.runId);
      setTransferSteps(result.steps);
      setTransferReasonCodes(result.reasonCodes);
      setTransferUiState(mapTransferStateToUi(result.state));
      if (result.state !== 'success') {
        const firstReason = result.reasonCodes[0];
        setTransferError(
          firstReason ? REASON_CODE_LABELS[firstReason] : 'Transfer RME tidak sepenuhnya berhasil.'
        );
      }
    } catch (error) {
      setTransferUiState('failed');
      setTransferError(error instanceof Error ? error.message : 'Transfer RME gagal.');
    }
  };

  const handleCancelTransfer = async (): Promise<void> => {
    if (!transferRunId) return;
    try {
      await sendMessage('cancelRMETransfer', { runId: transferRunId });
      setTransferUiState('failed');
      setTransferError(REASON_CODE_LABELS.USER_CANCELLED);
    } catch (error) {
      setTransferUiState('failed');
      setTransferError(error instanceof Error ? error.message : 'Gagal membatalkan transfer.');
    }
  };

  const selectSuggestedDiagnosis = (item: RankedDiagnosis): void => {
    const normalizedIcd = normalizeIcdCode(item.suggestion.icd_x);
    const diagnosis: SelectedDiagnosis = {
      icd_x: normalizedIcd || item.suggestion.icd_x,
      nama: resolveDiagnosisDisplayName(
        normalizedIcd || item.suggestion.icd_x,
        item.suggestion.nama
      ),
      source: 'suggested',
      rank: item.rank,
    };

    let exceeded = false;
    setSelectedDiagnoses((prev) => {
      const exists = prev.some((entry) => diagnosisKey(entry) === diagnosisKey(diagnosis));
      if (exists) {
        return prev.filter((entry) => diagnosisKey(entry) !== diagnosisKey(diagnosis));
      }
      if (prev.length >= MAX_DIAGNOSIS_SELECTION) {
        exceeded = true;
        return prev;
      }
      return [...prev, diagnosis];
    });

    if (exceeded) {
      setTherapyState('error');
      setTherapyError(`Maksimal ${MAX_DIAGNOSIS_SELECTION} diagnosis dapat dipilih.`);
    } else {
      setTherapyError('');
    }
  };

  const selectManualDiagnosis = (): void => {
    const icd = normalizeIcdCode(manualIcd);
    if (!icd) {
      setTherapyState('error');
      setTherapyError('Kode ICD-X manual wajib diisi sebelum mengambil farmakoterapi.');
      return;
    }
    if (!isLikelyIcdCode(icd)) {
      setTherapyState('error');
      setTherapyError('Format ICD-X manual tidak valid. Contoh: I10, N18.9, E11.9.');
      return;
    }

    const resolvedName = resolveDiagnosisDisplayName(icd, manualName.trim() || undefined);
    const diagnosis: SelectedDiagnosis = {
      icd_x: icd,
      nama: resolvedName,
      source: 'manual',
    };

    let exceeded = false;
    setSelectedDiagnoses((prev) => {
      const exists = prev.some((entry) => diagnosisKey(entry) === diagnosisKey(diagnosis));
      if (exists) {
        return prev.filter((entry) => diagnosisKey(entry) !== diagnosisKey(diagnosis));
      }
      if (prev.length >= MAX_DIAGNOSIS_SELECTION) {
        exceeded = true;
        return prev;
      }
      return [...prev, diagnosis];
    });

    if (exceeded) {
      setTherapyState('error');
      setTherapyError(`Maksimal ${MAX_DIAGNOSIS_SELECTION} diagnosis dapat dipilih.`);
      return;
    }

    setTherapyError('');
    setManualIcd('');
    setManualName('');
  };

  const removeDiagnosis = (diagnosis: SelectedDiagnosis): void => {
    setSelectedDiagnoses((prev) =>
      prev.filter((entry) => diagnosisKey(entry) !== diagnosisKey(diagnosis))
    );
    setTherapyError('');
  };

  return (
    <div
      className="ct-neu-shell relative min-h-screen w-full p-5 flex flex-col gap-4"
      style={{ background: 'linear-gradient(180deg, #202024 0%, #1a1a1d 100%)' }}
    >
      <div
        className="absolute top-0 left-0 right-0 h-40 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse 80% 50% at 50% -10%, rgba(255,107,47,0.08) 0%, transparent 70%)',
        }}
      />
      <CTHeader
        title="Sentra Assist"
        subtitle="Architected by dr Ferdi Iskandar"
        sectionLabel="Diagnosis + Resep"
        meta={
          processingTimeMs !== null
            ? `Resolution workflow • ${processingTimeMs}ms processing time`
            : 'Clinical resolution workflow for diagnosis and pharmacotherapy'
        }
        onBack={onBack}
      />

      <div className="neu-card-inset p-1.5">
        <div className="flex gap-1.5">
          <button
            onClick={onBack}
            className="flex-1 py-2 px-2 rounded-lg text-body relative neu-tab text-muted font-medium"
          >
            Clinical Trajectory
          </button>
          <button className="flex-1 py-2 px-2 rounded-lg text-body relative neu-tab-active text-platinum font-semibold">
            Diagnosis + Resep
          </button>
        </div>
      </div>

      <div className="ttv-section p-3">
        <div className="text-tiny font-bold text-muted uppercase tracking-wide mb-2">
          Alur Kerja Cepat
        </div>
        <div className="grid grid-cols-1 gap-2">
          <div
            className={`ct-neu-cell rounded-[6px] border p-2 ${
              selectedDiagnoses.length > 0
                ? 'border-emerald-600/35 bg-emerald-600/10'
                : 'border-[var(--border-subtle)] bg-[var(--surface-primary)]'
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-semibold text-platinum">
                Step 1 • Pilih Diagnosis
              </span>
              <span className="text-[10px] text-muted font-mono">
                {selectedDiagnoses.length}/{MAX_DIAGNOSIS_SELECTION}
              </span>
            </div>
          </div>
          <div
            className={`ct-neu-cell rounded-[6px] border p-2 ${
              hasResepPayloadReady
                ? 'border-emerald-600/35 bg-emerald-600/10'
                : selectedMedicationCount > 0
                  ? 'border-amber-600/35 bg-amber-600/10'
                  : 'border-[var(--border-subtle)] bg-[var(--surface-primary)]'
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-semibold text-platinum">Step 2 • Pilih Resep</span>
              <span className="text-[10px] text-muted font-mono">
                {selectedMedicationCount}/{candidateMedicationCount}
              </span>
            </div>
          </div>
          <div
            className={`ct-neu-cell rounded-[6px] border p-2 ${
              transferUiState === 'success'
                ? 'border-emerald-600/35 bg-emerald-600/10'
                : transferUiState === 'running'
                  ? 'border-blue-600/35 bg-blue-600/10'
                  : transferUiState === 'partial'
                    ? 'border-amber-600/35 bg-amber-600/10'
                    : transferUiState === 'failed'
                      ? 'border-red-600/35 bg-red-600/10'
                      : 'border-[var(--border-subtle)] bg-[var(--surface-primary)]'
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-semibold text-platinum">
                Step 3 • Uplink ke RME
              </span>
              <span className="text-[10px] text-muted font-mono">
                {transferUiState.toUpperCase()}
              </span>
            </div>
          </div>
        </div>
      </div>

      {(trajectory || canonicalTrajectory) && hasVisitHistory !== undefined && (
        <div className="bg-blue-700/10 border border-blue-700/30 rounded-[6px] p-3 mb-3">
          <div className="flex items-center gap-2 mb-1">
            <div className="text-[10px] text-blue-300 font-semibold uppercase tracking-wide">
              Trajectory Intelligence Active
            </div>
            <span className="px-2 py-0.5 rounded border border-blue-600/35 bg-blue-600/10 text-[10px] text-blue-300 font-mono">
              {hasVisitHistory ? 'Returning Patient' : 'New Case'}
            </span>
            <span className="px-2 py-0.5 rounded border border-emerald-600/35 bg-emerald-600/10 text-[10px] text-emerald-300 font-mono">
              {canonicalSourceLabel}
            </span>
          </div>
          <div className="text-[10px] text-muted leading-snug">
            Auto-detecting: Prognosis ({canonicalTrendLabel} trend, {canonicalRiskLabel} risk) •
            Kasus ({hasVisitHistory ? 'LAMA' : 'BARU'}) • Chronic diseases from ICD
            {canonicalNews2 ? ` • NEWS2 ${canonicalNews2.score}` : ''}
          </div>
          {canonicalTrajectory?.narrative ? (
            <div className="text-[10px] text-platinum mt-2 leading-snug">
              {canonicalTrajectory.narrative}
            </div>
          ) : null}
          {canonicalOutput?.recommendations.immediate_actions?.length ? (
            <div className="flex flex-wrap gap-1 mt-2">
              {canonicalOutput.recommendations.immediate_actions.slice(0, 2).map((action, index) => (
                <span
                  key={`${action}-${index}`}
                  className="px-2 py-0.5 rounded border border-blue-600/25 bg-blue-600/10 text-[10px] text-blue-200"
                >
                  {action}
                </span>
              ))}
            </div>
          ) : (
            <div className="text-[10px] text-muted mt-2">
              Differential tetap fallback ke workflow lokal bila canonical detail belum tersedia.
            </div>
          )}
          <div className="text-[10px] text-muted mt-2">
            Source aktif: {canonicalOutput ? 'dashboard canonical engine' : 'trajectory lokal transisi'}.
          </div>
        </div>
      )}

      <div className="ttv-section p-3">
        <div className="text-tiny font-bold text-muted uppercase tracking-wide mb-2">
          Ringkasan Kasus
        </div>
        <div className="grid grid-cols-1 gap-2">
          <div
            className="ct-neu-cell rounded-[6px] px-3 py-3"
            style={{
              background: 'linear-gradient(145deg, #1e1e20 0%, #1a1a1c 100%)',
              border: '1px solid rgba(255,255,255,0.06)',
            }}
          >
            <div className="text-xs text-platinum font-medium leading-relaxed">
              {keluhanUtama || '-'}
            </div>
            {keluhanTambahan && (
              <div className="text-[10px] text-muted mt-1 leading-snug">{keluhanTambahan}</div>
            )}
            <div className="flex items-center gap-2 mt-2">
              <span className="text-[10px] font-mono text-muted">RM {patientRM}</span>
              <span className="text-[10px] font-mono text-muted">{patientAge || '-'}th</span>
              <span
                className="px-2 py-0.5 rounded text-[10px] font-bold font-mono"
                style={{
                  background: 'rgba(255,69,0,0.15)',
                  color: 'var(--accent-primary)',
                  border: '1px solid rgba(255,69,0,0.3)',
                }}
              >
                {patientGender}
              </span>
            </div>
            {confirmedChronicDiagnoses.length > 0 && (
              <div className="mt-2">
                <div className="text-[10px] text-muted mb-1 uppercase tracking-wide font-semibold">
                  Confirmed Chronic Diagnosis
                </div>
                <div className="flex flex-wrap gap-1">
                  {confirmedChronicDiagnoses.slice(0, 3).map((item) => (
                    <span
                      key={`${item.icd_x}-${item.nama}`}
                      className="px-2 py-0.5 rounded border border-amber-600/35 bg-amber-600/10 text-[10px] text-amber-300 font-mono"
                    >
                      {item.icd_x} • {humanize(item.nama)}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="ct-neu-cell bg-[var(--surface-primary)] border border-[var(--border-subtle)] rounded-[6px] px-3 py-3">
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="text-[10px] font-semibold text-muted uppercase tracking-wide">
                Konfirmasi Kehamilan
              </div>
              <span className="px-2 py-0.5 rounded border border-[var(--border-subtle)] text-[10px] text-muted">
                {pregnancyStatusLabel(pregnancyStatus)}
              </span>
            </div>
            {patientGender === 'L' ? (
              <div className="text-[10px] text-muted leading-snug">
                Gender male terdeteksi, status kehamilan dikunci ke{' '}
                <span className="text-platinum font-semibold">Not Pregnant</span>.
              </div>
            ) : typeof confirmedPregnancyStatus === 'boolean' ? (
              <div className="text-[10px] text-muted leading-snug">
                Status kehamilan dari Anamnesa:{' '}
                <span className="text-platinum font-semibold">
                  {confirmedPregnancyStatus ? 'Pregnant' : 'Not Pregnant'}
                </span>
                .
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <div className="text-[10px] text-muted leading-snug">
                  Pilih status untuk menyesuaikan safety filter farmakoterapi.
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPregnancyStatus(false)}
                    className={`px-3 py-1.5 rounded border text-[10px] font-semibold ${
                      pregnancyStatus === false
                        ? 'border-emerald-600/35 text-emerald-300 bg-emerald-600/10'
                        : 'border-[var(--border-subtle)] text-muted'
                    }`}
                  >
                    Not Pregnant
                  </button>
                  <button
                    onClick={() => setPregnancyStatus(true)}
                    className={`px-3 py-1.5 rounded border text-[10px] font-semibold ${
                      pregnancyStatus === true
                        ? 'border-amber-600/35 text-amber-300 bg-amber-600/10'
                        : 'border-[var(--border-subtle)] text-muted'
                    }`}
                  >
                    Pregnant
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {phase === 'loading' && (
        <div className="ttv-section p-8 flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-pulse-500 border-t-transparent rounded-full " />
          <div className="text-small text-muted">Menganalisis differential diagnosis...</div>
        </div>
      )}

      {phase === 'error' && (
        <div className="bg-[var(--surface-secondary)] border border-critical/40 rounded-[6px] p-4">
          <div className="text-xs text-critical font-bold mb-1">FAILED TO LOAD DIFFERENTIAL</div>
          <div className="text-small text-muted">
            {errorMsg || 'Terjadi error saat memuat data.'}
          </div>
        </div>
      )}

      {phase === 'ready' && (
        <div className="flex flex-col gap-3">
          {errorMsg && (
            <div className="bg-amber-700/10 border border-amber-700/30 rounded-[6px] p-3">
              <div className="text-[10px] text-amber-300 leading-snug">{errorMsg}</div>
            </div>
          )}
          {displayedDiagnoses.length === 0 && (
            <div className="ttv-section p-4">
              <div className="text-small text-muted">
                Belum ada differential diagnosis yang bisa diproposisikan.
              </div>
            </div>
          )}

          {displayedDiagnoses.length > 0 && (
            <div className="ttv-section p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="text-tiny font-bold text-muted uppercase tracking-wide">
                  Step 1 • Kandidat Diagnosis
                </div>
                <span className="px-2 py-0.5 rounded border border-[var(--border-subtle)] text-[10px] text-muted">
                  Top {Math.min(displayedDiagnoses.length, 3)}
                </span>
              </div>
            </div>
          )}

          {displayedDiagnoses.slice(0, 3).map((item) => {
            const { suggestion, insight, adjustedConfidence } = item;
            const confidencePct = Math.round(suggestion.confidence * 100);
            const adjustedPct = Math.round(adjustedConfidence * 100);
            const needStyle = toNeedStyle(insight.supportingExamPlan.needLevel);

            // SPRINT 1 HOTFIX: Confidence tier classification
            const confidenceTier =
              adjustedConfidence >= 0.6
                ? 'primary'
                : adjustedConfidence >= 0.25
                  ? 'secondary'
                  : 'low';
            const normalizedSuggestionIcd = normalizeIcdCode(suggestion.icd_x);
            const diagnosisCandidate: SelectedDiagnosis = {
              icd_x: normalizedSuggestionIcd || suggestion.icd_x,
              nama: resolveDiagnosisDisplayName(
                normalizedSuggestionIcd || suggestion.icd_x,
                suggestion.nama
              ),
              source: 'suggested',
              rank: item.rank,
            };
            const isSelected = isDiagnosisSelected(diagnosisCandidate);
            const isSelectionBlocked =
              !isSelected && selectedDiagnoses.length >= MAX_DIAGNOSIS_SELECTION;

            return (
              <details
                key={`${suggestion.icd_x}-${suggestion.rank}`}
                className={`ttv-section p-4 ${isSelected ? 'border-emerald-500/50' : ''}`}
              >
                <summary className="cursor-pointer list-none">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-muted text-sm">▸</span>
                        <span className="px-2 py-0.5 rounded bg-carbon-800 border border-[var(--border-subtle)] text-[10px] text-muted font-mono">
                          #{item.rank}
                        </span>
                        <span className="px-2 py-0.5 rounded bg-carbon-800 border border-[var(--border-subtle)] text-[10px] text-platinum font-mono">
                          {suggestion.icd_x}
                        </span>
                      </div>
                      <h3 className="text-sm font-semibold text-platinum">
                        {humanize(suggestion.nama)}
                      </h3>
                    </div>
                    <div className="text-right flex flex-col items-end gap-1">
                      {/* SPRINT 1 HOTFIX: Tier badge */}
                      {confidenceTier === 'primary' ? (
                        <div className="px-2 py-0.5 rounded bg-emerald-600/15 border border-emerald-600/30 text-[9px] text-emerald-300 font-bold uppercase tracking-wide">
                          ✓ Tinggi
                        </div>
                      ) : (
                        <div className="px-2 py-0.5 rounded bg-amber-600/15 border border-amber-600/30 text-[9px] text-amber-300 font-bold uppercase tracking-wide">
                          ⚠ Pertimbangkan
                        </div>
                      )}
                      {/* Adjusted confidence (composite score) */}
                      <div className="text-[10px] text-muted">
                        Skor Klinis:{' '}
                        <span className="font-mono font-bold text-platinum">{adjustedPct}%</span>
                      </div>
                      {/* Raw AI confidence */}
                      <div className="text-[9px] text-muted/70">AI: {confidencePct}%</div>
                    </div>
                  </div>
                </summary>

                <div className="mt-3">
                  <div className="flex justify-end mb-2">
                    <button
                      onClick={() => selectSuggestedDiagnosis(item)}
                      disabled={isSelectionBlocked}
                      className={`px-2 py-1 rounded border text-[10px] font-semibold ${
                        isSelected
                          ? 'border-emerald-600/35 text-emerald-300 bg-emerald-600/10'
                          : isSelectionBlocked
                            ? 'border-[var(--border-subtle)] text-muted/50 cursor-not-allowed'
                            : 'border-[var(--border-subtle)] text-muted'
                      }`}
                    >
                      {isSelected ? 'Batalkan Pilihan' : 'Pilih Diagnosis'}
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2 mb-2">
                    <div className="ct-neu-cell bg-[var(--surface-primary)] border border-[var(--border-subtle)] rounded-[6px] p-2">
                      <div className="text-tiny font-bold text-muted uppercase tracking-wide mb-1">
                        Berdasarkan Gejala
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {insight.matchedSymptoms.length > 0 ? (
                          insight.matchedSymptoms.map((item) => (
                            <span
                              key={item}
                              className="px-2 py-0.5 rounded bg-carbon-800/70 border border-[var(--border-subtle)] text-[10px] text-muted"
                            >
                              {humanize(item)}
                            </span>
                          ))
                        ) : (
                          <span className="text-[10px] text-muted">
                            Tidak ada sinyal gejala dominan.
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="ct-neu-cell bg-[var(--surface-primary)] border border-[var(--border-subtle)] rounded-[6px] p-2">
                      <div className="text-tiny font-bold text-muted uppercase tracking-wide mb-1">
                        Driver TTV
                      </div>
                      <div className="flex flex-col gap-1">
                        {insight.vitalDrivers.length > 0 ? (
                          insight.vitalDrivers.slice(0, 2).map((driver) => (
                            <div key={driver} className="text-[10px] text-muted leading-snug">
                              • {humanize(driver)}
                            </div>
                          ))
                        ) : (
                          <div className="text-[10px] text-muted">
                            Tidak ada abnormalitas TTV dominan.
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div
                    className="ct-neu-cell bg-[var(--surface-primary)] border rounded-[6px] p-2 mb-2"
                    style={{ borderColor: needStyle.border }}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <div className="text-tiny font-bold text-muted uppercase tracking-wide">
                        Pemeriksaan Penunjang
                      </div>
                      <span
                        className="px-2 py-0.5 rounded border text-[10px] font-bold tracking-wide"
                        style={{
                          color: needStyle.color,
                          background: needStyle.bg,
                          borderColor: needStyle.border,
                        }}
                      >
                        {needStyle.label}
                      </span>
                    </div>
                    <div className="text-[10px] text-muted mb-1">
                      {insight.supportingExamPlan.summary}
                    </div>
                    <div className="flex flex-col gap-1">
                      {insight.supportingExamPlan.tests.slice(0, 4).map((test) => (
                        <div key={test} className="text-[10px] text-muted leading-snug">
                          • {humanize(test)}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="text-[11px] text-muted leading-relaxed mb-2">
                    {humanize(
                      suggestion.rationale ||
                        suggestion.reasoning ||
                        'Rasional klinis tidak tersedia.'
                    )}
                  </div>

                  {suggestion.red_flags && suggestion.red_flags.length > 0 && (
                    <div className="mb-2">
                      <div className="text-[10px] text-critical uppercase font-bold tracking-wide mb-1">
                        Red Flags
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {suggestion.red_flags.slice(0, 4).map((flag) => (
                          <span
                            key={flag}
                            className="px-2 py-0.5 rounded bg-critical/10 border border-critical/30 text-[10px] text-critical"
                          >
                            {humanize(flag)}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {suggestion.recommended_actions && suggestion.recommended_actions.length > 0 && (
                    <div>
                      <div className="text-[10px] text-muted uppercase font-bold tracking-wide mb-1">
                        Aksi Awal Disarankan
                      </div>
                      <div className="flex flex-col gap-1">
                        {suggestion.recommended_actions.slice(0, 3).map((action) => (
                          <div key={action} className="text-[10px] text-muted leading-snug">
                            • {humanize(action)}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </details>
            );
          })}

          <div className="ttv-section p-4">
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="text-tiny font-bold text-muted uppercase tracking-wide">
                Step 1 • Diagnosis Terpilih
              </div>
              <span className="px-2 py-0.5 rounded border border-[var(--border-subtle)] text-[10px] text-muted">
                {selectedDiagnoses.length}/{MAX_DIAGNOSIS_SELECTION}
              </span>
            </div>
            {selectedDiagnoses.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {selectedDiagnoses.map((diagnosis) => (
                  <button
                    key={diagnosisKey(diagnosis)}
                    onClick={() => removeDiagnosis(diagnosis)}
                    className="px-2 py-1 rounded border border-emerald-600/35 bg-emerald-600/10 text-[10px] text-emerald-300"
                  >
                    {diagnosis.icd_x} - {humanize(diagnosis.nama)} ×
                  </button>
                ))}
              </div>
            ) : (
              <div className="text-[10px] text-muted">
                Pilih 1-2 diagnosis dari daftar differential. Klik ulang diagnosis untuk
                membatalkan.
              </div>
            )}
          </div>

          <div className="ttv-section p-4">
            <button
              onClick={() => setShowManualDiagnosisInput((prev) => !prev)}
              className="px-3 py-2 text-[11px] font-semibold rounded-[6px] border border-[var(--border-subtle)] text-platinum flex items-center gap-2"
            >
              <span className="text-muted text-sm">{showManualDiagnosisInput ? '▾' : '▸'}</span>
              {showManualDiagnosisInput
                ? 'Step 1b • Tutup Diagnosis Manual'
                : 'Step 1b • Input Diagnosis Manual (Opsional)'}
            </button>
            {showManualDiagnosisInput && (
              <div className="mt-3">
                <div className="grid grid-cols-2 gap-2 mb-2">
                  <input
                    value={manualIcd}
                    onChange={(event) => setManualIcd(event.target.value)}
                    placeholder="ICD-X manual (contoh: I10)"
                    className="bg-[var(--surface-primary)] border border-[var(--border-subtle)] rounded-[6px] px-2 py-2 text-xs text-platinum outline-none"
                  />
                  <input
                    value={manualName}
                    onChange={(event) => setManualName(event.target.value)}
                    placeholder="Nama diagnosis manual (opsional)"
                    className="bg-[var(--surface-primary)] border border-[var(--border-subtle)] rounded-[6px] px-2 py-2 text-xs text-platinum outline-none"
                  />
                </div>
                <button
                  onClick={selectManualDiagnosis}
                  className="px-3 py-2 text-[11px] font-semibold rounded-[6px] border border-emerald-600/40 text-emerald-300 bg-emerald-600/10"
                >
                  Gunakan Diagnosis Manual
                </button>
              </div>
            )}
          </div>

          <div className="ttv-section p-4">
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="text-tiny font-bold text-muted uppercase tracking-wide">
                Step 2 • Rekomendasi Resep
              </div>
              <span className="px-2 py-0.5 rounded border border-[var(--border-subtle)] text-[10px] text-muted">
                Basis:{' '}
                {selectedDiagnoses.length > 0
                  ? selectedDiagnoses.map((item) => item.icd_x).join(', ')
                  : 'Belum dipilih'}
              </span>
            </div>
            <div className="mb-2 ct-neu-cell bg-[var(--surface-primary)] border border-[var(--border-subtle)] rounded-[6px] px-2 py-2">
              <div className="flex items-center justify-between gap-2">
                <div className="text-[10px] text-muted leading-snug">
                  Obat dipilih:{' '}
                  <span className="text-platinum font-semibold">{selectedMedicationCount}</span>/
                  {candidateMedicationCount}
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={selectAllRecommendedMedications}
                    disabled={
                      candidateMedicationCount === 0 ||
                      selectedMedicationCount === candidateMedicationCount
                    }
                    className="px-2 py-1 rounded border border-emerald-600/35 text-[10px] text-emerald-300 bg-emerald-600/10 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Pilih Semua
                  </button>
                  <button
                    onClick={clearSelectedMedications}
                    disabled={selectedMedicationCount === 0}
                    className="px-2 py-1 rounded border border-[var(--border-subtle)] text-[10px] text-muted disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Reset
                  </button>
                </div>
              </div>
            </div>
            <div className="mb-2 ct-neu-cell bg-[var(--surface-primary)] border border-[var(--border-subtle)] rounded-[6px] px-2 py-2">
              {selectedDiagnoses.length === 0 && (
                <div className="mb-2 text-[10px] text-muted leading-snug">
                  Belum ada diagnosis dipilih. Obat manual tetap bisa disiapkan, tapi uplink resep
                  membutuhkan diagnosis.
                </div>
              )}
              <div className="mb-2">
                <button
                  onClick={() => setShowManualMedicationInput((prev) => !prev)}
                  className="w-full flex items-center justify-between gap-2 text-[10px] text-platinum"
                >
                  <span className="font-semibold uppercase tracking-wide">Input Obat Manual</span>
                  <span className="text-muted">{showManualMedicationInput ? '▾' : '▸'}</span>
                </button>
              </div>

              {showManualMedicationInput && (
                <div className="mt-2 grid grid-cols-1 gap-2">
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      value={manualMedicationDraft.nama_obat}
                      onChange={(event) =>
                        updateManualMedicationDraft('nama_obat', event.target.value)
                      }
                      placeholder="Nama obat manual"
                      className="bg-[var(--surface-primary)] border border-[var(--border-subtle)] rounded-[6px] px-2 py-2 text-[11px] text-platinum outline-none"
                    />
                    <input
                      value={manualMedicationDraft.dosis}
                      onChange={(event) => updateManualMedicationDraft('dosis', event.target.value)}
                      placeholder="Dosis (contoh: 3x1)"
                      className="bg-[var(--surface-primary)] border border-[var(--border-subtle)] rounded-[6px] px-2 py-2 text-[11px] text-platinum outline-none"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <select
                      value={manualMedicationDraft.aturan_pakai}
                      onChange={(event) =>
                        updateManualMedicationDraft(
                          'aturan_pakai',
                          event.target.value as ManualMedicationDraft['aturan_pakai']
                        )
                      }
                      className="bg-[var(--surface-primary)] border border-[var(--border-subtle)] rounded-[6px] px-2 py-2 text-[11px] text-platinum outline-none"
                    >
                      {MANUAL_ATURAN_PAKAI_OPTIONS.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                    <input
                      value={manualMedicationDraft.durasi}
                      onChange={(event) =>
                        updateManualMedicationDraft('durasi', event.target.value)
                      }
                      placeholder="Durasi (contoh: 3 hari)"
                      className="bg-[var(--surface-primary)] border border-[var(--border-subtle)] rounded-[6px] px-2 py-2 text-[11px] text-platinum outline-none"
                    />
                  </div>
                  <input
                    value={manualMedicationDraft.rationale}
                    onChange={(event) =>
                      updateManualMedicationDraft('rationale', event.target.value)
                    }
                    placeholder="Catatan klinis singkat (opsional)"
                    className="bg-[var(--surface-primary)] border border-[var(--border-subtle)] rounded-[6px] px-2 py-2 text-[11px] text-platinum outline-none"
                  />
                  <button
                    onClick={addManualMedication}
                    className="px-3 py-2 text-[11px] font-semibold rounded-[6px] border border-emerald-600/40 text-emerald-300 bg-emerald-600/10"
                  >
                    Tambah Obat Manual
                  </button>
                </div>
              )}

              {manualMedications.length > 0 && (
                <div className="mt-2 grid grid-cols-1 gap-1.5">
                  {manualMedications.map((medication, index) => {
                    const medKey = medicationSelectionKey(medication);
                    const isMedicationSelected = selectedMedicationKeySet.has(medKey);

                    return (
                      <div
                        key={`manual-${medKey}-${index}`}
                        className={`rounded-[6px] border px-2 py-2 ${
                          isMedicationSelected
                            ? 'border-emerald-600/35 bg-emerald-600/10'
                            : 'border-[var(--border-subtle)]'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-start gap-2">
                            <input
                              type="checkbox"
                              checked={isMedicationSelected}
                              onChange={() => toggleMedicationSelection(medication)}
                              className="mt-0.5 h-3.5 w-3.5 accent-emerald-500 cursor-pointer"
                            />
                            <div>
                              <div className="text-[11px] text-platinum font-semibold">
                                {medication.nama_obat}
                              </div>
                              <div className="text-[10px] text-muted">
                                {medication.dosis} • {medication.aturan_pakai} •{' '}
                                {medication.durasi || '-'}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="px-2 py-0.5 rounded border border-cyan-600/35 text-[10px] text-cyan-300">
                              MANUAL
                            </span>
                            <button
                              onClick={() => removeManualMedication(medication)}
                              className="px-2 py-0.5 rounded border border-red-600/35 text-[10px] text-red-300"
                            >
                              Hapus
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            {therapyState === 'idle' && (
              <div className="text-[10px] text-muted leading-snug">
                {therapyError ||
                  'Pilih diagnosis terlebih dahulu agar rekomendasi farmakoterapi ditampilkan.'}
              </div>
            )}
            {therapyState === 'loading' && (
              <div className="text-[10px] text-muted leading-snug">
                Mengambil rekomendasi farmakoterapi untuk diagnosis terpilih...
              </div>
            )}
            {therapyState === 'error' && (
              <div className="text-[10px] text-critical leading-snug mb-2">
                {therapyError || 'Gagal memuat rekomendasi farmakoterapi.'}
              </div>
            )}

            {(therapyState === 'ready' || therapyState === 'error' || therapyState === 'loading') &&
            selectedDiagnoses.length > 0 ? (
              <div className="grid grid-cols-1 gap-2">
                {selectedDiagnoses.map((diagnosis) => {
                  const therapyResult = therapyByDiagnosis.find(
                    (result) => diagnosisKey(result.diagnosis) === diagnosisKey(diagnosis)
                  );
                  const medications = therapyResult?.medications || [];
                  const explainability = therapyResult?.explainability;
                  const escalationAlerts = (therapyResult?.alerts || []).filter(
                    (alert) => alert.type === 'red_flag' && alert.severity === 'emergency'
                  );
                  const explainabilityRiskUi = explainability
                    ? riskTierUi(explainability.risk_tier)
                    : null;

                  return (
                    <div
                      key={diagnosisKey(diagnosis)}
                      className="ct-neu-cell bg-[var(--surface-primary)] border border-[var(--border-subtle)] rounded-[6px] p-2"
                    >
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <div className="text-[11px] font-semibold text-platinum">
                          {diagnosis.icd_x} - {humanize(diagnosis.nama)}
                        </div>
                        <button
                          onClick={() => removeDiagnosis(diagnosis)}
                          className="px-2 py-0.5 rounded border border-[var(--border-subtle)] text-[10px] text-muted"
                        >
                          Batalkan
                        </button>
                      </div>

                      {!therapyResult && therapyState === 'loading' && (
                        <div className="text-[10px] text-muted">
                          Menyiapkan rekomendasi farmakoterapi...
                        </div>
                      )}
                      {therapyResult?.error && (
                        <div className="text-[10px] text-critical">{therapyResult.error}</div>
                      )}
                      {therapyResult && !therapyResult.error && explainability && (
                        <div className="ct-neu-cell bg-[var(--surface-primary)] border border-[var(--border-subtle)] rounded-[6px] p-2 mb-2">
                          <div className="flex items-center justify-between gap-2 mb-2">
                            <div className="text-tiny font-bold text-muted uppercase tracking-wide">
                              Explainability
                            </div>
                            <div className="flex items-center gap-1.5">
                              {explainabilityRiskUi && (
                                <span
                                  className={`px-2 py-0.5 rounded border text-[10px] font-semibold ${explainabilityRiskUi.badgeClass}`}
                                >
                                  {explainabilityRiskUi.label}
                                </span>
                              )}
                              <span className="px-2 py-0.5 rounded border border-[var(--border-subtle)] text-[10px] text-platinum font-mono">
                                {Math.round(explainability.confidence)}%
                              </span>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-2 mb-2">
                            <div className="text-[10px] text-muted">
                              Review window:{' '}
                              <span className="text-platinum font-mono">
                                {explainability.review_window}
                              </span>
                            </div>
                            <div className="text-[10px] text-muted">
                              Pathway:{' '}
                              <span className="text-platinum">
                                {pathwayUi(explainability.pathway)}
                              </span>
                            </div>
                          </div>
                          <div className="text-[10px] text-muted uppercase tracking-wide font-semibold mb-1">
                            Drivers
                          </div>
                          <div className="flex flex-col gap-1">
                            {explainability.drivers.slice(0, 5).map((driver) => (
                              <div key={driver} className="text-[10px] text-muted leading-snug">
                                • {humanize(driver)}
                              </div>
                            ))}
                          </div>
                          {explainability.missing_data.length > 0 && (
                            <div className="mt-2">
                              <div className="text-[10px] text-amber-300 uppercase tracking-wide font-semibold mb-1">
                                Missing Data
                              </div>
                              <div className="flex flex-wrap gap-1">
                                {explainability.missing_data.map((item) => (
                                  <span
                                    key={item}
                                    className="px-2 py-0.5 rounded border border-amber-600/35 bg-amber-600/10 text-[10px] text-amber-300"
                                  >
                                    {humanize(item)}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                      {therapyResult && !therapyResult.error && escalationAlerts.length > 0 && (
                        <div className="ct-neu-cell bg-red-600/10 border border-red-600/35 rounded-[6px] p-2 mb-2">
                          <div className="text-[10px] text-red-300 font-semibold uppercase tracking-wide mb-1">
                            Escalation Alert
                          </div>
                          {escalationAlerts.slice(0, 2).map((alert) => (
                            <div
                              key={alert.id}
                              className="text-[10px] text-red-200 leading-snug mb-1 last:mb-0"
                            >
                              • {humanize(alert.title)}: {humanize(alert.message)}
                            </div>
                          ))}
                        </div>
                      )}
                      {therapyResult && !therapyResult.error && medications.length > 0 && (
                        <div className="grid grid-cols-1 gap-2">
                          {medications.slice(0, 5).map((med) => {
                            const medKey = medicationSelectionKey(med);
                            const isMedicationSelected = selectedMedicationKeySet.has(medKey);

                            return (
                              <div
                                key={`${diagnosisKey(diagnosis)}-${med.nama_obat}-${med.dosis}`}
                                className={`neu-list-item rounded-[10px] p-2 border ${
                                  isMedicationSelected
                                    ? 'border-emerald-600/35 bg-emerald-600/10'
                                    : 'border-[var(--border-subtle)]'
                                }`}
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <div className="flex items-start gap-2">
                                    <input
                                      type="checkbox"
                                      checked={isMedicationSelected}
                                      onChange={() => toggleMedicationSelection(med)}
                                      className="mt-0.5 h-3.5 w-3.5 accent-emerald-500 cursor-pointer"
                                    />
                                    <div>
                                      <div className="text-xs font-semibold text-platinum">
                                        {med.nama_obat}
                                      </div>
                                      <div className="text-[10px] text-muted mt-0.5">
                                        {med.dosis} • {med.aturan_pakai} • {med.durasi || '-'}
                                      </div>
                                    </div>
                                  </div>
                                  <span
                                    className={`px-2 py-0.5 rounded border text-[10px] font-semibold ${
                                      med.safety_check === 'safe'
                                        ? 'border-emerald-600/35 text-emerald-400'
                                        : med.safety_check === 'caution'
                                          ? 'border-amber-600/35 text-amber-400'
                                          : 'border-red-600/35 text-red-400'
                                    }`}
                                  >
                                    {med.safety_check.toUpperCase()}
                                  </span>
                                </div>
                                <div className="text-[10px] text-muted mt-1 leading-snug">
                                  {humanize(med.rationale)}
                                </div>
                                {med.contraindications && med.contraindications.length > 0 && (
                                  <div className="text-[10px] text-amber-300 mt-1">
                                    Kontraindikasi:{' '}
                                    {med.contraindications.map((c) => humanize(c)).join('; ')}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                      {therapyResult &&
                        !therapyResult.error &&
                        therapyResult.guidelines.length > 0 && (
                          <div className="ct-neu-cell bg-[var(--surface-primary)] border border-[var(--border-subtle)] rounded-[6px] p-2 mt-2">
                            <div className="text-[10px] text-muted uppercase tracking-wide font-semibold mb-1">
                              Guideline Notes
                            </div>
                            <div className="flex flex-col gap-1">
                              {therapyResult.guidelines.slice(0, 3).map((guide) => (
                                <div key={guide} className="text-[10px] text-muted leading-snug">
                                  • {humanize(guide)}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      {therapyResult && !therapyResult.error && medications.length === 0 && (
                        <div className="text-[10px] text-muted">
                          Belum ada paket terapi farmakologi terstruktur untuk diagnosis ini.
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : null}
          </div>
        </div>
      )}

      <div className="ttv-section p-4">
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="text-tiny font-bold text-muted uppercase tracking-wide">
            Step 3 • Uplink ke ePuskesmas
          </div>
          <span
            className={`px-2 py-0.5 rounded border text-[10px] font-semibold ${
              transferUiState === 'success'
                ? 'border-emerald-600/35 text-emerald-300 bg-emerald-600/10'
                : transferUiState === 'partial'
                  ? 'border-amber-600/35 text-amber-300 bg-amber-600/10'
                  : transferUiState === 'running'
                    ? 'border-blue-600/35 text-blue-300 bg-blue-600/10'
                    : transferUiState === 'failed'
                      ? 'border-red-600/35 text-red-300 bg-red-600/10'
                      : 'border-[var(--border-subtle)] text-muted'
            }`}
          >
            {transferUiState.toUpperCase()}
          </span>
        </div>

        <details className="mb-3">
          <summary className="cursor-pointer list-none text-[10px] text-muted uppercase tracking-wide font-semibold">
            Detail Status Transfer
          </summary>
          <div className="grid grid-cols-1 gap-2 mt-2">
            {TRANSFER_STEP_ORDER.map((step) => {
              const status = transferSteps[step];
              const hasError = status.state === 'failed' || status.state === 'partial';
              return (
                <div
                  key={step}
                  className={`ct-neu-cell rounded-[6px] p-2 border ${
                    hasError
                      ? 'border-amber-600/35 bg-amber-600/10'
                      : status.state === 'success'
                        ? 'border-emerald-600/35 bg-emerald-600/10'
                        : status.state === 'running'
                          ? 'border-blue-600/35 bg-blue-600/10'
                          : 'border-[var(--border-subtle)] bg-[var(--surface-primary)]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-[11px] font-semibold text-platinum">{stepLabel(step)}</div>
                    <div className="text-[10px] text-muted font-mono">
                      {status.state} • {status.latencyMs}ms • try {status.attempt}
                    </div>
                  </div>
                  <div className="text-[10px] text-muted mt-1">
                    ok:{status.successCount} fail:{status.failedCount} skip:{status.skippedCount}
                  </div>
                  {status.reasonCode && (
                    <div className="text-[10px] text-amber-300 mt-1 leading-snug">
                      {REASON_CODE_LABELS[status.reasonCode]}
                    </div>
                  )}
                  {status.message && (
                    <div className="text-[10px] text-muted mt-1 leading-snug">{status.message}</div>
                  )}
                </div>
              );
            })}
          </div>
        </details>

        {transferReasonCodes.length > 0 && (
          <div className="mb-3 text-[10px] text-muted leading-snug">
            Reason code:{' '}
            {transferReasonCodes.map((code) => REASON_CODE_LABELS[code] || code).join(' | ')}
          </div>
        )}

        {transferError && (
          <div className="mb-3 text-[10px] text-red-300 leading-snug">{transferError}</div>
        )}

        {transferResult && (
          <div className="mb-3 text-[10px] text-muted leading-snug font-mono">
            runId: {transferResult.runId} • total: {transferResult.totalLatencyMs}ms
          </div>
        )}

        <div className="mb-3">
          <button
            onClick={() => {
              void handleAutoFillAll(false);
            }}
            disabled={transferUiState === 'running'}
            className="w-full px-4 py-2.5 text-[12px] font-bold rounded-[6px] border border-[#eb5939]/60 text-white bg-[#eb5939]/20 hover:bg-[#eb5939]/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Auto Fill RME
          </button>
        </div>

        <div className="grid grid-cols-1 gap-3">
          <div className="ct-neu-cell bg-[var(--surface-primary)] border border-[var(--border-subtle)] rounded-[6px] p-3">
            <div className="text-[11px] font-semibold text-platinum mb-2">Diagnosis</div>
            <button
              onClick={() => {
                void handleTransferToRME('diagnosa', false);
              }}
              disabled={!hasDiagnosisForTransfer || transferUiState === 'running'}
              className="w-full px-3 py-2 text-[11px] font-semibold rounded-[6px] border border-cyan-600/40 text-cyan-300 bg-cyan-600/10 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Uplink Diagnosis
            </button>
          </div>

          <div className="ct-neu-cell bg-[var(--surface-primary)] border border-[var(--border-subtle)] rounded-[6px] p-3">
            <div className="text-[11px] font-semibold text-platinum mb-2">Pharmacotherapy</div>
            <button
              onClick={() => {
                void handleTransferToRME('resep', false);
              }}
              disabled={!hasResepPayloadReady || transferUiState === 'running'}
              className="w-full px-3 py-2 text-[11px] font-semibold rounded-[6px] border border-emerald-600/40 text-emerald-300 bg-emerald-600/10 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Uplink Resep
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2 mt-3">
          <button
            onClick={() => {
              void handleTransferToRME('anamnesa', false);
            }}
            disabled={transferUiState === 'running'}
            className="px-3 py-2 text-[11px] font-semibold rounded-[6px] border border-blue-600/40 text-blue-300 bg-blue-600/10 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Uplink Anamnesa
          </button>
          <button
            onClick={() => {
              void handleTransferToRME(lastTriggeredStep, true);
            }}
            disabled={transferUiState === 'running'}
            className="px-3 py-2 text-[11px] font-semibold rounded-[6px] border border-amber-600/40 text-amber-300 bg-amber-600/10 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Paksa Rerun Step
          </button>
          <button
            onClick={() => {
              void handleCancelTransfer();
            }}
            disabled={transferUiState !== 'running' || !transferRunId}
            className="px-3 py-2 text-[11px] font-semibold rounded-[6px] border border-red-600/40 text-red-300 bg-red-600/10 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
        </div>

        {(!hasDiagnosisForTransfer || !hasResepPayloadReady) && (
          <div className="mt-2 text-[10px] text-muted leading-snug">
            Pilih diagnosis terlebih dahulu, lalu pilih minimal 1 obat proposal/manual sebelum
            uplink Pharmacotherapy.
          </div>
        )}
      </div>

      <div className="bg-amber-700/10 border border-amber-700/30 rounded-[6px] p-3">
        <div className="text-[10px] text-amber-400 font-semibold uppercase tracking-wide mb-1">
          Clinical Safety Note
        </div>
        <div className="text-[10px] text-muted leading-relaxed">
          Differential diagnosis adalah dukungan klinis awal, bukan diagnosis final. Konfirmasi
          dengan anamnesis lanjutan, pemeriksaan fisik, dan pemeriksaan penunjang sesuai konteks
          FKTP.
        </div>
      </div>
    </div>
  );
};
