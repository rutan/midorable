import { LogicalSize, Viewport } from './types';

export class BrowserSurface {
  private _element: HTMLElement;
  private _canvas: HTMLCanvasElement;
  private _logicalSize: LogicalSize = { width: 0, height: 0 };
  private _resizeObserverStop: (() => void) | null = null;
  private _onViewportChanged: ((viewport: Viewport) => void) | null = null;

  constructor(element: HTMLElement) {
    this._element = element;
    this._element.style.position = 'relative';
    this._element.style.touchAction = 'none';
    this._element.style.userSelect = 'none';
    this._element.style.setProperty('-webkit-tap-highlight-color', 'transparent');
    this._element.style.setProperty('-webkit-user-select', 'none');

    const canvas = document.createElement('canvas');
    canvas.width = element.clientWidth || 800;
    canvas.height = element.clientHeight || 600;
    canvas.style.position = 'absolute';
    canvas.style.left = '0';
    canvas.style.top = '0';
    canvas.style.touchAction = 'none';
    canvas.style.userSelect = 'none';
    canvas.style.setProperty('-webkit-tap-highlight-color', 'transparent');
    canvas.style.setProperty('-webkit-user-select', 'none');
    element.appendChild(canvas);
    this._canvas = canvas;
  }

  get element() {
    return this._element;
  }

  get canvas() {
    return this._canvas;
  }

  setLogicalSize(width: number, height: number) {
    this._logicalSize = { width, height };
    this.updateViewport();
  }

  observeViewport(onViewportChanged: (viewport: Viewport) => void) {
    this._onViewportChanged = onViewportChanged;
    if (this._resizeObserverStop) {
      return;
    }

    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(() => this.updateViewport());
      observer.observe(this._element);
      this._resizeObserverStop = () => observer.disconnect();
      return;
    }

    const onResize = () => this.updateViewport();
    window.addEventListener('resize', onResize);
    this._resizeObserverStop = () => window.removeEventListener('resize', onResize);
  }

  dispose() {
    this._onViewportChanged = null;
    if (this._resizeObserverStop) {
      this._resizeObserverStop();
      this._resizeObserverStop = null;
    }
    if (this._canvas.parentElement === this._element) {
      this._element.removeChild(this._canvas);
    }
  }

  private updateViewport() {
    const { width, height } = this._logicalSize;
    if (!width || !height) {
      return;
    }

    const containerWidth = this._element.clientWidth || 0;
    const containerHeight = this._element.clientHeight || 0;
    if (!containerWidth || !containerHeight) {
      return;
    }

    const scale = Math.min(containerWidth / width, containerHeight / height);
    const viewWidth = Math.round(width * scale);
    const viewHeight = Math.round(height * scale);
    const offsetX = Math.round((containerWidth - viewWidth) / 2);
    const offsetY = Math.round((containerHeight - viewHeight) / 2);

    const viewport: Viewport = {
      width: viewWidth,
      height: viewHeight,
      scale,
      offsetX,
      offsetY,
    };

    this._canvas.style.width = `${viewport.width}px`;
    this._canvas.style.height = `${viewport.height}px`;
    this._canvas.style.left = `${viewport.offsetX}px`;
    this._canvas.style.top = `${viewport.offsetY}px`;
    this._onViewportChanged?.(viewport);
  }
}
