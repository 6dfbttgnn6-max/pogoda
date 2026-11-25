// Animowana scena: pracownia Mikołaja. Wszystko rysowane wektorowo na canvas,
// deterministycznie od czasu t (ta sama klatka = ten sam obraz), co pozwala renderować film szybciej niż w czasie rzeczywistym.

export const W = 720;
export const H = 1280;

const TAU = Math.PI * 2;
const hash = (n) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const ease = (x) => x * x * (3 - 2 * x);
const lerp = (a, b, t) => a + (b - a) * t;

function ellipse(ctx, x, y, rx, ry, fill, rot = 0) {
  ctx.beginPath();
  ctx.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot, 0, TAU);
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
}
function circle(ctx, x, y, r, fill) { ellipse(ctx, x, y, r, r, fill); }
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// ---------------------------------------------------------------- tło (statyczne, rysowane raz)

function drawWall(ctx) {
  const g = ctx.createLinearGradient(0, 0, 0, 900);
  g.addColorStop(0, '#4a2a1a');
  g.addColorStop(1, '#6b3d22');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, 900);
  // bale drewniane
  for (let i = 0; i < 15; i++) {
    const y = i * 62;
    const lg = ctx.createLinearGradient(0, y, 0, y + 62);
    const tone = 0.85 + hash(i) * 0.3;
    lg.addColorStop(0, `rgba(${120 * tone},${70 * tone},${40 * tone},0.55)`);
    lg.addColorStop(0.5, `rgba(${150 * tone},${92 * tone},${52 * tone},0.35)`);
    lg.addColorStop(1, 'rgba(30,14,6,0.6)');
    ctx.fillStyle = lg;
    ctx.fillRect(0, y, W, 62);
    ctx.fillStyle = 'rgba(20,8,2,0.5)';
    ctx.fillRect(0, y + 59, W, 3);
    for (let k = 0; k < 3; k++) {
      const kx = hash(i * 7 + k) * W;
      ellipse(ctx, kx, y + 30, 9, 5, 'rgba(40,18,6,0.35)');
      ellipse(ctx, kx, y + 30, 4, 2, 'rgba(40,18,6,0.4)');
    }
  }
}

function windowPath(ctx, x, y, w, h) {
  ctx.beginPath();
  ctx.moveTo(x, y + h);
  ctx.lineTo(x, y + w / 2);
  ctx.arc(x + w / 2, y + w / 2, w / 2, Math.PI, 0);
  ctx.lineTo(x + w, y + h);
  ctx.closePath();
}

const WIN = { x: 48, y: 118, w: 270, h: 360 };

function drawWindowView(ctx) {
  const { x, y, w, h } = WIN;
  ctx.save();
  windowPath(ctx, x, y, w, h);
  ctx.clip();
  const sky = ctx.createLinearGradient(0, y, 0, y + h);
  sky.addColorStop(0, '#081634');
  sky.addColorStop(0.6, '#1d3d72');
  sky.addColorStop(1, '#4f74a8');
  ctx.fillStyle = sky;
  ctx.fillRect(x, y, w, h);
  for (let i = 0; i < 40; i++) circle(ctx, x + hash(i + 3) * w, y + hash(i + 50) * h * 0.55, hash(i + 9) * 1.4 + 0.4, 'rgba(255,255,240,0.85)');
  // księżyc
  circle(ctx, x + w * 0.72, y + 95, 30, '#fff7d6');
  circle(ctx, x + w * 0.72 + 12, y + 88, 27, '#122a55');
  // wzgórza
  ctx.fillStyle = '#c9dcf2';
  ctx.beginPath();
  ctx.moveTo(x, y + h * 0.72);
  ctx.quadraticCurveTo(x + w * 0.3, y + h * 0.6, x + w * 0.6, y + h * 0.7);
  ctx.quadraticCurveTo(x + w * 0.85, y + h * 0.77, x + w, y + h * 0.66);
  ctx.lineTo(x + w, y + h);
  ctx.lineTo(x, y + h);
  ctx.fill();
  // choinki za oknem
  for (let i = 0; i < 6; i++) {
    const tx = x + 20 + i * 45 + hash(i) * 10, ty = y + h * 0.74 + hash(i + 4) * 20, s = 0.6 + hash(i + 8) * 0.5;
    ctx.fillStyle = '#1b3b3a';
    ctx.beginPath();
    ctx.moveTo(tx, ty - 60 * s); ctx.lineTo(tx + 20 * s, ty); ctx.lineTo(tx - 20 * s, ty); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.beginPath();
    ctx.moveTo(tx, ty - 60 * s); ctx.lineTo(tx + 7 * s, ty - 40 * s); ctx.lineTo(tx - 7 * s, ty - 40 * s); ctx.fill();
  }
  // domek z zapalonym okienkiem
  const hx = x + w * 0.18, hy = y + h * 0.78;
  ctx.fillStyle = '#5a3a2a'; ctx.fillRect(hx, hy, 46, 30);
  ctx.fillStyle = '#eef4ff';
  ctx.beginPath(); ctx.moveTo(hx - 6, hy + 2); ctx.lineTo(hx + 23, hy - 20); ctx.lineTo(hx + 52, hy + 2); ctx.fill();
  ctx.fillStyle = '#ffd36b'; ctx.fillRect(hx + 17, hy + 10, 12, 11);
  const snowG = ctx.createLinearGradient(0, y + h * 0.85, 0, y + h);
  snowG.addColorStop(0, '#e6f0fb'); snowG.addColorStop(1, '#ffffff');
  ctx.fillStyle = snowG;
  ctx.fillRect(x, y + h * 0.88, w, h * 0.12);
  ctx.restore();
}

function drawWindowFrame(ctx) {
  const { x, y, w, h } = WIN;
  ctx.save();
  ctx.lineJoin = 'round';
  windowPath(ctx, x, y, w, h);
  ctx.lineWidth = 22;
  ctx.strokeStyle = '#2e170b';
  ctx.stroke();
  ctx.lineWidth = 14;
  ctx.strokeStyle = '#8a5530';
  ctx.stroke();
  // szprosy
  ctx.lineWidth = 9;
  ctx.strokeStyle = '#7a4826';
  ctx.beginPath();
  ctx.moveTo(x + w / 2, y + 2); ctx.lineTo(x + w / 2, y + h);
  ctx.moveTo(x, y + h * 0.52); ctx.lineTo(x + w, y + h * 0.52);
  ctx.stroke();
  // szron w rogach
  ctx.save();
  windowPath(ctx, x, y, w, h);
  ctx.clip();
  for (const [cx, cy] of [[x, y + h], [x + w, y + h]]) {
    const fg = ctx.createRadialGradient(cx, cy, 0, cx, cy, 90);
    fg.addColorStop(0, 'rgba(255,255,255,0.75)');
    fg.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = fg;
    ctx.fillRect(cx - 90, cy - 90, 180, 180);
  }
  ctx.restore();
  // parapet ze śniegiem
  ctx.fillStyle = '#5c3219';
  roundRect(ctx, x - 26, y + h - 4, w + 52, 26, 6);
  ctx.fill();
  ctx.fillStyle = '#f6fbff';
  ctx.beginPath();
  ctx.moveTo(x - 24, y + h - 2);
  for (let i = 0; i <= 12; i++) ctx.quadraticCurveTo(x - 24 + (i - 0.5) * (w + 48) / 12, y + h - 16 - hash(i) * 6, x - 24 + i * (w + 48) / 12, y + h - 4);
  ctx.lineTo(x + w + 24, y + h + 4);
  ctx.lineTo(x - 24, y + h + 4);
  ctx.fill();
  ctx.restore();
}

