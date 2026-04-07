// Ghost Protocols — Iskandar Diagnosis Engine V1
// Ported 1:1 from console-boot-demo.html reference design

import React, { useCallback, useEffect, useRef } from 'react'

interface EngineButton {
  id: string
  label: string
}

type ShellStatus = 'standby' | 'syncing' | 'ready' | 'insufficient'

/** Matches `id` on tabpanels in main.tsx (`sidepanel-tabpanel-*`). */
const ENGINE_TAB_PANEL_ID: Record<string, string> = {
  vs: 'sidepanel-tabpanel-ttv',
  emergency: 'sidepanel-tabpanel-emergency',
  settings: 'sidepanel-tabpanel-agent',
}

const ENGINE_TAB_TRIGGER_ID: Record<string, string> = {
  vs: 'sidepanel-tab-ttv',
  emergency: 'sidepanel-tab-emergency',
  settings: 'sidepanel-tab-agent',
}

const ENGINE_TAB_ORDER = ['vs', 'emergency', 'settings'] as const

interface SidePanelHeaderProps {
  activeEngine: string
  onEngineChange: (engineId: string) => void
  patientName?: string
  patientAge?: number
  chronicHistorySummary?: string
  onRefreshPatient?: () => void | Promise<void>
  isLoadingPatient?: boolean
  demographicStatus?: ShellStatus
  historyStatus?: ShellStatus
  bootMode?: boolean
  doctorOnlineCount?: number
  onInitialisasi?: () => void
}

const engineButtons: EngineButton[] = [
  { id: 'vs', label: 'VS Inference' },
  { id: 'emergency', label: 'Emergency' },
  { id: 'settings', label: 'Pengaturan' },
]

