const ALLOWED_HOSTS = ["cdninstagram.com", "fbcdn.net"];

const UPSTREAM =
  "https://api-ig-ruddy.vercel.app/api/berita/sekolah/tamanmadyajetisyogya1956";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36";

const isAllowed = (raw) => {
  try {
    const u = new URL(raw);
    if (u.protocol !== "https:") return false;
    const host = u.hostname.toLowerCase();
    return ALLOWED_HOSTS.some((d) => host === d || host.endsWith(`.${d}`));
  } catch {
    return false;
  }
};

/* URL mp4 Instagram hanya berlaku beberapa jam (parameter `oe`), jadi jangan
  andalkan URL yang sudah ikut ter-cache di /api/berita. Ambil ulang dari
   upstream setiap kali video benar-benar dibuka. */
const freshVideoUrl = async (shortCode) => {
  const upstream = await fetch(UPSTREAM, {
    headers: { Accept: "application/json", "Cache-Control": "no-cache" },
  });

  if (!upstream.ok) throw new Error(`upstream status ${upstream.status}`);

  const payload = await upstream.json();
  const items = Array.isArray(payload.data) ? payload.data : [];
  const found = items.find((item) => item && item.short_code === shortCode);

  if (!found || !found.is_video || !found.video_url) return "";
  return String(found.video_url);
};

export default async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.setHeader("Allow", "GET, HEAD");
    return res.status(405).json({ ok: false, error: "method_not_allowed" });
  }

  const q = req.query || {};
  const shortCode = String(Array.isArray(q.id) ? q.id[0] : q.id || "").trim();
  const raw = String(Array.isArray(q.url) ? q.url[0] : q.url || "").trim();

  if (!shortCode && !raw) {
    return res.status(400).json({ ok: false, error: "parameter_kosong" });
  }

  /* Teruskan Range supaya <video> bisa streaming & di-sek. */
  const headers = {
    Referer: "https://www.instagram.com/",
    "User-Agent": UA,
    Accept: "video/*,*/*;q=0.8",
  };
  const range = req.headers.range;
  if (range) headers.Range = range;

  try {
    const target = shortCode ? await freshVideoUrl(shortCode) : raw;

    if (!target) {
      return res.status(404).json({
        ok: false,
        error: "video_tidak_ditemukan",
        hint: "pakai embed Instagram",
      });
    }

    if (!isAllowed(target)) {
      return res.status(400).json({ ok: false, error: "url_tidak_diizinkan" });
    }

    const upstream = await fetch(target, { headers, redirect: "follow" });

    if (!upstream.ok && upstream.status !== 206) {
      return res.status(502).json({
        ok: false,
        error: "video_tidak_tersedia",
        status: upstream.status,
        hint: "URL Instagram kedaluwarsa, pakai embed",
      });
    }

    const type = (upstream.headers.get("content-type") || "").split(";")[0].trim();
    const length = upstream.headers.get("content-length");
    const contentRange = upstream.headers.get("content-range");

    /* Jaga-jaga: jangan pernah kirim HTML/JSON pretending video. */
    if (!type.startsWith("video/") && !type.startsWith("application/octet-stream")) {
      return res.status(502).json({ ok: false, error: "tipe_bukan_video", type });
    }

    res.status(upstream.status);
    res.setHeader("Content-Type", type);
    if (length) res.setHeader("Content-Length", length);
    if (contentRange) res.setHeader("Content-Range", contentRange);
    res.setHeader("Accept-Ranges", "bytes");
    res.setHeader("Cache-Control", "public, max-age=300, s-maxage=3600");
    res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
    res.setHeader("X-Content-Type-Options", "nosniff");

    if (req.method === "HEAD") return res.end();

    const body = Buffer.from(await upstream.arrayBuffer());
    return res.end(body);
  } catch (error) {
    return res.status(502).json({
      ok: false,
      error: "gagal_mengambil",
      detail: String(error.message || error),
    });
  }
}