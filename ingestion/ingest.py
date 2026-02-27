"""
NBA Data Ingestion Pipeline
Pulls player data, game logs, advanced stats, and shot charts from nba_api.

Install dependencies:
    pip install nba_api psycopg2-binary pandas python-dotenv

Usage:
    python ingestion/ingest.py --player "Cade Cunningham" --season 2024-25
    python ingestion/ingest.py --full-refresh --season 2024-25
"""

import time
import argparse
import logging
from datetime import datetime

import pandas as pd
import psycopg2
from psycopg2.extras import execute_values
from dotenv import load_dotenv
import os

from nba_api.stats.endpoints import (
    playergamelogs,
    playerdashboardbyyearoveryear,
    shotchartdetail,
    commonplayerinfo,
    leaguedashplayerstats,
)
from nba_api.stats.static import players, teams

load_dotenv()

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger(__name__)

DB_URL = os.getenv("DATABASE_URL", "postgresql://localhost/nba_analytics")
SEASON = "2024-25"
# nba_api rate limit — be respectful
REQUEST_DELAY = 0.6  


def get_connection():
    return psycopg2.connect(DB_URL)


# ---------------------------------------------------------------------------
# Players & Teams
# ---------------------------------------------------------------------------

def ingest_teams():
    log.info("Ingesting teams...")
    all_teams = teams.get_teams()
    rows = [
        (t["id"], t["full_name"], t["abbreviation"], t["city"], t["state"], None, None)
        for t in all_teams
    ]
    with get_connection() as conn:
        with conn.cursor() as cur:
            execute_values(cur, """
                INSERT INTO teams (team_id, full_name, abbr, city, conference, division)
                VALUES %s
                ON CONFLICT (team_id) DO UPDATE SET
                    full_name = EXCLUDED.full_name,
                    abbr = EXCLUDED.abbr
            """, [(r[0], r[1], r[2], r[3], r[5], r[6]) for r in rows])
        conn.commit()
    log.info(f"  → {len(rows)} teams upserted")


def ingest_players(active_only=True):
    log.info("Ingesting players...")
    all_players = players.get_active_players() if active_only else players.get_players()
    rows = []
    for p in all_players:
        rows.append((p["id"], p["full_name"], None, None, None, None, True))

    with get_connection() as conn:
        with conn.cursor() as cur:
            execute_values(cur, """
                INSERT INTO players (player_id, full_name, team_id, team_abbr, position, jersey_number, is_active)
                VALUES %s
                ON CONFLICT (player_id) DO UPDATE SET
                    full_name = EXCLUDED.full_name,
                    is_active = EXCLUDED.is_active
            """, rows)
        conn.commit()
    log.info(f"  → {len(rows)} players upserted")


# ---------------------------------------------------------------------------
# Game Logs
# ---------------------------------------------------------------------------

def ingest_game_logs(player_id: int, season: str = SEASON):
    log.info(f"  Fetching game logs for player {player_id} ({season})...")
    time.sleep(REQUEST_DELAY)

    logs = playergamelogs.PlayerGameLogs(
        player_id_nullable=player_id,
        season_nullable=season,
    ).get_data_frames()[0]

    if logs.empty:
        log.warning(f"  No game logs found for player {player_id}")
        return

    rows = []
    for _, row in logs.iterrows():
        rows.append((
            player_id,
            row["GAME_ID"],
            row["GAME_DATE"][:10],  # truncate to date
            season,
            row.get("MATCHUP"),
            row.get("WL"),
            row.get("MIN"),
            row.get("PTS"),
            row.get("REB"),
            row.get("AST"),
            row.get("STL"),
            row.get("BLK"),
            row.get("TOV"),
            row.get("FGM"),
            row.get("FGA"),
            row.get("FG_PCT"),
            row.get("FG3M"),
            row.get("FG3A"),
            row.get("FG3_PCT"),
            row.get("FTM"),
            row.get("FTA"),
            row.get("FT_PCT"),
            row.get("PLUS_MINUS"),
        ))

    with get_connection() as conn:
        with conn.cursor() as cur:
            execute_values(cur, """
                INSERT INTO player_game_logs (
                    player_id, game_id, game_date, season, matchup, wl,
                    min, pts, reb, ast, stl, blk, tov,
                    fgm, fga, fg_pct, fg3m, fg3a, fg3_pct,
                    ftm, fta, ft_pct, plus_minus
                ) VALUES %s
                ON CONFLICT (player_id, game_id) DO UPDATE SET
                    pts = EXCLUDED.pts,
                    plus_minus = EXCLUDED.plus_minus
            """, rows)
        conn.commit()
    log.info(f"  → {len(rows)} game logs upserted")


