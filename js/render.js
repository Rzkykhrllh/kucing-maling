// Gambar semua ke <canvas>, gaya pixel art. Nggak ada file gambar, semua digambar pakai kotak.
import { TILE } from './level.js';
import { CATS } from './sim.js';

const C = {
  wall: '#f2dfc0', stripe: '#ead2ad', border: '#4a3326', borderHi: '#5d4231',
  floor: '#a0663c', floorDark: '#80502d', floorLine: '#6b4224',
  sofa: '#c4553b', sofaDark: '#9a3f2a', sofaHi: '#dc7356', under: '#3a2a22',
  shelf: '#9c6b45', shelfDark: '#6f4a2e',
  table: '#b07a4a', tableDark: '#7d5330',
  water: '#4aa3d8', waterDark: '#2f7fb3', waterHi: '#bfe6fb',
  plank: '#d1a26a', plankDark: '#9d7344',
  gate: '#f7f4ee', gateDark: '#bdb6aa',
  box: '#c8975a', boxDark: '#9c7140', tape: '#e8c88f',
  btnA: '#4a7bd1', btnADark: '#2f5aa8', btnB: '#d14a4a', btnBDark: '#a32f2f', btnBase: '#5b5b66',
  metal: '#8d96a3', metalDark: '#5c6470',
  text: '#7a5a43',
};

const CAT_COLORS = [
  { base: '#f0a04b', dark: '#c8702a', light: '#fde3b8', line: '#4a2b17' }, // Gembul: oren
  { base: '#f7f3ec', dark: '#9aa2ad', light: '#ffffff', line: '#3a3a46' }, // Mochi: putih belang abu
];

const SPRITE_UNIT = [3, 2]; // ukuran 1 "pixel" kucing: Gembul 3px, Mochi 2px

export class Renderer {
  constructor(canvas, sim) {
    this.cv = canvas;
    this.sim = sim;
    this.W = sim.W * TILE;
    this.H = sim.H * TILE;
    canvas.width = this.W;
    canvas.height = this.H;
    this.ctx = canvas.getContext('2d');
    this.ctx.imageSmoothingEnabled = false;
    this.particles = [];
    this.seenFx = sim.s.fxId;
    this.anim = {}; // animasi halus jembatan/pagar/lampu
    this.time = 0;
    this.me = -1; // kucing yang dikontrol pemain ini (-1 = mode lokal)
    this.bg = this.buildBackground();
    if (sim.level.dark) {
      this.dark = document.createElement('canvas');
      this.dark.width = this.W; this.dark.height = this.H;
    }
  }

  // Area kosong? (biar dekorasi nggak nabrak tembok)
  free(tx, ty, tw, th) {
    for (let y = ty; y < ty + th; y++) for (let x = tx; x < tx + tw; x++) if (this.sim.tile(x, y) !== '.') return false;
    return true;
  }

  // Latar + tile yang nggak pernah berubah digambar sekali ke canvas terpisah
  buildBackground() {
    const cv = document.createElement('canvas');
    cv.width = this.W; cv.height = this.H;
    const g = cv.getContext('2d');
    const { sim } = this;
    g.fillStyle = C.wall; g.fillRect(0, 0, this.W, this.H);
    for (let x = 0; x < this.W; x += 32) { g.fillStyle = C.stripe; g.fillRect(x + 12, 0, 8, this.H); }
    if (this.free(2, 1, 7, 7)) this.drawWindow(g, 3 * TILE, 2 * TILE, 4 * TILE, 4 * TILE);
    if (this.free(13, 2, 5, 4)) {
      g.fillStyle = C.border; g.fillRect(14 * TILE - 4, 3 * TILE - 4, 3 * TILE + 8, 2 * TILE + 8);
      g.fillStyle = '#9fd0c4'; g.fillRect(14 * TILE, 3 * TILE, 3 * TILE, 2 * TILE);
      g.fillStyle = '#6aa88f'; g.fillRect(14 * TILE, 4 * TILE + 8, 3 * TILE, TILE - 8);
      g.fillStyle = '#f6d36b'; g.fillRect(16 * TILE, 3 * TILE + 8, 12, 12);
    }
    if (this.free(29, 3, 2, 2)) this.drawClock(g, 29 * TILE, 3 * TILE);
    // kolong sofa (gelap)
    for (let ty = 0; ty < sim.H; ty++) for (let tx = 0; tx < sim.W; tx++) {
      if (sim.tile(tx, ty) === '.' && sim.tile(tx, ty - 1) === 'S') { g.fillStyle = C.under; g.fillRect(tx * TILE, ty * TILE, TILE, TILE); }
    }
    for (let ty = 0; ty < sim.H; ty++) for (let tx = 0; tx < sim.W; tx++) this.drawStaticTile(g, tx, ty);
    // jalur lift (rel di dinding)
    for (const d of sim.liftDefs) {
      g.fillStyle = 'rgba(74,51,38,.25)';
      g.fillRect(d.x + 4, d.topY, 4, d.restY - d.topY + 12); g.fillRect(d.x + d.w - 8, d.topY, 4, d.restY - d.topY + 12);
    }
    return cv;
  }

