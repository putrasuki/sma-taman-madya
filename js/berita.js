(() => {
  "use strict";

  const ENDPOINT = "/api/berita";
  const MAX_ATTEMPTS = 3;
  const RETRY_DELAYS = [1500, 4000];
  const INSTAGRAM_URL = "https://www.instagram.com/tamanmadyajetisyogya1956/";
  const LOCAL_HINT =
    "Feed berita diambil dari /api/berita. Untuk mencoba di komputer, jalankan `npx vercel dev` — atau cek versi live di sma-taman-madya.vercel.app.";

  const isLocalPreview = () =>
    window.location.protocol === "file:" ||
    /^(localhost|127\.0\.0\.1|\[::1\])$/.test(window.location.hostname);

  const grid = document.querySelector("[data-berita-grid]");
  if (!grid) return;

  const MONTHS = [
    "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember",
  ];

  const formatDate = (iso) => {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
  };

  const splitCaption = (text) => {
    const clean = String(text || "").replace(/\s+#[\p{L}\p{N}_]+/gu, "").trim();
    if (!clean) return { title: "Kabar sekolah", excerpt: "" };
    const words = clean.split(" ");
    if (words.length <= 14) return { title: clean, excerpt: "" };
    return {
      title: `${words.slice(0, 14).join(" ")}…`,
      excerpt: clean.length > 180 ? `${clean.slice(0, 180).trim()}…` : clean,
    };
  };

  const formatLikes = (n) =>
    n >= 1000 ? `${(n / 1000).toFixed(1).replace(/\.0$/, "")}rb` : String(n);

  /* ShortCode karangan (mis. PPDB di katalog lokal) bukan post Instagram,
     jadi tidak boleh dipakai untuk proxy thumbnail. */
  const proxyThumbSrc = (item) => {
    if (!item.thumbnail) return "";
    const shortCodeAsli =
      typeof item.shortCode === "string" && /^[A-Za-z0-9_-]{8,}$/.test(item.shortCode);
    return shortCodeAsli
      ? `/api/thumbnail?id=${encodeURIComponent(item.shortCode)}`
      : `/api/thumbnail?url=${encodeURIComponent(item.thumbnail)}`;
  };

  const createCard = (item) => {
    const { title, excerpt } = splitCaption(item.text);
    const judul = item.judulKurasi || title;
    const fig = document.createElement("article");
    fig.className = "berita-card reveal is-visible";

    /* Kartu tidak lagi membuka halaman detail; foto dan tombolnya mengarah ke
       post asli di Instagram. Halaman detail berita.html tetap bisa dibuka
       langsung, tapi bukan lagi tujuan klik dari daftar. */
    const media = document.createElement("a");
    media.className = "berita-media";
    media.href = item.postUrl;
    media.target = "_blank";
    media.rel = "noopener noreferrer";
    media.setAttribute("aria-label", `Lihat di Instagram: ${judul}`);

    /* Selalu ada gambar: thumbnail dari proxy (kalau ada), kalau gagal turun ke
       cover kategori. Cover kategori juga jadi gambar awal untuk berita yang
       tidak punya thumbnail, sehingga tidak pernah ada kartu kosong. */
    const fallbackCover = item.cover || "/img/berita/cover-berita.svg";

    const img = document.createElement("img");
    img.alt = judul;
    img.loading = "lazy";
    img.decoding = "async";

    const showCover = () => {
      if (img.src.endsWith(fallbackCover)) return;
      img.classList.add("berita-cover");
      img.src = fallbackCover;
    };

    const proxySrc = proxyThumbSrc(item);

    if (proxySrc) {
      img.addEventListener("error", showCover, { once: true });
      img.src = proxySrc;
    } else {
      showCover();
    }

    media.appendChild(img);

    if (item.isVideo) {
      const play = document.createElement("span");
      play.className = "berita-play";
      play.setAttribute("aria-hidden", "true");
      play.innerHTML =
        '<svg viewBox="0 0 24 24" width="22" height="22"><path d="M8 5.5v13l11-6.5z"/></svg>';
      media.appendChild(play);
    }

    if (item.kategoriLabel) {
      const badge = document.createElement("span");
      badge.className = "berita-badge";
      badge.textContent = item.kategoriLabel;
      media.appendChild(badge);
    }

    fig.appendChild(media);

    const body = document.createElement("div");
    body.className = "berita-body";

    const meta = document.createElement("p");
    meta.className = "berita-meta";
    meta.textContent = [
      item.type === "info" ? "Info" : item.isVideo ? "Video" : "Foto",
      formatDate(item.postedAt),
      item.likes ? `${formatLikes(item.likes)} suka` : "",
    ]
      .filter(Boolean)
      .join(" · ");
    body.appendChild(meta);

    const heading = document.createElement("h3");
    heading.textContent = judul;
    body.appendChild(heading);

    if (excerpt && excerpt !== judul) {
      const para = document.createElement("p");
      para.className = "berita-excerpt";
      para.textContent = excerpt;
      body.appendChild(para);
    }

    const link = document.createElement("a");
    link.className = "berita-link";
    link.href = item.postUrl;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = "Lihat di Instagram";
    link.setAttribute("aria-label", `Lihat "${judul}" di Instagram`);
    body.appendChild(link);

    fig.appendChild(body);
    return fig;
  };

  const createSkeleton = () => {
    const fig = document.createElement("article");
    fig.className = "berita-card berita-skeleton";
    fig.setAttribute("aria-hidden", "true");

    const media = document.createElement("span");
    media.className = "berita-media";

    const lines = document.createElement("span");
    lines.className = "berita-skeleton-lines";
    lines.append(
      Object.assign(document.createElement("span"), { className: "berita-skeleton-line" }),
      Object.assign(document.createElement("span"), { className: "berita-skeleton-line" })
    );

    fig.append(media, lines);
    return fig;
  };

  const createError = (message, onRetry, hint) => {
    const fig = document.createElement("article");
    fig.className = "berita-card berita-error";

    const body = document.createElement("div");
    body.className = "berita-body";

    const heading = document.createElement("h3");
    heading.textContent = "Berita belum bisa dimuat";

    const para = document.createElement("p");
    para.className = "berita-excerpt";
    para.textContent = message;

    body.append(heading, para);

    if (hint) {
      const note = document.createElement("p");
      note.className = "berita-hint";
      note.textContent = hint;
      body.appendChild(note);
    }

    const actions = document.createElement("p");
    actions.className = "berita-actions";

    const retry = document.createElement("button");
    retry.type = "button";
    retry.className = "btn btn-ghost btn-sm";
    retry.textContent = "Muat ulang";
    retry.addEventListener("click", onRetry);

    const ig = document.createElement("a");
    ig.className = "btn btn-ghost btn-sm";
    ig.href = INSTAGRAM_URL;
    ig.target = "_blank";
    ig.rel = "noopener noreferrer";
    ig.textContent = "Buka Instagram";

    actions.append(retry, ig);
    body.appendChild(actions);
    fig.appendChild(body);
    return fig;
  };

  const statusEl = document.querySelector("[data-berita-status]");

  const setStatus = (message, warning = false) => {
    if (!statusEl) return;
    statusEl.textContent = message || "";
    statusEl.hidden = !message;
    statusEl.classList.toggle("is-warning", Boolean(warning));
  };

  const showSkeleton = () => {
    const fragment = document.createDocumentFragment();
    for (let i = 0; i < 3; i += 1) fragment.appendChild(createSkeleton());
    grid.replaceChildren(fragment);
    grid.classList.add("is-loading");
  };

  const showError = (message, onRetry, hint) => {
    grid.replaceChildren(createError(message, onRetry, hint));
    grid.classList.remove("is-loading");
  };

  const retryLater = (attempt) => {
    const delay = RETRY_DELAYS[attempt] ?? RETRY_DELAYS[RETRY_DELAYS.length - 1];
    window.setTimeout(() => load(attempt + 1), delay);
  };

  const render = (items, meta) => {
    const fragment = document.createDocumentFragment();
    items.forEach((item) => fragment.appendChild(createCard(item)));
    grid.replaceChildren(fragment);
    grid.classList.remove("is-loading");

    const terbaru = items.length ? formatDate(items[0].postedAt) : "";
    setStatus(
      [
        `${items.length} berita`,
        terbaru ? `terbaru ${terbaru}` : "",
        meta && meta.dariKatalog ? `${meta.dariKatalog} dari katalog sekolah` : "",
        meta && meta.updatedAt ? `diperbarui ${formatDate(meta.updatedAt)}` : "",
      ]
        .filter(Boolean)
        .join(" · ")
    );

    /* Katalog lokal tetap tampil kalau API Instagram sedang bermasalah. */
    if (meta && meta.upstream === false) {
      setStatus(
        `${items.length} berita dari katalog sekolah · Instagram sedang tidak dapat dihubungi`,
        true
      );
    }

    renderPengumuman(items);
  };

  const load = (attempt = 0) => {
    if (attempt === 0) {
      showSkeleton();
      setStatus("");
    } else {
      setStatus(`Memuat ulang berita… (percobaan ${attempt + 1} dari ${MAX_ATTEMPTS})`);
    }

    /* Percobaan ulang memakai query unik supaya respons gagal yang sempat
       tersimpan di cache CDN tidak diambil lagi. */
    const url = attempt === 0 ? ENDPOINT : `${ENDPOINT}?_=${Date.now()}`;

    fetch(url, { headers: { Accept: "application/json" } })
      .then((res) => res.json())
      .then((payload) => {
        if (payload && payload.ok && payload.items.length) {
          render(payload.items, payload);
          return;
        }

        const reason = (payload && payload.error && ` (${payload.error})`) || "";

        if (attempt < MAX_ATTEMPTS - 1) {
          retryLater(attempt);
          return;
        }

        showError(
          `Kabar terbaru belum bisa diambil dari server${reason}. Coba lagi sebentar lagi.`,
          load,
          LOCAL_HINT
        );
        setStatus("Berita gagal dimuat.");
      })
      .catch(() => {
        if (attempt < MAX_ATTEMPTS - 1) {
          retryLater(attempt);
          return;
        }

        showError(
          isLocalPreview()
            ? "Halaman ini dibuka tanpa server, jadi /api/berita tidak tersedia."
            : "Kabar terbaru belum bisa diambil dari server. Periksa koneksi Anda lalu coba lagi.",
          load,
          LOCAL_HINT
        );
        setStatus("Berita gagal dimuat.");
      });
  };

  /* ---------- Pengumuman (section #pengumuman) ----------
     Sebelumnya 3 item hardcode tanpa gambar dan tanpa link, jadi terlihat
     tidak sinkron dengan grid berita. Sekarang diisi dari data yang sama:
     berita bertipe info lebih dulu, lalu berita terbaru lainnya. */
  const pengumumanEl = document.querySelector("[data-pengumuman-list]");

  const renderPengumuman = (items) => {
    if (!pengumumanEl) return;

    /* Pengumuman info (PPDB, dll) didahulukan, lalu dilengkapi berita
       terbaru lain. Shortcode dipakai sebagai kunci agar satu berita
       tidak tampil dua kali. */
    const info = items.filter((item) => item.type === "info");
    const gabungan = [...new Map([...info, ...items].map((i) => [i.shortCode, i])).values()];
    const pilihan = gabungan.slice(0, 3);

    if (!pilihan.length) {
      pengumumanEl.replaceChildren();
      return;
    }

    pengumumanEl.replaceChildren(
      ...pilihan.map((item) => {
        const { title, excerpt } = splitCaption(item.text);
        const judul = item.judulKurasi || title;
        const card = document.createElement("article");
        card.className = "news-item reveal";

        /* Foto asli dari Instagram kalau ada, sama seperti kartu grid.
           Kalau proxy gagal atau berita ini dari katalog lokal (shortCode
           karangan), turun ke cover kategori. */
        const fallbackCover = item.cover || "/img/berita/cover-berita.svg";
        const thumb = document.createElement("img");
        thumb.className = "news-item-media";
        thumb.alt = "";
        thumb.loading = "lazy";
        thumb.decoding = "async";

        const proxySrc = proxyThumbSrc(item);
        if (proxySrc) {
          thumb.addEventListener(
            "error",
            () => {
              thumb.src = fallbackCover;
            },
            { once: true }
          );
          thumb.src = proxySrc;
        } else {
          thumb.src = fallbackCover;
        }
        card.appendChild(thumb);

        const body = document.createElement("div");
        body.className = "news-item-body";

        const meta = document.createElement("p");
        meta.className = "news-item-meta";
        meta.textContent = [
          item.kategoriLabel || "Pengumuman",
          formatDate(item.postedAt),
        ]
          .filter(Boolean)
          .join(" · ");
        body.appendChild(meta);

        const heading = document.createElement("h3");
        heading.textContent = judul;
        body.appendChild(heading);

        if (excerpt && excerpt !== judul) {
          const para = document.createElement("p");
          para.textContent = excerpt;
          body.appendChild(para);
        }

        const link = document.createElement("a");
        link.className = "berita-link";
        link.href = item.postUrl;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.textContent = "Lihat di Instagram";
        link.setAttribute("aria-label", `Lihat "${judul}" di Instagram`);
        body.appendChild(link);

        card.appendChild(body);
        return card;
      })
    );
  };

  load();
})();
