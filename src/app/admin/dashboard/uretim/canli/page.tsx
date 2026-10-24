'use client'
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import AdminTopBar from '@/components/admin/TopBar'
import { erp } from '@/lib/erp-client'
import { fmtN, fmtInt, todayISO } from '@/lib/fmt'
import { useUretim, byId, MAKINE_DURUM, yuzde, fireOrani, emirIhtiyac, varyantEtiket } from '@/lib/uretim-utils'
import { sum } from '@/lib/muh-utils'
import { Page, PageHead, Kpi, KpiGrid, Card, Badge, Empty, useToast } from '@/components/admin/erp/ui'
import { TrendChart } from '@/components/admin/erp/charts'
import { Activity, Send, Pause, CheckCircle2, Cog, AlertTriangle, Factory, Gauge, Timer, Flame, ExternalLink } from 'lucide-react'

const saat = (t: string) => new Date(t).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })

export default function CanliUretimPage() {
  const toast = useToast()
  const { d, loading, reload } = useUretim(['emirler', 'products', 'variants', 'makineler', 'kaliplar', 'hareketler', 'receteler', 'receteKalemleri', 'hammaddeler'], 10000)
  const [formlar, setFormlar] = useState<Record<string, { u: string; f: string; c: string; n: string; v: string }>>({})
  const [busy, setBusy] = useState('')
  const [now, setNow] = useState(() => new Date())
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(t) }, [])

  const urun = useMemo(() => byId(d.products), [d.products])
  const makine = useMemo(() => byId(d.makineler), [d.makineler])
  const kalip = useMemo(() => byId(d.kaliplar), [d.kaliplar])
  const recete = useMemo(() => byId(d.receteler), [d.receteler])
  const emirNo = useMemo(() => byId(d.emirler), [d.emirler])
  const aktif = d.emirler.filter((e: any) => e.durum === 'uretimde')

  const bugun = todayISO()
  const bh = d.hareketler.filter((h: any) => (h.tarih || '').startsWith(bugun))
  const bUretim = sum(bh, (h: any) => h.uretilen_adet), bFire = sum(bh, (h: any) => h.fire_adet)
  const saatlik = useMemo(() => Array.from({ length: 24 }, (_, s) => sum(bh.filter((h: any) => new Date(h.tarih).getHours() === s), (h: any) => h.uretilen_adet)), [bh])
  const ilk = Math.max(0, Math.min(saatlik.findIndex(x => x > 0), new Date().getHours() - 8 < 0 ? 0 : new Date().getHours() - 8)), son = Math.max(new Date().getHours(), ilk + 5)
  const calisan = d.makineler.filter((m: any) => m.durum === 'uretimde').length
  const sorunlu = d.makineler.filter((m: any) => ['arizali', 'bakimda'].includes(m.durum))

  const F = (id: string) => formlar[id] || { u: '', f: '0', c: '', n: '', v: '' }
  const setF = (id: string, p: any) => setFormlar(x => ({ ...x, [id]: { ...F(id), ...p } }))

  async function gonder(e: any) {
    const f = F(e.id), u = +f.u || 0, fr = +f.f || 0
    if (u <= 0 && fr <= 0) return
    if (+e.uretilen_miktar + u > +e.planlanan_miktar && !confirm(`Toplam ${fmtInt(+e.uretilen_miktar + u)} adet olacak; planlanan ${fmtInt(e.planlanan_miktar)} adedi aşıyor. Devam?`)) return
    setBusy(e.id)
    const r: any = await erp.from('uretim_hareketleri').insert({ uretim_emri_id: e.id, uretilen_adet: u, fire_adet: fr, cevrim_suresi: f.c ? +f.c : null, fire_nedeni: f.n || null, variant_id: f.v || null, vardiya: e.vardiya || null })
    setBusy('')
    if (r?.error) return toast.show(r.error, true)
    setF(e.id, { u: '', f: '0', c: '', n: '' }); toast.show(`${e.no}: +${fmtInt(u)} adet${fr ? `, ${fmtInt(fr)} fire` : ''}`); reload()
  }

  async function durdur(e: any, yeni: 'durduruldu' | 'tamamlandi') {
    if (yeni === 'tamamlandi' && +e.uretilen_miktar < +e.planlanan_miktar * 0.95 && !confirm(`Planlanan ${fmtInt(e.planlanan_miktar)} adedin altında (${fmtInt(e.uretilen_miktar)}). Yine de tamamlansın mı?`)) return
    setBusy(e.id)
    await erp.from('uretim_emirleri').update({ durum: yeni, ...(yeni === 'tamamlandi' ? { bitis: new Date().toISOString() } : {}) }).eq('id', e.id)
    if (e.makine_id) await erp.from('makineler').update({ durum: 'musait', mevcut_uretim_emri_id: null, mevcut_kalip_id: null }).eq('id', e.makine_id)
    if (e.kalip_id && !d.emirler.some((x: any) => x.id !== e.id && x.kalip_id === e.kalip_id && x.durum === 'uretimde')) await erp.from('kaliplar').update({ durum: 'hazir' }).eq('id', e.kalip_id)
    setBusy(''); toast.show(`${e.no}: ${yeni === 'tamamlandi' ? 'tamamlandı' : 'durduruldu'}`); reload()
  }

  return (
    <div style={{ flex: 1, overflow: 'auto' }}>
      <AdminTopBar title="Canlı Üretim" />
      <Page>
        <PageHead title="Üretim Hattı — Canlı"
          sub={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><span style={{ width: 8, height: 8, borderRadius: 4, background: 'var(--adm-green)', animation: 'admPulse 1.6s infinite' }} />10 sn’de bir yenilenir · {now.toLocaleTimeString('tr-TR')}</span> as any}
          actions={<Link href="/admin/dashboard/uretim/emirler" className="adm-btn-ghost" style={{ textDecoration: 'none' }}><ExternalLink size={13} />Tüm emirler</Link>} />

        <KpiGrid min={170}>
          <Kpi label="Hatta Çalışan Emir" value={aktif.length} Icon={Activity} color="var(--adm-blue)" sub={`${calisan}/${d.makineler.length} makine çalışıyor`} />
          <Kpi label="Bugün Üretim" value={fmtInt(bUretim)} Icon={Factory} color="var(--adm-green)" sub={`${bh.length} kayıt`} />
          <Kpi label="Bugün Fire" value={`%${fmtN(fireOrani(bUretim, bFire), 1)}`} Icon={Flame} color={fireOrani(bUretim, bFire) > 5 ? 'var(--adm-red)' : 'var(--adm-amber)'} sub={`${fmtInt(bFire)} adet`} />
          <Kpi label="Arıza / Bakım" value={sorunlu.length} Icon={AlertTriangle} color={sorunlu.length ? 'var(--adm-red)' : 'var(--adm-green)'} sub={sorunlu.length ? sorunlu.map((m: any) => m.ad).join(', ') : 'Tüm makineler sağlam'} />
        </KpiGrid>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,420px),1fr))', gap: 16, marginBottom: 16 }}>
          <Card title="Bugünkü Saatlik Üretim" pad={16}><TrendChart type="bar" height={180} labels={Array.from({ length: son - ilk + 1 }, (_, i) => `${String(ilk + i).padStart(2, '0')}:00`)} series={[{ name: 'Üretilen adet', color: '#2f7dd6', data: saatlik.slice(ilk, son + 1) }]} format={n => fmtInt(n)} /></Card>
          <Card title={<><Cog size={14} />Makine Durumu</>} pad={14}>
            {d.makineler.length === 0 ? <Empty title="Makine tanımlı değil" /> : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(130px,1fr))', gap: 8 }}>
                {d.makineler.map((m: any) => { const s = MAKINE_DURUM[m.durum] || MAKINE_DURUM.musait; const e = aktif.find((x: any) => x.makine_id === m.id); return (
                  <div key={m.id} style={{ padding: 10, borderRadius: 10, background: s.color + '14', border: `1px solid ${s.color}40` }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 700 }}><Cog size={13} style={{ color: s.color, animation: m.durum === 'uretimde' ? 'admSpin 6s linear infinite' : undefined }} />{m.ad}</div>
                    <div style={{ fontSize: 11, color: s.color, fontWeight: 600, marginTop: 2 }}>{s.l}</div>
                    {e && <div style={{ fontSize: 10.5, color: 'var(--adm-tx3)', marginTop: 2 }}>{e.no} · %{fmtN(yuzde(+e.uretilen_miktar, +e.planlanan_miktar), 0)}</div>}
                  </div>) })}
              </div>)}
          </Card>
        </div>

        {loading ? null : aktif.length === 0 ? (
          <div className="adm-card"><Empty icon={<Activity size={34} />} title="Şu anda hatta çalışan emir yok" sub="Üretim Emirleri sayfasından bir emri başlat." action={<Link href="/admin/dashboard/uretim/emirler" className="adm-btn" style={{ textDecoration: 'none' }}>Üretim emirlerine git</Link>} /></div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(360px,1fr))', gap: 16 }}>
            {aktif.map((e: any) => {
              const y = yuzde(+e.uretilen_miktar, +e.planlanan_miktar), m = makine[e.makine_id], f = F(e.id)
              const sure = e.baslangic ? (Date.now() - +new Date(e.baslangic)) / 3600000 : 0, hiz = sure > 0.02 ? +e.uretilen_miktar / sure : 0
              const kalanSaat = hiz > 0 ? Math.max(+e.planlanan_miktar - +e.uretilen_miktar, 0) / hiz : null
              const bitisTahmin = kalanSaat != null ? new Date(Date.now() + kalanSaat * 3600000) : null
              const rec = e.recete_id ? recete[e.recete_id] : null
              const hedefFire = +rec?.hedef_fire_orani || 0, gFire = fireOrani(+e.uretilen_miktar, +e.fire_miktar)
              const eksik = e.recete_id ? emirIhtiyac(e, d.receteKalemleri, d.hammaddeler).filter(x => x.gerekli > x.stok) : []
              const varyantlar = d.variants.filter((v: any) => v.product_id === e.urun_id)
              const r = 44, c = 2 * Math.PI * r
              return (
                <div key={e.id} className="adm-card" style={{ borderTop: '3px solid var(--adm-blue)' }}>
                  <div style={{ padding: '14px 16px', display: 'flex', gap: 14, alignItems: 'center' }}>
                    <div style={{ position: 'relative', width: 100, height: 100, flexShrink: 0 }}>
                      <svg width="100" height="100" style={{ transform: 'rotate(-90deg)' }}><circle cx="50" cy="50" r={r} fill="none" stroke="var(--adm-s2)" strokeWidth="9" /><circle cx="50" cy="50" r={r} fill="none" stroke={y >= 100 ? 'var(--adm-green)' : 'var(--adm-blue)'} strokeWidth="9" strokeLinecap="round" strokeDasharray={`${(y / 100) * c} ${c}`} style={{ transition: 'stroke-dasharray .6s' }} /></svg>
                      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}><b style={{ fontSize: 20, fontFamily: 'JetBrains Mono,monospace' }}>{fmtN(y, 0)}%</b><span style={{ fontSize: 9.5, color: 'var(--adm-tx3)' }}>tamamlandı</span></div>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><b style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: 13 }}>{e.no}</b>{m && <Badge tone="blue"><Cog size={10} style={{ marginRight: 3 }} />{m.ad}</Badge>}</div>
                      <div style={{ fontSize: 14, fontWeight: 700, margin: '3px 0' }}>{urun[e.urun_id]?.name}</div>
                      <div style={{ fontSize: 12, color: 'var(--adm-tx3)' }}>{fmtInt(e.uretilen_miktar)} / {fmtInt(e.planlanan_miktar)} adet{e.kalip_id ? ` · ${kalip[e.kalip_id]?.ad}` : ''}</div>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 6, padding: '0 16px 12px' }}>
                    {[['Hız', hiz ? `${fmtN(hiz, 0)}/sa` : '—'], ['Bitiş', bitisTahmin ? saat(bitisTahmin.toISOString()) : '—'], ['Çevrim', e.gercek_cevrim ? `${e.gercek_cevrim}${e.hedef_cevrim ? `/${e.hedef_cevrim}` : ''}sn` : e.hedef_cevrim ? `—/${e.hedef_cevrim}sn` : '—'], ['Fire', `%${fmtN(gFire, 1)}`]].map(([k, v]: any, i) => (
                      <div key={k} style={{ padding: '7px 8px', borderRadius: 8, background: i === 3 && hedefFire && gFire > hedefFire ? 'var(--adm-red2)' : 'var(--adm-s2)' }}><div style={{ fontSize: 9.5, color: 'var(--adm-tx3)', fontWeight: 700, textTransform: 'uppercase' }}>{k}</div><b style={{ fontSize: 12.5, fontFamily: 'JetBrains Mono,monospace', color: i === 3 && hedefFire && gFire > hedefFire ? 'var(--adm-red)' : undefined }}>{v}</b></div>))}
                  </div>
                  {(eksik.length > 0 || (hedefFire > 0 && gFire > hedefFire * 1.5)) && (
                    <div style={{ margin: '0 16px 12px', padding: '8px 10px', borderRadius: 8, background: 'var(--adm-amber2)', fontSize: 11.5, color: 'var(--adm-amber)', display: 'flex', gap: 6 }}><AlertTriangle size={13} style={{ flexShrink: 0, marginTop: 1 }} /><span>{eksik.length > 0 && `Hammadde yetersiz: ${eksik.map(x => x.ad).join(', ')}. `}{hedefFire > 0 && gFire > hedefFire * 1.5 && `Fire hedefin (%${hedefFire}) üstünde.`}</span></div>)}

                  <div style={{ padding: '12px 16px 16px', borderTop: '1px solid var(--adm-bdr)' }}>
                    {varyantlar.length > 1 && <select className="adm-inp" style={{ marginBottom: 8, fontSize: 12.5 }} value={f.v} onChange={ev => setF(e.id, { v: ev.target.value })}><option value="">İlk varyant (varsayılan)</option>{varyantlar.map((v: any) => <option key={v.id} value={v.id}>{varyantEtiket(v, urun)}</option>)}</select>}
                    {varyantlar.length === 0 && <div style={{ fontSize: 11.5, color: 'var(--adm-red)', marginBottom: 8 }}>⚠ Ürünün stok varyantı yok — üretim stoğa işlenmez.</div>}
                    <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr', gap: 8, marginBottom: 8 }}>
                      <div><label className="adm-label" style={{ fontSize: 10.5 }}>Üretilen adet</label><input type="number" min="0" className="adm-inp" style={{ fontSize: 18, fontWeight: 700, textAlign: 'center' }} value={f.u} onChange={ev => setF(e.id, { u: ev.target.value })} onKeyDown={ev => ev.key === 'Enter' && gonder(e)} /></div>
                      <div><label className="adm-label" style={{ fontSize: 10.5 }}>Fire</label><input type="number" min="0" className="adm-inp" style={{ fontSize: 18, fontWeight: 700, textAlign: 'center' }} value={f.f} onChange={ev => setF(e.id, { f: ev.target.value })} /></div>
                      <div><label className="adm-label" style={{ fontSize: 10.5 }}>Çevrim sn</label><input type="number" step="0.1" className="adm-inp" style={{ fontSize: 18, textAlign: 'center' }} value={f.c} onChange={ev => setF(e.id, { c: ev.target.value })} /></div>
                    </div>
                    <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>{[10, 50, 100, 500].map(n => <button key={n} className="adm-btn-ghost" style={{ fontSize: 12, padding: '4px 10px' }} onClick={() => setF(e.id, { u: String((+f.u || 0) + n) })}>+{n}</button>)}
                      {+f.f > 0 && <input className="adm-inp" list="cf-nedenler" placeholder="Fire nedeni" style={{ flex: 1, minWidth: 120, fontSize: 12.5, padding: '4px 9px' }} value={f.n} onChange={ev => setF(e.id, { n: ev.target.value })} />}</div>
                    <datalist id="cf-nedenler">{['Kısa atım', 'Çapak', 'Yanık / siyah nokta', 'Renk hatası', 'Çarpılma', 'Boyut hatası', 'Ayar / başlangıç firesi'].map(n => <option key={n} value={n} />)}</datalist>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button className="adm-btn" style={{ flex: 1, justifyContent: 'center', padding: '10px 0' }} disabled={busy === e.id} onClick={() => gonder(e)}><Send size={14} />Kaydet</button>
                      <button className="adm-btn-ghost" title="Duraklat" disabled={busy === e.id} onClick={() => durdur(e, 'durduruldu')}><Pause size={14} /></button>
                      <button className="adm-btn-ghost" title="Emri tamamla" style={{ color: 'var(--adm-green)' }} disabled={busy === e.id} onClick={() => durdur(e, 'tamamlandi')}><CheckCircle2 size={14} /></button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        <div style={{ marginTop: 16 }}>
          <Card title={<><Timer size={14} />Son Üretim Hareketleri</>} right={<span style={{ fontSize: 11.5, color: 'var(--adm-tx3)' }}>son 30</span>}>
            {d.hareketler.length === 0 ? <Empty icon={<Gauge size={28} />} title="Hareket yok" /> : d.hareketler.slice(0, 30).map((h: any) => {
              const em = emirNo[h.uretim_emri_id]
              return (
                <div key={h.id} className="adm-row" style={{ padding: '9px 16px' }}>
                  <span style={{ fontSize: 11.5, color: 'var(--adm-tx3)', fontFamily: 'JetBrains Mono,monospace', width: 44 }}>{saat(h.tarih)}</span>
                  <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 12.5, fontWeight: 600 }}>{em?.no || '—'} <span style={{ fontWeight: 400, color: 'var(--adm-tx3)' }}>· {urun[em?.urun_id]?.name} · {makine[em?.makine_id]?.ad || ''}</span></div>{h.fire_nedeni && <div style={{ fontSize: 11, color: 'var(--adm-tx3)' }}>{h.fire_nedeni}</div>}</div>
                  <b style={{ color: 'var(--adm-green)', fontFamily: 'JetBrains Mono,monospace', fontSize: 13 }}>+{fmtInt(h.uretilen_adet)}</b>
                  {+h.fire_adet > 0 && <b style={{ color: 'var(--adm-red)', fontFamily: 'JetBrains Mono,monospace', fontSize: 12 }}>fire {fmtInt(h.fire_adet)}</b>}
                </div>)
            })}
          </Card>
        </div>
      </Page>
      {toast.node}
    </div>
  )
}