function drawFloor(ctx) {
  const g = ctx.createLinearGradient(0, 880, 0, H);
  g.addColorStop(0, '#7a4a27');
  g.addColorStop(1, '#4a2a14');
  ctx.fillStyle = g;
  ctx.fillRect(0, 880, W, H - 880);
  ctx.strokeStyle = 'rgba(30,14,4,0.45)';
  ctx.lineWidth = 2;
  for (let i = -8; i <= 8; i++) {
    ctx.beginPath();
    ctx.moveTo(W / 2 + i * 60, 880);
    ctx.lineTo(W / 2 + i * 150, H);
    ctx.stroke();
  }
  for (let r = 0; r < 6; r++) {
    const y = 880 + Math.pow(r / 6, 1.6) * 400;
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
  }
  // listwa
  ctx.fillStyle = '#3a1f0e';
  ctx.fillRect(0, 872, W, 14);
  // dywan
  ellipse(ctx, 360, 1005, 300, 78, '#7d1220');
  ellipse(ctx, 360, 1005, 286, 70, '#b01e2c');
  ctx.lineWidth = 4;
  ctx.strokeStyle = '#e7b54a';
  ellipse(ctx, 360, 1005, 250, 58);
  ctx.stroke();
  ctx.setLineDash([6, 10]);
  ellipse(ctx, 360, 1005, 226, 50);
  ctx.stroke();
  ctx.setLineDash([]);
}

const TREE = { x: 600, top: 232, base: 860 };
function treeLayers() {
  const L = [];
  const n = 6;
  for (let i = 0; i < n; i++) {
    const k = i / (n - 1);
    L.push({ y: lerp(TREE.top + 40, TREE.base - 40, k), w: lerp(52, 150, k), h: lerp(100, 150, k) });
  }
  return L;
}
const ORNAMENTS = (() => {
  const res = [];
  const cols = ['#d62f3c', '#f2c14e', '#3d7fd9', '#e8e8f0', '#b84fd0'];
  for (let i = 0; i < 22; i++) {
    const v = hash(i + 100);
    const y = lerp(TREE.top + 90, TREE.base - 40, Math.pow(hash(i + 200), 0.8));
    const half = lerp(30, 140, (y - TREE.top) / (TREE.base - TREE.top)) * 0.85;
    res.push({ x: TREE.x + (v * 2 - 1) * half, y, r: 7 + hash(i + 300) * 5, c: cols[i % cols.length] });
  }
  return res;
})();
const TREE_LIGHTS = (() => {
  const res = [];
  for (let i = 0; i < 46; i++) {
    const k = i / 46;
    const y = lerp(TREE.top + 60, TREE.base - 30, k);
    const half = lerp(26, 150, (y - TREE.top) / (TREE.base - TREE.top)) * 0.9;
    const x = TREE.x + Math.sin(k * 26) * half;
    res.push({ x, y, c: ['#ffdf6b', '#ff6b6b', '#7be0ff', '#a6ff8a'][i % 4], ph: hash(i + 500) * TAU });
  }
  return res;
})();

function drawTree(ctx) {
  // pień
  ctx.fillStyle = '#4a2a12';
  ctx.fillRect(TREE.x - 18, TREE.base - 40, 36, 60);
  // donica
  ctx.fillStyle = '#9b2230';
  ctx.beginPath();
  ctx.moveTo(TREE.x - 55, TREE.base + 5); ctx.lineTo(TREE.x + 55, TREE.base + 5);
  ctx.lineTo(TREE.x + 42, TREE.base + 58); ctx.lineTo(TREE.x - 42, TREE.base + 58);
  ctx.fill();
  ctx.fillStyle = '#e7b54a';
  ctx.fillRect(TREE.x - 56, TREE.base + 2, 112, 9);
  const layers = treeLayers().reverse();
  for (const l of layers) {
    const g = ctx.createLinearGradient(TREE.x - l.w, 0, TREE.x + l.w, 0);
    g.addColorStop(0, '#0f4a2b');
    g.addColorStop(0.45, '#1f7a45');
    g.addColorStop(1, '#0c3a22');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(TREE.x, l.y - l.h);
    ctx.quadraticCurveTo(TREE.x + l.w * 0.4, l.y - l.h * 0.4, TREE.x + l.w, l.y);
    for (let s = 4; s >= 0; s--) {
      const sx = TREE.x - l.w + (2 * l.w * s) / 4;
      ctx.quadraticCurveTo(sx + l.w / 4, l.y + 16, sx, l.y);
    }
    ctx.quadraticCurveTo(TREE.x - l.w * 0.4, l.y - l.h * 0.4, TREE.x, l.y - l.h);
    ctx.fill();
    // śnieżny brzeg gałęzi
    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.lineWidth = 3;
    ctx.stroke();
  }
  // łańcuch
  ctx.strokeStyle = '#e9c45a';
  ctx.lineWidth = 3;
  for (let i = 0; i < 4; i++) {
    const y0 = lerp(TREE.top + 120, TREE.base - 80, i / 3);
    const half = lerp(40, 130, (y0 - TREE.top) / (TREE.base - TREE.top));
    ctx.beginPath();
    ctx.moveTo(TREE.x - half, y0 - 10);
    ctx.quadraticCurveTo(TREE.x, y0 + 40, TREE.x + half, y0 + 20);
    ctx.stroke();
  }
  for (const o of ORNAMENTS) {
    const g = ctx.createRadialGradient(o.x - o.r / 3, o.y - o.r / 3, 1, o.x, o.y, o.r);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(0.25, o.c);
    g.addColorStop(1, 'rgba(0,0,0,0.6)');
    circle(ctx, o.x, o.y, o.r, g);
    ctx.fillStyle = '#e7b54a';
    ctx.fillRect(o.x - 3, o.y - o.r - 4, 6, 5);
  }
}

function drawGiftPile(ctx) {
  const gifts = [
    [455, 858, 70, 52, '#d6303d', '#f5d36a'], [520, 868, 56, 44, '#2f7bd6', '#ffffff'],
    [640, 880, 74, 50, '#7c3ad6', '#f5d36a'], [690, 860, 48, 64, '#1f9b5a', '#ff5a5a'],
    [486, 820, 46, 38, '#f2a93b', '#c8263a'],
  ];
  for (const [x, y, w, h, c, r] of gifts) drawGift(ctx, x, y, w, h, c, r);
}

