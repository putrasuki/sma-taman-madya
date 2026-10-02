(() => {
  "use strict";

  const ENDPOINT = "/api/berita";
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
    fig.className = "berita-card reveal";

    const media = document.createElement("a");
    media.className = "berita-media";
    media.href = item.postUrl;
    media.target = "_blank";
    media.rel = "noopener noreferrer";
    media.setAttribute("aria-label", title);

    const img = document.createElement("img");
    img.src = item.thumbnail;
    img.alt = title;
    img.loading = "lazy";
    img.decoding = "async";
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

  const showFallback = () => {
    grid.classList.remove("is-loading");
    grid.classList.add("is-fallback");
  };

  const render = (items) => {
    const fragment = document.createDocumentFragment();
    items.forEach((item) => fragment.appendChild(createCard(item)));
    grid.replaceChildren(fragment);
    grid.classList.remove("is-loading", "is-fallback");

    const cards = grid.querySelectorAll(".berita-card");
    if (cards.length && "IntersectionObserver" in window) {
      const spy = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (!entry.isIntersecting) return;
            entry.target.classList.add("is-visible");
            spy.unobserve(entry.target);
          });
        },
        { threshold: 0.1 }
      );
      cards.forEach((card) => spy.observe(card));
    } else {
      cards.forEach((card) => card.classList.add("is-visible"));
    }
  };

  const load = () => {
    fetch(ENDPOINT, { headers: { Accept: "application/json" } })
      .then((res) => res.json())
      .then((payload) => {
        if (payload && payload.ok && payload.items.length) render(payload.items);
        else showFallback();
      })
      .catch(showFallback);
  };

  load();
})();