import type { Size, SystemScreenFeature, SystemScreenState } from '@rutan/midorable/platform';

type ScreenListener = (state: SystemScreenState) => void;

/**
 * ブラウザ向けの system.screen 実装
 *
 * @remarks
 * コンテナ座標系は、ゲーム要素の左上（border の内側）を原点とする CSS ピクセルの座標系とする。
 * viewSize はゲーム要素の clientWidth / clientHeight を返す。
 */
export class BrowserScreenFeature implements SystemScreenFeature {
  private readonly _element: HTMLElement;
  private readonly _listeners = new Set<ScreenListener>();
  private _lastState: SystemScreenState | null = null;
  private _unsubscribe: (() => void) | null = null;
  private _probe: HTMLElement | null = null;
  private _disposed = false;

  readonly onChange = {
    on: (listener: ScreenListener) => {
      if (this._disposed) return;
      this._listeners.add(listener);
      this.subscribe();
    },
    off: (listener: ScreenListener) => {
      this._listeners.delete(listener);
      if (this._listeners.size === 0) this.unsubscribe();
    },
  };

  constructor(element: HTMLElement) {
    this._element = element;
  }

  getState(): SystemScreenState {
    const viewSize = this.getViewSize();
    return {
      viewSize,
    };
  }

  dispose() {
    this._disposed = true;
    this._listeners.clear();
    this.unsubscribe();
    this._probe?.remove();
    this._probe = null;
  }

  private subscribe() {
    if (this._unsubscribe) return;

    const update = () => this.notifyIfChanged();
    const win = typeof window !== 'undefined' ? window : undefined;
    let observer: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(update);
      observer.observe(this._element);
    }
    win?.addEventListener('resize', update);
    win?.addEventListener('orientationchange', update);
    win?.visualViewport?.addEventListener('resize', update);

    this._lastState = this.getState();
    this._unsubscribe = () => {
      observer?.disconnect();
      win?.removeEventListener('resize', update);
      win?.removeEventListener('orientationchange', update);
      win?.visualViewport?.removeEventListener('resize', update);
    };
  }

  private unsubscribe() {
    this._unsubscribe?.();
    this._unsubscribe = null;
    this._lastState = null;
  }

  private notifyIfChanged() {
    const state = this.getState();
    if (this._lastState && isSameState(this._lastState, state)) return;
    this._lastState = state;
    for (const listener of this._listeners) {
      try {
        listener(state);
      } catch (error) {
        console.error('Error in system.screen listener:', error);
      }
    }
  }

  private getViewSize(): Size {
    return { width: this._element.clientWidth || 0, height: this._element.clientHeight || 0 };
  }
}

function isSameState(a: SystemScreenState, b: SystemScreenState) {
  if (a.viewSize.width !== b.viewSize.width || a.viewSize.height !== b.viewSize.height) {
    return false;
  }
  return true;
}
