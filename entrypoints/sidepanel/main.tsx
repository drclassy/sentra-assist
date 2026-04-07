// Designed and constructed by Claudesy.
/**
 * Sentra Assist - Side Panel Entry
 * Updated with TTV Inference UI + Emergency Dashboard
 */

import type {
  ScreeningAlert,
  TTVInferenceData,
} from '@/components/clinical/TTVInferenceUI';
import type { ComposedAnamnesaDraft } from '@/lib/clinical/anamnesa-composer';
import type { CanonicalClinicalEngineOutput } from '@/lib/api/bridge-client';
import type {
  AutosenPreset,
  DisabilityType,
  ObesityConfirmation,
} from '@/lib/clinical/autosen-types';
import { SidePanelHeader } from '@/components/sidepanel/SidePanelHeader';
import { SidePanelFooter } from '@/components/sidepanel/SidePanelFooter';
import { PowerButton } from '@/components/sidepanel/PowerButton';
import { ConsoleLogin } from '@/components/sidepanel/ConsoleLogin';
import { DashboardView } from '@/components/sidepanel/DashboardView';
import type { AuthUser } from '@/lib/api/auth-store';
import type { BridgeConfig } from '@/lib/api/bridge-client';
import type { VisitRecord } from '@/lib/iskandar-diagnosis-engine/visit-history-store';
import { sendMessage } from '@/utils/messaging';
import React, { Suspense, useCallback, useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
import './style.css';
import './globals.css';

// Dynamic imports → separate chunks (ClinicalDifferential, ClinicalTrajectory, bridge-client)
const ClinicalDifferential = React.lazy(() =>
  import('@/components/clinical/ClinicalDifferential').then((m) => ({ default: m.ClinicalDifferential }))
);
const ClinicalTrajectory = React.lazy(() =>
  import('@/components/clinical/ClinicalTrajectory').then((m) => ({ default: m.ClinicalTrajectory }))
);
const TTVInferenceUI = React.lazy(() =>
  import('@/components/clinical/TTVInferenceUI').then((m) => ({ default: m.TTVInferenceUI }))
);

// ============================================================================
// PATIENT DATA TYPE
// ============================================================================
interface PatientData {
  name: string;
  gender: 'L' | 'P';
  age: number;
  rm: string;
  dob: string;
  bloodType: string;
  bpjsStatus: 'aktif' | 'nonaktif' | 'mandiri' | null;
  kelurahan: string;
}

type MedicalHistoryEntry = {
  code: string;
  description: string;
  shortLabel: string;
};

type PrefilledHistoryFlags = Record<string, boolean>;

type PrefetchedVisitHistory = {
  visits: VisitRecord[];
  diagnostics: string[];
  status: 'ready' | 'insufficient';
};

type ExtractedClinicalContext = {
  facilityName: string;
  payerLabel: string;
  specialConditions: string[];
  pregnancyRisk: string;
  allergies: string[];
  pregnancyStatus: boolean | null;
};

const CHRONIC_FLAG_ORDER = ['dm', 'ht', 'jantung', 'stroke', 'ginjal', 'asma'] as const;

const HISTORY_FLAG_META: Record<(typeof CHRONIC_FLAG_ORDER)[number], { labels: string[]; display: string }> = {
  dm: { labels: ['DM'], display: 'DM' },
  ht: { labels: ['HT'], display: 'HT' },
  jantung: { labels: ['HF', 'CHD', 'JANTUNG'], display: 'Jantung' },
  stroke: { labels: ['STROKE'], display: 'Stroke' },
  ginjal: { labels: ['CKD', 'GINJAL'], display: 'Ginjal' },
  asma: { labels: ['ASTHMA', 'ASMA'], display: 'Asma' },
};

function mapMedicalHistoryToFlags(entries: MedicalHistoryEntry[]): PrefilledHistoryFlags {
  const flags: PrefilledHistoryFlags = {};
  const labels = new Set(entries.map((entry) => entry.shortLabel.toUpperCase().trim()));

  for (const key of CHRONIC_FLAG_ORDER) {
    flags[key] = HISTORY_FLAG_META[key].labels.some((label) => labels.has(label));
  }

  return flags;
}

function createEmptyHistoryFlags(): PrefilledHistoryFlags {
  return CHRONIC_FLAG_ORDER.reduce((accumulator, key) => {
    accumulator[key] = false;
    return accumulator;
  }, {} as PrefilledHistoryFlags);
}

function buildHistorySummary(flags: PrefilledHistoryFlags): string {
  const selected = CHRONIC_FLAG_ORDER.filter((key) => flags[key]).map(
    (key) => HISTORY_FLAG_META[key].display
  );
  return selected.length > 0 ? selected.join(', ') : 'Menunggu Input';
}

const normalizePatientNameForDisplay = (name?: string): string => {
  const normalized = name?.trim();

  if (
    !normalized ||
    normalized === 'Error memuat data' ||
    normalized === 'Data tidak ditemukan' ||
    normalized === 'Tidak ditemukan'
  ) {
    return '---';
  }

  return normalized;
};

console.log('[SidePanel] main.tsx loading...');

type TabType = 'ttv' | 'emergency' | 'agent';
type ViewState = 'main' | 'trajectory' | 'differential';
type EngineId = 'vs' | 'emergency' | 'settings' | 'sentratype' | 'movi' | 'uplink';

// ============================================================================
// TTV STATE (Lifted to parent to persist across tab switches)
// ============================================================================
export interface TTVFormState {
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
}

const initialTTVState: TTVFormState = {
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
  autosenPreset: 'adl',
};

// Default patient data (shown while loading)
const defaultPatient: PatientData = {
  name: 'Memuat...',
  gender: 'L',
  age: 0,
  rm: '-',
  dob: '',
  bloodType: '',
  bpjsStatus: null,
  kelurahan: '',
};

const defaultClinicalContext: ExtractedClinicalContext = {
  facilityName: '',
  payerLabel: '',
  specialConditions: [],
  pregnancyRisk: '',
  allergies: [],
  pregnancyStatus: null,
};

const engineConfig: Record<EngineId, { section: string }> = {
  vs: { section: 'VS Inference' },
  emergency: { section: 'Emergency' },
  settings: { section: 'Pengaturan' },
  sentratype: { section: 'SentraType' },
  movi: { section: 'MOVI' },
  uplink: { section: 'Uplink' },
};

function App() {
  // Boot sequence state: off → booting → login → dashboard → clinical
  const [isPowered, setIsPowered] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [showDashboard, setShowDashboard] = useState(true);
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);

  const [activeTab, setActiveTab] = useState<TabType>('ttv');
  const [viewState, setViewState] = useState<ViewState>('main');
  const [emergencyAlerts, setEmergencyAlerts] = useState<ScreeningAlert[]>([]);
  const [activeEngine, setActiveEngine] = useState<EngineId>('vs');

  // Lifted TTV state - persists across tab switches
  const [ttvState, setTTVState] = useState<TTVFormState>(initialTTVState);

  // Patient data state (fetched from ePuskesmas page)
  const [patientData, setPatientData] = useState<PatientData>(defaultPatient);
  const [isLoadingPatient, setIsLoadingPatient] = useState(true);
  const [patientHistorySummary, setPatientHistorySummary] = useState('Menunggu Input');
  const [prefilledHistoryFlags, setPrefilledHistoryFlags] = useState<PrefilledHistoryFlags>(createEmptyHistoryFlags);
  const [clinicalContext, setClinicalContext] = useState<ExtractedClinicalContext>(defaultClinicalContext);
  const [prefetchedVisitHistory, setPrefetchedVisitHistory] = useState<PrefetchedVisitHistory | null>(
    null
  );
  const [anamnesaDraft, setAnamnesaDraft] = useState<ComposedAnamnesaDraft | null>(null);

  // Trajectory state - passed from ClinicalTrajectory to ClinicalDifferential
  const [trajectoryData, setTrajectoryData] = useState<
    import('@/lib/iskandar-diagnosis-engine/trajectory-analyzer').TrajectoryAnalysis | undefined
  >(undefined);
  const [canonicalTrajectoryData, setCanonicalTrajectoryData] =
    useState<CanonicalClinicalEngineOutput | null>(null);
  const [visitCount, setVisitCount] = useState<number>(0);
  const visiblePatientName = normalizePatientNameForDisplay(patientData.name);
  const demographicStatus =
    isLoadingPatient ? 'syncing' : visiblePatientName !== '---' && patientData.rm !== '-' ? 'ready' : 'standby';
  const historyStatus = isLoadingPatient
    ? 'syncing'
    : prefetchedVisitHistory?.status === 'ready'
      ? 'ready'
      : prefetchedVisitHistory?.status === 'insufficient'
        ? 'insufficient'
        : 'standby';

  // Boot sequence — drive --power-state CSS variable
  useEffect(() => {
    document.documentElement.style.setProperty('--power-state', isPowered ? '1' : '0');
  }, [isPowered]);

  // Auto-detect existing session on mount → skip login if already authenticated
  useEffect(() => {
    void (async () => {
      try {
        const { getStoredSession } = await import('@/lib/api/auth-client');
        const session = await getStoredSession();
        if (session?.user) {
          setAuthUser(session.user);
          setIsLoggedIn(true);
          setIsPowered(true);
          setShowDashboard(true); // Always show credits/dashboard page
        }
      } catch {
        // No stored session — show login flow
      }
    })();
  }, []);

  const handlePowerToggle = useCallback(() => {
    const next = !isPowered;
    setIsPowered(next);
    if (!next) {
      setIsLoggedIn(false);
      setShowDashboard(true);
      setAuthUser(null);
    }
  }, [isPowered]);

  const handleLoginSuccess = useCallback((user: AuthUser) => {
    setAuthUser(user);
    setIsLoggedIn(true);
    setShowDashboard(true); // Show dashboard after fresh login
  }, []);

  const handleLaunchConsole = useCallback(() => {
    setShowDashboard(false);
  }, []);

  const handleLogout = useCallback(() => {
    void (async () => {
      try {
        const { logout } = await import('@/lib/api/auth-client');
        await logout();
      } catch {
        // Best effort
      }
      setIsLoggedIn(false);
      setShowDashboard(true);
      setAuthUser(null);
    })();
  }, []);

  const handleEngineChange = useCallback((engineId: string) => {
    const nextEngine = engineId as EngineId;
    setActiveEngine(nextEngine);

    if (nextEngine === 'emergency') {
      setActiveTab('emergency');
      return;
    }

    if (nextEngine === 'settings') {
      setActiveTab('agent');
      return;
    }

    setActiveTab('ttv');
  }, []);

  // ========================================
  // Fetch patient data from ePuskesmas page
  // ========================================
  const fetchPatientData = useCallback(async () => {
    console.log('[SidePanel] Fetching patient data...');
    setIsLoadingPatient(true);
    setPrefilledHistoryFlags(createEmptyHistoryFlags());
    setPatientHistorySummary('Menunggu Input');
    setClinicalContext(defaultClinicalContext);
    setAnamnesaDraft(null);

    try {
      let resolvedPatientRm = '-';

      // Get active tab
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id) {
        console.error('[SidePanel] No active tab found');
        setIsLoadingPatient(false);
        return;
      }

      const [patientResponse, medicalHistoryResponse, visitHistoryResponse, clinicalContextResponse] =
        await Promise.allSettled([
        chrome.tabs.sendMessage(tab.id, { type: 'getPatientInfo' }),
        sendMessage('scanMedicalHistory', undefined),
        sendMessage('scanVisitHistory', undefined),
        sendMessage('scanClinicalContext', undefined),
      ]);

      if (patientResponse.status === 'fulfilled') {
        const response = patientResponse.value;
        console.log('[SidePanel] Patient info response:', response);

        if (response?.success && response.patient) {
          const p = response.patient;
          resolvedPatientRm = p.rm || '-';
          setPatientData({
            name: p.name || 'Tidak ditemukan',
            gender: p.gender || 'L',
            age: p.age || 0,
            rm: p.rm || '-',
            dob: p.dob || '',
            bloodType: '',
            bpjsStatus: p.bpjsStatus || null,
            kelurahan: p.kelurahan || '',
          });
        } else {
          console.warn('[SidePanel] Failed to get patient info:', response?.error);
          setPatientData({
            ...defaultPatient,
            name: 'Data tidak ditemukan',
          });
        }
      } else {
        console.error('[SidePanel] Error fetching patient info:', patientResponse.reason);
        setPatientData({
          ...defaultPatient,
          name: 'Error memuat data',
        });
      }

      if (medicalHistoryResponse.status === 'fulfilled') {
        const response = medicalHistoryResponse.value;
        console.log('[SidePanel] Medical history response:', response);

        if (response.success) {
          const nextFlags = mapMedicalHistoryToFlags(response.history);
          setPrefilledHistoryFlags(nextFlags);
          setPatientHistorySummary(buildHistorySummary(nextFlags));
        } else {
          console.warn('[SidePanel] scanMedicalHistory failed:', response.error);
          setPrefilledHistoryFlags(createEmptyHistoryFlags());
          setPatientHistorySummary('Menunggu Input');
        }
      } else {
        console.error('[SidePanel] Error fetching medical history:', medicalHistoryResponse.reason);
        setPrefilledHistoryFlags(createEmptyHistoryFlags());
        setPatientHistorySummary('Menunggu Input');
      }

      if (visitHistoryResponse.status === 'fulfilled') {
        const response = visitHistoryResponse.value;
        console.log('[SidePanel] Visit history response:', response);

        if (response.success) {
          const visits: VisitRecord[] = (response.visits || [])
            .slice(0, 5)
            .map((visit) => ({
            patient_id: resolvedPatientRm,
            encounter_id: visit.encounter_id,
            timestamp: visit.date,
            vitals: visit.vitals,
            keluhan_utama: visit.keluhan_utama,
            diagnosa: visit.diagnosa || undefined,
            source: 'scrape',
            }));

          const diagnostics = [...(response.diagnostics || [])];
          const status = visits.length >= 3 ? 'ready' : 'insufficient';
          if (status === 'insufficient') {
            diagnostics.unshift(`INSUFFICIENT_HISTORY: hanya ${visits.length} kunjungan tersedia`);
          }

          setPrefetchedVisitHistory({
            visits,
            diagnostics,
            status,
          });
        } else {
          console.warn('[SidePanel] scanVisitHistory failed:', response.error);
          setPrefetchedVisitHistory(null);
        }
      } else {
        console.error('[SidePanel] Error fetching visit history:', visitHistoryResponse.reason);
        setPrefetchedVisitHistory(null);
      }

      if (clinicalContextResponse.status === 'fulfilled') {
        const response = clinicalContextResponse.value as {
          success?: boolean;
          context?: Partial<ExtractedClinicalContext>;
          error?: string;
        };

        if (response.success && response.context) {
          setClinicalContext({
            facilityName: response.context.facilityName || '',
            payerLabel: response.context.payerLabel || '',
            specialConditions: response.context.specialConditions || [],
            pregnancyRisk: response.context.pregnancyRisk || '',
            allergies: response.context.allergies || [],
            pregnancyStatus:
              typeof response.context.pregnancyStatus === 'boolean'
                ? response.context.pregnancyStatus
                : null,
          });
        } else {
          console.warn('[SidePanel] scanClinicalContext failed:', response.error);
          setClinicalContext(defaultClinicalContext);
        }
      } else {
        console.error('[SidePanel] Error fetching clinical context:', clinicalContextResponse.reason);
        setClinicalContext(defaultClinicalContext);
      }
    } catch (error) {
      console.error('[SidePanel] Error fetching patient data:', error);
      setPatientData({
        ...defaultPatient,
        name: 'Error memuat data',
      });
    } finally {
      setIsLoadingPatient(false);
    }
  }, []);

  // Auto-fetch patient data on mount
  useEffect(() => {
    // Small delay to ensure content script is ready
    const timer = setTimeout(() => {
      fetchPatientData();
    }, 500);

    return () => clearTimeout(timer);
  }, [fetchPatientData]);

  useEffect(() => {
    setAnamnesaDraft(null);
  }, [patientData.rm, ttvState.autosenPreset, ttvState.pregnancyStatus, ttvState.symptomText, ttvState.allergies]);

  const handleTTVComplete = (data: TTVInferenceData) => {
    console.log('[SidePanel] TTV Data:', data);
    setAnamnesaDraft(data.anamnesaDraft);
  };

  // Callback to receive alerts from TTVInferenceUI
  const handleAlertsChange = useCallback((alerts: ScreeningAlert[]) => {
    console.log(
      '[App] Received alerts:',
      alerts.length,
      alerts.map((a) => a.type)
    );
    setEmergencyAlerts(alerts);
  }, []);

  // Debug: log ttvState changes
  console.log('[App] Current ttvState:', {
    sbp: ttvState.sbp,
    dbp: ttvState.dbp,
    glucose: ttvState.glucose,
    pregnancyStatus: ttvState.pregnancyStatus,
  });

  // Trajectory view (full-screen overlay)
  if (viewState === 'trajectory') {
    return (
      <div className="view-transition">
        <Suspense fallback={<div className="ct-loading-bar">Memuat...</div>}>
        <ClinicalTrajectory
          vitals={{
            sbp: parseInt(ttvState.sbp) || 0,
            dbp: parseInt(ttvState.dbp) || 0,
            hr: parseInt(ttvState.hr) || 0,
            rr: parseInt(ttvState.rr) || 0,
            temp: parseFloat(ttvState.temp) || 0,
            spo2: parseInt(ttvState.spo2) || 0,
            glucose: parseInt(ttvState.glucose) || 0,
          }}
          keluhanUtama={anamnesaDraft?.payload.keluhan_utama || ttvState.symptomText || '-'}
          keluhanTambahan={anamnesaDraft?.payload.keluhan_tambahan || ''}
          narrative={{
            keluhan_utama: anamnesaDraft?.payload.keluhan_utama || ttvState.symptomText || '-',
            lama_sakit: anamnesaDraft?.metadata.durationLabel || '',
            is_akut:
              !anamnesaDraft?.metadata.durationLabel ||
              !/(bulan|tahun|kronik)/i.test(anamnesaDraft.metadata.durationLabel),
            confidence: anamnesaDraft ? 0.9 : 0.5,
          }}
          alerts={emergencyAlerts}
          patientAge={patientData.age}
          patientGender={patientData.gender}
          patientName={patientData.name}
          patientRM={patientData.rm}
          patientDOB={patientData.dob}
          patientBPJSStatus={patientData.bpjsStatus}
          patientKelurahan={patientData.kelurahan}
          patientFacilityName={clinicalContext.facilityName}
          patientPayerLabel={clinicalContext.payerLabel}
          allergies={ttvState.allergies}
          pregnancyStatus={patientData.gender === 'L' ? false : ttvState.pregnancyStatus}
          chronicHistorySummary={patientHistorySummary}
          extractedPregnancyRisk={clinicalContext.pregnancyRisk}
          extractedSpecialConditions={clinicalContext.specialConditions}
          disabilityType={ttvState.disabilityType}
          obesityConfirmation={ttvState.obesityConfirmation}
          autosenPreset={ttvState.autosenPreset}
          symptomTextRaw={ttvState.symptomText}
          onBack={() => setViewState('main')}
          prefetchedVisits={prefetchedVisitHistory?.visits}
          prefetchedDiagnostics={prefetchedVisitHistory?.diagnostics}
          prefetchedVisitStatus={prefetchedVisitHistory?.status}
          onNextDifferential={(trajectory, count, canonicalOutput) => {
            setTrajectoryData(trajectory);
            setCanonicalTrajectoryData(canonicalOutput);
            setVisitCount(count);
            setViewState('differential');
          }}
        />
        </Suspense>
      </div>
    );
  }

  // Differential diagnosis view (full-screen overlay)
  if (viewState === 'differential') {
    return (
      <div className="view-transition">
        <Suspense fallback={<div className="ct-loading-bar">Memuat...</div>}>
        <ClinicalDifferential
          keluhanUtama={anamnesaDraft?.payload.keluhan_utama || ttvState.symptomText || '-'}
          keluhanTambahan={anamnesaDraft?.payload.keluhan_tambahan || ''}
          patientAge={patientData.age}
          patientGender={patientData.gender}
          patientRM={patientData.rm}
          allergies={ttvState.allergies}
          confirmedPregnancyStatus={patientData.gender === 'L' ? false : ttvState.pregnancyStatus}
          vitals={{
            sbp: parseInt(ttvState.sbp) || 0,
            dbp: parseInt(ttvState.dbp) || 0,
            hr: parseInt(ttvState.hr) || 0,
            rr: parseInt(ttvState.rr) || 0,
            temp: parseFloat(ttvState.temp) || 0,
            glucose: parseInt(ttvState.glucose) || 0,
          }}
          trajectory={trajectoryData}
          canonicalOutput={canonicalTrajectoryData}
          hasVisitHistory={visitCount > 1}
          onBack={() => setViewState('main')}
        />
        </Suspense>
      </div>
    );
  }

  // ════════════════════════════════════════════════════════════════
  // PAGE 1: LOGIN — completely separate full-page design
  // ════════════════════════════════════════════════════════════════
  if (!isLoggedIn) {
    return (
      <ConsoleLogin onLoginSuccess={handleLoginSuccess} />
    );
  }

  // ════════════════════════════════════════════════════════════════
  // PAGE 2: DASHBOARD / WELCOME — completely separate full-page design
  // ════════════════════════════════════════════════════════════════
  if (showDashboard) {
    return (
      <div className="sidepanel-shell view-transition">
        <div className="sidepanel-shell__ambient" aria-hidden="true" />
        <div className="sidepanel-shell__container">
          <DashboardView
            user={authUser}
            onLaunchConsole={handleLaunchConsole}
            onLogout={handleLogout}
          />
        </div>
      </div>
    );
  }

  // ════════════════════════════════════════════════════════════════
  // PAGE 3: CLINICAL UI — the main operational interface
  // ════════════════════════════════════════════════════════════════
  return (
    <div key={`main-${activeTab}`} className="sidepanel-shell view-transition">
      <div className="sidepanel-shell__ambient" aria-hidden="true" />

      <div className="sidepanel-shell__container">
        <div className="sentra-card">
          <SidePanelHeader
            activeEngine={activeEngine}
            onEngineChange={handleEngineChange}
            patientName={visiblePatientName}
            patientAge={patientData.age}
            chronicHistorySummary={patientHistorySummary}
            onRefreshPatient={fetchPatientData}
            isLoadingPatient={isLoadingPatient}
            demographicStatus={demographicStatus}
            historyStatus={historyStatus}
          />

          <section className="sidepanel-shell-content" aria-label="Konten side panel aktif">
            <div className={activeTab === 'ttv' ? 'tab-panel-active' : 'tab-panel-hidden'}>
              <Suspense fallback={<div className="ct-loading-bar">Memuat...</div>}>
              <TTVInferenceUI
                patientName={visiblePatientName}
                patientGender={patientData.gender}
                patientAge={patientData.age}
                patientRM={patientData.rm}
                patientDOB={patientData.dob}
                patientBloodType={patientData.bloodType}
                patientBPJSStatus={patientData.bpjsStatus}
                patientKelurahan={patientData.kelurahan}
                onComplete={handleTTVComplete}
                onAlertsChange={handleAlertsChange}
                showMaskedName={false}
                ttvState={ttvState}
                onTTVStateChange={setTTVState}
                onRefreshPatient={fetchPatientData}
                isLoadingPatient={isLoadingPatient}
                onNavigateToTrajectory={() => setViewState('trajectory')}
                onChronicHistoryChange={setPatientHistorySummary}
                prefilledHistoryFlags={prefilledHistoryFlags}
                extractedSpecialConditions={clinicalContext.specialConditions}
                extractedPregnancyRisk={clinicalContext.pregnancyRisk}
                extractedFacilityName={clinicalContext.facilityName}
                extractedPayerLabel={clinicalContext.payerLabel}
                extractedAllergies={clinicalContext.allergies}
                extractedPregnancyStatus={clinicalContext.pregnancyStatus}
                canonicalOutput={canonicalTrajectoryData}
              />
              </Suspense>
            </div>
            <div className={activeTab === 'emergency' ? 'tab-panel-active' : 'tab-panel-hidden'}>
              <EmergencyDashboard alerts={emergencyAlerts} />
            </div>
            <div className={activeTab === 'agent' ? 'tab-panel-active' : 'tab-panel-hidden'}>
              <AgentPanel />
            </div>
          </section>

          <SidePanelFooter
            workspace="Puskesmas Balowerti"
            section={engineConfig[activeEngine].section}
            loadingPatient={isLoadingPatient}
          />
        </div>
      </div>
    </div>
  );
}

