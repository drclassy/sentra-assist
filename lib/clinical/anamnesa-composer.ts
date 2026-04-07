import type { AnamnesaFillPayload } from '@/utils/types'

export interface ComposeAnamnesaInput {
  symptomText: string
  patientGender: 'L' | 'P'
  chronicDiseases?: string[]
  allergies?: string[]
  pregnancyStatus?: boolean | null
  specialConditions?: string[]
  pregnancyRisk?: string
  vitals?: {
    sbp?: number
    dbp?: number
    hr?: number
    rr?: number
    temp?: number
    spo2?: number
    glucose?: number
  }
  disabilityType?: string
  obesityConfirmation?: 'confirmed' | 'not_confirmed' | ''
  autosenPresetLabel?: string
}

export interface ComposedAnamnesaDraft {
  chiefComplaint: string
  presentIllness: string
  payload: AnamnesaFillPayload
  metadata: {
    symptomPhrases: string[]
    durationLabel: string
    missingFacts: string[]
  }
}

interface DurationParseResult {
  label: string
  lamaSakit: AnamnesaFillPayload['lama_sakit']
}

const DURATION_PATTERNS: Array<{
  regex: RegExp
  toResult: (match: RegExpMatchArray) => DurationParseResult
}> = [
  {
    regex: /\b(\d+)\s*(hari|hr)\b/i,
    toResult: (match) => ({
      label: `${match[1]} hari`,
      lamaSakit: { thn: 0, bln: 0, hr: Number.parseInt(match[1], 10) || 0 },
    }),
  },
  {
    regex: /\b(\d+)\s*(minggu|mgg)\b/i,
    toResult: (match) => ({
      label: `${match[1]} minggu`,
      lamaSakit: { thn: 0, bln: 0, hr: (Number.parseInt(match[1], 10) || 0) * 7 },
    }),
  },
  {
    regex: /\b(\d+)\s*(bulan|bln)\b/i,
    toResult: (match) => ({
      label: `${match[1]} bulan`,
      lamaSakit: { thn: 0, bln: Number.parseInt(match[1], 10) || 0, hr: 0 },
    }),
  },
  {
    regex: /\b(\d+)\s*(tahun|thn)\b/i,
    toResult: (match) => ({
      label: `${match[1]} tahun`,
      lamaSakit: { thn: Number.parseInt(match[1], 10) || 0, bln: 0, hr: 0 },
    }),
  },
]

const RELATIVE_DURATION_PATTERNS: Array<{ regex: RegExp; label: string; lamaSakit: AnamnesaFillPayload['lama_sakit'] }> =
  [
    { regex: /\bsejak kemarin\b/i, label: 'sejak kemarin', lamaSakit: { thn: 0, bln: 0, hr: 1 } },
    { regex: /\bsejak tadi (pagi|siang|sore|malam)\b/i, label: 'sejak hari ini', lamaSakit: { thn: 0, bln: 0, hr: 0 } },
    { regex: /\bmendadak\b/i, label: 'onset mendadak', lamaSakit: { thn: 0, bln: 0, hr: 0 } },
  ]

const LEAD_IN_PATTERNS = [
  /\bpasien (mengeluh|datang dengan|mengalami)\b/gi,
  /\bkeluhan( utama)?\b/gi,
  /\bdisertai\b/gi,
  /\bsejak\b/gi,
]

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}

function parseDuration(text: string): DurationParseResult {
  const normalized = normalizeWhitespace(text.toLowerCase())

  for (const pattern of DURATION_PATTERNS) {
    const match = normalized.match(pattern.regex)
    if (match) return pattern.toResult(match)
  }

  for (const pattern of RELATIVE_DURATION_PATTERNS) {
    if (pattern.regex.test(normalized)) {
      return { label: pattern.label, lamaSakit: pattern.lamaSakit }
    }
  }

  return { label: '', lamaSakit: { thn: 0, bln: 0, hr: 0 } }
}

function stripDurationPhrase(value: string): string {
  let cleaned = value

  for (const pattern of DURATION_PATTERNS) {
    cleaned = cleaned.replace(pattern.regex, ' ')
  }

  for (const pattern of RELATIVE_DURATION_PATTERNS) {
    cleaned = cleaned.replace(pattern.regex, ' ')
  }

  return normalizeWhitespace(cleaned)
}

function cleanSymptomPhrase(value: string): string {
  let cleaned = normalizeWhitespace(value.toLowerCase())

  for (const pattern of LEAD_IN_PATTERNS) {
    cleaned = cleaned.replace(pattern, ' ')
  }

  cleaned = stripDurationPhrase(cleaned)
  cleaned = cleaned.replace(/^[,.\-:;]+|[,.\-:;]+$/g, '')

  return normalizeWhitespace(cleaned)
}

