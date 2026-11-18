#!/usr/bin/env python3
"""Genererer feed.xml (RSS 2.0) fra resources/meta.json.

Kjøres automatisk av add_review.py, men kan også kjøres selv etter at du har
fylt inn datoer i meta.json:
    python3 build_feed.py
"""
import html
import json
import os
import re
from datetime import datetime, timezone
from email.utils import format_datetime

SITE_ROOT = os.path.dirname(os.path.abspath(__file__))
SITE_URL = "https://fredrikudengen.github.io"  # bytt når du får eget domene

KINDS = [
    # (meta_key, resource_dir, page_dir, norsk type, forfatter-felt)
    ("books", "books", "boker", "Bok", "forfatter"),
    ("movies", "movies", "filmer", "Film", "regissor"),
]


def parse_date(value):
    try:
        d, m, y = (int(p) for p in value.split("."))
        return datetime(y, m, d, 12, 0, tzinfo=timezone.utc)
    except (ValueError, AttributeError):
        return None


def excerpt(path, limit=240):
    try:
        with open(path, encoding="utf-8") as f:
            body = f.read()
    except OSError:
        return ""
    m = re.search(r"<p>(.*?)</p>", body, re.S)
    text = re.sub(r"<[^>]+>", "", m.group(1)) if m else ""
    text = html.unescape(" ".join(text.split()))
    if len(text) > limit:
        text = text[:limit].rsplit(" ", 1)[0] + "…"
    return text


def collect():
    with open(os.path.join(SITE_ROOT, "resources", "meta.json"), encoding="utf-8") as f:
        meta = json.load(f)
    items = []
    for meta_key, res_dir, page_dir, label, creator_field in KINDS:
        for slug, entry in meta.get(meta_key, {}).items():
            date = parse_date(entry.get("dato", ""))
            if not date:
                continue  # uten dato kan ikke innlegget plasseres i tidslinjen
            creator = entry.get(creator_field, "")
            title = f"{label}: {entry['title']}" + (f" ({creator})" if creator else "")
            link = f"{SITE_URL}/{page_dir}/{slug}.html"
            desc = excerpt(os.path.join(SITE_ROOT, "resources", res_dir, f"{slug}.html"))
            items.append((date, title, link, desc))
    items.sort(key=lambda i: i[0], reverse=True)
    return items


def render(items):
    esc = html.escape
    out = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">',
        "<channel>",
        "<title>Fredrik Udengen</title>",
        f"<link>{SITE_URL}/skrevet.html</link>",
        "<description>Bok- og filmanmeldelser av Fredrik Udengen</description>",
        "<language>no</language>",
        f'<atom:link href="{SITE_URL}/feed.xml" rel="self" type="application/rss+xml" />',
    ]
    if items:
        out.append(f"<lastBuildDate>{format_datetime(items[0][0])}</lastBuildDate>")
    for date, title, link, desc in items:
        out += [
            "<item>",
            f"<title>{esc(title)}</title>",
            f"<link>{link}</link>",
            f'<guid isPermaLink="true">{link}</guid>',
            f"<pubDate>{format_datetime(date)}</pubDate>",
            f"<description>{esc(desc)}</description>",
            "</item>",
        ]
    out += ["</channel>", "</rss>", ""]
    return "\n".join(out)


def main():
    items = collect()
    path = os.path.join(SITE_ROOT, "feed.xml")
    with open(path, "w", encoding="utf-8") as f:
        f.write(render(items))
    print(f"Skrev {path} ({len(items)} innlegg)")


if __name__ == "__main__":
    main()
