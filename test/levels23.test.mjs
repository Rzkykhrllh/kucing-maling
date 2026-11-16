// Uji level 2 & 3 pakai bot yang bisa lompatin robot dan lubang air:
//   node test/levels23.test.mjs
import { Sim } from '../js/sim.js';
import { LEVELS, TILE } from '../js/level.js';

const DT = 1 / 60;
let fails = 0;
const check = (ok, msg) => { console.log((ok ? '  ok   ' : '  FAIL ') + msg); if (!ok) fails++; };
const cx = (e) => e.x + e.w / 2;
const tileCx = (tx) => tx * TILE + TILE / 2;
const idle = () => ({ l: false, r: false, j: false });

// Bot: jalan ke x, lompat kalau mentok / ada robot mendekat / ada lubang air di depan.
// hold=true → tetap di situ selamanya (mis. nahan tombol), sambil tetap ngindarin robot.
function walker(i, x, { hold = false, jumpStuck = true } = {}) {
  let lastX = null, stuck = 0, jumpHold = 0;
  const fn = (sim) => {
    const e = sim.s.cats[i];
    const d = x - cx(e);
    const dir = d > 2 ? 1 : d < -2 ? -1 : 0;
    let jump = false;
    if (e.ground && jumpHold === 0) {
      for (const R of sim.s.robots) {
        if (R.off || Math.abs(R.y + R.h - (e.y + e.h)) > 6) continue;
        const dist = R.x + R.w / 2 - cx(e), side = Math.sign(dist);
        const gap = Math.abs(dist) - (e.w / 2 + (R.w - 16) / 2);
        const rel = (dir === side ? (i ? 220 : 190) : 0) + (R.dir === -side ? 80 : -80);
        if (rel <= 0) continue; // robot menjauh
        if (dir === side && R.dir === side && rel < 150) { if (gap < 60) return { l: false, r: false, j: false }; continue; } // jangan nyalip robot dari belakang
        if (gap < 6 + rel * 0.07) jump = true;
      }
      if (dir) {
        const ahead = Math.floor((cx(e) + dir * (e.w / 2 + 6)) / TILE), ty = Math.floor((e.y + e.h + 2) / TILE);
        const c = sim.tile(ahead, ty);
        if (c === 'w' || (c === '~' && !sim.active('~'))) jump = i === 1 ? 'short' : true; // Mochi lompat pendek biar nggak kebablasan
      }
      if (jumpStuck && lastX !== null && Math.abs(e.x - lastX) < 0.01 && dir) { if (++stuck > 3) { jump = true; stuck = 0; } }
    }
    lastX = e.x;
    if (jump) jumpHold = jump === 'short' ? 4 : 34;
    const j = jumpHold > 0;
    if (jumpHold > 0) jumpHold--;
    return { l: dir < 0, r: dir > 0, j };
  };
  fn.done = (sim) => { const e = sim.s.cats[i]; return !hold && Math.abs(x - cx(e)) < 3 && e.ground; };
  return fn;
}

function run(sim, bots, until, max = 1800) {
  for (let f = 0; f < max; f++) {
    if (until(sim)) return true;
    sim.step(DT, bots.map((b) => (b ? b(sim) : idle())));
  }
  return until(sim);
}
// skrip input mentah (buat lompatan yang spesifik)
function script(sim, frames, fn) { for (let f = 0; f < frames; f++) sim.step(DT, fn(f, sim)); }
const onTop = (e, y) => Math.abs(e.y + e.h - y) < 0.6 && e.ground;

