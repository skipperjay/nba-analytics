import { useState, useEffect, useRef, useCallback } from 'react'
import {
  LineChart, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, ReferenceLine
} from 'recharts'

const API = '/api'

async function apiFetch(path, opts = {}) {
  const res = await fetch(`${API}${path}`, opts)
  if (!res.ok) throw new Error(`${res.status}`)
  return res.json()
}

// ── Stat Card ────────────────────────────────────────────────────────────────
function StatCard({ label, value, delta, unit = '', className = '' }) {
  const positive = delta > 0
  const hasD = delta !== undefined && delta !== null
  return (
    <div className={`stat-card ${className}`} style={{
      background: 'var(--card)',
      border: '1px solid var(--border)',
      borderRadius: 12,
      padding: '20px 24px',
      display: 'flex',
      flexDirection: 'column',
      gap: 6,
    }}>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--muted)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>{label}</span>
      <span style={{ fontFamily: 'var(--font-disp)', fontSize: 42, lineHeight: 1, color: 'var(--text)', letterSpacing: '0.02em' }}>
        {value ?? '—'}{unit}
      </span>
      {hasD && (
        <span style={{ fontSize: 12, color: positive ? 'var(--positive)' : 'var(--negative)', fontFamily: 'var(--font-mono)' }}>
          {positive ? '▲' : '▼'} {Math.abs(delta)} vs season avg
        </span>
      )}
    </div>
  )
}

// ── Trend Badge ───────────────────────────────────────────────────────────────
function TrendBadge({ label, delta }) {
  if (delta === null || delta === undefined) return null
  const up = delta > 0
  const color = up ? 'var(--positive)' : 'var(--negative)'
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 6,
      background: up ? 'rgba(74,222,128,0.08)' : 'rgba(248,113,113,0.08)',
      border: `1px solid ${up ? 'rgba(74,222,128,0.2)' : 'rgba(248,113,113,0.2)'}`,
      borderRadius: 8, padding: '6px 12px',
    }}>
      <span style={{ color, fontSize: 13 }}>{up ? '▲' : '▼'}</span>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color }}>{label}: {up ? '+' : ''}{delta}</span>
    </div>
  )
}

// ── Custom Tooltip ────────────────────────────────────────────────────────────
function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: 8, padding: '10px 14px', fontFamily: 'var(--font-mono)', fontSize: 12,
    }}>
      <div style={{ color: 'var(--muted)', marginBottom: 6 }}>{label}</div>
      {payload.map(p => (
        <div key={p.dataKey} style={{ color: p.color }}>
          {p.name}: {typeof p.value === 'number' ? p.value.toFixed(1) : p.value}
        </div>
      ))}
    </div>
  )
}

