// Sentra Assist — Dashboard / Welcome View
// Pixel-perfect port of page2-dashboard.html into React component.
// Shows credits, technology partners, and Launch Console button.

import React, { useState } from 'react';
import type { AuthUser } from '@/lib/api/auth-store';

interface DashboardViewProps {
  user: AuthUser | null;
  onLaunchConsole: () => void;
  onLogout: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  user,
  onLaunchConsole,
  onLogout,
}) => {
  const [activeAssist, setActiveAssist] = useState('clinical');

  const assists = [
    { id: 'clinical', label: 'Clinical Assist' },
    { id: 'diagnostic', label: 'Diagnostic Assist' },
    { id: 'therapy', label: 'Therapy Assist' },
  ];

  return (
    <div className="dash-view">
      <div className="dash-card">
        {/* Launch button — top right (breathing green) */}
        <button
          className="dash-launch-orb"
          onClick={onLaunchConsole}
          title="Launch Console — masuk UI utama"
          aria-label="Launch Console"
          type="button"
        >
          ⏻
        </button>

        {/* Header */}
        <div className="dash-header">
          <div className="dash-logo-icon" aria-hidden="true">
            <svg width="44" height="52" viewBox="0 0 120 140" fill="#F4EFE6">
              <rect x="8" y="10" width="70" height="28" rx="14" transform="rotate(-35 43 24)" />
              <rect x="42" y="102" width="70" height="28" rx="14" transform="rotate(-35 77 116)" />
              <path d="M72 8 C105 8 120 30 120 55 C120 72 112 84 98 90 L88 68 C96 64 100 56 100 48 C100 36 90 28 78 28 Z" />
              <path d="M48 132 C15 132 0 110 0 85 C0 68 8 56 22 50 L32 72 C24 76 20 84 20 92 C20 104 30 112 42 112 Z" />
            </svg>
          </div>
          <h2 className="dash-title">Sentra Assist</h2>
          <p className="dash-subtitle">Intelligent Clinical Decision Support</p>
          {user && (
            <p className="dash-welcome">
              Welcome, <strong>{user.name}</strong>
              {user.facilityName ? ` — ${user.facilityName}` : ''}
            </p>
          )}
        </div>

        {/* Assist row */}
        <div className="dash-assist-row">
          {assists.map((a) => (
            <button
              key={a.id}
              className={`dash-assist-btn ${activeAssist === a.id ? 'active' : ''}`}
              onClick={() => setActiveAssist(a.id)}
              type="button"
            >
              {a.label}
            </button>
          ))}
        </div>

        {/* Credits */}
        <div className="dash-credits-box">
          <div className="dash-credits-text">
            Dirancang dan dikembangkan oleh <span className="dash-author">dr. Ferdi Iskandar</span>
            <br />
            Hak milik <span className="dash-company">Sentra Artificial Intelligence</span>
            <br />
            <span className="dash-rag">Retrieval-Augmented Generation (RAG) Implemented</span>
          </div>
        </div>

        <div className="dash-divider" />

        {/* Technology partners */}
        <div className="dash-partners-title">Ditenagai oleh Teknologi</div>
        <div className="dash-partners-grid">
          <div className="dash-partner dash-partner--melinda">
            <div className="dash-partner-info">
              <div className="dash-partner-name dash-partner-name--green">RSIA Melinda DHAI</div>
              <div className="dash-partner-desc">The birthplace of Sentra — Where the vision began under the leadership of our CEO</div>
            </div>
          </div>

          <div className="dash-partner">
            <div className="dash-partner-info">
              <div className="dash-partner-name">Claude.ai</div>
              <div className="dash-partner-desc">Advanced reasoning & clinical analysis engine</div>
            </div>
          </div>

          <div className="dash-partner">
            <div className="dash-partner-info">
              <div className="dash-partner-name">OpenAI</div>
              <div className="dash-partner-desc">GPT 5.4 High</div>
            </div>
          </div>

          <div className="dash-partner">
            <div className="dash-partner-info">
              <div className="dash-partner-name">Moonshot Kimi AI</div>
              <div className="dash-partner-desc">Kimi platform untuk knowledge retrieval</div>
            </div>
          </div>

          <div className="dash-partner">
            <div className="dash-partner-info">
              <div className="dash-partner-name">Gemini-Vertex</div>
              <div className="dash-partner-desc">Vertex AI infrastructure</div>
            </div>
          </div>

          <div className="dash-partner">
            <div className="dash-partner-info">
              <div className="dash-partner-name">Langflow</div>
              <div className="dash-partner-desc">Visual workflow orchestration & LLM pipeline framework</div>
            </div>
          </div>
        </div>

        <div className="dash-divider" />

        {/* Logout */}
        <div className="dash-footer">
          <button
            className="dash-logout-link"
            onClick={onLogout}
            type="button"
            aria-label="Logout"
          >
            Logout
          </button>
        </div>
      </div>

      <style>{`
        .dash-view {
          display: flex;
          align-items: flex-start;
          justify-content: center;
          min-height: calc(100vh - 24px);
          animation: dashFadeIn 0.8s ease;
        }

        @keyframes dashFadeIn {
          from { opacity: 0; transform: scale(0.98); }
          to { opacity: 1; transform: scale(1); }
        }

        .dash-card {
          width: 100%;
          max-width: 400px;
          background: #0F1012;
          border-radius: 16px;
          padding: 24px;
          border: 1px solid rgba(255,255,255,0.08);
          box-shadow:
            0 20px 60px rgba(0,0,0,0.6),
            inset 0 1px 0 rgba(255,255,255,0.05);
          position: relative;
        }

        .dash-card::before {
          content: '';
          position: absolute;
          top: 0; left: 0; right: 0;
          height: 1px;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent);
        }

        /* Launch orb — top right breathing green */
        .dash-launch-orb {
          position: absolute;
          top: 16px;
          right: 16px;
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background: rgba(16,185,129,0.15);
          border: 1px solid rgba(16,185,129,0.4);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #10B981;
          font-size: 12px;
          animation: dashBreathe 2s ease-in-out infinite;
          transition: all 0.2s ease;
        }

        @keyframes dashBreathe {
          0%, 100% {
            box-shadow: 0 0 5px rgba(16,185,129,0.3), inset 0 0 10px rgba(16,185,129,0.1);
            transform: scale(1);
          }
          50% {
            box-shadow: 0 0 20px rgba(16,185,129,0.7), inset 0 0 15px rgba(16,185,129,0.2);
            transform: scale(1.08);
          }
        }

        .dash-launch-orb:hover {
          background: rgba(16,185,129,0.25);
          border-color: rgba(16,185,129,0.6);
          box-shadow: 0 0 20px rgba(16,185,129,0.4);
        }

        .dash-launch-orb:focus-visible {
          outline: 2px solid #10B981;
          outline-offset: 4px;
        }

        /* Header */
        .dash-header {
          text-align: center;
          margin-bottom: 20px;
          padding-top: 8px;
        }

        .dash-logo-icon {
          margin: 0 auto 10px;
        }

        .dash-title {
          font-size: 22px;
          font-weight: 700;
          background: linear-gradient(135deg, #F4EFE6 0%, #CFC6B8 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          letter-spacing: -0.01em;
          margin: 0 0 4px;
        }

        .dash-subtitle {
          font-size: 10px;
          color: #737373;
          letter-spacing: 0.05em;
          margin: 0;
        }

        .dash-welcome {
          font-size: 10px;
          color: #10B981;
          margin: 8px 0 0;
        }

        .dash-welcome strong {
          color: var(--text-main, #F4EFE6);
          font-weight: 600;
        }

        /* Assist row */
        .dash-assist-row {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 8px;
          margin-bottom: 16px;
        }

        .dash-assist-btn {
          padding: 12px 6px;
          border-radius: 10px;
          font-size: 9px;
          font-weight: 600;
          background: #0F1012;
          border: 1px solid rgba(255,255,255,0.06);
          color: #737373;
          cursor: pointer;
          text-transform: uppercase;
          letter-spacing: 0.03em;
          box-shadow: 3px 3px 6px rgba(0,0,0,0.5), -1px -1px 3px rgba(255,255,255,0.02);
          transition: all 0.2s ease;
        }

        .dash-assist-btn:hover {
          color: #F4EFE6;
          border-color: rgba(255,255,255,0.1);
        }

        .dash-assist-btn.active {
          color: #F4EFE6;
          border-color: #10B981;
          box-shadow: 0 0 12px rgba(16,185,129,0.2);
        }

        /* Credits */
        .dash-credits-box {
          background: rgba(10,10,12,0.5);
          border: 1px solid rgba(255,255,255,0.04);
          border-radius: 10px;
          padding: 16px;
          margin-bottom: 16px;
          text-align: center;
        }

        .dash-credits-text {
          font-size: 10px;
          color: #737373;
          line-height: 1.8;
          letter-spacing: 0.02em;
        }

        .dash-author {
          color: rgba(244,239,230,0.7);
          font-weight: 500;
        }

        .dash-company {
          color: #10B981;
          opacity: 0.9;
        }

        .dash-rag {
          font-style: italic;
          opacity: 0.7;
        }

        .dash-divider {
          height: 1px;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.08), transparent);
          margin: 16px 0;
        }

        /* Partners */
        .dash-partners-title {
          font-size: 8px;
          font-weight: 600;
          color: #737373;
          text-transform: uppercase;
          letter-spacing: 0.12em;
          text-align: center;
          margin-bottom: 12px;
          opacity: 0.7;
        }

        .dash-partners-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 8px;
        }

        .dash-partner {
          background: #0A0A0C;
          border: 1px solid rgba(255,255,255,0.03);
          border-radius: 10px;
          padding: 14px 12px;
          box-shadow:
            inset 2px 2px 4px rgba(0,0,0,0.4),
            inset -1px -1px 2px rgba(255,255,255,0.02);
          transition: all 0.2s ease;
        }

        .dash-partner:hover {
          border-color: rgba(255,255,255,0.06);
        }

        .dash-partner--melinda {
          background: linear-gradient(135deg, rgba(16,185,129,0.08) 0%, rgba(10,10,12,0.9) 100%);
          border-color: rgba(16,185,129,0.15);
        }

        .dash-partner-name {
          font-size: 11px;
          font-weight: 600;
          color: rgba(244,239,230,0.85);
          letter-spacing: 0.01em;
          margin-bottom: 2px;
        }

        .dash-partner-name--green {
          color: #10B981;
        }

        .dash-partner-desc {
          font-size: 8px;
          color: #737373;
          line-height: 1.4;
          letter-spacing: 0.01em;
        }

        /* Footer */
        .dash-footer {
          text-align: center;
        }

        .dash-logout-link {
          background: none;
          border: none;
          color: #737373;
          font-size: 9px;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          cursor: pointer;
          padding: 4px 8px;
          transition: color 0.2s ease;
        }

        .dash-logout-link:hover {
          color: #ef4444;
        }
      `}</style>
    </div>
  );
};
