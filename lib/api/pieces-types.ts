// Designed and constructed by Claudesy.
/**
 * Precision-Architected. Future-Built by Docsyanpse
 * Sentra Healthcare Artificial Intelligence
 */

/**
 * Pieces Integration Types
 */

export interface PiecesSnippet {
  id?: string
  title: string
  content: string
  classification: 'markdown' | 'plaintext' | 'typescript'
  tags?: string[]
  created?: Date
}

/**
 * PiecesConfig interface
 *
 * @remarks
 * TODO: Add type description and property documentation
 * Auto-generated on 2026-03-12
 */

export interface PiecesConfig {
  baseUrl: string // Default: http://localhost:1000
}

/**
 * PiecesSearchResponse interface
 *
 * @remarks
 * TODO: Add type description and property documentation
 * Auto-generated on 2026-03-12
 */

export interface PiecesSearchResponse {
  snippets: PiecesSnippet[]
  total: number
}
