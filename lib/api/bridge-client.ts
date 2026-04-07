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
import type { RMETransferPayload, RMETransferResult } from '~/utils/types';
import type { PatientSyncPayload } from './patient-sync-payload';
import { authedFetch, AuthRequiredError } from './authed-fetch';
import { isAuthenticated } from './auth-store';

const log = createLogger('BridgeClient', 'background');

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
  return isAuthenticated();
}

// ============================================================================
// HTTP CLIENT — delegates to authed-fetch (reads token from auth-store)
// ============================================================================

async function bridgeFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const authed = await isAuthenticated();
  if (!authed) {
    throw new AuthRequiredError('Belum login. Silakan login terlebih dahulu.');
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
}

interface OnlineDoctorsResponse {
  ok: boolean;
  doctors: OnlineDoctor[];
  error?: string;
}

export type CanonicalPregnancyStatus =
  | 'hamil'
  | 'tidak_hamil'
  | 'tidak_relevan'
  | 'tidak_diisi';

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
  target_doctor_id: string;
  sent_at: string;
}

interface ConsultResponse {
  ok: boolean;
  consultId?: string;
  error?: string;
}

export async function getOnlineDoctors(): Promise<OnlineDoctor[]> {
  const res = await bridgeFetch<OnlineDoctorsResponse>('/api/doctors/online');
  if (!res.ok) throw new Error(res.error || 'Failed to fetch online doctors');
  return res.doctors;
}

export async function sendConsultToDoctor(payload: ConsultPayload): Promise<string> {
  const res = await bridgeFetch<ConsultResponse>('/api/consult', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(res.error || 'Failed to send consult');
  return res.consultId ?? '';
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
  return res.data;
}

export async function evaluateCanonicalDifferential(
  payload: CanonicalDifferentialInput
): Promise<CanonicalDifferentialOutput> {
  const res = await bridgeFetch<CanonicalDifferentialResponse>('/api/clinical/differential/evaluate', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  if (!res.ok || !res.data) {
    throw new Error(res.error || 'Failed to evaluate canonical differential');
  }
  return res.data;
}

// ============================================================================
// PATIENT SYNC — Send scraped data from Ghost → Dashboard EMR page
// ============================================================================

interface PatientSyncResponse {
  ok: boolean;
  id?: string;
  error?: string;
}

/**
 * Send scraped patient data from Ghost to Dashboard EMR page.
 * Dashboard receives via POST /api/emr/patient-sync → Socket.IO → EMR form auto-fill.
 */
export async function syncPatientToDashboard(payload: PatientSyncPayload): Promise<string> {
  const res = await bridgeFetch<PatientSyncResponse>('/api/emr/patient-sync', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(res.error || 'Failed to sync patient data to Dashboard');
  log.debug('[BridgeClient] Patient synced to Dashboard:', res.id);
  return res.id ?? '';
}
