import {
  fetchUpstreamItems,
  findUpstreamByShortCode,
  isAllowedMediaUrl,
  streamFromInstagram,
} from "../lib/ig.js";

/* Video: dipanggil per shortCode (/api/video?id=<shortCode>) supaya URL mp4
   Instagram diambil ulang setiap kali dibuka — URL itu hanya berlaku beberapa jam
   sehingga 403/502 kalau dipakai dari cache. Kalau tetap gagal, halaman detail
   otomatis jatuh ke embed Instagram. */
export default async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.setHeader("Allow", "GET, HEAD");
    return res.status(405).json({ ok: false, error: "method_not_allowed" });
  }

  const q = req.query || {};
  const shortCode = String(Array.isArray(q.id) ? q.id[0] : q.id || "").trim();
  const rawUrl = String(Array.isArray(q.url) ? q.url[0] : q.url || "").trim();

  if (!shortCode && !rawUrl) {
    return res.status(400).json({ ok: false, error: "parameter_kosong" });
  }

  if (rawUrl && !isAllowedMediaUrl(rawUrl)) {
    return res.status(400).json({ ok: false, error: "url_tidak_diizinkan" });
  }

  res.setHeader("Cache-Control", "public, max-age=300, s-maxage=3600");
  res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Accept-Ranges", "bytes");

  try {
    let target = rawUrl;

    if (shortCode) {
      const found = findUpstreamByShortCode(shortCode, await fetchUpstreamItems());
      const fresh = found && found.is_video ? found.video_url : "";

      if (fresh && isAllowedMediaUrl(fresh)) target = fresh;
    }

    if (!target) {
      return res.status(404).json({
        ok: false,
        error: "video_tidak_ditemukan",
        hint: "pakai embed Instagram",
      });
    }

    const result = await streamFromInstagram(target, req, res);

    if (result.body) return res.status(result.status).json(result.body);

    const { upstream, type } = result;
    const length = upstream.headers.get("content-length");
    const contentRange = upstream.headers.get("content-range");

    res.status(result.status);
    res.setHeader("Content-Type", type);
    if (length) res.setHeader("Content-Length", length);
    if (contentRange) res.setHeader("Content-Range", contentRange);

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