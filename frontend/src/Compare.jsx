import { useState, useEffect, useRef, useCallback } from 'react'
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis,
  ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid
} from 'recharts'

const API = import.meta.env.VITE_API_URL || ''

async function apiFetch(path, opts = {}) {
  const res = await fetch(`${API}${path}`, opts)
  if (!res.ok) throw new Error(`${res.status}`)
  return res.json()
}

const COLOR_A = '#e8ff47'
const COLOR_B = '#ff6b35'

// ── Player Search Box ─────────────────────────────────────────────────────────
function PlayerSearch({ label, color, onSelect, selected }) {
  const [query, setQuery] = useState(selected?.full_name || '')
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)
  const debounce = useRef(null)

  const search = useCallback(async (q) => {
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
    debounce.current = setTimeout(() => search(query), 300)
  }, [query, search])

  return (
    <div style={{ position: 'relative', flex: 1 }}>
      <div style={{
        fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.1em',
        textTransform: 'uppercase', marginBottom: 8,
        color,
      }}>{label}</div>
      <div style={{ position: 'relative' }}>
        <input
          value={query}
          onChange={e => { setQuery(e.target.value); if (!e.target.value) onSelect(null) }}
          placeholder="Search player..."
          style={{
            width: '100%', background: 'var(--card)',
            border: `1px solid ${selected ? color : 'var(--border)'}`,
            borderRadius: 10, padding: '12px 16px', color: 'var(--text)',
            fontFamily: 'var(--font-body)', fontSize: 14, outline: 'none',
          }}
        />
        {searching && (
          <div style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', width: 14, height: 14, border: '2px solid var(--border)', borderTopColor: color, borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        )}
      </div>
      {results.length > 0 && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100,
          background: 'var(--card)', border: '1px solid var(--border)',
          borderRadius: 10, marginTop: 4, overflow: 'hidden',
          boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
        }}>
          {results.map((p, i) => (
            <div key={p.player_id}
              onMouseDown={() => { onSelect(p); setQuery(p.full_name); setResults([]) }}
              style={{
                padding: '10px 16px', cursor: 'pointer',
                borderBottom: i < results.length - 1 ? '1px solid var(--border)' : 'none',
                display: 'flex', alignItems: 'center', gap: 10,
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--surface)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: color }} />
              <span style={{ fontSize: 14 }}>{p.full_name}</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--muted)', marginLeft: 'auto' }}>
                {p.team_abbr}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Stat Row ──────────────────────────────────────────────────────────────────
function StatRow({ label, a, b }) {
  const aNum = parseFloat(a)
  const bNum = parseFloat(b)
  const aWins = aNum > bNum
  const bWins = bNum > aNum
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '1fr auto 1fr',
      alignItems: 'center', gap: 16, padding: '12px 0',
      borderBottom: '1px solid var(--border)',
    }}>
      <div style={{
        textAlign: 'right', fontFamily: 'var(--font-disp)', fontSize: 28,
        color: aWins ? COLOR_A : 'var(--text)',
        textShadow: aWins ? `0 0 20px ${COLOR_A}40` : 'none',
      }}>{a ?? '—'}</div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--muted)', textAlign: 'center', letterSpacing: '0.08em', textTransform: 'uppercase', minWidth: 80 }}>{label}</div>
      <div style={{
        textAlign: 'left', fontFamily: 'var(--font-disp)', fontSize: 28,
        color: bWins ? COLOR_B : 'var(--text)',
        textShadow: bWins ? `0 0 20px ${COLOR_B}40` : 'none',
      }}>{b ?? '—'}</div>
    </div>
  )
}

