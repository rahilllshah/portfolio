// Nav hamburger toggle (nav is inlined in index.html and aboutme.html)
document.addEventListener("DOMContentLoaded", function () {
  var icon = document.getElementById("nav-icon");
  if (icon && window.$) {
    $(icon).click(function () {
      $(this).toggleClass("open");
    });
  }
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
          Math.atan2(b, a) * (180 / Math.PI)
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
  document.body.style.overflow = "hidden";
}

function closeModal(event) {
  const modal = document.querySelector(".modal");
  if (!modal) return;
  if (event && event.key && event.key !== "Escape") return;
  if (event && event.target !== modal && !event.key) return;
  modal.classList.remove("active");
  document.body.style.overflow = "";
}

// Work case study modals (cantrace, timeline, applemusic, deltahacks, instagram PDF)
function openWorkModal(triggerOrProject) {
  const workModal = document.getElementById("work-modal");
  const iframe = workModal && workModal.querySelector(".work-modal-iframe");
  if (!workModal || !iframe) return;
  var src;
  if (typeof triggerOrProject === "object" && triggerOrProject && triggerOrProject.getAttribute) {
    src = triggerOrProject.getAttribute("data-work-modal-src") || ("Work/" + triggerOrProject.getAttribute("data-work-modal") + "/home.html");
  } else {
    src = "Work/" + triggerOrProject + "/home.html";
  }
  iframe.src = src;
  workModal.classList.add("active");
  workModal.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
  document.documentElement.classList.add("work-modal-open");
}

function closeWorkModal(event) {
  const workModal = document.getElementById("work-modal");
  if (!workModal) return;
  if (event && event.key && event.key !== "Escape") return;
  if (event && event.type === "click") {
    if (!event.target.classList.contains("work-modal-backdrop") && !event.target.closest(".work-modal-close")) return;
  }
  workModal.classList.remove("active");
  workModal.setAttribute("aria-hidden", "true");
  var iframe = workModal.querySelector(".work-modal-iframe");
  if (iframe) iframe.src = "";
  document.body.style.overflow = "";
  document.documentElement.classList.remove("work-modal-open");
}

document.addEventListener("DOMContentLoaded", function () {
  document.querySelectorAll("[data-work-modal]").forEach(function (trigger) {
    trigger.addEventListener("click", function (e) {
      e.preventDefault();
      openWorkModal(this);
    });
  });

  var workModal = document.getElementById("work-modal");
  if (workModal) {
    workModal.querySelector(".work-modal-backdrop").addEventListener("click", closeWorkModal);
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

// Case study nav: highlight active section on scroll
document.addEventListener("DOMContentLoaded", function () {
  var nav = document.querySelector(".case-study-nav");
  if (!nav) return;
  var links = nav.querySelectorAll('a[href^="#"]');
  var sectionIds = Array.from(links).map(function (a) {
    return a.getAttribute("href").slice(1);
  });
  var activeThreshold = 120;

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
