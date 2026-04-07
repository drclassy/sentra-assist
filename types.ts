// Designed and constructed by Claudesy.
/**
 * @deprecated Legacy types — prefer '@/utils/types' for Encounter contracts.
 * Kept for backward compatibility with lib/scraper/anamnesa.ts.
 * Do NOT add new types here.
 */

export interface EncounterData {
  patientId: string
  encounterId?: string
  timestamp: string
  complaint?: string
  history?: string[]
  allergies?: string[]
  diagnosis?: {
    code: string
    name: string
    type: 'Primary' | 'Secondary'
  }[]
}
