// Sentra Assist — Dashboard / Credits View
// Shown after login, before entering the clinical console.
// Production-ready component wired to auth-store.

import React from 'react';
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
  return (
    <div className="dashboard-view">
      {/* Header */}
      <div className="dashboard-header">
        <div className="dashboard-logo">
          <svg viewBox="0 0 60 40" fill="none" aria-hidden="true" width="44" height="30">
            <text x="0" y="28" fill="#F4EFE6" fontSize="24" fontWeight="700" fontFamily="Inter">S</text>
            <circle cx="32" cy="20" r="14" stroke="#F4EFE6" strokeWidth="2" fill="none" />
            <circle cx="32" cy="20" r="5" fill="#F4EFE6" />
          </svg>
        </div>
        <h2 className="dashboard-title">Sentra Assist</h2>
        <p className="dashboard-subtitle">Intelligent Clinical Decision Support</p>
        {user && (
          <p className="dashboard-user">
            Logged in as <strong>{user.name}</strong>
            {user.poli ? ` — Poli ${user.poli}` : ''}
          </p>
        )}
      </div>

      {/* Assist categories */}
      <div className="dashboard-assist-row">
        <div className="dashboard-assist-chip dashboard-assist-chip--active">Clinical Assist</div>
        <div className="dashboard-assist-chip">Diagnostic Assist</div>
        <div className="dashboard-assist-chip">Therapy Assist</div>
      </div>

      {/* Credits */}
      <div className="dashboard-credits">
        <p>
          Dirancang dan dikembangkan oleh{' '}
          <span className="dashboard-credits__author">dr. Ferdi Iskandar</span>
        </p>
        <p>
          Hak milik{' '}
          <span className="dashboard-credits__company">Sentra Artificial Intelligence</span>
        </p>
        <p className="dashboard-credits__rag">
          Retrieval-Augmented Generation (RAG) Implemented
        </p>
      </div>

      <div className="dashboard-divider" />

      {/* Technology partners */}
      <div className="dashboard-partners-title">Ditenagai oleh Teknologi</div>
      <div className="dashboard-partners">
        <PartnerCard name="RSIA Melinda DHAI" desc="The birthplace of Sentra" accent />
        <PartnerCard name="Claude AI" desc="Advanced reasoning & clinical analysis" />
        <PartnerCard name="OpenAI" desc="GPT language model infrastructure" />
        <PartnerCard name="Moonshot Kimi" desc="Knowledge retrieval platform" />
        <PartnerCard name="Gemini-Vertex" desc="Vertex AI infrastructure" />
        <PartnerCard name="Langflow" desc="LLM pipeline orchestration" />
      </div>

      <div className="dashboard-divider" />

      {/* Actions */}
      <div className="dashboard-actions">
        <button
          className="dashboard-launch-btn"
          onClick={onLaunchConsole}
          aria-label="Launch clinical console"
          type="button"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <path d="M12 2v8M8 6a8 8 0 1 0 8 0" />
          </svg>
          Launch Console
        </button>
        <button
          className="dashboard-logout-btn"
          onClick={onLogout}
          aria-label="Logout"
          type="button"
        >
          Logout
        </button>
      </div>

      <style>{`
        .dashboard-view {
          padding: 4px 0;
          animation: dashFadeIn 0.5s ease;
        }

        @keyframes dashFadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .dashboard-header {
          text-align: center;
          margin-bottom: 16px;
        }

        .dashboard-logo {
          margin: 0 auto 8px;
          opacity: 0.7;
        }

        .dashboard-title {
          font-size: 20px;
          font-weight: 700;
          background: linear-gradient(135deg, #F4EFE6 0%, #CFC6B8 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          margin: 0 0 2px;
        }

        .dashboard-subtitle {
          font-size: 10px;
          color: var(--text-muted);
          letter-spacing: 0.05em;
          margin: 0 0 8px;
        }

        .dashboard-user {
          font-size: 10px;
          color: var(--accent-med);
          margin: 0;
        }

        .dashboard-user strong {
          color: var(--text-main);
          font-weight: 600;
        }

        /* Assist chips */
        .dashboard-assist-row {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 8px;
          margin-bottom: 12px;
        }

        .dashboard-assist-chip {
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 6px;
          font-size: 9px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.03em;
          background: var(--bg-card);
          border: 1px solid rgba(255,255,255,0.06);
          color: var(--text-muted);
          box-shadow: 3px 3px 6px rgba(0,0,0,0.5), -1px -1px 3px rgba(255,255,255,0.02);
        }

        .dashboard-assist-chip--active {
          color: var(--text-main);
          border-color: var(--accent-med);
          box-shadow: 0 0 12px rgba(16,185,129,0.2);
        }

        /* Credits */
        .dashboard-credits {
          background: rgba(10,10,12,0.5);
          border: 1px solid rgba(255,255,255,0.04);
          border-radius: 8px;
          padding: 12px;
          text-align: center;
          font-size: 10px;
          color: var(--text-muted);
          line-height: 1.8;
          margin-bottom: 12px;
        }

        .dashboard-credits p { margin: 0; }

        .dashboard-credits__author {
          color: rgba(244,239,230,0.7);
          font-weight: 500;
        }

        .dashboard-credits__company {
          color: var(--accent-med);
          opacity: 0.9;
        }

        .dashboard-credits__rag {
          font-style: italic;
          opacity: 0.7;
        }

        .dashboard-divider {
          height: 1px;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.06), transparent);
          margin: 12px 0;
        }

        /* Partners */
        .dashboard-partners-title {
          font-size: 8px;
          font-weight: 600;
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 0.12em;
          text-align: center;
          margin-bottom: 8px;
          opacity: 0.7;
        }

        .dashboard-partners {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 6px;
          margin-bottom: 8px;
        }

        .dashboard-partner {
          background: var(--neu-inset-bg);
          border: 1px solid rgba(255,255,255,0.03);
          border-radius: 8px;
          padding: 10px;
          box-shadow: inset 2px 2px 4px rgba(0,0,0,0.4), inset -1px -1px 2px rgba(255,255,255,0.02);
        }

        .dashboard-partner--accent {
          background: linear-gradient(135deg, rgba(16,185,129,0.08), rgba(10,10,12,0.9));
          border-color: rgba(16,185,129,0.15);
        }

        .dashboard-partner__name {
          font-size: 10px;
          font-weight: 600;
          color: rgba(244,239,230,0.85);
          margin-bottom: 2px;
        }

        .dashboard-partner--accent .dashboard-partner__name {
          color: var(--accent-med);
        }

        .dashboard-partner__desc {
          font-size: 8px;
          color: var(--text-muted);
          line-height: 1.4;
        }

        /* Actions */
        .dashboard-actions {
          display: flex;
          flex-direction: column;
          gap: 8px;
          align-items: center;
        }

        .dashboard-launch-btn {
          width: 100%;
          height: 40px;
          border-radius: 8px;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          border: none;
          background: #FFFFFF;
          color: #000000;
          box-shadow: 0 0 20px rgba(255,255,255,0.15);
          text-transform: uppercase;
          letter-spacing: 0.05em;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          transition: all 0.2s ease;
        }

        .dashboard-launch-btn:hover {
          box-shadow: 0 0 30px rgba(255,255,255,0.25);
          transform: translateY(-1px);
        }

        .dashboard-launch-btn:focus-visible {
          outline: 2px solid var(--accent-med);
          outline-offset: 2px;
        }

        .dashboard-logout-btn {
          background: none;
          border: none;
          color: var(--text-muted);
          font-size: 9px;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          cursor: pointer;
          padding: 4px 8px;
          transition: color 0.2s ease;
        }

        .dashboard-logout-btn:hover {
          color: #ef4444;
        }
      `}</style>
    </div>
  );
};

// Small partner card sub-component
function PartnerCard({ name, desc, accent }: { name: string; desc: string; accent?: boolean }) {
  return (
    <div className={`dashboard-partner ${accent ? 'dashboard-partner--accent' : ''}`}>
      <div className="dashboard-partner__name">{name}</div>
      <div className="dashboard-partner__desc">{desc}</div>
    </div>
  );
}
