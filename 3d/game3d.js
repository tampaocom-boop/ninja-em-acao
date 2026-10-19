/* Ninja em Ação 3D — Fase 1: Escola
   Corrida em 3 pistas. Os personagens e obstáculos são os desenhos do criador do jogo,
   transformados em "cubinhos" (voxels). */
import * as THREE from './three.module.min.js';

const IMG = window.__IMG;
const $ = id => document.getElementById(id);
const LANES = [-2.2, 0, 2.2];

// ---------------- Modos ----------------
const MODES = [
  { nome: 'Fácil',   vidas: 3, vel0: 12, velMax: 24, acel: 0.20, info: '3 vidas • começa rápido' },
  { nome: 'Médio',   vidas: 2, vel0: 15, velMax: 30, acel: 0.28, info: '2 vidas • muito rápido' },
  { nome: 'Difícil', vidas: 1, vel0: 18, velMax: 36, acel: 0.36, info: '1 vida • super rápido!' },
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
  roll: () => tone(500, 0.18, 'triangle', 0.12, 0, 160),
  lane: () => tone(700, 0.05, 'sine', 0.06),
  scroll: () => { tone(988, 0.07, 'square', 0.07); tone(1319, 0.09, 'square', 0.07, 0.05); },
  life: () => [784, 988, 1319].forEach((f, i) => tone(f, 0.12, 'sine', 0.14, i * 0.07)),
  hit: () => { tone(150, 0.25, 'square', 0.18, 0, 60); noise(0.15, 0.25); },
  over: () => [392, 330, 262, 196].forEach((f, i) => tone(f, 0.28, 'triangle', 0.16, i * 0.18)),
};
const SONG = [330, 392, 494, 392, 349, 440, 523, 440, 330, 392, 494, 587, 523, 494, 440, 392];
let songStep = 0, songT = 0;
function music(dt) {
  if (!AC || muted || state !== 'play') return;
  songT -= dt; if (songT > 0) return;
  const f = SONG[songStep % SONG.length]; tone(f, 0.14, 'triangle', 0.05); if (songStep % 2 === 0) tone(f / 2, 0.16, 'square', 0.025);
  songStep++; songT = Math.max(0.12, 0.2 - speed * 0.002);
}

