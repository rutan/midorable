import { createSceneRouter, type AssetsOf } from '@rutan/midorable/utils/scene';

export type { AssetsOf };

// 標準的なデモの一覧
export const NORMAL_DEMO_SCENES = [
  'rectangle',
  'image',
  'nestObject',
  'color',
  'mask',
  'ninePatch',
  'pointer',
  'text',
  'audio',
  'loader',
  'particle',
  'shader',
  'feature',
  'preload',
] as const;

// 発展的なデモの一覧
export const ADVANCED_DEMO_SCENES = [] as const;

type DemoScene = (typeof NORMAL_DEMO_SCENES)[number] | (typeof ADVANCED_DEMO_SCENES)[number];

export type SceneMap = {
  menu: { startTime: number };
} & {
  [K in DemoScene]: void;
};

export type SceneName = keyof SceneMap;

export const sceneRouter = createSceneRouter<SceneMap>();

export interface SceneMeta {
  showBackButton?: boolean;
}
