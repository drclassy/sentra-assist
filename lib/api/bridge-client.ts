// Designed and constructed by Claudesy.
/**
 * Sentra Assist — Dashboard Bridge Client
 * Polls the Puskesmas Dashboard Bridge API for pending transfer requests.
 * Also supports outbound consult: Assist → Dashboard (Send to Doctor).
 *
 * Flow (inbound): Dashboard → Bridge API → Assist polls → auto-fill ePuskesmas
 * Flow (outbound): Assist → POST /api/consult → Dashboard → Doctor
 */

import { createLogger } from '~/utils/logger';
import type {
  AnamnesisExtractionResult,
  AnamnesisMissingField,
  RMETransferPayload,
  RMETransferResult,
} from '~/utils/types';
import { getAuthConfig } from './auth-client';
import { getSession } from './auth-store';
import {
  authedFetch,
  AuthRequiredError,
  BridgeApiError,
  BridgeResponseFormatError,
} from './authed-fetch';
import type { PatientSyncPayload } from './patient-sync-payload';

const log = createLogger('BridgeClient', 'background');
const COOKIE_SESSION_ACCESS_TOKEN = 'cookie-session';
const BRIDGE_TOKEN_REQUIRED_MESSAGE =
  'Login Dashboard diperlukan agar Assist terhubung ke crew yang online. Jika diperlukan, Bridge Automation Token dapat dipakai sebagai fallback.';

// ============================================================================
// TYPES
// ============================================================================

export interface BridgeEntry {
  id: string;
  status: string;
  createdAt: string;
  createdBy: string;
  pelayananId: string;
  patientName?: string;
  hasAnamnesa: boolean;
  hasDiagnosa: boolean;
  hasResep: boolean;
}

export interface BridgeEntryDetail {
  id: string;
  status: string;
  createdAt: string;
  createdBy: string;
  pelayananId: string;
  patientName?: string;
  payload: RMETransferPayload;
}

interface BridgeListResponse {
  ok: boolean;
  items: BridgeEntry[];
  count: number;
  error?: string;
}

interface BridgeDetailResponse {
  ok: boolean;
  entry: BridgeEntryDetail;
  error?: string;
}

interface BridgePatchResponse {
  ok: boolean;
  entry: { id: string; status: string };
  error?: string;
}

// ============================================================================
// CONFIG — bridge-specific settings only (auth handled by auth-store)
// ============================================================================

const STORAGE_KEY = 'sentra:bridge-config';

export interface BridgeConfig {
  enabled: boolean;
  pollIntervalMinutes: number;
}

const DEFAULT_CONFIG: BridgeConfig = {
  enabled: false,
  pollIntervalMinutes: 0.5,
};

function hasBridgeAutomationToken(token: string | null | undefined): boolean {
  return Boolean(token?.trim());
}

async function hasBridgeSessionAuth(): Promise<boolean> {
  const session = await getSession();
  if (!session?.tokens?.accessToken) return false;
  if (session.tokens.expiresAt <= Date.now() + 60_000) return false;
  return session.tokens.accessToken === COOKIE_SESSION_ACCESS_TOKEN;
}

export async function getBridgeConfig(): Promise<BridgeConfig> {
  try {
    const raw = await browser.storage.local.get(STORAGE_KEY);
    const stored = raw[STORAGE_KEY] as Partial<BridgeConfig> | undefined;
    if (!stored) return DEFAULT_CONFIG;

    const cleaned: Partial<BridgeConfig> = {};
    if (typeof stored.enabled === 'boolean') cleaned.enabled = stored.enabled;
    if (stored.pollIntervalMinutes) cleaned.pollIntervalMinutes = stored.pollIntervalMinutes;
    return { ...DEFAULT_CONFIG, ...cleaned };
  } catch (e) {
    log.warn('[BridgeClient] Failed to load config, using safe defaults', {
      reason: e instanceof Error ? e.message : String(e),
    });
    return DEFAULT_CONFIG;
  }
}

