import { useState, useEffect } from 'react'
import {
  ResponsiveContainer, LineChart, Line,
  XAxis, YAxis, Tooltip, CartesianGrid
} from 'recharts'

const API = import.meta.env.VITE_API_URL || ''

async function apiFetch(path) {
  const res = await fetch(`${API}${path}`)
  if (!res.ok) throw new Error(`${res.status}`)
  return res.json()
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function pct(val) { return val ? (val * 100).toFixed(1) + '%' : '—' }
function num(val, d = 1) { return val != null ? parseFloat(val).toFixed(d) : '—' }

// ── Mini Spark Line ───────────────────────────────────────────────────────────
function Spark({ data, dataKey, color = 'var(--accent)' }) {
  return (
    <ResponsiveContainer width="100%" height={40}>
      <LineChart data={data}>
        <Line type="monotone" dataKey={dataKey} stroke={color} strokeWidth={1.5} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  )
}

// ── Stat Block ────────────────────────────────────────────────────────────────
function StatBlock({ label, value, sub, color = 'var(--text)', spark, sparkKey }) {
  return (
    <div style={{
      background: 'var(--surface)', borderRadius: 10,
      padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 4,
      border: '1px solid var(--border)',
    }}>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--muted)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>{label}</span>
      <span style={{ fontFamily: 'var(--font-disp)', fontSize: 36, color, lineHeight: 1 }}>{value}</span>
      {sub && <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--muted)' }}>{sub}</span>}
      {spark && sparkKey && <Spark data={spark} dataKey={sparkKey} color={color} />}
    </div>
  )
}

