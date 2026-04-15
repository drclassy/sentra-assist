// Designed and constructed by Claudesy.
/**
 * Precision-Architected. Future-Built by Docsyanpse
 * Sentra Healthcare Artificial Intelligence
 */

/**
 * CDSS Widget Component
 * Main container for Clinical Decision Support UI
 *
 * @module components/cdss/CDSSWidget
 */

import { useState, useEffect, useCallback } from 'react';
import {
  Sparkles,
  Loader2,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Database,
  Zap,
} from 'lucide-react';
import { sendMessage } from '@/utils/messaging';
import { DiagnosisCard } from './DiagnosisCard';
import { RedFlagAlert } from './RedFlagAlert';
import { CDSSDisclaimer } from './CDSSDisclaimer';
import type { CDSSEngineResult } from '@/lib/iskandar-diagnosis-engine/engine';
import type { ValidatedSuggestion } from '@/lib/iskandar-diagnosis-engine/validation/types';
import type { RedFlag } from '@/lib/iskandar-diagnosis-engine/red-flags';

// =============================================================================
// TYPES
// =============================================================================

interface CDSSWidgetProps {
  /** Callback when a diagnosis is selected */
  onDiagnosisSelect?: (suggestion: ValidatedSuggestion) => void;

  /** Additional CSS classes */
  className?: string;
}

interface CDSSStatus {
  ready: boolean;
  icd10_count: number;
  model: string;
  loading: boolean;
  error?: string;
}

// =============================================================================
// COMPONENT
// =============================================================================

/**
 * CDSSWidget
 * Main CDSS interface in Side Panel
 *
 * Features:
 * - Run AI diagnosis analysis
 * - Display red flag alerts (HARDCODED rules)
 * - Show validated suggestions
 * - Track acknowledged alerts
 */
