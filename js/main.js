// Alur aplikasi: lobby → (bikin/gabung room atau lokal) → game.
// HOST menjalankan simulasi & ngirim snapshot. GUEST cuma ngirim input & nampilin snapshot.
import { LEVELS } from './level.js';
import { Sim, CATS } from './sim.js';
import { Renderer } from './render.js';
import { Net } from './net.js';

const $ = (id) => document.getElementById(id);
const STEP = 1 / 60;          // simulasi 60x per detik
const SNAP_EVERY = 1 / 30;    // host kirim snapshot 30x per detik
const INPUT_KEEPALIVE = 0.15; // guest kirim ulang input tiap 150ms walau nggak berubah

let mode = null;   // 'local' | 'host' | 'guest'
let myCat = 0;     // 0 = Gembul, 1 = Mochi
let pickedCat = 0; // pilihan di lobby (buat host)
let sim = null, renderer = null, net = null;
let remoteInput = { l: false, r: false, j: false };
let running = false, lastFrame = 0, acc = 0, lastSim = 0, snapTimer = 0;
let lastSentInput = '', inputTimer = 0, pingMs = null, pingTimer = null, wasWon = false;

// ---------------- layar ----------------
function show(id) {
  document.querySelectorAll('.screen').forEach((s) => s.classList.toggle('active', s.id === id));
}
function message(title, text) {
  $('msgTitle').textContent = title;
  $('msgText').textContent = text;
  $('msgBox').classList.remove('hidden');
}

// ---------------- input ----------------
const keys = new Set();
const touch = { l: false, r: false, j: false };
const GAME_KEYS = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space', 'KeyW', 'KeyA', 'KeyS', 'KeyD'];
addEventListener('keydown', (e) => {
  if (!running) return;
  if (GAME_KEYS.includes(e.code)) e.preventDefault();
  keys.add(e.code);
  if (e.code === 'KeyR' && !e.repeat) restart();
});
addEventListener('keyup', (e) => keys.delete(e.code));
addEventListener('blur', () => keys.clear());

const k = (...codes) => codes.some((c) => keys.has(c));
const wasd = () => ({ l: k('KeyA'), r: k('KeyD'), j: k('KeyW') });
const arrows = () => ({ l: k('ArrowLeft'), r: k('ArrowRight'), j: k('ArrowUp') });
const anyKeys = () => ({ l: k('KeyA', 'ArrowLeft'), r: k('KeyD', 'ArrowRight'), j: k('KeyW', 'ArrowUp', 'Space') });
const withTouch = (i) => ({ l: i.l || touch.l, r: i.r || touch.r, j: i.j || touch.j });

document.querySelectorAll('#touch [data-k]').forEach((b) => {
  const key = b.dataset.k;
  const set = (v) => (e) => { e.preventDefault(); touch[key] = v; };
  b.addEventListener('pointerdown', set(true));
  ['pointerup', 'pointercancel', 'pointerleave'].forEach((ev) => b.addEventListener(ev, set(false)));
});

function currentInputs() {
  if (mode === 'local') return [withTouch(wasd()), arrows()];
  const ins = [];
  ins[myCat] = withTouch(anyKeys());
  ins[1 - myCat] = remoteInput;
  return ins;
}

// ---------------- game loop ----------------
let levelIndex = 0;

// Bikin ulang simulasi + renderer buat level tertentu
function loadLevel(lv) {
  levelIndex = Math.max(0, Math.min(LEVELS.length - 1, lv | 0));
  const level = LEVELS[levelIndex];
  sim = new Sim(level, levelIndex);
  renderer = new Renderer($('cv'), sim);
  renderer.me = mode === 'local' ? -1 : myCat;
  $('lvlSelect').value = String(levelIndex);
  $('winBox').classList.add('hidden');
  wasWon = false;
  acc = 0;
}

// Pindah level: host/lokal langsung, guest minta ke host
function goLevel(lv) {
  if (mode === 'guest') net.send({ t: 'goto', lv });
  else loadLevel(lv);
}

function startGame(m, lv = 0) {
  mode = m;
  loadLevel(lv);
  $('hudRoom').textContent = mode === 'local' ? 'lokal' : `room ${net.code}`;
  $('btnMic').style.display = mode === 'local' ? 'none' : '';
  $('btnMic').textContent = net?.mic ? 'Mic: nyala' : 'Mic: mati';
  $('controlsHelp').textContent = mode === 'local'
    ? 'Gembul: A / D jalan, W lompat  ·  Mochi: ← / → jalan, ↑ lompat  ·  R ulang'
    : `Kamu ${CATS[myCat].name}: ← → / A D jalan, ↑ / W / Spasi lompat  ·  R ulang  ·  Nyalain mic biar bisa ngobrol`;
  $('msgBox').classList.add('hidden');
  remoteInput = { l: false, r: false, j: false };
  show('game');
  running = true;
  lastFrame = lastSim = performance.now();
  acc = 0;
  requestAnimationFrame(frame);
}

function stopGame() {
  running = false;
  keys.clear();
}

