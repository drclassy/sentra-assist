// Designed and constructed by Claudesy.
/**
 * Assessment Widget - Clinical Assessment Summary Card
 *
 * Displays chief complaint, symptoms, and vital signs in compact form
 */

import type { AssessmentWidgetData, WidgetBaseProps } from '@/types/medlink';
import { Activity, AlertTriangle, ChevronRight, Stethoscope } from 'lucide-react';

/**
 * AssessmentWidgetProps interface
 * 
 * @remarks
 * TODO: Add type description and property documentation
 * Auto-generated on 2026-03-12
 */

export interface AssessmentWidgetProps extends WidgetBaseProps {
  data: AssessmentWidgetData;
}

/**
 * AssessmentWidget
 * 
 * @remarks
 * TODO: Add detailed description, parameters, and examples
 * Auto-generated on 2026-03-12
 */

export function AssessmentWidget({ mode, data, onClick, className = '' }: AssessmentWidgetProps) {
  const hasEmergencyFlags = (data.emergencyFlags || 0) > 0;

  return (
    <div className={`medlink-widget medlink-slide-in ${className}`} onClick={onClick}>
      {/* Widget Header */}
      <div className="medlink-widget-header">
        <div className="medlink-widget-title">
          <Stethoscope className="medlink-widget-icon" />
          <span>Assessment</span>
        </div>
        {hasEmergencyFlags && (
          <div
            className="medlink-widget-badge"
            style={{
              background: 'rgba(239, 68, 68, 0.1)',
              borderColor: 'rgba(239, 68, 68, 0.3)',
              color: '#FCA5A5',
            }}
          >
            <AlertTriangle className="w-3 h-3 inline mr-1" />
            {data.emergencyFlags} Alert{data.emergencyFlags! > 1 ? 's' : ''}
          </div>
        )}
      </div>

      {/* Chief Complaint */}
      {data.chiefComplaint && (
        <div className="mb-3">
          <div className="text-[10px] text-muted uppercase tracking-wide mb-1">Chief Complaint</div>
          <div className="text-sm text-cream font-medium leading-relaxed">
            {data.chiefComplaint}
          </div>
        </div>
      )}

      {/* Symptoms */}
      {data.symptoms && data.symptoms.length > 0 && (
        <div className="mb-3">
          <div className="text-[10px] text-muted uppercase tracking-wide mb-2">Key Symptoms</div>
          <div className="flex flex-wrap gap-1.5">
            {data.symptoms.slice(0, 4).map((symptom, idx) => (
              <span key={idx} className="medlink-symptom-tag">
                {symptom}
              </span>
            ))}
            {data.symptoms.length > 4 && (
              <span className="medlink-symptom-tag" style={{ opacity: 0.6 }}>
                +{data.symptoms.length - 4} more
              </span>
            )}
          </div>
        </div>
      )}

      {/* Vital Signs */}
      {data.vitalSigns && (
        <div className="medlink-widget-content">
          <div className="text-[10px] text-muted uppercase tracking-wide mb-2">Vital Signs</div>
          <div className="grid grid-cols-2 gap-2">
            {/* Blood Pressure */}
            {data.vitalSigns.bloodPressure && (
              <div className="medlink-vital-chip">
                <span className="medlink-vital-label">BP:</span>
                <span className="medlink-vital-value">
                  {data.vitalSigns.bloodPressure.systolic}/{data.vitalSigns.bloodPressure.diastolic}
                </span>
              </div>
            )}

            {/* Heart Rate */}
            {data.vitalSigns.heartRate && (
              <div className="medlink-vital-chip">
                <Activity className="w-3 h-3" style={{ color: 'var(--medlink-primary)' }} />
                <span className="medlink-vital-value">{data.vitalSigns.heartRate} bpm</span>
              </div>
            )}

            {/* Temperature */}
            {data.vitalSigns.temperature && (
              <div className="medlink-vital-chip">
                <span className="medlink-vital-label">Temp:</span>
                <span
                  className="medlink-vital-value"
                  style={{
                    color:
                      data.vitalSigns.temperature > 37.5 ? '#FCA5A5' : 'var(--medlink-primary)',
                  }}
                >
                  {data.vitalSigns.temperature}°C
                </span>
              </div>
            )}

            {/* Glucose */}
            {data.vitalSigns.glucose && (
              <div className="medlink-vital-chip">
                <span className="medlink-vital-label">GDS:</span>
                <span className="medlink-vital-value">{data.vitalSigns.glucose} mg/dL</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Widget Footer */}
      <div className="medlink-widget-footer">
        <div className="text-[10px] text-muted">
          {mode === 'widget' ? 'Click to expand' : 'Full assessment'}
        </div>
        <div className="medlink-expand-btn">
          <span>View Details</span>
          <ChevronRight className="w-4 h-4" />
        </div>
      </div>
    </div>
  );
}
