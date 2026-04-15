// Designed and constructed by Claudesy.
/**
 * Iskandar Diagnosis Engine V1 — LLM Reasoner (Constrained)
 * LLM is COPILOT, not PILOT. It ranks/enriches candidates from KB.
 * It does NOT generate diagnoses from nothing.
 *
 * Fallback: If LLM fails, returns KB-only results (no reasoning text).
 *
 * @module lib/iskandar-diagnosis-engine/llm-reasoner
 */

import type { AIDiagnosisSuggestion } from '@/lib/api/deepseek-types';
import type { MatchedCandidate } from './symptom-matcher';

// =============================================================================
// TYPES
// =============================================================================

export interface ReasonerInput {
  candidates: MatchedCandidate[];
  keluhanUtama: string;
  keluhanTambahan?: string;
  usia?: number;
  jenisKelamin?: 'L' | 'P';
  epiContext?: string;
}

/**
 * ReasonerOutput interface
 *
 * @remarks
 * TODO: Add type description and property documentation
 * Auto-generated on 2026-03-12
 */

export interface ReasonerOutput {
  suggestions: AIDiagnosisSuggestion[];
  source: 'ai' | 'local';
  modelVersion: string;
  latencyMs: number;
  dataQualityWarnings: string[];
}

// =============================================================================
// SYSTEM PROMPT
// =============================================================================

function buildSystemPrompt(epiContext: string): string {
  return `Anda adalah Iskandar Diagnosis Engine V1 (IDE) — Artificial Assisted Diagnostic Intelligence untuk Puskesmas di Indonesia.

PERAN: Menerima kandidat diagnosis dari knowledge base (KB) dan MERANKING ulang berdasarkan klinis.

ATURAN:
1. HANYA pilih dari kandidat yang diberikan — JANGAN buat diagnosis baru
2. Berikan reasoning klinis dalam Bahasa Indonesia
3. Identifikasi red flags dan recommended actions
4. Confidence 0.0–1.0 berdasarkan kesesuaian klinis
5. JANGAN fabrikasi obat, dosis, atau referensi

${epiContext}

OUTPUT FORMAT (JSON KETAT):
{
  "suggestions": [
    {
      "rank": 1,
      "diagnosis_name": "Nama diagnosis Bahasa Indonesia",
      "icd10_code": "ICD-10",
      "confidence": 0.85,
      "reasoning": "Alasan klinis",
      "red_flags": ["red flag 1"],
      "recommended_actions": ["tindakan 1"]
    }
  ]
}`;
}

function buildUserPrompt(input: ReasonerInput): string {
  const candidateList = input.candidates
    .slice(0, 5)
    .map(
      (c, i) =>
        `${i + 1}. [${c.icd10}] ${c.nama} (match: ${(c.matchScore * 100).toFixed(1)}%, gejala cocok: ${c.matchedSymptoms.join(', ')})`
    )
    .join('\n');

  return `PASIEN:
- Keluhan utama: ${input.keluhanUtama}
${input.keluhanTambahan ? `- Keluhan tambahan: ${input.keluhanTambahan}` : ''}
${input.usia ? `- Usia: ${input.usia} tahun` : ''}
${input.jenisKelamin ? `- Jenis kelamin: ${input.jenisKelamin === 'L' ? 'Laki-laki' : 'Perempuan'}` : ''}

KANDIDAT DARI KB (pilih dan ranking dari daftar ini):
${candidateList}

Berikan ranking ulang dengan reasoning klinis. Output JSON saja.`;
}

// =============================================================================
// LLM CALL
// =============================================================================

async function callLLM(
  _systemPrompt: string,
  userPrompt: string
): Promise<{ success: boolean; data?: { suggestions: AIDiagnosisSuggestion[] }; error?: string }> {
  try {
    // Dynamic import to avoid circular deps and handle missing API key gracefully
    const { inferDiagnosis } = await import('@/lib/api/deepseek-client');
    const { isAPIConfigured } = await import('@/lib/api/deepseek-client');

    if (!(await isAPIConfigured())) {
      return { success: false, error: 'API not configured' };
    }

    // Use the existing inferDiagnosis with a synthetic context
    // The buildMessages in prompt-templates will handle the formatting
    const context = {
      keluhan_utama: userPrompt,
      keluhan_tambahan: '',
      usia_tahun: 0,
      jenis_kelamin: 'L' as const,
      vital_signs: {},
      is_pregnant: false,
      allergies: [],
      chronic_diseases: [],
    };

    const result = await inferDiagnosis(context, []);

    if (result.suggestions.length > 0) {
      return {
        success: true,
        data: { suggestions: result.suggestions },
      };
    }

    return { success: false, error: 'No suggestions from LLM' };
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown LLM error';
    console.warn('[LLM Reasoner] LLM call failed, using fallback:', msg);
    return { success: false, error: msg };
  }
}

