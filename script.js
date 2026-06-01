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

// Reel — plays 3 Lottie clips back-to-back on a loop.
// Progress bar auto-tracks across the combined timeline and stays scrubbable.
document.addEventListener("DOMContentLoaded", function () {
  var container = document.querySelector(".reel-lottie");
  var progress = document.querySelector(".reel-progress");
  var fill = document.querySelector(".reel-progress-fill");
  if (!container || !progress || !fill || typeof lottie === "undefined") return;

  var sources = (container.getAttribute("data-clips") || "")
    .split(",")
    .map(function (s) {
      return s.trim();
    })
    .filter(Boolean);
  if (!sources.length) return;

  var reelFrame = container.closest(".reel-frame");

  var clips = []; // { data, frames, duration }
  var totalDuration = 0;
  var currentIndex = 0;
  var anim = null;
  var isScrubbing = false;
  var playbackStarted = false;

  function setFill(pct) {
    fill.style.width = pct + "%";
    progress.setAttribute("aria-valuenow", String(Math.round(pct)));
  }

  // seconds elapsed before clip i starts
  function offsetBefore(i) {
    var s = 0;
    for (var k = 0; k < i; k++) s += clips[k].duration;
    return s;
  }

  function updateProgress() {
    if (isScrubbing || !anim || !totalDuration) return;
    var clip = clips[currentIndex];
    var within = clip.frames ? (anim.currentFrame / clip.frames) * clip.duration : 0;
    setFill(((offsetBefore(currentIndex) + within) / totalDuration) * 100);
  }

  // Load clip i into the container; optionally seek to a starting frame.
  // Pass autoplay=false to render the first frame but stay paused.
  function playClip(i, fromFrame, autoplay) {
    if (autoplay === undefined) autoplay = true;
    currentIndex = i;
    if (anim) anim.destroy();
    anim = lottie.loadAnimation({
      container: container,
      renderer: "svg",
      loop: false,
      autoplay: false,
      animationData: clips[i].data,
      rendererSettings: { preserveAspectRatio: "xMidYMid slice" },
    });
    anim.addEventListener("DOMLoaded", function () {
      // Always render the starting frame so the reel is never blank/black.
      if (autoplay) anim.goToAndPlay(fromFrame || 0, true);
      else anim.goToAndStop(fromFrame || 0, true);
    });
    anim.addEventListener("enterFrame", updateProgress);
    anim.addEventListener("complete", function () {
      playClip((i + 1) % clips.length, 0); // chain to next, wrap to loop
    });
  }

  // Scrubbing: ratio is computed from pointer X within the bar's bounding box
  function ratioFromEvent(e) {
    var rect = progress.getBoundingClientRect();
    var r = (e.clientX - rect.left) / rect.width;
    if (r < 0) r = 0;
    if (r > 1) r = 1;
    return r;
  }

  function seekTo(e) {
    if (!totalDuration) return;
    var ratio = ratioFromEvent(e);
    var target = ratio * totalDuration; // seconds into the combined timeline
    var i = 0;
    var acc = 0;
    while (i < clips.length - 1 && acc + clips[i].duration <= target) {
      acc += clips[i].duration;
      i++;
    }
    var within = target - acc;
    var frame = clips[i].duration
      ? (within / clips[i].duration) * clips[i].frames
      : 0;
    setFill(ratio * 100); // drive fill directly so it never lags the cursor
    if (i !== currentIndex) {
      playClip(i, frame);
    } else if (anim) {
      anim.goToAndPlay(frame, true);
    }
  }

  progress.addEventListener("pointerdown", function (e) {
    if (e.button != null && e.button !== 0) return;
    if (!clips.length) return;
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

  document.addEventListener("visibilitychange", function () {
    if (!anim || !playbackStarted) return;
    if (document.hidden) anim.pause();
    else if (!isScrubbing) anim.play();
  });

  function startReel() {
    playbackStarted = true;
    // First clip is already rendered (paused on frame 1) — just play it.
    if (anim && currentIndex === 0) anim.play();
    else playClip(0, 0, true);
  }

  // Fetch all clips up front so we know each duration (needed for the combined
  // progress bar / scrubbing), then begin once the reel is in view.
  Promise.all(
    sources.map(function (src) {
      return fetch(src).then(function (r) {
        return r.json();
      });
    }),
  )
    .then(function (datas) {
      clips = datas.map(function (data) {
        var frames = (data.op || 0) - (data.ip || 0);
        var fr = data.fr || 30;
        return { data: data, frames: frames, duration: frames / fr };
      });
      totalDuration = clips.reduce(function (s, c) {
        return s + c.duration;
      }, 0);

      // Render the first frame right away so the reel shows artwork, not black.
      playClip(0, 0, false);

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
                startReel();
                reelObserver.disconnect();
              }
            });
          },
          { threshold: 0.5 },
        );
        reelObserver.observe(reelFrame || container);
      } else {
        startReel();
      }
    })
    .catch(function () {});
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

// Nav hamburger toggle (nav is inlined in index.html and aboutme.html)
document.addEventListener("DOMContentLoaded", function () {
  var icon = document.getElementById("nav-icon");
  if (icon) {
    icon.addEventListener("click", function () {
      icon.classList.toggle("open");
    });
  }

  // On mobile, close the dropdown when tapping Experience/Work/About.
  // Mobile nav open/close is driven by the checkbox (#nav-check) via CSS.
  var navCheck = document.getElementById("nav-check");
  if (!navCheck) return;

  function closeMobileNav() {
    navCheck.checked = false;
    navCheck.dispatchEvent(new Event("change", { bubbles: true }));
    if (icon) icon.classList.remove("open");
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

// Case study in-page nav: highlight active section on scroll + use replaceState so Back closes modal once
document.addEventListener("DOMContentLoaded", function () {
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
