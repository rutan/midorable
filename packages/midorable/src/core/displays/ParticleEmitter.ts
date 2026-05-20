import { createEventHandlers } from '../events';
import { multiplyTransform, clamp01, clamp255 } from '../internal';
import { RenderableImage, Renderer, RenderState } from '../renderer';
import { BlendMode, Color, Rectangle } from '../types';
import { DisplayObject, DisplayObjectProps } from './DisplayObject';

export type ScalarValue =
  | number
  | {
      min: number;
      max: number;
    };

export interface Curve {
  keys: CurveKey[];
}

export interface CurveKey {
  /** 時間（0..1） */
  t: number;
  /** 値 */
  v: number;
}

export interface ParticleColorConfig {
  start: Color;
  end: Color;
}

export interface ParticleEmitterConfig {
  /** エミッタの寿命（秒、0未満は無限） */
  duration: number;

  /** 発生パターン */
  spawn: ParticleSpawnConfig;

  /** 1秒あたりの発生数 */
  emissionRate: ScalarValue;

  /** 一度に発生する粒子の数 */
  burstCount?: ScalarValue;

  /** 粒子の寿命（秒） */
  lifetime: ScalarValue;

  /** 移動速度の基準値 */
  speed: ScalarValue;

  /** 移動速度の変化倍率 */
  speedOverLife?: Curve;

  /** 移動角度（度数法。0=右、90=下） */
  direction: ScalarValue;

  /** 粒子画像の向きを移動方向に合わせるか */
  alignToDirection?: boolean;

  /** 粒子画像の角速度（進行方向には影響しない） */
  angularVelocity?: ScalarValue;

  /** 粒子画像の角速度の変化倍率 */
  angularVelocityOverLife?: Curve;

  /** 拡大率の基準値 */
  scale: ScalarValue;

  /** 拡大率の変化倍率 */
  scaleOverLife?: Curve;

  /** 透明度の基準値 */
  alpha: ScalarValue;

  /** 透明度の変化倍率 */
  alphaOverLife?: Curve;

  /** 開始時と終了時のカラートーン */
  color?: ParticleColorConfig;

  /** ブレンドモード */
  blendMode: BlendMode;

  /** 力 */
  forces: ParticleForce[];
}

export type ParticleSpawnConfig = ParticlePointSpawnConfig | ParticleCircleSpawnConfig | ParticleRectangleSpawnConfig;

export interface ParticlePointSpawnConfig {
  type: 'point';
  /** 発生位置のX座標 */
  x: number;
  /** 発生位置のY座標 */
  y: number;
}

export interface ParticleCircleSpawnConfig {
  type: 'circle';
  /** 円の中心X座標 */
  x: number;
  /** 円の中心Y座標 */
  y: number;
  /** 円の半径 */
  radius: number;
  /** 円の端のみから生成するかどうか */
  edgeOnly?: boolean;
}

export interface ParticleRectangleSpawnConfig {
  type: 'rectangle';
  /** 矩形の左上X座標 */
  x: number;
  /** 矩形の左上Y座標 */
  y: number;
  /** 矩形の幅 */
  width: number;
  /** 矩形の高さ */
  height: number;
}

export type ParticleForce = ParticleGravityForce | ParticleAttractorForce;

export interface ParticleGravityForce {
  type: 'gravity';

  /** 重力のX成分 */
  x: number;

  /** 重力のY成分 */
  y: number;
}

export interface ParticleAttractorForce {
  type: 'attractor';

  /** 力の中心のX座標 */
  x: number;

  /** 力の中心のY座標 */
  y: number;

  /** 引力の強さ（正の値で引力、負の値で斥力） */
  strength: number;

  /** 粒子が消滅する距離 */
  killDistance?: number;
}

export interface ParticleEmitterProps extends DisplayObjectProps {
  /** エミッタの設定 */
  config: ParticleEmitterConfig;
  /** 使用する画像 */
  image: RenderableImage;
  /** 画像のフレーム情報。複数指定した場合はランダムに選択される */
  frames?: Rectangle[];
  /** 発生位置の基準点X座標（省略した場合は0） */
  baseX?: number;
  /** 発生位置の基準点Y座標（省略した場合は0） */
  baseY?: number;
}

export type ParticleEmitterEvents = ParticleEmitterFinishedEvent;