# ---------------------------------------------------------------------------
# Advanced Stats
# ---------------------------------------------------------------------------

def ingest_advanced_stats(season: str = SEASON):
    log.info(f"Fetching league-wide advanced stats ({season})...")
    time.sleep(REQUEST_DELAY)

    stats = leaguedashplayerstats.LeagueDashPlayerStats(
    season=season,
).get_data_frames()[0]

    # Only insert stats for players already in our players table
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT player_id FROM players")
            existing_ids = {r[0] for r in cur.fetchall()}

    rows = []
    for _, row in stats.iterrows():
        if int(row["PLAYER_ID"]) not in existing_ids:
            continue
        rows.append((
            int(row["PLAYER_ID"]),
            season,
            row.get("GP"),
            row.get("PIE"),        # nba_api uses PIE, similar to PER
            row.get("TS_PCT"),
            row.get("USG_PCT"),
            None,                  # BPM not in this endpoint
            None,                  # VORP not in this endpoint
            row.get("AST_PCT"),
            row.get("REB_PCT"),
            row.get("TM_TOV_PCT"),
        ))

    with get_connection() as conn:
        with conn.cursor() as cur:
            execute_values(cur, """
                INSERT INTO player_advanced_stats (
                    player_id, season, gp, per, ts_pct, usg_pct,
                    bpm, vorp, ast_pct, reb_pct, tov_pct
                ) VALUES %s
                ON CONFLICT (player_id, season) DO UPDATE SET
                    gp = EXCLUDED.gp,
                    per = EXCLUDED.per,
                    ts_pct = EXCLUDED.ts_pct,
                    usg_pct = EXCLUDED.usg_pct
            """, rows)
        conn.commit()
    log.info(f"  → {len(rows)} advanced stat rows upserted")


# ---------------------------------------------------------------------------
# Shot Charts
# ---------------------------------------------------------------------------

def ingest_shot_chart(player_id: int, season: str = SEASON):
    log.info(f"  Fetching shot chart for player {player_id}...")
    time.sleep(REQUEST_DELAY)

    shots = shotchartdetail.ShotChartDetail(
        team_id=0,
        player_id=player_id,
        season_nullable=season,
        season_type_all_star="Regular Season",
    ).get_data_frames()[0]

    if shots.empty:
        return

    rows = []
    for _, row in shots.iterrows():
        rows.append((
            player_id,
            row.get("GAME_ID"),
            season,
            row.get("GAME_DATE"),
            row.get("SHOT_ZONE_AREA"),
            row.get("SHOT_ZONE_BASIC"),
            row.get("SHOT_DISTANCE"),
            row.get("LOC_X"),
            row.get("LOC_Y"),
            row.get("SHOT_MADE_FLAG") == 1,
            row.get("SHOT_TYPE"),
            row.get("ACTION_TYPE"),
        ))

    with get_connection() as conn:
        with conn.cursor() as cur:
            # Delete existing and reinsert (shot charts don't have a clean unique key)
            cur.execute(
                "DELETE FROM shot_chart WHERE player_id = %s AND season = %s",
                (player_id, season)
            )
            execute_values(cur, """
                INSERT INTO shot_chart (
                    player_id, game_id, season, game_date,
                    shot_zone, shot_zone_basic, shot_distance,
                    loc_x, loc_y, shot_made, shot_type, action_type
                ) VALUES %s
            """, rows)
        conn.commit()
    log.info(f"  → {len(rows)} shot chart rows upserted")


