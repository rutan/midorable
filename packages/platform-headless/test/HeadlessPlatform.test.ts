import { App } from '@rutan/midorable';
import type { BinaryAsset, ImageAsset, RenderState, TextAsset } from '@rutan/midorable';
import { binaryAsset, textAsset } from '@rutan/midorable';
import { describe, expect, it, vi } from 'vitest';
import { createHeadlessPlatform, HeadlessRenderer } from '../src';

describe('HeadlessPlatform', () => {
  it('starts and stops loop with manual scheduler', async () => {
    const queue: ((now: number) => void)[] = [];
    let now = 100;
    const platform = await createHeadlessPlatform({
      schedule: (callback) => {
        queue.push(callback);
        return () => {
          const index = queue.indexOf(callback);
          if (index >= 0) {
            queue.splice(index, 1);
          }
        };
      },
      now: () => now,
    });
    const app = new App({ platform, fps: 60 });

    await app.start();
    expect(queue.length).toBe(1);

    const tick = queue.shift();
    expect(tick).toBeTypeOf('function');
    now = 116;
    tick!(now);
    expect(queue.length).toBe(1);

    await app.stop();
    expect(queue.length).toBe(0);
  });

  it('records renderer commands in record mode', async () => {
    const platform = await createHeadlessPlatform({ rendererMode: 'record' });
    platform.resize(320, 240);
    platform.renderer.beginFrame();
    platform.renderer.clear({ r: 1, g: 2, b: 3, a: 1 });
    platform.renderer.endFrame();

    const renderer = platform.renderer as HeadlessRenderer;
    expect(renderer.size).toEqual({ width: 320, height: 240 });
    expect(renderer.commands.length).toBe(1);
    expect(renderer.commands[0]?.type).toBe('clear');
  });

  it('provides renderer.mesh feature in record mode', async () => {
    const platform = await createHeadlessPlatform({ rendererMode: 'record' });
    const mesh = platform.getFeature('renderer.mesh');
    const image = {
      id: 'image://mesh',
      type: 'image',
      width: 16,
      height: 16,
      source: null,
    } satisfies ImageAsset;
    const state = {
      transform: { a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0 },
      alpha: 1,
      blendMode: 'normal',
      colorTone: { r: 0, g: 0, b: 0, a: 0 },
      smooth: true,
    } satisfies RenderState;

    expect(mesh).toBeDefined();
    platform.renderer.beginFrame();
    mesh!.drawTexturedTriangles({
      image,
      state,
      positions: [0, 0, 16, 0, 0, 16],
      uvs: [0, 0, 1, 0, 0, 1],
      indices: [0, 1, 2],
      tint: { r: 255, g: 128, b: 64, a: 0.5 },
    });
    platform.renderer.endFrame();

    const command = platform.renderer.commands[0];
    expect(command?.type).toBe('drawTexturedTriangles');
    expect(command).toMatchObject({
      positions: [0, 0, 16, 0, 0, 16],
      uvs: [0, 0, 1, 0, 0, 1],
      indices: [0, 1, 2],
      tint: { r: 255, g: 128, b: 64, a: 0.5 },
    });
  });

  it('loads and unloads text and binary with cache', async () => {
    const fetchText = vi.fn(async () => 'hello');
    const fetchBinary = vi.fn(async () => new Uint8Array([1, 2, 3]).buffer);
    const platform = await createHeadlessPlatform({
      resource: {
        fetchText,
        fetchBinary,
      },
    });

    const text1 = (await platform.loadAsset(textAsset('text://asset'))) as TextAsset;
    const text2 = (await platform.loadAsset(textAsset('text://asset'))) as TextAsset;
    expect(text1).not.toBe(text2);
    expect(text1.content).toBe('hello');
    expect(fetchText).toHaveBeenCalledTimes(1);
    platform.unloadAsset(text1);
    const text3 = (await platform.loadAsset(textAsset('text://asset'))) as TextAsset;
    expect(fetchText).toHaveBeenCalledTimes(1);
    expect(text3).not.toBe(text1);
    platform.unloadAsset(text2);
    platform.unloadAsset(text3);
    const text4 = (await platform.loadAsset(textAsset('text://asset'))) as TextAsset;
    expect(fetchText).toHaveBeenCalledTimes(2);
    expect(text4.content).toBe('hello');

    const binary = (await platform.loadAsset(binaryAsset('bin://asset'))) as BinaryAsset;
    expect(binary.content.byteLength).toBe(3);
    expect(fetchBinary).toHaveBeenCalledTimes(1);
  });

  it('uses injected resource.fetch for text and binary', async () => {
    let calls = 0;
    const platform = await createHeadlessPlatform({
      resource: {
        fetch: async (_url) => {
          calls += 1;
          return {
            text: async () => 'from-fetch',
            arrayBuffer: async () => new Uint8Array([9, 8]).buffer,
          } as Response;
        },
      },
    });

    const text = (await platform.loadAsset(textAsset('text://from-fetch'))) as TextAsset;
    const binary = (await platform.loadAsset(binaryAsset('bin://from-fetch'))) as BinaryAsset;

    expect(text.content).toBe('from-fetch');
    expect(binary.content.byteLength).toBe(2);
    expect(calls).toBe(2);
  });

  it('provides locale feature and keeps unsupported features optional', async () => {
    const platform = await createHeadlessPlatform();

    const locale = platform.getFeature('system.locale');
    expect(locale).toBeDefined();
    expect(typeof locale!.getLocale()).toBe('string');
    expect(typeof locale!.getTimeZone()).toBe('string');

    expect(platform.getFeature('system.clipboard')).toBeUndefined();
    expect(platform.getFeature('system.share')).toBeUndefined();
  });

  it('retries loading when the previous text load failed', async () => {
    const fetchText = vi
      .fn<(_: string) => Promise<string>>()
      .mockRejectedValueOnce(new Error('temporary failure'))
      .mockResolvedValueOnce('ok');
    const platform = await createHeadlessPlatform({
      resource: {
        fetchText,
      },
    });

    await expect(platform.loadAsset(textAsset('text://retry'))).rejects.toThrow('temporary failure');
    const text = (await platform.loadAsset(textAsset('text://retry'))) as TextAsset;

    expect(text.content).toBe('ok');
    expect(fetchText).toHaveBeenCalledTimes(2);
  });

  it('passes AbortSignal to headless resource loaders', async () => {
    const fetchText = vi.fn(async (_url: string, options?: { signal?: AbortSignal }) => {
      expect(options?.signal).toBeInstanceOf(AbortSignal);
      return 'ok';
    });
    const platform = await createHeadlessPlatform({
      resource: {
        fetchText,
      },
    });
    const controller = new AbortController();

    const text = (await platform.loadAsset(textAsset('text://signal'), { signal: controller.signal })) as TextAsset;

    expect(text.content).toBe('ok');
    expect(fetchText).toHaveBeenCalledTimes(1);
  });
});