  drawWindow(g, x, y, w, h) {
    g.fillStyle = C.border; g.fillRect(x - 6, y - 6, w + 12, h + 12);
    g.fillStyle = '#1d2547'; g.fillRect(x, y, w, h);
    g.fillStyle = '#f6efc7'; g.fillRect(x + w - 40, y + 14, 18, 18);
    g.fillStyle = '#1d2547'; g.fillRect(x + w - 34, y + 10, 16, 16);
    g.fillStyle = '#ffffff';
    [[12, 20], [40, 44], [70, 18], [22, 90], [96, 80], [58, 104]].forEach(([sx, sy]) => g.fillRect(x + sx, y + sy, 3, 3));
    g.fillStyle = '#2c3560'; // siluet gedung Tokyo
    [[0, 80, 26], [26, 60, 22], [48, 92, 30], [78, 50, 20], [98, 72, 30]].forEach(([bx, by, bw]) => g.fillRect(x + bx, y + by, bw, h - by));
    g.fillStyle = '#f6d36b';
    [[6, 92], [14, 104], [32, 70], [34, 84], [56, 100], [84, 62], [86, 78], [104, 84], [112, 100]].forEach(([wx, wy]) => g.fillRect(x + wx, y + wy, 4, 4));
    g.fillStyle = C.border; g.fillRect(x + w / 2 - 3, y, 6, h); g.fillRect(x, y + h / 2 - 3, w, 6);
    g.fillStyle = '#c96f5a'; g.fillRect(x - 14, y - 10, 16, h + 30); g.fillRect(x + w - 2, y - 10, 16, h + 30); // gorden
  }

  drawClock(g, x, y) {
    g.fillStyle = C.border; g.fillRect(x, y, 40, 40);
    g.fillStyle = '#fbf6ea'; g.fillRect(x + 4, y + 4, 32, 32);
    g.fillStyle = C.border; g.fillRect(x + 19, y + 8, 3, 13); g.fillRect(x + 19, y + 19, 10, 3);
  }