# ---------------------------------------------------------------------------
# Rolling Averages
# ---------------------------------------------------------------------------

def compute_rolling_averages(player_id: int, season: str = SEASON, windows=(5, 10, 20)):
    log.info(f"  Computing rolling averages for player {player_id}...")

    with get_connection() as conn:
        df = pd.read_sql("""
            SELECT DISTINCT ON (game_date) game_date, pts, reb, ast, plus_minus, fga, ftm, fta, fg3m, fg3a, fgm
            FROM player_game_logs
            WHERE player_id = %s AND season = %s
            ORDER BY game_date
        """, conn, params=(player_id, season))

    if df.empty:
        return

    # True shooting %: PTS / (2 * (FGA + 0.44 * FTA))
    df["ts_pct"] = df["pts"] / (2 * (df["fga"] + 0.44 * df["fta"].clip(lower=0.001)))

    numeric_cols = ["pts", "reb", "ast", "ts_pct", "plus_minus"]
    rows = []
    for window in windows:
        rolled = df[numeric_cols].rolling(window, min_periods=1).mean()
        for i, (_, row) in enumerate(rolled.iterrows()):
            rows.append((
                player_id,
                df.iloc[i]["game_date"],
                season,
                window,
                float(row["pts"]),
                float(row["reb"]),
                float(row["ast"]),
                float(row["ts_pct"]) if not pd.isna(row["ts_pct"]) else None,
                float(row["plus_minus"]),
            ))
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "DELETE FROM player_rolling_averages WHERE player_id = %s AND season = %s",
                (player_id, season)
            )
            execute_values(cur, """
                INSERT INTO player_rolling_averages (
                    player_id, game_date, season, window_size,
                    pts_avg, reb_avg, ast_avg, ts_pct_avg, plus_minus_avg
                ) VALUES %s
                ON CONFLICT (player_id, game_date, window_size) DO UPDATE SET
                    pts_avg = EXCLUDED.pts_avg,
                    reb_avg = EXCLUDED.reb_avg,
                    ast_avg = EXCLUDED.ast_avg,
                    ts_pct_avg = EXCLUDED.ts_pct_avg,
                    plus_minus_avg = EXCLUDED.plus_minus_avg,
                    season = EXCLUDED.season
            """, rows)
        conn.commit()
    log.info(f"  → {len(rows)} rolling average rows computed")


# ---------------------------------------------------------------------------
# Full player pipeline
# ---------------------------------------------------------------------------

def ingest_player(name: str, season: str = SEASON):
    matched = [p for p in players.get_active_players() if name.lower() in p["full_name"].lower()]
    if not matched:
        log.error(f"Player '{name}' not found")
        return
    if len(matched) > 1:
        log.warning(f"Multiple matches: {[p['full_name'] for p in matched]} — using first")

    player = matched[0]
    pid = player["id"]
    log.info(f"Ingesting {player['full_name']} (id={pid})")

    ingest_game_logs(pid, season)
    ingest_shot_chart(pid, season)
    compute_rolling_averages(pid, season)
    log.info(f"Done ingesting {player['full_name']}")


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="NBA Analytics Ingestion")
    parser.add_argument("--player", type=str, help="Player name to ingest")
    parser.add_argument("--season", type=str, default=SEASON)
    parser.add_argument("--full-refresh", action="store_true", help="Ingest all active players")
    parser.add_argument("--teams-players", action="store_true", help="Seed teams and players tables")
    args = parser.parse_args()

    if args.teams_players:
        ingest_teams()
        ingest_players()
        ingest_advanced_stats(args.season)

    elif args.player:
        ingest_player(args.player, args.season)

    elif args.full_refresh:
        ingest_teams()
        ingest_players()
        ingest_advanced_stats(args.season)
        all_players = players.get_active_players()
        for p in all_players:
            try:
                ingest_game_logs(p["id"], args.season)
                ingest_shot_chart(p["id"], args.season)
                compute_rolling_averages(p["id"], args.season)
            except Exception as e:
                log.error(f"Failed on {p['full_name']}: {e}")

    else:
        parser.print_help()
