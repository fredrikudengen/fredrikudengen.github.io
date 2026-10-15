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

// «Til toppen»-knapp nede i høyre hjørne, vises når man har scrollet forbi første skjerm
(function () {
  var button = document.createElement("button");
  button.type = "button";
  button.className = "to-top";
  button.innerHTML = '<span aria-hidden="true">↑</span> Til toppen';
  document.body.appendChild(button);

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  button.addEventListener("click", function () {
    window.scrollTo({ top: 0, behavior: reduceMotion.matches ? "auto" : "smooth" });
    var brand = document.querySelector(".brand");
    if (brand) brand.focus({ preventScroll: true });
  });

  var ticking = false;
  function update() {
    button.classList.toggle("is-visible", window.scrollY > window.innerHeight * 0.6);
    ticking = false;
  }
  window.addEventListener("scroll", function () {
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(update);
    }
  }, { passive: true });
  update();
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

// Respekter prefers-reduced-motion: ikke autoplay loopende videoer
(function () {
  var videos = document.querySelectorAll("video[autoplay]");
  if (!videos.length) return;

  if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  videos.forEach(function (video) {
    video.removeAttribute("autoplay");
    video.pause();
    video.load();
  });
})();
