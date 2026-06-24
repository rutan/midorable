import net from 'node:net';
import { defineConfig, devices } from '@playwright/test';

const testPort = await resolveTestPort();
const baseURL = `http://127.0.0.1:${testPort}`;

export default defineConfig({
  testDir: './test/playwright',
  testMatch: /.*\.bench\.ts/,
  workers: 1,
  timeout: 60_000,
  use: {
    baseURL,
    trace: 'retain-on-failure',
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
          reject(new Error('failed to allocate browser benchmark port'));
        }
      });
    });
  });
}

async function resolveTestPort() {
  const configuredPort = process.env.PLAYWRIGHT_BENCH_PORT;
  if (configuredPort !== undefined && configuredPort !== '') {
    const port = Number(configuredPort);
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      throw new Error(
        `PLAYWRIGHT_BENCH_PORT must be an integer between 1 and 65535, got ${JSON.stringify(configuredPort)}`,
      );
    }
    return port;
  }

  const port = await getFreePort();
  process.env.PLAYWRIGHT_BENCH_PORT = String(port);
  return port;
}
