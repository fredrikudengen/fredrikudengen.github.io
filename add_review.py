#!/usr/bin/env python3
"""Legg til en ny bok- eller filmanmeldelse på siten.

Bruk:
    python3 add_review.py "/path/til/Tittel.md" bok
    python3 add_review.py "/path/til/Tittel.md" film

Gjør fire ting, uten å røre eksisterende innhold:
  1. Konverterer .md -> resources/<books|movies>/<slug>.html
  2. Lager boker/<slug>.html eller filmer/<slug>.html (sidemal)
  3. Setter inn et nytt kort i boker.html / filmer.html (alfabetisk)
  4. Legger til en tom oppføring i resources/meta.json for slugen
     (overskriver ikke eksisterende oppføringer)
"""
import json
import os
import re
import sys

SITE_ROOT = os.path.dirname(os.path.abspath(__file__))

TRANSLIT = str.maketrans({
    "æ": "ae", "Æ": "ae",
    "ø": "o", "Ø": "o",
    "å": "a", "Å": "a",
})

CATEGORY_MAP = {
    "bok": {
        "resource_dir": "books",
        "page_dir": "boker",
        "listing_file": "boker.html",
        "listing_label": "Bøker",
        "meta_key": "books",
        "meta_fields": ["forfatter", "aar", "dato"],
    },
    "film": {
        "resource_dir": "movies",
        "page_dir": "filmer",
        "listing_file": "filmer.html",
        "listing_label": "Filmer",
        "meta_key": "movies",
        "meta_fields": ["regissor", "aar", "dato"],
    },
}

LINK_RE = re.compile(r"\[([^\]]+)\]\(([^)]+)\)")
ITALIC_RE = re.compile(r"(?<!\*)\*([^*\n]+)\*(?!\*)")
IMG_RE = re.compile(r"^<img\b.*?/?>\s*$", re.IGNORECASE)


def slugify(name):
    name = name.translate(TRANSLIT).lower()
    name = re.sub(r"[.',]", "", name)
    name = name.replace("(", "").replace(")", "")
    name = re.sub(r"[^a-z0-9]+", "-", name)
    return re.sub(r"-+", "-", name).strip("-")


def convert_inline(text):
    text = LINK_RE.sub(r'<a href="\2" target="_blank" rel="noopener">\1</a>', text)
    text = ITALIC_RE.sub(r"<em>\1</em>", text)
    return text


def convert_block_lines(lines):
    out_parts = []
    for i, line in enumerate(lines):
        hard_break = line.endswith("  ")
        out_parts.append(convert_inline(line.strip()))
        if i < len(lines) - 1:
            out_parts.append("<br>\n" if hard_break else " ")
    return "".join(out_parts)


def convert_markdown(src_text):
    blocks = re.split(r"\n\s*\n", src_text.strip())
    html_blocks = []
    for block in blocks:
        raw_lines = [l for l in block.split("\n") if l.strip() != ""]
        if not raw_lines:
            continue
        if len(raw_lines) == 1 and IMG_RE.match(raw_lines[0].strip()):
            html_blocks.append(f'<p class="review-figure">{raw_lines[0].strip()}</p>')
            continue
        if raw_lines[0].lstrip().startswith("#"):
            m = re.match(r"^#+\s*(.*)$", raw_lines[0].strip())
            heading_text = convert_inline(m.group(1)) if m else convert_inline(raw_lines[0])
            html_blocks.append(f"<h3>{heading_text}</h3>")
            continue
        if all(l.strip().startswith(">") for l in raw_lines):
            stripped = [re.sub(r"^\s*>\s?", "", l) for l in raw_lines]
            html_blocks.append(f"<blockquote><p>{convert_block_lines(stripped)}</p></blockquote>")
            continue
        if all(l.strip().startswith("- ") for l in raw_lines):
            items = [f"<li>{convert_inline(re.sub(r'^\\s*-\\s+', '', l.rstrip()))}</li>" for l in raw_lines]
            html_blocks.append("<ul>\n" + "\n".join(items) + "\n</ul>")
            continue
        html_blocks.append(f"<p>{convert_block_lines(raw_lines)}</p>")
    return "\n".join(html_blocks) + "\n"


NAV = """      <nav class="nav">
        <a href="../projects.html">Prosjekter</a>
        <a href="../boker.html">Bøker</a>
        <a href="../filmer.html">Filmer</a>
        <a href="https://www.linkedin.com/in/fredrik-udengen-87272a143/" target="_blank" rel="noopener">LinkedIn</a>
        <a href="mailto:fredrikudengen@proton.me">Kontakt</a>
      </nav>"""

