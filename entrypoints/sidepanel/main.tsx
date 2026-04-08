// Designed and constructed by Claudesy.
/**
 * Sentra Assist - Side Panel Entry
 * Updated with TTV Inference UI + Emergency Dashboard + Framer Motion
 */

import type { ScreeningAlert } from '@/components/clinical/TTVInferenceUI'
import type { MedicationRecommendation } from '@/types/api'
import { ConsoleLogin } from '@/components/sidepanel/ConsoleLogin'
import { CreditsView } from '@/components/sidepanel/CreditsView'
import { DashboardView } from '@/components/sidepanel/DashboardView'
import { SidePanelFooter } from '@/components/sidepanel/SidePanelFooter'
import { SidePanelHeader } from '@/components/sidepanel/SidePanelHeader'
import type { AuthUser } from '@/lib/api/auth-store'
import { playSound } from '@/lib/utils/sound'
import type { CanonicalClinicalEngineOutput } from '@/lib/api/bridge-client'
import type { ComposedAnamnesaDraft } from '@/lib/clinical/anamnesa-composer'
import type {
  AutosenPreset,
  DisabilityType,
  ObesityConfirmation,
} from '@/lib/clinical/autosen-types'
import type { TrajectoryAnalysis } from '@/lib/iskandar-diagnosis-engine/trajectory-analyzer'
import type { VisitRecord } from '@/lib/iskandar-diagnosis-engine/visit-history-store'
import { buildRMETransferPayload } from '@/lib/rme/payload-mapper'
import type { RMETransferResult } from '@/utils/types'
import { createLogger } from '@/utils/logger'
import { sendMessage } from '@/utils/messaging'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import React, { Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import ReactDOM from 'react-dom/client'
import './globals.css'
import './style.css'

// Dynamic imports
const ClinicalDifferential = React.lazy(() =>
  import('@/components/clinical/ClinicalDifferential').then((m) => ({
    default: m.ClinicalDifferential,
  }))
)
const ClinicalTrajectory = React.lazy(() =>
  import('@/components/clinical/ClinicalTrajectory').then((m) => ({
    default: m.ClinicalTrajectory,
  }))
)
const TTVInferenceUI = React.lazy(() =>
  import('@/components/clinical/TTVInferenceUI').then((m) => ({ default: m.TTVInferenceUI }))
)
const SettingsConsole = React.lazy(() =>
  import('@/components/clinical/SettingsConsole').then((m) => ({ default: m.SettingsConsole }))
)

// ============================================================================
// TYPES & HELPERS
// ============================================================================
interface PatientData {
  name: string
  gender: 'L' | 'P'
  age: number
  rm: string
  dob: string
  bloodType: string
  bpjsStatus: 'aktif' | 'nonaktif' | 'mandiri' | null
  kelurahan: string
}

type MedicalHistoryEntry = { code: string; description: string; shortLabel: string }
type PrefilledHistoryFlags = Record<string, boolean>
type PrefetchedVisitHistory = {
  visits: VisitRecord[]
  diagnostics: string[]
  status: 'ready' | 'insufficient'
}
type ExtractedClinicalContext = {
  facilityName: string
  payerLabel: string
  specialConditions: string[]
  pregnancyRisk: string
  allergies: string[]
  pregnancyStatus: boolean | null
}

const CHRONIC_FLAG_ORDER = ['dm', 'ht', 'jantung', 'stroke', 'ginjal', 'asma'] as const
const HISTORY_FLAG_META: Record<
  (typeof CHRONIC_FLAG_ORDER)[number],
  { labels: string[]; display: string }
> = {
  dm: { labels: ['DM'], display: 'DM' },
  ht: { labels: ['HT'], display: 'HT' },
  jantung: { labels: ['HF', 'CHD', 'JANTUNG'], display: 'Jantung' },
  stroke: { labels: ['STROKE'], display: 'Stroke' },
  ginjal: { labels: ['CKD', 'GINJAL'], display: 'Ginjal' },
  asma: { labels: ['ASTHMA', 'ASMA'], display: 'Asma' },
}

function mapMedicalHistoryToFlags(entries: MedicalHistoryEntry[]): PrefilledHistoryFlags {
  const flags: PrefilledHistoryFlags = {}
  const labels = new Set(entries.map((entry) => entry.shortLabel.toUpperCase().trim()))
  for (const key of CHRONIC_FLAG_ORDER) {
    flags[key] = HISTORY_FLAG_META[key].labels.some((label) => labels.has(label))
  }
  return flags
}

function createEmptyHistoryFlags(): PrefilledHistoryFlags {
  return CHRONIC_FLAG_ORDER.reduce((acc, key) => {
    acc[key] = false
    return acc
  }, {} as PrefilledHistoryFlags)
}

function buildHistorySummary(flags: PrefilledHistoryFlags): string {
  const selected = CHRONIC_FLAG_ORDER.filter((key) => flags[key]).map(
    (key) => HISTORY_FLAG_META[key].display
  )
  return selected.length > 0 ? selected.join(', ') : 'Menunggu Input'
}

const normalizePatientNameForDisplay = (name?: string): string => {
  const n = name?.trim()
  return !n || n.includes('Error') || n.includes('tidak ditemukan') ? '---' : n
}

type TabType = 'ttv' | 'emergency' | 'agent'
type ViewState = 'main' | 'trajectory' | 'differential'
type EngineId = 'vs' | 'emergency' | 'settings'

export interface TTVFormState {
  sbp: string
  dbp: string
  hr: string
  rr: string
  temp: string
  spo2: string
  glucose: string
  symptomText: string
  allergies: string[]
  pregnancyStatus: boolean | null
  disabilityType: DisabilityType
  obesityConfirmation: ObesityConfirmation
  autosenPreset: AutosenPreset
  avpu: 'A' | 'C' | 'V' | 'P' | 'U'
  supplemental_o2: boolean
  pain_score: string
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
  avpu: 'A',
  supplemental_o2: false,
  pain_score: '',
}

const defaultPatient: PatientData = {
  name: 'Memuat...',
  gender: 'L',
  age: 0,
  rm: '-',
  dob: '',
  bloodType: '',
  bpjsStatus: null,
  kelurahan: '',
}
const defaultClinicalContext: ExtractedClinicalContext = {
  facilityName: '',
  payerLabel: '',
  specialConditions: [],
  pregnancyRisk: '',
  allergies: [],
  pregnancyStatus: null,
}
const engineConfig: Record<EngineId, { section: string }> = {
  vs: { section: 'VS Inference' },
  emergency: { section: 'Emergency' },
  settings: { section: 'Pengaturan' },
}
const sidepanelLog = createLogger('SidepanelMain', 'global')

// ============================================================================
// MAIN APP COMPONENT
// ============================================================================
function App() {
  const reduceMotion = useReducedMotion() === true

  /** Opacity + translateY only (no blur/scale — avoids jank in narrow side panels). */
  const pageVariants = useMemo(
    () =>
      reduceMotion
        ? {
            initial: { opacity: 0 },
            enter: { opacity: 1, transition: { duration: 0.15, ease: 'easeOut' as const } },
            exit: { opacity: 0, transition: { duration: 0.12, ease: 'easeIn' as const } },
          }
        : {
            initial: { opacity: 0, y: 10 },
            enter: {
              opacity: 1,
              y: 0,
              transition: { duration: 0.36, ease: [0.22, 1, 0.36, 1] as const },
            },
            exit: {
              opacity: 0,
              y: -6,
              transition: { duration: 0.22, ease: [0.4, 0, 1, 1] as const },
            },
          },
    [reduceMotion]
  )

  /** Slightly faster / shorter travel than full-page routes (engine tabs inside main UI). */
  const tabPanelVariants = useMemo(
    () =>
      reduceMotion
        ? {
            initial: { opacity: 0 },
            enter: { opacity: 1, transition: { duration: 0.12, ease: 'easeOut' as const } },
            exit: { opacity: 0, transition: { duration: 0.1, ease: 'easeIn' as const } },
          }
        : {
            initial: { opacity: 0, y: 10 },
            enter: {
              opacity: 1,
              y: 0,
              transition: { duration: 0.36, ease: [0.22, 1, 0.36, 1] as const },
            },
            exit: {
              opacity: 0,
              y: -8,
              transition: { duration: 0.22, ease: [0.4, 0, 1, 1] as const },
            },
          },
    [reduceMotion]
  )

  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [showDashboard, setShowDashboard] = useState(true)
  const [showCredits, setShowCredits] = useState(false)
  const [authUser, setAuthUser] = useState<AuthUser | null>(null)
  const [activeTab, setActiveTab] = useState<TabType>('ttv')
  const [viewState, setViewState] = useState<ViewState>('main')
  const [emergencyAlerts, setEmergencyAlerts] = useState<ScreeningAlert[]>([])
  const [activeEngine, setActiveEngine] = useState<EngineId>('vs')
  const [ttvState, setTTVState] = useState<TTVFormState>(initialTTVState)
  const [patientData, setPatientData] = useState<PatientData>(defaultPatient)
  const [isLoadingPatient, setIsLoadingPatient] = useState(true)
  const [patientHistorySummary, setPatientHistorySummary] = useState('Menunggu Input')
  const [prefilledHistoryFlags, setPrefilledHistoryFlags] =
    useState<PrefilledHistoryFlags>(createEmptyHistoryFlags)
  const [clinicalContext, setClinicalContext] =
    useState<ExtractedClinicalContext>(defaultClinicalContext)
  const [prefetchedVisitHistory, setPrefetchedVisitHistory] =
    useState<PrefetchedVisitHistory | null>(null)
  const [anamnesaDraft, setAnamnesaDraft] = useState<ComposedAnamnesaDraft | null>(null)
  const [trajectoryData, setTrajectoryData] = useState<TrajectoryAnalysis | undefined>(undefined)
  const [canonicalTrajectoryData, setCanonicalTrajectoryData] =
    useState<CanonicalClinicalEngineOutput | null>(null)
  const [visitCount, setVisitCount] = useState<number>(0)
  const [diagnosisDraft, setDiagnosisDraft] = useState<{ icd_x: string; nama: string } | null>(null)
  const [medicationsDraft, setMedicationsDraft] = useState<MedicationRecommendation[]>([])

  const visiblePatientName = normalizePatientNameForDisplay(patientData.name)
  const demographicStatus = isLoadingPatient
    ? 'syncing'
    : visiblePatientName !== '---' && patientData.rm !== '-'
      ? 'ready'
      : 'standby'
  const historyStatus = isLoadingPatient
    ? 'syncing'
    : prefetchedVisitHistory?.status === 'ready'
      ? 'ready'
      : prefetchedVisitHistory?.status === 'insufficient'
        ? 'insufficient'
        : 'standby'

  useEffect(() => {
    void (async () => {
      try {
        const { getStoredSession } = await import('@/lib/api/auth-client')
        const session = await getStoredSession()
        if (session?.user) {
          setAuthUser(session.user)
          setIsLoggedIn(true)
          setShowDashboard(true)
        }
      } catch {
        /* no stored session */
      }
    })()
  }, [])

  const handleLoginSuccess = useCallback((user: AuthUser) => {
    setAuthUser(user)
    setIsLoggedIn(true)
    setShowDashboard(true)
    playSound('hello.mp3')
  }, [])
  const handleLaunchConsole = useCallback(() => setShowDashboard(false), [])
  const handleLogout = useCallback(() => {
    void (async () => {
      try {
        const { logout } = await import('@/lib/api/auth-client')
        await logout()
      } catch {
        /* best-effort logout */
      }
      setIsLoggedIn(false)
      setShowDashboard(true)
      setAuthUser(null)
    })()
  }, [])

  const handleEngineChange = useCallback((id: string) => {
    const next = id as EngineId
    setActiveEngine(next)
    if (next === 'emergency') setActiveTab('emergency')
    else if (next === 'settings') setActiveTab('agent')
    else setActiveTab('ttv')
  }, [])

  const fetchPatientData = useCallback(async () => {
    setIsLoadingPatient(true)
    setPrefilledHistoryFlags(createEmptyHistoryFlags())
    setPatientHistorySummary('Menunggu Input')
    setClinicalContext(defaultClinicalContext)
    setAnamnesaDraft(null)
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
      if (!tab?.id) return
      const [pRes, mHRes, vHRes, cCRes] = await Promise.allSettled([
        chrome.tabs.sendMessage(tab.id, { type: 'getPatientInfo' }),
        sendMessage('scanMedicalHistory', undefined),
        sendMessage('scanVisitHistory', undefined),
        sendMessage('scanClinicalContext', undefined),
      ])
      if (pRes.status === 'fulfilled' && pRes.value?.success) {
        const p = pRes.value.patient
        setPatientData({
          name: p.name,
          gender: p.gender,
          age: p.age,
          rm: p.rm,
          dob: p.dob,
          bloodType: '',
          bpjsStatus: p.bpjsStatus,
          kelurahan: p.kelurahan,
        })
      }
      if (mHRes.status === 'fulfilled' && mHRes.value?.success) {
        const flags = mapMedicalHistoryToFlags(mHRes.value.history)
        setPrefilledHistoryFlags(flags)
        setPatientHistorySummary(buildHistorySummary(flags))
      }
      if (vHRes.status === 'fulfilled' && vHRes.value?.success) {
        type Row = {
          encounter_id: string
          date: string
          vitals: VisitRecord['vitals']
          keluhan_utama: string
          diagnosa?: VisitRecord['diagnosa']
        }
        const rows = (vHRes.value.visits || []) as Row[]
        const visits: VisitRecord[] = rows.slice(0, 5).map((v) => ({
          patient_id: patientData.rm,
          encounter_id: v.encounter_id,
          timestamp: v.date,
          vitals: v.vitals,
          keluhan_utama: v.keluhan_utama,
          diagnosa: v.diagnosa,
          source: 'scrape',
        }))
        setPrefetchedVisitHistory({
          visits,
          diagnostics: vHRes.value.diagnostics || [],
          status: visits.length >= 3 ? 'ready' : 'insufficient',
        })
      }
      if (cCRes.status === 'fulfilled' && cCRes.value?.success && cCRes.value.context) {
        const c = cCRes.value.context
        setClinicalContext((prev) => ({
          ...prev,
          facilityName: c.facilityName ?? prev.facilityName,
          payerLabel: c.payerLabel ?? prev.payerLabel,
          pregnancyRisk: c.pregnancyRisk ?? prev.pregnancyRisk,
          specialConditions: c.specialConditions ?? prev.specialConditions,
          allergies: c.allergies ?? prev.allergies,
          ...(c.pregnancyStatus !== undefined ? { pregnancyStatus: c.pregnancyStatus } : {}),
        }))
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : 'unknown error'
      sidepanelLog.warn('fetchPatientData failed', { message })
    } finally {
      setIsLoadingPatient(false)
    }
  }, [patientData.rm])

  const [theme, setTheme] = useState('dark');

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
  };

  useEffect(() => {
    const t = setTimeout(() => fetchPatientData(), 500)
    return () => clearTimeout(t)
  }, [fetchPatientData])

  return (
    <div className="shell-route-stage">
      <AnimatePresence mode="wait" initial={false}>
        {showCredits ? (
          <motion.div
            key="credits"
            role="presentation"
            initial="initial"
            animate="enter"
            exit="exit"
            variants={pageVariants}
            className="shell-route-motion w-full min-h-screen"
          >
            <CreditsView onBack={() => setShowCredits(false)} />
          </motion.div>
        ) : !isLoggedIn ? (
          <motion.div
            key="login"
            role="presentation"
            initial="initial"
            animate="enter"
            exit="exit"
            variants={pageVariants}
            className="shell-route-motion w-full min-h-screen"
          >
            <ConsoleLogin onLoginSuccess={handleLoginSuccess} />
          </motion.div>
        ) : showDashboard ? (
          <motion.div
            key="dash"
            role="presentation"
            initial="initial"
            animate="enter"
            exit="exit"
            variants={pageVariants}
            className="shell-route-motion w-full min-h-screen"
          >
            <DashboardView
              user={authUser}
              onLaunchConsole={handleLaunchConsole}
              onLogout={handleLogout}
            />
          </motion.div>
        ) : viewState === 'trajectory' ? (
          <motion.div
            key="traj"
            role="presentation"
            initial="initial"
            animate="enter"
            exit="exit"
            variants={pageVariants}
            className="shell-route-motion w-full min-h-screen"
          >
            <Suspense
              fallback={
                <div className="animate-pulse text-center py-20 text-[var(--text-muted)]">
                  Loading Trajectory...
                </div>
              }
            >
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
                  keluhan_utama:
                    anamnesaDraft?.payload.keluhan_utama || ttvState.symptomText || '-',
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
                onNextDifferential={(traj, count, canon) => {
                  setTrajectoryData(traj)
                  setCanonicalTrajectoryData(canon)
                  setVisitCount(count)
                  setViewState('differential')
                }}
              />
            </Suspense>
          </motion.div>
        ) : viewState === 'differential' ? (
          <motion.div
            key="diff"
            role="presentation"
            initial="initial"
            animate="enter"
            exit="exit"
            variants={pageVariants}
            className="shell-route-motion w-full min-h-screen"
          >
            <Suspense
              fallback={
                <div className="animate-pulse text-center py-20 text-[var(--text-muted)]">
                  Loading Differential...
                </div>
              }
            >
              <ClinicalDifferential
                keluhanUtama={anamnesaDraft?.payload.keluhan_utama || ttvState.symptomText || '-'}
                keluhanTambahan={anamnesaDraft?.payload.keluhan_tambahan || ''}
                patientAge={patientData.age}
                patientGender={patientData.gender}
                patientRM={patientData.rm}
                allergies={ttvState.allergies}
                confirmedPregnancyStatus={
                  patientData.gender === 'L' ? false : ttvState.pregnancyStatus
                }
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
                onDiagnosisChange={setDiagnosisDraft}
                onMedicationsChange={setMedicationsDraft}
              />
            </Suspense>
          </motion.div>
        ) : (
          <motion.div
            key="main"
            role="presentation"
            initial="initial"
            animate="enter"
            exit="exit"
            variants={pageVariants}
            className="shell-route-motion w-full min-h-screen"
          >
            <div className="sidepanel-shell p-4 flex flex-col gap-4 overflow-y-auto min-h-screen">
              <div className="sentra-card flex flex-col h-full" data-sentra-id="main-container">
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
                  doctorOnlineCount={0}
                  onInitialisasi={() => {
                    setPatientData(defaultPatient)
                    setTTVState(initialTTVState)
                    void fetchPatientData()
                  }}
                  onToggleTheme={toggleTheme}
                />
                <section
                  className="flex-1 min-h-0 overflow-y-auto p-4 relative"
                  aria-label="Konten tab engine"
                >
                  <AnimatePresence mode="wait" initial={false}>
                    {activeTab === 'ttv' ? (
                      <motion.div
                        key="tab-ttv"
                        role="tabpanel"
                        id="sidepanel-tabpanel-ttv"
                        aria-labelledby="sidepanel-tab-ttv"
                        initial="initial"
                        animate="enter"
                        exit="exit"
                        variants={tabPanelVariants}
                        className="shell-tab-panel w-full"
                      >
                        <Suspense
                          fallback={
                            <div className="animate-pulse text-center py-8 text-[var(--text-muted)]">
                              Loading UI...
                            </div>
                          }
                        >
                          <TTVInferenceUI
                            patientName={visiblePatientName}
                            patientGender={patientData.gender}
                            patientAge={patientData.age}
                            patientRM={patientData.rm}
                            patientDOB={patientData.dob}
                            patientBloodType={patientData.bloodType}
                            patientBPJSStatus={patientData.bpjsStatus}
                            patientKelurahan={patientData.kelurahan}
                            onComplete={(d) => {
                              setAnamnesaDraft(d.anamnesaDraft)
                            }}
                            onAlertsChange={setEmergencyAlerts}
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
                            prefetchedVisits={prefetchedVisitHistory?.visits}
                            onSentraUplink={async () => {
                              sidepanelLog.debug('Sentra Uplink triggered', { patientRM: patientData.rm })

                              // Resolve dokter/perawat from current ePuskesmas page
                              let tenagaMedis: { dokterNama?: string; perawatNama?: string } = {}
                              try {
                                const tmRes = await sendMessage('resolveTenagaMedis', undefined)
                                if (tmRes?.success && tmRes.tenagaMedis) {
                                  tenagaMedis = {
                                    dokterNama: tmRes.tenagaMedis.dokterNama || undefined,
                                    perawatNama: tmRes.tenagaMedis.perawatNama || undefined,
                                  }
                                }
                              } catch { /* non-blocking — transfer still proceeds */ }

                              const { payload } = buildRMETransferPayload({
                                keluhanUtama: anamnesaDraft?.payload.keluhan_utama || ttvState.symptomText || '',
                                keluhanTambahan: anamnesaDraft?.payload.keluhan_tambahan || '',
                                patientGender: patientData.gender || 'L',
                                pregnancyStatus: ttvState.pregnancyStatus,
                                allergies: ttvState.allergies,
                                vitalSigns: {
                                  sbp: parseInt(ttvState.sbp) || undefined,
                                  dbp: parseInt(ttvState.dbp) || undefined,
                                  hr: parseInt(ttvState.hr) || undefined,
                                  rr: parseInt(ttvState.rr) || undefined,
                                  temp: parseFloat(ttvState.temp) || undefined,
                                  glucose: parseInt(ttvState.glucose) || undefined,
                                },
                                diagnosis: diagnosisDraft,
                                medications: medicationsDraft.length > 0 ? medicationsDraft : undefined,
                                tenagaMedis,
                                trajectory: trajectoryData,
                                hasVisitHistory: !!(prefetchedVisitHistory?.visits?.length),
                                // Extended TTV state → fills 40+ extra anamnesa fields
                                spo2: parseInt(ttvState.spo2) || undefined,
                                avpu: ttvState.avpu,
                                painScore: ttvState.pain_score ? parseInt(ttvState.pain_score) : undefined,
                                disabilityType: ttvState.disabilityType || undefined,
                                anamnesaDraftPayload: anamnesaDraft?.payload,
                              })
                              const result = await sendMessage('transferRME', payload) as RMETransferResult | null
                              if (result && result.state === 'failed') {
                                const reason = result.reasonCodes?.join(', ') || 'unknown'
                                throw new Error(`Gagal mengisi RME (${reason}). Reload halaman ePuskesmas lalu coba lagi.`)
                              }
                            }}
                          />
                        </Suspense>
                      </motion.div>
                    ) : activeTab === 'emergency' ? (
                      <motion.div
                        key="tab-emergency"
                        role="tabpanel"
                        id="sidepanel-tabpanel-emergency"
                        aria-labelledby="sidepanel-tab-emergency"
                        initial="initial"
                        animate="enter"
                        exit="exit"
                        variants={tabPanelVariants}
                        className="shell-tab-panel w-full"
                      >
                        <EmergencyDashboard alerts={emergencyAlerts} />
                      </motion.div>
                    ) : (
                      <motion.div
                        key="tab-agent"
                        role="tabpanel"
                        id="sidepanel-tabpanel-agent"
                        aria-labelledby="sidepanel-tab-agent"
                        initial="initial"
                        animate="enter"
                        exit="exit"
                        variants={tabPanelVariants}
                        className="shell-tab-panel w-full"
                      >
                        <Suspense
                          fallback={
                            <div className="animate-pulse text-center py-10 text-[var(--text-muted)] text-xs">
                              Loading...
                            </div>
                          }
                        >
                          <SettingsConsole />
                        </Suspense>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </section>
                <SidePanelFooter
                  workspace="Puskesmas Balowerti"
                  section={engineConfig[activeEngine].section}
                  loadingPatient={isLoadingPatient}
                  onShowCredits={() => setShowCredits(true)}
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// --- SUBCOMPONENTS (EmergencyDashboard, ErrorBoundary) ---
function EmergencyDashboard({ alerts }: { alerts: ScreeningAlert[] }) {
  return (
    <div className="emergency-dashboard">
      <div className="emergency-header">
        <div className="emergency-header__eyebrow">SENTRA ASSIST — EMERGENCY</div>
        <h2>Alert Klinis Aktif</h2>
        <div className="emergency-header__stats">
          <div className="emergency-stat-pill">
            <span className="emergency-stat-pill__label">TOTAL</span>
            <span className="emergency-stat-pill__value">{alerts.length}</span>
          </div>
          <div className="emergency-stat-pill">
            <span className="emergency-stat-pill__label">KRITIS</span>
            <span className="emergency-stat-pill__value">
              {alerts.filter((a) => a.severity === 'critical').length}
            </span>
          </div>
        </div>
      </div>

      {alerts.length === 0 ? (
        <div className="emergency-empty">
          <p>Tidak ada alert aktif</p>
          <span>Sistem monitoring berjalan normal</span>
        </div>
      ) : (
        <div className="emergency-section">
          <div className="emergency-cards">
            {alerts.map((a) => (
              <div
                key={a.id}
                className={`emergency-card emergency-card-${a.severity}`}
              >
                <div className="emergency-card-header">
                  <div className="emergency-card-heading">
                    <span className="emergency-card-kicker">{a.severity.toUpperCase()}</span>
                    <span className="emergency-card-title">{a.title}</span>
                  </div>
                  <div className={`emergency-indicator ${a.severity}`} />
                </div>
                {a.reasoning ? (
                  <p className="emergency-card-reasoning">{a.reasoning}</p>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props)
    this.state = { hasError: false, error: null }
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error }
  }
  render() {
    if (this.state.hasError)
      return (
        <div className="p-10 bg-black text-red-500 font-mono text-xs">
          <h1 className="text-orange-500 text-lg mb-4">CRITICAL RUNTIME ERROR</h1>
          <pre>{this.state.error?.message}</pre>
          <button
            onClick={() => window.location.reload()}
            className="mt-6 px-4 py-2 bg-blue-600 text-white rounded"
          >
            REBOOT SYSTEM
          </button>
        </div>
      )
    return this.props.children
  }
}

const rootEl = document.getElementById('root')
if (rootEl) {
  ReactDOM.createRoot(rootEl).render(
    <React.StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </React.StrictMode>
  )
}