// ======================== LEVEL 2 ========================
console.log('Level 2 — Robot Vacuum (solusi):');
{
  const sim = new Sim(LEVELS[1], 1);
  const [G, M] = sim.s.cats;
  const L = sim.s.lifts[0], top = sim.liftDefs[0].topY;
  const deaths0 = () => sim.s.deaths;

  check(run(sim, [walker(0, L.x + L.w / 2), null], (s) => onTop(G, L.y) && cx(G) > L.x + 4 && cx(G) < L.x + L.w - 4), 'Gembul naik ke lift (lompatin robot)');
  check(run(sim, [null, walker(1, tileCx(12), { hold: true })], (s) => s.s.on.c), 'Mochi ke tombol lift bawah');
  check(run(sim, [null, walker(1, tileCx(12), { hold: true })], () => Math.abs(L.y - top) < 0.5 && onTop(G, L.y), 2400), 'lift naik bawa Gembul (Mochi nahan tombol sambil lompatin robot)');
  check(run(sim, [walker(0, tileCx(21)), walker(1, tileCx(12), { hold: true })], (s) => onTop(G, 8 * TILE) && cx(G) > 21 * TILE), 'Gembul turun dari lift ke lantai atas');
  check(G.cp === 0, 'checkpoint atas kesentuh Gembul');
  check(run(sim, [null, walker(1, tileCx(16), { hold: true })], () => Math.abs(L.y - sim.liftDefs[0].restY) < 0.5, 2400), 'Mochi lepas tombol → lift turun lagi');
  check(run(sim, [null, walker(1, L.x + L.w / 2)], (s) => onTop(M, L.y) && cx(M) > L.x + 4 && cx(M) < L.x + L.w - 4, 2400), 'Mochi naik lift');
  check(run(sim, [walker(0, tileCx(23), { hold: true }), null], () => Math.abs(L.y - top) < 0.5 && onTop(M, L.y), 2400), 'Gembul nahan tombol lift atas → Mochi ikut naik');
  check(run(sim, [walker(0, tileCx(23), { hold: true }), walker(1, tileCx(22))], (s) => onTop(M, 8 * TILE) && cx(M) > 21 * TILE), 'Mochi nyampe lantai atas');
  check(!sim.active('D'), 'pagar masih ketutup');
  check(run(sim, [walker(0, tileCx(26), { hold: true }), null], (s) => sim.active('D') && sim.rectSolid({ x: 29 * TILE, y: 4 * TILE, w: 32, h: 32 }) === false), 'Gembul di tombol berat → pagar kebuka');
  check(run(sim, [walker(0, tileCx(26), { hold: true }), walker(1, tileCx(32))], (s) => s.s.on.a), 'Mochi lewat pagar, nginjek tombol di dalam');
  check(run(sim, [walker(0, tileCx(34) - 4), walker(1, tileCx(32), { hold: true })], (s) => s.s.won), `MENANG (oops ${sim.s.deaths}x, ${sim.s.t.toFixed(1)} dtk)`);
}

console.log('Level 2 — batasan:');
{
  const sim = new Sim(LEVELS[1], 1);
  const M = sim.s.cats[1];
  sim.s.robots[0].x = 2000; // robot disingkirin dulu biar tes fokus
  sim.s.lifts[0].x = 2000; // lift juga
  Object.assign(M, { x: tileCx(19) - M.w / 2, y: 15 * TILE - M.h });
  script(sim, 80, (f) => [idle(), { l: false, r: M.y + M.h < 8 * TILE, j: f < 45 }]);
  check(M.y + M.h > 8 * TILE + 1, 'Mochi NGGAK bisa lompat ke lantai atas (harus pakai lift)');
}
{
  const sim = new Sim(LEVELS[1], 1);
  const G = sim.s.cats[0], R = sim.s.robots[0];
  Object.assign(G, { x: R.x - 60, y: 15 * TILE - G.h }); R.dir = -1;
  run(sim, [null, null], (s) => s.s.deaths > 0, 300);
  check(sim.s.deaths === 1 && cx(G) < 4 * TILE, 'kesenggol robot = oops + balik ke start');
}
{
  const sim = new Sim(LEVELS[1], 1);
  check(sim.rectSolid({ x: 29 * TILE + 2, y: 5 * TILE, w: 20, h: 20 }), 'pagar padat tanpa tombol');
}

