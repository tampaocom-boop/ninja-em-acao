/* Ninja em Ação 3D
   Corrida em 3 pistas por 5 cenários + chefão final contra o Mão Afiada.
   Personagens e obstáculos são os desenhos do criador do jogo, transformados em cubinhos (voxels). */
import * as THREE from './three.module.min.js';

const IMG = window.__IMG;
const $ = id => document.getElementById(id);
const LANES = [-2.2, 0, 2.2];
const PHASE_LEN = 420;          // distância de cada fase

// ---------------- Modos ----------------
const MODES = [
  { nome: 'Fácil',   vidas: 3, vel0: 12, velMax: 24, acel: 0.20, ataque: 1.7, info: '3 vidas • começa rápido' },
  { nome: 'Médio',   vidas: 2, vel0: 15, velMax: 30, acel: 0.28, ataque: 1.35, info: '2 vidas • muito rápido' },
  { nome: 'Difícil', vidas: 1, vel0: 18, velMax: 36, acel: 0.36, ataque: 1.05, info: '1 vida • super rápido!' },
];
let modo = 1;
try { const g = localStorage.getItem('ninja3d-modo'); if (g === '0' || g === '1' || g === '2') modo = +g; } catch (e) {}
const M = () => MODES[modo];
const bestKey = () => 'ninja3d-recorde-' + modo;
function getBest() { try { return +(localStorage.getItem(bestKey()) || 0); } catch (e) { return 0; } }
function setBest(v) { try { localStorage.setItem(bestKey(), String(v)); } catch (e) {} }

// ---------------- Som (feito no aparelho) ----------------
let AC = null, master = null, muted = false;
function audio() {
  if (!AC) { const A = window.AudioContext || window.webkitAudioContext; if (!A) return null; AC = new A(); master = AC.createGain(); master.gain.value = 0.5; master.connect(AC.destination); }
  if (AC.state === 'suspended') AC.resume();
  return AC;
}
function tone(f, dur, type = 'square', vol = 0.12, when = 0, slide = null) {
  const a = audio(); if (!a || muted) return; const t = a.currentTime + when;
  const o = a.createOscillator(), g = a.createGain(); o.type = type; o.frequency.setValueAtTime(f, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + dur);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.02);
}
function noise(dur, vol = 0.3) {
  const a = audio(); if (!a || muted) return;
  const n = Math.floor(a.sampleRate * dur), b = a.createBuffer(1, n, a.sampleRate), d = b.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
  const s = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain(); f.type = 'lowpass'; f.frequency.value = 900; g.gain.value = vol;
  s.buffer = b; s.connect(f); f.connect(g); g.connect(master); s.start();
}
const SFX = {
  jump: () => tone(320, 0.16, 'square', 0.1, 0, 760),
  bigJump: () => tone(260, 0.3, 'square', 0.1, 0, 1200),
  roll: () => tone(500, 0.18, 'triangle', 0.12, 0, 160),
  lane: () => tone(700, 0.05, 'sine', 0.06),
  scroll: () => { tone(988, 0.07, 'square', 0.07); tone(1319, 0.09, 'square', 0.07, 0.05); },
  life: () => [784, 988, 1319].forEach((f, i) => tone(f, 0.12, 'sine', 0.14, i * 0.07)),
  power: () => [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 0.1, 'square', 0.09, i * 0.05)),
  shield: () => { tone(400, 0.3, 'sine', 0.15, 0, 900); noise(0.1, 0.15); },
  hit: () => { tone(150, 0.25, 'square', 0.18, 0, 60); noise(0.15, 0.25); },
  throw: () => tone(900, 0.2, 'sawtooth', 0.06, 0, 300),
  boom: () => { noise(0.9, 0.6); tone(90, 0.7, 'sawtooth', 0.18, 0, 30); },
  phase: () => [659, 784, 988].forEach((f, i) => tone(f, 0.15, 'square', 0.1, i * 0.1)),
  over: () => [392, 330, 262, 196].forEach((f, i) => tone(f, 0.28, 'triangle', 0.16, i * 0.18)),
  win: () => [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => tone(f, 0.22, 'square', 0.1, i * 0.13)),
};
const SONGS = [
  [330, 392, 494, 392, 349, 440, 523, 440, 330, 392, 494, 587, 523, 494, 440, 392],
  [392, 440, 494, 587, 494, 440, 392, 330, 392, 440, 494, 659, 587, 494, 440, 392],
  [220, 262, 330, 262, 247, 294, 370, 294, 220, 262, 330, 392, 370, 330, 294, 262],
  [330, 330, 392, 330, 440, 392, 330, 294, 330, 392, 440, 523, 494, 440, 392, 330],
  [196, 233, 294, 233, 185, 220, 277, 220, 196, 233, 294, 349, 330, 294, 277, 233],
  [147, 175, 220, 175, 147, 175, 233, 220, 147, 175, 220, 262, 247, 220, 175, 165],
];
let songStep = 0, songT = 0;
function music(dt) {
  if (!AC || muted || state !== 'play') return;
  songT -= dt; if (songT > 0) return;
  const s = SONGS[Math.min(phase, 5)];
  const f = s[songStep % s.length]; tone(f, 0.14, 'triangle', 0.05); if (songStep % 2 === 0) tone(f / 2, 0.16, 'square', 0.025);
  songStep++; songT = Math.max(0.12, 0.2 - speed * 0.002);
}

// ---------------- Cena ----------------
const canvas = $('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xe9dfc2);
scene.fog = new THREE.Fog(0xe9dfc2, 22, 75);
const camera = new THREE.PerspectiveCamera(62, 1, 0.1, 140);
const hemi = new THREE.HemisphereLight(0xfff7e6, 0x8a6a45, 1.6); scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffffff, 1.4); sun.position.set(3, 8, 6); scene.add(sun);

