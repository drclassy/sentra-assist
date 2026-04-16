// Ghost Protocols — Iskandar Diagnosis Engine V1
// Ported 1:1 from console-boot-demo.html reference design

import React, { useCallback, useEffect, useRef } from 'react';
import ThemeToggle from '../ui/ThemeToggle';

interface EngineButton {
  id: string;
  label: string;
}

type ShellStatus = 'standby' | 'syncing' | 'ready' | 'insufficient';

/** Matches `id` on tabpanels in main.tsx (`sidepanel-tabpanel-*`). */
const ENGINE_TAB_PANEL_ID: Record<string, string> = {
  vs: 'sidepanel-tabpanel-ttv',
  emergency: 'sidepanel-tabpanel-emergency',
  settings: 'sidepanel-tabpanel-agent',
};

const ENGINE_TAB_TRIGGER_ID: Record<string, string> = {
  vs: 'sidepanel-tab-ttv',
  emergency: 'sidepanel-tab-emergency',
  settings: 'sidepanel-tab-agent',
};

const ENGINE_TAB_ORDER = ['vs', 'emergency', 'settings'] as const;

interface SidePanelHeaderProps {
  activeEngine: string;
  onEngineChange: (engineId: string) => void;
  patientName?: string;
  patientAge?: number;
  chronicHistorySummary?: string;
  onRefreshPatient?: () => void | Promise<void>;
  isLoadingPatient?: boolean;
  demographicStatus?: ShellStatus;
  historyStatus?: ShellStatus;
  doctorOnlineCount?: number;
  onInitialisasi?: () => void;
  alertCount?: number;
}

const engineButtons: EngineButton[] = [
  { id: 'vs', label: 'VS Inference' },
  { id: 'emergency', label: 'Emergency' },
  { id: 'settings', label: 'Pengaturan' },
];

export const SidePanelHeader: React.FC<SidePanelHeaderProps> = ({
  activeEngine,
  onEngineChange,
  patientName = '---',
  patientAge = 0,
  chronicHistorySummary = 'Menunggu Input',
  onRefreshPatient,
  isLoadingPatient = false,
  demographicStatus = 'standby',
  doctorOnlineCount = 0,
  onInitialisasi,
  alertCount = 0,
}) => {
  const isReady = demographicStatus === 'ready';
  const doctorOnline = doctorOnlineCount > 0;
  const normalizedPatientName = patientName.trim();
  const patientNameValue = normalizedPatientName || '---';
  const patientNameDisplay = /^memuat/i.test(patientNameValue)
    ? 'NAMA .... Memuat'
    : `NAMA .... ${patientNameValue}`;
  const patientAgeDisplay = patientAge > 0 ? `USIA .... ${patientAge} tahun` : 'USIA .... --';
  const patientHistoryDisplay = chronicHistorySummary
    ? `RIWAYAT .... ${chronicHistorySummary}`
    : 'RIWAYAT .... Menunggu Input';

  const skipFocusSyncRef = useRef(true);

  const handleEngineTabKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLButtonElement>, engineId: string) => {
      const order = ENGINE_TAB_ORDER;
      const i = order.indexOf(engineId as (typeof order)[number]);
      if (i < 0) return;

      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        e.preventDefault();
        const next =
          e.key === 'ArrowRight' ? (i + 1) % order.length : (i - 1 + order.length) % order.length;
        onEngineChange(order[next]);
        return;
      }

      if (e.key === 'Home') {
        e.preventDefault();
        onEngineChange(order[0]);
        return;
      }

      if (e.key === 'End') {
        e.preventDefault();
        onEngineChange(order[order.length - 1]);
      }
    },
    [onEngineChange]
  );

  useEffect(() => {
    if (skipFocusSyncRef.current) {
      skipFocusSyncRef.current = false;
      return;
    }
    const id = ENGINE_TAB_TRIGGER_ID[activeEngine];
    if (!id) return;
    document.getElementById(id)?.focus({ preventScroll: true });
  }, [activeEngine]);

  return (
    <div className="card-header">
      {/* Title — knob kiri atas, judul tengah */}
      <div className="header-top relative flex justify-center items-start">
        <div className="absolute left-0 top-0">
          <ThemeToggle />
        </div>
        <div className="title-group text-center">
          <h1 className="card-title-main">Sentra Assist</h1>
          <p className="card-title-sub">Architected by dr Ferdi Iskandar</p>
        </div>
      </div>

      {/* Engine tabs — paired with tabpanels in main.tsx (sidepanel-tabpanel-*) */}
      <div className="engine-row engine-tablist" role="tablist" aria-label="Modul engine klinis">
        {engineButtons.map((engine) => {
          const selected = activeEngine === engine.id;
          const panelId = ENGINE_TAB_PANEL_ID[engine.id];
          const triggerId = ENGINE_TAB_TRIGGER_ID[engine.id];
          return (
            <button
              key={engine.id}
              id={triggerId}
              type="button"
              role="tab"
              tabIndex={selected ? 0 : -1}
              aria-selected={selected}
              aria-controls={panelId}
              className={`engine-btn engine-tab ${selected ? 'active' : ''}${engine.id === 'emergency' && alertCount > 0 ? ' engine-btn--alert-active' : ''}`}
              onClick={() => onEngineChange(engine.id)}
              onKeyDown={(e) => handleEngineTabKeyDown(e, engine.id)}
            >
              {engine.label}
              {engine.id === 'emergency' && alertCount > 0 && (
                <span className="engine-tab-dot" aria-label={`${alertCount} temuan klinis aktif`} />
              )}
            </button>
          );
        })}
      </div>

      {/* Status bar — Inisialisasi | Demograf | Dokter */}
      <div className="hdr-statusbar" role="group" aria-label="Status sistem">
        <button
          type="button"
          className="engine-btn engine-tab"
          onClick={onInitialisasi}
          aria-label="Inisialisasi — reset dan muat ulang data RME"
        >
          Inisialisasi
        </button>

        <button
          type="button"
          className={`engine-btn engine-tab ${isReady ? 'active' : ''}`}
          aria-label={`Demografi: ${isReady ? 'Siap' : 'Sinkronisasi'}`}
          onClick={() => void onRefreshPatient?.()}
          disabled={!onRefreshPatient || isLoadingPatient}
        >
          Demograf {isReady ? 'OK' : 'SYN'}
        </button>

        <div
          className={`engine-btn engine-tab doctor-avail-chip ${
            doctorOnline ? 'doctor-avail-chip--available' : 'doctor-avail-chip--unavailable'
          }`}
          aria-label={`Dokter: ${doctorOnline ? 'Online' : 'Offline'}`}
          role="status"
        >
          {doctorOnline ? 'Dokter On' : 'Dokter Off'}
        </div>
      </div>

      {/* Patient info — 2 rows, uniform LABEL .... VALUE format */}
      <div className="patient-bar">
        {/* Row 1: NAMA .... Ahmad   USIA .... 40 tahun */}
        <div className="patient-row-top">
          <span className="patient-field" title={patientNameDisplay}>
            {patientNameDisplay}
          </span>
          <span className="patient-field patient-field--right" title={patientAgeDisplay}>
            {patientAgeDisplay}
          </span>
        </div>
        {/* Row 2: RIWAYAT .... [history] */}
        <div className="patient-row-bottom">
          <span className="patient-field patient-field--full" title={patientHistoryDisplay}>
            {patientHistoryDisplay}
          </span>
        </div>
      </div>
    </div>
  );
};

export { SidePanelHeader as default };
