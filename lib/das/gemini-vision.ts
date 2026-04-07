// Designed and constructed by Claudesy.
/**
 * Precision-Architected. Future-Built by Docsyanpse
 * Sentra Healthcare Artificial Intelligence
 */

/**
 * DAS Phase 2: Gemini Vision Semantic Mapper
 *
 * Uses Vertex AI Gemini for intelligent form field mapping.
 * Understands clinical context and Indonesian medical terminology.
 *
 * @module lib/das/gemini-vision
 */

import type {
  FieldMapping,
  FieldSignature,
  MappingAction,
  MappingContext,
  MappingResult,
} from './types'

// ============================================================================
// CONFIGURATION
// ============================================================================

/**
 * Gemini configuration type
 */
interface GeminiConfig {
  projectId: string
  location: string
  model: string
  maxTokens: number
  temperature: number
  timeout: number
}

/**
 * Default Gemini configuration (can be overridden via storage)
 */
const DEFAULT_GEMINI_CONFIG: GeminiConfig = {
  projectId: '', // Must be set via storage or env
  location: 'us-central1',
  model: 'gemini-2.0-flash-001',
  maxTokens: 4096,
  temperature: 0.1,
  timeout: 30000,
}

/**
 * Get Gemini config from storage or environment
 */
async function getGeminiConfig(): Promise<GeminiConfig> {
  try {
    // Try chrome.storage first
    const result = await browser.storage.local.get('das:gemini:config')
    const stored = result['das:gemini:config'] as Partial<GeminiConfig> | undefined

    if (stored?.projectId) {
      return { ...DEFAULT_GEMINI_CONFIG, ...stored }
    }

    // Fallback to existing vertex-ai config
    const vertexResult = await browser.storage.sync.get('sentra:vertex:config')
    const vertexConfig = vertexResult['sentra:vertex:config'] as
      | { projectId?: string; location?: string }
      | undefined

    if (vertexConfig?.projectId) {
      return {
        ...DEFAULT_GEMINI_CONFIG,
        projectId: vertexConfig.projectId,
        location: vertexConfig.location || DEFAULT_GEMINI_CONFIG.location,
      }
    }

    // Final fallback - use default project (should be configured)
    console.warn('[DAS:Gemini] No config found, using fallback')
    return {
      ...DEFAULT_GEMINI_CONFIG,
      projectId: 'sentra-healthcare-solution', // Fallback only
    }
  } catch (error) {
    console.error('[DAS:Gemini] Config error:', error)
    return {
      ...DEFAULT_GEMINI_CONFIG,
      projectId: 'sentra-healthcare-solution',
    }
  }
}

// ============================================================================
// PROMPT INJECTION PROTECTION
// ============================================================================

/**
 * Sanitize string for safe AI prompt injection
 * Removes newlines, control characters, and limits length
 */
