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
| `img/hero-bg.jpg` | Foto utama (dipakai sebagai background hero via CSS) |
| `img/*.svg` | Aset cadangan: avatar, post, kegiatan, gedung |

## Berita

Kartu berita **tidak disimpan di HTML**. `js/berita.js` mengambil data terbaru dari
`api/berita.js` (proxy ke API Instagram) dan merender semuanya; tidak ada batas jumlah
kartu. Selama dimuat, muncul skeleton shimmer; kalau API gagal, muncul pesan error
beserta tombol "Muat ulang".

`img/berita/berita-1.jpg` hanya dipakai sebagai gambar cadangan kalau `/api/thumbnail`
gagal mengembalikan thumbnail.

Feed berita butuh fungsi server `api/berita.js`, jadi saat mencoba lokal harus memakai
server Vercel (CLI sudah terpasang):

```bash
npx vercel dev
```

Kalau hanya/static server biasa (atau `file://`), section berita menampilkan kartu
error: "Halaman ini dibuka tanpa server, jadi /api/berita tidak tersedia." beserta
tombol "Muat ulang" dan tautan Instagram.

> Catatan: 4 gambar di section galeri masih placeholder, di-inline sebagai `data:` URI di dalam `index.html`. Ganti dengan foto asli kalau sudah tersedia.
