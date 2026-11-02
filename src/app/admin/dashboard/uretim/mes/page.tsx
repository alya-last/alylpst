'use client'
import { useEffect, useMemo, useState } from 'react'
import AdminTopBar from '@/components/admin/TopBar'
import { erp } from '@/lib/erp-client'
import { fmtN, fmtInt, fmtDate, fmtDateTime } from '@/lib/fmt'
import { Page, PageHead, Kpi, KpiGrid, Card, Tabs, Empty } from '@/components/admin/erp/ui'
import { Cog, Gauge, Timer, Factory, AlertTriangle, Weight } from 'lucide-react'

// Fabrika makine takip sistemi (MES) verisi — salt-okunur kopya (her 3 dk'da senkron). Panelden yazılmaz.
const th: React.CSSProperties = { textAlign: 'left', padding: '8px 12px', fontSize: 11.5, color: 'var(--adm-tx3)', fontWeight: 600, borderBottom: '1px solid var(--adm-bd)' }
const thR: React.CSSProperties = { ...th, textAlign: 'right' }
const td: React.CSSProperties = { padding: '8px 12px', fontSize: 12.5, borderBottom: '1px solid var(--adm-bd)' }
const tdR: React.CSSProperties = { ...td, textAlign: 'right', fontFamily: 'JetBrains Mono,monospace' }
const gunFarki = (iso: string) => Math.floor((Date.now() - +new Date(iso + 'T12:00:00')) / 86400000)

