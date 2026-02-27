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
    allow_origins=[
        "https://nba-analytics-eta.vercel.app",
        "http://localhost:3000",
    ],
    allow_methods=["*"],
    allow_headers=["*"],
)

DB_URL = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@db/nba_analytics")
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY")
YOUTUBE_API_KEY = os.getenv("YOUTUBE_API_KEY")


def get_db():
    conn = psycopg2.connect(DB_URL)
    conn.cursor_factory = psycopg2.extras.RealDictCursor
    return conn


# ---------------------------------------------------------------------------
# Health check (required by Railway)
# ---------------------------------------------------------------------------

@app.get("/health")
def health():
    return {"status": "ok"}


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
                SELECT * FROM player_game_logs
                WHERE player_id = %s AND season = %s
                ORDER BY game_date DESC LIMIT %s
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
                SELECT shot_zone, shot_zone_basic,
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


@app.get("/players/{player_id}/trends")
def detect_trends(player_id: int, season: str = "2024-25"):
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                WITH season_avg AS (
                    SELECT AVG(pts) as pts, AVG(reb) as reb, AVG(ast) as ast,
                           AVG(fg_pct) as fg_pct, AVG(plus_minus) as plus_minus
                    FROM player_game_logs WHERE player_id = %s AND season = %s
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
                    ROUND(s.pts::numeric, 1) as season_pts,
                    ROUND(l.pts::numeric, 1) as recent_pts
                FROM season_avg s, last5 l
            """, (player_id, season, player_id, season))
            return cur.fetchone()


# ---------------------------------------------------------------------------
# Compare
# ---------------------------------------------------------------------------

@app.get("/compare")
def compare_players(player_a: int = Query(...), player_b: int = Query(...), season: str = "2024-25"):
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT p.full_name, p.team_abbr,
                    ROUND(AVG(gl.pts)::numeric, 1) AS ppg,
                    ROUND(AVG(gl.reb)::numeric, 1) AS rpg,
                    ROUND(AVG(gl.ast)::numeric, 1) AS apg,
                    ROUND(AVG(gl.tov)::numeric, 1) AS topg,
                    ROUND(AVG(gl.plus_minus)::numeric, 1) AS plus_minus,
                    ROUND(AVG(gl.fg_pct)::numeric, 3) AS fg_pct,
                    ROUND(AVG(gl.fg3_pct)::numeric, 3) AS fg3_pct,
                    COUNT(*) AS gp
                FROM player_game_logs gl
                JOIN players p ON p.player_id = gl.player_id
                WHERE gl.player_id = ANY(%s) AND gl.season = %s
                GROUP BY p.full_name, p.team_abbr, gl.player_id
            """, ([player_a, player_b], season))
            return cur.fetchall()


# ---------------------------------------------------------------------------
# YouTube
# ---------------------------------------------------------------------------

@app.get("/players/{player_id}/videos")
def get_player_videos(player_id: int, query_context: str = "highlights 2025"):
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT full_name FROM players WHERE player_id = %s", (player_id,))
            player = cur.fetchone()
            if not player:
                raise HTTPException(404, "Player not found")

    if not YOUTUBE_API_KEY:
        raise HTTPException(500, "YouTube API key not configured")

    from googleapiclient.discovery import build
    youtube = build("youtube", "v3", developerKey=YOUTUBE_API_KEY)
    search_query = f"{player['full_name']} {query_context}"

    response = youtube.search().list(
        q=search_query,
        part="snippet",
        type="video",
        maxResults=4,
        videoDuration="medium",
        relevanceLanguage="en",
    ).execute()

    return [{
        "video_id": item["id"]["videoId"],
        "title": item["snippet"]["title"],
        "thumbnail": item["snippet"]["thumbnails"]["medium"]["url"],
        "channel": item["snippet"]["channelTitle"],
        "embed_url": f"https://www.youtube.com/embed/{item['id']['videoId']}",
    } for item in response.get("items", [])]


# ---------------------------------------------------------------------------
# AI Insights
# ---------------------------------------------------------------------------

class InsightRequest(BaseModel):
    player_id: Optional[int] = None
    season: str = "2025-26"
    question: Optional[str] = None
    _raw: Optional[bool] = False


