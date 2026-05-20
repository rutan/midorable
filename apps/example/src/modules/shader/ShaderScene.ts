import { DisplayObject, type DisplayObjectProps, imageAsset, Sprite, Texture } from '@rutan/midorable';
import { FONT_NAME, sceneRouter, type AssetsOf } from '../_share';

const shaderSceneAssets = sceneRouter.defineAssets('shader', () => ({
  image: imageAsset('img/character.png'),
}));

type ShaderSceneAssets = AssetsOf<typeof shaderSceneAssets>;

export const ShaderSceneDef = sceneRouter.defineScene('shader', {
  getAssets: shaderSceneAssets,
  create({ context, assets }) {
    return new ShaderSceneView({ context, assets });
  },
});

export interface ShaderSceneViewProps extends DisplayObjectProps {
  assets: ShaderSceneAssets;
}

export class ShaderSceneView extends DisplayObject {
  constructor(props: ShaderSceneViewProps) {
    super(props);

    const { image } = props.assets;

    const sprite = new Sprite({
      context: this._context,
      image,
      x: this._context.app.width / 2,
      y: this._context.app.height / 2,
      anchorX: 0.5,
      anchorY: 0.5,
    });
    this.addChild(sprite);

    const texture = this._context.app.createTexture(this._context.app.width, 60);
    const statusSprite = new Sprite({
      context: this._context,
      image: texture,
      x: 0,
      y: this._context.app.height - texture.height,
    });
    this.addChild(statusSprite);

    const filterResult = this._generateFilter();
    if (!filterResult.result) {
      this._drawStatusText(texture, `[Error] ${filterResult.reason}`);
      return;
    }

    void this._applyFilter(sprite, texture, filterResult);
  }

  private async _applyFilter(
    sprite: Sprite,
    texture: Texture,
    filterResult: Extract<FilterGenerationResult, { result: true }>,
  ) {
    try {
      const filter = await this.context.app.createFilter({
        language: filterResult.language,
        fragment: filterResult.fragment,
        uniforms: {
          time: 0,
          amount: 0.9,
        },
      });
      sprite.filters = [filter];
      this._drawStatusText(texture, `Shader filter applied successfully (language: ${filterResult.language})`);

      let time = 0;
      this.onUpdate.on(() => {
        time += 1 / this._context.app.fps;
        filter.setUniform('time', time);
        sprite.rotation += 0.01;
      });
    } catch (e) {
      console.error(e);
      this._drawStatusText(
        texture,
        `[Error] Failed to create shader filter: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }

  private _generateFilter(): FilterGenerationResult {
    const filterCapabilities = this.context.app.filterCapabilities;
    if (!filterCapabilities) {
      return {
        result: false,
        reason: 'Shader filter unavailable (platform does not expose capabilities)',
      };
    }

    if (filterCapabilities.shaderLanguages.includes('glsl-es-300')) {
      return {
        result: true,
        language: 'glsl-es-300',
        fragment: SCANLINE_GLSL_ES_300,
      };
    }

    if (filterCapabilities.shaderLanguages.includes('wgsl')) {
      return {
        result: true,
        language: 'wgsl',
        fragment: SCANLINE_WGSL,
      };
    }

    return {
      result: false,
      reason: `Shader filter unavailable (unsupported shader languages: ${filterCapabilities.shaderLanguages.join(', ')})`,
    };
  }

  private _drawStatusText(texture: Texture, text: string) {
    texture.drawText({
      text,
      x: 10,
      y: 0,
      maxWidth: texture.width - 20,
      lineHeight: texture.height,
      font: {
        family: FONT_NAME,
        size: 24,
      },
      color: { r: 255, g: 255, b: 255, a: 255 },
      outlineColor: { r: 0, g: 0, b: 0, a: 255 },
      outlineWidth: 4,
    });
  }
}

type FilterGenerationResult = { result: true; language: string; fragment: string } | { result: false; reason: string };

const SCANLINE_GLSL_ES_300 = `
vec4 applyFilter(vec4 color, vec2 uv, vec4 uniforms[16]) {
  float time = uniforms[0].x;
  float amount = clamp(uniforms[1].x, 0.0, 1.0);
  float wave = sin(uv.y * 220.0 + time * 6.0) * 0.12 * amount;
  vec3 rgb = vec3(color.r + wave, color.g, color.b - wave);
  return vec4(clamp(rgb, vec3(0.0), vec3(1.0)), color.a);
}
`.trim();

const SCANLINE_WGSL = `
fn applyFilter(color: vec4<f32>, uv: vec2<f32>, uniforms: array<vec4<f32>, 16>) -> vec4<f32> {
  let time = uniforms[0].x;
  let amount = clamp(uniforms[1].x, 0.0, 1.0);
  let wave = sin(uv.y * 220.0 + time * 6.0) * 0.12 * amount;
  let rgb = vec3<f32>(color.r + wave, color.g, color.b - wave);
  return vec4<f32>(clamp(rgb, vec3<f32>(0.0), vec3<f32>(1.0)), color.a);
}
`.trim();
