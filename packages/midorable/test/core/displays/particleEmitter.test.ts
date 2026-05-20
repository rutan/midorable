import { describe, expect, it } from 'vitest';
import { ParticleEmitter, ParticleEmitterConfig } from '../../../src/core/displays/ParticleEmitter';
import { Renderer } from '../../../src/core/renderer';
import { createMockTexture } from '../../helpers/createMockPlatform';
import { createTestContext } from '../../helpers/createTestContext';

function createRendererSpy() {
  const drawSpriteCalls: Array<{
    alpha: number;
    transform: { a: number; b: number; c: number; d: number; tx: number; ty: number };
    colorTone: { r: number; g: number; b: number; a: number };
    smooth: boolean;
  }> = [];
  const renderer: Renderer = {
    beginFrame() {},
    endFrame() {},
    clear() {},
    drawSprite(_image, state) {
      drawSpriteCalls.push({
        alpha: state.alpha,
        transform: {
          a: state.transform.a,
          b: state.transform.b,
          c: state.transform.c,
          d: state.transform.d,
          tx: state.transform.tx,
          ty: state.transform.ty,
        },
        colorTone: {
          r: state.colorTone.r,
          g: state.colorTone.g,
          b: state.colorTone.b,
          a: state.colorTone.a,
        },
        smooth: state.smooth,
      });
    },
    pushFilters() {
      return false;
    },
    popFilters() {},
    pushMask() {},
    activateMask() {},
    popMask() {},
    resize() {},
  };
  return { renderer, drawSpriteCalls };
}

function createConfig(overrides: Partial<ParticleEmitterConfig> = {}): ParticleEmitterConfig {
  return {
    duration: 0.5,
    spawn: { type: 'point', x: 0, y: 0 },
    emissionRate: 60,
    burstCount: 1,
    lifetime: 0.3,
    speed: 0,
    direction: 0,
    scale: 1,
    alpha: 1,
    blendMode: 'normal',
    forces: [],
    ...overrides,
  };
}

describe('ParticleEmitter', () => {
  it('spawns particles while playing and renders them', () => {
    const context = createTestContext();
    const image = createMockTexture(8, 8, true);
    const emitter = new ParticleEmitter({ context, config: createConfig(), image });
    const { renderer, drawSpriteCalls } = createRendererSpy();

    emitter.play();
    for (let i = 0; i < 6; i += 1) {
      emitter.update();
    }
    emitter.render(renderer);

    expect(drawSpriteCalls.length).toBeGreaterThan(0);
    expect(emitter.isPlaying()).toBe(true);
  });

  it('emits finished after duration and particles end', () => {
    const context = createTestContext();
    const image = createMockTexture(8, 8, true);
    const emitter = new ParticleEmitter({ context, config: createConfig(), image });

    let finished = 0;
    emitter.onFinished.on((event) => {
      expect(event.type).toBe('finished');
      finished += 1;
    });

    emitter.play();
    for (let i = 0; i < 120; i += 1) {
      emitter.update();
    }

    expect(finished).toBe(1);
    expect(emitter.isPlaying()).toBe(false);
  });

  it('stop clears all particles immediately', () => {
    const context = createTestContext();
    const image = createMockTexture(8, 8, true);
    const emitter = new ParticleEmitter({ context, config: createConfig({ lifetime: 1 }), image });
    const { renderer, drawSpriteCalls } = createRendererSpy();

    emitter.play();
    for (let i = 0; i < 6; i += 1) {
      emitter.update();
    }
    emitter.stop();
    emitter.render(renderer);

    expect(drawSpriteCalls).toHaveLength(0);
    expect(emitter.isPlaying()).toBe(false);
  });

  it('applies config.color tone to rendered particles', () => {
    const context = createTestContext();
    const image = createMockTexture(8, 8, true);
    const emitter = new ParticleEmitter({
      context,
      config: createConfig({
        lifetime: 1,
        color: {
          start: { r: 32, g: 64, b: 96, a: 0.4 },
          end: { r: 32, g: 64, b: 96, a: 0.4 },
        },
      }),
      image,
    });
    const { renderer, drawSpriteCalls } = createRendererSpy();

    emitter.play();
    emitter.update();
    emitter.render(renderer);

    expect(drawSpriteCalls.length).toBeGreaterThan(0);
    expect(drawSpriteCalls[0]?.colorTone).toEqual({ r: 32, g: 64, b: 96, a: 0.4 });
  });

  it('aligns particle rotation to movement direction when alignToDirection is enabled', () => {
    const context = createTestContext();
    const image = createMockTexture(8, 8, true);
    const emitter = new ParticleEmitter({
      context,
      config: createConfig({
        duration: 1 / 60,
        emissionRate: 60,
        lifetime: 1,
        speed: 100,
        direction: 90,
        alignToDirection: true,
      }),
      image,
    });
    const { renderer, drawSpriteCalls } = createRendererSpy();

    emitter.play();
    emitter.update();
    emitter.render(renderer);

    expect(drawSpriteCalls.length).toBeGreaterThan(0);
    const transform = drawSpriteCalls[0]!.transform;
    const rotation = Math.atan2(transform.b, transform.a);
    expect(rotation).toBeCloseTo(Math.PI / 2, 3);
  });

  it('applies angularVelocity and angularVelocityOverLife to particle rotation', () => {
    const context = createTestContext();
    const image = createMockTexture(8, 8, true);
    const emitter = new ParticleEmitter({
      context,
      config: createConfig({
        duration: 1 / 60,
        emissionRate: 60,
        lifetime: 2,
        speed: 0,
        direction: 0,
        angularVelocity: 180,
        angularVelocityOverLife: {
          keys: [
            { t: 0, v: 0.5 },
            { t: 1, v: 0.5 },
          ],
        },
      }),
      image,
    });
    const { renderer, drawSpriteCalls } = createRendererSpy();

    emitter.play();
    for (let i = 0; i < 30; i += 1) {
      emitter.update();
    }
    emitter.render(renderer);

    expect(drawSpriteCalls.length).toBe(1);
    const transform = drawSpriteCalls[0]!.transform;
    const rotation = Math.atan2(transform.b, transform.a);
    expect(rotation).toBeCloseTo(Math.PI / 4, 3);
  });

  it('passes smooth flag to particle draw calls', () => {
    const context = createTestContext();
    const image = createMockTexture(8, 8, true);
    const emitter = new ParticleEmitter({
      context,
      config: createConfig({
        duration: 1 / 60,
        emissionRate: 60,
        lifetime: 1,
      }),
      image,
      smooth: false,
    });
    const { renderer, drawSpriteCalls } = createRendererSpy();

    emitter.play();
    emitter.update();
    emitter.render(renderer);

    expect(drawSpriteCalls.length).toBeGreaterThan(0);
    expect(drawSpriteCalls[0]?.smooth).toBe(false);
  });
});