const isFlow = () => document.documentElement.classList.contains('flow');
function resize() {
  const box = $('game');
  if (isFlow()) {
    const w = box.clientWidth || 360;
    const sw = screen.width || 390, sh = screen.height || 844;
    const land = (screen.orientation && String(screen.orientation.type).indexOf('landscape') === 0) || Math.abs(window.orientation || 0) === 90;
    const maxH = (land ? Math.min(sw, sh) : Math.max(sw, sh)) - 170;
    box.style.height = Math.max(260, Math.min(w * 1.5, maxH)) + 'px';
  }
  const w = box.clientWidth || 360, h = box.clientHeight || 640;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.fov = w / h < 0.8 ? 70 : 60;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
if (window.ResizeObserver) new ResizeObserver(resize).observe($('game'));

// ---------------- Desenho -> cubinhos (só a casca) ----------------
function loadImg(src) { return new Promise(r => { const i = new Image(); i.onload = () => r(i); i.onerror = () => r(null); i.src = src; }); }
const voxelMat = new THREE.MeshLambertMaterial({ vertexColors: true });
const FACES = [
  { n: [1, 0, 0],  c: [[1,0,0],[1,1,0],[1,1,1],[1,0,1]] },
  { n: [-1, 0, 0], c: [[0,0,1],[0,1,1],[0,1,0],[0,0,0]] },
  { n: [0, 1, 0],  c: [[0,1,1],[1,1,1],[1,1,0],[0,1,0]] },
  { n: [0, -1, 0], c: [[0,0,0],[1,0,0],[1,0,1],[0,0,1]] },
  { n: [0, 0, 1],  c: [[1,0,1],[1,1,1],[0,1,1],[0,0,1]] },
  { n: [0, 0, -1], c: [[0,0,0],[0,1,0],[1,1,0],[1,0,0]] },
];
async function voxel(name, cols, height, depth, centerY = false) {
  const im = await loadImg(IMG[name]);
  const g = new THREE.Group(); if (!im) return g;
  const W = im.naturalWidth || 64, H = im.naturalHeight || 64;
  const rows = Math.max(1, Math.round(cols * H / W)), S = 4;
  const c = document.createElement('canvas'); c.width = cols * S; c.height = rows * S;
  const x = c.getContext('2d'); x.drawImage(im, 0, 0, cols * S, rows * S);
  const d = x.getImageData(0, 0, cols * S, rows * S).data;
  const grid = new Array(cols * rows).fill(null);
  for (let y = 0; y < rows; y++) for (let cx = 0; cx < cols; cx++) {
    const i = ((y * S + 2) * cols * S + (cx * S + 2)) * 4;
    if (d[i + 3] > 150) { const col = new THREE.Color(); col.setRGB(d[i] / 255, d[i + 1] / 255, d[i + 2] / 255, THREE.SRGBColorSpace); grid[y * cols + cx] = col; }
  }
  const filled = (cx, y, l) => cx >= 0 && cx < cols && y >= 0 && y < rows && l >= 0 && l < depth && grid[y * cols + cx] !== null;
  const size = height / rows, pos = [], nor = [], colr = [];
  const yOff = centerY ? -height / 2 : 0;
  for (let y = 0; y < rows; y++) for (let cx = 0; cx < cols; cx++) {
    const col = grid[y * cols + cx]; if (!col) continue;
    for (let l = 0; l < depth; l++) {
      const X0 = (cx - cols / 2) * size, Y0 = (rows - 1 - y) * size + yOff, Z0 = (l - depth / 2) * size;
      for (const f of FACES) {
        if (filled(cx + f.n[0], y - f.n[1], l + f.n[2])) continue;
        const shade = f.n[1] === 1 ? 1.08 : f.n[1] === -1 ? 0.7 : f.n[0] !== 0 ? 0.88 : 1;
        const q = f.c.map(([a, b, e]) => [X0 + a * size, Y0 + b * size, Z0 + e * size]);
        for (const k of [0, 1, 2, 0, 2, 3]) { pos.push(...q[k]); nor.push(...f.n); colr.push(col.r * shade, col.g * shade, col.b * shade); }
      }
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colr, 3));
  g.add(new THREE.Mesh(geo, voxelMat));
  g.userData = { w: cols * size, h: rows * size, d: depth * size };
  return g;
}

// ---------------- Texturas (desenhadas no aparelho) ----------------
function canvasTex(w, h, paint, rx, ry) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; paint(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx, ry);
  t.anisotropy = 4; return t;
}
const rnd = (a, b) => a + Math.random() * (b - a);
function seeded(seed) { let s = seed; return () => { s = (s * 9301 + 49297) % 233280; return s / 233280; }; }

const TEX = {
  // Escola
  wood: () => canvasTex(256, 256, (x, w, h) => {
    x.fillStyle = '#b07a44'; x.fillRect(0, 0, w, h);
    for (let i = 0; i < 8; i++) { x.fillStyle = i % 2 ? '#a8723f' : '#b8834c'; x.fillRect(i * 32, 0, 32, h); }
    x.strokeStyle = '#7a4f28'; x.lineWidth = 3; for (let i = 0; i <= 8; i++) { x.beginPath(); x.moveTo(i * 32, 0); x.lineTo(i * 32, h); x.stroke(); }
    for (let i = 0; i < 8; i++) { x.beginPath(); const y = (i * 97) % h; x.moveTo(i * 32, y); x.lineTo(i * 32 + 32, y); x.stroke(); }
  }, 3, 40),
  lockers: () => canvasTex(256, 256, (x, w, h) => {
    x.fillStyle = '#ebdfc0'; x.fillRect(0, 0, w, h); x.fillStyle = '#c9b88f'; x.fillRect(0, 0, w, 20);
    for (let i = 0; i < 4; i++) {
      const X = i * 64 + 3; x.fillStyle = '#3b6fd1'; x.fillRect(X, 40, 58, 216); x.strokeStyle = '#1f3f86'; x.lineWidth = 4; x.strokeRect(X, 40, 58, 216);
      x.fillStyle = '#244f9e'; for (let k = 0; k < 3; k++) x.fillRect(X + 10, 58 + k * 14, 38, 6);
      x.fillStyle = '#eef2ff'; x.fillRect(X + 46, 150, 5, 24);
    }
  }, 30, 1),
  schoolCeil: () => canvasTex(256, 256, (x, w, h) => { x.fillStyle = '#d9cba6'; x.fillRect(0, 0, w, h); x.fillStyle = '#fff6cf'; x.fillRect(64, 90, 128, 60); }, 1, 20),
  // Pátio
  grass: () => canvasTex(256, 256, (x, w, h) => {
    for (let i = 0; i < 8; i++) { x.fillStyle = i % 2 ? '#4caf50' : '#43a047'; x.fillRect(0, i * 32, w, 32); }
    const r = seeded(7); x.fillStyle = '#2e7d32'; for (let i = 0; i < 300; i++) x.fillRect(r() * w, r() * h, 2, 4);
  }, 2, 40),
  hedge: () => canvasTex(512, 256, (x, w, h) => {
    x.clearRect(0, 0, w, h);
    const r = seeded(3);
    for (let i = 0; i < 6; i++) { const X = i * 90 + 20; x.fillStyle = '#6d4c2f'; x.fillRect(X + 30, 70, 14, 120); x.fillStyle = i % 2 ? '#2e7d32' : '#388e3c'; x.beginPath(); x.arc(X + 37, 70, 48, 0, Math.PI * 2); x.fill(); }
    x.fillStyle = '#ffffff'; for (let i = 0; i < w; i += 24) x.fillRect(i, 170, 8, 50); x.fillRect(0, 178, w, 8); x.fillRect(0, 205, w, 8);
    x.fillStyle = '#2e7d32'; x.fillRect(0, 215, w, 41); x.fillStyle = '#1b5e20'; for (let i = 0; i < 80; i++) x.fillRect(r() * w, 215 + r() * 40, 6, 6);
  }, 12, 1),
  // Telhados
  roof: () => canvasTex(256, 256, (x, w, h) => {
    x.fillStyle = '#8d3b2a'; x.fillRect(0, 0, w, h);
    for (let y = 0; y < 8; y++) for (let i = 0; i < 9; i++) { x.fillStyle = (i + y) % 2 ? '#a5452f' : '#97402c'; x.fillRect(i * 32 - (y % 2) * 16, y * 32, 30, 28); }
  }, 3, 40),
  city: () => canvasTex(512, 256, (x, w, h) => {
    x.clearRect(0, 0, w, h); const r = seeded(11);
    let X = 0; while (X < w) { const bw = 40 + r() * 60, bh = 90 + r() * 160; x.fillStyle = r() < 0.5 ? '#232a4d' : '#2c3560'; x.fillRect(X, h - bh, bw, bh);
      for (let yy = h - bh + 10; yy < h - 10; yy += 18) for (let xx = X + 6; xx < X + bw - 10; xx += 14) { x.fillStyle = r() < 0.55 ? '#ffd86b' : '#3a4270'; x.fillRect(xx, yy, 7, 9); }
      X += bw + 4; }
  }, 10, 1),
  // Trem
  trainRoof: () => canvasTex(256, 256, (x, w, h) => {
    x.fillStyle = '#9aa3ad'; x.fillRect(0, 0, w, h);
    x.fillStyle = '#c0392b'; x.fillRect(0, 0, 20, h); x.fillRect(w - 20, 0, 20, h);
    x.strokeStyle = '#6c757d'; x.lineWidth = 3; for (let y = 0; y < h; y += 64) { x.beginPath(); x.moveTo(0, y); x.lineTo(w, y); x.stroke(); }
    x.fillStyle = '#5f6b75'; for (let y = 8; y < h; y += 16) { x.fillRect(26, y, 4, 4); x.fillRect(w - 30, y, 4, 4); }
  }, 1, 40),
  scenery: () => canvasTex(512, 256, (x, w, h) => {
    x.clearRect(0, 0, w, h); const r = seeded(5);
    x.fillStyle = '#7a4a3a'; x.beginPath(); x.moveTo(0, h); for (let i = 0; i <= w; i += 32) x.lineTo(i, 120 + Math.sin(i / 60) * 30); x.lineTo(w, h); x.fill();
    for (let i = 0; i < 10; i++) { const X = r() * w; x.fillStyle = '#4e2f26'; x.fillRect(X, 150, 8, 60); x.fillStyle = '#3d6b3a'; x.beginPath(); x.arc(X + 4, 145, 22, 0, Math.PI * 2); x.fill(); }
    x.fillStyle = '#555'; x.fillRect(0, 236, w, 20);
  }, 8, 1),
  // Museu
  checker: () => canvasTex(256, 256, (x, w, h) => { for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { x.fillStyle = (i + j) % 2 ? '#c8bfa8' : '#5d5446'; x.fillRect(i * 64, j * 64, 64, 64); } }, 2, 30),
  gallery: () => canvasTex(512, 256, (x, w, h) => {
    x.fillStyle = '#5a1f2a'; x.fillRect(0, 0, w, h); x.fillStyle = '#3d141c'; x.fillRect(0, h - 40, w, 40);
    const cols = ['#4f7cac', '#3d6b3a', '#c0a060', '#8e44ad'];
    for (let i = 0; i < 4; i++) { const X = i * 128 + 24; x.fillStyle = '#d4a017'; x.fillRect(X - 8, 52, 96, 96); x.fillStyle = cols[i]; x.fillRect(X, 60, 80, 80); x.fillStyle = '#f5e6c0'; x.beginPath(); x.arc(X + 40, 95, 14, 0, Math.PI * 2); x.fill(); }
    x.fillStyle = '#b8a98a'; for (let i = 0; i < 4; i++) x.fillRect(i * 128 + 116, 0, 10, h);
  }, 12, 1),
  museumCeil: () => canvasTex(256, 256, (x, w, h) => { x.fillStyle = '#2a2235'; x.fillRect(0, 0, w, h); x.fillStyle = '#fff2c4'; x.beginPath(); x.arc(128, 128, 30, 0, Math.PI * 2); x.fill(); }, 1, 20),
};

