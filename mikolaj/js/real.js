// Realistyczna scena: ilustracja (Mikołaj na tronie, elfy, renifer) ożywiona w przeglądarce:
// ruch ust (opadanie żuchwy z brodą zsynchronizowane z głosem), oddech, migoczący ogień,
// mrugające światełka, śnieg za oknami, unoszące się iskierki i płynna praca kamery.
import { W, H, drawSubtitle, goldText, fitSize, drawFrontSnow, drawSparkles } from './scene.js';

const IMG_W = 1080, IMG_H = 1920;

// Współrzędne w pikselach obrazu źródłowego (1080x1920)
const MOUTH = { x: 595, y: 653, w: 44 };            // środek górnej wargi, szerokość ust
const JAW = { x0: 538, x1: 652, y0: 651, y1: 748 };  // obszar żuchwy i brody, który się przesuwa
const FACE = { x: 595, y: 640 };
const FIRE = { x: 1030, y: 760, r: 110 };
const WINDOWS = [
  { x: 250, y: 250, w: 112, h: 350 },
  { x: 672, y: 30, w: 208, h: 630 },
];

const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const ease = (x) => x * x * (3 - 2 * x);
const lerp = (a, b, t) => a + (b - a) * t;
const hash = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

let img = null;
let lights = [];
let jawCanvas = null;

function makeCanvas(w, h) {
  return typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(w, h) : Object.assign(document.createElement('canvas'), { width: w, height: h });
}

/** Wczytuje obraz i wykrywa na nim jasne punkty (lampki, świece) do migotania. */
export async function loadReal(url = new URL('../img/mikolaj.jpg', import.meta.url).href) {
  if (img) return;
  const im = new Image();
  im.decoding = 'async';
  im.src = url;
  await im.decode();
  img = im;
  const c = makeCanvas(IMG_W, IMG_H);
  const cx = c.getContext('2d', { willReadFrequently: true });
  cx.drawImage(im, 0, 0, IMG_W, IMG_H);
  const data = cx.getImageData(0, 0, IMG_W, IMG_H).data;
  const found = [];
  const step = 5;
  for (let y = 4; y < IMG_H - 4; y += step) {
    for (let x = 4; x < IMG_W - 4; x += step) {
      const i = (y * IMG_W + x) * 4;
      const r = data[i], g = data[i + 1], b = data[i + 2];
      const lum = 0.3 * r + 0.59 * g + 0.11 * b;
      if (lum < 225 || r - b < 35) continue;                       // tylko ciepłe, jasne punkty
      if (x > JAW.x0 - 60 && x < JAW.x1 + 60 && y > 520 && y < 800) continue; // nie na twarzy
      if (found.some((p) => Math.abs(p.x - x) < 16 && Math.abs(p.y - y) < 16)) continue;
      found.push({ x, y, lum });
    }
  }
  found.sort((a, b) => b.lum - a.lum);
  lights = found.slice(0, 160).map((p, k) => ({ ...p, ph: hash(k + 7) * Math.PI * 2, sp: 1.5 + hash(k + 70) * 2.5 }));
  jawCanvas = makeCanvas(JAW.x1 - JAW.x0, JAW.y1 - JAW.y0 + 30);
}

export function realReady() { return !!img; }

// ---------------------------------------------------------------- kamera

