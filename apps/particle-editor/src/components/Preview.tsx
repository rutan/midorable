import {
  App,
  imageAsset,
  type ImageAsset,
  ParticleEmitter,
  ParticleEmitterConfig,
  Rectangle,
  RenderableImage,
} from '@rutan/midorable';
import { createWebGlPlatform } from '@rutan/midorable-platform-browser';
import { Suspense, useEffect, useRef, useState } from 'react';
import { useImage, useParticleEmitterConfig, usePreviewSettings } from '../hooks';
import { cx } from '../utils';

export const Preview = () => {
  return (
    <div className={cx('Preview', 'w-full h-full bg-gray-700')}>
      <Suspense fallback={<p>Loading...</p>}>
        <MidorableApp />
      </Suspense>
    </div>
  );
};

const MidorableApp = () => {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<App | null>(null);
  const { config } = useParticleEmitterConfig();
  const { imageUrl, imageFrames } = useImage();
  const { previewSettings } = usePreviewSettings();
  const [image, setImage] = useState<RenderableImage | null>(null);
  const [appReady, setAppReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let disposeFunctions: (() => void)[] = [];

    (async () => {
      if (!wrapperRef.current) return;

      const platform = await createWebGlPlatform({
        element: wrapperRef.current,
      });

      if (cancelled) {
        platform.dispose?.();
        return;
      }

      const app = new App({
        platform,
        width: previewSettings.width,
        height: previewSettings.height,
        fps: previewSettings.fps,
        backgroundColor: previewSettings.backgroundColor,
      });

      appRef.current = app;
      setAppReady(true);
      app.start();

      disposeFunctions.push(() => {
        app.stop();
        platform.dispose?.();
        appRef.current = null;
        setAppReady(false);
      });
    })();

    return () => {
      cancelled = true;
      disposeFunctions.forEach((dispose) => dispose());
      disposeFunctions = [];
    };
  }, [previewSettings]);

  useEffect(() => {
    if (!appReady || !appRef.current) return;

    if (!imageUrl) {
      setImage(null);
      return;
    }

    const app = appRef.current;
    let disposeFunction: (() => void) | null = null;
    (async () => {
      const image = (await app.context.loader.load(imageAsset(imageUrl))) as ImageAsset;
      setImage(image);

      disposeFunction = () => {
        app.context.loader.unload(image);
      };
    })();

    return () => {
      disposeFunction?.();
    };
  }, [appReady, imageUrl]);

  useEffect(() => {
    if (!appReady || !appRef.current || !config) return;

    const app = appRef.current;
    return displayParticle({
      app,
      config,
      image: image ?? undefined,
      frames: imageFrames.length > 0 ? imageFrames : undefined,
    });
  }, [appReady, config, image, imageFrames]);

  return <div className={cx('MidorableApp', 'w-full h-full')} ref={wrapperRef} />;
};

function displayParticle({
  app,
  config,
  image: inputImage,
  frames,
}: {
  app: App;
  config: ParticleEmitterConfig;
  image?: RenderableImage;
  frames?: Rectangle[];
}) {
  let image: RenderableImage;
  let ownsImage = false;
  let timer = 0;

  if (inputImage) {
    image = inputImage;
  } else {
    const texture = app.createTexture(10, 10);
    texture.drawRect({
      x: 0,
      y: 0,
      width: 10,
      height: 10,
      color: { r: 255, g: 255, b: 255, a: 1 },
    });
    image = texture;
    ownsImage = true;
  }
  const particleEmitter = new ParticleEmitter({
    context: app.context,
    config,
    image,
    frames,
    x: app.width * 0.5,
    y: app.height * 0.5,
  });
  particleEmitter.onFinished.on(() => {
    timer = window.setTimeout(() => {
      particleEmitter.play();
    }, 1000);
  });
  app.root.addChild(particleEmitter);
  particleEmitter.play();

  return () => {
    clearTimeout(timer);
    particleEmitter.dispose();
    if (ownsImage && 'dispose' in image) {
      image.dispose();
    }
  };
}
