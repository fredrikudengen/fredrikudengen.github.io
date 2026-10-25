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

  // «The Infamous (Expanded Edition)» -> «The Infamous»
  function stripEdition(s) {
    return String(s || "").replace(/\s*[\(\[][^)\]]*[\)\]]\s*/g, " ").trim() || String(s || "");
  }

  function related(a, b) {
    return !!a && !!b && (a.indexOf(b) !== -1 || b.indexOf(a) !== -1);
  }

  // MusicBrainz tillater maks ett kall i sekundet: kjør dem i kø med pause, og prøv én gang til ved 503
  var mbChain = Promise.resolve();
  function wait(ms) { return new Promise(function (res) { setTimeout(res, ms); }); }
  function mbRequest(url) {
    function once() {
      return fetch(url).then(function (r) {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json();
      });
    }
    var run = mbChain.then(function () {
      return once().catch(function (e) {
        if (String(e.message).indexOf("503") === -1) throw e;
        return wait(2000).then(once);
      });
    });
    mbChain = run.catch(function () {}).then(function () { return wait(1100); });
    return run;
  }

  // Reserve når Last.fm ikke har cover: iTunes Search (ingen nøkkel).
  // Godtar bare treff der både artist og albumtittel stemmer, så vi heller viser tom ramme enn feil cover.
  function fallbackCover(artist, album, mbid) {
    var key = "cover:" + norm(artist) + "|" + norm(album);
    var cached = readCache(key, COVER_CACHE_MS);
    if (cached) return Promise.resolve(cached.d);

    var wantArtist = norm(artist);
    var wantAlbum = norm(stripEdition(album));

    function search(term) {
      var params = new URLSearchParams({
        term: term,
        media: "music",
        entity: "album",
        limit: 25,
      });
      return fetch("https://itunes.apple.com/search?" + params)
        .then(function (r) {
          if (!r.ok) throw new Error("HTTP " + r.status);
          return r.json();
        })
        .then(function (d) {
          var results = d.results || [];
          var hit = results.filter(function (x) {
            return related(norm(x.artistName), wantArtist) &&
              related(norm(stripEdition(x.collectionName)), wantAlbum);
          })[0];
          if (!hit) {
            console.info("[lastfm] Ingen cover-treff i iTunes for «" + term + "»", results.slice(0, 5).map(function (x) {
              return x.artistName + " – " + x.collectionName;
            }));
          }
          return hit && hit.artworkUrl100 ? hit.artworkUrl100.replace("100x100bb", "200x200bb") : "";
        });
    }

    // Henter hele artistens katalog i iTunes og leter etter albumet der
    function catalog() {
      var params = new URLSearchParams({
        term: artist,
        attribute: "artistTerm",
        media: "music",
        entity: "album",
        limit: 200,
      });
      return fetch("https://itunes.apple.com/search?" + params)
        .then(function (r) {
          if (!r.ok) throw new Error("HTTP " + r.status);
          return r.json();
        })
        .then(function (d) {
          var hit = (d.results || []).filter(function (x) {
            return related(norm(x.artistName), wantArtist) &&
              related(norm(stripEdition(x.collectionName)), wantAlbum);
          })[0];
          return hit && hit.artworkUrl100 ? hit.artworkUrl100.replace("100x100bb", "200x200bb") : "";
        });
    }

    // Siste utvei: MusicBrainz finner albumet, Cover Art Archive leverer coveret
    function musicBrainz() {
      var q = 'releasegroup:"' + album.replace(/"/g, "") + '" AND artist:"' + artist.replace(/"/g, "") + '"';
      var params = new URLSearchParams({ query: q, fmt: "json", limit: 5 });
      return mbRequest("https://musicbrainz.org/ws/2/release-group/?" + params)
        .then(function (d) {
          var hit = (d["release-groups"] || []).filter(function (g) {
            var credit = (g["artist-credit"] || []).map(function (c) { return c.name; }).join("");
            return related(norm(credit), wantArtist) && related(norm(stripEdition(g.title)), wantAlbum);
          })[0];
          return hit ? "https://coverartarchive.org/release-group/" + hit.id + "/front-250" : "";
        });
    }

    function attempt(fn) {
      return function (url) {
        if (url) return url;
        return fn().catch(function (e) {
          console.info("[lastfm] cover-oppslag feilet", e);
          return "";
        });
      };
    }

    // Først artist + album, så artistens hele katalog, så MusicBrainz
    return search(artist + " " + album)
      .catch(function (e) {
        console.info("[lastfm] iTunes-søk feilet", e);
        return "";
      })
      .then(attempt(catalog))
      .then(function (url) {
        // Last.fm oppgir noen ganger MusicBrainz-id-en til albumet: da trengs ikke noe søk
        if (!url && mbid) return "https://coverartarchive.org/release/" + mbid + "/front-250";
        return url;
      })
      .then(attempt(musicBrainz))
      .then(function (url) {
        if (url) writeCache(key, url); // cache bare treff, så feil og bom prøves på nytt
        return url;
      })
      .catch(function (e) {
        console.info("[lastfm] iTunes-oppslag feilet", e);
        return "";
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
        fallbackCover(al.artist.name, al.name, al.mbid).then(function (u) { swapCover(li, u); });
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