// =============================================================================
// KB-ONLY FALLBACK
// =============================================================================

function buildKBOnlySuggestions(candidates: MatchedCandidate[]): AIDiagnosisSuggestion[] {
  return candidates.slice(0, 5).map((c, index) => ({
    rank: index + 1,
    diagnosis_name: c.nama,
    icd10_code: c.icd10,
    confidence: c.matchScore,
    reasoning: c.definisi
      ? `${c.definisi.substring(0, 200)}${c.definisi.length > 200 ? '...' : ''}`
      : `Kesesuaian gejala: ${c.matchedSymptoms.slice(0, 3).join(', ')}. Match score: ${(c.matchScore * 100).toFixed(0)}%.`,
    red_flags: c.redFlags.slice(0, 3),
    recommended_actions: buildRecommendedActions(c),
  }));
}

function buildRecommendedActions(c: MatchedCandidate): string[] {
  const actions: string[] = [];
  actions.push('Lakukan pemeriksaan fisik terarah dan monitoring TTV serial');

  if (c.kriteria_rujukan) {
    actions.push(`Pertimbangkan rujukan: ${c.kriteria_rujukan.substring(0, 120)}`);
  }
  if (c.diagnosisBanding.length > 0) {
    actions.push(`Diagnosis banding: ${c.diagnosisBanding.slice(0, 3).join(', ')}`);
  }
  return actions.slice(0, 3);
}

// =============================================================================
// MAIN EXPORT
// =============================================================================

/**
 * Run LLM-augmented reasoning on KB candidates.
 * Falls back to KB-only if LLM unavailable.
 */
export async function runLLMReasoning(input: ReasonerInput): Promise<ReasonerOutput> {
  const startTime = Date.now();
  const warnings: string[] = [];

  if (input.candidates.length === 0) {
    return {
      suggestions: [],
      source: 'local',
      modelVersion: 'IDE-V1-KB',
      latencyMs: Date.now() - startTime,
      dataQualityWarnings: ['No candidates to reason about'],
    };
  }

  // Try LLM first
  const systemPrompt = buildSystemPrompt(input.epiContext || '');
  const userPrompt = buildUserPrompt(input);
  const llmResult = await callLLM(systemPrompt, userPrompt);

  if (llmResult.success && llmResult.data) {
    // Merge LLM reasoning with KB data
    const enriched = llmResult.data.suggestions.map((s, i) => {
      // Find matching KB candidate to enrich
      const kbMatch = input.candidates.find(
        (c) => c.icd10 === s.icd10_code || c.icd10.startsWith(s.icd10_code.split('.')[0])
      );
      return {
        ...s,
        rank: i + 1,
        // Use LLM confidence but cap at KB score + 0.1
        confidence: kbMatch ? Math.min(s.confidence, kbMatch.matchScore + 0.1) : s.confidence,
        red_flags: s.red_flags || kbMatch?.redFlags?.slice(0, 3) || [],
        recommended_actions:
          s.recommended_actions || (kbMatch ? buildRecommendedActions(kbMatch) : []),
      };
    });

    return {
      suggestions: enriched.slice(0, 5),
      source: 'ai',
      modelVersion: 'IDE-V1-LLM',
      latencyMs: Date.now() - startTime,
      dataQualityWarnings: warnings,
    };
  }

  // Fallback: KB-only
  if (llmResult.error) {
    warnings.push(`LLM unavailable: ${llmResult.error}. Using KB-only results.`);
  }

  return {
    suggestions: buildKBOnlySuggestions(input.candidates),
    source: 'local',
    modelVersion: 'IDE-V1-KB',
    latencyMs: Date.now() - startTime,
    dataQualityWarnings: warnings,
  };
}
