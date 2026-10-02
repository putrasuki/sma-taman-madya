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
    likes: Number(item.likes) || 0,
    postedAt: item.posted_at,
    postUrl: item.post_url || `https://www.instagram.com/p/${item.short_code}/`,
  };
}

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", `s-maxage=${CACHE_SECONDS}, stale-while-revalidate=86400`);
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  try {
    const upstream = await fetch(UPSTREAM, {
      headers: { Accept: "application/json" },
    });

    if (!upstream.ok) {
      throw new Error(`upstream status ${upstream.status}`);
    }

    const payload = await upstream.json();
    const items = (Array.isArray(payload.data) ? payload.data : []).map(normalise);

    /* ---- Mode detail: /api/berita?id=<shortCode> ---- */
    const rawId = Array.isArray(req.query.id) ? req.query.id[0] : req.query.id;
    if (rawId) {
      const needle = String(rawId).trim();
      const found = items.find(
        (item) => item.shortCode === needle || item.id === needle
      );

      if (!found) {
        return res.status(404).json({ ok: false, error: "berita_tidak_ditemukan", item: null });
      }

      const position = items.indexOf(found);
      return res.status(200).json({
        ok: true,
        updatedAt: new Date().toISOString(),
        item: found,
        prev: position > 0 ? items[position - 1] : null,
        next: position < items.length - 1 ? items[position + 1] : null,
        total: items.length,
      });
    }

    /* ---- Mode daftar ---- */
    return res.status(200).json({
      ok: true,
      updatedAt: new Date().toISOString(),
      items,
    });
  } catch (error) {
    return res.status(200).json({
      ok: false,
      error: String(error.message || error),
      items: [],
      item: null,
    });
  }
};