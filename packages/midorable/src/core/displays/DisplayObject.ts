import { AppContext } from '../App';
import { createEventHandlers } from '../events';
import { PointerEvent } from '../inputs';
import { applyTransform, invertTransform, multiplyTransform, clamp01, clamp255 } from '../internal';
import { FilterInstance, RenderState, Renderer, Transform2D } from '../renderer';
import { BlendMode, Color, CursorName, Rectangle } from '../types';

/**
 * DisplayObject の初期化パラメータ
 */
export interface DisplayObjectProps {
  /** 親要素から渡されるコンテキスト */
  context: AppContext;
  /** X座標 */
  x?: number;
  /** Y座標 */
  y?: number;
  /** X方向の拡大率 */
  scaleX?: number;
  /** Y方向の拡大率 */
  scaleY?: number;
  /** 回転角（ラジアン） */
  rotation?: number;
  /** 基準点のX座標(0.0～1.0) */
  anchorX?: number;
  /** 基準点のY座標(0.0～1.0) */
  anchorY?: number;
  /** 不透明度(0.0～1.0) */
  opacity?: number;
  /** 表示/非表示 */
  visible?: boolean;
  /** 表示オブジェクトが入力イベントを受け取るかどうか */
  interactive?: boolean;
  /** マスク用のオブジェクト。設定したオブジェクトは通常描画されず、マスク形状としてのみ使われる */
  mask?: DisplayObject | null;
  /** ブレンドモード */
  blendMode?: BlendMode | null;
  /** カラートーン */
  colorTone?: Color | null;
  /** カーソルの種類 */
  cursor?: CursorName | null;
  /** フィルター */
  filters?: readonly FilterInstance[];
  /** スムージングの有効/無効 */
  smooth?: boolean;
}

/**
 * 表示オブジェクトの基底クラス
 */
export class DisplayObject {
  protected _context: AppContext;
  private _children: DisplayObject[];
  private _parent: DisplayObject | null = null;
  private _x: number;
  private _y: number;
  private _scaleX: number;
  private _scaleY: number;
  private _rotation: number;
  private _anchorX: number;
  private _anchorY: number;
  private _opacity: number;
  private _visible: boolean;
  private _interactive: boolean;
  private _mask: DisplayObject | null;
  private _blendMode: BlendMode | null;
  private _colorTone: Color | null;
  private _cursor: CursorName | null;
  private _filters: FilterInstance[];
  private _smooth: boolean;
  private _maskRefCount = 0;

  private _onPointerDown = createEventHandlers<PointerEvent>();
  private _onPointerUp = createEventHandlers<PointerEvent>();
  private _onPointerMove = createEventHandlers<PointerEvent>();
  private _onPointerEnter = createEventHandlers<PointerEvent>();
  private _onPointerLeave = createEventHandlers<PointerEvent>();
  private _onClick = createEventHandlers<PointerEvent>();
  private _onMouseRightDown = createEventHandlers<PointerEvent>();
  private _onMouseRightUp = createEventHandlers<PointerEvent>();
  private _onMouseMiddleDown = createEventHandlers<PointerEvent>();
  private _onMouseMiddleUp = createEventHandlers<PointerEvent>();
  private _onUpdate = createEventHandlers<void>();

  constructor(config: DisplayObjectProps) {
    this._context = config.context;
    this._children = [];
    this._x = config.x ?? 0;
    this._y = config.y ?? 0;
    this._scaleX = config.scaleX ?? 1;
    this._scaleY = config.scaleY ?? 1;
    this._rotation = config.rotation ?? 0;
    this._anchorX = config.anchorX ?? 0;
    this._anchorY = config.anchorY ?? 0;
    this._opacity = config.opacity ?? 1;
    this._visible = config.visible ?? true;
    this._interactive = config.interactive ?? false;
    this._mask = null;
    this._blendMode = config.blendMode ?? null;
    this._colorTone = config.colorTone ?? null;
    this._cursor = config.cursor ?? null;
    this._filters = [...(config.filters ?? [])];
    this._smooth = config.smooth ?? true;
    if (config.mask) {
      this.mask = config.mask;
    }
  }

