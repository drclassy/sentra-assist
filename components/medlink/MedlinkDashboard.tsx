// Designed and constructed by Claudesy.
/**
 * Medlink Dashboard - Main Container Component
 *
 * Manages widget mode vs. full page mode with responsive layout
 */

import type {
  AssessmentWidgetData,
  DiagnosisWidgetData,
  TherapyWidgetData,
  WidgetLayout,
  WidgetType,
} from '@/types/medlink';
import { LayoutGrid, PlusSquare } from 'lucide-react';
import { useEffect, useState } from 'react';
import './styles.css';
import { AssessmentWidget } from './widgets/AssessmentWidget';
import { DiagnosisWidget } from './widgets/DiagnosisWidget';
import { TherapyWidget } from './widgets/TherapyWidget';

/**
 * MedlinkDashboardProps interface
 * 
 * @remarks
 * TODO: Add type description and property documentation
 * Auto-generated on 2026-03-12
 */

export interface MedlinkDashboardProps {
  // Optional: Override patient context
  patientId?: string;

  // Optional: Pre-load data
  initialAssessment?: AssessmentWidgetData;
  initialDiagnosis?: DiagnosisWidgetData;
  initialTherapy?: TherapyWidgetData;
}

/**
 * MedlinkDashboard
 * 
 * @remarks
 * TODO: Add detailed description, parameters, and examples
 * Auto-generated on 2026-03-12
 */

