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

Etter første import holdes stats.json oppdatert av update_letterboxd.py (RSS).
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

    Treffer på tittel + år (aar). Heter filmen noe annet på Letterboxd, eller har et annet
    år der, legg til "letterboxd_tittel" og/eller "letterboxd_aar" i oppføringen.
    Gir {(normalisert tittel, år): slug}.
    """
    with open(os.path.join(SITE_ROOT, "resources", "meta.json"), encoding="utf-8") as f:
        movies = json.load(f).get("movies", {})
    index = {}
    for slug, entry in movies.items():
        year = str(entry.get("letterboxd_aar", entry.get("aar", "")))
        if year.isdigit():
            index[(norm(entry.get("letterboxd_tittel", entry["title"])), year)] = slug
    return index


def compute_stats(films, diary):
    """Regner ut alt siden viser fra filmlisten og dagboken (ingen CSV nødvendig).

    films: [{t, y, u, r?, s?}], diary: [{t, y, u, d, r, rw, s?}]
    """
    per_year = defaultdict(lambda: {"count": 0, "rewatches": 0, "ratings": []})
    for row in diary:
        entry = per_year[row["d"][:4]]
        entry["count"] += 1
        entry["rewatches"] += row["rw"]
        if row["r"] is not None:
            entry["ratings"].append(row["r"])

    rating_values = [f["r"] for f in films if f.get("r") is not None]
    distribution = Counter(rating_values)
    decades = Counter(f["y"] // 10 * 10 for f in films if f["y"])

    return {
        "generated": date.today().isoformat(),
        "totals": {
            "watched": len(films),
            "rated": len(rating_values),
            "average": avg(rating_values),
            "five_star": distribution.get(5.0, 0),
            "diary_entries": len(diary),
            "rewatches": sum(row["rw"] for row in diary),
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
        "diary": diary,
        "films": films,
    }


def write_stats(stats):
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(stats, f, ensure_ascii=False, indent=2)
        f.write("\n")


def main():
    diary_rows, ratings, watched = read("diary.csv"), read("ratings.csv"), read("watched.csv")

    reviews = review_index()
    my_rating = {r["Letterboxd URI"]: float(r["Rating"]) for r in ratings if r["Rating"]}

    def film(row, **extra):
        uri = row["Letterboxd URI"]
        item = {"t": row["Name"], "y": int(row["Year"]) if row["Year"] else None}
        if uri in my_rating:
            item["r"] = my_rating[uri]
        slug = reviews.get((norm(row["Name"]), row["Year"]))
        if slug:
            item["s"] = slug
        item.update(extra)
        return item

    diary = [
        film(
            row,
            d=row["Watched Date"],
            r=float(row["Rating"]) if row["Rating"] else None,
            rw=1 if row["Rewatch"] else 0,
        )
        for row in diary_rows
    ]
    write_stats(compute_stats([film(row) for row in watched], diary))
    print(f"Skrev {OUT}")


if __name__ == "__main__":
    main()