  /**
   * コンテキスト
   */
  get context() {
    return this._context;
  }

  /**
   * この要素が持つ子要素の配列
   */
  get children() {
    return this._children as ReadonlyArray<DisplayObject>;
  }

  /**
   * この要素の親要素
   *
   * @remarks
   * この要素がどこにも addChild されていない場合は null を返す
   */
  get parent() {
    return this._parent;
  }

  /**
   * 表示オブジェクトのX座標
   */
  get x() {
    return this._x;
  }

  set x(value: number) {
    this._x = value;
  }

  /**
   * 表示オブジェクトのY座標
   */
  get y() {
    return this._y;
  }

  set y(value: number) {
    this._y = value;
  }

  /**
   * 表示オブジェクトのX方向の拡大率
   */
  get scaleX() {
    return this._scaleX;
  }

  set scaleX(value: number) {
    this._scaleX = value;
  }

  /**
   * 表示オブジェクトのY方向の拡大率
   */
  get scaleY() {
    return this._scaleY;
  }

  set scaleY(value: number) {
    this._scaleY = value;
  }

  /**
   * 表示オブジェクトの回転角（ラジアン）
   */
  get rotation() {
    return this._rotation;
  }

  set rotation(value: number) {
    this._rotation = value;
  }

  /**
   * 表示オブジェクトの基準点のX座標(0.0～1.0)
   */
  get anchorX() {
    return this._anchorX;
  }

  set anchorX(value: number) {
    this._anchorX = value;
  }

  /**
   * 表示オブジェクトの基準点のY座標(0.0～1.0)
   */
  get anchorY() {
    return this._anchorY;
  }

  set anchorY(value: number) {
    this._anchorY = value;
  }

  /**
   * 表示オブジェクトの不透明度(0.0～1.0)
   */
  get opacity() {
    return this._opacity;
  }

  set opacity(value: number) {
    this._opacity = value;
  }

  /**
   * 表示オブジェクトの表示/非表示
   */
  get visible() {
    return this._visible;
  }

  set visible(value: boolean) {
    this._visible = value;
  }

  /**
   * 表示オブジェクトが入力イベントを受け取るかどうか
   */
  get interactive() {
    return this._interactive;
  }

  set interactive(value: boolean) {
    this._interactive = value;
  }

  /**
   * 表示オブジェクトのマスク
   *
   * @remarks
   * 設定したオブジェクトは通常の描画対象やヒットテスト対象から外れ、
   * この表示オブジェクトのマスク形状としてのみ使用される。
   */
  get mask() {
    return this._mask;
  }

  set mask(value: DisplayObject | null) {
    if (this._mask === value) {
      return;
    }
    if (value === this) {
      throw new Error('Cannot assign self as mask');
    }
    if (value) {
      this.ensureCanAssignMask(value);
    }
    if (this._mask) {
      this._mask._maskRefCount = Math.max(0, this._mask._maskRefCount - 1);
    }
    this._mask = value;
    if (this._mask) {
      this._mask._maskRefCount += 1;
    }
  }

  /**
   * 表示オブジェクトのブレンドモード
   *
   * @remarks
   * null の場合は親のブレンドモードを継承する
   */
  get blendMode() {
    return this._blendMode;
  }

  set blendMode(value: BlendMode | null) {
    this._blendMode = value;
  }

  /**
   * 表示オブジェクトのカラートーン
   */
  get colorTone() {
    return this._colorTone;
  }

  set colorTone(value: Color | null) {
    this._colorTone = value;
  }

  /**
   * 表示オブジェクトにカーソルを合わせたときのカーソルの種類
   *
   * @remarks
   * null の場合は自動でカーソルを切り替える
   */
  get cursor() {
    return this._cursor;
  }

