const ALLOWED_HOSTS = ["cdninstagram.com", "fbcdn.net"];

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

export default async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.setHeader("Allow", "GET, HEAD");
    return res.status(405).json({ ok: false, error: "method_not_allowed" });
  }

  const raw = Array.isArray(req.query.url) ? req.query.url[0] : req.query.url;
  if (!raw || !isAllowed(raw)) {
    return res.status(400).json({ ok: false, error: "url_tidak_diizinkan" });
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
    const upstream = await fetch(raw, { headers, redirect: "follow" });

    if (!upstream.ok && upstream.status !== 206) {
      return res.status(502).json({
        ok: false,
        error: "video_tidak_tersedia",
        status: upstream.status,
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
  } catch {
    return res.status(502).json({ ok: false, error: "gagal_mengambil" });
  }
}