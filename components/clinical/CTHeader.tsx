// Designed and constructed by Claudesy.
import React from 'react';

/**
 * CTHeader - Shared Sentra clinical screen header
 */
interface CTHeaderProps {
  title: string;
  subtitle: string;
  sectionLabel: string;
  meta?: string;
  onBack?: () => void;
}

export const CTHeader: React.FC<CTHeaderProps> = ({
  title,
  subtitle,
  sectionLabel,
  meta,
  onBack,
}) => {
  return (
    <header className="sidepanel-shell-header mb-6" role="banner">
      <div className="sidepanel-shell-header__eyebrow-row">
        <span className="sidepanel-shell-header__ownership">Property of Sentra Incorporate</span>

        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="sidepanel-shell-back-button"
            aria-label="Kembali ke layar sebelumnya"
            data-metric="clinical-screen-back"
            data-slo="clinical-header-nav"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M10 12L6 8L10 4"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        )}
      </div>

      <div
        className="sidepanel-shell-header__brand-card"
        aria-label={`${sectionLabel} screen header`}
      >
        <div className="sidepanel-shell-header__brand-copy">
          <h1 className="sidepanel-shell-header__title">{title}</h1>
          <p className="sidepanel-shell-header__subtitle">{subtitle}</p>
          {meta && <p className="text-small mt-1" style={{ color: 'var(--text-muted)' }}>{meta}</p>}
        </div>

        <div className="sidepanel-shell-header__section-block">
          <span className="sidepanel-shell-header__section-label">Current Section</span>
          <span className="sidepanel-shell-header__section-value">{sectionLabel}</span>
        </div>
      </div>
    </header>
  );
};
