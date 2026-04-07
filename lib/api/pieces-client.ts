// Designed and constructed by Claudesy.
/**
 * Precision-Architected. Future-Built by Docsyanpse
 * Sentra Healthcare Artificial Intelligence
 */

import * as Pieces from '@pieces.app/pieces-os-client'
import { useSettingsStore } from '../settings-store'
import type { PiecesSearchResponse, PiecesSnippet } from './pieces-types'

/**
 * Pieces API Client
 * Orchestrates interaction with Pieces OS local instance
 */
export class PiecesClient {
  private static instance: PiecesClient
  private config: Pieces.Configuration
  private assetsApi: Pieces.AssetsApi

  private constructor() {
    this.config = new Pieces.Configuration({
      basePath: 'http://localhost:1000',
    })

    this.assetsApi = new Pieces.AssetsApi(this.config)
  }

  public static getInstance(): PiecesClient {
    if (!PiecesClient.instance) {
      PiecesClient.instance = new PiecesClient()
    }
    return PiecesClient.instance
  }

  /**
   * Save a clinical snippet to Pieces
   */
  public async saveClinicalSnippet(snippet: PiecesSnippet): Promise<string> {
    // Check configuration setting
    const { enableContextualSaving } = useSettingsStore.getState().pieces
    if (!enableContextualSaving) {
      console.log('[PiecesClient] Contextual saving disabled by user settings.')
      return ''
    }

    try {
      const result = await this.assetsApi.assetsCreateNewAsset({
        seed: {
          asset: {
            application: {
              id: 'sentra-assist',
              name: Pieces.ApplicationNameEnum.OpenSource,
              version: '1.0.0',
              platform: Pieces.PlatformEnum.Windows,
              onboarded: true,
              privacy: Pieces.PrivacyEnum.Anonymous,
            },
            metadata: {
              name: snippet.title,
            },
            format: {
              fragment: {
                string: {
                  raw: snippet.content,
                },
              },
            },
          },
        },
      })

      return result.id
    } catch (error) {
      console.error('[PiecesClient] Failed to save snippet:', error)
      throw new Error('Pieces OS not reachable. Please ensure Pieces is running.')
    }
  }

  /**
   * Search for clinical snippets in Pieces
   */
  public async searchClinicalMemory(query: string): Promise<PiecesSearchResponse> {
    try {
      // In Pieces SDK, search often uses the /search endpoint
      // Simplified version: listing assets if search is complex to implement immediately
      // Actually, Pieces search is usually prefix-based or through QGPT

      const assets = await this.assetsApi.assetsSnapshot()

      const filtered = assets.iterable
        .filter(asset => asset.name?.toLowerCase().includes(query.toLowerCase()))
        .map(asset => ({
          id: asset.id,
          title: asset.name || 'Untitled Snippet',
          content: 'Content retrieval requires additional API calls per asset', // Placeholder
          classification: 'plaintext' as const,
        }))

      return {
        snippets: filtered as PiecesSnippet[],
        total: filtered.length,
      }
    } catch (error) {
      console.error('[PiecesClient] Search failed:', error)
      return { snippets: [], total: 0 }
    }
  }

  /**
   * Check connection to Pieces OS
   */
  public async checkAvailability(): Promise<boolean> {
    try {
      const wellKnown = new Pieces.WellKnownApi(this.config)
      await wellKnown.getWellKnownHealth()
      return true
    } catch {
      return false
    }
  }

  /**
   * Proactively retrieves relevant clinical context based on query
   * Synthesizes patterns from local memory to ground the agent
   */
  public async getRelevantContext(query: string, patientId?: string): Promise<string> {
    // Check configuration setting
    const { enableAutoSuggestions } = useSettingsStore.getState().pieces
    if (!enableAutoSuggestions) {
      console.log('[PiecesClient] Auto-suggestions disabled by user settings.')
      return ''
    }

    const response = await this.searchClinicalMemory(`${query} ${patientId || ''}`)
    if (!response.snippets || response.snippets.length === 0) return ''

    // Synthesize top 3 snippets into a prompt-friendly string
    return response.snippets
      .slice(0, 3)
      .map(s => `- ${s.title}: ${s.content}`)
      .join('\n')
  }

  /**
   * Alias for checkAvailability to match standard health check naming
   */
  public async isAvailable(): Promise<boolean> {
    return this.checkAvailability()
  }
}

export const piecesClient = PiecesClient.getInstance()
