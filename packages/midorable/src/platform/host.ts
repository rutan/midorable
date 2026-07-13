import { CursorName } from './types';

/**
 * 各プラットフォームのホスト機能のインタフェース
 */
export interface HostBackend {
  /**
   * ループ処理を開始する
   *
   * @remarks
   * Platform は `stopLoop()` が呼ばれるまで、登録された `callback` を繰り返し呼び出す。
   * `callback` の `now` には単調増加する時刻をミリ秒で渡すことを想定している。
   * `startLoop()` が複数回呼ばれた場合は、既存のループを重複起動しないことが望ましい。
   *
   * @param callback - 現在の時刻を引数に取るループ処理のコールバック関数
   */
  startLoop(callback: (now: number) => void): void;

  /**
   * ループ処理を停止する
   *
   * @remarks
   * 以降 `startLoop()` で登録された callback が呼ばれないようにする。
   * すでに停止済みの場合は no-op として扱うことが望ましい。
   */
  stopLoop(): void;

  /**
   * 画面の論理サイズを変更する
   *
   * @remarks
   * このサイズとは実際の画面のピクセル数とは限らず、ゲーム内で使用する座標系の幅と高さを指す。
   * プラットフォーム側はこのサイズをもとに適切なスケーリングやセンタリング等の処理を行い、ゲームが指定された論理サイズで描画されるようにする必要がある。
   *
   * @param width - ゲームの論理的な幅
   * @param height - ゲームの論理的な高さ
   */
  resize(width: number, height: number): void;

  /**
   * システムカーソルを変更する
   * @param cursor - カーソルの種類
   */
  setCursor(cursor: CursorName): void;
}
