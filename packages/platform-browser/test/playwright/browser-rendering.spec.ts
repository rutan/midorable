import { inflateSync } from 'node:zlib';
import { expect, test } from '@playwright/test';

type PlatformKind = 'canvas' | 'webgl' | 'webgpu';
type SmokeName = 'sprite' | 'mask' | 'filter' | 'mesh' | 'dispose';
type Rgba = [number, number, number, number];

interface SmokeResult {
  canvasAttached: boolean;
}

const pixelRendererKinds: PlatformKind[] = ['canvas', 'webgl'];
const lifecycleRendererKinds: PlatformKind[] = ['canvas', 'webgl', 'webgpu'];

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

for (const kind of pixelRendererKinds) {
  test(`${kind} renders a sprite with expected pixels`, async ({ page }) => {
    await skipIfUnsupported(page, kind);

    const result = await renderSmoke(page, kind, 'sprite');
    const image = await screenshotCanvas(page);

    expectColorNear(readPngPixelCss(image, 12, 12), [0, 255, 0, 255]);
    expectColorNear(readPngPixelCss(image, 2, 2), [255, 0, 0, 255]);
    expect(result.canvasAttached).toBe(true);
    await cleanupSmoke(page);
  });

  test(`${kind} applies a rectangular mask`, async ({ page }) => {
    await skipIfUnsupported(page, kind);

    await renderSmoke(page, kind, 'mask');
    const image = await screenshotCanvas(page);

    expectColorNear(readPngPixelCss(image, 30, 30), [0, 255, 0, 255]);
    expectColorNear(readPngPixelCss(image, 12, 12), [0, 0, 0, 255]);
    await cleanupSmoke(page);
  });
}

for (const kind of lifecycleRendererKinds) {
  test(`${kind} removes the canvas on dispose`, async ({ page }) => {
    await skipIfUnsupported(page, kind);

    const result = await renderSmoke(page, kind, 'dispose');

    expect(result.canvasAttached).toBe(false);
  });
}

for (const kind of ['webgl'] satisfies PlatformKind[]) {
  test(`${kind} applies a shader filter`, async ({ page }) => {
    await skipIfUnsupported(page, kind);

    await renderSmoke(page, kind, 'filter');
    const image = await screenshotCanvas(page);

    expectColorNear(readPngPixelCss(image, 12, 12), [255, 0, 0, 255]);
    expectColorNear(readPngPixelCss(image, 2, 2), [0, 0, 0, 255]);
    await cleanupSmoke(page);
  });

  test(`${kind} renders a textured triangle mesh`, async ({ page }) => {
    await skipIfUnsupported(page, kind);

    await renderSmoke(page, kind, 'mesh');
    const image = await screenshotCanvas(page);

    expectColorNear(readPngPixelCss(image, 12, 12), [0, 255, 0, 255]);
    expectColorNear(readPngPixelCss(image, 56, 56), [255, 0, 0, 255]);
    await cleanupSmoke(page);
  });
}

async function skipIfUnsupported(page: import('@playwright/test').Page, kind: PlatformKind) {
  const supported = await page.evaluate((targetKind) => window.__midorableBrowserSmoke.supports(targetKind), kind);
  test.skip(!supported, `${kind} is not supported in this browser environment`);
}

async function renderSmoke(page: import('@playwright/test').Page, kind: PlatformKind, name: SmokeName) {
  return page.evaluate(([targetKind, smokeName]) => window.__midorableBrowserSmoke.run(targetKind, smokeName), [
    kind,
    name,
  ] satisfies [PlatformKind, SmokeName]) as Promise<SmokeResult>;
}

async function cleanupSmoke(page: import('@playwright/test').Page) {
  await page.evaluate(() => window.__midorableBrowserSmoke.cleanup());
}

async function screenshotCanvas(page: import('@playwright/test').Page): Promise<PngImage> {
  const screenshot = await page.locator('canvas').screenshot();
  return decodePng(screenshot);
}

function expectColorNear(actual: Rgba | undefined, expected: Rgba) {
  expect(actual, 'pixel should be present').toBeDefined();
  const tolerance = 3;
  for (let index = 0; index < expected.length; index += 1) {
    expect(actual![index], `channel ${index}`).toBeGreaterThanOrEqual(expected[index]! - tolerance);
    expect(actual![index], `channel ${index}`).toBeLessThanOrEqual(expected[index]! + tolerance);
  }
}

interface PngImage {
  width: number;
  height: number;
  data: Uint8Array;
}

function readPngPixelCss(image: PngImage, x: number, y: number): Rgba {
  return readPngPixel(image, Math.floor((x + 0.5) * (image.width / 64)), Math.floor((y + 0.5) * (image.height / 64)));
}

