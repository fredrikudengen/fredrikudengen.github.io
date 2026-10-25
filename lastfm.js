// Topp 5 album og sanger fra Last.fm, med valg av periode.
// Last.fm-nøkkelen er skrivebeskyttet og gjelder en offentlig profil, så det går fint at den ligger her.
(function () {
  var USER = "Dengern";
  var API_KEY = "d61b19d525a280751244c35d619446f1"; // lag en på https://www.last.fm/api/account/create
  var LIMIT = 5;
  var CACHE_MS = 60 * 60 * 1000; // husk svaret i én time, så siden ikke spammer API-et
  var DEFAULT_PERIOD = "1month"; // 7day | 1month | 3month | 6month | 12month | overall

  var root = document.getElementById("musikk");
  if (!root) return;

  var albumsEl = document.getElementById("music-albums");
  var tracksEl = document.getElementById("music-tracks");
  var statusEl = document.getElementById("music-status");
  var buttons = root.querySelectorAll(".music-periods button");
  var requestId = 0;

  function call(method, period) {
    var key = "lfm:" + method + ":" + USER + ":" + period;
    try {
      var cached = JSON.parse(localStorage.getItem(key));
      if (cached && Date.now() - cached.t < CACHE_MS) return Promise.resolve(cached.d);
    } catch (e) {}

    var params = new URLSearchParams({
      method: method,
      user: USER,
      period: period,
      limit: LIMIT,
      api_key: API_KEY,
      format: "json",
    });
    return fetch("https://ws.audioscrobbler.com/2.0/?" + params)
      .then(function (r) {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json();
      })
      .then(function (d) {
        if (d.error) throw new Error(d.message || "Last.fm-feil");
        try {
          localStorage.setItem(key, JSON.stringify({ t: Date.now(), d: d }));
        } catch (e) {}
        return d;
      });
  }

  // Last.fm gir en tom streng eller en standard stjerne-plassholder når albumet mangler cover
  function coverUrl(images) {
    if (!images || !images.length) return "";
    var pick = images.filter(function (i) { return i.size === "large"; })[0] || images[images.length - 1];
    var url = pick && pick["#text"];
    if (!url || url.indexOf("2a96cbd8b46e442fc41c2b86b821562f") !== -1) return "";
    return url;
  }

  function item(rank, title, artist, plays, href, cover) {
    var li = document.createElement("li");
    li.className = "music-item";

    var rankEl = document.createElement("span");
    rankEl.className = "music-rank";
    rankEl.textContent = rank;
    li.appendChild(rankEl);

    if (cover !== undefined) {
      if (cover) {
        var img = document.createElement("img");
        img.className = "music-cover";
        img.src = cover;
        img.alt = "";
        img.loading = "lazy";
        img.width = 56;
        img.height = 56;
        li.appendChild(img);
      } else {
        var ph = document.createElement("span");
        ph.className = "music-cover music-cover--empty";
        ph.setAttribute("aria-hidden", "true");
        li.appendChild(ph);
      }
    }

    var text = document.createElement("span");
    text.className = "music-text";
    var a = document.createElement("a");
    a.className = "music-title";
    a.href = href;
    a.target = "_blank";
    a.rel = "noopener";
    a.textContent = title;
    var by = document.createElement("span");
    by.className = "music-artist";
    by.textContent = artist;
    text.appendChild(a);
    text.appendChild(by);
    li.appendChild(text);

    var count = document.createElement("span");
    count.className = "music-plays";
    count.textContent = plays + " avspillinger";
    li.appendChild(count);

    return li;
  }

  function renderAlbums(data) {
    albumsEl.textContent = "";
    var list = (data.topalbums && data.topalbums.album) || [];
    list.forEach(function (al, i) {
      albumsEl.appendChild(
        item(i + 1, al.name, al.artist.name, al.playcount, al.url, coverUrl(al.image))
      );
    });
  }

  function renderTracks(data) {
    tracksEl.textContent = "";
    var list = (data.toptracks && data.toptracks.track) || [];
    list.forEach(function (t, i) {
      tracksEl.appendChild(item(i + 1, t.name, t.artist.name, t.playcount, t.url));
    });
  }

  function load(period) {
    var id = ++requestId;
    statusEl.textContent = "Henter fra Last.fm…";
    root.classList.add("is-loading");

    Promise.all([call("user.gettopalbums", period), call("user.gettoptracks", period)])
      .then(function (res) {
        if (id !== requestId) return; // et nyere valg har tatt over
        renderAlbums(res[0]);
        renderTracks(res[1]);
        statusEl.textContent = "";
        root.classList.remove("is-loading");
      })
      .catch(function () {
        if (id !== requestId) return;
        statusEl.textContent = "Kunne ikke hente musikk akkurat nå.";
        root.classList.remove("is-loading");
      });
  }

  buttons.forEach(function (btn) {
    btn.addEventListener("click", function () {
      buttons.forEach(function (b) { b.setAttribute("aria-pressed", String(b === btn)); });
      load(btn.dataset.period);
    });
  });

  buttons.forEach(function (b) {
    b.setAttribute("aria-pressed", String(b.dataset.period === DEFAULT_PERIOD));
  });
  load(DEFAULT_PERIOD);
})();
