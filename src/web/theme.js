(function () {
  "use strict";
  try {
    var saved = localStorage.getItem("shelvez-theme");
    var prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
    document.documentElement.setAttribute("data-theme", saved || (prefersDark ? "dark" : "light"));
  } catch (error) {
    document.documentElement.setAttribute("data-theme", "light");
  }
})();
