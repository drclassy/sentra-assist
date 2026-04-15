// Designed and constructed by Claudesy.
/**
 * Precision-Architected. Future-Built by Docsyanpse
 * Sentra Healthcare Artificial Intelligence
 */

/**
 * DeepSeek API Type Definitions
 * SiliconFlow Integration for CDSS Diagnosis Engine
 *
 * @module lib/api/deepseek-types
 * @version 1.0.0
 */

import type { VitalSigns } from '@/types/api';

// =============================================================================
// API CONFIGURATION
// =============================================================================

/**
 * DeepSeek API configuration
 */
export interface DeepSeekConfig {
  /** SiliconFlow API key */
  apiKey: string;

  /** API base URL */
  baseUrl: string;

  /** Model identifier */
  model: string;

  /** Maximum tokens for response */
  maxTokens: number;

  /** Temperature (0.0-1.0) - lower = more deterministic */
  temperature: number;

  /** Request timeout in milliseconds */
  timeout: number;

  /** Number of retry attempts */
  retryAttempts: number;

  /** Delay between retries in milliseconds */
  retryDelay: number;
}

/**
 * Default configuration values
 */
export const DEFAULT_DEEPSEEK_CONFIG: DeepSeekConfig = {
  apiKey: '',
  baseUrl: 'https://api.siliconflow.cn/v1',
  model: 'deepseek-ai/DeepSeek-R1-0528',
  maxTokens: 4096,
  temperature: 0.1, // Low temperature for clinical consistency
  timeout: 60000, // 60 seconds - reasoning models are slow
  retryAttempts: 2,
  retryDelay: 2000,
};

// =============================================================================
// REQUEST TYPES
// =============================================================================

/**
 * Chat message format for DeepSeek API
 */
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/**
 * DeepSeek API request body
 */
export interface DeepSeekRequest {
  model: string;
  messages: ChatMessage[];
  max_tokens?: number;
  temperature?: number;
  top_p?: number;
  stream?: boolean;
  response_format?: {
    type: 'text' | 'json_object';
  };
}

/**
 * Anonymized clinical context for diagnosis request
 */
export interface AnonymizedClinicalContext {
  /** Chief complaint (keluhan utama) */
  keluhan_utama: string;

  /** Additional complaints (keluhan tambahan) */
  keluhan_tambahan?: string;

  /** Patient age in years */
  usia_tahun: number;

  /** Patient gender */
  jenis_kelamin: 'L' | 'P';

  /** Vital signs if available */
  vital_signs?: VitalSigns;

  /** Duration of illness */
  lama_sakit?: {
    hari: number;
    bulan: number;
    tahun: number;
  };

  /** Known chronic diseases */
  chronic_diseases?: string[];

  /** Known allergies */
  allergies?: string[];

  /** Pregnancy status (for female patients) */
  is_pregnant?: boolean;

  /** Physical examination findings */
  pemeriksaan_fisik?: string;

  /** Laboratory results if any */
  lab_results?: string;
}

// =============================================================================
// RESPONSE TYPES
// =============================================================================

/**
 * DeepSeek API response
 */
export interface DeepSeekResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: DeepSeekChoice[];
  usage: DeepSeekUsage;
}

/**
 * DeepSeekChoice interface
 *
 * @remarks
 * TODO: Add type description and property documentation
 * Auto-generated on 2026-02-04
 */

export interface DeepSeekChoice {
  index: number;
  message: ChatMessage;
  finish_reason: 'stop' | 'length' | 'content_filter' | null;
}

/**
 * DeepSeekUsage interface
 *
 * @remarks
 * TODO: Add type description and property documentation
 * Auto-generated on 2026-02-04
 */

export interface DeepSeekUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

/**
 * Parsed diagnosis suggestion from AI response
 */
export interface AIDiagnosisSuggestion {
  /** Rank (1-5) */
  rank: number;

  /** Diagnosis name in Indonesian */
  diagnosis_name: string;

  /** ICD-10 code */
  icd10_code: string;

  /** Confidence score (0.0-1.0) */
  confidence: number;

  /** Clinical reasoning */
  reasoning: string;

  /** Red flags identified */
  red_flags: string[];

  /** Recommended actions */
  recommended_actions: string[];
}

/**
 * Structured AI response format
 */
export interface AIResponseFormat {
  /** Diagnosis suggestions */
  suggestions: AIDiagnosisSuggestion[];

  /** Data quality note if input incomplete */
  data_quality_note?: string;

  /** Reasoning chain (chain-of-thought) */
  reasoning_chain?: string;
}

/**
 * Inference result from DeepSeek
 */
export interface DeepSeekInferenceResult {
  /** Parsed suggestions */
  suggestions: AIDiagnosisSuggestion[];

  /** Raw response text */
  raw_response: string;

  /** Token usage */
  token_usage: {
    input: number;
    output: number;
    total: number;
  };

  /** Processing time in milliseconds */
  latency_ms: number;

  /** Model version used */
  model_version: string;

  /** Whether fallback was used */
  used_fallback: boolean;

  /** Data quality notes */
  data_quality_note?: string;
}

// =============================================================================
// ERROR TYPES
// =============================================================================

/**
 * DeepSeek API error response
 */
export interface DeepSeekAPIError {
  error: {
    message: string;
    type: string;
    code: string;
    param?: string;
  };
}

/**
 * Custom error class for DeepSeek API errors
 */
export class DeepSeekError extends Error {
  public readonly code: string;
  public readonly type: string;
  public readonly statusCode?: number;
  public readonly retryable: boolean;

  constructor(message: string, code: string, type: string, statusCode?: number) {
    super(message);
    this.name = 'DeepSeekError';
    this.code = code;
    this.type = type;
    this.statusCode = statusCode;

    // Determine if error is retryable
    this.retryable = this.isRetryable();
  }

  private isRetryable(): boolean {
    // Retry on server errors and rate limits
    if (this.statusCode && this.statusCode >= 500) return true;
    if (this.statusCode === 429) return true; // Rate limit
    if (this.code === 'timeout') return true;
    if (this.code === 'network_error') return true;
    return false;
  }
}

// =============================================================================
// TYPE GUARDS
// =============================================================================

/**
 * Type guard for DeepSeek response
 */
export function isDeepSeekResponse(obj: unknown): obj is DeepSeekResponse {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'id' in obj &&
    'choices' in obj &&
    Array.isArray((obj as DeepSeekResponse).choices)
  );
}

/**
 * Type guard for DeepSeek error
 */
export function isDeepSeekAPIError(obj: unknown): obj is DeepSeekAPIError {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'error' in obj &&
    typeof (obj as DeepSeekAPIError).error === 'object'
  );
}

/**
 * Type guard for AI response format
 */
export function isAIResponseFormat(obj: unknown): obj is AIResponseFormat {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'suggestions' in obj &&
    Array.isArray((obj as AIResponseFormat).suggestions)
  );
}

/**
 * Validate AI diagnosis suggestion structure
 */
export function isValidAISuggestion(obj: unknown): obj is AIDiagnosisSuggestion {
  if (typeof obj !== 'object' || obj === null) return false;

  const suggestion = obj as AIDiagnosisSuggestion;

  return (
    typeof suggestion.diagnosis_name === 'string' &&
    typeof suggestion.icd10_code === 'string' &&
    typeof suggestion.confidence === 'number' &&
    suggestion.confidence >= 0 &&
    suggestion.confidence <= 1
  );
}
