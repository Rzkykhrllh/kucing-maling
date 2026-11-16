# Kucing Maling

Game puzzle co-op online buat berdua. Gembul (kucing gede) dan Mochi (kucing kecil) kerja sama nyolong ikan dari meja makan. Gaya mainnya mirip Fireboy & Watergirl.

- **Gembul**: bisa nekan tombol berat dan dorong kardus, tapi lompatnya pendek dan nggak muat lewat celah sempit.
- **Mochi**: muat lewat celah sempit dan lompatnya tinggi, tapi terlalu ringan buat tombol berat.
- Level selesai kalau dua-duanya sampai ke ikan.

## Main

1. Satu orang klik **Buat room**, lalu kode 4 hurufnya (atau link-nya) dikirim ke pasangan.
2. Pasangan masukin kode, terus klik **Gabung**.
3. Nyalain **Mic** kalau mau ngobrol langsung di game.

Kontrol: `← →` / `A D` buat jalan, `↑` / `W` / `Spasi` buat lompat, `R` buat ngulang level. Di HP ada tombol sentuh.
Ada juga **Main lokal**: dua orang satu keyboard (Gembul pakai WASD, Mochi pakai panah).

## Jalanin di laptop

Harus lewat web server karena pakai ES modules (nggak bisa dibuka langsung dari file):

```bash
python3 -m http.server 8000
# buka http://localhost:8000
```

Buat nyoba online sendirian, buka dua tab: satu bikin room, satu gabung.

## Deploy ke GitHub Pages

Push repo ini ke GitHub, lalu buka **Settings → Pages → Deploy from branch → `main` / root**. Nggak perlu build dan nggak perlu server.

## Cara kerjanya

```
index.html       lobby, HUD, overlay
js/level.js      peta level (teks), gampang diedit
js/sim.js        fisika + aturan game (murni logika, bisa dites di Node)
js/render.js     gambar pixel art ke <canvas> (tanpa file gambar)
js/net.js        P2P pakai PeerJS + voice chat
js/main.js       alur lobby → game, loop, input
test/            bot yang nyelesaiin level 1 + cek batasan puzzle
```

**Online (host-authoritative P2P):**

- Pembuat room daftar ke server makelar gratis PeerJS dengan ID `kucingmaling-v1-<KODE>`. Yang gabung konek ke ID itu, terus data jalan langsung antar browser lewat WebRTC.
- Cuma **host** yang menjalankan simulasi (60x per detik) dan ngirim snapshot ke guest (30x per detik, sekitar 100 byte).
- **Guest** cuma ngirim input (kiri/kanan/lompat) dan nampilin snapshot dengan posisi yang dihaluskan.

Keterbatasannya: belum ada server TURN, jadi di jaringan yang ketat (WiFi kantor, sebagian jaringan seluler) koneksi bisa gagal. Guest juga belum pakai client-side prediction, jadi kalau ping-nya tinggi kucing guest bakal kerasa sedikit telat.

## Bikin level baru

Edit `map` di `js/level.js`. Legenda tile ada di bagian atas file itu. Abis itu jalanin tes:

```bash
node test/solve.test.mjs
```

Tes ini ngecek level 1 bisa diselesaikan, dan memastikan puzzle-nya nggak bisa diakalin (misalnya Gembul nggak muat masuk kolong sofa, atau nggak bisa naik meja tanpa kardus).
