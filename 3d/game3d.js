/* Ninja em Ação 3D
   Corrida em 3 pistas por 5 cenários + chefão final contra o Mão Afiada.
   Personagens e obstáculos são os desenhos do criador do jogo, transformados em cubinhos (voxels). */
import * as THREE from './three.module.min.js';

const IMG = window.__IMG;
const $ = id => document.getElementById(id);
const LANES = [-2.2, 0, 2.2];
const PHASE_LEN = 420;          // distância de cada fase

// ---------------- Plataforma (CrazyGames, opcional) e salvamento ----------------
let CG = null, adsOn = false, cgMuted = false, adMuted = false, inGameplay = false;
const Store = {
  get(k) {
    try { if (CG && CG.data) { const v = CG.data.getItem(k); if (v !== null && v !== undefined) return String(v); } } catch (e) {}
    try { return localStorage.getItem(k); } catch (e) { return null; }
  },
  set(k, v) {
    v = String(v);
    try { if (CG && CG.data) CG.data.setItem(k, v); } catch (e) {}
    try { localStorage.setItem(k, v); } catch (e) {}
  },
};
function cgCall(fn) { try { if (CG && CG.game && CG.game[fn]) CG.game[fn](); } catch (e) {} }
function gameplayStart() { if (!inGameplay) { inGameplay = true; cgCall('gameplayStart'); } }
function gameplayStop() { if (inGameplay) { inGameplay = false; cgCall('gameplayStop'); } }
async function initPlatform() {
  const sdk = window.CrazyGames && window.CrazyGames.SDK;
  if (!sdk) return;
  try { await sdk.init(); if (sdk.environment === 'disabled') return; CG = sdk; } catch (e) { return; }
  adsOn = !!(CG.ad && CG.ad.requestAd);
  try {
    cgMuted = !!(CG.game.settings && CG.game.settings.muteAudio);
    CG.game.addSettingsChangeListener(s => { cgMuted = !!(s && s.muteAudio); applyVolume(); updateMuteBtns(); });
  } catch (e) {}
}
// Anúncio: bloqueia a tela até terminar. done(true) só quando o anúncio foi assistido.
function showAd(type, done) {
  if (!adsOn) { done(false); return; }
  $('adwait').hidden = false; let fin = false;
  const end = ok => { if (fin) return; fin = true; adMuted = false; applyVolume(); $('adwait').hidden = true; done(ok); };
  try {
    CG.ad.requestAd(type, { adStarted: () => { adMuted = true; applyVolume(); }, adFinished: () => end(true), adError: () => end(false) });
  } catch (e) { end(false); }
}

// ---------------- Idiomas ----------------
const STR = {
  pt: {
    points: 'pontos', play: 'JOGAR', easy: 'FÁCIL', medium: 'MÉDIO', hard: 'DIFÍCIL', subtitle: '3D',
    ctrlHint: 'Celular: deslize o dedo • Computador: setas ou espaço',
    powHint: '5 fases + chefão • Poderes: 🌀 ímã • 🛡️ escudo • 👟 super pulo',
    paused: 'Pausado', resume: 'CONTINUAR', menu: 'MENU', congrats: 'PARABÉNS!',
    winText: 'Você derrotou o Mão Afiada e reencontrou seu amigo!', again: 'JOGAR DE NOVO', soon: 'Experimente o modo ♾️ Infinito!',
    overTitle: 'O Mão Afiada te pegou!', tip: 'Deslize: ↑ pular • ↓ rolar • ← → trocar de pista',
    boss: 'MÃO AFIADA', bossBanner: 'CHEFÃO: Mão Afiada! Pegue as bombas 💣', bossHud: 'CHEFÃO!', phase: 'Fase',
    record: 'Recorde', newRecord: '🏆 NOVO RECORDE!', scrollsW: 'pergaminhos',
    recordIn: (m, b) => `🏆 Recorde no ${m}: ${b} pontos`,
    shop: '🛒 LOJA', shopTitle: 'Loja do Dead Power', buy: 'Comprar', use: 'Usar', using: '✔ Usando', back: 'VOLTAR',
    contAd: '📺 Continuar (anúncio)', contScroll: 'Continuar (30 📜)', noAd: 'Sem anúncio agora, tente mais tarde.',
    oneChance: 'Uma chance de continuar por partida!', wait: 'Carregando anúncio…', bank: 'Seus pergaminhos',
    missing: n => `Faltam ${n} 📜`, shopHint: 'Junte pergaminhos nas corridas para comprar roupas novas!',
    lang: '🌐 English', free: 'Grátis', stage: (n, t) => `Fase ${n}: ${t}`,
    endless: '♾️ INFINITO', endlessHud: t => `♾️ ${t}`, endlessBest: b => `♾️ Recorde no Infinito: ${b} pontos`, meters: 'm',
    missions: '🎯 MISSÕES', missionsTitle: 'Missões', missionDone: (t, r) => `✅ ${t}  +${r} 📜`, missionsHint: 'Complete missões para ganhar pergaminhos!',
    skip: 'Pular tutorial ⏭', tutLaneK: 'Desvie! Use ← →', tutLaneT: 'Desvie! Deslize para o lado', tutJumpK: 'Pule! Aperte ↑ ou Espaço', tutJumpT: 'Pule! Deslize para cima',
    tutRollK: 'Role por baixo! Aperte ↓', tutRollT: 'Role por baixo! Deslize para baixo', tutScroll: 'Pegue os pergaminhos 📜', tutGo: 'Agora fuja do Mão Afiada!',
    modes: [{ nome: 'Fácil', info: '3 vidas • começa rápido' }, { nome: 'Médio', info: '2 vidas • muito rápido' }, { nome: 'Difícil', info: '1 vida • super rápido!' }],
    themes: ['Escola', 'Pátio', 'Telhados', 'Trem', 'Museu'],
    powers: { ima: 'Ímã de pergaminhos', escudo: 'Escudo ninja', pulo: 'Super pulo' },
    skins: { classico: 'Clássico', fogo: 'Fogo', floresta: 'Floresta', sombra: 'Sombra', dourado: 'Dourado', arcoiris: 'Arco-íris' },
  },
  en: {
    points: 'points', play: 'PLAY', easy: 'EASY', medium: 'MEDIUM', hard: 'HARD', subtitle: 'Ninja in Action 3D',
    ctrlHint: 'Phone: swipe • Computer: arrow keys or space',
    powHint: '5 stages + boss • Powers: 🌀 magnet • 🛡️ shield • 👟 super jump',
    paused: 'Paused', resume: 'RESUME', menu: 'MENU', congrats: 'YOU WIN!',
    winText: 'You defeated Sharp Hand and found your friend!', again: 'PLAY AGAIN', soon: 'Try ♾️ Endless mode!',
    overTitle: 'Sharp Hand got you!', tip: 'Swipe: ↑ jump • ↓ roll • ← → change lane',
    boss: 'SHARP HAND', bossBanner: 'BOSS: Sharp Hand! Grab the bombs 💣', bossHud: 'BOSS!', phase: 'Stage',
    record: 'Best', newRecord: '🏆 NEW RECORD!', scrollsW: 'scrolls',
    recordIn: (m, b) => `🏆 Best on ${m}: ${b} points`,
    shop: '🛒 SHOP', shopTitle: "Dead Power's Shop", buy: 'Buy', use: 'Use', using: '✔ Using', back: 'BACK',
    contAd: '📺 Continue (ad)', contScroll: 'Continue (30 📜)', noAd: 'No ad right now, try again later.',
    oneChance: 'One chance to continue per run!', wait: 'Loading ad…', bank: 'Your scrolls',
    missing: n => `${n} 📜 missing`, shopHint: 'Collect scrolls while running to buy new outfits!',
    lang: '🌐 Português', free: 'Free', stage: (n, t) => `Stage ${n}: ${t}`,
    endless: '♾️ ENDLESS', endlessHud: t => `♾️ ${t}`, endlessBest: b => `♾️ Endless best: ${b} points`, meters: 'm',
    missions: '🎯 MISSIONS', missionsTitle: 'Missions', missionDone: (t, r) => `✅ ${t}  +${r} 📜`, missionsHint: 'Complete missions to earn scrolls!',
    skip: 'Skip tutorial ⏭', tutLaneK: 'Dodge! Use ← →', tutLaneT: 'Dodge! Swipe sideways', tutJumpK: 'Jump! Press ↑ or Space', tutJumpT: 'Jump! Swipe up',
    tutRollK: 'Roll under! Press ↓', tutRollT: 'Roll under! Swipe down', tutScroll: 'Grab the scrolls 📜', tutGo: 'Now run from Sharp Hand!',
    modes: [{ nome: 'Easy', info: '3 lives • starts fast' }, { nome: 'Medium', info: '2 lives • very fast' }, { nome: 'Hard', info: '1 life • super fast!' }],
    themes: ['School', 'Playground', 'Rooftops', 'Train', 'Museum'],
    powers: { ima: 'Scroll magnet', escudo: 'Ninja shield', pulo: 'Super jump' },
    skins: { classico: 'Classic', fogo: 'Fire', floresta: 'Forest', sombra: 'Shadow', dourado: 'Golden', arcoiris: 'Rainbow' },
  },
};
let lang = (navigator.language || 'pt').toLowerCase().startsWith('pt') ? 'pt' : 'en';
const L = () => STR[lang];
function applyLang() {
  document.documentElement.lang = lang === 'pt' ? 'pt-BR' : 'en';
  document.querySelectorAll('[data-i18n]').forEach(el => { const v = L()[el.dataset.i18n]; if (typeof v === 'string') el.textContent = v; });
  if (typeof refreshMenu === 'function' && state !== 'loading') refreshMenu();
  if (typeof updatePhaseHud === 'function') updatePhaseHud();
}

