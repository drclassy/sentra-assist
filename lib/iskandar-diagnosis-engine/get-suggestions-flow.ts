// Designed and constructed by Claudesy.

import { getICD10Details, searchForDiagnosisSuggestions } from '@/lib/rag'
import type { APIResponse, CDSSResponse, DiagnosisRequestContext } from '@/types/api'
import type { Encounter } from '~/utils/types'
import { classifyChronicDisease } from './chronic-disease-classifier'
import { runDiagnosisEngine } from './engine'

type DiagnosisSuggestion = CDSSResponse['diagnosis_suggestions'][number]
type MedicationRecommendation = CDSSResponse['medication_recommendations'][number]

function normalizeText(value: string): string {
  return value.toLowerCase().replace(/\s+/g, ' ').trim()
}

function hasAny(text: string, keywords: string[]): boolean {
  return keywords.some(keyword => text.includes(keyword))
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

const ICD_PATTERN = /^[A-Z][0-9]{2}(?:\.[0-9A-Z]{1,2})?$/
const ICD_EMERGENCY_HEAD_MAP: Record<string, string> = {
  '0': 'O',
  '1': 'I',
  '5': 'S',
  '8': 'B',
}

function normalizeIcdCode(value: string | undefined): string {
  const raw = String(value || '')
    .toUpperCase()
    .replace(/\s+/g, '')
    .trim()
  if (!raw) return ''

  const direct = raw.match(/[A-Z][0-9]{2}(?:\.[0-9A-Z]{1,2})?/)
  if (direct?.[0]) return direct[0]

  const compact = raw.replace(/[^A-Z0-9.]/g, '')
  if (!compact) return ''

  const mappedHead = ICD_EMERGENCY_HEAD_MAP[compact[0]]
  if (mappedHead) {
    const candidate = `${mappedHead}${compact.slice(1)}`
    const recovered = candidate.match(/^[A-Z][0-9]{2}(?:\.[0-9A-Z]{1,2})?/)
    if (recovered?.[0]) return recovered[0]
  }

  return compact
}

function isLikelyIcdCode(value: string | undefined): boolean {
  const normalized = normalizeIcdCode(value)
  return ICD_PATTERN.test(normalized)
}

function isReadableDiagnosisName(value: string | undefined): boolean {
  const cleaned = String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
  return cleaned.length >= 3 && /[A-Za-z]/.test(cleaned) && !/^\d+$/.test(cleaned)
}

function isCodeLikeDiagnosisName(value: string): boolean {
  const cleaned = value.toUpperCase().replace(/\s+/g, ' ').trim()
  if (!cleaned) return false
  if (/^DIAGNOSIS\s+[A-Z][0-9]{2}(?:\.[0-9A-Z]{1,2})?$/.test(cleaned)) return true
  return isLikelyIcdCode(cleaned)
}

function sanitizeDiagnosisDisplayName(
  rawName: string | undefined,
  icdCode: string,
  preferredName?: string
): string {
  const cleaned = String(rawName || '')
    .replace(/\s+/g, ' ')
    .trim()
  if (isReadableDiagnosisName(cleaned) && !isCodeLikeDiagnosisName(cleaned)) {
    return cleaned
  }

  const preferred = String(preferredName || '')
    .replace(/\s+/g, ' ')
    .trim()
  if (isReadableDiagnosisName(preferred) && !isCodeLikeDiagnosisName(preferred)) {
    return preferred
  }

  const normalizedIcd = normalizeIcdCode(icdCode)
  const chronic = classifyChronicDisease(normalizedIcd)
  if (chronic) return chronic.fullName
  if (normalizedIcd) return `Diagnosis ${normalizedIcd}`
  return 'Diagnosis belum terklasifikasi'
}

async function hydrateSuggestionDisplayNames(
  suggestions: DiagnosisSuggestion[]
): Promise<DiagnosisSuggestion[]> {
  const codes = Array.from(
    new Set(
      suggestions
        .map(item => normalizeIcdCode(item.icd_x))
        .filter((code): code is string => Boolean(code && isLikelyIcdCode(code)))
    )
  )
  if (codes.length === 0) {
    return suggestions.map(item => {
      const normalizedCode = normalizeIcdCode(item.icd_x)
      return {
        ...item,
        icd_x: normalizedCode || item.icd_x,
        nama: sanitizeDiagnosisDisplayName(item.nama, normalizedCode || item.icd_x),
      }
    })
  }

  try {
    const details = await getICD10Details(codes)
    const labelByCode = new Map<string, string>()
    for (const detail of details) {
      const code = normalizeIcdCode(detail.code)
      if (!code) continue
      const label = detail.name_id || detail.name_en || ''
      if (!labelByCode.has(code)) labelByCode.set(code, label)
      const prefix = code.split('.')[0]
      if (!labelByCode.has(prefix)) labelByCode.set(prefix, label)
    }

    return suggestions.map(item => {
      const code = normalizeIcdCode(item.icd_x)
      const preferred = labelByCode.get(code) || labelByCode.get(code.split('.')[0]) || ''
      return {
        ...item,
        icd_x: code || item.icd_x,
        nama: sanitizeDiagnosisDisplayName(item.nama, code || item.icd_x, preferred),
      }
    })
  } catch {
    return suggestions.map(item => {
      const normalizedCode = normalizeIcdCode(item.icd_x)
      return {
        ...item,
        icd_x: normalizedCode || item.icd_x,
        nama: sanitizeDiagnosisDisplayName(item.nama, normalizedCode || item.icd_x),
      }
    })
  }
}

function deriveAturanPakai(namaObat: string): MedicationRecommendation['aturan_pakai'] {
  const normalized = namaObat.toLowerCase()
  if (
    normalized.includes('cream') ||
    normalized.includes('krim') ||
    normalized.includes('salep') ||
    normalized.includes('ointment')
  ) {
    return 'Pemakaian luar'
  }
  return 'Sesudah makan'
}

async function buildMedicationRecommendations(
  diagnosisSuggestions: DiagnosisSuggestion[],
  encounter: Encounter,
  context: DiagnosisRequestContext
): Promise<MedicationRecommendation[]> {
  const codes = Array.from(
    new Set(
      diagnosisSuggestions
        .map(item => item.icd_x)
        .filter((code): code is string => typeof code === 'string' && code.trim().length > 0)
    )
  ).slice(0, 5)

  if (codes.length === 0) {
    return []
  }

  try {
    const details = await getICD10Details(codes)
    const detailByCode = new Map(details.map(detail => [detail.code, detail]))

    for (const code of codes) {
      const entry = detailByCode.get(code)
      if (!entry?.terapi || entry.terapi.length === 0) continue
      const sourceDx = diagnosisSuggestions.find(item => item.icd_x === code)

      return entry.terapi.slice(0, 5).map(item => ({
        nama_obat: item.obat,
        dosis: item.frek || item.dosis || '-',
        aturan_pakai: deriveAturanPakai(item.obat),
        durasi: '3-5 hari',
        rationale: `Terapi farmakologi awal berbasis knowledge ICD (${code}) untuk ${sourceDx?.nama || entry.name_id}.`,
        safety_check: 'safe',
        contraindications: [],
      }))
    }
  } catch {
    // Continue complaint-based DB fallback
  }

  const chiefComplaint = context.keluhan_utama || encounter.anamnesa?.keluhan_utama || ''
  const additionalSymptoms = context.keluhan_tambahan || encounter.anamnesa?.keluhan_tambahan || ''
  if (!chiefComplaint.trim()) {
    return []
  }

  try {
    const dbResults = await searchForDiagnosisSuggestions(chiefComplaint, additionalSymptoms, 5)
    const bestWithTherapy = dbResults.find(
      result => result.entry.terapi && result.entry.terapi.length > 0
    )
    if (!bestWithTherapy?.entry.terapi || bestWithTherapy.entry.terapi.length === 0) {
      return []
    }

    return bestWithTherapy.entry.terapi.slice(0, 5).map(item => ({
      nama_obat: item.obat,
      dosis: item.frek || item.dosis || '-',
      aturan_pakai: deriveAturanPakai(item.obat),
      durasi: '3-5 hari',
      rationale: `Terapi farmakologi awal berbasis knowledge keluhan (${bestWithTherapy.entry.code} - ${bestWithTherapy.entry.name_id}).`,
      safety_check: 'safe',
      contraindications: [],
    }))
  } catch {
    return []
  }
}

function mapDbResultsToSuggestions(
  results: Array<{
    entry: {
      code: string
      name_id: string
      name_en: string
      definisi?: string
      red_flags?: string[]
      kriteria_rujukan?: string
      gejala_klinis?: string[]
      diagnosis_banding?: string[]
    }
    relevance_score: number
  }>
): DiagnosisSuggestion[] {
  return results.slice(0, 5).map((result, index) => {
    const entry = result.entry
    const confidence = clamp(0.2 + result.relevance_score * 0.55, 0.2, 0.75)
    const rationale =
      entry.definisi ||
      (entry.gejala_klinis && entry.gejala_klinis.length > 0
        ? `Kesesuaian gejala: ${entry.gejala_klinis.slice(0, 3).join(', ')}.`
        : `Hasil pencarian ICD berdasarkan keluhan dengan relevansi ${(result.relevance_score * 100).toFixed(0)}%.`)
    const recommendedActions = ['Lakukan pemeriksaan fisik terarah dan monitoring TTV serial']

    if (entry.kriteria_rujukan) {
      recommendedActions.push(
        `Pertimbangkan rujukan bila memenuhi kriteria: ${entry.kriteria_rujukan}`
      )
    }
    if (entry.diagnosis_banding && entry.diagnosis_banding.length > 0) {
      recommendedActions.push(
        `Pertimbangkan diagnosis banding: ${entry.diagnosis_banding.slice(0, 2).join(', ')}`
      )
    }

    return {
      rank: index + 1,
      icd_x: entry.code,
      nama: sanitizeDiagnosisDisplayName(entry.name_id || entry.name_en, entry.code),
      confidence,
      rationale,
      red_flags: entry.red_flags?.slice(0, 3) || [],
      recommended_actions: recommendedActions.slice(0, 3),
    }
  })
}

function buildRuleFallbackSuggestions(
  encounter: Encounter,
  context: DiagnosisRequestContext
): DiagnosisSuggestion[] {
  const complaintText = normalizeText(
    `${context.keluhan_utama || encounter.anamnesa?.keluhan_utama || ''} ${
      context.keluhan_tambahan || encounter.anamnesa?.keluhan_tambahan || ''
    }`
  )

  const vitals = context.vital_signs
  const hasHighRiskChestPainSignal =
    (vitals?.systolic ?? 120) >= 180 ||
    (vitals?.systolic ?? 120) < 90 ||
    (vitals?.heart_rate ?? 80) >= 120 ||
    (vitals?.respiratory_rate ?? 16) >= 24 ||
    (vitals?.spo2 ?? 98) <= 92

  if (hasAny(complaintText, ['nyeri dada', 'chest pain', 'dada'])) {
    return [
      {
        rank: 1,
        icd_x: 'I20.9',
        nama: 'Suspek Angina / Rule-Out ACS',
        confidence: hasHighRiskChestPainSignal ? 0.46 : 0.38,
        rationale:
          'Keluhan nyeri dada membutuhkan eksklusi cepat sindrom koroner akut sebelum menegakkan etiologi non-kardiak.',
        red_flags: hasHighRiskChestPainSignal
          ? ['Nyeri dada dengan instabilitas hemodinamik atau gangguan respirasi']
          : ['Nyeri dada persisten >20 menit atau memberat'],
        recommended_actions: [
          'Lakukan EKG 12 sadapan sesegera mungkin',
          'Monitoring serial TTV tiap 15-30 menit',
          'Rujuk emergensi bila nyeri menetap, hipotensi, atau sesak berat',
        ],
      },
      {
        rank: 2,
        icd_x: 'M94.0',
        nama: 'Nyeri Dinding Dada Muskuloskeletal',
        confidence: 0.31,
        rationale:
          'Pada pasien muda, nyeri dada muskuloskeletal termasuk diferensial yang sering setelah kondisi gawat tersingkirkan.',
        red_flags: [],
        recommended_actions: [
          'Evaluasi nyeri tekan lokal dinding dada',
          'Pastikan tidak ada red flag kardiopulmoner',
        ],
      },
      {
        rank: 3,
        icd_x: 'K21.9',
        nama: 'Refluks Gastroesofageal / Dispepsia',
        confidence: 0.27,
        rationale:
          'Nyeri ulu hati/retrosternal dapat menyerupai nyeri dada, namun diagnosis ini dipertimbangkan setelah etiologi akut dikesampingkan.',
        red_flags: [],
        recommended_actions: [
          'Telaah hubungan gejala dengan makanan dan posisi',
          'Berikan terapi simptomatik bila tidak ada tanda bahaya',
        ],
      },
    ]
  }

  return [
    {
      rank: 1,
      icd_x: 'R69',
      nama: 'Differential Belum Spesifik',
      confidence: 0.25,
      rationale:
        'Data klinis saat ini belum cukup untuk menyusun differential yang lebih spesifik secara aman.',
      red_flags: ['Data klinis belum lengkap'],
      recommended_actions: [
        'Lengkapi anamnesis terarah dan TTV serial',
        'Pertimbangkan pemeriksaan penunjang dasar sesuai keluhan',
      ],
    },
  ]
}

async function buildComplaintFallbackSuggestions(
  encounter: Encounter,
  context: DiagnosisRequestContext
): Promise<{ suggestions: DiagnosisSuggestion[]; source: 'database' | 'rule' }> {
  const chiefComplaint = context.keluhan_utama || encounter.anamnesa?.keluhan_utama || ''
  const additionalSymptoms = context.keluhan_tambahan || encounter.anamnesa?.keluhan_tambahan || ''

  try {
    const dbResults = await searchForDiagnosisSuggestions(chiefComplaint, additionalSymptoms, 5)
    if (dbResults.length > 0) {
      return {
        suggestions: mapDbResultsToSuggestions(dbResults),
        source: 'database',
      }
    }
  } catch {
    // Continue to deterministic rule fallback
  }

  return {
    suggestions: buildRuleFallbackSuggestions(encounter, context),
    source: 'rule',
  }
}

/**
 * runGetSuggestionsFlow
 *
 * @remarks
 * TODO: Add detailed description, parameters, and examples
 * Auto-generated on 2026-03-12
 */

export async function runGetSuggestionsFlow(
  encounter: Encounter,
  context: DiagnosisRequestContext
): Promise<APIResponse<CDSSResponse>> {
  if (!encounter.anamnesa?.keluhan_utama) {
    return {
      success: false,
      error: {
        code: 'MISSING_DATA',
        message: 'Keluhan utama tidak tersedia. Isi keluhan di form anamnesa.',
      },
    }
  }

  try {
    const engineResult = await runDiagnosisEngine(encounter, undefined, context)
    const mappedEngineSuggestions = engineResult.suggestions.map((s, index) => ({
      rank: index + 1,
      icd_x: normalizeIcdCode(s.icd10_code),
      nama: s.diagnosis_name,
      confidence: s.confidence,
      rationale: s.reasoning,
      red_flags: s.red_flags || [],
      recommended_actions: s.recommended_actions || [],
    }))
    const engineSuggestions = (await hydrateSuggestionDisplayNames(mappedEngineSuggestions)).filter(
      item => isLikelyIcdCode(item.icd_x)
    )

    const useFallback = engineSuggestions.length === 0
    const fallback = useFallback
      ? await buildComplaintFallbackSuggestions(encounter, context)
      : { suggestions: [] as DiagnosisSuggestion[], source: 'rule' as const }
    const diagnosisSuggestions = (
      await hydrateSuggestionDisplayNames(useFallback ? fallback.suggestions : engineSuggestions)
    ).filter(item => isLikelyIcdCode(item.icd_x))
    const fallbackWarning = useFallback
      ? [
          fallback.source === 'database'
            ? 'Engine v3 tidak menghasilkan differential di atas ambang confidence; fallback berbasis database ICD diaktifkan.'
            : 'Engine v3 tidak menghasilkan differential di atas ambang confidence; fallback rule-based diaktifkan.',
        ]
      : []
    const fallbackAlert = useFallback
      ? [
          {
            id: `fallback-${Date.now()}`,
            type: 'low_confidence' as const,
            severity: 'info' as const,
            title: 'Differential Fallback Aktif',
            message:
              fallback.source === 'database'
                ? 'Differential dihasilkan dari database knowledge ICD untuk menjaga kontinuitas evaluasi awal. Konfirmasi klinis tetap wajib.'
                : 'Differential dihasilkan dari rule-based keluhan untuk melengkapi evaluasi awal. Konfirmasi klinis tetap wajib.',
            action: 'Lengkapi pemeriksaan fisik dan pemeriksaan penunjang sesuai indikasi.',
          },
        ]
      : []
    const medicationRecommendations = await buildMedicationRecommendations(
      diagnosisSuggestions,
      encounter,
      context
    )

    return {
      success: true,
      data: {
        diagnosis_suggestions: diagnosisSuggestions,
        medication_recommendations: medicationRecommendations,
        alerts: [
          ...engineResult.alerts.map(a => ({
            id: a.id,
            type: a.type,
            severity: a.severity,
            title: a.title,
            message: a.message,
            icd_codes: a.icd_codes,
            action: a.action,
          })),
          ...fallbackAlert,
        ],
        validation_summary: {
          total_raw: engineResult.validation_summary.total_raw,
          total_validated: useFallback
            ? diagnosisSuggestions.length
            : engineResult.validation_summary.total_validated,
          unverified_codes: engineResult.validation_summary.unverified_codes,
          warnings: [...engineResult.validation_summary.warnings, ...fallbackWarning],
        },
        meta: {
          processing_time_ms: engineResult.processing_time_ms,
          model_version: engineResult.model_version,
          timestamp: new Date().toISOString(),
          is_local: engineResult.source === 'local',
          is_mock: false,
        },
      },
    }
  } catch (error) {
    return {
      success: false,
      error: {
        code: 'ENGINE_ERROR',
        message: error instanceof Error ? error.message : 'Unknown engine error',
      },
    }
  }
}
