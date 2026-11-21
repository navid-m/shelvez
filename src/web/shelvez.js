(function () {
  "use strict";

  var root = document.documentElement;
  var THEME_KEY = "shelvez-theme";
  var NAV_KEY = "shelvez-nav-open";

  function currentTheme() {
    return root.getAttribute("data-theme") === "dark" ? "dark" : "light";
  }

  function applyTheme(theme) {
    root.setAttribute("data-theme", theme);
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch (e) {}
    var button = document.getElementById("theme-toggle");
    if (button) {
      button.setAttribute("aria-pressed", theme === "dark" ? "true" : "false");
      button.setAttribute("title", theme === "dark" ? "Switch to light mode" : "Switch to dark mode");
    }
  }

  var toggle = document.getElementById("theme-toggle");
  if (toggle) {
    toggle.addEventListener("click", function () {
      applyTheme(currentTheme() === "dark" ? "light" : "dark");
    });
    applyTheme(currentTheme());
  }

  var menu = document.getElementById("menu-toggle");
  var overlay = document.querySelector(".sidebar-overlay");
  function closeNav() {
    document.body.classList.remove("nav-open");
    if (menu) menu.setAttribute("aria-expanded", "false");
  }
  if (menu) {
    menu.addEventListener("click", function () {
      var open = document.body.classList.toggle("nav-open");
      menu.setAttribute("aria-expanded", open ? "true" : "false");
    });
  }
  if (overlay) overlay.addEventListener("click", closeNav);
  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape") closeNav();
  });

  var savedNav = {};
  try {
    savedNav = JSON.parse(localStorage.getItem(NAV_KEY) || "{}") || {};
  } catch (e) {
    savedNav = {};
  }
  var sections = document.querySelectorAll("details[data-section]");
  Array.prototype.forEach.call(sections, function (section) {
    var key = section.getAttribute("data-section");
    if (Object.prototype.hasOwnProperty.call(savedNav, key)) {
      section.open = !!savedNav[key];
    }
    section.addEventListener("toggle", function () {
      savedNav[key] = section.open;
      try {
        localStorage.setItem(NAV_KEY, JSON.stringify(savedNav));
      } catch (e) {}
    });
  });

  var tocLinks = Array.prototype.slice.call(document.querySelectorAll(".toc-link"));
  if (tocLinks.length && "IntersectionObserver" in window) {
    var byId = {};
    tocLinks.forEach(function (link) {
      var id = decodeURIComponent(link.getAttribute("href").slice(1));
      byId[id] = link;
    });
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        tocLinks.forEach(function (link) { link.classList.remove("active"); });
        var active = byId[entry.target.id];
        if (active) active.classList.add("active");
      });
    }, { rootMargin: "-72px 0px -70% 0px", threshold: 0 });
    Object.keys(byId).forEach(function (id) {
      var heading = document.getElementById(id);
      if (heading) observer.observe(heading);
    });
  }

  var input = document.getElementById("search");
  var results = document.getElementById("search-results");
  var index = null;
  var loading = false;
  var activeResult = -1;

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function loadIndex() {
    if (index || loading) return;
    loading = true;
    fetch("/assets/search.json", { cache: "no-store" })
      .then(function (response) { return response.json(); })
      .then(function (data) {
        index = Array.isArray(data) ? data : [];
        loading = false;
        if (input && input.value.trim()) runSearch();
      })
      .catch(function () {
        loading = false;
        index = [];
      });
  }

  function scoreEntry(entry, terms) {
    var score = 0;
    var title = (entry.title || "").toLowerCase();
    var context = (entry.context || "").toLowerCase();
    var text = (entry.text || "").toLowerCase();
    for (var i = 0; i < terms.length; i++) {
      var term = terms[i];
      if (title.indexOf(term) >= 0) score += 60;
      if (context.indexOf(term) >= 0) score += 18;
      var at = text.indexOf(term);
      if (at >= 0) score += 6;
      if (title.indexOf(term) === 0) score += 30;
    }
    return score;
  }

  function runSearch() {
    if (!results || !input) return;
    var query = input.value.trim();
    if (!query) {
      results.classList.remove("open");
      results.innerHTML = "";
      activeResult = -1;
      return;
    }
    if (!index) {
      loadIndex();
      results.innerHTML = "<div class=\"search-empty\">Loading index…</div>";
      results.classList.add("open");
      return;
    }
    var terms = query.toLowerCase().split(/\s+/).filter(Boolean);
    var scored = [];
    for (var i = 0; i < index.length; i++) {
      var score = scoreEntry(index[i], terms);
      if (score > 0) scored.push({ score: score, entry: index[i] });
    }
    scored.sort(function (a, b) { return b.score - a.score; });
    if (!scored.length) {
      results.innerHTML = "<div class=\"search-empty\">No results for “" + escapeHtml(query) + "”</div>";
      results.classList.add("open");
      activeResult = -1;
      return;
    }
    var html = "";
    for (var j = 0; j < Math.min(scored.length, 12); j++) {
      var entry = scored[j].entry;
      html += "<a class=\"search-result\" href=\"" + escapeHtml(entry.url) + "\">" +
        "<span class=\"search-result-title\">" + escapeHtml(entry.title) + "</span>" +
        "<span class=\"search-result-context\">" + escapeHtml(entry.context || "") + "</span>" +
        "</a>";
    }
    results.innerHTML = html;
    results.classList.add("open");
    activeResult = -1;
  }

  if (input) {
    input.addEventListener("focus", loadIndex);
    input.addEventListener("input", runSearch);
    input.addEventListener("keydown", function (event) {
      var items = results ? results.querySelectorAll(".search-result") : [];
      if (!items.length) return;
      if (event.key === "ArrowDown") {
        event.preventDefault();
        activeResult = (activeResult + 1) % items.length;
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        activeResult = activeResult <= 0 ? items.length - 1 : activeResult - 1;
      } else if (event.key === "Enter" && activeResult >= 0) {
        event.preventDefault();
        items[activeResult].click();
        return;
      } else if (event.key === "Escape") {
        results.classList.remove("open");
        input.blur();
        return;
      } else {
        return;
      }
      Array.prototype.forEach.call(items, function (item, i) {
        item.classList.toggle("active", i === activeResult);
      });
      if (items[activeResult]) items[activeResult].scrollIntoView({ block: "nearest" });
    });
    document.addEventListener("click", function (event) {
      var wrap = document.querySelector(".search-wrap");
      if (wrap && !wrap.contains(event.target) && results) {
        results.classList.remove("open");
      }
    });
  }

  if (window.SHELVEZ_LIVE) {
    var version = String(window.SHELVEZ_VERSION || "");
    setInterval(function () {
      fetch("/__shelvez/version", { cache: "no-store" })
        .then(function (response) { return response.text(); })
        .then(function (next) {
          if (String(next).trim() !== version) window.location.reload();
        })
        .catch(function () {});
    }, 1200);
  }
})();