function readPngPixel(image: PngImage, x: number, y: number): Rgba {
  if (x < 0 || y < 0 || x >= image.width || y >= image.height) {
    throw new Error(`Pixel out of bounds: ${x}, ${y} for ${image.width}x${image.height}`);
  }
  const offset = (y * image.width + x) * 4;
  return [
    image.data[offset] ?? 0,
    image.data[offset + 1] ?? 0,
    image.data[offset + 2] ?? 0,
    image.data[offset + 3] ?? 0,
  ];
}

function decodePng(buffer: Buffer): PngImage {
  const signature = buffer.subarray(0, 8).toString('hex');
  if (signature !== '89504e470d0a1a0a') {
    throw new Error('Invalid PNG signature');
  }

  let offset = 8;
  let width = 0;
  let height = 0;
  let colorType = 0;
  const idatChunks: Uint8Array[] = [];

  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.subarray(offset + 4, offset + 8).toString('ascii');
    const data = buffer.subarray(offset + 8, offset + 8 + length);
    offset += length + 12;

    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      colorType = data[9] ?? 0;
    } else if (type === 'IDAT') {
      idatChunks.push(Uint8Array.from(data));
    } else if (type === 'IEND') {
      break;
    }
  }

  if (width <= 0 || height <= 0) {
    throw new Error('PNG is missing IHDR dimensions');
  }
  if (colorType !== 2 && colorType !== 6) {
    throw new Error(`Unsupported PNG color type: ${colorType}`);
  }

  const bytesPerPixel = colorType === 6 ? 4 : 3;
  const inflated = inflateSync(concatUint8Arrays(idatChunks));
  const stride = width * bytesPerPixel;
  const output = new Uint8Array(width * height * 4);
  let inputOffset = 0;
  let previous = new Uint8Array(stride);

  for (let y = 0; y < height; y += 1) {
    const filter = inflated[inputOffset] ?? 0;
    inputOffset += 1;
    const row = Uint8Array.from(inflated.subarray(inputOffset, inputOffset + stride));
    inputOffset += stride;
    unfilterRow(row, previous, bytesPerPixel, filter);

    for (let x = 0; x < width; x += 1) {
      const sourceOffset = x * bytesPerPixel;
      const targetOffset = (y * width + x) * 4;
      output[targetOffset] = row[sourceOffset] ?? 0;
      output[targetOffset + 1] = row[sourceOffset + 1] ?? 0;
      output[targetOffset + 2] = row[sourceOffset + 2] ?? 0;
      output[targetOffset + 3] = colorType === 6 ? (row[sourceOffset + 3] ?? 0) : 255;
    }

    previous = row;
  }

  return { width, height, data: output };
}

function concatUint8Arrays(chunks: readonly Uint8Array[]): Uint8Array {
  const length = chunks.reduce((total, chunk) => total + chunk.length, 0);
  const output = new Uint8Array(length);
  let offset = 0;

  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.length;
  }

  return output;
}

function unfilterRow(row: Uint8Array, previous: Uint8Array, bytesPerPixel: number, filter: number) {
  for (let index = 0; index < row.length; index += 1) {
    const left = index >= bytesPerPixel ? row[index - bytesPerPixel]! : 0;
    const up = previous[index] ?? 0;
    const upLeft = index >= bytesPerPixel ? previous[index - bytesPerPixel]! : 0;
    switch (filter) {
      case 0:
        break;
      case 1:
        row[index] = (row[index]! + left) & 0xff;
        break;
      case 2:
        row[index] = (row[index]! + up) & 0xff;
        break;
      case 3:
        row[index] = (row[index]! + Math.floor((left + up) / 2)) & 0xff;
        break;
      case 4:
        row[index] = (row[index]! + paeth(left, up, upLeft)) & 0xff;
        break;
      default:
        throw new Error(`Unsupported PNG filter: ${filter}`);
    }
  }
}

function paeth(left: number, up: number, upLeft: number): number {
  const estimate = left + up - upLeft;
  const leftDistance = Math.abs(estimate - left);
  const upDistance = Math.abs(estimate - up);
  const upLeftDistance = Math.abs(estimate - upLeft);
  if (leftDistance <= upDistance && leftDistance <= upLeftDistance) {
    return left;
  }
  if (upDistance <= upLeftDistance) {
    return up;
  }
  return upLeft;
}

declare global {
  interface Window {
    __midorableBrowserSmoke: {
      supports(kind: PlatformKind): Promise<boolean>;
      run(kind: PlatformKind, name: SmokeName): Promise<SmokeResult>;
      cleanup(): void;
    };
  }
}
