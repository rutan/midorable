import { bench, describe } from 'vitest';
import {
  App,
  Asset,
  AssetSpec,
  AudioAsset,
  AudioBackend,
  DisplayObject,
  ImageAsset,
  InputBackend,
  NinePatch,
  ParticleEmitter,
  ParticleEmitterConfig,
  Platform,
  RenderableImage,
  Renderer,
  RenderState,
  ResolvedAsset,
  Sprite,
  Texture,
} from '../src';

describe('core render/update paths', () => {
  const spriteScene = createSpriteScene(1_000);
  const spriteStateScene = createSpriteScene(1_000, { colorTone: true });
  const nestedSpriteScene = createNestedSpriteScene(250);
  const ninePatchScene = createNinePatchScene(100);
  const maskScene = createMaskedSpriteScene(100);
  const filterScene = createFilteredSpriteScene(100);
  const updateScene = createDisplayTree(1_000);
  const hitTestScene = createSpriteScene(1_000, { interactive: true });
  const nestedHitTestScene = createNestedHitTestScene(250);
  const childrenMutationScene = createChildrenMutationScene(1_000);
  const particleScene = createParticleScene();

  spriteScene.app.render();
  spriteStateScene.app.render();
  nestedSpriteScene.app.render();
  ninePatchScene.app.render();
  maskScene.app.render();
  filterScene.app.render();
  updateScene.app.update();
  hitTestScene.app.root.findTopmostHit(501, 21);
  nestedHitTestScene.app.root.findTopmostHit(251, 1);
  childrenMutationScene.parent.removeChild(childrenMutationScene.child);
  childrenMutationScene.parent.addChild(childrenMutationScene.child);
  particleScene.app.render();

  bench('render 1,000 sprites with no-op renderer', () => {
    spriteScene.app.render();
  });

  bench('render 1,000 sprites with state composition', () => {
    spriteStateScene.app.render();
  });

  bench('render 250 nested sprites', () => {
    nestedSpriteScene.app.render();
  });

  bench('render 100 nine-patches', () => {
    ninePatchScene.app.render();
  });

  bench('render 100 masked sprites', () => {
    maskScene.app.render();
  });

  bench('render 100 filtered sprites', () => {
    filterScene.app.render();
  });

  bench('update 1,000 display objects', () => {
    updateScene.app.update();
  });

  bench('hit test 1,000 interactive sprites', () => {
    hitTestScene.app.root.findTopmostHit(501, 21);
  });

  bench('hit test 250 nested objects', () => {
    nestedHitTestScene.app.root.findTopmostHit(251, 1);
  });

  bench('remove/add child among 1,000 siblings', () => {
    childrenMutationScene.parent.removeChild(childrenMutationScene.child);
    childrenMutationScene.parent.addChild(childrenMutationScene.child);
  });

  bench('update particle emitter', () => {
    particleScene.emitter.update();
  });

  bench('render particle emitter', () => {
    particleScene.app.render();
  });
});

interface SpriteSceneOptions {
  interactive?: boolean;
  colorTone?: boolean;
}

function createSpriteScene(count: number, options: SpriteSceneOptions = {}) {
  const app = createBenchApp();
  const image = createImage('sprite', 16, 16);

  for (let index = 0; index < count; index += 1) {
    app.root.addChild(
      new Sprite({
        context: app.context,
        image,
        x: index % 64,
        y: Math.floor(index / 64),
        rotation: (index % 16) * 0.01,
        opacity: 0.9,
        interactive: options.interactive,
        colorTone: options.colorTone ? { r: index % 255, g: 32, b: 64, a: 0.4 } : null,
        blendMode: options.colorTone && index % 2 === 0 ? 'add' : 'normal',
      }),
    );
  }

  return { app };
}

function createNestedSpriteScene(depth: number) {
  const app = createBenchApp();
  const image = createImage('sprite', 16, 16);
  let parent = app.root;

  for (let index = 0; index < depth; index += 1) {
    const sprite = new Sprite({
      context: app.context,
      image,
      x: 1,
      y: 1,
      rotation: 0.01,
      opacity: 0.99,
    });
    parent.addChild(sprite);
    parent = sprite;
  }

  return { app };
}

function createNinePatchScene(count: number) {
  const app = createBenchApp();
  const image = createImage('nine-patch', 32, 32);

  for (let index = 0; index < count; index += 1) {
    app.root.addChild(
      new NinePatch({
        context: app.context,
        image,
        slice: { left: 8, top: 8, right: 8, bottom: 8 },
        width: 96 + (index % 4) * 8,
        height: 48 + (index % 3) * 8,
        x: (index % 10) * 12,
        y: Math.floor(index / 10) * 8,
      }),
    );
  }

  return { app };
}

function createMaskedSpriteScene(count: number) {
  const app = createBenchApp();
  const image = createImage('sprite', 16, 16);
  const maskImage = createImage('mask', 16, 16);

  for (let index = 0; index < count; index += 1) {
    const mask = new Sprite({
      context: app.context,
      image: maskImage,
      x: 2,
      y: 2,
    });
    app.root.addChild(
      new Sprite({
        context: app.context,
        image,
        mask,
        x: (index % 10) * 16,
        y: Math.floor(index / 10) * 16,
      }),
    );
  }

  return { app };
}

function createFilteredSpriteScene(count: number) {
  const app = createBenchApp();
  const image = createImage('sprite', 16, 16);
  const filter = createNoopFilter();

  for (let index = 0; index < count; index += 1) {
    app.root.addChild(
      new Sprite({
        context: app.context,
        image,
        filters: [filter],
        x: (index % 10) * 16,
        y: Math.floor(index / 10) * 16,
      }),
    );
  }

  return { app };
}

