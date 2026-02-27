import { useState } from 'react'

const API = import.meta.env.VITE_API_URL || ''

async function apiFetch(path, opts = {}) {
  const res = await fetch(`${API}${path}`, opts)
  if (!res.ok) throw new Error(`${res.status}`)
  return res.json()
}

async function askClaude(prompt) {
  const data = await apiFetch('/insights', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ player_id: null, season: '2025-26', question: prompt, _raw: true }),
  })
  return data.insight
}

// ── Spinner ───────────────────────────────────────────────────────────────────
function Spinner() {
  return (
    <div style={{
      width: 20, height: 20,
      border: '2px solid var(--border)',
      borderTopColor: 'var(--accent)',
      borderRadius: '50%',
      animation: 'spin 0.8s linear infinite',
      display: 'inline-block',
    }} />
  )
}

// ── Result Card ───────────────────────────────────────────────────────────────
function ResultCard({ title, content, color = 'var(--accent)', emoji }) {
  const [copied, setCopied] = useState(false)

  const copy = () => {
    navigator.clipboard.writeText(content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="fade-up" style={{
      background: 'var(--card)', border: `1px solid ${color}40`,
      borderRadius: 12, padding: 24, position: 'relative',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
          {emoji} {title}
        </div>
        <button onClick={copy} style={{
          background: copied ? color : 'var(--surface)',
          color: copied ? '#000' : 'var(--muted)',
          border: '1px solid var(--border)', borderRadius: 6,
          padding: '4px 12px', fontFamily: 'var(--font-mono)',
          fontSize: 11, cursor: 'pointer', transition: 'all 0.2s',
        }}>
          {copied ? '✓ Copied' : '📋 Copy'}
        </button>
      </div>
      <div style={{ color: 'var(--text)', lineHeight: 1.8, fontSize: 14, whiteSpace: 'pre-wrap' }}>
        {content.replace(/#{1,3} /g, '').replace(/\*\*(.*?)\*\*/g, '$1')}
      </div>
    </div>
  )
}

// ── Player Search ─────────────────────────────────────────────────────────────
function PlayerSearch({ onSelect, selected, placeholder = 'Search player...' }) {
  const [query, setQuery] = useState(selected?.full_name || '')
  const [results, setResults] = useState([])
  const debounce = { current: null }

  const search = async (q) => {
    if (q.length < 2) { setResults([]); return }
    try {
      const data = await apiFetch(`/players/search?q=${encodeURIComponent(q)}`)
      setResults(data)
    } catch {}
  }

  return (
    <div style={{ position: 'relative', flex: 1 }}>
      <input
        value={query}
        onChange={e => {
          setQuery(e.target.value)
          clearTimeout(debounce.current)
          debounce.current = setTimeout(() => search(e.target.value), 300)
          if (!e.target.value) onSelect(null)
        }}
        placeholder={placeholder}
        style={{
          width: '100%', background: 'var(--surface)',
          border: `1px solid ${selected ? 'var(--accent)' : 'var(--border)'}`,
          borderRadius: 8, padding: '10px 14px', color: 'var(--text)',
          fontFamily: 'var(--font-body)', fontSize: 14, outline: 'none',
        }}
      />
      {results.length > 0 && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100,
          background: 'var(--card)', border: '1px solid var(--border)',
          borderRadius: 10, marginTop: 4, overflow: 'hidden',
          boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
        }}>
          {results.map((p, i) => (
            <div key={p.player_id}
              onClick={() => { onSelect(p); setQuery(p.full_name); setResults([]) }}
              style={{
                padding: '10px 16px', cursor: 'pointer', fontSize: 14,
                borderBottom: i < results.length - 1 ? '1px solid var(--border)' : 'none',
                display: 'flex', justifyContent: 'space-between',
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--surface)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <span>{p.full_name}</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--muted)' }}>{p.team_abbr}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Hot Take Generator ────────────────────────────────────────────────────────
function HotTakeGenerator() {
  const [player, setPlayer] = useState(null)
  const [take, setTake] = useState(null)
  const [loading, setLoading] = useState(false)
  const [heat, setHeat] = useState('spicy')

  const heatLevels = [
    { id: 'mild',     label: '🌶️ Mild',     desc: 'Slightly controversial' },
    { id: 'spicy',    label: '🌶️🌶️ Spicy',  desc: 'Debate worthy' },
    { id: 'nuclear',  label: '☢️ Nuclear',   desc: 'Full chaos mode' },
  ]

  const generate = async () => {
    if (!player) return
    setLoading(true)
    setTake(null)
    try {
      const heatInstructions = {
        mild: 'slightly controversial but defensible',
        spicy: 'very controversial, will spark debate in a group chat',
        nuclear: 'absolutely unhinged, maximum chaos, will make people lose their minds — but still loosely grounded in stats',
      }
      const data = await apiFetch('/insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          player_id: player.player_id,
          season: '2025-26',
          question: `Generate a single hot take about ${player.full_name} that is ${heatInstructions[heat]}. 
          The take should be 2-3 sentences max, punchy and shareable in a group chat. 
          Base it on their actual stats and performance. 
          Start directly with the take — no preamble like "Here's a hot take:" just say it.
          Make it feel like something a knowledgeable but opinionated fan would say.`,
        }),
      })
      setTake(data.insight)
    } catch {}
    setLoading(false)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--muted)', marginBottom: 8, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Player</div>
          <PlayerSearch onSelect={setPlayer} selected={player} />
        </div>

        <div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--muted)', marginBottom: 8, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Heat Level</div>
          <div style={{ display: 'flex', gap: 6 }}>
            {heatLevels.map(h => (
              <button key={h.id} onClick={() => setHeat(h.id)}
                style={{
                  background: heat === h.id ? 'var(--accent2)' : 'var(--surface)',
                  color: heat === h.id ? '#000' : 'var(--muted)',
                  border: `1px solid ${heat === h.id ? 'var(--accent2)' : 'var(--border)'}`,
                  borderRadius: 8, padding: '10px 14px',
                  fontFamily: 'var(--font-body)', fontSize: 13,
                  cursor: 'pointer', fontWeight: heat === h.id ? 700 : 400,
                  transition: 'all 0.15s', whiteSpace: 'nowrap',
                }}
              >{h.label}</button>
            ))}
          </div>
        </div>

        <button onClick={generate} disabled={!player || loading}
          style={{
            background: player ? 'var(--accent2)' : 'var(--surface)',
            color: player ? '#000' : 'var(--muted)',
            border: 'none', borderRadius: 8, padding: '10px 24px',
            fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: 14,
            cursor: player && !loading ? 'pointer' : 'not-allowed',
            display: 'flex', alignItems: 'center', gap: 8,
            opacity: !player ? 0.5 : 1,
          }}
        >
          {loading ? <><Spinner /> Generating...</> : '🔥 Generate Take'}
        </button>
      </div>

      {take && (
        <ResultCard
          title="Hot Take"
          content={take}
          color="var(--accent2)"
          emoji="🔥"
        />
      )}
    </div>
  )
}

// ── Overrated / Underrated ────────────────────────────────────────────────────
function OverratedUnderrated() {
  const [player, setPlayer] = useState(null)
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [verdict, setVerdict] = useState(null)

  const VERDICTS = {
    OVERRATED:   { color: '#f87171', emoji: '📉', label: 'OVERRATED' },
    UNDERRATED:  { color: '#4ade80', emoji: '📈', label: 'UNDERRATED' },
    'PROPERLY RATED': { color: 'var(--accent)', emoji: '⚖️', label: 'PROPERLY RATED' },
  }

  const analyze = async () => {
    if (!player) return
    setLoading(true)
    setResult(null)
    setVerdict(null)
    try {
      const data = await apiFetch('/insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          player_id: player.player_id,
          season: '2025-26',
          question: `Is ${player.full_name} overrated, underrated, or properly rated right now?

          Analyze their actual production vs their public perception and reputation.
          Consider: their stats, efficiency, impact on winning, contract value, All-Star selections, media coverage.
          
          Start your response with exactly one of these verdicts on its own line:
          OVERRATED
          UNDERRATED  
          PROPERLY RATED
          
          Then give a 3-4 sentence explanation with specific stats to back it up.
          Be bold and definitive — no fence sitting.`,
        }),
      })

      const text = data.insight
      const lines = text.trim().split('\n')
      const firstLine = lines[0].trim().toUpperCase()

      let v = null
      if (firstLine.includes('OVERRATED')) v = 'OVERRATED'
      else if (firstLine.includes('UNDERRATED')) v = 'UNDERRATED'
      else if (firstLine.includes('PROPERLY')) v = 'PROPERLY RATED'

      setVerdict(v)
      setResult(lines.slice(1).join('\n').trim() || text)
    } catch {}
    setLoading(false)
  }

  const v = verdict ? VERDICTS[verdict] : null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--muted)', marginBottom: 8, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Player</div>
          <PlayerSearch onSelect={setPlayer} selected={player} />
        </div>
        <button onClick={analyze} disabled={!player || loading}
          style={{
            background: player ? 'var(--accent)' : 'var(--surface)',
            color: player ? '#000' : 'var(--muted)',
            border: 'none', borderRadius: 8, padding: '10px 24px',
            fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: 14,
            cursor: player && !loading ? 'pointer' : 'not-allowed',
            display: 'flex', alignItems: 'center', gap: 8,
            opacity: !player ? 0.5 : 1,
          }}
        >
          {loading ? <><Spinner /> Analyzing...</> : '⚖️ Verdict'}
        </button>
      </div>

      {v && result && (
        <div className="fade-up">
          {/* Big verdict banner */}
          <div style={{
            background: `${v.color}15`,
            border: `2px solid ${v.color}`,
            borderRadius: 12, padding: '24px 32px',
            textAlign: 'center', marginBottom: 16,
          }}>
            <div style={{ fontSize: 48, marginBottom: 8 }}>{v.emoji}</div>
            <div style={{
              fontFamily: 'var(--font-disp)', fontSize: 52,
              color: v.color, letterSpacing: '0.06em', lineHeight: 1,
              textShadow: `0 0 40px ${v.color}60`,
            }}>{v.label}</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--muted)', marginTop: 8 }}>
              {player.full_name} · 2025-26
            </div>
          </div>

          <ResultCard
            title="Analysis"
            content={result}
            color={v.color}
            emoji={v.emoji}
          />
        </div>
      )}
    </div>
  )
}

