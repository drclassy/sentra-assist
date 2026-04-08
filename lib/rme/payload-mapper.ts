// Designed and constructed by Claudesy.

import { DOKTER_NAMA, PERAWAT_NAMA } from '@/lib/constants/tenaga-medis'
import { classifyChronicDisease } from '@/lib/iskandar-diagnosis-engine/chronic-disease-classifier'
import type { TrajectoryAnalysis } from '@/lib/iskandar-diagnosis-engine/trajectory-analyzer'
import stockDatabase from '@/public/data/stok_obat.json'
import type { MedicationRecommendation } from '@/types/api'
import type {
  AnamnesaFillPayload,
  AturanPakai,
  DiagnosaFillPayload,
  ResepFillPayload,
  RMETransferPayload,
  RMETransferReasonCode,
} from '@/utils/types'
import { mapTrajectoryToPrognosis } from './prognosis-mapper'

type TriadRole = 'utama' | 'adjuvant' | 'vitamin'

/**
 * RMETransferMapperInput interface
 *
 * @remarks
 * TODO: Add type description and property documentation
 * Auto-generated on 2026-03-12
 */

export interface RMETransferMapperInput {
  keluhanUtama: string
  keluhanTambahan?: string
  patientGender: 'L' | 'P'
  pregnancyStatus?: boolean | null
  allergies?: string[]
  vitalSigns?: {
    sbp?: number
    dbp?: number
    hr?: number
    rr?: number
    temp?: number
    glucose?: number
  }
  diagnosis?: Partial<DiagnosaFillPayload> | null
  medications?: MedicationRecommendation[]
  tenagaMedis?: {
    dokterNama?: string
    perawatNama?: string
    ruangan?: string
  }
  trajectory?: TrajectoryAnalysis
  hasVisitHistory?: boolean
  // Extended state from TTV form
  spo2?: number
  avpu?: 'A' | 'C' | 'V' | 'P' | 'U'
  painScore?: number
  disabilityType?: string
  obesityConfirmation?: boolean
  // Pre-built anamnesa from anamnesa-composer (overrides lama_sakit + riwayat_penyakit)
  anamnesaDraftPayload?: Pick<AnamnesaFillPayload, 'lama_sakit' | 'riwayat_penyakit'>
}

/**
 * PregnancyMappingResult interface
 *
 * @remarks
 * TODO: Add type description and property documentation
 * Auto-generated on 2026-03-12
 */

export interface PregnancyMappingResult {
  is_pregnant: boolean
  reasonCode?: RMETransferReasonCode
}

const VITAMIN_KEYWORDS = ['vitamin', 'ascorb', 'multivit', 'b complex', 'zinc']
const ADJUVANT_KEYWORDS = [
  'paracetamol',
  'parasetamol',
  'acetaminophen',
  'cetirizine',
  'cetirizin',
  'ctm',
  'domperidone',
  'ambroxol',
  'oralit',
  'omeprazole',
  'attapulgite',
]

const ATURAN_PAKAI_MAP: Record<string, AturanPakai> = {
  'sebelum makan': '1',
  'sesudah makan': '2',
  'pemakaian luar': '3',
  'jika diperlukan': '4',
  'saat makan': '5',
}

const MEDICATION_NAME_SYNONYMS: Record<string, string> = {
  amoxicillin: 'amoksisilin',
  amoksisilin: 'amoksisilin',
  ampicillin: 'ampisilin',
  ampisilin: 'ampisilin',
  acyclovir: 'asiklovir',
  aciclovir: 'asiklovir',
  asiklovir: 'asiklovir',
  azithromycin: 'azitromisin',
  azitromisin: 'azitromisin',
  paracetamol: 'parasetamol',
  parasetamol: 'parasetamol',
  acetaminophen: 'parasetamol',
  asetaminofen: 'parasetamol',
  'acetylsalicylic acid': 'asam asetilsalisilat',
  aspirin: 'asam asetilsalisilat',
  'asam asetilsalisilat': 'asam asetilsalisilat',
  diclofenac: 'diklofenak',
  diklofenak: 'diklofenak',
  'mefenamic acid': 'asam mefenamat',
  'asam mefenamat': 'asam mefenamat',
  naproxen: 'naproksen',
  naproksen: 'naproksen',
  betamethasone: 'betametason',
  betametason: 'betametason',
  dexamethasone: 'deksametason',
  deksametason: 'deksametason',
  hydrocortisone: 'hidrokortison',
  hidrokortison: 'hidrokortison',
  mometasone: 'mometason',
  mometason: 'mometason',
  prednisone: 'prednison',
  prednison: 'prednison',
  triamcinolone: 'triamsinolon',
  triamsinolon: 'triamsinolon',
  amlodipine: 'amlodipin',
  amlodipin: 'amlodipin',
  bisacodyl: 'bisakodil',
  bisakodil: 'bisakodil',
  cetirizine: 'setirizin',
  cetirizin: 'setirizin',
  setirizin: 'setirizin',
  captopril: 'kaptopril',
  kaptopril: 'kaptopril',
  chloramphenicol: 'kloramfenikol',
  kloramfenikol: 'kloramfenikol',
  clindamycin: 'klindamisin',
  klindamisin: 'klindamisin',
  cefadroxil: 'sefadroksil',
  sefadroksil: 'sefadroksil',
  cefixime: 'sefiksim',
  sefiksim: 'sefiksim',
  ceftriaxone: 'seftriakson',
  seftriakson: 'seftriakson',
  ciprofloxacin: 'siprofloksasin',
  siprofloksasin: 'siprofloksasin',
  erythromycin: 'eritromisin',
  eritromisin: 'eritromisin',
  gentamicin: 'gentamisin',
  gentamisin: 'gentamisin',
  nystatin: 'nistatin',
  nistatin: 'nistatin',
  oxytetracycline: 'oksitetrasiklin',
  oksitetrasiklin: 'oksitetrasiklin',
  rifampicin: 'rifampisin',
  rifampisin: 'rifampisin',
  chlorpheniramine: 'klorfeniramin',
  klorfeniramin: 'klorfeniramin',
  ctm: 'klorfeniramin',
  'folic acid': 'asam folat',
  'asam folat': 'asam folat',
  hydrochlorothiazide: 'hidroklorotiazid',
  hidroklorotiazid: 'hidroklorotiazid',
  methylprednisolone: 'metilprednisolon',
  metilprednisolon: 'metilprednisolon',
  theophylline: 'teofilin',
  teofilin: 'teofilin',
  tramadol: 'tramadol',
  'vitamin c': 'asam askorbat',
  'asam askorbat': 'asam askorbat',
}

