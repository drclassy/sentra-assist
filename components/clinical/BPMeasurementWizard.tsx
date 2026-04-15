// Designed and constructed by Claudesy.
/**
 * BP Measurement Wizard
 *
 * Step-by-step guided BP measurement following FKTP 2024 protocol
 * Part of Gate 2: Hypertension Classification
 *
 * @module components/clinical/BPMeasurementWizard
 */

import React, { useState } from 'react';
import { Wizard, WizardStep, WizardStepWrapper, WizardStepProps } from './Wizard';
import { BPReading } from '../../lib/emergency-detector/htn-classifier';

// ============================================================================
// TYPES
// ============================================================================

export interface BPMeasurementWizardProps {
  onComplete: (readings: BPReading[]) => void;
  onCancel?: () => void;
}

/**
 * BPMeasurementData interface
 *
 * @remarks
 * TODO: Add type description and property documentation
 * Auto-generated on 2026-02-04
 */

export interface BPMeasurementData {
  readings: BPReading[];
}

interface BPReadingDraft {
  sbp?: string | number;
  dbp?: string | number;
}

function getInitialReadingValue(data: unknown, key: keyof BPReadingDraft): string {
  if (typeof data !== 'object' || data === null) return '';
  const value = (data as BPReadingDraft)[key];
  return typeof value === 'number' || typeof value === 'string' ? String(value) : '';
}

// ============================================================================
// STEP COMPONENTS
// ============================================================================

/**
 * Step 1: First BP Reading
 */
const Step1FirstReading: React.FC<WizardStepProps> = ({
  onNext,
  onBack,
  data,
  isFirst,
  isLast,
}) => {
  const [sbp, setSbp] = useState<string>(getInitialReadingValue(data, 'sbp'));
  const [dbp, setDbp] = useState<string>(getInitialReadingValue(data, 'dbp'));

  const handleNext = () => {
    const reading: BPReading = {
      sbp: parseInt(sbp),
      dbp: parseInt(dbp),
      timestamp: new Date(),
    };
    onNext(reading);
  };

  const isValid = sbp && dbp && parseInt(sbp) > 0 && parseInt(dbp) > 0;

  return (
    <WizardStepWrapper
      onNext={handleNext}
      onBack={onBack}
      isFirst={isFirst}
      isLast={isLast}
      nextDisabled={!isValid}
    >
      <div className="bp-measurement-step">
        <div className="bp-measurement-instruction">
          <h4>Persiapan Pasien:</h4>
          <ul>
            <li>Pasien duduk tenang selama 5 menit</li>
            <li>Kaki menyentuh lantai, punggung bersandar</li>
            <li>Lengan sejajar jantung, tidak menyilang kaki</li>
          </ul>
        </div>

        <div className="bp-input-group">
          <div className="bp-input-field">
            <label htmlFor="sbp-1">Sistole (SBP)</label>
            <div className="bp-input-with-unit">
              <input
                id="sbp-1"
                type="number"
                value={sbp}
                onChange={(e) => setSbp(e.target.value)}
                placeholder="120"
                className="bp-input"
                min="50"
                max="300"
              />
              <span className="bp-unit">mmHg</span>
            </div>
          </div>

          <div className="bp-input-field">
            <label htmlFor="dbp-1">Diastole (DBP)</label>
            <div className="bp-input-with-unit">
              <input
                id="dbp-1"
                type="number"
                value={dbp}
                onChange={(e) => setDbp(e.target.value)}
                placeholder="80"
                className="bp-input"
                min="30"
                max="200"
              />
              <span className="bp-unit">mmHg</span>
            </div>
          </div>
        </div>

        {sbp && dbp && (
          <div className="bp-preview">
            <strong>TD Pertama:</strong> {sbp}/{dbp} mmHg
          </div>
        )}
      </div>
    </WizardStepWrapper>
  );
};

/**
 * Step 2: Second BP Reading
 */
