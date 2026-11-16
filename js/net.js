// Koneksi P2P pakai PeerJS:
//  1. Host daftar ke server "makelar" gratis PeerJS dengan ID  kucingmaling-v1-<KODE>
//  2. Guest konek ke ID itu  → setelah kenalan, data jalan langsung browser↔browser (WebRTC)
//  3. Voice chat juga lewat WebRTC (masing-masing "nelpon" pasangannya pakai mic sendiri)
//
// PENTING: tanpa izin mikrofon, Chrome nyembunyiin IP lokal (diganti nama mDNS *.local).
// Di sebagian jaringan nama itu nggak bisa di-resolve → dua device di WiFi yang sama gagal konek.
// Makanya izin mic diminta SEBELUM bikin/gabung room (lihat main.js).
import { TURN_SERVERS } from './config.js';

const PREFIX = 'kucingmaling-v1-';
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // tanpa O/0, I/1/L biar nggak ketuker
const PEER_OPTS = {
  debug: 0,
  config: {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:global.stun.twilio.com:3478' },
      ...TURN_SERVERS,
    ],
  },
};

const makeCode = () => Array.from({ length: 4 }, () => ALPHABET[Math.floor(Math.random() * ALPHABET.length)]).join('');

export class Net {
  constructor() {
    this.peer = null;
    this.conn = null;
    this.isHost = false;
    this.code = '';
    this.handlers = {};
    this.mic = null;
    this.calls = [];
  }

  on(type, fn) { this.handlers[type] = fn; return this; }
  emit(type, data) { this.handlers[type]?.(data); }
  get connected() { return !!this.conn?.open; }
  send(msg) { if (this.connected) this.conn.send(msg); }

  // Bikin room → resolve(kode)
  host() {
    this.isHost = true;
    return new Promise((resolve, reject) => {
      const attempt = (n) => {
        const code = makeCode();
        const peer = new window.Peer(PREFIX + code, PEER_OPTS);
        peer.on('open', () => { this.peer = peer; this.code = code; this.listen(); resolve(code); });
        peer.on('error', (err) => {
          if (err.type === 'unavailable-id' && n < 5) { peer.destroy(); attempt(n + 1); }
          else if (!this.peer) reject(friendly(err));
          else this.emit('error', friendly(err));
        });
      };
      attempt(0);
    });
  }

  // Gabung ke room orang lain
  join(rawCode) {
    const code = rawCode.trim().toUpperCase();
    this.isHost = false;
    return new Promise((resolve, reject) => {
      let settled = false;
      const fail = (err) => { if (!settled) { settled = true; reject(friendly(err)); } else this.emit('error', friendly(err)); };
      const peer = new window.Peer(PEER_OPTS);
      peer.on('error', fail);
      peer.on('open', () => {
        this.peer = peer; this.code = code; this.listen();
        const conn = peer.connect(PREFIX + code, { reliable: true, serialization: 'json' });
        const timer = setTimeout(() => fail(new Error('Gagal konek (timeout). Coba lagi, atau ganti jaringan.')), 15000);
        conn.on('open', () => { clearTimeout(timer); settled = true; this.attach(conn); resolve(); });
      });
    });
  }

  listen() {
    this.peer.on('connection', (conn) => {
      if (this.connected) { // room udah penuh (2 orang)
        conn.on('open', () => { conn.send({ t: 'full' }); setTimeout(() => conn.close(), 300); });
        return;
      }
      conn.on('open', () => this.attach(conn));
    });
    this.peer.on('call', (call) => {
      call.answer();
      call.on('stream', (stream) => this.playRemote(stream));
      this.calls.push(call);
    });
    this.peer.on('disconnected', () => { try { this.peer.reconnect(); } catch (_) { /* udah ditutup */ } });
  }

  attach(conn) {
    this.conn = conn;
    conn.on('data', (msg) => msg?.t && this.emit(msg.t, msg));
    conn.on('close', () => { if (this.conn === conn) { this.conn = null; this.emit('close'); } });
    conn.on('error', () => {});
    this.emit('connected');
    if (this.mic) this.callPartner();
  }

  // ---------- voice chat ----------
  async toggleMic() {
    if (this.mic) {
      this.mic.getTracks().forEach((tr) => tr.stop());
      this.mic = null;
      this.calls.forEach((c) => { if (c._mine) c.close(); });
      this.calls = this.calls.filter((c) => !c._mine);
      return false;
    }
    this.mic = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
    if (this.connected) this.callPartner();
    return true;
  }

  callPartner() {
    const call = this.peer.call(this.conn.peer, this.mic);
    call._mine = true;
    this.calls.push(call);
  }

  playRemote(stream) {
    let el = document.getElementById('remoteAudio');
    if (!el) { el = document.createElement('audio'); el.id = 'remoteAudio'; el.autoplay = true; document.body.appendChild(el); }
    el.srcObject = stream;
    el.play().catch(() => {});
  }

  close() {
    try { this.conn?.close(); } catch (_) {}
    try { this.peer?.destroy(); } catch (_) {}
    this.mic?.getTracks().forEach((tr) => tr.stop());
    this.peer = this.conn = this.mic = null;
    this.calls = [];
  }
}

function friendly(err) {
  const map = {
    'peer-unavailable': 'Room nggak ketemu. Cek lagi kodenya.',
    network: 'Nggak bisa nyambung ke server makelar. Cek internet kamu.',
    'server-error': 'Server makelar PeerJS lagi error. Coba sebentar lagi.',
    'browser-incompatible': 'Browser ini nggak dukung WebRTC.',
  };
  return new Error(map[err?.type] || err?.message || 'Ada yang error');
}