const DEFAULT_RESEP_DURATION_DAYS = 3
const QUANTITY_ROUNDING_STEP = 10
const MAX_RESEP_QUANTITY = 1000
const DEFAULT_RESEP_NOTE = 'Review klinis sebelum finalisasi resep.'
const MIN_STOCK_MATCH_SCORE = 45
const STOCK_CANDIDATE_LIMIT = 5

interface StockDrugItem {
  nama_obat: string
  status?: string
  stok_tersedia?: number
}

interface StockDatabaseShape {
  stok_obat?: StockDrugItem[]
}

const STOCK_ITEMS: StockDrugItem[] = Array.isArray((stockDatabase as StockDatabaseShape).stok_obat)
  ? ((stockDatabase as StockDatabaseShape).stok_obat as StockDrugItem[])
  : []

const AVAILABLE_STOCK_ITEMS: StockDrugItem[] = STOCK_ITEMS.filter(item => {
  const status = normalizeText(item.status || 'tersedia')
  const stok = Number(item.stok_tersedia ?? 0)
  return status === 'tersedia' && stok > 0
})

const LIQUID_FORM_KEYWORDS = [
  'sirup',
  'syrup',
  'suspensi',
  'suspension',
  'drop',
  'elixir',
  'solution',
  'ml',
]
const SOLID_FORM_KEYWORDS = ['tablet', 'tab', 'kaplet', 'kapsul', 'capsule', 'caplet']
type MedicationFormPreference = 'solid' | 'liquid' | 'unknown'

function normalizeText(value: string): string {
  return value.toLowerCase().replace(/\s+/g, ' ').trim()
}

function foldMedicationOrthography(value: string): string {
  return value
    .replace(/\bph/g, 'f')
    .replace(/x/g, 'ks')
    .replace(/y/g, 'i')
    .replace(/\bc(?=[eiy])/g, 's')
    .replace(/\bc(?=[aouklnrt])/g, 'k')
    .replace(/\b([a-z]{4,})e\b/g, '$1')
    .replace(/\s+/g, ' ')
    .trim()
}

function normalizeMedicationLookup(value: string): string {
  const normalized = normalizeText(value)
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  let rewritten = normalized
  for (const [alias, canonical] of Object.entries(MEDICATION_NAME_SYNONYMS)) {
    rewritten = rewritten.replace(new RegExp(`\\b${alias}\\b`, 'g'), canonical)
  }

  return foldMedicationOrthography(rewritten.replace(/\bamlodipine\b/g, 'amlodipin'))
}

function getLookupTokens(value: string): string[] {
  const stopwords = new Set([
    'tablet',
    'kapsul',
    'kaplet',
    'sirup',
    'syrup',
    'mg',
    'ml',
    'asam',
    'hcl',
    'hydrochloride',
    'blud',
    'doen',
  ])
  return normalizeMedicationLookup(value)
    .split(' ')
    .filter(token => token.length > 2)
    .filter(token => !/^\d+$/.test(token))
    .filter(token => !/^\d+(mg|ml|mcg|g|gr|iu)$/i.test(token))
    .filter(token => !stopwords.has(token))
}

function extractDoseValues(value: string, unit: 'mg' | 'ml'): number[] {
  const normalized = normalizeMedicationLookup(value)
  const pattern = unit === 'mg' ? /(\d+(?:\.\d+)?)\s*mg\b/g : /(\d+(?:\.\d+)?)\s*ml\b/g
  const values: number[] = []
  for (const match of normalized.matchAll(pattern)) {
    const parsed = Number(match[1])
    if (Number.isFinite(parsed) && parsed > 0) values.push(parsed)
  }
  return values
}

function hasAnyKeyword(text: string, keywords: string[]): boolean {
  return keywords.some(keyword => text.includes(keyword))
}

function wantsLiquidForm(value: string): boolean {
  const normalized = normalizeMedicationLookup(value)
  if (hasAnyKeyword(normalized, LIQUID_FORM_KEYWORDS)) return true
  return /\bmg\s*\/\s*\d+\s*ml\b/.test(normalized)
}

function wantsSolidForm(value: string): boolean {
  const normalized = normalizeMedicationLookup(value)
  if (hasAnyKeyword(normalized, SOLID_FORM_KEYWORDS)) return true
  if (wantsLiquidForm(value)) return false
  const mgValues = extractDoseValues(value, 'mg')
  const mlValues = extractDoseValues(value, 'ml')
  return mgValues.length > 0 && mlValues.length === 0
}