  set cursor(value: CursorName | null) {
    this._cursor = value;
  }

  /**
   * 表示オブジェクトに適用するシェーダーフィルターの配列
   */
  get filters(): readonly FilterInstance[] {
    return this._filters;
  }

  set filters(value: readonly FilterInstance[]) {
    this._filters = [...value];
  }

  /**
   * 表示オブジェクトのスムージングの有効/無効
   *
   * @remarks
   * 描画時のスケーリング品質を設定する。
   * true の場合はスムージングが有効になり、false の場合はスムージングが無効になる。
   * ドット絵などを鮮明に表示したい場合に false に設定することを想定している。
   */
  get smooth() {
    return this._smooth;
  }

  set smooth(value: boolean) {
    this._smooth = value;
  }

  /**
   * 表示オブジェクトがポインター押下されたときのイベントリスナー
   */
  get onPointerDown() {
    return this._onPointerDown.listeners;
  }

  /**
   * 表示オブジェクトがポインターを離したときのイベントリスナー
   *
   * @remarks
   * ポインター押下時にこのオブジェクトが対象になった場合、ポインターが後から領域外に移動しても
   * 押下中はこのオブジェクトに対して発火し続ける。
   */
  get onPointerUp() {
    return this._onPointerUp.listeners;
  }

  /**
   * 表示オブジェクトの上でポインターが移動したときのイベントリスナー
   *
   * @remarks
   * ポインター押下時にこのオブジェクトが対象になった場合、ポインターが後から領域外に移動しても
   * 押下中はこのオブジェクトに対して発火し続ける。
   */
  get onPointerMove() {
    return this._onPointerMove.listeners;
  }

  /**
   * 表示オブジェクトにポインターが入ったときのイベントリスナー
   */
  get onPointerEnter() {
    return this._onPointerEnter.listeners;
  }

  /**
   * 表示オブジェクトからポインターが出たときのイベントリスナー
   */
  get onPointerLeave() {
    return this._onPointerLeave.listeners;
  }

  /**
   * 表示オブジェクトがクリックされたときのイベントリスナー
   * 左ボタンまたは主ポインタで押下された対象の上で、そのまま離されたときに発火する
   */
  get onClick() {
    return this._onClick.listeners;
  }

  /**
   * 表示オブジェクトの上でマウスの右ボタンが押されたときのイベントリスナー
   */
  get onMouseRightDown() {
    return this._onMouseRightDown.listeners;
  }

  /**
   * 表示オブジェクトの上でマウスの右ボタンが離されたときのイベントリスナー
   */
  get onMouseRightUp() {
    return this._onMouseRightUp.listeners;
  }

  /**
   * 表示オブジェクトの上でマウスの中ボタンが押されたときのイベントリスナー
   */
  get onMouseMiddleDown() {
    return this._onMouseMiddleDown.listeners;
  }

  /**
   * 表示オブジェクトの上でマウスの中ボタンが離されたときのイベントリスナー
   */
  get onMouseMiddleUp() {
    return this._onMouseMiddleUp.listeners;
  }

  /**
   * 1フレームの更新ごとに呼び出されるイベントリスナー
   */
  get onUpdate() {
    return this._onUpdate.listeners;
  }

  /**
   * 表示オブジェクトを破棄する
   *
   * @remarks
   * 子オブジェクトもまとめて破棄される
   */
  dispose() {
    if (this._parent) {
      this._parent.removeChild(this);
    }
    this.mask = null;
    while (this._children.length > 0) {
      this._children[0]!.dispose();
    }
    this._children.length = 0;
    this._parent = null;
    this._onPointerDown.listeners.offAll();
    this._onPointerUp.listeners.offAll();
    this._onPointerMove.listeners.offAll();
    this._onPointerEnter.listeners.offAll();
    this._onPointerLeave.listeners.offAll();
    this._onClick.listeners.offAll();
    this._onMouseRightDown.listeners.offAll();
    this._onMouseRightUp.listeners.offAll();
    this._onMouseMiddleDown.listeners.offAll();
    this._onMouseMiddleUp.listeners.offAll();
    this._onUpdate.listeners.offAll();
  }

