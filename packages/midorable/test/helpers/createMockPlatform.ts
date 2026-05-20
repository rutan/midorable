import { vi } from 'vitest';
import {
  AudioAsset,
  AudioBackend,
  AudioInstance,
  AssetSpec,
  BinaryAsset,
  ImageAsset,
  InputSnapshot,
  InputState,
  InputPointerState,
  Platform,
  Renderer,
  ResolvedAsset,
  TextAsset,
  Texture,
} from '../../src/core';

export function createImageAsset(id: string, width = 64, height = 64): ImageAsset {
  return {
    id,
    type: 'image',
    width,
    height,
    source: null,
  };
}

export function createAudioAsset(id: string): AudioAsset {
  return {
    id,
    type: 'audio',
    duration: 1,
    source: null,
  };
}

export function createTextAsset(id: string, content = ''): TextAsset {
  return {
    id,
    type: 'text',
    content,
  };
}

export function createBinaryAsset(id: string): BinaryAsset {
  return {
    id,
    type: 'binary',
    content: new ArrayBuffer(0),
  };
}

export function createMockTexture(width = 16, height = 16, isShared = false): Texture {
  return {
    width,
    height,
    source: null,
    isShared,
    dispose: vi.fn(),
    drawLine: vi.fn(),
    drawRect: vi.fn(),
    drawText: vi.fn(),
    measureText: vi.fn(() => ({ width: 0, height: 0 })),
    drawImage: vi.fn(),
    clear: vi.fn(),
  };
}

export function createEmptyInputState(): InputState {
  return {
    pointers: [] as InputPointerState[],
    keyboard: {
      down: new Set<string>(),
      justPressed: new Set<string>(),
      justReleased: new Set<string>(),
    },
    gamepads: [],
  };
}

function createMockRenderer() {
  return {
    beginFrame: vi.fn(),
    endFrame: vi.fn(),
    clear: vi.fn(),
    drawSprite: vi.fn(),
    pushFilters: vi.fn(() => false),
    popFilters: vi.fn(),
    pushMask: vi.fn(),
    activateMask: vi.fn(),
    popMask: vi.fn(),
    resize: vi.fn(),
  } satisfies Renderer;
}

function createMockAudio() {
  return {
    play: vi.fn(
      (_audioAsset: AudioAsset): AudioInstance => ({
        id: 1,
        source: null,
      }),
    ),
    updatePlayback: vi.fn(),
    stop: vi.fn(),
    setMasterVolume: vi.fn(),
    setMuted: vi.fn(),
    resume: vi.fn(async () => undefined),
    dispose: vi.fn(),
  } satisfies AudioBackend;
}

export function createMockPlatform() {
  const renderer = createMockRenderer();
  const audio = createMockAudio();
  const inputState = createEmptyInputState();
  const inputSnapshot: InputSnapshot = {
    pointers: [],
    keyboard: {
      pressedKeys: [],
    },
    gamepads: [],
  };
  const input = {
    pollSnapshot: vi.fn(() => {
      inputSnapshot.pointers = inputState.pointers.map((pointer) => {
        if (pointer.pointerType === 'mouse') {
          const pressed = new Set(pointer.pressedButtons);
          const released = new Set(pointer.releasedButtons);
          return {
            kind: 'mouse' as const,
            id: pointer.id,
            x: pointer.x,
            y: pointer.y,
            pressedLeft:
              (pointer.down && !released.has('left')) ||
              pressed.has('left') ||
              (pointer.justPressed && pointer.pressedButtons.length === 0),
            pressedMiddle:
              (pointer.down && !released.has('middle')) ||
              pressed.has('middle') ||
              (pointer.justPressed && pointer.pressedButtons.length === 0),
            pressedRight:
              (pointer.down && !released.has('right')) ||
              pressed.has('right') ||
              (pointer.justPressed && pointer.pressedButtons.length === 0),
            inBounds: pointer.inBounds,
          };
        }
        return {
          kind: pointer.pointerType,
          id: pointer.id,
          x: pointer.x,
          y: pointer.y,
          pressed:
            (pointer.down && !pointer.releasedButtons.includes('left')) ||
            pointer.pressedButtons.includes('left') ||
            (pointer.justPressed && pointer.pressedButtons.length === 0),
          inBounds: pointer.inBounds,
        };
      });
      inputSnapshot.keyboard.pressedKeys = Array.from(inputState.keyboard.down);
      inputSnapshot.gamepads = [];
      return {
        pointers: [...inputSnapshot.pointers],
        keyboard: { pressedKeys: [...inputSnapshot.keyboard.pressedKeys] },
        gamepads: [],
      };
    }),
    dispose: vi.fn(),
  };

  let loopCallback: ((now: number) => void) | null = null;
  const loadAsset = vi.fn(
    async <TSpec extends AssetSpec>(
      spec: TSpec,
      _options?: { signal?: AbortSignal },
    ): Promise<ResolvedAsset<TSpec>> => {
      switch (spec.type) {
        case 'image':
          return createImageAsset(spec.src) as ResolvedAsset<TSpec>;
        case 'audio':
          return createAudioAsset(spec.src) as ResolvedAsset<TSpec>;
        case 'text':
          return createTextAsset(spec.src) as ResolvedAsset<TSpec>;
        case 'binary':
          return createBinaryAsset(spec.src) as ResolvedAsset<TSpec>;
      }
    },
  );

  const platform = {
    renderer,
    audio,
    input,
    dispose: vi.fn(),
    startLoop: vi.fn((callback: (now: number) => void) => {
      loopCallback = callback;
    }),
    stopLoop: vi.fn(() => {
      loopCallback = null;
    }),
    resize: vi.fn(),
    loadAsset: loadAsset as any,
    unloadAsset: vi.fn(),
    createTexture: vi.fn((width: number, height: number) => createMockTexture(width, height)),
    filterCapabilities: null,
    createFilter: vi.fn(async () => {
      throw new Error('Shader filters are not supported on mock platform');
    }),
    getFeature: vi.fn(() => undefined),
    setCursor: vi.fn(),
    mediaQuery: vi.fn(() => 'unknown' as const),
  } satisfies Platform;

  return {
    platform,
    renderer,
    audio,
    input,
    inputState,
    triggerTick(now: number) {
      if (!loopCallback) throw new Error('Loop callback is not active');
      loopCallback(now);
    },
  };
}
