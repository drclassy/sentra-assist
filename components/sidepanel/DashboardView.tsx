import type { AuthUser } from '@/lib/api/auth-store'
import React, { useState } from 'react'
import { browser } from 'wxt/browser'

/** Paths under `public/` for browser.runtime.getURL */
type PublicAssetPath =
  | '/icon/melinda.png'
  | '/icon/langflow.png'
  | '/icon/Logo-fix.png'
  | '/anthropic.svg'
  | '/openai.svg'
  | '/kimi.svg'
  | '/vertexai.svg'

type PartnerDef = {
  id: string
  name: string
  desc: string
  logoPath: PublicAssetPath
  logoClass?: string
  variant?: 'melinda' | 'default'
}

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
]

interface DashboardViewProps {
  user: AuthUser | null
  onLaunchConsole: () => void
  onLogout: () => void
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  user,
  onLaunchConsole,
  onLogout,
}) => {
  const [activeAssist, setActiveAssist] = useState('clinical')

  return (
    <div className="dash-view">
      <div className="dash-card">
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
            style={{ color: 'var(--text-main)', textShadow: '0 0 8px rgba(244, 239, 230, 0.2)' }}
          >
            DIAGNOSA | TERAPI | REPEAT
          </div>
        </header>

        <div className="dash-assist-row" role="group" aria-label="Mode assist">
          {['CLINICAL', 'DIAGNOSTIC', 'THERAPY'].map((label, i) => {
            const id = label.toLowerCase()
            return (
              <button
                key={i}
                type="button"
                className={`dash-assist-btn ${activeAssist === id ? 'active' : ''}`}
                onClick={() => setActiveAssist(id)}
                aria-pressed={activeAssist === id}
              >
                {label}
              </button>
            )
          })}
        </div>

        <div className="dashboard-links-section my-6 text-center">
          <div className="text-[9px] uppercase tracking-[0.2em] opacity-40 mb-2">
            Kunjungi kami di sini
          </div>
          <div className="flex items-center justify-center gap-3 text-[12px] tracking-wide">
            <a
              href="https://sentrahai.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#737373] hover:text-[#10B981] transition-colors"
            >
              Sentra Artificial Intelligence
            </a>
            <span className="opacity-20">|</span>
            <a
              href="https://ferdiiskandar.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#737373] hover:text-[#10B981] transition-colors"
            >
              dr. Ferdi Iskandar
            </a>
          </div>
        </div>

        <div className="dash-credits-box">
          <div className="dash-credits-text text-[14px]">
            Dirancang dan dikembangkan oleh <span className="author">dr. Ferdi Iskandar</span>
            <br />
            Hak milik <span className="company">Sentra Artificial Intelligence</span>
            <br />
            <span className="rag italic opacity-60 text-[12px]">
              &quot;Masterplan and masterpiece by Claudesy.&quot;
            </span>
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
  )
}
