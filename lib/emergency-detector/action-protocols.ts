// Designed and constructed by Claudesy.
/**
 * ABCDE Action Protocols — Clinical Pattern-Matching Engine (v2).
 *
 * 9 structured emergency action protocols for FKTP (Puskesmas).
 * Each protocol follows ABCDE (Airway, Breathing, Circulation, Disability, Exposure)
 * with FKTP-appropriate steps.
 *
 * ALL content transcribed 1:1 from:
 *   docs/specs/assist-gate 2-detect-trigger-action.md
 *
 * DO NOT modify thresholds or clinical recommendations without dr. Ferdi review.
 *
 * @module lib/emergency-detector/action-protocols
 */

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

/** ABCDE phase identifier. */
export type ABCDEPhase = 'A' | 'B' | 'C' | 'D' | 'E' | 'other';

/** A single action step within a protocol. */
export interface ActionStep {
  /** ABCDE phase this step belongs to */
  phase: ABCDEPhase;
  /** Action description (Indonesian, FKTP-appropriate) */
  action: string;
}

/** A complete emergency action protocol. */
export interface ActionProtocol {
  /** Unique protocol ID */
  id: string;
  /** Protocol name */
  name: string;
  /** Clinical condition this protocol addresses */
  condition: string;
  /** Ordered ABCDE steps */
  steps: ActionStep[];
  /** Criteria for referral to RS (hospital) */
  referralCriteria: string[];
  /** Evidence/guideline source */
  source: string;
}

// ---------------------------------------------------------------------------
// 9 ABCDE Protocols — transcribed from spec
// ---------------------------------------------------------------------------

