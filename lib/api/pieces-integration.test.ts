// Designed and constructed by Claudesy.
/**
 * Pieces Integration Verification
 * Tests the interaction between SettingsStore and PiecesClient
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useSettingsStore } from '../settings-store'
import { PiecesClient } from './pieces-client'

// Mock Pieces OS Client
vi.mock('@pieces.app/pieces-os-client', () => {
  const assetsCreateNewAsset = vi.fn().mockResolvedValue({ id: 'mock-asset-id' })
  const assetsSnapshot = vi.fn().mockResolvedValue({ iterable: [] })
  const getWellKnownHealth = vi.fn().mockResolvedValue('ok')

  return {
    Configuration: vi.fn(),
    AssetsApi: vi.fn().mockImplementation(() => ({
      assetsCreateNewAsset,
      assetsSnapshot,
    })),
    WellKnownApi: vi.fn().mockImplementation(() => ({
      getWellKnownHealth,
    })),
    ApplicationNameEnum: { OpenSource: 'OpenSource' },
    PlatformEnum: { Windows: 'Windows' },
    PrivacyEnum: { Anonymous: 'Anonymous' },
  }
})

describe('PiecesClient Settings Integration', () => {
  let client: PiecesClient

  beforeEach(() => {
    // Reset settings to default before each test
    useSettingsStore.getState().resetSettings()

    // Clear mocks
    vi.clearAllMocks()

    // Get client instance
    client = PiecesClient.getInstance()
  })

  it('should allow saving snippet when enableContextualSaving is true (default)', async () => {
    // Arrange
    useSettingsStore.getState().setPiecesSetting('enableContextualSaving', true)
    const mockSnippet = {
      title: 'Test',
      content: 'Test Content',
      classification: 'plaintext' as const,
    }

    // Act
    const result = await client.saveClinicalSnippet(mockSnippet)

    // Assert
    expect(result).toBe('mock-asset-id')
    // We can't easily inspect private properties without casting to any or exposing internals,
    // but the success return implies the API was called.
    // A more rigorous test would inspect the mock calls if we exposed the mock.
  })

  it('should BLOCK saving snippet when enableContextualSaving is false', async () => {
    // Arrange
    useSettingsStore.getState().setPiecesSetting('enableContextualSaving', false)
    const mockSnippet = {
      title: 'Test',
      content: 'Test Content',
      classification: 'plaintext' as const,
    }

    // Act
    const result = await client.saveClinicalSnippet(mockSnippet)

    // Assert
    // Our implementation returns '' when disabled
    expect(result).toBe('')
  })

  it('should allow context retrieval when enableAutoSuggestions is true (default)', async () => {
    // Arrange
    useSettingsStore.getState().setPiecesSetting('enableAutoSuggestions', true)

    // We need to spy on searchClinicalMemory or check the mock.
    // Since searchClinicalMemory is public, we can spy on it.
    const searchSpy = vi.spyOn(client, 'searchClinicalMemory')
    searchSpy.mockResolvedValueOnce({
      snippets: [{ id: '1', title: 'Context', content: 'Info', classification: 'plaintext' }],
      total: 1,
    })

    // Act
    const context = await client.getRelevantContext('query')

    // Assert
    expect(searchSpy).toHaveBeenCalled()
    expect(context).toContain('Context')
  })

  it('should BLOCK context retrieval when enableAutoSuggestions is false', async () => {
    // Arrange
    useSettingsStore.getState().setPiecesSetting('enableAutoSuggestions', false)

    const searchSpy = vi.spyOn(client, 'searchClinicalMemory')

    // Act
    const context = await client.getRelevantContext('query')

    // Assert
    expect(searchSpy).not.toHaveBeenCalled()
    expect(context).toBe('')
  })
})
