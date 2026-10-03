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

`index.html` memuat 6 kartu berita statis sebagai fallback. Di server, `js/berita.js`
menggantinya dengan data terbaru dari `api/berita.js` (proxy Instagram).

Kalau fallback perlu disegarkan: unduh thumbnail terbaru lewat
`/api/thumbnail?url=<thumbnail_url>` ke `img/berita/berita-N.jpg`, lalu perbarui
judul, tanggal, jumlah suka, dan `?id=<shortCode>` di `index.html`.

> Catatan: 4 gambar di section galeri masih placeholder, di-inline sebagai `data:` URI di dalam `index.html`. Ganti dengan foto asli kalau sudah tersedia.
