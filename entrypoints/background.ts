// Designed and constructed by Claudesy.
/**
 * Precision-Architected. Future-Built by Docsyanpse
 * Sentra Healthcare Artificial Intelligence
 */

// Service Worker (Background Script)
// Based on SENTRA-SPEC-001 v1.2.0 Section 4.3
// Handles: message routing, state management, side panel site-lock, CDSS API routing

import { AUTH_STORE_KEYS } from '@/lib/api/auth-store';
import { syncPatientToDashboard } from '@/lib/api/bridge-client';
import {
  registerBridgeExecutor,
  startBridgePoller,
  stopBridgePoller,
} from '@/lib/api/bridge-poller';
import { buildPatientSyncPayload } from '@/lib/api/patient-sync-payload';
import { SentraAPI } from '@/lib/api/sentra-api';
import { getCDSSEngineStatus, initCDSSEngine } from '@/lib/iskandar-diagnosis-engine';
import { runGetSuggestionsFlow } from '@/lib/iskandar-diagnosis-engine/get-suggestions-flow';
import { RMETransferOrchestrator } from '@/lib/rme/transfer-orchestrator';
import { auditService } from '@/lib/api/audit-service';
import type {
  AllergyCheckRequest,
  DiagnosisRequestContext,
  PediatricDoseRequest,
  PrescriptionRequestContext,
} from '@/types/api';
import { createLogger } from '~/utils/logger';
import {
  classifyTabMessageError,
  MESSAGE_TIMEOUTS,
  onMessage,
  parseAnamnesaData,
  parseDiagnosaData,
  parseResepData,
  sendMessage,
  sendMessageToTabWithTimeout,
} from '~/utils/messaging';
import {
  createEmptyEncounter,
  getEncounter,
  saveEncounter,
  updateEncounter,
} from '~/utils/storage';
import type {
  Encounter,
  FillResult,
  PageReadyInfo,
  RMETransferPayload,
  RMETransferProgressEvent,
  RMETransferStepResult,
  RMETransferStepStatus,
  ScrapePayload,
} from '~/utils/types';

const bgLog = createLogger('Background', 'background');
const riwayatLog = createLogger('BG:scanVisitHistory', 'riwayat');

bgLog.debug('worker boot marker', {
  version: '1.0.5',
  build: '2026-03-16 bridge-poller-wired',
});
const transferLog = createLogger('BG:RMETransfer', 'background');
const rmeTransferOrchestrator = new RMETransferOrchestrator();

type ScanFieldsResponse = {
  success: boolean;
  error?: string;
  fields: Array<{
    tag: string;
    type: string;
    name: string;
    id: string;
    placeholder: string;
    className: string;
  }>;
};

type ScanMedicalHistoryResponse = {
  success: boolean;
  error?: string;
  history: Array<{
    code: string;
    description: string;
    shortLabel: string;
  }>;
};

type ScanVisitHistoryResponse = {
  success: boolean;
  error?: string;
  diagnostics?: string[];
  visits: Array<{
    encounter_id: string;
    date: string;
    vitals: {
      sbp: number;
      dbp: number;
      hr: number;
      rr: number;
      temp: number;
      glucose: number;
    };
    keluhan_utama: string;
    diagnosa: { icd_x: string; nama: string } | null;
  }>;
};

type TenagaMedisSnapshot = {
  dokterNama: string;
  perawatNama: string;
  source: string[];
  capturedAt: string;
};

type ResolveTenagaMedisResponse = {
  success: boolean;
  error?: string;
  tenagaMedis?: TenagaMedisSnapshot;
};

const TENAGA_MEDIS_CACHE_KEY = 'sentra:tenaga-medis-cache';
const DIRECT_PATIENT_SYNC_CACHE_KEY = 'sentra:patient-sync:last-direct';
const DIRECT_PATIENT_SYNC_WINDOW_MS = 2 * 60 * 1000;

function normalizeTenagaMedisName(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value.replace(/\s+/g, ' ').trim();
}

function hasTenagaMedisValue(snapshot: Partial<TenagaMedisSnapshot> | null | undefined): boolean {
  if (!snapshot) return false;
  return Boolean(
    normalizeTenagaMedisName(snapshot.dokterNama) || normalizeTenagaMedisName(snapshot.perawatNama)
  );
}

async function readTenagaMedisCache(): Promise<TenagaMedisSnapshot | null> {
  try {
    const raw = await browser.storage.local.get(TENAGA_MEDIS_CACHE_KEY);
    const cached = raw[TENAGA_MEDIS_CACHE_KEY] as Partial<TenagaMedisSnapshot> | undefined;
    if (!hasTenagaMedisValue(cached)) return null;
    return {
      dokterNama: normalizeTenagaMedisName(cached?.dokterNama),
      perawatNama: normalizeTenagaMedisName(cached?.perawatNama),
      source: Array.isArray(cached?.source)
        ? cached!.source.filter((item): item is string => typeof item === 'string')
        : ['cache'],
      capturedAt:
        typeof cached?.capturedAt === 'string' && cached.capturedAt
          ? cached.capturedAt
          : new Date().toISOString(),
    };
  } catch (error) {
    transferLog.warn('Failed to read tenaga medis cache', error);
    return null;
  }
}

type RecentPatientSyncSnapshot = {
  rm: string;
  syncedAt: string;
};

async function readRecentDirectPatientSync(): Promise<RecentPatientSyncSnapshot | null> {
  try {
    const raw = await browser.storage.local.get(DIRECT_PATIENT_SYNC_CACHE_KEY);
    const cached = raw[DIRECT_PATIENT_SYNC_CACHE_KEY] as
      | Partial<RecentPatientSyncSnapshot>
      | undefined;
    if (!cached?.rm || !cached?.syncedAt) return null;
    return {
      rm: String(cached.rm).trim(),
      syncedAt: String(cached.syncedAt),
    };
  } catch (error) {
    bgLog.debug('Failed to read recent direct patient sync cache', error);
    return null;
  }
}

function hasRecentDirectPatientSync(
  snapshot: RecentPatientSyncSnapshot | null,
  patientRm: string | undefined
): boolean {
  if (!snapshot || !patientRm) return false;
  if (snapshot.rm !== patientRm.trim()) return false;

  const syncedAt = Date.parse(snapshot.syncedAt);
  if (Number.isNaN(syncedAt)) return false;
  return Date.now() - syncedAt <= DIRECT_PATIENT_SYNC_WINDOW_MS;
}

async function writeTenagaMedisCache(snapshot: TenagaMedisSnapshot): Promise<void> {
  try {
    await browser.storage.local.set({ [TENAGA_MEDIS_CACHE_KEY]: snapshot });
  } catch (error) {
    transferLog.warn('Failed to write tenaga medis cache', error);
  }
}