const MTXT = {
  pt: { runScrolls: n => `Pegue ${n} 📜 numa corrida`, jumps: n => `Pule ${n} vezes`, rolls: n => `Role ${n} vezes`, powers: n => `Pegue ${n} poderes`,
        reachPhase: n => `Chegue na fase ${n}`, boss: () => 'Derrote o Mão Afiada', endlessDist: n => `Corra ${n} m no Infinito`, runs: n => `Jogue ${n} partidas`, lanes: n => `Troque de pista ${n} vezes` },
  en: { runScrolls: n => `Grab ${n} 📜 in one run`, jumps: n => `Jump ${n} times`, rolls: n => `Roll ${n} times`, powers: n => `Grab ${n} powers`,
        reachPhase: n => `Reach stage ${n}`, boss: () => 'Defeat Sharp Hand', endlessDist: n => `Run ${n} m in Endless`, runs: n => `Play ${n} runs`, lanes: n => `Change lanes ${n} times` },
};
// ---------------- Modos ----------------
const MODES = [
  { vidas: 3, vel0: 12, velMax: 24, acel: 0.20, ataque: 1.7 },
  { vidas: 2, vel0: 15, velMax: 30, acel: 0.28, ataque: 1.35 },
  { vidas: 1, vel0: 18, velMax: 36, acel: 0.36, ataque: 1.05 },
];
let modo = 1;
const M = () => MODES[modo];
const modeName = () => L().modes[modo].nome;
const bestKey = () => runType === 'endless' ? 'ninja3d-recorde-inf-' + modo : 'ninja3d-recorde-' + modo;
function getBest() { return +(Store.get(bestKey()) || 0); }
function setBest(v) { Store.set(bestKey(), v); }

// ---------------- Pergaminhos guardados e roupas ----------------
const SKINS = [
  { id: 'classico', price: 0,   sw: '#3D558F' },
  { id: 'fogo',     price: 50,  sw: '#d63a2f', suit: { h: 0.0, sm: 1.2, lm: 1.15 }, acc: { h: 0.13, sm: 1, lm: 1.1 } },
  { id: 'floresta', price: 100, sw: '#2e8b3e', suit: { h: 0.36, sm: 1.1, lm: 1.05 } },
  { id: 'sombra',   price: 150, sw: '#6b3fa0', suit: { h: 0.76, sm: 1.1, lm: 1.0 }, acc: { h: 0.48, sm: 1, lm: 1 } },
  { id: 'dourado',  price: 300, sw: '#e0b02a', suit: { h: 0.125, s: 0.92, lm: 1.15, la: 0.2 }, acc: { h: 0, s: 0, l: 0.95 } },
  { id: 'arcoiris', price: 500, sw: 'linear-gradient(135deg,#e74c3c,#f1c40f,#2ecc71,#3498db,#9b59b6)', rainbow: true },
];
let bank = 0, owned = ['classico'], skin = 'classico', bankedThisRun = 0;
function loadSave() {
  const g = Store.get('ninja3d-modo'); if (g === '0' || g === '1' || g === '2') modo = +g;
  const lg = Store.get('ninja3d-idioma');
  if (lg === 'pt' || lg === 'en') lang = lg;
  else { let loc = ''; try { loc = (CG && CG.user && CG.user.systemInfo && CG.user.systemInfo.locale) || ''; } catch (e) {} if (!loc) loc = navigator.language || 'en'; lang = String(loc).toLowerCase().startsWith('pt') ? 'pt' : 'en'; }
  try { missionsState = JSON.parse(Store.get('ninja3d-missoes') || 'null'); } catch (e) { missionsState = null; }
  tutorialDone = Store.get('ninja3d-tutorial') === '1';
  bank = Math.max(0, +(Store.get('ninja3d-banco') || 0) || 0);
  try { const o = JSON.parse(Store.get('ninja3d-roupas') || '[]'); if (Array.isArray(o)) owned = [...new Set(['classico', ...o.filter(x => SKINS.some(s => s.id === x))])]; } catch (e) {}
  const s = Store.get('ninja3d-roupa'); if (s && owned.includes(s)) skin = s;
  muted = Store.get('ninja3d-som') === '0';
}
function saveBank() { Store.set('ninja3d-banco', bank); }
function bankRun() { bank += scrolls - bankedThisRun; bankedThisRun = scrolls; saveBank(); }