export async function saveBridgeConfig(config: Partial<BridgeConfig>): Promise<BridgeConfig> {
  const current = await getBridgeConfig();
  const updated = { ...current, ...config };
  await browser.storage.local.set({ [STORAGE_KEY]: updated });
  log.debug('[BridgeClient] Config saved', { enabled: updated.enabled });
  return updated;
}

/**
 * Check if bridge is ready (authenticated + enabled).
 */
export async function isBridgeReady(): Promise<boolean> {
  const config = await getBridgeConfig();
  if (!config.enabled) return false;
  const authConfig = await getAuthConfig();
  if (hasBridgeAutomationToken(authConfig.automationToken)) return true;
  return hasBridgeSessionAuth();
}

// ============================================================================
// HTTP CLIENT — delegates to authed-fetch (reads token from auth-store)
// ============================================================================

async function bridgeFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const authConfig = await getAuthConfig();
  const authed =
    hasBridgeAutomationToken(authConfig.automationToken) || (await hasBridgeSessionAuth());
  if (!authed) {
    throw new AuthRequiredError(BRIDGE_TOKEN_REQUIRED_MESSAGE);
  }
  return authedFetch<T>(path, options);
}

// ============================================================================
// PUBLIC API
// ============================================================================

export async function fetchPendingEntries(): Promise<BridgeEntry[]> {
  const res = await bridgeFetch<BridgeListResponse>('/api/emr/bridge?status=pending&limit=5');
  if (!res.ok) throw new Error(res.error || 'Failed to fetch pending entries');
  return res.items;
}

export async function fetchEntryDetail(id: string): Promise<BridgeEntryDetail> {
  const res = await bridgeFetch<BridgeDetailResponse>(`/api/emr/bridge/${id}`);
  if (!res.ok) throw new Error(res.error || 'Failed to fetch entry detail');
  return res.entry;
}

export async function claimEntry(id: string): Promise<void> {
  const res = await bridgeFetch<BridgePatchResponse>(`/api/emr/bridge/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ action: 'claim', claimedBy: 'assist-extension' }),
  });
  if (!res.ok) throw new Error(res.error || 'Failed to claim entry');
}

export async function reportProcessing(id: string): Promise<void> {
  await bridgeFetch<BridgePatchResponse>(`/api/emr/bridge/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ action: 'processing' }),
  });
}

export async function reportComplete(id: string, result: RMETransferResult): Promise<void> {
  await bridgeFetch<BridgePatchResponse>(`/api/emr/bridge/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ action: 'complete', result }),
  });
}

export async function reportFailed(
  id: string,
  error: string,
  result?: RMETransferResult
): Promise<void> {
  await bridgeFetch<BridgePatchResponse>(`/api/emr/bridge/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ action: 'fail', error, result }),
  });
}

// ============================================================================
// SEND TO DOCTOR — Outbound consult from Assist → Intelligence Dashboard
// ============================================================================

export interface OnlineDoctor {
  id: string;
  name: string;
  role: string;
  poli?: string;
  location_name?: string;
  room_name?: string;
  availability_status?: 'online' | 'busy' | 'away' | 'offline';
  last_seen_at?: string;
  /** Nama lengkap profesional dengan gelar (e.g. "dr. Ferdi Iskandar") */
  professional_name?: string;
  /** Nama lengkap non-gelar */
  full_name?: string;
}

interface OnlineDoctorsResponse {
  ok: boolean;
  doctors: OnlineDoctor[];
  error?: string;
}

export type CanonicalPregnancyStatus = 'hamil' | 'tidak_hamil' | 'tidak_relevan' | 'tidak_diisi';