// ── Shot Zone Court ───────────────────────────────────────────────────────────
function ShotZoneMap({ zones }) {
  if (!zones?.length) return null

  const zoneMap = {}
  zones.forEach(z => { zoneMap[z.shot_zone_basic] = z })

  const getZone = (name) => zoneMap[name] || { pct: null, attempts: 0 }
  const getColor = (pct) => {
    if (!pct) return 'var(--border)'
    const p = parseFloat(pct)
    if (p >= 55) return '#4ade80'
    if (p >= 45) return '#e8ff47'
    if (p >= 35) return '#fb923c'
    return '#f87171'
  }

  const ZoneCell = ({ name, label, style }) => {
    const z = getZone(name)
    const color = getColor(z.pct)
    return (
      <div style={{
        ...style,
        background: `${color}18`,
        border: `1px solid ${color}40`,
        borderRadius: 8, padding: '10px 8px',
        textAlign: 'center', cursor: 'default',
        transition: 'all 0.15s',
      }}
        title={`${name}: ${z.attempts} attempts`}
        onMouseEnter={e => { e.currentTarget.style.background = `${color}30` }}
        onMouseLeave={e => { e.currentTarget.style.background = `${color}18` }}
      >
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--muted)', marginBottom: 2 }}>{label}</div>
        <div style={{ fontFamily: 'var(--font-disp)', fontSize: 22, color, lineHeight: 1 }}>
          {z.pct ? z.pct + '%' : '—'}
        </div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--muted)', marginTop: 2 }}>
          {z.attempts > 0 ? `${z.attempts} att` : 'no data'}
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {/* Above the break 3s */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
        <ZoneCell name="Left Corner 3" label="LC3" />
        <ZoneCell name="Above the Break 3" label="ATB 3" />
        <ZoneCell name="Right Corner 3" label="RC3" />
      </div>
      {/* Mid range */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
        <ZoneCell name="Mid-Range" label="Mid Range" />
        <ZoneCell name="Backcourt" label="Half Court" />
      </div>
      {/* Paint */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
        <ZoneCell name="In The Paint (Non-RA)" label="Paint (Non-RA)" />
        <ZoneCell name="Restricted Area" label="Restricted Area" />
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 12, marginTop: 8, justifyContent: 'center' }}>
        {[
          { color: '#4ade80', label: '55%+' },
          { color: '#e8ff47', label: '45-55%' },
          { color: '#fb923c', label: '35-45%' },
          { color: '#f87171', label: '<35%' },
        ].map(({ color, label }) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <div style={{ width: 8, height: 8, borderRadius: 2, background: color }} />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--muted)' }}>{label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Recent Form Strip ─────────────────────────────────────────────────────────
function RecentForm({ games }) {
  if (!games?.length) return null
  const last10 = games.slice(0, 10)

  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
      {last10.map((g, i) => {
        const hot = g.pts >= 30
        const cold = g.pts < 10
        return (
          <div key={i}
            title={`${g.game_date?.slice(0, 10)} vs ${g.matchup} — ${g.pts}pts ${g.reb}reb ${g.ast}ast`}
            style={{
              width: 28, height: 28, borderRadius: 6,
              background: g.wl === 'W' ? 'rgba(74,222,128,0.15)' : 'rgba(248,113,113,0.1)',
              border: `1px solid ${g.wl === 'W' ? 'rgba(74,222,128,0.4)' : 'rgba(248,113,113,0.3)'}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: 'var(--font-mono)', fontSize: 10,
              color: g.wl === 'W' ? 'var(--positive)' : 'var(--negative)',
              fontWeight: 700, cursor: 'default',
              outline: hot ? '2px solid var(--accent)' : cold ? '2px solid rgba(248,113,113,0.4)' : 'none',
            }}
          >{g.pts}</div>
        )
      })}
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--muted)', marginLeft: 4 }}>last 10 games</span>
    </div>
  )
}

// ── Narrative Summary ─────────────────────────────────────────────────────────
function NarrativeStat({ label, value, context, positive }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '10px 0', borderBottom: '1px solid var(--border)',
    }}>
      <div>
        <div style={{ fontSize: 13, color: 'var(--text)', fontWeight: 500 }}>{label}</div>
        {context && <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{context}</div>}
      </div>
      <div style={{
        fontFamily: 'var(--font-disp)', fontSize: 28,
        color: positive === true ? 'var(--positive)' : positive === false ? 'var(--negative)' : 'var(--accent)',
      }}>{value}</div>
    </div>
  )
}

// ── Main Overview ─────────────────────────────────────────────────────────────
export default function Overview({ player, season, gameLogs, rolling, trends }) {
  const [shotZones, setShotZones] = useState([])
  const [loadingZones, setLoadingZones] = useState(false)

  useEffect(() => {
    if (!player) return
    setLoadingZones(true)
    apiFetch(`/players/${player.player_id}/shot-chart?season=${season}`)
      .then(data => setShotZones(data))
      .catch(() => {})
      .finally(() => setLoadingZones(false))
  }, [player, season])

  if (!gameLogs?.length) return null

  // Season averages
  const gp   = gameLogs.length
  const ppg  = (gameLogs.reduce((s, g) => s + (g.pts || 0), 0) / gp)
  const rpg  = (gameLogs.reduce((s, g) => s + (g.reb || 0), 0) / gp)
  const apg  = (gameLogs.reduce((s, g) => s + (g.ast || 0), 0) / gp)
  const topg = (gameLogs.reduce((s, g) => s + (g.tov || 0), 0) / gp)
  const fgp  = (gameLogs.reduce((s, g) => s + (g.fg_pct || 0), 0) / gp)
  const fg3p = (gameLogs.reduce((s, g) => s + (g.fg3_pct || 0), 0) / gp)
  const ftp  = (gameLogs.reduce((s, g) => s + (g.ft_pct || 0), 0) / gp)
  const pm   = (gameLogs.reduce((s, g) => s + (g.plus_minus || 0), 0) / gp)
  const wins = gameLogs.filter(g => g.wl === 'W').length
  const atr  = topg > 0 ? (apg / topg).toFixed(1) : '—'

  // Spark data (last 20 games chronological)
  const sparkData = [...gameLogs].reverse().slice(-20)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

      {/* Recent form */}
      <div className="fade-up-1" style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: '16px 20px' }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--muted)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 12 }}>Recent Form</div>
        <RecentForm games={gameLogs} />
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--muted)', marginTop: 8 }}>
          Hover for game details · <span style={{ color: 'var(--accent)' }}>⬛ = 30+ pts</span>
        </div>
      </div>

      {/* Core stat blocks */}
      <div className="fade-up-2" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        <StatBlock label="Points" value={ppg.toFixed(1)} sub={`${trends?.pts_delta > 0 ? '▲' : '▼'} ${Math.abs(trends?.pts_delta || 0)} L5`} color="var(--accent)" spark={sparkData} sparkKey="pts" />
        <StatBlock label="Rebounds" value={rpg.toFixed(1)} sub={`${gp} games`} spark={sparkData} sparkKey="reb" />
        <StatBlock label="Assists" value={apg.toFixed(1)} sub={`${atr} AST/TO`} spark={sparkData} sparkKey="ast" />
        <StatBlock label="Plus / Minus" value={pm >= 0 ? '+' + pm.toFixed(1) : pm.toFixed(1)} color={pm >= 0 ? 'var(--positive)' : 'var(--negative)'} sub={`${wins}W - ${gp - wins}L`} />
      </div>

      {/* Two column layout */}
      <div className="fade-up-3" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

        {/* Shooting efficiency */}
        <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: 20 }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--muted)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 16 }}>Shooting</div>
          <NarrativeStat
            label="Field Goal %"
            value={pct(fgp)}
            context={fgp >= 0.50 ? 'Elite efficiency' : fgp >= 0.45 ? 'Above average' : 'Below average'}
            positive={fgp >= 0.47}
          />
          <NarrativeStat
            label="Three Point %"
            value={pct(fg3p)}
            context={fg3p >= 0.38 ? 'Elite shooter' : fg3p >= 0.35 ? 'Solid' : 'Needs work'}
            positive={fg3p >= 0.36}
          />
          <NarrativeStat
            label="Free Throw %"
            value={pct(ftp)}
            context={ftp >= 0.85 ? 'Elite' : ftp >= 0.75 ? 'Solid' : 'Hack-a target'}
            positive={ftp >= 0.80}
          />
          <NarrativeStat
            label="Turnovers"
            value={topg.toFixed(1)}
            context={`${atr}:1 assist-to-turnover ratio`}
            positive={topg <= 2.5}
          />
        </div>

        {/* Shot zones */}
        <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: 20 }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--muted)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 16 }}>Shot Zone Efficiency</div>
          {loadingZones ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {[...Array(5)].map((_, i) => <div key={i} className="skeleton" style={{ height: 48 }} />)}
            </div>
          ) : (
            <ShotZoneMap zones={shotZones} />
          )}
        </div>
      </div>

      {/* Points trend */}
      <div className="fade-up-4" style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--muted)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Scoring Trend — Last 20 Games</div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--muted)' }}>
            Avg: <span style={{ color: 'var(--accent)' }}>{ppg.toFixed(1)}</span>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={160}>
          <LineChart data={sparkData}>
            <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
            <XAxis dataKey="game_date" tick={{ fontSize: 9, fill: 'var(--muted)', fontFamily: 'var(--font-mono)' }} tickLine={false} axisLine={false} interval="preserveStartEnd" tickFormatter={v => v?.slice(5)} />
            <YAxis tick={{ fontSize: 9, fill: 'var(--muted)', fontFamily: 'var(--font-mono)' }} tickLine={false} axisLine={false} />
            <Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, fontFamily: 'var(--font-mono)', fontSize: 11 }} />
            <Line type="monotone" dataKey="pts" name="PTS" stroke="var(--accent)" strokeWidth={2} dot={{ r: 3, fill: 'var(--accent)', strokeWidth: 0 }} />
            <Line type="monotone" dataKey="ast" name="AST" stroke="#60a5fa" strokeWidth={1.5} dot={false} strokeDasharray="4 4" />
          </LineChart>
        </ResponsiveContainer>
      </div>

    </div>
  )
}
