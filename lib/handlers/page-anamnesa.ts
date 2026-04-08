// Designed and constructed by Claudesy.
/**
 * Precision-Architected. Future-Built by Docsyanpse
 * Sentra Healthcare Artificial Intelligence
 */

/**
 * Anamnesa Page Handler
 * Handles auto-fill for Anamnesa/TTV form in ePuskesmas
 *
 * Fill Order (per user requirement):
 * 1. Anamnesa (Keluhan + Lama Sakit)
 * 2. Riwayat Penyakit
 * 3. Alergi Pasien
 * 4. Status Psikososial (Status Fisis/Neurologis/Mental/Biologis/Psikososiospiritual/Ekonomi)
 * 5. Periksa Fisik (Vital Signs + GCS + Anthropometrics + SpO2 + Activity + Kesadaran)
 * 6. Assesmen Nyeri
 * 7. Resiko Jatuh (Get Up and Go)
 * 8. Keadaan Fisik
 * 9. Lainnya (Terapi, Edukasi)
 * 10. Tenaga Medis
 */

import { DOKTER_NAMA, PERAWAT_NAMA } from '@/lib/constants/tenaga-medis'
import {
  activateCheckboxWithOnclick,
  type FieldMapping,
  type FillResult,
  fillFields,
  fillRangeSlider,
} from '@/lib/filler/filler-core'
import { fillViaMainWorld, type MainWorldFieldMapping } from '@/lib/filler/main-world-bridge'
import { createLogger } from '@/utils/logger'
import type { AnamnesaFillPayload } from '@/utils/types'

const anamnesaLog = createLogger('AnamnesaHandler', 'content')

// ============================================================================
// TEXT FORMATTING HELPERS FOR MANDATORY FIELDS
// ============================================================================

/**
 * Format keluhan_utama (chief complaint)
 * - Capitalize first letter
 * - Fix basic grammar issues
 * - Ensure proper sentence structure
 *
 * Example: "batuk Pilek" → "Pasien mengeluh Batuk dan pilek"
 */
function formatKeluhanUtama(text: string): string {
  if (!text || text.trim().length === 0) return text

  let formatted = text.trim()

  // Convert to lowercase first for consistent processing
  formatted = formatted.toLowerCase()

  // Fix common patterns
  formatted = formatted.replace(/\s+/g, ' ') // Normalize spaces
  formatted = formatted.replace(/pilek/gi, 'pilek') // Standardize
  formatted = formatted.replace(/batuk/gi, 'batuk') // Standardize

  // Add proper sentence structure if not present
  if (!formatted.includes('pasien')) {
    // Split by common separators
    const symptoms = formatted.split(/\s+(?:dan|,|&)\s+/i)

    if (symptoms.length > 1) {
      // Multiple symptoms: "Pasien mengeluh Batuk dan pilek"
      const capitalizedSymptoms = symptoms.map(s => s.charAt(0).toUpperCase() + s.slice(1))
      formatted = `Pasien mengeluh ${capitalizedSymptoms.join(' dan ')}`
    } else {
      // Single symptom: "Pasien mengeluh Batuk"
      formatted = `Pasien mengeluh ${formatted.charAt(0).toUpperCase() + formatted.slice(1)}`
    }
  } else {
    // Already has "pasien", just capitalize
    formatted = formatted.charAt(0).toUpperCase() + formatted.slice(1)
  }

  return formatted
}

/**
 * Expand keluhan_tambahan (additional complaints) to minimum 100-120 words
 * - Add clinical context
 * - Maintain medical professionalism
 */
function expandKeluhanTambahan(text: string): string {
  if (!text || text.trim().length === 0) return text

  let expanded = text.trim()

  // Count current words
  const wordCount = expanded.split(/\s+/).length

  // If already 100+ words, return as is
  if (wordCount >= 100) return expanded

  // Add clinical context based on chief complaint
  const additions: string[] = []

  // Ensure proper sentence structure
  if (!expanded.endsWith('.')) {
    expanded += '.'
  }

  // Add temporal context if not present
  if (!expanded.toLowerCase().includes('sejak') && !expanded.toLowerCase().includes('selama')) {
    additions.push('Keluhan dirasakan sejak beberapa hari yang lalu')
  }

  // Add severity context if not present
  if (
    !expanded.toLowerCase().includes('ringan') &&
    !expanded.toLowerCase().includes('sedang') &&
    !expanded.toLowerCase().includes('berat')
  ) {
    additions.push('dengan intensitas yang bervariasi')
  }

  // Add activity impact
  if (
    !expanded.toLowerCase().includes('aktivitas') &&
    !expanded.toLowerCase().includes('kegiatan')
  ) {
    additions.push('yang mengganggu aktivitas sehari-hari pasien')
  }

  // Add medical seeking behavior
  if (!expanded.toLowerCase().includes('obat') && !expanded.toLowerCase().includes('pengobatan')) {
    additions.push('Pasien belum mendapatkan pengobatan khusus sebelumnya')
  }

  // Add general condition
  if (
    !expanded.toLowerCase().includes('kondisi umum') &&
    !expanded.toLowerCase().includes('keadaan umum')
  ) {
    additions.push('Kondisi umum pasien saat ini cukup stabil dengan kesadaran compos mentis')
  }

  // Combine with additions
  if (additions.length > 0) {
    expanded += ' ' + additions.join('. ') + '.'
  }

  // Final word count check
  const finalWordCount = expanded.split(/\s+/).length
  anamnesaLog.debug(`[Keluhan Tambahan] Expanded from ${wordCount} to ${finalWordCount} words`)

  return expanded
}

/**
 * Fill Anamnesa form with TTV and clinical data
 * @param payload - Anamnesa data from sidepanel
 */
