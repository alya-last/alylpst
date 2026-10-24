'use client'
import { useEffect, useRef, useState, type ReactNode, type CSSProperties } from 'react'
import { X, Search, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { Sparkline } from './charts'

/* ───────── Toast ───────── */
export function useToast() {
  const [toast, setToast] = useState<{ m: string; err?: boolean } | null>(null)
  const t = useRef<any>(null)
  const show = (m: string, err = false) => {
    setToast({ m, err }); clearTimeout(t.current); t.current = setTimeout(() => setToast(null), err ? 5000 : 3000)
  }
  const node = toast ? <div className="adm-toast" style={toast.err ? { borderColor: 'var(--adm-red)', color: 'var(--adm-red)' } : undefined}>{toast.err ? '⚠ ' : '✓ '}{toast.m}</div> : null
  return { show, node }
}

/* ───────── Sayfa iskeleti ───────── */
export function Page({ children, maxWidth }: { children: ReactNode; maxWidth?: number }) {
  return <div style={{ padding: 24, maxWidth, margin: maxWidth ? '0 auto' : undefined }}>{children}</div>
}

export function PageHead({ title, sub, actions }: { title?: string; sub?: string; actions?: ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, flexWrap: 'wrap', marginBottom: 18 }}>
      <div style={{ flex: 1, minWidth: 220 }}>
        {title && <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, letterSpacing: '-.4px', color: 'var(--adm-tx)' }}>{title}</h2>}
        {sub && <p style={{ margin: '3px 0 0', fontSize: 12.5, color: 'var(--adm-tx3)' }}>{sub}</p>}
      </div>
      {actions && <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>{actions}</div>}
    </div>
  )
}

