#!/usr/bin/env python3
"""Legg til en ny bok- eller filmanmeldelse på siten.

Bruk:
    python3 add_review.py "/path/til/Tittel.md" bok
    python3 add_review.py "/path/til/Tittel.md" film
    python3 add_review.py "/path/til/Tittel.md" bok en   (engelsk oversettelse)

Gjør fire ting, uten å røre eksisterende innhold:
  1. Konverterer .md -> resources/<books|movies>/<slug>.html
  2. Lager boker/<slug>.html eller filmer/<slug>.html (sidemal)
  3. Setter inn et nytt kort i boker.html / filmer.html (alfabetisk)
  4. Legger til en tom oppføring i resources/meta.json for slugen
     (overskriver ikke eksisterende oppføringer)

Med "en" til slutt skrives bare resources/<books|movies>/<slug>.en.html, som
anmeldelsessiden viser når engelsk er valgt. Filnavnet må gi samme slug som den
norske anmeldelsen (f.eks. "Digger.md"), og den norske må finnes fra før.
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
        "listing_label_en": "Books",
        "meta_key": "books",
        "meta_fields": ["forfatter", "aar", "dato", "moenster"],
    },
    "film": {
        "resource_dir": "movies",
        "page_dir": "filmer",
        "listing_file": "filmer.html",
        "listing_label": "Filmer",
        "listing_label_en": "Films",
        "meta_key": "movies",
        "meta_fields": ["regissor", "aar", "dato", "moenster"],
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
        <a href="../projects.html"><span lang="no">Prosjekter</span><span lang="en">Projects</span></a>
        <a href="../boker.html"><span lang="no">Bøker</span><span lang="en">Books</span></a>
        <a href="../filmer.html"><span lang="no">Filmer</span><span lang="en">Films</span></a>
        <a href="https://www.linkedin.com/in/fredrik-udengen-87272a143/" target="_blank" rel="noopener">LinkedIn</a>
        <a href="mailto:fredrikudengen@proton.me"><span lang="no">Kontakt</span><span lang="en">Contact</span></a>
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
  <script src="../lang.js"></script>
</head>
<body>
  <header class="site-header">
    <div class="topbar">
      <a class="brand" href="../index.html">Fredrik Udengen</a>
{nav}
    </div>

    <section class="page-hero reveal">
      <a class="breadcrumb" href="../{listing_file}">&larr; <span lang="no">{listing_label}</span><span lang="en">{listing_label_en}</span></a>
      <h1>{title}</h1>
      <div class="chips review-meta" id="review-meta" aria-label="Detaljer" data-en-aria-label="Details"></div>
    </section>
  </header>

  <main class="content">
    <section class="card reveal" id="review-body">
      <p class="subtitle"><span lang="no">Laster anmeldelse&hellip;</span><span lang="en">Loading review&hellip;</span></p>
    </section>
  </main>

  <footer class="footer">
    <p>© <span id="year"></span> Fredrik Udengen</p>
  </footer>

  <script>
    document.getElementById("year").textContent = new Date().getFullYear();
  </script>
  <script src="../review.js" data-kind="{meta_key}" data-slug="{slug}"></script>
  <script src="../script.js"></script>
</body>
</html>
"""


def render_review_page(cfg, title, slug):
    return REVIEW_PAGE.format(
        title=title,
        title_attr=title.replace('"', "&quot;"),
        nav=NAV,
        listing_file=cfg["listing_file"],
        listing_label=cfg["listing_label"],
        listing_label_en=cfg["listing_label_en"],
        meta_key=cfg["meta_key"],
        slug=slug,
    )


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
    if len(sys.argv) not in (3, 4) or (len(sys.argv) == 4 and sys.argv[3].lower() != "en"):
        print(__doc__)
        sys.exit(1)

    md_path, category = sys.argv[1], sys.argv[2].lower()
    english = len(sys.argv) == 4
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

    if english:
        no_path = os.path.join(SITE_ROOT, "resources", cfg["resource_dir"], f"{slug}.html")
        if not os.path.isfile(no_path):
            print(f"Fant ingen norsk anmeldelse med slug '{slug}' ({no_path}). Sjekk filnavnet.")
            sys.exit(1)
        en_path = os.path.join(SITE_ROOT, "resources", cfg["resource_dir"], f"{slug}.en.html")
        with open(en_path, "w", encoding="utf-8") as f:
            f.write(converted)
        print(f"Skrev {en_path}")
        return

    resource_path = os.path.join(SITE_ROOT, "resources", cfg["resource_dir"], f"{slug}.html")
    with open(resource_path, "w", encoding="utf-8") as f:
        f.write(converted)
    print(f"Skrev {resource_path}")

    page_html = render_review_page(cfg, title, slug)
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