/** Kamera: zoom i punkt środka (w pikselach obrazu) w danej chwili. */
export function cameraAt(t, film) {
  const wide = { z: 1.0, x: IMG_W / 2, y: IMG_H / 2 };
  const face = { z: 2.15, x: 600, y: 770 };
  const faceClose = { z: 2.35, x: 598, y: 755 };
  const mid = { z: 1.6, x: 610, y: 840 };
  if (!film) {
    // podgląd na stronie: powolne "oddychanie" kamery między planem ogólnym a średnim
    const k = 0.5 - 0.5 * Math.cos(t * 0.12);
    return { z: lerp(1.0, 1.35, k), x: lerp(wide.x, 610, k), y: lerp(wide.y, 860, k) };
  }
  const tl = film.timeline;
  const first = tl[0] ? tl[0].start : 3;
  const letters = tl.filter((x) => x.section === 'letter');
  const lStart = letters.length ? letters[0].start : first + 8;
  const lEnd = letters.length ? letters[letters.length - 1].end : lStart + 5;
  const last = tl[tl.length - 1];
  const endStart = last ? last.start : film.duration - 4;
  const keys = [
    [0, { z: 1.0, x: IMG_W / 2, y: IMG_H / 2 }],
    [first - 0.6, { z: 1.12, x: 570, y: 930 }],
    [first + 2.5, face],
    [lStart - 0.5, faceClose],
    [lStart + 1.5, mid],
    [lEnd, { z: 1.55, x: 600, y: 830 }],
    [lEnd + 2.5, face],
    [endStart - 0.5, faceClose],
    [endStart + 2.5, { z: 1.08, x: IMG_W / 2, y: 980 }],
    [film.duration, { z: 1.0, x: IMG_W / 2, y: IMG_H / 2 }],
  ].sort((a, b) => a[0] - b[0]);
  let a = keys[0], b = keys[keys.length - 1];
  for (let i = 0; i < keys.length - 1; i++) if (t >= keys[i][0] && t <= keys[i + 1][0]) { a = keys[i]; b = keys[i + 1]; break; }
  if (t > keys[keys.length - 1][0]) a = b;
  const k = b[0] > a[0] ? ease(clamp((t - a[0]) / (b[0] - a[0]))) : 0;
  // delikatny "ręczny" ruch kamery
  const sway = { x: Math.sin(t * 0.37) * 6, y: Math.sin(t * 0.29 + 1) * 5 };
  return { z: lerp(a[1].z, b[1].z, k), x: lerp(a[1].x, b[1].x, k) + sway.x, y: lerp(a[1].y, b[1].y, k) + sway.y };
}

function applyCamera(ctx, cam) {
  // obraz 1080x1920 ma te same proporcje co kadr 720x1280
  const s = (W / IMG_W) * cam.z;
  // nie wyjeżdżamy poza obraz
  const halfW = W / s / 2, halfH = H / s / 2;
  const cx = clamp(cam.x, halfW, IMG_W - halfW);
  const cy = clamp(cam.y, halfH, IMG_H - halfH);
  ctx.setTransform(s, 0, 0, s, W / 2 - cx * s, H / 2 - cy * s);
}

// ---------------------------------------------------------------- warstwy animowane

function drawJaw(ctx, open) {
  if (open < 0.04) return;
  const D = open * 8.5; // maksymalne opadnięcie żuchwy w pikselach obrazu
  const jw = JAW.x1 - JAW.x0, jh = JAW.y1 - JAW.y0;
  const jc = jawCanvas.getContext('2d');
  jc.setTransform(1, 0, 0, 1, 0, 0);
  jc.globalCompositeOperation = 'source-over';
  jc.clearRect(0, 0, jawCanvas.width, jawCanvas.height);
  // wnętrze ust (widać je, gdy żuchwa opada)
  const rx = MOUTH.w * 0.46, ry = D * 0.6 + 2;
  jc.save();
  jc.translate(MOUTH.x - JAW.x0, 2 + D * 0.5);
  jc.scale(1, ry / rx);
  const mg = jc.createRadialGradient(0, 0, 0, 0, 0, rx);
  mg.addColorStop(0, '#1a0605');
  mg.addColorStop(0.65, '#33100e');
  mg.addColorStop(1, 'rgba(60,22,18,0)');
  jc.fillStyle = mg;
  jc.fillRect(-rx, -rx, rx * 2, rx * 2);
  jc.restore();
  // żuchwa i broda przesunięte w dół (najmocniej przy ustach, coraz słabiej niżej)
  const strip = 2;
  for (let r = 0; r < jh; r += strip) {
    const off = D * Math.pow(1 - r / jh, 1.1);
    jc.drawImage(img, JAW.x0, JAW.y0 + r, jw, strip, 0, r + off, jw, strip + 0.8);
  }
  // miękkie krawędzie (maska eliptyczna), żeby nie było widać szwów
  jc.globalCompositeOperation = 'destination-in';
  const cxm = jw / 2, cym = jh * 0.32;
  jc.save();
  jc.translate(cxm, cym);
  jc.scale(1, (jh * 0.95) / (jw * 0.5));
  const mask = jc.createRadialGradient(0, 0, jw * 0.18, 0, 0, jw * 0.5);
  mask.addColorStop(0, 'rgba(0,0,0,1)');
  mask.addColorStop(1, 'rgba(0,0,0,0)');
  jc.fillStyle = mask;
  jc.fillRect(-jw, -jw, jw * 2, jw * 2);
  jc.restore();
  jc.globalCompositeOperation = 'source-over';
  ctx.drawImage(jawCanvas, JAW.x0, JAW.y0);
  // górna warga i wąsy zostają na miejscu – dorysowujemy je z oryginału z miękką krawędzią
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(MOUTH.x, MOUTH.y - 9, MOUTH.w * 0.85, 11, 0, 0, Math.PI * 2);
  ctx.clip();
  ctx.drawImage(img, MOUTH.x - 50, MOUTH.y - 25, 100, 26, MOUTH.x - 50, MOUTH.y - 25, 100, 26);
  ctx.restore();
}

