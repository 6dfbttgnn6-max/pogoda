// Zapis filmu do pliku. Najpierw szybka ścieżka WebCodecs (H.264 + AAC -> MP4, szybciej niż w czasie rzeczywistym),
// a jeśli telefon jej nie obsługuje – nagrywanie w czasie rzeczywistym przez MediaRecorder.
import { Muxer, ArrayBufferTarget } from '../vendor/mp4-muxer.mjs';
import { stateAt, W, H } from './scene.js';
import { loadReal, drawReal, cameraAt } from './real.js';

const frame = (ctx, t, film) => drawReal(ctx, t, stateAt(t, film), cameraAt(t, film));

const VIDEO_CODECS = ['avc1.640028', 'avc1.4D4028', 'avc1.42E028', 'avc1.42E01F'];
const VIDEO_BITRATE = 2_200_000; // ok. 16 MB na minutę filmu

async function findVideoCodec(fps) {
  if (typeof VideoEncoder === 'undefined' || typeof VideoFrame === 'undefined') return null;
  for (const codec of VIDEO_CODECS) {
    try {
      const r = await VideoEncoder.isConfigSupported({ codec, width: W, height: H, bitrate: VIDEO_BITRATE, framerate: fps });
      if (r.supported) return codec;
    } catch { /* następny */ }
  }
  return null;
}

async function audioSupported(codec, sampleRate) {
  if (typeof AudioEncoder === 'undefined' || typeof AudioData === 'undefined') return false;
  try {
    const r = await AudioEncoder.isConfigSupported({ codec, sampleRate, numberOfChannels: 2, bitrate: 128000 });
    return !!r.supported;
  } catch { return false; }
}

function recorderMime() {
  if (typeof MediaRecorder === 'undefined') return null;
  const list = ['video/mp4;codecs=avc1.42E01E,mp4a.40.2', 'video/mp4;codecs=avc1,mp4a.40.2', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];
  return list.find((m) => { try { return MediaRecorder.isTypeSupported(m); } catch { return false; } }) || null;
}

/** Wybór sposobu zapisu dla tego urządzenia. */
export async function pickMethod(fps, sampleRate, force) {
  const vc = await findVideoCodec(fps);
  const aac = vc && (await audioSupported('mp4a.40.2', sampleRate));
  const mime = recorderMime();
  const opus = vc && (await audioSupported('opus', sampleRate));
  const methods = [];
  if (aac) methods.push({ kind: 'webcodecs', video: vc, audio: 'aac' });
  if (mime && mime.startsWith('video/mp4')) methods.push({ kind: 'recorder', mime });
  if (opus) methods.push({ kind: 'webcodecs', video: vc, audio: 'opus' });
  if (mime && !mime.startsWith('video/mp4')) methods.push({ kind: 'recorder', mime });
  if (force) return methods.find((m) => m.kind === force) || methods[0] || null;
  return methods[0] || null;
}

const tick = () => new Promise((r) => setTimeout(r, 0));

