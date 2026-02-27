import { useState, useEffect } from 'react'

const API = import.meta.env.VITE_API_URL || ''

async function apiFetch(path) {
  const res = await fetch(`${API}${path}`)
  if (!res.ok) throw new Error(`${res.status}`)
  return res.json()
}

// League average FG% by zone (2025-26 approximations)
const LEAGUE_AVG = {
  'Restricted Area':          64.5,
  'In The Paint (Non-RA)':    40.2,
  'Mid-Range':                42.1,
  'Left Corner 3':            38.8,
  'Right Corner 3':           39.1,
  'Above the Break 3':        36.2,
  'Backcourt':                 2.0,
}

function getDiff(pct, zone) {
  const avg = LEAGUE_AVG[zone]
  if (!avg || !pct) return 0
  return parseFloat(pct) - avg
}

function getColor(pct, zone) {
  if (!pct) return { fill: '#1e2433', stroke: '#2a3347', text: '#6b7280' }
  const diff = getDiff(pct, zone)
  if (diff >= 8)  return { fill: '#14532d', stroke: '#4ade80', text: '#4ade80' }
  if (diff >= 3)  return { fill: '#1a3a1a', stroke: '#86efac', text: '#86efac' }
  if (diff >= -3) return { fill: '#1e2433', stroke: '#e8ff47', text: '#e8ff47' }
  if (diff >= -8) return { fill: '#3a1a1a', stroke: '#fb923c', text: '#fb923c' }
  return { fill: '#2a0f0f', stroke: '#f87171', text: '#f87171' }
}

function DiffBadge({ pct, zone }) {
  const avg = LEAGUE_AVG[zone]
  if (!avg || !pct) return null
  const diff = getDiff(pct, zone)
  const pos = diff >= 0
  return (
    <span style={{
      fontSize: 9, fontFamily: 'var(--font-mono)',
      color: pos ? '#4ade80' : '#f87171',
    }}>
      {pos ? '+' : ''}{diff.toFixed(1)} vs avg
    </span>
  )
}

