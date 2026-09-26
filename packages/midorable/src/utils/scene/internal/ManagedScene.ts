import type { DisplayObject, Loader } from '../../../engine';
import type { SceneView } from '../definition';
import type { SceneChangeEvent, SceneRouteMap } from '../types';

export interface ManagedScene<TRoutes extends SceneRouteMap> {
  key: keyof TRoutes;
  params: TRoutes[keyof TRoutes] | undefined;
  meta: Record<string, unknown>;
  view: DisplayObject;
  dispose(): Promise<readonly unknown[]>;
}

/** 1シーン分のリソースを所有し、破棄を一度だけ実行する。 */
export function createManagedScene<TRoutes extends SceneRouteMap>(
  route: SceneChangeEvent<TRoutes>,
  scene: SceneView,
  loader: Loader,
): ManagedScene<TRoutes> {
  const view = scene.view;
  const disposeScene = scene.dispose?.bind(scene);
  let disposePromise: Promise<readonly unknown[]> | null = null;

  return {
    key: route.sceneKey,
    params: route.params,
    meta: route.meta,
    view,
    dispose() {
      disposePromise ??= Promise.resolve().then(async () => {
        const errors: unknown[] = [];
        for (const dispose of [() => disposeScene?.(), () => view.dispose(), () => loader.dispose()]) {
          try {
            await dispose();
          } catch (error) {
            errors.push(error);
          }
        }
        return errors;
      });
      return disposePromise;
    },
  };
}
