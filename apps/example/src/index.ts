import {
  createWebGlPlatform,
  registerPromptInputFeature,
  registerStorageFeature,
} from '@rutan/midorable-platform-browser';
import { createCanvasPlatform } from '@rutan/midorable-platform-browser/canvas';
import { createWebGpuPlatform } from '@rutan/midorable-platform-browser/webgpu';
import { launch } from './launch';

async function createPlatform(platform: string, root: HTMLElement) {
  switch (platform) {
    case 'webgpu': {
      return createWebGpuPlatform({
        element: root,
      });
    }
    case 'canvas': {
      return createCanvasPlatform({
        element: root,
      });
    }
    case 'webgl':
    default: {
      return createWebGlPlatform({
        element: root,
      });
    }
  }
}

(async () => {
  const search = location.search.slice(1);
  const options = new URLSearchParams(search);
  const platform = options.get('platform') || 'webgl';

  // プラットフォーム選択
  const platformSelector = document.getElementById('platform-selector') as HTMLSelectElement;
  platformSelector.value = platform;
  platformSelector.addEventListener('change', () => {
    const selectedPlatform = platformSelector.value;
    const url = new URL(location.href);
    url.searchParams.set('platform', selectedPlatform);
    location.href = url.toString();
  });

  // フルスクリーンボタン設定
  const fsButton = document.getElementById('fullscreen-button') as HTMLButtonElement;
  fsButton.addEventListener('click', async () => {
    if (!document.fullscreenElement) {
      const gameContainer = document.getElementById('game-container');
      if (gameContainer) await gameContainer.requestFullscreen();
    } else {
      await document.exitFullscreen();
    }
  });

  // ゲーム開始
  const gameRoot = document.getElementById('root');
  if (!gameRoot) throw new Error('root element not found');
  const platformInstance = await createPlatform(platform, gameRoot);
  registerStorageFeature(platformInstance, {
    prefix: 'midorable-example::',
  });
  registerPromptInputFeature(platformInstance);
  await launch(platformInstance);
})().catch((error: unknown) => {
  console.error('Failed to launch example', error);
});
