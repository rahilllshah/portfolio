// Scroll progress bar for case-study pages. Vanilla JS (no jQuery dependency).
// Usage: progressBar(document.querySelector("article"), { progressBarColor: "#FFF", ... });
(function () {
  function progressBar(article, options) {
    if (!article) return;
    options = options || {};

    var bar = document.createElement("div");
    var value = document.createElement("div");

    bar.style.cssText =
      "height:" + (options.progressBarHeight || 7) + "px;" +
      "background-color:" + (options.progressBarColor || "#F1F1F1") + ";" +
      "position:fixed;width:100%;left:0;top:" + (options.progressBarTopPosition || 0) + "px;";
    value.style.cssText =
      "position:absolute;width:0;height:100%;" +
      "background-color:" + (options.progressBarValueColor || "#A1A1A1") + ";" +
      "transition:width 0.3s linear;";
    if (options.progressBarValueColorG) {
      value.style.backgroundImage = options.progressBarValueColorG;
    }

    article.appendChild(bar);
    bar.appendChild(value);

    // Recompute on resize/load since images change article height after first paint.
    var max = 0;
    function measure() {
      var scrollable = article.clientHeight - window.innerHeight;
      max = scrollable > 0 ? scrollable : 0;
    }
    function update() {
      value.style.width = (max ? (window.scrollY / max) * 100 : 0) + "%";
    }

    var throttleMs = options.throttleTime || 100;
    var waiting = false;
    function onScroll() {
      if (waiting) return;
      waiting = true;
      setTimeout(function () {
        waiting = false;
      }, throttleMs);
      update();
    }

    measure();
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", function () {
      measure();
      update();
    });
    window.addEventListener("load", function () {
      measure();
      update();
    });
  }

  window.progressBar = progressBar;
})();
