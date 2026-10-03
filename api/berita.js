const KATALOG = require("../data/berita.json");

const UPSTREAM =
  "https://api-ig-ruddy.vercel.app/api/berita/sekolah/tamanmadyajetisyogya1956";

const CACHE_SECONDS = 60 * 30;

function plainText(caption) {
  if (typeof caption !== "string") return "";
  return caption
    .replace(/\r/g, "")
    .replace(/[*_`#>]/g, "")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

function normalise(item) {
  const text = plainText(item.caption);
  return {
    id: String(item.id),
    shortCode: item.short_code,
    type: item.is_video ? "video" : "image",
    isVideo: Boolean(item.is_video),
    text,
    hashtags: Array.isArray(item.hashtags) ? item.hashtags : [],
    thumbnail: item.thumbnail_url || (Array.isArray(item.images) ? item.images[0] : "") || "",
    cover: "",
    videoUrl: item.is_video ? item.video_url || "" : "",
    likes: Number(item.likes) || 0,
    postedAt: item.posted_at,
    postUrl: item.post_url || `https://www.instagram.com/p/${item.short_code}/`,
  };
}

/* Katalog lokal (data/berita.json) berisi berita yang belum ada di API Instagram.
   API tetap jadi sumber thumbnail, jumlah suka, dan video; katalog lokal menambah
   judul rapi, kategori, dan berita yang belum ter-scrape. */
function dariKatalog(row) {
  return {
    id: `lokal-${row.shortCode}`,
    shortCode: row.shortCode,
    type: row.tipe === "post" ? "image" : row.tipe === "info" ? "info" : "video",
    isVideo: row.tipe === "reel",
    text: row.ringkas || row.judul,
    hashtags: [],
    thumbnail: "",
    cover: row.cover,
    videoUrl: "",
    likes: 0,
    postedAt: row.tanggal,
    postUrl: row.url,
  };
}

function gabung(apiItems) {
  const map = new Map(apiItems.map((item) => [item.shortCode, { ...item, sumber: "api" }]));

  KATALOG.forEach((row) => {
    const ada = map.get(row.shortCode);

    if (ada) {
      ada.kategori = row.kategori;
      ada.kategoriLabel = row.kategoriLabel;
      ada.cover = row.cover;
      ada.judulKurasi = row.judul;
      return;
    }

    map.set(row.shortCode, { ...dariKatalog(row), sumber: "katalog", kategori: row.kategori, kategoriLabel: row.kategoriLabel, judulKurasi: row.judul });
  });

  return [...map.values()].sort(
    (a, b) => new Date(b.postedAt).getTime() - new Date(a.postedAt).getTime()
  );
}

module.exports = async function handler(req, res) {
  const okCache = `s-maxage=${CACHE_SECONDS}, stale-while-revalidate=86400`;

  /* Respons gagal tidak boleh di-cache CDN, supaya pengunjung berikutnya
     selalu mencoba ulang ke upstream alih-alih menerima error yang sama. */
  const send = (status, body, cacheControl) => {
    res.setHeader("Cache-Control", cacheControl);
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    return res.status(status).json(body);
  };

  try {
    const upstream = await fetch(UPSTREAM, {
      headers: { Accept: "application/json" },
    });

    if (!upstream.ok) {
      throw new Error(`upstream status ${upstream.status}`);
    }

    const payload = await upstream.json();
    const items = gabung((Array.isArray(payload.data) ? payload.data : []).map(normalise));

    if (!items.length) {
      return send(
        200,
        {
          ok: false,
          error: "upstream_kosong",
          updatedAt: new Date().toISOString(),
          items: [],
          item: null,
        },
        "no-store"
      );
    }

    /* ---- Mode detail: /api/berita?id=<shortCode> ---- */
    const rawId = Array.isArray(req.query.id) ? req.query.id[0] : req.query.id;
    if (rawId) {
      const needle = String(rawId).trim();
      const found = items.find(
        (item) => item.shortCode === needle || item.id === needle
      );

      if (!found) {
        return send(
          404,
          { ok: false, error: "berita_tidak_ditemukan", item: null },
          "no-store"
        );
      }

      const position = items.indexOf(found);
      return send(
        200,
        {
          ok: true,
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
        updatedAt: new Date().toISOString(),
        total: items.length,
        dariApi: items.filter((item) => item.sumber === "api").length,
        dariKatalog: items.filter((item) => item.sumber === "katalog").length,
        items,
      },
      okCache
    );
  } catch (error) {
    return send(
      200,
      {
        ok: false,
        error: String(error.message || error),
        items: [],
        item: null,
      },
      "no-store"
    );
  }
};