async function resolveTenagaMedisForTab(tabId: number): Promise<TenagaMedisSnapshot | null> {
  const request = { type: 'resolveTenagaMedis' } as const;

  try {
    const response = await sendMessageToTabWithTimeout<ResolveTenagaMedisResponse>(
      tabId,
      request,
      3000
    );
    const live = response?.tenagaMedis;
    if (hasTenagaMedisValue(live)) {
      const snapshot: TenagaMedisSnapshot = {
        dokterNama: normalizeTenagaMedisName(live?.dokterNama),
        perawatNama: normalizeTenagaMedisName(live?.perawatNama),
        source: Array.isArray(live?.source) ? live!.source : ['live'],
        capturedAt:
          typeof live?.capturedAt === 'string' && live.capturedAt
            ? live.capturedAt
            : new Date().toISOString(),
      };
      await writeTenagaMedisCache(snapshot);
      return snapshot;
    }
  } catch (error) {
    if (classifyTabMessageError(error) === 'NO_RECEIVER') {
      const injected = await tryInjectContentScripts(tabId);
      if (injected) {
        try {
          const retry = await sendMessageToTabWithTimeout<ResolveTenagaMedisResponse>(
            tabId,
            request,
            3000
          );
          const live = retry?.tenagaMedis;
          if (hasTenagaMedisValue(live)) {
            const snapshot: TenagaMedisSnapshot = {
              dokterNama: normalizeTenagaMedisName(live?.dokterNama),
              perawatNama: normalizeTenagaMedisName(live?.perawatNama),
              source: Array.isArray(live?.source) ? live!.source : ['live-retry'],
              capturedAt:
                typeof live?.capturedAt === 'string' && live.capturedAt
                  ? live.capturedAt
                  : new Date().toISOString(),
            };
            await writeTenagaMedisCache(snapshot);
            return snapshot;
          }
        } catch (retryError) {
          transferLog.debug('resolveTenagaMedis retry failed', retryError);
        }
      }
    } else {
      transferLog.debug('resolveTenagaMedis live fetch failed', error);
    }
  }

  return readTenagaMedisCache();
}

async function hydrateTenagaMedisPayload<TStep extends RMETransferStepStatus>(
  step: TStep,
  payload: RMETransferStepPayload[TStep],
  tabId: number
): Promise<RMETransferStepPayload[TStep]> {
  if (step !== 'anamnesa' && step !== 'resep') {
    return payload;
  }

  const resolved = await resolveTenagaMedisForTab(tabId);
  if (!resolved) {
    return payload;
  }

  if (step === 'anamnesa') {
    const anamnesaPayload = payload as NonNullable<RMETransferPayload['anamnesa']>;
    const dokterNama =
      normalizeTenagaMedisName(anamnesaPayload.tenaga_medis?.dokter_nama) || resolved.dokterNama;
    const perawatNama =
      normalizeTenagaMedisName(anamnesaPayload.tenaga_medis?.perawat_nama) || resolved.perawatNama;

    if (!dokterNama && !perawatNama) {
      return payload;
    }

    return {
      ...anamnesaPayload,
      tenaga_medis: {
        dokter_nama: dokterNama,
        perawat_nama: perawatNama,
      },
    } as RMETransferStepPayload[TStep];
  }

  const resepPayload = payload as NonNullable<RMETransferPayload['resep']>;
  const dokterNama = normalizeTenagaMedisName(resepPayload.ajax?.dokter) || resolved.dokterNama;
  const perawatNama = normalizeTenagaMedisName(resepPayload.ajax?.perawat) || resolved.perawatNama;

  if (!dokterNama && !perawatNama) {
    return payload;
  }

  return {
    ...resepPayload,
    ajax: {
      ...resepPayload.ajax,
      dokter: dokterNama,
      perawat: perawatNama,
    },
  } as RMETransferStepPayload[TStep];
}

function toTabCommunicationError(error: unknown, fallbackMessage: string): string {
  const kind = classifyTabMessageError(error);
  if (kind === 'TIMEOUT') {
    return 'Waktu habis menunggu respons dari halaman ePuskesmas.';
  }
  if (kind === 'NO_RECEIVER') {
    return 'Halaman ePuskesmas belum siap. Muat ulang halaman lalu coba lagi.';
  }
  if (kind === 'TAB_CLOSED') {
    return 'Tab ePuskesmas tidak tersedia. Buka ulang halaman dan ulangi aksi.';
  }
  return fallbackMessage;
}

type RMETransferStepPayload = {
  anamnesa: NonNullable<RMETransferPayload['anamnesa']>;
  diagnosa: NonNullable<RMETransferPayload['diagnosa']>;
  resep: NonNullable<RMETransferPayload['resep']>;
};

async function safeAuditLog(action: string, context: unknown, outcome: unknown): Promise<void> {
  try {
    await auditService.log({
      actor: 'SYSTEM_INTERNAL',
      action,
      context,
      outcome,
    });
  } catch (error) {
    transferLog.warn('Audit log write failed', error);
  }
}

async function broadcastTransferProgress(event: RMETransferProgressEvent): Promise<void> {
  try {
    await browser.runtime.sendMessage({ type: 'RME_TRANSFER_PROGRESS', data: event });
  } catch {
    // Side panel may be closed; non-blocking by design.
  }
}

async function resolveTransferTabId(): Promise<number | undefined> {
  const activeTabs = await browser.tabs.query({ active: true, currentWindow: true });
  if (activeTabs[0]?.id && activeTabs[0]?.url?.includes('epuskesmas.id')) {
    return activeTabs[0].id;
  }

  const epuskesmasTabs = await browser.tabs.query({ url: '*://*.epuskesmas.id/*' });
  if (epuskesmasTabs[0]?.id) {
    return epuskesmasTabs[0].id;
  }

  return activeTabs[0]?.id;
}

const STEP_URL_ALIASES: Record<RMETransferStepStatus, string[]> = {
  anamnesa: ['anamnesa', 'anamnesis', 'soap'],
  diagnosa: ['diagnosa', 'diagnosis', 'icd10', 'icd-10'],
  resep: ['resep', 'terapi', 'obat', 'prescription'],
};

const STEP_DOM_HINTS: Record<RMETransferStepStatus, string[]> = {
  anamnesa: [
    'anamnesa[',
    'keluhan_utama',
    'keluhan_tambahan',
    'periksafisik[',
    'malergipasien[',
    'mriwayatpasien[',
  ],
  diagnosa: [
    'diagnosa_id',
    'diagnosa_nama',
    'diagnosa_jenis',
    'diagnosa_kasus',
    'prognosa',
    'ambil_diagnosa_bpjs',
  ],
  resep: [
    'no_resep',
    'obat_nama',
    'obat_signa',
    'aturan_pakai',
    'obat_jumlah',
    'obat_jumlah_permintaan',
    'resepdetail[',
    'prioritas',
    'dokter_nama_bpjs',
    'perawat_nama',
    'ruangan',
  ],
};

function isStepUrl(url: string, step: RMETransferStepStatus): boolean {
  const normalized = url.toLowerCase();
  return STEP_URL_ALIASES[step].some(
    (alias) =>
      normalized.includes(`/${alias}/`) ||
      normalized.includes(`/${alias}?`) ||
      normalized.endsWith(`/${alias}`)
  );
}

function isStepPageType(pageType: string | null | undefined, step: RMETransferStepStatus): boolean {
  if (!pageType) return false;
  const normalized = pageType.toLowerCase();
  if (step === 'anamnesa') return normalized === 'anamnesa' || normalized === 'soap';
  return normalized === step;
}

function fieldProbeToken(field: {
  tag?: string;
  type?: string;
  name?: string;
  id?: string;
  className?: string;
  placeholder?: string;
}): string {
  return `${field.tag || ''} ${field.type || ''} ${field.name || ''} ${field.id || ''} ${field.className || ''} ${field.placeholder || ''}`
    .toLowerCase()
    .trim();
}

function isStepDomReady(
  fields: ScanFieldsResponse['fields'],
  step: RMETransferStepStatus
): boolean {
  const hints = STEP_DOM_HINTS[step];
  let hitCount = 0;

  for (const field of fields) {
    const token = fieldProbeToken(field);
    if (!token) continue;
    if (hints.some((hint) => token.includes(hint))) {
      hitCount += 1;
      if (hitCount >= 1) return true;
    }
  }

  return false;
}

interface TransferPageProbe {
  pageType: string | null;
  url: string;
}

