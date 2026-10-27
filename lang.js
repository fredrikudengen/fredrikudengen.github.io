// Språkvalg (norsk/engelsk). Lastes i <head> så riktig språk er satt før siden tegnes.
// Tekst merkes med lang="no" / lang="en", og style.css skjuler det språket som ikke er valgt.
// Attributter (alt, aria-label, title) kan ikke skjules med CSS, så de oversettes med
// data-en-alt="..." osv., og sidetittelen med data-en-title på <html>.
(function () {
  var KEY = "lang";
  var ATTRS = ["alt", "aria-label", "title"];
  var root = document.documentElement;
  var listeners = [];
  // Uten lagret valg følger siden nettleserspråket: norsk (no/nb/nn) gir norsk, alt annet engelsk
  function browserLang() {
    var langs = navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || ""];
    var first = String(langs[0] || "").toLowerCase().split("-")[0];
    return ["no", "nb", "nn"].indexOf(first) !== -1 ? "no" : "en";
  }

  var lang = browserLang();
  try {
    var stored = localStorage.getItem(KEY);
    if (stored === "en" || stored === "no") lang = stored;
  } catch (e) {}

  root.setAttribute("data-lang", lang);
  root.lang = lang;

  var titleNo = null;
  var button = null;

  function applyAttrs() {
    ATTRS.forEach(function (attr) {
      document.querySelectorAll("[data-en-" + attr + "]").forEach(function (el) {
        if (!el.hasAttribute("data-no-" + attr)) {
          el.setAttribute("data-no-" + attr, el.getAttribute(attr) || "");
        }
        el.setAttribute(attr, el.getAttribute("data-" + lang + "-" + attr));
      });
    });

    var titleEn = root.getAttribute("data-en-title");
    if (titleEn) {
      if (titleNo === null) titleNo = document.title;
      document.title = lang === "en" ? titleEn : titleNo;
    }
  }

  function updateButton() {
    if (!button) return;
    button.textContent = lang === "en" ? "Norsk" : "English";
    button.setAttribute("aria-label", lang === "en" ? "Bytt til norsk" : "Switch to English");
  }

  function set(next) {
    lang = next === "en" ? "en" : "no";
    root.setAttribute("data-lang", lang);
    root.lang = lang;
    try {
      localStorage.setItem(KEY, lang);
    } catch (e) {}
    applyAttrs();
    updateButton();
    listeners.forEach(function (fn) { fn(lang); });
  }

  // Lager <span lang="no">…</span><span lang="en">…</span> for tekst som bygges i JS
  function text(no, en) {
    var frag = document.createDocumentFragment();
    [["no", no], ["en", en]].forEach(function (pair) {
      var span = document.createElement("span");
      span.lang = pair[0];
      span.textContent = pair[1];
      frag.appendChild(span);
    });
    return frag;
  }

  window.siteLang = {
    get: function () { return lang; },
    set: set,
    text: text,
    onChange: function (fn) { listeners.push(fn); },
  };

  document.addEventListener("DOMContentLoaded", function () {
    var nav = document.querySelector(".nav");
    if (nav) {
      button = document.createElement("button");
      button.type = "button";
      button.className = "lang-toggle";
      button.addEventListener("click", function () {
        set(lang === "en" ? "no" : "en");
      });
      nav.appendChild(button);
      updateButton();
    }
    applyAttrs();
  });
})();
