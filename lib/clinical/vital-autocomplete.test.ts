import { describe, expect, it } from 'vitest';

import { buildAlerts } from '@/components/clinical/TTVInferenceUI';
import { PRESET_RANGES } from '@/lib/clinical/aassist-v2/vital-generator';
import { buildVitalAutofill } from '@/lib/clinical/vital-autocomplete';
import { getVitalScreeningProfile } from '@/lib/clinical/vital-screening-thresholds';

const HYPERTENSION_SEED = 43;
const HYPERGLYCEMIA_SEED = 123;

const makeState = (
  overrides: Partial<Parameters<typeof buildAlerts>[0]> = {}
): Parameters<typeof buildAlerts>[0] => ({
  sbp: '',
  dbp: '',
  hr: '',
  rr: '',
  temp: '',
  spo2: '',
  glucose: '',
  symptomText: '',
  allergies: [],
  pregnancyStatus: null,
  disabilityType: '',
  obesityConfirmation: '',
  autosenPreset: 'adl',
  avpu: 'A',
  supplemental_o2: false,
  pain_score: '',
  ...overrides,
});

describe('buildVitalAutofill', () => {
  it('uses seeded v2 hypertension range and still triggers crisis alert in adults', () => {
    const autofill = buildVitalAutofill('hypertension', 35, HYPERTENSION_SEED);
    const sbp = Number(autofill.vitals.sbp);
    const dbp = Number(autofill.vitals.dbp);

    expect(sbp).toBeGreaterThanOrEqual(PRESET_RANGES.hipertensi.sbp.min);
    expect(sbp).toBeLessThanOrEqual(PRESET_RANGES.hipertensi.sbp.max);
    expect(dbp).toBeGreaterThanOrEqual(PRESET_RANGES.hipertensi.dbp.min);
    expect(dbp).toBeLessThanOrEqual(PRESET_RANGES.hipertensi.dbp.max);

    const alerts = buildAlerts(
      makeState({
        ...autofill.vitals,
        autosenPreset: 'hypertension',
      }),
      { patientAge: 35 }
    );

    expect(alerts.some((alert) => alert.type === 'hypertensive_crisis')).toBe(true);
  });

  it('keeps hypertension preset above pediatric severe threshold with deterministic seed', () => {
    const profile = getVitalScreeningProfile(8);
    const autofill = buildVitalAutofill('hypertension', 8, HYPERTENSION_SEED);
    const sbp = Number(autofill.vitals.sbp);

    expect(sbp).toBeGreaterThanOrEqual(profile.severeHypertensionSbp);
    expect(sbp).toBeLessThanOrEqual(PRESET_RANGES.hipertensi.sbp.max);
  });

  it('activates glucose gate for hyperglycemia preset', () => {
    const autofill = buildVitalAutofill('hyperglycemia', 42, HYPERGLYCEMIA_SEED);
    const alerts = buildAlerts(
      makeState({
        ...autofill.vitals,
        autosenPreset: 'hyperglycemia',
      }),
      { patientAge: 42 }
    );

    expect(Number(autofill.vitals.glucose)).toBeGreaterThanOrEqual(
      PRESET_RANGES.hiperglikemi.glucose.min
    );
    expect(Number(autofill.vitals.glucose)).toBeLessThanOrEqual(
      PRESET_RANGES.hiperglikemi.glucose.max
    );
    expect(Number(autofill.vitals.glucose)).toBeGreaterThanOrEqual(300);
    expect(alerts.some((alert) => alert.type === 'hyperglycemia')).toBe(true);
  });

  it('activates glucose gate for hypoglycemia preset', () => {
    const autofill = buildVitalAutofill('hypoglycemia', 42);
    const alerts = buildAlerts(
      makeState({
        ...autofill.vitals,
        autosenPreset: 'hypoglycemia',
      }),
      { patientAge: 42 }
    );

    expect(Number(autofill.vitals.glucose)).toBeLessThan(70);
    expect(alerts.some((alert) => alert.type === 'hypoglycemia')).toBe(true);
  });

  it('keeps glucose tolerance preset outside crisis range', () => {
    const autofill = buildVitalAutofill('glucose_tolerance', 42);
    const alerts = buildAlerts(
      makeState({
        ...autofill.vitals,
        autosenPreset: 'glucose_tolerance',
      }),
      { patientAge: 42 }
    );

    expect(Number(autofill.vitals.glucose)).toBeGreaterThanOrEqual(140);
    expect(Number(autofill.vitals.glucose)).toBeLessThan(200);
    expect(alerts.some((alert) => alert.type === 'hyperglycemia')).toBe(false);
    expect(alerts.some((alert) => alert.type === 'hypoglycemia')).toBe(false);
  });

  it('fills stable baseline values for ADL preset', () => {
    const autofill = buildVitalAutofill('adl', 70);

    expect(Number(autofill.vitals.spo2)).toBeGreaterThanOrEqual(97);
    expect(Number(autofill.vitals.glucose)).toBeGreaterThanOrEqual(90);
    expect(autofill.reasoning[0]).toContain('baseline fisiologis');
  });
});