// ── Main Banter Tools ─────────────────────────────────────────────────────────
export default function BanterTools() {
  const [activeTool, setActiveTool] = useState('hottake')

  const tools = [
    { id: 'hottake',    label: '🔥 Hot Take',          component: HotTakeGenerator },
    { id: 'overrated',  label: '⚖️ Over/Underrated',   component: OverratedUnderrated },
  ]

  const ActiveComponent = tools.find(t => t.id === activeTool)?.component

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Tool selector */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {tools.map(t => (
          <button key={t.id} onClick={() => setActiveTool(t.id)}
            style={{
              background: activeTool === t.id ? 'var(--accent)' : 'var(--card)',
              color: activeTool === t.id ? '#000' : 'var(--muted)',
              border: `1px solid ${activeTool === t.id ? 'var(--accent)' : 'var(--border)'}`,
              borderRadius: 8, padding: '10px 20px',
              fontFamily: 'var(--font-body)', fontWeight: activeTool === t.id ? 700 : 400,
              fontSize: 14, cursor: 'pointer', transition: 'all 0.15s',
            }}
          >{t.label}</button>
        ))}
      </div>

      {/* Active tool */}
      <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: 24 }}>
        {ActiveComponent && <ActiveComponent />}
      </div>
    </div>
  )
}
