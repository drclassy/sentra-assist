import { describe, it, expect, vi } from 'vitest';

// Mock extension APIs before any imports that trigger webextension-polyfill
const { mockSendMessage } = vi.hoisted(() => ({ mockSendMessage: vi.fn() }));
vi.mock('wxt/browser', () => ({ browser: { tabs: { sendMessage: vi.fn() }, runtime: { id: 'test' } } }));
vi.mock('@webext-core/messaging', () => ({
  defineExtensionMessaging: () => ({ sendMessage: mockSendMessage, onMessage: vi.fn() }),
}));

import {
  normalizeIcdCode,
  isReadableDiagnosisName,
  isLikelyIcdCode,
  buildUiFallbackDiagnoses,
  buildConfirmedChronicSuggestion,
} from './ClinicalDifferential';

// Minimal vitals for fallback diagnosis tests
const NORMAL_VITALS = { sbp: 120, dbp: 80, hr: 72, rr: 16, temp: 36.5, glucose: 100 };
const HIGH_RISK_VITALS = { sbp: 185, dbp: 115, hr: 125, rr: 25, temp: 37, glucose: 110 };

describe('normalizeIcdCode', () => {
  it('direct ICD match returns code as-is', () => {
    expect(normalizeIcdCode('J06.9')).toBe('J06.9');
    expect(normalizeIcdCode('I10')).toBe('I10');
    expect(normalizeIcdCode('K21.0')).toBe('K21.0');
  });

  it('lowercase input is normalized to uppercase', () => {
    const result = normalizeIcdCode('j06.9');
    expect(result).toBe('J06.9');
  });

  it('leading "0" is mapped to "O" (emergency head map)', () => {
    // '0' → 'O', so '010' → 'O10'
    const result = normalizeIcdCode('010');
    expect(result).toMatch(/^O/);
  });

  it('empty or undefined returns empty string', () => {
    expect(normalizeIcdCode('')).toBe('');
    expect(normalizeIcdCode(undefined)).toBe('');
  });
});

describe('isReadableDiagnosisName', () => {
  it('valid readable name returns true', () => {
    expect(isReadableDiagnosisName('Hipertensi Esensial')).toBe(true);
    expect(isReadableDiagnosisName('Demam berdarah')).toBe(true);
  });

  it('only digits returns false', () => {
    expect(isReadableDiagnosisName('123')).toBe(false);
  });

  it('empty string returns false', () => {
    expect(isReadableDiagnosisName('')).toBe(false);
    expect(isReadableDiagnosisName(undefined)).toBe(false);
  });

  it('too short (< 3 chars) returns false', () => {
    expect(isReadableDiagnosisName('AB')).toBe(false);
  });

  it('no letters at all returns false', () => {
    expect(isReadableDiagnosisName('12.3')).toBe(false);
  });
});

describe('isLikelyIcdCode', () => {
  it('valid ICD-10 code returns true', () => {
    expect(isLikelyIcdCode('I10')).toBe(true);
    expect(isLikelyIcdCode('J06.9')).toBe(true);
    expect(isLikelyIcdCode('K21.0')).toBe(true);
  });

  it('plain text returns false', () => {
    expect(isLikelyIcdCode('Hipertensi')).toBe(false);
    expect(isLikelyIcdCode('random')).toBe(false);
  });

  it('empty/undefined returns false', () => {
    expect(isLikelyIcdCode('')).toBe(false);
    expect(isLikelyIcdCode(undefined)).toBe(false);
  });
});

describe('buildUiFallbackDiagnoses', () => {
  describe('chest pain complaint', () => {
    it('returns I20.9 (ACS suspect) for "nyeri dada"', () => {
      const result = buildUiFallbackDiagnoses('nyeri dada', NORMAL_VITALS);
      expect(result[0].icd_x).toBe('I20.9');
    });

    it('higher confidence when hemodynamic risk present (SBP ≥180)', () => {
      const lowRisk = buildUiFallbackDiagnoses('nyeri dada', NORMAL_VITALS);
      const highRisk = buildUiFallbackDiagnoses('nyeri dada', HIGH_RISK_VITALS);
      expect(highRisk[0].confidence).toBeGreaterThan(lowRisk[0].confidence);
    });

    it('includes musculoskeletal as second suggestion', () => {
      const result = buildUiFallbackDiagnoses('nyeri dada', NORMAL_VITALS);
      expect(result.length).toBeGreaterThanOrEqual(2);
      expect(result[1].icd_x).toBe('M94.0');
    });
  });

  describe('generic complaint', () => {
    it('returns R69 for non-specific complaint', () => {
      const result = buildUiFallbackDiagnoses('demam batuk', NORMAL_VITALS);
      expect(result[0].icd_x).toBe('R69');
    });

    it('result has rank 1 and confidence < 0.5', () => {
      const result = buildUiFallbackDiagnoses('sakit kepala', NORMAL_VITALS);
      expect(result[0].rank).toBe(1);
      expect(result[0].confidence).toBeLessThan(0.5);
    });
  });
});

describe('buildConfirmedChronicSuggestion', () => {
  it('returns rank 0 and confidence 0.98', () => {
    const result = buildConfirmedChronicSuggestion({ icd_x: 'I10', nama: 'Hipertensi' });
    expect(result.rank).toBe(0);
    expect(result.confidence).toBe(0.98);
  });

  it('preserves provided icd_x', () => {
    const result = buildConfirmedChronicSuggestion({ icd_x: 'E11.9', nama: 'DM Tipe 2' });
    expect(result.icd_x).toBe('E11.9');
  });
});