export interface ParticleEmitterFinishedEvent {
  type: 'finished';
}

/**
 * パーティクルエミッタの表示オブジェクト
 *
 * @remarks
 * シンプルなパーティクルシステムを提供する表示オブジェクト。
 * エミッタの設定に基づいて粒子を生成し、更新し、描画する。
 * 粒子の発生位置は、エミッタの位置（baseX, baseY）を基準に、spawnの設定に従って決定される。
 *
 * エミッタの設定値は particle-editor などの外部ツールで生成することを想定している。
 *
 * @example
 * ```ts
 * const emitter = new ParticleEmitter({
 *   context,
 *   config: { ... },
 *   image: myParticleImage,
 * });
 * app.root.addChild(emitter);
 * emitter.play();
 * ```
 */
export class ParticleEmitter extends DisplayObject {
  private _emitter = createEventHandlers<ParticleEmitterEvents>();
  private _config: ParticleEmitterConfig;
  private _image: RenderableImage;
  private _frames?: Rectangle[];
  private _baseX = 0;
  private _baseY = 0;
  private _particles: Particle[] = [];
  private _isPlaying = false;
  private _elapsed = 0;
  private _spawnCarry = 0;
  private _finishedEmitted = false;

  constructor(props: ParticleEmitterProps) {
    super(props);
    this._config = props.config;
    this._image = props.image;
    this._frames = props.frames;
    this._baseX = props.baseX ?? 0;
    this._baseY = props.baseY ?? 0;
  }

  /**
   * 発生位置の基準点X座標
   */
  get baseX() {
    return this._baseX;
  }

  set baseX(value: number) {
    this._baseX = value;
  }

  /**
   * 発生位置の基準点Y座標
   */
  get baseY() {
    return this._baseY;
  }

  set baseY(value: number) {
    this._baseY = value;
  }

  /**
   * 発火終了時のイベントハンドラ
   */
  get onFinished() {
    return this._emitter.listeners;
  }

  /**
   * 表示オブジェクトを破棄する
   *
   * @remarks
   * 内部で使用しているテクスチャが共有テクスチャでない場合は自動で破棄する。
   */
  dispose() {
    if ('dispose' in this._image && !this._image.isShared) {
      this._image.dispose();
    }
    this._emitter.listeners.offAll();
    this._particles.length = 0;
    super.dispose();
  }

  /**
   * エミッタを再生する
   *
   * @remarks
   * 再生中に再度呼び出した場合は、エミッタの状態がリセットされて最初から再生される。
   */
  play() {
    if (this._isPlaying) this.stop();
    this._isPlaying = true;
  }

  /**
   * エミッタが再生中かどうかを取得する
   */
  isPlaying() {
    return this._isPlaying;
  }

  /**
   * エミッタを停止する
   */
  stop() {
    this._isPlaying = false;
    this._elapsed = 0;
    this._spawnCarry = 0;
    this._finishedEmitted = false;
    this._particles.length = 0;
  }

  /**
   * エミッタの更新
   */
  update() {
    const fps = this.context.app?.fps ?? 60;
    const dt = fps > 0 ? 1 / fps : 1 / 60;

    if (this._isPlaying) {
      const duration = this._config.duration;
      const emissionActive = duration < 0 || this._elapsed < duration;
      if (emissionActive) {
        const emissionRate = Math.max(0, sampleScalar(this._config.emissionRate));
        this._spawnCarry += emissionRate * dt;
        while (this._spawnCarry >= 1) {
          this._spawnCarry -= 1;
          this._spawnParticles();
        }
      }
      this._elapsed += dt;
    }

    for (let i = this._particles.length - 1; i >= 0; i -= 1) {
      const particle = this._particles[i];
      particle.age += dt;
      if (particle.age >= particle.lifetime) {
        this._particles.splice(i, 1);
        continue;
      }
      if (this._shouldKillByAttractor(particle)) {
        this._particles.splice(i, 1);
        continue;
      }
      const force = this._computeForce(particle);
      particle.vx += force.x * dt;
      particle.vy += force.y * dt;

      const lifeT = particle.age / particle.lifetime;
      const speedScale = this._config.speedOverLife ? evaluateCurve(this._config.speedOverLife, lifeT) : 1;
      particle.x += particle.vx * dt * speedScale;
      particle.y += particle.vy * dt * speedScale;

      const velocitySq = particle.vx * particle.vx + particle.vy * particle.vy;
      if (velocitySq > 1e-8) {
        particle.direction = Math.atan2(particle.vy, particle.vx);
      }
      const angularVelocityScale = this._config.angularVelocityOverLife
        ? evaluateCurve(this._config.angularVelocityOverLife, lifeT)
        : 1;
      particle.rotation += particle.angularVelocity * dt * angularVelocityScale;
    }

    if (this._isPlaying && this._hasCompleted()) {
      this._isPlaying = false;
      if (!this._finishedEmitted) {
        this._finishedEmitted = true;
        this._emitter.emit({ type: 'finished' });
      }
    }

    super.update();
  }