// ---------------- Cenários (fases) ----------------
const THEMES = [
  { nome: 'Escola',   banner: 'nome-fase-1', sky: 0xe9dfc2, fog: [22, 75], hemi: [0xfff7e6, 0x8a6a45, 1.6], floor: 'wood', wall: 'lockers', ceil: 'schoolCeil', line: 0x8a5a2e,
    low: ['bola', 'mochila', 'balde', 'caixa', 'cone'], fly: ['pombo-voador', 'morcego-voador'], block: 'lockerBlock' },
  { nome: 'Pátio',    banner: 'nome-fase-2', sky: 0x8fd3ff, fog: [28, 95], hemi: [0xffffff, 0x4a7a3a, 1.7], floor: 'grass', wall: 'hedge', ceil: null, line: 0xffffff,
    low: ['espinhos', 'pedra', 'bola'], fly: ['pombo-voador'], block: 'bush' },
  { nome: 'Telhados', banner: 'nome-fase-3', sky: 0x1b2140, fog: [18, 72], hemi: [0x9fb0ff, 0x2a1a1a, 1.25], floor: 'roof', wall: 'city', ceil: null, line: 0x5e2a1d,
    low: ['caixa', 'antena'], fly: ['morcego-voador'], block: 'chimney' },
  { nome: 'Trem',     banner: 'nome-fase-4', sky: 0xf6a35c, fog: [24, 90], hemi: [0xffe0b0, 0x6a3a2a, 1.6], floor: 'trainRoof', wall: 'scenery', ceil: null, line: 0x6c757d,
    low: ['placa', 'cone'], fly: ['pombo-voador'], block: 'vent', wallSpeed: 3 },
  { nome: 'Museu',    banner: 'nome-fase-5', sky: 0x2a2235, fog: [18, 66], hemi: [0xffe9c4, 0x2a1f30, 1.35], floor: 'checker', wall: 'gallery', ceil: 'museumCeil', line: 0x3a3226,
    low: ['ossos'], fly: ['morcego-voador'], block: 'armor' },
];
const texCache = {};
const getTex = n => texCache[n] || (texCache[n] = TEX[n]());

const world = new THREE.Group(); scene.add(world);
const LEN = 200;
const floorMat = new THREE.MeshLambertMaterial(), wallMat = new THREE.MeshLambertMaterial({ side: THREE.DoubleSide }), ceilMat = new THREE.MeshBasicMaterial({ fog: true });
const floor = new THREE.Mesh(new THREE.PlaneGeometry(9, LEN), floorMat); floor.rotation.x = -Math.PI / 2; world.add(floor);
const wallGeo = new THREE.PlaneGeometry(LEN, 5);
const wallL = new THREE.Mesh(wallGeo, wallMat); wallL.rotation.y = Math.PI / 2; wallL.position.set(-4.5, 2.5, 0); world.add(wallL);
const wallR = new THREE.Mesh(wallGeo, wallMat); wallR.rotation.y = -Math.PI / 2; wallR.position.set(4.5, 2.5, 0); world.add(wallR);
const ceil = new THREE.Mesh(new THREE.PlaneGeometry(9, LEN), ceilMat); ceil.rotation.x = Math.PI / 2; ceil.position.y = 5; world.add(ceil);
const lineMat = new THREE.MeshBasicMaterial({ color: 0x8a5a2e });
for (const x of [-1.1, 1.1]) { const l = new THREE.Mesh(new THREE.PlaneGeometry(0.06, LEN), lineMat); l.rotation.x = -Math.PI / 2; l.position.set(x, 0.01, 0); world.add(l); }

let T = THEMES[0];
function applyTheme(i) {
  T = THEMES[Math.min(i, THEMES.length - 1)];
  scene.background.setHex(T.sky); scene.fog.color.setHex(T.sky); scene.fog.near = T.fog[0]; scene.fog.far = T.fog[1];
  hemi.color.setHex(T.hemi[0]); hemi.groundColor.setHex(T.hemi[1]); hemi.intensity = T.hemi[2];
  floorMat.map = getTex(T.floor); floorMat.needsUpdate = true;
  const wt = getTex(T.wall); const alpha = ['hedge', 'city', 'scenery'].includes(T.wall);
  wallMat.map = wt; wallMat.transparent = false; wallMat.alphaTest = alpha ? 0.5 : 0; wallMat.needsUpdate = true;
  wallL.position.x = alpha ? -6 : -4.5; wallR.position.x = alpha ? 6 : 4.5; floor.scale.x = alpha ? 14 / 9 : 1;
  ceil.visible = !!T.ceil; if (T.ceil) { ceilMat.map = getTex(T.ceil); ceilMat.needsUpdate = true; }
  lineMat.color.setHex(T.line);
}
function scrollTextures() {
  const f = getTex(T.floor); f.offset.y = (dist / LEN) * f.repeat.y;
  const w = getTex(T.wall); w.offset.x = -(dist / LEN) * w.repeat.x * (T.wallSpeed || 1);
  if (T.ceil) { const c = getTex(T.ceil); c.offset.y = (dist / LEN) * c.repeat.y; }
}