// ======================== LEVEL 3 ========================
console.log('Level 3 — Mati Lampu (solusi):');
{
  const sim = new Sim(LEVELS[2], 2);
  const [G, M] = sim.s.cats;
  check(!sim.active('Y0') && !sim.active('Y1'), 'awalnya semua lampu mati');
  check(run(sim, [null, walker(1, tileCx(4))], () => M.ground && Math.abs(cx(M) - tileCx(4)) < 3), 'Mochi ke bawah rak');
  script(sim, 70, (f) => [idle(), { l: false, r: M.y + M.h < 11 * TILE, j: f < 45 }]);
  check(run(sim, [null, walker(1, tileCx(5), { jumpStuck: false })], (s) => s.s.on.a), 'Mochi naik rak, nyalain lampu 1');
  check(sim.active('Y0'), 'lampu di atas lubang air nyala');
  check(run(sim, [walker(0, tileCx(21)), walker(1, tileCx(5), { hold: true, jumpStuck: false })], (s) => s.s.on.b, 2400), `Gembul nyebrang 3 lubang air ke tombol berat (oops ${sim.s.deaths}x)`);
  const d0 = sim.s.deaths;
  check(run(sim, [walker(0, tileCx(21), { hold: true }), walker(1, tileCx(20))], () => M.ground && cx(M) > 20 * TILE, 2400), `Mochi turun & nyebrang selagi Gembul jaga lampu (oops ${sim.s.deaths - d0}x)`);
  check(G.cp === 0 && M.cp === 0, 'checkpoint kasur kesentuh dua-duanya');
  check(run(sim, [walker(0, tileCx(21), { hold: true }), walker(1, tileCx(25))], () => M.ground && Math.abs(cx(M) - tileCx(25)) < 3, 2400), 'Mochi ke bawah rak tuas (lompatin robot)');
  script(sim, 70, (f) => [idle(), { l: false, r: M.y + M.h < 11 * TILE, j: f < 45 }]);
  check(sim.s.on.L, 'Mochi nyalain tuas: robot mati, lampu ruang ikan nyala');
  check(run(sim, [null, null], (s) => Math.abs(s.s.robots[0].x - 22 * TILE) < 1, 600), 'robot balik ke dok');
  check(run(sim, [walker(0, tileCx(23)), null], () => G.ground && Math.abs(cx(G) - tileCx(23)) < 3), 'Gembul ke belakang kardus');
  const box = sim.s.box;
  script(sim, 600, () => [{ l: false, r: box.x < 30 * TILE - 1, j: false }, idle()]);
  check(Math.abs(box.x - 30 * TILE) < 3, `kardus didorong ke meja (x=${box.x.toFixed(1)})`);
  run(sim, [walker(0, box.x - 30, { jumpStuck: false }), null], () => G.ground && Math.abs(cx(G) - (box.x - 30)) < 3);
  script(sim, 60, (f) => [{ l: false, r: f > 3 && f < 20, j: f < 30 }, idle()]);
  script(sim, 70, (f) => [{ l: false, r: f > 8, j: f < 30 }, idle()]);
  check(onTop(G, 12 * TILE), 'Gembul naik meja lewat kardus');
  check(run(sim, [walker(0, tileCx(34) - 4), null], () => G.ground && cx(G) > 33 * TILE), 'Gembul ke ikan');
  check(run(sim, [null, walker(1, tileCx(29))], () => M.ground && Math.abs(cx(M) - tileCx(29)) < 3), 'Mochi turun dari rak');
  script(sim, 70, (f) => [idle(), { l: false, r: M.y + M.h < 12 * TILE, j: f < 45 }]);
  check(run(sim, [null, walker(1, tileCx(32))], (s) => s.s.won), `MENANG (oops ${sim.s.deaths}x, ${sim.s.t.toFixed(1)} dtk)`);
}

console.log('Level 3 — batasan:');
{
  const sim = new Sim(LEVELS[2], 2);
  const G = sim.s.cats[0];
  run(sim, [walker(0, tileCx(4)), null], () => G.ground && Math.abs(cx(G) - tileCx(4)) < 3);
  script(sim, 70, (f) => [{ l: false, r: G.y + G.h < 11 * TILE, j: f < 45 }, idle()]);
  check(!sim.s.on.a, 'Gembul NGGAK bisa naik rak lampu');
}
{
  const sim = new Sim(LEVELS[2], 2);
  script(sim, 200, () => [{ l: false, r: true, j: false }, idle()]);
  check(sim.s.deaths >= 1, 'jalan lurus tanpa lompat = kecebur lubang');
}
{
  const sim = new Sim(LEVELS[2], 2);
  const G = sim.s.cats[0];
  Object.assign(G, { x: 20 * TILE, y: 15 * TILE - G.h }); G.cp = 0;
  sim.s.box.x = 2000; // kardus disingkirin
  script(sim, 400, () => [{ l: false, r: true, j: false }, idle()]);
  check(sim.s.deaths >= 1, 'robot di ruang ikan nyetrum kalau tuas belum nyala');
}

console.log(fails ? `\n${fails} gagal` : '\nSemua lulus');
process.exit(fails ? 1 : 0);