  protected renderSelf(renderer: Renderer, state: RenderState): void {
    for (const particle of this._particles) {
      const lifeT = particle.age / particle.lifetime;
      const scale =
        particle.scale * (this._config.scaleOverLife ? evaluateCurve(this._config.scaleOverLife, lifeT) : 1);
      const alpha =
        particle.alpha *
        (this._config.alphaOverLife ? evaluateCurve(this._config.alphaOverLife, lifeT) : 1) *
        state.alpha;
      if (alpha <= 0 || scale <= 0) {
        continue;
      }
      const particleTone = sampleParticleColorTone(this._config.color, lifeT);
      const rotation = particle.rotation + (this._config.alignToDirection ? particle.direction : 0);
      const cos = Math.cos(rotation);
      const sin = Math.sin(rotation);
      const width = particle.frame ? particle.frame.width : this._image.width;
      const height = particle.frame ? particle.frame.height : this._image.height;
      const halfWidth = width / 2;
      const halfHeight = height / 2;
      const a = cos * scale;
      const b = sin * scale;
      const c = -sin * scale;
      const d = cos * scale;
      const local = {
        a,
        b,
        c,
        d,
        tx: particle.x - (halfWidth * a + halfHeight * c),
        ty: particle.y - (halfWidth * b + halfHeight * d),
      };
      renderer.drawSprite(
        this._image,
        {
          transform: multiplyTransform(state.transform, local),
          alpha: clamp01(alpha),
          blendMode: this._config.blendMode,
          colorTone: composeColorTone(state.colorTone, particleTone),
          smooth: state.smooth,
        },
        particle.frame,
      );
    }
  }

  private _hasCompleted() {
    const duration = this._config.duration;
    const emissionEnded = duration >= 0 && this._elapsed >= duration;
    return emissionEnded && this._particles.length === 0;
  }

  private _spawnParticles() {
    const burst = this._config.burstCount ?? 1;
    const spawnCount = Math.max(1, Math.round(sampleScalar(burst)));
    for (let i = 0; i < spawnCount; i += 1) {
      const spawn = sampleSpawnPosition(this._config.spawn);
      const speed = sampleScalar(this._config.speed);
      const direction = (sampleScalar(this._config.direction) * Math.PI) / 180;
      const lifetime = Math.max(0.001, sampleScalar(this._config.lifetime));
      const frame = chooseFrame(this._frames);
      const angularVelocity =
        ((this._config.angularVelocity ? sampleScalar(this._config.angularVelocity) : 0) * Math.PI) / 180;
      this._particles.push({
        x: this.baseX + spawn.x,
        y: this.baseY + spawn.y,
        vx: Math.cos(direction) * speed,
        vy: Math.sin(direction) * speed,
        direction,
        rotation: 0,
        angularVelocity,
        age: 0,
        lifetime,
        scale: sampleScalar(this._config.scale),
        alpha: sampleScalar(this._config.alpha),
        frame,
      });
    }
  }

  private _shouldKillByAttractor(particle: Particle) {
    for (const force of this._config.forces) {
      if (force.type !== 'attractor' || force.killDistance == null || force.killDistance <= 0) {
        continue;
      }
      const dx = force.x - particle.x;
      const dy = force.y - particle.y;
      if (dx * dx + dy * dy <= force.killDistance * force.killDistance) {
        return true;
      }
    }
    return false;
  }

