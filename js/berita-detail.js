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

  const thumbUrl = (src) =>
    src ? `/api/thumbnail?url=${encodeURIComponent(src)}` : "/img/berita/berita-1.jpg";

  /* ---------- Elemen ---------- */
  const statusEl = document.querySelector("[data-detail-status]");
  const bodyEl = document.querySelector("[data-detail-body]");
  const errorEl = document.querySelector("[data-detail-error]");
  const errorText = document.querySelector("[data-detail-error-text]");
  const metaEl = document.querySelector("[data-detail-meta]");
  const titleEl = document.querySelector("[data-detail-title]");
  const tagsEl = document.querySelector("[data-detail-tags]");
  const imageEl = document.querySelector("[data-detail-image]");
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

    titleEl.textContent = shortTitle(item.text);

    imageEl.src = thumbUrl(item.thumbnail);
    imageEl.alt = shortTitle(item.text);
    imageEl.addEventListener("error", () => {
      imageEl.src = "/img/berita/berita-1.jpg";
    }, { once: true });

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