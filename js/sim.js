// Simulasi game (murni logika, tanpa DOM). Cuma dijalankan oleh HOST
// (atau di mode lokal). Guest cuma nerima snapshot hasil simulasi ini.
import { TILE } from './level.js';

export const CATS = [
  { kind: 'big', name: 'Gembul', w: 44, h: 34, speed: 190, jump: 537, heavy: true, push: true },
  { kind: 'small', name: 'Mochi', w: 26, h: 22, speed: 220, jump: 759, heavy: false, push: false },
];

const GRAV = 1800;
const MAX_FALL = 900;
const COYOTE = 0.09; // boleh lompat sesaat setelah jatuh dari pinggiran
const JUMP_BUF = 0.12; // tombol lompat ditekan sedikit sebelum mendarat tetap kehitung
const PUSH_SLOW = 0.6;
const SOLID = new Set(['#', 'S', 'E', 'T']);

const overlap = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

export class Sim {
  constructor(level) {
    this.level = level;
    this.map = level.map.map((r) => r.split(''));
    this.H = this.map.length;
    this.W = this.map[0].length;
    this.spawns = [];
    this.btnA = [];
    this.btnB = [];
    this.levers = [];
    this.goal = null;
    for (let ty = 0; ty < this.H; ty++) {
      for (let tx = 0; tx < this.W; tx++) {
        const c = this.map[ty][tx];
        const px = tx * TILE, py = ty * TILE;
        const sensor = { x: px + 4, y: py + TILE - 10, w: TILE - 8, h: 10, tx, ty };
        if (c === '1' || c === '2') this.spawns[+c - 1] = { x: px + TILE / 2, y: py + TILE };
        else if (c === 'K') this.boxSpawn = { x: px, y: py };
        else if (c === 'a') this.btnA.push(sensor);
        else if (c === 'b') this.btnB.push(sensor);
        else if (c === 'L') this.levers.push({ x: px + 6, y: py + 4, w: TILE - 12, h: TILE - 4, tx, ty });
        else if (c === 'G') {
          const r = { x: px, y: py, w: TILE, h: TILE };
          if (!this.goal) this.goal = r;
          else {
            const x2 = Math.max(this.goal.x + this.goal.w, r.x + r.w), y2 = Math.max(this.goal.y + this.goal.h, r.y + r.h);
            this.goal.x = Math.min(this.goal.x, r.x); this.goal.y = Math.min(this.goal.y, r.y);
            this.goal.w = x2 - this.goal.x; this.goal.h = y2 - this.goal.y;
          }
        } else continue;
        this.map[ty][tx] = '.';
      }
    }
    this.reset();
  }

  reset() {
    const keepId = this.s ? this.s.splashId : 0; // id cipratan jangan mulai dari 0 lagi
    this.s = {
      t: 0,
      cats: CATS.map((def, i) => ({
        x: this.spawns[i].x - def.w / 2, y: this.spawns[i].y - def.h, w: def.w, h: def.h,
        vx: 0, vy: 0, face: 1, ground: false, coyote: 0, jbuf: 0, prevJ: false, walk: 0,
      })),
      box: { x: this.boxSpawn.x, y: this.boxSpawn.y, w: TILE, h: TILE, vy: 0 },
      A: false, B: false, lever: false, bridge: false, gate: false,
      won: false, wonAt: 0, deaths: 0, splashes: [], splashId: keepId,
    };
  }

  tile(tx, ty) {
    if (tx < 0 || ty < 0 || tx >= this.W || ty >= this.H) return '#';
    return this.map[ty][tx];
  }

  solid(tx, ty) {
    const c = this.tile(tx, ty);
    if (SOLID.has(c)) return true;
    if (c === '~') return this.s.bridge;
    if (c === 'D') return !this.s.gate;
    return false;
  }

