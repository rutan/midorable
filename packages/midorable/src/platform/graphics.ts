import { FilterResource, Renderer, ShaderFilterDefinition, Texture } from './renderer';

export interface GraphicsBackend {
  readonly renderer: Renderer;

  /**
   * 画面描画機構のサポート状況と能力。
   */
  readonly capabilities: GraphicsCapabilities;

  /**
   * テクスチャを作成する
   * @param width - テクスチャの幅
   * @param height - テクスチャの高さ
   */
  createTexture(width: number, height: number): Texture;

  /**
   * シェーダーフィルターを作成する
   *
   * @remarks
   * 定義オブジェクトの内容や、サポートされるシェーダー言語の種類はプラットフォームによって異なる。
   * そのためゲーム側は事前に `capabilities.filters` を確認し、対応したシェーダー言語を使用してフィルターを作成する必要がある。
   *
   * @param definition - シェーダーフィルターの定義
   * @returns Platform固有のフィルターリソース。定義がサポートされない場合や作成に失敗した場合はrejectされる。
   */
  createFilterResource?(definition: ShaderFilterDefinition): Promise<FilterResource>;
}

export interface GraphicsCapabilities {
  /**
   * シェーダーフィルター機能のサポート状況と能力。
   * 未対応の場合は undefined。
   */
  readonly filters?: GraphicsFilterCapabilities;
  /** テクスチャ付き三角形メッシュのサポート状況。 */
  readonly mesh?: GraphicsMeshCapabilities;
}

export interface GraphicsFilterCapabilities {
  /**
   * Platform が受け付けるシェーダー言語識別子一覧。
   */
  readonly shaderLanguages: readonly ShaderFilterDefinition['language'][];
  /** フィルターが受け付ける vec4 ユニフォーム数の上限。 */
  readonly maxUniformVectors: number;
}

export interface GraphicsMeshCapabilities {
  readonly maxVertices?: number;
  readonly maxIndices?: number;
}
