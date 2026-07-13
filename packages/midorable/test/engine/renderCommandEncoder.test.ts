import { describe, expect, it } from 'vitest';
import { DefaultRenderCommandEncoder } from '../../src/engine/rendering';
import { FilterInstance, ImageAsset, RenderState } from '../../src/platform';

const image = {
  id: 'image',
  type: 'image',
  width: 32,
  height: 16,
  source: null,
} satisfies ImageAsset;

const state = {
  transform: { a: 1, b: 0, c: 0, d: 1, tx: 2, ty: 3 },
  alpha: 0.5,
  blendMode: 'normal',
  colorTone: { r: 255, g: 128, b: 0, a: 0.25 },
  smooth: true,
} satisfies RenderState;

describe('DefaultRenderCommandEncoder', () => {
  it('batches adjacent compatible sprites into packed instance data', () => {
    const encoder = createEncoder();
    encoder.drawSprite(image, state, { x: 8, y: 4, width: 16, height: 8 });
    encoder.drawSprite(image, { ...state, transform: { ...state.transform, tx: 10 } });

    const frame = encoder.finish();

    expect(frame.commands).toHaveLength(1);
    const command = frame.commands[0];
    expect(command?.type).toBe('spriteBatch');
    if (command?.type !== 'spriteBatch') {
      throw new Error('Expected sprite batch');
    }
    expect(command.instanceCount).toBe(2);
    expect(Array.from(command.instanceData.slice(0, 17))).toEqual([
      1,
      0,
      0,
      1,
      2,
      3,
      16,
      8,
      0.25,
      0.25,
      0.75,
      0.75,
      0.5,
      1,
      Math.fround(128 / 255),
      0,
      0.25,
    ]);
  });

  it('splits batches at state and mask boundaries without reordering', () => {
    const encoder = createEncoder();
    encoder.drawSprite(image, state);
    encoder.drawSprite(image, { ...state, blendMode: 'add' });
    encoder.pushMask();
    encoder.drawSprite(image, state);
    encoder.activateMask();
    encoder.drawSprite(image, state);
    encoder.popMask();

    expect(encoder.finish().commands.map((command) => command.type)).toEqual([
      'spriteBatch',
      'spriteBatch',
      'pushMask',
      'spriteBatch',
      'activateMask',
      'spriteBatch',
      'popMask',
    ]);
  });

  it('snapshots active filter uniforms and skips disabled filters', () => {
    const encoder = createEncoder();
    const filter = new FilterInstance({ language: 'test', fragment: '', uniforms: { amount: 0 } }, { dispose() {} });
    filter.setUniform('amount', 0.75);
    encoder.pushFilters([filter], state);
    encoder.drawSprite(image, state);
    encoder.popFilters();
    filter.setUniform('amount', 0.25);

    const command = encoder.finish().commands[0];
    expect(command?.type).toBe('pushFilters');
    if (command?.type !== 'pushFilters') {
      throw new Error('Expected pushFilters command');
    }
    expect(Array.from(command.filters[0]!.uniformData)).toEqual([0.75, 0, 0, 0]);

    const disabledEncoder = createEncoder();
    filter.enabled = false;
    disabledEncoder.pushFilters([filter], state);
    disabledEncoder.drawSprite(image, state);
    disabledEncoder.popFilters();
    expect(disabledEncoder.finish().commands.map((item) => item.type)).toEqual(['spriteBatch']);
  });

  it('validates mask and filter stacks', () => {
    const encoder = createEncoder();
    encoder.pushMask();
    expect(() => encoder.popMask()).toThrow('before activateMask');

    const filters = createEncoder();
    expect(() => filters.popFilters()).toThrow('without matching pushFilters');
  });

  it('copies mesh arrays and checks capabilities', () => {
    const unsupported = createEncoder(false);
    expect(() =>
      unsupported.drawTexturedTriangles({
        image,
        state,
        positions: [0, 0, 1, 0, 0, 1],
        uvs: [0, 0, 1, 0, 0, 1],
        indices: [0, 1, 2],
      }),
    ).toThrow('not supported');

    const positions = [0, 0, 1, 0, 0, 1];
    const encoder = createEncoder(true);
    encoder.drawTexturedTriangles({ image, state, positions, uvs: positions, indices: [0, 1, 2] });
    positions[0] = 99;
    const command = encoder.finish().commands[0];
    expect(command?.type).toBe('drawTexturedTriangles');
    if (command?.type === 'drawTexturedTriangles') {
      expect(command.positions[0]).toBe(0);
    }
  });
});

function createEncoder(meshSupported = false) {
  const encoder = new DefaultRenderCommandEncoder({ meshSupported });
  encoder.reset({ r: 1, g: 2, b: 3, a: 1 });
  return encoder;
}
