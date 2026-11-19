import { defineConfig } from '@playwright/test';
import { existsSync } from 'node:fs';

if (existsSync('.env')) process.loadEnvFile('.env');

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 90000,
  use: {
    baseURL: 'http://localhost:5173',
    headless: true,
    channel: process.env.FRAME_ROOM_E2E_CHANNEL,
    trace: 'retain-on-failure',
    actionTimeout: 15000,
  },
  outputDir: '.artifacts/playwright',
  reporter: 'list',
  webServer: {
    command: 'pnpm dev',
    url: 'http://localhost:5173',
    reuseExistingServer: true,
    timeout: 120000,
  },
});