const Step2SecondReading: React.FC<WizardStepProps> = ({
  onNext,
  onBack,
  data,
  isFirst,
  isLast,
}) => {
  const [sbp, setSbp] = useState<string>(getInitialReadingValue(data, 'sbp'));
  const [dbp, setDbp] = useState<string>(getInitialReadingValue(data, 'dbp'));

  const handleNext = () => {
    const reading: BPReading = {
      sbp: parseInt(sbp),
      dbp: parseInt(dbp),
      timestamp: new Date(),
    };
    onNext(reading);
  };

  const isValid = sbp && dbp && parseInt(sbp) > 0 && parseInt(dbp) > 0;

  return (
    <WizardStepWrapper
      onNext={handleNext}
      onBack={onBack}
      isFirst={isFirst}
      isLast={isLast}
      nextDisabled={!isValid}
    >
      <div className="bp-measurement-step">
        <div className="bp-measurement-instruction">
          <h4>Tunggu 1-2 menit, lalu ukur lagi</h4>
          <p>Pastikan pasien tetap tenang dan tidak bergerak</p>
        </div>

        <div className="bp-input-group">
          <div className="bp-input-field">
            <label htmlFor="sbp-2">Sistole (SBP)</label>
            <div className="bp-input-with-unit">
              <input
                id="sbp-2"
                type="number"
                value={sbp}
                onChange={(e) => setSbp(e.target.value)}
                placeholder="120"
                className="bp-input"
                min="50"
                max="300"
              />
              <span className="bp-unit">mmHg</span>
            </div>
          </div>

          <div className="bp-input-field">
            <label htmlFor="dbp-2">Diastole (DBP)</label>
            <div className="bp-input-with-unit">
              <input
                id="dbp-2"
                type="number"
                value={dbp}
                onChange={(e) => setDbp(e.target.value)}
                placeholder="80"
                className="bp-input"
                min="30"
                max="200"
              />
              <span className="bp-unit">mmHg</span>
            </div>
          </div>
        </div>

        {sbp && dbp && (
          <div className="bp-preview">
            <strong>TD Kedua:</strong> {sbp}/{dbp} mmHg
          </div>
        )}
      </div>
    </WizardStepWrapper>
  );
};

/**
 * Step 3: Third BP Reading
 */
const Step3ThirdReading: React.FC<WizardStepProps> = ({
  onNext,
  onBack,
  data,
  isFirst,
  isLast,
}) => {
  const [sbp, setSbp] = useState<string>(getInitialReadingValue(data, 'sbp'));
  const [dbp, setDbp] = useState<string>(getInitialReadingValue(data, 'dbp'));

  const handleNext = () => {
    const reading: BPReading = {
      sbp: parseInt(sbp),
      dbp: parseInt(dbp),
      timestamp: new Date(),
    };
    onNext(reading);
  };

  const isValid = sbp && dbp && parseInt(sbp) > 0 && parseInt(dbp) > 0;

  return (
    <WizardStepWrapper
      onNext={handleNext}
      onBack={onBack}
      isFirst={isFirst}
      isLast={isLast}
      nextDisabled={!isValid}
      nextLabel="Selesai Pengukuran"
    >
      <div className="bp-measurement-step">
        <div className="bp-measurement-instruction">
          <h4>Pengukuran ketiga (terakhir)</h4>
          <p>Tunggu 1-2 menit lagi, lalu ukur TD ketiga</p>
        </div>

        <div className="bp-input-group">
          <div className="bp-input-field">
            <label htmlFor="sbp-3">Sistole (SBP)</label>
            <div className="bp-input-with-unit">
              <input
                id="sbp-3"
                type="number"
                value={sbp}
                onChange={(e) => setSbp(e.target.value)}
                placeholder="120"
                className="bp-input"
                min="50"
                max="300"
              />
              <span className="bp-unit">mmHg</span>
            </div>
          </div>

          <div className="bp-input-field">
            <label htmlFor="dbp-3">Diastole (DBP)</label>
            <div className="bp-input-with-unit">
              <input
                id="dbp-3"
                type="number"
                value={dbp}
                onChange={(e) => setDbp(e.target.value)}
                placeholder="80"
                className="bp-input"
                min="30"
                max="200"
              />
              <span className="bp-unit">mmHg</span>
            </div>
          </div>
        </div>

        {sbp && dbp && (
          <div className="bp-preview">
            <strong>TD Ketiga:</strong> {sbp}/{dbp} mmHg
          </div>
        )}
      </div>
    </WizardStepWrapper>
  );
};

