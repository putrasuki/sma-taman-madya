(() => {
  "use strict";

  const prefersReducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)"
  ).matches;

  /* ---------- Footer year ---------- */
  const year = document.getElementById("year");
  if (year) year.textContent = String(new Date().getFullYear());

  /* ---------- Mobile navigation ---------- */
  const toggle = document.getElementById("nav-toggle");
  const nav = document.getElementById("site-nav");

  if (toggle && nav) {
    const setOpen = (open) => {
      toggle.setAttribute("aria-expanded", String(open));
      toggle.setAttribute(
        "aria-label",
        open ? "Tutup menu navigasi" : "Buka menu navigasi"
      );
      nav.classList.toggle("is-open", open);
    };

    toggle.addEventListener("click", () => {
      setOpen(toggle.getAttribute("aria-expanded") !== "true");
    });

    nav.addEventListener("click", (event) => {
      if (event.target.closest("a")) setOpen(false);
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && toggle.getAttribute("aria-expanded") === "true") {
        setOpen(false);
        toggle.focus();
      }
    });

    const desktop = window.matchMedia("(min-width: 48rem)");
    desktop.addEventListener("change", (event) => {
      if (event.matches) setOpen(false);
    });
  }

  /* ---------- Header shadow on scroll ---------- */
  const header = document.getElementById("site-header");
  const toTop = document.getElementById("to-top");

  if (header || toTop) {
    const onScroll = () => {
      const y = window.scrollY;
      if (header) header.classList.toggle("is-stuck", y > 8);
      if (toTop) toTop.hidden = y < 400;
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
  }

  if (toTop) {
    toTop.addEventListener("click", () => {
      window.scrollTo({ top: 0, behavior: prefersReducedMotion ? "auto" : "smooth" });
    });
  }

  /* ---------- Scroll reveal ---------- */
  const revealed = document.querySelectorAll(".reveal");

  if (prefersReducedMotion || !("IntersectionObserver" in window)) {
    revealed.forEach((el) => el.classList.add("is-visible"));
  } else {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        });
      },
      { rootMargin: "0px 0px -10% 0px", threshold: 0.15 }
    );

    revealed.forEach((el) => observer.observe(el));
  }

  /* ---------- Active section highlighting ---------- */
  const sections = document.querySelectorAll("main section[id]");

  if (sections.length && "IntersectionObserver" in window) {
    const links = document.querySelectorAll('.site-nav ul a[href^="#"]');

    const spy = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          links.forEach((link) => {
            const active = link.getAttribute("href") === `#${entry.target.id}`;
            link.classList.toggle("is-active", active);
            if (active) link.setAttribute("aria-current", "true");
            else link.removeAttribute("aria-current");
          });
        });
      },
      { rootMargin: "-45% 0px -50% 0px" }
    );

    sections.forEach((section) => spy.observe(section));
  }

  /* ---------- Facility gallery filter (satu tab = satu folder) ---------- */
  const facilityTabs = Array.from(
    document.querySelectorAll("[data-facility-tabs] [role='tab']")
  );
  const facilityItems = Array.from(
    document.querySelectorAll("[data-facility-grid] .facility-item")
  );
  const facilityStatus = document.querySelector("[data-facility-status]");
  const facilityPanel = document.getElementById("facility-panel");

  if (facilityTabs.length && facilityItems.length) {
    const select = (tab) => {
      const filter = tab.dataset.facilityFilter;

      facilityTabs.forEach((item) => {
        const active = item === tab;
        item.setAttribute("aria-selected", String(active));
        item.tabIndex = active ? 0 : -1;
      });

      let shown = 0;

      facilityItems.forEach((item) => {
        const match = filter === "all" || item.dataset.facility === filter;
        item.hidden = !match;
        if (!match) return;
        shown += 1;
        item.classList.add("is-visible");
      });

      if (facilityPanel) facilityPanel.setAttribute("aria-labelledby", tab.id);

      if (facilityStatus) {
        const label = tab.dataset.facilityLabel || "fasilitas";
        facilityStatus.textContent = `Menampilkan ${shown} foto ${label}.`;
      }
    };

    facilityTabs.forEach((tab, index) => {
      tab.addEventListener("click", () => select(tab));

      tab.addEventListener("keydown", (event) => {
        let next;

        if (event.key === "ArrowRight") next = index + 1;
        else if (event.key === "ArrowLeft") next = index - 1;
        else if (event.key === "Home") next = 0;
        else if (event.key === "End") next = facilityTabs.length - 1;
        else return;

        event.preventDefault();

        const target = facilityTabs[(next + facilityTabs.length) % facilityTabs.length];
        select(target);
        target.focus();
      });
    });

    const initial =
      facilityTabs.find((tab) => tab.getAttribute("aria-selected") === "true") ||
      facilityTabs[0];

    select(initial);
  }

})();
