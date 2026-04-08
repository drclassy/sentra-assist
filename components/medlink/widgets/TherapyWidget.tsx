// Designed and constructed by Claudesy.
/**
 * Therapy Widget - Treatment Recommendations Summary
 *
 * Displays medications and counseling advice
 */

import type { TherapyWidgetData, WidgetBaseProps } from '@/types/medlink';
import { ChevronRight, Pill, Shield } from 'lucide-react';

/**
 * TherapyWidgetProps interface
 * 
 * @remarks
 * TODO: Add type description and property documentation
 * Auto-generated on 2026-03-12
 */

export interface TherapyWidgetProps extends WidgetBaseProps {
  data: TherapyWidgetData;
}

/**
 * TherapyWidget
 * 
 * @remarks
 * TODO: Add detailed description, parameters, and examples
 * Auto-generated on 2026-03-12
 */

export function TherapyWidget({ mode: _mode, data, onClick, className = '' }: TherapyWidgetProps) {
  const medicationCount = data.medications.length;
  const hasInteractions = data.medications.some(
    (med) => med.interactions && med.interactions.length > 0
  );

  return (
    <div
      className={`medlink-widget medlink-slide-in ${className}`}
      onClick={onClick}
      style={{ animationDelay: '0.2s' }}
    >
      {/* Widget Header */}
      <div className="medlink-widget-header">
        <div className="medlink-widget-title">
          <Pill className="medlink-widget-icon" />
          <span>Therapy</span>
        </div>
        {hasInteractions && (
          <div
            className="medlink-widget-badge"
            style={{
              background: 'rgba(245, 158, 11, 0.1)',
              borderColor: 'rgba(245, 158, 11, 0.3)',
              color: '#FCD34D',
            }}
          >
            <Shield className="w-3 h-3 inline mr-1" />
            DDI Alert
          </div>
        )}
      </div>

      {/* Medications */}
      {medicationCount > 0 && (
        <div className="mb-3">
          <div className="text-[10px] text-muted uppercase tracking-wide mb-2">
            Medications ({medicationCount})
          </div>
          <div className="space-y-2">
            {data.medications.slice(0, 2).map((med) => (
              <div key={med.id} className="medlink-rx-dosage">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <div className="medlink-rx-name">{med.drugName}</div>
                    <div className="medlink-rx-sig">
                      {med.dosage} • {med.frequency} • {med.route} • {med.duration.value}{' '}
                      {med.duration.unit}
                    </div>
                  </div>
                  {med.interactions && med.interactions.length > 0 && (
                    <div className="flex-shrink-0">
                      <span className="text-xs text-amber-400" title="Drug interaction warning">
                        ⚠
                      </span>
                    </div>
                  )}
                </div>

                {/* Instructions */}
                <div className="text-xs text-muted mt-1 leading-relaxed">{med.instructions}</div>
              </div>
            ))}

            {medicationCount > 2 && (
              <div className="text-xs text-muted text-center py-1">
                +{medicationCount - 2} more medication{medicationCount > 3 ? 's' : ''}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Procedures */}
      {data.procedures && data.procedures.length > 0 && (
        <div className="mb-3">
          <div className="text-[10px] text-muted uppercase tracking-wide mb-2">
            Procedures ({data.procedures.length})
          </div>
          <div className="space-y-1">
            {data.procedures.map((proc) => (
              <div key={proc.id} className="text-sm text-cream">
                • {proc.name}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Counseling */}
      {data.counseling && data.counseling.length > 0 && (
        <div className="medlink-widget-content">
          <div className="text-[10px] text-muted uppercase tracking-wide mb-2">
            Patient Counseling
          </div>
          <div className="space-y-1">
            {data.counseling.slice(0, 3).map((advice, idx) => (
              <div key={idx} className="flex items-start gap-2">
                <span className="text-medlink-primary mt-0.5">→</span>
                <span className="text-xs text-cream leading-relaxed flex-1">{advice}</span>
              </div>
            ))}
            {data.counseling.length > 3 && (
              <div className="text-xs text-muted italic">
                +{data.counseling.length - 3} more instruction
                {data.counseling.length > 4 ? 's' : ''}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Empty State */}
      {medicationCount === 0 &&
        (!data.procedures || data.procedures.length === 0) &&
        (!data.counseling || data.counseling.length === 0) && (
          <div className="text-sm text-muted italic py-6 text-center">
            No therapy recommendations yet
          </div>
        )}

      {/* Widget Footer */}
      <div className="medlink-widget-footer">
        <div className="text-[10px] text-muted">Safety checks active</div>
        <div className="medlink-expand-btn">
          <span>Full Prescription</span>
          <ChevronRight className="w-4 h-4" />
        </div>
      </div>
    </div>
  );
}