// ---------------- Personagens ----------------
const player = new THREE.Group(); scene.add(player);
let dpRun, dpJump, ma1, ma2, cinz;
const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.45, 20), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.25 }));
shadow.rotation.x = -Math.PI / 2; scene.add(shadow);
const bubble = new THREE.Mesh(new THREE.SphereGeometry(1.15, 20, 14), new THREE.MeshBasicMaterial({ color: 0x5ac8ff, transparent: true, opacity: 0.28, depthWrite: false }));
bubble.position.y = 0.9; player.add(bubble); bubble.visible = false;
const chaser = new THREE.Group(); scene.add(chaser);
const friend = new THREE.Group(); scene.add(friend);

// ---------------- Objetos da pista ----------------
const PROTOS = {};
let scrollProto, heartProto, bombProto, boomProto, starProto, knifeProto;
const BLOCKS = {}, POWERS = {};
const items = [];

function makeScrollProto() {
  const g = new THREE.Group();
  const paper = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.55, 12), new THREE.MeshLambertMaterial({ color: 0xf3e2b3, emissive: 0x6b5520 }));
  paper.rotation.z = Math.PI / 2; g.add(paper);
  const capM = new THREE.MeshLambertMaterial({ color: 0xc0392b, emissive: 0x401010 });
  for (const s of [-1, 1]) { const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.19, 0.08, 12), capM); cap.rotation.z = Math.PI / 2; cap.position.x = s * 0.3; g.add(cap); }
  const band = new THREE.Mesh(new THREE.TorusGeometry(0.165, 0.025, 6, 16), new THREE.MeshLambertMaterial({ color: 0xffd34a, emissive: 0x806010 })); band.rotation.y = Math.PI / 2; g.add(band);
  return g;
}
function boxProto(paint, w, h, d) {
  const g = new THREE.Group();
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshLambertMaterial({ map: canvasTex(128, 256, paint, 1, 1) }));
  m.position.y = h / 2; g.add(m); g.userData = { w, h, d }; return g;
}
async function makeBlocks() {
  BLOCKS.lockerBlock = boxProto((x, w, h) => {
    x.fillStyle = '#3b6fd1'; x.fillRect(0, 0, w, h); x.strokeStyle = '#1f3f86'; x.lineWidth = 8; x.strokeRect(0, 0, w, h);
    x.fillStyle = '#244f9e'; for (let k = 0; k < 4; k++) x.fillRect(24, 26 + k * 18, 80, 8);
    x.fillStyle = '#eef2ff'; x.fillRect(100, 130, 8, 34); x.fillStyle = '#ffd34a'; x.fillRect(0, h - 26, w, 10);
  }, 1.8, 2.6, 1.0);
  BLOCKS.bush = boxProto((x, w, h) => {
    x.fillStyle = '#2e7d32'; x.fillRect(0, 0, w, h); const r = seeded(9);
    for (let i = 0; i < 70; i++) { x.fillStyle = r() < 0.5 ? '#388e3c' : '#1b5e20'; x.beginPath(); x.arc(r() * w, r() * h, 10 + r() * 10, 0, Math.PI * 2); x.fill(); }
  }, 1.9, 2.4, 1.4);
  BLOCKS.chimney = boxProto((x, w, h) => {
    x.fillStyle = '#9c4a33'; x.fillRect(0, 0, w, h); x.strokeStyle = '#6d2f20'; x.lineWidth = 3;
    for (let y = 0; y < h; y += 16) { x.beginPath(); x.moveTo(0, y); x.lineTo(w, y); x.stroke(); for (let i = (y / 16) % 2 ? 0 : 16; i < w; i += 32) { x.beginPath(); x.moveTo(i, y); x.lineTo(i, y + 16); x.stroke(); } }
    x.fillStyle = '#333'; x.fillRect(0, 0, w, 20);
  }, 1.6, 2.6, 1.2);
  BLOCKS.vent = boxProto((x, w, h) => {
    x.fillStyle = '#b0b8bf'; x.fillRect(0, 0, w, h); x.fillStyle = '#7d868d'; for (let y = 30; y < h - 20; y += 14) x.fillRect(12, y, w - 24, 6);
    x.fillStyle = '#f1c40f'; x.fillRect(0, h - 20, w, 10);
  }, 1.8, 2.3, 1.4);
  const armor = await voxel('armadura', 18, 2.6, 6);
  armor.userData = { w: 1.3, h: 2.6, d: 0.9 }; BLOCKS.armor = armor;
}
function makePowers() {
  // Shuriken (ímã de pergaminhos)
  const sh = new THREE.Shape(); for (let i = 0; i < 8; i++) { const r = i % 2 ? 0.13 : 0.45, a = i * Math.PI / 4; i ? sh.lineTo(Math.cos(a) * r, Math.sin(a) * r) : sh.moveTo(Math.cos(a) * r, Math.sin(a) * r); }
  const sg = new THREE.Group(); const s = new THREE.Mesh(new THREE.ExtrudeGeometry(sh, { depth: 0.08, bevelEnabled: false }), new THREE.MeshLambertMaterial({ color: 0xcfd8dc, emissive: 0x405060 }));
  s.position.z = -0.04; sg.add(s); POWERS.ima = sg;
  // Escudo
  const eg = new THREE.Group();
  eg.add(new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.1, 20), new THREE.MeshLambertMaterial({ color: 0x2f6fe0, emissive: 0x102860 })));
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.05, 8, 24), new THREE.MeshLambertMaterial({ color: 0xffd34a, emissive: 0x806010 })); ring.rotation.x = Math.PI / 2; eg.add(ring);
  eg.children.forEach(c => { c.rotation.x = (c.rotation.x || 0) + Math.PI / 2; }); POWERS.escudo = eg;
  // Tênis de super pulo
  const tg = new THREE.Group(); const red = new THREE.MeshLambertMaterial({ color: 0xe8453c, emissive: 0x501010 }), white = new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0x404040 });
  const b1 = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.3, 0.3), red); b1.position.set(0.05, 0.05, 0); tg.add(b1);
  const b2 = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.25, 0.3), red); b2.position.set(-0.13, 0.3, 0); tg.add(b2);
  const sole = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.08, 0.32), white); sole.position.set(0.05, -0.13, 0); tg.add(sole);
  POWERS.pulo = tg;
}
function makeKnife() {
  const g = new THREE.Group();
  const blade = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.05, 0.8), new THREE.MeshLambertMaterial({ color: 0xe3e7ec, emissive: 0x303540 })); blade.position.z = 0.25; g.add(blade);
  const handle = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.1, 0.3), new THREE.MeshLambertMaterial({ color: 0x6e3b1f })); handle.position.z = -0.3; g.add(handle);
  return g;
}