  drawStaticTile(g, tx, ty) {
    const s = this.sim, c = s.tile(tx, ty), x = tx * TILE, y = ty * TILE;
    if (c === '#') {
      const above = s.tile(tx, ty - 1);
      const inner = tx > 0 && tx < s.W - 1 && ty > 0;
      const isFloor = inner && (ty >= s.H - 2 || (above !== '#' && s.tile(tx - 1, ty) === '#' || above !== '#' && s.tile(tx + 1, ty) === '#'));
      if (isFloor) {
        g.fillStyle = above !== '#' ? C.floor : C.floorDark; g.fillRect(x, y, TILE, TILE);
        g.fillStyle = C.floorLine; g.fillRect(x, y + 15, TILE, 2);
        g.fillRect(x + ((tx * 13 + ty * 7) % 24), y, 2, 15); g.fillRect(x + ((tx * 7 + 11) % 24) + 4, y + 17, 2, 15);
        if (above !== '#') { g.fillStyle = '#b97a4c'; g.fillRect(x, y, TILE, 3); }
      } else {
        g.fillStyle = C.border; g.fillRect(x, y, TILE, TILE);
        g.fillStyle = C.borderHi; g.fillRect(x + 2, y + 2, TILE - 4, 2);
      }
    } else if (c === 'S') {
      g.fillStyle = C.sofa; g.fillRect(x, y, TILE, TILE);
      g.fillStyle = C.sofaHi; g.fillRect(x, y, TILE, 5);
      g.fillStyle = C.sofaDark; g.fillRect(x, y + TILE - 6, TILE, 6);
      if (s.tile(tx + 1, ty) === 'S' || s.tile(tx - 1, ty) === 'S') g.fillRect(x + TILE - 2, y + 5, 2, TILE - 11);
      if (s.tile(tx, ty + 1) !== 'S' && s.tile(tx - 1, ty) !== 'S') { g.fillStyle = C.border; g.fillRect(x + 2, y + TILE, 5, 4); }
    } else if (c === 'E') {
      g.fillStyle = C.shelf; g.fillRect(x, y, TILE, 12);
      g.fillStyle = C.shelfDark; g.fillRect(x, y + 10, TILE, 2);
      g.fillRect(x + 12, y + 12, 6, 10); g.fillRect(x + 12, y + 12, 14, 4);
    } else if (c === 'T') {
      if (s.tile(tx, ty - 1) !== 'T') {
        g.fillStyle = C.table; g.fillRect(x, y, TILE, 14);
        g.fillStyle = C.tableDark; g.fillRect(x, y + 12, TILE, 4);
        if (s.tile(tx - 1, ty) !== 'T') g.fillRect(x + 2, y + 16, 8, TILE - 16);
      } else { g.fillStyle = C.tableDark; g.fillRect(x + 2, y, 8, TILE); }
    }
  }

  // ---------- kucing ----------
  drawCat(g, i, e, t, withLabel = true) {
    const def = CATS[i], col = CAT_COLORS[i], u = SPRITE_UNIT[i];
    const spriteW = 15 * u, spriteH = 11 * u;
    const ox = Math.round(e.x + e.w / 2 - spriteW / 2), oy = Math.round(e.y + e.h - spriteH);
    const air = !e.ground;
    const step = e.ground && Math.abs(e.vx) > 1 ? Math.floor(e.walk / (u * 4)) % 2 : -1;
    const blink = (t + i * 1.7) % 3.3 < 0.12;

    // bentuk dasar (x, y, w, h dalam unit), menghadap kanan
    const tailUp = air ? 0 : Math.round(Math.sin(t * 3 + i) * 0.6 + 0.4);
    const body = [[2, 5, 9, 4], [9, 2, 6, 5], [0, 2 - tailUp, 1, 4], [1, 5 - tailUp, 1, 2]];
    const ears = [[9, 0, 1, 2], [10, 1, 1, 1], [14, 0, 1, 2], [13, 1, 1, 1]];
    let legs;
    if (air) legs = [[2, 8, 1, 3], [4, 8, 1, 2], [10, 8, 1, 3], [12, 8, 1, 2]];
    else if (step === 0) legs = [[2, 9, 1, 2], [5, 9, 1, 2], [8, 9, 1, 2], [11, 9, 1, 2]];
    else if (step === 1) legs = [[3, 9, 1, 2], [4, 9, 1, 2], [9, 9, 1, 2], [10, 9, 1, 2]];
    else legs = [[3, 9, 1, 2], [5, 9, 1, 2], [9, 9, 1, 2], [11, 9, 1, 2]];
    const all = [...body, ...ears, ...legs];

    g.save();
    if (e.face < 0) { g.translate(ox + spriteW, oy); g.scale(-1, 1); } else g.translate(ox, oy);
    const R = (r, color) => { g.fillStyle = color; g.fillRect(r[0] * u, r[1] * u, r[2] * u, r[3] * u); };
    g.fillStyle = col.line; // garis luar: semua bentuk diperbesar 1 unit
    for (const r of all) g.fillRect((r[0] - 1) * u + u / 2, (r[1] - 1) * u + u / 2, (r[2] + 1) * u, (r[3] + 1) * u);
    legs.forEach((r, k) => R(r, k % 2 === 0 ? col.dark : col.base));
    body.forEach((r) => R(r, col.base));
    ears.forEach((r) => R(r, col.base));
    R([9, 1, 1, 1], '#e88a9a'); R([14, 1, 1, 1], '#e88a9a');
    R([3, 8, 7, 1], col.light);
    R([12, 4, 3, 2], col.light);
    if (i === 0) { // belang oren
      R([4, 5, 1, 2], col.dark); R([6, 5, 1, 3], col.dark); R([8, 5, 1, 2], col.dark); R([11, 2, 2, 1], col.dark); R([0, 2 - tailUp, 1, 1], col.dark);
    } else { // tompel abu
      R([4, 5, 3, 2], col.dark); R([13, 0, 2, 1], col.dark); R([0, 2 - tailUp, 1, 2], col.dark);
    }
    if (blink) { R([11, 3, 1, 1], col.line); R([13, 3, 1, 1], col.line); }
    else { R([11, 3, 1, 1], '#222'); R([13, 3, 1, 1], '#222'); }
    R([14, 4, 1, 1], '#e88a9a');
    g.restore();
    if (withLabel) this.drawLabel(g, i, e);
  }

