// Server TURN opsional. Isi kalau punya sendiri (mis. coturn di VPS), biar tetap bisa konek
// walau koneksi langsung antar device gagal (WiFi kantor, jaringan seluler ketat, dll).
// Contoh:
//   export const TURN_SERVERS = [
//     { urls: ['turn:turn.byairu.com:3478', 'turn:turn.byairu.com:3478?transport=tcp'], username: 'kucing', credential: 'rahasia' },
//   ];
export const TURN_SERVERS = [];
