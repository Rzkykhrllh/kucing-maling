// Uji puzzle level 1 pakai "bot": node test/solve.test.mjs
import { Sim } from '../js/sim.js';
import { LEVELS, TILE } from '../js/level.js';

const DT = 1 / 60;
let fails = 0;
const check = (ok, msg) => { console.log((ok ? '  ok   ' : '  FAIL ') + msg); if (!ok) fails++; };
const cx = (e) => e.x + e.w / 2;
const idle = { l: false, r: false, j: false };

// Jalanin kucing `i` ke posisi x (tengah), lompat kalau mentok. Kucing lain pakai input `other`.
function goTo(sim, i, x, { other = idle, maxFrames = 900, jumpIfStuck = true } = {}) {
  const e = sim.s.cats[i];
  let lastX = e.x, stuck = 0, jumpHold = 0;
  for (let f = 0; f < maxFrames; f++) {
    const d = x - cx(e);
    if ((Math.abs(d) < 3 && e.ground) || sim.s.won) return true;
    const inp = { l: d < -2, r: d > 2, j: jumpHold > 0 };
    if (jumpHold > 0) jumpHold--;
    else if (jumpIfStuck && e.ground && Math.abs(e.x - lastX) < 0.01 && Math.abs(d) > 4) { stuck++; if (stuck > 3) { jumpHold = 40; stuck = 0; } }
    lastX = e.x;
    const ins = [idle, idle]; ins[i] = inp; ins[1 - i] = other;
    sim.step(DT, ins);
  }
  return false;
}
function wait(sim, frames, ins = [idle, idle]) { for (let f = 0; f < frames; f++) sim.step(DT, ins); }
const tileCx = (tx) => tx * TILE + TILE / 2;

const lvl = LEVELS[0];

console.log('Skenario utama (solusi):');
{
  const sim = new Sim(lvl);
  const [G, M] = sim.s.cats;
  check(goTo(sim, 1, tileCx(9)), 'Mochi masuk kolong sofa ke tombol A');
  check(sim.s.on.a && sim.active('~'), 'tombol A ketekan, jembatan muncul');
  check(goTo(sim, 0, tileCx(21)), 'Gembul naik sofa, nyebrang jembatan, ke tombol berat');
  check(sim.s.on.b, 'tombol berat ketekan sama Gembul');
  check(goTo(sim, 1, tileCx(5), { jumpIfStuck: false }), 'Mochi keluar kolong sofa (lewat kiri)');
  for (let f = 0; f < 50; f++) sim.step(DT, [idle, { l: false, r: f > 4, j: f < 30 }]); // lompat ke atas sofa
  check(M.y + M.h <= 13 * TILE + 0.5, 'Mochi di atas sofa');
  check(goTo(sim, 1, tileCx(24)), 'Mochi nyebrang selagi Gembul nahan jembatan');
  check(sim.s.deaths === 0, 'belum ada yang kecebur');
  // Mochi lompat ke rak (tahan kiri + lompat)
  for (let f = 0; f < 60; f++) sim.step(DT, [idle, { l: M.y + M.h < 11 * TILE, r: false, j: f < 40 }]);
  check(sim.s.on.L && sim.active('D'), 'Mochi nyampe rak, tuas nyala, pagar kebuka');
  check(goTo(sim, 0, tileCx(26)), 'Gembul lewat pagar (jembatan boleh hilang sekarang)');
  // Gembul dorong kardus sampai mepet meja
  for (let f = 0; f < 600 && sim.s.box.x < 30 * TILE - 1; f++) sim.step(DT, [{ l: false, r: true, j: false }, idle]);
  check(Math.abs(sim.s.box.x - 30 * TILE) < 3, `kardus didorong ke kaki meja (x=${sim.s.box.x.toFixed(1)})`);
  // Gembul mundur, naik kardus, lompat ke meja
  goTo(sim, 0, sim.s.box.x - 30, { jumpIfStuck: false });
  wait(sim, 5);
  for (let f = 0; f < 90; f++) sim.step(DT, [{ l: false, r: f > 3 && f < 20, j: f < 30 }, idle]); // naik kardus
  check(Math.abs(G.y + G.h - sim.s.box.y) < 1, 'Gembul berdiri di atas kardus');
  for (let f = 0; f < 90; f++) sim.step(DT, [{ l: false, r: f > 8, j: f < 30 }, idle]);
  check(G.y + G.h <= 12 * TILE + 0.5 && G.ground, 'Gembul nyampe atas meja');
  check(goTo(sim, 0, tileCx(33)), 'Gembul ke ikan');
  check(!sim.s.won, 'belum menang selama Mochi masih di rak');
  check(goTo(sim, 1, tileCx(29), { jumpIfStuck: false }), 'Mochi turun dari rak, lewat pagar');
  for (let f = 0; f < 70; f++) sim.step(DT, [idle, { l: false, r: M.y + M.h < 12 * TILE, j: f < 40 }]);
  check(goTo(sim, 1, tileCx(32)), 'Mochi lompat ke meja, ke ikan');
  wait(sim, 2);
  check(sim.s.won, `MENANG dalam ${sim.s.t.toFixed(1)} detik simulasi`);
}

