import { GLUCOSE_THRESHOLDS } from '@/lib/emergency-detector/glucose-classifier';
import { AutosenPreset } from '@/lib/clinical/autosen-types';
import {
  getVitalScreeningProfile,
  type VitalScreeningProfile,
} from '@/lib/clinical/vital-screening-thresholds';
import { generateVitals, type AassistPreset } from '@/lib/clinical/aassist-v2/vital-generator';

export interface VitalAutofillValues {
  sbp: string;
  dbp: string;
  hr: string;
  rr: string;
  temp: string;
  spo2: string;
  glucose: string;
}

export interface VitalAutofillResult {
  vitals: VitalAutofillValues;
  physiologyLabel: string;
  reasoning: string[];
}

interface NumericVitals {
  sbp: number;
  dbp: number;
  hr: number;
  rr: number;
  temp: number;
  spo2: number;
  glucose: number;
}

const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max);

const midpoint = (min: number, max: number): number => Math.round((min + max) / 2);

const formatInt = (value: number): string => Math.round(value).toString();

const formatTemp = (value: number): string => value.toFixed(1);

function buildBaselineVitals(profile: VitalScreeningProfile): NumericVitals {
  const sbp = profile.isPediatric
    ? profile.hypotensionSbpFloor + 12
    : profile.isOlderAdult
      ? 124
      : 118;
  const dbp = profile.isPediatric
    ? Math.max(52, Math.round(sbp * 0.62))
    : profile.isOlderAdult
      ? 74
      : 76;
  const hr = clamp(
    midpoint(profile.bradycardiaThreshold + 10, profile.tachycardiaThreshold - 14),
    profile.bradycardiaThreshold + 6,
    profile.tachycardiaThreshold - 6
  );
  const rr = clamp(
    midpoint(profile.bradypneaThreshold + 3, profile.tachypneaThreshold - 4),
    profile.bradypneaThreshold + 2,
    profile.tachypneaThreshold - 2
  );

  return {
    sbp,
    dbp,
    hr,
    rr,
    temp: profile.isOlderAdult ? 37.1 : 36.8,
    spo2: 98,
    glucose: 95,
  };
}

function applyPresetVitals(
  preset: AutosenPreset,
  profile: VitalScreeningProfile,
  baseline: NumericVitals
): { vitals: NumericVitals; reasoning: string[] } {
  switch (preset) {
    case 'hypertension':
      return {
        vitals: {
          ...baseline,
          sbp: profile.severeHypertensionSbp,
          dbp: profile.severeHypertensionDbp,
          hr: Math.min(profile.tachycardiaThreshold - 6, baseline.hr + 10),
          spo2: 97,
          glucose: Math.max(baseline.glucose, 110),
        },
        reasoning: [
          `Tekanan darah diisi pada ambang hipertensi berat untuk ${profile.label}.`,
          'Nadi dipertahankan sedikit naik tanpa menghapus konteks hemodinamik utama.',
          'Semua gate alert lain tetap dihitung ulang dari nilai yang baru terisi.',
        ],
      };

    case 'hyperglycemia':
      return {
        vitals: {
          ...baseline,
          hr: Math.min(profile.tachycardiaThreshold - 6, baseline.hr + 14),
          rr: Math.min(profile.tachypneaThreshold - 2, baseline.rr + 4),
          spo2: 97,
          glucose: Math.max(GLUCOSE_THRESHOLDS.DIABETES.GDS + 120, 320),
        },
        reasoning: [
          'Glukosa diisi di atas ambang hiperglikemia berat agar gate glukosa aktif.',
          'Nadi dan RR dinaikkan ringan untuk meniru stres metabolik tanpa memaksa syok.',
          'Tekanan darah dan suhu dipertahankan dekat baseline fisiologis pasien.',
        ],
      };

    case 'hypoglycemia':
      return {
        vitals: {
          ...baseline,
          sbp: Math.max(profile.hypotensionSbpFloor + 4, baseline.sbp - 6),
          dbp: Math.max(profile.isPediatric ? 48 : 58, baseline.dbp - 4),
          hr: Math.min(profile.tachycardiaThreshold - 6, baseline.hr + 12),
          glucose: Math.max(40, GLUCOSE_THRESHOLDS.HYPOGLYCEMIA - 12),
        },
        reasoning: [
          'Glukosa diisi di bawah 70 mg/dL agar algoritme hipoglikemia aktif penuh.',
          'Tekanan darah dibuat low-normal dan nadi sedikit naik untuk mencerminkan kompensasi awal.',
          'Nilai lain tetap dijaga realistis terhadap cohort usia pasien.',
        ],
      };

    case 'glucose_tolerance':
      return {
        vitals: {
          ...baseline,
          glucose: clamp(GLUCOSE_THRESHOLDS.PREDIABETES.TTGO_2H.min + 20, 140, 199),
        },
        reasoning: [
          'Glukosa diisi pada rentang toleransi glukosa terganggu, bukan krisis.',
          'Vital sign lain dipertahankan mendekati baseline agar preset ini tidak memunculkan alert palsu.',
        ],
      };

    case 'adl':
    default:
      return {
        vitals: baseline,
        reasoning: [
          'Preset ADL memakai baseline fisiologis usia karena fokusnya adalah konteks fungsi, bukan sindrom hemodinamik tertentu.',
          'Semua field tetap terisi otomatis agar form lengkap dan masih bisa disesuaikan manual.',
        ],
      };
  }
}

export function buildVitalAutofill(
  preset: AutosenPreset,
  patientAge: number,
  seed?: number,
): VitalAutofillResult {
  // For presets that map to the v2 random generator, use it for proper ranges
  const v2PresetMap: Partial<Record<AutosenPreset, AassistPreset>> = {
    hypertension:  'hipertensi',
    hypotension:   'hipotensi',
    hyperglycemia: 'hiperglikemi',
  };

  const v2Preset = v2PresetMap[preset];
  if (v2Preset !== undefined) {
    const result = generateVitals({ preset: v2Preset, seed });
    return {
      physiologyLabel: `Preset ${v2Preset} (v2 random)`,
      reasoning: result.reasoning,
      vitals: result.vitals,
    };
  }

  // adl / glucose_tolerance / hypoglycemia: use profile-aware deterministic logic with optional jitter
  const profile = getVitalScreeningProfile(patientAge || 0);
  const baseline = buildBaselineVitals(profile);
  const { vitals, reasoning } = applyPresetVitals(preset, profile, baseline);

  return {
    physiologyLabel: profile.label,
    reasoning,
    vitals: {
      sbp: formatInt(vitals.sbp),
      dbp: formatInt(vitals.dbp),
      hr: formatInt(vitals.hr),
      rr: formatInt(vitals.rr),
      temp: formatTemp(vitals.temp),
      spo2: formatInt(vitals.spo2),
      glucose: formatInt(vitals.glucose),
    },
  };
}
