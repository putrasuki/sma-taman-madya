(() => {
  "use strict";

  const ENDPOINT = "/api/berita";
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

  const createCard = (item) => {
    const { title, excerpt } = splitCaption(item.text);
    const fig = document.createElement("article");
    fig.className = "berita-card reveal is-visible";

    const media = document.createElement("a");
    media.className = "berita-media";
    media.href = `berita.html?id=${encodeURIComponent(item.shortCode)}`;
    media.setAttribute(
      "aria-label",
      `Baca berita: ${title}`
    );

    const img = document.createElement("img");
    img.src = item.thumbnail
      ? `/api/thumbnail?url=${encodeURIComponent(item.thumbnail)}`
      : "/img/berita/berita-1.jpg";
    img.alt = title;
    img.loading = "lazy";
    img.decoding = "async";
    img.addEventListener("error", () => {
      img.src = "/img/berita/berita-1.jpg";
    });
    media.appendChild(img);

    if (item.isVideo) {
      const play = document.createElement("span");
      play.className = "berita-play";
      play.setAttribute("aria-hidden", "true");
      play.innerHTML =
        '<svg viewBox="0 0 24 24" width="22" height="22"><path d="M8 5.5v13l11-6.5z"/></svg>';
      media.appendChild(play);
    }

    fig.appendChild(media);

    const body = document.createElement("div");
    body.className = "berita-body";

    const meta = document.createElement("p");
    meta.className = "berita-meta";
    meta.textContent = [
      item.isVideo ? "Video" : "Foto",
      formatDate(item.postedAt),
      item.likes ? `${formatLikes(item.likes)} suka` : "",
    ]
      .filter(Boolean)
      .join(" · ");
    body.appendChild(meta);

    const heading = document.createElement("h3");
    heading.textContent = title;
    body.appendChild(heading);

    if (excerpt) {
      const para = document.createElement("p");
      para.className = "berita-excerpt";
      para.textContent = excerpt;
      body.appendChild(para);
    }

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

  const setStatus = (message) => {
    const status = document.querySelector("[data-berita-status]");
    if (!status) return;
    status.textContent = message || "";
    status.hidden = !message;
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

  const render = (items, updatedAt) => {
    const fragment = document.createDocumentFragment();
    items.forEach((item) => fragment.appendChild(createCard(item)));
    grid.replaceChildren(fragment);
    grid.classList.remove("is-loading");

    const terbaru = items.length ? formatDate(items[0].postedAt) : "";
    setStatus(
      [
        `${items.length} berita dari Instagram`,
        terbaru ? `terbaru ${terbaru}` : "",
        updatedAt ? `diperbarui ${formatDate(updatedAt)}` : "",
      ]
        .filter(Boolean)
        .join(" · ")
    );
  };

  const load = () => {
    showSkeleton();
    setStatus("");

    fetch(ENDPOINT, { headers: { Accept: "application/json" } })
      .then((res) => res.json())
      .then((payload) => {
        if (payload && payload.ok && payload.items.length) {
          render(payload.items, payload.updatedAt);
          return;
        }
        const reason =
          (payload && payload.error && ` (${payload.error})`) || "";
        showError(
          `Kabar terbaru belum bisa diambil dari server${reason}. Coba lagi sebentar lagi.`,
          load,
          LOCAL_HINT
        );
        setStatus("Berita gagal dimuat.");
      })
      .catch(() => {
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

  load();
})();
