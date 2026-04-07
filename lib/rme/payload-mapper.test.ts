// Designed and constructed by Claudesy.
import { describe, expect, it } from 'vitest'
import {
  __rmeMapperInternals,
  buildRMETransferPayload,
  mapPregnancyStatusToBoolean,
} from '@/lib/rme/payload-mapper'

describe('RME payload mapper', () => {
  it('maps unknown pregnancy status to is_pregnant=false with explicit reason', () => {
    const pregnancy = mapPregnancyStatusToBoolean('P', null)

    expect(pregnancy.is_pregnant).toBe(false)
    expect(pregnancy.reasonCode).toBe('PREGNANCY_UNKNOWN_DEFAULT_FALSE')
  })

  it('builds payload with triad warning when regimen role is incomplete', () => {
    const mapped = buildRMETransferPayload({
      keluhanUtama: 'Batuk berdahak',
      patientGender: 'P',
      pregnancyStatus: false,
      allergies: ['Obat'],
      diagnosis: {
        icd_x: 'J06.9',
        nama: 'ISPA',
      },
      medications: [
        {
          nama_obat: 'Paracetamol 500mg',
          dosis: '3x1',
          aturan_pakai: 'Sesudah makan',
          durasi: '3 hari',
          rationale: 'Simptomatik',
          safety_check: 'safe',
          contraindications: [],
        },
        {
          nama_obat: 'Vitamin C 500mg',
          dosis: '1x1',
          aturan_pakai: 'Sesudah makan',
          durasi: '5 hari',
          rationale: 'Supportive',
          safety_check: 'safe',
          contraindications: [],
        },
      ],
    })

    expect(mapped.payload.anamnesa.is_pregnant).toBe(false)
    expect(mapped.payload.resep).not.toBeNull()
    expect(mapped.payload.resep?.medications.length).toBe(2)
    const vitaminRow = mapped.payload.resep?.medications.find(
      row =>
        row.nama_obat.toLowerCase().includes('vitamin') ||
        row.nama_obat.toLowerCase().includes('askorbat')
    )
    expect(vitaminRow).toBeDefined()
    expect(vitaminRow?.nama_obat.toLowerCase()).not.toContain('parasetamol')
    expect(mapped.reasonCodes).toContain('RESEP_TRIAD_INCOMPLETE')
  })

  it('marks resep empty after safety filter when all meds are contraindicated', () => {
    const mapped = buildRMETransferPayload({
      keluhanUtama: 'Nyeri dada',
      patientGender: 'L',
      diagnosis: {
        icd_x: 'I20.9',
        nama: 'Suspek angina',
      },
      medications: [
        {
          nama_obat: 'Captopril 12.5mg',
          dosis: '2x1',
          aturan_pakai: 'Sesudah makan',
          durasi: '5 hari',
          rationale: 'Should be blocked',
          safety_check: 'contraindicated',
          contraindications: ['Pregnancy'],
        },
      ],
    })

    expect(mapped.payload.resep).toBeNull()
    expect(mapped.reasonCodes).toContain('RESEP_EMPTY_AFTER_SAFETY')
    expect(mapped.reasonCodes).toContain('RESEP_PAYLOAD_EMPTY')
  })

  it('calculates rounded quantity with 3-day baseline and keeps signa text', () => {
    const mapped = buildRMETransferPayload({
      keluhanUtama: 'Hipertensi',
      patientGender: 'L',
      diagnosis: {
        icd_x: 'I10',
        nama: 'Hipertensi esensial',
      },
      medications: [
        {
          nama_obat: 'Captopril 25mg',
          dosis: '3x1',
          aturan_pakai: 'Sebelum makan',
          durasi: '33 hari',
          rationale: 'Kontrol tekanan darah',
          safety_check: 'safe',
          contraindications: [],
        },
      ],
    })

    const resep = mapped.payload.resep
    expect(resep).not.toBeNull()
    expect(resep?.static.no_resep).toBe('')
    expect(resep?.medications[0]?.jumlah_permintaan).toBe(10)
    expect(resep?.medications[0]?.jumlah).toBe(10)
    expect(resep?.medications[0]?.signa).toBe('3x1')
    expect(resep?.medications[0]?.aturan_pakai).toBe('1')
  })

  it('always fills keterangan when rationale is missing', () => {
    const mapped = buildRMETransferPayload({
      keluhanUtama: 'Demam',
      patientGender: 'L',
      diagnosis: {
        icd_x: 'R50',
        nama: 'Demam',
      },
      medications: [
        {
          nama_obat: 'Paracetamol 500mg',
          dosis: '3x1',
          aturan_pakai: 'Sesudah makan',
          durasi: '3 hari',
          rationale: '',
          safety_check: 'safe',
          contraindications: [],
        },
      ],
    })

    expect(mapped.payload.resep?.medications[0]?.keterangan).toContain('Aturan minum')
    expect(mapped.payload.resep?.medications[0]?.keterangan).toContain('Review klinis')
  })

  it('keeps original medication name when stock match is low confidence', () => {
    const mapped = buildRMETransferPayload({
      keluhanUtama: 'Keluhan lambung',
      patientGender: 'L',
      diagnosis: {
        icd_x: 'K29',
        nama: 'Gastritis',
      },
      medications: [
        {
          nama_obat: 'Obat Uji Tidak Ada 123',
          dosis: '2 x 1',
          aturan_pakai: 'Sesudah makan',
          durasi: '3 hari',
          rationale: '',
          safety_check: 'safe',
          contraindications: [],
        },
      ],
    })

    const resepItem = mapped.payload.resep?.medications[0]
    expect(resepItem?.nama_obat).toBe('Obat Uji Tidak Ada 123')
    expect(resepItem?.signa).toBe('2x1')
  })

  it('leaves ruangan empty and keeps dokter/perawat for resep ajax fields', () => {
    const mapped = buildRMETransferPayload({
      keluhanUtama: 'Batuk',
      patientGender: 'L',
      diagnosis: {
        icd_x: 'J06.9',
        nama: 'ISPA',
      },
      tenagaMedis: {
        ruangan: 'POLI UMUM',
        dokterNama: 'dr. Ferdi',
        perawatNama: 'Ns. Delia',
      },
      medications: [
        {
          nama_obat: 'Paracetamol 500mg',
          dosis: '3x1',
          aturan_pakai: 'Sesudah makan',
          durasi: '3 hari',
          rationale: 'Simptomatik',
          safety_check: 'safe',
          contraindications: [],
        },
      ],
    })

    expect(mapped.payload.resep?.ajax.ruangan).toBe('')
    expect(mapped.payload.resep?.ajax.dokter).toBe('dr. Ferdi')
    expect(mapped.payload.resep?.ajax.perawat).toBe('Ns. Delia')
  })

  it('prefers solid paracetamol form for 500mg input instead of syrup', () => {
    const mapped = buildRMETransferPayload({
      keluhanUtama: 'Demam',
      patientGender: 'L',
      diagnosis: {
        icd_x: 'R50',
        nama: 'Demam',
      },
      medications: [
        {
          nama_obat: 'Paracetamol 500mg',
          dosis: '3x1',
          aturan_pakai: 'Sesudah makan',
          durasi: '3 hari',
          rationale: 'Simptomatik',
          safety_check: 'safe',
          contraindications: [],
        },
      ],
    })

    const namaObat = mapped.payload.resep?.medications[0]?.nama_obat.toLowerCase() || ''
    expect(namaObat).toContain('parasetamol')
    expect(namaObat).toContain('tablet')
    expect(namaObat).not.toContain('sirup')
  })

  it('returns ranked stock candidates with tablet ahead of syrup for adult paracetamol query', () => {
    const candidates =
      __rmeMapperInternals.resolveMedicationCandidatesFromStock('Paracetamol 500mg')

    expect(candidates.length).toBeGreaterThan(0)
    expect(candidates[0]?.toLowerCase()).toContain('parasetamol')
    expect(candidates[0]?.toLowerCase()).toContain('tablet')
    expect(candidates[0]?.toLowerCase()).not.toContain('sirup')
  })

  it('keeps liquid preference for syrup query when formulation is explicit', () => {
    const candidates = __rmeMapperInternals.resolveMedicationCandidatesFromStock(
      'Paracetamol sirup 120 mg/5 ml'
    )

    expect(candidates.length).toBeGreaterThan(0)
    expect(candidates[0]?.toLowerCase()).toContain('parasetamol')
    expect(candidates[0]?.toLowerCase()).toContain('sirup')
  })

  it('normalizes C/K spelling variant for stock scoring', () => {
    const scoreMatch = __rmeMapperInternals.scoreMedicationCandidate(
      'Captopril 25mg',
      'Kaptopril 25 mg tablet'
    )
    const scoreMiss = __rmeMapperInternals.scoreMedicationCandidate(
      'Captopril 25mg',
      'Parasetamol 500 mg tablet'
    )

    expect(scoreMatch).toBeGreaterThan(scoreMiss)
  })
})