function splitSymptomPhrases(text: string): string[] {
  const normalized = normalizeWhitespace(text)
    .replace(/\n+/g, ', ')
    .replace(/[;|/]+/g, ', ')
    .replace(/\s+dan\s+/gi, ', ')

  const rawParts = normalized
    .split(',')
    .map((part) => cleanSymptomPhrase(part))
    .filter(Boolean)

  const uniqueParts: string[] = []
  for (const part of rawParts) {
    if (!uniqueParts.includes(part)) uniqueParts.push(part)
    if (uniqueParts.length >= 4) break
  }

  if (uniqueParts.length > 0) return uniqueParts

  const fallback = cleanSymptomPhrase(text)
  return fallback ? [fallback] : []
}

function toSentenceCase(value: string): string {
  if (!value) return value
  return value.charAt(0).toUpperCase() + value.slice(1)
}

function joinClinicalList(items: string[]): string {
  if (items.length === 0) return ''
  if (items.length === 1) return items[0]
  if (items.length === 2) return `${items[0]} dan ${items[1]}`
  return `${items.slice(0, -1).join(', ')}, dan ${items[items.length - 1]}`
}

function formatVitalNumber(value: number | undefined, digits = 0): string {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return ''
  return digits > 0 ? value.toFixed(digits) : `${Math.round(value)}`
}

function buildVitalSignNarrative(
  vitals: ComposeAnamnesaInput['vitals']
): { line: string | null; payload: AnamnesaFillPayload['vital_signs'] | undefined } {
  if (!vitals) {
    return { line: null, payload: undefined }
  }

  const tdSistolik = formatVitalNumber(vitals.sbp)
  const tdDiastolik = formatVitalNumber(vitals.dbp)
  const nadi = formatVitalNumber(vitals.hr)
  const rr = formatVitalNumber(vitals.rr)
  const suhu = formatVitalNumber(vitals.temp, 1)
  const spo2 = formatVitalNumber(vitals.spo2)
  const glucose = formatVitalNumber(vitals.glucose)

  const fragments = [
    tdSistolik && tdDiastolik ? `TD ${tdSistolik}/${tdDiastolik} mmHg` : '',
    nadi ? `nadi ${nadi} x/menit` : '',
    rr ? `RR ${rr} x/menit` : '',
    suhu ? `suhu ${suhu} C` : '',
    spo2 ? `SpO2 ${spo2}%` : '',
    glucose ? `gula darah ${glucose} mg/dL` : '',
  ].filter(Boolean)

  const payload =
    tdSistolik || tdDiastolik || nadi || rr || suhu || glucose
      ? {
          tekanan_darah_sistolik: Number(tdSistolik || 0),
          tekanan_darah_diastolik: Number(tdDiastolik || 0),
          nadi: Number(nadi || 0),
          respirasi: Number(rr || 0),
          suhu: Number(suhu || 0),
          ...(glucose ? { gula_darah: Number(glucose) } : {}),
          kesadaran: 'COMPOS MENTIS' as const,
        }
      : undefined

  return {
    line: fragments.length > 0 ? `Tanda vital saat input: ${fragments.join(', ')}.` : null,
    payload,
  }
}

function buildChiefComplaint(symptoms: string[], durationLabel: string): string {
  const symptomsLabel = joinClinicalList(symptoms) || 'keluhan belum terdefinisi'
  if (durationLabel) return `${toSentenceCase(symptomsLabel)} ${durationLabel.startsWith('sejak') ? durationLabel : `sejak ${durationLabel}`}`
  return toSentenceCase(symptomsLabel)
}

function normalizeAllergies(allergies: string[]): AnamnesaFillPayload['alergi'] {
  const result: AnamnesaFillPayload['alergi'] = {
    obat: [],
    makanan: [],
    udara: [],
    lainnya: [],
  }

  for (const allergy of allergies) {
    const normalized = allergy.toLowerCase().trim()
    if (!normalized) continue

    if (normalized.includes('obat')) {
      result.obat.push('Alergi obat dilaporkan')
      continue
    }

    if (normalized.includes('makanan')) {
      result.makanan.push('Alergi makanan dilaporkan')
      continue
    }

    if (normalized.includes('debu')) {
      result.udara.push('Alergi debu dilaporkan')
      continue
    }

    result.lainnya.push(toSentenceCase(normalized))
  }

  return result
}

