/**
 * イベントリスナーの管理とイベントの発火を行うオブジェクトを作成するユーティリティ関数
 * @returns イベントリスナーの管理とイベント発火を行うオブジェクト
 *
 * @example
 * ```ts
 * const { listeners, emit } = createEventHandlers<string>();
 *
 * // イベントリスナーを登録
 * listeners.on((event) => console.log(event));
 *
 * // イベントを発火
 * emit('Hello, world!');
 * ```
 */
export function createEventHandlers<T>() {
  type Listener = (event: T) => void;
  const listeners: Listener[] = [];

  return {
    listeners: {
      /**
       * イベントリスナーを登録する
       * @param listener - イベントリスナー関数
       */
      on(listener: Listener) {
        listeners.push(listener);
      },
      /**
       * イベントリスナーを解除する
       * @param listener - イベントリスナー関数
       */
      off(listener: Listener) {
        const index = listeners.indexOf(listener);
        if (index !== -1) {
          listeners.splice(index, 1);
        }
      },
      /**
       * すべてのイベントリスナーを解除する
       */
      offAll() {
        listeners.length = 0;
      },
    },
    /**
     * イベントを発火する
     * @param event - 発火するイベントのデータ
     */
    emit(event: T) {
      const snapshot = listeners.slice();
      for (const listener of snapshot) {
        listener(event);
      }
    },
  };
}

export type EventHandlers<T> = ReturnType<typeof createEventHandlers<T>>;
