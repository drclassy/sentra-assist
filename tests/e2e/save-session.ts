/**
 * Save ePuskesmas Session — jalankan SEKALI sebelum E2E test
 *
 * Usage:
 *   pnpm tsx tests/e2e/save-session.ts
 *
 * Cara:
 * 1. Jendela Chrome baru terbuka (profile kosong, dengan extension)
 * 2. Login ke ePuskesmas secara manual
 * 3. Tekan Enter di terminal ini
 * 4. Session tersimpan ke tests/e2e/auth.json
 */

import { chromium } from 'playwright';
import path from 'path';
import readline from 'readline';

const EXTENSION_PATH = path.resolve(__dirname, '../../.output/chrome-mv3-dev');
const TEST_PROFILE = path.resolve(__dirname, '.test-profile');
const AUTH_FILE = path.resolve(__dirname, 'auth.json');

async function main() {
  console.log('🔐 Membuka Chrome dengan profile test + extension Sentra Assist...');
  console.log(`   Extension: ${EXTENSION_PATH}`);
  console.log(`   Profile:   ${TEST_PROFILE}`);

  const context = await chromium.launchPersistentContext(TEST_PROFILE, {
    channel: 'chrome',
    headless: false,
    args: [
      `--load-extension=${EXTENSION_PATH}`,
      `--disable-extensions-except=${EXTENSION_PATH}`,
      '--no-first-run',
    ],
  });

  const page = await context.newPage();
  await page.goto('https://kotakediri.epuskesmas.id', { waitUntil: 'domcontentloaded' });

  console.log('\n✋ Silakan login ke ePuskesmas di jendela Chrome yang terbuka.');
  console.log('   Setelah berhasil masuk, tekan Enter di sini...\n');

  await waitForEnter();

  await context.storageState({ path: AUTH_FILE });
  console.log(`\n✅ Session tersimpan ke: ${AUTH_FILE}`);
  console.log('   Sekarang jalankan: pnpm test:e2e\n');

  await context.close();
}

function waitForEnter(): Promise<void> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question('', () => {
      rl.close();
      resolve();
    });
  });
}

main().catch((err) => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