function drawGift(ctx, x, y, w, h, c, r, ribbon = 1, bow = 1) {
  // x,y = środek dolnej krawędzi
  ctx.fillStyle = c;
  ctx.fillRect(x - w / 2, y - h, w, h);
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.fillRect(x + w / 6, y - h, w / 3, h);
  ctx.fillStyle = 'rgba(255,255,255,0.15)';
  ctx.fillRect(x - w / 2, y - h, w, 6);
  ctx.fillStyle = r;
  if (ribbon > 0) {
    ctx.fillRect(x - 4, y - h * clamp(ribbon * 2), 8, h * clamp(ribbon * 2));
    if (ribbon > 0.5) ctx.fillRect(x - (w / 2) * clamp((ribbon - 0.5) * 2), y - h / 2 - 4, w * clamp((ribbon - 0.5) * 2), 8);
  }
  if (bow > 0) {
    const s = bow;
    ellipse(ctx, x - 10 * s, y - h - 6 * s, 11 * s, 7 * s, r, -0.5);
    ellipse(ctx, x + 10 * s, y - h - 6 * s, 11 * s, 7 * s, r, 0.5);
    circle(ctx, x, y - h - 4 * s, 5 * s, r);
  }
}

function drawThrone(ctx) {
  const cx = 360;
  ctx.save();
  // cień
  ellipse(ctx, cx, 990, 210, 34, 'rgba(0,0,0,0.35)');
  // oparcie
  const back = ctx.createLinearGradient(cx - 170, 0, cx + 170, 0);
  back.addColorStop(0, '#5e0d18');
  back.addColorStop(0.5, '#a51e2e');
  back.addColorStop(1, '#5e0d18');
  ctx.beginPath();
  ctx.moveTo(cx - 165, 900);
  ctx.lineTo(cx - 165, 560);
  ctx.bezierCurveTo(cx - 165, 440, cx - 70, 418, cx, 400);
  ctx.bezierCurveTo(cx + 70, 418, cx + 165, 440, cx + 165, 560);
  ctx.lineTo(cx + 165, 900);
  ctx.closePath();
  ctx.fillStyle = '#c99a2e';
  ctx.fill();
  ctx.save();
  ctx.translate(cx, 0); ctx.scale(0.9, 1); ctx.translate(-cx, 0);
  ctx.beginPath();
  ctx.moveTo(cx - 165, 890);
  ctx.lineTo(cx - 165, 565);
  ctx.bezierCurveTo(cx - 165, 455, cx - 70, 436, cx, 420);
  ctx.bezierCurveTo(cx + 70, 436, cx + 165, 455, cx + 165, 565);
  ctx.lineTo(cx + 165, 890);
  ctx.closePath();
  ctx.fillStyle = back;
  ctx.fill();
  ctx.restore();
  // pikowanie
  for (let r = 0; r < 6; r++) for (let c = -2; c <= 2; c++) {
    const bx = cx + c * 50 + (r % 2 ? 25 : 0), by = 480 + r * 62;
    if (Math.abs(bx - cx) > 130) continue;
    circle(ctx, bx, by, 4, 'rgba(255,215,120,0.85)');
    ellipse(ctx, bx, by, 18, 12, 'rgba(0,0,0,0.08)');
  }
  // korona na szczycie
  ctx.fillStyle = '#e8b93c';
  ctx.beginPath();
  ctx.moveTo(cx - 40, 410); ctx.lineTo(cx - 28, 375); ctx.lineTo(cx - 12, 400); ctx.lineTo(cx, 360);
  ctx.lineTo(cx + 12, 400); ctx.lineTo(cx + 28, 375); ctx.lineTo(cx + 40, 410);
  ctx.closePath(); ctx.fill();
  circle(ctx, cx, 360, 7, '#ff4d5e');
  // podłokietniki
  for (const s of [-1, 1]) {
    const ax = cx + s * 178;
    const ag = ctx.createLinearGradient(ax - 30, 0, ax + 30, 0);
    ag.addColorStop(0, '#a87a1e'); ag.addColorStop(0.5, '#f0c652'); ag.addColorStop(1, '#a87a1e');
    ctx.fillStyle = ag;
    roundRect(ctx, ax - 30, 770, 60, 140, 16);
    ctx.fill();
    ellipse(ctx, ax, 772, 38, 20, '#f2cb5c');
    ellipse(ctx, ax, 772, 26, 12, '#c4932a');
    // nogi tronu
    ctx.fillStyle = '#b8862a';
    roundRect(ctx, ax - 18, 900, 36, 80, 10);
    ctx.fill();
    circle(ctx, ax, 985, 16, '#e7b54a');
  }
  // siedzisko
  ctx.fillStyle = '#8c1524';
  roundRect(ctx, cx - 160, 860, 320, 60, 22);
  ctx.fill();
  ctx.fillStyle = '#e7b54a';
  ctx.fillRect(cx - 160, 912, 320, 10);
  ctx.restore();
}

function drawGarlandBase(ctx) {
  ctx.save();
  for (let x = -20; x < W + 20; x += 7) {
    const y = garlandY(x);
    for (let k = 0; k < 3; k++) {
      ellipse(ctx, x + hash(x + k) * 10 - 5, y + hash(x * 3 + k) * 16 - 8, 12, 7,
        k === 0 ? '#0e3d22' : k === 1 ? '#17572f' : '#21703d', hash(x + k * 9) * 3);
    }
  }
  ctx.restore();
}
function garlandY(x) {
  const seg = 240;
  const p = ((x % seg) + seg) % seg / seg;
  return 64 + Math.sin(p * Math.PI) * 46;
}

let bgCache = null;
function background() {
  if (bgCache) return bgCache;
  const c = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(W, H) : Object.assign(document.createElement('canvas'), { width: W, height: H });
  const ctx = c.getContext('2d');
  drawWall(ctx);
  drawFloor(ctx);
  drawWindowView(ctx);
  bgCache = { base: c };
  // warstwa nad śniegiem w oknie
  const c2 = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(W, H) : Object.assign(document.createElement('canvas'), { width: W, height: H });
  const ctx2 = c2.getContext('2d');
  drawWindowFrame(ctx2);
  drawGarlandBase(ctx2);
  drawTree(ctx2);
  drawGiftPile(ctx2);
  drawThrone(ctx2);
  bgCache.over = c2;
  return bgCache;
}

// ---------------------------------------------------------------- elementy animowane

function drawSnowInWindow(ctx, t) {
  const { x, y, w, h } = WIN;
  ctx.save();
  windowPath(ctx, x, y, w, h);
  ctx.clip();
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  for (let i = 0; i < 70; i++) {
    const sp = 22 + hash(i) * 30;
    const yy = ((hash(i + 7) * h + t * sp) % (h + 20)) + y - 10;
    const xx = x + ((hash(i + 13) * w + Math.sin(t * 0.8 + i) * 10) % w);
    circle(ctx, xx, yy, 1.2 + hash(i + 21) * 2.2);
  }
  ctx.restore();
}

