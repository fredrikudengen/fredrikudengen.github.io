// Felles innlasting for anmeldelsessider:
//   <script src="../review.js" data-kind="books" data-slug="meditations"></script>
// Henter resources/<kind>/<slug>.html og, hvis den finnes, <slug>.en.html.
(function () {
  var script = document.currentScript;
  var kind = script.dataset.kind;
  var slug = script.dataset.slug;
  var t = window.siteLang.text;
  var body = document.getElementById("review-body");
  var base = "../resources/" + kind + "/" + slug;

  function get(url) {
    return fetch(url).then(function (r) {
      if (!r.ok) throw new Error(r.status);
      return r.text();
    });
  }

  Promise.all([get(base + ".html"), get(base + ".en.html").catch(function () { return null; })])
    .then(function (res) {
      body.textContent = "";
      var no = document.createElement("div");
      no.innerHTML = res[0];

      if (res[1] !== null) {
        no.lang = "no";
        var en = document.createElement("div");
        en.lang = "en";
        en.innerHTML = res[1];
        body.appendChild(no);
        body.appendChild(en);
      } else {
        // Ingen engelsk versjon ennå: vis den norske på begge språk. "nb" er riktig
        // språkkode for skjermlesere, men treffes ikke av skjuleregelen for lang="no".
        no.lang = "nb";
        var note = document.createElement("p");
        note.lang = "en";
        note.className = "subtitle";
        note.textContent = "This review is only available in Norwegian so far.";
        body.appendChild(note);
        body.appendChild(no);
      }
    })
    .catch(function () {
      body.textContent = "";
      var p = document.createElement("p");
      p.appendChild(t("Kunne ikke laste anmeldelsen.", "Could not load the review."));
      body.appendChild(p);
    });

  fetch("../resources/meta.json")
    .then(function (r) { return r.json(); })
    .then(function (meta) {
      var entry = (meta[kind] || {})[slug];
      if (!entry) return;
      var labels = {
        forfatter: ["Forfatter", "Author"],
        regissor: ["Regissør", "Director"],
        dato: ["Lest/sett", kind === "books" ? "Read" : "Watched"],
      };
      var order = ["forfatter", "regissor", "aar", "dato"];
      var el = document.getElementById("review-meta");
      order.forEach(function (key) {
        var value = entry[key];
        if (!value) return;
        // Felt som <key>_en (f.eks. "aar_en": "180 AD") overstyrer verdien på engelsk
        var valueEn = entry[key + "_en"] || value;
        var span = document.createElement("span");
        span.className = "chip";
        if (key === "aar") {
          span.appendChild(t(value, valueEn));
        } else {
          span.appendChild(t(labels[key][0] + ": " + value, labels[key][1] + ": " + valueEn));
        }
        el.appendChild(span);
      });
    })
    .catch(function () {});
})();
