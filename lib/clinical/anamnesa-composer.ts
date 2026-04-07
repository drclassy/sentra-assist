import type {
  AnamnesaFillPayload,
  AnamnesisExtractionResult,
  AnamnesisMissingField,
} from '@/utils/types'

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

const SHADOW_SUGGESTION_TEMPLATES: Record<AnamnesisMissingField, string> = {
  keluhan_utama: 'Keluhan utama saat ini adalah ...',
  onset: 'Onset keluhan sejak ...',
  lokasi: 'Lokasi keluhan dirasakan pada area ...',
  kualitas: 'Keluhan dirasakan seperti (berdenyut/tertusuk/terbakar/tumpul).',
  keparahan: 'Skala keluhan saat ini (1-10): ...',
  faktor_pemicu: 'Keluhan memberat saat aktivitas: ...',
  faktor_peredam: 'Keluhan berkurang setelah: ...',
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

const RELATIVE_DURATION_PATTERNS: Array<{
  regex: RegExp
  label: string
  lamaSakit: AnamnesaFillPayload['lama_sakit']
}> = [
  { regex: /\bsejak kemarin\b/i, label: 'sejak kemarin', lamaSakit: { thn: 0, bln: 0, hr: 1 } },
  {
    regex: /\bsejak tadi (pagi|siang|sore|malam)\b/i,
    label: 'sejak hari ini',
    lamaSakit: { thn: 0, bln: 0, hr: 0 },
  },
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

function normalizeDurationTypos(value: string): string {
  return value
    .replace(/\b(\d+)\s*haru\b/gi, '$1 hari')
    .replace(/\b(\d+)\s*hri\b/gi, '$1 hari')
    .replace(/\b(\d+)\s*mingu\b/gi, '$1 minggu')
    .replace(/\b(\d+)\s*buln\b/gi, '$1 bulan')
}

function normalizeSymptomTypos(value: string): string {
  return value
    .replace(/\bnnyeri\b/gi, 'nyeri')
    .replace(/\bnyerii\b/gi, 'nyeri')
    .replace(/\bpusingg\b/gi, 'pusing')
    .replace(/\bsakitt\b/gi, 'sakit')
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

function buildFollowUpLine(missingFacts: string[]): string | null {
  if (missingFacts.length === 0) return null
  const uniqueFacts = Array.from(
    new Set(
      missingFacts.filter(
        (fact) => fact !== 'durasi belum disebutkan' && fact !== 'onset/durasi belum jelas'
      )
    )
  ).slice(0, 2)
  if (uniqueFacts.length === 0) return null
  return `Perlu pendalaman anamnesis: ${joinClinicalList(uniqueFacts)}.`
}

function formatVitalNumber(value: number | undefined, digits = 0): string {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return ''
  return digits > 0 ? value.toFixed(digits) : `${Math.round(value)}`
}

function buildVitalSignNarrative(vitals: ComposeAnamnesaInput['vitals']): {
  line: string | null
  payload: AnamnesaFillPayload['vital_signs'] | undefined
} {
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
  if (durationLabel)
    return `${toSentenceCase(symptomsLabel)} ${durationLabel.startsWith('sejak') ? durationLabel : `sejak ${durationLabel}`}`
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

function getSymptomImpact(symptoms: string[]): string | null {
  const text = symptoms.join(' ').toLowerCase()
  if (text.includes('pusing') || text.includes('lemas') || text.includes('sakit kepala') || text.includes('migrain')) {
    return 'yang berpotensi mengganggu kenyamanan dan aktivitas harian'
  }
  if (text.includes('sesak') || text.includes('nyeri dada') || text.includes('berdebar')) {
    return 'yang membatasi mobilitas fisik dan memerlukan observasi'
  }
  if (text.includes('mual') || text.includes('muntah') || text.includes('diare') || text.includes('mencret')) {
    return 'yang berdampak pada penurunan asupan nutrisi/cairan atau aktivitas harian'
  }
  if (text.includes('nyeri') || text.includes('sakit') || text.includes('ngilu')) {
    return 'yang menimbulkan rasa tidak nyaman dan dapat menghambat aktivitas rutin'
  }
  if (text.includes('demam') || text.includes('panas')) {
    return 'yang menyebabkan penurunan kondisi tubuh secara umum'
  }
  return null
}

export function composeAnamnesaDraft(input: ComposeAnamnesaInput): ComposedAnamnesaDraft {
  const normalizedSymptomText = normalizeSymptomTypos(
    normalizeDurationTypos(normalizeWhitespace(input.symptomText))
  )
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
  if (!duration.label) missingFacts.push('durasi belum disebutkan')
  const triggerHintPresent = /\b(memicu|memberat|membaik|berkurang|setelah|saat)\b/i.test(
    normalizedSymptomText
  )
  if (!triggerHintPresent) {
    missingFacts.push('faktor pencetus/peringan belum disebutkan')
  }

  const sentences: string[] = []

  // Sentences building for composeAnamnesaDraft
  const onsetStr = duration.label ? `sejak ${duration.label.toLowerCase()}` : 'tanpa keterangan durasi yang jelas'
  sentences.push(`Pasien datang dengan keluhan utama ${chiefComplaint.toLowerCase()} ${onsetStr}.`)

  const impact = getSymptomImpact(symptoms)
  if (impact) {
    sentences.push(`Kondisi ini dirasakan ${impact}.`)
  }

  if (symptoms.length > 1) {
    sentences.push(`Gejala penyerta meliputi ${joinClinicalList(symptoms)}.`)
  }

  const medicalHistory: string[] = []
  if (chronicDiseases.length > 0) medicalHistory.push(`penyakit kronis (${joinClinicalList(chronicDiseases)})`)
  if (specialConditions.length > 0) medicalHistory.push(`kondisi khusus (${joinClinicalList(specialConditions)})`)
  if (medicalHistory.length > 0) {
    sentences.push(`Riwayat medis pasien mencatat adanya ${medicalHistory.join(' serta ')}.`)
  }

  if (allergies.length > 0) {
    sentences.push(`Terdapat riwayat alergi terhadap ${joinClinicalList(allergies)}.`)
  }

  if (input.patientGender === 'P') {
    if (typeof input.pregnancyStatus === 'boolean') {
      sentences.push(`Pasien saat ini berstatus ${input.pregnancyStatus ? 'hamil' : 'tidak hamil'}.`)
    }
    if (input.pregnancyRisk) {
      sentences.push(`Risiko kehamilan: ${input.pregnancyRisk}.`)
    }
  }

  if (vitalSignContext.line) {
    // Replace "Tanda vital saat input:" with more natural phrasing
    const vitalClean = vitalSignContext.line.replace(/^Tanda vital saat input:\s*/i, 'Pemeriksaan tanda vital menunjukkan ')
    sentences.push(vitalClean + (vitalClean.endsWith('.') ? '' : '.'))
  }

  if (disabilityLine) sentences.push(disabilityLine)
  if (obesityLine) sentences.push(obesityLine)

  const presentIllness = sentences.join(' ')
  const riwayatPenyakit =
    chronicDiseases.length > 0 || specialConditions.length > 0
      ? {
          sekarang: presentIllness,
          dahulu: [
            chronicDiseases.length > 0
              ? `Riwayat penyakit kronis: ${joinClinicalList(chronicDiseases)}.`
              : '',
            specialConditions.length > 0
              ? `Penyakit khusus: ${joinClinicalList(specialConditions)}.`
              : '',
          ]
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

function createExtractionMissingFacts(
  extraction: AnamnesisExtractionResult,
  durationLabel: string
): string[] {
  const labels: Record<AnamnesisMissingField, string> = {
    keluhan_utama: 'keluhan utama belum spesifik',
    onset: 'onset/durasi belum jelas',
    lokasi: 'lokasi keluhan belum jelas',
    kualitas: 'karakteristik keluhan belum jelas',
    keparahan: 'skala keparahan belum disebutkan',
    faktor_pemicu: 'faktor pemicu belum disebutkan',
    faktor_peredam: 'faktor peredam belum disebutkan',
  }

  const result = extraction.data_belum_lengkap.map((key) => labels[key])
  if (!durationLabel && !result.includes(labels.onset)) {
    result.push(labels.onset)
  }

  return result
}

export function buildAnamnesisShadowSuggestion(missingFields: AnamnesisMissingField[]): string {
  if (missingFields.length === 0) return ''

  const uniqueMissing = missingFields.filter(
    (field, index) => missingFields.indexOf(field) === index
  )
  return uniqueMissing
    .slice(0, 2)
    .map((field) => SHADOW_SUGGESTION_TEMPLATES[field])
    .join(' ')
}

export function composeAnamnesaDraftFromExtraction(
  extraction: AnamnesisExtractionResult,
  input: ComposeAnamnesaInput
): ComposedAnamnesaDraft {
  const normalizedSymptomText = normalizeSymptomTypos(
    normalizeDurationTypos(normalizeWhitespace(input.symptomText))
  )
  const symptoms = splitSymptomPhrases(normalizedSymptomText)
  const duration = parseDuration(normalizedSymptomText)
  const chronicDiseases = (input.chronicDiseases || []).filter(Boolean)
  const allergies = (input.allergies || []).filter(Boolean)
  const specialConditions = (input.specialConditions || []).filter(Boolean)
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
  const sentences: string[] = []

  const durationStr = extraction.onset || duration.label
  const onsetStr = durationStr ? `sejak ${durationStr.toLowerCase()}` : 'tanpa keterangan durasi yang jelas'
  const utamaStr = (extraction.keluhan_utama || 'keluhan tidak spesifik').toLowerCase()
  sentences.push(`Pasien datang dengan keluhan utama ${utamaStr} ${onsetStr}.`)

  const impact = getSymptomImpact(symptoms)
  if (impact) {
    sentences.push(`Kondisi ini dirasakan ${impact}.`)
  }

  if (symptoms.length > 1) {
    sentences.push(`Gejala penyerta meliputi ${joinClinicalList(symptoms)}.`)
  }

  if (extraction.lokasi || extraction.kualitas || typeof extraction.keparahan === 'number') {
    const details = []
    if (extraction.lokasi) details.push(`di area ${extraction.lokasi.toLowerCase()}`)
    if (extraction.kualitas) details.push(`dengan karakteristik ${extraction.kualitas.toLowerCase()}`)
    if (typeof extraction.keparahan === 'number') details.push(`berskala nyeri ${Math.round(extraction.keparahan)}/10`)
    sentences.push(`Kondisi ini dirasakan ${details.join(', ')}.`)
  }

  if (extraction.faktor_pemicu.length > 0 || extraction.faktor_peredam.length > 0) {
    const factors = []
    if (extraction.faktor_pemicu.length > 0) factors.push(`diperberat oleh ${joinClinicalList(extraction.faktor_pemicu)}`)
    if (extraction.faktor_peredam.length > 0) factors.push(`dapat diringankan dengan ${joinClinicalList(extraction.faktor_peredam)}`)
    sentences.push(`Keluhan cenderung ${factors.join(' dan ')}.`)
  }

  const medicalHistory: string[] = []
  if (chronicDiseases.length > 0) medicalHistory.push(`penyakit kronis (${joinClinicalList(chronicDiseases)})`)
  if (specialConditions.length > 0) medicalHistory.push(`kondisi khusus (${joinClinicalList(specialConditions)})`)
  if (medicalHistory.length > 0) {
    sentences.push(`Riwayat medis mencatat adanya ${medicalHistory.join(' serta ')}.`)
  }

  if (allergies.length > 0) {
    sentences.push(`Pasien memiliki riwayat alergi terhadap ${joinClinicalList(allergies)}.`)
  }

  if (input.patientGender === 'P') {
    if (typeof input.pregnancyStatus === 'boolean') {
      sentences.push(`Pasien saat ini berstatus ${input.pregnancyStatus ? 'hamil' : 'tidak hamil'}.`)
    }
    if (input.pregnancyRisk) {
      sentences.push(`Risiko kehamilan terpantau: ${input.pregnancyRisk}.`)
    }
  }

  if (vitalSignContext.line) {
    const vitalClean = vitalSignContext.line.replace(/^Tanda vital saat input:\s*/i, 'Pemeriksaan tanda vital menunjukkan ')
    sentences.push(vitalClean + (vitalClean.endsWith('.') ? '' : '.'))
  }

  if (disabilityLine) sentences.push(disabilityLine)
  if (obesityLine) sentences.push(obesityLine)

  const presentIllness = sentences.join(' ')
  const extractionMissingFacts = createExtractionMissingFacts(extraction, duration.label)

  const riwayatPenyakit =
    chronicDiseases.length > 0 || specialConditions.length > 0
      ? {
          sekarang: presentIllness,
          dahulu: [
            chronicDiseases.length > 0
              ? `Riwayat penyakit kronis: ${joinClinicalList(chronicDiseases)}.`
              : '',
            specialConditions.length > 0
              ? `Penyakit khusus: ${joinClinicalList(specialConditions)}.`
              : '',
          ]
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
    chiefComplaint: toSentenceCase(extraction.keluhan_utama || 'Keluhan belum terdefinisi'),
    presentIllness,
    payload: {
      keluhan_utama: toSentenceCase(extraction.keluhan_utama || 'Keluhan belum terdefinisi'),
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
      missingFacts: extractionMissingFacts,
    },
  }
}
