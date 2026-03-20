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

// Size landing "me" image to landing content height (title + sub + button) so image doesn't change with viewport width
document.addEventListener("DOMContentLoaded", function () {
  var landingContent = document.querySelector(".landing-content");
  var meWrapper = document.querySelector(".me-wrapper");
  if (!landingContent || !meWrapper) return;

  function sizeMeToContent() {
    if (window.innerWidth < 992) {
      meWrapper.style.height = "";
      return;
    }
    var h = landingContent.getBoundingClientRect().height;
    meWrapper.style.height = h + "px";
  }

  sizeMeToContent();
  var ro = new ResizeObserver(sizeMeToContent);
  ro.observe(landingContent);
  window.addEventListener("resize", sizeMeToContent);
});

// Nav hamburger toggle (nav is inlined in index.html and aboutme.html)
document.addEventListener("DOMContentLoaded", function () {
  var icon = document.getElementById("nav-icon");
  if (icon && window.$) {
    $(icon).click(function () {
      $(this).toggleClass("open");
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
    '.nav-links-mobile a[href*="#experience"], .nav-links-mobile a[href*="#work"], .nav-links-mobile a[href*="aboutme"]',
  );
  if (!mobileLinks.length) return;

  // Use a single click handler to avoid duplicate closures.
  mobileLinks.forEach(function (a) {
    a.addEventListener("click", function () {
      // Only necessary on mobile breakpoint, but safe even if desktop.
      if (window.matchMedia && window.matchMedia("(max-width: 1120px)").matches) {
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

// Shared image modal (index + about me)
// openModal(source): source = <img> element or string URL
function openModal(source) {
  const modal = document.querySelector(".modal");
  const modalImage = document.querySelector(".modal .modal-content");
  if (!modal || !modalImage) return;
  modalImage.src = typeof source === "string" ? source : source.src;
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

// Work case study modals (cantrace, timeline, applemusic, deltahacks, instagram PDF)
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
