(() => {
  "use strict";

  const ENDPOINT = "/api/berita";

  const MONTHS = [
    "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember",
  ];

  const formatDate = (iso) => {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
  };

  const formatLikes = (n) =>
    n >= 1000 ? `${(n / 1000).toFixed(1).replace(/\.0$/, "")}rb` : String(n);

  /* Judul pendek untuk kartu & navigasi. Teks lengkap tetap dipakai di halaman detail. */
  const shortTitle = (text) => {
    const clean = String(text || "").replace(/\s+#[\p{L}\p{N}_]+/gu, "").trim();
    if (!clean) return "Kabar sekolah";
    const words = clean.split(" ");
    return words.length <= 14 ? clean : `${words.slice(0, 14).join(" ")}…`;
  };

  /* Pecah caption jadi paragraf dan sisipkan hashtag sebagai tag. */
  const buildContent = (target, text) => {
    const raw = String(text || "").trim();
    if (!raw) {
      target.replaceChildren();
      return;
    }

    const paragraphs = raw.split(/\n+/).map((p) => p.trim()).filter(Boolean);

    target.replaceChildren(
      ...paragraphs.map((para) => {
        const p = document.createElement("p");
        p.className = "berita-detail-text";

        const parts = para.split(/(#[\p{L}\p{N}_]+)/gu);
        parts.forEach((part) => {
          if (!part) return;
          if (part.startsWith("#")) {
            const span = document.createElement("span");
            span.className = "berita-tag";
            span.textContent = part;
            p.appendChild(span);
          } else {
            p.appendChild(document.createTextNode(part));
          }
        });

        return p;
      })
    );
  };

  const coverOf = (item) => item.cover || "/img/berita/cover-berita.svg";

  /* Judul bersih dari file kurasi sekolah. Caption Instagram hanya dipakai
     cadangan kalau judulnya belum diisi. */
  const judulOf = (item) =>
    (item.title || item.judulKurasi || shortTitle(item.text || "")).trim();

  /* Foto utama berita. File lokal (fotoLokal) dipakai lebih dulu; kalau postnya
     masih ada di feed Instagram, fotonya diambil lewat proxy /api/thumbnail
     supaya URL-nya selalu yang terbaru. Cover kategori hanya jaring pengaman. */
  const thumbUrl = (item) => {
    if (item.fotoLokal) return item.fotoLokal;
    if (item.srcGambar) return item.srcGambar;
    return coverOf(item);
  };

  /* Hanya shortCode Instagram asli yang boleh dipakai untuk proxy & embed.
     Semua shortCode di data/berita.json berasal dari file kurasi sekolah, jadi
     ini hanya penjaga agar shortCode karangan tidak pernah diteruskan. */
  const hasRealShortCode = (item) =>
    typeof item.shortCode === "string" && /^[A-Za-z0-9_-]{8,}$/.test(item.shortCode);

  /* Proxy video lebih aman kalau dipanggil per shortCode: /api/video?id=...
     mengambil ulang URL mp4 dari upstream, jadi tidak ikut basi saat cache. */
  const videoProxyUrl = (item) =>
    hasRealShortCode(item)
      ? `/api/video?id=${encodeURIComponent(item.shortCode)}`
      : `/api/video?url=${encodeURIComponent(item.videoUrl)}`;

  /* Cadangan terakhir: embed resmi Instagram (mp4 bisa kedaluwarsa). */
  const embedUrl = (item) =>
    hasRealShortCode(item)
      ? `https://www.instagram.com/p/${encodeURIComponent(item.shortCode)}/embed/captioned/`
      : "";

  const removeEmbed = () => {
    const frame = document.querySelector("[data-detail-embed]");
    if (frame) frame.remove();
  };

  const showEmbed = (item) => {
    removeEmbed();

    videoEl.hidden = true;
    videoEl.removeAttribute("src");
    imageEl.hidden = true;

    const wrap = document.createElement("div");
    wrap.className = "berita-embed";
    wrap.setAttribute("data-detail-embed", "");

    const iframe = document.createElement("iframe");
    iframe.setAttribute("src", embedUrl(item));
    iframe.setAttribute("title", `Instagram: ${judulOf(item)}`);
    iframe.setAttribute("loading", "lazy");
    iframe.setAttribute("allow", "autoplay; encrypted-media; picture-in-picture");
    iframe.setAttribute("allowfullscreen", "");
    wrap.appendChild(iframe);

    const note = document.createElement("p");
    note.className = "berita-embed-note";
    note.textContent =
      "Video dimuat langsung dari Instagram. Jika tidak muncul, buka lewat tombol “Lihat di Instagram”.";
    wrap.appendChild(note);

    /* Sisipkan sebelum <figcaption> supaya urutannya tetap
       media → catatan → caption, sama seperti video & gambar. */
    if (figureEl) {
      figureEl.insertBefore(wrap, figureEl.querySelector("figcaption") || null);
    }
  };

  /* ---------- Elemen ---------- */
  const figureEl = document.querySelector(".berita-detail-figure");
  const statusEl = document.querySelector("[data-detail-status]");
  const bodyEl = document.querySelector("[data-detail-body]");
  const errorEl = document.querySelector("[data-detail-error]");
  const errorText = document.querySelector("[data-detail-error-text]");
  const metaEl = document.querySelector("[data-detail-meta]");
  const titleEl = document.querySelector("[data-detail-title]");
  const tagsEl = document.querySelector("[data-detail-tags]");
  const imageEl = document.querySelector("[data-detail-image]");
  const videoEl = document.querySelector("[data-detail-video]");
  const captionEl = document.querySelector("[data-detail-caption]");
  const igEl = document.querySelector("[data-detail-ig]");
  const navEl = document.querySelector("[data-detail-nav]");
  const prevEl = document.querySelector("[data-detail-prev]");
  const nextEl = document.querySelector("[data-detail-next]");
  const prevTitle = document.querySelector("[data-detail-prev-title]");
  const nextTitle = document.querySelector("[data-detail-next-title]");

  const crumbParts = document.querySelectorAll("[data-detail-crumb]");
  const crumbCurrent = document.querySelector(".breadcrumb-current");

  const showError = (message) => {
    if (statusEl) statusEl.hidden = true;
    if (bodyEl) bodyEl.hidden = true;
    if (errorEl) errorEl.hidden = false;
    if (errorText && message) errorText.textContent = message;
    if (crumbCurrent) crumbCurrent.textContent = "Tidak ditemukan";
  };

  const setMeta = (item) => {
    const title = shortTitle(item.text);
    const pageTitle = `${title} — Berita SMA Taman Madya Jetis`;
    document.title = pageTitle;

    const desc = document.querySelector('meta[name="description"]');
    if (desc && item.text) desc.setAttribute("content", item.text.slice(0, 180));

    const ogTitle = document.querySelector('meta[property="og:title"]');
    if (ogTitle) ogTitle.setAttribute("content", pageTitle);

    const ogDesc = document.querySelector('meta[property="og:description"]');
    if (ogDesc && item.text) ogDesc.setAttribute("content", item.text.slice(0, 180));

    crumbParts.forEach((el) => { el.hidden = false; });
    if (crumbCurrent) crumbCurrent.textContent = title;
  };

  const render = (payload) => {
    const item = payload.item;
    if (!item) {
      showError();
      return;
    }

    setMeta(item);

    if (statusEl) statusEl.hidden = true;
    if (errorEl) errorEl.hidden = true;
    if (bodyEl) bodyEl.hidden = false;

    metaEl.textContent = [
      item.isVideo ? "Video" : "Foto",
      formatDate(item.postedAt),
      item.likes ? `${formatLikes(item.likes)} suka` : "",
    ]
      .filter(Boolean)
      .join(" · ");

    titleEl.textContent = judulOf(item);

    const poster = thumbUrl(item);

    const showImage = () => {
      removeEmbed();
      videoEl.hidden = true;
      videoEl.removeAttribute("src");
      imageEl.hidden = false;
      imageEl.src = poster;
      imageEl.alt = judulOf(item);
      imageEl.addEventListener(
        "error",
        () => {
          imageEl.src = coverOf(item);
        },
        { once: true }
      );
    };

    /* Video: coba <video> dari proxy; kalau mp4 Instagram sudah kedaluwarsa
       (502/403), otomatis ganti ke embed Instagram agar tetap bisa dibuka. */
    const bisaStream =
      item.isVideo && hasRealShortCode(item) && Boolean(item.videoUrl || item.diFeed);

    if (bisaStream) {
      removeEmbed();
      videoEl.poster = poster;
      videoEl.hidden = false;
      imageEl.hidden = true;

      /* Samakan rasio kotak dengan rasio video aslinya supaya tidak ada
         bingkai kosong di samping/bawah. */
      videoEl.addEventListener(
        "loadedmetadata",
        () => {
          if (videoEl.videoWidth && videoEl.videoHeight) {
            videoEl.style.aspectRatio = `${videoEl.videoWidth} / ${videoEl.videoHeight}`;
          }
        },
        { once: true }
      );

      videoEl.addEventListener(
        "error",
        () => {
          if (embedUrl(item)) showEmbed(item);
        },
        { once: true }
      );

      videoEl.src = videoProxyUrl(item);
    } else if (item.isVideo && embedUrl(item) && !item.srcGambar) {
      /* Reel tanpa foto (mis. post lama yang sudah tidak ada di feed API):
         tidak ada yang bisa ditampilkan sebagai sampul, jadi pakai embed. */
      showEmbed(item);
    } else {
      /* Reel yang fotonya masih ada: tampilkan fotonya. Embed Instagram
         sudah dipakai sebagai tombol "Lihat di Instagram" di bawah. */
      showImage();
    }

    const full = String(item.text || "").trim();

    let articleBody = document.querySelector("[data-detail-text]");
    if (!articleBody) {
      articleBody = document.createElement("div");
      articleBody.className = "berita-detail-body";
      articleBody.setAttribute("data-detail-text", "");
      imageEl.closest(".berita-detail-figure").insertAdjacentElement("afterend", articleBody);
    }
    buildContent(articleBody, full);

    if (full) {
      captionEl.textContent = full.length > 240 ? `${full.slice(0, 240).trim()}…` : full;
      captionEl.hidden = false;
    } else {
      captionEl.hidden = true;
    }

    igEl.href = item.postUrl;

    const tags = (item.hashtags || []).filter((t) => typeof t === "string" && t.length > 1);
    if (tags.length) {
      tagsEl.replaceChildren(
        ...tags.map((t) => {
          const span = document.createElement("span");
          span.className = "berita-tag";
          span.textContent = t.startsWith("#") ? t : `#${t}`;
          return span;
        })
      );
      tagsEl.hidden = false;
    } else {
      tagsEl.hidden = true;
    }

    /* Navigasi sebelumnya / berikutnya */
    const wire = (link, titleEl2, data) => {
      if (!data) {
        link.hidden = true;
        return;
      }
      link.hidden = false;
      link.href = `berita.html?id=${encodeURIComponent(data.shortCode)}`;
      titleEl2.textContent = shortTitle(data.text);
    };

    wire(prevEl, prevTitle, payload.prev);
    wire(nextEl, nextTitle, payload.next);
    if (navEl) navEl.hidden = !(payload.prev || payload.next);

    document.body.classList.add("berita-ready");
  };

  const load = () => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get("id");

    if (!id) {
      showError("Alamat halaman berita tidak lengkap. Silakan pilih berita dari daftar.");
      return;
    }

    fetch(`${ENDPOINT}?id=${encodeURIComponent(id)}`, {
      headers: { Accept: "application/json" },
    })
      .then((res) => res.json().then((data) => ({ ok: res.ok, data })))
      .then(({ ok, data }) => {
        if (!ok || !data.ok || !data.item) {
          showError();
          return;
        }
        render(data);
      })
      .catch(() => {
        showError("Gagal memuat berita. Periksa koneksi internet Anda lalu coba lagi.");
      });
  };

  load();
})();