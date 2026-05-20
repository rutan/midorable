import {
  InputBackend,
  InputGamepadSnapshot,
  InputMouseSnapshot,
  InputPenSnapshot,
  InputPointerSnapshot,
  InputSnapshot,
  InputTouchSnapshot,
  PointerButtonId,
  PointerKind,
} from '@rutan/midorable';
import { Viewport } from './types';

interface PointerInternalState {
  id: number;
  kind: PointerKind;
  x: number;
  y: number;
  inBounds: boolean;
  buttons: Set<PointerButtonId>;
}

export class BrowserInput implements InputBackend {
  private _element: HTMLElement;
  private _pointerMap = new Map<number, PointerInternalState>();
  private _keyboardDown = new Set<string>();
  private _gamepadButtonsPrev = new Map<number, boolean[]>();
  private _supportsPointerEvent = typeof PointerEvent !== 'undefined';
  private _mousePointerId = 1;
  private _lastTouchTime = Number.NEGATIVE_INFINITY;
  private _lastPointerTouchTime = Number.NEGATIVE_INFINITY;
  private _viewport: Viewport = { width: 1, height: 1, scale: 1, offsetX: 0, offsetY: 0 };
  private _onPointerDown: (event: PointerEvent) => void;
  private _onPointerMove: (event: PointerEvent) => void;
  private _onPointerUp: (event: PointerEvent) => void;
  private _onPointerCancel: (event: PointerEvent) => void;
  private _onPointerEnter: (event: PointerEvent) => void;
  private _onPointerLeave: (event: PointerEvent) => void;
  private _onMouseDown: (event: MouseEvent) => void;
  private _onMouseMove: (event: MouseEvent) => void;
  private _onMouseUp: (event: MouseEvent) => void;
  private _onMouseLeave: (event: MouseEvent) => void;
  private _onKeyDown: (event: KeyboardEvent) => void;
  private _onKeyUp: (event: KeyboardEvent) => void;
  private _onWindowBlur: () => void;
  private _onVisibilityChange: () => void;
  private _onContextMenu: (event: MouseEvent) => void;
  private _onTouchStart: (event: TouchEvent) => void;
  private _onTouchMove: (event: TouchEvent) => void;
  private _onTouchEnd: (event: TouchEvent) => void;
  private _onTouchCancel: (event: TouchEvent) => void;

