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

// Page loader — tracks sizzle reel buffer, then blurs out when playable.
// At 100%: start nav + feed intros immediately, then blur the loader away over them.
(function initPageLoader() {
  var lockedScrollY = 0;

  function lockScroll() {
    lockedScrollY = window.scrollY || window.pageYOffset || 0;
    document.documentElement.classList.add("is-loader-scroll-lock");
    document.body.classList.add("is-loader-scroll-lock");
    document.body.style.top = "-" + lockedScrollY + "px";
  }

  function unlockScroll() {
    document.documentElement.classList.remove("is-loader-scroll-lock");
    document.body.classList.remove("is-loader-scroll-lock");
    document.body.style.top = "";
    window.scrollTo(0, lockedScrollY);
  }

  function signalPageReady() {
    if (document.body.classList.contains("is-ready")) return;
    document.body.classList.remove("is-loading");
    document.body.classList.add("is-ready");
    document.dispatchEvent(new CustomEvent("pageready"));
  }

  var loader = document.getElementById("page-loader");
  if (!loader) {
    unlockScroll();
    signalPageReady();
    return;
  }

  lockScroll();

  // Block wheel/touch scroll while the loader is up (Safari/iOS belt-and-suspenders)
  function preventScroll(e) {
    e.preventDefault();
  }
  window.addEventListener("wheel", preventScroll, { passive: false });
  window.addEventListener("touchmove", preventScroll, { passive: false });

  var ring = loader.querySelector(".page-loader-ring-progress");
  var pctNum = loader.querySelector(".page-loader-pct-num");
  var video = document.querySelector(".reel-video");
  var displayPct = 1; // never start at 0
  var targetPct = 1;
  var ready = false;
  var dismissed = false;
  var rafId = null;
  var safetyTimer = null;
  var startTime = performance.now();
  // Steady time-based climb toward this ceiling while the reel loads
  var AUTO_CEILING = 90;
  var AUTO_MS = 3200; // ~linear climb 1% → 90% over 3.2s
  var circumference = 289.026;
  if (ring) {
    var fromCss = getComputedStyle(loader)
      .getPropertyValue("--loader-circumference")
      .trim();
    var parsed = parseFloat(fromCss);
    if (isFinite(parsed) && parsed > 0) circumference = parsed;
    ring.style.strokeDasharray = String(circumference);
    ring.style.strokeDashoffset = String(circumference);
    // rAF drives the ring — disable CSS transition so it doesn't fight easing
    ring.style.transition = "none";
  }

  function paintRing(pct) {
    var shown = Math.max(1, Math.min(100, Math.round(pct)));
    loader.setAttribute("aria-valuenow", String(shown));
    if (pctNum) pctNum.textContent = String(shown);
    if (ring) {
      ring.style.strokeDashoffset = String(
        circumference * (1 - Math.max(pct, 1) / 100),
      );
    }
  }

  function bufferedPercent() {
    if (!video) return 100;
    if (video.readyState >= 4) return 100;
    var duration = video.duration;
    if (!duration || !isFinite(duration) || duration <= 0) {
      if (video.readyState >= 3) return 90;
      if (video.readyState >= 2) return 55;
      if (video.readyState >= 1) return 22;
      return 0;
    }
    if (!video.buffered || video.buffered.length === 0) {
      return video.readyState >= 2 ? 35 : 0;
    }
    var end = 0;
    for (var i = 0; i < video.buffered.length; i++) {
      var e = video.buffered.end(i);
      if (e > end) end = e;
    }
    return Math.min(100, (end / duration) * 100);
  }

  // Pure elapsed-time climb — does not depend on the reel starting
  function autoProgress(now) {
    var elapsed = Math.max(0, now - startTime);
    if (elapsed <= AUTO_MS) {
      return 1 + (AUTO_CEILING - 1) * (elapsed / AUTO_MS);
    }
    // Past the main climb: keep creeping so it never looks frozen
    var crawl = ((elapsed - AUTO_MS) / 14000) * 6;
    return Math.min(96, AUTO_CEILING + crawl);
  }

  function tick(now) {
    if (dismissed) return;

    if (!ready) {
      var auto = autoProgress(now);
      var buffered = bufferedPercent();
      // Time always drives progress; reel buffer can only pull it forward
      targetPct = Math.min(96, Math.max(auto, buffered, targetPct));
      // Follow the clock closely for a steady % tick-up
      displayPct = Math.max(displayPct, targetPct);
    } else {
      targetPct = 100;
      var diff = 100 - displayPct;
      if (diff < 0.2) displayPct = 100;
      else displayPct += diff * 0.2;
    }

    if (displayPct < 1) displayPct = 1;
    paintRing(displayPct);

    if (ready && displayPct >= 99.6) {
      displayPct = 100;
      paintRing(100);
      rafId = null;
      dismiss();
      return;
    }
    rafId = requestAnimationFrame(tick);
  }

  function startTicker() {
    if (rafId == null) rafId = requestAnimationFrame(tick);
  }

  function dismiss() {
    if (dismissed) return;
    dismissed = true;
    if (rafId != null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    if (safetyTimer != null) {
      clearTimeout(safetyTimer);
      safetyTimer = null;
    }
    displayPct = 100;
    paintRing(100);
    // Unlock scroll, then start intros + blur-out
    window.removeEventListener("wheel", preventScroll);
    window.removeEventListener("touchmove", preventScroll);
    unlockScroll();
    signalPageReady();
    // Next frame so nav/feed paint before the overlay begins fading
    requestAnimationFrame(function () {
      loader.classList.add("is-done");
      loader.setAttribute("aria-busy", "false");
    });

    var finished = false;
    function cleanup() {
      if (finished) return;
      finished = true;
      loader.removeEventListener("transitionend", onEnd);
      if (loader.parentNode) loader.parentNode.removeChild(loader);
    }
    function onEnd(e) {
      if (e.target !== loader || e.propertyName !== "opacity") return;
      cleanup();
    }
    loader.addEventListener("transitionend", onEnd);
    setTimeout(cleanup, 1200);
  }

  function markReady() {
    if (ready || dismissed) return;
    ready = true;
    targetPct = 100;
    startTicker();
  }

  function onProgress() {
    targetPct = Math.max(targetPct, bufferedPercent());
    startTicker();
  }

  paintRing(displayPct);
  startTicker();

  if (!video) {
    markReady();
    return;
  }

  var reelSrc =
    video.getAttribute("src") || video.currentSrc || "Images/sizzle-reel.mp4";

  function attachReadyListeners() {
    video.addEventListener("progress", onProgress);
    video.addEventListener("canplay", markReady);
    video.addEventListener("canplaythrough", markReady);
    video.addEventListener("loadeddata", function () {
      if (video.readyState >= 3) markReady();
    });
    video.addEventListener("error", markReady);
    if (video.readyState >= 3) markReady();
  }

  // iOS/Android often defer offscreen <video preload> — force the bytes down
  // via fetch so the loader isn't stuck waiting on a viewport-gated load.
  function forceFetchReel() {
    if (typeof fetch !== "function") {
      kickNativeLoad();
      return;
    }

    fetch(reelSrc)
      .then(function (res) {
        if (!res.ok) throw new Error("reel fetch failed");
        var total = parseInt(res.headers.get("content-length") || "0", 10);
        if (
          res.body &&
          typeof res.body.getReader === "function" &&
          total > 0
        ) {
          var reader = res.body.getReader();
          var chunks = [];
          var loaded = 0;
          function pump() {
            return reader.read().then(function (result) {
              if (result.done) {
                return new Blob(chunks, { type: "video/mp4" });
              }
              chunks.push(result.value);
              loaded +=
                result.value.byteLength || result.value.length || 0;
              targetPct = Math.max(
                targetPct,
                Math.min(AUTO_CEILING, (loaded / total) * 100),
              );
              startTicker();
              return pump();
            });
          }
          return pump();
        }
        return res.blob();
      })
      .then(function (blob) {
        if (dismissed || !blob) return;
        var url = URL.createObjectURL(blob);
        video.preload = "auto";
        video.src = url;
        attachReadyListeners();
        try {
          video.load();
        } catch (_) {}
        // Whole file is local now — finish as soon as it's decode-ready
        if (video.readyState >= 3) markReady();
      })
      .catch(function () {
        kickNativeLoad();
      });
  }

  function kickNativeLoad() {
    video.preload = "auto";
    attachReadyListeners();
    try {
      video.load();
    } catch (_) {}
    // Muted play/pause can coax mobile browsers into starting the buffer
    // even when the reel is still below the fold.
    var p = video.play();
    if (p && typeof p.then === "function") {
      p.then(function () {
        video.pause();
        try {
          video.currentTime = 0;
        } catch (_) {}
      }).catch(function () {});
    }
    onProgress();
  }

  if (video.readyState >= 3) {
    markReady();
  } else {
    forceFetchReel();
  }

  // Never trap the user if the network stalls
  safetyTimer = setTimeout(markReady, 10000);
})();

// Fade-in on scroll for sections below landing
document.addEventListener("DOMContentLoaded", function () {
  var fadeEls = document.querySelectorAll(".scroll-fade");
  if (!fadeEls.length) return;
  var observer = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
        }
      });
    },
    { rootMargin: "0px 0px -8% 0px", threshold: 0 },
  );
  fadeEls.forEach(function (el) {
    observer.observe(el);
  });
});

