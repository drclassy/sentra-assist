// Designed and constructed by Claudesy.
/**
 * Precision-Architected. Future-Built by Docsyanpse
 * Sentra Healthcare Artificial Intelligence
 */

/**
 * Prompt Templates for DeepSeek CDSS
 * Clinical diagnosis suggestion prompts
 *
 * @module lib/api/prompt-templates
 * @version 1.0.0
 */

import type { RAGSearchResult } from '../rag/types'
import type { AnonymizedClinicalContext, ChatMessage } from './deepseek-types'

// =============================================================================
// SYSTEM PROMPT
// =============================================================================

/**
 * System prompt for clinical diagnosis suggestions
 * Defines AI behavior, constraints, and output format
 */
export const SYSTEM_PROMPT = `Anda adalah asisten Clinical Decision Support System (CDSS) untuk Puskesmas di Indonesia.

PERAN ANDA:
- Memberikan SARAN diagnosis diferensial untuk mendukung keputusan klinis dokter
- Anda BUKAN pengganti penilaian klinis dokter
- Semua saran bersifat ADVISORY - dokter membuat keputusan final

ATURAN KETAT:
1. HANYA gunakan kode ICD-10 dari daftar referensi yang diberikan dalam konteks
2. Jika tidak yakin, jawab "Data tidak cukup untuk saran diagnosis"
3. JANGAN fabrikasi atau mengarang:
   - Nama obat atau dosis
   - Referensi jurnal atau guideline
   - Kode ICD-10 yang tidak ada dalam referensi
4. Selalu sertakan reasoning chain (alasan klinis) untuk setiap saran
5. Identifikasi red flags yang memerlukan rujukan segera

OUTPUT FORMAT (JSON KETAT):
{
  "suggestions": [
    {
      "rank": 1,
      "diagnosis_name": "Nama diagnosis dalam Bahasa Indonesia",
      "icd10_code": "Kode ICD-10 dari referensi",
      "confidence": 0.0-1.0,
      "reasoning": "Alasan klinis mengapa diagnosis ini sesuai dengan keluhan",
      "red_flags": ["Tanda bahaya yang perlu diwaspadai"],
      "recommended_actions": ["Tindakan yang disarankan"]
    }
  ],
  "data_quality_note": "Catatan jika data input tidak lengkap"
}

PANDUAN CONFIDENCE SCORE:
- 0.8-1.0: Sangat sesuai dengan keluhan dan tanda klinis
- 0.6-0.79: Kemungkinan besar, perlu konfirmasi pemeriksaan
- 0.4-0.59: Perlu dipertimbangkan dalam diferensial
- 0.2-0.39: Kemungkinan kecil tapi perlu disingkirkan
- <0.2: Tidak disarankan untuk ditampilkan

PRIORITAS DIAGNOSIS:
1. Kondisi yang mengancam jiwa (rule out dulu)
2. Kondisi yang paling sesuai dengan keluhan utama
3. Diagnosis banding yang perlu disingkirkan
4. Kondisi umum di Puskesmas

Berikan maksimal 5 saran diagnosis, diurutkan dari yang paling mungkin.`

// =============================================================================
// USER PROMPT BUILDER
// =============================================================================

/**
 * Build user prompt from clinical context and RAG results
 */
export function buildUserPrompt(
  context: AnonymizedClinicalContext,
  ragResults: RAGSearchResult[]
): string {
  const sections: string[] = []

  // Header
  sections.push('=== DATA KLINIS PASIEN ===')

  // Demographics
  const gender = context.jenis_kelamin === 'L' ? 'Laki-laki' : 'Perempuan'
  sections.push(`Usia: ${context.usia_tahun} tahun`)
  sections.push(`Jenis Kelamin: ${gender}`)

  if (context.is_pregnant) {
    sections.push('Status: Hamil')
  }

  // Chief complaint
  sections.push('')
  sections.push('=== KELUHAN ===')
  sections.push(`Keluhan Utama: ${context.keluhan_utama}`)

  if (context.keluhan_tambahan) {
    sections.push(`Keluhan Tambahan: ${context.keluhan_tambahan}`)
  }

  // Duration
  if (context.lama_sakit) {
    const duration = formatDuration(context.lama_sakit)
    if (duration) {
      sections.push(`Lama Sakit: ${duration}`)
    }
  }

  // Vital signs
  if (context.vital_signs) {
    const vitals = formatVitalSigns(context.vital_signs)
    if (vitals.length > 0) {
      sections.push('')
      sections.push('=== TANDA VITAL ===')
      sections.push(vitals.join(', '))
    }
  }

  // Physical examination
  if (context.pemeriksaan_fisik) {
    sections.push('')
    sections.push('=== PEMERIKSAAN FISIK ===')
    sections.push(context.pemeriksaan_fisik)
  }

  // Lab results
  if (context.lab_results) {
    sections.push('')
    sections.push('=== HASIL LABORATORIUM ===')
    sections.push(context.lab_results)
  }

  // Medical history
  if (context.chronic_diseases && context.chronic_diseases.length > 0) {
    sections.push('')
    sections.push('=== RIWAYAT PENYAKIT ===')
    sections.push(`Penyakit Kronis: ${context.chronic_diseases.join(', ')}`)
  }

  // Allergies
  if (context.allergies && context.allergies.length > 0) {
    sections.push('')
    sections.push('=== ALERGI ===')
    sections.push(context.allergies.join(', '))
  }

  // RAG context
  sections.push('')
  sections.push('=== REFERENSI KODE ICD-10 ===')
  sections.push('Gunakan HANYA kode dari daftar berikut:')
  sections.push('')

  if (ragResults.length > 0) {
    ragResults.forEach((result, index) => {
      const entry = result.entry
      sections.push(`${index + 1}. ${entry.code} - ${entry.name_id} (${entry.name_en})`)
    })
  } else {
    sections.push('(Tidak ada kode ICD-10 yang ditemukan dalam database lokal)')
  }

  // Instruction
  sections.push('')
  sections.push('=== INSTRUKSI ===')
  sections.push('Berdasarkan data klinis di atas, berikan saran diagnosis dalam format JSON.')
  sections.push('Pastikan semua kode ICD-10 berasal dari daftar referensi yang diberikan.')

  return sections.join('\n')
}

