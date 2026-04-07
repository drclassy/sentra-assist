// Ghost Protocols — Iskandar Diagnosis Engine V1
// Ported 1:1 from console-boot-demo.html reference design

import React from 'react';

interface EngineButton {
  id: string;
  label: string;
}

type ShellStatus = 'standby' | 'syncing' | 'ready' | 'insufficient';

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
  bootMode?: boolean;
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
  bootMode = false,
}) => {
  const resolvedAgeText = patientAge > 0 ? `${patientAge} tahun` : '--';
  const isReady = demographicStatus === 'ready';
  const statusLabel = isLoadingPatient ? 'Syncing' : isReady ? 'Ready' : 'Standby';

  return (
    <div className="card-header">
      {/* Title — compact, no spacers */}
      <div className="header-top">
        {bootMode && (
          <div className="boot-logo-container">
            <svg className="logo-svg" viewBox="0 0 60 40" fill="none" aria-hidden="true">
              <text x="0" y="28" fill="#F4EFE6" fontSize="24" fontWeight="700" fontFamily="Inter">S</text>
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

      {/* 3 uniform buttons — 36px, directly below title */}
      <div className="engine-row">
        {engineButtons.map((engine) => (
          <button
            key={engine.id}
            type="button"
            className={`engine-btn ${activeEngine === engine.id ? 'active' : ''}`}
            onClick={() => onEngineChange(engine.id)}
            aria-pressed={activeEngine === engine.id}
            aria-label={engine.label}
          >
            {engine.label}
          </button>
        ))}
      </div>

      {/* Patient info — exactly 2 rows */}
      <div className="patient-bar">
        {/* Row 1: Name (left) + Age (right) + Status dot */}
        <div className="patient-row-top">
          <span className="patient-name" title={patientName}>{patientName}</span>
          <span className="patient-age">{resolvedAgeText}</span>
          <button
            type="button"
            className="status-indicator"
            onClick={() => void onRefreshPatient?.()}
            disabled={!onRefreshPatient || isLoadingPatient}
            aria-label={`Status: ${statusLabel}. Klik untuk refresh`}
          >
            <div className={`status-dot ${isReady ? 'status-dot--ready' : ''} ${isLoadingPatient ? 'status-dot--syncing' : ''}`} />
            <span className="status-text">{statusLabel}</span>
          </button>
        </div>
        {/* Row 2: History (full width, single line ellipsis) */}
        <div className="patient-row-bottom">
          <span className="patient-history-label">Riwayat</span>
          <span className="patient-history" title={chronicHistorySummary}>{chronicHistorySummary}</span>
        </div>
      </div>

      {/* ============================================================
          COMPACT LAYOUT CSS — 8px baseline grid
          ============================================================ */}
      <style>{`
        .card-header {
          margin-bottom: 8px;
          position: relative;
          z-index: 1;
        }

        .header-top {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          margin-bottom: 8px;
        }

        .title-group {
          text-align: center;
        }

        .card-title-main {
          font-size: 22px;
          font-weight: 700;
          letter-spacing: -0.02em;
          line-height: 28px;
          background: linear-gradient(135deg, #F4EFE6 0%, #CFC6B8 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          margin: 0 0 2px;
        }

        .card-title-sub {
          font-size: 10px;
          line-height: 16px;
          color: var(--text-muted);
          letter-spacing: 0.02em;
          margin: 0;
        }

        /* ── Engine Row — 3 uniform 36px buttons ───────────── */
        .engine-row {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 8px;
          margin-bottom: 8px;
        }

        .engine-btn {
          height: 36px;
          padding: 0 12px;
          border-radius: 6px;
          font-size: 11px;
          font-weight: 600;
          line-height: 20px;
          background: var(--bg-card);
          border: 1px solid rgba(255,255,255,0.08);
          cursor: pointer;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          position: relative;
          overflow: hidden;
          color: #737373;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow:
            3px 3px 6px rgba(0,0,0,0.5),
            -1px -1px 3px rgba(255,255,255,0.03);
          transition: all 0.2s ease;
        }

        .engine-btn:hover {
          color: #F4EFE6;
          border-color: rgba(255,255,255,0.1);
        }

        .engine-btn:active {
          box-shadow:
            inset 2px 2px 4px rgba(0,0,0,0.5),
            inset -1px -1px 2px rgba(255,255,255,0.02);
          transform: translateY(1px);
        }

        .engine-btn.active {
          color: #F4EFE6;
          border-color: rgba(16,185,129,1);
          box-shadow:
            0 0 12px rgba(16,185,129,0.2),
            inset 0 1px 0 rgba(255,255,255,0.05);
        }

        .engine-btn:disabled {
          opacity: 0.5;
          pointer-events: none;
        }

        .engine-btn:focus-visible {
          outline: 2px solid var(--accent-med);
          outline-offset: 2px;
        }

        /* ── Patient Bar — exactly 2 rows ──────────────────── */
        .patient-bar {
          display: flex;
          flex-direction: column;
          gap: 4px;
          padding: 8px;
          background: var(--neu-inset-bg);
          border-radius: 8px;
          border: 1px solid rgba(255,255,255,0.06);
          box-shadow:
            inset 2px 2px 6px rgba(0,0,0,0.4),
            inset -1px -1px 2px rgba(255,255,255,0.02);
        }

        /* Row 1: Name + Age + Status */
        .patient-row-top {
          display: flex;
          align-items: center;
          gap: 8px;
          min-width: 0;
        }

        .patient-name {
          font-family: 'JetBrains Mono', monospace;
          font-size: 12px;
          font-weight: 600;
          line-height: 18px;
          color: var(--text-main);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          flex: 1;
          min-width: 0;
        }

        .patient-age {
          font-family: 'JetBrains Mono', monospace;
          font-size: 11px;
          line-height: 18px;
          color: var(--text-muted);
          white-space: nowrap;
          flex-shrink: 0;
        }

        /* Row 2: History label + value */
        .patient-row-bottom {
          display: flex;
          align-items: center;
          gap: 8px;
          min-width: 0;
        }

        .patient-history-label {
          font-size: 9px;
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 0.08em;
          white-space: nowrap;
          flex-shrink: 0;
        }

        .patient-history {
          font-family: 'JetBrains Mono', monospace;
          font-size: 11px;
          font-weight: 600;
          line-height: 18px;
          color: var(--text-main);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          min-width: 0;
          flex: 1;
        }

        /* Status indicator — inline with patient name */
        .status-indicator {
          display: flex;
          align-items: center;
          gap: 4px;
          background: none;
          border: none;
          cursor: pointer;
          padding: 0;
          flex-shrink: 0;
          transition: all 0.2s ease;
        }

        .status-indicator:disabled {
          cursor: default;
        }

        .status-indicator:focus-visible {
          outline: 2px solid var(--accent-med);
          outline-offset: 2px;
          border-radius: 4px;
        }

        .status-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #737373;
          transition: all 0.4s ease;
        }

        .status-dot--ready {
          background: var(--accent-med);
          box-shadow: 0 0 6px var(--accent-med);
        }

        .status-dot--syncing {
          animation: dot-pulse 2.4s ease-in-out infinite;
        }

        @keyframes dot-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.35; }
        }

        .status-text {
          font-size: 9px;
          color: var(--accent-med);
          font-weight: 500;
          white-space: nowrap;
        }
      `}</style>
    </div>
  );
};

export { SidePanelHeader as default };