/* ───────── KPI ───────── */
export function Kpi({ label, value, sub, color = 'var(--adm-ac)', Icon, delta, spark, onClick, valueSize = 22 }: {
  label: string; value: ReactNode; sub?: ReactNode; color?: string; Icon?: any; delta?: number | null; spark?: number[]; onClick?: () => void; valueSize?: number
}) {
  const up = (delta ?? 0) > 0.05, down = (delta ?? 0) < -0.05
  return (
    <div className="adm-kpi" onClick={onClick} style={{ borderLeft: `2.5px solid ${color}`, padding: '15px 16px', cursor: onClick ? 'pointer' : undefined }}>
      <div style={{ position: 'absolute', top: 0, right: 0, width: 90, height: 90, background: `radial-gradient(circle at top right,${color}16,transparent 70%)`, pointerEvents: 'none' }} />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <p className="adm-kpi-label" style={{ margin: 0 }}>{label}</p>
        {Icon && <div style={{ width: 28, height: 28, borderRadius: 8, background: color + '18', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon size={14} style={{ color }} strokeWidth={1.9} /></div>}
      </div>
      <p className="adm-kpi-value" style={{ fontSize: valueSize, color: 'var(--adm-tx)' }}>{value}</p>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8, gap: 8 }}>
        <div style={{ fontSize: 11, color: 'var(--adm-tx3)', display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
          {delta != null && isFinite(delta) && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2, fontWeight: 700, color: up ? 'var(--adm-green)' : down ? 'var(--adm-red)' : 'var(--adm-tx3)' }}>
              {up ? <TrendingUp size={11} /> : down ? <TrendingDown size={11} /> : <Minus size={11} />}{Math.abs(delta).toLocaleString('tr-TR', { maximumFractionDigits: 1 })}%
            </span>
          )}
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sub}</span>
        </div>
        {spark && spark.length > 1 && <Sparkline data={spark} color={color} w={64} h={22} />}
      </div>
    </div>
  )
}
export const KpiGrid = ({ children, min = 200 }: { children: ReactNode; min?: number }) =>
  <div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fit,minmax(${min}px,1fr))`, gap: 12, marginBottom: 18 }}>{children}</div>

/* ───────── Kart ───────── */
export function Card({ title, right, children, pad, style }: { title?: ReactNode; right?: ReactNode; children: ReactNode; pad?: number | string; style?: CSSProperties }) {
  return (
    <div className="adm-card" style={style}>
      {title && <div className="adm-card-h"><span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>{title}</span>{right && <span style={{ display: 'flex', gap: 8, alignItems: 'center', fontWeight: 500 }}>{right}</span>}</div>}
      <div style={{ padding: pad }}>{children}</div>
    </div>
  )
}

/* ───────── Badge / durum ───────── */
const TONES: Record<string, string> = { green: 'adm-badge-green', red: 'adm-badge-red', amber: 'adm-badge-amber', blue: 'adm-badge-blue', ac: 'adm-badge-ac', muted: 'adm-badge-muted' }
export const Badge = ({ tone = 'muted', children, style }: { tone?: keyof typeof TONES; children: ReactNode; style?: CSSProperties }) =>
  <span className={`adm-badge ${TONES[tone as string]}`} style={style}>{children}</span>

/* ───────── Sekmeler (sayaçlı) ───────── */
export function Tabs({ tabs, value, onChange, style }: { tabs: { v: string; l: string; n?: number | string; tone?: string }[]; value: string; onChange: (v: string) => void; style?: CSSProperties }) {
  return (
    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', background: 'var(--adm-s2)', padding: 4, borderRadius: 11, width: 'fit-content', maxWidth: '100%', ...style }}>
      {tabs.map(t => {
        const on = value === t.v
        return (
          <button key={t.v} onClick={() => onChange(t.v)} style={{
            border: 'none', fontFamily: 'inherit', fontSize: 12.5, fontWeight: 600, padding: '6px 13px', borderRadius: 8, display: 'inline-flex', alignItems: 'center', gap: 7,
            background: on ? 'var(--adm-s1)' : 'transparent', color: on ? 'var(--adm-tx)' : 'var(--adm-tx3)',
            boxShadow: on ? '0 1px 3px rgba(20,20,30,.12)' : 'none', transition: 'all .12s',
          }}>
            {t.l}
            {t.n != null && <span style={{ fontSize: 10.5, fontWeight: 700, padding: '1px 7px', borderRadius: 10, background: on ? 'var(--adm-ac2)' : 'var(--adm-s4)', color: on ? 'var(--adm-ac)' : 'var(--adm-tx2)' }}>{t.n}</span>}
          </button>
        )
      })}
    </div>
  )
}

/* ───────── Arama kutusu ───────── */
export function SearchBox({ value, onChange, placeholder = 'Ara...', width = 260 }: { value: string; onChange: (v: string) => void; placeholder?: string; width?: number }) {
  return (
    <div style={{ position: 'relative', width, maxWidth: '100%' }}>
      <Search size={13} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--adm-tx3)' }} />
      <input className="adm-inp" style={{ paddingLeft: 32, paddingTop: 8, paddingBottom: 8 }} placeholder={placeholder} value={value} onChange={e => onChange(e.target.value)} />
    </div>
  )
}

/* ───────── Yandan açılan panel ───────── */
export function Drawer({ open, onClose, title, sub, children, footer, width = 520 }: {
  open: boolean; onClose: () => void; title: ReactNode; sub?: ReactNode; children: ReactNode; footer?: ReactNode; width?: number
}) {
  useEffect(() => {
    if (!open) return
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h)
  }, [open, onClose])
  if (!open) return null
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 500, display: 'flex', justifyContent: 'flex-end' }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(10,10,20,.45)', backdropFilter: 'blur(2px)' }} />
      <div style={{ position: 'relative', width: '100%', maxWidth: width, background: 'var(--adm-s1)', height: '100%', display: 'flex', flexDirection: 'column', boxShadow: '-12px 0 40px rgba(0,0,0,.25)', animation: 'admSlideIn .2s ease' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '16px 20px', borderBottom: '1px solid var(--adm-bdr)' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15.5, fontWeight: 700, color: 'var(--adm-tx)' }}>{title}</div>
            {sub && <div style={{ fontSize: 12, color: 'var(--adm-tx3)', marginTop: 2 }}>{sub}</div>}
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--adm-tx3)', padding: 4 }}><X size={18} /></button>
        </div>
        <div style={{ flex: 1, overflow: 'auto' }}>{children}</div>
        {footer && <div style={{ padding: '12px 20px', borderTop: '1px solid var(--adm-bdr)', display: 'flex', gap: 8, justifyContent: 'flex-end', background: 'var(--adm-s1)' }}>{footer}</div>}
      </div>
    </div>
  )
}

/* ───────── Modal ───────── */
export function Modal({ open, onClose, title, children, footer, width = 560, onSubmit }: {
  open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; footer?: ReactNode; width?: number; onSubmit?: (e: React.FormEvent) => void
}) {
  useEffect(() => {
    if (!open) return
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h)
  }, [open, onClose])
  if (!open) return null
  const Body = (
    <>
      <div className="adm-modal-b">{children}</div>
      {footer && <div className="adm-modal-f">{footer}</div>}
    </>
  )
  return (
    <div className="adm-modal-bg" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="adm-modal" style={{ maxWidth: width }}>
        <div className="adm-modal-h"><span>{title}</span><button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--adm-tx3)' }}><X size={18} /></button></div>
        {onSubmit ? <form onSubmit={onSubmit}>{Body}</form> : Body}
      </div>
    </div>
  )
}

/* ───────── Form yardımcıları ───────── */
export const Field = ({ label, children, span, hint }: { label: string; children: ReactNode; span?: number; hint?: string }) => (
  <div style={{ gridColumn: span ? `span ${span}` : undefined }}>
    <label className="adm-label">{label}</label>{children}
    {hint && <p style={{ fontSize: 11, color: 'var(--adm-tx3)', margin: '5px 0 0' }}>{hint}</p>}
  </div>
)
export const FormGrid = ({ children, cols = 2 }: { children: ReactNode; cols?: number }) =>
  <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols},1fr)`, gap: 14 }}>{children}</div>