function drawGarlandLights(ctx, t) {
  const cols = ['#ff5a5a', '#ffd34d', '#5ad1ff', '#7dff7a', '#ff8af0'];
  for (let i = 0; i < 24; i++) {
    const x = 15 + i * 30;
    const y = garlandY(x) + 10;
    const on = 0.45 + 0.55 * (0.5 + 0.5 * Math.sin(t * 2.4 + i * 1.7));
    const c = cols[i % cols.length];
    ctx.save();
    ctx.globalAlpha = on * 0.45;
    const g = ctx.createRadialGradient(x, y, 0, x, y, 22);
    g.addColorStop(0, c); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - 22, y - 22, 44, 44);
    ctx.restore();
    ctx.fillStyle = '#333'; ctx.fillRect(x - 3, y - 10, 6, 5);
    ellipse(ctx, x, y, 5, 8, c);
    ctx.globalAlpha = on;
    ellipse(ctx, x - 1.5, y - 2, 2, 3, 'rgba(255,255,255,0.9)');
    ctx.globalAlpha = 1;
  }
}

function drawTreeLights(ctx, t) {
  for (const l of TREE_LIGHTS) {
    const on = 0.5 + 0.5 * Math.sin(t * 3 + l.ph);
    ctx.save();
    ctx.globalAlpha = 0.25 + on * 0.5;
    const g = ctx.createRadialGradient(l.x, l.y, 0, l.x, l.y, 14);
    g.addColorStop(0, l.c); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(l.x - 14, l.y - 14, 28, 28);
    ctx.globalAlpha = 0.6 + on * 0.4;
    circle(ctx, l.x, l.y, 3.2, l.c);
    ctx.restore();
  }
  // gwiazda
  const s = 1 + 0.06 * Math.sin(t * 2);
  ctx.save();
  ctx.translate(TREE.x, TREE.top + 4);
  ctx.scale(s, s);
  const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, 70);
  glow.addColorStop(0, 'rgba(255,230,140,0.55)'); glow.addColorStop(1, 'rgba(255,230,140,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(-70, -70, 140, 140);
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 ? 13 : 32;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  ctx.closePath();
  const sg = ctx.createLinearGradient(0, -30, 0, 30);
  sg.addColorStop(0, '#fff6c2'); sg.addColorStop(1, '#f2b632');
  ctx.fillStyle = sg;
  ctx.fill();
  ctx.restore();
}

