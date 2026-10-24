'use client'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { fmtK } from '@/lib/fmt'

function useWidth<T extends HTMLElement>(): [React.RefObject<T | null>, number] {
  const ref = useRef<T>(null)
  const [w, setW] = useState(600)
  useEffect(() => {
    if (!ref.current) return
    const ro = new ResizeObserver(e => setW(Math.max(220, Math.floor(e[0].contentRect.width))))
    ro.observe(ref.current); return () => ro.disconnect()
  }, [])
  return [ref, w]
}

export function Sparkline({ data, color = 'var(--adm-ac)', w = 80, h = 26 }: { data: number[]; color?: string; w?: number; h?: number }) {
  if (data.length < 2) return null
  const mn = Math.min(...data), mx = Math.max(...data), r = mx - mn || 1
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * (w - 2) + 1},${h - 3 - ((v - mn) / r) * (h - 6)}`)
  return (
    <svg width={w} height={h} style={{ flexShrink: 0 }}>
      <polyline points={pts.join(' ')} fill="none" stroke={color} strokeWidth={1.6} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={pts[pts.length - 1].split(',')[0]} cy={pts[pts.length - 1].split(',')[1]} r={2.2} fill={color} />
    </svg>
  )
}

function niceMax(v: number) {
  if (v <= 0) return 1
  const p = Math.pow(10, Math.floor(Math.log10(v)))
  const n = v / p
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p
}

export type Series = { name: string; color: string; data: number[] }

export function TrendChart({ labels, series, type = 'area', height = 230, format = fmtK, allowNegative = false }: {
  labels: string[]; series: Series[]; type?: 'area' | 'bar' | 'line'; height?: number; format?: (n: number) => string; allowNegative?: boolean
}) {
  const [ref, W] = useWidth<HTMLDivElement>()
  const [hover, setHover] = useState<number | null>(null)
  const padL = 54, padR = 12, padT = 12, padB = 26
  const iw = W - padL - padR, ih = height - padT - padB
  const all = series.flatMap(s => s.data)
  const mx = niceMax(Math.max(...all, 0))
  const mn = allowNegative ? -niceMax(Math.abs(Math.min(...all, 0))) : 0
  const range = mx - mn || 1
  const y = (v: number) => padT + ih - ((v - mn) / range) * ih
  const n = labels.length
  const x = (i: number) => padL + (type === 'bar' ? (i + 0.5) * (iw / n) : n === 1 ? iw / 2 : (i / (n - 1)) * iw)
  const ticks = [0, 1, 2, 3, 4].map(i => mn + (range / 4) * i)
  const step = Math.ceil(n / Math.max(2, Math.floor(iw / 62)))

  function onMove(e: React.MouseEvent<SVGSVGElement>) {
    const r = e.currentTarget.getBoundingClientRect()
    const px = e.clientX - r.left - padL
    const i = type === 'bar' ? Math.floor(px / (iw / n)) : Math.round((px / iw) * (n - 1))
    setHover(i >= 0 && i < n ? i : null)
  }

  return (
    <div ref={ref} style={{ position: 'relative', width: '100%' }}>
      <svg width={W} height={height} onMouseMove={onMove} onMouseLeave={() => setHover(null)} style={{ display: 'block' }}>
        <defs>
          {series.map((s, i) => (
            <linearGradient key={i} id={`g${i}-${s.name}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={s.color} stopOpacity=".28" /><stop offset="100%" stopColor={s.color} stopOpacity="0" />
            </linearGradient>
          ))}
        </defs>
        {ticks.map((t, i) => (
          <g key={i}>
            <line x1={padL} x2={W - padR} y1={y(t)} y2={y(t)} stroke="var(--adm-bdr)" strokeDasharray={t === 0 ? '' : '3 4'} />
            <text x={padL - 8} y={y(t) + 3.5} fontSize={10} textAnchor="end" fill="var(--adm-tx3)">{format(t)}</text>
          </g>
        ))}
        {labels.map((l, i) => i % step === 0 && <text key={i} x={x(i)} y={height - 8} fontSize={10} textAnchor="middle" fill="var(--adm-tx3)">{l}</text>)}

        {type === 'bar' && series.map((s, si) => {
          const bw = Math.min(26, (iw / n) * 0.72 / series.length)
          return s.data.map((v, i) => {
            const bx = x(i) - (bw * series.length) / 2 + si * bw
            const y0 = y(0), y1 = y(v)
            return <rect key={`${si}-${i}`} x={bx} y={Math.min(y0, y1)} width={bw - 1.5} height={Math.max(Math.abs(y0 - y1), v ? 1.5 : 0)} rx={3} fill={s.color} opacity={hover == null || hover === i ? 0.92 : 0.4} />
          })
        })}

        {type !== 'bar' && series.map((s, si) => {
          const pts = s.data.map((v, i) => [x(i), y(v)])
          const d = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0]},${p[1]}`).join(' ')
          return (
            <g key={si}>
              {type === 'area' && n > 1 && <path d={`${d} L${pts[n - 1][0]},${y(0)} L${pts[0][0]},${y(0)} Z`} fill={`url(#g${si}-${s.name})`} />}
              <path d={d} fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
              {hover != null && <circle cx={pts[hover][0]} cy={pts[hover][1]} r={4} fill="var(--adm-s1)" stroke={s.color} strokeWidth={2} />}
            </g>
          )
        })}
        {hover != null && <line x1={x(hover)} x2={x(hover)} y1={padT} y2={padT + ih} stroke="var(--adm-bdr2)" />}
      </svg>
      {hover != null && (
        <div style={{
          position: 'absolute', top: 6, left: Math.min(Math.max(x(hover) + 12, 8), W - 170), pointerEvents: 'none', zIndex: 5,
          background: 'var(--adm-tx)', color: '#fff', borderRadius: 9, padding: '8px 11px', fontSize: 11.5, minWidth: 130, boxShadow: '0 6px 18px rgba(0,0,0,.25)',
        }}>
          <div style={{ fontWeight: 700, marginBottom: 4, opacity: .8 }}>{labels[hover]}</div>
          {series.map(s => (
            <div key={s.name} style={{ display: 'flex', justifyContent: 'space-between', gap: 14, alignItems: 'center' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><i style={{ width: 8, height: 8, borderRadius: 2, background: s.color, display: 'inline-block' }} />{s.name}</span>
              <b>{new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 }).format(s.data[hover] || 0)}</b>
            </div>
          ))}
        </div>
      )}
      <Legend items={series.map(s => ({ label: s.name, color: s.color }))} />
    </div>
  )
}

