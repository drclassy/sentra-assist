import { describe, expect, it } from 'vitest';

import { buildAlerts } from './TTVInferenceUI';

const makeState = (overrides: Partial<Parameters<typeof buildAlerts>[0]> = {}): Parameters<typeof buildAlerts>[0] => ({
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

describe('buildAlerts geriatric screening', () => {
  it('adds orthostatic screening prompt for older adults with compatible symptoms', () => {
    const alerts = buildAlerts(
      makeState({
        sbp: '104',
        dbp: '68',
        hr: '88',
        symptomText: 'Pusing saat berdiri, sempat hampir pingsan',
      }),
      { patientAge: 70 }
    );

    expect(alerts.some((alert) => alert.type === 'orthostatic_check')).toBe(true);
  });

  it('flags low-grade fever as geriatric concern when atypical infection cues are present', () => {
    const alerts = buildAlerts(
      makeState({
        temp: '37.5',
        rr: '22',
        spo2: '94',
        symptomText: 'Lemas, bingung, dan intake turun sejak kemarin',
      }),
      { patientAge: 76 }
    );

    expect(alerts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'geriatric_low_grade_fever',
          severity: 'high',
        }),
      ])
    );
  });

  it('keeps low-grade fever silent for non-geriatric adults', () => {
    const alerts = buildAlerts(
      makeState({
        temp: '37.5',
        symptomText: 'Lemas dan batuk',
      }),
      { patientAge: 35 }
    );

    expect(alerts.some((alert) => alert.type === 'geriatric_low_grade_fever')).toBe(false);
    expect(alerts.some((alert) => alert.type === 'geriatric_fever')).toBe(false);
  });
});
