// Peta level. Tiap karakter = 1 tile (32x32 px). Semua level ukurannya 36 x 17.
//
//  #  tembok / lantai             S  sofa      E  rak      T  meja   (semua padat)
//  ~  air yang bisa jadi jembatan  w  air biasa (selalu bahaya)
//  a c e g   tombol biasa (siapa aja yang nginjek)
//  b h       tombol BERAT (cuma Gembul atau kardus)
//  L M       tuas (sekali disentuh nyala terus)
//  D F       pagar (kebuka selama tombol/tuas yang di-link aktif)
//  P         lift (tile berurutan = 1 lift), naik ke `lifts[i].toRow`
//  R         robot vacuum, patroli `robots[i].from` s/d `.to` (kolom)
//  C         kasur kucing = checkpoint (respawn di sini)
//  Y         lampu (penting di level gelap)
//  K         kardus (bisa didorong Gembul)
//  G         area ikan (dua kucing harus di sini)
//  1 / 2     start Gembul / Mochi
//
// `links` = objek mana nyala karena tombol/tuas apa. Kunci: '~' (jembatan), 'D'/'F' (pagar),
// 'P0' (lift ke-0), 'R0' (robot ke-0: MATI kalau aktif), 'Y0' (lampu ke-0).
// Default: '~' ← a|b, 'D' ← L.

export const TILE = 32;

export const LEVELS = [
  {
    name: 'Ikan di Meja Makan',
    map: [
      '####################################',
      '#........................#.........#',
      '#........................#.........#',
      '#........................#.........#',
      '#........................#.........#',
      '#........................#.........#',
      '#........................#.........#',
      '#........................#.........#',
      '#........................#.........#',
      '#........................#.........#',
      '#.....................L..#.........#',
      '#.....................EE.D......GGG#',
      '#........................D.....TTTT#',
      '#......SSSSS.............D........T#',
      '#.1.2....a.S.........b...D.K......T#',
      '############~~~~~~~~################',
      '####################################',
    ],
    hints: [
      { tx: 2, ty: 9.6, text: 'Gembul gede & kuat · Mochi kecil & lompat tinggi' },
      { tx: 6.4, ty: 12.4, text: 'kolong sofa: cuma Mochi muat' },
      { tx: 11, ty: 11.4, text: 'air! jembatan muncul kalau tombol ketekan' },
      { tx: 19.6, ty: 13.4, text: 'tombol berat ↓' },
      { tx: 18.6, ty: 9.6, text: 'tuas di atas rak →' },
      { tx: 26.3, ty: 13.4, text: 'kardus (didorong Gembul)' },
    ],
  },
  {
    name: 'Robot Vacuum',
    map: [
      '####################################',
      '#............................#.....#',
      '#............................#.....#',
      '#............................#.....#',
      '#............................D.....#',
      '#............................D.....#',
      '#............................D.....#',
      '#....................C.e..b..DGGaGG#',
      '#...................################',
      '#..................................#',
      '#..................................#',
      '#..................................#',
      '#..................................#',
      '#..................................#',
      '#.12....R...c.....PP...............#',
      '####################################',
      '####################################',
    ],
    links: { P0: ['c', 'e'], D: ['b', 'a'] },
    lifts: [{ toRow: 8 }],
    robots: [{ from: 5, to: 16 }],
    hints: [
      { tx: 1.4, ty: 11.6, text: 'robot vacuum: kesenggol = balik ke awal. lompatin!' },
      { tx: 9.6, ty: 13.2, text: 'tombol lift ↓' },
      { tx: 15.4, ty: 12.4, text: 'lift ↓' },
      { tx: 20.6, ty: 6.3, text: 'kasur = checkpoint' },
      { tx: 22.2, ty: 9.4, text: 'tombol lift atas · tombol berat buka pagar' },
      { tx: 29.4, ty: 3.4, text: 'tombol di dalam juga buka pagar' },
    ],
  },
  {
    name: 'Mati Lampu',
    dark: true,
    map: [
      '####################################',
      '#..................................#',
      '#..................................#',
      '#..................................#',
      '#..................................#',
      '#..................................#',
      '#..................................#',
      '#..................................#',
      '#............Y..............Y......#',
      '#..................................#',
      '#....a....................L........#',
      '#....EE...................EE....GGG#',
      '#..............................TTTT#',
      '#.................................T#',
      '#.12................Cb..K.R.......T#',
      '#########ww##ww##ww#################',
      '####################################',
    ],
    links: { Y0: ['a', 'b'], Y1: ['L'], R0: ['L'] },
    lamps: [{ r: 330 }, { r: 300 }],
    robots: [{ from: 22, to: 30, dock: 22 }],
    hints: [
      { tx: 1.4, ty: 8.4, text: 'mati lampu! cuma kelihatan sekitar sendiri' },
      { tx: 1.4, ty: 9.2, text: 'ada lampu yang bisa dinyalain…' },
    ],
  },
];
