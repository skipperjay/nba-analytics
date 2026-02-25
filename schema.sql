-- NBA Analytics Platform Schema

-- Players
CREATE TABLE IF NOT EXISTS players (
    player_id       INTEGER PRIMARY KEY,
    full_name       TEXT NOT NULL,
    team_id         INTEGER,
    team_abbr       TEXT,
    position        TEXT,
    jersey_number   TEXT,
    is_active       BOOLEAN DEFAULT TRUE,
    updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Teams
CREATE TABLE IF NOT EXISTS teams (
    team_id     INTEGER PRIMARY KEY,
    full_name   TEXT NOT NULL,
    abbr        TEXT NOT NULL,
    city        TEXT,
    conference  TEXT,
    division    TEXT
);

-- Game logs (one row per player per game)
CREATE TABLE IF NOT EXISTS player_game_logs (
    id              SERIAL PRIMARY KEY,
    player_id       INTEGER REFERENCES players(player_id),
    game_id         TEXT NOT NULL,
    game_date       DATE NOT NULL,
    season          TEXT NOT NULL,         -- e.g. '2024-25'
    matchup         TEXT,                  -- e.g. 'DET vs. OKC'
    wl              CHAR(1),               -- W or L
    min             FLOAT,
    pts             FLOAT,
    reb             FLOAT,
    ast             FLOAT,
    stl             FLOAT,
    blk             FLOAT,
    tov             FLOAT,
    fgm             FLOAT,
    fga             FLOAT,
    fg_pct          FLOAT,
    fg3m            FLOAT,
    fg3a            FLOAT,
    fg3_pct         FLOAT,
    ftm             FLOAT,
    fta             FLOAT,
    ft_pct          FLOAT,
    plus_minus      FLOAT,
    UNIQUE(player_id, game_id)
);

-- Advanced stats (per season)
CREATE TABLE IF NOT EXISTS player_advanced_stats (
    id              SERIAL PRIMARY KEY,
    player_id       INTEGER REFERENCES players(player_id),
    season          TEXT NOT NULL,
    gp              INTEGER,
    per             FLOAT,   -- Player Efficiency Rating
    ts_pct          FLOAT,   -- True Shooting %
    usg_pct         FLOAT,   -- Usage Rate
    bpm             FLOAT,   -- Box Plus/Minus
    vorp            FLOAT,   -- Value Over Replacement
    ast_pct         FLOAT,
    reb_pct         FLOAT,
    tov_pct         FLOAT,
    UNIQUE(player_id, season)
);

-- Shot chart data
CREATE TABLE IF NOT EXISTS shot_chart (
    id              SERIAL PRIMARY KEY,
    player_id       INTEGER REFERENCES players(player_id),
    game_id         TEXT,
    season          TEXT NOT NULL,
    game_date       DATE,
    shot_zone       TEXT,   -- e.g. 'Left Corner 3', 'Paint', 'Mid-Range'
    shot_zone_basic TEXT,
    shot_distance   INTEGER,
    loc_x           FLOAT,
    loc_y           FLOAT,
    shot_made       BOOLEAN,
    shot_type       TEXT,   -- '2PT' or '3PT'
    action_type     TEXT    -- 'Jump Shot', 'Layup', etc.
);

-- Lineup stats (player performance with/without teammates)
CREATE TABLE IF NOT EXISTS lineup_stats (
    id              SERIAL PRIMARY KEY,
    player_id       INTEGER REFERENCES players(player_id),
    season          TEXT NOT NULL,
    lineup          TEXT,   -- comma-separated player IDs
    min             FLOAT,
    net_rating      FLOAT,
    off_rating      FLOAT,
    def_rating      FLOAT,
    pace            FLOAT
);

-- AI-generated insights cache
CREATE TABLE IF NOT EXISTS player_insights (
    id              SERIAL PRIMARY KEY,
    player_id       INTEGER REFERENCES players(player_id),
    season          TEXT NOT NULL,
    insight_type    TEXT,   -- 'season_summary', 'trend', 'comparison'
    insight_text    TEXT,
    generated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    -- Cache for 24hrs so we don't hammer the LLM API
    expires_at      TIMESTAMP DEFAULT (CURRENT_TIMESTAMP + INTERVAL '24 hours')
);

-- Rolling averages (materialized for performance)
CREATE TABLE IF NOT EXISTS player_rolling_averages (
    id              SERIAL PRIMARY KEY,
    player_id       INTEGER REFERENCES players(player_id),
    game_date       DATE NOT NULL,
    season          TEXT NOT NULL,
    window_size     INTEGER,   -- 5, 10, or 20 game rolling window
    pts_avg         FLOAT,
    reb_avg         FLOAT,
    ast_avg         FLOAT,
    ts_pct_avg      FLOAT,
    plus_minus_avg  FLOAT,
    UNIQUE(player_id, game_date, window_size)
);
