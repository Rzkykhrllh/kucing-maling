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
const LIFT_SPEED = 95;
const ROBOT_SPEED = 80;
const ROBOT_W = 38, ROBOT_H = 14;

const SOLID = new Set(['#', 'S', 'E', 'T']);
const BUTTONS = new Set(['a', 'c', 'e', 'g']); // tombol biasa (siapa aja)
const HEAVY = new Set(['b', 'h']); // tombol berat (Gembul / kardus)
const LEVERS = new Set(['L', 'M']); // tuas, sekali sentuh nyala terus
const GATES = new Set(['D', 'F']);
const DEFAULT_LINKS = { '~': ['a', 'b'], D: ['L'] };

const overlap = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

export class Sim {
  constructor(level, index = 0) {
    this.level = level;
    this.index = index;
    this.links = { ...DEFAULT_LINKS, ...(level.links || {}) };
    this.map = level.map.map((r) => r.split(''));
    this.H = this.map.length;
    this.W = this.map[0].length;
    this.spawns = [];
    this.sensors = []; // tombol: {id, heavy, x,y,w,h, tx,ty}
    this.levers = []; // {id, ...rect}
    this.checkpoints = [];
    this.lampDefs = [];
    this.robotDefs = [];
    this.liftDefs = [];
    this.boxSpawn = null;
    this.goal = null;
    const triggerIds = new Set();

    for (let ty = 0; ty < this.H; ty++) {
      for (let tx = 0; tx < this.W; tx++) {
        const c = this.map[ty][tx];
        const px = tx * TILE, py = ty * TILE;
        if (c === '1' || c === '2') this.spawns[+c - 1] = { x: px + TILE / 2, y: py + TILE };
        else if (c === 'K') this.boxSpawn = { x: px, y: py };
        else if (BUTTONS.has(c) || HEAVY.has(c)) {
          this.sensors.push({ id: c, heavy: HEAVY.has(c), x: px + 4, y: py + TILE - 10, w: TILE - 8, h: 10, tx, ty });
          triggerIds.add(c);
        } else if (LEVERS.has(c)) {
          this.levers.push({ id: c, x: px + 6, y: py + 4, w: TILE - 12, h: TILE - 4, tx, ty });
          triggerIds.add(c);
        } else if (c === 'C') this.checkpoints.push({ x: px, y: py, w: TILE, h: TILE, tx, ty });
        else if (c === 'Y') this.lampDefs.push({ x: px + TILE / 2, y: py + TILE / 2, tx, ty, ...(level.lamps?.[this.lampDefs.length] || {}) });
        else if (c === 'R') {
          const cfg = level.robots?.[this.robotDefs.length] || {};
          this.robotDefs.push({ x: px, y: py + TILE - ROBOT_H, minX: (cfg.from ?? tx) * TILE, maxX: ((cfg.to ?? tx) + 1) * TILE, dock: (cfg.dock ?? tx) * TILE });
        } else if (c === 'P') {
          const prev = this.liftDefs[this.liftDefs.length - 1];
          if (prev && prev.ty === ty && prev.x + prev.w === px) prev.w += TILE; // lanjutan lift yang sama
          else {
            const cfg = level.lifts?.[this.liftDefs.length] || {};
            this.liftDefs.push({ x: px, y: py + TILE - 12, w: TILE, h: 12, ty, restY: py + TILE - 12, topY: (cfg.toRow ?? ty) * TILE });
          }
        } else if (c === 'G') {
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
    this.triggerIds = [...triggerIds].sort();
    this.reset();
  }

  reset() {
    const keepId = this.s ? this.s.fxId : 0; // id efek jangan mulai dari 0 lagi
    this.s = {
      t: 0,
      cats: CATS.map((def, i) => ({
        x: this.spawns[i].x - def.w / 2, y: this.spawns[i].y - def.h, w: def.w, h: def.h,
        vx: 0, vy: 0, face: 1, ground: false, coyote: 0, jbuf: 0, prevJ: false, walk: 0, cp: -1,
      })),
      box: this.boxSpawn ? { x: this.boxSpawn.x, y: this.boxSpawn.y, w: TILE, h: TILE, vy: 0 } : null,
      lifts: this.liftDefs.map((d) => ({ x: d.x, y: d.restY, w: d.w, h: d.h })),
      robots: this.robotDefs.map((d) => ({ x: d.x, y: d.y, w: ROBOT_W, h: ROBOT_H, dir: 1, off: false })),
      on: {}, cpOn: 0,
      won: false, wonAt: 0, deaths: 0, fx: [], fxId: keepId,
    };
  }

  // Apakah objek dengan kunci `key` (mis. '~', 'D', 'P0', 'R0', 'Y1') lagi aktif?
  active(key) {
    const ids = this.links[key];
    return !!ids && ids.some((id) => this.s.on[id]);
  }

  tile(tx, ty) {
    if (tx < 0 || ty < 0 || tx >= this.W || ty >= this.H) return '#';
    return this.map[ty][tx];
  }

  solid(tx, ty) {
    const c = this.tile(tx, ty);
    if (SOLID.has(c)) return true;
    if (c === '~') return this.active('~');
    if (GATES.has(c)) return !this.active(c);
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

  // Tabrakan vertikal sama benda padat yang bisa gerak (kardus, lift).
  // Return 'top' kalau e jadi berdiri di atasnya.
  landOn(e, r) {
    if (!overlap(e, r)) return null;
    if (e.y + e.h - r.y <= r.y + r.h - e.y) { e.y = r.y - e.h; return 'top'; }
    e.y = r.y + r.h; return 'bottom';
  }

  // Kalau jembatan tiba-tiba muncul pas ada yang lagi "di dalam" tile, dorong ke atas.
  unstick(e) {
    for (let i = 0; i < 3 && this.rectSolid(e); i++) e.y = Math.floor((e.y + e.h - 0.001) / TILE) * TILE - e.h;
  }

  inWater(e) {
    const bottom = e.y + e.h;
    const ty = Math.floor((bottom - 1) / TILE);
    const x0 = Math.floor((e.x + 2) / TILE), x1 = Math.floor((e.x + e.w - 2) / TILE);
    for (let tx = x0; tx <= x1; tx++) {
      const c = this.tile(tx, ty);
      if ((c === 'w' || (c === '~' && !this.active('~'))) && bottom > ty * TILE + 6) return true;
    }
    return false;
  }

  effect(kind, x, y) {
    const s = this.s;
    s.fx.push({ id: ++s.fxId, k: kind, x: Math.round(x), y: Math.round(y) });
    if (s.fx.length > 8) s.fx.shift();
  }

  respawn(i) {
    const s = this.s, e = s.cats[i];
    s.deaths++;
    const sp = e.cp >= 0
      ? { x: this.checkpoints[e.cp].x + TILE / 2, y: this.checkpoints[e.cp].y + TILE }
      : this.spawns[i];
    Object.assign(e, { x: sp.x - e.w / 2, y: sp.y - e.h, vx: 0, vy: 0, ground: false });
  }

  // inputs: [{l,r,j}, {l,r,j}] — index 0 = Gembul, 1 = Mochi
  step(dt, inputs) {
    const s = this.s;
    s.t += dt;
    const box = s.box;
    const bodies = box ? [...s.cats, box] : [...s.cats];

    // --- tombol & tuas ---
    const wasBridge = this.active('~');
    for (const id of this.triggerIds) if (!LEVERS.has(id)) s.on[id] = false;
    for (const r of this.sensors) {
      const who = r.heavy ? [s.cats[0], box] : bodies; // tombol berat: cuma Gembul atau kardus
      if (who.some((e) => e && overlap(e, r))) s.on[r.id] = true;
    }
    for (const r of this.levers) if (!s.on[r.id] && s.cats.some((e) => overlap(e, r))) s.on[r.id] = true;
    if (this.active('~') && !wasBridge) bodies.forEach((e) => this.unstick(e));

    // --- lift: naik kalau tombolnya aktif, turun kalau nggak ---
    s.lifts.forEach((L, i) => {
      const d = this.liftDefs[i];
      const target = this.active('P' + i) ? d.topY : d.restY;
      let dy = Math.max(-LIFT_SPEED * dt, Math.min(LIFT_SPEED * dt, target - L.y));
      if (!dy) return;
      const riders = bodies.filter((e) => Math.abs(e.y + e.h - L.y) < 2 && e.x < L.x + L.w && e.x + e.w > L.x);
      if (dy > 0) { // turun: jangan gencet yang ada di bawah
        const below = { x: L.x, y: L.y + L.h, w: L.w, h: dy };
        if (bodies.some((e) => !riders.includes(e) && overlap(e, below))) dy = 0;
      }
      L.y += dy;
      for (const e of riders) { e.y = L.y - e.h; if (dy < 0 && this.rectSolid(e)) { e.y -= dy; } }
    });

    // --- kardus: gravitasi ---
    if (box) {
      box.vy = Math.min(box.vy + GRAV * dt, MAX_FALL);
      const dy = box.vy * dt;
      if (this.moveY(box, dy)) box.vy = 0;
      for (const L of s.lifts) if (this.landOn(box, L)) box.vy = 0;
      if (this.inWater(box)) {
        this.effect('water', box.x + box.w / 2, Math.floor((box.y + box.h) / TILE) * TILE);
        Object.assign(box, { x: this.boxSpawn.x, y: this.boxSpawn.y, vy: 0 });
      }
    }

    // --- robot vacuum ---
    s.robots.forEach((R, i) => {
      const d = this.robotDefs[i];
      R.off = this.active('R' + i);
      if (R.off) { // pulang ke dok
        const dx = Math.max(-ROBOT_SPEED * dt, Math.min(ROBOT_SPEED * dt, d.dock - R.x));
        R.x += dx; if (dx) R.dir = Math.sign(dx);
        return;
      }
      R.x += R.dir * ROBOT_SPEED * dt;
      const bounce = R.x < d.minX || R.x + R.w > d.maxX || this.rectSolid(R) || (box && overlap(R, box));
      if (bounce) { R.x -= R.dir * ROBOT_SPEED * dt; R.dir *= -1; }
    });

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
      const touching = box && dir && e.y < box.y + box.h && e.y + e.h > box.y &&
        (dir > 0 ? Math.abs(e.x + e.w - box.x) < 1.5 : Math.abs(e.x - (box.x + box.w)) < 1.5);
      e.vx = dir * def.speed * (touching && def.push ? PUSH_SLOW : 1);

      // horizontal
      const dx = e.vx * dt;
      this.moveX(e, dx);
      if (box && overlap(e, box)) {
        if (def.push && dx) {
          const want = dx > 0 ? e.x + e.w - box.x : e.x - (box.x + box.w);
          const old = box.x;
          this.moveX(box, want);
          const other = s.cats[1 - i]; // kardus jangan nembus kucing satunya / lift / robot
          if ((overlap(box, other) && other.y + other.h > box.y + 4) || s.lifts.some((L) => overlap(box, L)) || s.robots.some((R) => !R.off && overlap(box, R))) box.x = old;
        }
        if (overlap(e, box)) e.x = dx > 0 ? box.x - e.w : box.x + box.w;
      }
      for (const L of s.lifts) if (overlap(e, L) && dx) e.x = dx > 0 ? L.x - e.w : L.x + L.w;

      // vertikal
      e.vy = Math.min(e.vy + GRAV * dt, MAX_FALL);
      const dy = e.vy * dt;
      const hit = this.moveY(e, dy);
      e.ground = hit && dy > 0;
      if (hit) e.vy = 0;
      for (const r of box ? [box, ...s.lifts] : s.lifts) {
        const side = this.landOn(e, r);
        if (side === 'top') { e.ground = true; if (e.vy > 0) e.vy = 0; }
        else if (side === 'bottom') e.vy = Math.max(e.vy, 0);
      }
      if (e.ground && dir) e.walk += Math.abs(dx); else if (e.ground) e.walk = 0;

      // checkpoint (kasur kucing)
      this.checkpoints.forEach((c, k) => { if (overlap(e, c)) { e.cp = k; s.cpOn |= 1 << k; } });

      // bahaya
      if (this.inWater(e)) {
        this.effect('water', e.x + e.w / 2, Math.floor((e.y + e.h) / TILE) * TILE);
        this.respawn(i);
      } else if (s.robots.some((R) => !R.off && overlap(e, { x: R.x + 8, y: R.y + 3, w: R.w - 16, h: R.h - 3 }))) {
        this.effect('zap', e.x + e.w / 2, e.y + e.h / 2);
        this.respawn(i);
      }
    });

    // --- menang: dua-duanya di area ikan ---
    if (!s.won && this.goal) {
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
      lv: this.index,
      tm: r(s.t),
      c: s.cats.map((e) => [r(e.x), r(e.y), r(e.vx), r(e.vy), e.face, e.ground ? 1 : 0, Math.round(e.walk)]),
      b: s.box ? [r(s.box.x), r(s.box.y)] : null,
      l: s.lifts.map((L) => r(L.y)),
      ro: s.robots.map((R) => [r(R.x), R.dir, R.off ? 1 : 0]),
      on: this.triggerIds.filter((id) => s.on[id]).join(''),
      cp: s.cpOn,
      won: s.won ? 1 : 0, w: r(s.wonAt), d: s.deaths, fx: s.fx,
    };
  }

  // Dipakai guest: timpa state lokal dengan snapshot dari host
  applySnapshot(n) {
    const s = this.s;
    const target = (e, x, y) => {
      e.tx = x; e.ty = y;
      if (!e.seen || Math.hypot(x - e.x, y - e.y) > 96) { e.x = x; e.y = y; }
      e.seen = true;
    };
    s.t = n.tm;
    n.c.forEach((a, i) => {
      const e = s.cats[i];
      target(e, a[0], a[1]);
      [, , e.vx, e.vy, e.face] = a;
      e.ground = !!a[5]; e.walk = a[6];
    });
    if (s.box && n.b) target(s.box, n.b[0], n.b[1]);
    n.l?.forEach((y, i) => target(s.lifts[i], s.lifts[i].x, y));
    n.ro?.forEach((a, i) => { target(s.robots[i], a[0], s.robots[i].y); s.robots[i].dir = a[1]; s.robots[i].off = !!a[2]; });
    s.on = {};
    for (const id of n.on || '') s.on[id] = true;
    s.cpOn = n.cp; s.won = !!n.won; s.wonAt = n.w; s.deaths = n.d; s.fx = n.fx;
  }

  // Guest: geser posisi tampilan pelan-pelan ke posisi dari host biar halus
  smooth(dt) {
    const k = Math.min(1, 1 - Math.pow(0.000001, dt)); // ±20% jarak per frame di 60fps
    const s = this.s;
    for (const e of [...s.cats, ...(s.box ? [s.box] : []), ...s.lifts, ...s.robots]) {
      if (e.tx === undefined) continue;
      e.x += (e.tx - e.x) * k;
      e.y += (e.ty - e.y) * k;
    }
  }
}
