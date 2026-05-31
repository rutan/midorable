import { DisplayObject } from './displays';
import { InputController } from './inputs';
import { Loader } from './Loader';
import { Platform, PlatformFeatureRegistry, RenderFilterCapabilities } from './platform';
import { FilterInstance, ShaderFilterDefinition, Texture } from './renderer';
import { Color, CursorName, MediaQuery, MediaSupportLevel } from './types';

const MAX_STEP_SNAP_TOLERANCE_MS = 1;
const STEP_SNAP_TOLERANCE_RATIO = 0.06;

/**
 * App の設定オブジェクト
 */
export interface AppConfig {
  /** プラットフォーム実装 */
  platform: Platform;
  /** アプリケーションの幅 */
  width?: number;
  /** アプリケーションの高さ */
  height?: number;
  /** 1秒あたりのフレーム数 */
  fps?: number;
  /** 背景色 */
  backgroundColor?: Color;
}

/**
 * アプリケーションの統計情報
 */
export interface AppStats {
  /** 実際のフレームレート */
  actualFps: number;
  /** フレーム間の経過時間（ミリ秒） */
  frameDeltaMs: number;
}

/**
 * 各種オブジェクトで共有するコンテキストオブジェクト
 *
 * @remarks
 * AppContext は、App や DisplayObject などのさまざまなオブジェクトで共有されるコンテキスト情報をまとめたオブジェクト。
 * 主に、App や Loader などのインスタンスへの参照を提供するために利用される。
 * 子要素を作成する際に、親要素から受け渡された AppContext をそのまま子要素のコンテキストとして利用することが想定されている。
 * ただし、必要に応じて Loader などの情報を上書きしてから子要素に渡すことも可能。
 */
export interface AppContext {
  /** App インスタンスへの参照 */
  app: App;
  /** Loader インスタンスへの参照 */
  loader: Loader;
}

/**
 * アプリケーション本体として機能するクラス
 *
 * @remarks
 * アプリケーション起動時に1つ生成することを想定。
 * プラットフォーム層とのやり取りや、アプリケーション全体で共有するリソースの管理などを担当する。
 *
 * @example
 * ```ts
 * import { App } from '@rutan/midorable';
 * import { createWebGlPlatform } from '@rutan/midorable-platform-browser';
 *
 * const app = new App({
 *   platform: await createWebGlPlatform({
 *     element: document.getElementById('app')!,
 *   }),
 *   width: 800,
 *   height: 600,
 *   fps: 60,
 *   backgroundColor: { r: 0, g: 0, b: 0, a: 1 },
 * });
 *
 * app.start();
 * ```
 */
export class App {
  private _platform: Platform;
  private _context: AppContext;

  private _inputController: InputController;
  private _pointerHover = new Map<number, DisplayObject | null>();
  private _pointerCapture = new Map<number, DisplayObject>();
  private _pointerClickTarget = new Map<number, DisplayObject>();
  private _pointerLastPosition = new Map<number, { x: number; y: number }>();
  private _cursor: string | null = null;
  private _width: number;
  private _height: number;
  private _fps: number;
  private _stats: AppStats;
  private _statsSampleFrameCount = 0;
  private _statsSampleLastAt = 0;
  private _backgroundColor: Color;

  private _root: DisplayObject;
  private _loaders: Set<Loader> = new Set();
  private _isRunning = false;

  private _mediaQueryCache = new Map<string, MediaSupportLevel>();

  constructor(config: AppConfig) {
    this._platform = config.platform;
    this._width = config.width ?? 800;
    this._height = config.height ?? 600;
    this._fps = config.fps ?? 60;
    this._stats = {
      actualFps: 0,
      frameDeltaMs: 0,
    };
    this._backgroundColor = config.backgroundColor ?? { r: 0, g: 0, b: 0, a: 1 };

    this._context = {
      app: this,
      loader: this.createLoader(),
    };
    this._root = new DisplayObject({ context: this._context });
    this._inputController = new InputController(this._platform.input);

    this._platform.resize(this._width, this._height);
  }

  /**
   * アプリケーション全体で共有するコンテキスト
   */
  get context() {
    return this._context;
  }

  /**
   * アプリケーションの画面表示のルートとなる DisplayObject
   * すべての表示オブジェクトはこの子孫として配置される
   */
  get root() {
    return this._root;
  }

