// Designed and constructed by Claudesy.
/**
 * Diagnosis Widget - AI-Suggested Diagnoses Summary
 *
 * Displays top differential diagnoses with confidence scores
 */

import type { DiagnosisWidgetData, WidgetBaseProps } from '@/types/medlink';
import { Brain, ChevronRight, TrendingUp } from 'lucide-react';

/**
 * DiagnosisWidgetProps interface
 * 
 * @remarks
 * TODO: Add type description and property documentation
 * Auto-generated on 2026-03-12
 */

export interface DiagnosisWidgetProps extends WidgetBaseProps {
  data: DiagnosisWidgetData;
}

/**
 * DiagnosisWidget
 * 
 * @remarks
 * TODO: Add detailed description, parameters, and examples
 * Auto-generated on 2026-03-12
 */

export function DiagnosisWidget({
  mode: _mode,
  data,
  onClick,
  className = '',
}: DiagnosisWidgetProps) {
  const topSuggestions = data.suggestions.slice(0, 3);
  const confirmedCount = data.confirmed?.length || 0;

  return (
    <div
      className={`medlink-widget medlink-slide-in ${className}`}
      onClick={onClick}
      style={{ animationDelay: '0.1s' }}
    >
      {/* Widget Header */}
      <div className="medlink-widget-header">
        <div className="medlink-widget-title">
          <Brain className="medlink-widget-icon" />
          <span>Diagnosis</span>
        </div>
        <div className="medlink-widget-badge">
          <TrendingUp className="w-3 h-3 inline mr-1" />
          AI-Assisted
        </div>
      </div>

      {/* Confirmed Diagnoses Count */}
      {confirmedCount > 0 && (
        <div
          className="mb-3 p-2 rounded-lg"
          style={{
            background: 'rgba(16, 185, 129, 0.1)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
          }}
        >
          <div className="text-sm text-emerald-400 font-medium">
            {confirmedCount} Confirmed Diagnos{confirmedCount > 1 ? 'es' : 'is'}
          </div>
        </div>
      )}

      {/* Differential Diagnoses */}
      <div className="medlink-widget-content">
        <div className="text-[10px] text-muted uppercase tracking-wide mb-2">Top Differentials</div>

        {topSuggestions.length === 0 ? (
          <div className="text-sm text-muted italic py-4 text-center">
            No diagnosis suggestions yet
          </div>
        ) : (
          <div className="space-y-3">
            {topSuggestions.map((diagnosis, _idx) => (
              <div key={diagnosis.id} className="space-y-1">
                {/* Diagnosis Name + ICD Code */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <div className="text-sm text-cream font-medium leading-tight">
                      {diagnosis.description}
                    </div>
                    <div className="mt-1">
                      <span className="medlink-icd-badge">ICD: {diagnosis.icd10Code}</span>
                    </div>
                  </div>
                  <div
                    className="text-xs font-semibold"
                    style={{
                      color:
                        diagnosis.confidence > 0.7
                          ? '#10B981'
                          : diagnosis.confidence > 0.5
                            ? '#F59E0B'
                            : '#6B7280',
                    }}
                  >
                    {Math.round(diagnosis.confidence * 100)}%
                  </div>
                </div>

                {/* Confidence Bar */}
                <div className="medlink-confidence-bar">
                  <div
                    className="medlink-confidence-fill"
                    style={{ width: `${diagnosis.confidence * 100}%` }}
                  />
                </div>

                {/* Reasoning (truncated) */}
                <div className="text-xs text-muted leading-relaxed">
                  {diagnosis.reasoning.length > 80
                    ? diagnosis.reasoning.substring(0, 80) + '...'
                    : diagnosis.reasoning}
                </div>

                {/* Red Flags */}
                {diagnosis.redFlags && diagnosis.redFlags.length > 0 && (
                  <div className="mt-1 text-xs text-red-400 flex items-center gap-1">
                    <span className="text-[10px]">⚠</span>
                    <span>{diagnosis.redFlags[0]}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Widget Footer */}
      <div className="medlink-widget-footer">
        <div className="text-[10px] text-muted">CDSS powered by Vertex AI</div>
        <div className="medlink-expand-btn">
          <span>View All</span>
          <ChevronRight className="w-4 h-4" />
        </div>
      </div>
    </div>
  );
}