function sanitizeForPrompt(input: string | null | undefined, maxLength = 100): string {
  if (!input) return ''

  return (
    input
      // Remove newlines and carriage returns (prevent instruction injection)
      .replace(/[\n\r]/g, ' ')
      // Remove control characters
      .replace(/[\p{Cc}\p{Cf}]/gu, '')
      // Remove potential prompt delimiters
      .replace(/```/g, '')
      .replace(/---/g, '')
      // Collapse multiple spaces
      .replace(/\s+/g, ' ')
      // Trim and limit length
      .trim()
      .substring(0, maxLength)
  )
}

/**
 * Sanitize payload for AI prompt
 */
function sanitizePayload(payload: Record<string, unknown>): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(payload)) {
    const sanitizedKey = sanitizeForPrompt(key, 50)

    if (typeof value === 'string') {
      sanitized[sanitizedKey] = sanitizeForPrompt(value, 200)
    } else if (typeof value === 'number' || typeof value === 'boolean') {
      sanitized[sanitizedKey] = value
    } else if (value === null || value === undefined) {
      sanitized[sanitizedKey] = null
    } else {
      // For complex objects, stringify and sanitize
      sanitized[sanitizedKey] = sanitizeForPrompt(JSON.stringify(value), 200)
    }
  }

  return sanitized
}

/**
 * Sanitize field signature for AI prompt
 */
function sanitizeFieldForPrompt(field: FieldSignature): Record<string, unknown> {
  return {
    id: sanitizeForPrompt(field.id, 50),
    selector: sanitizeForPrompt(field.selector, 150),
    type: field.fieldType, // Enum, safe
    name: sanitizeForPrompt(field.attributes.name, 50),
    placeholder: sanitizeForPrompt(field.attributes.placeholder, 100),
    label: sanitizeForPrompt(field.label, 100),
    ariaLabel: sanitizeForPrompt(field.attributes.ariaLabel, 100),
  }
}

// ============================================================================
// AUTHENTICATION (reuse from vertex-ai-client pattern)
// ============================================================================

/**
 * Get OAuth2 token via chrome.identity (relay through background)
 * Content scripts can't access chrome.identity directly - must relay via background
 */
async function getAuthToken(): Promise<string> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ type: 'GET_AUTH_TOKEN' }, response => {
      if (response?.error) {
        reject(new Error(response.error))
      } else if (response?.token) {
        resolve(response.token)
      } else {
        reject(new Error('No token received from background'))
      }
    })
  })
}

// ============================================================================
// PROMPT ENGINEERING
// ============================================================================

/**
 * Build the mapping prompt for Gemini
 * Uses sanitized data to prevent prompt injection
 */
function buildMappingPrompt(
  payload: Record<string, unknown>,
  fields: FieldSignature[],
  context: MappingContext
): string {
  // SECURITY: Sanitize all user-controlled data before injection
  const sanitizedPayload = sanitizePayload(payload)
  const sanitizedFields = fields.map(sanitizeFieldForPrompt)

  // Sanitize context values
  const sanitizedPageType = sanitizeForPrompt(context.pageType, 30)
  const sanitizedAge = context.patientAge ? String(context.patientAge) : 'tidak diketahui'
  const sanitizedMedicalContext =
    context.medicalContext?.map(c => sanitizeForPrompt(c, 50)).join(', ') || 'umum'

  return `Anda adalah AI semantic mapper untuk sistem rekam medis elektronik Indonesia (ePuskesmas).

TUGAS: Cocokkan data payload ke form field yang tepat.

KONTEKS KLINIS:
- Tipe halaman: ${sanitizedPageType}
- Usia pasien: ${sanitizedAge} tahun
- Konteks medis: ${sanitizedMedicalContext}

DATA PAYLOAD (yang akan diisi):
${JSON.stringify(sanitizedPayload, null, 2)}

FORM FIELDS YANG TERSEDIA:
${JSON.stringify(sanitizedFields, null, 2)}

TERMINOLOGI MEDIS INDONESIA:
- sistole/sistolik = tekanan darah sistolik
- diastole/diastolik = tekanan darah diastolik
- nadi = heart rate/pulse
- nafas/respirasi = respiratory rate
- suhu = temperature
- tinggi_badan/tb = height
- berat_badan/bb = weight
- keluhan_utama = chief complaint
- riwayat_penyakit = medical history
- alergi_obat = drug allergy

INSTRUKSI:
1. Untuk setiap key di payload, temukan field yang paling cocok
2. Pertimbangkan: name attribute, placeholder, label, konteks klinis
3. Berikan confidence score 0.0-1.0 berdasarkan kecocokan
4. Jika tidak ada field yang cocok, masukkan ke unmapped

CONFIDENCE GUIDELINES:
- 0.95-1.0: Exact match (name/id sama persis)
- 0.85-0.94: Strong match (label/placeholder cocok)
- 0.70-0.84: Moderate match (konteks cocok)
- <0.70: Weak match (perlu konfirmasi manual)

OUTPUT FORMAT (JSON only, no markdown):
{
  "mappings": [
    {
      "payloadKey": "string",
      "fieldId": "string",
      "confidence": number,
      "reasoning": "string"
    }
  ],
  "unmapped": ["string"],
  "warnings": ["string"]
}`
}

// ============================================================================
// RESPONSE PARSING
// ============================================================================

interface GeminiMappingResponse {
  mappings: Array<{
    payloadKey: string
    fieldId: string
    confidence: number
    reasoning: string
  }>
  unmapped: string[]
  warnings: string[]
}

/**
 * Parse Gemini response into FieldMapping array
 */
function parseGeminiResponse(responseText: string): GeminiMappingResponse {
  try {
    // Clean response (remove markdown code blocks if present)
    let cleaned = responseText.trim()
    if (cleaned.startsWith('```json')) {
      cleaned = cleaned.slice(7)
    }
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.slice(3)
    }
    if (cleaned.endsWith('```')) {
      cleaned = cleaned.slice(0, -3)
    }

    const parsed = JSON.parse(cleaned.trim())

    return {
      mappings: Array.isArray(parsed.mappings) ? parsed.mappings : [],
      unmapped: Array.isArray(parsed.unmapped) ? parsed.unmapped : [],
      warnings: Array.isArray(parsed.warnings) ? parsed.warnings : [],
    }
  } catch (error) {
    console.error('[DAS:GeminiVision] Parse error:', error)
    return {
      mappings: [],
      unmapped: [],
      warnings: [`Parse error: ${error instanceof Error ? error.message : 'Unknown'}`],
    }
  }
}

/**
 * Convert confidence to action
 */
function confidenceToAction(confidence: number): MappingAction {
  if (confidence >= 0.95) return 'AUTO_FILL'
  if (confidence >= 0.8) return 'CAUTIOUS_FILL'
  return 'HUMAN_REQUIRED'
}

