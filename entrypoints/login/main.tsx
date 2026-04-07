// Ghost Protocols — Secure Login Entry
// Integrates design from page1-login.html + page2-dashboard.html
// Backend Auth Integration

import React, { useState, useEffect, useCallback, useRef } from 'react';
import ReactDOM from 'react-dom/client';
import './style.css';
import { AuthClient, type AuthUser } from '@/lib/api/auth-client';
import { saveBridgeConfig } from '@/lib/api/bridge-client';

// Audio file path
const OPENING_SOUND = '/assets/sounds/opening.mp3';

// Inline Logo component - most reliable method
const LogoSentra: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 200 60" fill="none" xmlns="http://www.w3.org/2000/svg">
    <text x="10" y="45" fill="#F4EFE6" fontSize="42" fontWeight="700" fontFamily="Inter, sans-serif">S</text>
    <circle cx="75" cy="30" r="20" stroke="#F4EFE6" strokeWidth="2.5" fill="none" opacity="0.9"/>
    <circle cx="75" cy="30" r="8" fill="#F4EFE6" opacity="0.95"/>
    <text x="105" y="45" fill="#F4EFE6" fontSize="36" fontWeight="600" fontFamily="Inter, sans-serif" letterSpacing="0.02em">ENTRA</text>
  </svg>
);

// ============================================================================
// TYPES
// ============================================================================
type LoginState = 'login' | 'dashboard' | 'loading';

interface Credentials {
  username: string;
  password: string;
}

interface EngineConfig {
  id: string;
  label: string;
  active?: boolean;
}

// ============================================================================
// CONSTANTS
// ============================================================================
const ENGINES: EngineConfig[] = [
  { id: 'clinical', label: 'Clinical Assist', active: true },
  { id: 'diagnostic', label: 'Diagnostic Assist' },
  { id: 'therapy', label: 'Therapy Assist' },
];

const PARTNERS = [
  {
    name: 'RSIA Melinda DHAI',
    desc: 'The birthplace of Sentra — Where the vision began',
    highlight: true,
  },
  {
    name: 'Claude.ai',
    desc: 'Advanced reasoning & clinical analysis',
    highlight: false,
  },
  {
    name: 'OpenAI',
    desc: 'GPT 5.4 High',
    highlight: false,
  },
  {
    name: 'Moonshot Kimi AI',
    desc: 'Knowledge retrieval platform',
    highlight: false,
  },
  {
    name: 'Gemini-Vertex',
    desc: 'Vertex AI infrastructure',
    highlight: false,
  },
  {
    name: 'Langflow',
    desc: 'Visual workflow orchestration',
    highlight: false,
  },
];

// ============================================================================
// AUDIO HOOK
// ============================================================================
const useAudio = () => {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    // Preload audio
    audioRef.current = new Audio(OPENING_SOUND);
    audioRef.current.preload = 'auto';
    
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  const play = useCallback(() => {
    if (audioRef.current) {
      // Reset to start and play
      audioRef.current.currentTime = 0;
      audioRef.current.volume = 0.7;
      
      const playPromise = audioRef.current.play();
      if (playPromise !== undefined) {
        playPromise.catch((err) => {
          console.log('[Login] Audio play failed (user interaction required):', err);
        });
      }
    }
  }, []);

  return { play };
};

// ============================================================================
// POWER BUTTON ICON
// ============================================================================
const PowerIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
    <path d="M12 2v8M8 6a8 8 0 1 0 8 0"/>
  </svg>
);

