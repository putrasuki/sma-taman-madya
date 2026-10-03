/* Daftar berita SMA Taman Madya Jetis.

   Sumber data utama adalah file kurasi sekolah (data/berita.json, diturunkan
   dari "Daftar berita sma taman madya jetis.docx"). File itu yang menentukan
   berita mana yang tampil, urutannya, dan kategori section-nya. Feed API
   Instagram hanya dipakai sebagai sumber tambahan: foto, jumlah suka, dan
   tanggal unggah.

   Kenapa feed API tidak dipakai sebagai daftar utama? Feed Instagram hanya
   mengembalikan 12 post terbaru, sehingga berita lama yang masih relevan
   hilang dari situs. Dengan file kurasi sebagai acuan, ke-20 berita sekolah
   tetap punya alamat (berita.html?id=...).

   Foto Instagram hanya berlaku beberapa jam (parameter `oe` di URL-nya).
   Karena itu /api/thumbnail me-resolve ulang URL dari upstream tiap
   permintaan, bukan memakai URL yang tersimpan di respons ini.

   Ditulis CommonJS karena repo ini tidak punya package.json, dan Vercel
   memakai bundler bawaan yang membaca require() tanpa konfigurasi tambahan. */
const KATALOG = require("../data/berita.json");
const { fetchUpstreamItems } = require("../lib/ig.js");

const CACHE_SECONDS = 60 * 30;

const proxyThumb = (shortCode) => `/api/thumbnail?id=${encodeURIComponent(shortCode)}`;

function plainText(caption) {
  if (typeof caption !== "string") return "";
  return caption
    .replace(/\r/g, "")
    .replace(/[*_`#>]/g, "")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

/* Satu berita = satu baris file kurasi, ditambah data dari feed API bila
   postnya masih ada di sana. */
function gabung(upstreamItems) {
  const byCode = new Map();
  for (const item of upstreamItems) {
    if (item && item.short_code) byCode.set(item.short_code, item);
  }

  return KATALOG.items.map((row) => {
    const up = byCode.get(row.shortCode) || null;
    const thumbnail = up ? up.thumbnail_url || (Array.isArray(up.images) ? up.images[0] : "") || "" : "";
    const fotoLokal = row.fotoLokal || "";

    /* Foto yang benar-benar bisa ditampilkan: file lokal, atau thumbnail dari
       post yang masih ada di feed. Cover kategori hanya jaring pengaman, bukan
       gambar utama — itu sebabnya berita tanpa foto tidak ikut tampil. */
    const srcGambar = fotoLokal || (thumbnail ? proxyThumb(row.shortCode) : "");

    return {
      urutan: row.urutan,
      shortCode: row.shortCode,
      id: row.shortCode,
      type: row.tipe === "post" ? "image" : "reel" ? "video" : "image",
      isVideo: row.tipe === "reel",
      title: row.judul,
      subJudul: row.subJudul || "",
      text: plainText(row.ringkas || row.judul),
      hashtags: [],
      kategori: row.kategori,
      kategoriLabel: row.kategoriLabel,
      cover: row.cover || "",
      fotoLokal,
      srcGambar,
      punyaFoto: Boolean(srcGambar),
      thumbnail: "",
      videoUrl: up && up.is_video ? up.video_url || "" : "",
      likes: up ? Number(up.likes) || 0 : 0,
      postedAt: up && up.posted_at ? up.posted_at : "",
      postUrl: row.url,
      diFeed: Boolean(up),
    };
  });
}

const handler = async (req, res) => {
  const okCache = `s-maxage=${CACHE_SECONDS}, stale-while-revalidate=86400`;
  const noStore = "no-store";

  /* Respons gagal tidak boleh di-cache CDN, supaya pengunjung berikutnya
     selalu mencoba ulang alih-alih menerima error yang sama. */
  const send = (status, body, cacheControl) => {
    res.setHeader("Cache-Control", cacheControl);
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    return res.status(status).json(body);
  };

  try {
    let items;
    let upstreamOk = true;

    try {
      items = gabung(await fetchUpstreamItems());
    } catch (error) {
      /* Feed Instagram bermasalah: file kurasi sekolah tetap bisa dipakai.
         Foto lokal tetap tampil karena tidak bergantung pada feed. */
      upstreamOk = false;
      items = gabung([]);
      process.stderr.write(`[api/berita] upstream gagal: ${error.message}\n`);
    }

    if (!items.length) {
      return send(
        200,
        { ok: false, error: "tidak_ada_berita", updatedAt: new Date().toISOString(), items: [], item: null },
        noStore
      );
    }

    /* ---- Mode detail: /api/berita?id=<shortCode> ---- */
    const rawId = Array.isArray(req.query.id) ? req.query.id[0] : req.query.id;
    if (rawId) {
      const needle = String(rawId).trim();
      const found = items.find((item) => item.shortCode === needle || item.id === needle);

      if (!found) {
        return send(404, { ok: false, error: "berita_tidak_ditemukan", item: null }, noStore);
      }

      const position = items.indexOf(found);
      return send(
        200,
        {
          ok: true,
          upstream: upstreamOk,
          updatedAt: new Date().toISOString(),
          item: found,
          prev: position > 0 ? items[position - 1] : null,
          next: position < items.length - 1 ? items[position + 1] : null,
          total: items.length,
        },
        okCache
      );
    }

    /* ---- Mode daftar ---- */
    return send(
      200,
      {
        ok: true,
        upstream: upstreamOk,
        updatedAt: new Date().toISOString(),
        total: items.length,
        denganFoto: items.filter((item) => item.punyaFoto).length,
        dariFeed: items.filter((item) => item.diFeed).length,
        fotoLokal: items.filter((item) => item.fotoLokal).length,
        items,
      },
      okCache
    );
  } catch (error) {
    return send(200, { ok: false, error: String(error.message || error), items: [], item: null }, noStore);
  }
};

module.exports = handler;