// ============================================================================
// MAIN MAPPING FUNCTION
// ============================================================================

/**
 * Map payload to fields using Gemini Vision
 *
 * @param payload - Data to fill into form
 * @param fields - Detected form fields
 * @param context - Clinical context
 * @returns Mapping result with field matches
 */
export async function mapFieldsWithGemini(
  payload: Record<string, unknown>,
  fields: FieldSignature[],
  context: MappingContext
): Promise<MappingResult> {
  const startTime = Date.now()

  try {
    // 1. Get Config (from storage, not hardcoded)
    const config = await getGeminiConfig()

    // 2. Get Auth Token
    const token = await getAuthToken()

    // 3. Build Prompt
    const prompt = buildMappingPrompt(payload, fields, context)

    // 4. Prepare Request
    const url = `https://${config.location}-aiplatform.googleapis.com/v1/projects/${config.projectId}/locations/${config.location}/publishers/google/models/${config.model}:generateContent`

    const requestBody = {
      contents: [
        {
          role: 'user',
          parts: [{ text: prompt }],
        },
      ],
      generationConfig: {
        maxOutputTokens: config.maxTokens,
        temperature: config.temperature,
        responseMimeType: 'application/json',
      },
    }

    // 5. Execute Request
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'x-goog-user-project': config.projectId,
      },
      body: JSON.stringify(requestBody),
      signal: AbortSignal.timeout(config.timeout),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Gemini API error (${response.status}): ${errorText}`)
    }

    const data = await response.json()

    // 5. Parse Response
    const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text || ''
    const parsed = parseGeminiResponse(responseText)

    // 6. Build FieldMapping array
    const fieldMap = new Map(fields.map(f => [f.id, f]))
    const mappings: FieldMapping[] = []

    for (const mapping of parsed.mappings) {
      const targetField = fieldMap.get(mapping.fieldId)
      if (targetField) {
        mappings.push({
          payloadKey: mapping.payloadKey,
          targetField,
          confidence: mapping.confidence,
          reasoning: mapping.reasoning,
          action: confidenceToAction(mapping.confidence),
        })
      }
    }

    return {
      mappings,
      unmapped: parsed.unmapped,
      warnings: parsed.warnings,
      fromCache: false,
      latencyMs: Date.now() - startTime,
    }
  } catch (error) {
    console.error('[DAS:GeminiVision] Mapping error:', error)

    // Return empty result on error
    return {
      mappings: [],
      unmapped: Object.keys(payload),
      warnings: [`Gemini error: ${error instanceof Error ? error.message : 'Unknown'}`],
      fromCache: false,
      latencyMs: Date.now() - startTime,
    }
  }
}

// ============================================================================
// FALLBACK: HEURISTIC MAPPING
// ============================================================================

/**
 * Fallback heuristic mapping when Gemini is unavailable
 *
 * Uses simple name/label matching without AI
 */
export function mapFieldsHeuristic(
  payload: Record<string, unknown>,
  fields: FieldSignature[]
): MappingResult {
  const startTime = Date.now()
  const mappings: FieldMapping[] = []
  const unmapped: string[] = []

  for (const payloadKey of Object.keys(payload)) {
    const normalizedKey = payloadKey.toLowerCase().replace(/[_-]/g, '')

    // Try to find matching field
    let bestMatch: FieldSignature | null = null
    let bestScore = 0

    for (const field of fields) {
      let score = 0

      // Check name attribute
      const name = field.attributes.name?.toLowerCase().replace(/[_[\]-]/g, '') || ''
      if (name === normalizedKey) score = 0.95
      else if (name.includes(normalizedKey) || normalizedKey.includes(name)) score = 0.75

      // Check label
      const label = field.label?.toLowerCase().replace(/[_-]/g, '') || ''
      if (label === normalizedKey) score = Math.max(score, 0.9)
      else if (label.includes(normalizedKey)) score = Math.max(score, 0.7)

      // Check placeholder
      const placeholder = field.attributes.placeholder?.toLowerCase() || ''
      if (placeholder.includes(normalizedKey)) score = Math.max(score, 0.6)

      if (score > bestScore) {
        bestScore = score
        bestMatch = field
      }
    }

    if (bestMatch && bestScore >= 0.5) {
      mappings.push({
        payloadKey,
        targetField: bestMatch,
        confidence: bestScore,
        reasoning: 'Heuristic match (AI unavailable)',
        action: confidenceToAction(bestScore),
      })
    } else {
      unmapped.push(payloadKey)
    }
  }

  return {
    mappings,
    unmapped,
    warnings: ['Using heuristic fallback (Gemini unavailable)'],
    fromCache: false,
    latencyMs: Date.now() - startTime,
  }
}
