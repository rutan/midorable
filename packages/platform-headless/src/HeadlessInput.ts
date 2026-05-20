import {
  InputBackend,
  InputGamepadSnapshot,
  InputPointerSnapshot,
  InputSnapshot,
  InputState,
  PointerButtonId,
} from '@rutan/midorable';

export class HeadlessInput implements InputBackend {
  private _snapshot: InputSnapshot = createEmptyInputSnapshot();

  pollSnapshot(): InputSnapshot {
    return cloneInputSnapshot(this._snapshot);
  }

  setSnapshot(snapshot: InputSnapshot): void {
    this._snapshot = cloneInputSnapshot(snapshot);
  }

  patchSnapshot(
    patch: Partial<{
      pointers: readonly InputPointerSnapshot[];
      keyboard: { pressedKeys: readonly string[] };
      gamepads: readonly InputGamepadSnapshot[];
    }>,
  ): void {
    this._snapshot = {
      pointers: patch.pointers
        ? patch.pointers.map(clonePointerSnapshot)
        : this._snapshot.pointers.map(clonePointerSnapshot),
      keyboard: {
        pressedKeys: patch.keyboard ? [...patch.keyboard.pressedKeys] : [...this._snapshot.keyboard.pressedKeys],
      },
      gamepads: patch.gamepads
        ? patch.gamepads.map(cloneGamepadSnapshot)
        : this._snapshot.gamepads.map(cloneGamepadSnapshot),
    };
  }

  // Legacy helper for tests that still prepare InputState directly.
  setState(state: InputState): void {
    const pointers = state.pointers.map((pointer) => inputPointerStateToSnapshot(pointer));
    this._snapshot = {
      pointers,
      keyboard: {
        pressedKeys: Array.from(state.keyboard.down),
      },
      gamepads: [],
    };
  }

  dispose(): void {
    this._snapshot = createEmptyInputSnapshot();
  }
}

export function createEmptyInputSnapshot(): InputSnapshot {
  return {
    pointers: [],
    keyboard: {
      pressedKeys: [],
    },
    gamepads: [],
  };
}

function cloneInputSnapshot(snapshot: InputSnapshot): InputSnapshot {
  return {
    pointers: snapshot.pointers.map(clonePointerSnapshot),
    keyboard: {
      pressedKeys: [...snapshot.keyboard.pressedKeys],
    },
    gamepads: snapshot.gamepads.map(cloneGamepadSnapshot),
  };
}

function cloneGamepadSnapshot(snapshot: InputGamepadSnapshot): InputGamepadSnapshot {
  return {
    id: snapshot.id,
    index: snapshot.index,
    buttons: [...snapshot.buttons],
    axes: [...snapshot.axes],
  };
}

function clonePointerSnapshot(snapshot: InputPointerSnapshot): InputPointerSnapshot {
  if (snapshot.kind === 'mouse') {
    return {
      kind: 'mouse',
      id: snapshot.id,
      x: snapshot.x,
      y: snapshot.y,
      pressedLeft: snapshot.pressedLeft,
      pressedMiddle: snapshot.pressedMiddle,
      pressedRight: snapshot.pressedRight,
      inBounds: snapshot.inBounds,
    };
  }
  return {
    kind: snapshot.kind,
    id: snapshot.id,
    x: snapshot.x,
    y: snapshot.y,
    pressed: snapshot.pressed,
    inBounds: snapshot.inBounds,
  };
}

function inputPointerStateToSnapshot(pointer: {
  id: number;
  x: number;
  y: number;
  down: boolean;
  pointerType: 'mouse' | 'touch' | 'pen';
  inBounds: boolean;
  pressedButtons: PointerButtonId[];
}): InputPointerSnapshot {
  if (pointer.pointerType === 'mouse') {
    const down = new Set(pointer.pressedButtons);
    const leftDown = pointer.down || down.has('left');
    return {
      kind: 'mouse',
      id: pointer.id,
      x: pointer.x,
      y: pointer.y,
      pressedLeft: leftDown,
      pressedMiddle: down.has('middle'),
      pressedRight: down.has('right'),
      inBounds: pointer.inBounds,
    };
  }
  return {
    kind: pointer.pointerType,
    id: pointer.id,
    x: pointer.x,
    y: pointer.y,
    pressed: pointer.down,
    inBounds: pointer.inBounds,
  };
}
