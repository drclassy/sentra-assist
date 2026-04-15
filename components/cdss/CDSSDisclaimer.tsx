// Designed and constructed by Claudesy.
/**
 * Precision-Architected. Future-Built by Docsyanpse
 * Sentra Healthcare Artificial Intelligence
 */

/**
 * CDSS Disclaimer Component
 * Legal and clinical responsibility disclaimer
 *
 * @module components/cdss/CDSSDisclaimer
 *
 * IMPORTANT: This disclaimer MUST be displayed on every CDSS view.
 * It establishes that AI suggestions are advisory only.
 */

import { Info, Shield } from 'lucide-react';

// =============================================================================
// TYPES
// =============================================================================

interface CDSSDisclaimerProps {
  /** Compact mode for inline display */
  compact?: boolean;

  /** Additional CSS classes */
  className?: string;
}

// =============================================================================
// COMPONENT
// =============================================================================

/**
 * CDSSDisclaimer
 * Fixed footer disclaimer that MUST appear on all CDSS views
 *
 * CLINICAL GOVERNANCE REQUIREMENT:
 * - AI suggestions are ADVISORY ONLY
 * - Doctor retains FULL clinical responsibility
 * - Never auto-submit diagnosis to EMR
 */
export function CDSSDisclaimer({ compact = false, className = '' }: CDSSDisclaimerProps) {
  if (compact) {
    return (
      <div
        className={`flex items-center gap-2 px-3 py-2 bg-carbon-900/50 rounded-lg text-tiny text-muted ${className}`}
        role="note"
        aria-label="CDSS Disclaimer"
      >
        <Info className="w-3.5 h-3.5 flex-shrink-0" />
        <span>
          Saran AI untuk mendukung keputusan klinis. Dokter tetap bertanggung jawab penuh.
        </span>
      </div>
    );
  }

  return (
    <div
      className={`neu-card p-4 border border-carbon-700 ${className}`}
      role="note"
      aria-label="CDSS Disclaimer"
    >
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 p-2 bg-carbon-800 rounded-lg">
          <Shield className="w-5 h-5 text-pulse-500" />
        </div>

        <div className="flex-1">
          <h4 className="text-small font-semibold text-platinum mb-1">Catatan Penting</h4>

          <p className="text-caption text-muted leading-relaxed">
            Saran diagnosis ini dihasilkan oleh sistem AI Clinical Decision Support dan bersifat{' '}
            <strong className="text-platinum">hanya sebagai pendukung</strong> keputusan klinis.
          </p>

          <p className="text-caption text-muted leading-relaxed mt-2">
            <strong className="text-caution">Dokter tetap bertanggung jawab penuh</strong> atas
            semua keputusan diagnosis dan tata laksana pasien. Verifikasi selalu diperlukan.
          </p>
        </div>
      </div>

      {/* Governance badge */}
      <div className="mt-3 pt-3 border-t border-carbon-700 flex items-center justify-between">
        <span className="text-tiny text-muted">Sentra CDSS v1.0 • DeepSeek-R1-0528</span>
        <span className="text-tiny text-muted">Puskesmas Indonesia</span>
      </div>
    </div>
  );
}

// =============================================================================
// EXPORTS
// =============================================================================

export type { CDSSDisclaimerProps };