  /**
   * 表示オブジェクトに子オブジェクトを追加する
   * @param child - 追加する子オブジェクト
   */
  addChild(child: DisplayObject) {
    this.ensureCanAddChild(child);
    if (child._parent) {
      child._parent.removeChild(child);
    }
    child._parent = this;
    this._children.push(child);
  }

  /**
   * 子オブジェクトを指定したインデックスに追加する
   * @param child - 追加する子オブジェクト
   * @param index - 追加するインデックス
   */
  addChildAt(child: DisplayObject, index: number) {
    this.ensureCanAddChild(child);
    if (child._parent) {
      child._parent.removeChild(child);
    }
    child._parent = this;
    this._children.splice(index, 0, child);
  }

  /**
   * 表示オブジェクトから子オブジェクトを削除する
   * @param child - 削除する子オブジェクト
   */
  removeChild(child: DisplayObject) {
    const index = this._children.indexOf(child);
    if (index !== -1) {
      this._children.splice(index, 1);
      child._parent = null;
    }
  }

  /**
   * 表示オブジェクトからすべての子オブジェクトを削除する
   */
  removeChildren() {
    for (const child of this._children) {
      child._parent = null;
    }
    this._children = [];
  }

  /**
   * 表示オブジェクトを表示する
   *
   * @remarks
   * visible プロパティを true に設定するのと同じ効果
   */
  show() {
    this.visible = true;
  }

  /**
   * 表示オブジェクトを非表示にする
   *
   * @remarks
   * visible プロパティを false に設定するのと同じ効果
   */
  hide() {
    this.visible = false;
  }

  /**
   * 表示オブジェクトを描画する
   *
   * @remarks
   * 通常、アプリケーション開発者がこのメソッドを直接呼び出すことはない。
   * 画面描画処理時に自動的に呼び出される。
   *
   * @param renderer - レンダラー
   * @param parentState - 親の描画状態
   */
  render(renderer: Renderer, parentState?: RenderState) {
    this.renderInternal(renderer, parentState, false);
  }

  private renderInternal(renderer: Renderer, parentState?: RenderState, asMask = false) {
    if (!asMask && this._maskRefCount > 0) {
      return;
    }
    if (!this._visible) {
      return;
    }
    const alpha = parentState ? parentState.alpha * this._opacity : this._opacity;
    if (alpha <= 0) {
      return;
    }
    const localTransform = this.createLocalTransform();
    const worldTransform = parentState ? multiplyTransform(parentState.transform, localTransform) : localTransform;
    const blendMode = this._blendMode ?? parentState?.blendMode ?? 'normal';
    const colorTone = composeColorTone(parentState?.colorTone ?? IDENTITY_TONE, this._colorTone);
    const state: RenderState = { transform: worldTransform, alpha, blendMode, colorTone, smooth: this._smooth };
    const hasFilterLayer = this._filters.length > 0 && renderer.pushFilters(this._filters, state);
    if (this._mask) {
      renderer.pushMask();
    }
    this.renderSelf(renderer, state);
    for (const child of this._children) {
      child.render(renderer, state);
    }
    if (this._mask) {
      renderer.activateMask();
      this._mask.renderInternal(renderer, this.createMaskParentState(worldTransform), true);
      renderer.popMask();
    }
    if (hasFilterLayer) {
      renderer.popFilters();
    }
  }

  /**
   * 表示オブジェクトのフレーム更新処理
   *
   * @remarks
   * App クラスの root 配下にある表示オブジェクトは、毎フレームこの update メソッドが呼び出される。
   */
  update() {
    if (this._mask && this._mask.parent === null) {
      this._mask.update();
    }
    this._onUpdate.emit();
    for (const child of this._children) {
      child.update();
    }
  }

