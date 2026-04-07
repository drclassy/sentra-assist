// Designed and constructed by Claudesy.
/**
 * Precision-Architected. Future-Built by Docsyanpse
 * Sentra Healthcare Artificial Intelligence
 */

/**
 * DiagnosisSuggestions Component
 *
 * Displays AI-powered ICD-10 diagnosis suggestions based on patient symptoms.
 * Features:
 * - Confidence scoring with visual indicator
 * - Red flags warning display
 * - Jenis (PRIMER/SEKUNDER) and Kasus (BARU/LAMA) selector
 * - Click to auto-fill diagnosa form via fillDiagnosa message
 *
 * @module components/clinical/DiagnosisSuggestions
 */

import type { DiagnosisRequestContext, DiagnosisSuggestion } from '@/types/api';
import { sendMessage } from '@/utils/messaging';
import type { DiagnosaFillPayload, DiagnosaJenis, DiagnosaKasus } from '@/utils/types';
import React, { useCallback, useEffect, useState } from 'react';

// ============================================================================
// TYPES
// ============================================================================

interface DiagnosisSuggestionsProps {
  /** Chief complaint from anamnesa */
  keluhanUtama: string;
  /** Additional symptoms */
  keluhanTambahan?: string;
  /** Patient age in years */
  patientAge?: number;
  /** Patient gender */
  patientGender?: 'M' | 'F';
  /** Callback when fill is complete */
  onFillComplete?: (result: { success: boolean; message: string }) => void;
  /** Max suggestions to display */
  maxSuggestions?: number;
  /** Whether component is visible */
  isVisible?: boolean;
}

// ============================================================================
// CONFIDENCE HELPER
// ============================================================================

/**
 * Get confidence color based on score
 */
function getConfidenceColor(confidence: number): string {
  if (confidence >= 0.85) return '#6B9B8A'; // high
  if (confidence >= 0.65) return '#F59E0B'; // medium
  return '#EF4444'; // critical
}

/**
 * Get confidence label
 */
function getConfidenceLabel(confidence: number): string {
  if (confidence >= 0.85) return 'High';
  if (confidence >= 0.65) return 'Medium';
  return 'Low';
}

function humanizeUiText(value: string): string {
  return value.replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
}

// ============================================================================
// COMPONENT
// ============================================================================