  drawLabel(g, i, e) {
    const u = SPRITE_UNIT[i], oy = Math.round(e.y + e.h - 11 * u), cx = Math.round(e.x + e.w / 2);
    g.font = '10px "Pixelify Sans", monospace'; g.textAlign = 'center';
    const label = CATS[i].name + (i === this.me ? ' (kamu)' : '');
    const lw = g.measureText(label).width + 8;
    g.fillStyle = 'rgba(40,28,20,0.65)'; g.fillRect(cx - lw / 2, oy - 18, lw, 13);
    g.fillStyle = i === this.me ? '#ffe08a' : '#fff'; g.fillText(label, cx, oy - 8);
  }

  // Mata kucing yang nyala di gelap (buat kucing pasangan di level gelap)
  drawEyes(g, i, e, t) {
    const u = SPRITE_UNIT[i], spriteW = 15 * u, spriteH = 11 * u;
    const ox = Math.round(e.x + e.w / 2 - spriteW / 2), oy = Math.round(e.y + e.h - spriteH);
    if ((t + i * 1.7) % 3.3 < 0.12) return; // kedip
    g.fillStyle = '#d9ff6b';
    for (const ex of [11, 13]) {
      const px = e.face < 0 ? ox + spriteW - (ex + 1) * u : ox + ex * u;
      g.fillRect(px, oy + 3 * u, u, u);
    }
  }

  ease(key, target, dt, speed) {
    const v = this.anim[key] ?? target;
    this.anim[key] = v + (target - v) * Math.min(1, dt * speed);
    return this.anim[key];
  }

