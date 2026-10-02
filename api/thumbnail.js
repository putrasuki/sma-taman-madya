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
  res.setHeader("Cache-Control", "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400");

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ ok: false, error: "method_not_allowed" });
  }

  const raw = Array.isArray(req.query.url) ? req.query.url[0] : req.query.url;
  if (!raw || !isAllowed(raw)) {
    return res.status(400).json({ ok: false, error: "url_tidak_diizinkan" });
  }

  try {
    const upstream = await fetch(raw, {
      headers: { Referer: "https://www.instagram.com/", "User-Agent": UA, Accept: "image/*,*/*;q=0.8" },
      redirect: "follow",
    });

    const type = (upstream.headers.get("content-type") || "").split(";")[0].trim();
    if (!upstream.ok || !type.startsWith("image/")) {
      return res.status(502).json({ ok: false, error: "gambar_tidak_tersedia", status: upstream.status });
    }

    const body = Buffer.from(await upstream.arrayBuffer());

    res.setHeader("Content-Type", type);
    res.setHeader("Content-Length", String(body.length));
    res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
    res.setHeader("X-Content-Type-Options", "nosniff");
    return res.status(200).send(body);
  } catch {
    return res.status(502).json({ ok: false, error: "gagal_mengambil" });
  }
}