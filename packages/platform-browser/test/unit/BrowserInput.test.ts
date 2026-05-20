import { afterEach, describe, expect, it, vi } from 'vitest';
import { BrowserInput } from '../../src/BrowserInput';

type EventHandler = (event: any) => void;

interface MockElement {
  addEventListener: (type: string, handler: EventHandler, options?: unknown) => void;
  removeEventListener: (type: string, handler: EventHandler) => void;
  getBoundingClientRect: () => { left: number; top: number; width: number; height: number };
  setPointerCapture?: (id: number) => void;
  releasePointerCapture?: (id: number) => void;
  hasPointerCapture?: (id: number) => boolean;
}

function createWindowStub() {
  const listeners = new Map<string, EventHandler>();

  return {
    target: {
      addEventListener: vi.fn((type: string, handler: EventHandler) => {
        listeners.set(type, handler);
      }),
      removeEventListener: vi.fn((type: string) => {
        listeners.delete(type);
      }),
    },
    emit(type: string, event: any = {}) {
      const handler = listeners.get(type);
      if (!handler) {
        throw new Error(`window event handler not found: ${type}`);
      }
      handler(event);
    },
  };
}

function createDocumentStub() {
  const listeners = new Map<string, EventHandler>();
  const documentStub = {
    visibilityState: 'visible',
    addEventListener: vi.fn((type: string, handler: EventHandler) => {
      listeners.set(type, handler);
    }),
    removeEventListener: vi.fn((type: string) => {
      listeners.delete(type);
    }),
  };

  return {
    target: documentStub,
    emit(type: string, event: any = {}) {
      const handler = listeners.get(type);
      if (!handler) {
        throw new Error(`document event handler not found: ${type}`);
      }
      handler(event);
    },
    setVisibilityState(state: 'visible' | 'hidden') {
      documentStub.visibilityState = state;
    },
  };
}

function createMockElement() {
  const listeners = new Map<string, EventHandler>();
  const added: Array<{ type: string; options?: unknown }> = [];
  const element: MockElement = {
    addEventListener(type, handler, options) {
      listeners.set(type, handler);
      added.push({ type, options });
    },
    removeEventListener(type) {
      listeners.delete(type);
    },
    getBoundingClientRect() {
      return { left: 10, top: 20, width: 300, height: 200 };
    },
  };

  return {
    element,
    listeners,
    added,
    emit(type: string, event: any) {
      const handler = listeners.get(type);
      if (!handler) {
        throw new Error(`event handler not found: ${type}`);
      }
      handler(event);
    },
  };
}

function stubBrowserGlobals() {
  const windowStub = createWindowStub();
  const documentStub = createDocumentStub();
  vi.stubGlobal('window', windowStub.target);
  vi.stubGlobal('document', documentStub.target);
  vi.stubGlobal('navigator', {
    getGamepads: () => [],
  });
  return { windowStub, documentStub };
}

