import { describe, expect, it } from 'vitest';
import { DisplayObject, DisplayObjectProps } from '../../../src/core/displays/DisplayObject';
import { Sprite } from '../../../src/core/displays/Sprite';
import { FilterInstance, RenderableImage, Renderer, RenderState } from '../../../src/core/renderer';
import { Rectangle } from '../../../src/core/types';
import { createMockTexture } from '../../helpers/createMockPlatform';
import { createTestContext } from '../../helpers/createTestContext';

type RecordedCommand = { type: 'drawSprite' | 'pushMask' | 'activateMask' | 'popMask' };

class RecordingRenderer implements Renderer {
  readonly commands: RecordedCommand[] = [];

  beginFrame(): void {}

  endFrame(): void {}

  clear(): void {}

  drawSprite(_image: RenderableImage, _state: RenderState, _frame?: Rectangle | null): void {
    this.commands.push({ type: 'drawSprite' });
  }

  pushFilters(_filters: readonly FilterInstance[], _state: RenderState): boolean {
    return false;
  }

  popFilters(): void {}

  pushMask(): void {
    this.commands.push({ type: 'pushMask' });
  }

  activateMask(): void {
    this.commands.push({ type: 'activateMask' });
  }

  popMask(): void {
    this.commands.push({ type: 'popMask' });
  }

  resize(_width: number, _height: number): void {}
}

class Box extends DisplayObject {
  constructor(config: DisplayObjectProps) {
    super(config);
  }

  getLocalBounds() {
    return { x: 0, y: 0, width: 100, height: 100 };
  }
}

class OffsetBox extends DisplayObject {
  constructor(config: DisplayObjectProps) {
    super(config);
  }

  getLocalBounds() {
    return { x: -10, y: -20, width: 100, height: 100 };
  }
}

describe('DisplayObject#hitTestPoint', () => {
  it('hitTestPoint respects transform', () => {
    const box = new Box({ context: createTestContext() });
    box.x = 10;
    box.y = 20;

    expect(box.hitTestPoint(15, 25)).toBe(true);
    expect(box.hitTestPoint(5, 25)).toBe(false);
  });

  it('hitTestPoint returns false when transform is not invertible', () => {
    const box = new Box({ context: createTestContext() });
    box.scaleX = 0;

    expect(box.hitTestPoint(10, 10)).toBe(false);
  });

  it('hitTestPoint applies mask bounds', () => {
    const box = new Box({ context: createTestContext() });
    box.mask = new Sprite({
      context: box.context,
      image: createMockTexture(20, 30),
    });

    expect(box.hitTestPoint(10, 10)).toBe(true);
    expect(box.hitTestPoint(25, 10)).toBe(false);
    expect(box.hitTestPoint(10, 40)).toBe(false);
  });

  it('findTopmostHit returns last visible interactive hit child', () => {
    const context = createTestContext();
    const root = new DisplayObject({ context });
    const back = new Box({ context, interactive: true });
    const front = new Box({ context, interactive: true });
    root.addChild(back);
    root.addChild(front);

    expect(root.findTopmostHit(10, 10)).toBe(front);

    front.visible = false;
    expect(root.findTopmostHit(10, 10)).toBe(back);
  });

  it('findTopmostHit ignores children outside parent mask', () => {
    const context = createTestContext();
    const root = new DisplayObject({
      context,
      mask: new Sprite({
        context,
        image: createMockTexture(20, 20),
      }),
    });
    const child = new Box({ context, interactive: true });
    root.addChild(child);

    expect(root.findTopmostHit(10, 10)).toBe(child);
    expect(root.findTopmostHit(30, 10)).toBeNull();
  });

  it('mask uses masked object local coordinate space', () => {
    const context = createTestContext();
    const box = new Box({
      context,
      x: 50,
      y: 0,
      mask: new Sprite({
        context,
        image: createMockTexture(20, 20),
        x: 10,
        y: 0,
      }),
    });

    expect(box.hitTestPoint(65, 10)).toBe(true);
    expect(box.hitTestPoint(55, 10)).toBe(false);
  });

  it('updates detached mask objects through owner update', () => {
    const context = createTestContext();
    const mask = new Sprite({
      context,
      image: createMockTexture(20, 20),
    });
    const box = new Box({ context, mask });
    mask.onUpdate.on(() => {
      mask.x += 1;
    });

    box.update();

    expect(mask.x).toBe(1);
  });

  it('mask origin is based on the masked object anchor', () => {
    const context = createTestContext();
    const box = new Box({
      context,
      x: 100,
      y: 100,
      anchorX: 0.5,
      anchorY: 0.5,
      mask: new Sprite({
        context,
        image: createMockTexture(20, 20),
        anchorX: 0.5,
        anchorY: 0.5,
      }),
    });

    expect(box.hitTestPoint(100, 100)).toBe(true);
    expect(box.hitTestPoint(40, 40)).toBe(false);
  });

  it('anchor uses local bounds origin', () => {
    const context = createTestContext();
    const box = new OffsetBox({
      context,
      x: 100,
      y: 100,
      anchorX: 0.5,
      anchorY: 0.5,
    });

    expect(box.hitTestPoint(100, 100)).toBe(true);
    expect(box.hitTestPoint(60, 50)).toBe(true);
    expect(box.hitTestPoint(49, 50)).toBe(false);
  });

  it('child local origin follows parent anchor', () => {
    const context = createTestContext();
    const parent = new Sprite({
      context,
      image: createMockTexture(20, 20),
      x: 100,
      y: 100,
      anchorX: 0.5,
      anchorY: 0.5,
    });
    const child = new Sprite({
      context,
      image: createMockTexture(20, 20),
    });
    parent.addChild(child);

    expect(child.hitTestPoint(105, 105)).toBe(true);
    expect(child.hitTestPoint(95, 95)).toBe(false);
  });

  it('does not render mask objects as normal display objects', () => {
    const context = createTestContext();
    const renderer = new RecordingRenderer();
    renderer.beginFrame();
    const mask = new Sprite({
      context,
      image: createMockTexture(20, 20),
    });
    const box = new Box({
      context,
      mask,
    });
    box.addChild(mask);

    box.render(renderer);

    expect(renderer.commands.map(({ type }) => type)).toEqual(['pushMask', 'activateMask', 'drawSprite', 'popMask']);
    renderer.endFrame();
  });

  it('rejects cyclic mask assignments', () => {
    const context = createTestContext();
    const a = new Box({ context });
    const b = new Box({ context });

    a.mask = b;

    expect(() => {
      b.mask = a;
    }).toThrow('Cannot assign a mask that depends on this display object');
  });
});
