import { Rectangle } from '@rutan/midorable';

/**
 * 標準的なテクスチャパックのマニフェスト形式
 */
export interface TexturePackManifest {
  image: string;
  frames: Record<string, Rectangle>;
}

/**
 * 内部で扱うフレーム用の情報
 */
export interface TexturePackFrame {
  name: string;
  rect: Rectangle;
}