console.log('Batasan (biar puzzle-nya nggak bisa diakalin):');
{
  const sim = new Sim(lvl);
  const ok = goTo(sim, 0, tileCx(9), { maxFrames: 300, jumpIfStuck: false });
  check(!ok && sim.s.cats[0].x + sim.s.cats[0].w <= 7 * TILE + 0.5, 'Gembul NGGAK muat masuk kolong sofa');
}
{
  const sim = new Sim(lvl);
  goTo(sim, 1, tileCx(9));
  goTo(sim, 0, tileCx(21), { other: { l: false, r: false, j: false } });
  // Mochi tetap di tombol A biar Gembul bisa nyebrang; lalu Gembul coba lompat ke rak
  const G = sim.s.cats[0];
  goTo(sim, 0, tileCx(24), { jumpIfStuck: false });
  for (let f = 0; f < 90; f++) sim.step(DT, [{ l: f > 2, r: false, j: f < 40 }, idle]);
  check(!sim.s.on.L, 'Gembul NGGAK bisa lompat ke rak tuas');
  check(G.y + G.h > 11 * TILE + 1, 'Gembul tetap di lantai');
}
{
  const sim = new Sim(lvl);
  // Mochi lompat dari atas sofa nyoba nyebrang air tanpa jembatan
  const M = sim.s.cats[1];
  goTo(sim, 1, tileCx(9) - 120, { jumpIfStuck: false });
  for (let f = 0; f < 60 && !(M.ground && M.y + M.h <= 13 * TILE + 0.5); f++) sim.step(DT, [idle, { l: false, r: f > 6, j: f < 30 }]);
  check(M.y + M.h <= 13 * TILE + 0.5, 'Mochi bisa naik ke atas sofa');
  goTo(sim, 1, tileCx(11), { jumpIfStuck: false });
  for (let f = 0; f < 120; f++) sim.step(DT, [idle, { l: false, r: true, j: f < 45 }]);
  check(sim.s.deaths === 1, 'Mochi kecebur kalau lompat nyebrang tanpa jembatan (lalu respawn)');
}
{
  // Gembul nggak bisa naik meja tanpa kardus
  const sim = new Sim(lvl);
  sim.s.on.L = true;
  const G = sim.s.cats[0];
  Object.assign(G, { x: tileCx(29) - G.w / 2, y: 15 * TILE - G.h });
  sim.s.box.x = 26 * TILE; // kardus jauh
  for (let f = 0; f < 120; f++) sim.step(DT, [{ l: false, r: true, j: f < 40 }, idle]);
  check(G.y + G.h > 12 * TILE + 1, 'Gembul NGGAK bisa naik meja tanpa kardus');
}

console.log('Snapshot (host → guest):');
{
  const host = new Sim(lvl), guest = new Sim(lvl);
  goTo(host, 1, tileCx(9));
  const snap = host.snapshot();
  const bytes = JSON.stringify(snap).length;
  guest.applySnapshot(JSON.parse(JSON.stringify(snap)));
  for (let f = 0; f < 60; f++) guest.smooth(DT);
  check(Math.abs(guest.s.cats[1].x - host.s.cats[1].x) < 0.5 && guest.active('~'), `guest ikut posisi & status host (${bytes} byte/snapshot)`);
}

console.log(fails ? `\n${fails} gagal` : '\nSemua lulus');
process.exit(fails ? 1 : 0);
