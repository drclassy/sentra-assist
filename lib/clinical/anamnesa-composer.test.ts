import { describe, expect, it } from 'vitest';

import {
  buildAnamnesisShadowSuggestion,
  composeAnamnesaDraft,
  composeAnamnesaDraftFromExtraction,
} from './anamnesa-composer';

const countSentences = (text: string): number =>
  text
    .split('.')
    .map((part) => part.trim())
    .filter(Boolean).length;

describe('composeAnamnesaDraft', () => {
  it('builds deterministic anamnesa draft from short symptom input without fabricating duration', () => {
    const result = composeAnamnesaDraft({
      symptomText: 'demam, batuk, pilek',
      patientGender: 'L',
      chronicDiseases: ['HT'],
      allergies: [],
      pregnancyStatus: null,
    });

    expect(result.payload.keluhan_utama).toBe('Demam, batuk, dan pilek');
    expect(result.payload.keluhan_tambahan).toContain('tanpa keterangan durasi yang jelas');
    expect(result.payload.keluhan_tambahan).toContain('penyakit kronis (HT)');
    expect(result.metadata.missingFacts).toContain('durasi belum disebutkan');
    expect(result.payload.lama_sakit).toEqual({ thn: 0, bln: 0, hr: 0 });
  });

  it('extracts day-based duration and relevant context from structured input', () => {
    const result = composeAnamnesaDraft({
      symptomText: 'pusing, mual, lemas sejak 2 hari',
      patientGender: 'P',
      chronicDiseases: ['DM'],
      allergies: ['Debu', 'Obat'],
      pregnancyStatus: false,
      pregnancyRisk: 'KSPR rendah',
      specialConditions: ['Penyakit autoimun'],
    });

    expect(result.payload.keluhan_utama).toBe('Pusing, mual, dan lemas sejak 2 hari');
    expect(result.payload.keluhan_tambahan).toContain(
      'Pasien datang dengan keluhan utama pusing sejak 2 hari.'
    );
    expect(result.payload.keluhan_tambahan).toContain('Keluhan disertai mual dan lemas.');
    expect(result.payload.lama_sakit).toEqual({ thn: 0, bln: 0, hr: 2 });
    expect(result.payload.keluhan_tambahan).toContain('alergi terhadap Debu dan Obat');
    expect(result.payload.keluhan_tambahan).toContain('berstatus tidak hamil');
    expect(result.payload.keluhan_tambahan).toContain('Risiko kehamilan: KSPR rendah');
    expect(result.payload.keluhan_tambahan).toContain('kondisi khusus (Penyakit autoimun)');
    expect(result.payload.alergi.obat).toContain('Alergi obat dilaporkan');
    expect(result.payload.alergi.udara).toContain('Alergi debu dilaporkan');
  });

  it('normalizes common duration typo to avoid awkward repeated output', () => {
    const result = composeAnamnesaDraft({
      symptomText: 'sakit kepala 3 haru',
      patientGender: 'L',
    });

    expect(result.payload.keluhan_utama).toBe('Sakit kepala sejak 3 hari');
    expect(result.payload.keluhan_tambahan).not.toContain('Keluhan dominan yang disebutkan adalah');
    expect(result.payload.keluhan_tambahan).not.toContain('Perlu pendalaman anamnesis');
    expect(result.payload.lama_sakit).toEqual({ thn: 0, bln: 0, hr: 3 });
  });

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
    });

    expect(result.payload.keluhan_tambahan).toContain(
      'Pemeriksaan tanda vital menunjukkan TD 160/100 mmHg, nadi 112 x/menit, RR 28 x/menit, suhu 38.2 C, SpO2 93%, gula darah 210 mg/dL.'
    );
    expect(result.payload.keluhan_tambahan).toContain(
      'Konteks disabilitas yang dicatat pada form: Netra.'
    );
    expect(result.payload.keluhan_tambahan).toContain('Status obesitas pada form: terkonfirmasi.');
    expect(result.payload.keluhan_tambahan).not.toContain('Preset:');
    expect(result.payload.vital_signs).toEqual({
      tekanan_darah_sistolik: 160,
      tekanan_darah_diastolik: 100,
      nadi: 112,
      respirasi: 28,
      suhu: 38.2,
      gula_darah: 210,
      kesadaran: 'COMPOS MENTIS',
    });
  });
});

