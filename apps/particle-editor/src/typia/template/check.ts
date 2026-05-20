import { ParticleEmitterConfig } from '@rutan/midorable';
import typia from 'typia';
import { TexturePackManifest } from '../../types';

export const checkParticleEmitterConfig = typia.createIs<ParticleEmitterConfig>();
export const validateParticleEmitterConfig = typia.createValidate<ParticleEmitterConfig>();

export const checkTexturePackManifest = typia.createIs<TexturePackManifest>();
export const validateTexturePackManifest = typia.createValidate<TexturePackManifest>();
