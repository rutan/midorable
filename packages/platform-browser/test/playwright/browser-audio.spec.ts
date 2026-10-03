import { expect, test } from '@playwright/test';

test('loads base64 audio when connect-src CSP blocks data URL fetches', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => typeof window.__midorableAudioSmoke === 'function');

  const result = await page.evaluate(async (url) => {
    const policy = document.createElement('meta');
    policy.httpEquiv = 'Content-Security-Policy';
    policy.content = "connect-src 'none'";
    document.head.append(policy);

    let fetchBlocked = false;
    try {
      await fetch(url);
    } catch {
      fetchBlocked = true;
    }

    return { fetchBlocked, ...(await window.__midorableAudioSmoke(url)) };
  }, createSilentWavDataUrl());

  expect(result.fetchBlocked).toBe(true);
  expect(result.channels).toBe(1);
  expect(result.duration).toBeCloseTo(0.01, 3);
});

function createSilentWavDataUrl(): string {
  const sampleCount = 80;
  const wav = Buffer.alloc(44 + sampleCount);
  wav.write('RIFF', 0);
  wav.writeUInt32LE(wav.length - 8, 4);
  wav.write('WAVEfmt ', 8);
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20);
  wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(8000, 24);
  wav.writeUInt32LE(8000, 28);
  wav.writeUInt16LE(1, 32);
  wav.writeUInt16LE(8, 34);
  wav.write('data', 36);
  wav.writeUInt32LE(sampleCount, 40);
  wav.fill(128, 44);
  return `data:audio/wav;base64,${wav.toString('base64')}`;
}

declare global {
  interface Window {
    __midorableAudioSmoke(url: string): Promise<{ duration: number; channels: number }>;
  }
}
