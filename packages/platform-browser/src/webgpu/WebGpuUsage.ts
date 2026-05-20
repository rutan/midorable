export const GPU_TEXTURE_USAGE = {
  copyDst: 0x02,
  textureBinding: 0x04,
  renderAttachment: 0x10,
} as const;

export const GPU_BUFFER_USAGE = {
  copyDst: 0x08,
  vertex: 0x20,
  uniform: 0x40,
} as const;