  /**
   * ユーザーの入力状態
   */
  get input() {
    return this._inputController.state;
  }

  /**
   * オーディオ再生機能
   */
  get audio() {
    return this._platform.audio;
  }

  /**
   * アプリケーションの論理画面幅
   *
   * @remarks
   * 初期化時に指定された幅。
   * 画面のリサイズなどで物理的な画面サイズが変わってもこの値は変わらない。
   */
  get width() {
    return this._width;
  }

  /**
   * アプリケーションの論理画面高さ
   *
   * @remarks
   * 初期化時に指定された高さ。
   * 画面のリサイズなどで物理的な画面サイズが変わってもこの値は変わらない。
   */
  get height() {
    return this._height;
  }

  /**
   * アプリケーションの目標フレームレート
   */
  get fps() {
    return this._fps;
  }

  /**
   * アプリケーションの統計情報
   */
  get stats() {
    return this._stats;
  }

  /**
   * ローダーを作成
   *
   * @remarks
   * 原則として Loader はこのメソッド経由で作成する必要がある。
   * App は内部で管理しているすべての Loader を保持しており、アプリケーション停止時にまとめて破棄する。
   */
  createLoader() {
    const loader = new Loader(this._platform, {
      onDispose: () => {
        this._loaders.delete(loader);
      },
    });
    this._loaders.add(loader);
    return loader;
  }

  /**
   * 空のテクスチャを作成
   *
   * @remarks
   * 図形やテキストを描画するためのキャンバスとして利用できるテクスチャを作成する。
   * 不要になったテクスチャは dispose() して破棄する必要がある。
   *
   * @param width - テクスチャの幅
   * @param height - テクスチャの高さ
   *
   * @example
   * ```ts
   * const texture = app.createTexture(256, 256);
   * texture.drawRect({ x: 0, y: 0, width: 256, height: 256, color: { r: 255, g: 0, b: 0, a: 1 }, fill: true });
   * const sprite = new Sprite({ context: app.context, texture });
   * app.root.addChild(sprite);
   *
   * // 後でテクスチャが不要になったら破棄する
   * texture.dispose();
   * ```
   */
  createTexture(width: number, height: number): Texture {
    return this._platform.createTexture(width, height);
  }

  /**
   * 対応するシェーダー言語の取得
   *
   * @remarks
   * プラットフォームが対応しているシェーダー言語の情報を取得する。
   * シェーダーを利用する場合は、この情報をもとに適切な言語でシェーダーフィルターを作成する必要がある。
   */
  get filterCapabilities(): RenderFilterCapabilities | null {
    return this._platform.filterCapabilities || null;
  }

  /**
   * シェーダーフィルターを作成する
   * @param definition - シェーダーフィルターの定義
   */
  createFilter(definition: ShaderFilterDefinition): Promise<FilterInstance> {
    return (
      this._platform.createFilter?.(definition) ??
      Promise.reject(new Error('createFilter is not supported on this platform'))
    );
  }

  /**
   * 対応するメディア種別を取得
   *
   * @remarks
   * プラットフォームが特定のメディア種別に対応しているかを確認するための機能。
   * 音声や画像の出しわけなどに利用できる。
   *
   * @param query - メディアクエリ
   *
   * @example
   * ```ts
   * const supportLevel = app.mediaQuery({ type: 'audio', mime: 'audio/ogg' });
   * console.log(supportLevel); // 'supported', 'unsupported', or 'unknown'
   * ```
   */
  mediaQuery(query: MediaQuery) {
    const cacheKey = `${query.type}:${query.mime}`;
    if (this._mediaQueryCache.has(cacheKey)) {
      return this._mediaQueryCache.get(cacheKey)!;
    }
    const result = this._platform.mediaQuery(query);
    this._mediaQueryCache.set(cacheKey, result);
    return result;
  }