// Let's Chat — copy email + toast
document.addEventListener("DOMContentLoaded", function () {
  var btn = document.querySelector(".copy-email-btn");
  if (!btn) return;

  var wrap = btn.closest(".chat-btn-wrap");
  var toast = wrap && wrap.querySelector(".email-toast");
  var hideTimer = null;

  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text);
    }
    return new Promise(function (resolve, reject) {
      var ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      try {
        if (!document.execCommand("copy")) reject(new Error("copy failed"));
        else resolve();
      } catch (err) {
        reject(err);
      } finally {
        document.body.removeChild(ta);
      }
    });
  }

  function showToast() {
    if (!toast) return;
    if (hideTimer) clearTimeout(hideTimer);
    toast.classList.add("is-visible");
    toast.setAttribute("aria-hidden", "false");
    hideTimer = setTimeout(function () {
      toast.classList.remove("is-visible");
      toast.setAttribute("aria-hidden", "true");
      hideTimer = null;
    }, 1500);
  }

  btn.addEventListener("click", function () {
    var email = btn.getAttribute("data-email");
    if (!email) return;
    copyText(email)
      .then(showToast)
      .catch(function () {});
  });
});

// Reel video progress bar — auto-tracks via rAF, scrubbable via pointer drag
document.addEventListener("DOMContentLoaded", function () {
  var video = document.querySelector(".reel-video");
  var progress = document.querySelector(".reel-progress");
  var fill = document.querySelector(".reel-progress-fill");
  if (!video || !progress || !fill) return;

  // Hide the looping loading shimmer once the reel actually starts rendering frames.
  var reelFrame = video.closest(".reel-frame");
  function markReelLoaded() {
    if (reelFrame) reelFrame.classList.add("is-loaded");
  }
  if (video.readyState >= 3) {
    markReelLoaded();
  } else {
    video.addEventListener("playing", markReelLoaded);
    video.addEventListener("canplay", markReelLoaded);
    video.addEventListener("loadeddata", markReelLoaded);
  }

  var rafId = null;
  var isScrubbing = false;

  function setFill(pct) {
    fill.style.width = pct + "%";
    progress.setAttribute("aria-valuenow", String(Math.round(pct)));
  }

  function tick() {
    if (!isScrubbing && video.duration && isFinite(video.duration)) {
      setFill((video.currentTime / video.duration) * 100);
    }
    rafId = requestAnimationFrame(tick);
  }

  function start() {
    if (rafId == null) rafId = requestAnimationFrame(tick);
  }

  function stop() {
    if (rafId != null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
  }

  // Scrubbing: ratio is computed from pointer X within the bar's bounding box
  function ratioFromEvent(e) {
    var rect = progress.getBoundingClientRect();
    var x = e.clientX - rect.left;
    var r = x / rect.width;
    if (r < 0) r = 0;
    if (r > 1) r = 1;
    return r;
  }

  function seekTo(e) {
    if (!video.duration || !isFinite(video.duration)) return;
    var ratio = ratioFromEvent(e);
    video.currentTime = ratio * video.duration;
    // While scrubbing, drive the fill directly so it never lags behind the cursor
    setFill(ratio * 100);
  }

  progress.addEventListener("pointerdown", function (e) {
    if (e.button != null && e.button !== 0) return;
    isScrubbing = true;
    progress.classList.add("is-scrubbing");
    try {
      progress.setPointerCapture(e.pointerId);
    } catch (_) {}
    e.preventDefault();
    seekTo(e);
  });

  progress.addEventListener("pointermove", function (e) {
    if (!isScrubbing) return;
    seekTo(e);
  });

  function endScrub(e) {
    if (!isScrubbing) return;
    isScrubbing = false;
    progress.classList.remove("is-scrubbing");
    try {
      progress.releasePointerCapture(e.pointerId);
    } catch (_) {}
  }

  progress.addEventListener("pointerup", endScrub);
  progress.addEventListener("pointercancel", endScrub);

  // Tap the video (or the hint) to expand into the native fullscreen player.
  // Mobile only — desktop keeps the inline reel with no expand behavior.
  var hint = document.querySelector(".reel-expand-hint");
  var mobileQuery = window.matchMedia("(max-width: 768px)");
  function expandVideo() {
    if (!mobileQuery.matches) return;
    if (typeof video.webkitEnterFullscreen === "function") {
      // iOS Safari: native inline-video fullscreen player.
      try {
        video.webkitEnterFullscreen();
        return;
      } catch (_) {}
    }
    var target = reelFrame || video;
    var req =
      target.requestFullscreen ||
      target.webkitRequestFullscreen ||
      video.requestFullscreen ||
      video.webkitRequestFullscreen;
    if (req) {
      try {
        var r = req.call(target.requestFullscreen ? target : video);
        if (r && typeof r.catch === "function") r.catch(function () {});
      } catch (_) {}
    }
  }
  video.addEventListener("click", expandVideo);
  if (hint) hint.addEventListener("click", expandVideo);

  video.addEventListener("play", start);
  video.addEventListener("playing", start);
  video.addEventListener("pause", stop);
  video.addEventListener("ended", stop);
  document.addEventListener("visibilitychange", function () {
    if (document.hidden) stop();
    else if (!video.paused) start();
  });

  if (!video.paused) start();

  // Start playback only after at least 50% of the reel is in view.
  if ("IntersectionObserver" in window) {
    var hasStarted = false;
    var reelObserver = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (
            !hasStarted &&
            entry.isIntersecting &&
            entry.intersectionRatio >= 0.5
          ) {
            hasStarted = true;
            var p = video.play();
            if (p && typeof p.catch === "function") p.catch(function () {});
            reelObserver.disconnect();
          }
        });
      },
      { threshold: 0.5 },
    );
    reelObserver.observe(video);
  } else {
    var p = video.play();
    if (p && typeof p.catch === "function") p.catch(function () {});
  }
});