function spawn(kind, lane, z, extra = {}) {
  let proto, y = 0, box;
  if (kind === 'low') { proto = PROTOS[extra.name]; box = { w: proto.userData.w * 0.85, h: proto.userData.h * 0.9, d: proto.userData.d * 0.9, y: 0 }; }
  else if (kind === 'fly') { proto = PROTOS[extra.name]; y = 1.45; box = { w: proto.userData.w * 0.85, h: proto.userData.h * 0.9, d: 0.6, y: 1.45 }; }
  else if (kind === 'wall') { proto = BLOCKS[T.block]; const u = proto.userData; box = { w: Math.min(1.7, u.w * 0.95), h: u.h, d: u.d, y: 0 }; }
  else if (kind === 'scroll') { proto = scrollProto; y = extra.y || 0.7; box = { w: 0.8, h: 0.8, d: 0.8, y: y - 0.4 }; }
  else if (kind === 'heart') { proto = heartProto; y = 0.9; box = { w: 0.9, h: 0.9, d: 0.9, y: 0.45 }; }
  else if (kind === 'power') { proto = POWERS[extra.name]; y = 1.0; box = { w: 1.0, h: 1.0, d: 1.0, y: 0.5 }; }
  else if (kind === 'bomb') { proto = bombProto; y = 0.1; box = { w: 1.0, h: 1.1, d: 1.0, y: 0 }; }
  else if (kind === 'knife') { proto = knifeProto; y = extra.y; box = { w: 0.9, h: 0.35, d: 1.0, y: extra.y - 0.17 }; }
  const obj = proto.clone(); obj.position.set(LANES[lane], y, z);
  scene.add(obj);
  const it = { kind, lane, z, obj, box, alive: true, name: extra.name, vz: extra.vz || 0 };
  items.push(it); return it;
}

// gerador de fileiras: sempre deixa uma saída
let nextRowZ = -30, rowCount = 0;
function genRow(z) {
  rowCount++;
  const r = Math.random();
  const lanes = [0, 1, 2].sort(() => Math.random() - 0.5);
  const nObs = rowCount < 3 ? 1 : (r < 0.45 ? 1 : r < 0.85 ? 2 : 3);
  const kinds = [];
  for (let i = 0; i < nObs; i++) { const k = Math.random(); kinds.push(k < 0.5 ? 'low' : k < 0.75 ? 'fly' : 'wall'); }
  if (nObs === 3 && kinds.every(k => k === 'wall')) kinds[0] = 'low';
  for (let i = 0; i < nObs; i++) {
    const k = kinds[i];
    spawn(k, lanes[i], z, { name: k === 'low' ? T.low[Math.floor(Math.random() * T.low.length)] : T.fly[Math.floor(Math.random() * T.fly.length)] });
  }
  const free = lanes.slice(nObs);
  if (free.length && Math.random() < 0.75) {
    const L = free[0]; for (let i = 1; i <= 5; i++) spawn('scroll', L, z + 3 - i * 1.6);
  } else {
    const iLow = kinds.indexOf('low');
    if (iLow >= 0) for (let i = -2; i <= 2; i++) spawn('scroll', lanes[iLow], z + i * 1.3, { y: 0.8 + 1.5 * Math.cos(i / 2.5 * Math.PI / 2) });
  }
  if (free.length > 1) {
    if (lives < M().vidas && Math.random() < 0.06) spawn('heart', free[1], z - 4);
    else if (!power.name && Math.random() < 0.08) spawn('power', free[1], z - 4, { name: ['ima', 'escudo', 'pulo'][Math.floor(Math.random() * 3)] });
  }
}

// ---------------- Estado ----------------
let state = 'loading';           // loading, menu, play, paused, over, win
let speed = 12, dist = 0, scrolls = 0, lives = 3, inv = 0, chaserT = 0, time = 0, bonus = 0;
let phase = 0;                   // 0..4 = fases, 5 = chefão
const P = { lane: 1, x: 0, y: 0, vy: 0, roll: 0, z: 0 };
const power = { name: null, t: 0 }; let shield = false;
const boss = { hp: 3, t: 0, bombT: 0, x: 0, phaseOut: 0, hitFlash: 0, warn: null };
const POWER_TIME = 10;
const POWER_INFO = { ima: ['🌀', 'Ímã de pergaminhos'], escudo: ['🛡️', 'Escudo ninja'], pulo: ['👟', 'Super pulo'] };

function updateHearts() {
  const h = $('hearts'); h.innerHTML = '';
  for (let i = 0; i < M().vidas; i++) { const im = new Image(); im.src = IMG['coracao-vida']; im.alt = ''; im.style.opacity = i < lives ? 1 : 0.25; h.appendChild(im); }
}
function score() { return Math.floor(dist) + scrolls * 10 + bonus; }
function clearItems() { for (const it of items) scene.remove(it.obj); items.length = 0; }
function showBanner(imgName, text) {
  const b = $('banner'), t = $('bannerText');
  if (imgName) { b.src = IMG[imgName]; b.hidden = false; b.style.opacity = 1; t.hidden = true; }
  else { t.textContent = text; t.hidden = false; t.style.opacity = 1; b.hidden = true; }
  clearTimeout(showBanner.t1); clearTimeout(showBanner.t2);
  showBanner.t1 = setTimeout(() => { b.style.opacity = 0; t.style.opacity = 0; }, 2000);
  showBanner.t2 = setTimeout(() => { b.hidden = true; t.hidden = true; }, 2500);
}
function updatePhaseHud() {
  $('phase').textContent = phase < 5 ? `Fase ${phase + 1}/5 • ${THEMES[phase].nome}` : 'CHEFÃO!';
}

function startGame(startPhase = 0) {
  audio(); clearItems();
  speed = M().vel0; dist = startPhase * PHASE_LEN; scrolls = 0; bonus = 0; lives = M().vidas; inv = 0; chaserT = 0; time = 0; rowCount = 0;
  phase = Math.min(startPhase, 4); power.name = null; power.t = 0; shield = false; bubble.visible = false; $('powerbox').hidden = true;
  Object.assign(P, { lane: 1, x: 0, y: 0, vy: 0, roll: 0, z: 0 });
  Object.assign(boss, { hp: 3, t: 0, bombT: 0, x: 0, phaseOut: 0, hitFlash: 0 });
  chaser.rotation.set(0, 0, 0); chaser.scale.setScalar(1); chaser.visible = true; friend.visible = true;
  applyTheme(phase);
  nextRowZ = -28; while (nextRowZ > -110) { genRow(nextRowZ); nextRowZ -= rowGap(); }
  for (const id of ['menu', 'over', 'paused', 'win']) $(id).hidden = true;
  $('hud').hidden = false;
  updateHearts(); $('scrolls').textContent = '0'; updatePhaseHud();
  showBanner(THEMES[phase].banner);
  if (startPhase === 0) { const t = $('tip'); t.hidden = false; t.style.opacity = 1; setTimeout(() => { t.style.opacity = 0; }, 4500); setTimeout(() => { t.hidden = true; }, 5000); }
  stopConfetti();
  if (startPhase >= 5) startBoss();
  state = 'play';
}
function rowGap() { return Math.max(11, speed * 0.85) + Math.random() * 6; }

function nextPhase() {
  phase++; bonus += 100; SFX.phase();
  if (phase >= 5) { startBoss(); return; }
  applyTheme(phase); updatePhaseHud(); showBanner(THEMES[phase].banner);
}

