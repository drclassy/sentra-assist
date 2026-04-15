// Designed and constructed by Claudesy.
/**
 * Precision-Architected. Future-Built by Docsyanpse
 * Sentra Healthcare Artificial Intelligence
 */

/**
 * DeepSeek API Client
 * SiliconFlow Integration for CDSS Diagnosis Engine
 *
 * @module lib/api/deepseek-client
 * @version 1.0.0
 */

import type { RAGSearchResult } from '../rag/types';
import type {
  AIDiagnosisSuggestion,
  AnonymizedClinicalContext,
  DeepSeekConfig,
  DeepSeekInferenceResult,
  DeepSeekRequest,
  DeepSeekResponse,
} from './deepseek-types';
import {
  DEFAULT_DEEPSEEK_CONFIG,
  DeepSeekError,
  isDeepSeekAPIError,
  isDeepSeekResponse,
} from './deepseek-types';
import { buildMessages, parseAIResponse } from './prompt-templates';

// =============================================================================
// CONFIGURATION MANAGEMENT
// =============================================================================

/**
 * Storage key for API configuration
 */
const CONFIG_STORAGE_KEY = 'sentra:deepseek:config';

/**
 * Get API configuration from storage
 */
async function getStoredConfig(): Promise<Partial<DeepSeekConfig>> {
  try {
    const result = await browser.storage.sync.get(CONFIG_STORAGE_KEY);
    return result[CONFIG_STORAGE_KEY] || {};
  } catch {
    return {};
  }
}

/**
 * Save API configuration to storage
 */
export async function saveConfig(config: Partial<DeepSeekConfig>): Promise<void> {
  await browser.storage.sync.set({
    [CONFIG_STORAGE_KEY]: config,
  });
}

/**
 * Get merged configuration (defaults + stored)
 */
async function getConfig(): Promise<DeepSeekConfig> {
  const stored = await getStoredConfig();
  return {
    ...DEFAULT_DEEPSEEK_CONFIG,
    ...stored,
  };
}

/**
 * Check if API is configured (has API key)
 */
export async function isAPIConfigured(): Promise<boolean> {
  const config = await getConfig();
  return !!config.apiKey && config.apiKey.length > 0;
}

// =============================================================================
// API CLIENT
// =============================================================================

/**
 * Make HTTP request with timeout
 */
async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeout: number
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Make request with retry logic
 */
