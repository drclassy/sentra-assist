import { describe, expect, it } from 'vitest'

import { composeAnamnesaDraft } from './anamnesa-composer'

describe('composeAnamnesaDraft', () => {
  it('builds deterministic anamnesa draft from short symptom input without fabricating duration', () => {
    const result = composeAnamnesaDraft({
      symptomText: 'demam, batuk, pilek',
      patientGender: 'L',
      chronicDiseases: ['HT'],
      allergies: [],
      pregnancyStatus: null,
    })

    expect(result.payload.keluhan_utama).toBe('Demam, batuk, dan pilek')
    expect(result.payload.keluhan_tambahan).toContain('Durasi keluhan belum disebutkan pada input awal.')
    expect(result.payload.keluhan_tambahan).toContain('Riwayat penyakit kronis yang relevan: HT.')
    expect(result.metadata.missingFacts).toContain('durasi belum disebutkan')
    expect(result.payload.lama_sakit).toEqual({ thn: 0, bln: 0, hr: 0 })
  })

  it('extracts day-based duration and relevant context from structured input', () => {
    const result = composeAnamnesaDraft({
      symptomText: 'pusing, mual, lemas sejak 2 hari',
      patientGender: 'P',
      chronicDiseases: ['DM'],
      allergies: ['Debu', 'Obat'],
      pregnancyStatus: false,
      pregnancyRisk: 'KSPR rendah',
      specialConditions: ['Penyakit autoimun'],
    })

    expect(result.payload.keluhan_utama).toBe('Pusing, mual, dan lemas sejak 2 hari')
    expect(result.payload.lama_sakit).toEqual({ thn: 0, bln: 0, hr: 2 })
    expect(result.payload.keluhan_tambahan).toContain('Durasi keluhan 2 hari.')
    expect(result.payload.keluhan_tambahan).toContain('Riwayat alergi yang dilaporkan: Debu dan Obat.')
    expect(result.payload.keluhan_tambahan).toContain('Status kehamilan saat ini: tidak hamil.')
    expect(result.payload.keluhan_tambahan).toContain('Risiko kehamilan pada RME: KSPR rendah.')
    expect(result.payload.keluhan_tambahan).toContain('Penyakit khusus pada RME: Penyakit autoimun.')
    expect(result.payload.alergi.obat).toContain('Alergi obat dilaporkan')
    expect(result.payload.alergi.udara).toContain('Alergi debu dilaporkan')
  })

  it('adds vital sign and form context into AutoComplete+ draft without inventing new facts', () => {
    const result = composeAnamnesaDraft({
      symptomText: 'sesak, lemas',
      patientGender: 'L',
      chronicDiseases: ['Jantung'],
      allergies: ['Obat'],
      vitals: {
        sbp: 160,
        dbp: 100,
        hr: 112,
        rr: 28,
        temp: 38.2,
        spo2: 93,
        glucose: 210,
      },
      disabilityType: 'Netra',
      obesityConfirmation: 'confirmed',
      autosenPresetLabel: 'Hipertensi',
    })

    expect(result.payload.keluhan_tambahan).toContain(
      'Tanda vital saat input: TD 160/100 mmHg, nadi 112 x/menit, RR 28 x/menit, suhu 38.2 C, SpO2 93%, gula darah 210 mg/dL.'
    )
    expect(result.payload.keluhan_tambahan).toContain(
      'Konteks disabilitas yang dicatat pada form: Netra.'
    )
    expect(result.payload.keluhan_tambahan).toContain(
      'Status obesitas pada form: terkonfirmasi.'
    )
    expect(result.payload.keluhan_tambahan).toContain(
      'Preset aktif AutoComplete+: Hipertensi.'
    )
    expect(result.payload.vital_signs).toEqual({
      tekanan_darah_sistolik: 160,
      tekanan_darah_diastolik: 100,
      nadi: 112,
      respirasi: 28,
      suhu: 38.2,
      gula_darah: 210,
      kesadaran: 'COMPOS MENTIS',
    })
  })
})