// ---------------- Chefão ----------------
function startBoss() {
  phase = 5; applyTheme(4); updatePhaseHud();
  // limpa obstáculos que ainda estão à frente
  for (const it of items) if (it.z < P.z - 2 && it.kind !== 'scroll') { it.alive = false; scene.remove(it.obj); }
  Object.assign(boss, { hp: 3, t: 2.2, bombT: 3.5, x: 0, phaseOut: 0, hitFlash: 0 });
  showBanner(null, 'CHEFÃO: Mão Afiada! Pegue as bombas 💣');
  $('bossbar').hidden = false; updateBossBar();
  friend.visible = false;
}
function updateBossBar() { $('bossfill').style.width = (boss.hp / 3 * 100) + '%'; }
const projectiles = [];   // bombas voando até o Mão Afiada
const effects = [];       // explosões e estrelinhas
function throwBomb() {
  const b = bombProto.clone(); b.position.set(P.x, P.y + 1.2, P.z - 0.5); scene.add(b);
  projectiles.push({ obj: b, t: 0, from: b.position.clone() }); SFX.throw();
}
function explode(pos, size = 1.6) {
  const e = boomProto.clone(); e.position.copy(pos); e.scale.setScalar(0.4); scene.add(e);
  effects.push({ obj: e, t: 0, life: 0.45, grow: size }); SFX.boom();
}
function bossHit() {
  boss.hp--; boss.hitFlash = 0.6; bonus += 200; updateBossBar();
  if (boss.hp <= 0) { boss.phaseOut = 0.001; $('bossbar').hidden = true; if (boss.warn) { scene.remove(boss.warn.mesh); boss.warn = null; } for (const it of items) if (it.kind === 'knife' || it.kind === 'bomb') { it.alive = false; scene.remove(it.obj); } }
}

function gameOver() {
  state = 'over'; SFX.over(); $('bossbar').hidden = true;
  const s = score(), best = getBest(), novo = s > best; if (novo) setBest(s);
  $('finalScore').textContent = s + ' pontos';
  $('finalInfo').textContent = (novo ? '🏆 NOVO RECORDE! • ' : 'Recorde: ' + Math.max(best, s) + ' • ') + scrolls + ' pergaminhos • ' + (phase < 5 ? 'Fase ' + (phase + 1) : 'Chefão') + ' • ' + M().nome;
  setTimeout(() => { if (state === 'over') { $('over').hidden = false; $('hud').hidden = true; } }, 900);
}
function victory() {
  state = 'win'; bonus += 1000; SFX.win();
  const s = score(), best = getBest(), novo = s > best; if (novo) setBest(s);
  $('winScore').textContent = s + ' pontos';
  $('winInfo').textContent = (novo ? '🏆 NOVO RECORDE! • ' : 'Recorde: ' + Math.max(best, s) + ' • ') + scrolls + ' pergaminhos • ' + M().nome;
  friend.visible = true; startConfetti();
  setTimeout(() => { if (state === 'win') { $('win').hidden = false; $('hud').hidden = true; } }, 1500);
}

// confete
let confetti = null;
function startConfetti() {
  if (!confetti) {
    confetti = new THREE.InstancedMesh(new THREE.BoxGeometry(0.12, 0.12, 0.03), new THREE.MeshBasicMaterial(), 160);
    const cols = [0xe74c3c, 0xf1c40f, 0x2ecc71, 0x3498db, 0x9b59b6, 0xff6fb5]; const c = new THREE.Color();
    for (let i = 0; i < 160; i++) { c.setHex(cols[i % cols.length]); confetti.setColorAt(i, c); }
    confetti.userData.p = Array.from({ length: 160 }, () => ({ x: rnd(-4, 4), y: rnd(0, 7), z: rnd(-8, 2), s: rnd(1, 2.5), r: rnd(0, 6) }));
    scene.add(confetti);
  }
  confetti.visible = true;
}
function stopConfetti() { if (confetti) confetti.visible = false; }
const cm = new THREE.Matrix4(), cq = new THREE.Quaternion(), ce = new THREE.Euler(), cs = new THREE.Vector3(1, 1, 1), cp = new THREE.Vector3();
function updateConfetti(dt) {
  if (!confetti || !confetti.visible) return;
  confetti.userData.p.forEach((p, i) => {
    p.y -= p.s * dt; p.r += dt * 4; if (p.y < 0) p.y = 7;
    cp.set(P.x + p.x, p.y, P.z + p.z); ce.set(p.r, p.r * 0.7, 0); cq.setFromEuler(ce); cm.compose(cp, cq, cs); confetti.setMatrixAt(i, cm);
  });
  confetti.instanceMatrix.needsUpdate = true;
}