  constructor(element: HTMLElement) {
    this._element = element;
    this._onPointerDown = (event) => {
      if (event.pointerType === 'touch') {
        event.preventDefault();
        this._lastTouchTime = performance.now();
      }
      if (event.pointerType === 'mouse') {
        this._mousePointerId = event.pointerId;
        return;
      }

      this.trySetPointerCapture(event.pointerId);
      const pointer = this.getOrCreatePointer(event.pointerId, this.toPointerKind(event.pointerType));
      pointer.inBounds = true;
      this.updatePointerPosition(pointer, event);
      pointer.buttons.add('left');
    };

    this._onPointerMove = (event) => {
      const pointer = this.getOrCreatePointer(event.pointerId, this.toPointerKind(event.pointerType));
      if (event.pointerType === 'mouse') {
        this._mousePointerId = event.pointerId;
      }
      if (event.pointerType === 'touch') {
        event.preventDefault();
        this._lastTouchTime = performance.now();
      }
      pointer.inBounds = true;
      this.updatePointerPosition(pointer, event);
    };

    this._onPointerUp = (event) => {
      if (event.pointerType === 'touch') {
        event.preventDefault();
        this._lastTouchTime = performance.now();
        this._lastPointerTouchTime = this._lastTouchTime;
      }
      if (event.pointerType === 'mouse') {
        this._mousePointerId = event.pointerId;
        return;
      }
      const pointer = this.getOrCreatePointer(event.pointerId, this.toPointerKind(event.pointerType));
      this.updatePointerPosition(pointer, event);
      pointer.buttons.delete('left');
      pointer.inBounds = true;
      this.tryReleasePointerCapture(event.pointerId);
    };

    this._onPointerCancel = (event) => {
      if (event.pointerType === 'touch') {
        event.preventDefault();
        this._lastTouchTime = performance.now();
        this._lastPointerTouchTime = this._lastTouchTime;
      }
      if (event.pointerType === 'mouse') {
        this._mousePointerId = event.pointerId;
        return;
      }
      const pointer = this.getOrCreatePointer(event.pointerId, this.toPointerKind(event.pointerType));
      this.updatePointerPosition(pointer, event);
      pointer.buttons.delete('left');
      pointer.inBounds = false;
      this.tryReleasePointerCapture(event.pointerId);
    };

    this._onPointerEnter = (event) => {
      const pointer = this.getOrCreatePointer(event.pointerId, this.toPointerKind(event.pointerType));
      if (event.pointerType === 'mouse') {
        this._mousePointerId = event.pointerId;
      }
      if (event.pointerType === 'touch') {
        event.preventDefault();
        this._lastTouchTime = performance.now();
        this._lastPointerTouchTime = this._lastTouchTime;
      }
      pointer.inBounds = true;
      this.updatePointerPosition(pointer, event);
    };

    this._onPointerLeave = (event) => {
      const pointer = this.getOrCreatePointer(event.pointerId, this.toPointerKind(event.pointerType));
      if (event.pointerType === 'mouse') {
        this._mousePointerId = event.pointerId;
        pointer.inBounds = false;
        this.updatePointerPosition(pointer, event);
        return;
      }
      if (event.pointerType === 'touch') {
        event.preventDefault();
        this._lastTouchTime = performance.now();
        this._lastPointerTouchTime = this._lastTouchTime;
      }
      this.updatePointerPosition(pointer, event);
    };

    this._onMouseDown = (event) => {
      if (performance.now() - this._lastTouchTime < 1000) {
        return;
      }
      const button = event.button ?? 0;
      if (button > 2) {
        return;
      }
      const pointer = this.getOrCreatePointer(this._mousePointerId, 'mouse');
      pointer.inBounds = true;
      this.updatePointerPosition(pointer, event);
      pointer.buttons.add(this.toButtonId(button));
    };

    this._onMouseMove = (event) => {
      if (performance.now() - this._lastTouchTime < 1000) {
        return;
      }
      const pointer = this.getOrCreatePointer(this._mousePointerId, 'mouse');
      pointer.inBounds = true;
      this.updatePointerPosition(pointer, event);
    };

    this._onMouseUp = (event) => {
      if (performance.now() - this._lastTouchTime < 1000) {
        return;
      }
      const button = event.button ?? 0;
      if (button > 2) {
        return;
      }
      const pointer = this.getOrCreatePointer(this._mousePointerId, 'mouse');
      this.updatePointerPosition(pointer, event);
      pointer.buttons.delete(this.toButtonId(button));
    };

    this._onMouseLeave = (event) => {
      if (performance.now() - this._lastTouchTime < 1000) {
        return;
      }
      const pointer = this.getOrCreatePointer(this._mousePointerId, 'mouse');
      pointer.inBounds = false;
      this.updatePointerPosition(pointer, event);
    };

    this._onKeyDown = (event) => {
      this._keyboardDown.add(event.code);
    };

    this._onKeyUp = (event) => {
      this._keyboardDown.delete(event.code);
    };

    this._onWindowBlur = () => {
      this.resetTransientState();
    };

    this._onVisibilityChange = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
        this.resetTransientState();
      }
    };

    this._onContextMenu = (event) => {
      event.preventDefault();
    };

    this._onTouchStart = (event) => {
      if (this.shouldIgnoreTouchFallback()) {
        return;
      }
      event.preventDefault();
      this._lastTouchTime = performance.now();
      for (const touch of event.changedTouches) {
        const pointer = this.getOrCreatePointer(this.toTouchPointerId(touch.identifier), 'touch');
        pointer.inBounds = true;
        this.updatePointerPositionFromClient(pointer, touch.clientX, touch.clientY);
        pointer.buttons.add('left');
      }
    };

    this._onTouchMove = (event) => {
      if (this.shouldIgnoreTouchFallback()) {
        return;
      }
      event.preventDefault();
      this._lastTouchTime = performance.now();
      for (const touch of event.changedTouches) {
        const pointer = this.getOrCreatePointer(this.toTouchPointerId(touch.identifier), 'touch');
        pointer.inBounds = true;
        this.updatePointerPositionFromClient(pointer, touch.clientX, touch.clientY);
      }
    };

    this._onTouchEnd = (event) => {
      if (this.shouldIgnoreTouchFallback()) {
        return;
      }
      event.preventDefault();
      this._lastTouchTime = performance.now();
      for (const touch of event.changedTouches) {
        const pointer = this.getOrCreatePointer(this.toTouchPointerId(touch.identifier), 'touch');
        this.updatePointerPositionFromClient(pointer, touch.clientX, touch.clientY);
        pointer.buttons.delete('left');
        pointer.inBounds = true;
      }
    };

    this._onTouchCancel = (event) => {
      if (this.shouldIgnoreTouchFallback()) {
        return;
      }
      event.preventDefault();
      this._lastTouchTime = performance.now();
      for (const touch of event.changedTouches) {
        const pointer = this.getOrCreatePointer(this.toTouchPointerId(touch.identifier), 'touch');
        this.updatePointerPositionFromClient(pointer, touch.clientX, touch.clientY);
        pointer.buttons.delete('left');
        pointer.inBounds = false;
      }
    };

    this.bindEvents();
  }

  pollSnapshot(): InputSnapshot {
    const pointers: InputPointerSnapshot[] = [];
    for (const pointer of this._pointerMap.values()) {
      if (pointer.kind === 'mouse') {
        const mouseSnapshot: InputMouseSnapshot = {
          kind: 'mouse',
          id: pointer.id,
          x: pointer.x,
          y: pointer.y,
          pressedLeft: pointer.buttons.has('left'),
          pressedMiddle: pointer.buttons.has('middle'),
          pressedRight: pointer.buttons.has('right'),
          inBounds: pointer.inBounds,
        };
        pointers.push(mouseSnapshot);
      } else if (pointer.kind === 'touch') {
        const touchSnapshot: InputTouchSnapshot = {
          kind: 'touch',
          id: pointer.id,
          x: pointer.x,
          y: pointer.y,
          pressed: pointer.buttons.has('left'),
          inBounds: pointer.inBounds,
        };
        pointers.push(touchSnapshot);
      } else {
        const penSnapshot: InputPenSnapshot = {
          kind: 'pen',
          id: pointer.id,
          x: pointer.x,
          y: pointer.y,
          pressed: pointer.buttons.has('left'),
          inBounds: pointer.inBounds,
        };
        pointers.push(penSnapshot);
      }
    }

    const snapshot: InputSnapshot = {
      pointers,
      keyboard: {
        pressedKeys: Array.from(this._keyboardDown),
      },
      gamepads: this.readGamepads(),
    };

    this.prunePointers();
    return snapshot;
  }

  setViewport(viewport: Viewport) {
    this._viewport = viewport;
  }

  dispose() {
    this._element.removeEventListener('pointerdown', this._onPointerDown);
    this._element.removeEventListener('pointermove', this._onPointerMove);
    this._element.removeEventListener('pointerup', this._onPointerUp);
    this._element.removeEventListener('pointercancel', this._onPointerCancel);
    this._element.removeEventListener('pointerenter', this._onPointerEnter);
    this._element.removeEventListener('pointerleave', this._onPointerLeave);
    this._element.removeEventListener('mousedown', this._onMouseDown);
    this._element.removeEventListener('mousemove', this._onMouseMove);
    window.removeEventListener('mouseup', this._onMouseUp);
    this._element.removeEventListener('mouseleave', this._onMouseLeave);
    this._element.removeEventListener('contextmenu', this._onContextMenu);
    this._element.removeEventListener('touchstart', this._onTouchStart);
    this._element.removeEventListener('touchmove', this._onTouchMove);
    this._element.removeEventListener('touchend', this._onTouchEnd);
    this._element.removeEventListener('touchcancel', this._onTouchCancel);
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup', this._onKeyUp);
    window.removeEventListener('blur', this._onWindowBlur);
    document.removeEventListener('visibilitychange', this._onVisibilityChange);

    this._pointerMap.clear();
    this._keyboardDown.clear();
    this._gamepadButtonsPrev.clear();
  }

  private bindEvents() {
    this._element.addEventListener('pointerdown', this._onPointerDown);
    this._element.addEventListener('pointermove', this._onPointerMove);
    this._element.addEventListener('pointerup', this._onPointerUp);
    this._element.addEventListener('pointercancel', this._onPointerCancel);
    this._element.addEventListener('pointerenter', this._onPointerEnter);
    this._element.addEventListener('pointerleave', this._onPointerLeave);
    this._element.addEventListener('mousedown', this._onMouseDown);
    this._element.addEventListener('mousemove', this._onMouseMove);
    window.addEventListener('mouseup', this._onMouseUp);
    this._element.addEventListener('mouseleave', this._onMouseLeave);
    this._element.addEventListener('contextmenu', this._onContextMenu);
    this._element.addEventListener('touchstart', this._onTouchStart, { passive: false });
    this._element.addEventListener('touchmove', this._onTouchMove, { passive: false });
    this._element.addEventListener('touchend', this._onTouchEnd, { passive: false });
    this._element.addEventListener('touchcancel', this._onTouchCancel, { passive: false });
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
    window.addEventListener('blur', this._onWindowBlur);
    document.addEventListener('visibilitychange', this._onVisibilityChange);
  }

  private getOrCreatePointer(id: number, kind: PointerKind): PointerInternalState {
    let pointer = this._pointerMap.get(id);
    if (!pointer) {
      pointer = {
        id,
        kind,
        x: 0,
        y: 0,
        inBounds: false,
        buttons: new Set<PointerButtonId>(),
      };
      this._pointerMap.set(id, pointer);
    } else {
      pointer.kind = kind;
    }
    return pointer;
  }

  private toPointerKind(pointerType: string): PointerKind {
    if (pointerType === 'touch' || pointerType === 'pen') {
      return pointerType;
    }
    return 'mouse';
  }

  private toButtonId(button: number): PointerButtonId {
    if (button === 1) return 'middle';
    if (button === 2) return 'right';
    return 'left';
  }

  private toTouchPointerId(identifier: number): number {
    return 1000 + identifier;
  }

  private shouldIgnoreTouchFallback(): boolean {
    if (!this._supportsPointerEvent) {
      return false;
    }
    return performance.now() - this._lastPointerTouchTime < 1000;
  }

  private updatePointerPosition(pointer: PointerInternalState, event: PointerEvent | MouseEvent) {
    this.updatePointerPositionFromClient(pointer, event.clientX, event.clientY);
  }

  private updatePointerPositionFromClient(pointer: PointerInternalState, clientX: number, clientY: number) {
    const rect = this._element.getBoundingClientRect();
    const localX = clientX - rect.left;
    const localY = clientY - rect.top;
    pointer.x = (localX - this._viewport.offsetX) / this._viewport.scale;
    pointer.y = (localY - this._viewport.offsetY) / this._viewport.scale;
  }

  private trySetPointerCapture(pointerId: number) {
    const element = this._element as HTMLElement & {
      setPointerCapture?: (id: number) => void;
    };
    if (typeof element.setPointerCapture !== 'function') {
      return;
    }
    try {
      element.setPointerCapture(pointerId);
    } catch {
      // noop
    }
  }

  private tryReleasePointerCapture(pointerId: number) {
    const element = this._element as HTMLElement & {
      hasPointerCapture?: (id: number) => boolean;
      releasePointerCapture?: (id: number) => void;
    };
    if (typeof element.releasePointerCapture !== 'function') {
      return;
    }
    if (typeof element.hasPointerCapture === 'function' && !element.hasPointerCapture(pointerId)) {
      return;
    }
    try {
      element.releasePointerCapture(pointerId);
    } catch {
      // noop
    }
  }

  private readGamepads(): InputGamepadSnapshot[] {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    const states: InputGamepadSnapshot[] = [];

    for (const pad of pads) {
      if (!pad) {
        continue;
      }

      const buttons = pad.buttons.map((button) => button.pressed || button.value > 0.5);
      this._gamepadButtonsPrev.set(pad.index, buttons);

      states.push({
        id: pad.id,
        index: pad.index,
        buttons,
        axes: pad.axes.slice(),
      });
    }

    return states;
  }

  private prunePointers() {
    for (const [id, pointer] of this._pointerMap.entries()) {
      const hasDownButton = pointer.buttons.size > 0;
      if (pointer.kind === 'mouse') {
        if (!pointer.inBounds && !hasDownButton) {
          this._pointerMap.delete(id);
        }
        continue;
      }
      if (!hasDownButton) {
        this._pointerMap.delete(id);
      }
    }
  }

  private resetTransientState() {
    this._pointerMap.clear();
    this._keyboardDown.clear();
    this._gamepadButtonsPrev.clear();
  }
}