export const Empty = ({ icon, title, sub, action }: { icon?: ReactNode; title: string; sub?: string; action?: ReactNode }) => (
  <div style={{ padding: '44px 20px', textAlign: 'center', color: 'var(--adm-tx3)' }}>
    {icon && <div style={{ marginBottom: 10, opacity: .55, display: 'flex', justifyContent: 'center' }}>{icon}</div>}
    <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--adm-tx2)', margin: 0 }}>{title}</p>
    {sub && <p style={{ fontSize: 12.5, margin: '4px 0 0' }}>{sub}</p>}
    {action && <div style={{ marginTop: 14 }}>{action}</div>}
  </div>
)

export const Skeleton = ({ h = 14, w = '100%', style }: { h?: number; w?: number | string; style?: CSSProperties }) =>
  <div style={{ height: h, width: w, borderRadius: 6, background: 'linear-gradient(90deg,var(--adm-s2),var(--adm-s4),var(--adm-s2))', backgroundSize: '200% 100%', animation: 'admShimmer 1.2s infinite', ...style }} />

/* ───────── Tutar hücresi ───────── */
export const Money = ({ v, tone, sign, bold = true, size = 13, cur = 'TRY' }: { v: number; tone?: 'auto' | 'green' | 'red'; sign?: boolean; bold?: boolean; size?: number; cur?: string }) => {
  const c = tone === 'auto' ? (v > 0 ? 'var(--adm-green)' : v < 0 ? 'var(--adm-red)' : 'var(--adm-tx3)') : tone === 'green' ? 'var(--adm-green)' : tone === 'red' ? 'var(--adm-red)' : 'var(--adm-tx)'
  const s = new Intl.NumberFormat('tr-TR', { style: 'currency', currency: cur }).format(Math.abs(v || 0))
  return <span style={{ fontFamily: 'JetBrains Mono,monospace', fontWeight: bold ? 700 : 500, color: c, fontSize: size, whiteSpace: 'nowrap' }}>{sign && v > 0 ? '+' : v < 0 ? '-' : ''}{s}</span>
}

export const Divider = ({ label }: { label?: string }) =>
  <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '16px 0 10px' }}>
    {label && <span style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--adm-tx3)', textTransform: 'uppercase', letterSpacing: '.08em' }}>{label}</span>}
    <div style={{ flex: 1, height: 1, background: 'var(--adm-bdr)' }} />
  </div>

export const InfoRow = ({ k, v }: { k: string; v: ReactNode }) =>
  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '7px 0', fontSize: 12.5, borderBottom: '1px dashed var(--adm-bdr)' }}>
    <span style={{ color: 'var(--adm-tx3)' }}>{k}</span><span style={{ color: 'var(--adm-tx)', fontWeight: 500, textAlign: 'right', wordBreak: 'break-word' }}>{v}</span>
  </div>
