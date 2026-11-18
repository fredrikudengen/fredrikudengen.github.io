// Filmstatistikk fra resources/stats.json (laget av build_stats.py fra Letterboxd-eksporten)
(function () {
  var root = document.getElementById("film-stats");
  if (!root) return;

  var tiles = document.getElementById("stat-tiles");
  var charts = document.getElementById("stat-charts");
  var detail = document.getElementById("stat-detail");
  var selected = null; // søylen som er åpnet

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

  function closeDetail() {
    selected = null;
    detail.hidden = true;
    detail.textContent = "";
    root.querySelectorAll(".bar-col[aria-pressed='true']").forEach(function (b) {
      b.setAttribute("aria-pressed", "false");
    });
  }

  function filmItem(f, showDate) {
    var li = document.createElement("li");
    li.className = "film-item";

    var title = document.createElement("span");
    title.className = "film-title";
    title.textContent = f.t;
    li.appendChild(title);

    var meta = document.createElement("span");
    meta.className = "film-meta";
    var bits = [];
    if (f.y) bits.push(f.y);
    if (showDate && f.d) bits.push(f.d.split("-").reverse().join("."));
    if (f.r != null) bits.push("★ " + fmt(f.r, f.r % 1 ? 1 : 0));
    if (f.rw) bits.push(siteLang.get() === "en" ? "rewatch" : "sett på nytt");
    meta.textContent = bits.join(" · ");
    li.appendChild(meta);

    if (f.s) {
      var review = document.createElement("a");
      review.className = "film-review";
      review.href = "filmer/" + f.s + ".html";
      review.appendChild(siteLang.text("Min anmeldelse", "My review"));
      li.appendChild(review);
    }
    return li;
  }

  // Viser filmlisten for en søyle. row.films er allerede sortert; row.dates: vis visningsdato.
  function openDetail(chartTitle, row, button, key) {
    if (selected === key) return closeDetail();
    closeDetail();
    selected = key;
    button.setAttribute("aria-pressed", "true");

    var head = document.createElement("div");
    head.className = "stat-detail-head";
    var h3 = document.createElement("h3");
    h3.appendChild(siteLang.text(chartTitle[0] + " · " + row.label, chartTitle[1] + " · " + row.label));
    var count = document.createElement("span");
    count.className = "stat-detail-count";
    count.appendChild(siteLang.text(row.films.length + " filmer", row.films.length + " films"));
    var close = document.createElement("button");
    close.type = "button";
    close.className = "stat-detail-close";
    close.appendChild(siteLang.text("Lukk", "Close"));
    close.addEventListener("click", function () {
      var back = root.querySelector(".bar-col[data-key='" + key + "']");
      closeDetail();
      if (back) back.focus();
    });
    head.appendChild(h3);
    head.appendChild(count);
    head.appendChild(close);

    var list = document.createElement("ul");
    list.className = "film-list";
    row.films.forEach(function (f) { list.appendChild(filmItem(f, row.dates)); });

    detail.appendChild(head);
    detail.appendChild(list);
    detail.hidden = false;

    var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    detail.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "nearest" });
  }

  // Søylediagram med div-er. rows: [{label, value, shown?, films, dates?}]. Høyden er relativ
  // til største verdi, og hver søyle er en knapp som åpner filmlisten.
  function barChart(id, titleNo, titleEn, rows, opts) {
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

    rows.forEach(function (r) {
      var key = id + ":" + r.label;
      var shown = r.shown != null ? r.shown : r.value;
      var col = document.createElement("button");
      col.type = "button";
      col.className = "bar-col";
      col.dataset.key = key;
      col.setAttribute("aria-pressed", "false");
      col.setAttribute("aria-label", r.label + ": " + shown);
      var val = document.createElement("span");
      val.className = "bar-value";
      val.textContent = shown;
      var bar = document.createElement("span");
      bar.className = "bar";
      bar.style.height = Math.max(2, ((r.value - from) / (max - from)) * 100) + "%";
      var label = document.createElement("span");
      label.className = "bar-label";
      label.textContent = r.label;
      col.appendChild(val);
      col.appendChild(bar);
      col.appendChild(label);
      col.addEventListener("click", function () {
        openDetail([titleNo, titleEn], r, col, key);
      });
      bars.appendChild(col);
    });
    figure.appendChild(bars);
    charts.appendChild(figure);
  }

  function byYearDesc(a, b) { return (b.y || 0) - (a.y || 0) || a.t.localeCompare(b.t); }
  function byRatingDesc(a, b) { return (b.r || 0) - (a.r || 0) || byYearDesc(a, b); }
  function byDateDesc(a, b) { return b.d < a.d ? -1 : b.d > a.d ? 1 : 0; }

  function render(s) {
    closeDetail();
    tiles.textContent = "";
    charts.textContent = "";
    var t = s.totals;
    tile(fmt(t.watched), "filmer sett", "films watched");
    tile(fmt(t.rated), "med rating", "rated");
    tile(fmt(t.average, 2), "snittkarakter", "average rating");
    tile(fmt(t.five_star), "femmere", "five-star films");

    function diaryYear(year) {
      return s.diary.filter(function (d) { return d.d.slice(0, 4) === String(year); }).sort(byDateDesc);
    }

    barChart("year", "Filmer sett per år", "Films watched per year",
      s.per_year.map(function (y) {
        return { label: String(y.year), value: y.count, films: diaryYear(y.year), dates: true };
      }));

    var avgRows = s.per_year.filter(function (y) { return y.average != null; });
    barChart("avg", "Snittkarakter per år", "Average rating per year",
      avgRows.map(function (y) {
        var films = diaryYear(y.year).sort(function (a, b) { return (b.r || 0) - (a.r || 0); });
        return { label: String(y.year), value: y.average, shown: fmt(y.average, 2), films: films, dates: true };
      }),
      { min: 3 });

    barChart("rating", "Karakterfordeling", "Rating distribution",
      s.ratings.map(function (r) {
        var films = s.films.filter(function (f) { return f.r === r.rating; }).sort(byYearDesc);
        return { label: fmt(r.rating, r.rating % 1 ? 1 : 0), value: r.count, films: films };
      }));

    barChart("decade", "Filmer etter tiår", "Films by decade of release",
      s.decades.map(function (d) {
        var films = s.films.filter(function (f) {
          return f.y && Math.floor(f.y / 10) * 10 === d.decade;
        }).sort(byRatingDesc);
        return { label: String(d.decade).slice(2) + "s", value: d.count, films: films };
      }));
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