function getMedicationFormPreference(value: string): MedicationFormPreference {
  if (wantsLiquidForm(value)) return 'liquid'
  if (wantsSolidForm(value)) return 'solid'
  return 'unknown'
}

function scoreDoseAlignment(input: string, candidate: string): number {
  const inputMg = extractDoseValues(input, 'mg')
  const candidateMg = extractDoseValues(candidate, 'mg')
  if (inputMg.length > 0 && candidateMg.length > 0) {
    const hasExact = inputMg.some(expected =>
      candidateMg.some(actual => Math.abs(actual - expected) < 0.5)
    )
    return hasExact ? 26 : -16
  }

  const inputMl = extractDoseValues(input, 'ml')
  const candidateMl = extractDoseValues(candidate, 'ml')
  if (inputMl.length > 0 && candidateMl.length > 0) {
    const hasExact = inputMl.some(expected =>
      candidateMl.some(actual => Math.abs(actual - expected) < 0.5)
    )
    return hasExact ? 18 : -10
  }

  return 0
}

function scoreMedicationCandidate(input: string, candidate: string): number {
  const normalizedInput = normalizeMedicationLookup(input)
  const normalizedCandidate = normalizeMedicationLookup(candidate)
  if (!normalizedInput || !normalizedCandidate) return -999

  let score = 0

  if (normalizedCandidate === normalizedInput) score += 120
  else if (
    normalizedCandidate.includes(normalizedInput) ||
    normalizedInput.includes(normalizedCandidate)
  )
    score += 80

  const inputTokens = getLookupTokens(input)
  const candidateTokens = getLookupTokens(candidate)
  if (inputTokens.length > 0 && candidateTokens.length > 0) {
    const overlap = inputTokens.filter(token => candidateTokens.includes(token)).length
    score += (overlap / inputTokens.length) * 70
    if (overlap === 0) score -= 35
  }

  const inputForm = getMedicationFormPreference(input)
  const candidateForm = getMedicationFormPreference(candidate)
  if (inputForm === 'solid' && candidateForm === 'unknown') score -= 45
  if (inputForm === 'solid' && candidateForm === 'liquid') score -= 80
  if (inputForm === 'liquid' && candidateForm === 'solid') score -= 45
  if (inputForm !== 'unknown' && inputForm === candidateForm) score += 45

  const inputMg = extractDoseValues(input, 'mg')
  if (inputMg.some(dose => dose >= 250) && candidateForm === 'liquid') {
    // Avoid syrup mis-picks for common adult tablet strengths.
    score -= 35
  }
  const candidateMg = extractDoseValues(candidate, 'mg')
  if (inputMg.length > 0 && candidateMg.length === 0 && candidateForm === 'unknown') {
    score -= 25
  }

  score += scoreDoseAlignment(input, candidate)

  return score
}

function resolveMedicationCandidatesFromStock(
  rawName: string,
  limit = STOCK_CANDIDATE_LIMIT
): string[] {
  const input = rawName.trim()
  if (!input) return []
  if (AVAILABLE_STOCK_ITEMS.length === 0) return []

  const scoredCandidates: Array<{ name: string; score: number }> = []
  for (const item of AVAILABLE_STOCK_ITEMS) {
    const candidate = item.nama_obat?.trim()
    if (!candidate) continue
    const score = scoreMedicationCandidate(input, candidate)
    scoredCandidates.push({ name: candidate, score })
  }

  return scoredCandidates
    .sort((a, b) => b.score - a.score)
    .filter(item => item.score >= MIN_STOCK_MATCH_SCORE)
    .map(item => item.name)
    .filter((name, index, arr) => arr.indexOf(name) === index)
    .slice(0, limit)
}

function resolveMedicationNameFromStock(rawName: string): string {
  const candidates = resolveMedicationCandidatesFromStock(rawName, 1)
  if (candidates.length > 0) return candidates[0]

  // Safety-first: if confident stock match is unavailable, keep original name.
  return rawName
}

function classifyRole(medicationName: string): TriadRole {
  const name = normalizeText(medicationName)
  if (VITAMIN_KEYWORDS.some(keyword => name.includes(keyword))) return 'vitamin'
  if (ADJUVANT_KEYWORDS.some(keyword => name.includes(keyword))) return 'adjuvant'
  return 'utama'
}

function mapAturanPakai(value: string): AturanPakai {
  const normalized = normalizeText(value)
  return ATURAN_PAKAI_MAP[normalized] || '2'
}

function estimateQuantity(dosis: string, durasi?: string): number {
  const doseMatch = dosis.match(/(\d+)\s*x\s*(\d+)?/i)
  const timesPerDay = doseMatch ? Math.max(1, Number(doseMatch[1])) : 2
  const unitPerDose = doseMatch?.[2] ? Math.max(1, Number(doseMatch[2])) : 1

  const durationMatch = (durasi || '').match(/(\d+)/i)
  const mappedDays = durationMatch
    ? Math.max(1, Number(durationMatch[1]))
    : DEFAULT_RESEP_DURATION_DAYS
  const days = Math.min(DEFAULT_RESEP_DURATION_DAYS, mappedDays)

  const estimated = timesPerDay * unitPerDose * days
  const rounded =
    Math.ceil(Math.max(1, estimated) / QUANTITY_ROUNDING_STEP) * QUANTITY_ROUNDING_STEP
  return Math.min(MAX_RESEP_QUANTITY, Math.max(QUANTITY_ROUNDING_STEP, rounded))
}