export const Legend = ({ items }: { items: { label: string; color: string }[] }) => (
  <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap', marginTop: 4 }}>
    {items.map(i => <span key={i.label} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--adm-tx3)' }}><i style={{ width: 9, height: 9, borderRadius: 3, background: i.color, display: 'inline-block' }} />{i.label}</span>)}
  </div>
)

export function Donut({ data, size = 170, center }: { data: { label: string; value: number; color: string }[]; size?: number; center?: { top: string; bottom: ReactNode } }) {
  const total = data.reduce((s, d) => s + d.value, 0)
  const r = size / 2 - 14, c = 2 * Math.PI * r
  let off = 0
  const [hi, setHi] = useState<number | null>(null)
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap', justifyContent: 'center' }}>
      <div style={{ position: 'relative', width: size, height: size }}>
        <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--adm-s2)" strokeWidth={20} />
          {total > 0 && data.map((d, i) => {
            const len = (d.value / total) * c
            const el = <circle key={i} cx={size / 2} cy={size / 2} r={r} fill="none" stroke={d.color} strokeWidth={hi === i ? 24 : 20}
              strokeDasharray={`${Math.max(len - 1.5, 0)} ${c}`} strokeDashoffset={-off} onMouseEnter={() => setHi(i)} onMouseLeave={() => setHi(null)} style={{ transition: 'stroke-width .12s' }} />
            off += len; return el
          })}
        </svg>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: 24 }}>
          <span style={{ fontSize: 10.5, color: 'var(--adm-tx3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em' }}>{hi != null ? data[hi].label : center?.top}</span>
          <span style={{ fontSize: 15, fontWeight: 700, fontFamily: 'JetBrains Mono,monospace', color: 'var(--adm-tx)' }}>{hi != null ? fmtK(data[hi].value) : center?.bottom}</span>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 7, minWidth: 140 }}>
        {data.map((d, i) => (
          <div key={i} onMouseEnter={() => setHi(i)} onMouseLeave={() => setHi(null)} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, opacity: hi == null || hi === i ? 1 : 0.5 }}>
            <i style={{ width: 9, height: 9, borderRadius: 3, background: d.color, display: 'inline-block', flexShrink: 0 }} />
            <span style={{ flex: 1, color: 'var(--adm-tx2)' }}>{d.label}</span>
            <b style={{ color: 'var(--adm-tx)' }}>{total ? Math.round((d.value / total) * 100) : 0}%</b>
          </div>
        ))}
      </div>
    </div>
  )
}

export function BarList({ items, format = fmtK, color = 'var(--adm-ac)' }: { items: { label: string; value: number; color?: string; sub?: string }[]; format?: (n: number) => string; color?: string }) {
  const mx = Math.max(...items.map(i => Math.abs(i.value)), 1)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
      {items.map((i, k) => (
        <div key={k}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, marginBottom: 4, gap: 10 }}>
            <span style={{ color: 'var(--adm-tx)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{i.label}{i.sub && <span style={{ color: 'var(--adm-tx3)', fontWeight: 400 }}> · {i.sub}</span>}</span>
            <b style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: 12 }}>{format(i.value)}</b>
          </div>
          <div style={{ height: 6, borderRadius: 4, background: 'var(--adm-s2)', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${(Math.abs(i.value) / mx) * 100}%`, background: i.color || color, borderRadius: 4, transition: 'width .5s ease' }} />
          </div>
        </div>
      ))}
    </div>
  )
}

// Yatay yığılmış çubuk (yaşlandırma gibi dağılımlar için)
export function StackBar({ parts, height = 14 }: { parts: { label: string; value: number; color: string }[]; height?: number }) {
  const total = parts.reduce((s, p) => s + p.value, 0)
  return (
    <div>
      <div style={{ display: 'flex', height, borderRadius: 8, overflow: 'hidden', background: 'var(--adm-s2)' }}>
        {total > 0 && parts.map((p, i) => p.value > 0 && <div key={i} title={`${p.label}: ${fmtK(p.value)}`} style={{ width: `${(p.value / total) * 100}%`, background: p.color }} />)}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${parts.length},1fr)`, gap: 8, marginTop: 10 }}>
        {parts.map((p, i) => (
          <div key={i}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10.5, color: 'var(--adm-tx3)', fontWeight: 600 }}><i style={{ width: 8, height: 8, borderRadius: 2, background: p.color, display: 'inline-block' }} />{p.label}</div>
            <div style={{ fontSize: 13, fontWeight: 700, fontFamily: 'JetBrains Mono,monospace', marginTop: 2 }}>{fmtK(p.value)}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
