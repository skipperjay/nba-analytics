"""
NBA Analytics API
Run with: uvicorn api.main:app --reload
"""

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
import psycopg2
import psycopg2.extras
import anthropic
import os
import json
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(title="NBA Analytics API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)

DB_URL = os.getenv("DATABASE_URL", "postgresql://localhost/nba_analytics")
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY")


def get_db():
    conn = psycopg2.connect(DB_URL)
    conn.cursor_factory = psycopg2.extras.RealDictCursor
    return conn


# ---------------------------------------------------------------------------
# Players
# ---------------------------------------------------------------------------

@app.get("/players/search")
def search_players(q: str = Query(..., min_length=2)):
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT player_id, full_name, team_abbr, position
                FROM players
                WHERE LOWER(full_name) LIKE LOWER(%s) AND is_active = TRUE
                LIMIT 10
            """, (f"%{q}%",))
            return cur.fetchall()


@app.get("/players/{player_id}/game-logs")
def get_game_logs(player_id: int, season: str = "2024-25", last_n: int = 20):
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT *
                FROM player_game_logs
                WHERE player_id = %s AND season = %s
                ORDER BY game_date DESC
                LIMIT %s
            """, (player_id, season, last_n))
            return cur.fetchall()


@app.get("/players/{player_id}/rolling-averages")
def get_rolling_averages(player_id: int, season: str = "2024-25", window: int = 10):
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT game_date, pts_avg, reb_avg, ast_avg, ts_pct_avg, plus_minus_avg
                FROM player_rolling_averages
                WHERE player_id = %s AND season = %s AND window_size = %s
                ORDER BY game_date ASC
            """, (player_id, season, window))
            return cur.fetchall()


@app.get("/players/{player_id}/shot-chart")
def get_shot_chart(player_id: int, season: str = "2024-25"):
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT
                    shot_zone,
                    shot_zone_basic,
                    COUNT(*) AS attempts,
                    SUM(CASE WHEN shot_made THEN 1 ELSE 0 END) AS makes,
                    ROUND(AVG(CASE WHEN shot_made THEN 1.0 ELSE 0.0 END) * 100, 1) AS pct
                FROM shot_chart
                WHERE player_id = %s AND season = %s
                GROUP BY shot_zone, shot_zone_basic
                ORDER BY attempts DESC
            """, (player_id, season))
            return cur.fetchall()


@app.get("/players/{player_id}/advanced")
def get_advanced_stats(player_id: int, season: str = "2024-25"):
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT * FROM player_advanced_stats
                WHERE player_id = %s AND season = %s
            """, (player_id, season))
            row = cur.fetchone()
            if not row:
                raise HTTPException(404, "Advanced stats not found")
            return row


# ---------------------------------------------------------------------------
# Player Comparison
# ---------------------------------------------------------------------------

@app.get("/compare")
def compare_players(
    player_a: int = Query(...),
    player_b: int = Query(...),
    season: str = "2024-25"
):
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT
                    p.full_name,
                    p.team_abbr,
                    AVG(gl.pts) AS ppg,
                    AVG(gl.reb) AS rpg,
                    AVG(gl.ast) AS apg,
                    AVG(gl.tov) AS topg,
                    AVG(gl.plus_minus) AS plus_minus,
                    AVG(gl.fg_pct) AS fg_pct,
                    AVG(gl.fg3_pct) AS fg3_pct,
                    COUNT(*) AS gp
                FROM player_game_logs gl
                JOIN players p ON p.player_id = gl.player_id
                WHERE gl.player_id = ANY(%s) AND gl.season = %s
                GROUP BY p.full_name, p.team_abbr, gl.player_id
            """, ([player_a, player_b], season))
            return cur.fetchall()


# ---------------------------------------------------------------------------
# AI Insights
# ---------------------------------------------------------------------------

class InsightRequest(BaseModel):
    player_id: int
    season: str = "2024-25"
    question: Optional[str] = None   # e.g. "Why is he struggling lately?"