  // ---------- frame ----------
  draw(dt) {
    this.time += dt;
    const g = this.ctx, s = this.sim.s, sim = this.sim, t = this.time;

    g.drawImage(this.bg, 0, 0);

    // kasur kucing (checkpoint)
    sim.checkpoints.forEach((c, k) => {
      const x = c.x, y = c.y + TILE, lit = s.cpOn & (1 << k);
      g.fillStyle = '#7d4f8f'; g.fillRect(x + 1, y - 10, TILE - 2, 10);
      g.fillStyle = lit ? '#e7a6d8' : '#b98ac6'; g.fillRect(x + 4, y - 13, TILE - 8, 6);
      if (lit) {
        g.font = '10px "Pixelify Sans", monospace'; g.textAlign = 'center'; g.fillStyle = '#7d4f8f';
        g.fillText('z', x + TILE / 2 + Math.sin(t * 2) * 3, y - 18 - (t * 8 % 8));
      }
    });

    // air, jembatan, pagar
    const bridge = this.ease('~', sim.active('~') ? 1 : 0, dt, 18);
    for (let ty = 0; ty < sim.H; ty++) for (let tx = 0; tx < sim.W; tx++) {
      const c = sim.tile(tx, ty), x = tx * TILE, y = ty * TILE;
      if (c === '~' || c === 'w') {
        g.fillStyle = C.waterDark; g.fillRect(x, y, TILE, TILE);
        g.fillStyle = C.water; g.fillRect(x, y + 6, TILE, TILE - 6);
        g.fillStyle = C.waterHi;
        const w = Math.floor((Math.sin(t * 2.5 + tx * 1.3) + 1) * 6);
        g.fillRect(x + w, y + 4, 10, 2); g.fillRect(x + ((w + 16) % 26), y + 14, 6, 2);
        if (c === '~' && bridge > 0.02) {
          const ext = Math.round(TILE * bridge);
          g.fillStyle = C.plank; g.fillRect(x + (TILE - ext) / 2, y, ext, 10);
          g.fillStyle = C.plankDark; g.fillRect(x + (TILE - ext) / 2, y + 8, ext, 3); g.fillRect(x + TILE / 2 - 1, y, 2, 10);
        }
      } else if ((c === 'D' || c === 'F') && sim.tile(tx, ty - 1) !== c) {
        let rows = 0; while (sim.tile(tx, ty + rows) === c) rows++;
        const gh = rows * TILE, gy = y - Math.round(this.ease(c, sim.active(c) ? 1 : 0, dt, 6) * gh);
        g.save(); g.beginPath(); g.rect(x - 4, y, TILE + 8, gh); g.clip();
        g.fillStyle = C.gateDark; g.fillRect(x + 2, gy, TILE - 4, 6); g.fillRect(x + 2, gy + gh - 6, TILE - 4, 6);
        g.fillStyle = C.gate;
        for (let bx = 4; bx < TILE - 4; bx += 8) g.fillRect(x + bx, gy, 4, gh);
        g.fillRect(x + 2, gy, TILE - 4, 4); g.fillRect(x + 2, gy + gh / 2, TILE - 4, 4);
        g.restore();
        g.fillStyle = C.border; g.fillRect(x - 2, y + gh - 4, TILE + 4, 4);
      }
    }

    // tombol (biru = biasa, merah = berat)
    for (const r of sim.sensors) {
      const on = s.on[r.id], x = r.tx * TILE, y = r.ty * TILE + TILE;
      const [col, dark] = r.heavy ? [C.btnB, C.btnBDark] : [C.btnA, C.btnADark];
      g.fillStyle = C.btnBase; g.fillRect(x + 2, y - 5, TILE - 4, 5);
      const h = on ? 3 : 8;
      g.fillStyle = on ? dark : col; g.fillRect(x + 6, y - 5 - h, TILE - 12, h);
      if (!on) { g.fillStyle = 'rgba(255,255,255,.4)'; g.fillRect(x + 8, y - 12, TILE - 16, 2); }
    }

    // tuas
    for (const r of sim.levers) {
      const on = s.on[r.id], x = r.tx * TILE, y = r.ty * TILE + TILE;
      g.fillStyle = C.btnBase; g.fillRect(x + 6, y - 6, TILE - 12, 6);
      g.save(); g.translate(x + TILE / 2, y - 6); g.rotate(on ? 0.6 : -0.6);
      g.fillStyle = '#6a6a74'; g.fillRect(-2, -20, 4, 20);
      g.fillStyle = on ? '#5fd17a' : '#e5574d'; g.fillRect(-5, -26, 10, 8);
      g.restore();
      g.fillStyle = on ? '#5fd17a' : '#e5574d'; g.fillRect(x + TILE / 2 - 2, y - 4, 4, 2);
    }

    // lampu gantung
    sim.lampDefs.forEach((L, k) => {
      const on = sim.links['Y' + k] ? sim.active('Y' + k) : true;
      g.fillStyle = C.border; g.fillRect(L.x - 1, TILE, 2, L.y - TILE - 6);
      g.fillStyle = on ? '#ffe9a8' : '#6b5a4a'; g.fillRect(L.x - 6, L.y + 4, 12, 6);
      g.fillStyle = '#c96f5a'; g.fillRect(L.x - 14, L.y - 8, 28, 12);
      g.fillStyle = '#9a4f3e'; g.fillRect(L.x - 14, L.y + 2, 28, 3);
      if (on && !sim.level.dark) { g.fillStyle = 'rgba(255,233,168,.18)'; g.fillRect(L.x - 40, L.y + 8, 80, 60); }
    });

    // lift
    for (const L of s.lifts) {
      const x = Math.round(L.x), y = Math.round(L.y);
      g.fillStyle = C.metalDark; g.fillRect(x + 6, TILE, 2, y - TILE); g.fillRect(x + L.w - 8, TILE, 2, y - TILE);
      g.fillStyle = C.metalDark; g.fillRect(x, y, L.w, L.h);
      g.fillStyle = C.metal; g.fillRect(x + 2, y + 1, L.w - 4, L.h - 5);
      g.fillStyle = '#f6d36b'; for (let k = 4; k < L.w - 6; k += 12) g.fillRect(x + k, y + L.h - 4, 6, 2);
    }

    // ikan di atas piring (area tujuan)
    if (sim.goal) {
      const gx = sim.goal.x + sim.goal.w / 2, gy = sim.goal.y + sim.goal.h;
      g.fillStyle = '#ffffff'; g.fillRect(gx - 24, gy - 6, 48, 6);
      g.fillStyle = '#d9d4cc'; g.fillRect(gx - 20, gy - 2, 40, 2);
      if (!s.won) {
        const bob = Math.round(Math.sin(t * 4) * 1.5);
        g.fillStyle = '#7f95a8'; g.fillRect(gx - 16, gy - 14 + bob, 24, 8); g.fillRect(gx + 8, gy - 16 + bob, 6, 12);
        g.fillStyle = '#c3d2dd'; g.fillRect(gx - 14, gy - 10 + bob, 20, 3);
        g.fillStyle = '#222'; g.fillRect(gx - 12, gy - 12 + bob, 2, 2);
      } else { // tulang ikan
        g.fillStyle = '#efe9df'; g.fillRect(gx - 14, gy - 10, 22, 2);
        for (let k = 0; k < 4; k++) g.fillRect(gx - 10 + k * 5, gy - 14, 2, 10);
        g.fillRect(gx + 8, gy - 14, 4, 10);
      }
    }

    // kardus
    if (s.box) {
      const b = s.box, x = Math.round(b.x), y = Math.round(b.y);
      g.fillStyle = C.boxDark; g.fillRect(x, y, b.w, b.h);
      g.fillStyle = C.box; g.fillRect(x + 2, y + 2, b.w - 4, b.h - 4);
      g.fillStyle = C.tape; g.fillRect(x + b.w / 2 - 3, y + 2, 6, b.h - 4);
      g.fillStyle = C.boxDark; g.fillRect(x + 2, y + 9, b.w - 4, 1);
    }

    // robot vacuum
    for (const R of s.robots) {
      const x = Math.round(R.x), y = Math.round(R.y);
      g.fillStyle = '#2f3138'; g.fillRect(x + 2, y + 2, R.w - 4, R.h - 2); g.fillRect(x, y + 5, R.w, R.h - 7);
      g.fillStyle = '#4a4d57'; g.fillRect(x + 6, y, R.w - 12, 4);
      g.fillStyle = '#16171b'; g.fillRect(x + 4, y + R.h - 2, 6, 2); g.fillRect(x + R.w - 10, y + R.h - 2, 6, 2);
      const blinkOn = R.off || Math.floor(t * 4) % 2;
      g.fillStyle = R.off ? '#5aa9ff' : blinkOn ? '#5fd17a' : '#2d6b3b';
      g.fillRect(x + (R.dir > 0 ? R.w - 12 : 8), y + 4, 4, 3);
      if (!R.off) { // debu kesedot
        g.fillStyle = 'rgba(160,140,120,.6)';
        const back = R.dir > 0 ? x - 6 : x + R.w + 2;
        g.fillRect(back + Math.sin(t * 20) * 2, y + R.h - 4, 3, 3);
      }
    }

    const dark = !!sim.level.dark;
    if (!dark) this.drawHints(g);

    // kucing (yang dikontrol pemain digambar terakhir biar di depan)
    const order = this.me === 0 ? [1, 0] : [0, 1];
    for (const i of order) this.drawCat(g, i, s.cats[i], t, !dark);

    // efek: cipratan air & kesetrum robot
    for (const f of s.fx || []) {
      if (f.id <= this.seenFx) continue;
      this.seenFx = f.id;
      const n = f.k === 'zap' ? 14 : 18;
      for (let k = 0; k < n; k++) {
        this.particles.push(f.k === 'zap'
          ? { x: f.x, y: f.y, vx: (Math.random() - 0.5) * 300, vy: (Math.random() - 0.5) * 300, life: 0.5, c: '#ffe066', g: 0 }
          : { x: f.x + (Math.random() - 0.5) * 20, y: f.y, vx: (Math.random() - 0.5) * 220, vy: -150 - Math.random() * 260, life: 0.8, c: C.waterHi, g: 900 });
      }
    }
    this.particles = this.particles.filter((p) => (p.life -= dt) > 0);
    for (const p of this.particles) {
      p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt;
      g.fillStyle = p.c; g.fillRect(Math.round(p.x), Math.round(p.y), 4, 4);
    }

    if (dark) { this.drawDarkness(g, t, order); this.drawHints(g); }
  }

