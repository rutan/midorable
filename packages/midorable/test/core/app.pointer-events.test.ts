import { describe, expect, it, vi } from 'vitest';
import { App } from '../../src/core/App';
import { DisplayObject, DisplayObjectProps } from '../../src/core/displays/DisplayObject';
import { InputPointerState } from '../../src/core/inputs';
import { createMockPlatform } from '../helpers/createMockPlatform';

class Box extends DisplayObject {
  constructor(config: DisplayObjectProps) {
    super(config);
  }

  getLocalBounds() {
    return { x: 0, y: 0, width: 100, height: 100 };
  }
}

function mousePointer(overrides: Partial<InputPointerState>): InputPointerState {
  return {
    id: 1,
    x: 0,
    y: 0,
    down: false,
    justPressed: false,
    justReleased: false,
    moved: false,
    pressedButtons: [],
    releasedButtons: [],
    pointerType: 'mouse',
    inBounds: true,
    ...overrides,
  };
}

describe('App pointer events', () => {
  it('dispatches pointer enter/down/move/up/leave and updates cursor', () => {
    const { platform, inputState } = createMockPlatform();
    const app = new App({ platform });
    const target = new Box({ context: app.context, interactive: true, cursor: 'pointer' });
    app.root.addChild(target);

    const enter = vi.fn();
    const down = vi.fn();
    const move = vi.fn();
    const up = vi.fn();
    const leave = vi.fn();
    target.onPointerEnter.on(enter);
    target.onPointerDown.on(down);
    target.onPointerMove.on(move);
    target.onPointerUp.on(up);
    target.onPointerLeave.on(leave);

    inputState.pointers = [mousePointer({ x: 10, y: 10, down: true, justPressed: true, pressedButtons: ['left'] })];
    app.update();
    inputState.pointers = [mousePointer({ x: 10, y: 10, down: false, justReleased: true, releasedButtons: ['left'] })];
    app.update();
    inputState.pointers = [mousePointer({ x: 200, y: 200 })];
    app.update();

    expect(enter).toHaveBeenCalledTimes(1);
    expect(down).toHaveBeenCalledTimes(1);
    expect(move).toHaveBeenCalledTimes(1);
    expect(up).toHaveBeenCalledTimes(1);
    expect(leave).toHaveBeenCalledTimes(1);
    expect(platform.setCursor).toHaveBeenNthCalledWith(1, 'pointer');
    expect(platform.setCursor).toHaveBeenNthCalledWith(2, 'default');
  });

  it('dispatches mouse middle/right button events', () => {
    const { platform, inputState } = createMockPlatform();
    const app = new App({ platform });
    const target = new Box({ context: app.context, interactive: true });
    app.root.addChild(target);

    const middleDown = vi.fn();
    const middleUp = vi.fn();
    const rightDown = vi.fn();
    const rightUp = vi.fn();
    target.onMouseMiddleDown.on(middleDown);
    target.onMouseMiddleUp.on(middleUp);
    target.onMouseRightDown.on(rightDown);
    target.onMouseRightUp.on(rightUp);

    inputState.pointers = [mousePointer({ x: 10, y: 10, justPressed: true, pressedButtons: ['middle', 'right'] })];
    app.update();
    inputState.pointers = [mousePointer({ x: 10, y: 10, justReleased: true, releasedButtons: ['middle', 'right'] })];
    app.update();

    expect(middleDown).toHaveBeenCalledTimes(1);
    expect(rightDown).toHaveBeenCalledTimes(1);
    expect(middleUp).toHaveBeenCalledTimes(1);
    expect(rightUp).toHaveBeenCalledTimes(1);
  });

  it('dispatches leave when pointer disappears from input state', () => {
    const { platform, inputState } = createMockPlatform();
    const app = new App({ platform });
    const target = new Box({ context: app.context, interactive: true });
    app.root.addChild(target);

    const leave = vi.fn();
    target.onPointerLeave.on(leave);

    inputState.pointers = [mousePointer({ id: 10, x: 40, y: 50 })];
    app.update();
    inputState.pointers = [];
    app.update();

    expect(leave).toHaveBeenCalledTimes(1);
    expect(leave).toHaveBeenCalledWith({ pointerId: 10, x: 40, y: 50 });
  });

  it('keeps sending move/up to the pressed target after pointer capture', () => {
    const { platform, inputState } = createMockPlatform();
    const app = new App({ platform });
    const target = new Box({ context: app.context, interactive: true });
    app.root.addChild(target);

    const move = vi.fn();
    const up = vi.fn();
    target.onPointerMove.on(move);
    target.onPointerUp.on(up);

    inputState.pointers = [mousePointer({ x: 10, y: 10, down: true, justPressed: true, pressedButtons: ['left'] })];
    app.update();
    inputState.pointers = [mousePointer({ x: 200, y: 200, down: true })];
    app.update();
    inputState.pointers = [
      mousePointer({ x: 200, y: 200, down: false, justReleased: true, releasedButtons: ['left'] }),
    ];
    app.update();

    expect(move).toHaveBeenNthCalledWith(2, { pointerId: 1, x: 200, y: 200 });
    expect(up).toHaveBeenCalledTimes(1);
    expect(up).toHaveBeenCalledWith({ pointerId: 1, x: 200, y: 200 });
  });

  it('dispatches click when pointer is released over the same target', () => {
    const { platform, inputState } = createMockPlatform();
    const app = new App({ platform });
    const target = new Box({ context: app.context, interactive: true });
    app.root.addChild(target);

    const click = vi.fn();
    target.onClick.on(click);

    inputState.pointers = [mousePointer({ x: 10, y: 10, down: true, justPressed: true, pressedButtons: ['left'] })];
    app.update();
    inputState.pointers = [mousePointer({ x: 10, y: 10, down: false, justReleased: true, releasedButtons: ['left'] })];
    app.update();

    expect(click).toHaveBeenCalledTimes(1);
    expect(click).toHaveBeenCalledWith({ pointerId: 1, x: 10, y: 10 });
  });

  it('does not dispatch click when pointer is released outside the pressed target', () => {
    const { platform, inputState } = createMockPlatform();
    const app = new App({ platform });
    const target = new Box({ context: app.context, interactive: true });
    app.root.addChild(target);

    const click = vi.fn();
    target.onClick.on(click);

    inputState.pointers = [mousePointer({ x: 10, y: 10, down: true, justPressed: true, pressedButtons: ['left'] })];
    app.update();
    inputState.pointers = [
      mousePointer({ x: 200, y: 200, down: false, justReleased: true, releasedButtons: ['left'] }),
    ];
    app.update();

    expect(click).not.toHaveBeenCalled();
  });

  it('does not dispatch click when pressed pointer disappears before release', () => {
    const { platform, inputState } = createMockPlatform();
    const app = new App({ platform });
    const target = new Box({ context: app.context, interactive: true });
    app.root.addChild(target);

    const click = vi.fn();
    target.onClick.on(click);

    inputState.pointers = [
      mousePointer({ id: 10, x: 10, y: 10, down: true, justPressed: true, pressedButtons: ['left'] }),
    ];
    app.update();
    inputState.pointers = [];
    app.update();

    expect(click).not.toHaveBeenCalled();
  });

  it('dispatches click when pointer returns over the pressed target before release', () => {
    const { platform, inputState } = createMockPlatform();
    const app = new App({ platform });
    const target = new Box({ context: app.context, interactive: true });
    app.root.addChild(target);

    const click = vi.fn();
    target.onClick.on(click);

    inputState.pointers = [mousePointer({ x: 10, y: 10, down: true, justPressed: true, pressedButtons: ['left'] })];
    app.update();
    inputState.pointers = [mousePointer({ x: 200, y: 200, down: true })];
    app.update();
    inputState.pointers = [mousePointer({ x: 10, y: 10, down: false, justReleased: true, releasedButtons: ['left'] })];
    app.update();

    expect(click).toHaveBeenCalledTimes(1);
    expect(click).toHaveBeenCalledWith({ pointerId: 1, x: 10, y: 10 });
  });
});
