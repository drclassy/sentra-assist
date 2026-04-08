// Blueprinted & built by Claudesy.
/**
 * DDInter CSV to JSON Converter
 * Converts DDInter 2.0 CSV files to compact JSON for Sentra Assist DDI checker
 *
 * Output format optimized for fast lookup and minimal bundle size:
 * {
 *   drugs: { "aspirin": 0, "warfarin": 1, ... },  // drugName -> drugIndex
 *   interactions: [[0, 1, 3], ...]  // [drugA_idx, drugB_idx, severity]
 * }
 *
 * Severity codes: 0=unknown, 1=minor, 2=moderate, 3=major
 */

const fs = require('fs');
const path = require('path');

const DDI_DIR = path.join(__dirname, '../data/ddi');
const OUTPUT_FILE = path.join(__dirname, '../data/ddi-database.json');
const OUTPUT_COMPACT = path.join(__dirname, '../data/ddi-database.min.json');

// Severity mapping
const SEVERITY_MAP = {
  'unknown': 0,
  'minor': 1,
  'moderate': 2,
  'major': 3,
};

function normalizeDrugName(name) {
  if (!name) return '';
  return name
    .toLowerCase()
    .trim()
    .replace(/\s*\([^)]*\)\s*/g, '') // Remove parenthetical info like (topical)
    .replace(/[^a-z0-9]/g, '');      // Keep only alphanumeric
}

function parseSeverity(level) {
  if (!level) return 0;
  const normalized = level.toLowerCase().trim();
  return SEVERITY_MAP[normalized] ?? 0;
}

function parseCSVLine(line) {
  // Simple CSV parser that handles quoted fields
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());

  return result;
}

async function main() {
  console.log('=== DDInter CSV to JSON Converter ===\n');

  const mergedFile = path.join(DDI_DIR, 'ddinter_merged.csv');

  if (!fs.existsSync(mergedFile)) {
    console.error('Error: ddinter_merged.csv not found. Run download first.');
    process.exit(1);
  }

  console.log('Reading merged CSV...');
  const content = fs.readFileSync(mergedFile, 'utf-8');
  const lines = content.split('\n').filter(l => l.trim());

  console.log(`Total lines: ${lines.length}`);

  // Skip header
  const dataLines = lines.slice(1);

  // Build drug index and interactions
  const drugIndex = new Map(); // drugName -> index
  const interactions = [];     // [[drugA_idx, drugB_idx, severity], ...]
  const seenPairs = new Set(); // To track unique pairs

  let drugCounter = 0;
  let validCount = 0;
  let skippedCount = 0;

  for (const line of dataLines) {
    const parts = parseCSVLine(line);

    if (parts.length < 5) {
      skippedCount++;
      continue;
    }

    const [, drugA, , drugB, level] = parts;

    // Normalize drug names
    const normA = normalizeDrugName(drugA);
    const normB = normalizeDrugName(drugB);

    if (!normA || !normB || normA === normB) {
      skippedCount++;
      continue;
    }

    // Validate severity
    const severity = parseSeverity(level);
    if (!['unknown', 'minor', 'moderate', 'major'].includes(level?.toLowerCase()?.trim())) {
      // Skip rows with invalid severity (likely parsing errors)
      skippedCount++;
      continue;
    }

    // Get or create drug indices
    if (!drugIndex.has(normA)) {
      drugIndex.set(normA, drugCounter++);
    }
    if (!drugIndex.has(normB)) {
      drugIndex.set(normB, drugCounter++);
    }

    const idxA = drugIndex.get(normA);
    const idxB = drugIndex.get(normB);

    // Ensure consistent ordering (smaller index first)
    const [idx1, idx2] = idxA < idxB ? [idxA, idxB] : [idxB, idxA];

    // Check for duplicates
    const pairKey = `${idx1}-${idx2}`;
    if (seenPairs.has(pairKey)) {
      skippedCount++;
      continue;
    }
    seenPairs.add(pairKey);

    interactions.push([idx1, idx2, severity]);
    validCount++;
  }

  console.log(`\nProcessing complete:`);
  console.log(`  - Valid interactions: ${validCount}`);
  console.log(`  - Skipped: ${skippedCount}`);
  console.log(`  - Unique drugs: ${drugIndex.size}`);

  // Build output
  const output = {
    version: '2.0',
    source: 'DDInter 2.0 (https://ddinter2.scbdd.com/)',
    generated: new Date().toISOString(),
    stats: {
      drugs: drugIndex.size,
      interactions: interactions.length,
      byLevel: {
        major: interactions.filter(i => i[2] === 3).length,
        moderate: interactions.filter(i => i[2] === 2).length,
        minor: interactions.filter(i => i[2] === 1).length,
        unknown: interactions.filter(i => i[2] === 0).length,
      }
    },
    severityCodes: { unknown: 0, minor: 1, moderate: 2, major: 3 },
    drugs: Object.fromEntries(drugIndex),
    interactions: interactions,
  };

  // Also create reverse lookup (index -> drug name)
  const drugNames = new Array(drugIndex.size);
  for (const [name, idx] of drugIndex) {
    drugNames[idx] = name;
  }
  output.drugNames = drugNames;

  console.log(`\nSeverity distribution:`);
  console.log(`  - Major: ${output.stats.byLevel.major}`);
  console.log(`  - Moderate: ${output.stats.byLevel.moderate}`);
  console.log(`  - Minor: ${output.stats.byLevel.minor}`);
  console.log(`  - Unknown: ${output.stats.byLevel.unknown}`);

  // Write full version
  console.log(`\nWriting ${OUTPUT_FILE}...`);
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2));

  // Write minified version
  console.log(`Writing ${OUTPUT_COMPACT}...`);
  fs.writeFileSync(OUTPUT_COMPACT, JSON.stringify(output));

  // Check file sizes
  const fullSize = fs.statSync(OUTPUT_FILE).size;
  const compactSize = fs.statSync(OUTPUT_COMPACT).size;

  console.log(`\nFile sizes:`);
  console.log(`  - Full: ${(fullSize / 1024 / 1024).toFixed(2)} MB`);
  console.log(`  - Minified: ${(compactSize / 1024 / 1024).toFixed(2)} MB`);

  console.log('\n✅ Conversion complete!');
}

main().catch(console.error);