describe('hybrid autotext helpers', () => {
  it('builds deterministic shadow suggestions from missing fields', () => {
    const suggestion = buildAnamnesisShadowSuggestion(['kualitas', 'keparahan', 'onset']);
    expect(suggestion).toContain('Keluhan dirasakan seperti');
    expect(suggestion).toContain('Skala keluhan saat ini');
    expect(suggestion).not.toContain('Onset keluhan');
  });

  it('composes anamnesa draft from backend extraction result', () => {
    const result = composeAnamnesaDraftFromExtraction(
      {
        keluhan_utama: 'nyeri perut kanan bawah',
        onset: 'sejak kemarin',
        lokasi: 'perut kanan bawah',
        kualitas: 'tertusuk',
        keparahan: 6,
        faktor_pemicu: ['bergerak'],
        faktor_peredam: ['istirahat'],
        associated_symptoms: ['mual', 'nafsu makan turun'],
        pertinent_negatives: ['muntah proyektil', 'perdarahan'],
        functional_impact: 'aktivitas harian dan mobilisasi',
        data_belum_lengkap: ['faktor_peredam'],
      },
      {
        symptomText: 'nyeri perut kanan bawah sejak kemarin',
        patientGender: 'P',
        chronicDiseases: ['DM'],
        allergies: ['Obat'],
        pregnancyStatus: false,
        pregnancyRisk: 'Risiko rendah',
        specialConditions: ['Hipertensi'],
      }
    );

    expect(result.payload.keluhan_utama).toBe('Nyeri perut kanan bawah');
    expect(result.payload.keluhan_tambahan).toContain(
      'Pasien datang dengan keluhan utama nyeri perut kanan bawah sejak kemarin.'
    );
    expect(result.payload.keluhan_tambahan).toContain(
      'Keluhan disertai mual dan nafsu makan turun.'
    );
    expect(result.payload.keluhan_tambahan).toContain('di area perut kanan bawah');
    expect(result.payload.keluhan_tambahan).toContain('dengan karakteristik tertusuk');
    expect(result.payload.keluhan_tambahan).toContain('dengan intensitas sekitar 6/10');
    expect(result.payload.keluhan_tambahan).toContain(
      'Keluhan ini berdampak pada aktivitas harian dan mobilisasi.'
    );
    expect(result.payload.keluhan_tambahan).toContain(
      'Saat anamnesis awal, pasien menyangkal muntah proyektil dan perdarahan.'
    );
    expect(result.metadata.missingFacts).toContain('faktor peredam belum disebutkan');
  });

  it('normalizes repeated symptom typo for fallback draft', () => {
    const result = composeAnamnesaDraft({
      symptomText: 'nnyeri kepala berulang',
      patientGender: 'L',
    });

    expect(result.payload.keluhan_utama).toBe('Nyeri kepala berulang');
    expect(result.payload.keluhan_tambahan).toContain('tanpa keterangan durasi yang jelas');
  });

  it('keeps fallback narrative concise for runtime complaint flow', () => {
    const result = composeAnamnesaDraft({
      symptomText: 'sakit kepala 3 haru disertai mual',
      patientGender: 'L',
      chronicDiseases: ['hipertensi'],
      allergies: ['penisilin'],
      autosenPresetLabel: 'ADL Terganggu',
      vitals: {
        sbp: 150,
        dbp: 95,
        hr: 98,
      },
    });

    expect(result.payload.keluhan_utama).toBe('Sakit kepala dan mual sejak 3 hari');
    expect(result.payload.keluhan_tambahan).toContain(
      'Pasien datang dengan keluhan utama sakit kepala sejak 3 hari.'
    );
    expect(result.payload.keluhan_tambahan).toContain('Keluhan disertai mual.');
    expect(result.payload.keluhan_tambahan).toContain(
      'Pemeriksaan tanda vital menunjukkan TD 150/95 mmHg, nadi 98 x/menit.'
    );
    expect(result.payload.keluhan_tambahan).toContain('alergi terhadap penisilin');
    expect(result.payload.keluhan_tambahan).not.toContain('Perlu pendalaman anamnesis');
    expect(result.payload.keluhan_tambahan).not.toContain('Preset:');
    expect(countSentences(result.payload.keluhan_tambahan)).toBeLessThanOrEqual(6);
  });

  it('does not repeat duration twice in the drafted narrative', () => {
    const result = composeAnamnesaDraft({
      symptomText: 'demam, batuk sejak 2 hari',
      patientGender: 'L',
    });

    expect(result.payload.keluhan_tambahan).toContain(
      'Pasien datang dengan keluhan utama demam sejak 2 hari.'
    );
    expect(result.payload.keluhan_tambahan).not.toContain('sejak 2 hari sejak 2 hari');
  });
});
