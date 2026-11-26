import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BrowserScreenFeature } from '../../src/features/screen';

function createEnvironment() {
  const windowListeners = new Map<string, Set<() => void>>();
  const resizeObservers: { callback: () => void; disconnect: ReturnType<typeof vi.fn> }[] = [];
  const win = {
    innerWidth: 400,
    innerHeight: 800,
    addEventListener: vi.fn((type: string, handler: () => void) => {
      if (!windowListeners.has(type)) windowListeners.set(type, new Set());
      windowListeners.get(type)!.add(handler);
    }),
    removeEventListener: vi.fn((type: string, handler: () => void) => {
      windowListeners.get(type)?.delete(handler);
    }),
  };

  vi.stubGlobal('window', win);
  vi.stubGlobal(
    'ResizeObserver',
    class {
      disconnect = vi.fn();
      constructor(callback: () => void) {
        resizeObservers.push({ callback, disconnect: this.disconnect });
      }
      observe() {}
    },
  );

  const dispatchWindow = (type: string) => {
    for (const handler of windowListeners.get(type) ?? []) handler();
  };

  return { windowListeners, resizeObservers, dispatchWindow };
}

function createElement(clientWidth = 400, clientHeight = 800) {
  return { clientWidth, clientHeight };
}

describe('BrowserScreenFeature', () => {
  let env: ReturnType<typeof createEnvironment>;

  beforeEach(() => {
    env = createEnvironment();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns the view size', () => {
    const feature = new BrowserScreenFeature(createElement() as unknown as HTMLElement);

    expect(feature.getState()).toEqual({
      viewSize: { width: 400, height: 800 },
    });
  });

  it('returns the element client size when it is smaller than the window', () => {
    const element = createElement(300, 700);
    const feature = new BrowserScreenFeature(element as unknown as HTMLElement);

    expect(feature.getState()).toEqual({
      viewSize: { width: 300, height: 700 },
    });
  });

  it('notifies listeners only when the state changes', () => {
    const element = createElement();
    const feature = new BrowserScreenFeature(element as unknown as HTMLElement);
    const listener = vi.fn();
    feature.onChange.on(listener);

    env.dispatchWindow('resize');
    expect(listener).not.toHaveBeenCalled();

    element.clientWidth = 800;
    env.resizeObservers[0].callback();
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenLastCalledWith({
      viewSize: { width: 800, height: 800 },
    });

    env.dispatchWindow('orientationchange');
    expect(listener).toHaveBeenCalledTimes(1);

    element.clientHeight = 400;
    env.dispatchWindow('orientationchange');
    expect(listener).toHaveBeenCalledTimes(2);
    expect(listener).toHaveBeenLastCalledWith({
      viewSize: { width: 800, height: 400 },
    });
  });

  it('calls a listener that re-registers itself only once per change', () => {
    const element = createElement();
    const feature = new BrowserScreenFeature(element as unknown as HTMLElement);
    const listener = vi.fn().mockImplementationOnce(() => {
      feature.onChange.off(listener);
      feature.onChange.on(listener);
    });
    feature.onChange.on(listener);

    element.clientWidth = 500;
    env.resizeObservers[0].callback();
    expect(listener).toHaveBeenCalledTimes(1);

    element.clientWidth = 600;
    env.dispatchWindow('resize');
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('unsubscribes when all listeners are removed', () => {
    const feature = new BrowserScreenFeature(createElement() as unknown as HTMLElement);
    const listener = vi.fn();

    feature.onChange.on(listener);
    expect(env.resizeObservers).toHaveLength(2);
    expect(env.windowListeners.get('resize')?.size).toBe(1);

    feature.onChange.off(listener);
    for (const observer of env.resizeObservers) expect(observer.disconnect).toHaveBeenCalled();
    expect(env.windowListeners.get('resize')?.size).toBe(0);
  });

  it('disconnects the resize observers and removes window listeners on dispose', () => {
    const feature = new BrowserScreenFeature(createElement() as unknown as HTMLElement);
    feature.onChange.on(vi.fn());

    feature.dispose();
    for (const observer of env.resizeObservers) expect(observer.disconnect).toHaveBeenCalled();
    expect(env.windowListeners.get('resize')?.size).toBe(0);
    expect(env.windowListeners.get('orientationchange')?.size).toBe(0);
  });
});
