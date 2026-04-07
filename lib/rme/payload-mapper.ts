// Designed and constructed by Claudesy.

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

function buildAnamnesaPayload(input: RMETransferMapperInput): {
  payload: AnamnesaFillPayload
  reasonCodes: RMETransferReasonCode[]
} {
  const reasonCodes: RMETransferReasonCode[] = []
  const pregnancy = mapPregnancyStatusToBoolean(input.patientGender, input.pregnancyStatus)
  if (pregnancy.reasonCode) reasonCodes.push(pregnancy.reasonCode)

  const keluhanUtama = input.keluhanUtama.trim() || 'Keluhan belum diisi'
  const vital = input.vitalSigns

  const payload: AnamnesaFillPayload = {
    keluhan_utama: keluhanUtama,
    keluhan_tambahan: input.keluhanTambahan?.trim() || keluhanUtama,
    lama_sakit: { thn: 0, bln: 0, hr: 1 },
    is_pregnant: pregnancy.is_pregnant,
    alergi: normalizeAllergies(input.allergies || []),
    ...(vital
      ? {
          vital_signs: {
            tekanan_darah_sistolik: vital.sbp || 0,
            tekanan_darah_diastolik: vital.dbp || 0,
            nadi: vital.hr || 0,
            respirasi: vital.rr || 0,
            suhu: vital.temp || 0,
            gula_darah: vital.glucose,
            kesadaran: 'COMPOS MENTIS' as const,
          },
        }
      : {}),
    ...(input.tenagaMedis?.dokterNama || input.tenagaMedis?.perawatNama
      ? {
          tenaga_medis: {
            dokter_nama: input.tenagaMedis?.dokterNama || '',
            perawat_nama: input.tenagaMedis?.perawatNama || '',
          },
        }
      : {}),
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
        dokter: input.tenagaMedis?.dokterNama || '',
        perawat: input.tenagaMedis?.perawatNama || '',
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