function normalizeSignaValue(rawDosis: string | undefined): string {
  const text = (rawDosis || '').trim()
  if (!text) return '1x1'
  const compact = text.replace(/\s+/g, '').replace(/[xX×]/g, 'x')
  const match = compact.match(/(\d+)\s*x\s*(\d+)/i)
  if (match) {
    const left = Math.max(1, Number(match[1]))
    const right = Math.max(1, Number(match[2]))
    return `${left}x${right}`
  }
  return compact.includes('x') ? compact : '1x1'
}

function resolveMedicationNote(rationale: string | undefined, aturanPakai: string): string {
  const normalized = (rationale || '').trim()
  if (normalized) return normalized
  const signa = (aturanPakai || '').trim() || 'sesuai anjuran'
  return `Aturan minum ${signa}. ${DEFAULT_RESEP_NOTE}`
}

function normalizeAllergies(allergies: string[]): AnamnesaFillPayload['alergi'] {
  const result: AnamnesaFillPayload['alergi'] = {
    obat: [],
    makanan: [],
    udara: [],
    lainnya: [],
  }

  for (const rawItem of allergies) {
    const item = rawItem.trim()
    if (!item || item.toLowerCase() === 'tidak ada') continue

    if (item.toLowerCase() === 'obat') {
      result.obat.push('Alergi obat (dilaporkan)')
      continue
    }
    if (item.toLowerCase() === 'makanan') {
      result.makanan.push('Alergi makanan (dilaporkan)')
      continue
    }
    if (item.toLowerCase().includes('debu') || item.toLowerCase().includes('udara')) {
      result.udara.push(item)
      continue
    }
    result.lainnya.push(item)
  }

  return result
}

/**
 * mapPregnancyStatusToBoolean
 *
 * @remarks
 * TODO: Add detailed description, parameters, and examples
 * Auto-generated on 2026-03-12
 */

export function mapPregnancyStatusToBoolean(
  patientGender: 'L' | 'P',
  pregnancyStatus?: boolean | null
): PregnancyMappingResult {
  if (patientGender === 'L') {
    return { is_pregnant: false }
  }
  if (typeof pregnancyStatus === 'boolean') {
    return { is_pregnant: pregnancyStatus }
  }
  return {
    is_pregnant: false,
    reasonCode: 'PREGNANCY_UNKNOWN_DEFAULT_FALSE',
  }
}

// ============================================================================
// ANAMNESA EXTENDED — compute additional sections from TTV state
// ============================================================================

type AvpuValue = 'A' | 'C' | 'V' | 'P' | 'U'
type KesadaranValue = 'COMPOS MENTIS' | 'SOMNOLEN' | 'SOPOR' | 'COMA'

const AVPU_GCS_MAP: Record<AvpuValue, {
  mata: '4' | '3' | '2' | '1'
  verbal: '5' | '4' | '3' | '2' | '1'
  motorik: '6' | '5' | '4' | '3' | '2' | '1'
}> = {
  A: { mata: '4', verbal: '5', motorik: '6' },
  C: { mata: '4', verbal: '4', motorik: '6' },
  V: { mata: '3', verbal: '3', motorik: '5' },
  P: { mata: '2', verbal: '2', motorik: '4' },
  U: { mata: '1', verbal: '1', motorik: '1' },
}

const AVPU_KESADARAN_MAP: Record<AvpuValue, KesadaranValue> = {
  A: 'COMPOS MENTIS',
  C: 'SOMNOLEN',
  V: 'SOMNOLEN',
  P: 'SOPOR',
  U: 'COMA',
}

function buildPeriksaFisikExtended(
  avpu: AvpuValue,
  spo2: number,
  disabilityType: string | undefined,
  obesityConfirmation?: boolean
): AnamnesaFillPayload['periksa_fisik'] {
  const gcs = AVPU_GCS_MAP[avpu]
  const adl: '0' | '1' | '2' = disabilityType ? '1' : '0'
  // IMT: use obesity-confirmed value (30.5) or default normal (22.0)
  // Handler skips falsy (0), so we always provide a non-zero estimate
  const imt = obesityConfirmation ? 30.5 : 22.0
  const hasil_imt = obesityConfirmation ? 'Obesitas I' : 'Normal'
  return {
    gcs_membuka_mata: gcs.mata,
    gcs_respon_verbal: gcs.verbal,
    gcs_respon_motorik: gcs.motorik,
    tinggi: 0,         // not captured — handler skips falsy
    berat: 0,
    lingkar_perut: 0,
    imt,
    hasil_imt,
    saturasi: spo2,
    mobilisasi: adl,
    toileting: adl,
    makan_minum: adl,
    mandi: adl,
    berpakaian: adl,
    aktifitas_fisik: disabilityType
      ? `Keterbatasan fisik: ${disabilityType}`
      : 'Pasien dapat beraktivitas secara mandiri',
  }
}

