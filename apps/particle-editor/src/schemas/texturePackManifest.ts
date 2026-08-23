import type { Rectangle } from '@rutan/midorable';
import * as z from 'zod';
import type { TexturePackManifest } from '../types';

const rectangleSchema = z.looseObject({
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number(),
}) satisfies z.ZodType<Rectangle>;

export const texturePackManifestSchema = z.looseObject({
  image: z.string(),
  frames: z.record(z.string(), rectangleSchema),
}) satisfies z.ZodType<TexturePackManifest>;
