'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { Search, X, FileText, Users2, ClipboardList, Receipt, LayoutDashboard } from 'lucide-react'
import { muh } from '@/lib/muhasebe-client'
import { erp } from '@/lib/erp-client'
import { web } from '@/lib/web-data'

type Sonuc = { tur: string; baslik: string; alt?: string; href: string; ara: string }
const tr = (s: string) => String(s || '').toLocaleLowerCase('tr').replace(/\s+/g, ' ').trim()
const TUR_ICON: Record<string, any> = { Sayfa: LayoutDashboard, Cari: Users2, Teklif: FileText, Sipariş: ClipboardList, Fatura: Receipt }

/** Üst çubukta genel hızlı arama: sayfalar (yetkiye göre menüden), cari, teklif, satış siparişi, fatura. Ctrl+K / "/" ile açılır. */
export default function HizliArama() {
  const router = useRouter()
  const [acik, setAcik] = useState(false), [q, setQ] = useState(''), [sec, setSec] = useState(0), [yuk, setYuk] = useState(false), [mounted, setMounted] = useState(false)
  const [kayit, setKayit] = useState<Sonuc[]>([]), [sayfa, setSayfa] = useState<Sonuc[]>([])
  const yuklendi = useRef(false), inp = useRef<HTMLInputElement>(null)

  useEffect(() => { setMounted(true) }, [])
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null, yazi = !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setAcik(a => !a) }
      else if (e.key === '/' && !yazi && !e.ctrlKey && !e.metaKey) { e.preventDefault(); setAcik(true) }
      else if (e.key === 'Escape') setAcik(false)
    }
    window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k)
  }, [])

  useEffect(() => {
    if (!acik) return
    setQ(''); setSec(0); setTimeout(() => inp.current?.focus(), 30)
    // Sayfalar: kenar menüde görünenler (yetkiye göre zaten süzülmüş)
    const s: Sonuc[] = []
    document.querySelectorAll<HTMLAnchorElement>('.adm-sb-nav a[href^="/admin"]').forEach(a => { const t = (a.textContent || '').trim(); if (t) s.push({ tur: 'Sayfa', baslik: t, href: a.getAttribute('href') || '', ara: tr(t) }) })
    setSayfa(s)
    if (yuklendi.current) return
    yuklendi.current = true; setYuk(true)
    const al = async (p: PromiseLike<any>) => { try { const r = await p; return Array.isArray(r?.data) ? r.data : [] } catch { return [] } }
    ;(async () => {
      const [cari, tek, sip, fat] = await Promise.all([
        al(muh.from('cari_hesaplar').select('id,ad,vergi_no,telefon').order('ad', { ascending: true }).limit(3000)),
        al(web.from('teklifler').select('id,no,musteri_adi,toplam,para_birimi,durum').order('created_at', { ascending: false }).limit(1000)),
        al(erp.from('satis_siparisleri').select('id,no,durum,cari_id').order('created_at', { ascending: false }).limit(1000)),
        al(muh.from('faturalar').select('id,no,tip,cari_id,toplam').order('tarih', { ascending: false }).limit(1500)),
      ])
      const cm = new Map<string, string>(cari.map((c: any) => [c.id, c.ad]))
      const r: Sonuc[] = [
        ...cari.map((c: any) => ({ tur: 'Cari', baslik: c.ad, alt: [c.vergi_no, c.telefon].filter(Boolean).join(' · '), href: `/admin/dashboard/muhasebe/cari?ac=${c.id}`, ara: tr(`${c.ad} ${c.vergi_no || ''} ${c.telefon || ''}`) })),
        ...tek.map((t: any) => ({ tur: 'Teklif', baslik: `${t.no} · ${t.musteri_adi}`, alt: `${t.durum}`, href: `/admin/dashboard/satis/teklifler?ac=${t.id}`, ara: tr(`${t.no} ${t.musteri_adi}`) })),
        ...sip.map((s: any) => ({ tur: 'Sipariş', baslik: `${s.no}${cm.get(s.cari_id) ? ' · ' + cm.get(s.cari_id) : ''}`, alt: s.durum, href: `/admin/dashboard/satis/siparisler?ac=${s.id}`, ara: tr(`${s.no} ${cm.get(s.cari_id) || ''}`) })),
        ...fat.map((f: any) => ({ tur: 'Fatura', baslik: `${f.no || '—'}${cm.get(f.cari_id) ? ' · ' + cm.get(f.cari_id) : ''}`, alt: f.tip, href: `/admin/dashboard/muhasebe/faturalar?ac=${f.id}`, ara: tr(`${f.no || ''} ${cm.get(f.cari_id) || ''}`) })),
      ]
      setKayit(r); setYuk(false)
    })()
  }, [acik])

  const sonuc = useMemo(() => {
    const k = tr(q); if (!k) return sayfa.slice(0, 12)
    const parca = k.split(' ')
    const uyan = (x: Sonuc) => parca.every(p => x.ara.includes(p))
    const puan = (x: Sonuc) => (x.ara.startsWith(k) ? 0 : 1) + (x.tur === 'Sayfa' ? 0 : 0.5)
    return [...sayfa, ...kayit].filter(uyan).sort((a, b) => puan(a) - puan(b)).slice(0, 30)
  }, [q, sayfa, kayit])
  useEffect(() => { setSec(0) }, [q])

  const git = (s?: Sonuc) => { if (!s) return; setAcik(false); router.push(s.href) }
  const tus = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSec(i => Math.min(i + 1, sonuc.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSec(i => Math.max(i - 1, 0)) }
    else if (e.key === 'Enter') { e.preventDefault(); git(sonuc[sec]) }
  }

  return <>
    <button type="button" className="adm-btn-ghost" style={{ marginRight: 8, display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5 }} onClick={() => setAcik(true)} title="Hızlı arama (Ctrl+K)"><Search size={14} /><span className="adm-hizli-yazi">Ara…</span><kbd style={{ fontSize: 10, border: '1px solid var(--adm-bdr)', borderRadius: 4, padding: '0 4px', color: 'var(--adm-tx3)' }}>Ctrl K</kbd></button>
    {mounted && acik && createPortal(
      <div className="adm-modal-bg" style={{ alignItems: 'flex-start', paddingTop: '12vh' }} onMouseDown={e => { if (e.target === e.currentTarget) setAcik(false) }}>
        <div className="adm-modal" style={{ maxWidth: 620 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px', borderBottom: '1px solid var(--adm-bdr)' }}>
            <Search size={16} style={{ color: 'var(--adm-tx3)' }} />
            <input ref={inp} className="adm-inp" style={{ border: 'none', background: 'transparent', boxShadow: 'none', padding: 0 }} placeholder="Sayfa, cari, teklif no, sipariş, fatura ara…" value={q} onChange={e => setQ(e.target.value)} onKeyDown={tus} />
            <button type="button" className="adm-btn-ghost" style={{ padding: '3px 6px' }} onClick={() => setAcik(false)}><X size={14} /></button>
          </div>
          <div style={{ maxHeight: '55vh', overflowY: 'auto', padding: 6 }}>
            {sonuc.length === 0 && <div style={{ padding: 16, fontSize: 13, color: 'var(--adm-tx3)' }}>{yuk ? 'Yükleniyor…' : 'Sonuç yok'}</div>}
            {sonuc.map((s, i) => { const I = TUR_ICON[s.tur] || FileText; return <div key={s.href + i} onMouseEnter={() => setSec(i)} onClick={() => git(s)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 8, cursor: 'pointer', background: i === sec ? 'var(--adm-s3)' : 'transparent' }}>
              <I size={15} style={{ color: 'var(--adm-tx3)', flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.baslik}</div>{s.alt && <div style={{ fontSize: 11, color: 'var(--adm-tx3)' }}>{s.alt}</div>}</div>
              <span style={{ fontSize: 10.5, color: 'var(--adm-tx3)' }}>{s.tur}</span>
            </div> })}
          </div>
          <div style={{ padding: '6px 14px', fontSize: 11, color: 'var(--adm-tx3)', borderTop: '1px solid var(--adm-bdr)' }}>↑↓ seç · Enter aç · Esc kapat{yuk ? ' · kayıtlar yükleniyor…' : ''}</div>
        </div>
      </div>, document.body)}
  </>
}
