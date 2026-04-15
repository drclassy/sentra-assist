// Blueprinted & built by Claudesy.
/**
 * Optimize DDI Database
 * Creates a compact version with only Major + Moderate interactions
 * These are the clinically relevant ones that need alerts
 */

const fs = require('fs');
const path = require('path');

const INPUT_FILE = path.join(__dirname, '../data/ddi-database.json');
const OUTPUT_FILE = path.join(__dirname, '../data/ddi-clinical.json');

async function main() {
  console.log('=== DDI Database Optimizer ===\n');

  const data = JSON.parse(fs.readFileSync(INPUT_FILE, 'utf-8'));

  console.log('Original stats:');
  console.log(`  - Drugs: ${data.stats.drugs}`);
  console.log(`  - Interactions: ${data.stats.interactions}`);

  // Filter to only Major (3) and Moderate (2) interactions
  const clinicalInteractions = data.interactions.filter(([, , severity]) =>
    severity === 3 || severity === 2
  );

  // Find drugs that are actually used in clinical interactions
  const usedDrugIndices = new Set();
  for (const [a, b] of clinicalInteractions) {
    usedDrugIndices.add(a);
    usedDrugIndices.add(b);
  }

  // Create new drug index mapping (old index -> new index)
  const oldToNew = new Map();
  const newDrugs = {};
  const newDrugNames = [];
  let newIndex = 0;

  for (const [drugName, oldIdx] of Object.entries(data.drugs)) {
    if (usedDrugIndices.has(oldIdx)) {
      oldToNew.set(oldIdx, newIndex);
      newDrugs[drugName] = newIndex;
      newDrugNames.push(drugName);
      newIndex++;
    }
  }

  // Remap interactions to new indices
  const remappedInteractions = clinicalInteractions.map(([a, b, severity]) => [
    oldToNew.get(a),
    oldToNew.get(b),
    severity,
  ]);

  const output = {
    version: '2.0-clinical',
    source: 'DDInter 2.0 (filtered: Major + Moderate only)',
    generated: new Date().toISOString(),
    stats: {
      drugs: newDrugNames.length,
      interactions: remappedInteractions.length,
      byLevel: {
        major: remappedInteractions.filter(i => i[2] === 3).length,
        moderate: remappedInteractions.filter(i => i[2] === 2).length,
      }
    },
    severityCodes: { moderate: 2, major: 3 },
    drugs: newDrugs,
    drugNames: newDrugNames,
    interactions: remappedInteractions,
  };

  console.log('\nOptimized stats:');
  console.log(`  - Drugs: ${output.stats.drugs}`);
  console.log(`  - Interactions: ${output.stats.interactions}`);
  console.log(`  - Major: ${output.stats.byLevel.major}`);
  console.log(`  - Moderate: ${output.stats.byLevel.moderate}`);

  // Write optimized version
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(output));

  const size = fs.statSync(OUTPUT_FILE).size;
  console.log(`\nOutput: ${OUTPUT_FILE}`);
  console.log(`Size: ${(size / 1024).toFixed(1)} KB`);

  console.log('\n✅ Optimization complete!');
}

main().catch(console.error);