describe('BrowserInput', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('falls back to touch events when PointerEvent is unavailable', () => {
    stubBrowserGlobals();
    vi.stubGlobal('PointerEvent', undefined);
    const mock = createMockElement();
    const input = new BrowserInput(mock.element as unknown as HTMLElement);
    input.setViewport({ width: 300, height: 200, scale: 1, offsetX: 0, offsetY: 0 });

    const preventDefault = vi.fn();
    mock.emit('touchstart', {
      preventDefault,
      changedTouches: [{ identifier: 7, clientX: 60, clientY: 80 }],
    });
    const started = input.pollSnapshot();
    expect(preventDefault).toHaveBeenCalledTimes(1);
    expect(started.pointers).toHaveLength(1);
    expect(started.pointers[0]).toMatchObject({
      kind: 'touch',
      id: 1007,
      x: 50,
      y: 60,
      pressed: true,
      inBounds: true,
    });

    mock.emit('touchend', {
      preventDefault: vi.fn(),
      changedTouches: [{ identifier: 7, clientX: 65, clientY: 90 }],
    });
    const ended = input.pollSnapshot();
    expect(ended.pointers).toHaveLength(1);
    expect(ended.pointers[0]).toMatchObject({
      kind: 'touch',
      id: 1007,
      x: 55,
      y: 70,
      pressed: false,
      inBounds: true,
    });

    const pruned = input.pollSnapshot();
    expect(pruned.pointers).toHaveLength(0);
  });

  it('does not throw if pointer capture APIs are unavailable', () => {
    stubBrowserGlobals();
    const mock = createMockElement();
    const input = new BrowserInput(mock.element as unknown as HTMLElement);
    input.setViewport({ width: 300, height: 200, scale: 1, offsetX: 0, offsetY: 0 });

    expect(() => {
      mock.emit('pointerdown', {
        pointerType: 'touch',
        pointerId: 10,
        clientX: 20,
        clientY: 30,
        preventDefault: vi.fn(),
      });
      mock.emit('pointerup', {
        pointerType: 'touch',
        pointerId: 10,
        clientX: 22,
        clientY: 35,
        preventDefault: vi.fn(),
      });
      input.pollSnapshot();
    }).not.toThrow();
  });

  it('keeps touch pointer in bounds on pointerup after pointerleave', () => {
    stubBrowserGlobals();
    vi.stubGlobal('PointerEvent', class PointerEvent {});
    const mock = createMockElement();
    const input = new BrowserInput(mock.element as unknown as HTMLElement);
    input.setViewport({ width: 300, height: 200, scale: 1, offsetX: 0, offsetY: 0 });

    mock.emit('pointerdown', {
      pointerType: 'touch',
      pointerId: 10,
      clientX: 30,
      clientY: 40,
      preventDefault: vi.fn(),
    });
    mock.emit('pointerleave', {
      pointerType: 'touch',
      pointerId: 10,
      clientX: 31,
      clientY: 41,
      preventDefault: vi.fn(),
    });
    mock.emit('pointerup', {
      pointerType: 'touch',
      pointerId: 10,
      clientX: 32,
      clientY: 42,
      preventDefault: vi.fn(),
    });

    const snapshot = input.pollSnapshot();
    expect(snapshot.pointers).toHaveLength(1);
    expect(snapshot.pointers[0]).toMatchObject({
      kind: 'touch',
      id: 10,
      pressed: false,
      inBounds: true,
    });
  });

  it('clears keyboard and pointer state on window blur', () => {
    const { windowStub } = stubBrowserGlobals();
    vi.stubGlobal('PointerEvent', class PointerEvent {});
    const mock = createMockElement();
    const input = new BrowserInput(mock.element as unknown as HTMLElement);
    input.setViewport({ width: 300, height: 200, scale: 1, offsetX: 0, offsetY: 0 });

    windowStub.emit('keydown', { code: 'Space' });
    mock.emit('pointerenter', {
      pointerType: 'mouse',
      pointerId: 1,
      clientX: 30,
      clientY: 40,
    });
    expect(input.pollSnapshot().pointers).toHaveLength(1);

    windowStub.emit('blur');
    const snapshot = input.pollSnapshot();
    expect(snapshot.keyboard.pressedKeys).toEqual([]);
    expect(snapshot.pointers).toHaveLength(0);
  });

  it('tracks mouse movement through mouse fallback events', () => {
    stubBrowserGlobals();
    vi.stubGlobal('PointerEvent', undefined);
    const mock = createMockElement();
    const input = new BrowserInput(mock.element as unknown as HTMLElement);
    input.setViewport({ width: 300, height: 200, scale: 1, offsetX: 0, offsetY: 0 });

    mock.emit('mousemove', {
      clientX: 40,
      clientY: 70,
    });
    const moved = input.pollSnapshot();
    expect(moved.pointers).toHaveLength(1);
    expect(moved.pointers[0]).toMatchObject({
      kind: 'mouse',
      x: 30,
      y: 50,
      inBounds: true,
    });

    mock.emit('mouseleave', {
      clientX: 45,
      clientY: 80,
    });
    const left = input.pollSnapshot();
    expect(left.pointers).toHaveLength(1);
    expect(left.pointers[0]).toMatchObject({
      kind: 'mouse',
      x: 35,
      y: 60,
      inBounds: false,
    });

    expect(input.pollSnapshot().pointers).toHaveLength(0);
  });

  it('clears keyboard state when document becomes hidden', () => {
    const { windowStub, documentStub } = stubBrowserGlobals();
    const mock = createMockElement();
    const input = new BrowserInput(mock.element as unknown as HTMLElement);

    windowStub.emit('keydown', { code: 'Enter' });
    expect(input.pollSnapshot().keyboard.pressedKeys).toEqual(['Enter']);

    documentStub.setVisibilityState('hidden');
    documentStub.emit('visibilitychange');

    expect(input.pollSnapshot().keyboard.pressedKeys).toEqual([]);
  });
});
