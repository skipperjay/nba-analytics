"""
Bulk ingestion script — ingests all active NBA players across specified seasons.
Usage:
    python ingest_bulk.py                        # all active players, current season
    python ingest_bulk.py --seasons 2025-26 2024-25 2023-24   # multiple seasons
    python ingest_bulk.py --all-seasons          # last 25 seasons (long!)
"""

import subprocess
import sys
import argparse
import time
from nba_api.stats.static import players

ALL_SEASONS = [
    "2025-26", "2024-25", "2023-24", "2022-23", "2021-22",
    "2020-21", "2019-20", "2018-19", "2017-18", "2016-17",
    "2015-16", "2014-15", "2013-14", "2012-13", "2011-12",
    "2010-11", "2009-10", "2008-09", "2007-08", "2006-07",
    "2005-06", "2004-05", "2003-04", "2002-03", "2001-02",
]

def run(player, season):
    result = subprocess.run(
        [sys.executable, "ingestion/ingest.py", "--player", player, "--season", season],
        capture_output=False,
    )
    return result.returncode == 0

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--seasons", nargs="+", default=["2025-26"])
    parser.add_argument("--all-seasons", action="store_true")
    parser.add_argument("--active-only", action="store_true", default=True)
    args = parser.parse_args()

    seasons = ALL_SEASONS if args.all_seasons else args.seasons

    print("Fetching player list from nba_api...")
    all_players = players.get_active_players() if args.active_only else players.get_players()
    player_names = [p["full_name"] for p in all_players]
    print(f"Found {len(player_names)} players")

    total = len(player_names) * len(seasons)
    done = 0
    failed = []

    for season in seasons:
        print(f"\n{'='*50}")
        print(f"  Season: {season}  ({len(player_names)} players)")
        print(f"{'='*50}")
        for player in player_names:
            done += 1
            print(f"\n[{done}/{total}] {player} — {season}")
            ok = run(player, season)
            if not ok:
                failed.append(f"{player} ({season})")

    print(f"\n{'='*50}")
    print(f"Done! {total - len(failed)}/{total} succeeded.")
    if failed:
        print(f"\nFailed ({len(failed)}):")
        for f in failed:
            print(f"  - {f}")
    print('='*50)