export default function MesPage() {
  const [yuk, setYuk] = useState(true)
  const [hata, setHata] = useState('')
  const [mk, setMk] = useState<any[]>([])
  const [ur, setUr] = useState<any[]>([])
  const [gn, setGn] = useState<any[]>([])
  const [dr, setDr] = useState<any[]>([])
  const [em, setEm] = useState<any[]>([])
  const [sk, setSk] = useState<any>(null)
  const [donem, setDonem] = useState('tum')
  const [tab, setTab] = useState('makine')

  useEffect(() => {
    let iptal = false
    ;(async () => {
      try {
        const [a, b, c, d, e, f] = await Promise.all([
          erp.all('mes_makine'), erp.all('mes_urun'), erp.all('mes_uretim_gunluk'), erp.all('mes_durum_gunluk'),
          erp.all('mes_is_emri_satir'), erp.all('mes_senkron', '*', (q: any) => q.eq('basarili', true).order('calisma_zamani', { ascending: false }).limit(1)),
        ])
        if (iptal) return
        setMk(a); setUr(b); setGn(c); setDr(d); setEm(e); setSk(f[0] || null)
      } catch (x: any) { if (!iptal) setHata(String(x?.message || x)) } finally { if (!iptal) setYuk(false) }
    })()
    return () => { iptal = true }
  }, [])

  const mkAd = useMemo(() => Object.fromEntries(mk.map(m => [m.id, m.ad])), [mk])
  const urBy = useMemo(() => Object.fromEntries(ur.map(u => [u.id, u])), [ur])
  const aylar = useMemo(() => [...new Set(gn.map(g => String(g.tarih).slice(0, 7)))].sort().reverse(), [gn])
  const uyar = useMemo(() => {
    const uretimli = gn.filter(g => +g.uretim_adedi > 0).map(g => String(g.tarih))
    const son = uretimli.sort().pop() || null
    return { son, gun: son ? gunFarki(son) : null }
  }, [gn])

  const inDonem = (t: string) => donem === 'tum' || String(t).startsWith(donem)
  const G = useMemo(() => gn.filter(g => inDonem(g.tarih)), [gn, donem]) // eslint-disable-line react-hooks/exhaustive-deps
  const D = useMemo(() => dr.filter(g => inDonem(g.tarih)), [dr, donem]) // eslint-disable-line react-hooks/exhaustive-deps

  const toplam = G.reduce((s, g) => s + (+g.uretim_adedi || 0), 0)
  const calSn = D.reduce((s, g) => s + (+g.calisma_sn || 0), 0), durSn = D.reduce((s, g) => s + (+g.durus_sn || 0), 0)
  const kg = G.reduce((s, g) => s + ((+g.uretim_adedi || 0) * (+urBy[g.urun_id]?.agirlik_g || 0)) / 1000, 0)

  const makineSatir = useMemo(() => {
    const o: Record<string, any> = {}
    G.forEach(g => { const k = g.makine_id; (o[k] ||= { id: k, uretim: 0, cal: 0, dur: 0 }).uretim += +g.uretim_adedi || 0 })
    D.forEach(g => { const k = g.makine_id; const x = (o[k] ||= { id: k, uretim: 0, cal: 0, dur: 0 }); x.cal += +g.calisma_sn || 0; x.dur += +g.durus_sn || 0 })
    return Object.values(o).filter(x => x.uretim || x.cal || x.dur).sort((a, b) => b.uretim - a.uretim)
  }, [G, D])

  const urunSatir = useMemo(() => {
    const o: Record<string, any> = {}
    G.forEach(g => { if (!+g.uretim_adedi) return; const x = (o[g.urun_id] ||= { id: g.urun_id, uretim: 0 }); x.uretim += +g.uretim_adedi })
    return Object.values(o).sort((a, b) => b.uretim - a.uretim).slice(0, 40)
  }, [G])

  const emirSatir = useMemo(() => {
    const o: Record<string, any> = {}
    em.forEach(r => {
      const x = (o[r.is_emri_no] ||= { no: r.is_emri_no, satir: 0, makine: r.makine_id, urun: r.urun_id, hedef: 0, uretilen: 0, bas: null as string | null, bit: null as string | null, acik: false, panel: null as string | null })
      x.satir++; x.hedef = Math.max(x.hedef, +r.hedef_adet || 0); x.uretilen = Math.max(x.uretilen, +r.uretilen_adet || 0)
      if (r.baslangic && (!x.bas || r.baslangic < x.bas)) x.bas = r.baslangic
      if (!r.bitis) x.acik = true; else if (!x.bit || r.bitis > x.bit) x.bit = r.bitis
      if (r.panel_emir_no) x.panel = r.panel_emir_no
    })
    return Object.values(o).filter(x => inDonem(x.bas || '')).sort((a, b) => String(b.bas || '').localeCompare(String(a.bas || '')))
  }, [em, donem]) // eslint-disable-line react-hooks/exhaustive-deps

  const yuzde = calSn + durSn ? (calSn / (calSn + durSn)) * 100 : 0

  return (
    <div>
      <AdminTopBar title="Makine Verisi (MES)" />
      <Page>
        <PageHead title="Makine Takip Sistemi Verisi" sub="Fabrikadaki makine sayaçlarından gelen üretim ve çalışma verisi — yalnızca okunur, her 3 dakikada güncellenir"
          actions={
            <select value={donem} onChange={e => setDonem(e.target.value)} className="adm-input" style={{ minWidth: 150 }}>
              <option value="tum">Tüm dönem</option>
              {aylar.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          } />

        {uyar.son && (uyar.gun ?? 0) > 3 && (
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '12px 14px', borderRadius: 10, marginBottom: 16, background: 'color-mix(in srgb, var(--adm-red) 10%, transparent)', border: '1px solid var(--adm-red)' }}>
            <AlertTriangle size={18} style={{ color: 'var(--adm-red)', flexShrink: 0, marginTop: 1 }} />
            <div style={{ fontSize: 12.5, lineHeight: 1.5 }}>
              <b>Makine sistemi verisi güncel değil.</b> Son üretim sinyali <b>{fmtDate(uyar.son)}</b> ({uyar.gun} gün önce). Sayaçtan veri gelmiyor ya da iş emri açılmıyor olabilir.
              Aşağıdaki rakamlar gerçek üretimi göstermez; fabrikadaki sistem düzelene kadar karar için kullanmayın. Fire bu sistemde girilmediği için her zaman 0 görünür.
            </div>
          </div>
        )}
        <div style={{ fontSize: 11.5, color: 'var(--adm-tx3)', marginBottom: 14 }}>
          Son başarılı senkron: {sk ? fmtDateTime(sk.calisma_zamani) : 'henüz yok'}
        </div>

        {hata ? <Empty icon={<AlertTriangle size={28} />} title="Veri okunamadı" sub={hata} /> : yuk ? <Empty icon={<Gauge size={28} />} title="Yükleniyor…" /> : (
          <>
            <KpiGrid>
              <Kpi label="Üretim (adet)" value={fmtInt(toplam)} sub="sayaç tabanlı" Icon={Factory} color="var(--adm-green)" />
              <Kpi label="Üretim (kg)" value={fmtInt(kg)} sub="adet × ürün gramajı" Icon={Weight} />
              <Kpi label="Çalışma süresi" value={`${fmtInt(calSn / 3600)} sa`} sub={`duruş ${fmtInt(durSn / 3600)} sa`} Icon={Timer} />
              <Kpi label="Çalışma oranı" value={`%${fmtN(yuzde, 1)}`} sub="çalışma / (çalışma + duruş)" Icon={Gauge} color="var(--adm-blue)" />
              <Kpi label="İş emri" value={fmtInt(emirSatir.length)} sub="farklı emir numarası" Icon={Cog} />
            </KpiGrid>

            <Tabs style={{ margin: '16px 0 12px' }} value={tab} onChange={setTab}
              tabs={[{ v: 'makine', l: 'Makineler', n: makineSatir.length }, { v: 'urun', l: 'Ürünler (ilk 40)', n: urunSatir.length }, { v: 'emir', l: 'İş emirleri', n: emirSatir.length }]} />

            {tab === 'makine' && (
              <Card pad={0}>
                {makineSatir.length === 0 ? <Empty icon={<Cog size={28} />} title="Bu dönemde kayıt yok" /> : (
                  <div style={{ overflowX: 'auto' }}><table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead><tr><th style={th}>Makine</th><th style={thR}>Üretim (adet)</th><th style={thR}>Çalışma (sa)</th><th style={thR}>Duruş (sa)</th><th style={thR}>Çalışma %</th></tr></thead>
                    <tbody>{makineSatir.map(m => (
                      <tr key={m.id}><td style={td}>{mkAd[m.id] || `#${m.id}`}</td><td style={tdR}>{fmtInt(m.uretim)}</td><td style={tdR}>{fmtN(m.cal / 3600, 1)}</td><td style={tdR}>{fmtN(m.dur / 3600, 1)}</td><td style={tdR}>{m.cal + m.dur ? fmtN((m.cal / (m.cal + m.dur)) * 100, 1) : '-'}</td></tr>
                    ))}</tbody>
                  </table></div>
                )}
              </Card>
            )}

            {tab === 'urun' && (
              <Card pad={0}>
                {urunSatir.length === 0 ? <Empty icon={<Cog size={28} />} title="Bu dönemde üretim yok" /> : (
                  <div style={{ overflowX: 'auto' }}><table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead><tr><th style={th}>Ürün</th><th style={thR}>Gramaj (g)</th><th style={thR}>Üretim (adet)</th><th style={thR}>Üretim (kg)</th></tr></thead>
                    <tbody>{urunSatir.map(u => { const p = urBy[u.id]; return (
                      <tr key={u.id}><td style={td}>{p?.ad || `#${u.id}`}<div style={{ fontSize: 11, color: 'var(--adm-tx3)' }}>{p?.kod}</div></td><td style={tdR}>{p?.agirlik_g ? fmtN(+p.agirlik_g, 1) : '-'}</td><td style={tdR}>{fmtInt(u.uretim)}</td><td style={tdR}>{p?.agirlik_g ? fmtInt((u.uretim * +p.agirlik_g) / 1000) : '-'}</td></tr>
                    ) })}</tbody>
                  </table></div>
                )}
              </Card>
            )}

            {tab === 'emir' && (
              <Card pad={0}>
                {emirSatir.length === 0 ? <Empty icon={<Cog size={28} />} title="Bu dönemde iş emri yok" /> : (
                  <>
                    <div style={{ padding: '10px 14px', fontSize: 11.5, color: 'var(--adm-tx3)' }}>Aynı emir numarası birden çok kayıt satırı içerebilir; hedef ve üretilen için en yüksek değer gösterilir (yaklaşık). “Açık” durumu da sistemde kapatılmamış satır varsa görünür, gerçek durumu yansıtmayabilir.</div>
                    <div style={{ overflowX: 'auto' }}><table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead><tr><th style={th}>Emir no</th><th style={th}>Makine</th><th style={th}>Ürün</th><th style={thR}>Hedef</th><th style={thR}>Üretilen</th><th style={th}>Başlangıç</th><th style={th}>Panel emri</th></tr></thead>
                      <tbody>{emirSatir.slice(0, 300).map(e => (
                        <tr key={e.no}><td style={td}>{e.no}{e.acik ? ' · açık' : ''}</td><td style={td}>{mkAd[e.makine] || '-'}</td><td style={td}>{urBy[e.urun]?.ad || '-'}</td><td style={tdR}>{fmtInt(e.hedef)}</td><td style={tdR}>{fmtInt(e.uretilen)}</td><td style={td}>{fmtDate(e.bas)}</td><td style={td}>{e.panel || '-'}</td></tr>
                      ))}</tbody>
                    </table></div>
                  </>
                )}
              </Card>
            )}
          </>
        )}
      </Page>
    </div>
  )
}
