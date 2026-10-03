/* Helper bersama untuk semua proxy Instagram (api/berita.js, api/thumbnail.js,
   api/video.js).

   Dua hal yang sering membuat website error, diurus di satu tempat:

   1. URL media Instagram (thumbnail & mp4) hanya berlaku beberapa jam — parameter
      `oe` di URL-nya adalah waktu kedaluwarsa. Kalau URL-nya ikut ter-cache, proxy
      membalas 403/502 padahal datanya masih valid. Karena itu proxy media
      me-resolve ulang URL dari upstream pada setiap permintaan, bukan memakai URL
      yang tersimpan di respons /api/berita.
   2. Hanya host CDN resmi Instagram yang boleh diteruskan, supaya endpoint ini
      tidak jadi open proxy.

   Ditulis sebagai CommonJS supaya bisa di-require dari api/ tanpa masalah
   bundler di Vercel. */

const UPSTREAM_URL =
  "https://api-ig-ruddy.vercel.app/api/berita/sekolah/tamanmadyajetisyogya1956";

const ALLOWED_HOSTS = ["cdninstagram.com", "fbcdn.net"];

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36";

const HEADERS = {
  Referer: "https://www.instagram.com/",
  "User-Agent": UA,
};

function isAllowedMediaUrl(raw) {
  try {
    const u = new URL(raw);
    if (u.protocol !== "https:") return false;
    const host = u.hostname.toLowerCase();
    return ALLOWED_HOSTS.some((d) => host === d || host.endsWith(`.${d}`));
  } catch {
    return false;
  }
}

/* Ambil data mentah upstream. Sengaja tanpa cache supaya video/thumbnail
   selalu dapat URL yang masih berlaku. */
async function fetchUpstreamItems() {
  const res = await fetch(UPSTREAM_URL, {
    headers: { Accept: "application/json", "Cache-Control": "no-cache" },
  });

  if (!res.ok) throw new Error(`upstream status ${res.status}`);

  const payload = await res.json();
  const items = Array.isArray(payload.data) ? payload.data : [];

  if (!items.length) throw new Error("upstream kosong");
  return items;
}

function findUpstreamByShortCode(shortCode, items) {
  return items.find((item) => item && item.short_code === shortCode) || null;
}

/* Teruskan media dari CDN Instagram, teruskan Range supaya <video> bisa di-sek.
   Balik { body } kalau gagal, { upstream, type } kalau boleh dikirim. */
async function streamFromInstagram(rawUrl, req) {
  if (!isAllowedMediaUrl(rawUrl)) {
    return { status: 400, body: { ok: false, error: "url_tidak_diizinkan" } };
  }

  const headers = { ...HEADERS, Accept: "*/*" };
  if (req.headers && req.headers.range) headers.Range = req.headers.range;

  const upstream = await fetch(rawUrl, { headers, redirect: "follow" });

  if (!upstream.ok && upstream.status !== 206) {
    return {
      status: 502,
      body: {
        ok: false,
        error: "media_tidak_tersedia",
        status: upstream.status,
        hint: "URL Instagram kedaluwarsa, pakai embed",
      },
    };
  }

  const type = (upstream.headers.get("content-type") || "").split(";")[0].trim();

  /* Jaga-jaga: jangan pernah kirim HTML/JSON yang dipura-pura jadi media. */
  if (type.startsWith("text/") || type.includes("json") || type.includes("html") || !type) {
    return { status: 502, body: { ok: false, error: "tipe_bukan_media", type } };
  }

  return { status: upstream.status, upstream, type };
}

module.exports = {
  UPSTREAM_URL,
  isAllowedMediaUrl,
  fetchUpstreamItems,
  findUpstreamByShortCode,
  streamFromInstagram,
};