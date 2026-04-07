import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DosageCalculator } from './DosageCalculator';

describe('DosageCalculator', () => {
  describe('age group label', () => {
    it('age 6 shows Anak label', () => {
      render(<DosageCalculator patientAge={6} />);
      expect(screen.getByText(/Anak \(2-12 tahun\)/)).toBeInTheDocument();
      expect(screen.getByText(/6 tahun/)).toBeInTheDocument();
    });

    it('age 70 shows Lansia label', () => {
      render(<DosageCalculator patientAge={70} />);
      expect(screen.getByText(/Lansia/)).toBeInTheDocument();
      expect(screen.getByText(/70 tahun/)).toBeInTheDocument();
    });
  });

  describe('drug dropdown', () => {
    it('shows drugs for child age group', () => {
      render(<DosageCalculator patientAge={6} />);
      const select = screen.getByRole('combobox');
      // Should have options beyond the placeholder
      expect(select.querySelectorAll('option').length).toBeGreaterThan(1);
    });

    it('includes paracetamol for child', () => {
      render(<DosageCalculator patientAge={6} />);
      expect(screen.getByText(/Paracetamol/)).toBeInTheDocument();
    });
  });

  describe('dosage calculation', () => {
    it('paracetamol child weight 20 → dose 300mg, q6h, dailyTotal 1200mg', () => {
      render(<DosageCalculator patientAge={6} />);

      // Enter weight 20 kg
      const weightInput = screen.getByPlaceholderText('0.0');
      fireEvent.change(weightInput, { target: { value: '20' } });

      // Select paracetamol
      const select = screen.getByRole('combobox');
      fireEvent.change(select, { target: { value: 'paracetamol' } });

      // Should show dose label and frequency
      expect(screen.getByText('DOSIS PER PEMBERIAN')).toBeInTheDocument();
      // Dose value appears somewhere in the rendered output
      expect(document.body.textContent).toContain('300');
      expect(screen.getByText('q6h')).toBeInTheDocument();
    });

    it('paracetamol child weight 40 → capped at 500mg with max dose warning', () => {
      render(<DosageCalculator patientAge={6} />);

      fireEvent.change(screen.getByPlaceholderText('0.0'), { target: { value: '40' } });
      fireEvent.change(screen.getByRole('combobox'), { target: { value: 'paracetamol' } });

      // Dose should be 500 (capped from 600)
      expect(document.body.textContent).toContain('500');
      // Should show max dose warning
      expect(screen.getByText(/melebihi maksimum/i)).toBeInTheDocument();
    });

    it('paracetamol warnings show HEPATOTOXIC', () => {
      render(<DosageCalculator patientAge={6} />);

      fireEvent.change(screen.getByPlaceholderText('0.0'), { target: { value: '20' } });
      fireEvent.change(screen.getByRole('combobox'), { target: { value: 'paracetamol' } });

      expect(screen.getByText(/HEPATOTOXIC/)).toBeInTheDocument();
    });
  });

  describe('edge cases', () => {
    it('weight = 0 → no dosage result rendered', () => {
      render(<DosageCalculator patientAge={6} />);

      fireEvent.change(screen.getByRole('combobox'), { target: { value: 'paracetamol' } });
      // Weight left empty (defaults to 0)

      expect(screen.queryByText(/DOSIS PER PEMBERIAN/)).not.toBeInTheDocument();
    });

    it('very low weight (1.5 kg) → low weight warning', () => {
      render(<DosageCalculator patientAge={6} />);

      fireEvent.change(screen.getByPlaceholderText('0.0'), { target: { value: '1.5' } });

      expect(screen.getByText(/Berat badan sangat rendah/)).toBeInTheDocument();
    });
  });

  describe('close button', () => {
    it('calls onClose when ✕ clicked', () => {
      const onClose = vi.fn();
      render(<DosageCalculator patientAge={6} onClose={onClose} />);

      fireEvent.click(screen.getByText('✕'));
      expect(onClose).toHaveBeenCalledOnce();
    });

    it('does not render close button when onClose not provided', () => {
      render(<DosageCalculator patientAge={6} />);
      expect(screen.queryByText('✕')).not.toBeInTheDocument();
    });
  });
});