// ---------------- Cena ----------------
const canvas = $('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
const scene = new THREE.Scene();
const SKY = 0xe9dfc2;
scene.background = new THREE.Color(SKY);
scene.fog = new THREE.Fog(SKY, 22, 75);
const camera = new THREE.PerspectiveCamera(62, 1, 0.1, 120);
scene.add(new THREE.HemisphereLight(0xfff7e6, 0x8a6a45, 1.6));
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
  camera.fov = w / h < 0.8 ? 70 : 60;   // celular em pé: vê mais das laterais
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
if (window.ResizeObserver) new ResizeObserver(resize).observe($('game'));

// ---------------- Desenho -> cubinhos ----------------
function loadImg(src) { return new Promise(r => { const i = new Image(); i.onload = () => r(i); i.onerror = () => r(null); i.src = src; }); }
const voxelMat = new THREE.MeshLambertMaterial({ vertexColors: true });
// Faces de um cubo: direção do vizinho e os 4 cantos
const FACES = [
  { n: [1, 0, 0],  c: [[1,0,0],[1,1,0],[1,1,1],[1,0,1]] },
  { n: [-1, 0, 0], c: [[0,0,1],[0,1,1],[0,1,0],[0,0,0]] },
  { n: [0, 1, 0],  c: [[0,1,1],[1,1,1],[1,1,0],[0,1,0]] },
  { n: [0, -1, 0], c: [[0,0,0],[1,0,0],[1,0,1],[0,0,1]] },
  { n: [0, 0, 1],  c: [[1,0,1],[1,1,1],[0,1,1],[0,0,1]] },
  { n: [0, 0, -1], c: [[0,0,0],[0,1,0],[1,1,0],[1,0,0]] },
];
async function voxel(name, cols, height, depth) {
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
  // só a "casca": cria uma face apenas onde o vizinho está vazio
  const filled = (cx, y, l) => cx >= 0 && cx < cols && y >= 0 && y < rows && l >= 0 && l < depth && grid[y * cols + cx] !== null;
  const size = height / rows, pos = [], nor = [], colr = [];
  for (let y = 0; y < rows; y++) for (let cx = 0; cx < cols; cx++) {
    const col = grid[y * cols + cx]; if (!col) continue;
    for (let l = 0; l < depth; l++) {
      const X0 = (cx - cols / 2) * size, Y0 = (rows - 1 - y) * size, Z0 = (l - depth / 2) * size;
      for (const f of FACES) {
        // vizinho: y da imagem cresce para baixo, então o "para cima" no mundo é y-1 na imagem
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
  g.userData = { w: cols * size, h: rows * size, d: depth * size, tris: pos.length / 9 };
  return g;
}

// ---------------- Texturas da escola (desenhadas no aparelho) ----------------
function canvasTex(w, h, paint, rx, ry) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; paint(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx, ry);
  t.anisotropy = 4; return t;
}
const floorTex = canvasTex(256, 256, (x, w, h) => {
  x.fillStyle = '#b07a44'; x.fillRect(0, 0, w, h);
  for (let i = 0; i < 8; i++) { x.fillStyle = i % 2 ? '#a8723f' : '#b8834c'; x.fillRect(i * 32, 0, 32, h); }
  x.strokeStyle = '#7a4f28'; x.lineWidth = 3; for (let i = 0; i <= 8; i++) { x.beginPath(); x.moveTo(i * 32, 0); x.lineTo(i * 32, h); x.stroke(); }
  for (let i = 0; i < 8; i++) { x.beginPath(); const y = (i * 97) % h; x.moveTo(i * 32, y); x.lineTo(i * 32 + 32, y); x.stroke(); }
}, 3, 40);
const lockerTex = canvasTex(256, 256, (x, w, h) => {
  x.fillStyle = '#ebdfc0'; x.fillRect(0, 0, w, h);
  x.fillStyle = '#c9b88f'; x.fillRect(0, 0, w, 20);
  for (let i = 0; i < 4; i++) {
    const X = i * 64 + 3; x.fillStyle = '#3b6fd1'; x.fillRect(X, 40, 58, 216); x.strokeStyle = '#1f3f86'; x.lineWidth = 4; x.strokeRect(X, 40, 58, 216);
    x.fillStyle = '#244f9e'; for (let k = 0; k < 3; k++) x.fillRect(X + 10, 58 + k * 14, 38, 6);
    x.fillStyle = '#eef2ff'; x.fillRect(X + 46, 150, 5, 24);
  }
}, 30, 1);
const ceilTex = canvasTex(256, 256, (x, w, h) => {
  x.fillStyle = '#d9cba6'; x.fillRect(0, 0, w, h); x.fillStyle = '#fff6cf'; x.fillRect(64, 90, 128, 60);
}, 1, 20);

// ---------------- Mundo ----------------
const world = new THREE.Group(); scene.add(world);
const LEN = 200;
const floor = new THREE.Mesh(new THREE.PlaneGeometry(9, LEN), new THREE.MeshLambertMaterial({ map: floorTex }));
floor.rotation.x = -Math.PI / 2; world.add(floor);
const wallGeo = new THREE.PlaneGeometry(LEN, 5);
const wallL = new THREE.Mesh(wallGeo, new THREE.MeshLambertMaterial({ map: lockerTex })); wallL.rotation.y = Math.PI / 2; wallL.position.set(-4.5, 2.5, 0); world.add(wallL);
const wallR = new THREE.Mesh(wallGeo, new THREE.MeshLambertMaterial({ map: lockerTex })); wallR.rotation.y = -Math.PI / 2; wallR.position.set(4.5, 2.5, 0); world.add(wallR);
const ceil = new THREE.Mesh(new THREE.PlaneGeometry(9, LEN), new THREE.MeshBasicMaterial({ map: ceilTex, fog: true }));
ceil.rotation.x = Math.PI / 2; ceil.position.y = 5; world.add(ceil);
// faixas no chão entre as pistas
const lineMat = new THREE.MeshBasicMaterial({ color: 0x8a5a2e });
for (const x of [-1.1, 1.1]) { const l = new THREE.Mesh(new THREE.PlaneGeometry(0.06, LEN), lineMat); l.rotation.x = -Math.PI / 2; l.position.set(x, 0.01, 0); world.add(l); }

// ---------------- Personagens ----------------
const player = new THREE.Group(); scene.add(player);
let dpRun, dpJump, ma1, ma2, cinz;
const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.45, 20), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.25 }));
shadow.rotation.x = -Math.PI / 2; scene.add(shadow);
const chaser = new THREE.Group(); scene.add(chaser);
const friend = new THREE.Group(); scene.add(friend);