@app.post("/insights")
def generate_insight(req: InsightRequest):
    # Raw mode — just pass question directly to Claude (for banter tools)
    if not req.player_id and req.question:
        client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
        message = client.messages.create(
            model="claude-opus-4-6",
            max_tokens=1024,
            messages=[{"role": "user", "content": req.question}]
        )
        return {"insight": message.content[0].text, "cached": False, "keywords": []}

    # Check cache
    if not req.question:
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    SELECT insight_text FROM player_insights
                    WHERE player_id = %s AND season = %s
                      AND insight_type = 'season_summary'
                      AND expires_at > NOW()
                    ORDER BY generated_at DESC LIMIT 1
                """, (req.player_id, req.season))
                cached = cur.fetchone()
                if cached:
                    return {"insight": cached["insight_text"], "cached": True, "keywords": []}

    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT full_name, team_abbr, position FROM players WHERE player_id = %s", (req.player_id,))
            player = cur.fetchone()
            if not player:
                raise HTTPException(404, "Player not found")

            cur.execute("""
                SELECT game_date, matchup, wl, pts, reb, ast, tov,
                       fg_pct, fg3_pct, ft_pct, plus_minus, min
                FROM player_game_logs
                WHERE player_id = %s AND season = %s
                ORDER BY game_date DESC LIMIT 20
            """, (req.player_id, req.season))
            recent_games = cur.fetchall()

            cur.execute("""
                SELECT ROUND(AVG(pts)::numeric,1) AS ppg, ROUND(AVG(reb)::numeric,1) AS rpg,
                       ROUND(AVG(ast)::numeric,1) AS apg, ROUND(AVG(tov)::numeric,1) AS topg,
                       ROUND(AVG(fg_pct)::numeric,3) AS fg_pct, ROUND(AVG(fg3_pct)::numeric,3) AS fg3_pct,
                       ROUND(AVG(plus_minus)::numeric,1) AS plus_minus, COUNT(*) AS gp
                FROM player_game_logs WHERE player_id = %s AND season = %s
            """, (req.player_id, req.season))
            season_avgs = cur.fetchone()

            cur.execute("""
                SELECT shot_zone_basic, COUNT(*) AS attempts,
                       ROUND(AVG(CASE WHEN shot_made THEN 1.0 ELSE 0.0 END)*100,1) AS pct
                FROM shot_chart WHERE player_id = %s AND season = %s
                GROUP BY shot_zone_basic ORDER BY attempts DESC
            """, (req.player_id, req.season))
            shot_zones = cur.fetchall()

    user_question = req.question or f"Why is {player['full_name']} having the season they're having? What are the key drivers of their performance?"

    prompt = f"""You are an expert NBA analyst. Use the data below to answer the question.

Player: {player['full_name']} ({player['team_abbr']}, {player['position']})
Season: {req.season}

SEASON AVERAGES: {json.dumps(dict(season_avgs), default=str)}
LAST 20 GAMES: {json.dumps([dict(g) for g in recent_games], default=str)}
SHOT ZONES: {json.dumps([dict(z) for z in shot_zones], default=str)}

QUESTION: {user_question}

Respond with a JSON object:
{{
  "insight": "3-5 paragraph analysis with specific numbers and the 2-3 biggest performance factors",
  "keywords": ["3-4 short YouTube search phrases reflecting key themes, e.g. mid range improvement"]
}}

CRITICAL: Return ONLY a raw JSON object. No markdown, no code blocks, no explanatory text before or after. Just the JSON object starting with {{ and ending with }}."""

    client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
    message = client.messages.create(
        model="claude-opus-4-6",
        max_tokens=1024,
        messages=[{"role": "user", "content": prompt}]
    )

    try:
        parsed = json.loads(message.content[0].text)
        insight_text = parsed.get("insight", "")
        keywords = parsed.get("keywords", [])
    except json.JSONDecodeError:
        insight_text = message.content[0].text
        keywords = []

    if not req.question:
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    INSERT INTO player_insights (player_id, season, insight_type, insight_text)
                    VALUES (%s, %s, 'season_summary', %s)
                """, (req.player_id, req.season, insight_text))
            conn.commit()

    return {"insight": insight_text, "cached": False, "keywords": keywords}