// ---------------- Som (feito no aparelho) ----------------
let AC = null, master = null, sfxBus = null, musicBus = null, muted = false, noiseBuf = null;
const isMuted = () => muted || cgMuted || adMuted;
function applyVolume() { if (master) master.gain.value = isMuted() ? 0 : 0.6; }
function audio() {
  if (!AC) {
    const A = window.AudioContext || window.webkitAudioContext; if (!A) return null; AC = new A();
    const comp = AC.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 4; comp.connect(AC.destination);
    master = AC.createGain(); master.connect(comp); sfxBus = AC.createGain(); sfxBus.gain.value = 0.8; sfxBus.connect(master);
    musicBus = AC.createGain(); musicBus.gain.value = 0.32; musicBus.connect(master); applyVolume();
    noiseBuf = AC.createBuffer(1, AC.sampleRate * 0.4, AC.sampleRate); const nd = noiseBuf.getChannelData(0); for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
  }
  if (AC.state === 'suspended') AC.resume();
  return AC;
}
function updateMuteBtns() { document.querySelectorAll('.mutebtn').forEach(b => { b.textContent = (muted || cgMuted) ? '🔇' : '🔊'; }); }
function toggleMute() { muted = !muted; Store.set('ninja3d-som', muted ? '0' : '1'); audio(); applyVolume(); updateMuteBtns(); }
function tone(f, dur, type = 'square', vol = 0.12, when = 0, slide = null) {
  const a = audio(); if (!a || isMuted()) return; const t = a.currentTime + when;
  const o = a.createOscillator(), g = a.createGain(); o.type = type; o.frequency.setValueAtTime(f, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + dur);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g); g.connect(sfxBus); o.start(t); o.stop(t + dur + 0.02);
}
function noise(dur, vol = 0.3) {
  const a = audio(); if (!a || isMuted()) return;
  const n =Math.floor(a.sampleRate * dur), b = a.createBuffer(1, n, a.sampleRate), d = b.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
  const s = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain(); f.type = 'lowpass'; f.frequency.value = 900; g.gain.value = vol;
  s.buffer = b; s.connect(f); f.connect(g); g.connect(sfxBus); s.start();
}
const SFX = {
  jump: () => tone(320, 0.16, 'square', 0.1, 0, 760),
  bigJump: () => tone(260, 0.3, 'square', 0.1, 0, 1200),
  roll: () => tone(500, 0.18, 'triangle', 0.12, 0, 160),
  lane: () => tone(700, 0.05, 'sine', 0.06),
  scroll: () => { const k = Math.pow(2, Math.min(scrollStreak, 12) / 12); tone(988 * k, 0.06, 'square', 0.055); tone(1319 * k, 0.08, 'square', 0.055, 0.04); },
  mission: () => [784, 1047, 1319, 1568].forEach((f, i) => tone(f, 0.14, 'triangle', 0.12, i * 0.08)),
  land: () => noise(0.06, 0.12),
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
// Música: sequenciador com bateria, baixo e melodia (agendado no relógio do áudio, não depende da taxa de quadros)
const NOTE = n => 440 * Math.pow(2, (n - 69) / 12);
const SONGS = [ // root MIDI, escala, progressão (graus), bpm
  { root: 57, sc: [0, 2, 4, 5, 7, 9, 11], prog: [0, 5, 3, 4], bpm: 132 },  // Escola: alegre
  { root: 60, sc: [0, 2, 4, 5, 7, 9, 11], prog: [0, 3, 4, 3], bpm: 138 },  // Pátio
  { root: 55, sc: [0, 2, 3, 5, 7, 8, 10], prog: [0, 5, 6, 4], bpm: 140 },  // Telhados (noite, menor)
  { root: 59, sc: [0, 2, 4, 5, 7, 9, 11], prog: [0, 4, 5, 3], bpm: 146 },  // Trem
  { root: 52, sc: [0, 2, 3, 5, 7, 8, 10], prog: [0, 3, 5, 4], bpm: 136 },  // Museu (misterioso)
  { root: 50, sc: [0, 1, 3, 5, 7, 8, 10], prog: [0, 1, 0, 6], bpm: 156 },  // Chefão
];
const MEL = [0, 2, 4, 2, 7, 4, 2, 4, 0, 4, 7, 9, 7, 4, 2, 1]; // contorno da melodia (graus relativos ao acorde)
let musicOn = false, mStep = 0, mNext = 0, mSong = -1, mTimer = null;
function deg(song, d, oct = 0) { const sc = song.sc, n = sc.length; const o = Math.floor(d / n); return song.root + sc[((d % n) + n) % n] + 12 * (o + oct); }
function drum(kind, t, v = 1) {
  if (kind === 'k') { const o = AC.createOscillator(), g = AC.createGain(); o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
    g.gain.setValueAtTime(0.9 * v, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.16); o.connect(g); g.connect(musicBus); o.start(t); o.stop(t + 0.18); return; }
  const src = AC.createBufferSource(); src.buffer = noiseBuf; const f = AC.createBiquadFilter(), g = AC.createGain();
  if (kind === 's') { f.type = 'bandpass'; f.frequency.value = 1900; g.gain.setValueAtTime(0.45 * v, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.13); }
  else { f.type = 'highpass'; f.frequency.value = 7000; g.gain.setValueAtTime(0.16 * v, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.04); }
  src.connect(f); f.connect(g); g.connect(musicBus); src.start(t); src.stop(t + 0.2);
}
function synth(type, f, t, dur, vol, cut) {
  const o = AC.createOscillator(), fl = AC.createBiquadFilter(), g = AC.createGain(); o.type = type; o.frequency.setValueAtTime(f, t);
  fl.type = 'lowpass'; fl.frequency.value = cut; g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(fl); fl.connect(g); g.connect(musicBus); o.start(t); o.stop(t + dur + 0.02);
}
function playStep(song, st, t) {
  const bar = Math.floor(st / 16) % 4, s16 = st % 16, ch = song.prog[bar], calm = state === 'menu';
  if (!calm) {
    if (s16 % 4 === 0) drum('k', t);
    if (s16 === 4 || s16 === 12) drum('s', t);
    if (s16 % 2 === 1) drum('h', t, s16 % 4 === 3 ? 1 : 0.6);
  } else if (s16 === 0 || s16 === 8) drum('k', t, 0.5);
  if (s16 % 2 === 0) synth('sawtooth', NOTE(deg(song, ch, -2) + (s16 % 4 === 2 ? 12 : 0)), t, 0.16, calm ? 0.14 : 0.2, 700);
  if ([0, 3, 6, 8, 10, 12, 14].includes(s16)) synth('square', NOTE(deg(song, ch + MEL[(s16 + bar * 4) % 16], 0)), t, s16 === 14 ? 0.3 : 0.15, calm ? 0.05 : 0.075, 2600);
  if (s16 === 0) [0, 2, 4].forEach(k => synth('triangle', NOTE(deg(song, ch + k, -1)), t, 1.6, 0.04, 1800));
}
function musicTick() {
  if (!AC || !musicOn) return;
  const idx = state === 'menu' ? 0 : Math.min(phase, 5), song = SONGS[idx];
  if (idx !== mSong) { mSong = idx; mStep = 0; mNext = Math.max(mNext, AC.currentTime + 0.05); }
  const stepDur = 60 / song.bpm / 4;
  while (mNext < AC.currentTime + 0.15) { if (!isMuted()) playStep(song, mStep, mNext); mStep++; mNext += stepDur; }
}
function setMusic(on) { musicOn = on; if (on && AC) { mNext = Math.max(mNext, AC.currentTime + 0.05); if (!mTimer) mTimer = setInterval(musicTick, 25); } }
function music() { setMusic(!!AC && (state === 'play' || state === 'menu')); }

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
  camera.fov = w / h < 0.8 ? 70 : 60;  // o laço ajusta um pouco com a velocidade
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
  g.userData = { w: cols * size, h: rows * size, d: depth * size, geo, base: Float32Array.from(colr) };
  return g;
}