// Emergency Dashboard Component
interface EmergencyDashboardProps {
  alerts: ScreeningAlert[];
}

function EmergencyDashboard({ alerts }: EmergencyDashboardProps) {
  const criticalAlerts = alerts.filter((a) => a.severity === 'critical');
  const highAlerts = alerts.filter((a) => a.severity === 'high');
  const warningAlerts = alerts.filter((a) => a.severity === 'warning');
  const totalActionItems = alerts.reduce((sum, alert) => sum + alert.recommendations.length, 0);

  return (
    <div className="emergency-dashboard">
      {/* Emergency Header */}
      <div className="emergency-header">
        <div className="emergency-header__copy">
          <span className="emergency-header__eyebrow">Clinical Priority Board</span>
          <h2>Emergency Alerts</h2>
          <p className="emergency-header__description">
            Ringkasan alert prioritas tinggi untuk membantu triase cepat dan menentukan tindakan
            berikutnya.
          </p>
        </div>

        <div className="emergency-header__stats">
          <div className="emergency-stat-pill">
            <span className="emergency-stat-pill__label">Alerts</span>
            <span className="emergency-stat-pill__value">{alerts.length}</span>
          </div>
          <div className="emergency-stat-pill">
            <span className="emergency-stat-pill__label">Actions</span>
            <span className="emergency-stat-pill__value">{totalActionItems}</span>
          </div>
        </div>
      </div>

      {/* No Alerts State */}
      {alerts.length === 0 && (
        <div className="emergency-empty">
          <p>Tidak ada alert aktif</p>
          <span>Semua vital sign dan skrining saat ini masih berada dalam ambang aman.</span>
        </div>
      )}

      {/* Critical Alerts Section */}
      {criticalAlerts.length > 0 && (
        <div className="emergency-section emergency-section-critical">
          <h3 className="emergency-section-title">
            <span className="emergency-indicator critical" />
            CRITICAL ({criticalAlerts.length})
          </h3>
          <div className="emergency-cards">
            {criticalAlerts.map((alert) => (
              <EmergencyCard key={alert.id} alert={alert} />
            ))}
          </div>
        </div>
      )}

      {/* High Alerts Section */}
      {highAlerts.length > 0 && (
        <div className="emergency-section emergency-section-high">
          <h3 className="emergency-section-title">
            <span className="emergency-indicator high" />
            HIGH PRIORITY ({highAlerts.length})
          </h3>
          <div className="emergency-cards">
            {highAlerts.map((alert) => (
              <EmergencyCard key={alert.id} alert={alert} />
            ))}
          </div>
        </div>
      )}

      {/* Warning Alerts Section */}
      {warningAlerts.length > 0 && (
        <div className="emergency-section emergency-section-warning">
          <h3 className="emergency-section-title">
            <span className="emergency-indicator warning" />
            WARNING ({warningAlerts.length})
          </h3>
          <div className="emergency-cards">
            {warningAlerts.map((alert) => (
              <EmergencyCard key={alert.id} alert={alert} />
            ))}
          </div>
        </div>
      )}

      {/* Clinical Parameters */}
      {alerts.length > 0 && (
        <div className="emergency-diagram-area">
          <h3>Clinical Parameters</h3>
          <div className="diagram-grid">
            <div className="diagram-card">
              <span className="diagram-label">Blood Pressure</span>
              <span className="diagram-value">
                {alerts.find((a) => a.clinicalData?.map)?.clinicalData?.map
                  ? `MAP: ${alerts.find((a) => a.clinicalData?.map)?.clinicalData?.map} mmHg`
                  : '—'}
              </span>
            </div>
            <div className="diagram-card">
              <span className="diagram-label">Glucose</span>
              <span className="diagram-value">
                {alerts.find((a) => a.gate === 'GATE_3_GLUCOSE')
                  ? alerts.find((a) => a.gate === 'GATE_3_GLUCOSE')?.type === 'hypoglycemia'
                    ? 'LOW'
                    : 'HIGH'
                  : '—'}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Emergency Card Component
function EmergencyCard({ alert }: { alert: ScreeningAlert }) {
  const severityLabel =
    alert.severity === 'critical'
      ? 'Critical'
      : alert.severity === 'high'
        ? 'High Priority'
        : 'Warning';

  return (
    <div className={`emergency-card emergency-card-${alert.severity}`}>
      <div className="emergency-card-header">
        <div className="emergency-card-heading">
          <span className="emergency-card-kicker">{severityLabel}</span>
          <span className="emergency-card-title">{alert.title}</span>
        </div>
        <span className="emergency-card-gate">{alert.gate.replace(/_/g, ' ')}</span>
      </div>

      <div className="emergency-card-block">
        <span className="emergency-card-block-label">Clinical reasoning</span>
        <p className="emergency-card-reasoning">{alert.reasoning}</p>
      </div>

      <div className="emergency-card-recommendations">
        <span className="emergency-card-block-label">Recommended actions</span>
        {alert.recommendations.map((rec, idx) => (
          <div
            key={idx}
            className={`emergency-rec-item ${rec.startsWith('━━━') ? 'emergency-rec-section' : ''}`}
          >
            {rec.startsWith('━━━') ? rec : `→ ${rec}`}
          </div>
        ))}
      </div>
    </div>
  );
}

// Pengaturan (Bridge Config) Panel — simplified, auth handled by auth-store
function PengaturanPanel() {
  const [config, setConfig] = useState<BridgeConfig>({
    enabled: false,
    pollIntervalMinutes: 0.5,
  });
  const [authStatus, setAuthStatus] = useState<'checking' | 'logged_in' | 'not_logged_in'>('checking');
  const [userName, setUserName] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'ok' | 'err'>('idle');
  const [testStatus, setTestStatus] = useState<'idle' | 'loading' | 'ok' | 'err'>('idle');
  const [testMsg, setTestMsg] = useState('');

  useEffect(() => {
    void import('@/lib/api/bridge-client').then((m) => m.getBridgeConfig()).then(setConfig);
    void import('@/lib/api/auth-store').then(async (m) => {
      const session = await m.getSession();
      if (session?.tokens?.accessToken) {
        setAuthStatus('logged_in');
        setUserName(session.user.name || session.user.username);
      } else {
        setAuthStatus('not_logged_in');
      }
    });
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setSaveStatus('idle');
    try {
      const { saveBridgeConfig } = await import('@/lib/api/bridge-client');
      await saveBridgeConfig(config);
      // Notify background to restart/stop poller based on new config
      await chrome.runtime.sendMessage({ type: 'AUTH_STATE_CHANGED' });
      setSaveStatus('ok');
    } catch {
      setSaveStatus('err');
    } finally {
      setSaving(false);
      setTimeout(() => setSaveStatus('idle'), 2500);
    }
  };

  const handleTest = async () => {
    setTestStatus('loading');
    setTestMsg('');
    try {
      const { getOnlineDoctors } = await import('@/lib/api/bridge-client');
      const docs = await getOnlineDoctors();
      setTestStatus('ok');
      setTestMsg(
        docs.length > 0 ? `${docs.length} dokter online` : 'Terhubung — tidak ada dokter online'
      );
    } catch (e) {
      setTestStatus('err');
      setTestMsg(e instanceof Error ? e.message : 'Koneksi gagal');
    }
    setTimeout(() => setTestStatus('idle'), 4000);
  };

  const authLabel =
    authStatus === 'checking' ? 'Memeriksa...'
    : authStatus === 'logged_in' ? `Login sebagai ${userName}`
    : 'Belum login';

  const authColor =
    authStatus === 'logged_in' ? 'var(--status-success)' : 'var(--text-muted)';

  return (
    <div className="pengaturan-shell sentra-card">
      <div className="pengaturan-shell__header">
          <div>
          <div className="text-caption">Bridge Console</div>
          <h3 className="pengaturan-shell__title">Konfigurasi Bridge</h3>
          <p className="pengaturan-shell__subtitle">
            Sinkronisasi Crew Dashboard untuk transfer EMR dan konsultasi dokter online.
          </p>
        </div>

        <div className="pengaturan-shell__toggle">
          <span
            className="text-small"
            style={{ color: config.enabled ? 'var(--status-success)' : 'var(--text-muted)' }}
          >
            {config.enabled ? 'Aktif' : 'Nonaktif'}
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={config.enabled}
            aria-label="Aktifkan bridge dashboard"
            onClick={() => setConfig((c) => ({ ...c, enabled: !c.enabled }))}
            className={`pengaturan-shell__toggle-track ${config.enabled ? 'pengaturan-shell__toggle-track--enabled' : ''}`}
          >
            <div
              className={`pengaturan-shell__toggle-thumb ${config.enabled ? 'pengaturan-shell__toggle-thumb--enabled' : ''}`}
            />
          </button>
        </div>
      </div>

      <div className="pengaturan-shell__field">
        <label className="pengaturan-shell__label">Status Autentikasi</label>
        <div className="pengaturan-shell__auth-status" style={{ color: authColor, fontSize: '13px', padding: '8px 0' }}>
          {authLabel}
        </div>
      </div>

      <div className="pengaturan-shell__actions">
        <button
          onClick={() => void handleTest()}
          disabled={testStatus === 'loading' || authStatus !== 'logged_in'}
          className="shell-secondary-button"
        >
          {testStatus === 'loading' ? 'Testing…' : 'Test Koneksi'}
        </button>
        <button
          onClick={() => void handleSave()}
          disabled={saving}
          className="shell-primary-button"
        >
          {saving ? 'Menyimpan...' : saveStatus === 'ok' ? '✓ Tersimpan' : 'Simpan'}
        </button>
      </div>

      {testMsg && (
        <div
          className={`pengaturan-shell__feedback ${testStatus === 'ok' ? 'pengaturan-shell__feedback--ok' : 'pengaturan-shell__feedback--err'}`}
        >
          {testMsg}
        </div>
      )}

      <div className="pengaturan-shell__note">
        Token otomatis tersedia setelah login. Bridge akan aktif otomatis saat Anda masuk.
      </div>
    </div>
  );
}

// AgentPanel — alias ke PengaturanPanel
function AgentPanel() {
  return <PengaturanPanel />;
}

// Error Boundary to catch runtime crashes and SHOW the error
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[SidePanel] React crash:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            padding: 20,
            color: '#EF4444',
            background: '#0F1115',
            fontFamily: 'monospace',
            fontSize: 12,
          }}
        >
          <h2 style={{ color: '#F59E0B' }}>Ghost Protocols — Runtime Error</h2>
          <pre style={{ whiteSpace: 'pre-wrap', marginTop: 12 }}>{this.state.error?.message}</pre>
          <pre style={{ whiteSpace: 'pre-wrap', marginTop: 8, color: '#888', fontSize: 10 }}>
            {this.state.error?.stack}
          </pre>
          <button
            onClick={() => window.location.reload()}
            style={{
              marginTop: 16,
              padding: '8px 16px',
              background: '#3B82F6',
              color: '#fff',
              border: 'none',
              borderRadius: 6,
              cursor: 'pointer',
            }}
          >
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// Mount React
const rootEl = document.getElementById('root');
if (rootEl) {
  ReactDOM.createRoot(rootEl).render(
    <React.StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </React.StrictMode>
  );
}