export interface CanonicalTriageInput {
  request_id: string;
  request_time: string;
  source: {
    app: 'sentra-assist';
    app_version?: string;
    engine_mode: 'preview' | 'canonical';
  };
  patient: {
    patient_id: string;
    rm: string;
    name?: string;
    gender: 'L' | 'P';
    age: number;
    dob?: string;
    payer_label?: string;
    bpjs_status?: 'aktif' | 'nonaktif' | 'mandiri' | null;
    kelurahan?: string;
    facility_name?: string;
  };
  vitals: {
    sbp: number;
    dbp: number;
    hr: number;
    rr: number;
    temp: number;
    spo2: number;
    glucose?: {
      value: number;
      type: 'GDS';
    };
    avpu?: 'A' | 'C' | 'V' | 'P' | 'U';
    supplemental_o2?: boolean;
    pain_score?: number;
    has_copd?: boolean;
    weight_kg?: number;
    height_cm?: number;
    measurement_time?: string;
  };
  narrative: {
    symptom_text_raw: string;
    keluhan_utama: string;
    keluhan_tambahan?: string;
    autocomplete_summary?: string;
    autosen_preset?: string;
  };
  context: {
    chronic_diseases: string[];
    allergies: string[];
    pregnancy_status: CanonicalPregnancyStatus;
    pregnancy_risk?: string;
    special_conditions: string[];
    disability_type?: string;
    obesity_confirmation?: 'confirmed' | 'not_confirmed';
  };
  bedside_signs?: {
    structured_signs_text?: string;
    deterioration_summary_text?: string;
  };
  history?: {
    visits_used?: number;
    prefetched_visits?: Array<{
      encounter_id: string;
      timestamp: string;
      keluhan_utama: string;
      source: 'scrape';
      vitals: {
        sbp: number;
        dbp: number;
        hr: number;
        rr: number;
        temp: number;
        glucose: number;
        spo2: number;
      };
      diagnosa?: {
        icd_x: string;
        nama: string;
      };
    }>;
  };
}

export interface CanonicalClinicalEngineOutput {
  request_id: string;
  processed_at: string;
  source: {
    engine: 'dashboard-clinical-engine';
    engine_version: string;
    mode: 'canonical';
  };
  scoring: {
    news2?: {
      score: number;
      risk_level: 'low' | 'low-medium' | 'medium' | 'high';
      drivers: string[];
    };
    map?: {
      value: number;
      interpretation: string;
    };
    occult_shock?: {
      risk_level: 'low' | 'moderate' | 'high' | 'critical';
      suspected: boolean;
      reasoning: string[];
    };
  };
  alerts: Array<{
    id: string;
    family: 'red_flag' | 'news2' | 'early_warning' | 'trajectory' | 'governance';
    severity: 'emergency' | 'urgent' | 'warning' | 'info';
    title: string;
    message: string;
    action?: string;
    criteria_met?: string[];
  }>;
  early_warning_patterns?: Array<{
    id: string;
    label: string;
    severity: 'high' | 'medium' | 'low';
    reasoning: string[];
    recommendations: string[];
  }>;
  trajectory?: {
    available: boolean;
    visit_count: number;
    overall_trend?: 'improving' | 'declining' | 'stable' | 'insufficient_data';
    overall_risk?: 'low' | 'moderate' | 'high' | 'critical';
    momentum_level?: string;
    deterioration_state?: 'improving' | 'stable' | 'deteriorating' | 'critical';
    narrative?: string;
    recommendations?: Array<{
      category: 'improvement' | 'concern' | 'action' | 'monitoring';
      priority: 'high' | 'medium' | 'low';
      text: string;
    }>;
    raw_context?: {
      trajectory_context?: {
        momentumLevel: string;
        convergencePattern: string;
        convergenceScore: number;
        worseningParams: string[];
        isAccelerating: boolean;
        timeToCriticalDays: number | null;
        treatmentResponseNote: string;
        narrative: string;
        visitCount?: number;
      };
      deterioration_summary_text?: string;
    };
  };
  recommendations: {
    immediate_actions: string[];
    monitoring_actions: string[];
    referral_actions: string[];
    next_best_questions: string[];
  };
  governance: {
    disclaimer: string;
    review_required: boolean;
    authoritative_engine: 'dashboard';
  };
}