export const SidePanelHeader: React.FC<SidePanelHeaderProps> = ({
  activeEngine,
  onEngineChange,
  patientName = '---',
  patientAge = 0,
  chronicHistorySummary = 'Menunggu Input',
  onRefreshPatient,
  isLoadingPatient = false,
  demographicStatus = 'standby',
  bootMode = false,
  doctorOnlineCount = 0,
  onInitialisasi,
}) => {
  const resolvedAgeText = patientAge > 0 ? `${patientAge} tahun` : '--'
  const isReady = demographicStatus === 'ready'
  const statusLabel = isLoadingPatient ? 'Syncing' : isReady ? 'Ready' : 'Standby'
  const demogReady = demographicStatus === 'ready'
  const doctorOnline = (doctorOnlineCount ?? 0) > 0

  const skipFocusSyncRef = useRef(true)

  const handleEngineTabKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLButtonElement>, engineId: string) => {
      const order = ENGINE_TAB_ORDER
      const i = order.indexOf(engineId as (typeof order)[number])
      if (i < 0) return

      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        e.preventDefault()
        const next =
          e.key === 'ArrowRight' ? (i + 1) % order.length : (i - 1 + order.length) % order.length
        onEngineChange(order[next])
        return
      }

      if (e.key === 'Home') {
        e.preventDefault()
        onEngineChange(order[0])
        return
      }

      if (e.key === 'End') {
        e.preventDefault()
        onEngineChange(order[order.length - 1])
      }
    },
    [onEngineChange]
  )

  useEffect(() => {
    if (skipFocusSyncRef.current) {
      skipFocusSyncRef.current = false
      return
    }
    const id = ENGINE_TAB_TRIGGER_ID[activeEngine]
    if (!id) return
    document.getElementById(id)?.focus({ preventScroll: true })
  }, [activeEngine])

  return (
    <div className="card-header">
      {/* Title — compact, no spacers */}
      <div className="header-top">
        {bootMode && (
          <div className="boot-logo-container">
            <svg className="logo-svg" viewBox="0 0 60 40" fill="none" aria-hidden="true">
              <text x="0" y="28" fill="#F4EFE6" fontSize="24" fontWeight="700" fontFamily="Inter">
                S
              </text>
              <circle cx="32" cy="20" r="14" stroke="#F4EFE6" strokeWidth="2" fill="none" />
              <circle cx="32" cy="20" r="5" fill="#F4EFE6" />
            </svg>
            <span className="version-badge">MedPro</span>
          </div>
        )}
        <div className={bootMode ? 'boot-title-group' : 'title-group'}>
          <h1 className="card-title-main">Sentra Assist</h1>
          <p className="card-title-sub">Architected by dr Ferdi Iskandar</p>
        </div>
      </div>

      {/* Engine tabs — paired with tabpanels in main.tsx (sidepanel-tabpanel-*) */}
      <div className="engine-row engine-tablist" role="tablist" aria-label="Modul engine klinis">
        {engineButtons.map((engine) => {
          const selected = activeEngine === engine.id
          const panelId = ENGINE_TAB_PANEL_ID[engine.id]
          const triggerId = ENGINE_TAB_TRIGGER_ID[engine.id]
          return (
            <button
              key={engine.id}
              id={triggerId}
              type="button"
              role="tab"
              tabIndex={selected ? 0 : -1}
              aria-selected={selected}
              aria-controls={panelId}
              className={`engine-btn engine-tab ${selected ? 'active' : ''}`}
              onClick={() => onEngineChange(engine.id)}
              onKeyDown={(e) => handleEngineTabKeyDown(e, engine.id)}
            >
              {engine.label}
            </button>
          )
        })}
      </div>

      {/* Patient info — exactly 2 rows */}
      <div className="patient-bar">
        {/* Row 1: Name (left) + Age (right) + Status dot */}
        <div className="patient-row-top">
          <span className="patient-name" title={patientName}>
            {patientName}
          </span>
          <span className="patient-age">{resolvedAgeText}</span>
          <button
            type="button"
            className="status-indicator"
            onClick={() => void onRefreshPatient?.()}
            disabled={!onRefreshPatient || isLoadingPatient}
            aria-label={`Status: ${statusLabel}. Klik untuk refresh`}
          >
            <div
              className={`status-dot ${isReady ? 'status-dot--ready' : ''} ${isLoadingPatient ? 'status-dot--syncing' : ''}`}
            />
            <span className="status-text">{statusLabel}</span>
          </button>
        </div>
        {/* Row 2: History (full width, single line ellipsis) */}
        <div className="patient-row-bottom">
          <span className="patient-history-label">Riwayat</span>
          <span className="patient-history" title={chronicHistorySummary}>
            {chronicHistorySummary}
          </span>
        </div>
      </div>

      {/* Status bar — Inisialisasi | Demograf | Dokter */}
      <div className="status-bar" role="group" aria-label="Status sistem">
        <button
          type="button"
          className="status-chip status-chip--action"
          onClick={onInitialisasi}
          disabled={!onInitialisasi}
          aria-label="Inisialisasi — reset dan muat ulang data RME"
        >
          <span className="status-chip__icon" aria-hidden="true">🔄</span>
          <span className="status-chip__label">Inisialisasi</span>
        </button>

        <div
          className={`status-chip ${demogReady ? 'status-chip--ready' : 'status-chip--syn'}`}
          aria-label={`Demografi: ${demogReady ? 'Siap' : 'Sinkronisasi'}`}
          role="status"
        >
          <span className="status-chip__icon status-chip__icon--text">
            {demogReady ? 'OK' : 'SYN'}
          </span>
          <span className="status-chip__label">Demograf</span>
        </div>

        <div
          className={`status-chip ${doctorOnline ? 'status-chip--ready' : 'status-chip--offline'}`}
          aria-label={`Dokter: ${doctorOnline ? 'Online' : 'Offline'}`}
          role="status"
        >
          <span className="status-chip__icon status-chip__icon--text">
            {doctorOnline ? 'ON' : 'OFF'}
          </span>
          <span className="status-chip__label">Dokter</span>
        </div>
      </div>
    </div>
  )
}

export { SidePanelHeader as default }