// Work grid videos: defer download + play only while on screen.
// (autoplay was removed so the files don't download until needed.)
document.addEventListener("DOMContentLoaded", function () {
  var vids = document.querySelectorAll("video.work-item-img[data-autoplay]");
  if (!vids.length) return;

  function play(v) {
    var p = v.play();
    if (p && typeof p.catch === "function") p.catch(function () {});
  }

  if (!("IntersectionObserver" in window)) {
    vids.forEach(play);
    return;
  }

  var observer = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (entry) {
        var v = entry.target;
        if (entry.isIntersecting) {
          if (v.preload === "none") v.preload = "auto";
          play(v);
        } else if (!v.paused) {
          v.pause();
        }
      });
    },
    { rootMargin: "200px 0px", threshold: 0.1 },
  );
  vids.forEach(function (v) {
    observer.observe(v);
  });
});

// Landing title feed: brand colors draw from each prev company into the
// headline tip, then absorb into the mesh gradient that fills the type.
document.addEventListener("DOMContentLoaded", function () {
  var root = document.querySelector(".landing-content");
  var svg = root && root.querySelector(".title-feed");
  var title = root && root.querySelector(".title");
  var chatBtn = root && root.querySelector(".copy-email-btn");
  var companies = root
    ? Array.prototype.slice.call(
        root.querySelectorAll(".prev-company[data-feed]"),
      )
    : [];
  if (!root || !svg || !title || !companies.length) {
    if (title) title.classList.remove("is-awaiting-feed");
    if (chatBtn) chatBtn.classList.remove("is-awaiting-feed");
    return;
  }

  var STROKES_PER_COMPANY = 4;
  var STROKE_WIDTH = 2;

  var FEEDS = {
    instagram: {
      colors: ["#f58529", "#dd2a7b", "#8134af", "#515bd4"],
    },
    shopify: {
      colors: ["#b4d96a", "#95bf47", "#6fa32e", "#95bf47"],
    },
    robinhood: {
      colors: ["#5ef0c2", "#00cf98", "#0ea5e9", "#2dd4bf"],
    },
    twitch: {
      colors: ["#bf94ff", "#9146ff", "#a855f7", "#7c3aed"],
    },
  };

  function hash(n) {
    var x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
    return x - Math.floor(x);
  }

  var NS = "http://www.w3.org/2000/svg";
  var paths = [];
  var done = false;
  var resizeTimer = null;
  var titleFed = false;

  function el(name, attrs) {
    var node = document.createElementNS(NS, name);
    if (attrs) {
      Object.keys(attrs).forEach(function (key) {
        node.setAttribute(key, attrs[key]);
      });
    }
    return node;
  }

  function feedTitle() {
    if (titleFed) return;
    titleFed = true;
    title.classList.remove("is-awaiting-feed");
    title.classList.add("is-fed");
    if (chatBtn) {
      chatBtn.classList.remove("is-awaiting-feed");
      chatBtn.classList.add("is-fed");
    }
  }

  function collectGlyphTargets(rootRect) {
    var targets = [];
    var range = document.createRange();
    var walker = document.createTreeWalker(title, NodeFilter.SHOW_TEXT, null);
    var node;
    while ((node = walker.nextNode())) {
      var text = node.textContent || "";
      for (var i = 0; i < text.length; i++) {
        if (/\s/.test(text.charAt(i))) continue;
        range.setStart(node, i);
        range.setEnd(node, i + 1);
        var rects = range.getClientRects();
        for (var j = 0; j < rects.length; j++) {
          var r = rects[j];
          if (r.width < 1 || r.height < 1) continue;
          targets.push({
            x: r.left - rootRect.left + r.width * 0.5,
            y: r.top - rootRect.top + r.height * 0.55,
            w: r.width,
            h: r.height,
          });
        }
      }
    }
    return targets;
  }

  function buildSvg() {
    var rootRect = root.getBoundingClientRect();
    var titleRect = title.getBoundingClientRect();
    if (rootRect.width < 8 || titleRect.height < 8) return false;

    svg.setAttribute(
      "viewBox",
      "0 0 " + rootRect.width + " " + rootRect.height,
    );
    svg.setAttribute("width", String(rootRect.width));
    svg.setAttribute("height", String(rootRect.height));
    while (svg.firstChild) svg.removeChild(svg.firstChild);

    var defs = el("defs");
    svg.appendChild(defs);

    var layer = el("g");
    svg.appendChild(layer);

    var glyphTargets = collectGlyphTargets(rootRect);
    paths = [];
    var companyCount = companies.length;
    var strokeIndex = 0;

    companies.forEach(function (company, companyIndex) {
      var key = company.getAttribute("data-feed");
      var feed = FEEDS[key];
      if (!feed) return;

      var cRect = company.getBoundingClientRect();
      var companyT =
        companyCount === 1 ? 0.5 : companyIndex / (companyCount - 1);

      for (var s = 0; s < STROKES_PER_COMPANY; s++) {
        var seed = companyIndex * 17 + s * 3.1 + 1;
        var r1 = hash(seed);
        var r2 = hash(seed + 1.7);
        var r3 = hash(seed + 3.3);
        var r4 = hash(seed + 5.9);

        var startX =
          cRect.left - rootRect.left + cRect.width * (0.16 + r1 * 0.68);
        var startY = cRect.top - rootRect.top + 2 + r2 * 3;

        // Aim tips into real glyph boxes so they land inside letters.
        var endX;
        var endY;
        if (glyphTargets.length) {
          var targetIndex = Math.min(
            glyphTargets.length - 1,
            Math.floor(
              (companyT * 0.7 +
                ((s + 0.5) / STROKES_PER_COMPANY) * 0.3 +
                r3 * 0.08) *
                glyphTargets.length,
            ),
          );
          // Spread strokes across nearby glyphs instead of stacking one cell.
          targetIndex = Math.max(
            0,
            Math.min(
              glyphTargets.length - 1,
              targetIndex + Math.floor((r4 - 0.5) * 6),
            ),
          );
          var target = glyphTargets[targetIndex];
          endX = target.x + (r1 - 0.5) * target.w * 0.35;
          endY = target.y + (r2 - 0.5) * target.h * 0.25;
        } else {
          endX =
            titleRect.left -
            rootRect.left +
            titleRect.width *
              (0.06 +
                companyT * 0.62 +
                r3 * 0.22 +
                (s / STROKES_PER_COMPANY) * 0.1);
          endY =
            titleRect.top -
            rootRect.top +
            titleRect.height * (0.16 + r4 * 0.68);
        }

        var rise = Math.max(40, startY - endY);
        var sway =
          (r1 - 0.5) * 64 +
          (s - (STROKES_PER_COMPANY - 1) / 2) * 12 +
          (companyIndex % 2 === 0 ? -8 : 10);
        var c1x = startX + sway * (0.22 + r2 * 0.32);
        var c1y = startY - rise * (0.3 + r3 * 0.22);
        var c2x = endX - sway * (0.12 + r4 * 0.28);
        var c2y = endY + rise * (0.16 + r1 * 0.2);

        var colorA = feed.colors[s % feed.colors.length];
        var colorB = feed.colors[(s + 1) % feed.colors.length];
        var tipColor = feed.colors[(s + 2) % feed.colors.length];
        var gradId = "feed-grad-" + key + "-" + s;
        var grad = el("linearGradient", {
          id: gradId,
          gradientUnits: "userSpaceOnUse",
          x1: startX.toFixed(2),
          y1: startY.toFixed(2),
          x2: endX.toFixed(2),
          y2: endY.toFixed(2),
        });
        // Soft origin → bright tip at the title, so color visibly feeds in.
        grad.appendChild(
          el("stop", {
            offset: "0%",
            "stop-color": colorA,
            "stop-opacity": "0",
          }),
        );
        grad.appendChild(
          el("stop", {
            offset: "18%",
            "stop-color": colorA,
            "stop-opacity": "0.55",
          }),
        );
        grad.appendChild(
          el("stop", {
            offset: "62%",
            "stop-color": colorB,
            "stop-opacity": "0.85",
          }),
        );
        grad.appendChild(
          el("stop", {
            offset: "100%",
            "stop-color": tipColor,
            "stop-opacity": "1",
          }),
        );
        defs.appendChild(grad);

        var d =
          "M " +
          startX.toFixed(2) +
          " " +
          startY.toFixed(2) +
          " C " +
          c1x.toFixed(2) +
          " " +
          c1y.toFixed(2) +
          ", " +
          c2x.toFixed(2) +
          " " +
          c2y.toFixed(2) +
          ", " +
          endX.toFixed(2) +
          " " +
          endY.toFixed(2);

        var path = el("path", {
          class: "feed-path",
          d: d,
          stroke: "url(#" + gradId + ")",
          "stroke-width": String(STROKE_WIDTH),
        });

        layer.appendChild(path);
        paths.push({
          path: path,
          companyIndex: companyIndex,
          stroke: s,
          globalIndex: strokeIndex,
        });
        strokeIndex += 1;
      }
    });

    return paths.length > 0;
  }

  // Pour into the title: erase from the company origin so the tip is last
  // to fade — reading as color depositing into the mesh.
  // Safari mishandles negative stroke-dashoffset (0 → -len), which makes the
  // wipe look staggered/jumpy. Use positive equivalents instead: 2L ≡ 0 and
  // L ≡ -L (mod 2L), so 2L → L is the same continuous origin→tip clear.
  function absorbIntoTitle(item) {
    var path = item.path;
    var len = path.getTotalLength();
    var absorbMs = 1200 + hash(item.globalIndex + 2) * 160;
    var dash = len + " " + len;

    path.style.transition = "none";
    path.style.strokeDasharray = dash;
    // Fully visible, equivalent to offset 0 — avoids a negative-from state.
    path.style.strokeDashoffset = String(len * 2);
    path.style.opacity = "0.78";
    // Force style commit before transitioning (Safari needs the extra frame).
    path.getBoundingClientRect();

    window.requestAnimationFrame(function () {
      window.requestAnimationFrame(function () {
        path.classList.remove("is-drawing");
        path.classList.add("is-absorbing");
        path.style.transition =
          "opacity " +
          absorbMs +
          "ms cubic-bezier(0.33, 0, 0.2, 1)," +
          " stroke-dashoffset " +
          absorbMs +
          "ms cubic-bezier(0.33, 0, 0.2, 1)," +
          " stroke-width " +
          absorbMs +
          "ms cubic-bezier(0.33, 0, 0.2, 1)";
        // Positive L clears from the start → tip last (≡ animating to -L).
        path.style.strokeDashoffset = String(len);
        path.style.opacity = "0";
        path.style.strokeWidth = "0.55";
      });
    });

    window.setTimeout(function () {
      if (path.parentNode) path.parentNode.removeChild(path);
    }, absorbMs + 80);
  }

  function animateFeeds() {
    if (done) return;
    if (!buildSvg()) {
      // Don’t leave the headline stuck in the muted pre-feed state.
      feedTitle();
      return;
    }
    done = true;

    var drawMs = 1650;
    var companyStagger = 140;
    var strokeStagger = 70;
    var earliestTip = Infinity;

    paths.forEach(function (item) {
      var path = item.path;
      var len = path.getTotalLength();
      var thisDraw = drawMs + hash(item.globalIndex) * 80;
      // Gentle cascade — fewer strokes, longer ease for a smoother pour.
      var delay =
        item.companyIndex * companyStagger +
        item.stroke * strokeStagger +
        hash(item.globalIndex + 9) * 24;

      // Tip reaches the title near the end of the draw.
      var tipAt = delay + thisDraw * 0.82;
      if (tipAt < earliestTip) earliestTip = tipAt;

      // Two-value dasharray keeps Safari aligned with Chrome for later absorb.
      path.style.strokeDasharray = len + " " + len;
      path.style.strokeDashoffset = String(len);
      path.style.opacity = "0";

      window.setTimeout(function () {
        path.classList.add("is-drawing");
        path.style.transition =
          "stroke-dashoffset " +
          thisDraw +
          "ms cubic-bezier(0.33, 0, 0.2, 1), opacity 0.55s cubic-bezier(0.33, 0, 0.2, 1)";
        path.getBoundingClientRect();
        path.style.strokeDashoffset = "0";
        path.style.opacity = "0.78";
      }, delay);

      // Absorb just as the tip lands — color becomes the mesh.
      window.setTimeout(function () {
        absorbIntoTitle(item);
      }, tipAt);
    });

    // Wake the mesh as the first brand tips arrive.
    window.setTimeout(feedTitle, Math.max(earliestTip - 40, 180));
  }

  function onResize() {
    // One-shot intro — don’t rebuild after it has played.
    if (done) return;
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(function () {
      buildSvg();
    }, 120);
  }

  function startFeedIntro() {
    // Safety: always reveal the mesh if the intro never completes.
    window.setTimeout(feedTitle, 4200);
    // Start on the next frame — don't wait on fonts.ready (Safari can stall).
    window.requestAnimationFrame(animateFeeds);
  }

  // Wait until the loader hits 100% (pageready) so feed runs under the blur-out.
  if (document.body.classList.contains("is-loading")) {
    document.addEventListener("pageready", startFeedIntro, { once: true });
  } else {
    startFeedIntro();
  }

  window.addEventListener("resize", onResize);
});

