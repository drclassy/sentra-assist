// Designed and constructed by Claudesy.
/**
 * Medlink Integration Module - Type Definitions
 *
 * Normalized data models for EMR integration and clinical workflows
 */

// ============================================================================
// Core Clinical Data Models
// ============================================================================

export interface Assessment {
  id: string
  patientId: string
  timestamp: Date
  chiefComplaint: string
  historyOfPresentIllness: string
  reviewOfSystems: ReviewOfSystems
  physicalExam: PhysicalExam
  vitalSigns: VitalSigns
}

export interface ReviewOfSystems {
  constitutional: SystemReview
  heent: SystemReview
  cardiovascular: SystemReview
  respiratory: SystemReview
  gastrointestinal: SystemReview
  genitourinary: SystemReview
  musculoskeletal: SystemReview
  neurological: SystemReview
  psychiatric: SystemReview
  skin: SystemReview
}

export interface SystemReview {
  status: 'positive' | 'negative' | 'not-assessed'
  findings?: string[]
  notes?: string
}

export interface PhysicalExam {
  general: ExamSection
  vitalSigns: ExamSection
  heent: ExamSection
  cardiovascular: ExamSection
  respiratory: ExamSection
  abdomen: ExamSection
  extremities: ExamSection
  neurological: ExamSection
  skin: ExamSection
}

export interface ExamSection {
  normal: boolean
  findings?: string
  notes?: string
}

export interface VitalSigns {
  bloodPressure: {
    systolic: number
    diastolic: number
    map?: number
  }
  heartRate: number
  respiratoryRate: number
  temperature: number
  oxygenSaturation?: number
  glucose?: number
  weight?: number
  height?: number
  bmi?: number
}

// ============================================================================
// Diagnosis Models
// ============================================================================

export interface Diagnosis {
  id: string
  icd10Code: string
  description: string
  confidence: number // 0-1
  differential: boolean
  reasoning: string
  supportingEvidence: string[]
  createdAt: Date
  updatedAt?: Date
}

export interface DiagnosisSuggestion extends Diagnosis {
  source: 'cdss' | 'manual' | 'api'
  probability: number
  riskFactors?: string[]
  redFlags?: string[]
}

// ============================================================================
// Therapy Models
// ============================================================================

export interface Therapy {
  id: string
  type: 'medication' | 'procedure' | 'counseling' | 'referral'
  name: string
  instructions: string
  contraindications: string[]
  createdAt: Date
}

export interface Medication extends Therapy {
  type: 'medication'
  drugName: string
  genericName?: string
  dosage: string
  frequency: Frequency
  route: Route
  duration: Duration
  quantity: number
  refills?: number
  prn?: boolean
  prnInstructions?: string
  interactions?: DrugInteraction[]
}

export type Frequency = 'QD' | 'BID' | 'TID' | 'QID' | 'Q4H' | 'Q6H' | 'Q8H' | 'PRN' | 'CUSTOM'

export type Route = 'PO' | 'IV' | 'IM' | 'SC' | 'TOP' | 'INH' | 'PR' | 'SL' | 'OTHER'

export interface Duration {
  value: number
  unit: 'days' | 'weeks' | 'months' | 'ongoing'
}

export interface DrugInteraction {
  severity: 'critical' | 'high' | 'moderate' | 'low'
  interactingDrug: string
  effect: string
  recommendation: string
}

// ============================================================================
// Widget Component Props
// ============================================================================

export interface WidgetBaseProps {
  mode: 'widget' | 'fullpage'
  onClick?: () => void
  className?: string
}

export interface AssessmentWidgetData {
  chiefComplaint?: string
  symptoms?: string[]
  vitalSigns?: VitalSigns
  emergencyFlags?: number
}

export interface DiagnosisWidgetData {
  suggestions: DiagnosisSuggestion[]
  confirmed?: Diagnosis[]
}

export interface TherapyWidgetData {
  medications: Medication[]
  procedures?: Therapy[]
  counseling?: string[]
}

// ============================================================================
// API Client Types
// ============================================================================

export type AdapterType = 'mock' | 'fhir' | 'hl7' | 'custom'

export interface MedlinkConfig {
  adapterType: AdapterType
  apiEndpoint?: string
  apiKey?: string
  authToken?: string
  timeout?: number
  retryAttempts?: number
}

export interface APICapabilities {
  canFetchAssessment: boolean
  canFetchDiagnosis: boolean
  canFetchTherapy: boolean
  canSaveAssessment: boolean
  canSaveDiagnosis: boolean
  canSaveTherapy: boolean
  supportsRealtime: boolean
  rateLimit?: {
    requests: number
    perSeconds: number
  }
}

export interface AuthToken {
  accessToken: string
  refreshToken?: string
  expiresAt: Date
  tokenType: 'Bearer' | 'ApiKey'
}

export interface APIResponse<T> {
  success: boolean
  data?: T
  error?: APIError
  metadata?: ResponseMetadata
}

export interface APIError {
  code: string
  message: string
  details?: unknown
  retryable: boolean
}

export interface ResponseMetadata {
  requestId: string
  timestamp: Date
  source: 'api' | 'cache' | 'mock'
  latency?: number
}

// ============================================================================
// Medlink Store State
// ============================================================================

export interface MedlinkState {
  // Configuration
  config: MedlinkConfig
  capabilities: APICapabilities | null
  connected: boolean

  // Current encounter data
  currentAssessment: Assessment | null
  currentDiagnoses: Diagnosis[]
  currentTherapies: Therapy[]

  // UI state
  activeView: 'dashboard' | 'assessment' | 'diagnosis' | 'therapy'
  widgetLayout: WidgetLayout

  // Sync state
  lastSyncAt: Date | null
  syncInProgress: boolean
  syncErrors: string[]
}

export interface WidgetLayout {
  columns: 1 | 2 | 3
  widgetOrder: WidgetType[]
  collapsed: WidgetType[]
}

export type WidgetType = 'assessment' | 'diagnosis' | 'therapy' | 'vitals'

// ============================================================================
// Integration with TTV System
// ============================================================================

export interface TTVMedlinkBridge {
  // Convert TTV data to Medlink assessment
  ttvToVitalSigns(ttvData: unknown): VitalSigns

  // Extract symptoms from TTV inference
  extractSymptoms(symptomText: string): string[]

  // Map emergency alerts to assessment flags
  mapEmergencyAlerts(alerts: unknown[]): string[]
}
