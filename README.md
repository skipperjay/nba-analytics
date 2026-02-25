# NBA Analytics Platform

An AI-powered NBA player performance intelligence tool. Ask *why* a player is thriving or struggling — not just what their stats are.

---

## Features

- **Game log ingestion** — pulls every game for any active player via `nba_api`
- **Advanced stats** — True Shooting %, Usage Rate, PIE, and more
- **Shot chart analysis** — zone-by-zone efficiency breakdowns
- **Rolling averages** — 5/10/20-game windows to spot momentum shifts
- **Trend detection** — auto-flags significant stat changes vs season average
- **AI insights** — feed real data into Claude to get narrative explanations of performance
- **Player comparison** — head-to-head stat comparison across any two players

---

## Stack

| Layer | Tech |
|---|---|
| Data ingestion | Python + `nba_api` |
| Database | PostgreSQL + DuckDB (optional for local dev) |
| Transformations | dbt (optional) |
| API | FastAPI |
| AI | Anthropic Claude API |
| Frontend | React + Recharts |

---

## Quickstart

### 1. Set up Postgres

```bash
createdb nba_analytics
psql nba_analytics < schema.sql
```

### 2. Install Python dependencies

```bash
pip install nba_api psycopg2-binary pandas fastapi uvicorn anthropic python-dotenv
```

### 3. Configure environment

```bash
cp .env.example .env
# Edit .env with your DB URL and Anthropic API key
```

### 4. Ingest data

```bash
# Seed teams and players first
python ingestion/ingest.py --teams-players --season 2024-25

# Ingest specific players
python ingestion/ingest.py --player "Cade Cunningham" --season 2024-25
python ingestion/ingest.py --player "Paolo Banchero" --season 2024-25

# Full league refresh (takes ~30 mins due to rate limiting)
python ingestion/ingest.py --full-refresh --season 2024-25
```

### 5. Start the API

```bash
uvicorn api.main:app --reload
```

### 6. Start the frontend

```bash
cd frontend
npm install
npm run dev
```

---

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| GET | `/players/search?q=cade` | Search players by name |
| GET | `/players/{id}/game-logs` | Recent game logs |
| GET | `/players/{id}/rolling-averages` | 5/10/20-game rolling stats |
| GET | `/players/{id}/shot-chart` | Shot zone efficiency |
| GET | `/players/{id}/advanced` | Advanced stats |
| GET | `/players/{id}/trends` | Last 5 vs season average |
| GET | `/compare?player_a=X&player_b=Y` | Head-to-head comparison |
| POST | `/insights` | AI-generated performance analysis |

---

## Example AI Insight Query

```bash
curl -X POST http://localhost:8000/insights \
  -H "Content-Type: application/json" \
  -d '{
    "player_id": 1629029,
    "season": "2024-25",
    "question": "Why is Cade Cunningham having such a good season?"
  }'
```

---

## Project Structure

```
nba-analytics/
├── schema.sql              # Database schema
├── ingestion/
│   └── ingest.py           # Data ingestion pipeline
├── api/
│   └── main.py             # FastAPI backend
├── frontend/               # React app (to build)
└── README.md
```

---

## Roadmap

- [ ] React frontend with player search + charts
- [ ] Shot chart visualization (hexbin map)
- [ ] dbt models for cleaner transformations
- [ ] Scheduled nightly ingestion (Airflow or cron)
- [ ] Lineup/on-off analysis
- [ ] Real-time game tracking during live games