// Landing arrow cue: visible on load, fades in/out smoothly as the user
// scrolls through the first 20% of the viewport (one-fifth of a "page").
document.addEventListener("DOMContentLoaded", function () {
  var landingArrow = document.querySelector(".arrowA");
  if (!landingArrow) return;

  var BASE_OPACITY = 0.75;

  function updateLandingArrowVisibility() {
    var fadeRange = Math.max(window.innerHeight * 0.2, 1);
    var progress = Math.min(Math.max(window.scrollY / fadeRange, 0), 1);
    landingArrow.style.opacity = String(BASE_OPACITY * (1 - progress));
    landingArrow.classList.toggle("is-hidden", progress >= 1);
  }

  updateLandingArrowVisibility();
  window.addEventListener("scroll", updateLandingArrowVisibility, {
    passive: true,
  });
  window.addEventListener("resize", updateLandingArrowVisibility);
});

// Nav hamburger: open/close is checkbox-driven (#nav-check) via CSS only.
// Do not toggle a separate .open class on the icon — that desyncs with the
// label/checkbox and glitches the hamburger ↔ X animation.
document.addEventListener("DOMContentLoaded", function () {
  // On mobile, close the dropdown when tapping Experience/Work/About.
  var navCheck = document.getElementById("nav-check");
  if (!navCheck) return;

  function closeMobileNav() {
    navCheck.checked = false;
    navCheck.dispatchEvent(new Event("change", { bubbles: true }));
  }

  // *#experience* / *#work* cover index.html (#section) and aboutme.html (full URL with hash).
  var mobileLinks = document.querySelectorAll(
    '.nav-links-mobile a[href*="#experience"], .nav-links-mobile a[href*="#work"], .nav-links-mobile a[href*="#testimonials"], .nav-links-mobile a[href*="aboutme"]',
  );
  if (!mobileLinks.length) return;

  // Use a single click handler to avoid duplicate closures.
  mobileLinks.forEach(function (a) {
    a.addEventListener("click", function () {
      // Only necessary on mobile breakpoint, but safe even if desktop.
      if (
        window.matchMedia &&
        window.matchMedia("(max-width: 1120px)").matches
      ) {
        closeMobileNav();
      }
    });
  });
});

