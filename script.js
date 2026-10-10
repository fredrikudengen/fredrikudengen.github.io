(function () {
  var els = document.querySelectorAll(".reveal");
  if (!els.length) return;

  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    els.forEach(function (el) { el.classList.add("is-visible"); });
    return;
  }

  var observer = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.15, rootMargin: "0px 0px -40px 0px" }
  );

  els.forEach(function (el, i) {
    el.style.transitionDelay = (i % 4) * 80 + "ms";
    observer.observe(el);
  });
})();

// Plassholder for bilder/videoer som ikke er lagt til ennå (kalles via onerror="")
function handleMediaError(el) {
  if (!el?.parentNode || el.dataset.placeholderApplied) return;
  el.dataset.placeholderApplied = "true";

  var box = document.createElement("div");
  box.className = "media-placeholder";

  var width = el.getAttribute("width");
  var height = el.getAttribute("height");
  if (width && height) {
    box.style.aspectRatio = width + " / " + height;
  }

  box.textContent = el.getAttribute("alt") || el.getAttribute("aria-label") || "Media mangler";
  el.parentNode.replaceChild(box, el);
}

// Pause loopende videoer utenfor viewport, og respekter prefers-reduced-motion
(function () {
  var videos = document.querySelectorAll("video[autoplay]");
  if (!videos.length) return;

  var reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (reducedMotion) {
    videos.forEach(function (video) {
      video.removeAttribute("autoplay");
      video.pause();
      video.load();
    });
    return;
  }

  if (!("IntersectionObserver" in window)) return;

  var observer = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (entry) {
        var video = entry.target;
        if (entry.isIntersecting) {
          video.play().catch(function () {});
        } else {
          video.pause();
        }
      });
    },
    { threshold: 0.25 }
  );

  videos.forEach(function (video) { observer.observe(video); });
})();
