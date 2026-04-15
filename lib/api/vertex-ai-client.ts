// Designed and constructed by Claudesy.
/**
 * Precision-Architected. Future-Built by Docsyanpse
 * Sentra Healthcare Artificial Intelligence
 */

/// <reference types="chrome" />

import type { RAGSearchResult } from '../rag/types';
import type { AIDiagnosisSuggestion, AnonymizedClinicalContext } from './deepseek-types';
import { buildMessages, parseAIResponse } from './prompt-templates';
import {
  DEFAULT_VERTEX_AI_CONFIG,
  type VertexAIConfig,
  type VertexAIInferenceResult,
} from './vertex-ai-types';

// =============================================================================
// CONFIGURATION MANAGEMENT
// =============================================================================

const CONFIG_STORAGE_KEY = 'sentra:vertex:config';

async function getStoredConfig(): Promise<Partial<VertexAIConfig>> {
  try {
    const result = await browser.storage.sync.get(CONFIG_STORAGE_KEY);
    return result[CONFIG_STORAGE_KEY] || {};
  } catch {
    return {};
  }
}

async function getConfig(): Promise<VertexAIConfig> {
  const stored = await getStoredConfig();
  return {
    ...DEFAULT_VERTEX_AI_CONFIG,
    ...stored,
  };
}

// =============================================================================
// AUTHENTICATION
// =============================================================================

/**
 * Get OAuth2 token via chrome.identity
 */
async function getAuthToken(): Promise<string> {
  return new Promise((resolve, reject) => {
    chrome.identity.getAuthToken({ interactive: true }, (result) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      const token = typeof result === 'object' ? result.token : result;
      if (!token) {
        reject(new Error('Failed to retrieve OAuth token'));
        return;
      }
      resolve(token);
    });
  });
}

// =============================================================================
// MAIN INFERENCE FUNCTION
// =============================================================================

/**
 * Run diagnosis inference with Vertex AI (Gemini) via REST API
 */
export async function inferDiagnosis(
  context: AnonymizedClinicalContext,
  ragResults: RAGSearchResult[]
): Promise<VertexAIInferenceResult> {
  const startTime = Date.now();
  const config = await getConfig();

  try {
    // 1. Get Auth Token
    const token = await getAuthToken();

    // 2. Prepare Request
    const messages = buildMessages(context, ragResults);
    const systemPrompt = messages.find((m) => m.role === 'system')?.content || '';
    const userPrompt = messages.find((m) => m.role === 'user')?.content || '';

    // Vertex AI Generative AI REST API endpoint
    // Format: https://{location}-aiplatform.googleapis.com/v1/projects/{project}/locations/{location}/publishers/google/models/{model}:generateContent
    const url = `https://${config.location}-aiplatform.googleapis.com/v1/projects/${config.projectId}/locations/${config.location}/publishers/google/models/${config.model}:generateContent`;

    const requestBody = {
      systemInstruction: {
        parts: [{ text: systemPrompt }],
      },
      contents: [
        {
          role: 'user',
          parts: [{ text: userPrompt }],
        },
      ],
      generationConfig: {
        maxOutputTokens: config.maxTokens,
        temperature: config.temperature,
        responseMimeType: 'application/json',
      },
      tools: config.enableSearchGrounding ? [{ googleSearchRetrieval: {} }] : [],
    };

    // 3. Execute Request
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'x-goog-user-project': config.projectId, // Essential for billing
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Vertex AI API error (${response.status}): ${errorText}`);
    }

    const data = await response.json();

    // 4. Parse Response (Gemini REST format)
    const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const parsed = parseAIResponse(responseText);

    if (!parsed.success || !parsed.data) {
      return {
        suggestions: [],
        raw_response: responseText,
        token_usage: {
          input: data.usageMetadata?.promptTokenCount || 0,
          output: data.usageMetadata?.candidatesTokenCount || 0,
          total: data.usageMetadata?.totalTokenCount || 0,
        },
        latency_ms: Date.now() - startTime,
        model_version: config.model,
        used_fallback: false,
        data_quality_note: `Parse error: ${parsed.error}`,
      };
    }

    return {
      suggestions: parsed.data.suggestions as AIDiagnosisSuggestion[],
      raw_response: responseText,
      grounding_metadata: data.candidates?.[0]?.groundingMetadata,
      token_usage: {
        input: data.usageMetadata?.promptTokenCount || 0,
        output: data.usageMetadata?.candidatesTokenCount || 0,
        total: data.usageMetadata?.totalTokenCount || 0,
      },
      latency_ms: Date.now() - startTime,
      model_version: config.model,
      used_fallback: false,
      data_quality_note: parsed.data.data_quality_note,
    };
  } catch (error) {
    console.error('[VertexAI] Inference error:', error);
    throw error;
  }
}

export { localFallbackInference } from './deepseek-client';
