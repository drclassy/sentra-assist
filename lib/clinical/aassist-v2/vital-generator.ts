/**
 * AASSIST v2 — Seeded Random Vital Generator
 * Generates clinically plausible vital signs with optional seed for reproducibility.
 * commit: feat(aassist): seeded random vital generator with preset ranges
 */

// ─── Mulberry32 PRNG (OSS, zero-dep) ───────────────────────────────────────
function seededRand(seed: number): () => number {
  let s = seed;
  return () => {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randFloat(rng: () => number, min: number, max: number): number {
  return min + rng() * (max - min);
}

function randInt(rng: () => number, min: number, max: number): number {
  return Math.round(randFloat(rng, min, max));
}

// ─── Rentang Normal Klinis Default ─────────────────────────────────────────
export const NORMAL_RANGES = {
  sbp: { min: 90, max: 120 },
  dbp: { min: 60, max: 80 },
  hr: { min: 60, max: 100 },
  rr: { min: 12, max: 20 },
  temp: { min: 36.1, max: 37.2 },
  spo2: { min: 95, max: 100 },
  glucose: { min: 70, max: 140 },
} as const;

// ─── Rentang Per Preset ─────────────────────────────────────────────────────
export const PRESET_RANGES = {
  hipertensi: {
    sbp: { min: 140, max: 180 },
    dbp: { min: 90, max: 110 },
  },
  hipotensi: {
    sbp: { min: 60, max: 89 },
    dbp: { min: 40, max: 59 },
  },
  hiperglikemi: {
    glucose: { min: 180, max: 350 },
  },
} as const;

// ─── Types ──────────────────────────────────────────────────────────────────
export type AassistPreset = 'hipertensi' | 'hipotensi' | 'hiperglikemi';

/**
 * GenerateVitalsOptions interface
 * 
 * @remarks
 * TODO: Add type description and property documentation
 * Auto-generated on 2026-04-15
 */

export interface GenerateVitalsOptions {
  preset?: AassistPreset | null;
  seed?: number;
  constraints?: Partial<typeof NORMAL_RANGES>;
}

/**
 * GeneratedVitals interface
 * 
 * @remarks
 * TODO: Add type description and property documentation
 * Auto-generated on 2026-04-15
 */

export interface GeneratedVitals {
  sbp: string;
  dbp: string;
  hr: string;
  rr: string;
  temp: string;
  spo2: string;
  glucose: string;
}

/**
 * AutocompleteMetadata interface
 * 
 * @remarks
 * TODO: Add type description and property documentation
 * Auto-generated on 2026-04-15
 */

export interface AutocompleteMetadata {
  source: 'ASIST-autocomplete';
  seedUsed: number;
  generatedAt: string;
  preset: AassistPreset | null;
}

/**
 * GenerateVitalsResult interface
 * 
 * @remarks
 * TODO: Add type description and property documentation
 * Auto-generated on 2026-04-15
 */

export interface GenerateVitalsResult {
  vitals: GeneratedVitals;
  metadata: AutocompleteMetadata;
  reasoning: string[];
}

// ─── Main Generator ─────────────────────────────────────────────────────────
export function generateVitals(opts: GenerateVitalsOptions = {}): GenerateVitalsResult {
  const seed = opts.seed ?? Date.now();
  const rng = seededRand(seed);
  const ranges = { ...NORMAL_RANGES, ...(opts.constraints ?? {}) };
  const pr = opts.preset ? PRESET_RANGES[opts.preset] : {};

  const sbp = randInt(
    rng,
    (pr as Partial<typeof PRESET_RANGES.hipertensi>).sbp?.min ?? ranges.sbp.min,
    (pr as Partial<typeof PRESET_RANGES.hipertensi>).sbp?.max ?? ranges.sbp.max
  );
  const dbp = randInt(
    rng,
    (pr as Partial<typeof PRESET_RANGES.hipertensi>).dbp?.min ?? ranges.dbp.min,
    (pr as Partial<typeof PRESET_RANGES.hipertensi>).dbp?.max ?? ranges.dbp.max
  );
  const hr = randInt(rng, ranges.hr.min, ranges.hr.max);
  const rr = randInt(rng, ranges.rr.min, ranges.rr.max);
  const temp = parseFloat(randFloat(rng, ranges.temp.min, ranges.temp.max).toFixed(1));
  const spo2 = randInt(rng, ranges.spo2.min, ranges.spo2.max);
  const glucose = randInt(
    rng,
    (pr as Partial<typeof PRESET_RANGES.hiperglikemi>).glucose?.min ?? ranges.glucose.min,
    (pr as Partial<typeof PRESET_RANGES.hiperglikemi>).glucose?.max ?? ranges.glucose.max
  );

  const preset = opts.preset ?? null;
  const reasoning: string[] = [
    `Preset: ${preset ?? 'normal (tanpa preset)'}. Seed: ${seed}.`,
    `TD ${sbp}/${dbp} mmHg | HR ${hr} bpm | RR ${rr} rpm | SpO₂ ${spo2}% | Suhu ${temp}°C | GDS ${glucose} mg/dL.`,
  ];

  return {
    vitals: {
      sbp: String(sbp),
      dbp: String(dbp),
      hr: String(hr),
      rr: String(rr),
      temp: String(temp),
      spo2: String(spo2),
      glucose: String(glucose),
    },
    metadata: {
      source: 'ASIST-autocomplete',
      seedUsed: seed,
      generatedAt: new Date().toISOString(),
      preset,
    },
    reasoning,
  };
}
