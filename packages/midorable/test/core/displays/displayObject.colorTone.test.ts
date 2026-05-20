import { describe, expect, it } from 'vitest';
import { DisplayObject } from '../../../src/core/displays/DisplayObject';
import { Sprite } from '../../../src/core/displays/Sprite';
import { Renderer, RenderState } from '../../../src/core/renderer';
import { createMockTexture } from '../../helpers/createMockPlatform';
import { createTestContext } from '../../helpers/createTestContext';

function createRendererSpy() {
  const states: RenderState[] = [];
  const renderer: Renderer = {
    beginFrame() {},
    endFrame() {},
    clear() {},
    drawSprite(_image, state) {
      states.push(state);
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
  return { renderer, states };
}

describe('DisplayObject colorTone', () => {
  it('inherits parent colorTone to child draw calls', () => {
    const context = createTestContext();
    const root = new DisplayObject({
      context,
      colorTone: { r: 0, g: 0, b: 0, a: 0.4 },
    });
    const child = new Sprite({
      context,
      image: createMockTexture(8, 8, true),
    });
    root.addChild(child);
    const { renderer, states } = createRendererSpy();

    root.render(renderer);

    expect(states).toHaveLength(1);
    expect(states[0]?.colorTone).toEqual({ r: 0, g: 0, b: 0, a: 0.4 });
  });

  it('composes parent and child colorTone', () => {
    const context = createTestContext();
    const root = new DisplayObject({
      context,
      colorTone: { r: 0, g: 0, b: 0, a: 0.5 },
    });
    const child = new Sprite({
      context,
      image: createMockTexture(8, 8, true),
      colorTone: { r: 255, g: 0, b: 0, a: 0.2 },
    });
    root.addChild(child);
    const { renderer, states } = createRendererSpy();

    root.render(renderer);

    expect(states).toHaveLength(1);
    expect(states[0]?.colorTone.r).toBeCloseTo(85, 6);
    expect(states[0]?.colorTone.g).toBeCloseTo(0, 6);
    expect(states[0]?.colorTone.b).toBeCloseTo(0, 6);
    expect(states[0]?.colorTone.a).toBeCloseTo(0.6, 6);
  });
});
