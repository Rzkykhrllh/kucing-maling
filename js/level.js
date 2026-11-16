// Level 1 — "Ikan di Meja Makan"
// Tiap karakter = 1 tile (32x32 px). Edit peta di sini buat bikin level baru.
//
//  #  tembok / lantai          ~  air (jadi jembatan kalau tombol ditekan)
//  S  sofa (padat)             E  rak dinding (padat)
//  T  meja (padat)             D  pagar (kebuka kalau tuas ON)
//  a  tombol biasa (siapa aja) b  tombol BERAT (cuma Gembul / kardus)
//  L  tuas (sekali sentuh nyala terus)
//  K  kardus (bisa didorong Gembul)
//  G  area ikan (dua kucing harus di sini)
//  1  start Gembul (kucing gede)   2  start Mochi (kucing kecil)

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
];