function drawSanta(ctx, t, st) {
  const cx = 360;
  const talk = st.mouth || 0;
  const reading = st.mode === 'letter';
  const breathe = Math.sin(t * 1.6) * 2.5;
  const nod = Math.sin(t * 1.15) * 0.025 + Math.sin(t * 3.1) * talk * 0.03;

  // nogi
  for (const s of [-1, 1]) {
    ctx.fillStyle = '#b3121f';
    roundRect(ctx, cx + s * 60 - 38, 860, 76, 105, 30);
    ctx.fill();
    ctx.fillStyle = '#f4f1ea';
    roundRect(ctx, cx + s * 60 - 42, 930, 84, 26, 13);
    ctx.fill();
    // buty
    ctx.fillStyle = '#1b1310';
    ctx.beginPath();
    ctx.ellipse(cx + s * 66, 985, 52, 26, 0, 0, TAU);
    ctx.fill();
    ctx.fillRect(cx + s * 60 - 34, 948, 68, 34);
    ellipse(ctx, cx + s * 74, 975, 18, 6, 'rgba(255,255,255,0.18)');
  }

  // tułów
  ctx.save();
  ctx.translate(0, breathe * 0.4);
  const coat = ctx.createRadialGradient(cx - 40, 720, 20, cx, 790, 200);
  coat.addColorStop(0, '#e2323f');
  coat.addColorStop(0.7, '#b3121f');
  coat.addColorStop(1, '#7a0a14');
  ctx.fillStyle = coat;
  ctx.beginPath();
  ctx.moveTo(cx - 105, 660);
  ctx.bezierCurveTo(cx - 175, 700, cx - 175, 880, cx - 120, 890);
  ctx.lineTo(cx + 120, 890);
  ctx.bezierCurveTo(cx + 175, 880, cx + 175, 700, cx + 105, 660);
  ctx.closePath();
  ctx.fill();
  // futrzany pas środkowy
  ctx.fillStyle = '#f4f1ea';
  roundRect(ctx, cx - 20, 760, 40, 132, 14);
  ctx.fill();
  // pasek
  ctx.fillStyle = '#1e1512';
  ctx.fillRect(cx - 160, 818, 320, 34);
  ctx.fillStyle = '#e7b54a';
  roundRect(ctx, cx - 30, 812, 60, 46, 8);
  ctx.fill();
  ctx.fillStyle = '#1e1512';
  roundRect(ctx, cx - 17, 822, 34, 26, 4);
  ctx.fill();
  ctx.restore();

  // ręce
  const armSwing = reading ? 0 : Math.sin(t * 2.2) * 8 * (0.3 + talk);
  const drawArm = (s, hx, hy) => {
    ctx.strokeStyle = '#b3121f';
    ctx.lineCap = 'round';
    ctx.lineWidth = 50;
    ctx.beginPath();
    ctx.moveTo(cx + s * 110, 690);
    ctx.quadraticCurveTo(cx + s * 170, 760, hx, hy);
    ctx.stroke();
    ctx.lineWidth = 0;
    // mankiet
    const ang = Math.atan2(hy - 760, hx - (cx + s * 170));
    ctx.save();
    ctx.translate(hx, hy);
    ctx.rotate(ang);
    ctx.fillStyle = '#f4f1ea';
    roundRect(ctx, -18, -30, 26, 60, 12);
    ctx.fill();
    ctx.restore();
    // rękawica
    circle(ctx, hx + Math.cos(ang) * 22, hy + Math.sin(ang) * 22, 24, '#1f1a17');
  };

  if (!reading) {
    drawArm(-1, cx - 172, 790 + armSwing);
    drawArm(1, cx + 172, 790 - armSwing);
  }

  // głowa
  ctx.save();
  const hx = cx, hy = 585 + breathe * 0.3;
  ctx.translate(hx, hy);
  ctx.rotate(nod);
  ctx.translate(-hx, -hy);

  // broda (tył)
  const beard = (dx, dy, r, c) => circle(ctx, hx + dx, hy + dy, r, c);
  const bc1 = '#e9e6df', bc2 = '#ffffff';
  const beardDrop = talk * 6;
  [[-70, 40, 42], [70, 40, 42], [-55, 90, 46], [55, 90, 46], [0, 110 + beardDrop, 58], [-30, 140 + beardDrop, 44], [30, 140 + beardDrop, 44], [0, 165 + beardDrop, 38], [-82, 0, 30], [82, 0, 30]]
    .forEach(([dx, dy, r]) => beard(dx, dy, r, bc1));
  [[-60, 35, 34], [60, 35, 34], [-40, 85, 38], [40, 85, 38], [0, 100 + beardDrop, 48], [-20, 135 + beardDrop, 34], [20, 135 + beardDrop, 34], [0, 155 + beardDrop, 28]]
    .forEach(([dx, dy, r]) => beard(dx - 4, dy - 4, r, bc2));

  // twarz
  const face = ctx.createRadialGradient(hx - 15, hy - 20, 10, hx, hy, 75);
  face.addColorStop(0, '#ffe0c7');
  face.addColorStop(1, '#eab58f');
  ellipse(ctx, hx, hy, 64, 70, face);
  // uszy
  ellipse(ctx, hx - 64, hy + 4, 13, 20, '#eab58f');
  ellipse(ctx, hx + 64, hy + 4, 13, 20, '#eab58f');
  // policzki
  ellipse(ctx, hx - 36, hy + 22, 17, 12, 'rgba(240,110,110,0.45)');
  ellipse(ctx, hx + 36, hy + 22, 17, 12, 'rgba(240,110,110,0.45)');

  // usta (pod wąsami)
  const mo = clamp(talk);
  const mouthH = 4 + mo * 20;
  const mouthW = 20 + mo * 6;
  ellipse(ctx, hx, hy + 48 + mouthH * 0.35, mouthW, mouthH, '#5a1a1a');
  if (mo > 0.25) {
    ellipse(ctx, hx, hy + 48 + mouthH * 0.9, mouthW * 0.6, mouthH * 0.35, '#d8606a');
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fillRect(hx - mouthW * 0.55, hy + 45, mouthW * 1.1, 4);
  }
  // broda pod ustami (przykrywa dół ust)
  [[-26, 82 + mo * 14, 26], [26, 82 + mo * 14, 26], [0, 92 + mo * 16, 28]].forEach(([dx, dy, r]) => beard(dx, dy, r, bc2));

  // oczy (mruganie)
  const blinkPhase = (t % 3.7) / 3.7;
  const blink = blinkPhase > 0.96 ? 0.1 : 1;
  const eyeY = hy - 10;
  const look = reading ? 6 : Math.sin(t * 0.5) * 2;
  for (const s of [-1, 1]) {
    ellipse(ctx, hx + s * 24, eyeY, 10, 11 * blink, '#ffffff');
    ellipse(ctx, hx + s * 24, eyeY + (reading ? 4 : 1) * blink, 6, 7 * blink, '#3b2a20');
    if (blink > 0.5) circle(ctx, hx + s * 24 - 2 + look * 0.2, eyeY - 2, 2.2, '#ffffff');
  }
  // okulary przy czytaniu
  if (reading) {
    ctx.strokeStyle = '#c99a2e';
    ctx.lineWidth = 3;
    for (const s of [-1, 1]) { ellipse(ctx, hx + s * 24, eyeY, 17, 15); ctx.stroke(); }
    ctx.beginPath(); ctx.moveTo(hx - 7, eyeY); ctx.lineTo(hx + 7, eyeY); ctx.stroke();
    ctx.fillStyle = 'rgba(200,230,255,0.15)';
    for (const s of [-1, 1]) ellipse(ctx, hx + s * 24, eyeY, 16, 14, 'rgba(200,230,255,0.15)');
  }
  // brwi
  const brow = talk * 4 + Math.max(0, Math.sin(t * 0.9)) * 2;
  for (const s of [-1, 1]) {
    for (let k = 0; k < 5; k++) {
      circle(ctx, hx + s * (12 + k * 8), eyeY - 22 - brow - Math.sin(k / 4 * Math.PI) * 5 + k * 0.5, 7 - Math.abs(k - 2) * 0.8, '#f7f5f0');
    }
  }
  // nos
  const ng = ctx.createRadialGradient(hx - 5, hy + 10, 2, hx, hy + 16, 18);
  ng.addColorStop(0, '#ffc1a8'); ng.addColorStop(1, '#e48a74');
  ellipse(ctx, hx, hy + 16, 16, 14, ng);
  // wąsy
  const mw = Math.sin(t * 3) * talk * 2;
  for (const s of [-1, 1]) {
    ctx.save();
    ctx.translate(hx + s * 2, hy + 36 - mo * 2);
    ctx.rotate(s * (0.12 + mw * 0.02));
    ellipse(ctx, s * 24, 0, 30, 13, '#f2efe8', s * 0.18);
    ellipse(ctx, s * 44, -6, 14, 9, '#f7f5f0', s * 0.5);
    ellipse(ctx, s * 20, -4, 22, 8, '#ffffff', s * 0.12);
    ctx.restore();
  }

  // czapka
  const flop = Math.sin(t * 1.3) * 0.06;
  ctx.save();
  ctx.translate(hx, hy - 52);
  ctx.fillStyle = '#c4161f';
  ctx.beginPath();
  ctx.moveTo(-66, 0);
  ctx.bezierCurveTo(-60, -90, 20, -120, 75, -78 + flop * 60);
  ctx.bezierCurveTo(95, -60 + flop * 60, 105, -20 + flop * 60, 110, 10 + flop * 40);
  ctx.bezierCurveTo(70, -40, 40, -40, 66, 0);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,0.15)';
  ctx.beginPath();
  ctx.moveTo(10, -60); ctx.bezierCurveTo(50, -80, 80, -70, 106, 4 + flop * 40); ctx.bezierCurveTo(70, -40, 40, -40, 30, -10);
  ctx.fill();
  // pompon
  circle(ctx, 112 + flop * 20, 16 + flop * 40, 20, '#f7f5f0');
  circle(ctx, 106 + flop * 20, 10 + flop * 40, 9, '#ffffff');
  // futrzany otok
  ctx.fillStyle = '#f4f1ea';
  roundRect(ctx, -76, -16, 152, 34, 17);
  ctx.fill();
  for (let k = 0; k < 7; k++) circle(ctx, -60 + k * 20, -6 + hash(k) * 6, 10, '#ffffff');
  ctx.restore();
  ctx.restore();

  // list w dłoniach
  if (reading || st.letterAmt > 0) {
    const a = reading ? 1 : st.letterAmt;
    drawLetterScroll(ctx, cx, 775 + (1 - a) * 60, a, t);
  }
}