export function composeAnamnesaDraft(input: ComposeAnamnesaInput): ComposedAnamnesaDraft {
  const normalizedSymptomText = normalizeWhitespace(input.symptomText)
  const symptoms = splitSymptomPhrases(normalizedSymptomText)
  const duration = parseDuration(normalizedSymptomText)
  const chiefComplaint = buildChiefComplaint(symptoms, duration.label)
  const chronicDiseases = (input.chronicDiseases || []).filter(Boolean)
  const allergies = (input.allergies || []).filter(Boolean)
  const specialConditions = (input.specialConditions || []).filter(Boolean)
  const missingFacts: string[] = []
  const vitalSignContext = buildVitalSignNarrative(input.vitals)
  const disabilityLine = input.disabilityType
    ? `Konteks disabilitas yang dicatat pada form: ${input.disabilityType}.`
    : null
  const obesityLine =
    input.obesityConfirmation === 'confirmed'
      ? 'Status obesitas pada form: terkonfirmasi.'
      : input.obesityConfirmation === 'not_confirmed'
        ? 'Status obesitas pada form: tidak terkonfirmasi.'
        : null
  const presetLine = input.autosenPresetLabel
    ? `Preset aktif AutoComplete+: ${input.autosenPresetLabel}.`
    : null

  if (!duration.label) missingFacts.push('durasi belum disebutkan')
  missingFacts.push('faktor pencetus/peringan belum disebutkan')
  missingFacts.push('dampak aktivitas belum terkonfirmasi')

  const presentIllnessLines = [
    `Pasien datang dengan keluhan ${chiefComplaint.toLowerCase()}.`,
    symptoms.length > 1
      ? `Gejala yang disebutkan pada input singkat meliputi ${joinClinicalList(symptoms)}.`
      : `Keluhan dominan yang disebutkan adalah ${joinClinicalList(symptoms) || 'keluhan belum terdefinisi'}.`,
    duration.label ? `Durasi keluhan ${duration.label}.` : 'Durasi keluhan belum disebutkan pada input awal.',
    chronicDiseases.length > 0
      ? `Riwayat penyakit kronis yang relevan: ${joinClinicalList(chronicDiseases)}.`
      : 'Riwayat penyakit kronis relevan belum teridentifikasi dari input aktif.',
    allergies.length > 0
      ? `Riwayat alergi yang dilaporkan: ${joinClinicalList(allergies)}.`
      : 'Riwayat alergi belum dilaporkan pada input ini.',
    input.patientGender === 'P'
      ? typeof input.pregnancyStatus === 'boolean'
        ? `Status kehamilan saat ini: ${input.pregnancyStatus ? 'hamil' : 'tidak hamil'}.`
        : 'Status kehamilan belum terkonfirmasi.'
      : null,
    input.patientGender === 'P' && input.pregnancyRisk
      ? `Risiko kehamilan pada RME: ${input.pregnancyRisk}.`
      : null,
    specialConditions.length > 0
      ? `Penyakit khusus pada RME: ${joinClinicalList(specialConditions)}.`
      : null,
    vitalSignContext.line,
    disabilityLine,
    obesityLine,
    presetLine,
    'Faktor pencetus/peringan, kualitas keluhan, dan dampak aktivitas belum disebutkan dalam input singkat sehingga perlu konfirmasi anamnesis lanjutan.',
  ].filter(Boolean) as string[]

  const presentIllness = presentIllnessLines.join(' ')
  const riwayatPenyakit =
    chronicDiseases.length > 0 || specialConditions.length > 0
      ? {
          sekarang: presentIllness,
          dahulu: [chronicDiseases.length > 0 ? `Riwayat penyakit kronis: ${joinClinicalList(chronicDiseases)}.` : '', specialConditions.length > 0 ? `Penyakit khusus: ${joinClinicalList(specialConditions)}.` : '']
            .filter(Boolean)
            .join(' '),
          keluarga: '',
        }
      : {
          sekarang: presentIllness,
          dahulu: '',
          keluarga: '',
        }

  return {
    chiefComplaint,
    presentIllness,
    payload: {
      keluhan_utama: chiefComplaint,
      keluhan_tambahan: presentIllness,
      lama_sakit: duration.lamaSakit,
      ...(input.patientGender === 'P' && typeof input.pregnancyStatus === 'boolean'
        ? { is_pregnant: input.pregnancyStatus }
        : {}),
      riwayat_penyakit: riwayatPenyakit,
      alergi: normalizeAllergies(allergies),
      ...(vitalSignContext.payload ? { vital_signs: vitalSignContext.payload } : {}),
    },
    metadata: {
      symptomPhrases: symptoms,
      durationLabel: duration.label,
      missingFacts,
    },
  }
}
