#!/usr/bin/env python3
"""Oppdaterer resources/stats.json med nye filmer fra Letterboxd sin RSS-feed.

Bruk:
    LETTERBOXD_USER=brukernavn python3 update_letterboxd.py
    python3 update_letterboxd.py path/til/feed.xml     (fil i stedet for nett, til testing)

RSS-feeden har bare de siste ca. 50 loggførte filmene, så den bygger videre på det
build_stats.py laget fra eksporten. Ny logging legges i dagboken, nye filmer i filmlisten,
og endret karakter oppdateres. Skriver bare filen hvis noe har endret seg.
GitHub Action (.github/workflows/letterboxd.yml) kjører dette jevnlig.
"""
import json
import os
import re
import sys
import urllib.request
import xml.etree.ElementTree as ET

import build_stats

NS = {"lb": "https://letterboxd.com"}


def load_source(arg):
    if arg:
        with open(arg, "rb") as f:
            return f.read()
    user = os.environ.get("LETTERBOXD_USER", "").strip()
    if not user:
        sys.exit("Sett LETTERBOXD_USER (Letterboxd-brukernavnet) eller oppgi en feed-fil.")
    req = urllib.request.Request(
        f"https://letterboxd.com/{user}/rss/",
        headers={"User-Agent": "fredrikudengen.github.io stats updater"},
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        return resp.read()


def parse_feed(xml_bytes):
    """Gir loggføringer, eldst først. Hopper over lister og andre oppføringer uten film."""
    entries = []
    for item in ET.fromstring(xml_bytes).iter("item"):
        title = item.findtext("lb:filmTitle", namespaces=NS)
        watched = item.findtext("lb:watchedDate", namespaces=NS)
        if not title or not watched:
            continue
        year = item.findtext("lb:filmYear", namespaces=NS)
        rating = item.findtext("lb:memberRating", namespaces=NS)
        link = item.findtext("link") or ""
        slug = re.search(r"/film/([^/]+)/", link)
        entries.append({
            "t": title,
            "y": int(year) if year else None,
            "u": f"https://letterboxd.com/film/{slug.group(1)}/" if slug else link,
            "d": watched,
            "r": float(rating) if rating else None,
            "rw": 1 if (item.findtext("lb:rewatch", namespaces=NS) or "").lower() == "yes" else 0,
        })
    return sorted(entries, key=lambda e: e["d"])


def film_key(item):
    return (build_stats.norm(item["t"]), item["y"])


def merge(stats, entries):
    films, diary = stats["films"], stats["diary"]
    by_film = {film_key(f): f for f in films}
    seen = {(*film_key(d), d["d"]) for d in diary}

    for e in entries:
        key = film_key(e)
        if (*key, e["d"]) not in seen:
            diary.append(dict(e))
            seen.add((*key, e["d"]))
        film = by_film.get(key)
        if film is None:
            film = {"t": e["t"], "y": e["y"], "u": e["u"]}
            films.append(film)
            by_film[key] = film
        if e["r"] is not None:
            film["r"] = e["r"]


def refresh_reviews(stats):
    """Setter «Min anmeldelse»-lenke på filmer du har skrevet om i meta.json."""
    reviews = build_stats.review_index()
    for item in stats["films"] + stats["diary"]:
        slug = reviews.get(item["u"]) or reviews.get((build_stats.norm(item["t"]), str(item["y"])))
        if slug:
            item["s"] = slug
        else:
            item.pop("s", None)


def main():
    arg = sys.argv[1] if len(sys.argv) > 1 else None
    entries = parse_feed(load_source(arg))

    with open(build_stats.OUT, encoding="utf-8") as f:
        old = json.load(f)
    merge(old, entries)
    refresh_reviews(old)
    new = build_stats.compute_stats(old["films"], old["diary"])

    with open(build_stats.OUT, encoding="utf-8") as f:
        before = json.load(f)
    if {k: v for k, v in before.items() if k != "generated"} == {k: v for k, v in new.items() if k != "generated"}:
        print(f"Ingen endringer ({len(entries)} loggføringer i feeden).")
        return
    build_stats.write_stats(new)
    print(f"Oppdaterte {build_stats.OUT} ({len(entries)} loggføringer i feeden).")


if __name__ == "__main__":
    main()