// ── Main Compare Component ────────────────────────────────────────────────────
export default function Compare({ season = '2025-26' }) {
  const [playerA, setPlayerA] = useState(null)
  const [playerB, setPlayerB] = useState(null)
  const [statsA, setStatsA] = useState(null)
  const [statsB, setStatsB] = useState(null)
  const [insight, setInsight] = useState(null)
  const [loadingInsight, setLoadingInsight] = useState(false)
  const [loading, setLoading] = useState(false)

  const loadStats = async (player, setter) => {
    try {
      const logs = await apiFetch(`/players/${player.player_id}/game-logs?season=${season}&last_n=100`)
      if (!logs.length) return
      setter({
        ppg:  (logs.reduce((s, g) => s + (g.pts || 0), 0) / logs.length).toFixed(1),
        rpg:  (logs.reduce((s, g) => s + (g.reb || 0), 0) / logs.length).toFixed(1),
        apg:  (logs.reduce((s, g) => s + (g.ast || 0), 0) / logs.length).toFixed(1),
        topg: (logs.reduce((s, g) => s + (g.tov || 0), 0) / logs.length).toFixed(1),
        fg:   (logs.reduce((s, g) => s + (g.fg_pct || 0), 0) / logs.length * 100).toFixed(1),
        fg3:  (logs.reduce((s, g) => s + (g.fg3_pct || 0), 0) / logs.length * 100).toFixed(1),
        ft:   (logs.reduce((s, g) => s + (g.ft_pct || 0), 0) / logs.length * 100).toFixed(1),
        pm:   (logs.reduce((s, g) => s + (g.plus_minus || 0), 0) / logs.length).toFixed(1),
        gp:   logs.length,
      })
    } catch {}
  }

  useEffect(() => {
    if (playerA) loadStats(playerA, setStatsA)
    else setStatsA(null)
  }, [playerA])

  useEffect(() => {
    if (playerB) loadStats(playerB, setStatsB)
    else setStatsB(null)
  }, [playerB])

  const generateInsight = async () => {
    if (!playerA || !playerB) return
    setLoadingInsight(true)
    setInsight(null)
    try {
      const data = await apiFetch('/insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          player_id: playerA.player_id,
          season,
          question: `Compare ${playerA.full_name} vs ${playerB.full_name} this season. Who is having the better season and why? Be specific with stats. Player B is ${playerB.full_name} (${playerB.team_abbr}).`,
        }),
      })
      setInsight(data.insight)
    } catch {}
    setLoadingInsight(false)
  }

  // Radar chart data
  const radarData = statsA && statsB ? [
    { stat: 'PPG',  A: parseFloat(statsA.ppg),  B: parseFloat(statsB.ppg) },
    { stat: 'RPG',  A: parseFloat(statsA.rpg),  B: parseFloat(statsB.rpg) },
    { stat: 'APG',  A: parseFloat(statsA.apg),  B: parseFloat(statsB.apg) },
    { stat: 'FG%',  A: parseFloat(statsA.fg),   B: parseFloat(statsB.fg) },
    { stat: '3P%',  A: parseFloat(statsA.fg3),  B: parseFloat(statsB.fg3) },
    { stat: '+/-',  A: parseFloat(statsA.pm) + 10, B: parseFloat(statsB.pm) + 10 },
  ] : []

  const barData = statsA && statsB ? [
    { name: 'PPG',  [playerA.full_name.split(' ')[1]]: parseFloat(statsA.ppg), [playerB.full_name.split(' ')[1]]: parseFloat(statsB.ppg) },
    { name: 'RPG',  [playerA.full_name.split(' ')[1]]: parseFloat(statsA.rpg), [playerB.full_name.split(' ')[1]]: parseFloat(statsB.rpg) },
    { name: 'AST',  [playerA.full_name.split(' ')[1]]: parseFloat(statsA.apg), [playerB.full_name.split(' ')[1]]: parseFloat(statsB.apg) },
    { name: 'TOV',  [playerA.full_name.split(' ')[1]]: parseFloat(statsA.topg), [playerB.full_name.split(' ')[1]]: parseFloat(statsB.topg) },
  ] : []

  const nameA = playerA?.full_name.split(' ')[1] || 'Player A'
  const nameB = playerB?.full_name.split(' ')[1] || 'Player B'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>

      {/* Search boxes */}
      <div className="fade-up" style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
        <PlayerSearch label="Player A" color={COLOR_A} onSelect={setPlayerA} selected={playerA} />
        <div style={{ fontFamily: 'var(--font-disp)', fontSize: 32, color: 'var(--muted)', paddingTop: 32 }}>VS</div>
        <PlayerSearch label="Player B" color={COLOR_B} onSelect={setPlayerB} selected={playerB} />
      </div>

      {/* Stats comparison */}
      {statsA && statsB && (
        <div className="fade-up">
          {/* Player name headers */}
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr auto 1fr',
            gap: 16, marginBottom: 8, paddingBottom: 16,
            borderBottom: '2px solid var(--border)',
          }}>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontFamily: 'var(--font-disp)', fontSize: 36, color: COLOR_A, lineHeight: 1 }}>{playerA.full_name}</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>{playerA.team_abbr} · {statsA.gp} GP</div>
            </div>
            <div style={{ width: 80 }} />
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontFamily: 'var(--font-disp)', fontSize: 36, color: COLOR_B, lineHeight: 1 }}>{playerB.full_name}</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>{playerB.team_abbr} · {statsB.gp} GP</div>
            </div>
          </div>

          {/* Stat rows */}
          <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: '8px 24px' }}>
            <StatRow label="Points" a={statsA.ppg} b={statsB.ppg} />
            <StatRow label="Rebounds" a={statsA.rpg} b={statsB.rpg} />
            <StatRow label="Assists" a={statsA.apg} b={statsB.apg} />
            <StatRow label="Turnovers" a={statsA.topg} b={statsB.topg} />
            <StatRow label="FG %" a={statsA.fg} b={statsB.fg} />
            <StatRow label="3PT %" a={statsA.fg3} b={statsB.fg3} />
            <StatRow label="FT %" a={statsA.ft} b={statsB.ft} />
            <StatRow label="+/-" a={statsA.pm} b={statsB.pm} />
          </div>

          {/* Charts */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 16 }}>
            {/* Radar */}
            <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: 24 }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--muted)', marginBottom: 16, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Radar Comparison</div>
              <ResponsiveContainer width="100%" height={240}>
                <RadarChart data={radarData}>
                  <PolarGrid stroke="var(--border)" />
                  <PolarAngleAxis dataKey="stat" tick={{ fontSize: 11, fill: 'var(--muted)', fontFamily: 'var(--font-mono)' }} />
                  <Radar name={nameA} dataKey="A" stroke={COLOR_A} fill={COLOR_A} fillOpacity={0.15} strokeWidth={2} />
                  <Radar name={nameB} dataKey="B" stroke={COLOR_B} fill={COLOR_B} fillOpacity={0.15} strokeWidth={2} />
                </RadarChart>
              </ResponsiveContainer>
            </div>

            {/* Bar chart */}
            <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: 24 }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--muted)', marginBottom: 16, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Head to Head</div>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={barData} barGap={4}>
                  <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--muted)', fontFamily: 'var(--font-mono)' }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: 'var(--muted)', fontFamily: 'var(--font-mono)' }} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, fontFamily: 'var(--font-mono)', fontSize: 12 }} />
                  <Bar dataKey={nameA} fill={COLOR_A} radius={[4, 4, 0, 0]} />
                  <Bar dataKey={nameB} fill={COLOR_B} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* AI Comparison */}
          <div style={{ marginTop: 16 }}>
            <button
              onClick={generateInsight}
              disabled={loadingInsight}
              style={{
                width: '100%', background: 'var(--card)',
                border: `1px solid var(--border)`,
                borderRadius: 12, padding: '16px 24px',
                color: 'var(--text)', fontFamily: 'var(--font-body)',
                fontSize: 15, fontWeight: 600, cursor: loadingInsight ? 'wait' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                transition: 'border-color 0.2s',
              }}
              onMouseEnter={e => !loadingInsight && (e.currentTarget.style.borderColor = 'var(--accent)')}
              onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
            >
              {loadingInsight ? (
                <>
                  <div style={{ width: 16, height: 16, border: '2px solid var(--border)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                  Analyzing {playerA.full_name} vs {playerB.full_name}...
                </>
              ) : (
                <>⚡ AI Analysis — Who's Better and Why?</>
              )}
            </button>

            {insight && (
              <div className="fade-up" style={{
                background: 'var(--card)', border: '1px solid var(--border)',
                borderRadius: 12, padding: 24, marginTop: 12,
              }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--accent)', marginBottom: 16, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                  AI Analysis · {playerA.full_name} vs {playerB.full_name}
                </div>
                <div style={{ color: 'var(--text)', lineHeight: 1.8, fontSize: 14, whiteSpace: 'pre-wrap' }}>
                  {insight.replace(/#{1,3} /g, '').replace(/\*\*(.*?)\*\*/g, '$1')}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Empty state */}
      {(!playerA || !playerB) && (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--muted)' }}>
          <div style={{ fontFamily: 'var(--font-disp)', fontSize: 48, color: 'var(--border)', lineHeight: 1, marginBottom: 12 }}>VS</div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, letterSpacing: '0.1em' }}>SELECT TWO PLAYERS TO COMPARE</div>
        </div>
      )}
    </div>
  )
}