// ---------------- Objetos da pista ----------------
const PROTOS = {};
const LOW = ['bola', 'mochila', 'balde', 'caixa', 'cone'];
const FLY = ['pombo-voador', 'morcego-voador'];
let scrollProto, heartProto, wallProto;
const items = [];      // obstáculos, pergaminhos e corações ativos

function makeScrollProto() {
  const g = new THREE.Group();
  const paper = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.55, 12), new THREE.MeshLambertMaterial({ color: 0xf3e2b3, emissive: 0x6b5520 }));
  paper.rotation.z = Math.PI / 2; g.add(paper);
  const capM = new THREE.MeshLambertMaterial({ color: 0xc0392b, emissive: 0x401010 });
  for (const s of [-1, 1]) { const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.19, 0.08, 12), capM); cap.rotation.z = Math.PI / 2; cap.position.x = s * 0.3; g.add(cap); }
  const band = new THREE.Mesh(new THREE.TorusGeometry(0.165, 0.025, 6, 16), new THREE.MeshLambertMaterial({ color: 0xffd34a, emissive: 0x806010 })); band.rotation.y = Math.PI / 2; g.add(band);
  return g;
}
function makeWallProto() {
  // bloco de armários no meio da pista: tem que trocar de pista
  const g = new THREE.Group();
  const tex = canvasTex(128, 256, (x, w, h) => {
    x.fillStyle = '#3b6fd1'; x.fillRect(0, 0, w, h); x.strokeStyle = '#1f3f86'; x.lineWidth = 8; x.strokeRect(0, 0, w, h);
    x.fillStyle = '#244f9e'; for (let k = 0; k < 4; k++) x.fillRect(24, 26 + k * 18, 80, 8);
    x.fillStyle = '#eef2ff'; x.fillRect(100, 130, 8, 34);
    x.fillStyle = '#ffd34a'; x.fillRect(0, h - 26, w, 10);
  }, 1, 1);
  const m = new THREE.Mesh(new THREE.BoxGeometry(1.8, 2.6, 1.0), new THREE.MeshLambertMaterial({ map: tex }));
  m.position.y = 1.3; g.add(m); g.userData = { w: 1.8, h: 2.6, d: 1.0 };
  return g;
}

function spawn(kind, lane, z, extra = {}) {
  let proto, y = 0, box;
  if (kind === 'low') { proto = PROTOS[extra.name]; box = { w: proto.userData.w * 0.85, h: proto.userData.h * 0.9, d: proto.userData.d * 0.9, y: 0 }; }
  else if (kind === 'fly') { proto = PROTOS[extra.name]; y = 1.45; box = { w: proto.userData.w * 0.85, h: proto.userData.h * 0.9, d: 0.6, y: 1.45 }; }
  else if (kind === 'wall') { proto = wallProto; box = { w: 1.7, h: 2.6, d: 1.0, y: 0 }; }
  else if (kind === 'scroll') { proto = scrollProto; y = extra.y || 0.7; box = { w: 0.8, h: 0.8, d: 0.8, y: y - 0.4 }; }
  else if (kind === 'heart') { proto = heartProto; y = 0.9; box = { w: 0.9, h: 0.9, d: 0.9, y: 0.45 }; }
  const obj = proto.clone(); obj.position.set(LANES[lane], y, z);
  if (kind === 'fly') obj.rotation.y = Math.PI / 2 * (Math.random() < 0.5 ? 1 : -1) * 0;
  scene.add(obj);
  items.push({ kind, lane, z, obj, box, alive: true, name: extra.name });
}

