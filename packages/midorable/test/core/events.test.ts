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

  it('does not call listeners added during a single-listener emit until the next emit', () => {
    const handlers = createEventHandlers<string>();
    const added = vi.fn();
    const first = vi.fn(() => {
      handlers.listeners.on(added);
    });
    handlers.listeners.on(first);

    handlers.emit('first');

    expect(first).toHaveBeenCalledTimes(1);
    expect(first).toHaveBeenCalledWith('first');
    expect(added).not.toHaveBeenCalled();

    handlers.emit('second');

    expect(first).toHaveBeenCalledTimes(2);
    expect(first).toHaveBeenLastCalledWith('second');
    expect(added).toHaveBeenCalledTimes(1);
    expect(added).toHaveBeenCalledWith('second');
  });

  it('continues emitting to the current snapshot when a listener removes another listener', () => {
    const handlers = createEventHandlers<string>();
    const second = vi.fn();
    const first = vi.fn(() => {
      handlers.listeners.off(second);
    });
    handlers.listeners.on(first);
    handlers.listeners.on(second);

    handlers.emit('hello');

    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledWith('hello');

    handlers.emit('again');

    expect(first).toHaveBeenCalledTimes(2);
    expect(second).toHaveBeenCalledTimes(1);
  });
});
