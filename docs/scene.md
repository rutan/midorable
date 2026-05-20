# シーン管理

`@rutan/midorable` のCoreにはシーン管理機能は含まれていません。代わりに、CoreのAPIを利用したシーン管理ユーティリティを `@rutan/midorable/utils/scene` として提供しています。

利用は任意です。ゲーム側で独自にシーン管理を実装しても構いません。

## `@rutan/midorable/utils/scene`

このモジュールは、主に以下の機能を提供します。

- シーンキーごとのパラメータ型定義
- シーン遷移前のアセットプリロード
- `goTo()` によるシーン置き換え
- `pushScene()` / `popScene()` によるスタック型のシーン遷移
- ローディング状態とシーン変更イベントの通知

## 基本的な使い方

まず、ゲームで使用するシーンと、それぞれのシーンに渡すパラメータを定義します。パラメータが不要なシーンは `undefined` または `void` を指定します。

```ts
import { DisplayObject, Sprite, imageAsset, type DisplayObjectProps } from '@rutan/midorable';
import { createSceneRouter, type AssetsOf, type SceneNavigator } from '@rutan/midorable/utils/scene';

type SceneMap = {
  title: undefined;
  stage: { stageId: string };
  result: { score: number };
};

const sceneRouter = createSceneRouter<SceneMap>();
```

シーンごとのアセットは `defineAssets()` で定義します。関数には遷移先の `sceneKey`、`params`、シーン専用の `context` が渡されます。

```ts
const stageAssets = sceneRouter.defineAssets('stage', ({ params }) => {
  return {
    background: imageAsset(`assets/stages/${params.stageId}/background.png`),
    player: imageAsset('assets/player.png'),
  } as const;
});

type StageAssets = AssetsOf<typeof stageAssets>;
```

シーン本体は `defineScene()` で定義します。`create()` では `DisplayObject` を直接返すか、追加の破棄処理が必要な場合は `{ view, dispose }` を返します。

```ts
const TitleSceneDef = sceneRouter.defineScene('title', {
  create({ context, navigator }) {
    return new TitleSceneView({ context, navigator });
  },
});

const StageSceneDef = sceneRouter.defineScene('stage', {
  meta: {
    showPauseButton: true,
  },
  getAssets: stageAssets,
  create({ context, params, assets, navigator }) {
    const view = new StageSceneView({ context, params, assets, navigator });

    return {
      view,
      dispose() {
        view.stopStageTimer();
      },
    };
  },
});

const ResultSceneDef = sceneRouter.defineScene('result', {
  create({ context, params }) {
    return new ResultSceneView({ context, score: params.score });
  },
});
```

`create()` に渡される `context` は、そのシーン専用のloaderを持ちます。`getAssets` で定義したアセットは遷移前にロードされ、`create()` の `assets` から型付きで参照できます。

```ts
interface StageSceneViewProps extends DisplayObjectProps {
  params: SceneMap['stage'];
  assets: StageAssets;
  navigator: SceneNavigator<SceneMap>;
}

class StageSceneView extends DisplayObject {
  private _navigator: SceneNavigator<SceneMap>;

  constructor(props: StageSceneViewProps) {
    super(props);
    this._navigator = props.navigator;

    const background = new Sprite({
      context: this.context,
      image: props.assets.background,
    });
    this.addChild(background);
  }

  finish(score: number) {
    void this._navigator.goTo('result', { score });
  }

  stopStageTimer() {
    // シーン固有のタイマーや購読をここで停止する
  }
}
```

最後に `setup()` でルート表示オブジェクト、アプリケーションの `context`、シーン定義を登録してから遷移します。

```ts
sceneRouter.setup({
  root: app.root,
  context: app.context,
  routes: {
    title: TitleSceneDef,
    stage: StageSceneDef,
    result: ResultSceneDef,
  },
});

await sceneRouter.goTo('title');
```

`setup()` は1回だけ呼び出せます。`setup()` 前でもイベント購読はできますが、`goTo()` や `currentView` などランタイムへアクセスするAPIは例外を投げます。

## シーン遷移

`SceneRouter` と、各シーンの `create()` に渡される `navigator` は同じ遷移メソッドを持ちます。

- `goTo(sceneKey, params)` は、現在のシーンと退避中のシーンスタックを破棄して指定シーンへ遷移します。
- `pushScene(sceneKey, params)` は、現在のシーンを破棄せずにスタックへ退避してから指定シーンへ遷移します。
- `popScene()` は、現在のシーンを破棄して、`pushScene()` で退避していた直前のシーンへ戻ります。スタックが空の場合は何もしません。

遷移要求は内部で直列化されるため、連続して呼び出された場合も順番に処理されます。アセット読み込みやシーン生成に失敗した場合、現在のシーン表示は維持されます。

## アセットのプリロード

`getAssets` を持つシーンでは、遷移前にアセットが自動でロードされます。ロード済みアセットは `create()` の `assets` に渡されます。

```ts
const assets = sceneRouter.defineAssets(
  'stage',
  ({ params }) =>
    ({
      background: imageAsset(`assets/${params.stageId}.png`),
    }) as const,
);

const StageSceneDef = sceneRouter.defineScene('stage', {
  getAssets: assets,
  create({ context, assets }) {
    return new Sprite({
      context,
      image: assets.background,
    });
  },
});
```

シーンごとに専用loaderが作成され、シーン破棄時にそのloaderも破棄されます。シーン専用loaderの `get()` は、専用loaderに存在しないキーを親の `app.context.loader` からも探します。

## ローディング状態

`onLoadingStateChanged` で、シーン遷移中のローディング状態を監視できます。

```ts
sceneRouter.onLoadingStateChanged.on((state) => {
  if (state.status === 'loading') {
    const progress = state.assetLoading?.progress;
    console.log(progress);
    return;
  }

  if (state.status === 'failed') {
    console.error(state.error);
    void state.retry();
    return;
  }

  // state.status === 'hidden'
});
```

状態は以下のいずれかです。

- `hidden`: ローディング表示が不要な状態
- `loading`: 遷移先シーンの準備中
- `failed`: アセット読み込みに失敗した状態

`loading` / `failed` では `sceneKey` と `params` が参照できます。アセット読み込みの進行状況がある場合は `assetLoading.progress` に `total`、`completed`、`failed`、`pending` が入ります。

`failed` の `retry()` を呼ぶと、失敗した遷移を同じ引数で再試行します。`pushScene()` の失敗からretryした場合も、再試行は `pushScene()` として扱われます。

## シーン変更イベント

`onSceneChanged` はシーン遷移が完了した後に通知されます。

```ts
sceneRouter.onSceneChanged.on(({ sceneKey, params, meta }) => {
  console.log('Scene changed:', sceneKey, params);
  backButton.visible = meta.showBackButton !== false;
});
```

`meta` には、シーン定義の `meta` に指定した値が渡されます。UIの表示切り替えなど、シーンに付随する補助情報を渡す用途に使えます。

## 現在のシーン情報

`SceneRouter` から現在の表示オブジェクトとルート情報を参照できます。

```ts
const view = sceneRouter.currentView;
const route = sceneRouter.currentRoute;
```

`currentRoute` は、まだシーンが表示されていない場合は `null` です。表示中の場合は `{ sceneKey, params, meta }` を返します。