  /**
   * ポインターが押下されたときのイベントを発火する
   *
   * @remarks
   * 通常、アプリケーション開発者がこのメソッドを直接呼び出すことはない。
   * 判定処理時に自動的に呼び出される。
   *
   * @param event - ポインターイベント
   */
  dispatchPointerDown(event: PointerEvent) {
    this._onPointerDown.emit(event);
  }

  /**
   * ポインターが離されたときのイベントを発火する
   *
   * @remarks
   * 通常、アプリケーション開発者がこのメソッドを直接呼び出すことはない。
   * 判定処理時に自動的に呼び出される。
   *
   * @param event - ポインターイベント
   */
  dispatchPointerUp(event: PointerEvent) {
    this._onPointerUp.emit(event);
  }

  /**
   * マウスの右ボタンが押下されたときのイベントを発火する
   *
   * @remarks
   * 通常、アプリケーション開発者がこのメソッドを直接呼び出すことはない。
   * 判定処理時に自動的に呼び出される。
   *
   * @param event - ポインターイベント
   */
  dispatchMouseRightDown(event: PointerEvent) {
    this._onMouseRightDown.emit(event);
  }

  /**
   * マウスの右ボタンが離されたときのイベントを発火する
   *
   * @remarks
   * 通常、アプリケーション開発者がこのメソッドを直接呼び出すことはない。
   * 判定処理時に自動的に呼び出される。
   *
   * @param event - ポインターイベント
   */
  dispatchMouseRightUp(event: PointerEvent) {
    this._onMouseRightUp.emit(event);
  }

  /**
   * マウスの中ボタンが押下されたときのイベントを発火する
   *
   * @remarks
   * 通常、アプリケーション開発者がこのメソッドを直接呼び出すことはない。
   * 判定処理時に自動的に呼び出される。
   *
   * @param event - ポインターイベント
   */
  dispatchMouseMiddleDown(event: PointerEvent) {
    this._onMouseMiddleDown.emit(event);
  }

  /**
   * マウスの中ボタンが離されたときのイベントを発火する
   *
   * @remarks
   * 通常、アプリケーション開発者がこのメソッドを直接呼び出すことはない。
   * 判定処理時に自動的に呼び出される。
   *
   * @param event - ポインターイベント
   */
  dispatchMouseMiddleUp(event: PointerEvent) {
    this._onMouseMiddleUp.emit(event);
  }

  /**
   * ポインターが移動したときのイベントを発火する
   *
   * @remarks
   * 通常、アプリケーション開発者がこのメソッドを直接呼び出すことはない。
   * 判定処理時に自動的に呼び出される。
   *
   * @param event - ポインターイベント
   */
  dispatchPointerMove(event: PointerEvent) {
    this._onPointerMove.emit(event);
  }

  /**
   * ポインターが入ったときのイベントを発火する
   *
   * @remarks
   * 通常、アプリケーション開発者がこのメソッドを直接呼び出すことはない。
   * 判定処理時に自動的に呼び出される。
   *
   * @param event - ポインターイベント
   */
  dispatchPointerEnter(event: PointerEvent) {
    this._onPointerEnter.emit(event);
  }

  /**
   * ポインターが出たときのイベントを発火する
   *
   * @remarks
   * 通常、アプリケーション開発者がこのメソッドを直接呼び出すことはない。
   * 判定処理時に自動的に呼び出される。
   *
   * @param event - ポインターイベント
   */
  dispatchPointerLeave(event: PointerEvent) {
    this._onPointerLeave.emit(event);
  }

  /**
   * 表示オブジェクトがクリックされたときのイベントを発火する
   *
   * @remarks
   * 左ボタンまたは主ポインタで押下された対象の上で、そのまま離されたときに発火する
   * 通常、アプリケーション開発者がこのメソッドを直接呼び出すことはない。
   * 判定処理時に自動的に呼び出される。
   *
   * @param event - ポインターイベント
   */
  dispatchClick(event: PointerEvent) {
    this._onClick.emit(event);
  }