// Pinta a roupa do Dead Power: troca a cor do macacão azul (e do detalhe vermelho)
const _c = new THREE.Color(), _hsl = { h: 0, s: 0, l: 0 };
const clamp01 = v => Math.max(0, Math.min(1, v));
function skinClasses(g) {
  if (g.userData.cls) return g.userData.cls;
  const b = g.userData.base, cls = new Uint8Array(b.length / 3);
  for (let i = 0; i < cls.length; i++) {
    _c.setRGB(b[i * 3], b[i * 3 + 1], b[i * 3 + 2]); _c.getHSL(_hsl, THREE.SRGBColorSpace);
    const hd = _hsl.h * 360;
    if (hd >= 195 && hd <= 250 && _hsl.s > 0.2) cls[i] = 1;
    else if ((hd < 20 || hd > 340) && _hsl.s > 0.5 && _hsl.l > 0.35) cls[i] = 2;
  }
  return (g.userData.cls = cls);
}
function recolor(g, def, t = 0) {
  if (!g || !g.userData.base) return;
  const b = g.userData.base, attr = g.userData.geo.getAttribute('color'), a = attr.array, cls = skinClasses(g);
  const rule = (k, h) => { if (h) return h; return null; };
  for (let i = 0; i < cls.length; i++) {
    let r = null;
    if (def && def.rainbow && cls[i]) r = { h: (t * 0.12 + (cls[i] === 2 ? 0.5 : 0) + i * 0.00002) % 1, sm: 1.4, lm: 1.4 };
    else if (def && cls[i] === 1) r = rule(1, def.suit);
    else if (def && cls[i] === 2) r = rule(2, def.acc);
    if (!r) { a[i * 3] = b[i * 3]; a[i * 3 + 1] = b[i * 3 + 1]; a[i * 3 + 2] = b[i * 3 + 2]; continue; }
    _c.setRGB(b[i * 3], b[i * 3 + 1], b[i * 3 + 2]); _c.getHSL(_hsl, THREE.SRGBColorSpace);
    const s = r.s !== undefined ? r.s : clamp01(_hsl.s * (r.sm || 1)), l = r.l !== undefined ? r.l * (0.7 + _hsl.l) : clamp01(_hsl.l * (r.lm || 1) + (r.la || 0));
    _c.setHSL(r.h, s, clamp01(l), THREE.SRGBColorSpace);
    a[i * 3] = _c.r; a[i * 3 + 1] = _c.g; a[i * 3 + 2] = _c.b;
  }
  attr.needsUpdate = true;
}
function applySkin() { const def = SKINS.find(s => s.id === skin) || SKINS[0]; recolor(dpRun, def.id === 'classico' ? null : def, time); recolor(dpJump, def.id === 'classico' ? null : def, time); }
let rainbowT = 0;
function updateRainbow(dt) {
  if (skin !== 'arcoiris') return; rainbowT -= dt; if (rainbowT > 0) return; rainbowT = 0.08;
  const def = SKINS.find(s => s.id === 'arcoiris'); recolor(dpRun && dpRun.visible ? dpRun : dpJump, def, time);
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
const POWER_ICON = { ima: '🌀', escudo: '🛡️', pulo: '👟' };
let continued = false, offeredAd = false;
let runType = 'story', nextPhaseAt = PHASE_LEN, lap = 0, timeScale = 1, timeTarget = 1, scrollStreak = 0, streakT = 0, shake = 0;
let tut = null, tutorialDone = false, missionsState = null, runStats = null, wasAir = false, touchUsed = false;

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
  $('phase').textContent = runType === 'endless' ? L().endlessHud(L().themes[phase]) : phase < 5 ? `${L().phase} ${phase + 1}/5 • ${L().themes[phase]}` : L().bossHud;
}
function phaseBanner(i) {
  if (lang === 'pt') showBanner(THEMES[i].banner); else showBanner(null, L().stage(i + 1, L().themes[i]));
}

function startGame(startPhase = 0, opts = {}) {
  audio(); clearItems(); runType = opts.endless ? 'endless' : 'story'; lap = 0; nextPhaseAt = (Math.min(startPhase, 4) + 1) * PHASE_LEN;
  timeScale = timeTarget = 1; scrollStreak = 0; shake = 0; wasAir = false; hideTut();
  runStats = { scrolls: 0, jumps: 0, rolls: 0, powers: 0, lanes: 0, maxPhase: Math.min(startPhase, 4) + 1 };
  speed = M().vel0; dist = startPhase * PHASE_LEN; scrolls = 0; bankedThisRun = 0; continued = false; offeredAd = false; bonus = 0; lives = M().vidas; inv = 0; chaserT = 0; time = 0; rowCount = 0;
  phase = Math.min(startPhase, 4); power.name = null; power.t = 0; shield = false; bubble.visible = false; $('powerbox').hidden = true;
  Object.assign(P, { lane: 1, x: 0, y: 0, vy: 0, roll: 0, z: 0 });
  Object.assign(boss, { hp: 3, t: 0, bombT: 0, x: 0, phaseOut: 0, hitFlash: 0 });
  chaser.rotation.set(0, 0, 0); chaser.scale.setScalar(1); chaser.visible = true; friend.visible = true;
  chaser.position.set(0, 0, 9);  // começa atrás do ninja (não passa na frente da câmera)
  applyTheme(phase);
  tut = opts.tutorial ? { step: 0, waiting: false, rowsBuilt: false, endZ: 0, msgT: 0 } : null;
  if (tut) buildTutorial(); else { nextRowZ = -28; while (nextRowZ > -110) { genRow(nextRowZ); nextRowZ -= rowGap(); } }
  $('skipTut').hidden = !tut;
  for (const id of ['menu', 'over', 'paused', 'win']) $(id).hidden = true;
  $('hud').hidden = false;
  updateHearts(); $('scrolls').textContent = '0'; updatePhaseHud();
  phaseBanner(phase);
  if (startPhase === 0 && !tut) { const t = $('tip'); t.hidden = false; t.style.opacity = 1; setTimeout(() => { t.style.opacity = 0; }, 4500); setTimeout(() => { t.hidden = true; }, 5000); }
  stopConfetti();
  if (startPhase >= 5) startBoss();
  state = 'play'; gameplayStart(); music(); mission('runs', 1);
}
function rowGap() { return Math.max(11, speed * 0.85) + Math.random() * 6; }

function nextPhase() {
  bonus += 100; SFX.phase(); nextPhaseAt += PHASE_LEN;
  if (runType === 'endless') { phase = (phase + 1) % 5; if (phase === 0) lap++; applyTheme(phase); updatePhaseHud(); phaseBanner(phase); return; }
  phase++; runStats.maxPhase = Math.max(runStats.maxPhase, phase + 1); mission('reachPhase', Math.min(phase + 1, 5));
  if (phase >= 5) { startBoss(); return; }
  applyTheme(phase); updatePhaseHud(); phaseBanner(phase);
}