function drawLetterScroll(ctx, cx, cy, amt, t) {
  ctx.save();
  ctx.globalAlpha = clamp(amt * 1.5);
  const w = 230 * (0.4 + 0.6 * ease(clamp(amt))), h = 150;
  // ręce trzymające
  ctx.strokeStyle = '#b3121f';
  ctx.lineCap = 'round';
  ctx.lineWidth = 46;
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(cx + s * 110, 690);
    ctx.quadraticCurveTo(cx + s * 165, 760, cx + s * (w / 2 + 8), cy);
    ctx.stroke();
  }
  const pg = ctx.createLinearGradient(cx - w / 2, 0, cx + w / 2, 0);
  pg.addColorStop(0, '#e9d6a8'); pg.addColorStop(0.5, '#fbf0d2'); pg.addColorStop(1, '#e3cd99');
  ctx.fillStyle = pg;
  ctx.fillRect(cx - w / 2, cy - h / 2 + Math.sin(t * 1.4) * 1.5, w, h);
  ctx.fillStyle = '#c9a868';
  roundRect(ctx, cx - w / 2 - 10, cy - h / 2 - 6, 20, h + 12, 10); ctx.fill();
  roundRect(ctx, cx + w / 2 - 10, cy - h / 2 - 6, 20, h + 12, 10); ctx.fill();
  ctx.strokeStyle = 'rgba(80,50,30,0.55)';
  ctx.lineWidth = 2;
  for (let i = 0; i < 6; i++) {
    const y = cy - h / 2 + 24 + i * 20;
    ctx.beginPath();
    ctx.moveTo(cx - w / 2 + 20, y);
    for (let x = cx - w / 2 + 20; x < cx + w / 2 - 20 - (i === 5 ? 60 : 0); x += 12) ctx.lineTo(x, y + Math.sin(x * 0.7 + i) * 2);
    ctx.stroke();
  }
  ellipse(ctx, cx + w / 2 - 38, cy + h / 2 - 22, 10, 8, '#d23a4a'); // serduszko-pieczęć
  for (const s of [-1, 1]) circle(ctx, cx + s * (w / 2 + 12), cy, 22, '#1f1a17');
  ctx.restore();
}

function drawElf(ctx, x, y, t, o) {
  const bob = Math.sin(t * 4 + o.ph) * 3;
  ctx.save();
  ctx.translate(x, y + bob);
  ctx.scale(o.s, o.s);
  // tułów
  ctx.fillStyle = '#2f8f3f';
  ctx.beginPath();
  ctx.moveTo(-34, 0); ctx.quadraticCurveTo(-40, -70, 0, -78); ctx.quadraticCurveTo(40, -70, 34, 0);
  ctx.closePath(); ctx.fill();
  // kołnierz w ząbki
  ctx.fillStyle = '#d62f3c';
  ctx.beginPath();
  for (let i = 0; i <= 6; i++) { const a = Math.PI + (i / 6) * Math.PI; ctx.lineTo(Math.cos(a) * 34, -74 + Math.sin(a) * -1 + (i % 2 ? 14 : 0)); }
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#1e1512'; ctx.fillRect(-34, -24, 68, 9);
  ctx.fillStyle = '#e7b54a'; ctx.fillRect(-7, -26, 14, 13);
  // głowa
  const hy = -104;
  ellipse(ctx, -30, hy + 2, 16, 7, '#f2c3a0', -0.5); // uszy
  ellipse(ctx, 30, hy + 2, 16, 7, '#f2c3a0', 0.5);
  circle(ctx, 0, hy, 28, '#f6cfae');
  ellipse(ctx, -14, hy + 9, 7, 5, 'rgba(240,110,110,0.5)');
  ellipse(ctx, 14, hy + 9, 7, 5, 'rgba(240,110,110,0.5)');
  const bl = ((t + o.ph) % 4.1) / 4.1 > 0.95 ? 0.15 : 1;
  ellipse(ctx, -10, hy - 2, 3.5, 4.5 * bl, '#2a1e18');
  ellipse(ctx, 10, hy - 2, 3.5, 4.5 * bl, '#2a1e18');
  ctx.strokeStyle = '#7a3a2a'; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.arc(0, hy + 7, 9, 0.2, Math.PI - 0.2); ctx.stroke();
  // czapka
  const sway = Math.sin(t * 2 + o.ph) * 10;
  ctx.fillStyle = o.hat;
  ctx.beginPath();
  ctx.moveTo(-30, hy - 12); ctx.quadraticCurveTo(-5, hy - 70, 20 + sway, hy - 88); ctx.quadraticCurveTo(10, hy - 50, 30, hy - 12);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#d62f3c';
  ctx.beginPath(); ctx.moveTo(-14, hy - 40); ctx.quadraticCurveTo(5, hy - 52, 18, hy - 42); ctx.lineTo(16, hy - 34); ctx.quadraticCurveTo(2, hy - 44, -18, hy - 32); ctx.fill();
  circle(ctx, 20 + sway, hy - 90, 7, '#f2c14e');
  ctx.fillStyle = '#f4f1ea';
  roundRect(ctx, -32, hy - 20, 64, 14, 7); ctx.fill();
  ctx.restore();
}

function drawElves(ctx, t) {
  const P = 3.6;
  const cyc = Math.floor(t / P);
  const ph = (t % P) / P;
  const colors = [['#d6303d', '#f5d36a'], ['#2f7bd6', '#ffffff'], ['#7c3ad6', '#f5d36a'], ['#f2a93b', '#c8263a'], ['#1f9b5a', '#ff5a5a']];
  const [bc, rc] = colors[cyc % colors.length];

  // elfy za stołem
  drawElf(ctx, 95, 1012, t, { s: 1, ph: 0, hat: '#2f8f3f' });
  drawElf(ctx, 262, 1018, t, { s: 0.92, ph: 1.3, hat: '#1f6f8f' });

  // stół
  ctx.fillStyle = '#6e3f1f';
  roundRect(ctx, 14, 1000, 320, 26, 8); ctx.fill();
  ctx.fillStyle = '#8d5429';
  ctx.fillRect(14, 1000, 320, 8);
  ctx.fillStyle = '#5a3218';
  ctx.fillRect(34, 1026, 18, 60); ctx.fillRect(296, 1026, 18, 60);

  // rolka papieru i nożyczki
  ctx.save();
  ctx.translate(40, 996);
  ctx.fillStyle = '#e04a5a'; roundRect(ctx, -6, -22, 60, 22, 10); ctx.fill();
  ctx.fillStyle = '#f5d36a'; for (let i = 0; i < 4; i++) circle(ctx, 6 + i * 14, -11, 3);
  ctx.restore();

  // pakowany prezent
  let gx = 170, alpha = 1;
  const ribbon = clamp((ph - 0.12) / 0.45);
  const bow = clamp((ph - 0.57) / 0.1);
  if (ph > 0.7) { gx = lerp(170, 300, ease(clamp((ph - 0.7) / 0.25))); }
  if (ph > 0.93) alpha = clamp(1 - (ph - 0.93) / 0.07);
  ctx.save();
  ctx.globalAlpha = alpha;
  drawGift(ctx, gx, 1000, 64, 48, bc, rc, ribbon, bow);
  ctx.restore();

  // ręce elfów pracujące przy prezencie
  const handA = ph < 0.7 ? Math.sin(ph * 40) * 10 : 0;
  ctx.fillStyle = '#f6cfae';
  ctx.strokeStyle = '#2f8f3f';
  ctx.lineWidth = 14; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(115, 950); ctx.quadraticCurveTo(140, 975, 146 + handA, 978 - Math.abs(handA)); ctx.stroke();
  circle(ctx, 148 + handA, 978 - Math.abs(handA), 8, '#f6cfae');
  ctx.strokeStyle = '#1f6f8f';
  const reach = ph > 0.65 ? ease(clamp((ph - 0.65) / 0.2)) : 0;
  ctx.beginPath(); ctx.moveTo(244, 955); ctx.quadraticCurveTo(220, 975, lerp(200, gx + 26, reach) - handA * 0.6, 980); ctx.stroke();
  circle(ctx, lerp(200, gx + 26, reach) - handA * 0.6, 980, 8, '#f6cfae');

  // stosik gotowych prezentów obok
  drawGift(ctx, 318, 1002, 30, 26, '#2f7bd6', '#fff');
  drawGift(ctx, 300, 976, 26, 22, '#d6303d', '#f5d36a');
}

