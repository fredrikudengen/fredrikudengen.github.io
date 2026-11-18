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
    }

    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(stats, f, ensure_ascii=False, indent=2)
        f.write("\n")
    print(f"Skrev {OUT}")


if __name__ == "__main__":
    main()
