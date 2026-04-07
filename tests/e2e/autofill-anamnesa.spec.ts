import { test, expect } from '@playwright/test';

const EPUSKESMAS_URL =
  'https://kotakediri.epuskesmas.id/anamnesa/create/72095?from=%27pelayanan%27&action=%27edit%27';

test.describe('Autofill RME — Anamnesa', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(EPUSKESMAS_URL, { waitUntil: 'domcontentloaded', timeout: 25_000 });

    // Skip jika session expired
    if (page.url().includes('login') || page.url().includes('auth')) {
      console.warn('[E2E] Session expired — jalankan: pnpm tsx tests/e2e/save-session.ts');
      test.skip();
    }
  });

  test('DOM field TTV terdeteksi di form anamnesa', async ({ page }) => {
    await expect(page.locator('input[name="PeriksaFisik[sistole]"]').first())
      .toBeVisible({ timeout: 10_000 });
    await expect(page.locator('input[name="PeriksaFisik[diastole]"]').first())
      .toBeVisible({ timeout: 5_000 });
    await expect(page.locator('input[name="PeriksaFisik[detak_nadi]"]').first())
      .toBeVisible({ timeout: 5_000 });

    console.log('[E2E] ✅ Field TTV ditemukan di DOM ePuskesmas');
  });

  test('autofill vital signs ke form anamnesa', async ({ page }) => {
    const vitals: Record<string, string> = {
      'PeriksaFisik[sistole]': '120',
      'PeriksaFisik[diastole]': '80',
      'PeriksaFisik[detak_nadi]': '80',
      'PeriksaFisik[nafas]': '18',
      'PeriksaFisik[suhu]': '36.5',
    };

    for (const [name, value] of Object.entries(vitals)) {
      const el = page.locator(`input[name="${name}"]`).first();
      if (await el.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await el.fill(value);
        console.log(`[E2E] ✅ ${name} = ${value}`);
      } else {
        console.warn(`[E2E] ⚠️ Field tidak ditemukan: ${name}`);
      }
    }

    // Verifikasi nilai tersimpan
    const sistoleVal = await page
      .locator('input[name="PeriksaFisik[sistole]"]')
      .first()
      .inputValue();
    expect(sistoleVal).toBe('120');

    console.log('[E2E] ✅ Vital signs berhasil di-fill ke form ePuskesmas');
  });

  test('field keluhan utama bisa diisi', async ({ page }) => {
    const keluhanEl = page.locator('textarea[name="Anamnesa[keluhan_utama]"]').first();
    await expect(keluhanEl).toBeVisible({ timeout: 10_000 });

    await keluhanEl.fill('Batuk dan pilek sejak 3 hari, demam ringan');
    expect(await keluhanEl.inputValue()).toContain('Batuk');

    console.log('[E2E] ✅ Keluhan utama berhasil diisi');
  });
});
