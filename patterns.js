// Små generative SVG-mønstre til filmkortene på filmer.html.
// Samme tittel gir alltid samme mønster (seedet fra tittelen).
//
// Bruk:  makePattern(title, slug, kind)  ->  <svg>-element
//   kind (valgfritt) kan settes per film i resources/meta.json som "moenster":
//   "flow" | "radial" | "truchet" | "nested" | "nested:6" | "wave" | "iso"
//   Uten "moenster" brukes standardvalget for sluggen under, ellers velges
//   en type ut fra tittelen.
(function () {
  var W = 300;
  var H = 120;
  var SVGNS = "http://www.w3.org/2000/svg";

  // Standardvalg for filmene som finnes fra før. Koblingene er skjønn, ikke fasit.
  var DEFAULTS = {
    "digger": "flow",
    "project-hail-mary": "radial",
    "one-battle-after-another": "truchet",
    "the-substance": "nested:4",
    "affeksjonsverdi": "truchet",
    "the-brutalist": "iso",
    "hostsonaten": "flow",
    "mulholland-drive": "wave",
    "synecdoche-new-york": "nested:6"
  };

  function hash(s) {
    var h = 2166136261;
    for (var i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  // Liten seedet tilfeldighetsgenerator (mulberry32)
  function rng(seed) {
    var a = seed;
    return function () {
      a = (a + 0x6d2b79f5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function n1(v) {
    return Math.round(v * 10) / 10;
  }

  function pts(arr) {
    return arr
      .map(function (p, i) {
        return (i ? "L" : "M") + n1(p[0]) + " " + n1(p[1]);
      })
      .join("");
  }

  var kinds = {
    // Nestede polygoner som dreier seg litt for hver ring
    nested: function (r, sides) {
      sides = sides || 4;
      var rot = 0.05 + r() * 0.08;
      var d = [];
      for (var i = 0; i < 16; i++) {
        var rad = 58 - i * 3.5;
        var a0 = i * rot;
        var ring = [];
        for (var k = 0; k < sides; k++) {
          var a = a0 + (k * 2 * Math.PI) / sides - Math.PI / 2;
          ring.push([W / 2 + rad * Math.cos(a), H / 2 + rad * Math.sin(a)]);
        }
        ring.push(ring[0]);
        d.push(pts(ring));
      }
      return d.join("");
    },

    // Jevnt fordelte linjer som er bøyd av to sinuskurver
    wave: function (r) {
      var d = [];
      var ph = 0.25 + r() * 0.2;
      var fr = 0.03 + r() * 0.02;
      for (var i = 0; i < 16; i++) {
        var base = 6 + i * 7.2;
        var row = [];
        for (var x = 0; x <= W; x += 5) {
          row.push([x, base + 4 * Math.sin(x * fr + i * ph) + 3 * Math.sin(x * fr * 2.3 - i * 0.7)]);
        }
        d.push(pts(row));
      }
      return d.join("");
    },

    // Stråler fra et midtpunkt, lengden varierer med vinkelen
    radial: function (r) {
      var d = [];
      var n = 56;
      var a0 = r() * 6.28;
      var r0 = 10 + r() * 8;
      var ph = r() * 6.28;
      var k = 3 + Math.floor(r() * 4);
      for (var i = 0; i < n; i++) {
        var a = a0 + (i * 2 * Math.PI) / n;
        var len = 16 + 22 * (0.5 + 0.5 * Math.sin(k * a + ph));
        d.push(
          pts([
            [W / 2 + r0 * Math.cos(a), H / 2 + r0 * Math.sin(a)],
            [W / 2 + (r0 + len) * Math.cos(a), H / 2 + (r0 + len) * Math.sin(a)]
          ])
        );
      }
      return d.join("");
    },

    // Truchet-fliser: to kvartbuer per flis, tilfeldig orientert
    truchet: function (r) {
      var d = [];
      var t = 20;
      var h = 10;
      for (var row = 0; row < 6; row++) {
        for (var col = 0; col < 15; col++) {
          var x = col * t;
          var y = row * t;
          if (r() < 0.5) {
            d.push("M" + (x + h) + " " + y + "A" + h + " " + h + " 0 0 1 " + x + " " + (y + h));
            d.push("M" + (x + t) + " " + (y + h) + "A" + h + " " + h + " 0 0 0 " + (x + h) + " " + (y + t));
          } else {
            d.push("M" + (x + h) + " " + y + "A" + h + " " + h + " 0 0 0 " + (x + t) + " " + (y + h));
            d.push("M" + x + " " + (y + h) + "A" + h + " " + h + " 0 0 1 " + (x + h) + " " + (y + t));
          }
        }
      }
      return d.join("");
    },

    // Isometriske kuber: sekskanter med Y inni, noen celler utelatt
    iso: function (r) {
      var d = [];
      var s = 13;
      var w = s * Math.sqrt(3);
      for (var row = -1; row < 8; row++) {
        for (var col = -1; col < 14; col++) {
          var cx = col * w + (Math.abs(row) % 2 ? w / 2 : 0);
          var cy = row * 1.5 * s;
          if (r() < 0.22) continue;
          var v = [];
          for (var k = 0; k < 6; k++) {
            var a = ((30 + 60 * k) * Math.PI) / 180;
            v.push([cx + s * Math.cos(a), cy + s * Math.sin(a)]);
          }
          d.push(pts(v.concat([v[0]])));
          [1, 3, 5].forEach(function (i) {
            d.push(pts([[cx, cy], v[i]]));
          });
        }
      }
      return d.join("");
    },

    // Flytende linjer som følger et enkelt vinkelfelt
    flow: function (r) {
      var d = [];
      var p1 = r() * 6.28;
      var p2 = r() * 6.28;
      var f1 = 0.012 + r() * 0.01;
      var f2 = 0.02 + r() * 0.015;
      for (var i = 0; i < 22; i++) {
        var x = -4;
        var y = 3 + i * 5.6;
        var row = [[x, y]];
        for (var s = 0; s < 90; s++) {
          var a = 1.1 * Math.sin(x * f1 * 3 + y * f2 + p1) + 0.8 * Math.cos(y * f1 * 4 - x * f2 * 0.5 + p2);
          x += 4 * Math.cos(a);
          y += 4 * Math.sin(a);
          row.push([x, y]);
          if (x > W + 4) break;
        }
        d.push(pts(row));
      }
      return d.join("");
    }
  };

  var KIND_NAMES = Object.keys(kinds);

  function resolve(title, slug, kind) {
    var spec = kind || DEFAULTS[slug] || "";
    var parts = String(spec).split(":");
    var name = parts[0];
    var sides = parts[1] ? parseInt(parts[1], 10) : undefined;
    if (!kinds[name]) {
      name = KIND_NAMES[hash(title || slug || "") % KIND_NAMES.length];
    }
    return { name: name, sides: sides };
  }

  window.makePattern = function (title, slug, kind) {
    var spec = resolve(title, slug, kind);
    var r = rng(hash(title || slug || ""));

    var svg = document.createElementNS(SVGNS, "svg");
    svg.setAttribute("viewBox", "0 0 " + W + " " + H);
    svg.setAttribute("preserveAspectRatio", "xMidYMid slice");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("focusable", "false");

    var path = document.createElementNS(SVGNS, "path");
    path.setAttribute("d", kinds[spec.name](r, spec.sides));
    svg.appendChild(path);
    return svg;
  };
})();