export function MedlinkDashboard({
  patientId: _patientId,
  initialAssessment,
  initialDiagnosis,
  initialTherapy,
}: MedlinkDashboardProps) {
  const [activeView, setActiveView] = useState<
    'dashboard' | 'assessment' | 'diagnosis' | 'therapy'
  >('dashboard');
  const [layout, setLayout] = useState<WidgetLayout>({
    columns: 3,
    widgetOrder: ['assessment', 'diagnosis', 'therapy'],
    collapsed: [],
  });

  // Mock data for Phase 1 (will be replaced with API/store data in Phase 2)
  const [assessmentData] = useState<AssessmentWidgetData>(
    initialAssessment || {
      chiefComplaint: 'Demam 3 hari, batuk berdahak',
      symptoms: ['Demam', 'Batuk produktif', 'Nyeri kepala', 'Lemas'],
      vitalSigns: {
        bloodPressure: { systolic: 120, diastolic: 80, map: 93 },
        heartRate: 88,
        respiratoryRate: 18,
        temperature: 38.2,
        oxygenSaturation: 98,
        glucose: 105,
      },
      emergencyFlags: 0,
    }
  );

  const [diagnosisData] = useState<DiagnosisWidgetData>(
    initialDiagnosis || {
      suggestions: [
        {
          id: 'dx-1',
          icd10Code: 'J20.9',
          description: 'Acute bronchitis, unspecified',
          confidence: 0.85,
          differential: true,
          reasoning: 'Productive cough + fever + normal vital signs',
          supportingEvidence: ['Fever 3 days', 'Productive cough', 'No respiratory distress'],
          source: 'cdss',
          probability: 0.85,
          createdAt: new Date(),
        },
        {
          id: 'dx-2',
          icd10Code: 'J18.9',
          description: 'Pneumonia, unspecified organism',
          confidence: 0.45,
          differential: true,
          reasoning: 'Fever + productive cough (requires chest exam/X-ray to confirm)',
          supportingEvidence: ['Fever', 'Productive cough'],
          source: 'cdss',
          probability: 0.45,
          redFlags: ['Consider if respiratory symptoms worsen'],
          createdAt: new Date(),
        },
      ],
      confirmed: [],
    }
  );

  const [therapyData] = useState<TherapyWidgetData>(
    initialTherapy || {
      medications: [
        {
          id: 'rx-1',
          type: 'medication',
          name: 'Paracetamol 500mg',
          drugName: 'Paracetamol',
          genericName: 'Acetaminophen',
          dosage: '500mg',
          frequency: 'TID',
          route: 'PO',
          duration: { value: 5, unit: 'days' },
          quantity: 15,
          instructions: 'Minum 3x sehari sesudah makan',
          contraindications: ['Liver disease', 'Alcohol abuse'],
          createdAt: new Date(),
        },
      ],
      counseling: [
        'Istirahat cukup 7-8 jam/hari',
        'Minum air putih minimal 8 gelas/hari',
        'Hindari aktivitas berat',
      ],
    }
  );

  // Handle widget click - navigate to full page view
  const handleWidgetClick = (widgetType: WidgetType) => {
    console.log('[Medlink] Widget clicked:', widgetType);
    setActiveView(widgetType as 'assessment' | 'diagnosis' | 'therapy');
    // TODO: Phase 3 - Render full page component
  };

  // Handle back to dashboard
  const handleBackToDashboard = () => {
    setActiveView('dashboard');
  };

  // Responsive layout adjustment
  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      if (width < 768) {
        setLayout((prev) => ({ ...prev, columns: 1 }));
      } else if (width < 1024) {
        setLayout((prev) => ({ ...prev, columns: 2 }));
      } else {
        setLayout((prev) => ({ ...prev, columns: 3 }));
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Dashboard view - widget grid
  if (activeView === 'dashboard') {
    return (
      <div className="medlink-dashboard">
        {/* Header */}
        <div className="medlink-header">
          <div className="flex items-center gap-3">
            <div className="medlink-icon-wrapper">
              <PlusSquare className="w-6 h-6 text-medlink-primary" />
            </div>
            <div>
              <h2 className="text-title text-platinum">Medlink Integration</h2>
              <p className="text-small text-muted mt-0.5">Clinical Workflow Assistant</p>
            </div>
          </div>

          {/* Layout controls */}
          <div className="flex items-center gap-2">
            <button
              className="medlink-control-btn"
              onClick={() => {
                setLayout((prev) => {
                  const nextColumns = ((prev.columns % 3) + 1) as 1 | 2 | 3;
                  return { ...prev, columns: nextColumns };
                });
              }}
            >
              <LayoutGrid className="w-4 h-4" />
              <span className="text-small">{layout.columns} cols</span>
            </button>
          </div>
        </div>

        {/* Widget Grid */}
        <div
          className="medlink-widget-grid"
          style={{
            gridTemplateColumns: `repeat(${layout.columns}, 1fr)`,
          }}
        >
          {/* Assessment Widget */}
          {layout.widgetOrder.includes('assessment') &&
            !layout.collapsed.includes('assessment') && (
              <AssessmentWidget
                mode="widget"
                data={assessmentData}
                onClick={() => handleWidgetClick('assessment')}
              />
            )}

          {/* Diagnosis Widget */}
          {layout.widgetOrder.includes('diagnosis') && !layout.collapsed.includes('diagnosis') && (
            <DiagnosisWidget
              mode="widget"
              data={diagnosisData}
              onClick={() => handleWidgetClick('diagnosis')}
            />
          )}

          {/* Therapy Widget */}
          {layout.widgetOrder.includes('therapy') && !layout.collapsed.includes('therapy') && (
            <TherapyWidget
              mode="widget"
              data={therapyData}
              onClick={() => handleWidgetClick('therapy')}
            />
          )}
        </div>

        {/* Footer Info */}
        <div className="medlink-footer">
          <div className="flex items-center gap-2 text-small text-muted">
            <div className="w-2 h-2 rounded-full bg-medlink-primary animate-pulse" />
            <span>Mock Mode (Phase 1)</span>
          </div>
          <div className="text-small text-muted">API Integration: Coming in Phase 2</div>
        </div>
      </div>
    );
  }

  // Full page views (Phase 3 - Placeholder for now)
  return (
    <div className="medlink-fullpage">
      <div className="medlink-fullpage-header">
        <button onClick={handleBackToDashboard} className="medlink-back-btn">
          ← Back to Dashboard
        </button>
        <h2 className="text-title text-platinum capitalize">{activeView}</h2>
      </div>

      <div className="medlink-fullpage-content">
        <div className="text-center text-muted py-12">
          <p className="text-body mb-2">Full {activeView} page coming in Phase 3</p>
          <p className="text-small">Widget mode is fully functional</p>
        </div>
      </div>
    </div>
  );
}
