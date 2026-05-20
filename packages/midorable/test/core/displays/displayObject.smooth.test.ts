import { describe, expect, it } from 'vitest';
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

describe('DisplayObject smooth', () => {
  it('passes smooth=false to renderer draw call', () => {
    const context = createTestContext();
    const sprite = new Sprite({
      context,
      image: createMockTexture(8, 8, true),
      smooth: false,
    });
    const { renderer, states } = createRendererSpy();

    sprite.render(renderer);

    expect(states).toHaveLength(1);
    expect(states[0]?.smooth).toBe(false);
  });
});
