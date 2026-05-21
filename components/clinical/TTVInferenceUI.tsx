// Designed and constructed by Claudesy.
import { TextEffect } from '@/components/ui/TextEffect';
import {
  BRIDGE_AUTH_REQUIRED_HINT,
  evaluateCanonicalClinicalEngine,
  extractClinicalAnamnesis,
  getBridgeRuntimeStatus,
  getOnlineDoctors,
  sendConsultToDoctor,
  type CanonicalClinicalEngineOutput,
  type OnlineDoctor,
} from '@/lib/api/bridge-client';
import { determineAVPU, type AvpuResult } from '@/lib/clinical/aassist-v2/avpu-engine';
import {
  canOverrideField,
  makeFieldMeta,
  type FieldMeta,
} from '@/lib/clinical/aassist-v2/field-priority';
import {
  buildAnamnesisShadowSuggestion,
  composeAnamnesaDraft,
  composeAnamnesaDraftFromExtraction,
  type ComposedAnamnesaDraft,
} from '@/lib/clinical/anamnesa-composer';
import { AutosenPreset, DisabilityType, ObesityConfirmation } from '@/lib/clinical/autosen-types';
import {
  buildCanonicalRequestId,
  buildCanonicalTriageInput,
} from '@/lib/clinical/canonical-triage-builder';
import { buildVitalAutofill } from '@/lib/clinical/vital-autocomplete';
import { getVitalScreeningProfile } from '@/lib/clinical/vital-screening-thresholds';
import {
  detectOccultShock,
  type HistoricalBP,
  type OccultShockInput,
} from '@/lib/emergency-detector/occult-shock-detector';
import {
  classifyHypertension,
  getHTNSeverity,
  type BPMeasurementSession,
} from '@/lib/emergency-detector/htn-classifier';
import { classifyBloodGlucose } from '@/lib/emergency-detector/glucose-classifier';
import { buildClinicalSnapshot } from '@/lib/emergency-detector/clinical-snapshot';
import { CLINICAL_PATTERNS } from '@/lib/emergency-detector/clinical-patterns';
import { evaluatePatterns, patternMatchesToAlerts } from '@/lib/emergency-detector/pattern-engine';
import type { VisitRecord } from '@/lib/iskandar-diagnosis-engine/visit-history-store';
import { playSound } from '@/utils/sound';
import { createLogger } from '@/utils/logger';
import type { AnamnesisMissingField } from '@/utils/types';
import { AlertTriangle, ChevronDown, RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { browser } from 'wxt/browser';

/**
 * ScreeningAlert interface
 *
 * @remarks
 * TODO: Add type description and property documentation
 * Auto-generated on 2026-04-15
 */

export interface ScreeningAlert {
  id: string;
  type: string;
  severity: 'critical' | 'high' | 'warning';
  title: string;
  gate: string;
  reasoning: string;
  recommendations: string[];
  clinicalData?: {
    sbp?: number;
    dbp?: number;
    hr?: number;
    rr?: number;
    temp?: number;
    spo2?: number;
    glucose?: number;
    map?: number;
  };
}

/**
 * TTVInferenceData interface
 *
 * @remarks
 * TODO: Add type description and property documentation
 * Auto-generated on 2026-04-15
 */

export interface TTVInferenceData {
  patient: {
    name: string;
    gender: 'L' | 'P';
    age: number;
    rm: string;
    dob?: string;
    bloodType?: string;
    bpjsStatus?: 'aktif' | 'nonaktif' | 'mandiri' | null;
    kelurahan?: string;
  };
  vitals: {
    sbp: number;
    dbp: number;
    hr: number;
    rr: number;
    temp: number;
    spo2: number;
    glucose: number;
  };
  symptomText: string;
  allergies: string[];
  pregnancyStatus: boolean | null;
  disabilityType: DisabilityType;
  obesityConfirmation: ObesityConfirmation;
  autosenPreset: AutosenPreset;
  alerts: ScreeningAlert[];
  summary: string;
  anamnesaDraft: ComposedAnamnesaDraft;
  generatedAt: string;
}

interface TTVStateShape {
  sbp: string;
  dbp: string;
  hr: string;
  rr: string;
  temp: string;
  spo2: string;
  glucose: string;
  symptomText: string;
  allergies: string[];
  pregnancyStatus: boolean | null;
  disabilityType: DisabilityType;
  obesityConfirmation: ObesityConfirmation;
  autosenPreset: AutosenPreset;
  avpu: 'A' | 'C' | 'V' | 'P' | 'U';
  supplemental_o2: boolean;
  pain_score: string;
}

type VitalFieldKey = 'sbp' | 'dbp' | 'hr' | 'rr' | 'temp' | 'spo2' | 'glucose';
const VITAL_FIELD_KEYS: readonly VitalFieldKey[] = [
  'sbp',
  'dbp',
  'hr',
  'rr',
  'temp',
  'spo2',
  'glucose',
];

// Module-scope constant — not recreated on each render
const SCRAMBLE_CHARS = 'ABCDEFGHIJKLMNOPRSTUVWXYZ01234!@#$%';

/** Derive physical exam context from keluhan + AVPU for Intelligence Dashboard consult */
function buildPhysicalExamContext(keluhan: string, avpu: string): Record<string, string> {
  const k = keluhan.toLowerCase();
  const findings: Record<string, string> = {};
  const hasNyeri = /nyeri|sakit|pegal|linu|ngilu/.test(k);

  if (/kaki|lutut|betis|tungkai|paha|pergelangan kaki/.test(k))
    findings['ekstremitas_bawah'] = hasNyeri
      ? 'Nyeri tekan (+), ROM terbatas'
      : 'Dalam batas normal';
  if (/tangan|lengan|siku|pergelangan tangan|jari/.test(k))
    findings['ekstremitas_atas'] = hasNyeri ? 'Nyeri tekan (+)' : 'Dalam batas normal';
  if (/perut|abdomen|mulas|ulu hati|mual|diare/.test(k))
    findings['abdomen'] = hasNyeri
      ? 'Nyeri tekan (+), bising usus normal'
      : 'Supel, bising usus normal';
  if (/dada|sesak|nafas|batuk/.test(k))
    findings['thorax'] = /sesak|nafas/.test(k)
      ? 'Auskultasi: evaluasi pernafasan'
      : 'Dalam batas normal';
  if (/kepala|pusing|migrain|vertigo/.test(k))
    findings['kepala'] = 'Tidak ada jejas, nyeri tekan kepala (+)';
  if (/leher|kaku kuduk/.test(k))
    findings['leher'] = hasNyeri ? 'Nyeri gerak leher (+)' : 'Dalam batas normal';
  if (avpu && avpu !== 'A') findings['kesadaran'] = `AVPU ${avpu} — perlu asesmen lanjutan`;

  return findings;
}

type AvpuValue = 'A' | 'C' | 'V' | 'P' | 'U';
const AVPU_OPTIONS: AvpuValue[] = ['A', 'C', 'V', 'P', 'U'];
const AVPU_LABELS: Record<AvpuValue, string> = {
  A: 'Alert',
  C: 'Confusion',
  V: 'Voice',
  P: 'Pain',
  U: 'Unresponsive',
};
type VitalGhostLane = 'bp' | 'glucose' | 'hr' | 'rr' | 'temp' | 'spo2';

interface TTVInferenceUIProps {
  patientName?: string;
  patientGender?: 'L' | 'P';
  patientAge?: number;
  patientRM?: string;
  patientDOB?: string;
  patientBloodType?: string;
  patientBPJSStatus?: 'aktif' | 'nonaktif' | 'mandiri' | null;
  patientKelurahan?: string;
  onComplete?: (data: TTVInferenceData) => void;
  onAlertsChange?: (alerts: ScreeningAlert[]) => void;
  onAccessEmergency?: () => void;
  showMaskedName?: boolean;
  ttvState?: TTVStateShape;
  onTTVStateChange?: (state: TTVStateShape) => void;
  onRefreshPatient?: () => void | Promise<void>;
  isLoadingPatient?: boolean;
  onNavigateToTrajectory?: () => void;
  onChronicHistoryChange?: (summary: string) => void;
  prefilledHistoryFlags?: Record<string, boolean>;
  extractedSpecialConditions?: string[];
  extractedPregnancyRisk?: string;
  extractedFacilityName?: string;
  extractedPayerLabel?: string;
  extractedAllergies?: string[];
  extractedPregnancyStatus?: boolean | null;
  canonicalOutput?: CanonicalClinicalEngineOutput | null;
  prefetchedVisits?: VisitRecord[];
  onSentraUplink?: () => void | Promise<void>;
}

const DEFAULT_STATE: TTVStateShape = {
  sbp: '',
  dbp: '',
  hr: '',
  rr: '',
  temp: '',
  spo2: '',
  glucose: '',
  symptomText: '',
  allergies: [],
  pregnancyStatus: null,
  disabilityType: '',
  obesityConfirmation: '',
  autosenPreset: '',
  avpu: 'A',
  supplemental_o2: false,
  pain_score: '',
};

const historyItems = [
  { id: 'dm', label: 'DM' },
  { id: 'ht', label: 'HT' },
  { id: 'jantung', label: 'Jantung' },
  { id: 'stroke', label: 'Stroke' },
  { id: 'ginjal', label: 'Ginjal' },
  { id: 'asma', label: 'Asma' },
] as const;

const allergyPresets = ['Makanan', 'Kulit', 'Debu', 'Obat'] as const;
const VITAL_GHOST_LANES: VitalGhostLane[] = ['bp', 'glucose', 'hr', 'rr', 'temp', 'spo2'];
const VITAL_GHOST_LANE_FIELDS: Record<VitalGhostLane, VitalFieldKey[]> = {
  bp: ['sbp', 'dbp'],
  glucose: ['glucose'],
  hr: ['hr'],
  rr: ['rr'],
  temp: ['temp'],
  spo2: ['spo2'],
};
const disabilityOptions: DisabilityType[] = [
  '',
  'Netra',
  'Rungu',
  'Daksa',
  'Intelektual',
  'Emosi dan Perilaku',
  'Komunikasi',
  'Mental',
  'Hiperaktivitas',
  'Belajar spesifik',
  'Spektrum Autis (ASD)',
];

const presetLabels: Record<AutosenPreset, string> = {
  '': 'Pilih di sini',
  hypertension: 'Hipertensi',
  hyperglycemia: 'Hiperglikema',
  hypoglycemia: 'Hipoglikemi',
  hypotension: 'Hipotensi',
  glucose_tolerance: 'Gangguan Toleransi glukosa',
  adl: 'ADL Terganggu',
};

const parseNumber = (value: string): number => {
  const normalized = value.replace(',', '.').trim();
  if (!normalized) {
    return 0;
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
};

const shuffleGhostLanes = (lanes: readonly VitalGhostLane[]): VitalGhostLane[] => {
  const next = [...lanes];

  for (let index = next.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
  }

  return next;
};

const getSelectedHistoryLabels = (flags: Record<string, boolean>): string[] =>
  historyItems.filter((item) => flags[item.id]).map((item) => item.label);

const createEmptyHistoryFlags = (): Record<string, boolean> =>
  historyItems.reduce(
    (accumulator, item) => {
      accumulator[item.id] = false;
      return accumulator;
    },
    {} as Record<string, boolean>
  );

export const AVAILABILITY_LABELS: Record<
  NonNullable<OnlineDoctor['availability_status']>,
  string
> = {
  online: 'ONLINE',
  busy: 'BUSY',
  away: 'AWAY',
  offline: 'OFFLINE',
};

const AVAILABILITY_RANK: Record<NonNullable<OnlineDoctor['availability_status']>, number> = {
  online: 0,
  busy: 1,
  away: 2,
  offline: 3,
};

const normalizeText = (value?: string): string => (value || '').trim().toLowerCase();

const HYBRID_AUTOTEXT_ENABLED = import.meta.env.VITE_ENABLE_HYBRID_AUTOTEXT !== 'false';
const ttvLog = createLogger('TTVInferenceUI', 'content');

/**
 * getDoctorInitials
 *
 * @remarks
 * TODO: Add detailed description, parameters, and examples
 * Auto-generated on 2026-04-15
 */

export const getDoctorInitials = (name: string): string =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');

/**
 * formatLastSeenRelative
 *
 * @remarks
 * TODO: Add detailed description, parameters, and examples
 * Auto-generated on 2026-04-15
 */

export const formatLastSeenRelative = (iso?: string): string => {
  if (!iso) return 'Tidak ada data aktivitas';

  const timestamp = new Date(iso).getTime();
  if (!Number.isFinite(timestamp)) return 'Waktu aktivitas tidak valid';

  const diffMs = Date.now() - timestamp;
  if (diffMs < 60_000) return 'Aktif baru saja';
  if (diffMs < 60 * 60_000) return `Aktif ${Math.max(1, Math.floor(diffMs / 60_000))} menit lalu`;
  if (diffMs < 24 * 60 * 60_000) {
    return `Aktif ${Math.max(1, Math.floor(diffMs / (60 * 60_000)))} jam lalu`;
  }

  return `Aktif ${Math.max(1, Math.floor(diffMs / (24 * 60 * 60_000)))} hari lalu`;
};

/**
 * toSafeAutoTextReason
 *
 * @remarks
 * TODO: Add detailed description, parameters, and examples
 * Auto-generated on 2026-04-15
 */

export const toSafeAutoTextReason = (error: unknown, fallback: string): string => {
  const message = error instanceof Error ? error.message : fallback;
  const normalized = message.trim().toLowerCase();
  if (normalized.startsWith('<!doctype html') || normalized.startsWith('<html')) {
    return 'Server extraction mengembalikan HTML, bukan JSON API. Cek Base URL Bridge dan endpoint extraction.';
  }
  return message;
};

const GERIATRIC_ORTHOSTATIC_KEYWORDS = [
  'pusing',
  'berkunang',
  'limbung',
  'jatuh',
  'sinkop',
  'pingsan',
  'lemas',
  'lemah',
] as const;

const GERIATRIC_ATYPICAL_INFECTION_KEYWORDS = [
  'bingung',
  'delirium',
  'jatuh',
  'lemas',
  'lemah',
  'nafsu makan turun',
  'intake turun',
  'penurunan aktivitas',
  'penurunan fungsi',
] as const;

const hasKeywordSignal = (text: string, keywords: readonly string[]): boolean =>
  keywords.some((keyword) => text.includes(keyword));

const derivePreferredPoliKeywords = (
  flags: string[],
  preset: AutosenPreset,
  pregnancyStatus: boolean | null
): string[] => {
  const keywords = new Set<string>(['umum']);

  if (pregnancyStatus === true) {
    keywords.add('kia');
    keywords.add('obgyn');
    keywords.add('kandungan');
  }

  if (flags.includes('Jantung')) {
    keywords.add('jantung');
    keywords.add('penyakit dalam');
  }

  if (flags.includes('DM') || preset === 'hyperglycemia' || preset === 'hypoglycemia') {
    keywords.add('penyakit dalam');
    keywords.add('metabolik');
  }

  if (preset === 'hypertension') {
    keywords.add('penyakit dalam');
  }

  return Array.from(keywords);
};

const formatBpjsStatus = (status?: TTVInferenceUIProps['patientBPJSStatus']): string => {
  if (status === 'aktif') return 'BPJS Aktif';
  if (status === 'nonaktif') return 'BPJS Nonaktif';
  if (status === 'mandiri') return 'Mandiri';
  return 'Menunggu data';
};

const formatPayerLabel = (
  extractedPayerLabel?: string,
  patientBPJSStatus?: TTVInferenceUIProps['patientBPJSStatus']
): string => extractedPayerLabel?.trim() || formatBpjsStatus(patientBPJSStatus);

const humanize = (value: string): string => value.replace(/_/g, ' ').replace(/\s+/g, ' ').trim();

/**
 * matchesPreferredPoli
 *
 * @remarks
 * TODO: Add detailed description, parameters, and examples
 * Auto-generated on 2026-04-15
 */

export const matchesPreferredPoli = (doctor: OnlineDoctor, keywords: string[]): boolean => {
  const poli = normalizeText(doctor.poli);
  if (!poli) {
    return false;
  }

  return keywords.some((keyword) => poli.includes(keyword));
};

/**
 * matchesPreferredFacility
 *
 * @remarks
 * TODO: Add detailed description, parameters, and examples
 * Auto-generated on 2026-04-15
 */

export const matchesPreferredFacility = (doctor: OnlineDoctor, facilityName?: string): boolean => {
  const locationHint = normalizeText(facilityName);
  if (!locationHint) {
    return false;
  }

  const combinedLocation = normalizeText(
    [doctor.location_name, doctor.room_name].filter(Boolean).join(' ')
  );
  return combinedLocation.includes(locationHint);
};

const buildForwardSummary = ({
  targetDoctorName,
  patientName,
  patientRM,
  patientBPJSStatus,
  extractedPayerLabel,
  specialConditions,
  pregnancyRisk,
  facilityName,
  consultId,
  canonicalOutput,
}: {
  targetDoctorName: string;
  patientName: string;
  patientRM: string;
  patientBPJSStatus?: TTVInferenceUIProps['patientBPJSStatus'];
  extractedPayerLabel?: string;
  specialConditions: string[];
  pregnancyRisk?: string;
  facilityName?: string;
  consultId?: string;
  canonicalOutput?: CanonicalClinicalEngineOutput | null;
}): string => {
  const lines = [
    '[FORWARD TO DOCTOR]',
    `Tujuan: ${targetDoctorName}`,
    `Pasien: ${patientName} | RM ${patientRM}`,
    `BPJS/Penjamin: ${formatPayerLabel(extractedPayerLabel, patientBPJSStatus)}`,
    `Penyakit Khusus: ${specialConditions.length > 0 ? specialConditions.join(', ') : 'Tidak terdeteksi'}`,
    `Risiko Kehamilan: ${pregnancyRisk?.trim() || 'Tidak terdeteksi'}`,
    `Faskes RME: ${facilityName?.trim() || 'Tidak terdeteksi'}`,
  ];

  if (canonicalOutput?.scoring.news2) {
    lines.push(
      `Canonical NEWS2: ${canonicalOutput.scoring.news2.score} • ${canonicalOutput.scoring.news2.risk_level.toUpperCase()}`
    );
  }

  if (canonicalOutput?.trajectory?.overall_trend || canonicalOutput?.trajectory?.overall_risk) {
    lines.push(
      `Canonical Trajectory: ${
        canonicalOutput.trajectory?.overall_trend
          ? humanize(canonicalOutput.trajectory.overall_trend).toUpperCase()
          : 'TIDAK TERSEDIA'
      } • ${
        canonicalOutput.trajectory?.overall_risk
          ? humanize(canonicalOutput.trajectory.overall_risk).toUpperCase()
          : 'TIDAK TERSEDIA'
      }`
    );
  }

  if (canonicalOutput?.recommendations.immediate_actions?.length) {
    lines.push(
      `Immediate Actions: ${canonicalOutput.recommendations.immediate_actions.slice(0, 3).join(', ')}`
    );
  }

  if (consultId) {
    lines.push(`Consult ID: ${consultId}`);
  }

  return lines.join('\n');
};

/**
 * buildAlerts
 *
 * @remarks
 * TODO: Add detailed description, parameters, and examples
 * Auto-generated on 2026-04-15
 */

export const buildAlerts = (
  state: TTVStateShape,
  patient: Pick<TTVInferenceUIProps, 'patientAge'>,
  context?: { bpHistory?: HistoricalBP[]; knownHTN?: boolean }
): ScreeningAlert[] => {
  const alerts: ScreeningAlert[] = [];
  const sbp = parseNumber(state.sbp);
  const dbp = parseNumber(state.dbp);
  const hr = parseNumber(state.hr);
  const rr = parseNumber(state.rr);
  const temp = parseNumber(state.temp);
  const spo2 = parseNumber(state.spo2);
  const glucose = parseNumber(state.glucose);
  const map = sbp > 0 && dbp > 0 ? Math.round((sbp + 2 * dbp) / 3) : undefined;
  const physiology = getVitalScreeningProfile(patient.patientAge || 0);
  const ageContext = `${physiology.label.toLowerCase()} (${patient.patientAge || 0} tahun)`;
  const symptomText = normalizeText(state.symptomText);
  const hasOrthostaticCue =
    physiology.isOlderAdult && hasKeywordSignal(symptomText, GERIATRIC_ORTHOSTATIC_KEYWORDS);
  const hasAtypicalInfectionCue =
    physiology.isOlderAdult && hasKeywordSignal(symptomText, GERIATRIC_ATYPICAL_INFECTION_KEYWORDS);

  const hasHypotension =
    sbp > 0 &&
    dbp > 0 &&
    (physiology.isPediatric
      ? sbp < physiology.hypotensionSbpFloor
      : Boolean((map && map < 65) || sbp < physiology.hypotensionSbpFloor));

  if (hasHypotension) {
    alerts.push({
      id: 'hypotension-alert',
      type: 'hypotension',
      severity: 'critical',
      title: physiology.isPediatric
        ? `Hipotensi untuk ${physiology.label}`
        : 'Perfusi rendah terdeteksi',
      gate: 'GATE_1_HEMODYNAMIC',
      reasoning: physiology.isPediatric
        ? `Tekanan darah ${sbp}/${dbp} mmHg berada di bawah ambang hipotensi untuk ${ageContext} (SBP < ${physiology.hypotensionSbpFloor} mmHg).`
        : `Tekanan darah ${sbp}/${dbp} mmHg${
            map ? ` dengan MAP ${map} mmHg` : ''
          } mengarah ke perfusi organ yang tidak adekuat.`,
      recommendations: [
        'Aktifkan evaluasi ABC dan ulang tekanan darah manual.',
        'Pertimbangkan cairan resusitasi sesuai konteks klinis.',
        'Segera eskalasi ke dokter penanggung jawab.',
      ],
      clinicalData: { sbp, dbp, map },
    });
  }

  // ── GATE_AVPU: Consciousness level — via avpu-engine.ts ─────────────────────
  if (sbp > 0 && spo2 > 0) {
    const glucoseSafe = glucose > 0 ? glucose : -1;
    const avpuResult = determineAVPU({ sbp, spo2, rr, hr, glucose: glucoseSafe });
    if (avpuResult.avpu !== 'A') {
      const avpuSeverityMap: Record<string, ScreeningAlert['severity']> = {
        V: 'high',
        P: 'critical',
        U: 'critical',
      };
      const avpuTitleMap: Record<string, string> = {
        V: `Penurunan respons — AVPU: VERBAL (${sbp} mmHg / SpO2 ${spo2}%)`,
        P: `Penurunan kesadaran berat — AVPU: PAIN (SBP ${sbp} / SpO2 ${spo2}%)`,
        U: `TIDAK RESPONSIF — AVPU: UNRESPONSIVE — AKTIFKAN EMERGENCY`,
      };
      alerts.push({
        id: 'avpu-alert',
        type: 'avpu_abnormal',
        severity: avpuSeverityMap[avpuResult.avpu] ?? 'high',
        title: avpuTitleMap[avpuResult.avpu] ?? `AVPU: ${avpuResult.avpu}`,
        gate: 'GATE_0_AVPU',
        reasoning: avpuResult.reason.join(' | '),
        recommendations:
          avpuResult.avpu === 'U'
            ? [
                'Aktifkan respons emergensi segera — panggil bantuan.',
                'Evaluasi ABC: airway, breathing, circulation.',
                'Posisikan pasien aman — recovery position jika napas ada.',
                'Siapkan AED dan pastikan akses IV.',
              ]
            : avpuResult.avpu === 'P'
              ? [
                  'Evaluasi tingkat kesadaran dengan GCS segera.',
                  'Nilai ABC dan pertahankan airway.',
                  'Monitor serial tanda vital setiap 5 menit.',
                  'Eskalasi segera ke dokter penanggung jawab.',
                ]
              : [
                  'Monitor ketat — nilai ulang AVPU setiap 15 menit.',
                  'Korelasikan dengan BP, SpO2, dan status mental.',
                  'Eskalasi jika AVPU memburuk ke P atau U.',
                ],
        clinicalData: { sbp, spo2, hr, rr },
      });
    }
  }

  // ── GATE_1B: Occult shock — via detectOccultShock() (MSF Guidelines) ────────
  if (!physiology.isPediatric && sbp > 0 && dbp > 0) {
    const hasDizziness = hasKeywordSignal(symptomText, [
      'pusing',
      'oyong',
      'mau pingsan',
      'berputar',
      'vertigo',
    ]);
    const hasWeakness = hasKeywordSignal(symptomText, [
      'lemas',
      'lemah',
      'tidak kuat',
      'lesu',
      'loyo',
    ]);
    const hasPresyncope = hasKeywordSignal(symptomText, [
      'hampir pingsan',
      'mau jatuh',
      'kunang',
      'gelap',
    ]);
    const hasSyncope = hasKeywordSignal(symptomText, ['pingsan', 'hilang kesadaran', 'jatuh tiba']);

    const shockInput: OccultShockInput = {
      vitals: {
        current_sbp: sbp,
        current_dbp: dbp,
        glucose: glucose > 0 ? glucose : undefined,
      },
      last_3_visits:
        context?.bpHistory?.map((h) => ({
          visit_date: h.visit_date ?? '',
          sbp: h.sbp,
          dbp: h.dbp,
          location: h.location,
        })) ?? [],
      symptoms: {
        dizziness: hasDizziness,
        presyncope: hasPresyncope,
        syncope: hasSyncope,
        weakness: hasWeakness,
      },
      known_htn: Boolean(context?.knownHTN),
    };

    const shockResult = detectOccultShock(shockInput);

    const hasRelativeHypotensionTrigger = shockResult.triggers.some((trigger) =>
      trigger.includes('Relative hypotension')
    );
    const shouldTriggerOccultShockAlert =
      shockResult.risk_level === 'CRITICAL' ||
      shockResult.risk_level === 'HIGH' ||
      (shockResult.risk_level === 'MODERATE' && hasRelativeHypotensionTrigger);

    if (shouldTriggerOccultShockAlert && !hasHypotension) {
      alerts.push({
        id: 'occult-shock-alert',
        type: 'occult_shock',
        severity: shockResult.risk_level === 'CRITICAL' ? 'critical' : 'high',
        title:
          shockResult.risk_level === 'CRITICAL'
            ? `Shock terdeteksi — MAP ${shockResult.map} mmHg${shockResult.delta_sbp ? `, ΔSBP ${shockResult.delta_sbp}` : ''}`
            : `Curiga occult shock — ΔSBP ${shockResult.delta_sbp ?? '?'} mmHg dari baseline`,
        gate: 'GATE_1_HEMODYNAMIC',
        reasoning: [
          ...shockResult.triggers,
          shockResult.baseline_bp
            ? `Baseline pasien: ${shockResult.baseline_bp.sbp}/${shockResult.baseline_bp.dbp} mmHg (median 3 kunjungan).`
            : '',
        ]
          .filter(Boolean)
          .join(' | '),
        recommendations: shockResult.recommendations.filter((r) => r.trim() !== ''),
        clinicalData: { sbp, dbp, map },
      });
    }
  }

  // ── GATE 2: HTN — via htn-classifier.ts (FKTP 2024) ───────────────────────
  if (sbp > 0 && dbp > 0) {
    if (physiology.isPediatric) {
      // Pediatric: tetap pakai physiology thresholds (tabel usia/gender)
      if (sbp >= physiology.severeHypertensionSbp || dbp >= physiology.severeHypertensionDbp) {
        alerts.push({
          id: 'hypertensive-alert',
          type: 'hypertensive_crisis',
          severity: 'critical',
          title: `Tekanan darah sangat tinggi untuk ${physiology.label}`,
          gate: 'GATE_2_BP',
          reasoning: `Tekanan darah ${sbp}/${dbp} mmHg sangat tinggi untuk ${ageContext}. ${physiology.bpScreeningDisclaimer ?? ''}`,
          recommendations: [
            'Nilai gejala target organ seperti nyeri dada, sesak, atau gangguan neurologis.',
            'Ulangi pengukuran setelah pasien istirahat dan posisi benar.',
            'Prioritaskan review dokter di kunjungan ini.',
          ],
          clinicalData: { sbp, dbp, map },
        });
      }
    } else {
      // Adult/geriatric: pakai htn-classifier.ts penuh
      const htnSeverity = getHTNSeverity({ sbp, dbp });

      if (htnSeverity === 'stage2' || htnSeverity === 'crisis') {
        const bpSession: BPMeasurementSession = {
          readings: [{ sbp, dbp }],
          final_bp: { sbp, dbp },
          measurement_quality: 'acceptable',
        };

        const knownHTN = Boolean(context?.knownHTN);
        const htnResult = classifyHypertension(
          bpSession,
          // Red flags tidak tersedia dari input manual — default ke undefined
          // sehingga classifier default ke HTN_URGENCY (bukan EMERGENCY) tanpa red flags
          undefined,
          { on_medication: knownHTN }
        );

        const severityMap: Record<string, ScreeningAlert['severity']> = {
          stage1: 'warning',
          stage2: 'high',
          crisis: 'critical',
        };

        const titleMap: Record<string, string> = {
          stage1: `Hipertensi Grade 1 (${sbp}/${dbp} mmHg)`,
          stage2: `Hipertensi Grade 2 — eskalasi diperlukan (${sbp}/${dbp} mmHg)`,
          crisis:
            htnResult.type === 'HTN_EMERGENCY'
              ? `EMERGENSI HIPERTENSI — rujuk IGD segera (${sbp}/${dbp} mmHg)`
              : `Urgensi Hipertensi — tata laksana segera (${sbp}/${dbp} mmHg)`,
        };

        alerts.push({
          id: 'hypertensive-alert',
          type: 'hypertensive_crisis',
          severity: severityMap[htnSeverity] ?? 'high',
          title: titleMap[htnSeverity] ?? `Hipertensi terdeteksi (${sbp}/${dbp} mmHg)`,
          gate: 'GATE_2_BP',
          reasoning: htnResult.reasoning,
          recommendations: htnResult.recommendations,
          clinicalData: { sbp, dbp, map },
        });
      }
    }
  }

  // ── GATE 3: GLUCOSE — via glucose-classifier.ts (PERKENI 2024 / ADA 2026) ─
  if (glucose > 0) {
    const glucoseResult = classifyBloodGlucose({
      gds: glucose,
      sample_type: 'capillary',
      has_classic_symptoms: false, // Tidak ada input gejala klasik dari form TTV
    });

    if (glucoseResult.category === 'HYPOGLYCEMIA_CRISIS') {
      alerts.push({
        id: 'hypoglycemia-alert',
        type: 'hypoglycemia',
        severity: 'high',
        title: `Hipoglikemia — tangani segera (GDS ${glucose} mg/dL)`,
        gate: 'GATE_3_GLUCOSE',
        reasoning: glucoseResult.reasoning,
        recommendations: glucoseResult.recommendations,
        clinicalData: { glucose },
      });
    } else if (glucoseResult.category === 'HYPERGLYCEMIA_CRISIS') {
      alerts.push({
        id: 'hyperglycemia-crisis-alert',
        type: 'hyperglycemia',
        severity: 'critical',
        title: `Krisis hiperglikemia — curiga DKA/HHS (GDS ${glucose} mg/dL)`,
        gate: 'GATE_3_GLUCOSE',
        reasoning: glucoseResult.reasoning,
        recommendations: glucoseResult.recommendations,
        clinicalData: { glucose },
      });
    } else if (glucose >= 300 || glucoseResult.category === 'DIABETES_CONFIRMED') {
      alerts.push({
        id: 'diabetes-alert',
        type: 'hyperglycemia',
        severity: 'high',
        title: `Hiperglikemia berat — evaluasi DM (GDS ${glucose} mg/dL)`,
        gate: 'GATE_3_GLUCOSE',
        reasoning: glucoseResult.reasoning,
        recommendations: glucoseResult.recommendations,
        clinicalData: { glucose },
      });
    } else if (glucoseResult.category === 'PREDIABETES') {
      alerts.push({
        id: 'prediabetes-alert',
        type: 'hyperglycemia',
        severity: 'warning',
        title: `Prediabetes terdeteksi (GDS ${glucose} mg/dL)`,
        gate: 'GATE_3_GLUCOSE',
        reasoning: glucoseResult.reasoning,
        recommendations: glucoseResult.recommendations,
        clinicalData: { glucose },
      });
    }
  }

  if (spo2 > 0 && spo2 < 90) {
    alerts.push({
      id: 'hypoxia-alert',
      type: 'hypoxia',
      severity: 'critical',
      title: 'Hipoksia signifikan',
      gate: 'GATE_4_RESPIRATORY',
      reasoning: `SpO2 ${spo2}% mengindikasikan kebutuhan intervensi respirasi segera.`,
      recommendations: [
        'Pastikan alat ukur valid dan cek ulang dengan probe yang baik.',
        'Pertimbangkan suplementasi oksigen sesuai protokol.',
        'Amati kerja napas dan tanda kelelahan respirasi.',
      ],
      clinicalData: { spo2, rr },
    });
  } else if (spo2 > 0 && spo2 <= 93) {
    alerts.push({
      id: 'borderline-hypoxia-alert',
      type: 'borderline_hypoxia',
      severity: 'high',
      title: 'Saturasi borderline',
      gate: 'GATE_4_RESPIRATORY',
      reasoning: `SpO2 ${spo2}% perlu pemantauan dekat dan korelasi dengan gejala respirasi.`,
      recommendations: [
        'Nilai ulang SpO2 setelah reposisi atau latihan napas.',
        'Pantau RR dan keluhan sesak.',
      ],
      clinicalData: { spo2, rr },
    });
  }

  if (hr >= physiology.tachycardiaThreshold) {
    alerts.push({
      id: 'tachycardia-alert',
      type: 'tachycardia',
      severity: 'high',
      title: physiology.isPediatric
        ? `Takikardia untuk ${physiology.label}`
        : 'Takikardia bermakna',
      gate: 'GATE_5_CIRCULATION',
      reasoning: physiology.isPediatric
        ? `Nadi ${hr} x/menit berada di atas ambang takikardia untuk ${ageContext} (>= ${physiology.tachycardiaThreshold} x/menit).`
        : `Nadi ${hr} x/menit dapat mencerminkan nyeri, infeksi, dehidrasi, atau syok dini.`,
      recommendations: [
        'Korelasikan dengan suhu, tekanan darah, dan status hidrasi.',
        'Evaluasi kemungkinan infeksi, perdarahan, atau nyeri tidak terkontrol.',
      ],
      clinicalData: { hr },
    });
  }

  if (hr > 0 && hr <= physiology.bradycardiaThreshold) {
    alerts.push({
      id: 'bradycardia-alert',
      type: 'bradycardia',
      severity: physiology.isPediatric ? 'high' : 'warning',
      title: physiology.isPediatric
        ? `Bradikardia untuk ${physiology.label}`
        : 'Bradikardia terdeteksi',
      gate: 'GATE_5B_CIRCULATION_LOW',
      reasoning: physiology.isPediatric
        ? `Nadi ${hr} x/menit berada di bawah ambang bawah untuk ${ageContext} (<= ${physiology.bradycardiaThreshold} x/menit). Korelasikan dengan perfusi, hipoksia, dan tingkat kesadaran.`
        : `Nadi ${hr} x/menit berada di bawah ambang yang diharapkan dan perlu korelasi dengan kondisi klinis pasien.`,
      recommendations: [
        'Nilai perfusi perifer, kesadaran, dan korelasikan dengan SpO2.',
        'Ulangi pengukuran nadi secara manual bila perlu.',
        'Segera eskalasi bila disertai perfusi buruk atau penurunan kesadaran.',
      ],
      clinicalData: { hr, spo2 },
    });
  }

  if (rr >= physiology.tachypneaThreshold) {
    alerts.push({
      id: 'tachypnea-alert',
      type: 'tachypnea',
      severity: 'high',
      title: physiology.isPediatric
        ? `Takipnea untuk ${physiology.label}`
        : 'Frekuensi napas meningkat',
      gate: 'GATE_6_RESP_RATE',
      reasoning: physiology.isPediatric
        ? `RR ${rr} x/menit berada di atas ambang takipnea untuk ${ageContext} (>= ${physiology.tachypneaThreshold} x/menit).`
        : `RR ${rr} x/menit membutuhkan evaluasi beban respirasi dan perfusi.`,
      recommendations: [
        'Nilai retraksi, penggunaan otot bantu, dan pola napas.',
        'Pertimbangkan triase lebih tinggi bila ada sesak atau SpO2 menurun.',
      ],
      clinicalData: { rr, spo2 },
    });
  }

  if (rr > 0 && rr <= physiology.bradypneaThreshold) {
    alerts.push({
      id: 'bradypnea-alert',
      type: 'bradypnea',
      severity: physiology.isPediatric ? 'high' : 'warning',
      title: physiology.isPediatric
        ? `Bradipnea untuk ${physiology.label}`
        : 'Frekuensi napas rendah',
      gate: 'GATE_6B_RESP_RATE_LOW',
      reasoning: physiology.isPediatric
        ? `RR ${rr} x/menit berada di bawah ambang bawah untuk ${ageContext} (<= ${physiology.bradypneaThreshold} x/menit).`
        : `RR ${rr} x/menit lebih rendah dari rentang yang diharapkan dan perlu evaluasi klinis.`,
      recommendations: [
        'Pastikan pasien tidak sedang tidur nyenyak atau menahan napas saat dihitung.',
        'Nilai kesadaran, kerja napas, dan ulangi pengukuran respirasi.',
        'Pertimbangkan eskalasi cepat bila disertai hipoksia atau perfusi buruk.',
      ],
      clinicalData: { rr, spo2 },
    });
  }

  if (hasOrthostaticCue) {
    alerts.push({
      id: 'orthostatic-check-alert',
      type: 'orthostatic_check',
      severity: sbp > 0 && sbp < 100 ? 'high' : 'warning',
      title: 'Perlu skrining hipotensi ortostatik',
      gate: 'GATE_1B_GERIATRIC_ORTHOSTATIC',
      reasoning:
        physiology.geriatricOrthostaticNote ||
        `Keluhan pada ${ageContext} mengarah ke risiko hipotensi ortostatik dan perlu verifikasi posisi.`,
      recommendations: [
        'Ukur tekanan darah serta nadi saat duduk atau berbaring, lalu ulang 1-3 menit setelah berdiri.',
        'Tinjau hidrasi, obat antihipertensi atau diuretik, dan risiko jatuh pasien.',
        'Segera eskalasi bila ada sinkop, jatuh berulang, atau perfusi tetap buruk.',
      ],
      clinicalData: { sbp, dbp, hr, map },
    });
  }

  if (physiology.isOlderAdult) {
    if (temp >= 39) {
      alerts.push({
        id: 'fever-alert',
        type: 'hyperthermia',
        severity: 'warning',
        title: 'Demam tinggi pada usia tua',
        gate: 'GATE_7_TEMPERATURE',
        reasoning: `Suhu ${temp.toFixed(1)} C pada ${ageContext} mendukung proses infeksi atau inflamasi aktif. ${physiology.geriatricTemperatureNote}`,
        recommendations: [
          'Cari fokus infeksi dan pantau tanda sepsis atau penurunan kesadaran.',
          'Pastikan hidrasi adekuat, observasi respons antipiretik, dan verifikasi suhu ulang.',
        ],
        clinicalData: { temp },
      });
    } else if (temp >= (physiology.geriatricSingleFeverThreshold || 37.8)) {
      alerts.push({
        id: 'geriatric-fever-alert',
        type: 'geriatric_fever',
        severity: hasAtypicalInfectionCue ? 'high' : 'warning',
        title: 'Demam pada usia tua perlu evaluasi dini',
        gate: 'GATE_7_TEMPERATURE',
        reasoning: `Suhu ${temp.toFixed(1)} C sudah memenuhi ambang demam skrining untuk ${ageContext}. ${physiology.geriatricTemperatureNote}`,
        recommendations: [
          'Ulangi suhu dan korelasikan dengan fokus infeksi, hidrasi, serta perubahan status fungsional.',
          'Pantau delirium, intake, atau penurunan aktivitas sebagai presentasi infeksi atipikal.',
          'Prioritaskan review dokter bila disertai hemodinamik labil atau hipoksia.',
        ],
        clinicalData: { temp, spo2, rr },
      });
    } else if (temp >= (physiology.geriatricRepeatFeverThreshold || 37.2)) {
      alerts.push({
        id: 'geriatric-low-grade-fever-alert',
        type: 'geriatric_low_grade_fever',
        severity: hasAtypicalInfectionCue ? 'high' : 'warning',
        title: 'Kenaikan suhu ringan pada usia tua',
        gate: 'GATE_7_TEMPERATURE',
        reasoning: `Suhu ${temp.toFixed(1)} C pada ${ageContext} sudah layak dicurigai sebagai demam dini, terutama bila berulang atau meningkat dari baseline.`,
        recommendations: [
          'Ulangi suhu dalam kunjungan ini dan bandingkan dengan baseline bila tersedia.',
          'Cari fokus infeksi, intake menurun, bingung mendadak, atau penurunan fungsi.',
        ],
        clinicalData: { temp },
      });
    } else if (hasAtypicalInfectionCue) {
      alerts.push({
        id: 'geriatric-afebrile-infection-alert',
        type: 'geriatric_afebrile_infection_risk',
        severity: 'warning',
        title: 'Infeksi pada usia tua bisa afebril',
        gate: 'GATE_7B_GERIATRIC_AFEBRILE',
        reasoning: `Keluhan ${ageContext} mengarah ke presentasi infeksi atipikal. ${physiology.geriatricTemperatureNote}`,
        recommendations: [
          'Jangan menunggu demam tinggi untuk menilai fokus infeksi atau dehidrasi.',
          'Pantau perubahan mental, intake, aktivitas, dan ulangi suhu bila keluhan berlanjut.',
        ],
        clinicalData: { temp, spo2, rr },
      });
    }
  } else if (temp >= 39) {
    alerts.push({
      id: 'fever-alert',
      type: 'hyperthermia',
      severity: 'warning',
      title: 'Demam tinggi',
      gate: 'GATE_7_TEMPERATURE',
      reasoning: `Suhu ${temp.toFixed(1)} C mendukung proses infeksi atau inflamasi aktif.`,
      recommendations: [
        'Cari fokus infeksi dan pantau tanda sepsis.',
        'Pastikan hidrasi adekuat dan observasi respons antipiretik.',
      ],
      clinicalData: { temp },
    });
  }

  // ── PATTERN ENGINE v2: Evaluate 70 clinical patterns ──────────────────────
  const snapshot = buildClinicalSnapshot(state, patient, context);
  const existingAlertIds = alerts.map((a) => a.id);
  const patternMatches = evaluatePatterns(snapshot, CLINICAL_PATTERNS, existingAlertIds, {
    tierFilter: ['A', 'B'],
  });
  alerts.push(...patternMatchesToAlerts(patternMatches));

  return alerts;
};

const buildSummary = (
  state: TTVStateShape,
  alerts: ScreeningAlert[],
  flags: Record<string, boolean>,
  patient: Pick<TTVInferenceUIProps, 'patientName' | 'patientGender' | 'patientAge' | 'patientRM'>
): string => {
  const physiology = getVitalScreeningProfile(patient.patientAge || 0);
  const activeFlags = historyItems
    .filter((item) => flags[item.id])
    .map((item) => item.label)
    .join(', ');

  const lines = [
    '[AUTOSEN ANALYSIS]',
    `Pasien: ${patient.patientName || 'Belum terhubung'} | RM ${patient.patientRM || '-'}`,
    `Profil: ${patient.patientGender || '-'} | ${patient.patientAge || 0} tahun | Preset ${presetLabels[state.autosenPreset]}`,
    `Mode screening fisiologis: ${physiology.label}`,
    ...(physiology.isOlderAdult
      ? [
          'Catatan geriatri: suhu bisa tampak lebih rendah; cek ortostatik bila ada pusing, jatuh, atau sinkop.',
        ]
      : []),
    '',
    `Keluhan utama: ${state.symptomText || 'Belum diisi'}`,
    `Alergi: ${state.allergies.length > 0 ? state.allergies.join(', ') : 'Tidak dilaporkan'}`,
    `Disabilitas: ${state.disabilityType || 'Tidak dipilih'}`,
    `Obesitas: ${
      state.obesityConfirmation === 'confirmed'
        ? 'Terkonfirmasi'
        : state.obesityConfirmation === 'not_confirmed'
          ? 'Tidak Terkonfirmasi'
          : 'Tidak dipilih'
    }`,
    `Risk markers: ${activeFlags || 'Tidak dipilih'}`,
    '',
    `TD ${state.sbp || '-'}/${state.dbp || '-'} mmHg | Nadi ${state.hr || '-'} | RR ${state.rr || '-'} | Suhu ${state.temp || '-'} C`,
    `SpO2 ${state.spo2 || '-'}% | Gula darah ${state.glucose || '-'} mg/dL`,
    '',
    alerts.length > 0
      ? `Prioritas: ${alerts[0].severity.toUpperCase()} - ${alerts[0].title}`
      : 'Prioritas: STABLE - belum ada alert prioritas tinggi',
    alerts.length > 0
      ? `Tindakan awal: ${alerts[0].recommendations[0]}`
      : 'Tindakan awal: lanjutkan observasi dan lengkapi data klinis bila perlu',
  ];

  return lines.join('\n');
};

const buildSenautoOutput = (draft: ComposedAnamnesaDraft, summary: string): string => {
  const verificationNote =
    draft.metadata.missingFacts.length > 0
      ? `Catatan verifikasi: ${draft.metadata.missingFacts.join('; ')}.`
      : 'Catatan verifikasi: data inti anamnesis awal sudah terbaca, tetap perlu review klinisi.';

  const lines = [
    '[AUTOSEN ANAMNESA DRAFT]',
    `Keluhan utama: ${draft.payload.keluhan_utama}`,
    '',
    'Anamnesa sekarang:',
    draft.payload.keluhan_tambahan,
    '',
    verificationNote,
    '',
    summary,
  ];

  return lines.join('\n');
};

/**
 * buildCanonicalVitalOutput
 *
 * @remarks
 * TODO: Add detailed description, parameters, and examples
 * Auto-generated on 2026-04-15
 */

export const buildCanonicalVitalOutput = (
  canonical: CanonicalClinicalEngineOutput,
  fallback: string,
  context: {
    patientName: string;
    patientAge: number;
    patientRM: string;
    vitalsLine: string;
  }
): string => {
  const lines: string[] = [
    '[CANONICAL AUTO COMPLETE+ VITAL SIGN]',
    `Pasien: ${context.patientName} | RM ${context.patientRM}`,
    `Usia: ${context.patientAge} tahun`,
    context.vitalsLine,
  ];

  if (canonical.scoring.news2) {
    lines.push(
      `NEWS2: ${canonical.scoring.news2.score} • ${canonical.scoring.news2.risk_level.toUpperCase()}`
    );
  }

  if (canonical.trajectory?.overall_trend || canonical.trajectory?.overall_risk) {
    const trend = canonical.trajectory?.overall_trend
      ? canonical.trajectory.overall_trend.toUpperCase()
      : 'TIDAK TERSEDIA';
    const risk = canonical.trajectory?.overall_risk
      ? canonical.trajectory.overall_risk.toUpperCase()
      : 'TIDAK TERSEDIA';
    lines.push(`Trajectory: ${trend} • ${risk}`);
  }

  const immediateActions = canonical.recommendations.immediate_actions || [];
  if (immediateActions.length > 0) {
    lines.push(`Immediate Actions: ${immediateActions.slice(0, 3).join(', ')}`);
  }

  if (canonical.alerts.length > 0) {
    lines.push('Alerts:');
    canonical.alerts.slice(0, 3).forEach((alert) => {
      lines.push(`- ${alert.severity.toUpperCase()} • ${alert.title} • ${alert.message}`);
    });
  }

  if (canonical.governance?.disclaimer) {
    lines.push(`Disclaimer: ${canonical.governance.disclaimer}`);
  }

  lines.push('', 'Fallback lokal:', fallback);
  return lines.join('\n');
};

const buildVitalAutocompleteOutput = ({
  state,
  alerts,
  patient,
  autofillReasoning,
}: {
  state: TTVStateShape;
  alerts: ScreeningAlert[];
  patient: Pick<TTVInferenceUIProps, 'patientName' | 'patientGender' | 'patientAge' | 'patientRM'>;
  autofillReasoning?: string[];
}): string => {
  const physiology = getVitalScreeningProfile(patient.patientAge || 0);
  const lines = [
    '[AUTOCOMPLETE+ VITAL SIGN]',
    `Pasien: ${patient.patientName || 'Belum terhubung'} | RM ${patient.patientRM || '-'}`,
    `Mode screening fisiologis: ${physiology.label}`,
    ...(physiology.isOlderAdult
      ? [
          'Catatan geriatri: demam bisa lebih rendah dari dewasa umum dan infeksi dapat muncul tanpa demam tinggi.',
        ]
      : []),
    `TTV: TD ${state.sbp || '-'}/${state.dbp || '-'} mmHg | Nadi ${state.hr || '-'} | RR ${state.rr || '-'} | Suhu ${state.temp || '-'} C | SpO2 ${state.spo2 || '-'}% | Gula darah ${state.glucose || '-'} mg/dL`,
    '',
    alerts.length > 0
      ? 'Ringkasan screening:'
      : 'Ringkasan screening: belum ada alert prioritas tinggi.',
    ...(alerts.length > 0
      ? alerts
          .slice(0, 3)
          .map((alert) => `- ${alert.severity.toUpperCase()} • ${alert.title} • ${alert.reasoning}`)
      : []),
    ...(autofillReasoning?.length
      ? ['', 'Autofill reasoning:', ...autofillReasoning.map((line) => `- ${line}`)]
      : []),
    '',
    alerts.length > 0
      ? `Tindakan awal: ${alerts[0].recommendations.join(' ')}`
      : 'Tindakan awal: lanjutkan observasi, verifikasi ulang pengukuran, dan korelasikan dengan kondisi klinis pasien.',
  ];

  return lines.join('\n');
};

function deriveScreeningResultForAudit(out: CanonicalClinicalEngineOutput | null | undefined): {
  status: 'positive' | 'negative' | 'inconclusive';
  score: number;
  risk_level: 'low' | 'medium' | 'high' | 'critical';
  summary: string;
} {
  if (!out?.scoring?.news2) {
    return {
      status: 'inconclusive',
      score: 0,
      risk_level: 'low',
      summary: 'NEWS2 tidak tersedia',
    };
  }

  const news2 = out.scoring.news2;
  const traj = out.trajectory;
  let risk_level: 'low' | 'medium' | 'high' | 'critical' = 'medium';
  if (news2.risk_level === 'low') risk_level = 'low';
  else if (news2.risk_level === 'high') risk_level = 'high';
  else risk_level = 'medium';

  let status: 'positive' | 'negative' | 'inconclusive' = 'inconclusive';
  const highTrajectory =
    traj?.overall_risk === 'critical' ||
    traj?.overall_risk === 'high' ||
    traj?.deterioration_state === 'critical';
  if (news2.risk_level === 'high' || highTrajectory) {
    status = 'positive';
  } else if (news2.risk_level === 'low' && (!traj?.overall_risk || traj.overall_risk === 'low')) {
    status = 'negative';
  }

  const summary =
    (traj?.narrative && traj.narrative.slice(0, 240)) ||
    `NEWS2 ${news2.score} (${news2.risk_level})`;

  return { status, score: news2.score, risk_level, summary };
}

async function patientPseudonymToken(rm: string): Promise<string> {
  const enc = new TextEncoder();
  const buf = await crypto.subtle.digest(
    'SHA-256',
    enc.encode(`sentra-assist-pid|${rm || 'unknown'}`)
  );
  const hex = Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return `pid-${hex.slice(0, 24)}`;
}

/**
 * TTVInferenceUI
 *
 * @remarks
 * TODO: Add detailed description, parameters, and examples
 * Auto-generated on 2026-04-15
 */

export function TTVInferenceUI({
  patientName = 'Pasien belum terhubung',
  patientGender = 'L',
  patientAge = 0,
  patientRM = '-',
  patientDOB = '',
  patientBloodType = '',
  patientBPJSStatus = null,
  patientKelurahan = '',
  onComplete,
  onAlertsChange,
  ttvState,
  onTTVStateChange,
  onNavigateToTrajectory,
  onChronicHistoryChange,
  prefilledHistoryFlags,
  extractedSpecialConditions = [],
  extractedPregnancyRisk = '',
  extractedFacilityName = '',
  extractedPayerLabel = '',
  extractedAllergies = [],
  extractedPregnancyStatus = null,
  canonicalOutput: canonicalOutputProp = null,
  prefetchedVisits,
  onSentraUplink,
  onAccessEmergency,
}: TTVInferenceUIProps): JSX.Element {
  const [localState, setLocalState] = useState<TTVStateShape>(DEFAULT_STATE);
  const [historyFlags, setHistoryFlags] =
    useState<Record<string, boolean>>(createEmptyHistoryFlags);
  const [output, setOutput] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isAnalyzingVitals, setIsAnalyzingVitals] = useState(false);
  const [animatedDraftText, setAnimatedDraftText] = useState('');
  const [isDraftTyping, setIsDraftTyping] = useState(false);
  const [lastProcessedSymptomText, setLastProcessedSymptomText] = useState('');
  const [localCanonicalOutput, setLocalCanonicalOutput] =
    useState<CanonicalClinicalEngineOutput | null>(canonicalOutputProp ?? null);
  const [canonicalError, setCanonicalError] = useState('');
  const [isCanonicalLoading, setIsCanonicalLoading] = useState(false);
  const [isGhostFillAnimating, setIsGhostFillAnimating] = useState(false);
  const [ghostActiveLane, setGhostActiveLane] = useState<VitalGhostLane | null>(null);
  const [ghostCompletedLanes, setGhostCompletedLanes] = useState<VitalGhostLane[]>([]);
  const [ghostVisibleValues, setGhostVisibleValues] = useState<
    Partial<Record<VitalFieldKey, string>>
  >({});
  const [outputMode, setOutputMode] = useState<'anamnesis' | 'vital' | null>(null);

  const [isAllergyOpen, setIsAllergyOpen] = useState(false);
  const [isDisabilityOpen, setIsDisabilityOpen] = useState(false);
  const [isObesityOpen, setIsObesityOpen] = useState(false);
  const [isPresetOpen, setIsPresetOpen] = useState(false);
  const [anamnesisMissingFields, setAnamnesisMissingFields] = useState<AnamnesisMissingField[]>([]);
  const [shadowSuggestion, setShadowSuggestion] = useState('');
  const [onlineDoctors, setOnlineDoctors] = useState<OnlineDoctor[]>([]);
  const [selectedDoctorId, setSelectedDoctorId] = useState('');
  const [isLoadingDoctors, setIsLoadingDoctors] = useState(false);
  const [isSendingConsult, setIsSendingConsult] = useState(false);
  const [doctorPickerError, setDoctorPickerError] = useState('');
  const [doctorPickerNotice, setDoctorPickerNotice] = useState('');
  const [isConsultFooterOpen, setIsConsultFooterOpen] = useState(false);
  const [uplinkState, setUplinkState] = useState<'idle' | 'processing' | 'completed'>('idle');
  const [uplinkDisplayText, setUplinkDisplayText] = useState('Sentra Uplink →');
  const [bridgeSyncStatus, setBridgeSyncStatus] = useState<'idle' | 'ok' | 'fail'>('idle');
  const [bridgeSyncError, setBridgeSyncError] = useState('');
  const [uplinkError, setUplinkError] = useState<string | null>(null);
  const scrambleIntervalRef = useRef<number | null>(null);
  const [avpuSuggestion, setAvpuSuggestion] = useState<AvpuResult | null>(null);
  const [avpuLocked, setAvpuLocked] = useState(false);
  // Ref mirrors avpuLocked for use inside setTimeout callbacks (avoid stale closure)
  const avpuLockedRef = useRef(false);
  // Per-field source tracking for autocomplete override protection
  const [fieldMeta, setFieldMeta] = useState<Partial<Record<VitalFieldKey, FieldMeta>>>({});
  const fieldMetaRef = useRef<Partial<Record<VitalFieldKey, FieldMeta>>>({});

  // Keep refs in sync with state (prevents stale closure bugs in setTimeout/setInterval)
  useEffect(() => {
    avpuLockedRef.current = avpuLocked;
  }, [avpuLocked]);
  useEffect(() => {
    fieldMetaRef.current = fieldMeta;
  }, [fieldMeta]);

  // Reset uplink + AVPU + field meta when patient changes
  useEffect(() => {
    if (scrambleIntervalRef.current !== null) {
      clearInterval(scrambleIntervalRef.current);
      scrambleIntervalRef.current = null;
    }
    setUplinkState('idle');
    setUplinkDisplayText('Sentra Uplink →');
    setUplinkError(null);
    setAvpuSuggestion(null);
    setAvpuLocked(false);
    setFieldMeta({});
  }, [patientRM]);

  const startTextScramble = useCallback((setFn: (t: string) => void): number => {
    const target = 'MENGISI RME...';
    let frame = 0;
    const id = window.setInterval(() => {
      const scrambled = target
        .split('')
        .map((ch, i) => {
          if (ch === ' ') return ' ';
          if (frame > i * 1.5) return target[i];
          return SCRAMBLE_CHARS[Math.floor(Math.random() * SCRAMBLE_CHARS.length)];
        })
        .join('');
      setFn(scrambled);
      frame++;
      if (frame > target.length * 2) frame = 0;
    }, 55);
    return id;
  }, []);

  const handleSentraUplink = useCallback(async () => {
    if (!onSentraUplink || uplinkState !== 'idle') return;
    setUplinkState('processing');
    setUplinkError(null);
    const scId = startTextScramble(setUplinkDisplayText);
    scrambleIntervalRef.current = scId;
    try {
      await onSentraUplink();
      clearInterval(scId);
      scrambleIntervalRef.current = null;
      setUplinkDisplayText('Completed');
      setUplinkState('completed');
      playSound('notif1.wav');
    } catch (err) {
      clearInterval(scId);
      scrambleIntervalRef.current = null;
      setUplinkDisplayText('Sentra Uplink →');
      setUplinkState('idle');
      setUplinkError(err instanceof Error ? err.message : 'Uplink gagal');
    }
  }, [onSentraUplink, uplinkState, startTextScramble]);
  const allergyDropdownRef = useRef<HTMLDivElement | null>(null);
  const disabilityDropdownRef = useRef<HTMLDivElement | null>(null);
  const obesityDropdownRef = useRef<HTMLDivElement | null>(null);
  const presetDropdownRef = useRef<HTMLDivElement | null>(null);
  const ghostAnimationTimeoutsRef = useRef<number[]>([]);

  const state = ttvState ?? localState;
  const stateRef = useRef(state);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    return () => {
      ghostAnimationTimeoutsRef.current.forEach((timeoutId) => window.clearTimeout(timeoutId));
      ghostAnimationTimeoutsRef.current = [];
      // Also clear scramble interval to prevent state updates on unmounted component
      if (scrambleIntervalRef.current !== null) {
        clearInterval(scrambleIntervalRef.current);
        scrambleIntervalRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    setLocalCanonicalOutput(canonicalOutputProp ?? null);
  }, [canonicalOutputProp]);

  const canonicalOutput = localCanonicalOutput ?? canonicalOutputProp;

  const clearGhostAnimationTimers = () => {
    ghostAnimationTimeoutsRef.current.forEach((timeoutId) => window.clearTimeout(timeoutId));
    ghostAnimationTimeoutsRef.current = [];
  };

  const displayedVitalValue = (field: VitalFieldKey): string => {
    if (isGhostFillAnimating) {
      return ghostVisibleValues[field] ?? '';
    }

    return state[field];
  };

  const getVitalGhostItemClassName = (lane: VitalGhostLane): string =>
    [
      'vital-item',
      isGhostFillAnimating ? 'vital-item--ghosting' : '',
      ghostCompletedLanes.includes(lane) ? 'vital-item--ghost-complete' : '',
      ghostActiveLane === lane ? 'vital-item--ghost-active' : '',
    ]
      .filter(Boolean)
      .join(' ');

  const runGhostFillAnimation = (targetState: TTVStateShape): Promise<void> => {
    clearGhostAnimationTimers();

    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const orderedLanes = shuffleGhostLanes(VITAL_GHOST_LANES);
    const startupDelay = prefersReducedMotion ? 0 : 88;
    const laneDelay = prefersReducedMotion ? 42 : 136;
    const revealDelay = prefersReducedMotion ? 10 : 62;
    const laneHold = prefersReducedMotion ? 54 : 176;

    setIsGhostFillAnimating(true);
    setGhostActiveLane(null);
    setGhostCompletedLanes([]);
    setGhostVisibleValues({});

    return new Promise((resolve) => {
      orderedLanes.forEach((lane, index) => {
        const laneStartAt = startupDelay + index * laneDelay;

        const activateId = window.setTimeout(() => {
          setGhostActiveLane(lane);
        }, laneStartAt);

        const revealId = window.setTimeout(() => {
          setGhostCompletedLanes((previous) =>
            previous.includes(lane) ? previous : [...previous, lane]
          );
          setGhostVisibleValues((previous) => {
            const nextValues = { ...previous };
            VITAL_GHOST_LANE_FIELDS[lane].forEach((field) => {
              nextValues[field] = targetState[field];
            });
            return nextValues;
          });
        }, laneStartAt + revealDelay);

        const deactivateId = window.setTimeout(() => {
          setGhostActiveLane((current) => (current === lane ? null : current));
        }, laneStartAt + laneHold);

        ghostAnimationTimeoutsRef.current.push(activateId, revealId, deactivateId);
      });

      const resolveId = window.setTimeout(
        () => {
          resolve();
        },
        startupDelay + orderedLanes.length * laneDelay + laneHold
      );

      ghostAnimationTimeoutsRef.current.push(resolveId);
    });
  };

  const normalizedPrefilledHistoryFlags = useMemo(
    () =>
      historyItems.reduce(
        (accumulator, item) => {
          accumulator[item.id] = Boolean(prefilledHistoryFlags?.[item.id]);
          return accumulator;
        },
        {} as Record<string, boolean>
      ),
    [prefilledHistoryFlags]
  );

  const commitState = (updater: (prev: TTVStateShape) => TTVStateShape) => {
    const nextState = updater(stateRef.current);

    if (onTTVStateChange) {
      onTTVStateChange(nextState);
      return;
    }

    setLocalState(nextState);
  };

  const applySymptomText = (value: string) => {
    commitState((prev) => ({
      ...prev,
      symptomText: value,
    }));
  };

  const bpHistory = useMemo<HistoricalBP[]>(
    () =>
      (prefetchedVisits ?? [])
        .filter((v) => v.vitals.sbp > 0 && v.vitals.dbp > 0)
        .map((v) => ({ visit_date: v.timestamp, sbp: v.vitals.sbp, dbp: v.vitals.dbp })),
    [prefetchedVisits]
  );

  const effectiveHistoryFlags = useMemo(() => {
    const hasPrefilledSelection = historyItems.some(
      (item) => normalizedPrefilledHistoryFlags[item.id]
    );
    const hasLocalSelection = historyItems.some((item) => historyFlags[item.id]);

    if (!hasLocalSelection && hasPrefilledSelection) {
      return normalizedPrefilledHistoryFlags;
    }

    return historyFlags;
  }, [historyFlags, normalizedPrefilledHistoryFlags]);

  const alerts = useMemo(
    () =>
      buildAlerts(
        state,
        { patientAge },
        {
          bpHistory,
          knownHTN: Boolean(effectiveHistoryFlags['ht']),
        }
      ),
    [
      patientAge,
      state.dbp,
      state.glucose,
      state.hr,
      state.rr,
      state.sbp,
      state.spo2,
      state.temp,
      bpHistory,
      effectiveHistoryFlags,
    ]
  );

  useEffect(() => {
    onAlertsChange?.(alerts);
  }, [alerts, onAlertsChange]);

  const hasMinimalVitals = Boolean(state.sbp && state.dbp && state.hr && state.rr && state.temp);
  const physiologyProfile = useMemo(() => getVitalScreeningProfile(patientAge || 0), [patientAge]);
  const chronicHistoryLabels = getSelectedHistoryLabels(effectiveHistoryFlags);
  const chronicHistorySummary = chronicHistoryLabels.join(', ');
  const allergySummary = state.allergies.join(', ');
  const allergyPlaceholder = allergySummary || 'Pilih di sini';
  const isAllergyPlaceholder = allergyPlaceholder === 'Pilih di sini';
  const disabilityPlaceholder = state.disabilityType || 'Pilih di sini';
  const isDisabilityPlaceholder = disabilityPlaceholder === 'Pilih di sini';
  const obesityPlaceholder =
    state.obesityConfirmation === 'confirmed'
      ? 'Terkonfirmasi'
      : state.obesityConfirmation === 'not_confirmed'
        ? 'Tidak Terkonfirmasi'
        : 'Pilih di sini';
  const isObesityPlaceholder = obesityPlaceholder === 'Pilih di sini';
  const presetPlaceholder = state.autosenPreset
    ? presetLabels[state.autosenPreset]
    : 'Pilih di sini';
  const isPresetPlaceholder = !state.autosenPreset;
  const isFemalePatient = patientGender === 'P';
  const hasLoadedPatientContext =
    patientAge > 0 &&
    Boolean(patientRM && patientRM !== '-') &&
    patientName !== 'Pasien belum terhubung';
  const showPediatricScreeningMode = hasLoadedPatientContext && physiologyProfile.isPediatric;
  const canForwardToDoctor =
    hasMinimalVitals &&
    Boolean(selectedDoctorId) &&
    !isSendingConsult &&
    // If uplink is completed, bypass pregnancy status requirement — RME already filled
    (!isFemalePatient || state.pregnancyStatus !== null || uplinkState === 'completed');
  const hasSymptomDraftPending =
    Boolean(state.symptomText.trim()) && state.symptomText.trim() !== lastProcessedSymptomText;
  const anamnesaDraft = useMemo(
    () =>
      composeAnamnesaDraft({
        symptomText: state.symptomText,
        patientGender,
        chronicDiseases: chronicHistoryLabels,
        allergies: state.allergies,
        pregnancyStatus: state.pregnancyStatus,
        specialConditions: extractedSpecialConditions,
        pregnancyRisk: extractedPregnancyRisk,
        vitals: {
          sbp: parseNumber(state.sbp),
          dbp: parseNumber(state.dbp),
          hr: parseNumber(state.hr),
          rr: parseNumber(state.rr),
          temp: parseNumber(state.temp),
          spo2: parseNumber(state.spo2),
          glucose: parseNumber(state.glucose),
        },
        disabilityType: state.disabilityType,
        obesityConfirmation: state.obesityConfirmation,
        autosenPresetLabel: presetLabels[state.autosenPreset],
      }),
    [
      chronicHistoryLabels,
      extractedPregnancyRisk,
      extractedSpecialConditions,
      patientGender,
      state.allergies,
      state.autosenPreset,
      state.dbp,
      state.disabilityType,
      state.glucose,
      state.hr,
      state.obesityConfirmation,
      state.pregnancyStatus,
      state.rr,
      state.sbp,
      state.spo2,
      state.symptomText,
      state.temp,
    ]
  );

  useEffect(() => {
    setShadowSuggestion(buildAnamnesisShadowSuggestion(anamnesisMissingFields));
  }, [anamnesisMissingFields]);
  const preferredPoliKeywords = useMemo(
    () =>
      derivePreferredPoliKeywords(chronicHistoryLabels, state.autosenPreset, state.pregnancyStatus),
    [chronicHistoryLabels, state.autosenPreset, state.pregnancyStatus]
  );
  const consultSummaryRows = useMemo(
    () =>
      [
        {
          label: 'BPJS / Penjamin',
          value: formatPayerLabel(extractedPayerLabel, patientBPJSStatus),
        },
        {
          label: 'Penyakit Khusus',
          value:
            extractedSpecialConditions.length > 0
              ? extractedSpecialConditions.join(', ')
              : 'Tidak terdeteksi',
        },
        {
          label: 'Risiko Kehamilan',
          value: extractedPregnancyRisk.trim() || 'Tidak terdeteksi',
        },
        canonicalOutput?.scoring.news2
          ? {
              label: 'Canonical NEWS2',
              value: `${canonicalOutput.scoring.news2.score} • ${canonicalOutput.scoring.news2.risk_level.toUpperCase()}`,
            }
          : null,
        canonicalOutput?.trajectory
          ? {
              label: 'Canonical Trajectory',
              value: `${
                canonicalOutput.trajectory.overall_trend
                  ? humanize(canonicalOutput.trajectory.overall_trend).toUpperCase()
                  : 'TIDAK TERSEDIA'
              } • ${
                canonicalOutput.trajectory.overall_risk
                  ? humanize(canonicalOutput.trajectory.overall_risk).toUpperCase()
                  : 'TIDAK TERSEDIA'
              }`,
            }
          : null,
      ].filter(Boolean) as Array<{ label: string; value: string }>,
    [
      canonicalOutput,
      extractedPayerLabel,
      extractedPregnancyRisk,
      extractedSpecialConditions,
      patientBPJSStatus,
    ]
  );
  const selectedDoctor = useMemo(
    () => onlineDoctors.find((doctor) => doctor.id === selectedDoctorId) || null,
    [onlineDoctors, selectedDoctorId]
  );
  const consultFooterRows = useMemo(
    () =>
      [
        extractedAllergies.length > 0
          ? { label: 'Riwayat Alergi', value: extractedAllergies.join(', ') }
          : null,
        extractedSpecialConditions.length > 0
          ? { label: 'Penyakit Khusus', value: extractedSpecialConditions.join(', ') }
          : null,
        extractedPregnancyRisk.trim()
          ? { label: 'Risiko Kehamilan', value: extractedPregnancyRisk.trim() }
          : null,
      ].filter(Boolean) as Array<{ label: string; value: string }>,
    [extractedAllergies, extractedPregnancyRisk, extractedSpecialConditions]
  );
  const sortedDoctors = useMemo(
    () =>
      [...onlineDoctors].sort((left, right) => {
        const leftRank = AVAILABILITY_RANK[left.availability_status || 'offline'];
        const rightRank = AVAILABILITY_RANK[right.availability_status || 'offline'];
        if (leftRank !== rightRank) {
          return leftRank - rightRank;
        }

        const leftPoli = normalizeText(left.poli);
        const rightPoli = normalizeText(right.poli);
        const leftPoliScore = preferredPoliKeywords.some((keyword) => leftPoli.includes(keyword))
          ? 0
          : 1;
        const rightPoliScore = preferredPoliKeywords.some((keyword) => rightPoli.includes(keyword))
          ? 0
          : 1;
        if (leftPoliScore !== rightPoliScore) {
          return leftPoliScore - rightPoliScore;
        }

        const locationHint = normalizeText(extractedFacilityName);
        const leftLocationScore =
          locationHint && normalizeText(left.location_name).includes(locationHint) ? 0 : 1;
        const rightLocationScore =
          locationHint && normalizeText(right.location_name).includes(locationHint) ? 0 : 1;
        if (leftLocationScore !== rightLocationScore) {
          return leftLocationScore - rightLocationScore;
        }

        return left.name.localeCompare(right.name);
      }),
    [extractedFacilityName, onlineDoctors, preferredPoliKeywords]
  );

  useEffect(() => {
    onChronicHistoryChange?.(chronicHistorySummary || 'Menunggu Input');
  }, [chronicHistorySummary, onChronicHistoryChange]);

  useEffect(() => {
    setHistoryFlags(normalizedPrefilledHistoryFlags);
  }, [normalizedPrefilledHistoryFlags, patientRM]);

  useEffect(() => {
    if (patientRM === '-') {
      return;
    }

    commitState((prev) => ({
      ...prev,
      allergies: extractedAllergies,
      pregnancyStatus: extractedPregnancyStatus,
    }));
  }, [extractedAllergies, extractedPregnancyStatus, patientRM]);

  useEffect(() => {
    setLastProcessedSymptomText('');
    setAnimatedDraftText('');
    setIsDraftTyping(false);
    setAnamnesisMissingFields([]);
    setShadowSuggestion('');
  }, [patientRM]);

  const [hasAutoTriggeredSymptoms, setHasAutoTriggeredSymptoms] = useState(false);

  useEffect(() => {
    if (!HYBRID_AUTOTEXT_ENABLED) return;

    const raw = state.symptomText.trim();
    if (raw.length < 8 || isAnalyzing || isDraftTyping) return;

    // Auto-trigger full analysis when 3 or more symptoms are detected
    const symptoms = raw
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 2);
    if (symptoms.length >= 3 && !hasAutoTriggeredSymptoms) {
      setHasAutoTriggeredSymptoms(true);
      handleAnalyze();
      return;
    } else if (symptoms.length < 3) {
      setHasAutoTriggeredSymptoms(false);
    }

    const timerId = window.setTimeout(() => {
      void (async () => {
        const extractionStart = Date.now();
        try {
          const extraction = await extractClinicalAnamnesis(raw);
          setAnamnesisMissingFields(extraction.data_belum_lengkap);
          ttvLog.debug('Hybrid preview extraction updated', {
            source: 'backend',
            missingCount: extraction.data_belum_lengkap.length,
            latencyMs: Date.now() - extractionStart,
          });
        } catch (error) {
          ttvLog.debug('Preview extraction gagal', error);
        }
      })();
    }, 220);

    return () => window.clearTimeout(timerId);
  }, [state.symptomText, isAnalyzing, isDraftTyping]);

  useEffect(() => {
    if (!sortedDoctors.length) {
      setSelectedDoctorId('');
      return;
    }

    setSelectedDoctorId((current) =>
      sortedDoctors.some((doctor) => doctor.id === current) ? current : sortedDoctors[0].id
    );
  }, [sortedDoctors]);

  useEffect(() => {
    if (!isAllergyOpen) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) {
        return;
      }

      if (!allergyDropdownRef.current?.contains(target)) {
        setIsAllergyOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [isAllergyOpen]);

  useEffect(() => {
    if (!isDisabilityOpen) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) {
        return;
      }

      if (!disabilityDropdownRef.current?.contains(target)) {
        setIsDisabilityOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [isDisabilityOpen]);

  useEffect(() => {
    if (!isObesityOpen) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) {
        return;
      }

      if (!obesityDropdownRef.current?.contains(target)) {
        setIsObesityOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [isObesityOpen]);

  useEffect(() => {
    if (!isPresetOpen) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) {
        return;
      }

      if (!presetDropdownRef.current?.contains(target)) {
        setIsPresetOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [isPresetOpen]);

  useEffect(() => {
    void loadOnlineDoctorOptions();
  }, []);

  useEffect(() => {
    const handler = (message: { type?: string; data?: { ok?: boolean; error?: string } }) => {
      if (message?.type === 'BRIDGE_SYNC_RESULT') {
        const { ok, error } = message.data ?? {};
        setBridgeSyncStatus(ok ? 'ok' : 'fail');
        setBridgeSyncError(error || '');
        if (ok) {
          const timer = setTimeout(() => setBridgeSyncStatus('idle'), 5000);
          return () => clearTimeout(timer);
        }
      }
    };
    browser.runtime.onMessage.addListener(handler);
    return () => browser.runtime.onMessage.removeListener(handler);
  }, []);

  const updateField = (field: keyof TTVStateShape, value: string | boolean | string[] | null) => {
    commitState((prev) => ({
      ...prev,
      [field]: value,
    }));
    // Mark vital fields as ASIST-manual when user types (not when autocomplete fills)
    if (
      (VITAL_FIELD_KEYS as string[]).includes(field as string) &&
      typeof value === 'string' &&
      value.trim() !== ''
    ) {
      const meta = makeFieldMeta(value, 'ASIST-manual');
      setFieldMeta((prev) => ({ ...prev, [field]: meta }));
    }
  };

  const applyShadowSuggestion = () => {
    if (!shadowSuggestion.trim()) return;

    const current = state.symptomText.trim();
    const nextText = current ? `${current} ${shadowSuggestion}` : shadowSuggestion;
    applySymptomText(nextText);
    setLastProcessedSymptomText(nextText);
    setAnamnesisMissingFields([]);
  };

  const toggleAllergy = (label: string) => {
    const nextAllergies = state.allergies.includes(label)
      ? state.allergies.filter((item) => item !== label)
      : [...state.allergies, label];

    updateField('allergies', nextAllergies);
  };

  const loadOnlineDoctorOptions = async () => {
    setIsLoadingDoctors(true);
    setDoctorPickerError('');
    setDoctorPickerNotice('');

    try {
      const doctors = await getOnlineDoctors();
      setOnlineDoctors(doctors);
      setSelectedDoctorId((current) => current || doctors[0]?.id || '');
      if (doctors.length === 0) {
        setDoctorPickerError(
          'Tidak ada dokter online saat ini. Pastikan dashboard sudah terbuka dan status online aktif.'
        );
      }
    } catch (error) {
      // Clear stale list — jangan tampilkan fallback dokter ke user saat authenticated
      setOnlineDoctors([]);
      setSelectedDoctorId('');
      const msg = error instanceof Error ? error.message : 'Gagal memuat daftar dokter';
      const isAuthHint =
        error instanceof Error &&
        (error.name === 'AuthRequiredError' || msg.includes('Bridge memerlukan'));
      setDoctorPickerError(
        isAuthHint
          ? `${BRIDGE_AUTH_REQUIRED_HINT} Lalu muat ulang daftar dokter.`
          : `${msg} — Periksa Crew API Base URL dan Automation Token di Settings → Agent.`
      );
    } finally {
      setIsLoadingDoctors(false);
    }
  };

  const handleForwardToDoctor = async () => {
    if (!selectedDoctorId) {
      setDoctorPickerError('Pilih dokter tujuan terlebih dahulu.');
      return;
    }

    setIsSendingConsult(true);
    setDoctorPickerError('');
    setDoctorPickerNotice('');

    try {
      const bridgeStatus = await getBridgeRuntimeStatus();
      if (bridgeStatus.readiness !== 'ready') {
        setDoctorPickerError(bridgeStatus.message || BRIDGE_AUTH_REQUIRED_HINT);
        return;
      }
      const screeningAudit = deriveScreeningResultForAudit(canonicalOutput);
      const patient_id_token = await patientPseudonymToken(patientRM);
      const assistSessionId = canonicalOutput?.request_id ?? buildCanonicalRequestId(patientRM);
      const facilitySlug = (extractedFacilityName || 'unknown').trim() || 'unknown';

      const keluhanForConsult =
        anamnesaDraft.payload.keluhan_utama || state.symptomText.trim() || '-';
      const isObese = state.obesityConfirmation === 'confirmed';
      const estTinggi = patientGender === 'P' ? 155 : 165;
      const estIMT = isObese ? 30.5 : 22.0;
      const estBerat = Math.round(estIMT * Math.pow(estTinggi / 100, 2));
      const estLingkarPerut = isObese
        ? patientGender === 'P'
          ? 90
          : 95
        : patientGender === 'P'
          ? 72
          : 80;

      const { consultId, eventId: _consultEventId } = await sendConsultToDoctor({
        patient: {
          name: patientName,
          age: patientAge,
          gender: patientGender,
          rm: patientRM,
          dob: patientDOB || undefined,
          bpjsStatus: patientBPJSStatus || null,
          kelurahan: patientKelurahan || '',
        },
        ttv: {
          sbp: state.sbp,
          dbp: state.dbp,
          hr: state.hr,
          rr: state.rr,
          temp: state.temp,
          spo2: state.spo2,
          glucose: state.glucose,
        },
        keluhan_utama: keluhanForConsult,
        keluhan_tambahan: anamnesaDraft.payload.keluhan_tambahan,
        risk_factors:
          alerts.length > 0
            ? alerts.map((alert) => `${alert.severity.toUpperCase()} • ${alert.title}`)
            : ['Tidak ada alert prioritas tinggi'],
        anthropometrics: {
          tinggi: estTinggi,
          berat: estBerat,
          imt: estIMT,
          hasil_imt: isObese ? 'Obesitas (estimasi)' : 'Normal (estimasi)',
          lingkar_perut: estLingkarPerut,
        },
        avpu: (state.avpu as 'A' | 'C' | 'V' | 'P' | 'U') || undefined,
        physical_exam_context: buildPhysicalExamContext(keluhanForConsult, state.avpu),
        penyakit_kronis: chronicHistoryLabels,
        alergi: state.allergies,
        status_kehamilan:
          state.pregnancyStatus === true
            ? 'hamil'
            : state.pregnancyStatus === false
              ? 'tidak_hamil'
              : 'tidak_diisi',
        disability_type: state.disabilityType || undefined,
        obesity_confirmation:
          state.obesityConfirmation === 'confirmed'
            ? 'confirmed'
            : state.obesityConfirmation === 'not_confirmed'
              ? 'not_confirmed'
              : undefined,
        clinical_context: {
          facility_name: extractedFacilityName || undefined,
          special_conditions: extractedSpecialConditions,
          pregnancy_risk: extractedPregnancyRisk || undefined,
        },
        canonical_clinical: canonicalOutput
          ? {
              news2: canonicalOutput.scoring.news2,
              trajectory: canonicalOutput.trajectory
                ? {
                    overall_trend: canonicalOutput.trajectory.overall_trend,
                    overall_risk: canonicalOutput.trajectory.overall_risk,
                    deterioration_state: canonicalOutput.trajectory.deterioration_state,
                    narrative: canonicalOutput.trajectory.narrative,
                  }
                : undefined,
              immediate_actions: canonicalOutput.recommendations.immediate_actions,
            }
          : undefined,
        visit_history: (prefetchedVisits ?? []).slice(0, 5).map((v) => ({
          encounter_id: v.encounter_id,
          timestamp: v.timestamp,
          vitals: {
            sbp: v.vitals.sbp,
            dbp: v.vitals.dbp,
            hr: v.vitals.hr,
            rr: v.vitals.rr,
            temp: v.vitals.temp,
            glucose: v.vitals.glucose,
          },
          keluhan_utama: v.keluhan_utama,
          diagnosa: v.diagnosa ?? null,
        })),
        target_doctor_id: selectedDoctorId,
        sent_at: new Date().toISOString(),
        screening_result: screeningAudit,
        patient_id_token,
        screening_id: assistSessionId,
        facility_id: facilitySlug,
        assist_id: assistSessionId,
        app_version:
          typeof browser !== 'undefined' && browser.runtime?.getManifest
            ? browser.runtime.getManifest().version
            : undefined,
      });

      const successMessage = `Consult terkirim ke ${selectedDoctor?.name || 'dokter tujuan'}${
        consultId ? ` • ${consultId}` : ''
      }`;
      const forwardSummary = buildForwardSummary({
        targetDoctorName: selectedDoctor?.name || 'Dokter tujuan',
        patientName,
        patientRM,
        patientBPJSStatus,
        extractedPayerLabel,
        specialConditions: extractedSpecialConditions,
        pregnancyRisk: extractedPregnancyRisk,
        facilityName: extractedFacilityName,
        consultId,
        canonicalOutput,
      });
      setDoctorPickerNotice(successMessage);
      playSound('notif1.wav');
      setOutput((prev) => `${prev ? `${prev}\n\n` : ''}${forwardSummary}`);
    } catch (error) {
      setDoctorPickerError(error instanceof Error ? error.message : 'Gagal mengirim consult');
    } finally {
      setIsSendingConsult(false);
    }
  };

  function handleAnalyze() {
    setIsAnalyzing(true);

    window.setTimeout(() => {
      void (async () => {
        let activeDraft = anamnesaDraft;
        let extractionLatencyMs = 0;

        if (HYBRID_AUTOTEXT_ENABLED) {
          const extractionStart = Date.now();
          try {
            const extraction = await extractClinicalAnamnesis(state.symptomText.trim());
            extractionLatencyMs = Date.now() - extractionStart;
            setAnamnesisMissingFields(extraction.data_belum_lengkap);
            activeDraft = composeAnamnesaDraftFromExtraction(extraction, {
              symptomText: state.symptomText,
              patientGender,
              chronicDiseases: chronicHistoryLabels,
              allergies: state.allergies,
              pregnancyStatus: state.pregnancyStatus,
              specialConditions: extractedSpecialConditions,
              pregnancyRisk: extractedPregnancyRisk,
              vitals: {
                sbp: parseNumber(state.sbp),
                dbp: parseNumber(state.dbp),
                hr: parseNumber(state.hr),
                rr: parseNumber(state.rr),
                temp: parseNumber(state.temp),
                spo2: parseNumber(state.spo2),
                glucose: parseNumber(state.glucose),
              },
              disabilityType: state.disabilityType,
              obesityConfirmation: state.obesityConfirmation,
              autosenPresetLabel: presetLabels[state.autosenPreset],
            });
            ttvLog.debug('Hybrid extraction applied', {
              source: 'backend',
              missingCount: extraction.data_belum_lengkap.length,
              latencyMs: extractionLatencyMs,
            });
          } catch (error) {
            setAnamnesisMissingFields([]);
            ttvLog.warn('Hybrid extraction fallback to local composer', {
              source: 'fallback-local',
              reason: error instanceof Error ? error.message : 'unknown',
              latencyMs: Date.now() - extractionStart,
            });
          }
        }

        const draftedSymptomText = activeDraft.payload.keluhan_tambahan;
        const summary = buildSummary(state, alerts, effectiveHistoryFlags, {
          patientName,
          patientGender,
          patientAge,
          patientRM,
        });
        const senautoOutput = buildSenautoOutput(activeDraft, summary);
        const payload: TTVInferenceData = {
          patient: {
            name: patientName,
            gender: patientGender,
            age: patientAge,
            rm: patientRM,
            dob: patientDOB,
            bloodType: patientBloodType,
            bpjsStatus: patientBPJSStatus,
            kelurahan: patientKelurahan,
          },
          vitals: {
            sbp: parseNumber(state.sbp),
            dbp: parseNumber(state.dbp),
            hr: parseNumber(state.hr),
            rr: parseNumber(state.rr),
            temp: parseNumber(state.temp),
            spo2: parseNumber(state.spo2),
            glucose: parseNumber(state.glucose),
          },
          symptomText: draftedSymptomText,
          allergies: state.allergies,
          pregnancyStatus: state.pregnancyStatus,
          disabilityType: state.disabilityType,
          obesityConfirmation: state.obesityConfirmation,
          autosenPreset: state.autosenPreset,
          alerts,
          summary,
          anamnesaDraft: activeDraft,
          generatedAt: new Date().toISOString(),
        };

        setIsDraftTyping(true);
        setAnimatedDraftText(draftedSymptomText);
        applySymptomText('');

        setOutput(senautoOutput);
        setOutputMode('anamnesis');
        onComplete?.(payload);
        setIsAnalyzing(false);
      })();
    }, 320);
  }

  const handleDraftAnimationComplete = () => {
    if (!animatedDraftText) {
      setIsDraftTyping(false);
      return;
    }

    applySymptomText(animatedDraftText);
    setLastProcessedSymptomText(animatedDraftText);
    setAnimatedDraftText('');
    setIsDraftTyping(false);
  };

  const handleAnalyzeVitals = () => {
    setIsAnalyzingVitals(true);
    setIsCanonicalLoading(true);
    setCanonicalError('');
    setLocalCanonicalOutput(null);

    window.setTimeout(() => {
      void (async () => {
        const currentPreset = stateRef.current.autosenPreset;
        const generated = buildVitalAutofill(currentPreset || 'adl', patientAge, Date.now());

        // Apply source-priority guard — do not overwrite RME-manual or ASIST-manual fields
        const filteredVitals: Partial<Record<VitalFieldKey, string>> = {};
        for (const field of VITAL_FIELD_KEYS) {
          if (canOverrideField(fieldMetaRef.current[field], 'ASIST-autocomplete')) {
            filteredVitals[field] = generated.vitals[field as keyof typeof generated.vitals];
          }
          // Blocked fields are silently skipped (logged via audit trail in future)
        }

        const nextState: TTVStateShape = {
          ...stateRef.current,
          ...filteredVitals,
        };

        // Mark filled fields as ASIST-autocomplete in fieldMeta
        const newMeta: Partial<Record<VitalFieldKey, FieldMeta>> = { ...fieldMetaRef.current };
        for (const field of VITAL_FIELD_KEYS) {
          if (field in filteredVitals && filteredVitals[field] !== undefined) {
            newMeta[field] = makeFieldMeta(filteredVitals[field]!, 'ASIST-autocomplete');
          }
        }
        setFieldMeta(newMeta);
        const nextAlerts = buildAlerts(nextState, { patientAge });

        const vitalOutput = buildVitalAutocompleteOutput({
          state: nextState,
          alerts: nextAlerts,
          patient: {
            patientName,
            patientGender,
            patientAge,
            patientRM,
          },
          autofillReasoning: [
            `Preset ${presetLabels[nextState.autosenPreset]} — ${generated.physiologyLabel}.`,
            ...generated.reasoning,
          ],
        });

        await runGhostFillAnimation(nextState);
        commitState(() => nextState);

        const settleGhostId = window.setTimeout(() => {
          setIsGhostFillAnimating(false);
          setGhostActiveLane(null);
          setGhostCompletedLanes([]);
          setGhostVisibleValues({});

          // Auto-determine AVPU from filled vital values
          const sbp = Number(nextState.sbp);
          const spo2 = Number(nextState.spo2);
          const rr = Number(nextState.rr);
          const hr = Number(nextState.hr);
          const glucose = Number(nextState.glucose);
          if (sbp > 0 && spo2 > 0) {
            // Use -1 for unknown/empty glucose — avpu-engine skips glucose checks when < 0
            const glucoseSafe = glucose > 0 ? glucose : -1;
            const avpuResult = determineAVPU({ sbp, spo2, rr, hr, glucose: glucoseSafe });
            setAvpuSuggestion(avpuResult);
            // Use ref (not state) to avoid stale closure — user may have locked between call and execution
            if (!avpuLockedRef.current) {
              commitState((prev) => ({ ...prev, avpu: avpuResult.avpu }));
            }
          }
        }, 96);
        ghostAnimationTimeoutsRef.current.push(settleGhostId);

        setOutput(vitalOutput);
        setOutputMode('vital');

        const vitalsLine = `TTV: TD ${nextState.sbp || '-'}/${nextState.dbp || '-'} mmHg | Nadi ${nextState.hr || '-'} | RR ${nextState.rr || '-'} | Suhu ${nextState.temp || '-'} C | SpO2 ${nextState.spo2 || '-'}% | Gula darah ${nextState.glucose || '-'} mg/dL`;
        const symptomTextRaw = nextState.symptomText.trim();
        const fallbackChiefComplaint =
          symptomTextRaw ||
          `Pemeriksaan vital sign preset ${presetLabels[nextState.autosenPreset]}`;
        const requestTime = new Date().toISOString();
        const canonicalInput = buildCanonicalTriageInput({
          requestId: buildCanonicalRequestId(patientRM),
          requestTime,
          patientName,
          patientGender,
          patientAge,
          patientRM,
          patientDOB,
          patientBPJSStatus,
          patientKelurahan,
          patientFacilityName: extractedFacilityName || undefined,
          patientPayerLabel: extractedPayerLabel || undefined,
          vitals: {
            sbp: parseNumber(nextState.sbp),
            dbp: parseNumber(nextState.dbp),
            hr: parseNumber(nextState.hr),
            rr: parseNumber(nextState.rr),
            temp: parseNumber(nextState.temp),
            spo2: parseNumber(nextState.spo2),
            glucose: parseNumber(nextState.glucose),
            avpu: nextState.avpu,
            supplemental_o2: nextState.supplemental_o2,
            ...(nextState.pain_score !== ''
              ? { pain_score: Math.min(10, Math.max(0, parseNumber(nextState.pain_score))) }
              : {}),
          },
          symptomTextRaw,
          keluhanUtama: anamnesaDraft.payload.keluhan_utama || fallbackChiefComplaint,
          keluhanTambahan: anamnesaDraft.payload.keluhan_tambahan || symptomTextRaw || undefined,
          chronicHistorySummary,
          allergies: nextState.allergies,
          pregnancyStatus: nextState.pregnancyStatus,
          extractedPregnancyRisk,
          extractedSpecialConditions,
          disabilityType: nextState.disabilityType,
          obesityConfirmation: nextState.obesityConfirmation,
          autosenPreset: nextState.autosenPreset,
          hasCopd: Boolean(effectiveHistoryFlags['asma']),
        });

        try {
          const canonical = await evaluateCanonicalClinicalEngine(canonicalInput);
          setLocalCanonicalOutput(canonical);
          setOutput(
            buildCanonicalVitalOutput(canonical, vitalOutput, {
              patientName,
              patientAge,
              patientRM,
              vitalsLine,
            })
          );
        } catch (error) {
          setLocalCanonicalOutput(null);
          // Canonical engine is optional — any failure (auth, HTML response, network, server down)
          // falls back silently. Never show internal API errors to clinical users.
          const errName = error instanceof Error ? error.name : '';
          const errMsg = error instanceof Error ? error.message : '';
          const isAuthOrFormat =
            errName === 'AuthRequiredError' ||
            errName === 'BridgeResponseFormatError' ||
            errMsg.includes('halaman HTML') ||
            errMsg.includes('Belum login') ||
            errMsg.includes('Login diperlukan');
          if (!isAuthOrFormat) {
            // Log unexpected errors for diagnostics but still don't show in UI
            console.warn('[Canonical] fallback to local — unexpected error:', errMsg);
          }
          setCanonicalError('');
          setOutput(
            `${vitalOutput}\n\n[CANONICAL STATUS]\nDashboard canonical engine tidak tersedia. Menampilkan analisis lokal extension.`
          );
        } finally {
          setIsCanonicalLoading(false);
          setIsAnalyzingVitals(false);
        }
      })();
    }, 180);
  };

  return (
    <div className="clinical-form-stack flex flex-col gap-3">
      <div className="form-group">
        <div className="form-group-header form-group-header--cta">
          <div className="form-group-header__title-block">
            <div className="console-label console-label-prominent">Gejala / Keluhan</div>
            {showPediatricScreeningMode ? (
              <div className="screening-mode-indicator">Pediatric screening mode</div>
            ) : null}
          </div>
          <button
            type="button"
            className={`btn-ac-inline${hasSymptomDraftPending ? ' engine-btn--pulse' : ''}`}
            onClick={() => void handleAnalyze()}
            disabled={isAnalyzing || isCanonicalLoading}
            aria-label="AutoComplete+ Gejala"
          >
            {isAnalyzing ? '...' : 'AutoComplete+'}
          </button>
        </div>
        {isDraftTyping && animatedDraftText ? (
          <div
            className="neu-textarea neu-textarea--animated"
            aria-live="polite"
            aria-label="Draft anamnesa sedang dibangun"
          >
            <TextEffect
              key={animatedDraftText}
              per="char"
              preset="fade"
              trigger
              onAnimationComplete={handleDraftAnimationComplete}
              className="neu-textarea__animated-copy"
            >
              {animatedDraftText}
            </TextEffect>
          </div>
        ) : (
          <textarea
            value={state.symptomText}
            onChange={(event) => updateField('symptomText', event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Tab' && shadowSuggestion.trim()) {
                event.preventDefault();
                applyShadowSuggestion();
              }
            }}
            placeholder="Ketik keluhan utama, durasi, dan konteks klinis singkat..."
            className="neu-textarea"
            aria-label="Keluhan utama pasien"
          />
        )}
        {shadowSuggestion ? (
          <div className="field-context-note text-[10px] text-[var(--text-muted)]">
            Suggestion: {shadowSuggestion} (Tekan Tab untuk terapkan)
          </div>
        ) : null}
        {/* Development debug info removed per request */}
      </div>

      <div className="form-row-dual">
        <div className="form-group form-group--inline">
          <div className="form-group-header">
            <div className="console-label console-label-prominent">Riwayat Alergi</div>
            {extractedAllergies.length > 0 ? (
              <span className="field-extracted-indicator">extracted</span>
            ) : null}
          </div>
          <div ref={allergyDropdownRef} className="history-dropdown">
            <button
              type="button"
              onClick={() => setIsAllergyOpen((prev) => !prev)}
              className={`collapsible-trigger neu-select font-mono text-[12px] ${
                isAllergyOpen ? 'collapsible-trigger-open' : ''
              }`}
              aria-expanded={isAllergyOpen}
              aria-controls="riwayat-alergi-panel"
            >
              <span
                className={`collapsible-trigger__summary field-summary-prominent ${
                  isAllergyPlaceholder ? 'field-summary-prominent--placeholder' : ''
                }`}
                title={allergyPlaceholder}
              >
                {allergyPlaceholder}
              </span>
              <ChevronDown
                className={`collapsible-trigger__icon ${isAllergyOpen ? 'collapsible-trigger__icon-open' : ''}`}
              />
            </button>
            {isAllergyOpen ? (
              <div
                id="riwayat-alergi-panel"
                className="history-dropdown__panel option-grid option-grid--single"
              >
                {allergyPresets.map((label) => (
                  <label key={label} className="option-item option-item--single">
                    <input
                      type="checkbox"
                      checked={state.allergies.includes(label)}
                      onChange={() => toggleAllergy(label)}
                    />
                    <span>{label}</span>
                  </label>
                ))}
              </div>
            ) : null}
          </div>
          {extractedAllergies.length > 0 ? (
            <div className="field-context-note">RME: {extractedAllergies.join(', ')}</div>
          ) : null}
        </div>

        <div className="form-group form-group--inline">
          <div className="form-group-header">
            <div className="console-label console-label-prominent">Status Kehamilan</div>
            {isFemalePatient && !extractedPregnancyRisk && state.pregnancyStatus === null ? (
              <span className="field-placeholder-hint">Mohon diisi</span>
            ) : isFemalePatient && extractedPregnancyRisk ? (
              <span className="field-extracted-indicator">risiko terdeteksi</span>
            ) : null}
          </div>
          {isFemalePatient ? (
            <select
              value={
                state.pregnancyStatus === true
                  ? 'hamil'
                  : state.pregnancyStatus === false
                    ? 'tidak_hamil'
                    : 'pilih'
              }
              onChange={(event) =>
                updateField(
                  'pregnancyStatus',
                  event.target.value === 'hamil'
                    ? true
                    : event.target.value === 'tidak_hamil'
                      ? false
                      : null
                )
              }
              className={`neu-select field-summary-prominent select-prominent ${
                state.pregnancyStatus === null ? 'select-prominent--placeholder' : ''
              }`}
              aria-label="Pilih status kehamilan"
              aria-required
            >
              <option value="pilih">Pilih di sini</option>
              <option value="hamil">Hamil</option>
              <option value="tidak_hamil">Tidak Hamil</option>
            </select>
          ) : (
            <div
              className="neu-select field-summary-prominent select-prominent pregnancy-select--inactive pregnancy-select--static"
              aria-label="Tidak relevan"
            >
              Tidak relevan
            </div>
          )}
          {isFemalePatient && extractedPregnancyRisk ? (
            <div className="field-context-note">RME: {extractedPregnancyRisk}</div>
          ) : null}
        </div>
      </div>

      <div className="form-row-dual">
        <div className="form-group form-group--inline">
          <div className="form-group-header">
            <div className="console-label console-label-prominent">Disabilitas</div>
          </div>
          <div ref={disabilityDropdownRef} className="history-dropdown">
            <button
              type="button"
              onClick={() => {
                setIsDisabilityOpen((prev) => !prev);
                setIsObesityOpen(false);
                setIsPresetOpen(false);
              }}
              className={`collapsible-trigger neu-select font-mono text-[12px] ${
                isDisabilityOpen ? 'collapsible-trigger-open' : ''
              }`}
              aria-expanded={isDisabilityOpen}
              aria-controls="disabilitas-panel"
            >
              <span
                className={`collapsible-trigger__summary field-summary-prominent ${
                  isDisabilityPlaceholder ? 'field-summary-prominent--placeholder' : ''
                }`}
                title={disabilityPlaceholder}
              >
                {disabilityPlaceholder}
              </span>
              <ChevronDown
                className={`collapsible-trigger__icon ${isDisabilityOpen ? 'collapsible-trigger__icon-open' : ''}`}
              />
            </button>
            {isDisabilityOpen ? (
              <div
                id="disabilitas-panel"
                className="history-dropdown__panel option-grid option-grid--single"
              >
                {disabilityOptions.map((option, index) => (
                  <button
                    key={`${option || 'placeholder'}-${index}`}
                    type="button"
                    className={`option-item option-item--single ${state.disabilityType === option ? 'option-item--selected' : ''}`}
                    onClick={() => {
                      updateField('disabilityType', option);
                      setIsDisabilityOpen(false);
                    }}
                  >
                    <span className={!option ? 'option-item__placeholder' : ''}>
                      {option || 'Pilih di sini'}
                    </span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </div>

        <div className="form-group form-group--inline">
          <div className="form-group-header">
            <div className="console-label console-label-prominent">Obesitas</div>
          </div>
          <div ref={obesityDropdownRef} className="history-dropdown">
            <button
              type="button"
              onClick={() => {
                setIsObesityOpen((prev) => !prev);
                setIsDisabilityOpen(false);
                setIsPresetOpen(false);
              }}
              className={`collapsible-trigger neu-select font-mono text-[12px] ${
                isObesityOpen ? 'collapsible-trigger-open' : ''
              }`}
              aria-expanded={isObesityOpen}
              aria-controls="obesitas-panel"
            >
              <span
                className={`collapsible-trigger__summary field-summary-prominent ${
                  isObesityPlaceholder ? 'field-summary-prominent--placeholder' : ''
                }`}
                title={obesityPlaceholder}
              >
                {obesityPlaceholder}
              </span>
              <ChevronDown
                className={`collapsible-trigger__icon ${isObesityOpen ? 'collapsible-trigger__icon-open' : ''}`}
              />
            </button>
            {isObesityOpen ? (
              <div
                id="obesitas-panel"
                className="history-dropdown__panel option-grid option-grid--single"
              >
                {[
                  { value: '' as ObesityConfirmation, label: 'Pilih di sini' },
                  { value: 'confirmed' as ObesityConfirmation, label: 'Terkonfirmasi' },
                  { value: 'not_confirmed' as ObesityConfirmation, label: 'Tidak Terkonfirmasi' },
                ].map((option) => (
                  <button
                    key={option.value || 'placeholder'}
                    type="button"
                    className={`option-item option-item--single ${state.obesityConfirmation === option.value ? 'option-item--selected' : ''}`}
                    onClick={() => {
                      updateField('obesityConfirmation', option.value);
                      setIsObesityOpen(false);
                    }}
                  >
                    <span className={option.value === '' ? 'option-item__placeholder' : ''}>
                      {option.label}
                    </span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {extractedSpecialConditions.length > 0 ? (
        <div className="form-group">
          <div className="form-group-header">
            <div className="console-label console-label-prominent">Penyakit Khusus</div>
            <span className="field-extracted-indicator">extracted</span>
          </div>
          <div className="field-context-note">{extractedSpecialConditions.join(', ')}</div>
        </div>
      ) : null}

      <div className="form-group">
        <div className="form-group-header">
          <div className="console-label console-label-prominent">AutoSen Preset</div>
          <div className="text-[10px] text-[var(--text-muted)]">Quick selector</div>
        </div>
        <div ref={presetDropdownRef} className="history-dropdown">
          <button
            type="button"
            onClick={() => {
              setIsPresetOpen((prev) => !prev);
              setIsDisabilityOpen(false);
              setIsObesityOpen(false);
            }}
            className={`collapsible-trigger neu-select font-mono text-[12px] ${
              isPresetOpen ? 'collapsible-trigger-open' : ''
            }`}
            aria-expanded={isPresetOpen}
            aria-controls="autocomplete-preset-panel"
          >
            <span
              className={`collapsible-trigger__summary field-summary-prominent ${
                isPresetPlaceholder ? 'field-summary-prominent--placeholder' : ''
              }`}
              title={presetPlaceholder}
            >
              {presetPlaceholder}
            </span>
            <ChevronDown
              className={`collapsible-trigger__icon ${isPresetOpen ? 'collapsible-trigger__icon-open' : ''}`}
            />
          </button>
          {isPresetOpen ? (
            <div
              id="autocomplete-preset-panel"
              className="history-dropdown__panel option-grid option-grid--single"
            >
              {(Object.keys(presetLabels) as AutosenPreset[])
                .filter((p) => p !== '')
                .map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    className={`option-item option-item--single ${state.autosenPreset === preset ? 'option-item--selected' : ''}`}
                    onClick={() => {
                      updateField('autosenPreset', preset);
                      setIsPresetOpen(false);
                    }}
                  >
                    <span>{presetLabels[preset]}</span>
                  </button>
                ))}
            </div>
          ) : null}
        </div>
      </div>

      <div className="form-group">
        <div className="form-group-header form-group-header--cta">
          <div className="form-group-header__title-block">
            <div className="console-label console-label-prominent">
              Vital Signs - Cardiopulmonary Metrics
            </div>
          </div>
          <button
            type="button"
            className="btn-ac-inline"
            onClick={() => void handleAnalyzeVitals()}
            disabled={isAnalyzingVitals || isCanonicalLoading}
            aria-label="AutoComplete+ Vital Signs"
          >
            {isAnalyzingVitals ? '...' : 'AutoComplete+'}
          </button>
        </div>
        <div
          className={`vitals-grid vitals-grid--redesign ${isGhostFillAnimating ? 'vitals-grid--ghosting' : ''}`}
        >
          {/* Row 1 — Tensi (2-col, teal highlight) */}
          <div className="vitals-row vitals-row--2col vitals-row--tensi">
            <div className={getVitalGhostItemClassName('bp')}>
              <span className="vital-label-inline">Sistolik</span>
              <input
                type="text"
                className="vital-input vital-input--centered"
                placeholder="---"
                value={displayedVitalValue('sbp')}
                onChange={(event) => updateField('sbp', event.target.value)}
                aria-label="Sistolik"
                disabled={isGhostFillAnimating}
              />
            </div>
            <div className={getVitalGhostItemClassName('bp')}>
              <span className="vital-label-inline">Diastolik</span>
              <input
                type="text"
                className="vital-input vital-input--centered"
                placeholder="---"
                value={displayedVitalValue('dbp')}
                onChange={(event) => updateField('dbp', event.target.value)}
                aria-label="Diastolik"
                disabled={isGhostFillAnimating}
              />
            </div>
          </div>

          {/* Row 2 — Nadi / Suhu / Gula (3-col) */}
          <div className="vitals-row vitals-row--3col">
            {[
              { key: 'hr' as const, label: 'Nadi', lane: 'hr' as const },
              { key: 'temp' as const, label: 'Suhu', lane: 'temp' as const },
              { key: 'glucose' as const, label: 'Gula', lane: 'glucose' as const },
            ].map((item) => (
              <div key={item.key} className={getVitalGhostItemClassName(item.lane)}>
                <span className="vital-label-inline">{item.label}</span>
                <input
                  type="text"
                  className="vital-input vital-input--centered"
                  placeholder="---"
                  value={displayedVitalValue(item.key)}
                  onChange={(event) => updateField(item.key, event.target.value)}
                  aria-label={item.label}
                  disabled={isGhostFillAnimating}
                />
              </div>
            ))}
          </div>

          {/* Row 3 — Pernafasan / Saturasi O2 (2-col) */}
          <div className="vitals-row vitals-row--2col">
            {[
              { key: 'rr' as const, label: 'Pernafasan', lane: 'rr' as const },
              { key: 'spo2' as const, label: 'Saturasi O₂', lane: 'spo2' as const },
            ].map((item) => (
              <div key={item.key} className={getVitalGhostItemClassName(item.lane)}>
                <span className="vital-label-inline">{item.label}</span>
                <input
                  type="text"
                  className="vital-input vital-input--centered"
                  placeholder="---"
                  value={displayedVitalValue(item.key)}
                  onChange={(event) => updateField(item.key, event.target.value)}
                  aria-label={item.label}
                  disabled={isGhostFillAnimating}
                />
              </div>
            ))}
          </div>
        </div>

        <div className="form-group">
          <div className="form-group-header">
            <div className="console-label console-label-prominent">Tingkat Kesadaran</div>
          </div>

          {/* GAP-001: Clinical Assessment Row */}
          <div className="vital-assessment-row">
            <div className="vital-assessment-group">
              <div className="vital-assessment-label">AVPU</div>
              <div className="vital-assessment-controls">
                {AVPU_OPTIONS.map((option) => (
                  <button
                    key={option}
                    type="button"
                    className={`avpu-btn ${state.avpu === option ? 'avpu-btn--active' : ''}`}
                    onClick={() => {
                      if (!avpuLocked) updateField('avpu', option);
                    }}
                    title={AVPU_LABELS[option]}
                    aria-label={`AVPU ${AVPU_LABELS[option]}`}
                    disabled={isGhostFillAnimating || avpuLocked}
                  >
                    {option}
                  </button>
                ))}
                {avpuSuggestion && (
                  <span
                    className="avpu-suggestion"
                    style={{ color: avpuSuggestion.color }}
                    title={avpuSuggestion.reason.join(' · ')}
                  >
                    {avpuSuggestion.avpu === 'A' ? '● Normal' : `⚠ ${avpuSuggestion.avpu}`}
                  </span>
                )}
                <button
                  type="button"
                  className={`avpu-confirm-btn${avpuLocked ? ' avpu-confirm-btn--locked' : ''}`}
                  onClick={() => setAvpuLocked(true)}
                  disabled={avpuLocked}
                  aria-label="Konfirmasi status AVPU"
                >
                  {avpuLocked ? '✓' : 'OK'}
                </button>
              </div>
            </div>
            <div className="vital-assessment-group vital-assessment-group--pain">
              <div className="vital-assessment-label">Nyeri (0-10)</div>
              <div className="vital-value">
                <input
                  type="number"
                  min={0}
                  max={10}
                  step={1}
                  className="vital-input vital-input--narrow"
                  placeholder="--"
                  value={state.pain_score}
                  onChange={(e) => updateField('pain_score', e.target.value)}
                  aria-label="Skor nyeri 0 sampai 10"
                  disabled={isGhostFillAnimating}
                />
                <span className="vital-unit">/10</span>
                <div
                  className={`pain-graph-accent ${state.pain_score.trim() ? 'pain-graph-accent--hidden' : ''}`}
                  aria-hidden="true"
                >
                  <span />
                  <span />
                  <span />
                  <span />
                  <span />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {alerts.length > 0 ? (
        <div className="alert-timeline-preview">
          <div className="alert-timeline-preview__header">
            <span className="alert-timeline-preview__label alert-timeline-preview__label--pulse">
              TEMUAN KLINIS
            </span>
            <span className="alert-timeline-preview__count">{alerts.length}</span>
          </div>
          <div className="alert-timeline-preview__track">
            {alerts.slice(0, 3).map((alert, i) => (
              <div
                key={alert.id}
                className="alert-timeline-entry"
                style={{ animationDelay: `${i * 80}ms` }}
              >
                <div className="alert-timeline-entry__spine">
                  <div className="alert-timeline-entry__dot" />
                  {i < Math.min(alerts.length, 3) - 1 && (
                    <div className="alert-timeline-entry__line" />
                  )}
                </div>
                <div className="alert-timeline-entry__body">
                  <div className="alert-timeline-entry__gate">
                    {alert.gate.replace('GATE_', 'G').replace(/_/g, '·')}
                  </div>
                  <div className="alert-timeline-entry__title">{alert.title}</div>
                  <div className="alert-timeline-entry__reasoning">{alert.reasoning}</div>
                  <div
                    className="alert-timeline-entry__access"
                    role="button"
                    tabIndex={0}
                    onClick={() => onAccessEmergency?.()}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') onAccessEmergency?.();
                    }}
                  >
                    Akses Darurat ↑
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="form-group">
        <div className="form-group-header">
          <div className="console-label console-label-prominent">Dokter Online</div>
          <button
            type="button"
            className="icon-btn"
            onClick={() => void loadOnlineDoctorOptions()}
            title="Refresh dokter online"
            aria-label="Refresh dokter online"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isLoadingDoctors ? 'animate-spin' : ''}`} />
          </button>
        </div>
        <div className="doctor-picker-panel">
          <div className="doctor-picker-panel__subtitle">
            Pilih dokter online terlebih dahulu, lalu klik Forward to Doctor.
          </div>

          <div className="doctor-picker-summary">
            <div className="doctor-picker-summary__title">Consult Snapshot</div>
            <div className="doctor-picker-summary__rows">
              {consultSummaryRows.map((item) => (
                <div key={item.label} className="doctor-picker-summary__row">
                  <span className="doctor-picker-summary__label">{item.label}</span>
                  <span className="doctor-picker-summary__value" title={item.value}>
                    {item.value}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="doctor-picker-panel__list">
            {sortedDoctors.map((doctor) => {
              const isSelected = doctor.id === selectedDoctorId;

              return (
                <button
                  key={doctor.id}
                  type="button"
                  className={`doctor-option ${isSelected ? 'doctor-option--active' : ''}`}
                  onClick={() => setSelectedDoctorId(doctor.id)}
                  aria-pressed={isSelected}
                >
                  <span className="doctor-option__name">{doctor.name}</span>
                </button>
              );
            })}

            {!isLoadingDoctors && sortedDoctors.length === 0 ? (
              <div className="doctor-picker-panel__empty">Data dokter online belum tersedia.</div>
            ) : null}
          </div>

          {doctorPickerError ? (
            <div className="doctor-picker-panel__feedback doctor-picker-panel__feedback--error">
              {doctorPickerError}
            </div>
          ) : null}

          {bridgeSyncStatus === 'ok' ? (
            <div className="doctor-picker-panel__feedback doctor-picker-panel__feedback--success">
              Data pasien berhasil dikirim ke Dashboard.
            </div>
          ) : null}

          {bridgeSyncStatus === 'fail' ? (
            <div className="doctor-picker-panel__feedback doctor-picker-panel__feedback--error">
              Gagal kirim data ke Dashboard: {bridgeSyncError}
            </div>
          ) : null}

          {consultFooterRows.length > 0 ? (
            <div className="doctor-picker-footer">
              <button
                type="button"
                className={`doctor-picker-footer__toggle ${
                  isConsultFooterOpen ? 'doctor-picker-footer__toggle--open' : ''
                }`}
                onClick={() => setIsConsultFooterOpen((prev) => !prev)}
                aria-expanded={isConsultFooterOpen}
                aria-controls="doctor-consult-footer-panel"
              >
                <span className="doctor-picker-footer__title">
                  Footer Consult{selectedDoctor ? ` • ${selectedDoctor.name}` : ''}
                </span>
                <ChevronDown
                  className={`doctor-picker-footer__icon ${
                    isConsultFooterOpen ? 'doctor-picker-footer__icon--open' : ''
                  }`}
                />
              </button>
              {isConsultFooterOpen ? (
                <div id="doctor-consult-footer-panel" className="doctor-picker-footer__rows">
                  {consultFooterRows.map((item) => (
                    <div key={item.label} className="doctor-picker-footer__row">
                      <span className="doctor-picker-footer__label">{item.label}</span>
                      <span className="doctor-picker-footer__value" title={item.value}>
                        {item.value}
                      </span>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      <div className="action-bar action-bar--sequential">
        <button
          type="button"
          className={[
            'btn-sentra-uplink',
            uplinkState === 'processing' ? 'sentra-uplink--processing' : '',
            uplinkState === 'completed' ? 'sentra-uplink--completed' : '',
          ]
            .filter(Boolean)
            .join(' ')}
          onClick={() => void handleSentraUplink()}
          disabled={!onSentraUplink || uplinkState === 'processing'}
          aria-label="Sentra Uplink — isi RME otomatis"
        >
          {uplinkDisplayText}
        </button>
        {uplinkState === 'completed' && (
          <span className="uplink-arrow" aria-hidden="true">
            {'----->'}
          </span>
        )}
        <span className="action-bar__sep" aria-hidden="true">
          ›
        </span>
        <button
          type="button"
          className={[
            'action-btn',
            uplinkState === 'completed' ? 'action-btn--primary btn--blue' : 'action-btn--secondary',
          ].join(' ')}
          onClick={() => void handleForwardToDoctor()}
          disabled={!canForwardToDoctor || uplinkState !== 'completed'}
          aria-label="Kirim konsultasi ke dokter"
        >
          → Kirim Dokter
        </button>
      </div>
      {uplinkError ? (
        <p className="action-bar__hint action-bar__hint--error">{uplinkError}</p>
      ) : uplinkState === 'idle' && onSentraUplink ? (
        <p className="action-bar__hint">Selesaikan Uplink untuk mengaktifkan Kirim Dokter</p>
      ) : null}

      {doctorPickerNotice ? (
        <div className="doctor-picker-panel__feedback doctor-picker-panel__feedback--success">
          {doctorPickerNotice}
        </div>
      ) : null}

      {onNavigateToTrajectory && uplinkState === 'completed' ? (
        <button
          type="button"
          className="traj-nav-card"
          onClick={onNavigateToTrajectory}
          aria-label="Lanjut ke Clinical Trajectory"
        >
          <span className="traj-nav-card__icon" aria-hidden="true">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
            </svg>
          </span>
          <span className="traj-nav-card__body">
            <span className="traj-nav-card__title">Clinical Trajectory</span>
            <span className="traj-nav-card__desc">Analisis trend vital &amp; stratifikasi risiko</span>
          </span>
          <span className="traj-nav-card__arrow" aria-hidden="true">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </span>
        </button>
      ) : null}

      {canonicalError && canonicalError.length > 0 && outputMode === 'vital' ? (
        <div className="doctor-picker-panel__feedback doctor-picker-panel__feedback--error">
          Canonical vital sign fallback ke hasil lokal: {canonicalError}
        </div>
      ) : null}

      <div className="output-section">
        <div className="output-header">
          <span className="output-label">
            {outputMode === 'vital'
              ? 'AutoComplete+ Vital Sign'
              : outputMode === 'anamnesis'
                ? 'AutoComplete+ Anamnesis'
                : 'AutoComplete+ Output'}
          </span>
          <div className="output-actions">
            <button
              type="button"
              className="icon-btn"
              onClick={() => {
                setOutput('');
                setOutputMode(null);
              }}
              title="Clear output"
              aria-label="Hapus hasil analisis"
            >
              C
            </button>
            <button
              type="button"
              className="icon-btn"
              onClick={outputMode === 'vital' ? handleAnalyzeVitals : handleAnalyze}
              title="Re-run analysis"
              aria-label="Jalankan ulang analisis"
            >
              <AlertTriangle className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        <div className="output-content">
          {output || (
            <span className="placeholder-text">
              Output AutoComplete+ anamnesis atau vital sign akan muncul di sini setelah tombol yang
              sesuai dijalankan.
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export { TTVInferenceUI as default };
