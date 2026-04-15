// Designed and constructed by Claudesy.
/**
 * Precision-Architected. Future-Built by Docsyanpse
 * Sentra Healthcare Artificial Intelligence
 */

/**
 * Vertex AI Type Definitions
 * Google Cloud Integration for CDSS Diagnosis Engine
 *
 * @module lib/api/vertex-ai-types
 * @version 1.0.0
 */

import type { AIDiagnosisSuggestion, AnonymizedClinicalContext } from './deepseek-types';

// =============================================================================
// API CONFIGURATION
// =============================================================================

/**
 * Vertex AI configuration
 */
export interface VertexAIConfig {
  /** Google Cloud Project ID */
  projectId: string;

  /** Region for Vertex AI (e.g., 'us-central1') */
  location: string;

  /** API Key (optional fallback) */
  apiKey?: string;

  /** Base URL for REST API */
  baseUrl?: string;

  /** Model identifier (e.g., 'gemini-1.5-flash') */
  model: string;

  /** Maximum tokens for response */
  maxTokens: number;

  /** Temperature (0.0-1.0) - lower = more deterministic */
  temperature: number;

  /** Enable Google Search Grounding */
  enableSearchGrounding: boolean;

  /** Request timeout in milliseconds */
  timeout: number;

  /** Number of retry attempts */
  retryAttempts: number;

  /** Delay between retries in milliseconds */
  retryDelay: number;
}

/**
 * Default configuration values for Vertex AI
 */
export const DEFAULT_VERTEX_AI_CONFIG: VertexAIConfig = {
  projectId: 'sentra-healthcare-solution',
  location: 'us-central1',
  model: 'gemini-1.5-flash-002', // Using Flash for speed and cost-efficiency
  maxTokens: 4096,
  temperature: 0.1, // Low temperature for clinical consistency
  enableSearchGrounding: true, // Default to true for better clinical context
  timeout: 60000,
  retryAttempts: 2,
  retryDelay: 2000,
};

// =============================================================================
// INFERENCE TYPES
// =============================================================================

/**
 * Inference result from Vertex AI
 */
export interface VertexAIInferenceResult {
  /** Parsed suggestions */
  suggestions: AIDiagnosisSuggestion[];

  /** Raw response text */
  raw_response: string;

  /** Grounding metadata (if any) */
  grounding_metadata?: {
    searchEntryPoint?: {
      htmlContent?: string;
    };
    groundingChunks?: Array<{
      web?: {
        uri?: string;
        title?: string;
      };
    }>;
    groundingSupports?: Array<{
      segment?: {
        startIndex?: number;
        endIndex?: number;
        text?: string;
      };
      groundingChunkIndices?: number[];
      confidenceScores?: number[];
    }>;
    webSearchQueries?: string[];
  };

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

// Re-export shared clinical types
export type { AIDiagnosisSuggestion, AnonymizedClinicalContext };
