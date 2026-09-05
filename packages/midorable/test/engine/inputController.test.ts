import { describe, expect, it } from 'vitest';
import { InputController } from '../../src/engine/input/InputController';
import type { InputSnapshot } from '../../src/platform';

describe('InputController', () => {
  it('preserves input transitions when the backend reuses and mutates its snapshot', () => {
    const snapshot: InputSnapshot = {
      pointers: [
        {
          kind: 'mouse',
          id: 1,
          x: 0,
          y: 0,
          pressedLeft: true,
          pressedMiddle: false,
          pressedRight: false,
          inBounds: true,
        },
        { kind: 'touch', id: 2, x: 0, y: 0, pressed: true, inBounds: true },
        { kind: 'pen', id: 3, x: 0, y: 0, pressed: true, inBounds: true },
      ],
      keyboard: { pressedKeys: ['Space'] },
      gamepads: [{ id: 'pad', index: 0, buttons: [true], axes: [0] }],
    };
    const controller = new InputController({ pollSnapshot: () => snapshot, dispose() {} });

    controller.update();
    const pressedState = controller.state;
    for (const pointer of pressedState.pointers) {
      expect(pointer.justPressed).toBe(true);
    }
    expect(pressedState.keyboard.justPressed).toEqual(new Set(['Space']));
    expect(pressedState.gamepads[0].buttons[0].justPressed).toBe(true);

    for (const pointer of snapshot.pointers) {
      pointer.x = 10;
      if (pointer.kind === 'mouse') {
        pointer.pressedLeft = false;
      } else {
        pointer.pressed = false;
      }
    }
    snapshot.keyboard.pressedKeys.length = 0;
    snapshot.gamepads[0].buttons[0] = false;
    snapshot.gamepads[0].axes[0] = 0.5;

    controller.update();

    for (const pointer of controller.state.pointers) {
      expect(pointer).toMatchObject({ x: 10, moved: true, down: false, justPressed: false, justReleased: true });
    }
    expect(controller.state.keyboard.justReleased).toEqual(new Set(['Space']));
    expect(controller.state.gamepads[0].buttons[0]).toEqual({ down: false, justPressed: false, justReleased: true });
    expect(controller.state.gamepads[0].axes).toEqual([0.5]);
    expect(pressedState.pointers.map((pointer) => pointer.x)).toEqual([0, 0, 0]);
    expect(pressedState.gamepads[0].axes).toEqual([0]);

    controller.update();

    for (const pointer of controller.state.pointers) {
      expect(pointer).toMatchObject({ moved: false, justPressed: false, justReleased: false });
    }
    expect(controller.state.keyboard.justReleased.size).toBe(0);
    expect(controller.state.gamepads[0].buttons[0].justReleased).toBe(false);
  });
});
