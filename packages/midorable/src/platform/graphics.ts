import { FilterInstance, Renderer, ShaderFilterDefinition, Texture } from './renderer';

export interface GraphicsBackend {
  readonly renderer: Renderer;

  /**
   * シェーダーフィルター機能のサポート状況と能力。
   */
  readonly filterCapabilities?: RenderFilterCapabilities | null;

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
   * そのためゲーム側は事前に filterCapabilities を確認し、対応したシェーダー言語を使用してフィルターを作成する必要がある。
   *
   * @param definition - シェーダーフィルターの定義
   * @returns 作成されたフィルターインスタンスを返すPromise。定義の内容がプラットフォームでサポートされない場合や、作成に失敗した場合はPromiseがrejectされる。
   */
  createFilter?(definition: ShaderFilterDefinition): Promise<FilterInstance>;
}

export interface RenderFilterCapabilities {
  /**
   * Platform が受け付けるシェーダー言語識別子一覧。
   */
  shaderLanguages: readonly ShaderFilterDefinition['language'][];
}