async function probeTransferPage(tabId: number, allowInject: boolean): Promise<TransferPageProbe> {
  const currentTab = await browser.tabs.get(tabId);
  const fallback: TransferPageProbe = {
    pageType: null,
    url: currentTab.url || '',
  };

  try {
    const response = await sendMessageToTabWithTimeout<{
      pageType?: unknown;
      url?: unknown;
    }>(tabId, { type: 'getCurrentPageType' }, 2500);

    return {
      pageType:
        typeof response?.pageType === 'string' && response.pageType.trim()
          ? response.pageType.trim().toLowerCase()
          : null,
      url: typeof response?.url === 'string' && response.url ? response.url : fallback.url,
    };
  } catch (error) {
    if (allowInject && classifyTabMessageError(error) === 'NO_RECEIVER') {
      const injected = await tryInjectContentScripts(tabId);
      if (injected) {
        return probeTransferPage(tabId, false);
      }
    }
    return fallback;
  }
}

async function probeTransferStepDom(
  tabId: number,
  step: RMETransferStepStatus,
  allowInject: boolean
): Promise<boolean> {
  try {
    const scan = await sendMessageToTabWithTimeout<ScanFieldsResponse>(
      tabId,
      { type: 'scanFields' },
      3000
    );
    if (!scan?.success || !Array.isArray(scan.fields)) return false;
    return isStepDomReady(scan.fields, step);
  } catch (error) {
    if (allowInject && classifyTabMessageError(error) === 'NO_RECEIVER') {
      const injected = await tryInjectContentScripts(tabId);
      if (injected) {
        return probeTransferStepDom(tabId, step, false);
      }
    }
    return false;
  }
}

function isStepContextReady(context: TransferPageProbe, step: RMETransferStepStatus): boolean {
  return isStepPageType(context.pageType, step) || isStepUrl(context.url, step);
}

function resolveStartStepFromContext(context: TransferPageProbe): RMETransferStepStatus {
  if (isStepContextReady(context, 'resep')) return 'resep';
  if (isStepContextReady(context, 'diagnosa')) return 'diagnosa';
  return 'anamnesa';
}

async function ensureTransferStepPage(tabId: number, step: RMETransferStepStatus): Promise<void> {
  const initial = await probeTransferPage(tabId, true);
  if (!initial.url.includes('epuskesmas.id')) return;
  if (isStepContextReady(initial, step)) return;

  const domReady = await probeTransferStepDom(tabId, step, true);
  if (domReady) {
    transferLog.debug('Step readiness resolved by DOM probe', {
      step,
      pageType: initial.pageType || 'unknown',
      url: initial.url,
    });
    return;
  }

  const activePage = initial.pageType || 'unknown';
  throw new Error(
    `Halaman ${step} belum siap. Halaman aktif: ${activePage}. Buka halaman ${step} lalu klik Uplink ${step} lagi.`
  );
}

async function executeRMEFillStep<TStep extends RMETransferStepStatus>(
  step: TStep,
  payload: RMETransferStepPayload[TStep]
): Promise<unknown> {
  transferLog.debug('executeRMEFillStep called', { step });

  const tabId = await resolveTransferTabId();
  transferLog.debug('transfer tab resolved', { hasTabId: Boolean(tabId) });

  if (!tabId) {
    throw new Error('No active tab');
  }

  const hydratedPayload = await hydrateTenagaMedisPayload(step, payload, tabId);

  await ensureTransferStepPage(tabId, step);
  transferLog.debug('transfer step page ready', { step, tabId });

  const fillMessage = {
    type: 'execFill',
    data: {
      type: step,
      encounter: hydratedPayload,
    },
  } as const;
  const timeout = step === 'anamnesa' ? 45000 : step === 'resep' ? 30000 : 18000;

  transferLog.debug('sending transfer fill message', { step, tabId, timeout });

  try {
    const result = await sendMessageToTabWithTimeout<unknown>(tabId, fillMessage, timeout);
    transferLog.debug('transfer fill result received', { step, tabId });
    return result;
  } catch (error) {
    transferLog.error('transfer fill error', { step, tabId, error });
    if (classifyTabMessageError(error) === 'NO_RECEIVER') {
      transferLog.warn('NO_RECEIVER during transfer fill, attempting inject', {
        step,
        tabId,
      });
      const injected = await tryInjectContentScripts(tabId);
      transferLog.debug('transfer fill inject result', { step, tabId, injected });
      if (injected) {
        return sendMessageToTabWithTimeout<unknown>(tabId, fillMessage, timeout);
      }
    }
    throw error;
  }
}

// =============================================================================
// SIDE PANEL HELPER
// Chrome's sidePanel API is not in webextension-polyfill
// Access it directly from chrome/browser object with fallback
// =============================================================================
interface SidePanelAPI {
  setPanelBehavior: (options: { openPanelOnActionClick: boolean }) => Promise<void>;
}

interface BrowserGlobalWithSidePanel {
  sidePanel?: SidePanelAPI;
  scripting?: {
    executeScript: (options: {
      target: { tabId: number };
      world?: 'MAIN' | 'ISOLATED';
      func?: (...args: unknown[]) => void;
      args?: unknown[];
      files?: string[];
    }) => Promise<unknown>;
  };
}

function getSidePanel(): SidePanelAPI | undefined {
  const chromeGlobal = (globalThis as { chrome?: BrowserGlobalWithSidePanel }).chrome;
  const browserGlobal = (globalThis as { browser?: BrowserGlobalWithSidePanel }).browser;
  return chromeGlobal?.sidePanel || browserGlobal?.sidePanel;
}

async function tryInjectContentScripts(
  tabId: number,
  diag?: (msg: string) => void
): Promise<boolean> {
  const chromeGlobal = (globalThis as { chrome?: BrowserGlobalWithSidePanel }).chrome;
  if (!chromeGlobal?.scripting?.executeScript) {
    diag?.('INJECT_SKIP: chrome.scripting unavailable');
    return false;
  }

  try {
    await chromeGlobal.scripting.executeScript({
      target: { tabId },
      files: ['content-scripts/content.js'],
      world: 'ISOLATED',
    });
    await chromeGlobal.scripting.executeScript({
      target: { tabId },
      files: ['content-scripts/inject.js'],
      world: 'MAIN',
    });
    // Give runtime listener a moment to register before retry.
    await new Promise((resolve) => setTimeout(resolve, 250));
    diag?.(`INJECT_OK: tab=${tabId}`);
    return true;
  } catch (error) {
    diag?.(`INJECT_FAIL: ${error instanceof Error ? error.message : String(error)}`);
    return false;
  }
}

// Audio playback helper for icon click
const OPENING_SOUND_URL = '/assets/sounds/opening.mp3';

function playOpeningSound(): void {
  try {
    const audio = new Audio(OPENING_SOUND_URL);
    audio.volume = 0.7;
    audio.play().catch((err) => {
      // Audio play failed (likely due to user interaction not yet triggered)
      bgLog.debug('Audio play skipped:', err.message);
    });
  } catch (error) {
    bgLog.debug('Audio creation failed:', error);
  }
}

