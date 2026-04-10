import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';

// Mock extension APIs before any imports that trigger webextension-polyfill
const { mockSendMessage } = vi.hoisted(() => ({ mockSendMessage: vi.fn() }));
vi.mock('wxt/browser', () => ({ browser: { tabs: { sendMessage: vi.fn() }, runtime: { id: 'test' } } }));
vi.mock('@webext-core/messaging', () => ({
  defineExtensionMessaging: () => ({ sendMessage: mockSendMessage, onMessage: vi.fn() }),
}));

import { DiagnosisSuggestions } from './DiagnosisSuggestions';

function makeSuggestion(overrides: Partial<{
  icd_x: string; nama: string; confidence: number;
  red_flags: string[]; rationale: string; rank: number;
}> = {}) {
  return {
    icd_x: 'J06.9',
    nama: 'ISPA Tidak Spesifik',
    confidence: 0.75,
    rationale: 'Keluhan batuk dan pilek mendukung diagnosis ini.',
    red_flags: [],
    recommended_actions: [],
    rank: 1,
    ...overrides,
  };
}

const MINIMAL_PROPS = {
  keluhanUtama: 'batuk pilek',
  patientAge: 30,
  patientGender: 'M' as const,
};

// Helper: click refresh button to trigger fetch immediately (bypasses debounce)
function clickRefresh() {
  fireEvent.click(screen.getByTitle('Refresh suggestions'));
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('DiagnosisSuggestions', () => {
  describe('prompt state', () => {
    it('shows prompt text when keluhanUtama is empty', () => {
      render(<DiagnosisSuggestions keluhanUtama="" />);
      expect(screen.getByText(/Masukkan keluhan utama/)).toBeInTheDocument();
    });

    it('refresh button disabled when keluhanUtama is empty', () => {
      render(<DiagnosisSuggestions keluhanUtama="" />);
      expect(screen.getByTitle('Refresh suggestions')).toBeDisabled();
    });
  });

  describe('loading state', () => {
    it('shows loading spinner when fetch is in progress', async () => {
      mockSendMessage.mockReturnValue(new Promise(() => {})); // never resolves

      render(<DiagnosisSuggestions {...MINIMAL_PROPS} />);

      await act(async () => { clickRefresh(); });

      expect(screen.getByText(/Menganalisis keluhan/)).toBeInTheDocument();
    });
  });

  describe('error state', () => {
    it('shows error message when sendMessage returns success: false', async () => {
      mockSendMessage.mockResolvedValue({
        success: false,
        error: { message: 'Server error' },
      });

      render(<DiagnosisSuggestions {...MINIMAL_PROPS} />);

      await act(async () => { clickRefresh(); });

      await waitFor(() => {
        expect(screen.getByText('Server error')).toBeInTheDocument();
      });
    });
  });

  describe('happy path', () => {
    it('renders ICD-10 codes when suggestions returned', async () => {
      mockSendMessage.mockResolvedValue({
        success: true,
        data: {
          diagnosis_suggestions: [
            makeSuggestion({ icd_x: 'J06.9', nama: 'ISPA' }),
            makeSuggestion({ icd_x: 'J00', nama: 'Common Cold', rank: 2 }),
          ],
        },
      });

      render(<DiagnosisSuggestions {...MINIMAL_PROPS} />);
      await act(async () => { clickRefresh(); });

      await waitFor(() => {
        expect(screen.getByText('J06.9')).toBeInTheDocument();
        expect(screen.getByText('J00')).toBeInTheDocument();
      });
    });

    it('confidence label High for confidence >= 0.85', async () => {
      mockSendMessage.mockResolvedValue({
        success: true,
        data: { diagnosis_suggestions: [makeSuggestion({ confidence: 0.90 })] },
      });

      render(<DiagnosisSuggestions {...MINIMAL_PROPS} />);
      await act(async () => { clickRefresh(); });

      await waitFor(() => {
        expect(screen.getByText('High')).toBeInTheDocument();
      });
    });

    it('confidence label Medium for confidence >= 0.65 and < 0.85', async () => {
      mockSendMessage.mockResolvedValue({
        success: true,
        data: { diagnosis_suggestions: [makeSuggestion({ confidence: 0.70 })] },
      });

      render(<DiagnosisSuggestions {...MINIMAL_PROPS} />);
      await act(async () => { clickRefresh(); });

      await waitFor(() => {
        expect(screen.getByText('Medium')).toBeInTheDocument();
      });
    });

    it('confidence label Low for confidence < 0.65', async () => {
      mockSendMessage.mockResolvedValue({
        success: true,
        data: { diagnosis_suggestions: [makeSuggestion({ confidence: 0.50 })] },
      });

      render(<DiagnosisSuggestions {...MINIMAL_PROPS} />);
      await act(async () => { clickRefresh(); });

      await waitFor(() => {
        expect(screen.getByText('Low')).toBeInTheDocument();
      });
    });
  });

  describe('red flags', () => {
    it('renders red flags section when suggestion has red_flags', async () => {
      mockSendMessage.mockResolvedValue({
        success: true,
        data: {
          diagnosis_suggestions: [
            makeSuggestion({ red_flags: ['chest_pain_suspect_acs'] }),
          ],
        },
      });

      render(<DiagnosisSuggestions {...MINIMAL_PROPS} />);
      await act(async () => { clickRefresh(); });

      await waitFor(() => {
        expect(screen.getByText(/Red Flags/)).toBeInTheDocument();
        expect(screen.getByText(/chest pain suspect acs/)).toBeInTheDocument();
      });
    });
  });

  describe('maxSuggestions', () => {
    it('only displays maxSuggestions items even if more returned', async () => {
      const many = Array.from({ length: 7 }, (_, i) =>
        makeSuggestion({ icd_x: `J0${i}`, nama: `Diagnosis ${i}`, rank: i + 1 })
      );
      mockSendMessage.mockResolvedValue({
        success: true,
        data: { diagnosis_suggestions: many },
      });

      render(<DiagnosisSuggestions {...MINIMAL_PROPS} maxSuggestions={3} />);
      await act(async () => { clickRefresh(); });

      await waitFor(() => {
        expect(screen.getByText('#1')).toBeInTheDocument();
        expect(screen.getByText('#2')).toBeInTheDocument();
        expect(screen.getByText('#3')).toBeInTheDocument();
        expect(screen.queryByText('#4')).not.toBeInTheDocument();
      });
    });
  });

  describe('isVisible', () => {
    it('renders nothing when isVisible is false', () => {
      const { container } = render(
        <DiagnosisSuggestions {...MINIMAL_PROPS} isVisible={false} />
      );
      expect(container.firstChild).toBeNull();
    });
  });

  describe('jenis selector', () => {
    it('fillDiagnosa called with SEKUNDER when Jenis changed to Sekunder', async () => {
      mockSendMessage
        .mockResolvedValueOnce({
          success: true,
          data: { diagnosis_suggestions: [makeSuggestion({ icd_x: 'J06.9', nama: 'ISPA' })] },
        })
        .mockResolvedValueOnce({ success: ['icd10'], failed: [] });

      render(<DiagnosisSuggestions {...MINIMAL_PROPS} />);
      await act(async () => { clickRefresh(); });

      await waitFor(() => {
        expect(screen.getByText('J06.9')).toBeInTheDocument();
      });

      // Change Jenis to Sekunder
      const selects = screen.getAllByRole('combobox');
      const jenisSelect = selects[0]; // first select is Jenis
      fireEvent.change(jenisSelect, { target: { value: 'SEKUNDER' } });

      // Click first suggestion card (it's a button containing the ICD code)
      const cards = screen.getAllByRole('button', { name: /./ });
      const suggestionCard = cards.find(btn => btn.textContent?.includes('J06.9'));
      if (suggestionCard) {
        await act(async () => { fireEvent.click(suggestionCard); });
      }

      await waitFor(() => {
        const fillCall = mockSendMessage.mock.calls.find(
          (call) => call[0] === 'fillDiagnosa'
        );
        expect(fillCall).toBeDefined();
        expect(fillCall![1].jenis).toBe('SEKUNDER');
      });
    });
  });
});