function buildLainnyaFromMedications(
  medications: MedicationRecommendation[],
  keluhanUtama: string,
  diagnosisNama?: string
): AnamnesaFillPayload['lainnya'] {
  const terapiObat =
    medications.length > 0
      ? medications.map((m) => `${m.nama_obat} ${m.dosis}`).join(', ')
      : 'Sesuai advis dokter'

  const dxLabel = diagnosisNama || 'kondisi pasien'
  const edukasi = [
    `Edukasi mengenai ${dxLabel} telah diberikan kepada pasien dan keluarga.`,
    'Anjurkan istirahat cukup dan minum air putih minimal 2 liter per hari.',
    'Kontrol kembali jika keluhan tidak membaik dalam 3 hari atau timbul gejala baru yang mengkhawatirkan.',
    'Minum obat sesuai anjuran dokter dan jangan berhenti tanpa konsultasi.',
  ].join(' ')

  const keluhan = keluhanUtama.toLowerCase()
  const askep = buildAskep(keluhan, dxLabel)
  const tindakanKeperawatan = buildTindakanKeperawatan(keluhan)

  return {
    terapi: terapiObat,
    terapi_non_obat: 'Istirahat cukup, minum air putih 2 liter/hari, diet sesuai anjuran dokter',
    bmhp: 'Kassa steril, plester, dan sarung tangan bersih.',
    merokok: '0',
    konsumsi_alkohol: '0',
    kurang_sayur_buah: '0',
    edukasi,
    askep,
    observasi: 'Pantau tanda vital per 4-6 jam. Monitor respons terapi. Perhatikan perubahan kondisi klinis seperti penurunan kesadaran, nyeri memberat, atau gejala baru.',
    keterangan: 'Pasien kooperatif, edukasi telah diberikan dan dipahami.',
    biopsikososial: `Pasien dalam kondisi stabil secara biologis. Ekspresi dan emosi pasien tampak cemas terkait kondisinya, namun dukungan keluarga baik. Kondisi sosial ekonomi cukup untuk mendukung proses penyembuhan terkait ${dxLabel}.`,
    tindakan_keperawatan: tindakanKeperawatan,
  }
}

function buildAskep(keluhan: string, dxLabel: string): string {
  const lines: string[] = [`Asuhan keperawatan pada pasien dengan ${dxLabel}.`]
  if (/batuk|sesak|nafas|pilek/.test(keluhan)) {
    lines.push('Gangguan pola napas: observasi frekuensi dan kedalaman napas, posisikan semi-fowler.')
  }
  if (/nyeri|sakit/.test(keluhan)) {
    lines.push('Nyeri akut: kaji skala nyeri, berikan posisi nyaman, kolaborasi analgetik sesuai advis.')
  }
  if (/mual|muntah|diare|perut/.test(keluhan)) {
    lines.push('Gangguan keseimbangan cairan: monitor intake-output, anjurkan cairan oral adekuat.')
  }
  if (/demam|panas/.test(keluhan)) {
    lines.push('Hipertermia: monitor suhu tubuh tiap 4 jam, kompres hangat, hidrasi adekuat.')
  }
  lines.push('Defisit pengetahuan: berikan edukasi tentang penyakit, pengobatan, dan pencegahan kambuh.')
  return lines.join(' ')
}

function buildTindakanKeperawatan(keluhan: string): string {
  const tindakan = [
    'Mengukur dan mendokumentasikan tanda-tanda vital.',
    'Melakukan anamnesis dan pengkajian fisik.',
  ]
  if (/batuk|sesak|nafas/.test(keluhan)) {
    tindakan.push('Memposisikan pasien semi-fowler untuk memaksimalkan ekspansi paru.')
  }
  if (/demam|panas/.test(keluhan)) {
    tindakan.push('Memberikan kompres hangat dan memantau suhu tubuh.')
  }
  if (/mual|muntah|diare/.test(keluhan)) {
    tindakan.push('Memantau keseimbangan cairan dan elektrolit.')
  }
  tindakan.push('Memberikan edukasi kepada pasien dan keluarga.')
  tindakan.push('Mendokumentasikan seluruh tindakan keperawatan.')
  return tindakan.join(' ')
}

/** Derive nyeri detail fields from keluhan text */
function buildNyeriDetails(keluhan: string): { lokasi: string; kualitas: string; pencetus: string } {
  const k = keluhan.toLowerCase()
  let lokasi = 'Tidak spesifik'
  if (/kepala|pusing|migrain/.test(k)) lokasi = 'Kepala'
  if (/perut|abdomen|mulas|ulu hati/.test(k)) lokasi = 'Abdomen'
  if (/dada/.test(k)) lokasi = 'Dada'
  if (/gigi|gusi/.test(k)) lokasi = 'Gigi/Mulut'
  if (/kaki|betis|lutut|tungkai|paha|pergelangan kaki/.test(k)) lokasi = 'Kaki/Ekstremitas Bawah'
  if (/tangan|lengan|siku|pergelangan tangan|jari/.test(k)) lokasi = 'Tangan/Ekstremitas Atas'
  if (/punggung|pinggang/.test(k)) lokasi = 'Punggung/Pinggang'
  if (/leher/.test(k)) lokasi = 'Leher'
  return {
    lokasi,
    kualitas: 'Nyeri tumpul seperti ditekan',
    pencetus: 'Diperberat oleh aktivitas, membaik dengan istirahat',
  }
}