  /**
   * アプリケーションのメインループを開始する
   *
   * @remarks
   * 開始後は update() と render() が自動的に呼び出されるようになる。
   * stop() を呼び出すまでループは継続する。
   * すでに開始している場合は何もしない。
   */
  async start() {
    if (this._isRunning) {
      return;
    }
    this._isRunning = true;

    const stepMs = 1000 / this._fps;
    const stepSnapToleranceMs = Math.min(MAX_STEP_SNAP_TOLERANCE_MS, stepMs * STEP_SNAP_TOLERANCE_RATIO);
    let lastTime = 0;
    let accumulator = 0;
    const tick = (now: number) => {
      if (!this._isRunning) {
        return;
      }
      if (lastTime === 0) {
        lastTime = now;
        this._statsSampleLastAt = now;
      }
      const delta = now - lastTime;
      lastTime = now;
      this.updateStats(now, delta);
      accumulator += delta;
      if (accumulator > stepMs - stepSnapToleranceMs && accumulator < stepMs) {
        accumulator = stepMs;
      }
      let updates = 0;
      while (accumulator >= stepMs) {
        // 長時間の非アクティブなどで永久に早送りになることを防ぐため、
        // 一定以上の更新が溜まったら強制的に抜け、追従完了にしてしまう
        if (updates > 10) {
          accumulator = 0;
          break;
        }

        this.update();
        accumulator -= stepMs;
        updates += 1;
      }
      if (updates === 1 && accumulator > 0 && accumulator < stepSnapToleranceMs) {
        accumulator = 0;
      }
      this.render();
    };
    this._platform.startLoop(tick);
  }

  /**
   * アプリケーションのメインループを停止する
   *
   * @remarks
   * 停止後は update() と render() は呼び出されなくなる。
   * start() を呼び出すことで再度ループを開始することができる。
   * すでに停止している場合は何もしない。
   */
  async stop() {
    if (!this._isRunning) return;

    this._isRunning = false;
    this._platform.stopLoop();
  }

  /**
   * アプリケーションを破棄する
   *
   * @remarks
   * アプリケーションで利用しているリソースをすべて解放し、プラットフォームとの接続も切る。
   * 破棄後はこの App インスタンスは再利用できない。
   */
  async dispose() {
    await this.stop();

    for (const loader of this._loaders) {
      try {
        await loader.dispose();
      } catch (e) {
        console.error('Failed to dispose loader', loader, e);
      }
    }
    this._root.dispose();
    this._platform.dispose();
  }

  /**
   * 画面を描画する
   *
   * @remarks
   * 通常は start() を呼び出すことで自動的に呼び出されるため、アプリケーションコードで直接呼び出す必要はない。
   */
  render() {
    this._platform.renderer.beginFrame();
    this._platform.renderer.clear(this._backgroundColor);
    this._root.render(this._platform.renderer);
    this._platform.renderer.endFrame();
  }

  /**
   * アプリケーションの状態を更新する
   *
   * @remarks
   * 通常は start() を呼び出すことで自動的に呼び出されるため、アプリケーションコードで直接呼び出す必要はない。
   * ユーザーの入力状態の更新や、表示オブジェクトの更新などを行う。
   */
  update() {
    this._inputController.update();
    this.dispatchPointerEvents();
    this._root.update();
  }

  /**
   * プラットフォーム固有の機能を取得する
   *
   * @remarks
   * プラットフォームが提供する固有の機能を取得するためのメソッド。
   * 複数のプラットフォームへの対応を見込んでいる場合は、必ずこのメソッドを経由して機能を取得するようにすること。
   *
   * @param key - 取得したい機能のキー
   * @returns 指定したキーに対応するプラットフォーム固有の機能、存在しない場合は undefined
   *
   * @example
   * ```ts
   * // ストレージへの保存の例
   * const storageFeature = app.getFeature('system.storage');
   * if (storageFeature) {
   *   await storageFeature.setItem('key', 'value');
   * } else {
   *  console.warn('Storage feature is not supported on this platform');
   * }
   * ```
   */
  getFeature<K extends keyof PlatformFeatureRegistry>(key: K): PlatformFeatureRegistry[K] | undefined {
    return this._platform.getFeature(key);
  }

  private updateStats(now: number, delta: number) {
    this._stats.frameDeltaMs = delta;
    this._statsSampleFrameCount += 1;
    const elapsed = now - this._statsSampleLastAt;
    if (elapsed < 250) {
      return;
    }

    this._stats.actualFps = (this._statsSampleFrameCount * 1000) / elapsed;
    this._statsSampleFrameCount = 0;
    this._statsSampleLastAt = now;
  }

