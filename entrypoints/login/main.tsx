// Ghost Protocols — Secure Login Entry
// Integrates design from page1-login.html + page2-dashboard.html
// Backend Auth Integration

import { AuthClient, type AuthUser } from '@/lib/api/auth-client'
import { createLogger } from '@/utils/logger'
import React, { useCallback, useEffect, useRef, useState } from 'react'
import ReactDOM from 'react-dom/client'
import { browser } from 'wxt/browser'
import './style.css'

// Audio file path
const LOGIN_SOUND_PATH = 'assets/sounds/hello.mp3'
const loginLog = createLogger('LoginMain', 'global')

// Inline Logo component - most reliable method
const LogoSentra: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 320 28" fill="none" xmlns="http://www.w3.org/2000/svg">
    <text
      x="50%"
      y="20"
      fill="#EDEDED"
      fontWeight="600"
      fontFamily="Inter, system-ui, sans-serif"
      fontSize="15"
      letterSpacing="0.25em"
      textAnchor="middle"
    >
      SENTRA ARTIFICIAL INTELLIGENCE
    </text>
  </svg>
)

// ============================================================================
// TYPES
// ============================================================================
type LoginState = 'login' | 'dashboard' | 'loading'

interface EngineConfig {
  id: string
  label: string
  active?: boolean
}

// ============================================================================
// CONSTANTS
// ============================================================================
const ENGINES: EngineConfig[] = [
  { id: 'clinical', label: 'Clinical Assist', active: true },
  { id: 'diagnostic', label: 'Diagnostic Assist' },
  { id: 'therapy', label: 'Therapy Assist' },
]

// ============================================================================
// AUDIO HOOK
// ============================================================================
const useAudio = () => {
  const audioRef = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    // Preload audio with proper extension URL
    const url = browser.runtime.getURL(LOGIN_SOUND_PATH)
    audioRef.current = new Audio(url)
    audioRef.current.preload = 'auto'
    audioRef.current.volume = 0.7

    return () => {
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current = null
      }
    }
  }, [])

  const play = useCallback(() => {
    if (audioRef.current) {
      // Reset to start and play
      audioRef.current.currentTime = 0
      const playPromise = audioRef.current.play()
      if (playPromise !== undefined) {
        playPromise.catch((err) => {
          loginLog.warn('Audio play failed', err)
        })
      }
    }
  }, [])

  return { play }
}

// ============================================================================
// POWER BUTTON ICON
// ============================================================================
const PowerIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
  >
    <path d="M12 2v8M8 6a8 8 0 1 0 8 0" />
  </svg>
)

// ============================================================================
// LOGIN PAGE COMPONENT
// ============================================================================
const LoginPage: React.FC<{ onLogin: (user: AuthUser) => void }> = ({ onLogin }) => {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const { play: playOpeningSound } = useAudio()

  const handleSubmit = useCallback(async () => {
    if (!username.trim() || !password.trim()) return
    setIsLoading(true)
    const result = await AuthClient.login({ username: username.trim(), password: password.trim() })
    setIsLoading(false)
    if (!result.success) return
    playOpeningSound()
    setTimeout(() => onLogin(result.session!.user), 400)
  }, [username, password, onLogin, playOpeningSound])

  return (
    <div className="login-container">
      <div className="login-logo">
        <LogoSentra />
      </div>

      <div className="login-inputs">
        <div className="luxury-line">
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
            placeholder="USERNAME"
            className="login-input"
          />
        </div>
        <div className="luxury-line">
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
            placeholder="PASSWORD"
            className="login-input"
          />
        </div>
      </div>

      <button className="power-btn" onClick={handleSubmit} disabled={isLoading}>
        <PowerIcon />
      </button>
    </div>
  )
}