// Symptom → organ system mapping for keadaan_fisik
const SYMPTOM_ORGAN_MAP: Array<{
  keywords: RegExp
  organs: (keyof NonNullable<AnamnesaFillPayload['keadaan_fisik']>)[]
}> = [
  { keywords: /batuk|sesak|nafas|dada|paru|ronkhi|wheezing/, organs: ['dada_punggung', 'kardiovaskuler'] },
  { keywords: /pilek|hidung|ingus|bersin|sinus/, organs: ['hidung_sinus'] },
  { keywords: /tenggorok|telan|suara|tonsil|amandel|faring/, organs: ['mulut_bibir', 'leher'] },
  { keywords: /perut|mual|muntah|diare|nyeri perut|kembung|konstipasi|mulas|disentri/, organs: ['abdomen_perut'] },
  { keywords: /mata|penglihatan|kabur|merah|konjungtiva/, organs: ['mata'] },
  { keywords: /telinga|pendengaran|tuli|tinnitus/, organs: ['telinga'] },
  { keywords: /kepala|pusing|vertigo|migren|sakit kepala/, organs: ['kepala'] },
  { keywords: /kulit|gatal|ruam|bintik|eksim|dermatitis/, organs: ['kulit'] },
  { keywords: /nyeri dada|jantung|berdebar/, organs: ['kardiovaskuler'] },
  { keywords: /kaki|betis|lutut|pergelangan kaki|tungkai/, organs: ['ekstremitas_bawah'] },
  { keywords: /tangan|lengan|siku|pergelangan tangan|jari/, organs: ['ekstremitas_atas'] },
  { keywords: /leher|benjolan leher|tiroid/, organs: ['leher'] },
]

const ORGAN_NORMAL_FINDINGS: Record<
  keyof NonNullable<AnamnesaFillPayload['keadaan_fisik']>,
  NonNullable<AnamnesaFillPayload['keadaan_fisik']>[keyof NonNullable<AnamnesaFillPayload['keadaan_fisik']>]
> = {
  kepala: { inspeksi: 'Normocephal, tidak ada deformitas', palpasi: 'Tidak teraba massa, tidak ada nyeri tekan' },
  wajah: { inspeksi: 'Simetris, tidak pucat, tidak ikterik', palpasi: 'Tidak ada nyeri tekan' },
  mata: { inspeksi: 'Konjungtiva anemis (-/-), sklera ikterik (-/-), pupil isokor, refleks cahaya (+/+)' },
  telinga: { inspeksi: 'Tidak ada discharge, membran timpani intak', palpasi: 'Tidak ada nyeri tekan mastoid' },
  hidung_sinus: { inspeksi: 'Mukosa hidung tampak sedikit hiperemis, sekret minimal', palpasi_perkusi: 'Tidak ada nyeri tekan sinus paranasalis' },
  mulut_bibir: { inspeksi_luar: 'Bibir tidak pucat, tidak kering, tidak sianosis', inspeksi_dalam: 'Mukosa mulut lembab, faring sedikit hiperemis, tonsil T1/T1' },
  leher: { inspeksi: 'Tidak tampak pembesaran KGB, JVP tidak meningkat', auskultasi_karotis: 'Tidak terdengar bising karotis', palpasi_tiroid: 'Tidak teraba pembesaran tiroid', auskultasi_bising: 'Tidak ada bising pembuluh darah' },
  kulit: { inspeksi: 'Turgor kulit baik, tidak ada ruam, tidak ikterik', palpasi: 'Akral hangat, CRT < 2 detik' },
  kuku: { inspeksi: 'Tidak ada clubbing finger, tidak sianosis', palpasi: 'CRT < 2 detik' },
  dada_punggung: { inspeksi: 'Gerakan dada simetris, tidak ada retraksi', palpasi: 'Vocal fremitus simetris, tidak ada nyeri tekan', perkusi: 'Sonor di seluruh lapang paru', auskultasi: 'Suara napas vesikuler, tidak ada rhonki, tidak ada wheezing' },
  kardiovaskuler: { inspeksi: 'Iktus kordis tidak tampak', palpasi: 'Iktus kordis teraba di ICS 5 linea midklavikularis kiri', perkusi: 'Batas jantung dalam batas normal', auskultasi: 'S1 S2 reguler, tidak ada murmur, tidak ada gallop' },
  dada_aksila: { inspeksi_dada: 'Simetris, tidak ada massa', palpasi_dada: 'Tidak ada nyeri tekan, tidak ada massa', inspeksi_palpasi_aksila: 'Tidak teraba pembesaran KGB aksila' },
  abdomen_perut: { inspeksi: 'Perut datar, tidak tampak distensi, tidak ada massa yang menonjol', auskultasi: 'Bising usus normal (+) 5-10x/menit', perkusi_kuadran: 'Timpani di keempat kuadran', perkusi_hepar: 'Pekak hepar dalam batas normal', perkusi_limfa: 'Timpani, tidak ada splenomegali', perkusi_ginjal: 'Tidak ada nyeri ketuk ginjal kanan/kiri', palpasi_kuadran: 'Supel, tidak ada nyeri tekan, tidak teraba hepatomegali/splenomegali' },
  ekstremitas_atas: { inspeksi: 'Tidak ada deformitas, tidak ada edema, tidak ada sianosis', palpasi: 'Tidak ada nyeri tekan, kekuatan otot baik, tonus otot normal' },
  ekstremitas_bawah: { inspeksi: 'Tidak ada deformitas, tidak ada edema, tidak ada varises', palpasi: 'Tidak ada nyeri tekan, kekuatan otot baik, refleks fisiologis (+/+)' },
}