interface CanonicalEngineResponse {
  ok: boolean;
  data?: CanonicalClinicalEngineOutput;
  error?: string;
}

export interface CanonicalDifferentialInput {
  request_id: string;
  patient: {
    age: number;
    gender: 'L' | 'P';
  };
  narrative: {
    keluhan_utama: string;
    keluhan_tambahan?: string;
  };
  vitals: {
    sbp?: number;
    dbp?: number;
    hr?: number;
    rr?: number;
    temp?: number;
    spo2?: number;
    glucose?: number;
  };
  context?: {
    allergies?: string[];
    chronic_diseases?: string[];
    is_pregnant?: boolean;
  };
  canonical_clinical?: {
    trajectory_context?: NonNullable<
      NonNullable<CanonicalClinicalEngineOutput['trajectory']>['raw_context']
    >['trajectory_context'];
    deterioration_summary_text?: string;
  };
}

export interface CanonicalDifferentialOutput {
  diagnosis_suggestions: Array<{
    rank: number;
    icd_x: string;
    nama: string;
    diagnosis_name?: string;
    icd10_code?: string;
    confidence: number;
    rationale: string;
    reasoning?: string;
    red_flags?: string[];
    recommended_actions?: string[];
  }>;
  alerts: Array<{
    severity: 'emergency' | 'urgent' | 'warning';
    condition: string;
    action: string;
    criteria_met: string[];
    icd_codes?: string[];
  }>;
  validation_summary?: {
    total_raw: number;
    total_validated: number;
    unverified_codes: string[];
    warnings: string[];
  };
  meta: {
    processing_time_ms: number;
    source: 'dashboard-canonical-differential';
    model_version: string;
  };
}

interface CanonicalDifferentialResponse {
  ok: boolean;
  data?: CanonicalDifferentialOutput;
  error?: string;
}

interface ClinicalAnamnesisExtractionResponse {
  ok: boolean;
  data?: AnamnesisExtractionResult;
  error?: string;
}

const EXTRACTION_CIRCUIT_COOLDOWN_MS = 10 * 60 * 1000;
let extractionCircuitOpenUntilMs = 0;
let extractionCircuitReason = '';

/**
 * Contract artifact for CI/docs parity checks.
 * Keep this minimal and focused on required fields that must exist for safe rendering.
 */
export const CANONICAL_CLINICAL_ENGINE_OUTPUT_SCHEMA = {
  schema_version: '2026-04-08',
  type: 'object',
  required: ['request_id', 'processed_at', 'source', 'alerts', 'recommendations', 'governance'],
  properties: {
    request_id: { type: 'string' },
    processed_at: { type: 'string' },
    source: {
      type: 'object',
      required: ['engine', 'engine_version', 'mode'],
      properties: {
        engine: { const: 'dashboard-clinical-engine' },
        engine_version: { type: 'string' },
        mode: { const: 'canonical' },
      },
    },
    alerts: { type: 'array' },
    recommendations: {
      type: 'object',
      required: [
        'immediate_actions',
        'monitoring_actions',
        'referral_actions',
        'next_best_questions',
      ],
      properties: {
        immediate_actions: { type: 'array', items: { type: 'string' } },
        monitoring_actions: { type: 'array', items: { type: 'string' } },
        referral_actions: { type: 'array', items: { type: 'string' } },
        next_best_questions: { type: 'array', items: { type: 'string' } },
      },
    },
    governance: {
      type: 'object',
      required: ['disclaimer', 'review_required', 'authoritative_engine'],
      properties: {
        disclaimer: { type: 'string' },
        review_required: { type: 'boolean' },
        authoritative_engine: { const: 'dashboard' },
      },
    },
  },
} as const;