// ── SVG Court with Zones ──────────────────────────────────────────────────────
function CourtDiagram({ zones }) {
  const [hovered, setHovered] = useState(null)

  const zoneMap = {}
  zones.forEach(z => { zoneMap[z.shot_zone_basic] = z })

  const getZone = (name) => zoneMap[name] || { pct: null, attempts: 0, makes: 0 }

  const ZoneTooltip = ({ zone }) => {
    if (!zone) return null
    const z = getZone(zone)
    const avg = LEAGUE_AVG[zone]
    const diff = z.pct ? getDiff(z.pct, zone) : null
    const c = getColor(z.pct, zone)
    return (
      <div style={{
        position: 'absolute', top: 10, right: 10,
        background: 'var(--surface)', border: `1px solid ${c.stroke}`,
        borderRadius: 10, padding: '14px 18px', minWidth: 180,
        zIndex: 10, pointerEvents: 'none',
      }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--muted)', marginBottom: 8, letterSpacing: '0.08em', textTransform: 'uppercase' }}>{zone}</div>
        <div style={{ fontFamily: 'var(--font-disp)', fontSize: 36, color: c.text, lineHeight: 1 }}>
          {z.pct ? z.pct + '%' : '—'}
        </div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--muted)', marginTop: 6 }}>
          {z.attempts} attempts · {z.makes} makes
        </div>
        {avg && z.pct && (
          <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--border)' }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--muted)' }}>
              League avg: <span style={{ color: 'var(--text)' }}>{avg}%</span>
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: diff >= 0 ? '#4ade80' : '#f87171', marginTop: 2 }}>
              {diff >= 0 ? '▲' : '▼'} {Math.abs(diff).toFixed(1)}% vs avg
            </div>
          </div>
        )}
      </div>
    )
  }

  // SVG court dimensions (half court)
  // viewBox: 0 0 500 470
  const zones_svg = [
    {
      id: 'Restricted Area',
      // Small arc near basket
      d: 'M 215 380 A 40 40 0 0 1 285 380 L 285 420 L 215 420 Z',
      label: 'RA',
    },
    {
      id: 'In The Paint (Non-RA)',
      d: 'M 170 280 L 330 280 L 330 420 L 285 420 L 285 380 A 40 40 0 0 0 215 380 L 215 420 L 170 420 Z',
      label: 'Paint',
    },
    {
      id: 'Mid-Range',
      // Everything inside the 3pt line but outside paint
      d: 'M 50 280 L 170 280 L 170 420 L 50 420 Z',
      label: 'Mid\nLeft',
      subzone: true,
    },
    {
      id: 'Mid-Range',
      d: 'M 330 280 L 450 280 L 450 420 L 330 420 Z',
      label: 'Mid\nRight',
      subzone: true,
      skip: true,
    },
    {
      id: 'Mid-Range',
      // Top of key mid range
      d: 'M 130 130 Q 250 70 370 130 L 330 280 L 170 280 Z',
      label: 'Mid Range',
      primary: true,
    },
    {
      id: 'Left Corner 3',
      d: 'M 0 280 L 50 280 L 50 420 L 0 420 Z',
      label: 'LC3',
    },
    {
      id: 'Right Corner 3',
      d: 'M 450 280 L 500 280 L 500 420 L 450 420 Z',
      label: 'RC3',
    },
    {
      id: 'Above the Break 3',
      d: 'M 0 0 L 500 0 L 500 280 L 450 280 L 450 420 L 500 420 L 500 470 L 0 470 L 0 420 L 50 420 L 50 280 L 0 280 Z M 130 130 Q 250 70 370 130 L 500 280 L 0 280 Z',
      label: 'Above Break 3',
      fillRule: 'evenodd',
    },
  ]

  return (
    <div style={{ position: 'relative' }}>
      <svg viewBox="0 0 500 470" style={{ width: '100%', maxWidth: 500, display: 'block', margin: '0 auto' }}>
        {/* Court background */}
        <rect width="500" height="470" fill="#0a0d14" rx="8" />

        {/* Court lines */}
        {/* Baseline */}
        <line x1="0" y1="420" x2="500" y2="420" stroke="#1e2433" strokeWidth="2" />
        {/* Sidelines */}
        <line x1="0" y1="0" x2="0" y2="470" stroke="#1e2433" strokeWidth="2" />
        <line x1="500" y1="0" x2="500" y2="470" stroke="#1e2433" strokeWidth="2" />
        {/* Paint box */}
        <rect x="170" y="280" width="160" height="140" fill="none" stroke="#1e2433" strokeWidth="1.5" />
        {/* 3pt arc approximation */}
        <path d="M 50 420 L 50 280 Q 250 20 450 280 L 450 420" fill="none" stroke="#1e2433" strokeWidth="1.5" strokeDasharray="6 4" />
        {/* Basket */}
        <circle cx="250" cy="400" r="10" fill="none" stroke="#374151" strokeWidth="2" />
        <circle cx="250" cy="400" r="3" fill="#374151" />
        {/* Backboard */}
        <line x1="220" y1="388" x2="280" y2="388" stroke="#374151" strokeWidth="3" />
        {/* Free throw circle */}
        <circle cx="250" cy="280" r="60" fill="none" stroke="#1e2433" strokeWidth="1.5" strokeDasharray="6 4" />
        {/* Center court */}
        <circle cx="250" cy="30" r="25" fill="none" stroke="#1e2433" strokeWidth="1" strokeDasharray="4 4" />

        {/* Zone fills */}
        {/* Restricted Area */}
        {(() => {
          const z = getZone('Restricted Area')
          const c = getColor(z.pct, 'Restricted Area')
          const isHov = hovered === 'Restricted Area'
          return (
            <g onMouseEnter={() => setHovered('Restricted Area')} onMouseLeave={() => setHovered(null)} style={{ cursor: 'pointer' }}>
              <path d="M 215 388 A 35 35 0 0 1 285 388 L 285 420 L 215 420 Z"
                fill={isHov ? c.stroke + '40' : c.fill} stroke={c.stroke} strokeWidth={isHov ? 2 : 1} />
              <text x="250" y="410" textAnchor="middle" fill={c.text} fontSize="9" fontFamily="monospace" fontWeight="bold">
                {z.pct ? z.pct + '%' : '—'}
              </text>
            </g>
          )
        })()}

        {/* Paint Non-RA */}
        {(() => {
          const z = getZone('In The Paint (Non-RA)')
          const c = getColor(z.pct, 'In The Paint (Non-RA)')
          const isHov = hovered === 'In The Paint (Non-RA)'
          return (
            <g onMouseEnter={() => setHovered('In The Paint (Non-RA)')} onMouseLeave={() => setHovered(null)} style={{ cursor: 'pointer' }}>
              <path d="M 170 280 L 215 280 L 215 388 A 35 35 0 0 0 285 388 L 285 280 L 330 280 L 330 420 L 170 420 Z"
                fill={isHov ? c.stroke + '30' : c.fill} stroke={c.stroke} strokeWidth={isHov ? 2 : 1} />
              <text x="250" y="340" textAnchor="middle" fill={c.text} fontSize="10" fontFamily="monospace" fontWeight="bold">
                {z.pct ? z.pct + '%' : '—'}
              </text>
              <text x="250" y="355" textAnchor="middle" fill={c.text + '99'} fontSize="8" fontFamily="monospace">Paint</text>
            </g>
          )
        })()}

        {/* Mid Range */}
        {(() => {
          const z = getZone('Mid-Range')
          const c = getColor(z.pct, 'Mid-Range')
          const isHov = hovered === 'Mid-Range'
          return (
            <g onMouseEnter={() => setHovered('Mid-Range')} onMouseLeave={() => setHovered(null)} style={{ cursor: 'pointer' }}>
              {/* Left mid */}
              <path d="M 50 280 L 170 280 L 170 420 L 50 420 Z"
                fill={isHov ? c.stroke + '30' : c.fill} stroke={c.stroke} strokeWidth={isHov ? 2 : 1} />
              {/* Right mid */}
              <path d="M 330 280 L 450 280 L 450 420 L 330 420 Z"
                fill={isHov ? c.stroke + '30' : c.fill} stroke={c.stroke} strokeWidth={isHov ? 2 : 1} />
              {/* Top mid */}
              <path d="M 130 130 Q 250 65 370 130 L 330 280 L 170 280 Z"
                fill={isHov ? c.stroke + '30' : c.fill} stroke={c.stroke} strokeWidth={isHov ? 2 : 1} />
              <text x="250" y="215" textAnchor="middle" fill={c.text} fontSize="11" fontFamily="monospace" fontWeight="bold">
                {z.pct ? z.pct + '%' : '—'}
              </text>
              <text x="250" y="230" textAnchor="middle" fill={c.text + '99'} fontSize="9" fontFamily="monospace">Mid-Range</text>
            </g>
          )
        })()}

        {/* Left Corner 3 */}
        {(() => {
          const z = getZone('Left Corner 3')
          const c = getColor(z.pct, 'Left Corner 3')
          const isHov = hovered === 'Left Corner 3'
          return (
            <g onMouseEnter={() => setHovered('Left Corner 3')} onMouseLeave={() => setHovered(null)} style={{ cursor: 'pointer' }}>
              <path d="M 0 280 L 50 280 L 50 420 L 0 420 Z"
                fill={isHov ? c.stroke + '40' : c.fill} stroke={c.stroke} strokeWidth={isHov ? 2 : 1} />
              <text x="25" y="355" textAnchor="middle" fill={c.text} fontSize="9" fontFamily="monospace" fontWeight="bold" transform="rotate(-90, 25, 355)">
                {z.pct ? z.pct + '%' : '—'}
              </text>
            </g>
          )
        })()}

        {/* Right Corner 3 */}
        {(() => {
          const z = getZone('Right Corner 3')
          const c = getColor(z.pct, 'Right Corner 3')
          const isHov = hovered === 'Right Corner 3'
          return (
            <g onMouseEnter={() => setHovered('Right Corner 3')} onMouseLeave={() => setHovered(null)} style={{ cursor: 'pointer' }}>
              <path d="M 450 280 L 500 280 L 500 420 L 450 420 Z"
                fill={isHov ? c.stroke + '40' : c.fill} stroke={c.stroke} strokeWidth={isHov ? 2 : 1} />
              <text x="475" y="355" textAnchor="middle" fill={c.text} fontSize="9" fontFamily="monospace" fontWeight="bold" transform="rotate(90, 475, 355)">
                {z.pct ? z.pct + '%' : '—'}
              </text>
            </g>
          )
        })()}

        {/* Above Break 3 */}
        {(() => {
          const z = getZone('Above the Break 3')
          const c = getColor(z.pct, 'Above the Break 3')
          const isHov = hovered === 'Above the Break 3'
          return (
            <g onMouseEnter={() => setHovered('Above the Break 3')} onMouseLeave={() => setHovered(null)} style={{ cursor: 'pointer' }}>
              {/* Left wing */}
              <path d="M 0 0 L 130 0 L 130 130 Q 50 200 50 280 L 0 280 Z"
                fill={isHov ? c.stroke + '25' : c.fill} stroke={c.stroke} strokeWidth={isHov ? 2 : 1} />
              {/* Right wing */}
              <path d="M 370 0 L 500 0 L 500 280 L 450 280 Q 450 200 370 130 Z"
                fill={isHov ? c.stroke + '25' : c.fill} stroke={c.stroke} strokeWidth={isHov ? 2 : 1} />
              {/* Top center */}
              <path d="M 130 0 L 370 0 L 370 130 Q 250 65 130 130 Z"
                fill={isHov ? c.stroke + '25' : c.fill} stroke={c.stroke} strokeWidth={isHov ? 2 : 1} />
              <text x="250" y="55" textAnchor="middle" fill={c.text} fontSize="13" fontFamily="monospace" fontWeight="bold">
                {z.pct ? z.pct + '%' : '—'}
              </text>
              <text x="250" y="72" textAnchor="middle" fill={c.text + '99'} fontSize="9" fontFamily="monospace">Above Break 3</text>
            </g>
          )
        })()}
      </svg>

      {/* Hover tooltip */}
      {hovered && <ZoneTooltip zone={hovered} />}
    </div>
  )
}