  // tulisan petunjuk di dunia
  drawHints(g) {
    g.font = '11px "Pixelify Sans", monospace'; g.textAlign = 'left';
    for (const h of this.sim.level.hints || []) {
      g.fillStyle = 'rgba(255,248,236,.75)';
      const w = g.measureText(h.text).width;
      g.fillRect(h.tx * TILE - 4, h.ty * TILE - 11, w + 8, 15);
      g.fillStyle = C.text; g.fillText(h.text, h.tx * TILE, h.ty * TILE);
    }
  }

  // Level gelap: semua hitam kecuali sekitar kucing & lampu yang nyala.
  // Online: kamu cuma lihat sekitar kucingmu sendiri; pasangan cuma kelihatan matanya.
  drawDarkness(g, t, order) {
    const sim = this.sim, s = sim.s, d = this.dark.getContext('2d');
    d.globalCompositeOperation = 'source-over';
    d.clearRect(0, 0, this.W, this.H);
    d.fillStyle = 'rgba(6,6,14,0.96)';
    d.fillRect(0, 0, this.W, this.H);
    d.globalCompositeOperation = 'destination-out';
    const light = (x, y, r) => {
      const grad = d.createRadialGradient(x, y, r * 0.25, x, y, r);
      grad.addColorStop(0, 'rgba(0,0,0,1)'); grad.addColorStop(0.55, 'rgba(0,0,0,.95)'); grad.addColorStop(1, 'rgba(0,0,0,0)');
      d.fillStyle = grad; d.beginPath(); d.arc(x, y, r, 0, Math.PI * 2); d.fill();
    };
    sim.lampDefs.forEach((L, k) => {
      const on = sim.links['Y' + k] ? sim.active('Y' + k) : true;
      const r = this.ease('Y' + k, on ? (L.r || 260) : 0, 1 / 60, 8);
      if (r > 4) light(L.x, L.y + r * 0.35, r);
    });
    s.cats.forEach((e, i) => {
      if (this.me === -1 || this.me === i) light(e.x + e.w / 2, e.y + e.h / 2, 85 + Math.sin(t * 3) * 3);
    });
    g.drawImage(this.dark, 0, 0);
    // lampu yang nyala kelihatan sebagai sumber cahaya
    sim.lampDefs.forEach((L, k) => {
      const on = sim.links['Y' + k] ? sim.active('Y' + k) : true;
      if (on) { g.fillStyle = '#ffe9a8'; g.fillRect(L.x - 6, L.y + 4, 12, 6); }
    });
    for (const i of order) {
      const mine = s.cats[this.me], e = s.cats[i];
      const near = mine && Math.hypot(e.x - mine.x, e.y - mine.y) < 70; // kalau dekat, udah kelihatan
      if (this.me !== -1 && this.me !== i && !near) this.drawEyes(g, i, e, t);
      this.drawLabel(g, i, s.cats[i]);
    }
  }
}
