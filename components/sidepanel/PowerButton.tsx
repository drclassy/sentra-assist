// Console Boot Sequence — Power Button
// Ported 1:1 from console-boot-demo.html reference design

import React from 'react';

interface PowerButtonProps {
  isPowered: boolean;
  onToggle: () => void;
}

export const PowerButton: React.FC<PowerButtonProps> = ({ isPowered, onToggle }) => {
  return (
    <div
      className={`power-container ${isPowered ? 'booted' : ''}`}
      role="region"
      aria-label="Power control"
    >
      <button
        className="power-btn"
        onClick={onToggle}
        title={isPowered ? 'Power Off' : 'Power On'}
        aria-label={isPowered ? 'Matikan sistem' : 'Nyalakan sistem'}
        type="button"
      >
        <svg className="power-icon" viewBox="0 0 24 24">
          <path d="M12 2v8M8 6a8 8 0 1 0 8 0" />
        </svg>
      </button>
      <span className="power-label">{isPowered ? 'ON' : 'SYSTEM OFF'}</span>
    </div>
  );
};
