// Console Boot Sequence — Login Section
// Ported 1:1 from console-boot-demo.html reference design

import React, { useCallback, useRef, useState } from 'react';

interface ConsoleLoginProps {
  isPowered: boolean;
  onLoginSuccess: () => void;
}

export const ConsoleLogin: React.FC<ConsoleLoginProps> = ({ isPowered, onLoginSuccess }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [shaking, setShaking] = useState(false);
  const loginBtnRef = useRef<HTMLButtonElement>(null);

  const handleLogin = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!isPowered) return;

      const trimUser = username.trim();
      const trimPass = password.trim();

      if (!trimUser || !trimPass) {
        // Shake animation for error
        setShaking(true);
        setTimeout(() => setShaking(false), 300);
        return;
      }

      // Login success — wire to auth-store in future
      onLoginSuccess();
    },
    [isPowered, username, password, onLoginSuccess]
  );

  return (
    <>
      <form className="login-section" onSubmit={handleLogin} aria-label="Secure Login">
        <div className="login-label">Secure Login</div>

        <div className="input-line">
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Username"
            autoComplete="off"
            aria-label="Username"
            disabled={!isPowered}
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
            disabled={!isPowered}
          />
          <div className="input-glow" />
        </div>

        <button
          ref={loginBtnRef}
          type="submit"
          className="login-btn"
          disabled={!isPowered}
          style={
            shaking
              ? { animation: 'login-shake 0.3s ease' }
              : undefined
          }
          aria-label="Access Console"
        >
          Access Console
        </button>
      </form>

      <div className="login-divider" />

      <style>{`
        @keyframes login-shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-5px); }
          50% { transform: translateX(5px); }
          75% { transform: translateX(-3px); }
        }
      `}</style>
    </>
  );
};
