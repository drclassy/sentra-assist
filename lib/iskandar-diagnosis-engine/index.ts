// Designed and constructed by Claudesy.
/**
 * Precision-Architected. Future-Built by Docsyanpse
 * Sentra Healthcare Artificial Intelligence
 */

/**
 * CDSS Module Public API
 * Clinical Decision Support System for Sentra Assist
 *
 * @module lib/iskandar-diagnosis-engine
 * @version 1.0.0
 *
 * CORE EXPORTS:
 * - Engine: runDiagnosisEngine, initCDSSEngine, getCDSSEngineStatus
 * - Anonymizer: anonymize, validateAnonymization
 * - Red Flags: runRedFlagChecks, runRedFlagChecksFromContext
 * - Validation: runValidationPipeline
 * - Audit: auditLogger, log* functions
 */

// =============================================================================
// ENGINE EXPORTS (Main Entry Point)
// =============================================================================

export type { CDSSAlert, CDSSEngineConfig, CDSSEngineResult, CDSSEngineStatus } from './engine';
export {
  DEFAULT_ENGINE_CONFIG,
  getCDSSEngineStatus,
  initCDSSEngine,
  runDiagnosisEngine,
} from './engine';

// =============================================================================
// Iskandar Diagnosis Engine V1 MODULE EXPORTS
// =============================================================================

export type { EpiWeightResult } from './epidemiology-weights';
export {
  applyEpidemiologyWeights,
  getEpidemiologyMeta,
  getEpidemiologyWeight,
  getLocalEpidemiologyContext,
} from './epidemiology-weights';
export type { ReasonerInput, ReasonerOutput } from './llm-reasoner';
export { runLLMReasoning } from './llm-reasoner';
export type { MatchedCandidate, MatcherInput } from './symptom-matcher';
export { clearMatcherCache, getKBDiseaseCount, matchSymptoms } from './symptom-matcher';
export type { TrafficLightInput, TrafficLightLevel, TrafficLightOutput } from './traffic-light';
export { classifyTrafficLight } from './traffic-light';

// =============================================================================
// ANONYMIZER EXPORTS
// =============================================================================

export { anonymize, containsPII, redactPII, validateAnonymization } from './anonymizer';

// =============================================================================
// RED FLAG EXPORTS
// =============================================================================

export type { RedFlag, RedFlagContext } from './red-flags';
export {
  checkACS,
  checkAnaphylaxis,
  checkHypoglycemia,
  checkPreeclampsia,
  checkSepsis,
  checkStroke,
  runRedFlagChecks,
  runRedFlagChecksFromContext,
} from './red-flags';

// =============================================================================
// VALIDATION EXPORTS
// =============================================================================

export { runValidationPipeline } from './validation';

export type {
  ValidatedSuggestion,
  ValidationContext,
  ValidationFlag,
  ValidationResult,
} from './validation/types';

// =============================================================================
// AUDIT EXPORTS
// =============================================================================

export type { AuditAction, AuditEntry } from './audit-logger';
export {
  auditLogger,
  logDiagnosisRequest,
  logEngineError,
  logFallbackUsed,
  logRedFlagShown,
  logSuggestionDisplayed,
  logSuggestionSelected,
} from './audit-logger';

// =============================================================================
// CHRONIC DISEASE CLASSIFIER EXPORTS
// =============================================================================

export type {
  BadgeConfig,
  ChronicDiseaseClassification,
  ChronicDiseaseSeverity,
} from './chronic-disease-classifier';
export {
  ChronicDiseaseType,
  classifyChronicDisease,
  getBadgeConfig,
  getBadgeConfigForDisease,
  getDiseaseFullName,
  getSupportedDiseaseTypes,
  isChronicDisease,
} from './chronic-disease-classifier';

// =============================================================================
// DDI (DRUG-DRUG INTERACTION) CHECKER EXPORTS
// =============================================================================

export {
  checkDrugInteractions,
  getDDIStatus,
  getSeverityColor,
  getSeverityLabel,
  hasBlockingInteractions,
  loadDDIDatabase,
} from './ddi-checker';
