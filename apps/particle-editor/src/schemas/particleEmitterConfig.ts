import type { ParticleEmitterConfig } from '@rutan/midorable';
import * as z from 'zod';

const scalarValueSchema = z.union([
  z.number(),
  z.looseObject({
    min: z.number(),
    max: z.number(),
  }),
]);

const curveSchema = z.looseObject({
  keys: z.array(
    z.looseObject({
      t: z.number(),
      v: z.number(),
    }),
  ),
});

const spawnSchema = z.discriminatedUnion('type', [
  z.looseObject({
    type: z.literal('point'),
    x: z.number(),
    y: z.number(),
  }),
  z.looseObject({
    type: z.literal('circle'),
    x: z.number(),
    y: z.number(),
    radius: z.number(),
    edgeOnly: z.boolean().optional(),
  }),
  z.looseObject({
    type: z.literal('rectangle'),
    x: z.number(),
    y: z.number(),
    width: z.number(),
    height: z.number(),
  }),
]);

const forceSchema = z.discriminatedUnion('type', [
  z.looseObject({
    type: z.literal('gravity'),
    x: z.number(),
    y: z.number(),
  }),
  z.looseObject({
    type: z.literal('attractor'),
    x: z.number(),
    y: z.number(),
    strength: z.number(),
    killDistance: z.number().optional(),
  }),
]);

export const particleEmitterConfigSchema = z.looseObject({
  duration: z.number(),
  spawn: spawnSchema,
  emissionRate: scalarValueSchema,
  burstCount: scalarValueSchema.optional(),
  lifetime: scalarValueSchema,
  speed: scalarValueSchema,
  speedOverLife: curveSchema.optional(),
  direction: scalarValueSchema,
  alignToDirection: z.boolean().optional(),
  angularVelocity: scalarValueSchema.optional(),
  angularVelocityOverLife: curveSchema.optional(),
  scale: scalarValueSchema,
  scaleOverLife: curveSchema.optional(),
  alpha: scalarValueSchema,
  alphaOverLife: curveSchema.optional(),
  color: z
    .looseObject({
      start: colorSchema(),
      end: colorSchema(),
    })
    .optional(),
  blendMode: z.enum(['normal', 'add', 'subtract', 'multiply', 'screen']),
  forces: z.array(forceSchema),
}) satisfies z.ZodType<ParticleEmitterConfig>;

function colorSchema() {
  return z.looseObject({
    r: z.number(),
    g: z.number(),
    b: z.number(),
    a: z.number(),
  });
}
