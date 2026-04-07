import { describe, expect, it } from 'vitest'
import {
  CANONICAL_CLINICAL_ENGINE_OUTPUT_SCHEMA,
  CANONICAL_DIFFERENTIAL_OUTPUT_SCHEMA,
  isAnamnesisExtractionResult,
  isCanonicalClinicalEngineOutput,
  isCanonicalDifferentialOutput,
} from './bridge-client'

function isUUIDv4(str: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(str)
}

describe('event_id generation', () => {
  it('crypto.randomUUID() produces valid UUID v4', () => {
    const id = crypto.randomUUID()
    expect(isUUIDv4(id)).toBe(true)
  })

  it('two calls to crypto.randomUUID() produce different IDs', () => {
    const a = crypto.randomUUID()
    const b = crypto.randomUUID()
    expect(a).not.toBe(b)
  })

  it('isUUIDv4 rejects non-UUIDs', () => {
    expect(isUUIDv4('not-a-uuid')).toBe(false)
    expect(isUUIDv4('')).toBe(false)
  })
})

describe('ConsultPayload screening_result type contract', () => {
  it('accepts screening_result with all fields', () => {
    const result: {
      status: 'positive' | 'negative' | 'inconclusive'
      score?: number
      risk_level?: 'low' | 'medium' | 'high' | 'critical'
      summary?: string
    } = {
      status: 'positive',
      score: 85,
      risk_level: 'high',
      summary: 'HTN Crisis',
    }
    expect(result.status).toBe('positive')
    expect(result.score).toBe(85)
  })
})

describe('canonical contract guards', () => {
  it('exports canonical schema artifacts with expected required keys', () => {
    expect(CANONICAL_CLINICAL_ENGINE_OUTPUT_SCHEMA.required).toEqual(
      expect.arrayContaining(['request_id', 'processed_at', 'source', 'alerts', 'recommendations'])
    )
    expect(CANONICAL_DIFFERENTIAL_OUTPUT_SCHEMA.required).toEqual(
      expect.arrayContaining(['diagnosis_suggestions', 'alerts', 'meta'])
    )
  })

  it('accepts valid canonical clinical engine output shape', () => {
    const payload = {
      request_id: 'req-1',
      processed_at: new Date().toISOString(),
      source: { engine: 'dashboard-clinical-engine', engine_version: '1.0.0', mode: 'canonical' },
      scoring: {},
      alerts: [],
      recommendations: {
        immediate_actions: ['A'],
        monitoring_actions: ['B'],
        referral_actions: ['C'],
        next_best_questions: ['D'],
      },
      governance: {
        disclaimer: 'clinical support only',
        review_required: true,
        authoritative_engine: 'dashboard',
      },
    }

    expect(isCanonicalClinicalEngineOutput(payload)).toBe(true)
  })

  it('rejects invalid canonical clinical engine output shape', () => {
    const payload = {
      request_id: 'req-2',
      processed_at: new Date().toISOString(),
      source: { engine: 'dashboard-clinical-engine' },
      alerts: 'not-array',
      recommendations: {},
      governance: { disclaimer: 'x', review_required: true },
    }

    expect(isCanonicalClinicalEngineOutput(payload)).toBe(false)
  })

  it('accepts valid canonical differential output shape', () => {
    const payload = {
      diagnosis_suggestions: [],
      alerts: [],
      meta: {
        processing_time_ms: 120,
        source: 'dashboard-canonical-differential',
        model_version: 'v1',
      },
    }

    expect(isCanonicalDifferentialOutput(payload)).toBe(true)
  })

  it('rejects invalid canonical differential output shape', () => {
    const payload = {
      diagnosis_suggestions: [],
      alerts: [],
      meta: {
        processing_time_ms: '120',
        source: 'dashboard-canonical-differential',
        model_version: 'v1',
      },
    }

    expect(isCanonicalDifferentialOutput(payload)).toBe(false)
  })

  it('enforces canonical source constants in schema artifacts', () => {
    expect(CANONICAL_CLINICAL_ENGINE_OUTPUT_SCHEMA.properties.source.properties.engine.const).toBe(
      'dashboard-clinical-engine'
    )
    expect(CANONICAL_DIFFERENTIAL_OUTPUT_SCHEMA.properties.meta.properties.source.const).toBe(
      'dashboard-canonical-differential'
    )
  })
})

describe('hybrid anamnesis extraction contract guard', () => {
  it('accepts valid extraction result shape', () => {
    const payload = {
      keluhan_utama: 'nyeri dada',
      onset: 'sejak kemarin',
      lokasi: 'dada kiri',
      kualitas: 'tertindih',
      keparahan: 7,
      faktor_pemicu: ['aktivitas'],
      faktor_peredam: ['istirahat'],
      data_belum_lengkap: ['faktor_peredam'],
    }

    expect(isAnamnesisExtractionResult(payload)).toBe(true)
  })

  it('rejects extraction result with unknown missing-field key', () => {
    const payload = {
      keluhan_utama: 'nyeri dada',
      onset: null,
      lokasi: null,
      kualitas: null,
      keparahan: null,
      faktor_pemicu: [],
      faktor_peredam: [],
      data_belum_lengkap: ['unknown_key'],
    }

    expect(isAnamnesisExtractionResult(payload)).toBe(false)
  })
})