/**
 * Contract artifact for CI/docs parity checks.
 */
export const CANONICAL_DIFFERENTIAL_OUTPUT_SCHEMA = {
  schema_version: '2026-04-08',
  type: 'object',
  required: ['diagnosis_suggestions', 'alerts', 'meta'],
  properties: {
    diagnosis_suggestions: { type: 'array' },
    alerts: { type: 'array' },
    meta: {
      type: 'object',
      required: ['processing_time_ms', 'source', 'model_version'],
      properties: {
        processing_time_ms: { type: 'number' },
        source: { const: 'dashboard-canonical-differential' },
        model_version: { type: 'string' },
      },
    },
  },
} as const;

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function isAnamnesisMissingField(value: unknown): value is AnamnesisMissingField {
  return (
    value === 'keluhan_utama' ||
    value === 'onset' ||
    value === 'lokasi' ||
    value === 'kualitas' ||
    value === 'keparahan' ||
    value === 'faktor_pemicu' ||
    value === 'faktor_peredam'
  );
}

export function isAnamnesisExtractionResult(value: unknown): value is AnamnesisExtractionResult {
  const candidate = asRecord(value);
  if (!candidate) return false;
  if (typeof candidate.keluhan_utama !== 'string') return false;
  if (candidate.onset !== null && typeof candidate.onset !== 'string') return false;
  if (candidate.lokasi !== null && typeof candidate.lokasi !== 'string') return false;
  if (candidate.kualitas !== null && typeof candidate.kualitas !== 'string') return false;
  if (candidate.keparahan !== null && typeof candidate.keparahan !== 'number') return false;
  if (!isStringArray(candidate.faktor_pemicu)) return false;
  if (!isStringArray(candidate.faktor_peredam)) return false;
  if (
    candidate.chronology_summary !== undefined &&
    candidate.chronology_summary !== null &&
    typeof candidate.chronology_summary !== 'string'
  ) {
    return false;
  }
  if (
    candidate.associated_symptoms !== undefined &&
    !isStringArray(candidate.associated_symptoms)
  ) {
    return false;
  }
  if (
    candidate.pertinent_negatives !== undefined &&
    !isStringArray(candidate.pertinent_negatives)
  ) {
    return false;
  }
  if (
    candidate.functional_impact !== undefined &&
    candidate.functional_impact !== null &&
    typeof candidate.functional_impact !== 'string'
  ) {
    return false;
  }
  if (candidate.red_flag_signs !== undefined && !isStringArray(candidate.red_flag_signs)) {
    return false;
  }
  if (
    candidate.clinician_questions !== undefined &&
    !isStringArray(candidate.clinician_questions)
  ) {
    return false;
  }
  if (!Array.isArray(candidate.data_belum_lengkap)) return false;
  if (!candidate.data_belum_lengkap.every((item) => isAnamnesisMissingField(item))) return false;
  return true;
}

export function isCanonicalClinicalEngineOutput(
  value: unknown
): value is CanonicalClinicalEngineOutput {
  const candidate = asRecord(value);
  if (!candidate) return false;

  const source = asRecord(candidate.source);
  const alerts = candidate.alerts;
  const recommendations = asRecord(candidate.recommendations);
  const governance = asRecord(candidate.governance);

  if (typeof candidate.request_id !== 'string') return false;
  if (typeof candidate.processed_at !== 'string') return false;
  if (!source || typeof source.engine !== 'string') return false;
  if (!Array.isArray(alerts)) return false;
  if (!recommendations) return false;
  if (!governance) return false;

  if (!isStringArray(recommendations.immediate_actions)) return false;
  if (!isStringArray(recommendations.monitoring_actions)) return false;
  if (!isStringArray(recommendations.referral_actions)) return false;
  if (!isStringArray(recommendations.next_best_questions)) return false;

  if (typeof governance.disclaimer !== 'string') return false;
  if (typeof governance.review_required !== 'boolean') return false;

  return true;
}

