// Designed and constructed by Claudesy.
/**
 * Precision-Architected. Future-Built by Docsyanpse
 * Sentra Healthcare Artificial Intelligence
 */

/**
 * Diagnosis Card Component
 * Displays a single AI diagnosis suggestion
 *
 * @module components/cdss/DiagnosisCard
 */

import { useState } from 'react';
import { ChevronDown, ChevronUp, Check, Copy, AlertTriangle } from 'lucide-react';
import { ConfidenceMeter } from './ConfidenceMeter';
import type { ValidatedSuggestion } from '@/lib/iskandar-diagnosis-engine/validation/types';

// =============================================================================
// TYPES
// =============================================================================

const HIGH_CONFIDENCE_THRESHOLD = 0.85;
const MEDIUM_CONFIDENCE_THRESHOLD = 0.65;

interface DiagnosisCardProps {
  /** Diagnosis suggestion data */
  suggestion: ValidatedSuggestion;

  /** Rank in the list (1-based) */
  rank: number;

  /** Callback when diagnosis is selected */
  onSelect?: (suggestion: ValidatedSuggestion) => void;

  /** Whether the card is in selected state */
  selected?: boolean;

  /** Additional CSS classes */
  className?: string;
}

// =============================================================================
// COMPONENT
// =============================================================================

/**
 * DiagnosisCard
 * Displays diagnosis suggestion with ICD-10 code, name, confidence, and reasoning
 *
 * Border color indicates confidence:
 * - High (>=85%): border-safe
 * - Medium (65-84%): border-caution
 * - Low (<65%): border-status-info
 */
export function DiagnosisCard({
  suggestion,
  rank,
  onSelect,
  selected = false,
  className = '',
}: DiagnosisCardProps) {
  const [expanded, setExpanded] = useState(false);

  const confidence = suggestion.confidence;

  // Determine border color based on confidence
  const borderColor =
    confidence >= HIGH_CONFIDENCE_THRESHOLD
      ? 'border-safe'
      : confidence >= MEDIUM_CONFIDENCE_THRESHOLD
        ? 'border-caution'
        : 'border-status-info';

  // Handle copy ICD code
  const handleCopyCode = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(suggestion.icd10_code);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  // Handle select
  const handleSelect = () => {
    onSelect?.(suggestion);
  };

  // Has validation flags
  const hasFlags = suggestion.validation_flags && suggestion.validation_flags.length > 0;

  return (
    <div
      className={`neu-card p-4 border-l-4 ${borderColor} transition-all ${
        selected ? 'ring-2 ring-pulse-500/50' : ''
      } ${className}`}
    >
      {/* Header: Rank + ICD Code + Name */}
      <div className="flex items-start gap-3">
        {/* Rank badge */}
        <div className="flex-shrink-0 w-6 h-6 rounded-full bg-carbon-800 flex items-center justify-center">
          <span className="text-tiny text-muted font-mono">{rank}</span>
        </div>

        <div className="flex-1 min-w-0">
          {/* ICD Code + Copy button */}
          <div className="flex items-center gap-2 mb-1">
            <code className="text-subtitle font-mono text-pulse-500">{suggestion.icd10_code}</code>
            <button
              onClick={handleCopyCode}
              className="p-1 hover:bg-carbon-800 rounded transition-colors"
              aria-label="Copy ICD-10 code"
            >
              <Copy className="w-3.5 h-3.5 text-muted" />
            </button>
            {/* Verification badge */}
            {suggestion.rag_verified && (
              <span className="text-tiny text-safe flex items-center gap-0.5">
                <Check className="w-3 h-3" />
                <span>Verified</span>
              </span>
            )}
          </div>

          {/* Diagnosis name */}
          <p className="text-small text-platinum leading-snug">{suggestion.diagnosis_name}</p>

          {/* Confidence meter */}
          <div className="mt-2">
            <ConfidenceMeter confidence={confidence} size="sm" />
          </div>
        </div>
      </div>

      {/* Validation flags warning */}
      {hasFlags && (
        <div className="mt-3 flex items-start gap-2 p-2 rounded bg-caution/10 border border-caution/20">
          <AlertTriangle className="w-4 h-4 text-caution flex-shrink-0 mt-0.5" />
          <div className="text-tiny text-caution">
            {suggestion.validation_flags?.map((flag) => (
              <p key={flag.code}>{flag.message}</p>
            ))}
          </div>
        </div>
      )}

      {/* Expand/Collapse button */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="mt-3 w-full flex items-center justify-center gap-1 py-1.5 text-caption text-muted hover:text-platinum transition-colors"
        aria-expanded={expanded}
        aria-label={expanded ? 'Hide reasoning' : 'Show reasoning'}
      >
        {expanded ? (
          <>
            <ChevronUp className="w-4 h-4" />
            <span>Sembunyikan</span>
          </>
        ) : (
          <>
            <ChevronDown className="w-4 h-4" />
            <span>Lihat Alasan</span>
          </>
        )}
      </button>

      {/* Expanded: Reasoning */}
      {expanded && (
        <div className="mt-3 pt-3 border-t border-carbon-700">
          <p className="text-caption text-muted mb-1">Alasan Klinis:</p>
          <p className="text-small text-platinum/80 leading-relaxed">{suggestion.reasoning}</p>

          {/* Red flags from AI */}
          {suggestion.red_flags && suggestion.red_flags.length > 0 && (
            <div className="mt-3">
              <p className="text-caption text-critical mb-1">Peringatan AI:</p>
              <ul className="text-small text-critical/80 list-disc list-inside">
                {suggestion.red_flags.map((flag, idx) => (
                  <li key={idx}>{flag}</li>
                ))}
              </ul>
            </div>
          )}

          {suggestion.recommended_actions && suggestion.recommended_actions.length > 0 && (
            <div className="mt-3">
              <p className="text-caption text-safe mb-1">Rekomendasi:</p>
              <ul className="text-small text-safe/80 list-disc list-inside">
                {suggestion.recommended_actions.map((action, idx) => (
                  <li key={idx}>{action}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Select button */}
      {onSelect && (
        <button
          onClick={handleSelect}
          disabled={selected}
          className={`mt-4 w-full py-2.5 rounded-lg text-small font-medium transition-all ${
            selected
              ? 'bg-safe/20 text-safe border border-safe/30 cursor-default'
              : 'neu-action-btn text-platinum'
          }`}
        >
          {selected ? (
            <span className="flex items-center justify-center gap-2">
              <Check className="w-4 h-4" />
              Dipilih
            </span>
          ) : (
            'Pilih Diagnosis Ini'
          )}
        </button>
      )}
    </div>
  );
}

// =============================================================================
// EXPORTS
// =============================================================================

export type { DiagnosisCardProps };
