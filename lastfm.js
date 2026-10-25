(function () {
  var USER = "Dengern";
  var API_KEY = "d61b19d525a280751244c35d619446f1"; // skrivebeskyttet ;)
  var LIMIT = 5;
  var CACHE_MS = 60 * 60 * 1000; // husk svaret i én time, så siden ikke spammer API-et
  var COVER_CACHE_MS = 7 * 24 * 60 * 60 * 1000; // cover endrer seg sjelden
  var DEFAULT_PERIOD = "1month"; // 7day | 1month | 3month | 6month | 12month | overall

  var root = document.getElementById("musikk");
  if (!root) return;

  var albumsEl = document.getElementById("music-albums");
  var tracksEl = document.getElementById("music-tracks");
  var statusEl = document.getElementById("music-status");
  var buttons = root.querySelectorAll(".music-periods button");
  var requestId = 0;

  function readCache(key, maxAge) {
    try {
      var cached = JSON.parse(localStorage.getItem(key));
      if (cached && Date.now() - cached.t < maxAge) return cached;
    } catch (e) {}
    return null;
  }

  function writeCache(key, data) {
    try {
      localStorage.setItem(key, JSON.stringify({ t: Date.now(), d: data }));
    } catch (e) {}
  }

  function call(method, period) {
    var key = "lfm:" + method + ":" + USER + ":" + period;
    var cached = readCache(key, CACHE_MS);
    if (cached) return Promise.resolve(cached.d);

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
        writeCache(key, d);
        return d;
      });
  }

  // Last.fm gir ofte en tom streng eller en standard plassholder når albumet mangler cover
  function coverUrl(images) {
    if (!images || !images.length) return "";
    var pick = images.filter(function (i) { return i.size === "large"; })[0] || images[images.length - 1];
    var url = pick && pick["#text"];
    if (!url || url.indexOf("2a96cbd8b46e442fc41c2b86b821562f") !== -1) return "";
    return url;
  }

  function norm(s) {
    return String(s || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "");
  }

  function related(a, b) {
    return !!a && !!b && (a.indexOf(b) !== -1 || b.indexOf(a) !== -1);
  }

  // Reserve når Last.fm ikke har cover: iTunes Search (ingen nøkkel).
  // Godtar bare treff der både artist og albumtittel stemmer, så vi heller viser tom ramme enn feil cover.
  function fallbackCover(artist, album) {
    var key = "cover:" + norm(artist) + "|" + norm(album);
    var cached = readCache(key, COVER_CACHE_MS);
    if (cached) return Promise.resolve(cached.d);

    var params = new URLSearchParams({
      term: artist + " " + album,
      media: "music",
      entity: "album",
      limit: 8,
    });
    return fetch("https://itunes.apple.com/search?" + params)
      .then(function (r) {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json();
      })
      .then(function (d) {
        var wantArtist = norm(artist);
        var wantAlbum = norm(album);
        var hit = (d.results || []).filter(function (x) {
          return related(norm(x.artistName), wantArtist) && related(norm(x.collectionName), wantAlbum);
        })[0];
        var url = hit && hit.artworkUrl100 ? hit.artworkUrl100.replace("100x100bb", "200x200bb") : "";
        writeCache(key, url);
        return url;
      })
      .catch(function () {
        return ""; // ikke cache feil, prøv igjen neste gang
      });
  }

  function coverImg(url) {
    var img = document.createElement("img");
    img.className = "music-cover";
    img.src = url;
    img.alt = "";
    img.referrerPolicy = "no-referrer";
    img.loading = "lazy";
    img.width = 56;
    img.height = 56;
    return img;
  }

  function emptyCover() {
    var ph = document.createElement("span");
    ph.className = "music-cover music-cover--empty";
    ph.setAttribute("aria-hidden", "true");
    return ph;
  }

  function item(rank, title, artist, plays, href, withCover) {
    var li = document.createElement("li");
    li.className = "music-item";

    var rankEl = document.createElement("span");
    rankEl.className = "music-rank";
    rankEl.textContent = rank;
    li.appendChild(rankEl);

    if (withCover) li.appendChild(emptyCover());

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

  function swapCover(li, url, onFail) {
    var ph = li.querySelector(".music-cover");
    if (!ph || !url) return;
    var img = coverImg(url);
    // Hvis bildet ikke lar seg laste (f.eks. blokkert av ORB), behold den tomme rammen og prøv reserven
    img.onerror = function () {
      if (img.parentNode) img.parentNode.replaceChild(emptyCover(), img);
      if (onFail) onFail();
    };
    ph.parentNode.replaceChild(img, ph);
  }

  function renderAlbums(data) {
    albumsEl.textContent = "";
    var list = (data.topalbums && data.topalbums.album) || [];
    list.forEach(function (al, i) {
      var li = item(i + 1, al.name, al.artist.name, al.playcount, al.url, true);
      albumsEl.appendChild(li);

      function useFallback() {
        fallbackCover(al.artist.name, al.name).then(function (u) { swapCover(li, u); });
      }

      var url = coverUrl(al.image);
      if (url) {
        swapCover(li, url, useFallback);
      } else {
        useFallback();
      }
    });
  }

  function renderTracks(data) {
    tracksEl.textContent = "";
    var list = (data.toptracks && data.toptracks.track) || [];
    list.forEach(function (t, i) {
      tracksEl.appendChild(item(i + 1, t.name, t.artist.name, t.playcount, t.url, false));
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