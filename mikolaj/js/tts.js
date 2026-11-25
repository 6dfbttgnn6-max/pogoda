// Darmowa synteza mowy w przeglądarce: model Piper (VITS) uruchamiany przez onnxruntime-web.
// Model pobierany raz z Hugging Face i zapisywany w pamięci podręcznej przeglądarki.
import { textToIPA, ipaToIds } from './g2p.js';

const HF = 'https://huggingface.co/diffusionstudio/piper-voices/resolve/main/pl/pl_PL';
export const VOICES = {
  darkman: `${HF}/darkman/medium/pl_PL-darkman-medium.onnx`,
  mc_speech: `${HF}/mc_speech/medium/pl_PL-mc_speech-medium.onnx`,
};
const CACHE = 'mikolaj-glos-v1';

let session = null;
let config = null;
let loadedUrl = null;

async function fetchCached(url, onProgress) {
  let cache = null;
  try { cache = await caches.open(CACHE); } catch { /* np. tryb prywatny */ }
  if (cache) {
    const hit = await cache.match(url);
    if (hit) { onProgress?.(1); return new Uint8Array(await hit.arrayBuffer()); }
  }
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Nie udało się pobrać głosu (${res.status}).`);
  const total = +(res.headers.get('Content-Length') || 0);
  const reader = res.body.getReader();
  const chunks = [];
  let loaded = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    loaded += value.length;
    if (total) onProgress?.(loaded / total);
  }
  const buf = new Uint8Array(loaded);
  let off = 0;
  for (const c of chunks) { buf.set(c, off); off += c.length; }
  if (cache) {
    try {
      await cache.put(url, new Response(buf, { headers: { 'Content-Type': 'application/octet-stream' } }));
    } catch { /* brak miejsca – trudno, pobierze się następnym razem */ }
  }
  onProgress?.(1);
  return buf;
}

/** Wczytuje model głosu (raz na sesję). */
export async function loadVoice(modelUrl, onProgress) {
  if (session && loadedUrl === modelUrl) return;
  const ort = window.ort;
  if (!ort) throw new Error('Brak silnika mowy (onnxruntime).');
  ort.env.wasm.wasmPaths = new URL('../vendor/', import.meta.url).href;
  ort.env.wasm.numThreads = 1; // wielowątkowość wymaga nagłówków COOP/COEP, których hosting nie daje
  const [cfgBuf, model] = await Promise.all([
    fetchCached(modelUrl + '.json'),
    fetchCached(modelUrl, onProgress),
  ]);
  config = JSON.parse(new TextDecoder().decode(cfgBuf));
  session = await ort.InferenceSession.create(model, { executionProviders: ['wasm'] });
  loadedUrl = modelUrl;
}

export function sampleRate() {
  return config?.audio?.sample_rate || 22050;
}

/**
 * Synteza jednego fragmentu tekstu. Zwraca Float32Array (mono).
 * lengthScale > 1 = wolniej (Mikołaj mówi spokojnie).
 */
export async function synthesize(text, { lengthScale = 1.1, noiseScale = 0.5, noiseW = 0.7 } = {}) {
  if (!session) throw new Error('Głos nie jest wczytany.');
  const ort = window.ort;
  const ipa = text.startsWith('IPA:') ? text.slice(4) : textToIPA(text);
  const ids = ipaToIds(ipa, config.phoneme_id_map);
  if (ids.length < 5) return new Float32Array(0);
  const feeds = {
    input: new ort.Tensor('int64', BigInt64Array.from(ids.map(BigInt)), [1, ids.length]),
    input_lengths: new ort.Tensor('int64', BigInt64Array.from([BigInt(ids.length)]), [1]),
    scales: new ort.Tensor('float32', Float32Array.from([noiseScale, lengthScale, noiseW]), [3]),
  };
  const out = await session.run(feeds);
  return out.output.data.slice();
}