function drawWindowsSnow(ctx, t) {
  ctx.save();
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  WINDOWS.forEach((w, wi) => {
    ctx.save();
    ctx.beginPath();
    ctx.rect(w.x, w.y, w.w, w.h);
    ctx.clip();
    const n = Math.round((w.w * w.h) / 1400);
    for (let i = 0; i < n; i++) {
      const id = i + wi * 1000;
      const sp = 25 + hash(id) * 35;
      const y = w.y + ((hash(id + 3) * w.h + t * sp) % w.h);
      const x = w.x + ((hash(id + 5) * w.w + Math.sin(t * 0.7 + id) * 8 + w.w) % w.w);
      ctx.globalAlpha = 0.35 + hash(id + 9) * 0.5;
      ctx.beginPath();
      ctx.arc(x, y, 1.1 + hash(id + 11) * 2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  });
  ctx.restore();
}

function drawLights(ctx, t) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const l of lights) {
    const k = 0.5 + 0.5 * Math.sin(t * l.sp + l.ph);
    const a = 0.08 + k * k * 0.32;
    const r = 7 + k * 6;
    const g = ctx.createRadialGradient(l.x, l.y, 0, l.x, l.y, r);
    g.addColorStop(0, `rgba(255,230,170,${a})`);
    g.addColorStop(1, 'rgba(255,200,120,0)');
    ctx.fillStyle = g;
    ctx.fillRect(l.x - r, l.y - r, r * 2, r * 2);
  }
  ctx.restore();
}

