// Minimal script for case-study pages (loaded inside the work-modal iframe).
// Only what those pages actually use: history anchoring + in-page section nav.

// Anchor current history entry to this page URL (avoids Back going to about:blank in Safari/WebKit).
function anchorHistory() {
  if (window.location.href === "about:blank") return;
  var url =
    window.location.pathname +
    window.location.search +
    (window.location.hash || "");
  if (!url) url = "/";
  try {
    history.replaceState(history.state || {}, "", url);
  } catch (e) {}
}
anchorHistory();

// Case study in-page nav: highlight active section on scroll + use replaceState so Back closes modal once
document.addEventListener("DOMContentLoaded", function () {
  anchorHistory(); // Re-anchor in Safari/WebKit after load

  var nav = document.querySelector(".case-study-nav");
  if (!nav) return;
  var links = nav.querySelectorAll('a[href^="#"]');
  var sectionIds = Array.from(links).map(function (a) {
    return a.getAttribute("href").slice(1);
  });
  var activeThreshold = 120;

  // Intercept nav clicks: scroll to section but don't push history (use replaceState).
  // Keeps iframe at one history entry so one Back press closes the parent modal.
  links.forEach(function (a) {
    a.addEventListener("click", function (e) {
      var id = this.getAttribute("href").slice(1);
      if (!id) return;
      var el = document.getElementById(id);
      if (!el) return;
      e.preventDefault();
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      var hash = "#" + id;
      var url = document.location.pathname + document.location.search + hash;
      history.replaceState(undefined, "", url);
    });
  });

  function setActiveSection() {
    var scrollY = window.scrollY || window.pageYOffset;
    var activeId = null;
    for (var i = sectionIds.length - 1; i >= 0; i--) {
      var el = document.getElementById(sectionIds[i]);
      if (!el) continue;
      var top = el.getBoundingClientRect().top + scrollY;
      if (scrollY >= top - activeThreshold) {
        activeId = sectionIds[i];
        break;
      }
    }
    if (!activeId && sectionIds.length) activeId = sectionIds[0];
    links.forEach(function (a) {
      var id = a.getAttribute("href").slice(1);
      a.classList.toggle("active", id === activeId);
    });
  }

  setActiveSection();
  window.addEventListener("scroll", setActiveSection, { passive: true });
});
