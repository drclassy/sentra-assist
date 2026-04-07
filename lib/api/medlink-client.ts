// Designed and constructed by Claudesy.
/**
 * Precision-Architected. Future-Built by Docsyanpse
 * Sentra Healthcare Artificial Intelligence
 */

/**
 * Medlink API Client
 * Sends encounter data from Assist to Medlink for automatic logbook
 *
 * @module lib/api/medlink-client
 */

import type { EncounterState, MedicationRow } from '@/lib/store'
import type { VitalSigns } from '@/types/api'

// =============================================================================
// TYPES
// =============================================================================

/**
 * Medlink API encounter payload
 * Maps to Medlink's /api/patient/encounters endpoint schema
 */
export interface MedlinkEncounterPayload {
  patient: {
    noRm: string
    nama: string
    jenisKelamin?: string
    umur?: string
    noBpjs?: string
    faskes?: string
  }
  encounter: {
    sourceSystem: 'SENTRA_ASSIST'
    sourceId: string
    faskes?: string
    poli?: string
    visitDate?: string
    visitTime?: string
    keluhan?: string
    diagnosisUtama?: string
    diagnosisIcd?: string
    resep?: MedicationRow[]
    vitalSigns?: Record<string, number | undefined>
    dokter?: string
  }
  // Optional: User ID for XP attribution
  userId?: string
}

/**
 * MedlinkApiResponse interface
 *
 * @remarks
 * TODO: Add type description and property documentation
 * Auto-generated on 2026-03-12
 */

export interface MedlinkApiResponse {
  success: boolean
  data?: {
    id: string
    patientNoRm: string
    sourceSystem: string
    sourceId: string
    createdAt: string
  }
  error?: string
}

// =============================================================================
// CONFIGURATION
// =============================================================================

const MEDLINK_API_URL = import.meta.env.VITE_MEDLINK_API_URL || 'http://localhost:3000'
const MEDLINK_API_KEY = import.meta.env.VITE_MEDLINK_API_KEY || ''

// =============================================================================
// DATA TRANSFORMATION
// =============================================================================

/**
 * Transform Assist encounter state to Medlink payload format
 */
export function transformToMedlinkPayload(
  state: EncounterState,
  userId?: string
): MedlinkEncounterPayload | null {
  const { patient, anamnesa, diagnosis, therapy, meta } = state

  // Validation: Must have patient context
  if (!patient) {
    console.warn('[Medlink] Cannot send encounter: No patient context')
    return null
  }

  // Validation: Must have pelayananId as source identifier
  if (!meta.pelayananId) {
    console.warn('[Medlink] Cannot send encounter: No pelayananId')
    return null
  }

  // Build patient data
  const patientPayload = {
    noRm: patient.medicalRecordNumber || patient.patientId,
    nama: patient.patientName,
    jenisKelamin: patient.gender === 'L' ? 'L' : 'P',
    umur: patient.age.toString(),
  }

  // Build encounter data
  const encounterPayload = {
    sourceSystem: 'SENTRA_ASSIST' as const,
    sourceId: meta.pelayananId,
    keluhan: anamnesa?.complaint,
    diagnosisUtama: diagnosis?.selectedDiagnosis || undefined,
    diagnosisIcd: diagnosis?.selectedICD10 || undefined,
    vitalSigns: anamnesa?.vitals ? transformVitalSigns(anamnesa.vitals) : undefined,
    resep: therapy?.medications ? transformMedications(therapy.medications) : undefined,
    dokter: therapy?.dokter || undefined,
    visitDate: new Date().toISOString().split('T')[0], // YYYY-MM-DD
    visitTime: new Date().toTimeString().split(' ')[0], // HH:MM:SS
  }

  return {
    patient: patientPayload,
    encounter: encounterPayload,
    userId,
  }
}

/**
 * Transform Assist vital signs to Medlink format
 */
function transformVitalSigns(vitals: VitalSigns): Record<string, number | undefined> {
  return {
    systolic: vitals.systolic,
    diastolic: vitals.diastolic,
    heart_rate: vitals.heart_rate,
    respiratory_rate: vitals.respiratory_rate,
    temperature: vitals.temperature,
    spo2: vitals.spo2,
    gcs: vitals.gcs,
  }
}

/**
 * Transform Assist medications to Medlink format
 */
function transformMedications(medications: MedicationRow[]): MedicationRow[] {
  return medications.map(med => ({
    id: med.id,
    racikan: med.racikan,
    jumlah_permintaan: med.jumlah_permintaan,
    nama_obat: med.nama_obat,
    jumlah: med.jumlah,
    signa: med.signa,
    aturan_pakai: med.aturan_pakai,
    keterangan: med.keterangan,
  }))
}

// =============================================================================
// API CLIENT
// =============================================================================

/**
 * Send encounter data to Medlink for automatic logbook
 *
 * @param payload - Encounter payload
 * @returns Promise resolving to API response
 */
export async function sendToMedlink(payload: MedlinkEncounterPayload): Promise<MedlinkApiResponse> {
  // Validation
  if (!MEDLINK_API_KEY) {
    console.error('[Medlink] API key not configured')
    return {
      success: false,
      error: 'Medlink API key not configured',
    }
  }

  try {
    const response = await fetch(`${MEDLINK_API_URL}/api/patient/encounters`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-sentra-assist-key': MEDLINK_API_KEY,
      },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => null)
      throw new Error(errorData?.error || `HTTP ${response.status}`)
    }

    const data = await response.json()
    console.log('[Medlink] Encounter sent successfully:', data)

    return {
      success: true,
      data,
    }
  } catch (error) {
    console.error('[Medlink] Failed to send encounter:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Send current encounter state to Medlink
 * Convenience wrapper that transforms and sends in one call
 *
 * @param state - Current encounter state from store
 * @param userId - Optional user ID for XP attribution
 * @returns Promise resolving to API response
 */
export async function sendCurrentEncounter(
  state: EncounterState,
  userId?: string
): Promise<MedlinkApiResponse> {
  const payload = transformToMedlinkPayload(state, userId)

  if (!payload) {
    return {
      success: false,
      error: 'Invalid encounter state - missing required data',
    }
  }

  return sendToMedlink(payload)
}
