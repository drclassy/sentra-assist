// Designed and constructed by Claudesy.
/**
 * Hypoglycemia 15-15 Timer
 *
 * Interactive timer for hypoglycemia treatment following 15-15 rule
 * Part of Gate 3: Blood Glucose Classification
 *
 * @module components/clinical/Hypoglycemia1515Timer
 */

import React, { useState, useEffect, useCallback } from 'react';
import { FAST_CARBS_15G } from '../../lib/emergency-detector/glucose-classifier';

// ============================================================================
// TYPES
// ============================================================================

export interface Hypoglycemia1515TimerProps {
  initialGlucose: number;
  onComplete: (cycles: TreatmentCycle[]) => void;
  onCancel?: () => void;
}

/**
 * TreatmentCycle interface
 *
 * @remarks
 * TODO: Add type description and property documentation
 * Auto-generated on 2026-02-04
 */

export interface TreatmentCycle {
  cycle_number: number;
  carbs_given: string;
  glucose_before: number;
  glucose_after?: number;
  timestamp: Date;
}

type TimerState = 'IDLE' | 'RUNNING' | 'WAITING_RECHECK' | 'COMPLETE';

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export const Hypoglycemia1515Timer: React.FC<Hypoglycemia1515TimerProps> = ({
  initialGlucose,
  onComplete,
  onCancel,
}) => {
  const [state, setState] = useState<TimerState>('IDLE');
  const [cycles, setCycles] = useState<TreatmentCycle[]>([]);
  const [currentCycle, setCurrentCycle] = useState(1);
  const [timeRemaining, setTimeRemaining] = useState(15 * 60); // 15 minutes in seconds
  const [selectedCarb, setSelectedCarb] = useState<string>('');
  const [recheckGlucose, setRecheckGlucose] = useState<string>('');

  // Timer countdown
  useEffect(() => {
    if (state !== 'RUNNING') return;

    const interval = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          setState('WAITING_RECHECK');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [state]);

  const handleStartCycle = useCallback(() => {
    if (!selectedCarb) return;

    const cycle: TreatmentCycle = {
      cycle_number: currentCycle,
      carbs_given: selectedCarb,
      glucose_before: currentCycle === 1 ? initialGlucose : parseInt(recheckGlucose),
      timestamp: new Date(),
    };

    setCycles((prev) => [...prev, cycle]);
    setState('RUNNING');
    setTimeRemaining(15 * 60);
  }, [selectedCarb, currentCycle, initialGlucose, recheckGlucose]);

  const handleRecheck = useCallback(() => {
    const glucose = parseInt(recheckGlucose);

    // Update last cycle with recheck glucose
    setCycles((prev) => {
      const updated = [...prev];
      updated[updated.length - 1].glucose_after = glucose;
      return updated;
    });

    if (glucose >= 70) {
      // Success - glucose normalized
      setState('COMPLETE');
      onComplete(cycles);
    } else if (currentCycle >= 3) {
      // Max cycles reached - escalate
      setState('COMPLETE');
      onComplete(cycles);
    } else {
      // Need another cycle
      setCurrentCycle((prev) => prev + 1);
      setState('IDLE');
      setSelectedCarb('');
      setRecheckGlucose('');
    }
  }, [recheckGlucose, currentCycle, cycles, onComplete]);

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="hypoglycemia-timer">
      {/* Header */}
      <div className="hypoglycemia-timer-header">
        <div className="hypoglycemia-timer-title-section">
          <h3 className="hypoglycemia-timer-title">🚨 Hypoglycemia Treatment (15-15 Rule)</h3>
          <p className="hypoglycemia-timer-subtitle">
            Glucose: {initialGlucose} mg/dL &lt;70 (Critical)
          </p>
        </div>
        {onCancel && (
          <button onClick={onCancel} className="hypoglycemia-timer-close">
            ✕
          </button>
        )}
      </div>

      {/* Cycle Progress */}
      <div className="hypoglycemia-timer-progress">
        <div className="hypoglycemia-cycle-indicator">
          <span className="hypoglycemia-cycle-label">Cycle:</span>
          <span className="hypoglycemia-cycle-number">{currentCycle}/3</span>
        </div>
        {currentCycle > 1 && (
          <div className="hypoglycemia-cycle-warning">
            ⚠️ Glucose still &lt;70 after {currentCycle - 1} cycle(s)
          </div>
        )}
      </div>

      {/* Step 1: Give 15g Carbs */}
      {state === 'IDLE' && (
        <div className="hypoglycemia-step">
          <div className="hypoglycemia-step-header">
            <span className="hypoglycemia-step-number">1️⃣</span>
            <h4 className="hypoglycemia-step-title">Give 15g Fast-Acting Carbohydrate</h4>
          </div>

          <div className="hypoglycemia-carb-options">
            {FAST_CARBS_15G.map((carb, index) => (
              <label key={index} className="hypoglycemia-carb-option">
                <input
                  type="radio"
                  name="carb"
                  value={carb}
                  checked={selectedCarb === carb}
                  onChange={(e) => setSelectedCarb(e.target.value)}
                />
                <span className="hypoglycemia-carb-label">{carb}</span>
              </label>
            ))}
          </div>

          <button
            onClick={handleStartCycle}
            disabled={!selectedCarb}
            className="hypoglycemia-btn hypoglycemia-btn-primary"
          >
            ⚡ Start 15-Minute Timer
          </button>
        </div>
      )}

      {/* Step 2: Wait 15 Minutes */}
      {state === 'RUNNING' && (
        <div className="hypoglycemia-step">
          <div className="hypoglycemia-step-header">
            <span className="hypoglycemia-step-number">2️⃣</span>
            <h4 className="hypoglycemia-step-title">Wait 15 Minutes</h4>
          </div>

          <div className="hypoglycemia-timer-display">
            <div className="hypoglycemia-timer-circle">
              <div className="hypoglycemia-timer-time">{formatTime(timeRemaining)}</div>
              <div className="hypoglycemia-timer-label">remaining</div>
            </div>
          </div>

          <div className="hypoglycemia-timer-info">
            <p>✓ Carbs given: {cycles[cycles.length - 1].carbs_given}</p>
            <p>Patient should rest and avoid activity</p>
          </div>
        </div>
      )}

      {/* Step 3: Recheck Glucose */}
      {state === 'WAITING_RECHECK' && (
        <div className="hypoglycemia-step">
          <div className="hypoglycemia-step-header">
            <span className="hypoglycemia-step-number">3️⃣</span>
            <h4 className="hypoglycemia-step-title">Recheck Glucose</h4>
          </div>

          <div className="hypoglycemia-recheck-alert">
            ⏰ 15 minutes elapsed - Time to recheck glucose!
          </div>

          <div className="hypoglycemia-glucose-input">
            <label htmlFor="recheck-glucose">Glucose Level:</label>
            <div className="hypoglycemia-input-with-unit">
              <input
                id="recheck-glucose"
                type="number"
                value={recheckGlucose}
                onChange={(e) => setRecheckGlucose(e.target.value)}
                placeholder="Enter glucose"
                className="hypoglycemia-input"
                min="20"
                max="600"
              />
              <span className="hypoglycemia-unit">mg/dL</span>
            </div>
          </div>

          <button
            onClick={handleRecheck}
            disabled={!recheckGlucose}
            className="hypoglycemia-btn hypoglycemia-btn-primary"
          >
            Evaluate Result
          </button>
        </div>
      )}

      {/* Step 4: Complete */}
      {state === 'COMPLETE' && (
        <div className="hypoglycemia-step">
          <div className="hypoglycemia-step-header">
            <span className="hypoglycemia-step-number">4️⃣</span>
            <h4 className="hypoglycemia-step-title">Treatment Complete</h4>
          </div>

          {cycles[cycles.length - 1].glucose_after! >= 70 ? (
            <div className="hypoglycemia-success">
              <div className="hypoglycemia-success-icon">✅</div>
              <div className="hypoglycemia-success-message">
                <h4>Glucose Normalized!</h4>
                <p>Final glucose: {cycles[cycles.length - 1].glucose_after} mg/dL ≥70</p>
              </div>
            </div>
          ) : (
            <div className="hypoglycemia-escalate">
              <div className="hypoglycemia-escalate-icon">🚑</div>
              <div className="hypoglycemia-escalate-message">
                <h4>Escalate Treatment</h4>
                <p>Glucose still &lt;70 after {currentCycle} cycles</p>
                <p>
                  <strong>Consider:</strong>
                </p>
                <ul>
                  <li>IV Dextrose 10-25g</li>
                  <li>Glucagon 1mg IM/SC</li>
                  <li>Call emergency team</li>
                </ul>
              </div>
            </div>
          )}

          <div className="hypoglycemia-next-steps">
            <h4>Next Steps:</h4>
            <ul>
              <li>Give meal/snack to prevent recurrence</li>
              <li>Evaluate cause (insulin/OAD dose, missed meal, exercise)</li>
              <li>Adjust diabetes management plan</li>
            </ul>
          </div>
        </div>
      )}

      {/* Treatment History */}
      {cycles.length > 0 && (
        <div className="hypoglycemia-history">
          <h4>Treatment History:</h4>
          <div className="hypoglycemia-history-items">
            {cycles.map((cycle) => (
              <div key={cycle.cycle_number} className="hypoglycemia-history-item">
                <div className="hypoglycemia-history-cycle">Cycle {cycle.cycle_number}</div>
                <div className="hypoglycemia-history-details">
                  <span>Carbs: {cycle.carbs_given}</span>
                  <span>Before: {cycle.glucose_before} mg/dL</span>
                  {cycle.glucose_after && <span>After: {cycle.glucose_after} mg/dL</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================================================
// STYLES
// ============================================================================

export const hypoglycemia1515Styles = `
.hypoglycemia-timer {
  background: var(--surface-primary);
  border: 2px solid var(--error-primary);
  border-radius: 12px;
  padding: 20px;
  max-width: 600px;
  margin: 0 auto;
}

.hypoglycemia-timer-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 20px;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--border-subtle);
}

.hypoglycemia-timer-title {
  font-size: 18px;
  font-weight: 700;
  color: var(--error-text);
  margin: 0 0 4px 0;
}

.hypoglycemia-timer-subtitle {
  font-size: 14px;
  color: var(--text-secondary);
  margin: 0;
}

.hypoglycemia-timer-close {
  background: none;
  border: none;
  color: var(--text-tertiary);
  font-size: 20px;
  cursor: pointer;
  padding: 0 4px;
}

.hypoglycemia-timer-progress {
  background: var(--error-bg);
  padding: 12px;
  border-radius: 6px;
  margin-bottom: 20px;
}

.hypoglycemia-cycle-indicator {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
}

.hypoglycemia-cycle-label {
  color: var(--text-secondary);
}

.hypoglycemia-cycle-number {
  font-size: 18px;
  font-weight: 700;
  color: var(--error-primary);
}

.hypoglycemia-cycle-warning {
  margin-top: 8px;
  font-size: 13px;
  color: var(--warning-text);
}

.hypoglycemia-step {
  margin-bottom: 20px;
}

.hypoglycemia-step-header {
  display: flex;
  gap: 12px;
  align-items: center;
  margin-bottom: 16px;
}

.hypoglycemia-step-number {
  font-size: 24px;
}

.hypoglycemia-step-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
}

.hypoglycemia-carb-options {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 16px;
}

.hypoglycemia-carb-option {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background: var(--surface-secondary);
  border: 1px solid var(--border-subtle);
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
}

.hypoglycemia-carb-option:hover {
  background: var(--surface-hover);
}

.hypoglycemia-carb-option input[type="radio"] {
  cursor: pointer;
}

.hypoglycemia-carb-label {
  font-size: 14px;
  color: var(--text-primary);
}

.hypoglycemia-timer-display {
  display: flex;
  justify-content: center;
  margin: 24px 0;
}

.hypoglycemia-timer-circle {
  width: 200px;
  height: 200px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--error-bg) 0%, var(--error-bg-dark) 100%);
  border: 4px solid var(--error-primary);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.05); }
}

.hypoglycemia-timer-time {
  font-size: 48px;
  font-weight: 700;
  color: var(--error-primary);
  font-variant-numeric: tabular-nums;
}

.hypoglycemia-timer-label {
  font-size: 14px;
  color: var(--text-secondary);
  margin-top: 4px;
}

.hypoglycemia-timer-info {
  background: var(--info-bg);
  padding: 12px;
  border-radius: 6px;
  font-size: 13px;
  color: var(--text-secondary);
}

.hypoglycemia-timer-info p {
  margin: 4px 0;
}

.hypoglycemia-recheck-alert {
  background: var(--warning-bg);
  border-left: 3px solid var(--warning-primary);
  padding: 12px;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 600;
  color: var(--warning-text);
  margin-bottom: 16px;
}

.hypoglycemia-glucose-input {
  margin-bottom: 16px;
}

.hypoglycemia-glucose-input label {
  display: block;
  font-size: 13px;
  font-weight: 500;
  color: var(--text-secondary);
  margin-bottom: 8px;
}

.hypoglycemia-input-with-unit {
  display: flex;
  align-items: center;
  gap: 8px;
  background: var(--surface-secondary);
  border: 1px solid var(--border-subtle);
  border-radius: 6px;
  padding: 0 12px;
}

.hypoglycemia-input {
  flex: 1;
  background: none;
  border: none;
  padding: 12px 0;
  font-size: 18px;
  font-weight: 600;
  color: var(--text-primary);
  outline: none;
}

.hypoglycemia-unit {
  font-size: 12px;
  color: var(--text-tertiary);
}

.hypoglycemia-btn {
  width: 100%;
  padding: 12px 20px;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  border: none;
  transition: all 0.2s;
}

.hypoglycemia-btn-primary {
  background: var(--error-primary);
  color: white;
}

.hypoglycemia-btn-primary:hover:not(:disabled) {
  background: var(--error-hover);
}

.hypoglycemia-btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.hypoglycemia-success,
.hypoglycemia-escalate {
  display: flex;
  gap: 16px;
  align-items: flex-start;
  padding: 16px;
  border-radius: 8px;
  margin-bottom: 16px;
}

.hypoglycemia-success {
  background: var(--success-bg);
  border: 1px solid var(--success-primary);
}

.hypoglycemia-escalate {
  background: var(--error-bg);
  border: 1px solid var(--error-primary);
}

.hypoglycemia-success-icon,
.hypoglycemia-escalate-icon {
  font-size: 32px;
}

.hypoglycemia-success-message h4,
.hypoglycemia-escalate-message h4 {
  font-size: 16px;
  font-weight: 600;
  margin: 0 0 8px 0;
}

.hypoglycemia-success-message p,
.hypoglycemia-escalate-message p {
  font-size: 14px;
  margin: 4px 0;
}

.hypoglycemia-escalate-message ul {
  margin: 8px 0 0 20px;
  padding: 0;
}

.hypoglycemia-escalate-message li {
  font-size: 13px;
  margin: 4px 0;
}

.hypoglycemia-next-steps {
  background: var(--info-bg);
  padding: 12px;
  border-radius: 6px;
}

.hypoglycemia-next-steps h4 {
  font-size: 14px;
  font-weight: 600;
  margin: 0 0 8px 0;
}

.hypoglycemia-next-steps ul {
  margin: 0;
  padding-left: 20px;
}

.hypoglycemia-next-steps li {
  font-size: 13px;
  margin: 4px 0;
}

.hypoglycemia-history {
  border-top: 1px solid var(--border-subtle);
  padding-top: 16px;
  margin-top: 16px;
}

.hypoglycemia-history h4 {
  font-size: 14px;
  font-weight: 600;
  margin: 0 0 12px 0;
}

.hypoglycemia-history-items {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.hypoglycemia-history-item {
  display: flex;
  gap: 12px;
  align-items: center;
  padding: 8px;
  background: var(--surface-secondary);
  border-radius: 4px;
  font-size: 13px;
}

.hypoglycemia-history-cycle {
  font-weight: 600;
  color: var(--accent-primary);
}

.hypoglycemia-history-details {
  display: flex;
  gap: 12px;
  color: var(--text-secondary);
}
`;
