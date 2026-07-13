/** 全ての入力状態を表すスナップショット */
export interface InputSnapshot {
  pointers: InputPointerSnapshot[];
  keyboard: InputKeyboardSnapshot;
  gamepads: InputGamepadSnapshot[];
}

/** ポインティングデバイスのスナップショット */
export type InputPointerSnapshot = InputMouseSnapshot | InputTouchSnapshot | InputPenSnapshot;

export type PointerButtonId = 'left' | 'middle' | 'right';
export type PointerKind = 'mouse' | 'touch' | 'pen';

/** マウス入力のスナップショット */
export interface InputMouseSnapshot {
  kind: 'mouse';
  id: number;
  x: number;
  y: number;
  pressedLeft: boolean;
  pressedMiddle: boolean;
  pressedRight: boolean;
  inBounds: boolean;
}

/** タッチ入力のスナップショット */
export interface InputTouchSnapshot {
  kind: 'touch';
  id: number;
  x: number;
  y: number;
  pressed: boolean;
  inBounds: boolean;
}

/** ペン入力のスナップショット */
export interface InputPenSnapshot {
  kind: 'pen';
  id: number;
  x: number;
  y: number;
  pressed: boolean;
  inBounds: boolean;
}

/** キーボードのスナップショット */
export interface InputKeyboardSnapshot {
  /** 現在押されているキーの識別子 */
  pressedKeys: string[];
}

/** ゲームパッドのスナップショット */
export interface InputGamepadSnapshot {
  id: string;
  index: number;
  buttons: boolean[];
  axes: number[];
}

/** Platform が提供する入力システムのインターフェース */
export interface InputBackend {
  /**
   * 現在の入力状態のスナップショットを取得する
   *
   * @remarks
   * pointer の座標は App の論理座標系に合わせ、押下から解放まで同じ id を維持する。
   * 解放したフレームにも pointer を含め、次のフレーム以降に取り除く必要がある。
   */
  pollSnapshot(): InputSnapshot;

  /** 入力系のリソースを解放する */
  dispose(): void;
}
