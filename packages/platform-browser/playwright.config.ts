import net from 'node:net';
import { defineConfig, devices } from '@playwright/test';

const testPort = await resolveTestPort();
const baseURL = `http://127.0.0.1:${testPort}`;
const isCI = process.env.CI === 'true';

export default defineConfig({
  testDir: './test/playwright',
  workers: isCI ? 1 : undefined,
  timeout: 30_000,
  expect: {
    timeout: 5_000,
  },
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    viewport: {
      width: 1280,
      height: 900,
    },
  },
  webServer: {
    command: `pnpm exec vite --config test/playwright/fixture/vite.config.ts --host 127.0.0.1 --port ${testPort}`,
    url: baseURL,
    reuseExistingServer: false,
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: {
          args: ['--enable-unsafe-webgpu'],
        },
      },
    },
  ],
});

function getFreePort() {
  return new Promise<number>((resolve, reject) => {
    const server = net.createServer();

    server.unref();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      server.close(() => {
        if (address && typeof address === 'object') {
          resolve(address.port);
        } else {
          reject(new Error('failed to allocate browser test port'));
        }
      });
    });
  });
}

async function resolveTestPort() {
  const configuredPort = process.env.PLAYWRIGHT_TEST_PORT;
  if (configuredPort) {
    return Number(configuredPort);
  }

  const port = await getFreePort();
  process.env.PLAYWRIGHT_TEST_PORT = String(port);
  return port;
}