async function fetchWithRetry(
  url: string,
  options: RequestInit,
  config: DeepSeekConfig
): Promise<Response> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= config.retryAttempts; attempt++) {
    try {
      const response = await fetchWithTimeout(url, options, config.timeout);

      // Don't retry on client errors (4xx) except rate limit
      if (response.status >= 400 && response.status < 500 && response.status !== 429) {
        return response;
      }

      // Retry on server errors and rate limits
      if (response.status >= 500 || response.status === 429) {
        if (attempt < config.retryAttempts) {
          const delay = config.retryDelay * 2 ** attempt; // Exponential backoff
          console.warn(
            `[DeepSeek] Request failed with ${response.status}, retrying in ${delay}ms...`
          );
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }
      }

      return response;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Check if it's a timeout or network error (retryable)
      if (error instanceof Error && error.name === 'AbortError') {
        lastError = new DeepSeekError('Request timeout', 'timeout', 'network_error');
      }

      if (attempt < config.retryAttempts) {
        const delay = config.retryDelay * 2 ** attempt;
        console.warn(`[DeepSeek] Request error: ${lastError.message}, retrying in ${delay}ms...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError || new Error('Request failed after retries');
}

/**
 * Call DeepSeek API
 */
async function callAPI(
  messages: Array<{ role: string; content: string }>,
  config: DeepSeekConfig
): Promise<DeepSeekResponse> {
  const url = `${config.baseUrl}/chat/completions`;

  const requestBody: DeepSeekRequest = {
    model: config.model,
    messages: messages as DeepSeekRequest['messages'],
    max_tokens: config.maxTokens,
    temperature: config.temperature,
    response_format: { type: 'json_object' },
  };

  const response = await fetchWithRetry(
    url,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify(requestBody),
    },
    config
  );

  const data = await response.json();

  if (!response.ok) {
    if (isDeepSeekAPIError(data)) {
      throw new DeepSeekError(
        data.error.message,
        data.error.code,
        data.error.type,
        response.status
      );
    }
    throw new DeepSeekError(
      `API request failed: ${response.status}`,
      'api_error',
      'http_error',
      response.status
    );
  }

  if (!isDeepSeekResponse(data)) {
    throw new DeepSeekError('Invalid API response format', 'invalid_response', 'parse_error');
  }

  return data;
}

// =============================================================================
// MAIN INFERENCE FUNCTION
// =============================================================================

/**
 * Run diagnosis inference with DeepSeek
 */
export async function inferDiagnosis(
  context: AnonymizedClinicalContext,
  ragResults: RAGSearchResult[]
): Promise<DeepSeekInferenceResult> {
  const startTime = Date.now();
  const config = await getConfig();

  // Check if API is configured
  if (!config.apiKey) {
    throw new DeepSeekError('API key not configured', 'not_configured', 'config_error');
  }

  // Build messages
  const messages = buildMessages(context, ragResults);

  try {
    // Call API
    const response = await callAPI(messages, config);

    // Extract response text
    const responseText = response.choices[0]?.message?.content || '';

    // Parse response
    const parsed = parseAIResponse(responseText);

    if (!parsed.success || !parsed.data) {
      console.error('[DeepSeek] Failed to parse response:', parsed.error);
      return {
        suggestions: [],
        raw_response: responseText,
        token_usage: {
          input: response.usage.prompt_tokens,
          output: response.usage.completion_tokens,
          total: response.usage.total_tokens,
        },
        latency_ms: Date.now() - startTime,
        model_version: config.model,
        used_fallback: false,
        data_quality_note: `Parse error: ${parsed.error}`,
      };
    }

    // Map to AIDiagnosisSuggestion format
    const suggestions: AIDiagnosisSuggestion[] = parsed.data.suggestions.map((s) => ({
      rank: s.rank,
      diagnosis_name: s.diagnosis_name,
      icd10_code: s.icd10_code,
      confidence: s.confidence,
      reasoning: s.reasoning,
      red_flags: s.red_flags,
      recommended_actions: s.recommended_actions,
    }));

    return {
      suggestions,
      raw_response: responseText,
      token_usage: {
        input: response.usage.prompt_tokens,
        output: response.usage.completion_tokens,
        total: response.usage.total_tokens,
      },
      latency_ms: Date.now() - startTime,
      model_version: config.model,
      used_fallback: false,
      data_quality_note: parsed.data.data_quality_note,
    };
  } catch (error) {
    console.error('[DeepSeek] Inference error:', error);

    // Rethrow to let caller handle fallback
    throw error;
  }
}

// =============================================================================
// LOCAL FALLBACK
// =============================================================================

/**
 * Local fallback when API is unavailable
 * Uses RAG results to suggest diagnoses without AI
 */
export function localFallbackInference(
  _context: AnonymizedClinicalContext,
  ragResults: RAGSearchResult[]
): DeepSeekInferenceResult {
  const startTime = Date.now();

  // Convert RAG results to suggestions
  const suggestions: AIDiagnosisSuggestion[] = ragResults.slice(0, 5).map((result, index) => ({
    rank: index + 1,
    diagnosis_name: result.entry.name_id,
    icd10_code: result.entry.code,
    confidence: result.relevance_score * 0.7, // Reduce confidence for local fallback
    reasoning: `Berdasarkan keyword matching: ${result.matched_keywords?.join(', ') || 'similarity'}`,
    red_flags: [],
    recommended_actions: ['Verifikasi diagnosis dengan pemeriksaan klinis'],
  }));

  return {
    suggestions,
    raw_response: JSON.stringify({ fallback: true, suggestions }),
    token_usage: {
      input: 0,
      output: 0,
      total: 0,
    },
    latency_ms: Date.now() - startTime,
    model_version: 'local-fallback',
    used_fallback: true,
    data_quality_note: 'Menggunakan fallback lokal karena API tidak tersedia',
  };
}

// =============================================================================
// HEALTH CHECK
// =============================================================================

/**
 * Check if DeepSeek API is reachable
 */
export async function checkAPIHealth(): Promise<{
  healthy: boolean;
  latency_ms?: number;
  error?: string;
}> {
  const startTime = Date.now();

  try {
    const config = await getConfig();

    if (!config.apiKey) {
      return {
        healthy: false,
        error: 'API key not configured',
      };
    }

    // Simple health check with minimal request
    const response = await fetchWithTimeout(
      `${config.baseUrl}/models`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
        },
      },
      5000 // 5 second timeout for health check
    );

    return {
      healthy: response.ok,
      latency_ms: Date.now() - startTime,
      error: response.ok ? undefined : `HTTP ${response.status}`,
    };
  } catch (error) {
    return {
      healthy: false,
      latency_ms: Date.now() - startTime,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// =============================================================================
// EXPORTS
// =============================================================================

export type {
  AIDiagnosisSuggestion,
  AnonymizedClinicalContext,
  DeepSeekConfig,
  DeepSeekInferenceResult,
} from './deepseek-types';
export { DeepSeekError } from './deepseek-types';
