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
| `assets/css/styles.css` | Styling & layout |
| `assets/js/main.js` | Navigasi mobile, scroll reveal, active section |
| `assets/img/*.svg` | Placeholder gambar — **ganti dengan foto asli** |

> Catatan: gambar di `assets/img/` masih placeholder SVG. Ganti dengan foto asli (format `.webp` atau `.jpg`, lalu sesuaikan path di `index.html`) agar situs tampil final.