function drawFire(ctx, t) {
  const f = 0.75 + 0.25 * Math.sin(t * 9.1) * Math.sin(t * 5.3 + 1) + 0.1 * Math.sin(t * 17);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const g = ctx.createRadialGradient(FIRE.x, FIRE.y, 5, FIRE.x, FIRE.y, FIRE.r * 2.6);
  g.addColorStop(0, `rgba(255,150,60,${0.22 * f})`);
  g.addColorStop(1, 'rgba(255,120,40,0)');
  ctx.fillStyle = g;
  ctx.fillRect(FIRE.x - FIRE.r * 2.6, FIRE.y - FIRE.r * 2.6, FIRE.r * 5.2, FIRE.r * 5.2);
  // iskry
  for (let i = 0; i < 14; i++) {
    const life = (t * (0.5 + hash(i) * 0.4) + hash(i + 3)) % 1;
    const x = FIRE.x - 30 + hash(i + 5) * 70 + Math.sin(life * 9 + i) * 8;
    const y = FIRE.y + 30 - life * 170;
    ctx.globalAlpha = Math.sin(life * Math.PI) * 0.9;
    ctx.fillStyle = '#ffb04a';
    ctx.beginPath();
    ctx.arc(x, y, 1.6, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  // ciepłe światło ognia pulsuje też na Mikołaju i podłodze
  ctx.save();
  ctx.globalCompositeOperation = 'soft-light';
  ctx.globalAlpha = 0.18 * f;
  ctx.fillStyle = '#ff9a40';
  ctx.fillRect(500, 500, 580, 900);
  ctx.restore();
}

function drawMotes(ctx, t) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 40; i++) {
    const life = (t * 0.05 * (0.6 + hash(i) * 0.8) + hash(i + 40)) % 1;
    const x = (hash(i + 80) * IMG_W + Math.sin(t * 0.3 + i) * 30 + IMG_W) % IMG_W;
    const y = IMG_H * (0.9 - life * 0.8);
    if (Math.abs(x - FACE.x) < 110 && Math.abs(y - FACE.y) < 130) continue; // nie na twarzy
    ctx.globalAlpha = Math.sin(life * Math.PI) * (0.25 + hash(i + 7) * 0.35);
    ctx.fillStyle = '#ffe9b0';
    ctx.beginPath();
    ctx.arc(x, y, 1.5 + hash(i + 9) * 2.5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function grade(ctx) {
  // winieta – kino w domu
  const v = ctx.createRadialGradient(W / 2, H * 0.45, H * 0.28, W / 2, H * 0.5, H * 0.78);
  v.addColorStop(0, 'rgba(0,0,0,0)');
  v.addColorStop(1, 'rgba(8,3,0,0.6)');
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, W, H);
}

// ---------------------------------------------------------------- klatka

/**
 * Rysuje klatkę realistycznej sceny.
 * st: wynik stateAt() (mouth, subtitle, mode, title, titleAlpha, ending), cam: cameraAt()
 */
export function drawReal(ctx, t, st, cam) {
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, H);
  applyCamera(ctx, cam);
  // lekki "oddech" Mikołaja: minimalne skalowanie tułowia i głowy wokół siedziska
  ctx.drawImage(img, 0, 0, IMG_W, IMG_H);
  const breathe = Math.sin(t * 1.5) * 0.004;
  if (breathe) {
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(600, 760, 190, 260, 0, 0, Math.PI * 2);
    ctx.clip();
    ctx.translate(600, 1000);
    ctx.scale(1 + breathe * 0.5, 1 + breathe);
    ctx.translate(-600, -1000);
    ctx.drawImage(img, 400, 480, 400, 560, 400, 480, 400, 560);
    ctx.restore();
  }
  drawJaw(ctx, clamp(st.mouth || 0));
  drawWindowsSnow(ctx, t);
  drawFire(ctx, t);
  drawLights(ctx, t);
  drawMotes(ctx, t);
  ctx.restore();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  grade(ctx);

  if (st.ending > 0) {
    drawFrontSnow(ctx, t, clamp(st.ending * 1.5) * 0.8);
    drawSparkles(ctx, t * 1.6, 36, [0, 100, W, 900], clamp(st.ending * 1.5));
  }
  drawSubtitle(ctx, st.subtitle, st.mode, st.subAlpha ?? 1);
  if (st.titleAlpha > 0 && st.title) {
    ctx.save();
    ctx.globalAlpha = st.titleAlpha * 0.45;
    ctx.fillStyle = '#12060a';
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
    goldText(ctx, 'Film od', W / 2, 470, fitSize(ctx, 'Film od', 64, W - 80), st.titleAlpha);
    goldText(ctx, 'Świętego Mikołaja', W / 2, 560, fitSize(ctx, 'Świętego Mikołaja', 78, W - 60), st.titleAlpha);
    goldText(ctx, st.title, W / 2, 690, fitSize(ctx, st.title, 70, W - 80), st.titleAlpha);
  }
  if (st.ending > 0.3) {
    const a = clamp((st.ending - 0.3) / 0.3);
    const sz = fitSize(ctx, 'Wesołych Świąt!', 96, W - 60);
    goldText(ctx, 'Wesołych Świąt!', W / 2, 260, sz * (0.9 + 0.1 * a), a);
  }
}
