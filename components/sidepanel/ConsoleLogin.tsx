// Sentra Assist — Login View
// Pixel-perfect port of page1-login.html into React component.
// Wired to auth-client.ts for production authentication.

import React, { useCallback, useState } from 'react';
import type { AuthUser } from '@/lib/api/auth-store';

interface ConsoleLoginProps {
  onLoginSuccess: (user: AuthUser) => void;
}

type LoginState = 'idle' | 'loading' | 'success' | 'error';

export const ConsoleLogin: React.FC<ConsoleLoginProps> = ({ onLoginSuccess }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginState, setLoginState] = useState<LoginState>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [shaking, setShaking] = useState(false);

  const triggerShake = useCallback(() => {
    setShaking(true);
    setTimeout(() => setShaking(false), 300);
  }, []);

  const handleLogin = useCallback(
    async () => {
      if (loginState === 'loading') return;

      const trimUser = username.trim();
      const trimPass = password.trim();

      if (!trimUser || !trimPass) {
        triggerShake();
        setLoginState('error');
        setErrorMsg('Enter credentials to proceed');
        setTimeout(() => { setLoginState('idle'); setErrorMsg(''); }, 2500);
        return;
      }

      setLoginState('loading');
      setErrorMsg('');

      try {
        const { login } = await import('@/lib/api/auth-client');
        const result = await login({ username: trimUser, password: trimPass });

        if (result.success && result.session) {
          setLoginState('success');
          setTimeout(() => onLoginSuccess(result.session!.user), 600);
        } else {
          setLoginState('error');
          setErrorMsg(result.error?.message || 'Login gagal');
          triggerShake();
          setTimeout(() => { setLoginState('idle'); setErrorMsg(''); }, 3000);
        }
      } catch {
        setLoginState('error');
        setErrorMsg('Koneksi gagal');
        triggerShake();
        setTimeout(() => { setLoginState('idle'); setErrorMsg(''); }, 3000);
      }
    },
    [username, password, loginState, onLoginSuccess, triggerShake]
  );

  const isLoading = loginState === 'loading';
  const isSuccess = loginState === 'success';
  const isError = loginState === 'error';

  const statusText = isLoading ? 'Authenticating' : isSuccess ? 'System Online' : 'System Off';
  const powerLabel = isLoading ? 'Authenticating...' : isSuccess ? 'Welcome' : 'Initialize';

  return (
    <div className="login-view">
      <div className="login-card">
        {/* Logo resmi Sentra */}
        <div className="login-logo" aria-hidden="true">
          <img src="/icon/Logo-fix.png" alt="Sentra" width="48" height="48" />
        </div>
        <div className="login-brand">Sentra Assist</div>

        {/* System status */}
        <div className="login-system-status">
          <div className={`login-status-dot ${isSuccess ? 'login-status-dot--online' : ''}`} />
          {statusText}
        </div>

        {/* Credential lines */}
        <div className="login-credentials">
          <div className="login-luxury-line">
            <label htmlFor="login-user" className="sr-only">Username</label>
            <input
              id="login-user"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') document.getElementById('login-pass')?.focus(); }}
              placeholder="Username"
              autoComplete="off"
              disabled={isLoading || isSuccess}
            />
          </div>
          <div className="login-luxury-line">
            <label htmlFor="login-pass" className="sr-only">Password</label>
            <input
              id="login-pass"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') void handleLogin(); }}
              placeholder="Password"
              disabled={isLoading || isSuccess}
            />
          </div>
        </div>

        {/* Power button */}
        <button
          className={`login-power-btn ${isLoading ? 'login-power-btn--loading' : ''} ${isSuccess ? 'login-power-btn--success' : ''}`}
          onClick={() => void handleLogin()}
          disabled={isLoading || isSuccess}
          aria-label="Login — Initialize system"
          type="button"
          style={shaking ? { animation: 'loginShake 0.3s ease' } : undefined}
        >
          <div className="login-power-ring" />
          <svg className="login-power-icon" viewBox="0 0 24 24">
            <path d="M12 2v8M8 6a8 8 0 1 0 8 0" />
          </svg>
        </button>
        <div className="login-power-label">{powerLabel}</div>

        {/* Hint / Error */}
        <div className="login-hint">
          {isError ? '' : 'dev: dr.ferdi / sentra123'}
        </div>
        <div className={`login-error ${isError ? 'login-error--show' : ''}`}>
          {errorMsg}
        </div>
      </div>

      <style>{`
        .login-view {
          width: 100%;
          min-height: 100vh;
          animation: loginFadeIn 0.6s ease;
        }

        @keyframes loginFadeIn {
          from { opacity: 0; transform: scale(0.98); }
          to { opacity: 1; transform: scale(1); }
        }

        .login-card {
          width: 100%;
          min-height: 100vh;
          background: #12141A;
          border: 1px solid rgba(255,255,255,0.03);
          box-shadow: 0 40px 80px rgba(0,0,0,0.4);
          position: relative;
          text-align: center;
          /* Card fills the page, content centered vertically */
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 40px 32px;
        }

        .login-card::before {
          content: '';
          position: absolute;
          top: 0;
          left: 50%;
          transform: translateX(-50%);
          width: 40px;
          height: 1px;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent);
        }

        .login-logo {
          margin: 0 auto 12px;
          opacity: 0.8;
        }

        .login-brand {
          font-size: 11px;
          font-weight: 500;
          color: rgba(244,239,230,0.45);
          letter-spacing: 0.3em;
          text-transform: uppercase;
          margin-bottom: 36px;
        }

        .login-system-status {
          font-size: 10px;
          color: #737373;
          letter-spacing: 0.2em;
          text-transform: uppercase;
          margin-bottom: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
        }

        .login-status-dot {
          width: 4px;
          height: 4px;
          border-radius: 50%;
          background: #737373;
          animation: loginPulse 2s ease-in-out infinite;
          transition: all 0.4s ease;
        }

        .login-status-dot--online {
          background: #10B981;
          box-shadow: 0 0 8px #10B981;
          animation: none;
        }

        @keyframes loginPulse {
          0%, 100% { opacity: 0.3; }
          50% { opacity: 0.6; }
        }

        /* Credential lines */
        .login-credentials { margin-bottom: 28px; }

        .login-luxury-line {
          position: relative;
          margin-bottom: 20px;
        }

        .login-luxury-line input {
          width: 100%;
          background: transparent;
          border: none;
          border-bottom: 1px solid rgba(255,255,255,0.06);
          padding: 10px 0;
          font-family: 'JetBrains Mono', monospace;
          font-size: 13px;
          color: rgba(244,239,230,0.9);
          text-align: center;
          letter-spacing: 0.08em;
          outline: none;
          transition: all 0.3s ease;
        }

        .login-luxury-line input::placeholder {
          color: rgba(115,115,115,0.55);
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 0.15em;
        }

        .login-luxury-line input:focus {
          border-bottom-color: rgba(16,185,129,0.4);
          color: rgba(244,239,230,0.9);
        }

        .login-luxury-line input:disabled {
          opacity: 0.5;
        }

        /* Power button */
        .login-power-btn {
          width: 56px;
          height: 56px;
          border-radius: 50%;
          background: transparent;
          border: 1px solid rgba(16,185,129,0.3);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto;
          position: relative;
          transition: all 0.4s ease;
        }

        .login-power-btn:hover:not(:disabled) {
          border-color: #10B981;
          box-shadow: 0 0 30px rgba(16,185,129,0.2);
          transform: scale(1.05);
        }

        .login-power-btn:focus-visible {
          outline: 2px solid #10B981;
          outline-offset: 4px;
        }

        .login-power-btn:disabled {
          cursor: default;
        }

        .login-power-btn--loading {
          border-color: #10B981;
        }

        .login-power-btn--loading .login-power-icon {
          animation: loginSpin 0.8s linear infinite;
        }

        .login-power-btn--success {
          border-color: #10B981;
          box-shadow: 0 0 40px rgba(16,185,129,0.4);
        }

        .login-power-ring {
          position: absolute;
          inset: -3px;
          border-radius: 50%;
          border: 1px solid transparent;
          border-top-color: #10B981;
          opacity: 0.4;
          animation: loginRotate 3s linear infinite;
        }

        @keyframes loginRotate {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        @keyframes loginSpin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        .login-power-icon {
          width: 20px;
          height: 20px;
          fill: none;
          stroke: #10B981;
          stroke-width: 1.5;
          stroke-linecap: round;
        }

        .login-power-label {
          font-size: 8px;
          color: #737373;
          letter-spacing: 0.2em;
          text-transform: uppercase;
          margin-top: 12px;
        }

        .login-hint {
          font-size: 9px;
          color: rgba(115,115,115,0.3);
          letter-spacing: 0.05em;
          margin-top: 24px;
        }

        .login-error {
          font-size: 9px;
          color: #ef4444;
          margin-top: 12px;
          opacity: 0;
          transition: opacity 0.3s ease;
        }

        .login-error--show { opacity: 1; }

        @keyframes loginShake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-3px); }
          50% { transform: translateX(3px); }
          75% { transform: translateX(-3px); }
        }

        .sr-only {
          position: absolute;
          width: 1px; height: 1px;
          padding: 0; margin: -1px;
          overflow: hidden;
          clip: rect(0,0,0,0);
          border: 0;
        }
      `}</style>
    </div>
  );
};