function createDisplayTree(count: number) {
  const app = createBenchApp();

  for (let index = 0; index < count; index += 1) {
    const object = new DisplayObject({
      context: app.context,
      x: index % 32,
      y: Math.floor(index / 32),
    });
    object.onUpdate.on(() => {
      object.x += 1;
      object.x -= 1;
    });
    app.root.addChild(object);
  }

  return { app };
}

function createNestedHitTestScene(depth: number) {
  const app = createBenchApp();
  const image = createImage('target', 16, 16);
  let parent = app.root;

  for (let index = 0; index < depth; index += 1) {
    const container = new DisplayObject({
      context: app.context,
      x: 1,
      y: 0,
    });
    parent.addChild(container);
    parent = container;
  }

  parent.addChild(
    new Sprite({
      context: app.context,
      image,
      interactive: true,
    }),
  );

  return { app };
}

function createChildrenMutationScene(count: number) {
  const app = createBenchApp();
  const parent = new DisplayObject({ context: app.context });
  app.root.addChild(parent);
  let child = new DisplayObject({ context: app.context });

  for (let index = 0; index < count; index += 1) {
    const nextChild = new DisplayObject({ context: app.context });
    parent.addChild(nextChild);
    if (index === Math.floor(count / 2)) {
      child = nextChild;
    }
  }

  return { app, parent, child };
}

function createParticleScene() {
  const app = createBenchApp();
  const emitter = new ParticleEmitter({
    context: app.context,
    config: particleConfig,
    image: createImage('particle', 8, 8),
  });
  app.root.addChild(emitter);
  emitter.play();

  for (let index = 0; index < 60; index += 1) {
    emitter.update();
  }

  return { app, emitter };
}

function createNoopFilter() {
  return {
    id: 'noop',
    definition: { language: 'noop', fragment: '' },
    enabled: true,
    setUniform() {},
    dispose() {},
  };
}

function createBenchApp() {
  return new App({
    platform: createNoopPlatform(),
    width: 800,
    height: 600,
    fps: 60,
  });
}

const particleConfig: ParticleEmitterConfig = {
  duration: -1,
  spawn: { type: 'point', x: 0, y: 0 },
  emissionRate: 300,
  burstCount: 1,
  lifetime: 2,
  speed: 120,
  speedOverLife: {
    keys: [
      { t: 0, v: 1 },
      { t: 1, v: 0.25 },
    ],
  },
  direction: 45,
  angularVelocity: 180,
  scale: 1,
  alpha: 1,
  alphaOverLife: {
    keys: [
      { t: 0, v: 1 },
      { t: 1, v: 0 },
    ],
  },
  blendMode: 'normal',
  forces: [{ type: 'gravity', x: 0, y: 80 }],
};

function createNoopPlatform(): Platform {
  const renderer = createNoopRenderer();
  const audio = createNoopAudio();
  const input = createNoopInput();

  return {
    renderer,
    audio,
    input,
    filterCapabilities: null,
    dispose() {},
    startLoop() {},
    stopLoop() {},
    resize() {},
    async loadAsset<TSpec extends AssetSpec>(spec: TSpec): Promise<ResolvedAsset<TSpec>> {
      switch (spec.type) {
        case 'image':
          return createImage(spec.src) as ResolvedAsset<TSpec>;
        case 'audio':
          return { id: spec.src, type: 'audio', duration: 1, source: null } as ResolvedAsset<TSpec>;
        case 'text':
          return { id: spec.src, type: 'text', content: '' } as ResolvedAsset<TSpec>;
        case 'binary':
          return { id: spec.src, type: 'binary', content: new ArrayBuffer(0) } as ResolvedAsset<TSpec>;
      }
    },
    unloadAsset(_asset: Asset) {},
    mediaQuery() {
      return 'unknown';
    },
    createTexture(width: number, height: number) {
      return createTexture(width, height);
    },
    async createFilter() {
      throw new Error('Filters are not supported by the benchmark platform');
    },
    getFeature() {
      return undefined;
    },
    setCursor() {},
  };
}

function createNoopRenderer(): Renderer {
  let drawCount = 0;

  return {
    beginFrame() {
      drawCount = 0;
    },
    endFrame() {
      if (drawCount < 0) {
        throw new Error('unreachable');
      }
    },
    clear() {},
    drawSprite(_image: RenderableImage, state: RenderState) {
      drawCount += 1;
      if (state.alpha < 0) {
        throw new Error('unreachable');
      }
    },
    pushFilters() {
      return true;
    },
    popFilters() {},
    pushMask() {},
    activateMask() {},
    popMask() {},
    resize() {},
  };
}

function createNoopAudio(): AudioBackend {
  return {
    play(_audioAsset: AudioAsset) {
      return { id: 0, source: null };
    },
    updatePlayback() {},
    stop() {},
    setMasterVolume() {},
    setMuted() {},
    async resume() {},
    dispose() {},
  };
}

function createNoopInput(): InputBackend {
  return {
    pollSnapshot() {
      return {
        pointers: [],
        keyboard: { pressedKeys: [] },
        gamepads: [],
      };
    },
    dispose() {},
  };
}

function createImage(id: string, width = 16, height = 16): ImageAsset {
  return {
    id,
    type: 'image',
    width,
    height,
    source: null,
  };
}

function createTexture(width: number, height: number): Texture {
  return {
    width,
    height,
    source: null,
    isShared: false,
    dispose() {},
    drawLine() {},
    drawRect() {},
    drawText() {},
    measureText() {
      return { width: 0, height: 0 };
    },
    drawImage() {},
    clear() {},
  };
}