// ============================================================================
// LOGIN PAGE COMPONENT
// ============================================================================
const LoginPage: React.FC<{ onLogin: (user: AuthUser) => void }> = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isHovered, setIsHovered] = useState(false);
  const [isShaking, setIsShaking] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { play: playOpeningSound } = useAudio();

  // Play sound when login page opens (icon clicked)
  useEffect(() => {
    const timer = setTimeout(() => {
      playOpeningSound();
    }, 100);
    return () => clearTimeout(timer);
  }, [playOpeningSound]);

  const handleSubmit = useCallback(async () => {
    if (!username.trim() || !password.trim()) {
      setIsShaking(true);
      setError('Enter credentials to proceed');
      setTimeout(() => {
        setIsShaking(false);
        setError('');
      }, 2000);
      return;
    }

    setIsLoading(true);
    setError('');

    // Call backend authentication
    const result = await AuthClient.login({
      username: username.trim(),
      password: password.trim(),
    });

    setIsLoading(false);

    if (!result.success) {
      setIsShaking(true);
      setError(result.error?.message || 'Login failed');
      setTimeout(() => {
        setIsShaking(false);
        setError('');
      }, 3000);
      return;
    }

    // Auto-enable bridge after successful login
    try {
      await saveBridgeConfig({ enabled: true });
      await chrome.runtime.sendMessage({ type: 'AUTH_STATE_CHANGED' });
    } catch (e) {
      console.warn('[Login] Failed to auto-enable bridge:', e);
    }

    // Play opening sound on successful login
    playOpeningSound();

    // Navigate to dashboard with user info
    setTimeout(() => {
      onLogin(result.session!.user);
    }, 400);
  }, [username, password, onLogin, playOpeningSound]);

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSubmit();
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        {/* Logo Section */}
        <div className="login-logo">
          <LogoSentra className="login-logo__svg" />
          <div className="login-logo__brand">Sentra Assist</div>
        </div>

        {/* System Status */}
        <div className="login-status">
          <span className="login-status__dot" />
          <span className="login-status__text">System Off</span>
        </div>

        {/* Credential Lines */}
        <div className="login-inputs">
          <div className="luxury-line">
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Username"
              autoComplete="off"
              className="luxury-line__input"
            />
          </div>
          <div className="luxury-line">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Password"
              className="luxury-line__input"
            />
          </div>
        </div>

        {/* Power Button */}
        <button
          className={`power-btn ${isShaking ? 'power-btn--shake' : ''} ${isLoading ? 'power-btn--loading' : ''}`}
          onClick={handleSubmit}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          disabled={isLoading}
          aria-label="Initialize system"
        >
          <div className={`power-btn__ring ${isHovered || isLoading ? 'power-btn__ring--active' : ''}`} />
          {isLoading ? (
            <div className="power-btn__spinner" />
          ) : (
            <PowerIcon className="power-btn__icon" />
          )}
        </button>
        <div className="power-label">{isLoading ? 'Authenticating...' : 'Initialize'}</div>

        {/* Hint & Error */}
        <div className={`login-hint ${error ? 'login-hint--hidden' : ''}`}>
          Enter credentials to enable
        </div>
        <div className={`login-error ${error ? 'login-error--visible' : ''}`}>
          {error}
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// DASHBOARD PAGE COMPONENT
// ============================================================================
const DashboardPage: React.FC<{ user: AuthUser; onLogout: () => void }> = ({ user, onLogout }) => {
  const [activeEngine, setActiveEngine] = useState('clinical');
  const [isLaunching, setIsLaunching] = useState(false);

  const handleLaunch = () => {
    setIsLaunching(true);
    // Transition to main sidepanel after delay
    setTimeout(() => {
      window.location.href = '/sidepanel.html';
    }, 800);
  };

  return (
    <div className="dashboard-container">
      <div className={`dashboard-card ${isLaunching ? 'dashboard-card--launching' : ''}`}>
        {/* Launch Button */}
        <button 
          className="dashboard-launch-btn"
          onClick={handleLaunch}
          title="Launch Console"
        >
          ⏻
        </button>

        {/* Header */}
        <div className="dashboard-header">
          <LogoSentra className="dashboard-logo__svg" />
          <h1 className="dashboard-title">Sentra Assist</h1>
          <p className="dashboard-subtitle">Intelligent Clinical Decision Support</p>
        </div>

        {/* Engine Selector */}
        <div className="engine-row">
          {ENGINES.map((engine) => (
            <button
              key={engine.id}
              className={`engine-selector ${activeEngine === engine.id ? 'engine-selector--active' : ''}`}
              onClick={() => setActiveEngine(engine.id)}
            >
              {engine.label}
            </button>
          ))}
        </div>

        {/* Credits */}
        <div className="credits-box">
          <p className="credits-text">
            Selamat datang, <span className="credits-author">{user.name}</span><br />
            <span className="credits-role">{user.role === 'doctor' ? 'Dokter' : user.role === 'nurse' ? 'Perawat' : 'Admin'} • {user.facilityName}</span><br />
            <span className="credits-rag">Retrieval-Augmented Generation (RAG) Implemented</span>
          </p>
        </div>

        {/* Divider */}
        <div className="dashboard-divider" />

        {/* Partners */}
        <div className="partners-section">
          <div className="partners-title">Ditenagai oleh Teknologi</div>
          <div className="partners-grid">
            {PARTNERS.map((partner, idx) => (
              <div 
                key={idx} 
                className={`partner-card ${partner.highlight ? 'partner-card--highlight' : ''}`}
              >
                <div className="partner-logo">
                  {partner.name.charAt(0)}
                </div>
                <div className="partner-info">
                  <div className="partner-name">{partner.name}</div>
                  <div className="partner-desc">{partner.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// MAIN APP COMPONENT
// ============================================================================
const App: React.FC = () => {
  const [loginState, setLoginState] = useState<LoginState>('loading');
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);

  // Check if already logged in
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const session = await AuthClient.getStoredSession();
        if (session) {
          setCurrentUser(session.user);
          setLoginState('dashboard');
        } else {
          setLoginState('login');
        }
      } catch {
        setLoginState('login');
      }
    };

    checkAuth();
  }, []);

  const handleLogin = useCallback(async (user: AuthUser) => {
    setCurrentUser(user);
    setLoginState('dashboard');
  }, []);

  const handleLogout = useCallback(async () => {
    await AuthClient.logout();
    setCurrentUser(null);
    setLoginState('login');
  }, []);

  if (loginState === 'loading') {
    return (
      <div className="loading-screen">
        <div className="loading-spinner" />
        <span>Initializing...</span>
      </div>
    );
  }

  if (loginState === 'login') {
    return <LoginPage onLogin={handleLogin} />;
  }

  return currentUser ? <DashboardPage user={currentUser} onLogout={handleLogout} /> : <LoginPage onLogin={handleLogin} />;
};

// ============================================================================
// MOUNT
// ============================================================================
const rootEl = document.getElementById('root');
if (rootEl) {
  ReactDOM.createRoot(rootEl).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}