// gerador de "fileiras": nunca fecha as 3 pistas com algo impossível
let nextRowZ = -30, rowCount = 0;
function genRow(z) {
  rowCount++;
  const r = Math.random();
  const lanes = [0, 1, 2].sort(() => Math.random() - 0.5);
  const nObs = rowCount < 3 ? 1 : (r < 0.45 ? 1 : r < 0.85 ? 2 : 3);
  const kinds = [];
  for (let i = 0; i < nObs; i++) {
    const k = Math.random();
    kinds.push(k < 0.5 ? 'low' : k < 0.75 ? 'fly' : 'wall');
  }
  if (nObs === 3 && kinds.every(k => k === 'wall')) kinds[0] = 'low';          // sempre tem saída
  for (let i = 0; i < nObs; i++) {
    const k = kinds[i];
    spawn(k, lanes[i], z, { name: k === 'low' ? LOW[Math.floor(Math.random() * LOW.length)] : FLY[Math.floor(Math.random() * 2)] });
  }
  // pergaminhos: numa pista livre em linha, ou num arco por cima de um obstáculo baixo
  const free = lanes.slice(nObs);
  if (free.length && Math.random() < 0.75) {
    const L = free[0]; for (let i = 1; i <= 5; i++) spawn('scroll', L, z + 3 - i * 1.6);
  } else {
    const iLow = kinds.indexOf('low');
    if (iLow >= 0) for (let i = -2; i <= 2; i++) spawn('scroll', lanes[iLow], z + i * 1.3, { y: 0.8 + 1.5 * Math.cos(i / 2.5 * Math.PI / 2) });
  }
  if (lives < M().vidas && Math.random() < 0.06 && free.length > 1) spawn('heart', free[1], z - 4);
}

// ---------------- Estado ----------------
let state = 'loading';           // loading, menu, play, paused, over
let speed = 12, dist = 0, scrolls = 0, lives = 3, inv = 0, chaserT = 0, time = 0;
const P = { lane: 1, x: 0, y: 0, vy: 0, roll: 0, z: 0 };

function updateHearts() {
  const h = $('hearts'); h.innerHTML = '';
  for (let i = 0; i < M().vidas; i++) { const im = new Image(); im.src = IMG['coracao-vida']; im.alt = ''; im.style.opacity = i < lives ? 1 : 0.25; h.appendChild(im); }
}
function score() { return Math.floor(dist) + scrolls * 10; }

function clearItems() { for (const it of items) scene.remove(it.obj); items.length = 0; }
function startGame() {
  audio(); clearItems();
  speed = M().vel0; dist = 0; scrolls = 0; lives = M().vidas; inv = 0; chaserT = 0; time = 0; rowCount = 0;
  Object.assign(P, { lane: 1, x: 0, y: 0, vy: 0, roll: 0, z: 0 });
  nextRowZ = -28; while (nextRowZ > -110) { genRow(nextRowZ); nextRowZ -= rowGap(); }
  $('menu').hidden = true; $('over').hidden = true; $('paused').hidden = true; $('hud').hidden = false;
  updateHearts(); $('scrolls').textContent = '0';
  const b = $('banner'); b.src = IMG['nome-fase-1']; b.hidden = false; b.style.opacity = 1; setTimeout(() => { b.style.opacity = 0; }, 1800); setTimeout(() => { b.hidden = true; }, 2300);
  const t = $('tip'); t.hidden = false; t.style.opacity = 1; setTimeout(() => { t.style.opacity = 0; }, 4500); setTimeout(() => { t.hidden = true; }, 5000);
  state = 'play';
}
function rowGap() { return Math.max(11, speed * 0.85) + Math.random() * 6; }

function gameOver() {
  state = 'over'; SFX.over();
  const s = score(), best = getBest(), novo = s > best; if (novo) setBest(s);
  $('finalScore').textContent = s + ' pontos';
  $('finalInfo').textContent = (novo ? '🏆 NOVO RECORDE! • ' : 'Recorde: ' + Math.max(best, s) + ' • ') + scrolls + ' pergaminhos • ' + M().nome;
  setTimeout(() => { if (state === 'over') { $('over').hidden = false; $('hud').hidden = true; } }, 900);
}

