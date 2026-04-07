// Designed and constructed by Claudesy.
/**
 * Patient Header Component
 *
 * Displays patient demographic info with privacy-compliant name masking
 *
 * @module components/clinical/PatientHeader
 */

import React from 'react';
import {
  classifyChronicDisease,
  type ChronicDiseaseClassification,
} from '../../lib/iskandar-diagnosis-engine/chronic-disease-classifier';
import { formatPatientName } from '../../utils/name-masking';

// ============================================================================
// TYPES
// ============================================================================

export interface MedicalHistoryItem {
  code: string; // ICD-10 code (e.g., 'I10')
  description: string; // Full description
  shortLabel: string; // Short display label (e.g., 'HT')
}

/**
 * ProfileStatus type
 * 
 * @remarks
 * TODO: Add type description and property documentation
 * Auto-generated on 2026-03-12
 */

export type ProfileStatus = 'loading' | 'loaded' | 'error' | 'idle';

/**
 * PatientHeaderProps interface
 * 
 * @remarks
 * TODO: Add type description and property documentation
 * Auto-generated on 2026-03-12
 */

export interface PatientHeaderProps {
  name: string;
  gender: 'L' | 'P';
  age: number;
  rmNumber: string;
  masked?: boolean;
  // Extended patient info
  dob?: string; // Tanggal lahir (DD-MM-YYYY)
  bloodType?: string; // Golongan darah (A/B/AB/O +/-)
  bpjsStatus?: 'aktif' | 'nonaktif' | 'mandiri' | null;
  kelurahan?: string; // Alamat kelurahan
  // Medical history
  medicalHistory?: MedicalHistoryItem[]; // Detected from page
  // Refresh callback
  onRefresh?: () => void;
  isLoading?: boolean;
  // Profile status indicator
  profileStatus?: ProfileStatus;
}

// ============================================================================
// COMPONENT
// ============================================================================

export const PatientHeader: React.FC<PatientHeaderProps> = ({
  name,
  age,
  masked = true,
  medicalHistory,
  onRefresh,
  isLoading,
}) => {
  const displayName = formatPatientName(name, { masked });

  // Classify chronic diseases and deduplicate by type
  const classifyAndDedupe = (): ChronicDiseaseClassification[] => {
    if (!medicalHistory || medicalHistory.length === 0) return [];

    const seen = new Map<string, ChronicDiseaseClassification>();

    for (const item of medicalHistory) {
      const classification = classifyChronicDisease(item.code);
      if (classification && !seen.has(classification.type)) {
        seen.set(classification.type, classification);
      }
    }

    // Sort by severity: critical first, then moderate
    return Array.from(seen.values())
      .sort((a, b) => {
        if (a.severity === 'critical' && b.severity !== 'critical') return -1;
        if (a.severity !== 'critical' && b.severity === 'critical') return 1;
        return 0;
      })
      .slice(0, 3); // Max 3 badges
  };

  const chronicDiseases = classifyAndDedupe();

  return (
    <div className="neu-card-inset p-1.5 mb-4">
      <div className="flex items-center gap-1.5">
        {/* Patient Name - primary tab */}
        <div className="neu-tab flex-1 py-2 px-2 rounded-lg relative">
          <span className="text-body text-platinum font-medium" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block', fontSize: '13px' }}>
            {displayName}
          </span>
        </div>
        {/* Age */}
        <div className="neu-tab py-2 px-2 rounded-lg">
          <span className="text-body text-muted font-medium">{age} th</span>
        </div>
        {/* Refresh */}
        {onRefresh && (
          <button
            onClick={onRefresh}
            disabled={isLoading}
            className="motion-press neu-tab py-2 px-2 rounded-lg text-body text-muted font-medium"
            title="Refresh data pasien"
          >
            {isLoading ? '...' : '↻'}
          </button>
        )}
        {/* Chronic Disease Badges */}
        {chronicDiseases.map((disease) => (
          <div
            key={disease.type}
            className="neu-tab py-2 px-2 rounded-lg"
            title={`${disease.icdCode}: ${disease.fullName}`}
          >
            <span className="text-body font-medium" style={{ color: '#EF4444' }}>{disease.shortLabel}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

// ============================================================================
// STYLES
// ============================================================================

export const patientHeaderStyles = `
/* Compact Patient Header - 2-Row Layout (inherits neu-card-inset) */
.patient-header-compact {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 10px 14px;
  margin-bottom: 18px;
  position: relative;
  overflow: hidden;
}

.patient-metadata-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.patient-name-compact {
  font-size: 14px;
  font-weight: 800;
  color: #FFFFFF;
  text-transform: uppercase;
  letter-spacing: 0.2px;
  margin: 0;
  line-height: 1.2;
}

.patient-age-compact {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-secondary);
  opacity: 0.9;
}

.patient-location-compact {
  font-size: 12px;
  color: var(--text-tertiary);
  opacity: 0.8;
}

.patient-bpjs-compact {
  font-size: 10px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 4px;
  text-transform: uppercase;
  letter-spacing: 0.3px;
}

.patient-bpjs-compact.bpjs-aktif {
  background: rgba(16, 185, 129, 0.15);
  color: #6B9B8A;
}

.patient-bpjs-compact.bpjs-nonaktif {
  background: rgba(239, 68, 68, 0.15);
  color: #EF4444;
}

.patient-bpjs-compact.bpjs-mandiri {
  background: rgba(245, 158, 11, 0.15);
  color: #F59E0B;
}

/* Refresh Button */
.patient-refresh-btn {
  background: transparent;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 4px;
  padding: 2px 6px;
  font-size: 12px;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.2s;
  margin-left: auto;
}

.patient-refresh-btn:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.05);
  color: var(--text-primary);
  border-color: rgba(255, 255, 255, 0.2);
}

.patient-refresh-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Medical History Badges - Pojok Kanan Atas */
.patient-history-badges {
  display: flex;
  gap: 4px;
  margin-left: 8px;
}

/* All chronic disease badges - Red (unified color) */
.history-badge {
  font-size: 9px;
  font-weight: 700;
  padding: 3px 7px;
  border-radius: 4px;
  text-transform: uppercase;
  letter-spacing: 0.4px;
  font-family: 'Geist Mono', 'JetBrains Mono', monospace;
  background:
    linear-gradient(135deg, rgba(239, 68, 68, 0.14) 0%, rgba(220, 38, 38, 0.1) 100%),
    rgba(20, 20, 22, 0.5);
  color: #EF4444;
  border: 1px solid rgba(239, 68, 68, 0.3);
  box-shadow:
    0 1px 3px rgba(239, 68, 68, 0.15),
    inset 0 1px 0 rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(8px);
}
}
`;