  rectSolid(r) {
    const x0 = Math.floor(r.x / TILE), x1 = Math.floor((r.x + r.w - 0.001) / TILE);
    const y0 = Math.floor(r.y / TILE), y1 = Math.floor((r.y + r.h - 0.001) / TILE);
    for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) if (this.solid(tx, ty)) return true;
    return false;
  }

  // Gerak horizontal + tabrakan tile. Return true kalau nabrak.
  moveX(e, dx) {
    if (!dx) return false;
    e.x += dx;
    const y0 = Math.floor(e.y / TILE), y1 = Math.floor((e.y + e.h - 0.001) / TILE);
    if (dx > 0) {
      const tx = Math.floor((e.x + e.w - 0.001) / TILE);
      for (let ty = y0; ty <= y1; ty++) if (this.solid(tx, ty)) { e.x = tx * TILE - e.w; return true; }
    } else {
      const tx = Math.floor(e.x / TILE);
      for (let ty = y0; ty <= y1; ty++) if (this.solid(tx, ty)) { e.x = (tx + 1) * TILE; return true; }
    }
    return false;
  }

  moveY(e, dy) {
    if (!dy) return false;
    e.y += dy;
    const x0 = Math.floor(e.x / TILE), x1 = Math.floor((e.x + e.w - 0.001) / TILE);
    if (dy > 0) {
      const ty = Math.floor((e.y + e.h - 0.001) / TILE);
      for (let tx = x0; tx <= x1; tx++) if (this.solid(tx, ty)) { e.y = ty * TILE - e.h; return true; }
    } else {
      const ty = Math.floor(e.y / TILE);
      for (let tx = x0; tx <= x1; tx++) if (this.solid(tx, ty)) { e.y = (ty + 1) * TILE; return true; }
    }
    return false;
  }

  // Kalau jembatan tiba-tiba muncul pas ada yang lagi "di dalam" tile, dorong ke atas.
  unstick(e) {
    for (let i = 0; i < 3 && this.rectSolid(e); i++) e.y = Math.floor((e.y + e.h - 0.001) / TILE) * TILE - e.h;
  }

  inWater(e) {
    if (this.s.bridge) return false;
    const bottom = e.y + e.h;
    const ty = Math.floor((bottom - 1) / TILE);
    const x0 = Math.floor((e.x + 2) / TILE), x1 = Math.floor((e.x + e.w - 2) / TILE);
    for (let tx = x0; tx <= x1; tx++) if (this.tile(tx, ty) === '~' && bottom > ty * TILE + 6) return true;
    return false;
  }

  splash(x, y) {
    const s = this.s;
    s.splashes.push({ id: ++s.splashId, x: Math.round(x), y: Math.round(y) });
    if (s.splashes.length > 6) s.splashes.shift();
  }

  // inputs: [{l,r,j}, {l,r,j}] — index 0 = Gembul, 1 = Mochi
  step(dt, inputs) {
    const s = this.s;
    s.t += dt;
    const box = s.box;

    // --- tombol, tuas, jembatan, pagar ---
    const anyOn = (sensors, who) => sensors.some((r) => who.some((e) => overlap(e, r)));
    s.A = anyOn(this.btnA, [...s.cats, box]);
    s.B = anyOn(this.btnB, [s.cats[0], box]); // tombol berat: cuma Gembul atau kardus
    if (!s.lever && this.levers.some((r) => s.cats.some((e) => overlap(e, r)))) s.lever = true;
    const wasBridge = s.bridge;
    s.bridge = s.A || s.B;
    s.gate = s.lever;
    if (s.bridge && !wasBridge) { s.cats.forEach((e) => this.unstick(e)); this.unstick(box); }

    // --- kardus: gravitasi ---
    box.vy = Math.min(box.vy + GRAV * dt, MAX_FALL);
    if (this.moveY(box, box.vy * dt)) box.vy = 0;
    if (this.inWater(box)) {
      this.splash(box.x + box.w / 2, Math.floor((box.y + box.h) / TILE) * TILE);
      Object.assign(box, { x: this.boxSpawn.x, y: this.boxSpawn.y, vy: 0 });
    }

    // --- kucing ---
    s.cats.forEach((e, i) => {
      const def = CATS[i];
      const inp = s.won ? { l: false, r: false, j: false } : inputs[i] || {};
      const dir = (inp.r ? 1 : 0) - (inp.l ? 1 : 0);
      if (dir) e.face = dir;

      if (inp.j && !e.prevJ) e.jbuf = JUMP_BUF; else e.jbuf = Math.max(0, e.jbuf - dt);
      e.prevJ = !!inp.j;
      e.coyote = e.ground ? COYOTE : Math.max(0, e.coyote - dt);
      if (e.jbuf > 0 && e.coyote > 0) { e.vy = -def.jump; e.jbuf = 0; e.coyote = 0; e.ground = false; }
      if (!inp.j && e.vy < -220) e.vy = -220; // lepas tombol lompat = lompatan pendek

      // nempel ke kardus? jalan lebih pelan (lagi ngedorong)
      const touching = dir && e.y < box.y + box.h && e.y + e.h > box.y &&
        (dir > 0 ? Math.abs(e.x + e.w - box.x) < 1.5 : Math.abs(e.x - (box.x + box.w)) < 1.5);
      e.vx = dir * def.speed * (touching && def.push ? PUSH_SLOW : 1);

      // horizontal
      const dx = e.vx * dt;
      this.moveX(e, dx);
      if (overlap(e, box)) {
        if (def.push && dx) {
          const want = dx > 0 ? e.x + e.w - box.x : e.x - (box.x + box.w);
          const old = box.x;
          this.moveX(box, want);
          // kardus jangan nembus kucing satunya
          const other = s.cats[1 - i];
          if (overlap(box, other) && other.y + other.h > box.y + 4) box.x = old;
        }
        if (overlap(e, box)) e.x = dx > 0 ? box.x - e.w : box.x + box.w;
      }

      // vertikal
      e.vy = Math.min(e.vy + GRAV * dt, MAX_FALL);
      const dy = e.vy * dt;
      const hit = this.moveY(e, dy);
      e.ground = hit && dy > 0;
      if (hit) e.vy = 0;
      if (overlap(e, box)) {
        if (dy > 0) { e.y = box.y - e.h; e.ground = true; } else e.y = box.y + box.h;
        e.vy = 0;
      }
      if (e.ground && dir) e.walk += Math.abs(dx); else if (e.ground) e.walk = 0;

      // kecebur
      if (this.inWater(e)) {
        this.splash(e.x + e.w / 2, Math.floor((e.y + e.h) / TILE) * TILE);
        s.deaths++;
        const sp = this.spawns[i];
        Object.assign(e, { x: sp.x - e.w / 2, y: sp.y - e.h, vx: 0, vy: 0, ground: false });
      }
    });

    // --- menang: dua-duanya di area ikan ---
    if (!s.won) {
      const g = this.goal;
      const inGoal = (e) => {
        const cx = e.x + e.w / 2, by = e.y + e.h;
        return cx > g.x && cx < g.x + g.w && by > g.y && by <= g.y + g.h + 1;
      };
      if (s.cats.every(inGoal)) { s.won = true; s.wonAt = s.t; }
    }
  }

  // Snapshot ringkas buat dikirim ke guest (~30x per detik)
  snapshot() {
    const s = this.s, r = (v) => Math.round(v * 10) / 10;
    return {
      tm: r(s.t),
      c: s.cats.map((e) => [r(e.x), r(e.y), r(e.vx), r(e.vy), e.face, e.ground ? 1 : 0, Math.round(e.walk)]),
      b: [r(s.box.x), r(s.box.y)],
      f: (s.A ? 1 : 0) | (s.B ? 2 : 0) | (s.lever ? 4 : 0) | (s.bridge ? 8 : 0) | (s.gate ? 16 : 0) | (s.won ? 32 : 0),
      w: r(s.wonAt), d: s.deaths, sp: s.splashes,
    };
  }

  // Dipakai guest: timpa state lokal dengan snapshot dari host
  applySnapshot(n) {
    const s = this.s;
    s.t = n.tm;
    n.c.forEach((a, i) => {
      const e = s.cats[i];
      [e.tx, e.ty, e.vx, e.vy, e.face] = a;
      e.ground = !!a[5]; e.walk = a[6];
      if (e.tx2 === undefined || Math.hypot(e.tx - e.x, e.ty - e.y) > 96) { e.x = e.tx; e.y = e.ty; }
      e.tx2 = true;
    });
    s.box.tx = n.b[0]; s.box.ty = n.b[1];
    if (Math.hypot(s.box.tx - s.box.x, s.box.ty - s.box.y) > 96) { s.box.x = s.box.tx; s.box.y = s.box.ty; }
    s.A = !!(n.f & 1); s.B = !!(n.f & 2); s.lever = !!(n.f & 4); s.bridge = !!(n.f & 8); s.gate = !!(n.f & 16); s.won = !!(n.f & 32);
    s.wonAt = n.w; s.deaths = n.d; s.splashes = n.sp;
  }

  // Guest: geser posisi tampilan pelan-pelan ke posisi dari host biar halus
  smooth(dt) {
    const k = Math.min(1, 1 - Math.pow(0.000001, dt)); // ±20% jarak per frame di 60fps
    for (const e of [...this.s.cats, this.s.box]) {
      if (e.tx === undefined) continue;
      e.x += (e.tx - e.x) * k;
      e.y += (e.ty - e.y) * k;
    }
  }
}
