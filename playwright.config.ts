import { defineConfig } from '@playwright/test';
import path from 'path';
import fs from 'fs';

const EXTENSION_PATH = path.resolve(__dirname, '.output/chrome-mv3-dev');
const TEST_PROFILE = path.resolve(__dirname, 'tests/e2e/.test-profile');
const AUTH_FILE = path.resolve(__dirname, 'tests/e2e/auth.json');

const storageState = fs.existsSync(AUTH_FILE) ? AUTH_FILE : undefined;

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  retries: 0,
  reporter: 'list',
  use: {
    headless: false,
    viewport: { width: 1280, height: 800 },
    storageState,
    video: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'sentra-assist-e2e',
      use: {
        browserName: 'chromium',
        launchOptions: {
          channel: 'chrome',
          headless: false,
          args: [
            `--load-extension=${EXTENSION_PATH}`,
            `--disable-extensions-except=${EXTENSION_PATH}`,
            '--no-first-run',
          ],
        },
      },
    },
  ],
});