export const DiagnosisSuggestions: React.FC<DiagnosisSuggestionsProps> = ({
  keluhanUtama,
  keluhanTambahan,
  patientAge = 30,
  patientGender = 'M',
  onFillComplete,
  maxSuggestions = 5,
  isVisible = true,
}) => {
  // State
  const [suggestions, setSuggestions] = useState<DiagnosisSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedJenis, setSelectedJenis] = useState<DiagnosaJenis>('PRIMER');
  const [selectedKasus, setSelectedKasus] = useState<DiagnosaKasus>('BARU');
  const [fillingIndex, setFillingIndex] = useState<number | null>(null);

  // ========================================
  // FETCH SUGGESTIONS
  // ========================================
  const fetchSuggestions = useCallback(async () => {
    if (!keluhanUtama || keluhanUtama.trim().length < 3) {
      setSuggestions([]);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const context: DiagnosisRequestContext = {
        keluhan_utama: keluhanUtama,
        keluhan_tambahan: keluhanTambahan || '',
        patient_age: patientAge,
        patient_gender: patientGender,
      };

      const response = await sendMessage('getSuggestions', context);

      if (response.success && response.data?.diagnosis_suggestions) {
        setSuggestions(response.data.diagnosis_suggestions.slice(0, maxSuggestions));
      } else {
        setError(response.error?.message || 'Gagal mendapatkan saran diagnosis');
        setSuggestions([]);
      }
    } catch (err) {
      console.error('[DiagnosisSuggestions] Fetch error:', err);
      setError(err instanceof Error ? err.message : 'Network error');
      setSuggestions([]);
    } finally {
      setIsLoading(false);
    }
  }, [keluhanUtama, keluhanTambahan, patientAge, patientGender, maxSuggestions]);

  // Fetch when keluhan changes
  useEffect(() => {
    if (isVisible && keluhanUtama) {
      const debounce = setTimeout(fetchSuggestions, 500);
      return () => clearTimeout(debounce);
    }
  }, [keluhanUtama, keluhanTambahan, isVisible, fetchSuggestions]);

  // ========================================
  // HANDLE SUGGESTION CLICK
  // ========================================
  const handleSuggestionClick = async (suggestion: DiagnosisSuggestion, index: number) => {
    setFillingIndex(index);

    try {
      const payload: DiagnosaFillPayload = {
        icd_x: suggestion.icd_x || '',
        nama: suggestion.nama || '',
        jenis: selectedJenis,
        kasus: selectedKasus,
        prognosa: '',
        penyakit_kronis: [],
      };

      console.warn('[DiagnosisSuggestions] Filling with payload:', payload);

      const result = await sendMessage('fillDiagnosa', payload);

      const successCount = result.success?.length || 0;
      const failedCount = result.failed?.length || 0;

      onFillComplete?.({
        success: successCount > 0,
        message: `Filled ${successCount} fields${failedCount > 0 ? `, ${failedCount} failed` : ''}`,
      });
    } catch (err) {
      console.error('[DiagnosisSuggestions] Fill error:', err);
      onFillComplete?.({
        success: false,
        message: err instanceof Error ? err.message : 'Fill failed',
      });
    } finally {
      setFillingIndex(null);
    }
  };

  // ========================================
  // RENDER
  // ========================================
  if (!isVisible) return null;

  return (
    <div className="diagnosis-suggestions glass-panel">
      {/* Header with Advisory Label */}
      <div className="diagnosis-suggestions-header">
        <h4 className="diagnosis-suggestions-title">Saran Diagnosis (ICD-10)</h4>
        <div className="diagnosis-suggestions-badges">
          <span className="badge-advisory">ADVISORY ONLY</span>
          <span className="badge-audit">Audit logged</span>
        </div>
      </div>

      {/* Jenis & Kasus Selectors */}
      <div className="diagnosis-selectors">
        <div className="diagnosis-selector">
          <label>Jenis:</label>
          <select
            value={selectedJenis}
            onChange={(e) => setSelectedJenis(e.target.value as DiagnosaJenis)}
            className="diagnosis-select"
          >
            <option value="PRIMER">Primer</option>
            <option value="SEKUNDER">Sekunder</option>
          </select>
        </div>
        <div className="diagnosis-selector">
          <label>Kasus:</label>
          <select
            value={selectedKasus}
            onChange={(e) => setSelectedKasus(e.target.value as DiagnosaKasus)}
            className="diagnosis-select"
          >
            <option value="BARU">Baru</option>
            <option value="LAMA">Lama</option>
          </select>
        </div>
        <button
          onClick={fetchSuggestions}
          disabled={isLoading || !keluhanUtama}
          className="diagnosis-refresh-btn"
          title="Refresh suggestions"
        >
          {isLoading ? '...' : '↻'}
        </button>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="diagnosis-loading">
          <span className="diagnosis-loading-spinner"></span>
          <span>Menganalisis keluhan...</span>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="diagnosis-error">
          <span className="diagnosis-error-icon">⚠</span>
          <span>{error}</span>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !error && suggestions.length === 0 && keluhanUtama && (
        <div className="diagnosis-empty">
          <span>Tidak ada saran diagnosis untuk keluhan ini.</span>
        </div>
      )}

      {/* Prompt State */}
      {!keluhanUtama && (
        <div className="diagnosis-prompt">
          <span>Masukkan keluhan utama untuk mendapatkan saran diagnosis.</span>
        </div>
      )}

      {/* Suggestions List */}
      {!isLoading && suggestions.length > 0 && (
        <div className="diagnosis-suggestions-list">
          {suggestions.map((suggestion, index) => (
            <button
              key={`${suggestion.icd_x}-${index}`}
              onClick={() => handleSuggestionClick(suggestion, index)}
              disabled={fillingIndex !== null}
              className={`diagnosis-suggestion-card glass-card ${fillingIndex === index ? 'filling' : ''}`}
            >
              <div className="diagnosis-suggestion-main">
                <div className="diagnosis-suggestion-header">
                  <span className="diagnosis-icd-code">{suggestion.icd_x}</span>
                  <span
                    className="diagnosis-confidence"
                    style={{ color: getConfidenceColor(suggestion.confidence) }}
                  >
                    {(suggestion.confidence * 100).toFixed(0)}%
                    <span className="diagnosis-confidence-label">
                      {getConfidenceLabel(suggestion.confidence)}
                    </span>
                  </span>
                </div>
                <div className="diagnosis-name">{suggestion.nama}</div>
                {(suggestion.rationale || suggestion.reasoning) && (
                  <div className="diagnosis-rationale">
                    {suggestion.rationale || suggestion.reasoning}
                  </div>
                )}
              </div>

              {/* Red Flags Warning */}
              {suggestion.red_flags && suggestion.red_flags.length > 0 && (
                <div className="diagnosis-red-flags">
                  <span className="red-flag-icon">🚨</span>
                  <span className="red-flag-text">
                    Red Flags: {suggestion.red_flags.map((item) => humanizeUiText(item)).join(', ')}
                  </span>
                </div>
              )}

              {suggestion.recommended_actions && suggestion.recommended_actions.length > 0 && (
                <div className="diagnosis-recommendations">
                  <span className="recommendation-icon">✓</span>
                  <span className="recommendation-text">
                    Tindakan:{' '}
                    {suggestion.recommended_actions.map((item) => humanizeUiText(item)).join('; ')}
                  </span>
                </div>
              )}

              {/* Rank Badge */}
              <span className="diagnosis-rank">#{index + 1}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

// ============================================================================
// STYLES
// ============================================================================

export const diagnosisSuggestionsStyles = `
/* Diagnosis Suggestions Container */
.diagnosis-suggestions {
  background: var(--glass-bg, rgba(255, 255, 255, 0.03));
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid var(--glass-border, rgba(255, 255, 255, 0.08));
  border-radius: 12px;
  padding: 12px;
  margin-top: 12px;
}

.diagnosis-suggestions-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.diagnosis-suggestions-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary, #E5E5E5);
  margin: 0;
}

.diagnosis-suggestions-badges {
  display: flex;
  gap: 8px;
}

.badge-advisory {
  font-size: 8px;
  font-family: 'JetBrains Mono', monospace;
  color: #06B6D4;
  background: rgba(6, 182, 212, 0.1);
  padding: 2px 6px;
  border-radius: 4px;
}

.badge-audit {
  font-size: 8px;
  font-family: 'JetBrains Mono', monospace;
  color: #6B9B8A;
  background: rgba(16, 185, 129, 0.1);
  padding: 2px 6px;
  border-radius: 4px;
}

/* Selectors */
.diagnosis-selectors {
  display: flex;
  gap: 12px;
  margin-bottom: 12px;
  align-items: center;
}

.diagnosis-selector {
  display: flex;
  align-items: center;
  gap: 6px;
}

.diagnosis-selector label {
  font-size: 12px;
  color: var(--text-secondary, #A1A1AA);
}

.diagnosis-select {
  background: var(--bg-raised, #1C1F26);
  border: 1px solid var(--border-subtle, #2E3239);
  border-radius: 4px;
  padding: 4px 8px;
  font-size: 12px;
  color: var(--text-primary, #E5E5E5);
  cursor: pointer;
}

.diagnosis-refresh-btn {
  background: var(--bg-raised, #1C1F26);
  border: 1px solid var(--border-subtle, #2E3239);
  border-radius: 4px;
  width: 28px;
  height: 28px;
  font-size: 14px;
  color: var(--text-secondary, #A1A1AA);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-left: auto;
}

.diagnosis-refresh-btn:hover:not(:disabled) {
  background: var(--bg-surface, #16181D);
  color: var(--text-primary, #E5E5E5);
}

.diagnosis-refresh-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Loading State */
.diagnosis-loading {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 16px;
  color: var(--text-secondary, #A1A1AA);
  font-size: 13px;
}

.diagnosis-loading-spinner {
  width: 16px;
  height: 16px;
  border: 2px solid var(--border-subtle, #2E3239);
  border-top-color: var(--primary, #3B82F6);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* Error State */
.diagnosis-error {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px;
  background: rgba(239, 68, 68, 0.1);
  border-radius: 6px;
  color: #EF4444;
  font-size: 13px;
}

.diagnosis-error-icon {
  font-size: 16px;
}

/* Empty & Prompt State */
.diagnosis-empty,
.diagnosis-prompt {
  padding: 16px;
  text-align: center;
  color: var(--text-tertiary, #6B6B6B);
  font-size: 13px;
}

/* Suggestions List */
.diagnosis-suggestions-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

/* Suggestion Card */
.diagnosis-suggestion-card {
  position: relative;
  width: 100%;
  text-align: left;
  background: var(--glass-bg, rgba(255, 255, 255, 0.03));
  border: 1px solid var(--glass-border, rgba(255, 255, 255, 0.08));
  border-radius: 8px;
  padding: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.diagnosis-suggestion-card:hover:not(:disabled) {
  background: var(--bg-surface, #16181D);
  border-color: var(--primary, #3B82F6);
  box-shadow: 0 0 0 1px var(--primary, #3B82F6);
}

.diagnosis-suggestion-card:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.diagnosis-suggestion-card.filling {
  border-color: var(--safe, #6B9B8A);
  animation: pulse-fill 1s ease-in-out infinite;
}

@keyframes pulse-fill {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.7; }
}

.diagnosis-suggestion-main {
  padding-right: 32px;
}

.diagnosis-suggestion-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 4px;
}

.diagnosis-icd-code {
  font-family: 'JetBrains Mono', monospace;
  font-size: 14px;
  font-weight: 700;
  color: var(--primary, #3B82F6);
}

.diagnosis-confidence {
  font-family: 'JetBrains Mono', monospace;
  font-size: 12px;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 4px;
}

.diagnosis-confidence-label {
  font-size: 9px;
  opacity: 0.8;
  text-transform: uppercase;
}

.diagnosis-name {
  font-size: 13px;
  color: var(--text-primary, #E5E5E5);
  margin-bottom: 4px;
}

.diagnosis-rationale {
  font-size: 11px;
  color: var(--text-tertiary, #6B6B6B);
  font-style: italic;
}

/* Red Flags */
.diagnosis-red-flags {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  margin-top: 8px;
  padding: 8px;
  background: rgba(239, 68, 68, 0.1);
  border-radius: 4px;
}

.red-flag-icon {
  font-size: 12px;
}

.red-flag-text {
  font-size: 11px;
  color: #EF4444;
  line-height: 1.4;
}

.diagnosis-recommendations {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  margin-top: 8px;
  padding: 8px;
  background: rgba(16, 185, 129, 0.1);
  border-radius: 4px;
}

.recommendation-icon {
  font-size: 12px;
  color: #6B9B8A;
}

.recommendation-text {
  font-size: 11px;
  color: #6B9B8A;
  line-height: 1.4;
}

/* Rank Badge */
.diagnosis-rank {
  position: absolute;
  top: 8px;
  right: 8px;
  font-size: 10px;
  font-family: 'JetBrains Mono', monospace;
  color: var(--text-tertiary, #6B6B6B);
  background: var(--bg-surface, #16181D);
  padding: 2px 6px;
  border-radius: 4px;
}
`;

export default DiagnosisSuggestions;