// Host/lokal: jalanin simulasi. Dipanggil dari rAF dan dari timer (biar tetap jalan walau tab di-background).
function runSim(now) {
  if (!running || mode === 'guest') return;
  acc += Math.min(0.25, (now - lastSim) / 1000);
  lastSim = now;
  const inputs = currentInputs();
  while (acc >= STEP) { sim.step(STEP, inputs); acc -= STEP; snapTimer += STEP; }
  if (mode === 'host' && snapTimer >= SNAP_EVERY) { snapTimer = 0; net.send({ t: 'st', ...sim.snapshot() }); }
}
setInterval(() => runSim(performance.now()), 50);

function frame(now) {
  if (!running) return;
  const dt = Math.min(0.05, (now - lastFrame) / 1000);
  lastFrame = now;

  if (mode === 'guest') {
    const inp = withTouch(anyKeys());
    const key = `${+inp.l}${+inp.r}${+inp.j}`;
    inputTimer += dt;
    if (key !== lastSentInput || inputTimer > INPUT_KEEPALIVE) {
      net.send({ t: 'in', ...inp });
      lastSentInput = key; inputTimer = 0;
    }
    sim.smooth(dt);
  } else runSim(now);

  renderer.draw(dt);
  updateHud();
  requestAnimationFrame(frame);
}

