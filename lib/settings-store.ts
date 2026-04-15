// Designed and constructed by Claudesy.
/**
 * Precision-Architected. Future-Built by Docsyanpse
 * Sentra Healthcare Artificial Intelligence
 */

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

/**
 * Pieces Specific Configuration Interface
 */
export interface PiecesSettings {
  enableAutoSuggestions: boolean;
  enableContextualSaving: boolean;
  enableStatusBarIcon: boolean;
}

/**
 * Global Application Settings Interface
 */
export interface SettingsState {
  // Pieces Integration Settings
  pieces: PiecesSettings;

  // Actions
  setPiecesSetting: (key: keyof PiecesSettings, value: boolean) => void;
  resetSettings: () => void;
}

const DEFAULT_SETTINGS: Pick<SettingsState, 'pieces'> = {
  pieces: {
    enableAutoSuggestions: true,
    enableContextualSaving: true,
    enableStatusBarIcon: true,
  },
};

/**
 * Unified Settings Store
 * Persistent configuration management for Sentra Assist
 */
export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      ...DEFAULT_SETTINGS,

      setPiecesSetting: (key, value) =>
        set((state) => ({
          pieces: {
            ...state.pieces,
            [key]: value,
          },
        })),

      resetSettings: () => set(DEFAULT_SETTINGS),
    }),
    {
      name: 'sentra-settings-storage',
      storage: createJSONStorage(() => localStorage), // Leveraging web-standard localStorage (WXT compatible)
    }
  )
);