export default defineBackground(() => {
  bgLog.debug('Sentra Assist service worker initialized');

  // ========================================
  // Icon Click Sound Effect
  // ========================================
  browser.action?.onClicked?.addListener(() => {
    playOpeningSound();
  });

  // Note: Sound is also played by login popup when it opens
  // SidePanel doesn't have onOpened event in MV3, so we rely on the popup

  // ========================================
  // CDSS Engine Initialization
  // ========================================

  // Initialize CDSS engine (async, non-blocking)
  initCDSSEngine()
    .then((ready) => {
      bgLog.debug('CDSS Engine initialized:', ready ? 'SUCCESS' : 'FAILED');
    })
    .catch((error) => {
      bgLog.error('CDSS Engine initialization error:', error);
    });

  // ========================================
  // Bridge Poller — Dashboard ↔ Assist Transfer
  // ========================================

  // Register RME transfer executor so bridge-poller can auto-fill ePuskesmas
  registerBridgeExecutor(async (_entryId, _pelayananId, payload) => {
    bgLog.debug(`Bridge transfer: ${_entryId} (pelayanan: ${_pelayananId})`);
    return rmeTransferOrchestrator.run(payload, executeRMEFillStep, {
      timeoutMs: { anamnesa: 45000, diagnosa: 18000, resep: 30000 },
      retryByStep: { anamnesa: 1, diagnosa: 1, resep: 1 },
    });
  });

  // Start polling dashboard for pending transfers
  startBridgePoller()
    .then(() => bgLog.debug('Bridge poller started'))
    .catch((err) => bgLog.error('Bridge poller failed to start:', err));

  // ========================================
  // Auth State Listener — auto-start/stop bridge on login/logout
  // ========================================
  browser.storage.onChanged.addListener((changes, area) => {
    const sessionChanged =
      (area === 'session' && AUTH_STORE_KEYS.session in changes) ||
      (area === 'local' && AUTH_STORE_KEYS.persisted in changes);

    if (!sessionChanged) return;

    const key = area === 'session' ? AUTH_STORE_KEYS.session : AUTH_STORE_KEYS.persisted;
    const newValue = changes[key]?.newValue as { tokens?: { accessToken?: string } } | undefined;

    if (newValue?.tokens?.accessToken) {
      bgLog.debug('Auth session detected — starting bridge poller');
      startBridgePoller().catch((err) =>
        bgLog.error('Bridge poller restart failed:', err)
      );
    } else {
      bgLog.debug('Auth session cleared — stopping bridge poller');
      stopBridgePoller().catch((err) =>
        bgLog.error('Bridge poller stop failed:', err)
      );
    }
  });

  // Handle AUTH_STATE_CHANGED message from login popup
  browser.runtime.onMessage.addListener((message) => {
    if (message?.type === 'AUTH_STATE_CHANGED') {
      bgLog.debug('AUTH_STATE_CHANGED received — restarting bridge poller');
      startBridgePoller().catch((err) =>
        bgLog.error('Bridge poller restart failed:', err)
      );
    }
  });

  // ========================================
  // Side Panel Setup - SIMPLIFIED FOR DEBUG
  // ========================================
  const sidePanel = getSidePanel();
  bgLog.debug('sidePanel object:', sidePanel);

  bgLog.debug(
    'chrome object:',
    typeof (globalThis as { chrome?: BrowserGlobalWithSidePanel }).chrome !== 'undefined'
      ? 'exists'
      : 'undefined'
  );

  if (sidePanel?.setPanelBehavior) {
    sidePanel
      .setPanelBehavior({ openPanelOnActionClick: true })
      .then(() => bgLog.debug('setPanelBehavior SUCCESS'))
      .catch((e: unknown) => bgLog.error('setPanelBehavior FAILED:', e));
  } else {
    bgLog.error('sidePanel API not available');
    bgLog.error(
      'globalThis.chrome?.sidePanel:',
      (globalThis as { chrome?: BrowserGlobalWithSidePanel }).chrome?.sidePanel
    );
    bgLog.error(
      'globalThis.browser?.sidePanel:',
      (globalThis as { browser?: BrowserGlobalWithSidePanel }).browser?.sidePanel
    );
  }

  // ========================================
  // Message Handlers
  // ========================================

  // Content → Worker: Page ready notification
  onMessage('pageReady', async (message) => {
    // Extract data from message - @webext-core/messaging passes data directly
    const info = message.data as PageReadyInfo;
    bgLog.debug('Page ready:', info);

    // Load or create encounter for this pelayanan_id
    if (info.pelayananId) {
      let encounter = await getEncounter();

      // Create new encounter if pelayanan_id changed
      if (!encounter || encounter.id !== info.pelayananId) {
        bgLog.debug('Creating new encounter:', info.pelayananId);
        encounter = createEmptyEncounter(info.pelayananId, 'PATIENT_TBD');
        await saveEncounter(encounter);
      }
    }

    try {
      await sendMessage('pageReady', info);
    } catch (error) {
      bgLog.warn('Failed to forward pageReady to panel:', error);
    }
  });

  // Content → Worker: Scrape result
  onMessage('scrapeResult', async (message) => {
    // Extract data from message
    const scrapeData = message.data as ScrapePayload;
    bgLog.debug('Scrape result received:', scrapeData);

    const encounter = await getEncounter();
    if (!encounter) {
      bgLog.warn('No encounter to update');
      return;
    }

    // Merge scraped data into encounter
    const updated: Partial<Encounter> = {};

    if (scrapeData.pageType === 'anamnesa' && scrapeData.data) {
      const parsed = parseAnamnesaData(scrapeData.data);
      if (parsed.ok && parsed.value) {
        updated.anamnesa = parsed.value;
      } else {
        bgLog.warn('Rejected anamnesa scrape payload', { reasons: parsed.reasons });
      }

      // Note: vital_signs and patient_demographics are passed through scrapeData.data
      // and read directly in syncPatientToDashboard below (not stored in Encounter)
    } else if (scrapeData.pageType === 'diagnosa' && scrapeData.data) {
      const parsed = parseDiagnosaData(scrapeData.data);
      if (parsed.ok && parsed.value) {
        updated.diagnosa = parsed.value;
      } else {
        bgLog.warn('Rejected diagnosa scrape payload', { reasons: parsed.reasons });
      }
    } else if (scrapeData.pageType === 'resep' && scrapeData.data) {
      const parsed = parseResepData(scrapeData.data);
      if (parsed.ok && parsed.value) {
        updated.resep = parsed.value;
        if (parsed.reasons.length > 0) {
          bgLog.warn('Resep scrape accepted with dropped rows', {
            reasons: parsed.reasons,
          });
        }
      } else {
        bgLog.warn('Rejected resep scrape payload', { reasons: parsed.reasons });
      }
    }

    if (Object.keys(updated).length === 0) {
      bgLog.warn('No valid scrape data to merge');
      return;
    }

    await updateEncounter(updated);
    bgLog.debug('Encounter updated from scrape');

    // Auto-sync to Dashboard when anamnesa is scraped (contains vitals + keluhan)
    if (scrapeData.pageType === 'anamnesa' && updated.anamnesa) {
      const fullEncounter = await getEncounter();
      if (fullEncounter) {
        // Use freshly scraped data (from enhanced scraper) — vitals come from DOM, not Encounter
        const rawData = scrapeData.data as Record<string, unknown>;
        const scrapedVitals = rawData.vital_signs as Record<string, number | undefined> | undefined;
        const scrapedDemo = rawData.patient_demographics as Record<string, unknown> | undefined;
        const patientRm = (scrapedDemo?.no_rm as string) || fullEncounter.patient_id;
        const recentDirectSync = await readRecentDirectPatientSync();

        if (hasRecentDirectPatientSync(recentDirectSync, patientRm)) {
          bgLog.debug('Skipping duplicate patient-sync after recent direct relay', {
            patientRm,
          });
          return;
        }

        const syncPayload = buildPatientSyncPayload({
          patient: {
            name: (scrapedDemo?.nama as string) || fullEncounter.patient_id || 'Unknown',
            age: (scrapedDemo?.umur as number) || 0,
            gender: ((scrapedDemo?.jenis_kelamin as string) === 'P' ? 'P' : 'L') as 'L' | 'P',
            rm: patientRm,
            noBpjs: (scrapedDemo?.no_bpjs as string) || undefined,
            isPregnant: fullEncounter.anamnesa?.is_pregnant,
          },
          vitals: {
            sbp: scrapedVitals?.tekanan_darah_sistolik,
            dbp: scrapedVitals?.tekanan_darah_diastolik,
            hr: scrapedVitals?.nadi,
            rr: scrapedVitals?.respirasi,
            temp: scrapedVitals?.suhu,
            glucose: scrapedVitals?.gula_darah,
          },
          narrative: {
            keluhan_utama: fullEncounter.anamnesa?.keluhan_utama || '',
            keluhan_tambahan: fullEncounter.anamnesa?.keluhan_tambahan || '',
          },
          medicalHistory: fullEncounter.anamnesa?.riwayat_penyakit
            ? [fullEncounter.anamnesa.riwayat_penyakit]
            : undefined,
        });

        const syncResult = await syncPatientToDashboard(syncPayload);
        // Relay result to side panel so UI can show feedback
        browser.runtime
          .sendMessage({
            type: 'BRIDGE_SYNC_RESULT',
            data: { ok: syncResult.ok, error: syncResult.error, id: syncResult.id },
          })
          .catch(() => {
            // Panel may not be open — safe to ignore
          });
      }
    }
  });

  // Panel → Worker: Fill command
  onMessage('fillResep', async (message) => {
    // Extract actual payload from message.data (webext-core/messaging wraps it)
    const resepPayload = message.data;
    bgLog.debug('Fill Resep request:', resepPayload);

    // Get active tab
    const tabs = await browser.tabs.query({ active: true, currentWindow: true });
    const tabId = tabs[0]?.id;

    if (!tabId) {
      bgLog.error('No active tab found');
      return {
        success: [],
        failed: [{ field: 'all', error: 'No active tab' }],
        skipped: [],
      };
    }

    bgLog.debug('Forwarding to tab:', tabId);

    // Forward to content script using native tabs.sendMessage
    try {
      const result = await sendMessageToTabWithTimeout<FillResult>(
        tabId,
        {
          type: 'execFill',
          data: {
            type: 'resep',
            encounter: resepPayload,
          },
        },
        MESSAGE_TIMEOUTS.fill
      );
      bgLog.debug('Fill result:', result);
      return result;
    } catch (error) {
      bgLog.error('Fill failed:', error);
      return {
        success: [],
        failed: [
          {
            field: 'all',
            error: toTabCommunicationError(
              error,
              error instanceof Error ? error.message : String(error)
            ),
          },
        ],
        skipped: [],
      };
    }
  });

  // Panel → Worker: Fill Anamnesa command (TTV + Keluhan)
  onMessage('fillAnamnesa', async (message) => {
    // Extract actual payload from message.data (webext-core/messaging wraps it)
    const anamnesaPayload = message.data;
    bgLog.debug('Fill Anamnesa request:', anamnesaPayload);

    // Get active tab
    const tabs = await browser.tabs.query({ active: true, currentWindow: true });
    const tabId = tabs[0]?.id;

    if (!tabId) {
      bgLog.error('No active tab found');
      return {
        success: [],
        failed: [{ field: 'all', error: 'No active tab' }],
        skipped: [],
      };
    }

    bgLog.debug('Forwarding Anamnesa fill to tab:', tabId);

    // Forward to content script using native tabs.sendMessage
    try {
      const result = await sendMessageToTabWithTimeout<FillResult>(
        tabId,
        {
          type: 'execFill',
          data: {
            type: 'anamnesa',
            encounter: anamnesaPayload,
          },
        },
        MESSAGE_TIMEOUTS.fill
      );
      bgLog.debug('Anamnesa fill result:', result);
      return result;
    } catch (error) {
      bgLog.error('Anamnesa fill failed:', error);
      return {
        success: [],
        failed: [
          {
            field: 'all',
            error: toTabCommunicationError(
              error,
              error instanceof Error ? error.message : String(error)
            ),
          },
        ],
        skipped: [],
      };
    }
  });

  // AUTH TOKEN RELAY - Content scripts can't access chrome.identity directly
  chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
    if (request.type === 'GET_AUTH_TOKEN') {
      chrome.identity.getAuthToken({ interactive: true }, (token) => {
        if (chrome.runtime.lastError) {
          sendResponse({ error: chrome.runtime.lastError.message });
        } else {
          sendResponse({ token });
        }
      });
      return true; // Keep channel open for async response
    }
  });

  // Panel → Worker: Fill Diagnosa command
  onMessage('fillDiagnosa', async (message) => {
    // Extract actual payload from message.data (webext-core/messaging wraps it)
    const diagnosaPayload = message.data;
    bgLog.debug('Fill Diagnosa request:', diagnosaPayload);

    const tabs = await browser.tabs.query({ active: true, currentWindow: true });
    const tabId = tabs[0]?.id;

    if (!tabId) {
      return {
        success: [],
        failed: [{ field: 'all', error: 'No active tab' }],
        skipped: [],
      };
    }

    try {
      const result = await sendMessageToTabWithTimeout<FillResult>(
        tabId,
        {
          type: 'execFill',
          data: {
            type: 'diagnosa',
            encounter: diagnosaPayload,
          },
        },
        MESSAGE_TIMEOUTS.fill
      );
      return result;
    } catch (error) {
      return {
        success: [],
        failed: [
          {
            field: 'all',
            error: toTabCommunicationError(
              error,
              error instanceof Error ? error.message : String(error)
            ),
          },
        ],
        skipped: [],
      };
    }
  });

  onMessage('transferRME', async (message) => {
    const payload = message.data as RMETransferPayload;
    transferLog.debug('transferRME request received', {
      hasAnamnesa: Boolean(payload.anamnesa),
      hasDiagnosa: Boolean(payload.diagnosa),
      hasResep: Boolean(payload.resep),
      options: payload.options || null,
    });
    let transferPayload = payload;

    try {
      const hasExplicitStep = Boolean(payload.options?.onlyStep || payload.options?.startFromStep);
      if (!hasExplicitStep) {
        const tabId = await resolveTransferTabId();
        if (tabId) {
          const pageContext = await probeTransferPage(tabId, true);
          const startFromStep = resolveStartStepFromContext(pageContext);
          transferPayload = {
            ...payload,
            options: {
              ...payload.options,
              startFromStep,
            },
          };
          transferLog.debug('transfer start context resolved', {
            startFromStep,
            pageType: pageContext.pageType || 'unknown',
            url: pageContext.url,
          });
        }
      } else {
        transferLog.debug('transfer step fixed by caller', {
          startFromStep: payload.options?.startFromStep || null,
          onlyStep: payload.options?.onlyStep || null,
        });
      }
    } catch (error) {
      transferLog.warn('transfer start context probing failed', error);
    }

    const startedAt = Date.now();
    await safeAuditLog(
      'RME_TRANSFER_STARTED',
      {
        requestId: transferPayload.options?.requestId || null,
        hasDiagnosa: Boolean(transferPayload.diagnosa),
        hasResep: Boolean(transferPayload.resep),
        startFromStep: transferPayload.options?.startFromStep || 'anamnesa',
        onlyStep: transferPayload.options?.onlyStep || null,
      },
      { status: 'started' }
    );

    const result = await rmeTransferOrchestrator.run(transferPayload, executeRMEFillStep, {
      timeoutMs: {
        anamnesa: 45000,
        diagnosa: 18000,
        resep: 30000,
      },
      retryByStep: {
        anamnesa: 1,
        diagnosa: 1,
        resep: 1,
      },
      onProgress: (event) => {
        void broadcastTransferProgress(event);
      },
      onStepFinal: async (step: RMETransferStepResult) => {
        await safeAuditLog(
          'RME_TRANSFER_STEP',
          {
            runId: transferPayload.options?.requestId || null,
            step: step.step,
            attempt: step.attempt,
            latencyMs: step.latencyMs,
            reasonCode: step.reasonCode || null,
            errorClass: step.errorClass || null,
          },
          {
            state: step.state,
            successCount: step.successCount,
            failedCount: step.failedCount,
            skippedCount: step.skippedCount,
          }
        );
      },
    });

    const stepLatency = (
      Object.entries(result.steps) as Array<[RMETransferStepStatus, RMETransferStepResult]>
    ).reduce<Record<string, number>>((acc, [stepKey, stepResult]) => {
      acc[stepKey] = stepResult.latencyMs;
      return acc;
    }, {});

    const lifecycleAction =
      result.state === 'success'
        ? 'RME_TRANSFER_COMPLETED'
        : result.state === 'partial'
          ? 'RME_TRANSFER_PARTIAL'
          : result.state === 'cancelled'
            ? 'RME_TRANSFER_CANCELLED'
            : 'RME_TRANSFER_FAILED';

    await safeAuditLog(
      lifecycleAction,
      {
        runId: result.runId,
        fingerprint: result.fingerprint,
        reasonCodes: result.reasonCodes,
        totalLatencyMs: result.totalLatencyMs,
        stepLatency,
      },
      {
        state: result.state,
        elapsedMs: Date.now() - startedAt,
      }
    );

    transferLog.debug('transferRME finished', {
      state: result.state,
      reasonCodes: result.reasonCodes,
    });
    return result;
  });

  onMessage('cancelRMETransfer', async (message) => {
    const data = message.data as { runId?: string };
    const runId = data?.runId?.trim();
    if (!runId) {
      return {
        success: false,
        reasonCode: 'UNKNOWN_STEP_FAILURE',
        message: 'runId wajib diisi',
      };
    }

    const cancelled = rmeTransferOrchestrator.cancelRun(runId);
    if (!cancelled) {
      return {
        success: false,
        reasonCode: 'UNKNOWN_STEP_FAILURE',
        message: 'Run tidak ditemukan atau sudah selesai',
      };
    }

    await broadcastTransferProgress({
      runId,
      state: 'cancelled',
      transferState: 'cancelled',
      steps: {
        anamnesa: {
          step: 'anamnesa',
          state: 'cancelled',
          attempt: 0,
          latencyMs: 0,
          successCount: 0,
          failedCount: 0,
          skippedCount: 0,
          reasonCode: 'USER_CANCELLED',
          errorClass: 'fatal',
          message: 'Transfer dibatalkan oleh pengguna',
        },
        diagnosa: {
          step: 'diagnosa',
          state: 'cancelled',
          attempt: 0,
          latencyMs: 0,
          successCount: 0,
          failedCount: 0,
          skippedCount: 0,
          reasonCode: 'USER_CANCELLED',
          errorClass: 'fatal',
          message: 'Transfer dibatalkan oleh pengguna',
        },
        resep: {
          step: 'resep',
          state: 'cancelled',
          attempt: 0,
          latencyMs: 0,
          successCount: 0,
          failedCount: 0,
          skippedCount: 0,
          reasonCode: 'USER_CANCELLED',
          errorClass: 'fatal',
          message: 'Transfer dibatalkan oleh pengguna',
        },
      },
      reasonCodes: ['USER_CANCELLED'],
      updatedAt: new Date().toISOString(),
    });

    await safeAuditLog('RME_TRANSFER_CANCEL_REQUESTED', { runId }, { status: 'accepted' });
    return { success: true, reasonCode: 'USER_CANCELLED' };
  });

  // ========================================
  // CDSS AI API Handlers
  // ========================================

  // Panel → Worker: Get diagnosis suggestions (REAL CDSS ENGINE)
  onMessage('getSuggestions', async (message) => {
    // Extract context from message
    const context = message.data as DiagnosisRequestContext;
    bgLog.debug('AI Diagnosis suggestion request');

    try {
      // Get current encounter
      let encounter = await getEncounter();

      if (!encounter) {
        bgLog.warn('No active encounter, creating v3-only transient encounter');
        const generatedEncounterId = `alpha-v3-${Date.now()}`;
        encounter = createEmptyEncounter(generatedEncounterId, 'UNKNOWN');

        if (context.keluhan_utama) {
          encounter.anamnesa.keluhan_utama = context.keluhan_utama;
        }
        if (context.keluhan_tambahan) {
          encounter.anamnesa.keluhan_tambahan = context.keluhan_tambahan;
        }
        if (context.allergies?.length) {
          encounter.anamnesa.alergi.obat = [...context.allergies];
        }
        if (context.chronic_diseases?.length) {
          encounter.diagnosa.penyakit_kronis = [...context.chronic_diseases];
        }

        await saveEncounter(encounter);
      }

      // Ensure encounter has anamnesa data for AI analysis
      // If encounter storage is missing keluhan but context has it, inject from context
      if (!encounter.anamnesa?.keluhan_utama && context.keluhan_utama) {
        bgLog.debug('Injecting keluhan_utama from request context into encounter');
        if (!encounter.anamnesa) {
          encounter.anamnesa = {
            keluhan_utama: context.keluhan_utama,
            keluhan_tambahan: '',
            lama_sakit: { thn: 0, bln: 0, hr: 0 },
            riwayat_penyakit: null,
            alergi: { obat: [], makanan: [], udara: [], lainnya: [] },
          };
        } else {
          encounter.anamnesa.keluhan_utama = context.keluhan_utama;
        }
        await saveEncounter(encounter);
      }

      if (!encounter.anamnesa?.keluhan_utama) {
        bgLog.warn('Encounter missing keluhan_utama and no context fallback');
        return {
          success: false,
          error: {
            code: 'MISSING_DATA',
            message: 'Keluhan utama tidak tersedia. Isi keluhan di form anamnesa.',
          },
        };
      }

      // Run REAL CDSS Engine
      bgLog.debug('Running CDSS Engine for encounter:', encounter.id);
      return await runGetSuggestionsFlow(encounter, context);
    } catch (error) {
      bgLog.error('CDSS Engine failed:', error);
      return {
        success: false,
        error: {
          code: 'ENGINE_ERROR',
          message: error instanceof Error ? error.message : 'Unknown engine error',
        },
      };
    }
  });

  // Panel → Worker: Get prescription recommendations
  onMessage('getRecommendations', async (message) => {
    const rawContext = message.data as PrescriptionRequestContext;
    const legacyPregnancyStatus = (
      rawContext as PrescriptionRequestContext & { pregnancyStatus?: unknown }
    ).pregnancyStatus;
    const normalizedIsPregnant =
      typeof rawContext.is_pregnant === 'boolean'
        ? rawContext.is_pregnant
        : typeof legacyPregnancyStatus === 'boolean'
          ? legacyPregnancyStatus
          : false;
    const context: PrescriptionRequestContext = {
      ...rawContext,
      is_pregnant: normalizedIsPregnant,
    };
    bgLog.debug('AI Prescription recommendation request');

    try {
      const result = await SentraAPI.recommendPrescription(context);
      bgLog.debug('Prescription recommendations received:', result.success);
      return result;
    } catch (error) {
      bgLog.error('Prescription recommendation failed:', error);
      return {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  });

  // Panel → Worker: Check drug interactions
  onMessage('checkInteractions', async (message) => {
    const drugs = message.data as string[];
    bgLog.debug('DDI check request for:', drugs);

    try {
      const result = await SentraAPI.checkDrugInteractions({ drugs });
      bgLog.debug('DDI check completed:', result.success);
      return result;
    } catch (error) {
      bgLog.error('DDI check failed:', error);
      return {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  });

  // Panel → Worker: Check allergy contraindications
  onMessage('checkAllergies', async (message) => {
    const context = message.data as AllergyCheckRequest;
    bgLog.debug('Allergy check request');

    try {
      const result = await SentraAPI.checkAllergies(context);
      bgLog.debug('Allergy check completed:', result.success);
      return result;
    } catch (error) {
      bgLog.error('Allergy check failed:', error);
      return {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  });

  // Panel → Worker: Calculate pediatric dose
  onMessage('calculatePediatricDose', async (message) => {
    const context = message.data as PediatricDoseRequest;
    bgLog.debug('Pediatric dose calculation request');

    try {
      const result = await SentraAPI.calculatePediatricDose(context);
      bgLog.debug('Pediatric dose calculated:', result.success);
      return result;
    } catch (error) {
      bgLog.error('Pediatric dose calculation failed:', error);
      return {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  });

  // ========================================
  // Field Diagnostic Handler
  // ========================================

  // Panel → Worker: Scan fields on current page
  onMessage('scanFields', async () => {
    bgLog.debug('Scan fields request');

    const tabs = await browser.tabs.query({ active: true, currentWindow: true });
    const tabId = tabs[0]?.id;

    if (!tabId) {
      return { success: false, error: 'No active tab', fields: [] };
    }

    try {
      const result = await sendMessageToTabWithTimeout<ScanFieldsResponse>(
        tabId,
        {
          type: 'scanFields',
        },
        MESSAGE_TIMEOUTS.scrape
      );
      bgLog.debug('Scan result:', result);
      return result;
    } catch (error) {
      bgLog.error('Scan failed:', error);
      return {
        success: false,
        error: toTabCommunicationError(
          error,
          error instanceof Error ? error.message : String(error)
        ),
        fields: [],
      };
    }
  });

  // Panel → Content: Scan medical history from page
  onMessage('scanMedicalHistory', async () => {
    bgLog.debug('Scan medical history request');

    const tabs = await browser.tabs.query({ active: true, currentWindow: true });
    const tabId = tabs[0]?.id;

    if (!tabId) {
      return { success: false, error: 'No active tab', history: [] };
    }

    try {
      const result = await sendMessageToTabWithTimeout<ScanMedicalHistoryResponse>(
        tabId,
        {
          type: 'scanMedicalHistory',
          timestamp: Date.now(),
        },
        MESSAGE_TIMEOUTS.scrape
      );
      bgLog.debug('Medical history result:', result);
      return result;
    } catch (error) {
      bgLog.error('Medical history scan failed:', error);
      return {
        success: false,
        error: toTabCommunicationError(
          error,
          error instanceof Error ? error.message : String(error)
        ),
        history: [],
      };
    }
  });

  // Panel → Content: Resolve dokter/perawat names with cache fallback
  onMessage('resolveTenagaMedis', async () => {
    const activeTabs = await browser.tabs.query({ active: true, currentWindow: true });
    let tabId = activeTabs[0]?.id;

    if (!tabId) {
      const epTabs = await browser.tabs.query({ url: '*://*.epuskesmas.id/*' });
      tabId = epTabs[0]?.id;
    }

    if (!tabId) {
      const cached = await readTenagaMedisCache();
      if (cached) {
        return { success: true, tenagaMedis: cached };
      }
      return { success: false, error: 'No active ePuskesmas tab', tenagaMedis: undefined };
    }

    const resolved = await resolveTenagaMedisForTab(tabId);
    if (!resolved) {
      return {
        success: false,
        error: 'Nama dokter/perawat tidak tersedia',
        tenagaMedis: undefined,
      };
    }

    return {
      success: true,
      tenagaMedis: resolved,
    };
  });

  // Panel → Content: Scan visit history from ePuskesmas page
  onMessage('scanVisitHistory', async () => {
    const bgDiag: string[] = [];
    const d = (msg: string) => {
      bgDiag.push(msg);
      riwayatLog.debug(msg);
    };

    // 3-strategy tab finding (same robust approach as scanMedicalHistory)
    let tabId: number | undefined;
    let tabUrl = 'unknown';

    // Strategy 1: Active tab if it's ePuskesmas
    const activeTabs = await browser.tabs.query({ active: true, currentWindow: true });
    d(`S1: activeTabs=${activeTabs.length} url=${activeTabs[0]?.url?.slice(0, 60) || 'none'}`);
    if (activeTabs[0]?.url?.includes('epuskesmas.id')) {
      tabId = activeTabs[0].id;
      tabUrl = activeTabs[0].url || 'unknown';
      d(`S1_HIT: epuskesmas tab=${tabId}`);
    }

    // Strategy 2: Search ALL tabs for ePuskesmas
    if (!tabId) {
      const epTabs = await browser.tabs.query({ url: '*://*.epuskesmas.id/*' });
      d(`S2: epuskesmas tabs found=${epTabs.length}`);
      if (epTabs[0]?.id) {
        tabId = epTabs[0].id;
        tabUrl = epTabs[0].url || 'unknown';
        d(`S2_HIT: tab=${tabId} url=${tabUrl.slice(0, 60)}`);
      }
    }

    // Strategy 3: Fallback to any active tab
    if (!tabId && activeTabs[0]?.id) {
      tabId = activeTabs[0].id;
      tabUrl = activeTabs[0].url || 'unknown';
      d(`S3_FALLBACK: tab=${tabId}`);
    }

    if (!tabId) {
      d('NO_TAB: all 3 strategies failed');
      return { success: false, error: 'No ePuskesmas tab found', visits: [], diagnostics: bgDiag };
    }

    try {
      d(`SEND: tab=${tabId} url=${tabUrl.slice(0, 60)}`);
      const result = await sendMessageToTabWithTimeout<ScanVisitHistoryResponse>(
        tabId,
        {
          type: 'scanVisitHistory',
          timestamp: Date.now(),
        },
        MESSAGE_TIMEOUTS.visitFetch
      );
      d(`RECV: success=${result.success} visits=${result.visits.length}`);
      return {
        ...result,
        diagnostics: [...bgDiag, ...(result.diagnostics || [])],
      };
    } catch (error) {
      if (classifyTabMessageError(error) === 'NO_RECEIVER') {
        d('NO_RECEIVER: attempting content-script self-heal');
        const injected = await tryInjectContentScripts(tabId, d);
        if (injected) {
          try {
            const retryResult = await sendMessageToTabWithTimeout<ScanVisitHistoryResponse>(
              tabId,
              {
                type: 'scanVisitHistory',
                timestamp: Date.now(),
              },
              MESSAGE_TIMEOUTS.visitFetch
            );
            d(`RETRY_RECV: success=${retryResult.success} visits=${retryResult.visits.length}`);
            return {
              ...retryResult,
              diagnostics: [...bgDiag, ...(retryResult.diagnostics || [])],
            };
          } catch (retryError) {
            d(
              `RETRY_SEND_ERROR: ${toTabCommunicationError(
                retryError,
                retryError instanceof Error ? retryError.message : String(retryError)
              )}`
            );
          }
        }
      }

      const mappedError = toTabCommunicationError(
        error,
        error instanceof Error ? error.message : String(error)
      );
      d(`SEND_ERROR: ${mappedError}`);
      return {
        success: false,
        error: mappedError,
        visits: [],
        diagnostics: [...bgDiag, 'Content script unreachable or threw'],
      };
    }
  });

  // Content → Worker → Panel: Visit history scraped acknowledgment
  onMessage('visitHistoryScraped', async (message) => {
    const data = message.data;
    bgLog.debug(`visitHistoryScraped received: ${data.visits?.length || 0} visits`);

    try {
      // Forward to side panel
      await sendMessage('visitHistoryScraped', data);
      bgLog.debug('visitHistoryScraped forwarded to panel');
    } catch (error) {
      bgLog.error('Failed to forward visitHistoryScraped:', error);
    }
  });

  // ========================================
  // CDSS Engine Status Handlers
  // ========================================

  // Panel → Worker: Get CDSS status
  onMessage('getCDSSStatus', async () => {
    bgLog.debug('CDSS status request');

    try {
      const status = await getCDSSEngineStatus();
      bgLog.debug('CDSS status:', status);
      return status;
    } catch (error) {
      bgLog.error('CDSS status check failed:', error);
      return {
        ready: false,
        icd10_count: 0,
        model: 'gemini-1.5-flash-002',
        audit_entries: 0,
        last_error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  });

  // Panel → Worker: Initialize CDSS (manual trigger)
  onMessage('initializeCDSS', async () => {
    bgLog.debug('CDSS initialization request');

    try {
      const ready = await initCDSSEngine();
      bgLog.debug('CDSS initialized:', ready);
      return ready;
    } catch (error) {
      bgLog.error('CDSS initialization failed:', error);
      return false;
    }
  });

  // ========================================
  // NATIVE MESSAGE LISTENER (for sidepanel native chrome.runtime.sendMessage)
  // ========================================
  browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    const msg = message as { type?: string; data?: unknown };
    bgLog.debug('Native message received:', msg.type, 'from:', sender.url);

    // Handle scanFields
    if (msg.type === 'scanFields') {
      (async () => {
        const tabs = await browser.tabs.query({ active: true, currentWindow: true });
        const tabId = tabs[0]?.id;
        if (!tabId) {
          sendResponse({ success: false, error: 'No active tab', fields: [] });
          return;
        }
        try {
          const result = await sendMessageToTabWithTimeout<ScanFieldsResponse>(
            tabId,
            { type: 'scanFields' },
            MESSAGE_TIMEOUTS.scrape
          );
          sendResponse(result);
        } catch (error) {
          sendResponse({
            success: false,
            error: toTabCommunicationError(
              error,
              error instanceof Error ? error.message : String(error)
            ),
            fields: [],
          });
        }
      })();
      return true; // Keep channel open for async
    }

    // Handle scanMedicalHistory
    if (msg.type === 'scanMedicalHistory') {
      (async () => {
        bgLog.debug('scanMedicalHistory received');

        // Try multiple strategies to find ePuskesmas tab
        let tabId: number | undefined;

        // Strategy 1: Active tab in current window
        const activeTabs = await browser.tabs.query({ active: true, currentWindow: true });
        if (activeTabs[0]?.url?.includes('epuskesmas.id')) {
          tabId = activeTabs[0].id;
          bgLog.debug('Found ePuskesmas in active tab:', tabId);
        }

        // Strategy 2: Search all tabs for ePuskesmas
        if (!tabId) {
          const allTabs = await browser.tabs.query({ url: '*://*.epuskesmas.id/*' });
          if (allTabs[0]?.id) {
            tabId = allTabs[0].id;
            bgLog.debug('Found ePuskesmas tab by URL:', tabId);
          }
        }

        // Strategy 3: Fall back to any active tab
        if (!tabId && activeTabs[0]?.id) {
          tabId = activeTabs[0].id;
          bgLog.debug('Fallback to active tab:', tabId);
        }

        if (!tabId) {
          bgLog.error('No ePuskesmas tab found');
          sendResponse({ success: false, error: 'No ePuskesmas tab found', history: [] });
          return;
        }

        try {
          bgLog.debug('Sending scanMedicalHistory to tab:', tabId);
          const result = await sendMessageToTabWithTimeout<ScanMedicalHistoryResponse>(
            tabId,
            { type: 'scanMedicalHistory', timestamp: Date.now() },
            MESSAGE_TIMEOUTS.scrape
          );
          bgLog.debug('scanMedicalHistory result:', result);
          sendResponse(result);
        } catch (error) {
          bgLog.error('scanMedicalHistory failed:', error);
          sendResponse({
            success: false,
            error: toTabCommunicationError(
              error,
              error instanceof Error ? error.message : String(error)
            ),
            history: [],
          });
        }
      })();
      return true; // Keep channel open for async
    }

    // Handle fillAnamnesa
    if (msg.type === 'fillAnamnesa') {
      (async () => {
        bgLog.debug('Native fillAnamnesa request received');
        bgLog.debug('Native fillAnamnesa request:', msg.data);
        const tabs = await browser.tabs.query({ active: true, currentWindow: true });
        const tabId = tabs[0]?.id;
        bgLog.debug('Active tab ID:', tabId);
        if (!tabId) {
          bgLog.warn('No active tab found for native fillAnamnesa');
          sendResponse({
            success: [],
            failed: [{ field: 'all', error: 'No active tab' }],
            skipped: [],
          });
          return;
        }
        try {
          bgLog.debug('Forwarding native execFill to tab', tabId);
          const result = await sendMessageToTabWithTimeout<FillResult>(
            tabId,
            {
              type: 'execFill',
              data: { type: 'anamnesa', encounter: msg.data },
            },
            MESSAGE_TIMEOUTS.fill
          );
          bgLog.debug('Native content response:', result);
          bgLog.debug('Native fillAnamnesa result:', result);
          sendResponse(result);
        } catch (error) {
          bgLog.error('Native fillAnamnesa failed:', error);
          sendResponse({
            success: [],
            failed: [
              {
                field: 'all',
                error: toTabCommunicationError(
                  error,
                  error instanceof Error ? error.message : String(error)
                ),
              },
            ],
            skipped: [],
          });
        }
      })();
      return true; // Keep channel open for async
    }

    // Handle triggerRiwayatClick — calls showRiwayatPelayanan() in page's MAIN world
    // Content script cannot call page functions due to isolated world + CSP blocking
    // chrome.scripting.executeScript with world: 'MAIN' is the official bypass
    if (msg.type === 'triggerRiwayatClick') {
      const { dataId } = msg as { type: string; dataId: string };
      (async () => {
        const tabs = await browser.tabs.query({ active: true, currentWindow: true });
        const tabId = tabs[0]?.id;
        if (!tabId) {
          sendResponse({ success: false, error: 'No active tab' });
          return;
        }
        try {
          const chrome = (globalThis as { chrome?: BrowserGlobalWithSidePanel }).chrome;
          if (!chrome?.scripting?.executeScript) {
            sendResponse({ success: false, error: 'chrome.scripting is not available' });
            return;
          }
          await chrome.scripting.executeScript({
            target: { tabId },
            world: 'MAIN',
            func: (...args: unknown[]) => {
              const id = args[0] as string;
              const el = document.querySelector(`a[data-id="${id}"]`);
              const maybeWindow = window as Window & {
                showRiwayatPelayanan?: (element: Element) => void;
              };
              if (el && typeof maybeWindow.showRiwayatPelayanan === 'function') {
                maybeWindow.showRiwayatPelayanan(el);
              }
            },
            args: [dataId],
          });
          bgLog.debug(`triggerRiwayatClick executed for data-id=${dataId}`);
          sendResponse({ success: true });
        } catch (error) {
          bgLog.error('triggerRiwayatClick failed:', error);
          sendResponse({ success: false, error: String(error) });
        }
      })();
      return true;
    }

    return false; // Not handled
  });

  bgLog.debug('Message handlers registered (including CDSS Engine + Native listener)');
});