export const ACTION_PROTOCOLS: readonly ActionProtocol[] = [
  // ═══════════════════════════════════════════════════════════════════════════
  // 1. RESPIRATORY FAILURE
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: 'PROTO_RESP_FAILURE',
    name: 'Gagal Napas Akut',
    condition: 'RR tinggi (>=25-30) + SpO2 rendah (<90-92) +/- sulit bicara',
    steps: [
      {
        phase: 'A',
        action:
          'Nilai jalan napas: pastikan tidak ada sumbatan, posisikan head tilt-chin lift jika tidak ada kecurigaan trauma leher.',
      },
      {
        phase: 'A',
        action: 'Bila muntah/sekret: miringkan kepala, bersihkan jalan napas.',
      },
      {
        phase: 'B',
        action: 'Pasien duduk tegak (posisi semi-fowler).',
      },
      {
        phase: 'B',
        action: 'Berikan oksigen: masker/simple mask 6-10 L/menit, kalau ada.',
      },
      {
        phase: 'B',
        action: 'Jika asma/COPD: mulai nebulizer bronkodilator sesuai protokol lokal.',
      },
      {
        phase: 'C',
        action: 'Cek nadi, tekanan darah, CRT; bila tanda syok, aktifkan juga paket syok.',
      },
      {
        phase: 'other',
        action: 'Pasang monitor vital sign sederhana, ulang RR/SpO2 tiap beberapa menit.',
      },
      {
        phase: 'other',
        action: 'Panggil dokter sesegera mungkin.',
      },
      {
        phase: 'other',
        action: 'Siapkan rujuk emergensi ke IGD RS, hubungi SPGDT/PSC bila tersedia.',
      },
    ],
    referralCriteria: [
      'SpO2 tetap <90% setelah O2',
      'RR tetap >=30',
      'Sulit bicara / silent chest',
      'Penurunan kesadaran',
    ],
    source: 'PMK 47/2018, WHO Emergency Triage',
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // 2. SYOK (SHOCK)
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: 'PROTO_SHOCK',
    name: 'Syok',
    condition: 'SBP <90-100 atau MAP <65 + HR tinggi + CRT memanjang / kulit dingin',
    steps: [
      {
        phase: 'A',
        action:
          'Pastikan jalan napas terbuka, posisi sesuai (supinasi dengan sedikit elevasi kaki bila bukan gagal napas).',
      },
      {
        phase: 'B',
        action: 'Berikan oksigen 6-10 L/menit.',
      },
      {
        phase: 'C',
        action:
          'Baringkan pasien, angkat kaki (Trendelenburg modifikasi) bila tidak dicurigai trauma tulang belakang.',
      },
      {
        phase: 'C',
        action: 'Hentikan perdarahan luar bila ada (tekan langsung, balut tekan).',
      },
      {
        phase: 'C',
        action:
          'Pasang infus besar (NaCl 0,9% atau Ringer Laktat) dan mulai cairan sesuai SOP lokal.',
      },
      {
        phase: 'other',
        action: 'Pantau vital sign tiap beberapa menit.',
      },
      {
        phase: 'other',
        action: 'Siapkan dokumen dan komunikasi rujuk emergensi ke RS; aktifkan SPGDT.',
      },
    ],
    referralCriteria: [
      'SBP tetap <90 setelah cairan awal',
      'MAP tetap <65',
      'Penurunan kesadaran',
      'Perdarahan tidak terkontrol',
    ],
    source: 'PMK 47/2018, MSF Shock Guidelines',
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // 3. SEPSIS BERAT / EARLY SEPSIS
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: 'PROTO_SEPSIS',
    name: 'Sepsis Berat / Early Sepsis',
    condition: 'Demam/hipotermia + HR >90 + RR >=22 + (SBP <=100 atau mental status turun)',
    steps: [
      {
        phase: 'A',
        action: 'Pastikan jalan napas terbuka.',
      },
      {
        phase: 'B',
        action: 'Oksigen bila RR tinggi/SpO2 turun.',
      },
      {
        phase: 'C',
        action: 'Cek BP berulang, nadi, CRT; bila SBP <90, ikuti paket syok.',
      },
      {
        phase: 'D',
        action: 'Cek kesadaran, gula darah (hipo/hiper).',
      },
      {
        phase: 'other',
        action: 'Mulai cairan IV bila ada tanda hipoperfusi (tunduk ke panduan lokal).',
      },
      {
        phase: 'other',
        action: 'Segera dokter review; jangan pulangkan begitu saja.',
      },
      {
        phase: 'other',
        action: 'Bila kecurigaan sepsis berat/septic shock kuat, rujuk ke RS secepatnya.',
      },
    ],
    referralCriteria: [
      'SBP <=100 persisten',
      'AVPU != A (penurunan kesadaran)',
      'qSOFA >= 2',
      'Tidak membaik setelah cairan awal',
    ],
    source: 'qSOFA (JAMA 2016), Surviving Sepsis Campaign 2021',
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // 4. ANAFILAKSIS
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: 'PROTO_ANAPHYLAXIS',
    name: 'Anafilaksis',
    condition: 'Paparan alergen + gejala kulit/mukosa + sesak/SpO2 turun atau SBP turun',
    steps: [
      {
        phase: 'A',
        action:
          'Nilai jalan napas; bila ada pembengkakan lidah/laring, posisi duduk tegak, siapkan jalan napas darurat.',
      },
      {
        phase: 'B',
        action: 'Oksigen 6-10 L/menit.',
      },
      {
        phase: 'C',
        action: 'Adrenalin IM segera (0,3-0,5 mg IM dewasa — detail dosis mengacu panduan lokal).',
      },
      {
        phase: 'C',
        action: 'Pasang infus, mulai cairan (NaCl/RL).',
      },
      {
        phase: 'other',
        action: 'Pantau vital sign ketat.',
      },
      {
        phase: 'other',
        action: 'Rujuk emergensi (IGD) tanpa menunggu lama.',
      },
      {
        phase: 'other',
        action: 'Dokumentasikan waktu pemberian adrenalin dan respon pasien.',
      },
    ],
    referralCriteria: [
      'Semua kasus anafilaksis harus dirujuk',
      'Risiko biphasic reaction dalam 8-12 jam',
      'SBP <90 atau SpO2 <94 setelah adrenalin',
    ],
    source: 'WHO Anaphylaxis Guidelines, EAACI 2021',
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // 5. ACS / INFARK
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: 'PROTO_ACS',
    name: 'ACS / Infark Miokard',
    condition: 'Nyeri dada khas + keringat dingin +/- HR/BP abnormal',
    steps: [
      {
        phase: 'A',
        action: 'Pastikan jalan napas terbuka.',
      },
      {
        phase: 'B',
        action: 'Oksigen bila SpO2 <94%.',
      },
      {
        phase: 'C',
        action: 'Pantau BP, HR, ritme (kalau ada monitor).',
      },
      {
        phase: 'other',
        action: 'Jangan biarkan pasien berjalan/berdiri.',
      },
      {
        phase: 'other',
        action:
          'Beri obat awal sesuai panduan PPK FKTP (mis: aspirin bila tidak kontraindikasi; detail dosis merujuk PPK resmi).',
      },
      {
        phase: 'other',
        action:
          'Rujuk segera ke RS yang punya fasilitas penanganan ACS (lebih baik yang punya cath lab).',
      },
    ],
    referralCriteria: [
      'Semua kasus suspected ACS harus dirujuk',
      'Nyeri dada >20 menit tidak membaik',
      'SBP <90 atau >180',
      'Aritmia',
    ],
    source: 'AHA/ACC Guidelines 2021, PPK FKTP',
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // 6. STROKE
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: 'PROTO_STROKE',
    name: 'Stroke',
    condition: 'Defisit neurologis fokal mendadak +/- BP tinggi, +/- kesadaran menurun',
    steps: [
      {
        phase: 'A',
        action: 'Pastikan jalan napas terbuka.',
      },
      {
        phase: 'B',
        action: 'Berikan oksigen bila ada hipoksia.',
      },
      {
        phase: 'C',
        action: 'Pantau BP; jangan turunkan agresif di FKTP tanpa indikasi khusus.',
      },
      {
        phase: 'other',
        action: 'Catat waktu onset gejala (last known well).',
      },
      {
        phase: 'other',
        action: 'Jaga kepala agak tinggi (sekitar 30 derajat) bila kesadaran menurun.',
      },
      {
        phase: 'other',
        action: 'Rujuk secepat mungkin (time critical — door-to-needle window).',
      },
      {
        phase: 'other',
        action:
          'BP tinggi BUKAN alasan menahan rujukan; penurunan TD agresif di FKTP tidak direkomendasikan.',
      },
    ],
    referralCriteria: [
      'Semua kasus suspected stroke harus dirujuk SEGERA',
      'Time-critical: golden hour untuk trombolisis',
      'AVPU != A',
      'Gejala progresif',
    ],
    source: 'AHA/ASA Stroke Guidelines, PERDOSSI',
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // 7. DKA / HHS
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: 'PROTO_DKA_HHS',
    name: 'DKA / HHS',
    condition: 'Pasien DM + napas cepat/dalam + lemas/mual, vital sign abnormal',
    steps: [
      {
        phase: 'A',
        action: 'Pastikan jalan napas terbuka.',
      },
      {
        phase: 'B',
        action: 'Oksigen bila sesak atau SpO2 turun.',
      },
      {
        phase: 'C',
        action: 'Pasang infus dan mulai cairan (NaCl 0,9% sesuai SOP lokal).',
      },
      {
        phase: 'D',
        action: 'Cek gula darah kapiler.',
      },
      {
        phase: 'other',
        action: 'Jangan berikan insulin mandiri di FKTP kecuali ada panduan/kompetensi yang jelas.',
      },
      {
        phase: 'other',
        action: 'Rujuk emergensi ke RS dengan fasilitas rawat inap/ICU.',
      },
    ],
    referralCriteria: [
      'Semua kasus suspected DKA/HHS harus dirujuk',
      'Glucose >300 dengan gejala metabolik',
      'Napas Kussmaul',
      'Penurunan kesadaran',
      'Dehidrasi berat',
    ],
    source: 'PERKENI 2024, ADA Standards of Care 2026',
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // 8. HIPOGLIKEMIA SEDANG-BERAT
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: 'PROTO_HYPOGLYCEMIA',
    name: 'Hipoglikemia Sedang-Berat',
    condition: 'Gula darah rendah + perubahan kesadaran/gelisah/kejang',
    steps: [
      {
        phase: 'A',
        action: 'Pastikan jalan napas, posisi miring bila muntah.',
      },
      {
        phase: 'B',
        action: 'Oksigen bila perlu.',
      },
      {
        phase: 'C',
        action: 'Cek gula darah.',
      },
      {
        phase: 'D',
        action: 'Bila pasien masih bisa minum: berikan glukosa oral cepat serap (air gula/juice).',
      },
      {
        phase: 'D',
        action:
          'Bila tidak bisa minum: berikan terapi IV sesuai panduan lokal (glukosa IV — detail dosis merujuk PPK).',
      },
      {
        phase: 'other',
        action: 'Observasi ketat, ulang gula darah.',
      },
      {
        phase: 'other',
        action: 'Rujuk bila tidak membaik atau etiologi serius.',
      },
    ],
    referralCriteria: [
      'Tidak membaik setelah 2-3 siklus 15-15 rule',
      'Penurunan kesadaran persisten',
      'Kejang',
      'Etiologi tidak jelas',
    ],
    source: 'PERKENI 2024, ADA 15-15 Rule',
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // 9. CARDIAC ARREST / NYARIS HENTI
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: 'PROTO_CARDIAC_ARREST',
    name: 'Cardiac Arrest / Nyaris Henti',
    condition: 'Tidak respons, tidak napas normal, tidak ada nadi',
    steps: [
      {
        phase: 'A',
        action: 'Cek respon dan napas; bila tidak ada napas normal, lanjut CPR.',
      },
      {
        phase: 'other',
        action: 'Aktifkan SPGDT/EMS dan minta AED bila ada.',
      },
      {
        phase: 'other',
        action:
          'Mulai RJP (CPR) sesuai algoritme (kompresi dada, ventilasi jika terlatih dan ada alat).',
      },
      {
        phase: 'other',
        action: 'Lanjutkan sampai sistem rujukan tiba / alat lanjutan tersedia.',
      },
    ],
    referralCriteria: [
      'Semua kasus cardiac arrest: aktifkan SPGDT/EMS segera',
      'Lanjutkan CPR sampai bantuan datang',
    ],
    source: 'AHA BLS Guidelines 2020, PMK 47/2018',
  },
] as const;

// ---------------------------------------------------------------------------
// Lookup function
// ---------------------------------------------------------------------------

/**
 * Find an action protocol by ID.
 *
 * @param id - Protocol ID (e.g. 'PROTO_RESP_FAILURE')
 * @returns The protocol or undefined if not found
 */
export function getActionProtocol(id: string): ActionProtocol | undefined {
  return ACTION_PROTOCOLS.find((p) => p.id === id);
}
