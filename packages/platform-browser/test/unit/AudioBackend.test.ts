import { afterEach, describe, expect, it, vi } from 'vitest';
import { BrowserAudioBackend } from '../../src/AudioBackend';

function createBackend() {
  const buffer = { duration: 1.25 } as AudioBuffer;
  const decodeAudioData = vi.fn(async (_data: ArrayBuffer) => buffer);
  const context = {
    destination: {},
    createGain: () => ({ connect: vi.fn(), gain: { value: 1 } }),
    decodeAudioData,
  } as unknown as AudioContext;
  return { backend: new BrowserAudioBackend({ context }), buffer, decodeAudioData };
}

describe('BrowserAudioBackend.loadAudio', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it.each([
    'data:audio/wav;base64,AP9/gA==',
    'data:audio/ogg;codecs=vorbis;base64,AP9/gA==',
    'data:;base64,AP9/gA==',
    'DATA:audio/wav;BASE64,AP9/gA==',
    'data:audio/wav; base64 ,AP9/gA==',
    'data:audio/wav;base64,AP9%2FgA%3D%3D',
    'data:audio/wav;base64,A P9/\ngA==',
    'data:audio/wav;base64,AP9/gA',
    'data:audio/wav;base64,AP9/gA==#fragment',
    ' data:audio/wav;base64,AP9/gA== ',
  ])('decodes base64 audio locally: %s', async (url) => {
    const { backend, buffer, decodeAudioData } = createBackend();
    const fetchMock = vi.fn(() => {
      throw new Error('fetch is blocked by CSP');
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(backend.loadAudio(url)).resolves.toEqual({
      id: url,
      type: 'audio',
      duration: 1.25,
      source: buffer,
    });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(decodeAudioData).toHaveBeenCalledTimes(1);
    expect(new Uint8Array(decodeAudioData.mock.calls[0]![0])).toEqual(new Uint8Array([0, 255, 127, 128]));
  });

  it('passes an empty base64 payload to the audio decoder without fetching', async () => {
    const { backend, decodeAudioData } = createBackend();
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await backend.loadAudio('data:audio/wav;base64,');

    expect(decodeAudioData).toHaveBeenCalledWith(new ArrayBuffer(0));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    'data:audio/wav;base64,not-valid-base64!',
    'data:audio/wav;base64,AP9/gA==?query',
    'data:audio/wav;base64,%invalid',
  ])('rejects malformed base64 without fetching or decoding audio: %s', async (url) => {
    const { backend, decodeAudioData } = createBackend();
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(backend.loadAudio(url)).rejects.toThrow();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(decodeAudioData).not.toHaveBeenCalled();
  });

  it.each([
    '/sound.wav',
    'https://example.com/sound.ogg',
    'blob:https://example.com/audio',
    'data:audio/wav,%00%FF%7F%80',
    'data:audio/wav;base64=parameter,AP9/gA==',
    'data:audio/wav;base64;charset=utf-8,AP9/gA==',
  ])('continues fetching other audio URLs: %s', async (url) => {
    const { backend, buffer, decodeAudioData } = createBackend();
    const data = new ArrayBuffer(4);
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, arrayBuffer: async () => data });
    vi.stubGlobal('fetch', fetchMock);
    const controller = new AbortController();

    await expect(backend.loadAudio(url, controller.signal)).resolves.toEqual({
      id: url,
      type: 'audio',
      duration: 1.25,
      source: buffer,
    });
    expect(fetchMock).toHaveBeenCalledExactlyOnceWith(url, { signal: controller.signal });
    expect(decodeAudioData).toHaveBeenCalledExactlyOnceWith(data);
  });

  it('preserves HTTP errors', async () => {
    const { backend, decodeAudioData } = createBackend();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404, statusText: 'Not Found' }));

    await expect(backend.loadAudio('/missing.wav')).rejects.toThrow(
      'Failed to load audio asset: /missing.wav (404 Not Found)',
    );
    expect(decodeAudioData).not.toHaveBeenCalled();
  });

  it('preserves fetch failures', async () => {
    const { backend, decodeAudioData } = createBackend();
    const error = new TypeError('Failed to fetch');
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(error));

    await expect(backend.loadAudio('/sound.wav')).rejects.toBe(error);
    expect(decodeAudioData).not.toHaveBeenCalled();
  });

  it.each(['data:audio/wav;base64,AP9/gA==', '/sound.wav'])('preserves audio decoding errors: %s', async (url) => {
    const { backend, decodeAudioData } = createBackend();
    const error = new DOMException('Invalid audio data', 'EncodingError');
    decodeAudioData.mockRejectedValue(error);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, arrayBuffer: async () => new ArrayBuffer(4) }));

    await expect(backend.loadAudio(url)).rejects.toBe(error);
  });

  it('rejects a base64 load cancelled while audio decoding is pending', async () => {
    const { backend, buffer, decodeAudioData } = createBackend();
    const decoding = Promise.withResolvers<AudioBuffer>();
    decodeAudioData.mockReturnValue(decoding.promise);
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const controller = new AbortController();

    const pending = backend.loadAudio('data:audio/wav;base64,AP9/gA==', controller.signal);
    controller.abort();
    decoding.resolve(buffer);

    await expect(pending).rejects.toBe(controller.signal.reason);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([undefined, new Error('cancelled')])(
    'rejects a pre-aborted base64 load with its abort reason',
    async (reason) => {
      const { backend, decodeAudioData } = createBackend();
      const fetchMock = vi.fn();
      vi.stubGlobal('fetch', fetchMock);
      const controller = new AbortController();
      controller.abort(reason);

      await expect(backend.loadAudio('data:audio/wav;base64,AP9/gA==', controller.signal)).rejects.toBe(
        controller.signal.reason,
      );
      expect(fetchMock).not.toHaveBeenCalled();
      expect(decodeAudioData).not.toHaveBeenCalled();
    },
  );
});