// ── Zone Stats Table ──────────────────────────────────────────────────────────
function ZoneTable({ zones }) {
  const zoneOrder = [
    'Restricted Area',
    'In The Paint (Non-RA)',
    'Mid-Range',
    'Left Corner 3',
    'Right Corner 3',
    'Above the Break 3',
  ]

  const sorted = zoneOrder.map(name => zones.find(z => z.shot_zone_basic === name)).filter(Boolean)

  return (
    <div style={{ background: 'var(--surface)', borderRadius: 10, overflow: 'hidden', border: '1px solid var(--border)' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'var(--font-mono)', fontSize: 12 }}>
        <thead>
          <tr style={{ borderBottom: '1px solid var(--border)' }}>
            {['Zone', 'FG%', 'Att', 'Lg Avg', 'Diff'].map(h => (
              <th key={h} style={{ padding: '10px 14px', color: 'var(--muted)', fontWeight: 500, textAlign: h === 'Zone' ? 'left' : 'right', fontSize: 10, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((z, i) => {
            const avg = LEAGUE_AVG[z.shot_zone_basic]
            const diff = z.pct && avg ? (parseFloat(z.pct) - avg) : null
            const c = getColor(z.pct, z.shot_zone_basic)
            return (
              <tr key={i} style={{ borderBottom: i < sorted.length - 1 ? '1px solid var(--border)' : 'none' }}>
                <td style={{ padding: '10px 14px', color: 'var(--text)', fontSize: 12 }}>{z.shot_zone_basic}</td>
                <td style={{ padding: '10px 14px', textAlign: 'right', color: c.text, fontWeight: 700 }}>
                  {z.pct ? z.pct + '%' : '—'}
                </td>
                <td style={{ padding: '10px 14px', textAlign: 'right', color: 'var(--muted)' }}>{z.attempts}</td>
                <td style={{ padding: '10px 14px', textAlign: 'right', color: 'var(--muted)' }}>{avg ? avg + '%' : '—'}</td>
                <td style={{ padding: '10px 14px', textAlign: 'right', color: diff === null ? 'var(--muted)' : diff >= 0 ? '#4ade80' : '#f87171', fontWeight: 600 }}>
                  {diff === null ? '—' : (diff >= 0 ? '+' : '') + diff.toFixed(1) + '%'}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ── Main Shot Chart ───────────────────────────────────────────────────────────
export default function ShotChart({ player, season }) {
  const [zones, setZones] = useState([])
  const [loading, setLoading] = useState(false)
  const [view, setView] = useState('court')

  useEffect(() => {
    if (!player) return
    setLoading(true)
    apiFetch(`/players/${player.player_id}/shot-chart?season=${season}`)
      .then(setZones)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [player, season])

  if (loading) return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {[...Array(3)].map((_, i) => <div key={i} className="skeleton" style={{ height: 100 }} />)}
    </div>
  )

  if (!zones.length) return (
    <div style={{ textAlign: 'center', padding: 40, color: 'var(--muted)', fontFamily: 'var(--font-mono)', fontSize: 13 }}>
      No shot data available for this season
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Header + view toggle */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontFamily: 'var(--font-disp)', fontSize: 28, letterSpacing: '0.04em' }}>Shot Chart</div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{season} · color = vs league average</div>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {[{id: 'court', label: '🏀 Court'}, {id: 'table', label: '📊 Table'}].map(v => (
            <button key={v.id} onClick={() => setView(v.id)}
              style={{
                background: view === v.id ? 'var(--accent)' : 'var(--card)',
                color: view === v.id ? '#000' : 'var(--muted)',
                border: '1px solid var(--border)', borderRadius: 8,
                padding: '8px 16px', fontFamily: 'var(--font-body)',
                fontSize: 13, cursor: 'pointer', fontWeight: view === v.id ? 700 : 400,
              }}
            >{v.label}</button>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        {[
          { color: '#4ade80', label: '8%+ above avg', desc: 'Elite zone' },
          { color: '#86efac', label: '3-8% above', desc: 'Above avg' },
          { color: '#e8ff47', label: '±3% of avg', desc: 'Average' },
          { color: '#fb923c', label: '3-8% below', desc: 'Below avg' },
          { color: '#f87171', label: '8%+ below avg', desc: 'Cold zone' },
        ].map(({ color, label, desc }) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 10, height: 10, borderRadius: 3, background: color, flexShrink: 0 }} />
            <div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text)' }}>{label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Court or Table */}
      <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: 24 }}>
        {view === 'court' ? <CourtDiagram zones={zones} /> : <ZoneTable zones={zones} />}
      </div>

      {/* Key insight */}
      {zones.length > 0 && (() => {
        const best = [...zones].filter(z => z.pct).sort((a, b) => getDiff(b.pct, b.shot_zone_basic) - getDiff(a.pct, a.shot_zone_basic))[0]
        const worst = [...zones].filter(z => z.pct && z.attempts > 10).sort((a, b) => getDiff(a.pct, a.shot_zone_basic) - getDiff(b.pct, b.shot_zone_basic))[0]
        if (!best) return null
        return (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {best && (
              <div style={{ background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.2)', borderRadius: 10, padding: '14px 18px' }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#4ade80', marginBottom: 6, letterSpacing: '0.08em', textTransform: 'uppercase' }}>🔥 Strongest Zone</div>
                <div style={{ fontFamily: 'var(--font-disp)', fontSize: 24, color: '#4ade80' }}>{best.shot_zone_basic}</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>
                  {best.pct}% · +{getDiff(best.pct, best.shot_zone_basic).toFixed(1)}% vs league avg
                </div>
              </div>
            )}
            {worst && (
              <div style={{ background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)', borderRadius: 10, padding: '14px 18px' }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#f87171', marginBottom: 6, letterSpacing: '0.08em', textTransform: 'uppercase' }}>❄️ Weakest Zone</div>
                <div style={{ fontFamily: 'var(--font-disp)', fontSize: 24, color: '#f87171' }}>{worst.shot_zone_basic}</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>
                  {worst.pct}% · {getDiff(worst.pct, worst.shot_zone_basic).toFixed(1)}% vs league avg
                </div>
              </div>
            )}
          </div>
        )
      })()}
    </div>
  )
}