// ── YouTube Card ─────────────────────────────────────────────────────────────
function VideoCard({ video }) {
  const [playing, setPlaying] = useState(false)
  return (
    <div style={{
      borderRadius: 10, overflow: 'hidden',
      border: '1px solid var(--border)', background: 'var(--card)',
      cursor: 'pointer',
    }} onClick={() => setPlaying(true)}>
      {playing ? (
        <iframe
          src={`${video.embed_url}?autoplay=1`}
          width="100%" height="180"
          allow="autoplay; encrypted-media"
          allowFullScreen
          style={{ border: 'none', display: 'block' }}
        />
      ) : (
        <div style={{ position: 'relative' }}>
          <img src={video.thumbnail} alt={video.title} style={{ width: '100%', height: 180, objectFit: 'cover', display: 'block' }} />
          <div style={{
            position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(0,0,0,0.4)',
          }}>
            <div style={{
              width: 48, height: 48, borderRadius: '50%',
              background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <span style={{ fontSize: 18, marginLeft: 3 }}>▶</span>
            </div>
          </div>
        </div>
      )}
      <div style={{ padding: '10px 12px' }}>
        <div style={{ fontSize: 12, fontWeight: 500, lineHeight: 1.4, color: 'var(--text)' }}>{video.title}</div>
        <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>{video.channel}</div>
      </div>
    </div>
  )
}

// ── Insight Panel ─────────────────────────────────────────────────────────────
function InsightPanel({ playerId, season, playerName }) {
  const [question, setQuestion] = useState('')
  const [insight, setInsight] = useState(null)
  const [videos, setVideos] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const ask = async (q) => {
    setLoading(true)
    setInsight(null)
    setVideos([])
    setError(null)
    try {
      const body = { player_id: playerId, season, question: q || null }
      const data = await apiFetch('/insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      setInsight(data.insight)

      // Fetch videos using the first keyword Claude returned
      if (data.keywords?.length) {
        try {
          const vids = await apiFetch(`/players/${playerId}/videos?query_context=${encodeURIComponent(data.keywords[0] + ' 2025')}`)
          setVideos(vids)
        } catch {}
      }
    } catch (e) {
      setError('Failed to generate insight. Check your API keys.')
    } finally {
      setLoading(false)
    }
  }

  const quickQuestions = [
    `Why is ${playerName} having the season they're having?`,
    `What are ${playerName}'s biggest weaknesses?`,
    `How has ${playerName}'s shot selection evolved?`,
    `What does ${playerName} need to improve?`,
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Question input */}
      <div style={{
        background: 'var(--card)', border: '1px solid var(--border)',
        borderRadius: 12, padding: 20,
      }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--muted)', marginBottom: 12, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Ask AI Analyst</div>
        <div style={{ display: 'flex', gap: 10 }}>
          <input
            value={question}
            onChange={e => setQuestion(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && ask(question)}
            placeholder={`Ask anything about ${playerName}...`}
            style={{
              flex: 1, background: 'var(--surface)', border: '1px solid var(--border)',
              borderRadius: 8, padding: '10px 14px', color: 'var(--text)',
              fontFamily: 'var(--font-body)', fontSize: 14, outline: 'none',
            }}
          />
          <button
            onClick={() => ask(question)}
            disabled={loading}
            style={{
              background: 'var(--accent)', color: '#000', border: 'none',
              borderRadius: 8, padding: '10px 20px', fontFamily: 'var(--font-body)',
              fontWeight: 700, fontSize: 14, cursor: loading ? 'wait' : 'pointer',
              opacity: loading ? 0.7 : 1, whiteSpace: 'nowrap',
            }}
          >
            {loading ? 'Analyzing...' : 'Analyze →'}
          </button>
        </div>

        {/* Quick questions */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
          {quickQuestions.map(q => (
            <button key={q} onClick={() => { setQuestion(q); ask(q) }}
              style={{
                background: 'var(--surface)', border: '1px solid var(--border)',
                borderRadius: 6, padding: '5px 10px', color: 'var(--muted)',
                fontFamily: 'var(--font-body)', fontSize: 12, cursor: 'pointer',
                transition: 'all 0.15s',
              }}
              onMouseEnter={e => { e.target.style.borderColor = 'var(--accent)'; e.target.style.color = 'var(--accent)' }}
              onMouseLeave={e => { e.target.style.borderColor = 'var(--border)'; e.target.style.color = 'var(--muted)' }}
            >{q}</button>
          ))}
        </div>
      </div>

      {error && (
        <div style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)', borderRadius: 8, padding: 16, color: 'var(--negative)', fontSize: 14 }}>
          {error}
        </div>
      )}

      {loading && (
        <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: 32, textAlign: 'center' }}>
          <div style={{ width: 32, height: 32, border: '3px solid var(--border)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 16px' }} />
          <div style={{ color: 'var(--muted)', fontFamily: 'var(--font-mono)', fontSize: 13 }}>Crunching {playerName}'s stats...</div>
        </div>
      )}

      {insight && (
        <div className="fade-up" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Insight text */}
          <div style={{
            background: 'var(--card)', border: '1px solid var(--border)',
            borderRadius: 12, padding: 24,
          }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--accent)', marginBottom: 16, letterSpacing: '0.1em', textTransform: 'uppercase' }}>AI Analysis</div>
            <div style={{ color: 'var(--text)', lineHeight: 1.8, fontSize: 14, whiteSpace: 'pre-wrap' }}>
              {insight.replace(/#{1,3} /g, '').replace(/\*\*(.*?)\*\*/g, '$1')}
            </div>
          </div>

          {/* Videos */}
          {videos.length > 0 && (
            <div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--muted)', marginBottom: 12, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Related Clips</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
                {videos.map(v => <VideoCard key={v.video_id} video={v} />)}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Main App ──────────────────────────────────────────────────────────────────
export default function App() {
  const [query, setQuery]         = useState('')
  const [results, setResults]     = useState([])
  const [searching, setSearching] = useState(false)
  const [player, setPlayer]       = useState(null)
  const [season]                  = useState('2025-26')
  const [gameLogs, setGameLogs]   = useState([])
  const [rolling, setRolling]     = useState([])
  const [trends, setTrends]       = useState(null)
  const [loading, setLoading]     = useState(false)
  const [activeTab, setActiveTab] = useState('overview')
  const [rollWindow, setRollWindow] = useState(10)
  const searchRef = useRef(null)
  const debounce  = useRef(null)

  const searchPlayers = useCallback(async (q) => {
    if (q.length < 2) { setResults([]); return }
    setSearching(true)
    try {
      const data = await apiFetch(`/players/search?q=${encodeURIComponent(q)}`)
      setResults(data)
    } catch {}
    setSearching(false)
  }, [])

  useEffect(() => {
    clearTimeout(debounce.current)
    debounce.current = setTimeout(() => searchPlayers(query), 300)
  }, [query, searchPlayers])

  const loadPlayer = async (p) => {
    setPlayer(p)
    setResults([])
    setQuery(p.full_name)
    setLoading(true)
    setActiveTab('overview')
    try {
      const [logs, roll, trend] = await Promise.all([
        apiFetch(`/players/${p.player_id}/game-logs?season=${season}&last_n=30`),
        apiFetch(`/players/${p.player_id}/rolling-averages?season=${season}&window=${rollWindow}`),
        apiFetch(`/players/${p.player_id}/trends?season=${season}`),
      ])
      setGameLogs(logs)
      setRolling(roll.map(r => ({ ...r, game_date: r.game_date?.slice(0, 10) })))
      setTrends(trend)
    } catch {}
    setLoading(false)
  }

  const seasonAvg = gameLogs.length ? {
    pts: (gameLogs.reduce((s, g) => s + (g.pts || 0), 0) / gameLogs.length).toFixed(1),
    reb: (gameLogs.reduce((s, g) => s + (g.reb || 0), 0) / gameLogs.length).toFixed(1),
    ast: (gameLogs.reduce((s, g) => s + (g.ast || 0), 0) / gameLogs.length).toFixed(1),
    pm:  (gameLogs.reduce((s, g) => s + (g.plus_minus || 0), 0) / gameLogs.length).toFixed(1),
  } : null

  const tabs = ['overview', 'charts', 'game log', 'ai insight']

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 24px 60px' }}>

      {/* Header */}
      <div style={{ padding: '48px 0 32px', borderBottom: '1px solid var(--border)', marginBottom: 40 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 4 }}>
          <h1 style={{ fontFamily: 'var(--font-disp)', fontSize: 52, letterSpacing: '0.04em', color: 'var(--accent)', lineHeight: 1 }}>NBA</h1>
          <h1 style={{ fontFamily: 'var(--font-disp)', fontSize: 52, letterSpacing: '0.04em', color: 'var(--text)', lineHeight: 1 }}>INTELLIGENCE</h1>
        </div>
        <p style={{ color: 'var(--muted)', fontFamily: 'var(--font-mono)', fontSize: 12, letterSpacing: '0.05em' }}>
          AI-POWERED PLAYER PERFORMANCE ANALYSIS · {season}
        </p>
      </div>

      {/* Search */}
      <div style={{ position: 'relative', marginBottom: 48 }} className="fade-up">
        <div style={{ position: 'relative' }}>
          <span style={{ position: 'absolute', left: 18, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)', fontSize: 18, pointerEvents: 'none' }}>⌕</span>
          <input
            ref={searchRef}
            value={query}
            onChange={e => { setQuery(e.target.value); if (!e.target.value) setPlayer(null) }}
            placeholder="Search any NBA player..."
            style={{
              width: '100%', background: 'var(--card)', border: '1px solid var(--border)',
              borderRadius: 12, padding: '16px 20px 16px 48px', color: 'var(--text)',
              fontFamily: 'var(--font-body)', fontSize: 16, outline: 'none',
              transition: 'border-color 0.2s',
            }}
            onFocus={e => e.target.style.borderColor = 'var(--accent)'}
            onBlur={e => e.target.style.borderColor = 'var(--border)'}
          />
          {searching && (
            <div style={{ position: 'absolute', right: 18, top: '50%', transform: 'translateY(-50%)', width: 16, height: 16, border: '2px solid var(--border)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          )}
        </div>

        {results.length > 0 && (
          <div style={{
            position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100,
            background: 'var(--card)', border: '1px solid var(--border)',
            borderRadius: 12, marginTop: 4, overflow: 'hidden',
            boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
          }}>
            {results.map((p, i) => (
              <div key={p.player_id}
                onClick={() => loadPlayer(p)}
                style={{
                  padding: '12px 20px', cursor: 'pointer', display: 'flex',
                  alignItems: 'center', gap: 12,
                  borderBottom: i < results.length - 1 ? '1px solid var(--border)' : 'none',
                  transition: 'background 0.1s',
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--surface)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent)', flexShrink: 0 }} />
                <span style={{ fontWeight: 500 }}>{p.full_name}</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--muted)', marginLeft: 'auto' }}>
                  {p.team_abbr} · {p.position}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Player content */}
      {player && (
        <div>
          {/* Player header */}
          <div className="fade-up" style={{ marginBottom: 32 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 16, flexWrap: 'wrap' }}>
              <h2 style={{ fontFamily: 'var(--font-disp)', fontSize: 48, letterSpacing: '0.03em', lineHeight: 1 }}>
                {player.full_name.split(' ')[0]}
              </h2>
              <h2 style={{ fontFamily: 'var(--font-disp)', fontSize: 48, letterSpacing: '0.03em', lineHeight: 1, color: 'var(--accent)' }}>
                {player.full_name.split(' ').slice(1).join(' ')}
              </h2>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--muted)', marginBottom: 4 }}>
                {player.team_abbr} · {player.position}
              </span>
            </div>

            {/* Trend badges */}
            {trends && (
              <div className="fade-up-1" style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 16 }}>
                <TrendBadge label="PTS L5" delta={trends.pts_delta} />
                <TrendBadge label="REB L5" delta={trends.reb_delta} />
                <TrendBadge label="AST L5" delta={trends.ast_delta} />
                <TrendBadge label="+/- L5" delta={trends.plus_minus_delta} />
              </div>
            )}
          </div>

          {/* Tabs */}
          <div className="fade-up-2" style={{ display: 'flex', gap: 2, marginBottom: 32, borderBottom: '1px solid var(--border)', paddingBottom: 0 }}>
            {tabs.map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  padding: '10px 20px', fontFamily: 'var(--font-mono)',
                  fontSize: 12, letterSpacing: '0.08em', textTransform: 'uppercase',
                  color: activeTab === tab ? 'var(--accent)' : 'var(--muted)',
                  borderBottom: activeTab === tab ? '2px solid var(--accent)' : '2px solid transparent',
                  marginBottom: -1, transition: 'all 0.15s',
                }}
              >{tab}</button>
            ))}
          </div>

          {loading ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
              {[...Array(4)].map((_, i) => <div key={i} className="skeleton" style={{ height: 110 }} />)}
            </div>
          ) : (
            <>
              {/* OVERVIEW TAB */}
              {activeTab === 'overview' && seasonAvg && (
                <div className="fade-up">
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16, marginBottom: 32 }}>
                    <StatCard label="Points" value={seasonAvg.pts} delta={trends?.pts_delta} className="fade-up-1" />
                    <StatCard label="Rebounds" value={seasonAvg.reb} delta={trends?.reb_delta} className="fade-up-2" />
                    <StatCard label="Assists" value={seasonAvg.ast} delta={trends?.ast_delta} className="fade-up-3" />
                    <StatCard label="Plus / Minus" value={seasonAvg.pm} delta={trends?.plus_minus_delta} className="fade-up-4" />
                  </div>

                  {/* Mini chart preview */}
                  {rolling.length > 0 && (
                    <div className="fade-up-5" style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: 24 }}>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--muted)', marginBottom: 16, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                        {rollWindow}-Game Rolling Average — Points
                      </div>
                      <ResponsiveContainer width="100%" height={200}>
                        <LineChart data={rolling}>
                          <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
                          <XAxis dataKey="game_date" tick={{ fontSize: 10, fill: 'var(--muted)', fontFamily: 'var(--font-mono)' }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                          <YAxis tick={{ fontSize: 10, fill: 'var(--muted)', fontFamily: 'var(--font-mono)' }} tickLine={false} axisLine={false} />
                          <Tooltip content={<ChartTooltip />} />
                          <Line type="monotone" dataKey="pts_avg" name="PPG" stroke="var(--accent)" strokeWidth={2} dot={false} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>
              )}

              {/* CHARTS TAB */}
              {activeTab === 'charts' && (
                <div className="fade-up" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                  {/* Window selector */}
                  <div style={{ display: 'flex', gap: 8 }}>
                    {[5, 10, 20].map(w => (
                      <button key={w} onClick={async () => {
                        setRollWindow(w)
                        const data = await apiFetch(`/players/${player.player_id}/rolling-averages?season=${season}&window=${w}`)
                        setRolling(data.map(r => ({ ...r, game_date: r.game_date?.slice(0, 10) })))
                      }}
                        style={{
                          background: rollWindow === w ? 'var(--accent)' : 'var(--card)',
                          color: rollWindow === w ? '#000' : 'var(--muted)',
                          border: '1px solid var(--border)', borderRadius: 6,
                          padding: '6px 16px', fontFamily: 'var(--font-mono)', fontSize: 12,
                          cursor: 'pointer', fontWeight: rollWindow === w ? 700 : 400,
                        }}
                      >{w}G</button>
                    ))}
                  </div>

                  {[
                    { key: 'pts_avg', name: 'Points', color: 'var(--accent)' },
                    { key: 'ast_avg', name: 'Assists', color: '#60a5fa' },
                    { key: 'reb_avg', name: 'Rebounds', color: '#a78bfa' },
                    { key: 'plus_minus_avg', name: '+/-', color: 'var(--accent2)' },
                  ].map(({ key, name, color }) => (
                    <div key={key} style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: 24 }}>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--muted)', marginBottom: 16, letterSpacing: '0.1em', textTransform: 'uppercase' }}>{name} — {rollWindow}G Rolling</div>
                      <ResponsiveContainer width="100%" height={180}>
                        <LineChart data={rolling}>
                          <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
                          <XAxis dataKey="game_date" tick={{ fontSize: 10, fill: 'var(--muted)', fontFamily: 'var(--font-mono)' }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                          <YAxis tick={{ fontSize: 10, fill: 'var(--muted)', fontFamily: 'var(--font-mono)' }} tickLine={false} axisLine={false} />
                          <Tooltip content={<ChartTooltip />} />
                          {key === 'plus_minus_avg' && <ReferenceLine y={0} stroke="var(--muted)" strokeDasharray="4 4" />}
                          <Line type="monotone" dataKey={key} name={name} stroke={color} strokeWidth={2} dot={false} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  ))}
                </div>
              )}

              {/* GAME LOG TAB */}
              {activeTab === 'game log' && (
                <div className="fade-up" style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'var(--font-mono)', fontSize: 12 }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border)' }}>
                        {['Date', 'Matchup', 'W/L', 'MIN', 'PTS', 'REB', 'AST', 'FG%', '3P%', '+/-'].map(h => (
                          <th key={h} style={{ padding: '12px 16px', color: 'var(--muted)', fontWeight: 500, textAlign: 'left', letterSpacing: '0.05em' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {gameLogs.slice(0, 20).map((g, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid var(--border)', transition: 'background 0.1s' }}
                          onMouseEnter={e => e.currentTarget.style.background = 'var(--surface)'}
                          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                        >
                          <td style={{ padding: '10px 16px', color: 'var(--muted)' }}>{g.game_date?.slice(0, 10)}</td>
                          <td style={{ padding: '10px 16px' }}>{g.matchup}</td>
                          <td style={{ padding: '10px 16px', color: g.wl === 'W' ? 'var(--positive)' : 'var(--negative)', fontWeight: 700 }}>{g.wl}</td>
                          <td style={{ padding: '10px 16px' }}>{g.min?.toFixed(0)}</td>
                          <td style={{ padding: '10px 16px', fontWeight: 700, color: 'var(--text)' }}>{g.pts}</td>
                          <td style={{ padding: '10px 16px' }}>{g.reb}</td>
                          <td style={{ padding: '10px 16px' }}>{g.ast}</td>
                          <td style={{ padding: '10px 16px' }}>{g.fg_pct ? (g.fg_pct * 100).toFixed(1) + '%' : '—'}</td>
                          <td style={{ padding: '10px 16px' }}>{g.fg3_pct ? (g.fg3_pct * 100).toFixed(1) + '%' : '—'}</td>
                          <td style={{ padding: '10px 16px', color: g.plus_minus > 0 ? 'var(--positive)' : g.plus_minus < 0 ? 'var(--negative)' : 'var(--muted)' }}>
                            {g.plus_minus > 0 ? '+' : ''}{g.plus_minus}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* AI INSIGHT TAB */}
              {activeTab === 'ai insight' && (
                <div className="fade-up">
                  <InsightPanel playerId={player.player_id} season={season} playerName={player.full_name} />
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Empty state */}
      {!player && (
        <div className="fade-up" style={{ textAlign: 'center', padding: '80px 0', color: 'var(--muted)' }}>
          <div style={{ fontFamily: 'var(--font-disp)', fontSize: 72, color: 'var(--border)', lineHeight: 1, marginBottom: 16 }}>NBA</div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, letterSpacing: '0.1em' }}>SEARCH A PLAYER TO BEGIN ANALYSIS</div>
        </div>
      )}

      {/* Footer */}
      <div style={{ marginTop: 80, paddingTop: 24, borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--muted)' }}>NBA INTELLIGENCE · {season}</span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--border)' }}>POWERED BY CLAUDE</span>
      </div>
    </div>
  )
}