/**
 * Format duration object to readable string
 */
function formatDuration(lama: { hari: number; bulan: number; tahun: number }): string {
  const parts: string[] = []

  if (lama.tahun > 0) {
    parts.push(`${lama.tahun} tahun`)
  }
  if (lama.bulan > 0) {
    parts.push(`${lama.bulan} bulan`)
  }
  if (lama.hari > 0) {
    parts.push(`${lama.hari} hari`)
  }

  return parts.join(' ')
}

/**
 * Format vital signs to readable string
 */
function formatVitalSigns(vitals: AnonymizedClinicalContext['vital_signs']): string[] {
  if (!vitals) return []

  const formatted: string[] = []

  if (vitals.systolic && vitals.diastolic) {
    formatted.push(`TD: ${vitals.systolic}/${vitals.diastolic} mmHg`)
  }
  if (vitals.heart_rate) {
    formatted.push(`Nadi: ${vitals.heart_rate} x/menit`)
  }
  if (vitals.respiratory_rate) {
    formatted.push(`RR: ${vitals.respiratory_rate} x/menit`)
  }
  if (vitals.temperature) {
    formatted.push(`Suhu: ${vitals.temperature}°C`)
  }
  if (vitals.spo2) {
    formatted.push(`SpO2: ${vitals.spo2}%`)
  }
  if (vitals.gcs) {
    formatted.push(`GCS: ${vitals.gcs}`)
  }

  return formatted
}

// =============================================================================
// MESSAGE BUILDER
// =============================================================================

/**
 * Build complete message array for DeepSeek API
 */
export function buildMessages(
  context: AnonymizedClinicalContext,
  ragResults: RAGSearchResult[]
): ChatMessage[] {
  return [
    {
      role: 'system',
      content: SYSTEM_PROMPT,
    },
    {
      role: 'user',
      content: buildUserPrompt(context, ragResults),
    },
  ]
}

// =============================================================================
// RESPONSE PARSER
// =============================================================================

/**
 * Parse AI response text to structured format
 * Handles various response formats and extracts JSON
 */
export function parseAIResponse(responseText: string): {
  success: boolean
  data?: {
    suggestions: Array<{
      rank: number
      diagnosis_name: string
      icd10_code: string
      confidence: number
      reasoning: string
      red_flags: string[]
      recommended_actions: string[]
    }>
    data_quality_note?: string
  }
  error?: string
} {
  try {
    // Try to extract JSON from response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/)

    if (!jsonMatch) {
      return {
        success: false,
        error: 'No JSON found in response',
      }
    }

    const parsed = JSON.parse(jsonMatch[0])

    // Validate structure
    if (!parsed.suggestions || !Array.isArray(parsed.suggestions)) {
      return {
        success: false,
        error: 'Invalid response structure: missing suggestions array',
      }
    }

    // Normalize suggestions
    const suggestions = parsed.suggestions.map((s: Record<string, unknown>, index: number) => ({
      rank: (s.rank as number) || index + 1,
      diagnosis_name: (s.diagnosis_name as string) || (s.nama as string) || '',
      icd10_code: (s.icd10_code as string) || (s.icd_x as string) || '',
      confidence: normalizeConfidence(s.confidence),
      reasoning: (s.reasoning as string) || (s.rationale as string) || '',
      red_flags: Array.isArray(s.red_flags) ? s.red_flags : [],
      recommended_actions: Array.isArray(s.recommended_actions) ? s.recommended_actions : [],
    }))

    return {
      success: true,
      data: {
        suggestions,
        data_quality_note: parsed.data_quality_note,
      },
    }
  } catch (error) {
    return {
      success: false,
      error: `Failed to parse response: ${error instanceof Error ? error.message : 'Unknown error'}`,
    }
  }
}

/**
 * Normalize confidence value to 0.0-1.0 range
 */
function normalizeConfidence(value: unknown): number {
  if (typeof value !== 'number') {
    return 0.5 // Default middle confidence
  }

  // Handle percentage (0-100) vs decimal (0-1)
  if (value > 1) {
    return Math.min(1, value / 100)
  }

  return Math.max(0, Math.min(1, value))
}

// =============================================================================
// FALLBACK PROMPT
// =============================================================================

/**
 * Simple fallback prompt for when main inference fails
 */
export function buildFallbackPrompt(context: AnonymizedClinicalContext): string {
  return `Keluhan: ${context.keluhan_utama}
Usia: ${context.usia_tahun} tahun, ${context.jenis_kelamin === 'L' ? 'Laki-laki' : 'Perempuan'}

Berikan 3 kemungkinan diagnosis dalam format sederhana:
1. [Kode ICD-10] - [Nama Diagnosis]
2. [Kode ICD-10] - [Nama Diagnosis]
3. [Kode ICD-10] - [Nama Diagnosis]`
}