// ============================================================================
// MAIN WIZARD COMPONENT
// ============================================================================

export const BPMeasurementWizard: React.FC<BPMeasurementWizardProps> = ({
  onComplete,
  onCancel,
}) => {
  const steps: WizardStep[] = [
    {
      id: 'reading_1',
      title: 'Pengukuran TD Pertama',
      instruction: 'Pasien duduk tenang 5 menit, lalu ukur TD',
      educational_tip: 'Jika TD <130/85, Anda bisa stop di sini (screening awal)',
      component: Step1FirstReading,
    },
    {
      id: 'reading_2',
      title: 'Pengukuran TD Kedua',
      instruction: 'Tunggu 1-2 menit, ukur TD lagi',
      educational_tip: 'Pengukuran serial lebih akurat dari single reading',
      component: Step2SecondReading,
    },
    {
      id: 'reading_3',
      title: 'Pengukuran TD Ketiga',
      instruction: 'Tunggu 1-2 menit lagi, ukur TD ketiga',
      educational_tip: 'TD Final = rerata 2 pengukuran terakhir',
      component: Step3ThirdReading,
    },
  ];

  const handleComplete = (allData: Record<string, unknown>) => {
    const data = allData as Partial<Record<'reading_1' | 'reading_2' | 'reading_3', BPReading>>;
    const readings: BPReading[] = [data.reading_1, data.reading_2, data.reading_3].filter(
      (reading): reading is BPReading => Boolean(reading)
    );
    onComplete(readings);
  };

  return (
    <Wizard
      steps={steps}
      onComplete={handleComplete}
      onCancel={onCancel}
      title="Protokol Pengukuran TD"
      subtitle="FKTP 2024 - 3 Pengukuran Serial"
    />
  );
};

// ============================================================================
// STYLES
// ============================================================================

export const bpMeasurementStyles = `
.bp-measurement-step {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.bp-measurement-instruction {
  background: var(--info-bg);
  border-left: 3px solid var(--info-border);
  padding: 16px;
  border-radius: 6px;
}

.bp-measurement-instruction h4 {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0 0 8px 0;
}

.bp-measurement-instruction p {
  font-size: 13px;
  color: var(--text-secondary);
  margin: 0;
}

.bp-measurement-instruction ul {
  margin: 8px 0 0 0;
  padding-left: 20px;
}

.bp-measurement-instruction li {
  font-size: 13px;
  color: var(--text-secondary);
  margin: 4px 0;
}

.bp-input-group {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.bp-input-field {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.bp-input-field label {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-secondary);
}

.bp-input-with-unit {
  display: flex;
  align-items: center;
  gap: 8px;
  background: var(--surface-secondary);
  border: 1px solid var(--border-subtle);
  border-radius: 6px;
  padding: 0 12px;
  transition: border-color 0.2s;
}

.bp-input-with-unit:focus-within {
  border-color: var(--accent-primary);
}

.bp-input {
  flex: 1;
  background: none;
  border: none;
  padding: 12px 0;
  font-size: 18px;
  font-weight: 600;
  color: var(--text-primary);
  outline: none;
}

.bp-input::placeholder {
  color: var(--text-tertiary);
  font-weight: 400;
}

.bp-unit {
  font-size: 12px;
  color: var(--text-tertiary);
  font-weight: 500;
}

.bp-preview {
  background: var(--surface-tertiary);
  padding: 12px 16px;
  border-radius: 6px;
  text-align: center;
  font-size: 16px;
  color: var(--text-primary);
}

.bp-preview strong {
  color: var(--accent-primary);
}
`;
