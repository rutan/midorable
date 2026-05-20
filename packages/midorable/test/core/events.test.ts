import { describe, expect, it, vi } from 'vitest';
import { createEventHandlers } from '../../src/core/events';

describe('createEventHandlers', () => {
  it('emits event to registered listeners', () => {
    const handlers = createEventHandlers<number>();
    const listener = vi.fn();
    handlers.listeners.on(listener);

    handlers.emit(42);

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith(42);
  });

  it('off removes listener', () => {
    const handlers = createEventHandlers<string>();
    const listener = vi.fn();
    handlers.listeners.on(listener);
    handlers.listeners.off(listener);

    handlers.emit('hello');

    expect(listener).not.toHaveBeenCalled();
  });

  it('offAll removes all listeners', () => {
    const handlers = createEventHandlers<void>();
    const a = vi.fn();
    const b = vi.fn();
    handlers.listeners.on(a);
    handlers.listeners.on(b);
    handlers.listeners.offAll();

    handlers.emit();

    expect(a).not.toHaveBeenCalled();
    expect(b).not.toHaveBeenCalled();
  });
});
