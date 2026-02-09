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