// ---------------- Controles ----------------
function act(a) {
  audio();
  if (state !== 'play') return;
  if (a === 'left' && P.lane > 0) { P.lane--; SFX.lane(); }
  if (a === 'right' && P.lane < 2) { P.lane++; SFX.lane(); }
  if (a === 'jump' && P.y <= 0.001 && P.roll <= 0) { const big = power.name === 'pulo'; P.vy = big ? 13.5 : 9.6; big ? SFX.bigJump() : SFX.jump(); }
  if (a === 'roll') { P.roll = 0.62; if (P.y > 0) P.vy = -16; SFX.roll(); }
}
const KEYS = { ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', ArrowUp: 'jump', KeyW: 'jump', Space: 'jump', ArrowDown: 'roll', KeyS: 'roll' };
window.addEventListener('keydown', e => {
  const a = KEYS[e.code];
  if (e.code === 'Escape' || e.code === 'KeyP') { togglePause(); return; }
  if (!a) { if (e.code === 'Enter' && state === 'menu') startGame(); return; }
  e.preventDefault(); if (!e.repeat) act(a);
  if (state === 'menu' && a === 'jump') startGame();
});
let sx = 0, sy = 0, swiping = false;
const area = $('game');
area.addEventListener('pointerdown', e => { if (e.target.closest('button')) return; audio(); sx = e.clientX; sy = e.clientY; swiping = true; });
area.addEventListener('pointermove', e => {
  if (!swiping) return; const dx = e.clientX - sx, dy = e.clientY - sy;
  if (Math.max(Math.abs(dx), Math.abs(dy)) < 28) return;
  swiping = false;
  if (Math.abs(dx) > Math.abs(dy)) act(dx > 0 ? 'right' : 'left'); else act(dy < 0 ? 'jump' : 'roll');
});
area.addEventListener('pointerup', () => { swiping = false; });
area.addEventListener('pointercancel', () => { swiping = false; });
document.addEventListener('touchmove', e => { if (state === 'play') e.preventDefault(); }, { passive: false });

function togglePause() {
  if (state === 'play') { state = 'paused'; $('paused').hidden = false; }
  else if (state === 'paused') { state = 'play'; $('paused').hidden = true; last = performance.now(); }
}
$('pause').addEventListener('click', togglePause);
$('resume').addEventListener('click', togglePause);
function toMenu() {
  state = 'menu'; clearItems(); for (const p of projectiles) scene.remove(p.obj); projectiles.length = 0;
  for (const id of ['over', 'paused', 'win', 'hud', 'bossbar']) $(id).hidden = true; $('menu').hidden = false;
  stopConfetti(); applyTheme(0); phase = 0; chaser.rotation.set(0, 0, 0); chaser.visible = true; friend.visible = true; refreshMenu();
}
for (const id of ['toMenu1', 'toMenu2', 'toMenu3']) $(id).addEventListener('click', toMenu);
$('again').addEventListener('click', () => startGame());
$('again2').addEventListener('click', () => startGame());
$('play').addEventListener('click', () => startGame());
document.querySelectorAll('.modes button').forEach(b => b.addEventListener('click', () => {
  modo = +b.dataset.m; try { localStorage.setItem('ninja3d-modo', String(modo)); } catch (e) {} refreshMenu(); audio(); tone(660, 0.06, 'sine', 0.08);
}));
function refreshMenu() {
  document.querySelectorAll('.modes button').forEach(b => b.setAttribute('aria-pressed', String(+b.dataset.m === modo)));
  $('modeinfo').textContent = M().info;
  const b = getBest(); $('best').textContent = b ? '🏆 Recorde no ' + M().nome + ': ' + b + ' pontos' : '';
}

// ---------------- Atualização ----------------
const tmp = new THREE.Vector3();
function hitPlayer(it) {
  if (inv > 0) return false;
  if (it) { it.alive = false; scene.remove(it.obj); }
  if (shield) { shield = false; bubble.visible = false; inv = 1.0; SFX.shield(); if (power.name === 'escudo') { power.name = null; $('powerbox').hidden = true; } return false; }
  lives--; SFX.hit(); updateHearts(); inv = 1.3; chaserT = 5;
  speed = Math.max(M().vel0, speed * 0.85);
  if (lives <= 0) { gameOver(); return true; }
  return false;
}
function update(dt) {
  time += dt;
  const bossOn = phase === 5;
  speed = Math.min(bossOn ? Math.min(M().velMax, 22) : M().velMax, speed + M().acel * dt);
  const dz = speed * dt; dist += dz; P.z -= dz;

  P.x += (LANES[P.lane] - P.x) * Math.min(1, dt * 14);
  if (P.y > 0 || P.vy > 0) { P.vy -= 28 * dt; P.y += P.vy * dt; if (P.y <= 0) { P.y = 0; P.vy = 0; } }
  if (P.roll > 0) P.roll -= dt;
  if (inv > 0) inv -= dt;
  if (chaserT > 0) chaserT -= dt;

  // poder ativo
  if (power.name) {
    power.t -= dt; $('powerfill').style.width = Math.max(0, power.t / POWER_TIME * 100) + '%';
    if (power.t <= 0) { if (power.name === 'escudo') { shield = false; bubble.visible = false; } power.name = null; $('powerbox').hidden = true; }
  }

  world.position.z = P.z - 60; scrollTextures();

  // troca de fase
  if (!bossOn && dist >= (phase + 1) * PHASE_LEN) nextPhase();

  if (!bossOn) { while (nextRowZ > P.z - 110) { genRow(nextRowZ); nextRowZ -= rowGap(); } }
  else updateBoss(dt);

  // ímã: pergaminhos voam até o ninja
  if (power.name === 'ima') for (const it of items) {
    if (it.alive && it.kind === 'scroll' && it.z < P.z + 1 && it.z > P.z - 16) {
      it.obj.position.x += (P.x - it.obj.position.x) * Math.min(1, dt * 8); it.obj.position.y += (P.y + 0.9 - it.obj.position.y) * Math.min(1, dt * 8);
      it.z += (P.z - it.z) * Math.min(1, dt * 6); it.obj.position.z = it.z;
    }
  }

  // colisões
  const rolling = P.roll > 0, ph = rolling ? 0.8 : 1.7;
  const pb = { x1: P.x - 0.35, x2: P.x + 0.35, y1: P.y, y2: P.y + ph, z1: P.z - 0.3, z2: P.z + 0.3 };
  for (const it of items) {
    if (!it.alive) continue;
    if (it.vz) { it.z += it.vz * dt; it.obj.position.z = it.z; }
    if (it.kind === 'scroll' || it.kind === 'heart' || it.kind === 'power' || it.kind === 'bomb') it.obj.rotation.y += dt * 3;
    if (it.kind === 'fly') it.obj.position.y = 1.45 + Math.sin(time * 6 + it.z) * 0.08;
    const ib = it.box, ix = it.obj.position.x;
    if (ix - ib.w / 2 < pb.x2 && ix + ib.w / 2 > pb.x1 && it.z - ib.d / 2 < pb.z2 && it.z + ib.d / 2 > pb.z1 && ib.y < pb.y2 && ib.y + ib.h > pb.y1) {
      if (it.kind === 'scroll') { it.alive = false; scene.remove(it.obj); scrolls++; $('scrolls').textContent = scrolls; SFX.scroll(); }
      else if (it.kind === 'heart') { it.alive = false; scene.remove(it.obj); if (lives < M().vidas) lives++; updateHearts(); SFX.life(); }
      else if (it.kind === 'power') { it.alive = false; scene.remove(it.obj); givePower(it.name); }
      else if (it.kind === 'bomb') { it.alive = false; scene.remove(it.obj); throwBomb(); }
      else if (hitPlayer(it)) return;
    }
  }
  for (let i = items.length - 1; i >= 0; i--) {
    if (!items[i].alive || items[i].z > P.z + 8) { if (items[i].alive) scene.remove(items[i].obj); items.splice(i, 1); }
  }
  $('score').textContent = score();
}
function givePower(name) {
  power.name = name; power.t = POWER_TIME; SFX.power();
  $('powerbox').hidden = false; $('powericon').textContent = POWER_INFO[name][0]; $('powername').textContent = POWER_INFO[name][1];
  if (name === 'escudo') { shield = true; bubble.visible = true; } else { shield = false; bubble.visible = false; }
}

function updateBoss(dt) {
  if (boss.phaseOut > 0) {                      // derrotado: voa girando
    boss.phaseOut += dt;
    if (boss.phaseOut > 2.4 && state === 'play') victory();
    return;
  }
  boss.t -= dt; boss.bombT -= dt; if (boss.hitFlash > 0) boss.hitFlash -= dt;
  boss.x = Math.sin(time * 1.3) * 2.2;
  const bz = P.z - 15;
  // ataque: aviso vermelho na pista e depois a faca
  if (boss.warn) { boss.warn.t -= dt; if (boss.warn.t <= 0) { scene.remove(boss.warn.mesh); spawn('knife', boss.warn.lane, bz + 1, { y: boss.warn.y, vz: 9 }); SFX.throw(); boss.warn = null; } }
  else if (boss.t <= 0) {
    const lane = Math.random() < 0.6 ? P.lane : Math.floor(Math.random() * 3);
    const high = Math.random() < 0.45;
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 9), new THREE.MeshBasicMaterial({ color: high ? 0x9b59b6 : 0xe74c3c, transparent: true, opacity: 0.45, depthWrite: false }));
    mesh.rotation.x = -Math.PI / 2; mesh.position.set(LANES[lane], 0.03, P.z - 8); scene.add(mesh);
    boss.warn = { lane, y: high ? 1.55 : 0.45, t: 0.55, mesh };
    boss.t = M().ataque + Math.random() * 0.4;
  }
  if (boss.warn) boss.warn.mesh.position.z = P.z - 8;
  // bombas para pegar
  if (boss.bombT <= 0) { spawn('bomb', Math.floor(Math.random() * 3), P.z - 32); boss.bombT = 4 + Math.random() * 2; }
}