export function isCanonicalDifferentialOutput(
  value: unknown
): value is CanonicalDifferentialOutput {
  const candidate = asRecord(value);
  if (!candidate) return false;

  const diagnosisSuggestions = candidate.diagnosis_suggestions;
  const alerts = candidate.alerts;
  const meta = asRecord(candidate.meta);

  if (!Array.isArray(diagnosisSuggestions)) return false;
  if (!Array.isArray(alerts)) return false;
  if (!meta) return false;
  if (typeof meta.processing_time_ms !== 'number') return false;
  if (typeof meta.source !== 'string') return false;
  if (typeof meta.model_version !== 'string') return false;

  return true;
}

export interface ConsultPayload {
  patient: {
    name: string;
    age: number;
    gender: string;
    rm: string;
    dob?: string;
    bpjsStatus?: string | null;
    kelurahan?: string;
  };
  ttv: {
    sbp: string;
    dbp: string;
    hr: string;
    rr: string;
    temp: string;
    spo2: string;
    glucose: string;
  };
  keluhan_utama: string;
  keluhan_tambahan?: string;
  risk_factors: string[];
  anthropometrics: {
    tinggi: number;
    berat: number;
    imt: number;
    hasil_imt: string;
    lingkar_perut: number;
  };
  penyakit_kronis: string[];
  alergi: string[];
  status_kehamilan: 'hamil' | 'tidak_hamil' | 'tidak_diisi';
  disability_type?: string;
  obesity_confirmation?: 'confirmed' | 'not_confirmed';
  clinical_context?: {
    facility_name?: string;
    special_conditions?: string[];
    pregnancy_risk?: string;
  };
  canonical_clinical?: {
    news2?: {
      score: number;
      risk_level: 'low' | 'low-medium' | 'medium' | 'high';
      drivers: string[];
    };
    trajectory?: {
      overall_trend?: 'improving' | 'declining' | 'stable' | 'insufficient_data';
      overall_risk?: 'low' | 'moderate' | 'high' | 'critical';
      deterioration_state?: 'improving' | 'stable' | 'deteriorating' | 'critical';
      narrative?: string;
    };
    immediate_actions?: string[];
  };
  /** AVPU consciousness level at time of consult */
  avpu?: 'A' | 'C' | 'V' | 'P' | 'U';
  /** Physical exam context derived from keluhan + TTV — keyed by organ system */
  physical_exam_context?: Record<string, string>;
  target_doctor_id: string;
  sent_at: string;
  /** UUID v4 generated by ASSIST before POST; used for audit idempotency */
  event_id?: string;
  screening_result?: {
    status: 'positive' | 'negative' | 'inconclusive';
    score?: number;
    risk_level?: 'low' | 'medium' | 'high' | 'critical';
    summary?: string;
  };
  /** Pseudonym token for patient (not raw RM) */
  patient_id_token?: string;
  screening_id?: string;
  facility_id?: string;
  app_version?: string;
  assist_id?: string;
}

interface ConsultResponse {
  ok: boolean;
  consultId?: string;
  event_id?: string;
  error?: string;
}

/** Hardcode fallback — displayed when DB returns empty or user is offline. */
const FALLBACK_DOCTORS: OnlineDoctor[] = [
  {
    id: 'fallback-ferdi',
    name: 'dr. Ferdi Iskandar',
    role: 'dokter',
    poli: 'Umum',
    availability_status: 'online',
  },
  {
    id: 'fallback-josep',
    name: 'dr. Josep Ariyanto S.Gz',
    role: 'dokter',
    poli: 'Gizi',
    availability_status: 'online',
  },
];

/**
 * Filters API doctor list for UI display:
 * 1. Only role === 'dokter'
 * 2. Prefer professional_name > full_name > name
 * 3. Exclude fallback IDs if real doctors present
 * 4. Deduplicate by normalized name
 */
