import type {
  InputBackend,
  InputGamepadSnapshot,
  InputPointerSnapshot,
  InputSnapshot,
  PointerButtonId,
  PointerKind,
} from '../../platform';

/**
 * 現在のすべての入力状態を表すオブジェクト
 */
export interface InputState {
  /**
   * 現在のポインタ配列
   */
  pointers: InputPointerState[];
  keyboard: InputKeyboardState;
  gamepads: InputGamepadState[];
}

export interface InputPointerState {
  /** ポインタのID */
  id: number;
  /** ポインタのX座標 */
  x: number;
  /** ポインタのY座標 */
  y: number;
  /** ポインタが押されているか */
  down: boolean;
  /** ポインタが押された直後か */
  justPressed: boolean;
  /** ポインタが離された直後か */
  justReleased: boolean;
  /** ポインタが移動したか */
  moved: boolean;
  /** 押されたボタンの配列 */
  pressedButtons: PointerButtonId[];
  /** 離されたボタンの配列 */
  releasedButtons: PointerButtonId[];
  /** ポインタの種別 */
  pointerType: PointerKind;
  /** ポインタが画面内にあるか */
  inBounds: boolean;
}

export interface InputKeyboardState {
  /** 押されているキーのセット */
  down: ReadonlySet<string>;
  /** 押された直後のキーのセット */
  justPressed: ReadonlySet<string>;
  /** 離された直後のキーのセット */
  justReleased: ReadonlySet<string>;
}

export interface InputGamepadState {
  /** ゲームパッドID */
  id: string;
  /** ゲームパッドインデックス */
  index: number;
  /** ボタン状態配列 */
  buttons: InputGamepadButtonState[];
  /** スティック軸の値配列 */
  axes: number[];
}

export interface InputGamepadButtonState {
  /** ボタンが押されているか */
  down: boolean;
  /** ボタンが押された直後か */
  justPressed: boolean;
  /** ボタンが離された直後か */
  justReleased: boolean;
}

export interface PointerEvent {
  pointerId: number;
  x: number;
  y: number;
}

/**
 * 入力状態を管理するコントローラークラス
 *
 * @remarks
 * 毎フレーム、プラットフォームから入力状態を取得して InputState を更新する。
 * アプリケーション開発者は App クラスの `input` プロパティを通じてこのクラスを利用する。
 */
export class InputController {
  private _backend: InputBackend;
  private _lastSnapshot: InputSnapshot = { pointers: [], keyboard: { pressedKeys: [] }, gamepads: [] };
  private _state: InputState = createInputState(
    [],
    { down: new Set(), justPressed: new Set(), justReleased: new Set() },
    [],
  );

  constructor(backend: InputBackend) {
    this._backend = backend;
  }

  /**
   * 現在の入力状態
   */
  get state() {
    return this._state;
  }

  /**
   * バックエンドから入力状態を取得して、InputState とイベントを更新する
   *
   * @remarks
   * このメソッドは App の更新ループ内で呼び出されるため、アプリケーション開発者が直接呼び出す必要はありません。
   */
  update() {
    const snapshot = this._backend.pollSnapshot();
    const lastPointers = createSnapshotPointerMap(this._lastSnapshot.pointers);

    const nextPointers: InputPointerState[] = [];

    for (const current of snapshot.pointers) {
      const pointerId = current.id;
      const previous = lastPointers.get(pointerId);
      const currentButtons = resolvePressedButtons(current);
      const previousButtons = previous ? resolvePressedButtons(previous) : [];
      const down = currentButtons.length > 0;
      const pressedButtons = currentButtons.filter((button) => !previousButtons.includes(button));
      const releasedButtons = previousButtons.filter((button) => !currentButtons.includes(button));
      const xChanged = !previous || previous.x !== current.x || previous.y !== current.y;

      const pointerState: InputPointerState = {
        id: pointerId,
        x: current.x,
        y: current.y,
        down,
        justPressed: pressedButtons.length > 0,
        justReleased: releasedButtons.length > 0,
        moved: xChanged,
        pressedButtons,
        releasedButtons,
        pointerType: current.kind,
        inBounds: current.inBounds,
      };
      nextPointers.push(pointerState);
    }

    const currentKeys = new Set(snapshot.keyboard.pressedKeys);
    const previousKeys = new Set(this._lastSnapshot.keyboard.pressedKeys);
    const keyboardJustPressed = new Set<string>();
    const keyboardJustReleased = new Set<string>();

    for (const key of currentKeys) {
      if (!previousKeys.has(key)) {
        keyboardJustPressed.add(key);
      }
    }
    for (const key of previousKeys) {
      if (!currentKeys.has(key)) {
        keyboardJustReleased.add(key);
      }
    }

    const previousGamepads = createSnapshotGamepadMap(this._lastSnapshot.gamepads);
    const nextGamepads: InputGamepadState[] = [];
    for (const gamepad of snapshot.gamepads) {
      const previousButtons = previousGamepads.get(gamepad.index) ?? [];
      const buttons: InputGamepadButtonState[] = [];
      for (let index = 0; index < gamepad.buttons.length; index += 1) {
        const downState = gamepad.buttons[index] ?? false;
        const prevDown = previousButtons[index] ?? false;
        buttons.push({
          down: downState,
          justPressed: downState && !prevDown,
          justReleased: !downState && prevDown,
        });
      }
      nextGamepads.push({
        id: gamepad.id,
        index: gamepad.index,
        buttons,
        axes: [...gamepad.axes],
      });
    }

    this._state = createInputState(
      nextPointers,
      { down: currentKeys, justPressed: keyboardJustPressed, justReleased: keyboardJustReleased },
      nextGamepads,
    );
    this._lastSnapshot = cloneSnapshot(snapshot);
  }
}

function resolvePressedButtons(snapshot: InputPointerSnapshot): PointerButtonId[] {
  if (snapshot.kind !== 'mouse') {
    return snapshot.pressed ? ['left'] : [];
  }
  const buttons: PointerButtonId[] = [];
  if (snapshot.pressedLeft) buttons.push('left');
  if (snapshot.pressedMiddle) buttons.push('middle');
  if (snapshot.pressedRight) buttons.push('right');
  return buttons;
}

function createSnapshotPointerMap(pointers: InputPointerSnapshot[]): Map<number, InputPointerSnapshot> {
  const map = new Map<number, InputPointerSnapshot>();
  for (const pointer of pointers) {
    map.set(pointer.id, pointer);
  }
  return map;
}

function createSnapshotGamepadMap(gamepads: InputGamepadSnapshot[]): Map<number, boolean[]> {
  const map = new Map<number, boolean[]>();
  for (const gamepad of gamepads) {
    map.set(gamepad.index, [...gamepad.buttons]);
  }
  return map;
}

function cloneSnapshot(snapshot: InputSnapshot): InputSnapshot {
  return {
    pointers: snapshot.pointers.map((pointer) => {
      if (pointer.kind === 'mouse') {
        return { ...pointer };
      }
      return { ...pointer };
    }),
    keyboard: {
      pressedKeys: [...snapshot.keyboard.pressedKeys],
    },
    gamepads: snapshot.gamepads.map((gamepad) => ({
      id: gamepad.id,
      index: gamepad.index,
      buttons: [...gamepad.buttons],
      axes: [...gamepad.axes],
    })),
  };
}

function createInputState(
  pointers: InputPointerState[],
  keyboard: InputKeyboardState,
  gamepads: InputGamepadState[],
): InputState {
  return {
    pointers,
    keyboard,
    gamepads,
  };
}