// ---------------- Chefão ----------------
function startBoss() {
  phase = 5; applyTheme(4); updatePhaseHud();
  // limpa obstáculos que ainda estão à frente
  for (const it of items) if (it.z < P.z - 2 && it.kind !== 'scroll') { it.alive = false; scene.remove(it.obj); }
  Object.assign(boss, { hp: 3, t: 2.2, bombT: 3.5, x: 0, phaseOut: 0, hitFlash: 0 });
  showBanner(null, L().bossBanner);
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

function endInfo(novo, best, s, withPhase) {
  return (novo ? L().newRecord + ' • ' : L().record + ': ' + Math.max(best, s) + ' • ') + scrolls + ' ' + L().scrollsW + ' • ' +
    (runType === 'endless' ? Math.floor(dist) + ' ' + L().meters + ' • ' : withPhase ? (phase < 5 ? L().phase + ' ' + (phase + 1) : L().bossHud) + ' • ' : '') + modeName();
}
function gameOver() {
  state = 'over'; SFX.over(); $('bossbar').hidden = true; gameplayStop(); hideTut(); endRunMissions(); bankRun(); music();
  const s = score(), best = getBest(), novo = s > best; if (novo) setBest(s);
  $('finalScore').textContent = s + ' ' + L().points;
  $('finalInfo').textContent = endInfo(novo, best, s, true);
  const can = !continued && !tut && (dist >= PHASE_LEN || phase === 5);
  $('contAd').hidden = !(can && adsOn); $('contScroll').hidden = !(can && bank >= 30);
  offeredAd = !$('contAd').hidden; $('overMsg').textContent = can && (adsOn || bank >= 30) ? L().oneChance : '';
  setTimeout(() => { if (state === 'over') { $('over').hidden = false; $('hud').hidden = true; } }, 900);
}
function doContinue() {
  if (state !== 'over' || continued) return;
  continued = true; lives = 1; updateHearts(); inv = 2.5; chaserT = 0;
  for (const it of items) if (it.alive && it.kind !== 'scroll' && it.z > P.z - 25 && it.z < P.z + 8) { it.alive = false; scene.remove(it.obj); }
  if (boss.warn) { scene.remove(boss.warn.mesh); boss.warn = null; boss.t = 1.5; }
  $('over').hidden = true; $('hud').hidden = false; if (phase === 5 && boss.hp > 0) $('bossbar').hidden = false;
  SFX.life(); state = 'play'; last = performance.now(); gameplayStart(); music();
}
function victory() {
  state = 'win'; bonus += 1000; SFX.win(); gameplayStop(); mission('boss', 1); endRunMissions(); bankRun(); music(); cgCall('happytime');
  const s = score(), best = getBest(), novo = s > best; if (novo) setBest(s);
  $('winScore').textContent = s + ' ' + L().points;
  $('winInfo').textContent = endInfo(novo, best, s, false);
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
  let did = false;
  if (a === 'left' && P.lane > 0) { P.lane--; SFX.lane(); did = true; mission('lanes', 1); }
  if (a === 'right' && P.lane < 2) { P.lane++; SFX.lane(); did = true; mission('lanes', 1); }
  if (a === 'jump' && P.y <= 0.001 && P.roll <= 0) { const big = power.name === 'pulo'; P.vy = big ? 13.5 : 9.6; big ? SFX.bigJump() : SFX.jump(); did = true; mission('jumps', 1); burst(tmp.set(P.x, 0.1, P.z), 0xcfc6b0, 6, 2.5, 1.5, 0.1, 0.35); }
  if (a === 'roll') { P.roll = 0.62; if (P.y > 0) P.vy = -16; SFX.roll(); did = true; mission('rolls', 1); }
  if (did && tut && tut.waiting) tutAction(a);
}
const KEYS = { ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', ArrowUp: 'jump', KeyW: 'jump', Space: 'jump', ArrowDown: 'roll', KeyS: 'roll' };
window.addEventListener('keydown', e => {
  const a = KEYS[e.code];
  if (e.code === 'KeyP') { togglePause(); return; }  // Esc fica livre: no CrazyGames ele sai da tela cheia
  const menuReady = state === 'menu' && $('shop').hidden && $('missionsPanel').hidden && $('adwait').hidden;
  if (!a) { if (e.code === 'Enter' && menuReady) startGame(0, { tutorial: !tutorialDone }); return; }
  e.preventDefault(); if (!e.repeat) act(a);
  if (menuReady && a === 'jump') startGame(0, { tutorial: !tutorialDone });
});
let sx = 0, sy = 0, swiping = false;
const area = $('game');
area.addEventListener('pointerdown', e => { if (e.pointerType === 'touch') touchUsed = true; if (e.target.closest('button')) return; audio(); music(); sx = e.clientX; sy = e.clientY; swiping = true; });
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
  if (state === 'play') { state = 'paused'; $('paused').hidden = false; gameplayStop(); music(); }
  else if (state === 'paused') { state = 'play'; $('paused').hidden = true; last = performance.now(); gameplayStart(); music(); }
}
$('pause').addEventListener('click', togglePause);
$('resume').addEventListener('click', togglePause);
function toMenu() {
  state = 'menu'; gameplayStop(); clearItems(); for (const p of projectiles) scene.remove(p.obj); projectiles.length = 0;
  for (const id of ['over', 'paused', 'win', 'hud', 'bossbar', 'shop', 'missionsPanel']) $(id).hidden = true; $('menu').hidden = false;
  stopConfetti(); applyTheme(0); phase = 0; runType = 'story'; hideTut(); chaserT = 0; inv = 0; chaser.position.set(P.x, 0, P.z + 9); chaser.rotation.set(0, 0, 0); chaser.visible = true; friend.visible = true; refreshMenu(); music();
}
for (const id of ['toMenu1', 'toMenu2', 'toMenu3']) $(id).addEventListener('click', toMenu);
// "Jogar de novo": pausa natural para anúncio (não na mesma tela em que oferecemos continuar com anúncio)
function playAgain(fromWin) { const o = { endless: runType === 'endless' }; if (!fromWin && offeredAd) { startGame(0, o); return; } showAd('midgame', () => startGame(0, o)); }
$('again').addEventListener('click', () => playAgain(false));
$('again2').addEventListener('click', () => playAgain(true));
$('contScroll').addEventListener('click', () => { if (bank < 30 || continued) return; bank -= 30; saveBank(); doContinue(); });
$('contAd').addEventListener('click', () => {
  if (continued) return;
  showAd('rewarded', ok => { if (ok) doContinue(); else { $('contAd').hidden = true; $('overMsg').textContent = L().noAd; } });
});
document.querySelectorAll('.mutebtn').forEach(b => b.addEventListener('click', e => { e.stopPropagation(); toggleMute(); }));
$('langBtn').addEventListener('click', () => { lang = lang === 'pt' ? 'en' : 'pt'; Store.set('ninja3d-idioma', lang); applyLang(); });
$('shopBtn').addEventListener('click', () => { audio(); $('menu').hidden = true; $('shop').hidden = false; renderShop(); });
$('shopBack').addEventListener('click', () => { $('shop').hidden = true; $('menu').hidden = false; refreshMenu(); });
function renderShop() {
  $('shopBank').textContent = bank;
  const g = $('shopGrid'); g.innerHTML = '';
  for (const sk of SKINS) {
    const card = document.createElement('div'); card.className = 'card' + (sk.id === skin ? ' on' : '');
    const sw = document.createElement('div'); sw.className = 'swatch'; sw.style.background = sk.sw;
    const nm = document.createElement('div'); nm.className = 'cname'; nm.textContent = L().skins[sk.id];
    const bt = document.createElement('button'); const has = owned.includes(sk.id);
    if (sk.id === skin) { bt.textContent = L().using; bt.disabled = true; }
    else if (has) bt.textContent = L().use;
    else { bt.textContent = sk.price + ' 📜'; if (bank < sk.price) bt.className = 'lock'; }
    bt.addEventListener('click', () => {
      if (!owned.includes(sk.id)) {
        if (bank < sk.price) { $('shopMsg').textContent = L().missing(sk.price - bank); tone(200, 0.15, 'square', 0.08); return; }
        bank -= sk.price; saveBank(); owned.push(sk.id); Store.set('ninja3d-roupas', JSON.stringify(owned)); SFX.power();
      } else tone(660, 0.06, 'sine', 0.08);
      skin = sk.id; Store.set('ninja3d-roupa', skin); applySkin(); $('shopMsg').textContent = ''; renderShop();
    });
    card.append(sw, nm, bt); g.appendChild(card);
  }
}
$('play').addEventListener('click', () => startGame(0, { tutorial: !tutorialDone }));
$('endlessBtn').addEventListener('click', () => startGame(0, { endless: true }));
$('skipTut').addEventListener('click', e => { e.stopPropagation(); skipTutorial(); });
$('missionsBtn').addEventListener('click', () => { audio(); $('menu').hidden = true; $('missionsPanel').hidden = false; renderMissions(); });
$('missionsBack').addEventListener('click', () => { $('missionsPanel').hidden = true; $('menu').hidden = false; refreshMenu(); });
document.addEventListener('visibilitychange', () => { if (document.hidden && state === 'play') togglePause(); });
document.querySelectorAll('.modes button').forEach(b => b.addEventListener('click', () => {
  modo = +b.dataset.m; Store.set('ninja3d-modo', modo); refreshMenu(); audio(); tone(660, 0.06, 'sine', 0.08);
}));
function refreshMenu() {
  document.querySelectorAll('.modes button').forEach(b => b.setAttribute('aria-pressed', String(+b.dataset.m === modo)));
  $('modeinfo').textContent = L().modes[modo].info;
  const b = getBest(); const bi = +(Store.get('ninja3d-recorde-inf-' + modo) || 0);
  $('best').textContent = (b ? L().recordIn(modeName(), b) : '') + (bi ? '  •  ' + L().endlessBest(bi) : '');
  ensureMissions(); $('missionsBadge').textContent = missionsState.active.filter(m => m.p > 0).length ? '•' : '';
  $('bankInfo').textContent = '📜 ' + bank;
}

// ---------------- Atualização ----------------
const tmp = new THREE.Vector3();
function hitPlayer(it) {
  if (inv > 0) return false;
  if (it) { it.alive = false; scene.remove(it.obj); }
  if (shield) { shield = false; bubble.visible = false; inv = 1.0; SFX.shield(); shake = 0.2; burst(tmp.set(P.x, P.y + 1, P.z), 0x5ac8ff, 18, 5, 2, 0.12, 0.5); if (power.name === 'escudo') { power.name = null; $('powerbox').hidden = true; } return false; }
  lives--; SFX.hit(); updateHearts(); inv = 1.3; chaserT = 5; shake = 0.45; scrollStreak = 0; hurtFlash(); burst(tmp.set(P.x, P.y + 1, P.z - 0.3), 0xff4a3a, 16, 5, 3, 0.12, 0.5); burst(tmp.set(P.x, P.y + 1, P.z - 0.3), 0xffffff, 8, 4, 2, 0.1, 0.4);
  speed = Math.max(M().vel0, speed * 0.85);
  if (lives <= 0) { gameOver(); return true; }
  return false;
}
function update(dt) {
  time += dt;
  const bossOn = phase === 5;
  const vmax = runType === 'endless' ? M().velMax * Math.min(1.4, 1 + lap * 0.08) : M().velMax;
  speed = tut ? 11 : Math.min(bossOn ? Math.min(M().velMax, 22) : vmax, speed + M().acel * dt);
  const dz = speed * dt; dist += dz; P.z -= dz;

  P.x += (LANES[P.lane] - P.x) * Math.min(1, dt * 14);
  if (P.y > 0 || P.vy > 0) { P.vy -= 28 * dt; P.y += P.vy * dt; if (P.y <= 0) { P.y = 0; P.vy = 0; } }
  if (wasAir && P.y <= 0) { burst(tmp.set(P.x, 0.08, P.z), 0xcfc6b0, 10, 3, 1.2, 0.1, 0.4); land = 0.18; SFX.land(); }
  wasAir = P.y > 0;
  if (streakT > 0) { streakT -= dt; if (streakT <= 0) scrollStreak = 0; }
  dustT -= dt; if (dustT <= 0 && P.y <= 0 && P.roll <= 0) { dustT = 0.06; burst(tmp.set(P.x + rnd(-0.2, 0.2), 0.05, P.z + 0.3), 0xb9ae95, 1, 0.8, 0.8, 0.07, 0.35); }
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
  if (!bossOn && dist >= nextPhaseAt) nextPhase();

  if (tut) updateTutorial(dt);
  else if (!bossOn) { while (nextRowZ > P.z - 110) { genRow(nextRowZ); nextRowZ -= rowGap(); } }
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
      if (it.kind === 'scroll') { it.alive = false; scene.remove(it.obj); scrolls++; scrollStreak++; streakT = 0.9; $('scrolls').textContent = scrolls; SFX.scroll(); burst(it.obj.position, 0xffd34a, 6, 3, 2, 0.08, 0.4); popup('+10', '#ffd34a'); runStats.scrolls++; }
      else if (it.kind === 'heart') { it.alive = false; scene.remove(it.obj); if (lives < M().vidas) lives++; updateHearts(); SFX.life(); burst(it.obj.position, 0xff5a7a, 12, 3.5, 2, 0.1, 0.5); popup('❤️', '#ff8aa0'); }
      else if (it.kind === 'power') { it.alive = false; scene.remove(it.obj); givePower(it.name); burst(it.obj.position, 0x7fd8ff, 18, 4.5, 2.5, 0.11, 0.6); mission('powers', 1); }
      else if (it.kind === 'bomb') { it.alive = false; scene.remove(it.obj); throwBomb(); }
      else if (tut) { it.alive = false; scene.remove(it.obj); }
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
  $('powerbox').hidden = false; $('powericon').textContent = POWER_ICON[name]; $('powername').textContent = L().powers[name];
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
  player.rotation.z = (P.x - LANES[P.lane]) * 0.22; player.rotation.y = (P.x - LANES[P.lane]) * -0.12;
  if (state === 'win') { player.rotation.set(0, 0, 0); player.scale.set(1, 1, 1); P.y = Math.abs(Math.sin(time * 6)) * 0.6; dpRun.visible = P.y < 0.2; dpJump.visible = P.y >= 0.2; }
  else if (rolling) { player.scale.set(1, 0.5, 1); player.rotation.x = -(0.62 - P.roll) / 0.62 * Math.PI * 2; }
  else { if (land > 0) { land -= dt; const k = land / 0.18; player.scale.set(1 + 0.15 * k, 1 - 0.22 * k, 1); } else player.scale.set(1, 1, 1); player.rotation.x = 0; if (!air && dpRun) dpRun.position.y = Math.abs(Math.sin(time * 14)) * 0.08; }
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
  else {
    const sk = shake > 0.01 ? shake : 0; shake *= Math.exp(-dt * 7);
    const fovK = state === 'play' ? Math.min(1, Math.max(0, (speed - M().vel0) / (M().velMax - M().vel0))) : 0;
    const fov = (camera.aspect < 0.8 ? 70 : 60) + fovK * 8; if (Math.abs(camera.fov - fov) > 0.05) { camera.fov += (fov - camera.fov) * Math.min(1, dt * 3); camera.updateProjectionMatrix(); }
    camera.position.set(cx + rnd(-sk, sk) * 0.6, 3.1 + P.y * 0.35 + rnd(-sk, sk) * 0.5, P.z + 5.6); camera.lookAt(cx, 1.2 + P.y * 0.25, P.z - 6);
    updateSpeedLines(dt, fovK);
  }
}

// ---------------- Partículas (cubinhos) ----------------
let land = 0, dustT = 0;
const PMAX = 360, partMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ fog: true }), PMAX);
partMesh.frustumCulled = false; scene.add(partMesh);
const parts = Array.from({ length: PMAX }, () => ({ life: 0 })); let pNext = 0;
const _pc = new THREE.Color(), _pm = new THREE.Matrix4(), _pq = new THREE.Quaternion(), _pe = new THREE.Euler(), _ps = new THREE.Vector3(), _pp = new THREE.Vector3();
for (let i = 0; i < PMAX; i++) { _pm.makeScale(0, 0, 0); partMesh.setMatrixAt(i, _pm); partMesh.setColorAt(i, _pc.setHex(0xffffff)); }
function burst(pos, color, n, spd, up, size, life) {
  for (let k = 0; k < n; k++) {
    const p = parts[pNext]; pNext = (pNext + 1) % PMAX;
    p.x = pos.x; p.y = pos.y; p.z = pos.z; p.vx = rnd(-1, 1) * spd; p.vy = rnd(0.2, 1) * up * 2; p.vz = rnd(-1, 1) * spd;
    p.life = p.max = life * rnd(0.7, 1.2); p.size = size * rnd(0.7, 1.3); p.r = rnd(0, 6);
    partMesh.setColorAt((pNext + PMAX - 1) % PMAX, _pc.setHex(color));
  }
  partMesh.instanceColor.needsUpdate = true;
}
function updateParticles(dt) {
  for (let i = 0; i < PMAX; i++) {
    const p = parts[i]; if (p.life <= 0) continue;
    p.life -= dt; p.vy -= 9 * dt; p.x += p.vx * dt; p.y = Math.max(0.02, p.y + p.vy * dt); p.z += p.vz * dt; p.r += dt * 8;
    const k = Math.max(0, p.life / p.max) * p.size; _pp.set(p.x, p.y, p.z); _pe.set(p.r, p.r * 0.7, 0); _pq.setFromEuler(_pe); _ps.set(k, k, k);
    _pm.compose(_pp, _pq, _ps); partMesh.setMatrixAt(i, _pm);
  }
  partMesh.instanceMatrix.needsUpdate = true;
}
// linhas de velocidade
const SL = 26, slMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false, fog: false });
const slMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(0.025, 0.025, 2.2), slMat, SL); slMesh.frustumCulled = false; scene.add(slMesh);
const sl = Array.from({ length: SL }, () => ({ a: rnd(0, Math.PI * 2), r: rnd(2.2, 4.2), z: rnd(-30, 0) }));
function updateSpeedLines(dt, k) {
  slMat.opacity = state === 'play' ? k * 0.45 : 0; slMesh.visible = slMat.opacity > 0.02; if (!slMesh.visible) return;
  sl.forEach((l, i) => { l.z += speed * 2.2 * dt; if (l.z > 4) { l.z = rnd(-34, -20); l.a = rnd(0, Math.PI * 2); }
    _pp.set(P.x + Math.cos(l.a) * l.r, 2 + Math.sin(l.a) * l.r * 0.7, P.z + l.z); _pm.makeTranslation(_pp.x, _pp.y, _pp.z); slMesh.setMatrixAt(i, _pm); });
  slMesh.instanceMatrix.needsUpdate = true;
}
// textos que sobem ("+10") e flash vermelho de dano
const _proj = new THREE.Vector3();
function popup(text, color) {
  const box = $('game'); if (!box) return; _proj.set(P.x, P.y + 2.1, P.z).project(camera);
  const el = document.createElement('div'); el.className = 'pop'; el.textContent = text; el.style.color = color;
  el.style.left = ((_proj.x + 1) / 2 * box.clientWidth + rnd(-18, 18)) + 'px'; el.style.top = ((1 - _proj.y) / 2 * box.clientHeight) + 'px';
  box.appendChild(el); setTimeout(() => el.remove(), 750);
}
function hurtFlash() { const h = $('hurt'); h.style.transition = 'none'; h.style.opacity = 0.8; requestAnimationFrame(() => { h.style.transition = 'opacity .5s'; h.style.opacity = 0; }); }
function toast(text) { const t = $('toast'); t.textContent = text; t.classList.remove('show'); void t.offsetWidth; t.classList.add('show'); }

