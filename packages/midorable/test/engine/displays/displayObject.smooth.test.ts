import { describe, expect, it } from 'vitest';
import { Sprite } from '../../../src/engine/displays/Sprite';
import { RenderCommandEncoder, RenderState } from '../../../src/platform/renderer';
import { createMockTexture } from '../../helpers/createMockPlatform';
import { createTestContext } from '../../helpers/createTestContext';

function createRendererSpy() {
  const states: RenderState[] = [];
  const renderer: RenderCommandEncoder = {
    drawSprite(_image, state) {
      states.push(state);
    },
    drawTexturedTriangles() {},
    pushFilters() {},
    popFilters() {},
    pushMask() {},
    activateMask() {},
    popMask() {},
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