const fmt = (t) => `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
function updateHud() {
  const s = sim.s;
  $('hudTime').textContent = fmt(s.won ? s.wonAt : s.t);
  $('hudDeaths').textContent = `oops: ${s.deaths}`;
  if (mode === 'guest' && pingMs != null) $('hudRoom').textContent = `room ${net.code} · ${pingMs} ms`;
  if (s.won && !wasWon) {
    const best = saveBest(levelIndex, s.wonAt);
    const last = levelIndex === LEVELS.length - 1;
    $('winTitle').textContent = last ? 'Tamat! Semua ikan udah dicolong' : 'Ikan berhasil dicuri!';
    $('winStats').textContent = `Waktu ${fmt(s.wonAt)} · oops ${s.deaths}x${s.deaths === 0 ? ' (kompak banget!)' : ''}`;
    $('winBest').textContent = best.isNew ? 'Rekor baru!' : `Rekor kalian: ${fmt(best.time)}`;
    $('btnNext').style.display = last ? 'none' : '';
    $('winBox').classList.remove('hidden');
  } else if (!s.won && wasWon) $('winBox').classList.add('hidden');
  wasWon = s.won;
}

// Rekor waktu terbaik per level (disimpan di browser masing-masing)
function saveBest(lv, time) {
  const key = `kucingmaling-best-${lv}`;
  let prev = null;
  try { prev = parseFloat(localStorage.getItem(key)); } catch { /* storage diblok */ }
  const isNew = !(prev > 0) || time < prev;
  if (isNew) try { localStorage.setItem(key, String(time)); } catch { /* abaikan */ }
  return { isNew, time: isNew ? time : prev };
}

function restart() {
  if (!sim) return;
  if (mode === 'guest') net.send({ t: 'restart' });
  else { sim.reset(); acc = 0; }
}

// ---------------- jaringan ----------------
function setupNet() {
  net?.close();
  net = new Net();
  net.on('close', () => {
    if (running) { stopGame(); message('Koneksi putus', 'Pasanganmu keluar atau koneksinya putus.'); }
    else { leave(); $('lobbyErr').textContent = 'Koneksi putus.'; }
  });
  net.on('error', (e) => console.warn('net error', e));
  return net;
}

// Minta izin mic SEBELUM konek. Selain buat voice chat, izin mic bikin Chrome pakai IP lokal asli
// (bukan nama *.local), jadi dua device di WiFi yang sama bisa saling nemu.
let micNote = '';
async function prepareMic() {
  micNote = '';
  if (!$('useMic').checked) { micNote = ' Tips: centang "Pakai voice chat" lalu izinkan mic, koneksi biasanya lebih gampang nyambung.'; return; }
  try { await net.toggleMic(); }
  catch { micNote = ' (Mic nggak diizinkan. Kalau gagal konek, coba izinkan mic di pengaturan situs browser.)'; }
}

async function hostRoom() {
  setLobbyBusy(true);
  myCat = pickedCat;
  setupNet();
  await prepareMic();
  net.on('connected', () => startGame('host'));
  // guest bilang "aku udah siap" → host kasih tahu dia jadi kucing yang mana
  net.on('join', () => net.send({ t: 'hello', yourCat: 1 - myCat, lv: levelIndex }));
  net.on('goto', (m) => loadLevel(m.lv));
  net.on('in', (m) => { remoteInput = { l: !!m.l, r: !!m.r, j: !!m.j }; });
  net.on('restart', () => { sim?.reset(); acc = 0; });
  net.on('ping', (m) => net.send({ t: 'pong', ts: m.ts }));
  try {
    const code = await net.host();
    $('roomCode').textContent = code;
    show('waiting');
    $('lobbyErr').textContent = '';
  } catch (e) {
    $('lobbyErr').textContent = e.message;
    net?.close(); net = null;
  }
  setLobbyBusy(false);
}

async function joinRoom(code) {
  if (!/^[A-Z0-9]{4}$/i.test(code.trim())) { $('lobbyErr').textContent = 'Kodenya 4 huruf.'; return; }
  setLobbyBusy(true);
  $('lobbyErr').textContent = 'Nyambungin…';
  setupNet();
  await prepareMic();
  net.on('hello', (m) => { myCat = m.yourCat; startGame('guest', m.lv || 0); });
  net.on('st', (m) => {
    if (!sim) return;
    if (m.lv !== levelIndex) loadLevel(m.lv); // host pindah level
    sim.applySnapshot(m);
  });
  net.on('full', () => { net.close(); show('lobby'); $('lobbyErr').textContent = 'Room-nya udah penuh (2 orang).'; });
  net.on('pong', (m) => { pingMs = Math.round(performance.now() - m.ts); });
  try {
    await net.join(code);
    net.send({ t: 'join' });
    $('lobbyErr').textContent = '';
    clearInterval(pingTimer);
    pingTimer = setInterval(() => net?.connected && net.send({ t: 'ping', ts: performance.now() }), 2000);
  } catch (e) {
    $('lobbyErr').textContent = e.message + micNote;
    net?.close(); net = null;
  }
  setLobbyBusy(false);
}

function setLobbyBusy(b) { ['btnHost', 'btnJoin', 'btnLocal'].forEach((id) => ($(id).disabled = b)); }

function leave() {
  stopGame();
  clearInterval(pingTimer); pingMs = null;
  net?.close(); net = null;
  mode = null; sim = null;
  $('msgBox').classList.add('hidden');
  show('lobby');
}

// ---------------- tombol-tombol ----------------
document.querySelectorAll('.cat-card').forEach((card) => card.addEventListener('click', () => {
  pickedCat = +card.dataset.cat;
  document.querySelectorAll('.cat-card').forEach((c) => c.classList.toggle('selected', c === card));
}));
$('btnHost').onclick = hostRoom;
$('btnJoin').onclick = () => joinRoom($('joinCode').value);
$('joinCode').addEventListener('keydown', (e) => { if (e.key === 'Enter') joinRoom($('joinCode').value); });
$('joinCode').addEventListener('input', (e) => { e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''); });
$('btnLocal').onclick = () => { net = null; startGame('local'); };
$('btnCancel').onclick = leave;
$('btnLeave').onclick = leave;
$('msgBtn').onclick = leave;
$('btnRestart').onclick = restart;
$('btnAgain').onclick = restart;
$('btnNext').onclick = () => goLevel(levelIndex + 1);
LEVELS.forEach((l, i) => $('lvlSelect').add(new Option(`Level ${i + 1}: ${l.name}`, String(i))));
$('lvlSelect').onchange = (e) => { goLevel(+e.target.value); e.target.blur(); };
$('btnCopyLink').onclick = async () => {
  const url = `${location.origin}${location.pathname}?room=${net.code}`;
  try { await navigator.clipboard.writeText(url); $('btnCopyLink').textContent = 'Link disalin!'; }
  catch { prompt('Salin link ini:', url); }
  setTimeout(() => ($('btnCopyLink').textContent = 'Salin link'), 1500);
};
$('btnMic').onclick = async () => {
  try { $('btnMic').textContent = (await net.toggleMic()) ? 'Mic: nyala' : 'Mic: mati'; }
  catch { message('Mic nggak bisa dipakai', 'Izinkan akses mikrofon di browser dulu ya.'); }
};

// Buat debug di console: kucing.sim.s
window.kucing = { get sim() { return sim; }, get net() { return net; } };

// Link undangan: ?room=ABCD langsung keisi
const roomParam = new URLSearchParams(location.search).get('room');
if (roomParam) { $('joinCode').value = roomParam.toUpperCase().slice(0, 4); $('joinCode').focus(); }

// Gambar kucing kecil di kartu pilihan lobby
const previewT0 = performance.now();
const previewR = Object.assign(Object.create(Renderer.prototype), { me: -2 }); // "renderer" mini tanpa canvas
function drawPreviews(now) {
  document.querySelectorAll('canvas[data-preview]').forEach((cv) => {
    const i = +cv.dataset.preview, def = CATS[i], g = cv.getContext('2d');
    g.clearRect(0, 0, cv.width, cv.height);
    const fake = { x: cv.width / 2 - def.w / 2, y: cv.height - 6 - def.h, w: def.w, h: def.h, vx: 0, ground: true, walk: 0, face: 1 };
    Renderer.prototype.drawCat.call(previewR, g, i, fake, (now - previewT0) / 1000);
  });
  if (document.getElementById('lobby').classList.contains('active')) requestAnimationFrame(drawPreviews);
  else setTimeout(() => requestAnimationFrame(drawPreviews), 500);
}
requestAnimationFrame(drawPreviews);