  private dispatchPointerEvents() {
    const pointers = this._inputController.state.pointers;
    const activePointerIds = new Set<number>();
    let cursor: CursorName = 'default';

    for (const pointer of pointers) {
      activePointerIds.add(pointer.id);
      const pointerEvent = { pointerId: pointer.id, x: pointer.x, y: pointer.y };
      const hover = pointer.inBounds ? this._root.findTopmostHit(pointer.x, pointer.y) : null;
      const capturedTarget = this._pointerCapture.get(pointer.id) ?? null;
      const prevHover = this._pointerHover.get(pointer.id) ?? null;
      const lastPosition = this._pointerLastPosition.get(pointer.id);
      let eventTarget = capturedTarget ?? hover;

      if (prevHover !== hover) {
        if (prevHover) {
          prevHover.dispatchPointerLeave(pointerEvent);
        }
        if (hover) {
          hover.dispatchPointerEnter(pointerEvent);
        }
      }

      const moved = !lastPosition || lastPosition.x !== pointer.x || lastPosition.y !== pointer.y;
      if (!capturedTarget && pointer.justPressed && hover) {
        this._pointerCapture.set(pointer.id, hover);
        eventTarget = hover;
      }

      if (eventTarget && moved) {
        eventTarget.dispatchPointerMove(pointerEvent);
      }

      if (eventTarget && pointer.justPressed) {
        if (pointer.pressedButtons.includes('left')) {
          this._pointerClickTarget.set(pointer.id, eventTarget);
          eventTarget.dispatchPointerDown(pointerEvent);
        }
        if (pointer.pointerType === 'mouse' && pointer.pressedButtons.includes('middle')) {
          eventTarget.dispatchMouseMiddleDown(pointerEvent);
        }
        if (pointer.pointerType === 'mouse' && pointer.pressedButtons.includes('right')) {
          eventTarget.dispatchMouseRightDown(pointerEvent);
        }
      }

      if (eventTarget && pointer.justReleased) {
        if (pointer.releasedButtons.includes('left')) {
          eventTarget.dispatchPointerUp(pointerEvent);
          // click は「押下した対象の上で離した」場合にのみ成立させる
          const clickTarget = this._pointerClickTarget.get(pointer.id);
          if (clickTarget === eventTarget && hover === eventTarget) {
            eventTarget.dispatchClick(pointerEvent);
          }
          this._pointerClickTarget.delete(pointer.id);
        }
        if (pointer.pointerType === 'mouse' && pointer.releasedButtons.includes('middle')) {
          eventTarget.dispatchMouseMiddleUp(pointerEvent);
        }
        if (pointer.pointerType === 'mouse' && pointer.releasedButtons.includes('right')) {
          eventTarget.dispatchMouseRightUp(pointerEvent);
        }
      }

      if (hover) {
        // 指定した要素がカーソル指定を持つ場合はそちらを優先し、
        // そうでなければポインタがホバーしていることを示すカーソルにする
        if (hover.cursor) {
          cursor = hover.cursor;
        } else {
          cursor = 'pointer';
        }
      }

      if (hover) {
        this._pointerHover.set(pointer.id, hover);
      } else {
        this._pointerHover.delete(pointer.id);
      }
      if (!pointer.down && pointer.justReleased) {
        this._pointerCapture.delete(pointer.id);
      }
      this._pointerLastPosition.set(pointer.id, { x: pointer.x, y: pointer.y });
    }

    for (const [pointerId, hover] of this._pointerHover.entries()) {
      if (activePointerIds.has(pointerId)) {
        continue;
      }
      const lastPosition = this._pointerLastPosition.get(pointerId);
      if (hover && lastPosition) {
        hover.dispatchPointerLeave({ pointerId, x: lastPosition.x, y: lastPosition.y });
      }
      this._pointerHover.delete(pointerId);
      this._pointerCapture.delete(pointerId);
      this._pointerClickTarget.delete(pointerId);
      this._pointerLastPosition.delete(pointerId);
    }

    this.setCursor(cursor);
  }

  private setCursor(cursor: CursorName) {
    if (this._cursor === cursor) {
      return;
    }
    this._cursor = cursor;
    this._platform.setCursor(cursor);
  }
}
