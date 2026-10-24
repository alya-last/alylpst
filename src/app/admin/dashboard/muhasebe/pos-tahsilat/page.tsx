'use client'
import { useCallback, useEffect, useMemo, useState } from 'react'
import AdminTopBar from '@/components/admin/TopBar'
import { web } from '@/lib/web-data'
import { muh } from '@/lib/muhasebe-client'
import { fmtDate, todayISO } from '@/lib/fmt'
import { posEkstre } from '@/lib/pos-ekstre'
import { Page, PageHead, Kpi, KpiGrid, Card, Badge, Money, useToast } from '@/components/admin/erp/ui'
import Yardim from '@/components/admin/erp/Yardim'
import { Plus, Check, Trash2, FileSpreadsheet, Clock, AlertTriangle, Landmark } from 'lucide-react'

const gunEkle = (d: string, n: number) => new Date(Date.parse(d) + n * 86400000).toISOString().slice(0, 10)
const bos = { musteri: '', cari_id: '', tarih: '', tutar: '', vade: '30' }

// POS (müşteri kredi kartı) tahsilatları: bankaya yatana kadar bekleyen tutar. Kasa/banka/kâr-zarara dokunmaz (bilgi amaçlı).
export default function PosTahsilatPage() {
  const toast = useToast()
  const [l, setL] = useState<any[]>([])
  const [cariler, setCariler] = useState<any[]>([])
  const [f, setF] = useState<any>({ ...bos, tarih: todayISO() })
  const [busy, setBusy] = useState(false)
  const [sekme, setSekme] = useState<'bekleyen' | 'ekstre'>('bekleyen')

  const yukle = useCallback(async () => {
    const [r, c] = await Promise.all([web.from('pos_tahsilat').select('*').order('tarih', { ascending: false }).limit(2000), muh.all('cari_hesaplar', 'id,ad,kod', (q: any) => q.eq('tip', 'musteri').order('ad')).catch(() => [])])
    if (r.error) toast.show(r.error.message, true)
    setL(r.data || []); setCariler(c || [])
  }, []) // eslint-disable-line
  useEffect(() => { yukle() }, [yukle])

  const bg = todayISO()
  const bek = useMemo(() => l.filter(x => x.durum === 'bekliyor').sort((a, b) => a.beklenen_tarih.localeCompare(b.beklenen_tarih)), [l])
  const top = (a: any[]) => a.reduce((t, x) => t + (+x.tutar || 0), 0)
  const hafta = gunEkle(bg, 7)
  const geciken = bek.filter(x => x.beklenen_tarih < bg), buHafta = bek.filter(x => x.beklenen_tarih >= bg && x.beklenen_tarih <= hafta)
  const ekstre = useMemo(() => posEkstre([...l].sort((a, b) => a.tarih.localeCompare(b.tarih))), [l])

  async function ekle(e: React.FormEvent) {
    e.preventDefault()
    const tutar = +String(f.tutar).replace(/\./g, '').replace(',', '.') || +String(f.tutar) || 0, vade = parseInt(f.vade, 10) || 30
    const cari = cariler.find(c => c.id === f.cari_id)
    const musteri = (cari?.ad || f.musteri).trim()
    if (!musteri || !f.tarih || tutar <= 0) { toast.show('Müşteri, tarih ve tutar gerekli', true); return }
    setBusy(true)
    const { error } = await web.from('pos_tahsilat').insert({ tarih: f.tarih, cari_id: cari?.id || null, musteri, tutar, ekstre_vade_gun: vade, beklenen_tarih: gunEkle(f.tarih, vade), kaynak: 'elle' })
    setBusy(false)
    if (error) return toast.show(error.message, true)
    setF({ ...bos, tarih: f.tarih }); toast.show('POS tahsilatı eklendi (bekliyor)'); yukle()
  }
  async function yatti(x: any) {
    const t = prompt(`${x.musteri} — ${(+x.tutar).toLocaleString('tr-TR', { minimumFractionDigits: 2 })} TL bankaya hangi tarihte yattı? (YYYY-AA-GG)`, bg)
    if (!t) return
    if (!/^\d{4}-\d{2}-\d{2}$/.test(t) || t < x.tarih) return toast.show('Geçerli bir tarih yaz (tahsilat tarihinden önce olamaz)', true)
    const { error } = await web.from('pos_tahsilat').update({ durum: 'yatti', yatis_tarihi: t, updated_at: new Date().toISOString() }).eq('id', x.id)
    if (error) toast.show(error.message, true); else { toast.show('Yattı olarak işaretlendi'); yukle() }
  }
  async function sil(x: any) {
    if (!confirm(`${x.musteri} — ${(+x.tutar).toLocaleString('tr-TR')} TL kaydı silinsin mi?`)) return
    const { error } = await web.from('pos_tahsilat').delete().eq('id', x.id); if (error) toast.show(error.message, true); else yukle()
  }
  const gun = (a: string, b: string) => Math.round((Date.parse(a) - Date.parse(b)) / 86400000)

  return (
    <div style={{ flex: 1, overflow: 'auto' }}>
      <AdminTopBar title="POS Tahsilatları" />
      <Page>
        <PageHead title="POS Tahsilatları" sub="Kredi kartıyla yapılan tahsilatlar: bankaya yatana kadar bekleyen tutar. Yapay zeka 'bankaya geçmeyen POS ne kadar' sorusunu buradan cevaplar."
          actions={<a className="adm-btn" style={{ textDecoration: 'none' }} href="/api/admin/pos-ekstre"><FileSpreadsheet size={14} />Excel indir (ekstre)</a>} />
        <Yardim sayfa="pos-tahsilat" />
        <KpiGrid min={200}>
          <Kpi label="Bankaya Geçmeyi Bekleyen" value={<Money v={top(bek)} />} Icon={Landmark} color="var(--adm-ac)" sub={`${bek.length} tahsilat`} />
          <Kpi label="Bu Hafta Yatması Beklenen" value={<Money v={top(buHafta)} />} Icon={Clock} color="var(--adm-blue)" sub={`${buHafta.length} tahsilat`} />
          <Kpi label="Vadesi Geçen (yatmadı)" value={<Money v={top(geciken)} />} Icon={AlertTriangle} color={geciken.length ? 'var(--adm-amber)' : 'var(--adm-green)'} sub={`${geciken.length} tahsilat`} />
        </KpiGrid>
        <div style={{ height: 14 }} />
        <Card>
          <form onSubmit={ekle} style={{ padding: 16, display: 'grid', gap: 10 }}>
            <div style={{ fontWeight: 600, fontSize: 14 }}>Yeni POS tahsilatı</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 10 }}>
              <select className="adm-inp" value={f.cari_id} onChange={e => setF((s: any) => ({ ...s, cari_id: e.target.value }))}><option value="">Müşteri (cariden seç)…</option>{cariler.map(c => <option key={c.id} value={c.id}>{c.ad}</option>)}</select>
              <input className="adm-inp" placeholder="ya da müşteri adı yaz" value={f.musteri} onChange={e => setF((s: any) => ({ ...s, musteri: e.target.value }))} disabled={!!f.cari_id} />
              <input className="adm-inp" type="date" value={f.tarih} onChange={e => setF((s: any) => ({ ...s, tarih: e.target.value }))} />
              <input className="adm-inp" placeholder="Tutar (TL)" inputMode="decimal" value={f.tutar} onChange={e => setF((s: any) => ({ ...s, tutar: e.target.value }))} />
              <input className="adm-inp" type="number" placeholder="Kaç günde yatar" value={f.vade} onChange={e => setF((s: any) => ({ ...s, vade: e.target.value }))} />
            </div>
            <div><button className="adm-btn" type="submit" disabled={busy}><Plus size={14} />Ekle</button></div>
          </form>
        </Card>
        <div style={{ height: 14 }} />
        <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
          <button className={sekme === 'bekleyen' ? 'adm-btn' : 'adm-btn-ghost'} onClick={() => setSekme('bekleyen')}>Bekleyenler ({bek.length})</button>
          <button className={sekme === 'ekstre' ? 'adm-btn' : 'adm-btn-ghost'} onClick={() => setSekme('ekstre')}>Ekstre (Borç / Alacak / Bakiye)</button>
        </div>
        {sekme === 'bekleyen' ? (
          <div style={{ display: 'grid', gap: 8 }}>
            {bek.map(x => {
              const gec = gun(bg, x.beklenen_tarih), beklemeG = gun(bg, x.tarih)
              return (
                <Card key={x.id}><div style={{ padding: 12, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', fontSize: 13 }}>
                  <div style={{ flex: '1 1 220px' }}><b>{x.musteri}</b><div style={{ color: 'var(--adm-tx3)', fontSize: 12 }}>Tahsilat {fmtDate(x.tarih)} · {beklemeG} gündür bekliyor</div></div>
                  <b><Money v={+x.tutar} /></b>
                  <div style={{ fontSize: 12.5 }}>Beklenen yatış: <b>{fmtDate(x.beklenen_tarih)}</b> {gec > 0 ? <Badge tone="amber">{gec} gün gecikti</Badge> : <Badge tone="blue">{-gec === 0 ? 'bugün' : `${-gec} gün sonra`}</Badge>}</div>
                  <button className="adm-btn-ghost" style={{ fontSize: 12 }} onClick={() => yatti(x)}><Check size={12} />Yattı</button>
                  <button className="adm-btn-ghost" style={{ fontSize: 12 }} onClick={() => sil(x)} title="Sil"><Trash2 size={12} /></button>
                </div></Card>
              )
            })}
            {!bek.length && <Card><div style={{ padding: 16, color: 'var(--adm-tx3)' }}>Bekleyen POS tahsilatı yok.</div></Card>}
          </div>
        ) : (
          <Card><div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
              <thead><tr style={{ textAlign: 'left', color: 'var(--adm-tx3)' }}>{['Tarih', 'Evrak', 'Vade', 'B/A', 'Borç', 'Alacak', 'Bakiye', 'Karşı hesap'].map(h => <th key={h} style={{ padding: '8px 10px' }}>{h}</th>)}</tr></thead>
              <tbody>{ekstre.satirlar.map((s, i) => (
                <tr key={i} style={{ borderTop: '1px solid var(--adm-bd)', background: s.durum === 'Bekliyor' ? 'rgba(245,180,0,.08)' : undefined }}>
                  <td style={{ padding: '6px 10px', whiteSpace: 'nowrap' }}>{fmtDate(s.tarih)}</td><td style={{ padding: '6px 10px' }}>{s.evrak}</td><td style={{ padding: '6px 10px' }}>{s.vade_gun ?? ''}</td><td style={{ padding: '6px 10px' }}>{s.ba}</td>
                  <td style={{ padding: '6px 10px', textAlign: 'right' }}>{s.borc ? <Money v={s.borc} /> : ''}</td><td style={{ padding: '6px 10px', textAlign: 'right' }}>{s.alacak ? <Money v={s.alacak} /> : ''}</td><td style={{ padding: '6px 10px', textAlign: 'right' }}><Money v={s.bakiye} /></td><td style={{ padding: '6px 10px' }}>{s.karsi}</td>
                </tr>))}
                <tr style={{ borderTop: '2px solid var(--adm-bd)', fontWeight: 700 }}><td style={{ padding: '8px 10px' }} colSpan={4}>TOPLAM</td><td style={{ padding: '8px 10px', textAlign: 'right' }}><Money v={ekstre.borc} /></td><td style={{ padding: '8px 10px', textAlign: 'right' }}><Money v={ekstre.alacak} /></td><td style={{ padding: '8px 10px', textAlign: 'right' }}><Money v={ekstre.bakiye} /></td><td style={{ padding: '8px 10px' }}>Bankaya geçmeyi bekleyen</td></tr>
              </tbody>
            </table>
          </div></Card>
        )}
      </Page>
      {toast.node}
    </div>
  )
}