function updateEffects(dt) {
  for (let i = projectiles.length - 1; i >= 0; i--) {
    const p = projectiles[i]; p.t += dt / 0.7;
    const target = tmp.set(chaser.position.x, chaser.position.y + 1.4, chaser.position.z);
    p.obj.position.lerpVectors(p.from, target, Math.min(1, p.t)); p.obj.position.y += Math.sin(Math.min(1, p.t) * Math.PI) * 3; p.obj.rotation.x += dt * 10;
    if (p.t >= 1) { scene.remove(p.obj); projectiles.splice(i, 1); explode(target.clone(), 2.2); bossHit(); }
  }
  for (let i = effects.length - 1; i >= 0; i--) {
    const e = effects[i]; e.t += dt;
    const k = e.t / e.life; e.obj.scale.setScalar(0.4 + k * e.grow); if (e.vy) { e.obj.position.y += e.vy * dt; e.obj.rotation.z += dt * 6; }
    if (e.t >= e.life) { scene.remove(e.obj); effects.splice(i, 1); }
  }
}

function place(dt) {
  player.position.set(P.x, P.y, P.z);
  const air = P.y > 0.05, rolling = P.roll > 0;
  if (dpRun && dpJump) { dpRun.visible = !air; dpJump.visible = air; }
  player.rotation.z = (P.x - LANES[P.lane]) * 0.12;
  if (state === 'win') { player.rotation.set(0, 0, 0); player.scale.set(1, 1, 1); P.y = Math.abs(Math.sin(time * 6)) * 0.6; dpRun.visible = P.y < 0.2; dpJump.visible = P.y >= 0.2; }
  else if (rolling) { player.scale.set(1, 0.5, 1); player.rotation.x = -(0.62 - P.roll) / 0.62 * Math.PI * 2; }
  else { player.scale.set(1, 1, 1); player.rotation.x = 0; if (!air && dpRun) dpRun.position.y = Math.abs(Math.sin(time * 14)) * 0.08; }
  player.visible = !(inv > 0 && Math.floor(inv * 10) % 2 === 0);
  shadow.position.set(P.x, 0.02, P.z); shadow.scale.setScalar(1 - Math.min(0.6, P.y * 0.25));
  bubble.material.opacity = 0.22 + Math.sin(time * 6) * 0.06;

  if (ma1 && ma2) { const f = Math.floor(time * 8) % 2; ma1.visible = f === 0; ma2.visible = f === 1; }
  if (phase === 5 && state !== 'menu') {
    // chefão: na frente, encarando o ninja
    if (boss.phaseOut > 0) {
      chaser.position.y += dt * 7; chaser.position.z -= dt * 4; chaser.rotation.z += dt * 9; chaser.rotation.y += dt * 5;
      if (Math.random() < 0.6) { const s = starProto.clone(); s.position.copy(chaser.position).add(tmp.set(rnd(-0.6, 0.6), 1.2, 0)); scene.add(s); effects.push({ obj: s, t: 0, life: 0.6, grow: 0.3, vy: -1 }); }
    } else {
      tmp.set(boss.x, 0, P.z - 15); chaser.position.lerp(tmp, Math.min(1, dt * 5));
      chaser.position.y = Math.abs(Math.sin(time * 10)) * 0.15;
      chaser.visible = !(boss.hitFlash > 0 && Math.floor(boss.hitFlash * 12) % 2 === 0);
    }
  } else {
    const perto = state === 'over' || chaserT > 0;
    const behind = state === 'over' ? 1.2 : (chaserT > 0 ? 1.9 : 9);
    tmp.set(P.x + (perto ? (P.lane === 2 ? -1.3 : 1.3) : 0), 0, P.z + behind);
    chaser.position.lerp(tmp, Math.min(1, dt * (perto ? 7 : 3)));
    chaser.position.y = Math.abs(Math.sin(time * 10)) * 0.12;
  }

  if (state === 'win') friend.position.set(P.x + 1.6, Math.abs(Math.sin(time * 6 + 1)) * 0.6, P.z - 0.5);
  else friend.position.set(Math.sin(time * 0.7) * 2, Math.abs(Math.sin(time * 12)) * 0.1, P.z - 34);

  const cx = P.x * 0.75;
  if (state === 'win') { camera.position.lerp(tmp.set(P.x + 0.8, 1.8, P.z - 5.5), Math.min(1, dt * 2)); camera.lookAt(P.x + 0.8, 1.1, P.z); }
  else { camera.position.set(cx, 3.1 + P.y * 0.35, P.z + 5.6); camera.lookAt(cx, 1.2 + P.y * 0.25, P.z - 6); }
}

// ---------------- Laço ----------------
let last = performance.now();
function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (state === 'play') { update(dt); music(dt); }
  else if (state === 'menu' || state === 'loading') { time += dt; P.z -= dt * 6; dist += dt * 6; world.position.z = P.z - 60; scrollTextures(); }
  else if (state === 'over' || state === 'win') { time += dt; }
  if (state !== 'paused') { updateEffects(dt); updateConfetti(dt); }
  if (phase === 5 && state === 'play') updateBoss2(dt);
  place(dt);
  renderer.render(scene, camera);
  requestAnimationFrame(loop);
}
function updateBoss2() { /* espaço para efeitos extras do chefão */ }

// ---------------- Início ----------------
(async function init() {
  resize(); applyTheme(0);
  $('logo').src = IMG['titulo-ninja-em-acao'];
  requestAnimationFrame(loop);
  dpRun = await voxel('dead-power-1-parado', 32, 1.75, 4);
  dpJump = await voxel('dead-power-2-pulando', 32, 1.75, 4);
  player.add(dpRun, dpJump); dpJump.visible = false;
  ma1 = await voxel('mao-afiada-1', 36, 2.3, 5); ma2 = await voxel('mao-afiada-2', 36, 2.3, 5);
  chaser.add(ma1, ma2); chaser.position.set(0, 0, 9);
  cinz = await voxel('cinzento', 30, 1.7, 4); friend.add(cinz);
  const lowAll = [...new Set(THEMES.flatMap(t => t.low))];
  const H = { cone: 1.0, antena: 1.05, placa: 1.05, espinhos: 0.6, pedra: 0.7, ossos: 0.75 };
  for (const n of lowAll) PROTOS[n] = await voxel(n, 18, H[n] || 0.85, n === 'espinhos' || n === 'ossos' ? 10 : 8);
  for (const n of ['pombo-voador', 'morcego-voador']) PROTOS[n] = await voxel(n, 22, 0.55, 3);
  scrollProto = makeScrollProto();
  heartProto = await voxel('coracao-vida', 14, 0.7, 4);
  bombProto = await voxel('bomba', 14, 0.9, 10);
  boomProto = await voxel('explosao', 16, 1.0, 3, true);
  starProto = await voxel('estrelinha', 10, 0.35, 2, true);
  knifeProto = makeKnife();
  await makeBlocks(); makePowers();
  // pré-carrega as texturas dos 5 cenários
  for (const t of THEMES) { getTex(t.floor); getTex(t.wall); if (t.ceil) getTex(t.ceil); }
  state = 'menu'; refreshMenu();
})();

// ganchos para testes automáticos
window.__n3d = { get state() { return state; }, get dist() { return dist; }, get lives() { return lives; }, get speed() { return speed; },
  get scrolls() { return scrolls; }, get phase() { return phase; }, get boss() { return boss; }, get power() { return power; },
  P, items, act, start: (p) => startGame(p || 0), setModo: m => { modo = m; refreshMenu(); } };