function buildKeadaanFisikFromKeluhan(
  keluhanUtama: string
): AnamnesaFillPayload['keadaan_fisik'] | undefined {
  const keluhan = keluhanUtama.toLowerCase()
  const activeOrgans = new Set<keyof NonNullable<AnamnesaFillPayload['keadaan_fisik']>>()

  for (const { keywords, organs } of SYMPTOM_ORGAN_MAP) {
    if (keywords.test(keluhan)) {
      organs.forEach((o) => activeOrgans.add(o))
    }
  }

  // Demam / lemas / infeksi → kepala + kulit always checked
  if (/demam|panas|meriang|lemas|lemah|tidak enak badan/.test(keluhan)) {
    activeOrgans.add('kepala')
    activeOrgans.add('kulit')
  }

  if (activeOrgans.size === 0) return undefined

  const hasNyeriKeluhan = /nyeri|sakit|pegal|linu|ngilu/.test(keluhan)
  const NYERI_PALPASI = 'Pasien teraba tegang dengan nyeri dirasakan oleh pasien'

  const result: Partial<NonNullable<AnamnesaFillPayload['keadaan_fisik']>> = {}
  for (const organ of activeOrgans) {
    const base = { ...(ORGAN_NORMAL_FINDINGS[organ] as Record<string, string>) }
    if (hasNyeriKeluhan) {
      // Override palpasi field for musculoskeletal organs based on pain complaint
      if (organ === 'ekstremitas_bawah' || organ === 'ekstremitas_atas') {
        base['palpasi'] = NYERI_PALPASI
      }
      if (organ === 'abdomen_perut') {
        base['palpasi_kuadran'] = 'Terdapat nyeri tekan pada area keluhan, tidak teraba hepatomegali/splenomegali'
      }
      if (organ === 'kepala') {
        base['palpasi'] = 'Terdapat nyeri tekan pada area keluhan'
      }
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(result as any)[organ] = base
  }
  return result as AnamnesaFillPayload['keadaan_fisik']
}


function buildAnamnesaPayload(input: RMETransferMapperInput): {
  payload: AnamnesaFillPayload
  reasonCodes: RMETransferReasonCode[]
} {
  const reasonCodes: RMETransferReasonCode[] = []
  const pregnancy = mapPregnancyStatusToBoolean(input.patientGender, input.pregnancyStatus)
  if (pregnancy.reasonCode) reasonCodes.push(pregnancy.reasonCode)

  const keluhanUtama = input.keluhanUtama.trim() || 'Keluhan belum diisi'
  const vital = input.vitalSigns
  const avpu = input.avpu ?? 'A'
  const spo2 = input.spo2 ?? 0
  const kesadaran = AVPU_KESADARAN_MAP[avpu]

  // lama_sakit: prefer pre-built draft (has parsed duration), fallback to default
  const lamaSakit = input.anamnesaDraftPayload?.lama_sakit ?? { thn: 0, bln: 0, hr: 1 }

  // assesmen_nyeri logic
  const nyeriKeywords = /nyeri|sakit|pegal|linu/i
  const hasNyeriKeluhan = nyeriKeywords.test(keluhanUtama)
  const shouldFillNyeri = input.painScore !== undefined || hasNyeriKeluhan

  const payload: AnamnesaFillPayload = {
    keluhan_utama: keluhanUtama,
    keluhan_tambahan: input.keluhanTambahan?.trim() || keluhanUtama,
    lama_sakit: lamaSakit,
    is_pregnant: pregnancy.is_pregnant,
    alergi: normalizeAllergies(input.allergies || []),

    // riwayat_penyakit: from pre-built draft, always ensure RPK has a default
    riwayat_penyakit: {
      sekarang: input.anamnesaDraftPayload?.riwayat_penyakit?.sekarang
        || input.keluhanTambahan?.trim()
        || keluhanUtama,
      dahulu: input.anamnesaDraftPayload?.riwayat_penyakit?.dahulu || '',
      keluarga: input.anamnesaDraftPayload?.riwayat_penyakit?.keluarga
        || 'Tidak ada riwayat penyakit serupa dalam keluarga yang diketahui.',
    },

    // vital_signs with AVPU-derived kesadaran
    ...(vital
      ? {
          vital_signs: {
            tekanan_darah_sistolik: vital.sbp || 0,
            tekanan_darah_diastolik: vital.dbp || 0,
            nadi: vital.hr || 0,
            respirasi: vital.rr || 0,
            suhu: vital.temp || 0,
            gula_darah: vital.glucose,
            kesadaran,
          },
        }
      : {}),

    // periksa_fisik: GCS + SpO2 + ADL + IMT from AVPU + spo2 + disabilityType + obesityConfirmation
    periksa_fisik: buildPeriksaFisikExtended(avpu, spo2, input.disabilityType, input.obesityConfirmation ?? false),

    // assesmen_nyeri: from pain_score, or inferred from keluhan
    // pencetus/kualitas/lokasi are conditional fields (appear after "Ya" radio click)
    ...((shouldFillNyeri)
      ? {
          assesmen_nyeri: {
            merasakan_nyeri: '1',
            skala_nyeri: input.painScore ?? 4,
            ...buildNyeriDetails(keluhanUtama),
          },
        }
      : {
          assesmen_nyeri: {
            merasakan_nyeri: '0',
            skala_nyeri: 0,
          },
        }),

    // resiko_jatuh: based on consciousness
    resiko_jatuh: {
      cara_berjalan: avpu === 'A' ? '0' : '1',
      penopang: avpu === 'A' ? '0' : '1',
    },

    // status_psikososial: sensible clinical defaults
    status_psikososial: {
      alat_bantu_aktrifitas: input.disabilityType ? '1' : '0',
      kendala_komunikasi: '0',
      merawat_dirumah: '1',
      membutuhkan_bantuan: input.disabilityType ? '1' : '0',
      bahasa_digunakan: 'indonesia',
      tinggal_dengan: 'lainnya',
      sosial_ekonomi: 'cukup',
      gangguan_jiwa_dimasa_lalu: '0',
      status_ekonomi: 'cukup',
    },

    // lainnya: semua field termasuk askep, observasi, biopsikososial, tindakan keperawatan
    lainnya: buildLainnyaFromMedications(
      input.medications || [],
      keluhanUtama,
      input.diagnosis?.nama
    ),

    // keadaan_fisik: symptom-based organ system activation
    keadaan_fisik: buildKeadaanFisikFromKeluhan(keluhanUtama),

    // tenaga_medis — hardcoded per Chief directive
    tenaga_medis: {
      dokter_nama: DOKTER_NAMA,
      perawat_nama: PERAWAT_NAMA,
    },
  }

  return { payload, reasonCodes }
}

function buildDiagnosaPayload(
  diagnosis?: Partial<DiagnosaFillPayload> | null,
  trajectory?: TrajectoryAnalysis,
  hasVisitHistory?: boolean
): DiagnosaFillPayload | null {
  if (!diagnosis?.icd_x?.trim()) return null

  const icdCode = diagnosis.icd_x.trim().toUpperCase()

  // Auto-detect chronic diseases from ICD code
  const chronicDisease = classifyChronicDisease(icdCode)
  const penyakitKronis = chronicDisease
    ? [chronicDisease.fullName]
    : diagnosis.penyakit_kronis || []

  // Auto-map prognosis from trajectory if available
  const prognosa = trajectory
    ? mapTrajectoryToPrognosis(trajectory)
    : diagnosis.prognosa || 'Bonam (Baik)'

  // Auto-detect kasus based on visit history
  const kasus = hasVisitHistory ? 'LAMA' : diagnosis.kasus || 'BARU'

  return {
    icd_x: icdCode,
    nama: diagnosis.nama?.trim() || icdCode,
    jenis: diagnosis.jenis || 'PRIMER',
    kasus,
    prognosa,
    penyakit_kronis: penyakitKronis,
  }
}

function buildResepPayload(input: RMETransferMapperInput): {
  payload: ResepFillPayload | null
  reasonCodes: RMETransferReasonCode[]
  triadMissingRoles: TriadRole[]
} {
  const reasonCodes: RMETransferReasonCode[] = []
  const medications = input.medications || []
  const safeMedications = medications.filter(item => item.safety_check !== 'contraindicated')

  if (medications.length > 0 && safeMedications.length === 0) {
    reasonCodes.push('RESEP_EMPTY_AFTER_SAFETY')
  }
  if (safeMedications.length === 0) {
    reasonCodes.push('RESEP_PAYLOAD_EMPTY')
    return { payload: null, reasonCodes, triadMissingRoles: ['utama', 'adjuvant', 'vitamin'] }
  }

  const roles = {
    utama: 0,
    adjuvant: 0,
    vitamin: 0,
  }

  const mappedRows: ResepFillPayload['medications'] = safeMedications.slice(0, 5).map(med => {
    const resolvedMedicationName = resolveMedicationNameFromStock(med.nama_obat)
    const role = classifyRole(resolvedMedicationName)
    roles[role] += 1
    const estimatedQty = estimateQuantity(med.dosis, med.durasi)
    return {
      racikan: '0',
      jumlah_permintaan: estimatedQty,
      nama_obat: resolvedMedicationName,
      jumlah: estimatedQty,
      signa: normalizeSignaValue(med.dosis),
      aturan_pakai: mapAturanPakai(med.aturan_pakai),
      keterangan: resolveMedicationNote(med.rationale, med.aturan_pakai),
    }
  })

  const triadMissingRoles = (Object.keys(roles) as TriadRole[]).filter(key => roles[key] === 0)
  if (triadMissingRoles.length > 0) {
    reasonCodes.push('RESEP_TRIAD_INCOMPLETE')
  }

  const allergySummary = normalizeAllergies(input.allergies || [])
  const allergyText = [...allergySummary.obat, ...allergySummary.makanan, ...allergySummary.udara]
    .filter(Boolean)
    .join(', ')
  return {
    payload: {
      static: {
        no_resep: '',
        alergi: allergyText,
      },
      ajax: {
        ruangan: '',
        dokter: DOKTER_NAMA,
        perawat: PERAWAT_NAMA,
      },
      medications: mappedRows,
      prioritas: '0',
    },
    reasonCodes,
    triadMissingRoles,
  }
}

/**
 * buildRMETransferPayload
 *
 * @remarks
 * TODO: Add detailed description, parameters, and examples
 * Auto-generated on 2026-03-12
 */

export function buildRMETransferPayload(input: RMETransferMapperInput): {
  payload: RMETransferPayload
  reasonCodes: RMETransferReasonCode[]
} {
  const reasonCodes = new Set<RMETransferReasonCode>()
  const anamnesa = buildAnamnesaPayload(input)
  anamnesa.reasonCodes.forEach(code => reasonCodes.add(code))

  const diagnosa = buildDiagnosaPayload(input.diagnosis, input.trajectory, input.hasVisitHistory)
  if (!diagnosa) reasonCodes.add('DIAGNOSA_PAYLOAD_EMPTY')

  const resep = buildResepPayload(input)
  resep.reasonCodes.forEach(code => reasonCodes.add(code))

  const payload: RMETransferPayload = {
    anamnesa: anamnesa.payload,
    diagnosa,
    resep: resep.payload,
    meta: {
      reasonCodes: Array.from(reasonCodes),
      triadComplete: resep.triadMissingRoles.length === 0,
      triadMissingRoles: resep.triadMissingRoles,
    },
  }

  return {
    payload,
    reasonCodes: Array.from(reasonCodes),
  }
}

export const __rmeMapperInternals = {
  resolveMedicationCandidatesFromStock,
  scoreMedicationCandidate,
  getMedicationFormPreference,
}