  private _computeForce(particle: Particle) {
    let x = 0;
    let y = 0;
    for (const force of this._config.forces) {
      if (force.type === 'gravity') {
        x += force.x;
        y += force.y;
        continue;
      }
      const dx = force.x - particle.x;
      const dy = force.y - particle.y;
      const distSq = dx * dx + dy * dy;
      if (distSq <= 1e-6) {
        continue;
      }
      const dist = Math.sqrt(distSq);
      const normalizedX = dx / dist;
      const normalizedY = dy / dist;
      x += normalizedX * force.strength;
      y += normalizedY * force.strength;
    }
    return { x, y };
  }

  hitTestPoint(_x: number, _y: number) {
    // パーティクルは当たり判定を持たないため、常にfalseを返す
    return false;
  }

  findTopmostHit(_x: number, _y: number) {
    // パーティクルは当たり判定を持たないため、常にnullを返す
    return null;
  }
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  direction: number;
  rotation: number;
  angularVelocity: number;
  age: number;
  lifetime: number;
  scale: number;
  alpha: number;
  frame?: Rectangle;
}

function sampleScalar(value: ScalarValue): number {
  if (typeof value === 'number') {
    return value;
  }
  const min = Math.min(value.min, value.max);
  const max = Math.max(value.min, value.max);
  return min + Math.random() * (max - min);
}

function chooseFrame(frames?: Rectangle[]) {
  if (!frames || frames.length === 0) {
    return undefined;
  }
  const index = Math.floor(Math.random() * frames.length);
  return frames[index];
}

function sampleSpawnPosition(spawn: ParticleSpawnConfig) {
  if (spawn.type === 'point') {
    return { x: spawn.x, y: spawn.y };
  }
  if (spawn.type === 'circle') {
    const theta = Math.random() * Math.PI * 2;
    const radius = spawn.edgeOnly ? spawn.radius : Math.sqrt(Math.random()) * spawn.radius;
    return {
      x: spawn.x + Math.cos(theta) * radius,
      y: spawn.y + Math.sin(theta) * radius,
    };
  }
  return {
    x: spawn.x + Math.random() * spawn.width,
    y: spawn.y + Math.random() * spawn.height,
  };
}

function evaluateCurve(curve: Curve, t: number): number {
  if (curve.keys.length === 0) {
    return 1;
  }
  const keys = curve.keys;
  const clampedT = clamp01(t);
  if (clampedT <= keys[0].t) {
    return keys[0].v;
  }
  const last = keys[keys.length - 1];
  if (clampedT >= last.t) {
    return last.v;
  }
  for (let i = 1; i < keys.length; i += 1) {
    const prev = keys[i - 1];
    const next = keys[i];
    if (clampedT > next.t) {
      continue;
    }
    const span = next.t - prev.t;
    if (span <= 0) {
      return next.v;
    }
    const localT = (clampedT - prev.t) / span;
    return prev.v + (next.v - prev.v) * localT;
  }
  return last.v;
}

const IDENTITY_TONE: Color = { r: 0, g: 0, b: 0, a: 0 };

function sampleParticleColorTone(config: ParticleColorConfig | undefined, lifeT: number): Color {
  if (!config) {
    return IDENTITY_TONE;
  }
  const t = clamp01(lifeT);
  return {
    r: lerp(clamp255(config.start.r), clamp255(config.end.r), t),
    g: lerp(clamp255(config.start.g), clamp255(config.end.g), t),
    b: lerp(clamp255(config.start.b), clamp255(config.end.b), t),
    a: lerp(clamp01(config.start.a), clamp01(config.end.a), t),
  };
}

function composeColorTone(base: Color, overlay: Color): Color {
  if (overlay.a <= 0) {
    return base;
  }
  if (base.a <= 0) {
    return overlay;
  }
  const ba = clamp01(base.a);
  const oa = clamp01(overlay.a);
  const mixedAlpha = ba + oa - ba * oa;
  if (mixedAlpha <= 0) {
    return IDENTITY_TONE;
  }
  return {
    r: clamp255((base.r * ba * (1 - oa) + overlay.r * oa) / mixedAlpha),
    g: clamp255((base.g * ba * (1 - oa) + overlay.g * oa) / mixedAlpha),
    b: clamp255((base.b * ba * (1 - oa) + overlay.b * oa) / mixedAlpha),
    a: mixedAlpha,
  };
}

function lerp(from: number, to: number, t: number): number {
  return from + (to - from) * t;
}