// Drag functionality for polaroids
document.addEventListener("DOMContentLoaded", function () {
  const polaroids = document.querySelectorAll(".polaroid");
  const gallery = document.querySelector(".polaroid-gallery");

  let draggedElement = null;
  let offsetX = 0;
  let offsetY = 0;
  let currentRotation = 0;

  polaroids.forEach((polaroid) => {
    // Get initial rotation from CSS variable or transform
    const computedStyle = window.getComputedStyle(polaroid);
    const rotationValue = computedStyle.getPropertyValue("--target-rotation");

    if (rotationValue) {
      // Extract degrees from CSS variable (e.g., "-8deg" -> -8)
      const match = rotationValue.match(/(-?\d+\.?\d*)deg/);
      if (match) {
        polaroid.dataset.rotation = parseFloat(match[1]);
      }
    } else {
      // Fallback: get from transform
      const transform = computedStyle.transform;
      if (transform && transform !== "none") {
        const values = transform.split("(")[1].split(")")[0].split(",");
        const a = parseFloat(values[0]);
        const b = parseFloat(values[1]);
        polaroid.dataset.rotation = Math.round(
          Math.atan2(b, a) * (180 / Math.PI),
        );
      }
    }

    // Mouse events
    polaroid.addEventListener("mousedown", startDrag);

    // Touch events for mobile
    polaroid.addEventListener("touchstart", startDrag, { passive: false });
  });

  function startDrag(e) {
    e.preventDefault();
    draggedElement = e.currentTarget;
    draggedElement.classList.add("dragging");

    const rect = draggedElement.getBoundingClientRect();
    const galleryRect = gallery.getBoundingClientRect();

    // Calculate offset from mouse/touch to element's top-left corner
    if (e.type === "touchstart") {
      offsetX = e.touches[0].clientX - rect.left;
      offsetY = e.touches[0].clientY - rect.top;
    } else {
      offsetX = e.clientX - rect.left;
      offsetY = e.clientY - rect.top;
    }

    // Get current rotation from data attribute or transform
    if (draggedElement.dataset.rotation !== undefined) {
      currentRotation = parseFloat(draggedElement.dataset.rotation);
    } else {
      const computedStyle = window.getComputedStyle(draggedElement);
      const transform = computedStyle.transform;
      if (transform && transform !== "none") {
        const values = transform.split("(")[1].split(")")[0].split(",");
        const a = parseFloat(values[0]);
        const b = parseFloat(values[1]);
        currentRotation = Math.round(Math.atan2(b, a) * (180 / Math.PI));
        draggedElement.dataset.rotation = currentRotation;
      }
    }

    // Add event listeners for dragging
    document.addEventListener("mousemove", drag);
    document.addEventListener("mouseup", stopDrag);
    document.addEventListener("touchmove", drag, { passive: false });
    document.addEventListener("touchend", stopDrag);
  }

  function drag(e) {
    if (!draggedElement) return;

    e.preventDefault();

    const galleryRect = gallery.getBoundingClientRect();
    let clientX, clientY;

    if (e.type === "touchmove") {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    // Calculate new position relative to gallery
    let newX = clientX - galleryRect.left - offsetX;
    let newY = clientY - galleryRect.top - offsetY;

    // Get element dimensions
    const elementRect = draggedElement.getBoundingClientRect();
    const elementWidth = elementRect.width;
    const elementHeight = elementRect.height;

    // Constrain within gallery bounds
    newX = Math.max(0, Math.min(newX, galleryRect.width - elementWidth));
    newY = Math.max(0, Math.min(newY, galleryRect.height - elementHeight));

    // Apply position and rotation
    draggedElement.style.left = newX + "px";
    draggedElement.style.top = newY + "px";
    draggedElement.style.right = "auto";
    draggedElement.style.bottom = "auto";
    draggedElement.style.transform = `rotate(${currentRotation}deg)`;
  }

  function stopDrag() {
    if (draggedElement) {
      draggedElement.classList.remove("dragging");
      draggedElement = null;
    }

    // Remove event listeners
    document.removeEventListener("mousemove", drag);
    document.removeEventListener("mouseup", stopDrag);
    document.removeEventListener("touchmove", drag);
    document.removeEventListener("touchend", stopDrag);
  }
});

// Shared image/video modal (index + about me)
function openModal(source) {
  const modal = document.querySelector(".modal");
  const modalImage = modal.querySelector(".modal-img");
  const modalVideo = modal.querySelector(".modal-video");
  if (!modal) return;

  const isVideo = source.tagName === "VIDEO";
  const src = typeof source === "string" ? source : source.src;

  if (isVideo) {
    modalVideo.src = src;
    modalVideo.style.display = "block";
    modalImage.style.display = "none";
    modalImage.src = "";
    modalVideo.play();
  } else {
    modalImage.src = src;
    modalImage.style.display = "block";
    modalVideo.style.display = "none";
    modalVideo.src = "";
  }

  modal.classList.add("active");
  history.pushState({ imageModalOpen: true }, "", window.location.href);
  var scrollY = window.scrollY || window.pageYOffset;
  document.body.dataset.scrollY = String(scrollY);
  document.body.style.top = "-" + scrollY + "px";
  document.body.classList.add("image-modal-open");
  document.documentElement.classList.add("image-modal-open");
}

function closeModal(event) {
  const modal = document.querySelector(".modal");
  if (!modal) return;
  if (!modal.classList.contains("active")) return;
  if (event && event.key && event.key !== "Escape") return;
  if (event && event.target !== modal && !event.key) return;
  const modalVideo = modal.querySelector(".modal-video");
  if (modalVideo) {
    modalVideo.pause();
    modalVideo.src = "";
  }
  modal.classList.remove("active");
  if (history.state && history.state.imageModalOpen) {
    var url =
      window.location.pathname +
      window.location.search +
      (window.location.hash || "");
    history.replaceState({}, "", url);
  }
  var scrollY = parseInt(document.body.dataset.scrollY || "0", 10);
  var html = document.documentElement;
  var prevScrollBehavior = html.style.scrollBehavior;
  html.style.scrollBehavior = "auto";
  document.body.classList.remove("image-modal-open");
  document.body.style.top = "";
  document.body.style.overflow = "";
  delete document.body.dataset.scrollY;
  document.documentElement.classList.remove("image-modal-open");
  document.documentElement.scrollTop = document.body.scrollTop = scrollY;
  html.style.scrollBehavior = prevScrollBehavior;
}

// Work case study modals (beacon, timeline, applemusic, deltahacks, instagram PDF)
function openWorkModal(triggerOrProject) {
  const workModal = document.getElementById("work-modal");
  const container =
    workModal && workModal.querySelector(".work-modal-container");
  if (!workModal || !container) return;
  var src;
  if (
    typeof triggerOrProject === "object" &&
    triggerOrProject &&
    triggerOrProject.getAttribute
  ) {
    src =
      triggerOrProject.getAttribute("data-work-modal-src") ||
      "Work/" + triggerOrProject.getAttribute("data-work-modal") + "/home.html";
  } else {
    src = "Work/" + triggerOrProject + "/home.html";
  }
  var oldIframe = container.querySelector(".work-modal-iframe");
  var iframe = document.createElement("iframe");
  iframe.className = "work-modal-iframe";
  iframe.title = "Work case study";
  iframe.setAttribute("tabindex", "-1");
  // Use srcdoc + location.replace so the iframe's initial about:blank history
  // entry is replaced by the case study URL. This avoids Safari/WebKit showing
  // about:blank inside the iframe when the user presses Back.
  var escapedSrc = src.replace(/"/g, "&quot;");
  iframe.setAttribute(
    "srcdoc",
    '<!doctype html><html><head><meta charset="utf-8"></head><body><script>location.replace("' +
      escapedSrc +
      '")</' +
      "script></body></html>",
  );
  if (oldIframe) oldIframe.replaceWith(iframe);
  else container.appendChild(iframe);
  workModal.classList.add("active");
  workModal.setAttribute("aria-hidden", "false");
  var baseUrl = window.location.pathname + window.location.search;
  if (!baseUrl || window.location.href === "about:blank") baseUrl = "/";
  var currentUrl = baseUrl + (window.location.hash || "");
  history.replaceState({}, "", currentUrl);
  history.pushState({ workModalOpen: true }, "", currentUrl);
  var scrollY = window.scrollY || window.pageYOffset;
  document.body.style.overflow = "hidden";
  document.body.dataset.scrollY = String(scrollY);
  document.body.style.top = "-" + scrollY + "px";
  document.body.classList.add("work-modal-open");
  document.documentElement.classList.add("work-modal-open");
  var closeBtn = workModal.querySelector(".work-modal-close");
  if (closeBtn)
    setTimeout(function () {
      closeBtn.focus();
    }, 0);
}

function closeWorkModal(event) {
  const workModal = document.getElementById("work-modal");
  if (!workModal) return;
  if (!workModal.classList.contains("active")) return;
  if (event && event.key && event.key !== "Escape") return;
  if (event && event.type === "click") {
    if (
      !event.target.classList.contains("work-modal-backdrop") &&
      !event.target.closest(".work-modal-close")
    )
      return;
  }
  workModal.classList.remove("active");
  workModal.setAttribute("aria-hidden", "true");
  var iframe = workModal.querySelector(".work-modal-iframe");
  if (iframe) iframe.src = "";
  if (history.state && history.state.workModalOpen) {
    var baseUrl = window.location.pathname + window.location.search;
    history.replaceState({}, "", baseUrl + (window.location.hash || ""));
  }
  var scrollY = parseInt(document.body.dataset.scrollY || "0", 10);
  var html = document.documentElement;
  var prevScrollBehavior = html.style.scrollBehavior;
  html.style.scrollBehavior = "auto";
  document.body.classList.remove("work-modal-open");
  document.body.style.top = "";
  document.body.style.overflow = "";
  delete document.body.dataset.scrollY;
  document.documentElement.classList.remove("work-modal-open");
  document.documentElement.scrollTop = document.body.scrollTop = scrollY;
  html.style.scrollBehavior = prevScrollBehavior;
}

document.addEventListener("DOMContentLoaded", function () {
  anchorHistory(); // Re-anchor in Safari/WebKit after load
  document.querySelectorAll("[data-work-modal]").forEach(function (trigger) {
    trigger.addEventListener("click", function (e) {
      e.preventDefault();
      openWorkModal(this);
    });
  });

  var workModal = document.getElementById("work-modal");
  if (workModal) {
    workModal
      .querySelector(".work-modal-backdrop")
      .addEventListener("click", closeWorkModal);
    var closeBtn = workModal.querySelector(".work-modal-close");
    if (closeBtn) closeBtn.addEventListener("click", closeWorkModal);
  }
});

// Hold B + click to interact with mesh background
(function () {
  var bHeld = false;
  var meshBg = null;
  var focusPoll = null;
  var releaseWatchdog = null;
  // Browser key-repeat fires keydown ~30-60ms while a key is held. If no
  // repeats arrive for this long, B has been released.
  var RELEASE_WATCHDOG_MS = 600;

  function bumpReleaseWatchdog() {
    if (releaseWatchdog) clearTimeout(releaseWatchdog);
    releaseWatchdog = setTimeout(deactivate, RELEASE_WATCHDOG_MS);
  }

  function startFocusPoll() {
    if (focusPoll) clearInterval(focusPoll);
    // When the user clicks the cross-origin mesh iframe, focus moves into it
    // and the parent stops receiving key-repeats / keyup. Reclaim focus on a
    // short interval so the watchdog can still detect B release. Mouse
    // capture is independent of focus, so the drag interaction continues.
    focusPoll = setInterval(function () {
      if (!bHeld) {
        clearInterval(focusPoll);
        focusPoll = null;
        return;
      }
      if (document.activeElement === meshBg) {
        try {
          window.focus();
        } catch (_) {}
      }
    }, 100);
  }

  function activate() {
    if (meshBg) {
      meshBg.style.zIndex = "2";
      meshBg.style.pointerEvents = "auto";
    }
    document.documentElement.classList.add("mesh-grab");
    startFocusPoll();
    bumpReleaseWatchdog();
  }

  function deactivate() {
    bHeld = false;
    if (meshBg) {
      meshBg.style.zIndex = "";
      meshBg.style.pointerEvents = "";
    }
    document.documentElement.classList.remove("mesh-grab");
    if (focusPoll) {
      clearInterval(focusPoll);
      focusPoll = null;
    }
    if (releaseWatchdog) {
      clearTimeout(releaseWatchdog);
      releaseWatchdog = null;
    }
    try {
      window.focus();
    } catch (_) {}
  }

  document.addEventListener("DOMContentLoaded", function () {
    meshBg = document.querySelector(".mesh-bg");
  });

  // Capture phase on window so nothing can swallow the key event before us.
  window.addEventListener(
    "keydown",
    function (e) {
      if (e.key !== "b" && e.key !== "B") return;
      var t = e.target;
      if (
        t &&
        (t.tagName === "INPUT" ||
          t.tagName === "TEXTAREA" ||
          t.isContentEditable)
      ) {
        return;
      }
      // A real new key press (!repeat) must always arm grab mode. If the iframe
      // had focus, we often miss keyup and bHeld stays true; the old "only when
      // !bHeld" branch then ignored the first new press and felt like "B twice".
      if (!e.repeat) {
        bHeld = true;
        activate();
      } else if (bHeld) {
        bumpReleaseWatchdog();
      }
    },
    true,
  );

  window.addEventListener(
    "keyup",
    function (e) {
      if (e.key === "b" || e.key === "B") deactivate();
    },
    true,
  );

  window.addEventListener("blur", function () {
    setTimeout(function () {
      // Iframe focus is fine — that's just the user grabbing the mesh, and
      // the focus poll will reclaim. Real focus loss (alt-tab, devtools)
      // means activeElement is body/null and document.hasFocus() is false.
      if (document.activeElement === meshBg) return;
      if (!document.hasFocus()) deactivate();
    }, 250);
  });

  document.addEventListener("visibilitychange", function () {
    if (document.hidden) deactivate();
  });
})();

document.addEventListener("keydown", function (event) {
  if (event.key === "Escape") {
    var workModal = document.getElementById("work-modal");
    if (workModal && workModal.classList.contains("active")) {
      closeWorkModal(event);
      return;
    }
    var modal = document.querySelector(".modal.active");
    if (modal) closeModal(event);
  }
});

// Browser back button closes iframe/work modal or image modal
function handleBackNavigation() {
  var workModal = document.getElementById("work-modal");
  if (workModal && workModal.classList.contains("active")) {
    closeWorkModal();
    return;
  }
  var modal = document.querySelector(".modal.active");
  if (modal) closeModal();
}

window.addEventListener("popstate", handleBackNavigation);