const DashboardPage: React.FC<{ user: AuthUser; onLogout: () => void }> = ({ user, onLogout }) => {
  const [activeEngine, setActiveEngine] = useState('clinical')
  const handleLaunch = () => {
    window.location.href = '/sidepanel.html'
  }

  return (
    <div className="dashboard-container">
      <div className="dashboard-header">
        <LogoSentra className="text-h1" />
        <div className="text-h2 mt-2">We empower you</div>
        <div className="text-subtitle mt-4">
          {user.name} • {user.facilityName}
        </div>
        <div className="dashboard-mantra mt-6 mb-2 text-mono opacity-30" style={{ fontSize: '8px', letterSpacing: '0.4em' }}>
          DIAGNOSA | TERAPI | REPEAT
        </div>
      </div>

      <div className="engine-list">
        {ENGINES.map((e) => (
          <div
            key={e.id}
            className={`engine-item ${activeEngine === e.id ? 'active' : ''}`}
            onClick={() => setActiveEngine(e.id)}
          >
            {e.label}
          </div>
        ))}
      </div>

      <div className="system-stats-grid">
        <div className="stat-item">
          <div className="text-mono stat-value">24ms</div>
          <div className="text-subtitle opacity-40" style={{ fontSize: '7px' }}>Latency</div>
        </div>
        <div className="stat-item">
          <div className="text-mono stat-value">AES-256</div>
          <div className="text-subtitle opacity-40" style={{ fontSize: '7px' }}>Security</div>
        </div>
        <div className="stat-item">
          <div className="text-mono stat-value">Active</div>
          <div className="text-subtitle opacity-40" style={{ fontSize: '7px' }}>Neural Core</div>
        </div>
      </div>

      <div className="dashboard-links-section">
        <div className="text-subtitle opacity-40 mb-2" style={{ fontSize: '7px' }}>Kunjungi kami di sini</div>
        <div className="flex items-center justify-center gap-3 text-[10px] tracking-wide">
          <a href="https://sentrahai.com/" target="_blank" rel="noopener noreferrer" className="hover:text-[#10B981] transition-colors">
            Sentra Artificial Intelligence
          </a>
          <span className="opacity-20">|</span>
          <a href="https://ferdiiskandar.com/" target="_blank" rel="noopener noreferrer" className="hover:text-[#10B981] transition-colors">
            dr. Ferdi Iskandar
          </a>
        </div>
      </div>

      <div className="credits-box">
        <div className="text-caption">
          Dirancang dan dikembangkan oleh <b>dr. Ferdi Iskandar</b>
          <br />
          Hak milik <span className="credits-company">Sentra Artificial Intelligence</span>
          <br />
          <i className="text-mono opacity-60" style={{ fontSize: '8px' }}>
            &quot;Masterplan and masterpiece by Claudesy.&quot;
          </i>
        </div>
      </div>

      <div className="divider" />

      <div className="partners-title text-subtitle" style={{ fontSize: '8px', opacity: 0.5 }}>
        Ditenagai oleh Teknologi
      </div>
      <div className="partners-grid">
        <div className="partner-card">
          <div
            className="partner-logo"
            style={{ background: "url('/icon/melinda.png') center/contain no-repeat" }}
          />
          <div className="partner-info">
            <div className="text-body font-semibold">RSIA Melinda DHAI</div>
            <div className="text-caption" style={{ fontSize: '8px' }}>
              Birthplace of Sentra — Vision Core
            </div>
          </div>
        </div>

        <div className="partner-card">
          <div
            className="partner-logo"
            style={{ background: "url('/anthropic.svg') center/contain no-repeat" }}
          />
          <div className="partner-info">
            <div className="text-body font-semibold">Claude.ai</div>
            <div className="text-caption" style={{ fontSize: '8px' }}>
              Clinical Reasoning Engine
            </div>
          </div>
        </div>

        <div className="partner-card">
          <div
            className="partner-logo"
            style={{ background: "url('/openai.svg') center/contain no-repeat" }}
          />
          <div className="partner-info">
            <div className="text-body font-semibold">OpenAI</div>
            <div className="text-caption" style={{ fontSize: '8px' }}>
              GPT 5.4 High-Performance
            </div>
          </div>
        </div>

        <div className="partner-card">
          <div
            className="partner-logo"
            style={{ background: "url('/kimi.svg') center/contain no-repeat" }}
          />
          <div className="partner-info">
            <div className="text-body font-semibold">Moonshot Kimi</div>
            <div className="text-caption" style={{ fontSize: '8px' }}>
              Knowledge Retrieval
            </div>
          </div>
        </div>
      </div>

      <div style={{ textAlign: 'center' }}>
        <button className="power-btn" onClick={handleLaunch} aria-label="Launch Console">
          <PowerIcon />
        </button>
        <div className="mt-6">
          <button className="logout-btn text-mono" onClick={onLogout}>
            Logout System
          </button>
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// MAIN APP COMPONENT
// ============================================================================
const App: React.FC = () => {
  const [loginState, setLoginState] = useState<LoginState>('loading')
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null)

  // Check if already logged in
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const session = await AuthClient.getStoredSession()
        if (session) {
          setCurrentUser(session.user)
          setLoginState('dashboard')
        } else {
          setLoginState('login')
        }
      } catch {
        setLoginState('login')
      }
    }

    checkAuth()
  }, [])

  const handleLogin = useCallback(async (user: AuthUser) => {
    setCurrentUser(user)
    setLoginState('dashboard')
  }, [])

  const handleLogout = useCallback(async () => {
    await AuthClient.logout()
    setCurrentUser(null)
    setLoginState('login')
  }, [])

  if (loginState === 'loading') {
    return (
      <div className="loading-screen">
        <div className="loading-spinner" />
        <span>Initializing...</span>
      </div>
    )
  }

  if (loginState === 'login') {
    return <LoginPage onLogin={handleLogin} />
  }

  return currentUser ? (
    <DashboardPage user={currentUser} onLogout={handleLogout} />
  ) : (
    <LoginPage onLogin={handleLogin} />
  )
}

// ============================================================================
// MOUNT
// ============================================================================
const rootEl = document.getElementById('root')
if (rootEl) {
  ReactDOM.createRoot(rootEl).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  )
}