  /**
   * 表示オブジェクト自身を描画する
   *
   * @remarks
   * render メソッド内で呼び出される。
   * 継承先のクラスはこのメソッドをオーバーライドして、表示オブジェクト自身の描画処理を実装する。
   *
   * @param _renderer - レンダラー
   * @param _state - 描画状態
   */
  protected renderSelf(_renderer: Renderer, _state: RenderState) {}

  /**
   * 指定した座標が表示オブジェクトの範囲内にあるかどうかを判定する
   * @param x - 判定するX座標
   * @param y - 判定するY座標
   * @returns 範囲内にある場合はtrue、それ以外はfalse
   */
  hitTestPoint(x: number, y: number) {
    if (!this.isPointWithinMask(x, y)) {
      return false;
    }
    const worldTransform = this.getWorldTransform();
    return this.hitTestPointWithWorldTransform(x, y, worldTransform);
  }

  private hitTestPointWithWorldTransform(x: number, y: number, worldTransform: Transform2D) {
    const inverse = invertTransform(worldTransform);
    if (!inverse) {
      return false;
    }
    const local = applyTransform(inverse, x, y);
    const bounds = this.getAnchorAdjustedLocalBounds();
    if (!bounds) {
      return false;
    }
    const inBounds =
      local.x >= bounds.x &&
      local.x <= bounds.x + bounds.width &&
      local.y >= bounds.y &&
      local.y <= bounds.y + bounds.height;
    if (!inBounds) {
      return false;
    }
    return true;
  }

  /**
   * 表示オブジェクトのローカル座標系での境界矩形を取得する
   * @returns 境界矩形。境界が定義されていない場合はnullを返す
   */
  getLocalBounds(): Rectangle | null {
    return null;
  }

  private createLocalTransform(): Transform2D {
    const cos = Math.cos(this._rotation);
    const sin = Math.sin(this._rotation);
    return {
      a: cos * this._scaleX,
      b: sin * this._scaleX,
      c: -sin * this._scaleY,
      d: cos * this._scaleY,
      tx: this._x,
      ty: this._y,
    };
  }

  private getWorldTransform(): Transform2D {
    const local = this.createLocalTransform();
    if (!this._parent) {
      return local;
    }
    return multiplyTransform(this._parent.getWorldTransform(), local);
  }

  private ensureCanAddChild(child: DisplayObject) {
    if (child === this) {
      throw new Error('Cannot add self as child');
    }
    if (this.hasAncestor(child)) {
      throw new Error('Cannot add an ancestor as child');
    }
  }

  private hasAncestor(target: DisplayObject): boolean {
    return this._parent === target || this._parent?.hasAncestor(target) === true;
  }

  private ensureCanAssignMask(mask: DisplayObject) {
    if (mask.dependsOn(this)) {
      throw new Error('Cannot assign a mask that depends on this display object');
    }
  }

  /**
   * 指定した座標にある表示オブジェクトのうち、最も手前にあるものを返す
   * @param x - 判定するX座標
   * @param y - 判定するY座標
   * @returns 最も手前にある表示オブジェクト。該当するオブジェクトがない場合はnull
   */
  findTopmostHit(x: number, y: number): DisplayObject | null {
    return this.findTopmostHitInternal(x, y, undefined);
  }

  private findTopmostHitInternal(x: number, y: number, parentTransform: Transform2D | undefined): DisplayObject | null {
    if (this._maskRefCount > 0) return null;
    if (!this._visible) return null;
    const localTransform = this.createLocalTransform();
    const worldTransform = parentTransform ? multiplyTransform(parentTransform, localTransform) : localTransform;
    if (this._mask && !this._mask.containsPointForMask(x, y, worldTransform)) return null;

    for (let index = this._children.length - 1; index >= 0; index -= 1) {
      const child = this._children[index];
      const hit = child.findTopmostHitInternal(x, y, worldTransform);
      if (hit) return hit;
    }
    if (this._interactive && this.hitTestPointWithWorldTransform(x, y, worldTransform)) {
      return this;
    }
    return null;
  }

