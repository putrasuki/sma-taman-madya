/* Thumbnail Instagram juga punya URL yang kedaluwarsa, jadi lebih aman dipanggil
   per shortCode: /api/thumbnail?id=<shortCode>. Parameter ?url= tetap dipakai
   sebagai cadangan kalau shortCode tidak ada. */
const { fetchUpstreamItems, findUpstreamByShortCode, isAllowedMediaUrl, streamFromInstagram } =
  require("../lib/ig.js");

module.exports = async function handler(req, res) {
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

  res.setHeader("Cache-Control", "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400");
  res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
  res.setHeader("X-Content-Type-Options", "nosniff");

  try {
    let target = rawUrl;

    if (shortCode) {
      const found = findUpstreamByShortCode(shortCode, await fetchUpstreamItems());
      const fresh = found && (found.thumbnail_url || (Array.isArray(found.images) ? found.images[0] : ""));

      if (fresh && isAllowedMediaUrl(fresh)) target = fresh;
    }

    if (!target) {
      return res.status(404).json({ ok: false, error: "gambar_tidak_ditemukan" });
    }

    const result = await streamFromInstagram(target, req);

    if (result.body) return res.status(result.status).json(result.body);

    const body = Buffer.from(await result.upstream.arrayBuffer());

    res.setHeader("Content-Type", result.type);
    res.setHeader("Content-Length", String(body.length));
    return res.status(200).send(body);
  } catch (error) {
    return res.status(502).json({
      ok: false,
      error: "gagal_mengambil",
      detail: String(error.message || error),
    });
  }
};