async function encodeWebCodecs(film, canvas, method, onProgress) {
  const { fps, duration, buffer } = film;
  const ctx = canvas.getContext('2d');
  const sampleRate = buffer.sampleRate;
  const muxer = new Muxer({
    target: new ArrayBufferTarget(),
    video: { codec: 'avc', width: W, height: H, frameRate: fps },
    audio: { codec: method.audio, numberOfChannels: 2, sampleRate },
    fastStart: 'in-memory',
    firstTimestampBehavior: 'offset',
  });
  let failure = null;

  // --- dźwięk ---
  const aenc = new AudioEncoder({
    output: (chunk, meta) => muxer.addAudioChunk(chunk, meta),
    error: (e) => { failure = e; },
  });
  aenc.configure({ codec: method.audio === 'aac' ? 'mp4a.40.2' : 'opus', sampleRate, numberOfChannels: 2, bitrate: 160000 });
  const L = buffer.getChannelData(0), R = buffer.getChannelData(1);
  const CH = 4800;
  for (let off = 0; off < L.length; off += CH) {
    const n = Math.min(CH, L.length - off);
    const data = new Float32Array(n * 2);
    data.set(L.subarray(off, off + n), 0);
    data.set(R.subarray(off, off + n), n);
    const ad = new AudioData({ format: 'f32-planar', sampleRate, numberOfFrames: n, numberOfChannels: 2, timestamp: Math.round((off / sampleRate) * 1e6), data });
    aenc.encode(ad);
    ad.close();
    if (aenc.encodeQueueSize > 20) await tick();
  }
  await aenc.flush();
  aenc.close();
  if (failure) throw failure;

  // --- obraz ---
  const venc = new VideoEncoder({
    output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
    error: (e) => { failure = e; },
  });
  venc.configure({ codec: method.video, width: W, height: H, bitrate: VIDEO_BITRATE, framerate: fps, avc: { format: 'avc' } });
  const total = Math.ceil(duration * fps);
  const frameDur = Math.round(1e6 / fps);
  for (let i = 0; i < total; i++) {
    if (failure) throw failure;
    const t = i / fps;
    frame(ctx, t, film);
    const vf = new VideoFrame(canvas, { timestamp: i * frameDur, duration: frameDur });
    venc.encode(vf, { keyFrame: i % (fps * 2) === 0 });
    vf.close();
    while (venc.encodeQueueSize > 6) await new Promise((r) => setTimeout(r, 2));
    if (i % 5 === 0) { onProgress?.(i / total); await tick(); }
  }
  await venc.flush();
  venc.close();
  if (failure) throw failure;
  muxer.finalize();
  onProgress?.(1);
  return { blob: new Blob([muxer.target.buffer], { type: 'video/mp4' }), mime: 'video/mp4', ext: 'mp4' };
}

async function recordRealtime(film, canvas, method, onProgress, audioCtx) {
  const { fps, duration, buffer } = film;
  const ctx2d = canvas.getContext('2d');
  const actx = audioCtx || new AudioContext();
  if (actx.state === 'suspended') await actx.resume();
  const dest = actx.createMediaStreamDestination();
  const src = actx.createBufferSource();
  src.buffer = buffer;
  src.connect(dest);
  frame(ctx2d, 0, film);
  const vstream = canvas.captureStream(fps);
  const stream = new MediaStream([...vstream.getVideoTracks(), ...dest.stream.getAudioTracks()]);
  const rec = new MediaRecorder(stream, { mimeType: method.mime, videoBitsPerSecond: VIDEO_BITRATE, audioBitsPerSecond: 160000 });
  const chunks = [];
  rec.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
  const done = new Promise((res) => { rec.onstop = res; });
  rec.start(1000);
  const t0 = actx.currentTime + 0.15;
  src.start(t0);
  await new Promise((resolve) => {
    const loop = () => {
      const t = actx.currentTime - t0;
      frame(ctx2d, Math.max(0, t), film);
      onProgress?.(Math.min(1, Math.max(0, t / duration)));
      if (t >= duration + 0.2) return resolve();
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  });
  rec.stop();
  await done;
  vstream.getTracks().forEach((tr) => tr.stop());
  const mime = method.mime.split(';')[0];
  return { blob: new Blob(chunks, { type: mime }), mime, ext: mime.includes('mp4') ? 'mp4' : 'webm' };
}

/** Renderuje film. Zwraca {blob, mime, ext, method}. */
export async function renderFilm(film, canvas, { onProgress, audioCtx, force } = {}) {
  canvas.width = W;
  canvas.height = H;
  await loadReal();
  const method = await pickMethod(film.fps, film.buffer.sampleRate, force);
  if (!method) throw new Error('Ta przeglądarka nie potrafi zapisać filmu. Spróbuj w Chrome (Android) lub Safari (iPhone).');
  if (method.kind === 'webcodecs') {
    try {
      return { ...(await encodeWebCodecs(film, canvas, method, onProgress)), method };
    } catch (e) {
      console.warn('WebCodecs nie zadziałało, nagrywam w czasie rzeczywistym', e);
      const fallback = { kind: 'recorder', mime: recorderMime() };
      if (!fallback.mime) throw e;
      return { ...(await recordRealtime(film, canvas, fallback, onProgress, audioCtx)), method: fallback };
    }
  }
  return { ...(await recordRealtime(film, canvas, method, onProgress, audioCtx)), method };
}
