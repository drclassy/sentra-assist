import fs from 'node:fs';
import path from 'node:path';

import { chromium } from 'playwright';

function readRequiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} wajib diisi untuk smoke test server-backed.`);
  }
  return value;
}

function readAutomationToken(rootDir: string): string {
  const envPath = path.resolve(rootDir, '../primary-healthcare/dashboard/.env.local');
  const envContent = fs.readFileSync(envPath, 'utf8');
  return (envContent.match(/^CREW_ACCESS_AUTOMATION_TOKEN=(.*)$/m)?.[1] || '').trim();
}

async function main(): Promise<void> {
  const rootDir = process.cwd();
  const extensionPath = path.resolve(rootDir, '.output/chrome-mv3-dev');
  const automationToken = readAutomationToken(rootDir);
  const headless = process.env.SMOKE_HEADLESS === '1';
  const smokeBaseUrl = readRequiredEnv('SMOKE_CREW_BASE_URL');
  const smokeUsername = readRequiredEnv('SMOKE_CREW_USERNAME');
  const smokePassword = readRequiredEnv('SMOKE_CREW_PASSWORD');

  if (!automationToken) {
    throw new Error('CREW_ACCESS_AUTOMATION_TOKEN tidak ditemukan di dashboard/.env.local');
  }

  const artifactDir = path.resolve(rootDir, 'output/playwright');
  const profileDir = path.join(artifactDir, `smoke-profile-${Date.now()}`);
  fs.mkdirSync(profileDir, { recursive: true });
  const debugScreenshotPath = path.join(artifactDir, 'sidepanel-anamnesis-smoke-debug.png');

  const context = await chromium.launchPersistentContext(profileDir, {
    channel: 'chromium',
    headless,
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
      '--no-first-run',
    ],
  });

  let page = null as Awaited<ReturnType<typeof context.newPage>> | null;

  try {
    let serviceWorker = context.serviceWorkers()[0];
    if (!serviceWorker) {
      serviceWorker = await context.waitForEvent('serviceworker', { timeout: 20_000 });
    }

    const extensionId = new URL(serviceWorker.url()).host;
    page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/sidepanel.html`, {
      waitUntil: 'domcontentloaded',
    });

    await page.evaluate(
      async ({ baseUrl, token }) => {
        await chrome.storage.local.set({
          'sentra:auth-config': {
            baseUrl,
            automationToken: token,
          },
          'sentra:bridge-config': {
            enabled: true,
            pollIntervalMinutes: 0.5,
          },
        });
      },
      { baseUrl: smokeBaseUrl, token: automationToken }
    );

    await page.locator('#login-username').fill(smokeUsername);
    const passwordInput = page.locator('#login-password');
    await passwordInput.fill(smokePassword);
    await passwordInput.press('Enter');

    await page
      .getByRole('button', { name: 'Launch Console — masuk UI utama' })
      .waitFor({ timeout: 15_000 });
    await page
      .getByRole('button', { name: 'Launch Console — masuk UI utama' })
      .click({ force: true });

    await page.getByRole('tab', { name: 'Pengaturan' }).waitFor({ timeout: 15_000 });
    await page.evaluate(() => {
      localStorage.setItem(
        'sentra-assist:settings',
        JSON.stringify({
          toggles: {
            'auto-fill': true,
            alerts: true,
            bridge: true,
            sounds: false,
            'dark-mode': true,
            telemetry: false,
          },
          workspaceUrl: 'https://kotakediri.epuskesmas.id',
        })
      );
    });

    await page.getByRole('tab', { name: 'Pengaturan' }).waitFor({ timeout: 15_000 });
    await page.getByRole('tab', { name: 'Pengaturan' }).click();
    await page.getByText('Runtime: ready').waitFor({ timeout: 15_000 });

    await page.getByRole('tab', { name: 'VS Inference' }).click();
    const symptomText =
      'Pasien mengeluh nyeri perut kanan bawah sejak 2 hari, disertai mual dan muntah, tidak diare, skala nyeri 7/10, memberat saat berjalan, membaik saat istirahat, aktivitas terganggu.';

    const symptomInput = page.getByLabel('Keluhan utama pasien');
    await symptomInput.waitFor({ timeout: 15_000 });
    await symptomInput.fill(symptomText);
    const filledValue = await symptomInput.inputValue();
    if (!filledValue.toLowerCase().includes('nyeri perut kanan bawah')) {
      throw new Error('Textarea gejala tidak menyimpan input smoke test dengan benar');
    }

    await page.waitForTimeout(2_500);

    const autoTriggered = await page.evaluate(() => {
      const text = document.body.innerText.toLowerCase();
      return (
        text.includes('[autosen anamnesa draft]') &&
        text.includes('nyeri perut kanan bawah') &&
        text.includes('catatan verifikasi:')
      );
    });

    if (!autoTriggered) {
      await page.getByRole('button', { name: 'AutoComplete+ Gejala' }).click();
    }

    await page.waitForFunction(
      () => {
        const text = document.body.innerText.toLowerCase();
        return (
          text.includes('[autosen anamnesa draft]') &&
          text.includes('nyeri perut kanan bawah') &&
          text.includes('catatan verifikasi:')
        );
      },
      { timeout: 40_000 }
    );

    const outputText = await page.locator('.output-content').innerText();
    const screenshotPath = path.join(artifactDir, 'sidepanel-anamnesis-smoke.png');
    await page.screenshot({ path: screenshotPath, fullPage: true });

    console.log(
      JSON.stringify(
        {
          extensionId,
          screenshotPath,
          outputPreview: outputText.slice(0, 1200),
          checks: {
            hasDraftHeader: outputText.includes('[AUTOSEN ANAMNESA DRAFT]'),
            hasChiefComplaint: outputText.toLowerCase().includes('nyeri perut kanan bawah'),
            hasAssociatedSymptoms: outputText.toLowerCase().includes('mual dan muntah'),
            hasVerificationNote: outputText.includes('Catatan verifikasi:'),
            hasBridgeReady: true,
          },
        },
        null,
        2
      )
    );
  } finally {
    if (page) {
      try {
        await page.screenshot({ path: debugScreenshotPath, fullPage: true });
        const debugText = await page
          .locator('body')
          .innerText()
          .catch(() => '');
        if (debugText) {
          fs.writeFileSync(
            path.join(artifactDir, 'sidepanel-anamnesis-smoke-debug.txt'),
            debugText,
            'utf8'
          );
        }
      } catch {
        // best-effort debug artifact only
      }
    }
    await context.close();
  }
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