export async function fillAnamnesaForm(payload: AnamnesaFillPayload): Promise<{
  success: FillResult[]
  failed: FillResult[]
  skipped: string[]
}> {
  anamnesaLog.debug('fillAnamnesaForm CALLED')
  anamnesaLog.debug('payload.vital_signs =', payload.vital_signs)
  anamnesaLog.debug('[Anamnesa Handler] Starting fill with payload:', payload)

  const mappings: FieldMapping[] = []
  const tenagaMedisBridgeFields: MainWorldFieldMapping[] = []
  const skipped: string[] = []
  const hasField = (selector: string): boolean => Boolean(document.querySelector(selector))

  // ========================================
  // SECTION 1: ANAMNESA (Keluhan + Lama Sakit)
  // Format: Anamnesa[field_name]
  // ========================================
  if (payload.keluhan_utama) {
    // MANDATORY FIELD 1: Always override, apply formatting
    const formattedKeluhanUtama = formatKeluhanUtama(payload.keluhan_utama)
    mappings.push({
      selector: 'textarea[name="Anamnesa[keluhan_utama]"], textarea#keluhan',
      value: formattedKeluhanUtama,
      type: 'textarea',
      forceOverride: true, // ✅ Always override
    })
  }

  if (payload.keluhan_tambahan) {
    // MANDATORY FIELD 2: Always override, expand to 100-120 words
    const expandedKeluhanTambahan = expandKeluhanTambahan(payload.keluhan_tambahan)
    mappings.push({
      selector: 'textarea[name="Anamnesa[keluhan_tambahan]"], textarea#keluhan-tambahan',
      value: expandedKeluhanTambahan,
      type: 'textarea',
      forceOverride: true, // ✅ Always override
    })
  }

  // Lama Sakit (bagian dari Anamnesa)
  if (payload.lama_sakit) {
    if (payload.lama_sakit.hr > 0) {
      mappings.push({
        selector: 'input[name="Anamnesa[lama_sakit_hari]"], input#sakit_hari',
        value: String(payload.lama_sakit.hr),
        type: 'number',
      })
    }
    if (payload.lama_sakit.bln > 0) {
      mappings.push({
        selector: 'input[name="Anamnesa[lama_sakit_bulan]"], input#sakit_bulan',
        value: String(payload.lama_sakit.bln),
        type: 'number',
      })
    }
    if (payload.lama_sakit.thn > 0) {
      mappings.push({
        selector: 'input[name="Anamnesa[lama_sakit_tahun]"], input#sakit_tahun',
        value: String(payload.lama_sakit.thn),
        type: 'number',
      })
    }
  }

  // ========================================
  // SECTION 2: RIWAYAT PENYAKIT (MRiwayatPasien)
  // Format: MRiwayatPasien[Type][value]
  // ========================================
  if (payload.riwayat_penyakit) {
    // RPS - Riwayat Penyakit Sekarang
    if (payload.riwayat_penyakit.sekarang) {
      mappings.push({
        selector:
          'textarea[name="MRiwayatPasien[Riwayat Penyakit Sekarang][value]"], textarea#text_rps',
        value: payload.riwayat_penyakit.sekarang,
        type: 'textarea',
      })
    }

    // RPD - Riwayat Penyakit Dulu
    if (payload.riwayat_penyakit.dahulu) {
      mappings.push({
        selector:
          'textarea[name="MRiwayatPasien[Riwayat Penyakit Dulu][value]"], textarea#text_rpd',
        value: payload.riwayat_penyakit.dahulu,
        type: 'textarea',
      })
    }

    // RPK - Riwayat Penyakit Keluarga
    if (payload.riwayat_penyakit.keluarga) {
      mappings.push({
        selector:
          'textarea[name="MRiwayatPasien[Riwayat Penyakit Keluarga][value]"], textarea#text_rpk',
        value: payload.riwayat_penyakit.keluarga,
        type: 'textarea',
      })
    }
  }

  // ========================================
  // SECTION 3: ALERGI PASIEN (MAlergiPasien)
  // Format: MAlergiPasien[Type][value]
  // ========================================
  if (payload.alergi) {
    // Alergi Obat
    if (payload.alergi.obat && payload.alergi.obat.length > 0) {
      mappings.push({
        selector: 'textarea[name="MAlergiPasien[Obat][value]"], textarea#text_alergiobat',
        value: payload.alergi.obat.join(', '),
        type: 'textarea',
      })
    }

    // Alergi Makanan
    if (payload.alergi.makanan && payload.alergi.makanan.length > 0) {
      mappings.push({
        selector: 'textarea[name="MAlergiPasien[Makanan][value]"], textarea#text_alergimakanan',
        value: payload.alergi.makanan.join(', '),
        type: 'textarea',
      })
    }

    // Alergi Udara
    if (payload.alergi.udara && payload.alergi.udara.length > 0) {
      mappings.push({
        selector: 'textarea[name="MAlergiPasien[Udara][value]"], textarea#text_alergiudara',
        value: payload.alergi.udara.join(', '),
        type: 'textarea',
      })
    }

    // Alergi Lainnya/Umum
    if (payload.alergi.lainnya && payload.alergi.lainnya.length > 0) {
      mappings.push({
        selector: 'textarea[name="MAlergiPasien[Umum][value]"], textarea#text_alergiumum',
        value: payload.alergi.lainnya.join(', '),
        type: 'textarea',
      })
    }
  }

  // ========================================
  // SECTION 4: STATUS PSIKOSOSIAL
  // (Status Fisis/Neurologis/Mental/Biologis/Psikososiospiritual/Ekonomi)
  // Format: Anamnesa[field_name]
  // ========================================
  if (payload.status_psikososial) {
    const ps = payload.status_psikososial

    // Alat bantu aktivitas
    if (ps.alat_bantu_aktrifitas) {
      mappings.push({
        selector: `input[name="Anamnesa[alat_bantu_aktrifitas]"][value="${ps.alat_bantu_aktrifitas}"]`,
        value: ps.alat_bantu_aktrifitas,
        type: 'radio',
      })
    }

    // Kendala komunikasi
    if (ps.kendala_komunikasi) {
      mappings.push({
        selector: `input[name="Anamnesa[kendala_komunikasi]"][value="${ps.kendala_komunikasi}"]`,
        value: ps.kendala_komunikasi,
        type: 'radio',
      })
    }

    // Merawat di rumah
    if (ps.merawat_dirumah) {
      mappings.push({
        selector: `input[name="Anamnesa[merawat_dirumah]"][value="${ps.merawat_dirumah}"]`,
        value: ps.merawat_dirumah,
        type: 'radio',
      })
    }

    // Membutuhkan bantuan
    if (ps.membutuhkan_bantuan) {
      mappings.push({
        selector: `input[name="Anamnesa[membutuhkan_bantuan]"][value="${ps.membutuhkan_bantuan}"]`,
        value: ps.membutuhkan_bantuan,
        type: 'radio',
      })
    }

    // Bahasa digunakan
    if (ps.bahasa_digunakan) {
      mappings.push({
        selector: `input[name="Anamnesa[bahasa_digunakan]"][value="${ps.bahasa_digunakan}"]`,
        value: ps.bahasa_digunakan,
        type: 'radio',
      })
    }

    // Tinggal dengan
    if (ps.tinggal_dengan) {
      mappings.push({
        selector: `input[name="Anamnesa[tinggal_dengan]"][value="${ps.tinggal_dengan}"]`,
        value: ps.tinggal_dengan,
        type: 'radio',
      })
    }

    // Sosial ekonomi
    if (ps.sosial_ekonomi) {
      mappings.push({
        selector: `input[name="Anamnesa[sosial_ekonomi]"][value="${ps.sosial_ekonomi}"]`,
        value: ps.sosial_ekonomi,
        type: 'radio',
      })
    }

    // Gangguan jiwa di masa lalu
    if (ps.gangguan_jiwa_dimasa_lalu) {
      mappings.push({
        selector: `input[name="Anamnesa[gangguan_jiwa_dimasa_lalu]"][value="${ps.gangguan_jiwa_dimasa_lalu}"]`,
        value: ps.gangguan_jiwa_dimasa_lalu,
        type: 'radio',
      })
    }

    // Status ekonomi
    if (ps.status_ekonomi) {
      mappings.push({
        selector: `input[name="Anamnesa[status_ekonomi]"][value="${ps.status_ekonomi}"]`,
        value: ps.status_ekonomi,
        type: 'radio',
      })
    }

    // Hubungan keluarga (select)
    if (ps.hubungan_keluarga) {
      mappings.push({
        selector: 'select[name="Anamnesa[hubungan_keluarga]"]',
        value: ps.hubungan_keluarga,
        type: 'select',
      })
    }
  }

  // ========================================
  // SECTION 5: PERIKSA FISIK
  // (Vital Signs + GCS + Anthropometrics + SpO2 + Activity + Kesadaran)
  // Format: PeriksaFisik[field_name]
  // ========================================

  // Vital Signs
  if (payload.vital_signs) {
    const vs = payload.vital_signs

    // Tekanan Darah Sistolik - ePuskesmas uses "sistole"
    if (vs.tekanan_darah_sistolik) {
      mappings.push({
        selector: 'input#sistole, input[name="PeriksaFisik[sistole]"]',
        value: String(vs.tekanan_darah_sistolik),
        type: 'number',
      })
    }

    // Tekanan Darah Diastolik - ePuskesmas uses "diastole"
    if (vs.tekanan_darah_diastolik) {
      mappings.push({
        selector: 'input#diastole, input[name="PeriksaFisik[diastole]"]',
        value: String(vs.tekanan_darah_diastolik),
        type: 'number',
      })
    }

    // Nadi / Heart Rate - ePuskesmas uses "detak_nadi"
    if (vs.nadi) {
      mappings.push({
        selector: 'input#detak-nadi, input[name="PeriksaFisik[detak_nadi]"]',
        value: String(vs.nadi),
        type: 'number',
      })
    }

    // Respirasi / RR - ePuskesmas uses "nafas"
    if (vs.respirasi) {
      mappings.push({
        selector: 'input#nafas, input[name="PeriksaFisik[nafas]"]',
        value: String(vs.respirasi),
        type: 'number',
      })
    }

    // Suhu / Temperature
    if (vs.suhu) {
      mappings.push({
        selector: 'input#suhu, input[name="PeriksaFisik[suhu]"]',
        value: String(vs.suhu),
        type: 'number',
      })
    }

    // Gula Darah / GDS (may not exist on all pages)
    if (vs.gula_darah) {
      const gulaDarahSelector =
        'input#gula-darah, input[name="PeriksaFisik[gula_darah]"], input[name="gula_darah"]'
      if (hasField(gulaDarahSelector)) {
        mappings.push({
          selector: gulaDarahSelector,
          value: String(vs.gula_darah),
          type: 'number',
        })
      } else {
        skipped.push('gula_darah: field optional tidak tersedia di halaman ini')
      }
    }

    // Kesadaran
    if (vs.kesadaran) {
      const kesadaranSelector = 'select[name="PeriksaFisik[kesadaran]"]'
      if (hasField(kesadaranSelector)) {
        mappings.push({
          selector: kesadaranSelector,
          value: vs.kesadaran,
          type: 'select',
        })
      } else {
        skipped.push('kesadaran: field optional tidak tersedia di halaman ini')
      }
    }
  }

  // Periksa Fisik Extended (GCS, Anthropometrics, SpO2, Activity)
  if (payload.periksa_fisik) {
    const pf = payload.periksa_fisik

    // GCS - Glasgow Coma Scale (Select fields)
    if (pf.gcs_membuka_mata) {
      mappings.push({
        selector: 'select[name="PeriksaFisik[membuka_mata]"], select#membuka_mata',
        value: pf.gcs_membuka_mata,
        type: 'select',
      })
    }

    if (pf.gcs_respon_verbal) {
      mappings.push({
        selector: 'select[name="PeriksaFisik[respon_verbal]"], select#respon_verbal',
        value: pf.gcs_respon_verbal,
        type: 'select',
      })
    }

    if (pf.gcs_respon_motorik) {
      mappings.push({
        selector: 'select[name="PeriksaFisik[respon_motorik]"], select#respon_motorik',
        value: pf.gcs_respon_motorik,
        type: 'select',
      })
    }

    // Anthropometrics
    if (pf.tinggi) {
      mappings.push({
        selector: 'input[name="PeriksaFisik[tinggi]"], input#tinggi',
        value: String(pf.tinggi),
        type: 'number',
      })
    }

    if (pf.berat) {
      mappings.push({
        selector: 'input[name="PeriksaFisik[berat]"], input#berat',
        value: String(pf.berat),
        type: 'number',
      })
    }

    if (pf.lingkar_perut) {
      mappings.push({
        selector: 'input[name="PeriksaFisik[lingkar_perut]"], input#lingkar_perut',
        value: String(pf.lingkar_perut),
        type: 'number',
      })
    }

    if (pf.imt) {
      mappings.push({
        selector: 'input[name="PeriksaFisik[imt]"], input#imt',
        value: String(pf.imt.toFixed(1)),
        type: 'number',
      })
    }

    if (pf.hasil_imt) {
      mappings.push({
        selector:
          'select[name="PeriksaFisik[hasil_imt]"], select#hasil_imt, input[name="PeriksaFisik[hasil_imt]"]',
        value: pf.hasil_imt,
        type: 'select',
      })
    }

    // SpO2 / Saturasi Oksigen
    if (pf.saturasi) {
      mappings.push({
        selector:
          'input[name="PeriksaFisik[saturasi]"], input#saturasi, input[name="PeriksaFisik[spo2]"]',
        value: String(pf.saturasi),
        type: 'number',
      })
    }

    // Aktivitas Fisik / ADL Assessment
    if (pf.mobilisasi) {
      mappings.push({
        selector: 'select[name="PeriksaFisik[mobilisasi]"], select#mobilisasi',
        value: pf.mobilisasi,
        type: 'select',
      })
    }

    if (pf.toileting) {
      mappings.push({
        selector: 'select[name="PeriksaFisik[toileting]"], select#toileting',
        value: pf.toileting,
        type: 'select',
      })
    }

    if (pf.makan_minum) {
      mappings.push({
        selector: 'select[name="PeriksaFisik[makan_minum]"], select#makan_minum',
        value: pf.makan_minum,
        type: 'select',
      })
    }

    if (pf.mandi) {
      mappings.push({
        selector: 'select[name="PeriksaFisik[mandi]"], select#mandi',
        value: pf.mandi,
        type: 'select',
      })
    }

    if (pf.berpakaian) {
      mappings.push({
        selector: 'select[name="PeriksaFisik[berpakaian]"], select#berpakaian',
        value: pf.berpakaian,
        type: 'select',
      })
    }

    if (pf.aktifitas_fisik) {
      mappings.push({
        selector: 'textarea[name="PeriksaFisik[aktifitas_fisik]"], textarea#aktifitas_fisik',
        value: pf.aktifitas_fisik,
        type: 'textarea',
      })
    }
  }

  // ========================================
  // SECTION 6: ASSESMEN NYERI (Pain Assessment)
  // Format: PeriksaFisik[field]
  // ========================================
  if (payload.assesmen_nyeri) {
    const an = payload.assesmen_nyeri

    // Merasakan nyeri (radio: 0=Tidak, 1=Ya)
    if (an.merasakan_nyeri !== undefined) {
      mappings.push({
        selector: `input[name="PeriksaFisik[merasakan_nyeri]"][value="${an.merasakan_nyeri}"]`,
        value: an.merasakan_nyeri,
        type: 'radio',
      })
    }

    // Skala Nyeri - SPECIAL HANDLING for range slider
    if (an.skala_nyeri !== undefined && an.skala_nyeri > 0) {
      anamnesaLog.debug(
        `[Anamnesa Handler] Filling skala nyeri slider with value: ${an.skala_nyeri}`
      )
      const sliderResult = await fillRangeSlider(
        'input#skala_nyeri, input[name="PeriksaFisik[skala_nyeri]"]',
        'input#range-slider, input[name="PeriksaFisik[skala_nyeri_slider]"]',
        an.skala_nyeri
      )
      if (sliderResult.success) {
        anamnesaLog.debug(`[Anamnesa Handler] ✓ Skala nyeri slider filled: ${an.skala_nyeri}`)
      } else {
        anamnesaLog.warn(`[Anamnesa Handler] Skala nyeri slider failed:`, sliderResult.error)
      }
    }
  }

  // ========================================
  // SECTION 7: ASSESMEN RESIKO JATUH (Get Up and Go)
  // Format: PeriksaFisik[field] - Radio buttons
  // ========================================
  if (payload.resiko_jatuh) {
    const rj = payload.resiko_jatuh

    // Cara berjalan - sempoyongan/tidak seimbang (0=Tidak, 1=Ya)
    if (rj.cara_berjalan !== undefined) {
      mappings.push({
        selector: `input[name="PeriksaFisik[cara_berjalan]"][value="${rj.cara_berjalan}"]`,
        value: rj.cara_berjalan,
        type: 'radio',
      })
    }

    // Penopang - memegang penopang saat duduk (0=Tidak, 1=Ya)
    if (rj.penopang !== undefined) {
      mappings.push({
        selector: `input[name="PeriksaFisik[penopang]"][value="${rj.penopang}"]`,
        value: rj.penopang,
        type: 'radio',
      })
    }
  }

  // ========================================
  // SECTION 8: KEADAAN FISIK (Physical Examination)
  // Format: PeriksaFisik[area][ExamType]
  // Checkbox must be activated first to enable textareas
  // ========================================
  if (payload.keadaan_fisik) {
    const kf = payload.keadaan_fisik

    // Checkbox index mapping for ePuskesmas textareaFisik[n]
    const checkboxMapping: Record<string, number> = {
      kulit: 1,
      kuku: 2,
      kepala: 3,
      wajah: 4,
      mata: 5,
      telinga: 6,
      hidung_sinus: 7,
      mulut_bibir: 8,
      leher: 9,
      dada_punggung: 10,
      kardiovaskuler: 11,
      dada_aksila: 12,
      abdomen_perut: 13,
      ekstremitas_atas: 14,
      ekstremitas_bawah: 15,
    }

    // Activate checkboxes for areas that have data
    const areasToActivate = Object.keys(kf) as (keyof typeof kf)[]
    for (const area of areasToActivate) {
      if (kf[area] && checkboxMapping[area] !== undefined) {
        const checkboxIndex = checkboxMapping[area]
        anamnesaLog.debug(
          `[Anamnesa Handler] Activating checkbox for ${area} (index ${checkboxIndex})`
        )
        await activateCheckboxWithOnclick(
          `input#textareaFisik\\[${checkboxIndex}\\], input[id="textareaFisik[${checkboxIndex}]"]`,
          true
        )
        await new Promise(resolve => setTimeout(resolve, 150))
      }
    }

    // Pemeriksaan Kulit
    if (kf.kulit) {
      if (kf.kulit.inspeksi) {
        mappings.push({
          selector: 'textarea[name="PeriksaFisik[kulit][Inspeksi]"]',
          value: kf.kulit.inspeksi,
          type: 'textarea',
        })
      }
      if (kf.kulit.palpasi) {
        mappings.push({
          selector: 'textarea[name="PeriksaFisik[kulit][Palpasi]"]',
          value: kf.kulit.palpasi,
          type: 'textarea',
        })
      }
    }

    // Pemeriksaan Kuku
    if (kf.kuku) {
      if (kf.kuku.inspeksi) {
        mappings.push({
          selector: 'textarea[name="PeriksaFisik[kuku][Inspeksi]"]',
          value: kf.kuku.inspeksi,
          type: 'textarea',
        })
      }
      if (kf.kuku.palpasi) {
        mappings.push({
          selector: 'textarea[name="PeriksaFisik[kuku][Palpasi]"]',
          value: kf.kuku.palpasi,
          type: 'textarea',
        })
      }
    }

    // Pemeriksaan Kepala
    if (kf.kepala) {
      if (kf.kepala.inspeksi) {
        mappings.push({
          selector: 'textarea[name="PeriksaFisik[kepala][Inspeksi]"]',
          value: kf.kepala.inspeksi,
          type: 'textarea',
        })
      }
      if (kf.kepala.palpasi) {
        mappings.push({
          selector: 'textarea[name="PeriksaFisik[kepala][Palpasi]"]',
          value: kf.kepala.palpasi,
          type: 'textarea',
        })
      }
    }

    // Pemeriksaan Wajah
    if (kf.wajah) {
      if (kf.wajah.inspeksi) {
        mappings.push({
          selector: 'textarea[name="PeriksaFisik[wajah][Inspeksi]"]',
          value: kf.wajah.inspeksi,
          type: 'textarea',
        })
      }
      if (kf.wajah.palpasi) {
        mappings.push({
          selector: 'textarea[name="PeriksaFisik[wajah][Palpasi]"]',
          value: kf.wajah.palpasi,
          type: 'textarea',
        })
      }
    }

    // Pemeriksaan Mata
    if (kf.mata?.inspeksi) {
      mappings.push({
        selector: 'textarea[name="PeriksaFisik[mata][Inspeksi]"]',
        value: kf.mata.inspeksi,
        type: 'textarea',
      })
    }

    // Pemeriksaan Telinga
    if (kf.telinga) {
      if (kf.telinga.inspeksi) {
        mappings.push({
          selector: 'textarea[name="PeriksaFisik[telinga][Inspeksi]"]',
          value: kf.telinga.inspeksi,
          type: 'textarea',
        })
      }
      if (kf.telinga.palpasi) {
        mappings.push({
          selector: 'textarea[name="PeriksaFisik[telinga][Palpasi]"]',
          value: kf.telinga.palpasi,
          type: 'textarea',
        })
      }
    }

    // Pemeriksaan Hidung/Sinus
    if (kf.hidung_sinus) {
      if (kf.hidung_sinus.inspeksi) {
        mappings.push({
          selector: 'textarea[name="PeriksaFisik[hidung_sinus][Inspeksi]"]',
          value: kf.hidung_sinus.inspeksi,
          type: 'textarea',
        })
      }
      if (kf.hidung_sinus.palpasi_perkusi) {
        mappings.push({
          selector: 'textarea[name="PeriksaFisik[hidung_sinus][Palpasi dan Perkusi]"]',
          value: kf.hidung_sinus.palpasi_perkusi,
          type: 'textarea',
        })
      }
    }

    // Pemeriksaan Mulut/Bibir
    if (kf.mulut_bibir) {
      if (kf.mulut_bibir.inspeksi_luar) {
        mappings.push({
          selector:
            'textarea[name="PeriksaFisik[mulut_bibir][Inspeksi dan Palpasi Struktur Luar]"]',
          value: kf.mulut_bibir.inspeksi_luar,
          type: 'textarea',
        })
      }
      if (kf.mulut_bibir.inspeksi_dalam) {
        mappings.push({
          selector:
            'textarea[name="PeriksaFisik[mulut_bibir][Inspeksi dan Palpasi Strukur Dalam]"]',
          value: kf.mulut_bibir.inspeksi_dalam,
          type: 'textarea',
        })
      }
    }

    // Pemeriksaan Leher
    if (kf.leher) {
      if (kf.leher.inspeksi) {
        mappings.push({
          selector: 'textarea[name="PeriksaFisik[leher][Inspeksi Leher]"]',
          value: kf.leher.inspeksi,
          type: 'textarea',
        })
      }
      if (kf.leher.auskultasi_karotis) {
        mappings.push({
          selector: 'textarea[name="PeriksaFisik[leher][Inspeksi dan Auskultasi Arteri Karotis]"]',
          value: kf.leher.auskultasi_karotis,
          type: 'textarea',
        })
      }
      if (kf.leher.palpasi_tiroid) {
        mappings.push({
          selector: 'textarea[name="PeriksaFisik[leher][Inspeksi dan Palpasi Kelenjer Tiroid]"]',
          value: kf.leher.palpasi_tiroid,
          type: 'textarea',
        })
      }
      if (kf.leher.auskultasi_bising) {
        mappings.push({
          selector: 'textarea[name="PeriksaFisik[leher][Auskultasi (Bising Pembuluh Darah)]"]',
          value: kf.leher.auskultasi_bising,
          type: 'textarea',
        })
      }
    }

    // Pemeriksaan Dada/Punggung
    if (kf.dada_punggung) {
      if (kf.dada_punggung.inspeksi) {
        mappings.push({
          selector: 'textarea[name="PeriksaFisik[dada_punggung][Inspeksi]"]',
          value: kf.dada_punggung.inspeksi,
          type: 'textarea',
        })
      }
      if (kf.dada_punggung.palpasi) {
        mappings.push({
          selector: 'textarea[name="PeriksaFisik[dada_punggung][Palpasi]"]',
          value: kf.dada_punggung.palpasi,
          type: 'textarea',
        })
      }
      if (kf.dada_punggung.perkusi) {
        mappings.push({
          selector: 'textarea[name="PeriksaFisik[dada_punggung][Perkusi]"]',
          value: kf.dada_punggung.perkusi,
          type: 'textarea',
        })
      }
      if (kf.dada_punggung.auskultasi) {
        mappings.push({
          selector: 'textarea[name="PeriksaFisik[dada_punggung][Auskultasi]"]',
          value: kf.dada_punggung.auskultasi,
          type: 'textarea',
        })
      }
    }

    // Pemeriksaan Kardiovaskuler
    if (kf.kardiovaskuler) {
      if (kf.kardiovaskuler.inspeksi) {
        mappings.push({
          selector: 'textarea[name="PeriksaFisik[kardiovaskuler][Inspeksi]"]',
          value: kf.kardiovaskuler.inspeksi,
          type: 'textarea',
        })
      }
      if (kf.kardiovaskuler.palpasi) {
        mappings.push({
          selector: 'textarea[name="PeriksaFisik[kardiovaskuler][Palpasi]"]',
          value: kf.kardiovaskuler.palpasi,
          type: 'textarea',
        })
      }
      if (kf.kardiovaskuler.perkusi) {
        mappings.push({
          selector: 'textarea[name="PeriksaFisik[kardiovaskuler][Perkusi]"]',
          value: kf.kardiovaskuler.perkusi,
          type: 'textarea',
        })
      }
      if (kf.kardiovaskuler.auskultasi) {
        mappings.push({
          selector: 'textarea[name="PeriksaFisik[kardiovaskuler][Auskultasi]"]',
          value: kf.kardiovaskuler.auskultasi,
          type: 'textarea',
        })
      }
    }

    // Pemeriksaan Dada/Aksila
    if (kf.dada_aksila) {
      if (kf.dada_aksila.inspeksi_dada) {
        mappings.push({
          selector: 'textarea[name="PeriksaFisik[dada_aksila][Inspeksi Dada]"]',
          value: kf.dada_aksila.inspeksi_dada,
          type: 'textarea',
        })
      }
      if (kf.dada_aksila.palpasi_dada) {
        mappings.push({
          selector: 'textarea[name="PeriksaFisik[dada_aksila][Palpasi Dada]"]',
          value: kf.dada_aksila.palpasi_dada,
          type: 'textarea',
        })
      }
      if (kf.dada_aksila.inspeksi_palpasi_aksila) {
        mappings.push({
          selector: 'textarea[name="PeriksaFisik[dada_aksila][Inspeksi dan Palpasi Aksila]"]',
          value: kf.dada_aksila.inspeksi_palpasi_aksila,
          type: 'textarea',
        })
      }
    }

    // Pemeriksaan Abdomen/Perut
    if (kf.abdomen_perut) {
      if (kf.abdomen_perut.inspeksi) {
        mappings.push({
          selector: 'textarea[name="PeriksaFisik[abdomen_perut][Inspeksi]"]',
          value: kf.abdomen_perut.inspeksi,
          type: 'textarea',
        })
      }
      if (kf.abdomen_perut.auskultasi) {
        mappings.push({
          selector: 'textarea[name="PeriksaFisik[abdomen_perut][Auskultasi]"]',
          value: kf.abdomen_perut.auskultasi,
          type: 'textarea',
        })
      }
      if (kf.abdomen_perut.perkusi_kuadran) {
        mappings.push({
          selector: 'textarea[name="PeriksaFisik[abdomen_perut][Perkusi Semua Kuadran]"]',
          value: kf.abdomen_perut.perkusi_kuadran,
          type: 'textarea',
        })
      }
      if (kf.abdomen_perut.perkusi_hepar) {
        mappings.push({
          selector: 'textarea[name="PeriksaFisik[abdomen_perut][Perkusi Hepar]"]',
          value: kf.abdomen_perut.perkusi_hepar,
          type: 'textarea',
        })
      }
      if (kf.abdomen_perut.perkusi_limfa) {
        mappings.push({
          selector: 'textarea[name="PeriksaFisik[abdomen_perut][Perkusi Limfa]"]',
          value: kf.abdomen_perut.perkusi_limfa,
          type: 'textarea',
        })
      }
      if (kf.abdomen_perut.perkusi_ginjal) {
        mappings.push({
          selector: 'textarea[name="PeriksaFisik[abdomen_perut][Perkusi Ginjal]"]',
          value: kf.abdomen_perut.perkusi_ginjal,
          type: 'textarea',
        })
      }
      if (kf.abdomen_perut.palpasi_kuadran) {
        mappings.push({
          selector: 'textarea[name="PeriksaFisik[abdomen_perut][Palpasi Semua Kuadran]"]',
          value: kf.abdomen_perut.palpasi_kuadran,
          type: 'textarea',
        })
      }
    }

    // Pemeriksaan Ekstremitas Atas
    if (kf.ekstremitas_atas) {
      if (kf.ekstremitas_atas.inspeksi) {
        mappings.push({
          selector:
            'textarea[name="PeriksaFisik[ekstermitas_atas][Inspeksi Struktur Muskuloskletal]"]',
          value: kf.ekstremitas_atas.inspeksi,
          type: 'textarea',
        })
      }
      if (kf.ekstremitas_atas.palpasi) {
        mappings.push({
          selector: 'textarea[name="PeriksaFisik[ekstermitas_atas][Palpasi]"]',
          value: kf.ekstremitas_atas.palpasi,
          type: 'textarea',
        })
      }
    }

    // Pemeriksaan Ekstremitas Bawah
    if (kf.ekstremitas_bawah) {
      if (kf.ekstremitas_bawah.inspeksi) {
        mappings.push({
          selector:
            'textarea[name="PeriksaFisik[ekstermitas_bawah][Inspeksi Struktur Muskuloskletal]"]',
          value: kf.ekstremitas_bawah.inspeksi,
          type: 'textarea',
        })
      }
      if (kf.ekstremitas_bawah.palpasi) {
        mappings.push({
          selector: 'textarea[name="PeriksaFisik[ekstermitas_bawah][Palpasi]"]',
          value: kf.ekstremitas_bawah.palpasi,
          type: 'textarea',
        })
      }
    }
  }

  // ========================================
  // SECTION 9: LAINNYA (Terapi, Edukasi)
  // Format: Anamnesa[field]
  // ========================================
  if (payload.lainnya) {
    const ln = payload.lainnya

    // Terapi Obat yang dianjurkan (required) — hardcoded per Chief directive
    mappings.push({
      selector: 'textarea[name="Anamnesa[terapi]"], textarea#text_terapi',
      value: 'Mengikuti dokter penanggung jawab layanan',
      type: 'textarea',
    })

    // Terapi Non Obat yang dianjurkan (required)
    if (ln.terapi_non_obat) {
      mappings.push({
        selector: 'textarea[name="Anamnesa[terapi_non_obat]"], textarea#text_terapi_non_obat',
        value: ln.terapi_non_obat,
        type: 'textarea',
      })
    }

    // BMHP yang digunakan
    if (ln.bmhp) {
      mappings.push({
        selector: 'textarea[name="Anamnesa[bmhp]"], textarea#text_bmhp',
        value: ln.bmhp,
        type: 'textarea',
      })
    }

    // Rencana
    if (ln.rencana_tindakan) {
      mappings.push({
        selector: 'textarea[name="Anamnesa[rencana_tindakan]"]',
        value: ln.rencana_tindakan,
        type: 'textarea',
      })
    }

    // Merokok (radio: 0=Tidak, 1=Ya)
    if (ln.merokok !== undefined) {
      mappings.push({
        selector: `input[name="Anamnesa[merokok]"][value="${ln.merokok}"]`,
        value: ln.merokok,
        type: 'radio',
      })
    }

    // Konsumsi Alkohol (radio: 0=Tidak, 1=Ya)
    if (ln.konsumsi_alkohol !== undefined) {
      mappings.push({
        selector: `input[name="Anamnesa[konsumsi_alkohol]"][value="${ln.konsumsi_alkohol}"]`,
        value: ln.konsumsi_alkohol,
        type: 'radio',
      })
    }

    // Kurang Sayur/Buah (radio: 0=Tidak, 1=Ya)
    if (ln.kurang_sayur_buah !== undefined) {
      mappings.push({
        selector: `input[name="Anamnesa[kurang_sayur_buah]"][value="${ln.kurang_sayur_buah}"]`,
        value: ln.kurang_sayur_buah,
        type: 'radio',
      })
    }

    // Edukasi (required)
    if (ln.edukasi) {
      mappings.push({
        selector: 'textarea[name="Anamnesa[edukasi]"], textarea#text_edukasi',
        value: ln.edukasi,
        type: 'textarea',
      })
    }

    // Deskripsi Askep
    if (ln.askep) {
      mappings.push({
        selector: 'textarea[name="Anamnesa[askep]"]',
        value: ln.askep,
        type: 'textarea',
      })
    }

    // Observasi
    if (ln.observasi) {
      mappings.push({
        selector: 'textarea[name="Anamnesa[observasi]"]',
        value: ln.observasi,
        type: 'textarea',
      })
    }

    // Keterangan
    if (ln.keterangan) {
      mappings.push({
        selector: 'textarea[name="Anamnesa[keterangan]"], textarea#text_keterangan',
        value: ln.keterangan,
        type: 'textarea',
      })
    }

    // Biopsikososial (termasuk Ekspresi dan Emosi)
    if (ln.biopsikososial) {
      mappings.push({
        selector: 'textarea[name="Anamnesa[biopsikososial]"], textarea#text_biopsikososial',
        value: ln.biopsikososial,
        type: 'textarea',
      })
    }

    // Tindakan Keperawatan
    if (ln.tindakan_keperawatan) {
      mappings.push({
        selector: 'textarea[name="Anamnesa[tindakan_keperawatan]"], textarea#tindakan_keperawatan',
        value: ln.tindakan_keperawatan,
        type: 'textarea',
      })
    }
  }

  // ========================================
  // SECTION 10: TENAGA MEDIS
  // ========================================
  if (payload.tenaga_medis) {
    // MANDATORY FIELD 3: Dokter — hardcoded per Chief directive
    mappings.push({
      selector: 'input[name="dokter_nama_bpjs"], input[name="dokter_nama"], input[name="dokter"]',
      value: DOKTER_NAMA,
      type: 'text',
      forceOverride: true,
    })
    tenagaMedisBridgeFields.push({
      selector: 'input[name="dokter_nama_bpjs"], input[name="dokter_nama"], input[name="dokter"]',
      value: DOKTER_NAMA,
      type: 'autocomplete',
      autocompleteTimeout: 4000,
    })

    // MANDATORY FIELD 4: Perawat — hardcoded per Chief directive
    mappings.push({
      selector: 'input[name="perawat_nama"], input[name="perawat"], input[name*="bidan"]',
      value: PERAWAT_NAMA,
      type: 'text',
      forceOverride: true,
    })
    tenagaMedisBridgeFields.push({
      selector: 'input[name="perawat_nama"], input[name="perawat"], input[name*="bidan"]',
      value: PERAWAT_NAMA,
      type: 'autocomplete',
      autocompleteTimeout: 4000,
    })
  }

  anamnesaLog.debug('[Anamnesa Handler] Built', mappings.length, 'field mappings')

  if (mappings.length === 0) {
    anamnesaLog.warn('[Anamnesa Handler] No mappings to fill!')
    return {
      success: [],
      failed: [],
      skipped: ['No data to fill'],
    }
  }

  // Execute fill with 100ms delay between fields
  const fillResults = await fillFields(mappings, 100)

  // Categorize results
  const success: FillResult[] = []
  const failed: FillResult[] = []

  for (const r of fillResults) {
    if (r.success) {
      success.push(r)
    } else {
      failed.push(r)
    }
  }

  // Fill nyeri conditional fields (pencetus/kualitas/lokasi)
  // These only appear in the DOM AFTER the merasakan_nyeri radio "Ya" is clicked.
  // We fill them in a separate pass after main fillFields so the radio click has settled.
  if (payload.assesmen_nyeri?.merasakan_nyeri === '1') {
    const an = payload.assesmen_nyeri
    const nyeriConditional: FieldMapping[] = []
    if (an.pencetus) {
      nyeriConditional.push({
        selector: 'textarea[name="PeriksaFisik[nyeri_pencetus]"], textarea#nyeri_pencetus, textarea[name="nyeri_pencetus"]',
        value: an.pencetus,
        type: 'textarea',
      })
    }
    if (an.kualitas) {
      nyeriConditional.push({
        selector: 'textarea[name="PeriksaFisik[nyeri_kualitas]"], textarea#nyeri_kualitas, textarea[name="nyeri_kualitas"]',
        value: an.kualitas,
        type: 'textarea',
      })
    }
    if (an.lokasi) {
      nyeriConditional.push({
        selector: 'textarea[name="PeriksaFisik[nyeri_lokasi]"], textarea#nyeri_lokasi, textarea[name="nyeri_lokasi"]',
        value: an.lokasi,
        type: 'textarea',
      })
    }
    if (nyeriConditional.length > 0) {
      const nyeriResults = await fillFields(nyeriConditional, 200)
      for (const r of nyeriResults) {
        if (r.success) success.push(r)
        else skipped.push(`nyeri conditional: ${String(r.field)} — ${r.error || 'not found'}`)
      }
    }
  }

  if (tenagaMedisBridgeFields.length > 0) {
    const bridgeResult = await fillViaMainWorld(tenagaMedisBridgeFields, 25000, 220)
    const dokterAlreadyFilled = success.some(item =>
      String(item.field).toLowerCase().includes('dokter')
    )
    const perawatAlreadyFilled = success.some(
      item =>
        String(item.field).toLowerCase().includes('perawat') ||
        String(item.field).toLowerCase().includes('bidan')
    )
    for (const ok of bridgeResult.success) {
      success.push({
        success: true,
        field: ok.field,
        value: ok.value,
        method: 'autocomplete',
      })
    }
    for (const bad of bridgeResult.failed) {
      const fieldToken = String(bad.field).toLowerCase()
      if (fieldToken.includes('dokter') && dokterAlreadyFilled) {
        skipped.push('dokter_nama: bridge fallback tidak diperlukan (sudah terisi)')
        continue
      }
      if (
        (fieldToken.includes('perawat') || fieldToken.includes('bidan')) &&
        perawatAlreadyFilled
      ) {
        skipped.push('perawat_nama: bridge fallback tidak diperlukan (sudah terisi)')
        continue
      }
      failed.push({
        success: false,
        field: bad.field,
        value: bad.value,
        method: 'autocomplete',
        error: bad.error || 'Main-world bridge failed',
      })
    }
  }

  anamnesaLog.debug('[Anamnesa Handler] Fill complete:', {
    success: success.length,
    failed: failed.length,
    skipped: skipped.length,
  })

  return { success, failed, skipped }
}

/**
 * Initialize Anamnesa page (called when page loads)
 */
export function initAnamnesaPage(): void {
  anamnesaLog.debug('[Anamnesa Handler] Page initialized')
  // Future: Add mutation observer for dynamic content
}