// ---------------- Tutorial jogando (primeira vez) ----------------
const TUT = ['lane', 'jump', 'roll', 'scroll'];
function buildTutorial() {
  let z = -34;
  spawn('wall', 1, z); spawn('scroll', 0, z - 2); spawn('scroll', 2, z - 2); tutTag(0); z -= 30;
  for (const l of [0, 1, 2]) spawn('low', l, z, { name: T.low[0] }); tutTag(1); z -= 30;
  for (const l of [0, 1, 2]) spawn('fly', l, z, { name: T.fly[0] }); tutTag(2); z -= 26;
  for (const l of [0, 1, 2]) for (let i = 0; i < 6; i++) spawn('scroll', l, z - i * 1.6); tutTag(3);
  tut.endZ = z - 20; nextRowZ = z - 34;
}
function tutTag(step) { for (const it of items) if (it.tut === undefined) it.tut = step; }
function tutText(step) {
  const t = touchUsed || (window.matchMedia && matchMedia('(pointer: coarse)').matches);
  return step === 0 ? [t ? '👆↔️' : '⬅️ ➡️', t ? L().tutLaneT : L().tutLaneK] : step === 1 ? [t ? '👆⬆️' : '⬆️', t ? L().tutJumpT : L().tutJumpK]
       : step === 2 ? [t ? '👆⬇️' : '⬇️', t ? L().tutRollT : L().tutRollK] : ['📜', L().tutScroll];
}
function showTut(step, text) {
  const [ic, tx] = text || tutText(step); $('tutIcon').textContent = ic; $('tutText').textContent = tx; $('tut').hidden = false;
}
function hideTut() { const t = $('tut'); if (t) t.hidden = true; }
function updateTutorial(dt) {
  if (tut.step < 3) {
    const obs = items.filter(it => it.alive && it.tut === tut.step && it.kind !== 'scroll');
    const near = obs.reduce((m, it) => Math.min(m, P.z - it.z), 99);
    if (!tut.waiting && tut.prompted !== tut.step && near < (tut.step === 0 ? 7 : 5.2) && near > 0) {
      if (tut.step === 0 && P.lane !== 1) tut.prompted = 0; else { tut.waiting = true; tut.prompted = tut.step; timeTarget = 0.08; showTut(tut.step); } }
    if (obs.length === 0 || near < -2) { tut.step++; tut.waiting = false; timeTarget = 1; hideTut(); }
  } else if (tut.step === 3) {
    const sc = items.filter(it => it.alive && it.tut === 3); const near = sc.reduce((m, it) => Math.min(m, P.z - it.z), 99);
    if (near < 14 && !tut.msgT) { showTut(3); tut.msgT = 1; }
    if (P.z < tut.endZ) { tut.step = 4; tut.msgT = 2.2; showTut(4, ['🏃💨', L().tutGo]); }
  } else { tut.msgT -= dt; if (tut.msgT <= 0) endTutorial(); }
}
function tutAction(a) {
  const need = TUT[tut.step];
  if ((need === 'lane' && (a === 'left' || a === 'right')) || need === a) { tut.waiting = false; timeTarget = 1; hideTut(); SFX.mission(); }
}
function endTutorial() {
  tut = null; timeTarget = 1; hideTut(); $('skipTut').hidden = true; tutorialDone = true; Store.set('ninja3d-tutorial', '1');
  const t = $('tip'); t.hidden = false; t.style.opacity = 1; setTimeout(() => { t.style.opacity = 0; }, 3500); setTimeout(() => { t.hidden = true; }, 4000);
}
function skipTutorial() {
  if (!tut) return;
  for (const it of items) if (it.tut !== undefined) { it.alive = false; scene.remove(it.obj); }
  nextRowZ = P.z - 30; endTutorial();
}

