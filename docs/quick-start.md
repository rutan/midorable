# クイックスタート

## インストール

```bash
npm install @rutan/midorable @rutan/midorable-platform-browser
```

実際の開発においては[Vite](https://vite.dev/)などのバンドラーを利用することを前提としています。

## 最小限のゲーム

```typescript
import { App, Sprite, imageAsset } from '@rutan/midorable';
import { createWebGlPlatform } from '@rutan/midorable-platform-browser';

const platform = await createWebGlPlatform({
  element: document.getElementById('root')!,
});

const app = new App({
  platform,
  width: 640,
  height: 480,
  fps: 60,
});

// 画像の読み込み
const cat = await app.context.loader.load(imageAsset('./assets/cat.png'));

// スプライトの作成
const sprite = new Sprite({
  context: app.context,
  image: cat,
});

// 毎フレームの更新処理
sprite.onUpdate.on(() => {
  sprite.x += 1;
});

// クリック時の処理
sprite.onClick.on(() => {
  console.log('Clicked!');
  sprite.x = 0;
});

// スプライトをルートコンテナに追加
app.root.addChild(sprite);

// ゲームの開始
app.start();
```