function drawReindeer(ctx, t) {
  const x = 636, y = 1050;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(0.86, 0.86);
  // cień
  ellipse(ctx, 10, 40, 140, 18, 'rgba(0,0,0,0.3)');
  // ciało leżące
  const body = ctx.createLinearGradient(0, -40, 0, 40);
  body.addColorStop(0, '#a8703f'); body.addColorStop(1, '#6e4320');
  ellipse(ctx, 20, 6, 110, 42, body);
  ellipse(ctx, 30, 22, 80, 20, '#e8d3b0');
  // podwinięte nogi
  ctx.fillStyle = '#5f3a1c';
  roundRect(ctx, -70, 26, 60, 18, 9); ctx.fill();
  roundRect(ctx, 60, 28, 64, 16, 8); ctx.fill();
  ctx.fillStyle = '#2a1a10';
  circle(ctx, -72, 35, 9); circle(ctx, 124, 36, 8);
  // ogonek
  ellipse(ctx, 128, -14, 12, 8, '#f1e5cf', -0.6);
  // szyja i głowa
  const chew = Math.sin(t * 5) * 1.5;
  const headTilt = Math.sin(t * 0.7) * 0.06;
  ctx.save();
  ctx.translate(-70, -20);
  ctx.rotate(headTilt);
  ctx.fillStyle = '#9a6536';
  ctx.beginPath();
  ctx.moveTo(-10, 20); ctx.quadraticCurveTo(-30, -30, -20, -60); ctx.lineTo(20, -55); ctx.quadraticCurveTo(30, -10, 30, 25); ctx.fill();
  // poroże
  ctx.strokeStyle = '#d9c49a';
  ctx.lineWidth = 7; ctx.lineCap = 'round';
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(s * 10 - 2, -95);
    ctx.quadraticCurveTo(s * 30, -140, s * 22, -170);
    ctx.moveTo(s * 22, -125); ctx.lineTo(s * 46, -140);
    ctx.moveTo(s * 25, -150); ctx.lineTo(s * 8, -165);
    ctx.stroke();
  }
  // głowa
  ellipse(ctx, 0, -88, 30, 28, '#a8703f');
  ellipse(ctx, -16, -62 + chew * 0.3, 22, 16, '#c08a55', -0.3);
  // uszy (strzygą)
  const ear = Math.sin(t * 1.3) > 0.92 ? 0.4 : 0;
  ellipse(ctx, -30, -100, 16, 7, '#8a5a30', -0.5 - ear);
  ellipse(ctx, 30, -100, 16, 7, '#8a5a30', 0.5 + ear);
  // oczy
  const bl = ((t + 1.7) % 5.3) / 5.3 > 0.95 ? 0.15 : 1;
  ellipse(ctx, -12, -94, 5, 6 * bl, '#1b120c');
  ellipse(ctx, 12, -94, 5, 6 * bl, '#1b120c');
  if (bl > 0.5) { circle(ctx, -10, -96, 1.8, '#fff'); circle(ctx, 14, -96, 1.8, '#fff'); }
  // nos (brązowy)
  ellipse(ctx, -26, -58 + chew * 0.3, 9, 7, '#3a2416');
  ctx.restore();
  // dzwoneczek na obroży
  ctx.fillStyle = '#c4161f';
  ctx.fillRect(-92, -10, 44, 8);
  circle(ctx, -70, 2, 7, '#f2c14e');
  ctx.restore();
}

export function drawSparkles(ctx, t, n = 18, area = [0, 0, W, 1100], alpha = 1) {
  for (let i = 0; i < n; i++) {
    const life = ((t * 0.35 + hash(i + 900)) % 1);
    const x = area[0] + hash(i + 1000) * area[2];
    const y = area[1] + area[3] - life * area[3] * 0.6 - hash(i + 1100) * area[3] * 0.4;
    const a = Math.sin(life * Math.PI) * alpha;
    const s = 2 + hash(i + 1200) * 4;
    ctx.save();
    ctx.globalAlpha = a;
    ctx.fillStyle = '#fff3b0';
    ctx.beginPath();
    ctx.moveTo(x, y - s * 2); ctx.lineTo(x + s * 0.5, y - s * 0.5); ctx.lineTo(x + s * 2, y); ctx.lineTo(x + s * 0.5, y + s * 0.5);
    ctx.lineTo(x, y + s * 2); ctx.lineTo(x - s * 0.5, y + s * 0.5); ctx.lineTo(x - s * 2, y); ctx.lineTo(x - s * 0.5, y - s * 0.5);
    ctx.fill();
    ctx.restore();
  }
}

export function drawFrontSnow(ctx, t, alpha) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = '#ffffff';
  for (let i = 0; i < 90; i++) {
    const sp = 40 + hash(i + 40) * 60;
    const yy = ((hash(i + 70) * H + t * sp) % (H + 20)) - 10;
    const xx = (hash(i + 90) * W + Math.sin(t + i) * 18 + W) % W;
    circle(ctx, xx, yy, 2 + hash(i + 33) * 3.5);
  }
  ctx.restore();
}

function lighting(ctx, t) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const flick = 0.9 + 0.1 * Math.sin(t * 7) * Math.sin(t * 3.3);
  const g = ctx.createRadialGradient(TREE.x, 600, 20, TREE.x, 600, 330);
  g.addColorStop(0, `rgba(255,190,90,${0.16 * flick})`);
  g.addColorStop(1, 'rgba(255,190,90,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  const g2 = ctx.createRadialGradient(360, 620, 40, 360, 620, 420);
  g2.addColorStop(0, 'rgba(255,220,160,0.12)');
  g2.addColorStop(1, 'rgba(255,220,160,0)');
  ctx.fillStyle = g2;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
  // winieta
  const v = ctx.createRadialGradient(W / 2, H * 0.48, H * 0.3, W / 2, H * 0.5, H * 0.75);
  v.addColorStop(0, 'rgba(0,0,0,0)');
  v.addColorStop(1, 'rgba(10,4,0,0.55)');
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, W, H);
}

// ---------------------------------------------------------------- napisy i plansze

function wrapLines(ctx, text, maxW) {
  const words = text.split(/\s+/);
  const lines = [];
  let cur = '';
  for (const w of words) {
    const test = cur ? cur + ' ' + w : w;
    if (ctx.measureText(test).width > maxW && cur) { lines.push(cur); cur = w; } else cur = test;
  }
  if (cur) lines.push(cur);
  return lines;
}