// ---------------- Missões ----------------
const MPOOL = [
  { id: 'sc30', t: 'runScrolls', n: 30, r: 20 }, { id: 'sc60', t: 'runScrolls', n: 60, r: 30 }, { id: 'sc100', t: 'runScrolls', n: 100, r: 50 },
  { id: 'j25', t: 'jumps', n: 25, r: 20 }, { id: 'j60', t: 'jumps', n: 60, r: 30 }, { id: 'r15', t: 'rolls', n: 15, r: 20 }, { id: 'r40', t: 'rolls', n: 40, r: 30 },
  { id: 'p3', t: 'powers', n: 3, r: 25 }, { id: 'ph3', t: 'reachPhase', n: 3, r: 30 }, { id: 'ph5', t: 'reachPhase', n: 5, r: 45 }, { id: 'boss', t: 'boss', n: 1, r: 60 },
  { id: 'inf1k', t: 'endlessDist', n: 1000, r: 40 }, { id: 'inf3k', t: 'endlessDist', n: 3000, r: 70 }, { id: 'runs5', t: 'runs', n: 5, r: 20 }, { id: 'lane50', t: 'lanes', n: 50, r: 15 },
];
const PERRUN = { runScrolls: 1, reachPhase: 1, endlessDist: 1, boss: 0 };
function ensureMissions() {
  if (!missionsState || !Array.isArray(missionsState.active)) missionsState = { active: [], done: 0 };
  missionsState.active = missionsState.active.filter(m => MPOOL.some(x => x.id === m.id));
  while (missionsState.active.length < 3) {
    const pool = MPOOL.filter(x => !missionsState.active.some(m => m.id === x.id) && x.id !== missionsState.last);
    const pick = pool[Math.floor(Math.random() * pool.length)]; missionsState.active.push({ id: pick.id, p: 0 });
  }
}
function saveMissions() { Store.set('ninja3d-missoes', JSON.stringify(missionsState)); }
function mtext(def) { return MTXT[lang][def.t](def.n); }
function mission(type, v) {
  if (tut && type !== 'runs') return; ensureMissions(); let changed = false;
  for (const m of [...missionsState.active]) {
    const def = MPOOL.find(x => x.id === m.id); if (!def || def.t !== type) continue;
    if (PERRUN[type]) { if (v > m.p) { m.p = v; changed = true; } } else { m.p += v; changed = true; }
    if (m.p >= def.n) {
      missionsState.active = missionsState.active.filter(x => x !== m); missionsState.done++; missionsState.last = m.id;
      bank += def.r; saveBank(); SFX.mission(); toast(L().missionDone(mtext(def), def.r)); ensureMissions();
    }
  }
  if (changed) saveMissions();
}
function endRunMissions() {
  if (!runStats) return;
  mission('runScrolls', scrolls);
  if (runType === 'endless') mission('endlessDist', Math.floor(dist));
}
function renderMissions() {
  ensureMissions(); const box = $('missionsList'); box.innerHTML = '';
  for (const m of missionsState.active) {
    const def = MPOOL.find(x => x.id === m.id); const row = document.createElement('div'); row.className = 'mrow';
    const p = Math.min(m.p, def.n);
    row.innerHTML = `<div class="mtop"><span></span><b>+${def.r} 📜</b></div><div class="bar"><div style="width:${p / def.n * 100}%"></div></div><small>${p} / ${def.n}</small>`;
    row.querySelector('span').textContent = mtext(def); box.appendChild(row);
  }
  $('missionsBank').textContent = bank;
}