@app.post("/insights")
def generate_insight(req: InsightRequest):
    # Check cache first
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT insight_text FROM player_insights
                WHERE player_id = %s AND season = %s
                  AND insight_type = 'season_summary'
                  AND expires_at > NOW()
                ORDER BY generated_at DESC
                LIMIT 1
            """, (req.player_id, req.season))
            cached = cur.fetchone()
            if cached and not req.question:
                return {"insight": cached["insight_text"], "cached": True}

    # Pull context data
    with get_db() as conn:
        with conn.cursor() as cur:
            # Player info
            cur.execute("SELECT full_name, team_abbr, position FROM players WHERE player_id = %s", (req.player_id,))
            player = cur.fetchone()
            if not player:
                raise HTTPException(404, "Player not found")

            # Last 20 game logs
            cur.execute("""
                SELECT game_date, matchup, wl, pts, reb, ast, tov,
                       fg_pct, fg3_pct, ft_pct, plus_minus, min
                FROM player_game_logs
                WHERE player_id = %s AND season = %s
                ORDER BY game_date DESC LIMIT 20
            """, (req.player_id, req.season))
            recent_games = cur.fetchall()

            # Season averages
            cur.execute("""
                SELECT
                    ROUND(AVG(pts)::numeric, 1) AS ppg,
                    ROUND(AVG(reb)::numeric, 1) AS rpg,
                    ROUND(AVG(ast)::numeric, 1) AS apg,
                    ROUND(AVG(tov)::numeric, 1) AS topg,
                    ROUND(AVG(fg_pct)::numeric, 3) AS fg_pct,
                    ROUND(AVG(fg3_pct)::numeric, 3) AS fg3_pct,
                    ROUND(AVG(plus_minus)::numeric, 1) AS plus_minus,
                    COUNT(*) AS gp
                FROM player_game_logs
                WHERE player_id = %s AND season = %s
            """, (req.player_id, req.season))
            season_avgs = cur.fetchone()

            # Shot zones
            cur.execute("""
                SELECT shot_zone_basic,
                       COUNT(*) AS attempts,
                       ROUND(AVG(CASE WHEN shot_made THEN 1.0 ELSE 0.0 END) * 100, 1) AS pct
                FROM shot_chart
                WHERE player_id = %s AND season = %s
                GROUP BY shot_zone_basic
                ORDER BY attempts DESC
            """, (req.player_id, req.season))
            shot_zones = cur.fetchall()

    # Build prompt
    user_question = req.question or f"Why is {player['full_name']} having the season they're having? What are the key drivers of their performance?"

    prompt = f"""You are an expert NBA analyst. Use the following data to answer the question below.

Player: {player['full_name']} ({player['team_abbr']}, {player['position']})
Season: {req.season}

SEASON AVERAGES:
{json.dumps(dict(season_avgs), indent=2, default=str)}

LAST 20 GAMES (most recent first):
{json.dumps([dict(g) for g in recent_games], indent=2, default=str)}

SHOT ZONE BREAKDOWN:
{json.dumps([dict(z) for z in shot_zones], indent=2, default=str)}

QUESTION: {user_question}

Provide a detailed but concise analysis (3-5 paragraphs). Focus on specific patterns in the data. 
Mention actual numbers. Identify the 2-3 biggest factors driving performance. Be direct and insightful.
"""

    client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
    message = client.messages.create(
        model="claude-opus-4-6",
        max_tokens=1024,
        messages=[{"role": "user", "content": prompt}]
    )

    insight_text = message.content[0].text

    # Cache it
    if not req.question:
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    INSERT INTO player_insights (player_id, season, insight_type, insight_text)
                    VALUES (%s, %s, 'season_summary', %s)
                """, (req.player_id, req.season, insight_text))
            conn.commit()

    return {"insight": insight_text, "cached": False}


# ---------------------------------------------------------------------------
# Trend Detection
# ---------------------------------------------------------------------------

@app.get("/players/{player_id}/trends")
def detect_trends(player_id: int, season: str = "2024-25"):
    """Compare last 5 games vs season average to flag trends."""
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                WITH season_avg AS (
                    SELECT AVG(pts) as pts, AVG(reb) as reb, AVG(ast) as ast,
                           AVG(fg_pct) as fg_pct, AVG(plus_minus) as plus_minus
                    FROM player_game_logs
                    WHERE player_id = %s AND season = %s
                ),
                last5 AS (
                    SELECT AVG(pts) as pts, AVG(reb) as reb, AVG(ast) as ast,
                           AVG(fg_pct) as fg_pct, AVG(plus_minus) as plus_minus
                    FROM (
                        SELECT * FROM player_game_logs
                        WHERE player_id = %s AND season = %s
                        ORDER BY game_date DESC LIMIT 5
                    ) sub
                )
                SELECT
                    ROUND((l.pts - s.pts)::numeric, 1) AS pts_delta,
                    ROUND((l.reb - s.reb)::numeric, 1) AS reb_delta,
                    ROUND((l.ast - s.ast)::numeric, 1) AS ast_delta,
                    ROUND((l.fg_pct - s.fg_pct)::numeric, 3) AS fg_pct_delta,
                    ROUND((l.plus_minus - s.plus_minus)::numeric, 1) AS plus_minus_delta,
                    s.pts as season_pts, l.pts as recent_pts
                FROM season_avg s, last5 l
            """, (player_id, season, player_id, season))
            return cur.fetchone()
