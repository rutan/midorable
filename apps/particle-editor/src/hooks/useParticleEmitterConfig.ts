import { ParticleEmitterConfig } from '@rutan/midorable';
import { atom, useAtom } from 'jotai';

export function createDefaultParticleEmitterConfig(): ParticleEmitterConfig {
  return {
    duration: -1,
    spawn: { type: 'point', x: 0, y: 0 },
    emissionRate: 45,
    burstCount: { min: 1, max: 3 },
    lifetime: { min: 0.35, max: 0.55 },
    speed: { min: 140, max: 220 },
    direction: { min: 220, max: 320 },
    scale: { min: 0.7, max: 1.4 },
    alpha: 1.0,
    alphaOverLife: {
      keys: [
        { t: 0, v: 1 },
        { t: 1, v: 0 },
      ],
    },
    blendMode: 'add',
    alignToDirection: true,
    angularVelocity: 0,
    forces: [],
  } satisfies ParticleEmitterConfig;
}

const particleEmitterConfigAtom = atom<ParticleEmitterConfig>(createDefaultParticleEmitterConfig());

export function useParticleEmitterConfig() {
  const [config, setConfig] = useAtom(particleEmitterConfigAtom);

  return {
    config,
    setConfig,
  };
}
