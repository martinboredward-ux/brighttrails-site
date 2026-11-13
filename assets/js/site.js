/* Bright Trails Publishing — shared behaviour. Works without JS: every book
   shows, buy buttons stay hidden and the menu stays open on small screens. */
(function () {
  "use strict";
  var doc = document.documentElement;
  doc.classList.add("js");
  var cfg = window.SITE_CONFIG || {};
  var books = cfg.books || {};
  var gives = cfg.gives || {};

  function isUrl(v) { return typeof v === "string" && /^https:\/\//.test(v); }
  function setText(sel, text) {
    document.querySelectorAll(sel).forEach(function (el) { el.textContent = text; });
  }

  // ---- Mobile menu ----
  var toggle = document.querySelector(".menu-toggle");
  var nav = document.getElementById("site-nav");
  if (toggle && nav) {
    toggle.addEventListener("click", function () {
      var open = nav.classList.toggle("open");
      toggle.setAttribute("aria-expanded", String(open));
    });
    nav.addEventListener("click", function (e) {
      if (e.target.closest("a")) { nav.classList.remove("open"); toggle.setAttribute("aria-expanded", "false"); }
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && nav.classList.contains("open")) {
        nav.classList.remove("open");
        toggle.setAttribute("aria-expanded", "false");
        toggle.focus();
      }
    });
  }

  // ---- Books: Amazon links, covers, prices ----
  document.querySelectorAll("[data-book]").forEach(function (card) {
    var b = books[card.dataset.book] || {};
    var buy = card.querySelector("[data-buy]");
    var notify = card.querySelector("[data-notify]");
    var live = card.querySelector(".tag.live");
    var soon = card.querySelector(".tag.soon");
    if (isUrl(b.amazon)) {
      buy.href = b.amazon; buy.rel = "noopener"; buy.hidden = false;
      if (notify) notify.hidden = true;
      if (live) live.hidden = false;
      if (soon) soon.hidden = true;
    }
    if (typeof b.cover === "string" && b.cover) {
      var img = document.createElement("img");
      img.src = b.cover; img.alt = "Cover of " + card.querySelector("h3").textContent;
      img.loading = "lazy";
      card.querySelector(".cover").appendChild(img);
    }
    var price = card.querySelector(".price");
    if (price && typeof b.price === "string" && b.price) { price.textContent = b.price; price.hidden = false; }
  });

  // Series list buttons share the same Amazon links
  document.querySelectorAll("[data-series-buy]").forEach(function (a) {
    var b = books[a.dataset.seriesBuy] || {};
    if (isUrl(b.amazon)) {
      a.href = b.amazon; a.rel = "noopener"; a.hidden = false;
      var pending = a.parentNode.querySelector(".status");
      if (pending) pending.hidden = true;
    }
  });

  // ---- Age filter ----
  var notes = {
    all: "Everything on the Bright Trails shelf, from toddlers to grown-ups.",
    little: "Thick lines, gentle stories and nothing scary. Made for ages 3–5.",
    kids: "Coloring with real facts about animals and the Philippines.",
    adults: "Calm, guided coloring and tracing for teens and grown-ups."
  };
  var filterBar = document.querySelector(".filters");
  if (filterBar) {
    filterBar.hidden = false;
    filterBar.addEventListener("click", function (e) {
      var btn = e.target.closest("button[data-shelf]");
      if (!btn) return;
      var shelf = btn.dataset.shelf;
      filterBar.querySelectorAll("button").forEach(function (b) {
        b.setAttribute("aria-pressed", String(b === btn));
      });
      document.querySelectorAll(".book[data-shelf]").forEach(function (card) {
        card.hidden = !(shelf === "all" || card.dataset.shelf === shelf);
      });
      setText(".shelf-note", notes[shelf] || notes.all);
    });
  }

  // ---- Bright Trails Gives ----
  if (typeof gives.kitsGiven === "number") {
    setText("[data-kits-given]", gives.kitsGiven.toLocaleString());
    setText("[data-kits-label]", "school kits given so far");
  }
  if (typeof gives.kitsPerClassroom === "number") {
    setText("[data-kits-per-class]", gives.kitsPerClassroom + " kits");
  }
  if (typeof gives.classroomPrice === "string" && gives.classroomPrice) {
    document.querySelectorAll("[data-class-price]").forEach(function (el) { el.textContent = gives.classroomPrice; el.hidden = false; });
  }
  if (isUrl(gives.checkoutUrl)) {
    document.querySelectorAll("[data-sponsor]").forEach(function (a) { a.href = gives.checkoutUrl; a.rel = "noopener"; a.hidden = false; });
    document.querySelectorAll("[data-sponsor-pending]").forEach(function (el) { el.hidden = true; });
  }

  // ---- Contact email ----
  if (typeof cfg.contactEmail === "string" && /@/.test(cfg.contactEmail)) {
    document.querySelectorAll("[data-email]").forEach(function (a) {
      a.href = "mailto:" + cfg.contactEmail; a.textContent = cfg.contactEmail; a.hidden = false;
    });
    document.querySelectorAll("[data-email-fallback]").forEach(function (el) { el.hidden = true; });
  }

  // ---- Year ----
  setText("[data-year]", String(new Date().getFullYear()));
})();
