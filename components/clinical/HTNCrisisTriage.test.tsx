import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { HTNCrisisTriage } from './HTNCrisisTriage';

const BP_CRISIS = { sbp: 185, dbp: 115 };

describe('HTNCrisisTriage', () => {
  describe('initial render', () => {
    it('shows HMOD checklist on step RED_FLAGS', () => {
      render(<HTNCrisisTriage bp={BP_CRISIS} onComplete={vi.fn()} />);

      expect(screen.getByText(/Chest Pain/)).toBeInTheDocument();
      expect(screen.getByText(/Pulmonary Edema/)).toBeInTheDocument();
      expect(screen.getByText(/Neurological Deficit/)).toBeInTheDocument();
      expect(screen.getByText(/Vision Changes/)).toBeInTheDocument();
      expect(screen.getByText(/Severe Headache/)).toBeInTheDocument();
      expect(screen.getByText(/Oliguria/)).toBeInTheDocument();
      expect(screen.getByText(/Altered Mental Status/)).toBeInTheDocument();
    });

    it('renders BP value in header', () => {
      render(<HTNCrisisTriage bp={BP_CRISIS} onComplete={vi.fn()} />);
      expect(screen.getByText(/185\/115 mmHg/)).toBeInTheDocument();
    });

    it('shows Continue button on RED_FLAGS step', () => {
      render(<HTNCrisisTriage bp={BP_CRISIS} onComplete={vi.fn()} />);
      expect(screen.getByText(/Continue to Result/)).toBeInTheDocument();
    });
  });

  describe('no red flags → HTN_URGENCY', () => {
    it('calls onComplete with HTN_URGENCY and CAPTOPRIL_SL when no checkboxes ticked', () => {
      const onComplete = vi.fn();
      render(<HTNCrisisTriage bp={BP_CRISIS} onComplete={onComplete} />);

      // Click Continue (no checkboxes ticked)
      fireEvent.click(screen.getByText(/Continue to Result/));

      // Should show urgency result (appears in multiple places in component)
      expect(screen.getAllByText(/Hypertensive Urgency/).length).toBeGreaterThan(0);
      expect(screen.getByText(/Captopril SL Protocol/)).toBeInTheDocument();

      // Click Complete
      fireEvent.click(screen.getByText(/Complete Triage/));

      expect(onComplete).toHaveBeenCalledOnce();
      const result = onComplete.mock.calls[0][0];
      expect(result.type).toBe('HTN_URGENCY');
      expect(result.protocol).toBe('CAPTOPRIL_SL');
      expect(result.red_flags.chest_pain).toBe(false);
    });
  });

  describe('chest pain checked → HTN_EMERGENCY', () => {
    it('calls onComplete with HTN_EMERGENCY and IMMEDIATE_ER_REFERRAL', () => {
      const onComplete = vi.fn();
      render(<HTNCrisisTriage bp={BP_CRISIS} onComplete={onComplete} />);

      // Tick chest_pain
      fireEvent.click(screen.getByLabelText(/Chest Pain/i) as HTMLInputElement);

      // Click Continue
      fireEvent.click(screen.getByText(/Continue to Result/));

      // Click Complete
      fireEvent.click(screen.getByText(/Complete Triage/));

      const result = onComplete.mock.calls[0][0];
      expect(result.type).toBe('HTN_EMERGENCY');
      expect(result.protocol).toBe('IMMEDIATE_ER_REFERRAL');
    });
  });

  describe('multiple red flags → HTN_EMERGENCY', () => {
    it('neurological_deficit + vision_changes still yields HTN_EMERGENCY', () => {
      const onComplete = vi.fn();
      render(<HTNCrisisTriage bp={BP_CRISIS} onComplete={onComplete} />);

      // Use getAllByRole to find checkboxes
      const checkboxes = screen.getAllByRole('checkbox');
      // neurological_deficit is 3rd checkbox (0-indexed: Chest Pain=0, Pulm Edema=1, Neuro=2, Vision=3)
      fireEvent.click(checkboxes[2]); // neurological_deficit
      fireEvent.click(checkboxes[3]); // vision_changes

      fireEvent.click(screen.getByText(/Continue to Result/));
      fireEvent.click(screen.getByText(/Complete Triage/));

      const result = onComplete.mock.calls[0][0];
      expect(result.type).toBe('HTN_EMERGENCY');
    });
  });

  describe('cancel button', () => {
    it('calls onCancel when ✕ clicked', () => {
      const onCancel = vi.fn();
      render(<HTNCrisisTriage bp={BP_CRISIS} onComplete={vi.fn()} onCancel={onCancel} />);

      fireEvent.click(screen.getByText('✕'));
      expect(onCancel).toHaveBeenCalledOnce();
    });

    it('does not render ✕ when onCancel not provided', () => {
      render(<HTNCrisisTriage bp={BP_CRISIS} onComplete={vi.fn()} />);
      expect(screen.queryByText('✕')).not.toBeInTheDocument();
    });
  });
});
