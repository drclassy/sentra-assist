import ThemeToggle from '@/components/ui/ThemeToggle';
import type { AuthUser } from '@/lib/api/auth-store';
import React from 'react';
import { browser } from 'wxt/browser';

/** Paths under `public/` for browser.runtime.getURL */
type PublicAssetPath =
  | '/icon/melinda.png'
  | '/icon/langflow.png'
  | '/icon/Logo-fix.png'
  | '/anthropic.svg'
  | '/openai.svg'
  | '/kimi.svg'
  | '/vertexai.svg';

type PartnerDef = {
  id: string;
  name: string;
  desc: string;
  logoPath: PublicAssetPath;
  logoClass?: string;
  variant?: 'melinda' | 'default';
};

const PARTNERS: PartnerDef[] = [
  {
    id: 'melinda',
    name: 'RSIA Melinda DHAI',
    desc: 'The birthplace of Sentra — Where the vision began under the leadership of our CEO',
    logoPath: '/icon/melinda.png',
    variant: 'melinda',
    logoClass: 'dash-partner-logo-img--bitmap',
  },
  {
    id: 'claude',
    name: 'Claude.ai',
    desc: 'Advanced reasoning & clinical analysis engine',
    logoPath: '/anthropic.svg',
    logoClass: 'dash-partner-logo-img--svg',
  },
  {
    id: 'openai',
    name: 'OpenAI',
    desc: 'GPT 5.4 High',
    logoPath: '/openai.svg',
    logoClass: 'dash-partner-logo-img--svg',
  },
  {
    id: 'kimi',
    name: 'Moonshot Kimi AI',
    desc: 'Kimi platform untuk knowledge retrieval',
    logoPath: '/kimi.svg',
    logoClass: 'dash-partner-logo-img--svg',
  },
  {
    id: 'vertex',
    name: 'Gemini-Vertex',
    desc: 'Vertex AI infrastructure',
    logoPath: '/vertexai.svg',
    logoClass: 'dash-partner-logo-img--svg',
  },
  {
    id: 'langflow',
    name: 'Langflow',
    desc: 'Visual workflow orchestration & LLM pipeline framework',
    logoPath: '/icon/langflow.png',
    logoClass: 'dash-partner-logo-img--langflow',
  },
];

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
    <div className="dash-view">
      <div className="dash-card">
        <div className="dash-theme-toggle">
          <ThemeToggle />
        </div>
        <button
          type="button"
          className="dash-launch-orb"
          onClick={onLaunchConsole}
          title="Launch Console — masuk UI utama"
          aria-label="Launch Console — masuk UI utama"
        >
          ⏻
        </button>

        <header className="dash-header pt-2">
          <a
            href="https://sentrahai.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="dash-title-link"
          >
            Sentra Assist
          </a>
          <p className="dash-subtitle">We empower you</p>
          {user ? (
            <div className="dash-welcome mt-2">
              <span className="dash-welcome-label">Selamat datang,</span>{' '}
              <strong>{user.name}</strong>
              {user.facilityName ? <> • {user.facilityName}</> : null}
            </div>
          ) : null}
          <div
            className="dashboard-mantra mt-4 mb-2 text-[10px] opacity-70 tracking-[0.4em] font-mono"
            style={{ color: 'var(--text-main)' }}
          >
            DIAGNOSA | TERAPI | REPEAT
          </div>
        </header>

        <div className="px-6 mt-4 mb-2">
          <button
            type="button"
            onClick={onLaunchConsole}
            className="w-full py-3 rounded-lg text-sm font-semibold tracking-wide
                       border transition-all duration-200"
            style={{
              background: 'rgba(255, 255, 255, 0.04)',
              borderColor: 'var(--sentra-border)',
              color: 'var(--text-main)',
            }}
          >
            Masuk ke ASSIST →
          </button>
        </div>

        <div className="dash-divider my-6" aria-hidden="true" />

        <div className="dashboard-links-section my-6 text-center">
          <div className="text-[9px] uppercase tracking-[0.2em] opacity-40 mb-2">
            Kunjungi kami di sini
          </div>
          <div className="flex items-center justify-center gap-3 text-[12px] tracking-wide">
            <a
              href="https://sentrahai.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[var(--text-muted)] hover:text-[var(--accent-med)] transition-colors"
            >
              Sentra Artificial Intelligence
            </a>
            <span className="opacity-20">|</span>
            <a
              href="https://ferdiiskandar.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[var(--text-muted)] hover:text-[var(--accent-med)] transition-colors"
            >
              dr. Ferdi Iskandar
            </a>
          </div>
        </div>

        <div className="dash-divider" aria-hidden="true" />

        <p className="dash-partners-title">Ditenagai oleh Teknologi</p>
        <div className="dash-partners-grid">
          {PARTNERS.map((p) => (
            <div key={p.id} className="dash-partner-card">
              <img
                src={browser.runtime.getURL(p.logoPath)}
                alt=""
                className={`dash-partner-logo-img ${p.logoClass ?? ''}`}
                width={32}
                height={32}
                decoding="async"
              />
              <div className="dash-partner-info">
                <div className="dash-partner-name">{p.name}</div>
                <div className="dash-partner-desc">{p.desc}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="dash-divider" aria-hidden="true" />

        <div className="dash-logout-wrap">
          <button type="button" className="dash-logout" onClick={onLogout}>
            Logout
          </button>
        </div>
      </div>
    </div>
  );
};
