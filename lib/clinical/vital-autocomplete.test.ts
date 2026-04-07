import { describe, expect, it } from 'vitest';

import { buildAlerts } from '@/components/clinical/TTVInferenceUI';
import { buildVitalAutofill } from '@/lib/clinical/vital-autocomplete';
import { getVitalScreeningProfile } from '@/lib/clinical/vital-screening-thresholds';

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
  it('uses crisis blood pressure values for hypertension preset in adults', () => {
    const profile = getVitalScreeningProfile(35);
    const autofill = buildVitalAutofill('hypertension', 35);

    expect(Number(autofill.vitals.sbp)).toBe(profile.severeHypertensionSbp);
    expect(Number(autofill.vitals.dbp)).toBe(profile.severeHypertensionDbp);

    const alerts = buildAlerts(
      makeState({
        ...autofill.vitals,
        autosenPreset: 'hypertension',
      }),
      { patientAge: 35 }
    );

    expect(alerts.some((alert) => alert.type === 'hypertensive_crisis')).toBe(true);
  });

  it('stays age-aware for pediatric hypertension preset', () => {
    const profile = getVitalScreeningProfile(8);
    const autofill = buildVitalAutofill('hypertension', 8);

    expect(Number(autofill.vitals.sbp)).toBe(profile.severeHypertensionSbp);
    expect(Number(autofill.vitals.hr)).toBeLessThan(profile.tachycardiaThreshold);
  });

  it('activates glucose gate for hyperglycemia preset', () => {
    const autofill = buildVitalAutofill('hyperglycemia', 42);
    const alerts = buildAlerts(
      makeState({
        ...autofill.vitals,
        autosenPreset: 'hyperglycemia',
      }),
      { patientAge: 42 }
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
