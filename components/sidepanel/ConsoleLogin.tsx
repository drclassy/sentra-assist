// Console Boot Sequence — Login Section
// Production-ready: wired to auth-client.ts for real authentication.

import React, { useCallback, useState } from 'react';
import type { AuthUser } from '@/lib/api/auth-store';

interface ConsoleLoginProps {
  isPowered: boolean;
  onLoginSuccess: (user: AuthUser) => void;
}

type LoginState = 'idle' | 'loading' | 'error';

export const ConsoleLogin: React.FC<ConsoleLoginProps> = ({ isPowered, onLoginSuccess }) => {
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
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!isPowered || loginState === 'loading') return;

      const trimUser = username.trim();
      const trimPass = password.trim();

      if (!trimUser || !trimPass) {
        triggerShake();
        setLoginState('error');
        setErrorMsg('Masukkan username dan password');
        setTimeout(() => setLoginState('idle'), 2500);
        return;
      }

      setLoginState('loading');
      setErrorMsg('');

      try {
        // Dynamic import to keep login chunk separate
        const { login } = await import('@/lib/api/auth-client');
        const result = await login({ username: trimUser, password: trimPass });

        if (result.success && result.session) {
          onLoginSuccess(result.session.user);
        } else {
          setLoginState('error');
          setErrorMsg(result.error?.message || 'Login gagal');
          triggerShake();
          setTimeout(() => setLoginState('idle'), 3000);
        }
      } catch (err) {
        setLoginState('error');
        setErrorMsg('Koneksi gagal. Periksa jaringan Anda.');
        triggerShake();
        setTimeout(() => setLoginState('idle'), 3000);
      }
    },
    [isPowered, username, password, loginState, onLoginSuccess, triggerShake]
  );

  const isLoading = loginState === 'loading';
  const isError = loginState === 'error';
  const buttonText = isLoading ? 'Authenticating...' : isError ? errorMsg : 'Access Console';

  return (
    <>
      <form className="login-section" onSubmit={(e) => void handleLogin(e)} aria-label="Secure Login">
        <div className="login-label">Secure Login</div>

        <div className="input-line">
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Username"
            autoComplete="off"
            aria-label="Username"
            disabled={!isPowered || isLoading}
          />
          <div className="input-glow" />
        </div>

        <div className="input-line">
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            aria-label="Password"
            disabled={!isPowered || isLoading}
          />
          <div className="input-glow" />
        </div>

        <button
          type="submit"
          className={`login-btn ${isLoading ? 'login-btn--loading' : ''} ${isError ? 'login-btn--error' : ''}`}
          disabled={!isPowered || isLoading}
          style={shaking ? { animation: 'login-shake 0.3s ease' } : undefined}
          aria-label="Access Console"
        >
          {buttonText}
        </button>

        <div className="login-hint">
          {isError ? '' : 'dev: dr.ferdi / sentra123'}
        </div>
      </form>

      <div className="login-divider" />

      <style>{`
        @keyframes login-shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-5px); }
          50% { transform: translateX(5px); }
          75% { transform: translateX(-3px); }
        }

        .login-btn--loading {
          opacity: 0.7;
          cursor: wait;
        }

        .login-btn--error {
          background: rgba(239, 68, 68, 0.8);
          color: #fff;
        }

        .login-hint {
          font-size: 8px;
          color: rgba(115,115,115,0.3);
          text-align: center;
          margin-top: 8px;
          letter-spacing: 0.05em;
        }
      `}</style>
    </>
  );
};