// ---------------- Controles ----------------
function act(a) {
  audio();
  if (state !== 'play') return;
  if (a === 'left' && P.lane > 0) { P.lane--; SFX.lane(); }
  if (a === 'right' && P.lane < 2) { P.lane++; SFX.lane(); }
  if (a === 'jump' && P.y <= 0.001 && P.roll <= 0) { P.vy = 9.6; SFX.jump(); }
  if (a === 'roll') { P.roll = 0.62; if (P.y > 0) P.vy = -16; SFX.roll(); }
}
const KEYS = { ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', ArrowUp: 'jump', KeyW: 'jump', Space: 'jump', ArrowDown: 'roll', KeyS: 'roll' };
window.addEventListener('keydown', e => {
  const a = KEYS[e.code];
  if (e.code === 'Escape' || e.code === 'KeyP') { togglePause(); return; }
  if (!a) { if ((e.code === 'Enter') && state === 'menu') startGame(); return; }
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
function toMenu() { state = 'menu'; clearItems(); $('over').hidden = true; $('paused').hidden = true; $('hud').hidden = true; $('menu').hidden = false; refreshMenu(); }
$('toMenu1').addEventListener('click', toMenu);
$('toMenu2').addEventListener('click', toMenu);
$('again').addEventListener('click', startGame);
$('play').addEventListener('click', startGame);
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
function update(dt) {
  time += dt;
  speed = Math.min(M().velMax, speed + M().acel * dt);
  const dz = speed * dt; dist += dz; P.z -= dz;

  // movimento lateral suave
  P.x += (LANES[P.lane] - P.x) * Math.min(1, dt * 14);
  // pulo e gravidade
  if (P.y > 0 || P.vy > 0) { P.vy -= 28 * dt; P.y += P.vy * dt; if (P.y <= 0) { P.y = 0; P.vy = 0; } }
  if (P.roll > 0) P.roll -= dt;
  if (inv > 0) inv -= dt;
  if (chaserT > 0) chaserT -= dt;

  // mundo acompanha o jogador (texturas deslizam)
  world.position.z = P.z - 60;
  floorTex.offset.y = (dist / LEN) * floorTex.repeat.y;
  lockerTex.offset.x = -(dist / LEN) * lockerTex.repeat.x;
  ceilTex.offset.y = (dist / LEN) * ceilTex.repeat.y;

  // novas fileiras à frente
  while (nextRowZ > P.z - 110) { genRow(nextRowZ); nextRowZ -= rowGap(); }

  // colisões
  const rolling = P.roll > 0;
  const ph = rolling ? 0.8 : 1.7;
  const pb = { x1: P.x - 0.35, x2: P.x + 0.35, y1: P.y, y2: P.y + ph, z1: P.z - 0.3, z2: P.z + 0.3 };
  for (const it of items) {
    if (!it.alive) continue;
    if (it.kind === 'scroll' || it.kind === 'heart') it.obj.rotation.y += dt * 3;
    if (it.kind === 'fly') it.obj.position.y = 1.45 + Math.sin(time * 6 + it.z) * 0.08;
    const ib = it.box, ix = it.obj.position.x;
    if (ix - ib.w / 2 < pb.x2 && ix + ib.w / 2 > pb.x1 && it.z - ib.d / 2 < pb.z2 && it.z + ib.d / 2 > pb.z1 && ib.y < pb.y2 && ib.y + ib.h > pb.y1) {
      if (it.kind === 'scroll') { it.alive = false; scene.remove(it.obj); scrolls++; $('scrolls').textContent = scrolls; SFX.scroll(); }
      else if (it.kind === 'heart') { it.alive = false; scene.remove(it.obj); if (lives < M().vidas) lives++; updateHearts(); SFX.life(); }
      else if (inv <= 0) {
        lives--; SFX.hit(); updateHearts(); inv = 1.3; chaserT = 5; it.alive = false; scene.remove(it.obj);
        speed = Math.max(M().vel0, speed * 0.85);
        if (lives <= 0) { gameOver(); return; }
      }
    }
  }
  // remove o que ficou para trás
  for (let i = items.length - 1; i >= 0; i--) {
    if (!items[i].alive || items[i].z > P.z + 8) { if (items[i].alive) scene.remove(items[i].obj); items.splice(i, 1); }
  }
  $('score').textContent = score();
}

function place(dt) {
  // jogador
  player.position.set(P.x, P.y, P.z);
  const air = P.y > 0.05, rolling = P.roll > 0;
  if (dpRun && dpJump) { dpRun.visible = !air; dpJump.visible = air; }
  player.rotation.z = (P.x - LANES[P.lane]) * 0.12;
  if (rolling) { player.scale.set(1, 0.5, 1); player.rotation.x = -(0.62 - P.roll) / 0.62 * Math.PI * 2; }
  else { player.scale.set(1, 1, 1); player.rotation.x = 0; if (!air && dpRun) dpRun.position.y = Math.abs(Math.sin(time * 14)) * 0.08; }
  player.visible = !(inv > 0 && Math.floor(inv * 10) % 2 === 0);
  shadow.position.set(P.x, 0.02, P.z); shadow.scale.setScalar(1 - Math.min(0.6, P.y * 0.25));

  // Mão Afiada: chega perto quando você tropeça
  const perto = state === 'over' || chaserT > 0;
  const behind = state === 'over' ? 1.2 : (chaserT > 0 ? 1.9 : 9);
  tmp.set(P.x + (perto ? (P.lane === 2 ? -1.3 : 1.3) : 0), 0, P.z + behind);
  chaser.position.lerp(tmp, Math.min(1, dt * (perto ? 7 : 3)));
  if (ma1 && ma2) { const f = Math.floor(time * 8) % 2; ma1.visible = f === 0; ma2.visible = f === 1; }
  chaser.position.y = Math.abs(Math.sin(time * 10)) * 0.12;

  // Cinzento correndo lá na frente
  friend.position.set(Math.sin(time * 0.7) * 2, Math.abs(Math.sin(time * 12)) * 0.1, P.z - 34);

  // câmera atrás e acima
  const cx = P.x * 0.75;
  camera.position.set(cx, 3.1 + P.y * 0.35, P.z + 5.6);
  camera.lookAt(cx, 1.2 + P.y * 0.25, P.z - 6);
}

// ---------------- Laço ----------------
let last = performance.now();
function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (state === 'play') { update(dt); music(dt); }
  else if (state === 'menu' || state === 'loading') { time += dt; P.z -= dt * 6; dist += dt * 6; world.position.z = P.z - 60; floorTex.offset.y = (dist / LEN) * floorTex.repeat.y; lockerTex.offset.x = -(dist / LEN) * lockerTex.repeat.x; }
  else if (state === 'over') { time += dt; }
  place(dt);
  renderer.render(scene, camera);
  requestAnimationFrame(loop);
}

// ---------------- Início ----------------
(async function init() {
  resize();
  $('logo').src = IMG['titulo-ninja-em-acao'];
  requestAnimationFrame(loop);
  dpRun = await voxel('dead-power-1-parado', 32, 1.75, 4);
  dpJump = await voxel('dead-power-2-pulando', 32, 1.75, 4);
  player.add(dpRun, dpJump); dpJump.visible = false;
  ma1 = await voxel('mao-afiada-1', 36, 2.3, 5); ma2 = await voxel('mao-afiada-2', 36, 2.3, 5);
  chaser.add(ma1, ma2); chaser.position.set(0, 0, 9);
  cinz = await voxel('cinzento', 30, 1.7, 4); friend.add(cinz);
  for (const n of LOW) PROTOS[n] = await voxel(n, 18, n === 'cone' ? 1.0 : 0.85, 8);
  for (const n of FLY) PROTOS[n] = await voxel(n, 22, 0.55, 3);
  scrollProto = makeScrollProto();
  heartProto = await voxel('coracao-vida', 14, 0.7, 4);
  wallProto = makeWallProto();
  state = 'menu'; refreshMenu();
})();

// ganchos para testes automáticos
window.__n3d = { get state() { return state; }, get dist() { return dist; }, get lives() { return lives; }, get speed() { return speed; },
  get scrolls() { return scrolls; }, P, items, act, start: startGame, setModo: m => { modo = m; refreshMenu(); } };
