#!/usr/bin/env python3
"""Lager resources/stats.json fra Letterboxd-eksporten i letterboxd/.

Eksporter fra Letterboxd (Settings -> Import & Export -> Export your data), legg
diary.csv, ratings.csv og watched.csv i letterboxd/, og kjør:
    python3 build_stats.py

Kilder:
  diary.csv    -> filmer per år og snittkarakter per år (ekte visningsdato).
                  watched.csv/ratings.csv brukes ikke til dette, for der er mange
                  filmer lagt inn samme dag da kontoen ble satt opp.
  ratings.csv  -> karakterfordeling og snittkarakter totalt
  watched.csv  -> antall sette filmer og fordeling på tiår
"""
import csv
import json
import os
from collections import Counter, defaultdict
from datetime import date

SITE_ROOT = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(SITE_ROOT, "letterboxd")
OUT = os.path.join(SITE_ROOT, "resources", "stats.json")


def read(name):
    with open(os.path.join(SRC, name), encoding="utf-8", newline="") as f:
        return list(csv.DictReader(f))


def avg(values):
    return round(sum(values) / len(values), 2) if values else None


def norm(title):
    return "".join(c for c in title.lower() if c.isalnum())


def review_index():
    """Kobler Letterboxd-filmer til egne anmeldelser i meta.json.

    Treff på Letterboxd-lenken hvis oppføringen har feltet "letterboxd" (boxd.it-lenke),
    ellers på tittel + år (aar). Gir {uri | (tittel, år): slug}.
    """
    with open(os.path.join(SITE_ROOT, "resources", "meta.json"), encoding="utf-8") as f:
        movies = json.load(f).get("movies", {})
    index = {}
    for slug, entry in movies.items():
        if entry.get("letterboxd"):
            index[entry["letterboxd"]] = slug
        year = str(entry.get("aar", ""))
        if year.isdigit():
            index[(norm(entry["title"]), year)] = slug
    return index


def main():
    diary, ratings, watched = read("diary.csv"), read("ratings.csv"), read("watched.csv")

    per_year = defaultdict(lambda: {"count": 0, "rewatches": 0, "ratings": []})
    for row in diary:
        year = row["Watched Date"][:4]
        entry = per_year[year]
        entry["count"] += 1
        entry["rewatches"] += 1 if row["Rewatch"] else 0
        if row["Rating"]:
            entry["ratings"].append(float(row["Rating"]))

    rating_values = [float(r["Rating"]) for r in ratings if r["Rating"]]
    distribution = Counter(rating_values)
    decades = Counter(int(w["Year"]) // 10 * 10 for w in watched if w["Year"])

    reviews = review_index()
    my_rating = {r["Letterboxd URI"]: float(r["Rating"]) for r in ratings if r["Rating"]}

    def film(row, **extra):
        uri = row["Letterboxd URI"]
        item = {"t": row["Name"], "y": int(row["Year"]) if row["Year"] else None, "u": uri}
        if uri in my_rating:
            item["r"] = my_rating[uri]
        slug = reviews.get(uri) or reviews.get((norm(row["Name"]), row["Year"]))
        if slug:
            item["s"] = slug
        item.update(extra)
        return item

    stats = {
        "generated": date.today().isoformat(),
        "totals": {
            "watched": len(watched),
            "rated": len(rating_values),
            "average": avg(rating_values),
            "five_star": distribution.get(5.0, 0),
            "diary_entries": len(diary),
            "rewatches": sum(1 for r in diary if r["Rewatch"]),
        },
        "per_year": [
            {
                "year": int(y),
                "count": e["count"],
                "rewatches": e["rewatches"],
                "average": avg(e["ratings"]),
            }
            for y, e in sorted(per_year.items())
        ],
        "ratings": [
            {"rating": r / 2, "count": distribution.get(r / 2, 0)} for r in range(1, 11)
        ],
        "decades": [{"decade": d, "count": c} for d, c in sorted(decades.items())],
        # Filmlistene bak diagrammene. Dagboken har dato og omsett-flagg, de andre har
        # bare den nåværende karakteren din.
        "diary": [
            film(
                row,
                d=row["Watched Date"],
                r=float(row["Rating"]) if row["Rating"] else None,
                rw=1 if row["Rewatch"] else 0,
            )
            for row in diary
        ],
        "films": [film(row) for row in watched],
    }

    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(stats, f, ensure_ascii=False, indent=2)
        f.write("\n")
    print(f"Skrev {OUT}")


if __name__ == "__main__":
    main()
