# SMA Taman Madya

Website landing page SMA Taman Madya — statis, tanpa build step.

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fputrasuki%2Fsma-taman-madya)

## Deploy

Klik tombol di atas, atau import repo ini langsung di [Vercel](https://vercel.com) (**Add New… → Project**). Tidak ada build command maupun output directory yang perlu diisi.

## Update

```bash
git add -A
git commit -m "pesan perubahan"
git push
```

Vercel otomatis redeploy setiap kali ada push ke branch `main`.

## Struktur

| File | Isi |
| --- | --- |
| `index.html` | Struktur halaman |
| `css/styles.css` | Styling & layout |
| `js/main.js` | Navigasi mobile, scroll reveal, active section, filter galeri fasilitas |
| `js/berita.js` | Render kartu berita dari `/api/berita` |
| `js/berita-detail.js` | Halaman detail `berita.html?id=<shortCode>` |
| `api/berita.js` | Gabungan API Instagram + `data/berita.json` |
| `data/berita.json` | Katalog berita kurasi sekolah (lihat bagian Berita) |
| `img/hero-bg.jpg` | Foto utama (dipakai sebagai background hero via CSS) |
| `img/*.svg` | Aset cadangan: avatar, post, kegiatan, gedung |

## Berita

Kartu berita **tidak disimpan di HTML**. `js/berita.js` mengambil `/api/berita` dan
merender semuanya; tidak ada batas jumlah kartu. Selama dimuat muncul skeleton
shimmer, dengan percobaan ulang otomatis 3×; kalau tetap gagal muncul kartu error
beserta tombol "Muat ulang".

`api/berita.js` menggabungkan dua sumber:

1. **API Instagram** (`api-ig-ruddy.vercel.app`) — dipakai untuk thumbnail, jumlah suka,
   dan URL video. API ini hanya menyediakan **12 berita terbaru**.
2. **`data/berita.json`** — katalog kurasi sekolah berisi 24 berita (MPLS, PPDB,
   ekstrakurikuler, classmeet, kebudayaan, prestasi, berita lainnya) yang belum
   ter-scrape di API. Jumlah, foto, dan urutan ditentukan dari `postedAt`, yang didekode
   dari shortcode Instagram.

Hasil gabungan: **25 berita** (12 dari API + 13 dari katalog). Berita dari katalog belum
punya thumbnail, jadi kartu memakai cover kategori `img/berita/cover-<kategori>.svg`
dan menampilkan badge kategori.

### Video

URL mp4 Instagram hanya berlaku beberapa jam (parameter `oe`), sehingga seringanya 403
dan video tidak bisa diputar. Karena itu halaman detail memanggil
`/api/video?id=<shortCode>` — proxy itu mengambil ulang `video_url` dari upstream setiap
kali video dibuka, bukan memakai URL yang ikut ter-cache di `/api/berita`.

Kalau URL-nya masih kedaluwarsa, proxy membalas 502 dan `js/berita-detail.js` otomatis
mengganti `<video>` dengan embed resmi Instagram (`/p/<shortCode>/embed/captioned/`).
Reel yang hanya ada di katalog (tanpa `video_url`) langsung memakai embed. Tombol
"Lihat di Instagram" selalu tersedia sebagai jalan terakhir.

Menambah berita: append ke `data/berita.json` dengan `shortCode`, `kategori`, `tipe`
(`reel`/`post`/`info`), `judul`, `ringkas`, dan `url`. Tanggal (`tanggal`) boleh diisi
dari shortcode Instagram:

```js
const A = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
let id = 0n;
for (const ch of shortCode) id = id * 64n + BigInt(A.indexOf(ch));
new Date(Number(id >> 23n) + 1314220021721).toISOString();
```

Katalog dibuat dari dokumen "Daftar berita sma taman madya jetis.docx".

Feed berita butuh fungsi server `api/berita.js`, jadi saat mencoba lokal harus memakai
server Vercel (CLI sudah terpasang):

```bash
npx vercel dev
```

Kalau hanya/static server biasa (atau `file://`), section berita menampilkan kartu
error: "Halaman ini dibuka tanpa server, jadi /api/berita tidak tersedia." beserta
tombol "Muat ulang" dan tautan Instagram.

> Catatan: 4 gambar di section galeri masih placeholder, di-inline sebagai `data:` URI di dalam `index.html`. Ganti dengan foto asli kalau sudah tersedia.
