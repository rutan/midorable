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

## 画像とテクスチャの破棄

Loader で読み込む画像は `ImageAsset` です。不要になった画像は `loader.unload(image)` で解放できます。
Loader 自体を破棄すると、その Loader に残っているアセットも解放されます。

`app.createTexture()` で作る編集可能な `Texture` は、作成者が寿命を管理します。
`Sprite`・`NinePatch`・`ParticleEmitter` に渡しても、テクスチャの所有権は移りません。
表示オブジェクトの破棄ではテクスチャは自動破棄されないため、すべての利用先で不要になった時点で `texture.dispose()` を呼び出してください。
同じテクスチャを複数の表示オブジェクトで共有する場合も、作成者がまとめて管理します。

```typescript
const texture = app.createTexture(32, 32);
texture.drawRect({ x: 0, y: 0, width: 32, height: 32, color: { r: 255, g: 255, b: 255, a: 1 } });
const sprite = new Sprite({ context: app.context, image: texture });
app.root.addChild(sprite);

// このテクスチャを使うすべての表示オブジェクトが不要になったら破棄する
sprite.dispose();
texture.dispose();
```
