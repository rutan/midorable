import { test } from '@playwright/test';

type PlatformKind = 'canvas' | 'webgl' | 'webgpu';
type SmokeName = 'sprite' | 'mask' | 'filter' | 'mesh' | 'dispose';
type BenchmarkName = 'sprites' | 'mask' | 'filter' | 'nine-patch' | 'mesh';

interface SmokeResult {
  canvasAttached: boolean;
}

interface BrowserBenchmarkResult {
  name: BenchmarkName;
  kind: PlatformKind;
  frames: number;
  sprites: number;
  meanMs: number;
  p95Ms: number;
  maxMs: number;
}

const benchmarkTargets: Array<{ name: BenchmarkName; kinds: PlatformKind[] }> = [
  { name: 'sprites', kinds: ['canvas', 'webgl', 'webgpu'] },
  { name: 'mask', kinds: ['canvas', 'webgl'] },
  { name: 'filter', kinds: ['webgl', 'webgpu'] },
  { name: 'nine-patch', kinds: ['canvas', 'webgl', 'webgpu'] },
  { name: 'mesh', kinds: ['webgl'] },
];

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

for (const target of benchmarkTargets) {
  for (const kind of target.kinds) {
    test(`${kind} ${target.name} render benchmark`, async ({ page }) => {
      const supported = await page.evaluate((targetKind) => window.__midorableBrowserSmoke.supports(targetKind), kind);
      test.skip(!supported, `${kind} is not supported in this browser environment`);

      const result = await page.evaluate(
        ([targetKind, benchmarkName]) => window.__midorableBrowserSmoke.benchmark(targetKind, benchmarkName),
        [kind, target.name] satisfies [PlatformKind, BenchmarkName],
      );

      console.log(JSON.stringify(result));
      await page.evaluate(() => window.__midorableBrowserSmoke.cleanup());
    });
  }
}

declare global {
  interface Window {
    __midorableBrowserSmoke: {
      supports(kind: PlatformKind): Promise<boolean>;
      run(kind: PlatformKind, name: SmokeName): Promise<SmokeResult>;
      benchmark(kind: PlatformKind, name: BenchmarkName): Promise<BrowserBenchmarkResult>;
      cleanup(): void;
    };
  }
}