export function filterDoctorsForDisplay(doctors: OnlineDoctor[]): OnlineDoctor[] {
  const onlyDokter = doctors.filter((d) => d.role === 'dokter');

  const withDisplayName = onlyDokter.map((d) => ({
    ...d,
    name: d.professional_name || d.full_name || d.name,
  }));

  const hasRealDoctors = withDisplayName.some((d) => !d.id.startsWith('fallback-'));
  const filtered = hasRealDoctors
    ? withDisplayName.filter((d) => !d.id.startsWith('fallback-'))
    : withDisplayName;

  const seen = new Set<string>();
  return filtered.filter((d) => {
    const key = d.name.trim().toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export async function getOnlineDoctors(): Promise<OnlineDoctor[]> {
  const authConfig = await getAuthConfig();
  const hasSessionAuth = await hasBridgeSessionAuth();

  // Without dashboard session or automation token, keep a safe placeholder list.
  if (!hasBridgeAutomationToken(authConfig.automationToken) && !hasSessionAuth) {
    return FALLBACK_DOCTORS;
  }

  // Authenticated — fetch real list. Throw on failure so callers can surface the error.
  const res = await bridgeFetch<OnlineDoctorsResponse>('/api/doctors/online');
  if (!res.ok) {
    throw new Error(res.error || 'Gagal memuat daftar dokter dari server.');
  }

  // Filter: only dokter role, professional names, deduplicate
  return filterDoctorsForDisplay(res.doctors);
}

export async function sendConsultToDoctor(
  payload: ConsultPayload
): Promise<{ consultId: string; eventId: string }> {
  const eventId = payload.event_id ?? crypto.randomUUID();
  const enrichedPayload: ConsultPayload = { ...payload, event_id: eventId };

  const doSend = () =>
    bridgeFetch<ConsultResponse>('/api/consult', {
      method: 'POST',
      body: JSON.stringify(enrichedPayload),
    });

  let res: ConsultResponse;
  try {
    res = await doSend();
  } catch (error) {
    const isRetryable =
      (error instanceof BridgeApiError && error.status === 503) ||
      (error instanceof Error && error.message.includes('Tidak dapat terhubung'));

    if (isRetryable) {
      log.warn('[BridgeClient] Consult send failed (retryable), retrying in 3s...');
      await new Promise<void>((r) => setTimeout(r, 3_000));
      res = await doSend();
    } else {
      throw error;
    }
  }

  if (!res.ok) throw new Error(res.error || 'Failed to send consult');

  return {
    consultId: res.consultId ?? '',
    eventId: res.event_id ?? eventId,
  };
}

export async function evaluateCanonicalClinicalEngine(
  payload: CanonicalTriageInput
): Promise<CanonicalClinicalEngineOutput> {
  const res = await bridgeFetch<CanonicalEngineResponse>('/api/clinical/engine/evaluate', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  if (!res.ok || !res.data) {
    throw new Error(res.error || 'Failed to evaluate canonical clinical engine');
  }
  if (!isCanonicalClinicalEngineOutput(res.data)) {
    throw new Error('Canonical clinical engine contract mismatch');
  }
  return res.data;
}

export async function evaluateCanonicalDifferential(
  payload: CanonicalDifferentialInput
): Promise<CanonicalDifferentialOutput> {
  const res = await bridgeFetch<CanonicalDifferentialResponse>(
    '/api/clinical/differential/evaluate',
    {
      method: 'POST',
      body: JSON.stringify(payload),
    }
  );
  if (!res.ok || !res.data) {
    throw new Error(res.error || 'Failed to evaluate canonical differential');
  }
  if (!isCanonicalDifferentialOutput(res.data)) {
    throw new Error('Canonical differential contract mismatch');
  }
  return res.data;
}

export async function extractClinicalAnamnesis(
  inputText: string
): Promise<AnamnesisExtractionResult> {
  const now = Date.now();
  if (extractionCircuitOpenUntilMs > now) {
    const remainingMinutes = Math.ceil((extractionCircuitOpenUntilMs - now) / 60_000);
    throw new Error(
      `Hybrid extraction backend nonaktif sementara (${remainingMinutes}m): ${extractionCircuitReason}`
    );
  }

  try {
    const res = await bridgeFetch<ClinicalAnamnesisExtractionResponse>(
      '/api/clinical/anamnesis/extract',
      {
        method: 'POST',
        body: JSON.stringify({ text: inputText }),
      }
    );
    if (!res.ok || !res.data) {
      throw new Error(res.error || 'Failed to extract clinical anamnesis');
    }
    if (!isAnamnesisExtractionResult(res.data)) {
      throw new Error('Clinical anamnesis extraction contract mismatch');
    }

    extractionCircuitOpenUntilMs = 0;
    extractionCircuitReason = '';
    return res.data;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown extraction error';
    const lowerMessage = message.toLowerCase();
    const shouldOpenCircuit =
      error instanceof BridgeResponseFormatError ||
      (error instanceof BridgeApiError &&
        [404, 405, 406, 415, 500, 501, 502, 503].includes(error.status)) ||
      lowerMessage.includes('html') ||
      lowerMessage.includes('base url bridge');

    if (shouldOpenCircuit) {
      extractionCircuitOpenUntilMs = Date.now() + EXTRACTION_CIRCUIT_COOLDOWN_MS;
      extractionCircuitReason =
        'Endpoint extraction tidak tersedia pada base URL saat ini (server membalas non-API/HTML).';
      log.warn('[BridgeClient] Extraction circuit opened', {
        cooldownMs: EXTRACTION_CIRCUIT_COOLDOWN_MS,
        reason: extractionCircuitReason,
      });
      throw new Error(`${extractionCircuitReason} Retry otomatis dalam 10 menit.`);
    }

    throw error;
  }
}

// ============================================================================
// PATIENT SYNC — Send scraped data from Ghost → Dashboard EMR page
// ============================================================================

interface PatientSyncResponse {
  ok: boolean;
  id?: string;
  error?: string;
}

export interface PatientSyncResult {
  ok: boolean;
  id?: string;
  error?: string;
}

/**
 * Send scraped patient data from Assist to Dashboard EMR page.
 * Retries up to 3 times on retryable errors (503, network failure).
 * Dashboard receives via POST /api/emr/patient-sync → Socket.IO → EMR form auto-fill.
 */
export async function syncPatientToDashboard(
  payload: PatientSyncPayload
): Promise<PatientSyncResult> {
  const doSync = () =>
    bridgeFetch<PatientSyncResponse>('/api/emr/patient-sync', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

  const MAX_RETRIES = 3;
  const RETRY_DELAY_MS = 3_000;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await doSync();
      if (!res.ok) {
        return { ok: false, error: res.error || 'Dashboard menolak data pasien' };
      }
      log.debug('[BridgeClient] Patient synced to Dashboard:', res.id);
      return { ok: true, id: res.id ?? '' };
    } catch (error) {
      const isRetryable =
        (error instanceof BridgeApiError && error.status === 503) ||
        (error instanceof Error && error.message.includes('Tidak dapat terhubung'));

      if (isRetryable && attempt < MAX_RETRIES) {
        log.warn(
          `[BridgeClient] Patient sync attempt ${attempt}/${MAX_RETRIES} failed (retryable), retrying in ${RETRY_DELAY_MS / 1000}s...`
        );
        await new Promise<void>((r) => setTimeout(r, RETRY_DELAY_MS));
        continue;
      }

      const message = error instanceof Error ? error.message : 'Unknown sync error';
      log.error(`[BridgeClient] Patient sync failed after ${attempt} attempt(s):`, message);
      return { ok: false, error: message };
    }
  }

  return { ok: false, error: 'Sync gagal setelah 3 percobaan' };
}