export function drawSubtitle(ctx, text, mode, alpha) {
  if (!text || alpha <= 0) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  const letter = mode === 'letter';
  let size = 36;
  let lines;
  for (;;) {
    ctx.font = `800 ${size}px Nunito, "Segoe UI", sans-serif`;
    lines = wrapLines(ctx, text, W - 110);
    if (lines.length <= 3 || size <= 24) break;
    size -= 3;
  }
  const lh = size * 1.22;
  const boxH = lines.length * lh + 46;
  const y0 = H - 30 - boxH;
  if (letter) {
    const pg = ctx.createLinearGradient(0, y0, 0, y0 + boxH);
    pg.addColorStop(0, '#fbf1d6'); pg.addColorStop(1, '#ead6a6');
    ctx.fillStyle = pg;
    roundRect(ctx, 26, y0, W - 52, boxH, 18);
    ctx.fill();
    ctx.strokeStyle = '#b8893a'; ctx.lineWidth = 4; ctx.stroke();
    ctx.fillStyle = '#4a2c14';
  } else {
    ctx.fillStyle = 'rgba(18,8,4,0.7)';
    roundRect(ctx, 26, y0, W - 52, boxH, 18);
    ctx.fill();
    ctx.strokeStyle = 'rgba(231,181,74,0.8)'; ctx.lineWidth = 3; ctx.stroke();
    ctx.fillStyle = '#ffffff';
  }
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  lines.forEach((l, i) => ctx.fillText(l, W / 2, y0 + 23 + lh / 2 + i * lh));
  ctx.restore();
}

export function goldText(ctx, text, x, y, size, alpha = 1) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.font = `${size}px Lobster, Georgia, serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.lineWidth = size * 0.16;
  ctx.strokeStyle = 'rgba(60,10,10,0.85)';
  ctx.strokeText(text, x, y);
  const g = ctx.createLinearGradient(0, y - size / 2, 0, y + size / 2);
  g.addColorStop(0, '#fff6c8'); g.addColorStop(0.5, '#f5c84c'); g.addColorStop(1, '#d48f1e');
  ctx.fillStyle = g;
  ctx.shadowColor = 'rgba(255,210,120,0.8)';
  ctx.shadowBlur = 18;
  ctx.fillText(text, x, y);
  ctx.restore();
}

export function fitSize(ctx, text, max, maxW) {
  let s = max;
  ctx.font = `${s}px Lobster, Georgia, serif`;
  while (ctx.measureText(text).width > maxW && s > 20) { s -= 2; ctx.font = `${s}px Lobster, Georgia, serif`; }
  return s;
}

// ---------------------------------------------------------------- główna funkcja

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} t czas w sekundach
 * @param {{mouth?:number, mode?:string, subtitle?:string, subAlpha?:number, title?:string, titleAlpha?:number,
 *          ending?:number, letterAmt?:number, zoom?:number}} st
 */
export function drawScene(ctx, t, st = {}) {
  const bg = background();
  ctx.save();
  const z = st.zoom || 1;
  if (z !== 1) {
    ctx.translate(360, 700);
    ctx.scale(z, z);
    ctx.translate(-360, -700);
  }
  ctx.drawImage(bg.base, 0, 0);
  drawSnowInWindow(ctx, t);
  ctx.drawImage(bg.over, 0, 0);
  drawGarlandLights(ctx, t);
  drawTreeLights(ctx, t);
  drawSanta(ctx, t, st);
  ctx.save(); ctx.translate(-8, 150); ctx.scale(0.86, 0.86); drawElves(ctx, t); ctx.restore();
  drawReindeer(ctx, t);
  drawSparkles(ctx, t, 14, [440, 220, 280, 640], 0.8);
  lighting(ctx, t);
  ctx.restore();

  if (st.ending > 0) {
    drawFrontSnow(ctx, t, clamp(st.ending * 1.5));
    drawSparkles(ctx, t * 1.6, 40, [0, 100, W, 900], clamp(st.ending * 1.5));
  }
  drawSubtitle(ctx, st.subtitle, st.mode, st.subAlpha ?? 1);

  if (st.titleAlpha > 0 && st.title) {
    ctx.save();
    ctx.globalAlpha = st.titleAlpha * 0.55;
    ctx.fillStyle = '#12060a';
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
    const s1 = fitSize(ctx, 'Film od', 64, W - 80);
    goldText(ctx, 'Film od', W / 2, 470, s1, st.titleAlpha);
    const s2 = fitSize(ctx, 'Świętego Mikołaja', 78, W - 60);
    goldText(ctx, 'Świętego Mikołaja', W / 2, 560, s2, st.titleAlpha);
    const s3 = fitSize(ctx, st.title, 70, W - 80);
    goldText(ctx, st.title, W / 2, 690, s3, st.titleAlpha);
  }
  if (st.ending > 0.3) {
    const a = clamp((st.ending - 0.3) / 0.3);
    const sz = fitSize(ctx, 'Wesołych Świąt!', 96, W - 60);
    goldText(ctx, 'Wesołych Świąt!', W / 2, 300, sz * (0.9 + 0.1 * a), a);
  }
}

/** Stan sceny dla czasu t na podstawie osi czasu filmu. */
export function stateAt(t, film) {
  const { timeline, envelope, fps, duration } = film;
  const f = Math.min(envelope.length - 1, Math.max(0, Math.floor(t * fps)));
  const cur = timeline.find((x) => t >= x.start - 0.05 && t <= x.end + 0.35);
  const prevIdx = timeline.findIndex((x) => x.start > t) - 1;
  const last = timeline[timeline.length - 1];
  const letterItems = timeline.filter((x) => x.section === 'letter');
  const lStart = letterItems.length ? letterItems[0].start - 1.1 : Infinity;
  const lEnd = letterItems.length ? letterItems[letterItems.length - 1].end + 0.6 : -Infinity;
  const inLetter = t >= lStart && t <= lEnd;
  let letterAmt = 0;
  if (t >= lStart - 0.6 && t < lStart) letterAmt = (t - (lStart - 0.6)) / 0.6;
  if (inLetter) letterAmt = 1;
  if (t > lEnd && t < lEnd + 0.6) letterAmt = 1 - (t - lEnd) / 0.6;

  // napis zostaje także w krótkich pauzach (płynniej się czyta)
  let sub = cur;
  if (!sub && prevIdx >= 0) {
    const p = timeline[prevIdx];
    const n = timeline[prevIdx + 1];
    if (n && n.start - p.end < 1.0) sub = p;
  }
  const endStart = last ? last.start : duration;
  // delikatne przybliżenie kamery podczas czytania listu
  const zIn = clamp((t - lStart) / 3), zOut = clamp((t - lEnd) / 2);
  const zoom = 1 + 0.05 * ease(zIn) * (1 - ease(zOut));
  return {
    mouth: envelope[f] || 0,
    mode: inLetter && letterAmt >= 1 ? 'letter' : 'talk',
    subtitle: sub ? sub.text : '',
    subAlpha: 1,
    title: film.titleText || '',
    titleAlpha: t < 2.4 ? clamp(t / 0.5) : clamp(1 - (t - 2.4) / 0.8),
    ending: t > endStart ? clamp((t - endStart) / 1.2) : 0,
    letterAmt,
    zoom,
  };
}