  private isPointWithinMask(x: number, y: number) {
    if (!this._mask) {
      return true;
    }
    return this._mask.containsPointForMask(x, y, this.getWorldTransform());
  }

  private containsPointForMask(x: number, y: number, parentTransform?: Transform2D) {
    if (!this._visible) {
      return false;
    }
    if (!this.isPointWithinAssignedMask(x, y, parentTransform)) {
      return false;
    }

    const localTransform = this.createLocalTransform();
    const worldTransform = parentTransform ? multiplyTransform(parentTransform, localTransform) : localTransform;

    for (let index = this._children.length - 1; index >= 0; index -= 1) {
      const child = this._children[index];
      if (child?.containsPointForMask(x, y, worldTransform)) {
        return true;
      }
    }

    const inverse = invertTransform(worldTransform);
    if (!inverse) {
      return false;
    }
    const local = applyTransform(inverse, x, y);
    const bounds = this.getAnchorAdjustedLocalBounds();
    if (!bounds) {
      return false;
    }
    return (
      local.x >= bounds.x &&
      local.x <= bounds.x + bounds.width &&
      local.y >= bounds.y &&
      local.y <= bounds.y + bounds.height
    );
  }

  private isPointWithinAssignedMask(x: number, y: number, parentTransform?: Transform2D) {
    if (!this._mask) {
      return true;
    }
    return this._mask.containsPointForMask(x, y, parentTransform);
  }

  private createMaskParentState(ownerWorldTransform: Transform2D): RenderState {
    return {
      transform: ownerWorldTransform,
      alpha: 1,
      blendMode: 'normal',
      colorTone: IDENTITY_TONE,
      smooth: this._smooth,
    };
  }

  protected getAnchorAdjustedLocalBounds() {
    const bounds = this.getLocalBounds();
    if (!bounds) {
      return null;
    }
    return {
      x: bounds.x - (bounds.x + bounds.width * this._anchorX),
      y: bounds.y - (bounds.y + bounds.height * this._anchorY),
      width: bounds.width,
      height: bounds.height,
    };
  }

  private dependsOn(target: DisplayObject, visited = new Set<DisplayObject>()): boolean {
    if (this === target) {
      return true;
    }
    if (visited.has(this)) {
      return false;
    }
    visited.add(this);
    if (this._mask?.dependsOn(target, visited)) {
      return true;
    }
    for (const child of this._children) {
      if (child.dependsOn(target, visited)) {
        return true;
      }
    }
    return false;
  }
}

const IDENTITY_TONE: Color = { r: 0, g: 0, b: 0, a: 0 };

function composeColorTone(parent: Color, own: Color | null): Color {
  if (!own || own.a <= 0) {
    return parent;
  }
  if (parent.a <= 0) {
    return normalizeColorTone(own);
  }

  const pa = clamp01(parent.a);
  const oa = clamp01(own.a);
  const mixedAlpha = pa + oa - pa * oa;
  if (mixedAlpha <= 0) {
    return IDENTITY_TONE;
  }

  const r = (clamp255(parent.r) * pa * (1 - oa) + clamp255(own.r) * oa) / mixedAlpha;
  const g = (clamp255(parent.g) * pa * (1 - oa) + clamp255(own.g) * oa) / mixedAlpha;
  const b = (clamp255(parent.b) * pa * (1 - oa) + clamp255(own.b) * oa) / mixedAlpha;

  return {
    r: clamp255(r),
    g: clamp255(g),
    b: clamp255(b),
    a: clamp01(mixedAlpha),
  };
}

function normalizeColorTone(color: Color): Color {
  return {
    r: clamp255(color.r),
    g: clamp255(color.g),
    b: clamp255(color.b),
    a: clamp01(color.a),
  };
}