REVIEW_PAGE = """<!DOCTYPE html>
<html lang="no">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>{title} · Fredrik Udengen</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Fraunces:wght@500;600;700&family=Source+Serif+4:ital,wght@0,400;0,600;1,400&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="../style.css" />
  <meta name="description" content="Anmeldelse av {title_attr} · Fredrik Udengen" />
</head>
<body>
  <header class="site-header">
    <div class="topbar">
      <a class="brand" href="../index.html">Fredrik Udengen</a>
{nav}
    </div>

    <section class="page-hero reveal">
      <a class="breadcrumb" href="../{listing_file}">&larr; {listing_label}</a>
      <h1>{title}</h1>
      <div class="chips review-meta" id="review-meta" aria-label="Detaljer"></div>
    </section>
  </header>

  <main class="content">
    <section class="card reveal" id="review-body">
      <p class="subtitle">Laster anmeldelse&hellip;</p>
    </section>
  </main>

  <footer class="footer">
    <p>© <span id="year"></span> Fredrik Udengen</p>
  </footer>

  <script>
    document.getElementById("year").textContent = new Date().getFullYear();
    fetch("../resources/{resource_dir}/{slug}.html")
      .then((r) => r.text())
      .then((htmlText) => {{
        document.getElementById("review-body").innerHTML = htmlText;
      }})
      .catch(() => {{
        document.getElementById("review-body").innerHTML =
          "<p>Kunne ikke laste anmeldelsen.</p>";
      }});

    fetch("../resources/meta.json")
      .then((r) => r.json())
      .then((meta) => {{
        var entry = (meta["{meta_key}"] || {{}})["{slug}"];
        if (!entry) return;
        var labels = {{
          forfatter: "Forfatter",
          regissor: "Regissør",
          aar: "År",
          dato: "Lest/sett",
        }};
        var order = ["forfatter", "regissor", "aar", "dato"];
        var el = document.getElementById("review-meta");
        order.forEach(function (key) {{
          var value = entry[key];
          if (!value) return;
          var span = document.createElement("span");
          span.className = "chip";
          span.textContent = (key === "aar" ? value : labels[key] + ": " + value);
          el.appendChild(span);
        }});
      }})
      .catch(function () {{}});
  </script>
  <script src="../script.js"></script>
</body>
</html>
"""

def update_meta(meta_path, meta_key, meta_fields, slug, title):
    with open(meta_path, encoding="utf-8") as f:
        meta = json.load(f)
    meta.setdefault(meta_key, {})
    if slug in meta[meta_key]:
        print(f"'{slug}' finnes allerede i meta.json, lar oppføringen være urørt.")
        return
    entry = {"title": title}
    entry.update(dict.fromkeys(meta_fields, ""))
    meta[meta_key][slug] = entry
    with open(meta_path, "w", encoding="utf-8") as f:
        json.dump(meta, f, ensure_ascii=False, indent=2)
        f.write("\n")


def main():
    if len(sys.argv) != 3:
        print(__doc__)
        sys.exit(1)

    md_path, category = sys.argv[1], sys.argv[2].lower()
    if category not in CATEGORY_MAP:
        print(f"Ukjent kategori '{category}'. Bruk 'bok' eller 'film'.")
        sys.exit(1)
    if not os.path.isfile(md_path):
        print(f"Fant ikke filen: {md_path}")
        sys.exit(1)

    cfg = CATEGORY_MAP[category]
    title = os.path.splitext(os.path.basename(md_path))[0]
    slug = slugify(title)

    with open(md_path, encoding="utf-8") as f:
        source = f.read()
    converted = convert_markdown(source)

    resource_path = os.path.join(SITE_ROOT, "resources", cfg["resource_dir"], f"{slug}.html")
    with open(resource_path, "w", encoding="utf-8") as f:
        f.write(converted)
    print(f"Skrev {resource_path}")

    page_html = REVIEW_PAGE.format(
        title=title,
        title_attr=title.replace('"', "&quot;"),
        nav=NAV,
        listing_file=cfg["listing_file"],
        listing_label=cfg["listing_label"],
        resource_dir=cfg["resource_dir"],
        meta_key=cfg["meta_key"],
        slug=slug,
    )
    page_path = os.path.join(SITE_ROOT, cfg["page_dir"], f"{slug}.html")
    with open(page_path, "w", encoding="utf-8") as f:
        f.write(page_html)
    print(f"Skrev {page_path}")

    meta_path = os.path.join(SITE_ROOT, "resources", "meta.json")
    update_meta(meta_path, cfg["meta_key"], cfg["meta_fields"], slug, title)
    print(f"Oppdaterte {meta_path}")
    print(f"{cfg['listing_file']} henter listen direkte fra meta.json, ingen videre endring nødvendig der.")

    print(f"\nFerdig! Fyll gjerne inn {', '.join(cfg['meta_fields'])} for '{slug}' i resources/meta.json.")


if __name__ == "__main__":
    main()
