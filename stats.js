// Filmstatistikk fra resources/stats.json (laget av build_stats.py fra Letterboxd-eksporten)
(function () {
  var root = document.getElementById("film-stats");
  if (!root) return;

  var tiles = document.getElementById("stat-tiles");
  var charts = document.getElementById("stat-charts");

  function fmt(n, digits) {
    return n.toLocaleString(siteLang.get() === "en" ? "en-GB" : "nb-NO", {
      minimumFractionDigits: digits || 0,
      maximumFractionDigits: digits || 0,
    });
  }

  function tile(value, no, en) {
    var box = document.createElement("div");
    box.className = "stat-tile";
    var dd = document.createElement("dd");
    dd.textContent = value;
    var dt = document.createElement("dt");
    dt.appendChild(siteLang.text(no, en));
    box.appendChild(dd);
    box.appendChild(dt);
    tiles.appendChild(box);
  }

  // Søylediagram med div-er. rows: [{label, value, shown?}]. Høyden er relativ til største verdi.
  function barChart(titleNo, titleEn, rows, opts) {
    opts = opts || {};
    var from = opts.min || 0;
    var max = Math.max.apply(null, rows.map(function (r) { return r.value || 0; })) || 1;
    var figure = document.createElement("figure");
    figure.className = "stat-chart";

    var cap = document.createElement("figcaption");
    cap.appendChild(siteLang.text(titleNo, titleEn));
    figure.appendChild(cap);

    var bars = document.createElement("div");
    bars.className = "bars";
    bars.setAttribute("role", "img");
    bars.setAttribute("aria-label", rows.map(function (r) {
      return r.label + ": " + (r.shown != null ? r.shown : r.value);
    }).join(", "));

    rows.forEach(function (r) {
      var col = document.createElement("div");
      col.className = "bar-col";
      var val = document.createElement("span");
      val.className = "bar-value";
      val.textContent = r.shown != null ? r.shown : r.value;
      var bar = document.createElement("span");
      bar.className = "bar";
      bar.style.height = Math.max(2, ((r.value - from) / (max - from)) * 100) + "%";
      var label = document.createElement("span");
      label.className = "bar-label";
      label.textContent = r.label;
      col.appendChild(val);
      col.appendChild(bar);
      col.appendChild(label);
      bars.appendChild(col);
    });
    figure.appendChild(bars);
    charts.appendChild(figure);
  }

  function render(s) {
    tiles.textContent = "";
    charts.textContent = "";
    var t = s.totals;
    tile(fmt(t.watched), "filmer sett", "films watched");
    tile(fmt(t.rated), "med rating", "rated");
    tile(fmt(t.average, 2), "snittkarakter", "average rating");
    tile(fmt(t.five_star), "femmere", "five-star films");

    barChart("Filmer sett per år", "Films watched per year",
      s.per_year.map(function (y) { return { label: String(y.year), value: y.count }; }));

    var avgRows = s.per_year.filter(function (y) { return y.average != null; });
    barChart("Snittkarakter per år", "Average rating per year",
      avgRows.map(function (y) { return { label: String(y.year), value: y.average, shown: fmt(y.average, 2) }; }),
      { min: 3 });

    barChart("Karakterfordeling", "Rating distribution",
      s.ratings.map(function (r) { return { label: fmt(r.rating, r.rating % 1 ? 1 : 0), value: r.count }; }));

    barChart("Filmer etter tiår", "Films by decade of release",
      s.decades.map(function (d) { return { label: String(d.decade).slice(2) + "s", value: d.count }; }));
  }

  fetch("resources/stats.json")
    .then(function (r) {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    })
    .then(function (s) {
      render(s);
      root.hidden = false;
      siteLang.onChange(function () { render(s); });
    })
    .catch(function () { /* uten statistikk skjules seksjonen */ });
})();