export function CDSSWidget({ onDiagnosisSelect, className = '' }: CDSSWidgetProps) {
  // State
  const [status, setStatus] = useState<CDSSStatus>({
    ready: false,
    icd10_count: 0,
    model: 'deepseek-r1-0528',
    loading: true,
  });
  const [result, setResult] = useState<CDSSEngineResult | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedDiagnosis, setSelectedDiagnosis] = useState<string | null>(null);
  const [acknowledgedFlags, setAcknowledgedFlags] = useState<Set<string>>(new Set());

  const getAlertToneClass = (severity: string) => {
    if (severity === 'emergency' || severity === 'high') {
      return 'border-critical/30 bg-critical/5 text-critical';
    }
    if (severity === 'medium') {
      return 'border-caution/30 bg-caution/10 text-caution';
    }
    return 'border-cyan-500/20 bg-cyan-500/5 text-cyan-300';
  };

  // Check CDSS status on mount
  useEffect(() => {
    checkStatus();
  }, []);

  // Check CDSS engine status
  const checkStatus = async () => {
    setStatus((prev) => ({ ...prev, loading: true }));
    try {
      const response = await sendMessage('getCDSSStatus', undefined);
      if (response) {
        setStatus({
          ready: response.ready,
          icd10_count: response.icd10_count,
          model: response.model,
          loading: false,
        });
      }
    } catch (err) {
      console.error('[CDSSWidget] Status check failed:', err);
      setStatus((prev) => ({
        ...prev,
        loading: false,
        error: err instanceof Error ? err.message : 'Status check failed',
      }));
    }
  };

  // Run diagnosis analysis
  const runAnalysis = useCallback(async () => {
    setAnalyzing(true);
    setError(null);
    setSelectedDiagnosis(null);
    setAcknowledgedFlags(new Set());

    try {
      const response = await sendMessage('getSuggestions', {
        keluhan_utama: '', // Will be read from encounter in background
        patient_age: 0,
        patient_gender: 'M',
      });

      if (response.success && response.data) {
        // Transform API response to CDSSEngineResult format
        const engineResult: CDSSEngineResult = {
          suggestions: (response.data.diagnosis_suggestions || []).map((s, idx) => ({
            // AIDiagnosisSuggestion fields
            rank: idx + 1,
            diagnosis_name: s.nama || s.diagnosis_name || '',
            icd10_code: s.icd_x || s.icd10_code || '',
            confidence: s.confidence || 0,
            reasoning: s.rationale || s.reasoning || '',
            red_flags: s.red_flags || [],
            recommended_actions: s.recommended_actions || [],
            // ValidatedSuggestion fields
            rag_verified: true,
            confidence_adjusted: false,
            validation_flags: [],
          })),
          red_flags: (response.data.alerts || [])
            .filter((a) => a.type === 'red_flag')
            .map((a) => ({
              id: a.id || `rf-${Date.now()}`,
              severity: a.severity as RedFlag['severity'],
              condition: a.title || '',
              action: a.action || '',
              icd_codes: a.icd_codes || [],
              criteria_met: [a.message || ''],
            })),
          alerts: response.data.alerts || [],
          processing_time_ms: response.data.meta?.processing_time_ms || 0,
          source: response.data.meta?.is_local ? 'local' : 'ai',
          model_version: response.data.meta?.model_version || 'unknown',
          validation_summary: {
            total_raw:
              response.data.validation_summary?.total_raw ||
              response.data.diagnosis_suggestions?.length ||
              0,
            total_validated:
              response.data.validation_summary?.total_validated ||
              response.data.diagnosis_suggestions?.length ||
              0,
            unverified_codes: response.data.validation_summary?.unverified_codes || [],
            warnings: response.data.validation_summary?.warnings || [],
          },
        };

        setResult(engineResult);
      } else {
        setError(response.error?.message || 'Analysis failed');
      }
    } catch (err) {
      console.error('[CDSSWidget] Analysis failed:', err);
      setError(err instanceof Error ? err.message : 'Analysis failed');
    } finally {
      setAnalyzing(false);
    }
  }, []);

  // Handle diagnosis selection
  const handleDiagnosisSelect = (suggestion: ValidatedSuggestion) => {
    setSelectedDiagnosis(suggestion.icd10_code);
    onDiagnosisSelect?.(suggestion);
  };

  // Handle red flag acknowledgement
  const handleAcknowledgeFlag = (flagId: string) => {
    setAcknowledgedFlags((prev) => new Set([...prev, flagId]));
  };

  // Render status indicator
  const renderStatusIndicator = () => {
    if (status.loading) {
      return (
        <div className="flex items-center gap-2 text-muted">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-caption">Memeriksa status...</span>
        </div>
      );
    }

    if (!status.ready) {
      return (
        <div className="flex items-center gap-2 text-caution">
          <AlertCircle className="w-4 h-4" />
          <span className="text-caption">Database belum siap</span>
        </div>
      );
    }

    return (
      <div className="flex items-center gap-2 text-safe">
        <CheckCircle2 className="w-4 h-4" />
        <span className="text-caption">Siap ({status.icd10_count.toLocaleString()} kode)</span>
      </div>
    );
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Header with status */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-pulse-500" />
          <h2 className="text-subtitle font-semibold text-platinum">CDSS AI</h2>
        </div>
        {renderStatusIndicator()}
      </div>

      {/* Disclaimer (compact) */}
      <CDSSDisclaimer compact />

      {/* Red Flag Alerts (always show first if present) */}
      {result?.red_flags && result.red_flags.length > 0 && (
        <div className="space-y-3">
          {result.red_flags.map((flag) => (
            <RedFlagAlert
              key={flag.id}
              flag={flag}
              acknowledged={acknowledgedFlags.has(flag.id)}
              onAcknowledge={handleAcknowledgeFlag}
            />
          ))}
        </div>
      )}

      {/* Analysis Results */}
      {result && (
        <div className="space-y-3">
          {/* Result metadata */}
          <div className="neu-card p-3 flex items-center justify-between">
            <div className="flex items-center gap-3 text-caption text-muted">
              <span className="flex items-center gap-1">
                <Database className="w-3.5 h-3.5" />
                {result.model_version?.includes('sentra-inference-v3')
                  ? 'Sentra Inference v3'
                  : result.source === 'ai'
                    ? 'DeepSeek AI'
                    : 'Edge AI / Offline Mode'}
              </span>
              <span className="flex items-center gap-1">
                <Zap className="w-3.5 h-3.5" />
                {result.processing_time_ms}ms
              </span>
            </div>
            <button
              onClick={runAnalysis}
              disabled={analyzing}
              className="p-1.5 hover:bg-carbon-800 rounded transition-colors"
              aria-label="Refresh analysis"
            >
              <RefreshCw className={`w-4 h-4 text-muted ${analyzing ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {/* Diagnosis suggestions */}
          {result.suggestions.length > 0 ? (
            <div className="space-y-3">
              <p className="text-caption text-muted px-1">
                {result.suggestions.length} saran diagnosis
              </p>
              {result.suggestions.map((suggestion, idx) => (
                <DiagnosisCard
                  key={suggestion.icd10_code}
                  suggestion={suggestion}
                  rank={idx + 1}
                  selected={selectedDiagnosis === suggestion.icd10_code}
                  onSelect={handleDiagnosisSelect}
                />
              ))}
            </div>
          ) : (
            <div className="neu-card p-6 text-center">
              <p className="text-small text-muted">
                Tidak ada saran diagnosis yang memenuhi kriteria validasi.
              </p>
            </div>
          )}

          {/* Validation warnings */}
          {result.validation_summary.warnings.length > 0 && (
            <div className="neu-card p-3 border border-caution/20 bg-caution/5">
              <p className="text-caption text-caution mb-1">Peringatan Validasi:</p>
              <ul className="text-small text-caution/80 list-disc list-inside">
                {result.validation_summary.warnings.map((warning, idx) => (
                  <li key={idx}>{warning}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Non-red alerts */}
          {result.alerts.filter((a) => a.type !== 'red_flag').length > 0 && (
            <div className="space-y-2">
              {result.alerts
                .filter((a) => a.type !== 'red_flag')
                .map((alert) => (
                  <div
                    key={alert.id}
                    className={`neu-card p-3 border ${getAlertToneClass(alert.severity)}`}
                  >
                    <p className="text-caption font-medium">{alert.title}</p>
                    <p className="text-small opacity-90 mt-1">{alert.message}</p>
                    {alert.action && <p className="text-small mt-1">Tindakan: {alert.action}</p>}
                  </div>
                ))}
            </div>
          )}
        </div>
      )}

      {/* Error display */}
      {error && (
        <div className="neu-card p-4 border border-critical/30 bg-critical/5">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-critical flex-shrink-0" />
            <div>
              <p className="text-small text-critical font-medium">Analisis Gagal</p>
              <p className="text-caption text-critical/80 mt-1">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Run Analysis Button */}
      <button
        onClick={runAnalysis}
        disabled={analyzing || !status.ready}
        className="neu-action-btn w-full py-3.5 text-subtitle text-platinum flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {analyzing ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>Menganalisis...</span>
          </>
        ) : (
          <>
            <Sparkles className="w-5 h-5" />
            <span>Analisis AI</span>
          </>
        )}
      </button>

      {/* Full disclaimer (at bottom) */}
      {result && <CDSSDisclaimer />}
    </div>
  );
}

// =============================================================================
// EXPORTS
// =============================================================================

export type { CDSSWidgetProps };