// ---------------- Laço ----------------
let last = performance.now();
const STEP = 1 / 120; let acc = 0;
function loop(now) {
  const dt = Math.min(0.1, (now - last) / 1000); last = now;
  timeScale += (timeTarget - timeScale) * Math.min(1, dt * 12);
  if (state !== 'play') acc = 0;
  if (state === 'play') { acc += dt * timeScale; let n = 0; while (acc >= STEP && n < 24) { update(STEP); acc -= STEP; n++; if (state !== 'play') { acc = 0; break; } } }
  else if (state === 'menu' || state === 'loading') { time += dt; P.z -= dt * 6; dist += dt * 6; world.position.z = P.z - 60; scrollTextures(); }
  else if (state === 'over' || state === 'win') { time += dt; }
  if (state !== 'paused') { const edt = dt * (state === 'play' ? timeScale : 1); updateEffects(edt); updateConfetti(edt); updateRainbow(dt); updateParticles(edt); }
  if (phase === 5 && state === 'play') updateBoss2(dt);
  place(dt);
  renderer.render(scene, camera);
  requestAnimationFrame(loop);
}
function updateBoss2() { /* espaço para efeitos extras do chefão */ }

// ---------------- Início ----------------
(async function init() {
  resize(); applyTheme(0);
  await initPlatform(); cgCall('loadingStart');
  loadSave(); applyLang(); updateMuteBtns();
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
  applySkin();
  state = 'menu'; refreshMenu(); cgCall('loadingStop');
  ensureMissions(); saveMissions();
  if (!tutorialDone) { modo = 0; startGame(0, { tutorial: true }); }  // primeira vez: começa jogando, com tutorial
})();

// ganchos para testes automáticos
window.__n3d = { get state() { return state; }, get dist() { return dist; }, get lives() { return lives; }, get speed() { return speed; },
  get scrolls() { return scrolls; }, get phase() { return phase; }, get boss() { return boss; }, get power() { return power; },
  P, items, act, start: (p) => startGame(p || 0), setModo: m => { modo = m; refreshMenu(); },
  get bank() { return bank; }, setBank: n => { bank = n; saveBank(); refreshMenu(); }, get skin() { return skin; }, get lang() { return lang; },
  get continued() { return continued; }, get tut() { return tut; }, get timeScale() { return timeScale; }, get missions() { return missionsState; }, startEndless: () => startGame(0, { endless: true }), startTut: () => startGame(0, { tutorial: true }), skipTut: () => skipTutorial(), get adsOn() { return adsOn; }, hit: () => hitPlayer(null), setDist: d => { dist = d; } };
