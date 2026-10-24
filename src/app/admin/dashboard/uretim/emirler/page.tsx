'use client'
import { useAcParam } from '@/lib/ac-param'
import { useMemo, useState } from 'react'
import Link from 'next/link'
import AdminTopBar from '@/components/admin/TopBar'
import { erp } from '@/lib/erp-client'
import { muh } from '@/lib/muhasebe-client'
import { fmt, fmtK, fmtN, fmtInt, fmtDate, fmtDateTime, todayISO, daysBetween } from '@/lib/fmt'
import { useUretim, byId, EMIR_DURUM, MAKINE_DURUM, yuzde, fireOrani, receteMaliyet, emirIhtiyac } from '@/lib/uretim-utils'
import { sum } from '@/lib/muh-utils'
import { Page, PageHead, Kpi, KpiGrid, Badge, Tabs, Drawer, Modal, Field, FormGrid, InfoRow, Divider, Empty, useToast } from '@/components/admin/erp/ui'
import { DataGrid, type Col } from '@/components/admin/erp/DataGrid'
import TopluDuzenle from '@/components/admin/TopluDuzenle'
import { ListChecks, Plus, Factory, Play, Pause, CheckCircle2, Ban, Undo2, Activity, AlertTriangle, PackageSearch, Timer, TrendingUp, ShieldCheck, Send, Layers, FlaskConical, ShoppingCart } from 'lucide-react'

const VARDIYA = ['Gündüz', 'Akşam', 'Gece']
const bos = () => ({ no: '', urun_id: '', siparis_id: '', recete_id: '', planlanan_miktar: '', makine_id: '', kalip_id: '', vardiya: 'Gündüz', hedef_cevrim: '', notlar: '' })
const girisBos = { uretilen: '', fire: '0', cevrim: '', neden: '', variant: '' }

export default function UretimEmirleriPage() {
  const toast = useToast()
  const { d, loading, reload } = useUretim(['emirler', 'products', 'variants', 'hammaddeler', 'makineler', 'kaliplar', 'receteler', 'receteKalemleri', 'siparisler', 'siparisKalemleri', 'hareketler', 'kalite', 'cariler'])
  const [tab, setTab] = useState('acik')
  const [detay, setDetay] = useState<any>(null)
  const [dTab, setDTab] = useState('ozet')
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState<any>(bos())
  const [mrp, setMrp] = useState(false)
  const [giris, setGiris] = useState<any>(girisBos)
  const [busy, setBusy] = useState(false)
  const [toplu, setToplu] = useState<any[] | null>(null)

  const urun = useMemo(() => byId(d.products), [d.products])
  const makine = useMemo(() => byId(d.makineler), [d.makineler])
  const kalip = useMemo(() => byId(d.kaliplar), [d.kaliplar])
  const siparis = useMemo(() => byId(d.siparisler), [d.siparisler])
  const recete = useMemo(() => byId(d.receteler), [d.receteler])
  const cari = useMemo(() => byId(d.cariler), [d.cariler])
  const canliDetay = detay ? d.emirler.find((e: any) => e.id === detay.id) || detay : null

  const urunHazirlik = (uid: string) => ({
    varyantlar: d.variants.filter((v: any) => v.product_id === uid),
    recete: d.receteler.find((r: any) => r.urun_id === uid && r.aktif) || null,
  })
  const termin = (e: any) => siparis[e.siparis_id]?.teslim_tarihi || null
  const acikMi = (e: any) => ['planlandi', 'uretimde', 'durduruldu'].includes(e.durum)
  const gec = (e: any) => acikMi(e) && termin(e) && termin(e) < todayISO()

  const cnt = (f: (e: any) => boolean) => d.emirler.filter(f).length
  const ay = todayISO().slice(0, 7)
  const ayHareket = d.hareketler.filter((h: any) => (h.tarih || '').startsWith(ay))
  const ayUretim = sum(ayHareket, (h: any) => h.uretilen_adet), ayFire = sum(ayHareket, (h: any) => h.fire_adet)
  const liste = d.emirler.filter((e: any) => tab === 'hepsi' ? true : tab === 'acik' ? acikMi(e) : tab === 'geciken' ? gec(e) : e.durum === tab)

  /* ── Hammadde ihtiyacı (MRP) ── */
  const ihtiyac = useMemo(() => {
    const m: Record<string, { gerekli: number; emirler: string[] }> = {}
    d.emirler.filter((e: any) => ['planlandi', 'uretimde'].includes(e.durum) && e.recete_id).forEach((e: any) => {
      const fire = 1 + (+recete[e.recete_id]?.hedef_fire_orani || 0) / 100
      emirIhtiyac(e, d.receteKalemleri, d.hammaddeler).forEach(x => { const o = (m[x.hammadde_id] ||= { gerekli: 0, emirler: [] }); o.gerekli += x.gerekli * fire; o.emirler.push(e.no) })
    })
    const hm = byId(d.hammaddeler)
    return Object.entries(m).map(([id, v]) => { const h = hm[id]; return { id, ad: h?.ad, birim: h?.birim, stok: +h?.mevcut_stok || 0, gerekli: v.gerekli, eksik: Math.max(v.gerekli - (+h?.mevcut_stok || 0), 0), tedarikci: h?.tedarikci_id, maliyet: +h?.ortalama_maliyet || 0, emirler: v.emirler } }).sort((a, b) => b.eksik - a.eksik)
  }, [d, recete])
  const eksikler = ihtiyac.filter(i => i.eksik > 0)

  /* ── Yeni emir formu ── */
  const sonrakiNo = () => { const y = new Date().getFullYear(), p = `UE-${y}-`; return p + String(Math.max(0, ...d.emirler.filter((e: any) => e.no?.startsWith(p)).map((e: any) => +e.no.slice(p.length) || 0)) + 1).padStart(4, '0') }
  const openNew = () => { setForm({ ...bos(), no: sonrakiNo() }); setModal(true) }
  function urunSec(uid: string) {
    const h = urunHazirlik(uid)
    setForm((f: any) => ({ ...f, urun_id: uid, recete_id: h.recete?.id || '', kalip_id: h.recete?.kalip_id || '', hedef_cevrim: h.recete?.hedef_cevrim_suresi ? String(h.recete.hedef_cevrim_suresi) : '', siparis_id: '' }))
  }
  function siparisSec(sid: string) {
    setForm((f: any) => {
      let miktar = f.planlanan_miktar
      const vids = new Set(d.variants.filter((v: any) => v.product_id === f.urun_id).map((v: any) => v.id))
      const k = d.siparisKalemleri.filter((x: any) => x.siparis_id === sid && vids.has(x.variant_id))
      const g = sum(k, (x: any) => x.uretim_gereken_miktar)
      if (g > 0) miktar = String(g)
      return { ...f, siparis_id: sid, planlanan_miktar: miktar }
    })
  }
  const fr = form.recete_id ? recete[form.recete_id] : null
  const frMal = fr ? receteMaliyet(fr, d.receteKalemleri, d.hammaddeler) : null
  const planAdet = +form.planlanan_miktar || 0
  const fireKat = 1 + (+fr?.hedef_fire_orani || 0) / 100
  const formIhtiyac = fr ? emirIhtiyac({ recete_id: fr.id }, d.receteKalemleri, d.hammaddeler, planAdet).map(x => ({ ...x, gerekli: x.gerekli * fireKat })) : []
  const formKavite = kalip[form.kalip_id]?.kavite_sayisi || fr?.kavite_sayisi || 1
  const tahminiSaat = +form.hedef_cevrim > 0 && planAdet ? (Math.ceil((planAdet * fireKat) / formKavite) * +form.hedef_cevrim) / 3600 : 0
  const fh = form.urun_id ? urunHazirlik(form.urun_id) : null

  async function varyantOlustur(uid: string) {
    const r: any = await muh.from('product_variants').insert({ product_id: uid, name: 'Standart', stock: 0, sort_order: 0 })
    if (r?.error) return toast.show(r.error, true)
    toast.show('“Standart” stok varyantı oluşturuldu'); reload()
  }

  async function serbest(e: any) {
    // makine & kalıbı serbest bırak (başka açık emri yoksa)
    if (e.makine_id) {
      const m = makine[e.makine_id]
      const baska = d.emirler.some((x: any) => x.id !== e.id && x.makine_id === e.makine_id && x.durum === 'uretimde')
      if (m && m.durum === 'uretimde' && !baska) await erp.from('makineler').update({ durum: 'musait', mevcut_uretim_emri_id: null, mevcut_kalip_id: null }).eq('id', e.makine_id)
    }
    if (e.kalip_id) {
      const baska = d.emirler.some((x: any) => x.id !== e.id && x.kalip_id === e.kalip_id && x.durum === 'uretimde')
      if (kalip[e.kalip_id]?.durum === 'uretimde' && !baska) await erp.from('kaliplar').update({ durum: 'hazir' }).eq('id', e.kalip_id)
    }
  }

  async function durumDegis(e: any, yeni: string) {
    if (busy) return
    setBusy(true)
    try {
      if (yeni === 'uretimde') {
        if (e.makine_id) {
          const m = makine[e.makine_id]
          if (m && ['bakimda', 'arizali', 'durduruldu'].includes(m.durum)) throw new Error(`${m.ad} şu an “${MAKINE_DURUM[m.durum].l}” — başlatılamaz`)
          const cakisan = d.emirler.find((x: any) => x.id !== e.id && x.makine_id === e.makine_id && x.durum === 'uretimde')
          if (cakisan) throw new Error(`${m?.ad} makinesinde “${cakisan.no}” emri üretimde. Önce onu durdur/tamamla.`)
        }
        if (e.kalip_id && ['bakimda', 'arizali'].includes(kalip[e.kalip_id]?.durum)) throw new Error(`${kalip[e.kalip_id].ad} kalıbı ${kalip[e.kalip_id].durum === 'bakimda' ? 'bakımda' : 'arızalı'}`)
        const h = urunHazirlik(e.urun_id)
        if (!h.varyantlar.length && !confirm(`“${urun[e.urun_id]?.name}” ürününün stok varyantı yok — üretilen adetler STOĞA İŞLENMEZ.\nYine de başlatılsın mı? (Önce varyant oluşturman önerilir)`)) { setBusy(false); return }
        const eks = emirIhtiyac(e, d.receteKalemleri, d.hammaddeler).filter(x => x.gerekli > x.stok)
        if (eks.length && !confirm(`Hammadde stoğu yetersiz görünüyor:\n${eks.map(x => `• ${x.ad}: gerekli ${fmtN(x.gerekli, 1)}, stok ${fmtN(x.stok, 1)} ${x.birim}`).join('\n')}\n\nYine de başlatılsın mı?`)) { setBusy(false); return }
        const r: any = await erp.from('uretim_emirleri').update({ durum: 'uretimde', baslangic: e.baslangic || new Date().toISOString(), bitis: null }).eq('id', e.id); if (r?.error) throw new Error(r.error)
        if (e.makine_id) await erp.from('makineler').update({ durum: 'uretimde', mevcut_uretim_emri_id: e.id, mevcut_kalip_id: e.kalip_id || null }).eq('id', e.makine_id)
        if (e.kalip_id) await erp.from('kaliplar').update({ durum: 'uretimde' }).eq('id', e.kalip_id)
      } else if (yeni === 'tamamlandi') {
        if (+e.uretilen_miktar < +e.planlanan_miktar * 0.95 && !confirm(`Üretilen ${fmtInt(e.uretilen_miktar)} adet, planlanan ${fmtInt(e.planlanan_miktar)} adetin altında. Yine de tamamlansın mı?`)) { setBusy(false); return }
        const r: any = await erp.from('uretim_emirleri').update({ durum: 'tamamlandi', bitis: new Date().toISOString() }).eq('id', e.id); if (r?.error) throw new Error(r.error)
        await serbest(e)
      } else if (yeni === 'iptal') {
        if (!confirm(`${e.no} iptal edilsin mi?${+e.uretilen_miktar ? '\n\nÜretilen adetler ve hammadde tüketimi stokta kalır (geri alınmaz).' : ''}`)) { setBusy(false); return }
        const r: any = await erp.from('uretim_emirleri').update({ durum: 'iptal', bitis: new Date().toISOString() }).eq('id', e.id); if (r?.error) throw new Error(r.error)
        await serbest(e)
      } else {
        const r: any = await erp.from('uretim_emirleri').update({ durum: yeni }).eq('id', e.id); if (r?.error) throw new Error(r.error)
        await serbest(e)
      }
      toast.show(`${e.no}: ${EMIR_DURUM[yeni].l}`); await reload()
    } catch (err: any) { toast.show(err.message, true) }
    setBusy(false)
  }

  async function kaydetEmir(baslat: boolean) {
    if (busy) return
    if (!form.urun_id || !(planAdet > 0)) return toast.show('Ürün ve planlanan miktar gerekli', true)
    if (d.emirler.some((e: any) => e.no === form.no)) return toast.show('Bu emir numarası zaten var', true)
    setBusy(true)
    try {
      const r: any = await erp.from('uretim_emirleri').insert({
        no: form.no, urun_id: form.urun_id, siparis_id: form.siparis_id || null, recete_id: form.recete_id || null, planlanan_miktar: planAdet, uretilen_miktar: 0, fire_miktar: 0,
        makine_id: form.makine_id || null, kalip_id: form.kalip_id || null, vardiya: form.vardiya || null, hedef_cevrim: form.hedef_cevrim ? +form.hedef_cevrim : null, notlar: form.notlar || null, durum: 'planlandi',
      })
      if (r?.error) throw new Error(r.error)
      toast.show('Üretim emri oluşturuldu'); setModal(false)
      await reload()
      if (baslat && r.data?.[0]) await durumDegis({ ...r.data[0] }, 'uretimde')
    } catch (err: any) { toast.show(err.message, true) }
    setBusy(false)
  }

  async function uretimGir(e: any) {
    if (busy) return
    const u = +giris.uretilen || 0, f = +giris.fire || 0
    if (u <= 0 && f <= 0) return toast.show('Üretilen veya fire adedi gir', true)
    if (e.durum !== 'uretimde') return toast.show('Üretim girişi için emir “Üretimde” olmalı — önce başlat', true)
    if (+e.uretilen_miktar + u > +e.planlanan_miktar && !confirm(`Toplam ${fmtInt(+e.uretilen_miktar + u)} adet olacak, planlanan ${fmtInt(e.planlanan_miktar)} adedi aşıyor. Devam?`)) return
    setBusy(true)
    const r: any = await erp.from('uretim_hareketleri').insert({ uretim_emri_id: e.id, uretilen_adet: u, fire_adet: f, cevrim_suresi: giris.cevrim ? +giris.cevrim : null, fire_nedeni: giris.neden || null, variant_id: giris.variant || null, vardiya: e.vardiya || null })
    setBusy(false)
    if (r?.error) return toast.show(r.error, true)
    setGiris({ ...girisBos, variant: giris.variant }); toast.show(`${fmtInt(u)} adet üretim${f ? `, ${fmtInt(f)} fire` : ''} kaydedildi`); reload()
  }

  async function satinalmaOlustur() {
    setBusy(true)
    try {
      const gruplar: Record<string, typeof eksikler> = {}
      eksikler.forEach(i => { (gruplar[i.tedarikci || 'genel'] ||= []).push(i) })
      let n = 0
      for (const [tid, kalemler] of Object.entries(gruplar)) {
        const r: any = await erp.from('satinalma_siparisleri').insert({ no: `SA-MRP-${Date.now().toString().slice(-6)}${n}`, tedarikci_id: tid === 'genel' ? null : tid, tarih: todayISO(), durum: 'beklemede', notlar: 'Üretim ihtiyacına göre otomatik oluşturuldu (MRP)' })
        if (r?.error) throw new Error(r.error)
        const id = r.data?.[0]?.id
        const k: any = await erp.from('satinalma_siparisi_kalemleri').insert(kalemler.map(x => ({ siparis_id: id, hammadde_id: x.id, miktar: Math.ceil(x.eksik), birim_fiyat: x.maliyet })))
        if (k?.error) throw new Error(k.error); n++
      }
      toast.show(`${n} satınalma siparişi oluşturuldu`); setMrp(false)
    } catch (err: any) { toast.show(err.message, true) }
    setBusy(false)
  }

  const ilerleme = (e: any) => yuzde(+e.uretilen_miktar, +e.planlanan_miktar)
  const cols: Col<any>[] = [
    { key: 'no', label: 'Emir', sort: e => e.no, render: e => <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}><div style={{ width: 32, height: 32, borderRadius: 9, background: (EMIR_DURUM[e.durum]?.color || '#999') + '1a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Factory size={15} style={{ color: EMIR_DURUM[e.durum]?.color }} /></div><div><b style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: 12.5 }}>{e.no}</b><div style={{ fontSize: 11, color: 'var(--adm-tx3)' }}>{urun[e.urun_id]?.name || '—'}</div></div></div> },
    { key: 'makine', label: 'Makine / Kalıp', sort: e => makine[e.makine_id]?.ad || '', render: e => <div>{makine[e.makine_id]?.ad || <span style={{ color: 'var(--adm-tx3)' }}>Atanmadı</span>}<div style={{ fontSize: 11, color: 'var(--adm-tx3)' }}>{kalip[e.kalip_id]?.ad || ''}</div></div>, hideSm: true },
    { key: 'ilerleme', label: 'İlerleme', width: 190, sort: e => ilerleme(e), render: e => <div><div style={{ height: 6, borderRadius: 4, background: 'var(--adm-s2)', overflow: 'hidden' }}><div style={{ width: `${ilerleme(e)}%`, height: '100%', background: e.durum === 'tamamlandi' ? 'var(--adm-green)' : 'var(--adm-blue)' }} /></div><div style={{ fontSize: 11, color: 'var(--adm-tx3)', marginTop: 3 }}>{fmtInt(e.uretilen_miktar)} / {fmtInt(e.planlanan_miktar)} · %{fmtN(ilerleme(e), 0)}</div></div> },
    { key: 'fire', label: 'Fire', align: 'right', sort: e => fireOrani(+e.uretilen_miktar, +e.fire_miktar), render: e => +e.fire_miktar ? <span style={{ color: 'var(--adm-red)', fontWeight: 600 }}>%{fmtN(fireOrani(+e.uretilen_miktar, +e.fire_miktar), 1)}</span> : <span style={{ color: 'var(--adm-tx3)' }}>—</span>, hideSm: true },
    { key: 'termin', label: 'Termin', sort: e => termin(e) || '9999', render: e => termin(e) ? <div>{fmtDate(termin(e))}{gec(e) && <div style={{ fontSize: 10.5, color: 'var(--adm-red)', fontWeight: 700 }}>{daysBetween(termin(e))} gün gecikti</div>}</div> : <span style={{ color: 'var(--adm-tx3)' }}>—</span>, hideSm: true },
    { key: 'durum', label: 'Durum', width: 110, sort: e => e.durum, render: e => <Badge tone={EMIR_DURUM[e.durum]?.tone}>{EMIR_DURUM[e.durum]?.l}</Badge> },
    { key: 'act', label: '', width: 150, align: 'right', render: e => (
      <span style={{ display: 'inline-flex', gap: 4 }} onClick={ev => ev.stopPropagation()}>
        {['planlandi', 'durduruldu'].includes(e.durum) && <button className="adm-btn" style={{ padding: '4px 10px', fontSize: 11.5 }} disabled={busy} onClick={() => durumDegis(e, 'uretimde')}><Play size={12} />{e.durum === 'durduruldu' ? 'Devam' : 'Başlat'}</button>}
        {e.durum === 'uretimde' && <><button className="adm-btn-ghost" style={{ padding: '4px 8px' }} title="Duraklat" disabled={busy} onClick={() => durumDegis(e, 'durduruldu')}><Pause size={12} /></button><button className="adm-btn" style={{ padding: '4px 10px', fontSize: 11.5, background: 'var(--adm-green)' }} disabled={busy} onClick={() => durumDegis(e, 'tamamlandi')}><CheckCircle2 size={12} />Bitir</button></>}
      </span>) },
  ]

  // Detay
  const dE = canliDetay
  const dHar = dE ? d.hareketler.filter((h: any) => h.uretim_emri_id === dE.id) : []
  const dKal = dE ? d.kalite.filter((k: any) => k.uretim_emri_id === dE.id) : []
  const dRec = dE?.recete_id ? recete[dE.recete_id] : null
  const dMal = dRec ? receteMaliyet(dRec, d.receteKalemleri, d.hammaddeler) : null
  const sure = dE?.baslangic ? ((dE.bitis ? +new Date(dE.bitis) : Date.now()) - +new Date(dE.baslangic)) / 3600000 : 0
  const hiz = sure > 0 ? +dE?.uretilen_miktar / sure : 0
  const kalanSaat = hiz > 0 && dE?.durum === 'uretimde' ? Math.max(+dE.planlanan_miktar - +dE.uretilen_miktar, 0) / hiz : null
  const dTuketim = dE?.recete_id ? emirIhtiyac(dE, d.receteKalemleri, d.hammaddeler, +dE.uretilen_miktar + +dE.fire_miktar) : []
  const dKalan = dE?.recete_id ? emirIhtiyac(dE, d.receteKalemleri, d.hammaddeler) : []

  useAcParam(!loading, id => { const e = d.emirler.find((x: any) => x.id === id); if (e) { setDetay(e); setDTab('ozet'); setGiris(girisBos) } })

  return (
    <div style={{ flex: 1, overflow: 'auto' }}>
      <AdminTopBar title="Üretim Emirleri" />
      <Page>
        <PageHead title="Üretim Planlama & Emirler" sub="Emir aç, makine/kalıp ata, hammadde yeterliliğini gör, üretimi takip et"
          actions={<>
            <Link href="/admin/dashboard/uretim/canli" className="adm-btn-ghost" style={{ textDecoration: 'none' }}><Activity size={14} />Canlı Üretim</Link>
            <button className="adm-btn-ghost" onClick={() => setMrp(true)} style={eksikler.length ? { borderColor: 'var(--adm-red)', color: 'var(--adm-red)' } : undefined}><PackageSearch size={14} />Hammadde İhtiyacı{eksikler.length ? ` (${eksikler.length} eksik)` : ''}</button>
            <button className="adm-btn" onClick={openNew}><Plus size={14} />Yeni Emir</button>
          </>} />

        <KpiGrid min={180}>
          <Kpi label="Açık Emir" value={cnt(acikMi)} Icon={Layers} color="var(--adm-ac)" sub={`${cnt(e => e.durum === 'planlandi')} planlı · ${cnt(e => e.durum === 'durduruldu')} durdurulmuş`} onClick={() => setTab('acik')} />
          <Kpi label="Üretimde" value={cnt(e => e.durum === 'uretimde')} Icon={Activity} color="var(--adm-blue)" sub="şu an hatta" onClick={() => setTab('uretimde')} />
          <Kpi label="Bu Ay Üretim" value={fmtInt(ayUretim)} Icon={TrendingUp} color="var(--adm-green)" sub={`${cnt(e => e.durum === 'tamamlandi')} emir tamamlandı`} />
          <Kpi label="Bu Ay Fire" value={`%${fmtN(fireOrani(ayUretim, ayFire), 1)}`} Icon={AlertTriangle} color={fireOrani(ayUretim, ayFire) > 5 ? 'var(--adm-red)' : 'var(--adm-amber)'} sub={`${fmtInt(ayFire)} adet`} />
          <Kpi label="Termini Geçen" value={cnt(gec)} Icon={Timer} color={cnt(gec) ? 'var(--adm-red)' : 'var(--adm-green)'} sub={cnt(gec) ? 'sipariş teslimi geçmiş' : 'Gecikme yok'} onClick={() => setTab('geciken')} />
        </KpiGrid>

        {eksikler.length > 0 && (
          <div className="adm-card" style={{ padding: '11px 16px', marginBottom: 14, display: 'flex', gap: 10, alignItems: 'center', borderColor: 'var(--adm-red)', fontSize: 13 }}>
            <AlertTriangle size={16} style={{ color: 'var(--adm-red)' }} /><span style={{ flex: 1 }}>Açık emirler için <b>{eksikler.length}</b> hammaddede eksik var: {eksikler.slice(0, 3).map(x => x.ad).join(', ')}{eksikler.length > 3 ? '…' : ''}</span>
            <button className="adm-btn" style={{ padding: '4px 12px', fontSize: 12 }} onClick={() => setMrp(true)}>İncele</button>
          </div>
        )}

        <div style={{ marginBottom: 12 }}>
          <Tabs value={tab} onChange={setTab} tabs={[{ v: 'acik', l: 'Açık', n: cnt(acikMi) }, { v: 'planlandi', l: 'Planlı', n: cnt(e => e.durum === 'planlandi') }, { v: 'uretimde', l: 'Üretimde', n: cnt(e => e.durum === 'uretimde') }, { v: 'durduruldu', l: 'Durdurulan', n: cnt(e => e.durum === 'durduruldu') }, { v: 'geciken', l: 'Geciken', n: cnt(gec) }, { v: 'tamamlandi', l: 'Tamamlanan', n: cnt(e => e.durum === 'tamamlandi') }, { v: 'iptal', l: 'İptal', n: cnt(e => e.durum === 'iptal') }, { v: 'hepsi', l: 'Tümü', n: d.emirler.length }]} />
        </div>

        <DataGrid rows={liste} cols={cols} rowKey={e => e.id} loading={loading} csvName="uretim-emirleri" storageKey="emirler" onRowClick={e => { setDetay(e); setDTab('ozet'); setGiris(girisBos) }} activeKey={detay?.id} selectable bulkActions={(sel) => <button className="adm-btn-ghost" style={{ padding: '3px 12px', fontSize: 12 }} onClick={() => setToplu(sel)}><ListChecks size={12} />Toplu düzenle</button>}
          searchText={e => `${e.no} ${urun[e.urun_id]?.name || ''} ${makine[e.makine_id]?.ad || ''}`} searchPlaceholder="Emir no, ürün, makine..." emptyTitle="Emir bulunamadı" emptySub="Yeni Emir ile üretimi planla" />
      </Page>

      {/* Detay */}
      <Drawer open={!!dE} onClose={() => setDetay(null)} width={620}
        title={dE && <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}><span style={{ fontFamily: 'JetBrains Mono,monospace' }}>{dE.no}</span><Badge tone={EMIR_DURUM[dE.durum]?.tone}>{EMIR_DURUM[dE.durum]?.l}</Badge></span>}
        sub={dE && `${urun[dE.urun_id]?.name || '—'}${dE.siparis_id ? ` · Sipariş ${siparis[dE.siparis_id]?.no || ''}` : ''}`}
        footer={dE && <>
          {['planlandi', 'durduruldu'].includes(dE.durum) && <button className="adm-btn" disabled={busy} onClick={() => durumDegis(dE, 'uretimde')}><Play size={14} />{dE.durum === 'durduruldu' ? 'Devam Et' : 'Başlat'}</button>}
          {dE.durum === 'uretimde' && <><button className="adm-btn-ghost" disabled={busy} onClick={() => durumDegis(dE, 'durduruldu')}><Pause size={13} />Duraklat</button><button className="adm-btn" style={{ background: 'var(--adm-green)' }} disabled={busy} onClick={() => durumDegis(dE, 'tamamlandi')}><CheckCircle2 size={14} />Tamamla</button></>}
          {dE.durum === 'durduruldu' && <button className="adm-btn-ghost" disabled={busy} onClick={() => durumDegis(dE, 'planlandi')}><Undo2 size={13} />Plana al</button>}
          {!['tamamlandi', 'iptal'].includes(dE.durum) && <button className="adm-btn-danger" disabled={busy} onClick={() => durumDegis(dE, 'iptal')}><Ban size={13} />İptal</button>}
          {dE.durum === 'tamamlandi' && <Link href="/admin/dashboard/kalite/kontrol" className="adm-btn-ghost" style={{ textDecoration: 'none' }}><ShieldCheck size={13} />Kalite kontrol gir</Link>}
        </>}>
        {dE && (
          <div>
            <div style={{ padding: '18px 20px 0' }}>
              <div style={{ marginBottom: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, marginBottom: 6 }}><b>{fmtInt(dE.uretilen_miktar)} / {fmtInt(dE.planlanan_miktar)} adet</b><span style={{ color: 'var(--adm-tx3)' }}>%{fmtN(ilerleme(dE), 0)}</span></div>
                <div style={{ height: 10, borderRadius: 6, background: 'var(--adm-s2)', overflow: 'hidden' }}><div style={{ width: `${ilerleme(dE)}%`, height: '100%', background: dE.durum === 'tamamlandi' ? 'var(--adm-green)' : 'var(--adm-blue)', transition: 'width .4s' }} /></div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8, marginBottom: 14 }}>
                {[['Fire', `%${fmtN(fireOrani(+dE.uretilen_miktar, +dE.fire_miktar), 1)}`, +dE.fire_miktar ? 'var(--adm-red)' : undefined], ['Hız', hiz ? `${fmtN(hiz, 0)}/sa` : '—'], ['Süre', sure ? `${fmtN(sure, 1)} sa` : '—'], [dE.durum === 'uretimde' ? 'Kalan' : 'Çevrim', dE.durum === 'uretimde' ? (kalanSaat != null ? `${fmtN(kalanSaat, 1)} sa` : '—') : dE.gercek_cevrim ? `${dE.gercek_cevrim} sn` : '—']].map(([k, v, c]: any) => <div key={k} style={{ padding: 10, borderRadius: 10, background: 'var(--adm-s2)' }}><div className="adm-kpi-label" style={{ marginBottom: 3 }}>{k}</div><b style={{ fontSize: 14.5, fontFamily: 'JetBrains Mono,monospace', color: c }}>{v}</b></div>)}
              </div>
              <Tabs value={dTab} onChange={setDTab} tabs={[{ v: 'ozet', l: 'Özet' }, { v: 'giris', l: 'Üretim Girişi' }, { v: 'malzeme', l: 'Malzeme' }, { v: 'hareket', l: 'Hareketler', n: dHar.length }, { v: 'kalite', l: 'Kalite', n: dKal.length }]} />
            </div>

            {dTab === 'ozet' && <div style={{ padding: 20 }}>
              <InfoRow k="Makine" v={makine[dE.makine_id]?.ad || 'Atanmadı'} />
              <InfoRow k="Kalıp" v={kalip[dE.kalip_id]?.ad || '—'} />
              <InfoRow k="Reçete" v={dRec ? `v${dRec.versiyon}` : 'Yok — hammadde tüketimi yapılmaz'} />
              <InfoRow k="Vardiya" v={dE.vardiya || '—'} />
              <InfoRow k="Hedef çevrim" v={dE.hedef_cevrim ? `${dE.hedef_cevrim} sn` : '—'} />
              <InfoRow k="Termin" v={termin(dE) ? fmtDate(termin(dE)) : '—'} />
              <InfoRow k="Başlangıç" v={dE.baslangic ? fmtDateTime(dE.baslangic) : '—'} />
              <InfoRow k="Bitiş" v={dE.bitis ? fmtDateTime(dE.bitis) : '—'} />
              {dMal && <InfoRow k="Tahmini maliyet" v={`${fmt(dMal.firedahil)} /adet · ${fmtK(dMal.firedahil * +dE.planlanan_miktar)} toplam`} />}
              {dE.notlar && <><Divider label="Notlar" /><p style={{ fontSize: 12.5, color: 'var(--adm-tx2)', margin: 0, whiteSpace: 'pre-wrap' }}>{dE.notlar}</p></>}
            </div>}

            {dTab === 'giris' && <div style={{ padding: 20 }}>
              {dE.durum !== 'uretimde' ? <Empty icon={<Factory size={28} />} title="Üretim girişi kapalı" sub="Üretim girmek için emri başlat (Üretimde durumu)." /> : <>
                {!urunHazirlik(dE.urun_id).varyantlar.length && <div style={{ padding: 10, borderRadius: 9, background: 'var(--adm-red2)', color: 'var(--adm-red)', fontSize: 12, marginBottom: 12 }}>Bu ürünün stok varyantı yok; üretilen adetler stoğa işlenmez. <button className="adm-btn-ghost" style={{ padding: '2px 8px', fontSize: 11 }} onClick={() => varyantOlustur(dE.urun_id)}>Varyant oluştur</button></div>}
                <FormGrid>
                  {urunHazirlik(dE.urun_id).varyantlar.length > 1 && <Field label="Varyant" span={2}><select className="adm-inp" value={giris.variant} onChange={e => setGiris((g: any) => ({ ...g, variant: e.target.value }))}><option value="">İlk varyant (varsayılan)</option>{urunHazirlik(dE.urun_id).varyantlar.map((v: any) => <option key={v.id} value={v.id}>{[v.name, v.color, v.size].filter(Boolean).join(' · ')}</option>)}</select></Field>}
                  <Field label="Üretilen adet"><input type="number" min="0" className="adm-inp" autoFocus value={giris.uretilen} onChange={e => setGiris((g: any) => ({ ...g, uretilen: e.target.value }))} style={{ fontSize: 16, fontWeight: 700 }} /></Field>
                  <Field label="Fire adet"><input type="number" min="0" className="adm-inp" value={giris.fire} onChange={e => setGiris((g: any) => ({ ...g, fire: e.target.value }))} style={{ fontSize: 16, fontWeight: 700 }} /></Field>
                  <Field label="Çevrim (sn)"><input type="number" step="0.1" className="adm-inp" value={giris.cevrim} onChange={e => setGiris((g: any) => ({ ...g, cevrim: e.target.value }))} /></Field>
                  <Field label="Fire nedeni"><input className="adm-inp" list="fire-nedenleri" value={giris.neden} onChange={e => setGiris((g: any) => ({ ...g, neden: e.target.value }))} /><datalist id="fire-nedenleri">{['Kısa atım', 'Çapak', 'Yanık / siyah nokta', 'Renk hatası', 'Çarpılma', 'Boyut hatası', 'Ayar / başlangıç firesi'].map(n => <option key={n} value={n} />)}</datalist></Field>
                </FormGrid>
                <div style={{ display: 'flex', gap: 6, margin: '10px 0' }}>{[10, 50, 100, 500].map(n => <button key={n} className="adm-btn-ghost" style={{ fontSize: 12, padding: '4px 10px' }} onClick={() => setGiris((g: any) => ({ ...g, uretilen: String((+g.uretilen || 0) + n) }))}>+{n}</button>)}</div>
                <button className="adm-btn" style={{ width: '100%', justifyContent: 'center', padding: '11px 0' }} disabled={busy} onClick={() => uretimGir(dE)}><Send size={14} />Üretimi Kaydet</button>
                <p style={{ fontSize: 11.5, color: 'var(--adm-tx3)', margin: '10px 0 0' }}>Kayıt; ürün stoğunu artırır, reçeteye göre hammaddeyi (üretilen + fire) düşer ve emir ilerlemesini günceller.</p>
              </>}
            </div>}

            {dTab === 'malzeme' && <div style={{ padding: 20 }}>
              {!dE.recete_id ? <Empty icon={<FlaskConical size={28} />} title="Reçete bağlı değil" sub="Reçetesiz emirde hammadde tüketimi hesaplanmaz." /> : (
                <table className="adm-tbl compact"><thead><tr><th>Hammadde</th><th style={{ textAlign: 'right' }}>Tüketilen</th><th style={{ textAlign: 'right' }}>Kalan ihtiyaç</th><th style={{ textAlign: 'right' }}>Stok</th></tr></thead>
                  <tbody>{dTuketim.map((t, i) => { const k = dKalan[i], yet = t.stok >= k.gerekli; return <tr key={t.hammadde_id}><td>{t.ad}</td><td style={{ textAlign: 'right' }}>{fmtN(t.gerekli, 1)} {t.birim}</td><td style={{ textAlign: 'right' }}>{fmtN(k.gerekli, 1)} {t.birim}</td><td style={{ textAlign: 'right', color: yet ? 'var(--adm-green)' : 'var(--adm-red)', fontWeight: 700 }}>{fmtN(t.stok, 1)}{yet ? ' ✓' : ' ⚠'}</td></tr> })}</tbody></table>)}
            </div>}

            {dTab === 'hareket' && (dHar.length === 0 ? <Empty title="Üretim hareketi yok" /> : dHar.map((h: any) => (
              <div key={h.id} className="adm-row"><div style={{ flex: 1 }}><div style={{ fontSize: 12.5, fontWeight: 600 }}>{fmtDateTime(h.tarih)}</div><div style={{ fontSize: 11.5, color: 'var(--adm-tx3)' }}>{h.vardiya || ''}{h.cevrim_suresi ? ` · ${h.cevrim_suresi} sn` : ''}{h.fire_nedeni ? ` · ${h.fire_nedeni}` : ''}</div></div>
                <b style={{ color: 'var(--adm-green)', fontFamily: 'JetBrains Mono,monospace' }}>+{fmtInt(h.uretilen_adet)}</b>{+h.fire_adet > 0 && <b style={{ color: 'var(--adm-red)', fontFamily: 'JetBrains Mono,monospace', fontSize: 12 }}>fire {fmtInt(h.fire_adet)}</b>}</div>)))}

            {dTab === 'kalite' && (dKal.length === 0 ? <Empty icon={<ShieldCheck size={28} />} title="Kalite kaydı yok" sub="Kalite → Kalite Kontrol’dan bu emre kayıt gir" /> : dKal.map((k: any) => (
              <div key={k.id} className="adm-row"><div style={{ flex: 1 }}><div style={{ fontSize: 12.5, fontWeight: 600 }}>{k.kontrol_tipi.replace('_', ' ')}</div><div style={{ fontSize: 11.5, color: 'var(--adm-tx3)' }}>{fmtDateTime(k.tarih)} · {fmtInt(k.uygun_adet)}/{fmtInt(k.kontrol_edilen_adet)} uygun</div></div><Badge tone={k.sonuc === 'uygun' ? 'green' : k.sonuc === 'red' ? 'red' : 'amber'}>{k.sonuc.replace('_', ' ')}</Badge></div>)))}
          </div>
        )}
      </Drawer>

      {/* Yeni emir */}
      <Modal open={modal} onClose={() => setModal(false)} width={880} title="Yeni Üretim Emri"
        footer={<>
          {tahminiSaat > 0 && <span style={{ marginRight: 'auto', fontSize: 12.5, color: 'var(--adm-tx3)' }}>Tahmini süre: <b style={{ color: 'var(--adm-tx)' }}>{fmtN(tahminiSaat, 1)} saat</b>{frMal ? <> · Maliyet: <b style={{ color: 'var(--adm-tx)' }}>{fmtK(frMal.firedahil * planAdet)}</b></> : null}</span>}
          <button type="button" className="adm-btn-ghost" onClick={() => setModal(false)}>İptal</button>
          <button type="button" className="adm-btn-ghost" disabled={busy} onClick={() => kaydetEmir(false)}>Planla</button>
          <button type="button" className="adm-btn" disabled={busy} onClick={() => kaydetEmir(true)}><Play size={13} />Oluştur ve Başlat</button></>}>
        <FormGrid cols={4}>
          <Field label="Emir No *"><input className="adm-inp" value={form.no} onChange={e => setForm((f: any) => ({ ...f, no: e.target.value }))} /></Field>
          <Field label="Ürün *" span={2}><select className="adm-inp" value={form.urun_id} onChange={e => urunSec(e.target.value)}><option value="">Seçin</option>{d.products.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></Field>
          <Field label="Planlanan miktar *"><input type="number" min="1" className="adm-inp" value={form.planlanan_miktar} onChange={e => setForm((f: any) => ({ ...f, planlanan_miktar: e.target.value }))} style={{ fontWeight: 700 }} /></Field>
        </FormGrid>
        {fh && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '12px 0 4px' }}>
            {fh.recete ? <Badge tone="green">Reçete v{fh.recete.versiyon}</Badge> : <Badge tone="amber">Aktif reçete yok — hammadde düşümü yapılmaz</Badge>}
            {fh.varyantlar.length ? <Badge tone="green">{fh.varyantlar.length} stok varyantı</Badge> : <span><Badge tone="red">Stok varyantı yok — üretim stoğa işlenmez</Badge> <button className="adm-btn-ghost" style={{ padding: '2px 10px', fontSize: 11.5 }} onClick={() => varyantOlustur(form.urun_id)}>“Standart” varyant oluştur</button></span>}
          </div>
        )}
        <FormGrid cols={4}>
          <Field label="Reçete"><select className="adm-inp" value={form.recete_id} onChange={e => { const r = recete[e.target.value]; setForm((f: any) => ({ ...f, recete_id: e.target.value, ...(r?.hedef_cevrim_suresi ? { hedef_cevrim: String(r.hedef_cevrim_suresi) } : {}), ...(r?.kalip_id && !f.kalip_id ? { kalip_id: r.kalip_id } : {}) })) }}><option value="">Yok</option>{d.receteler.filter((r: any) => r.urun_id === form.urun_id).map((r: any) => <option key={r.id} value={r.id}>v{r.versiyon}{r.aktif ? ' (aktif)' : ''}</option>)}</select></Field>
          <Field label="Makine"><select className="adm-inp" value={form.makine_id} onChange={e => setForm((f: any) => ({ ...f, makine_id: e.target.value }))}><option value="">Sonra ata</option>{d.makineler.map((m: any) => <option key={m.id} value={m.id}>{m.ad} — {MAKINE_DURUM[m.durum]?.l}</option>)}</select></Field>
          <Field label="Kalıp"><select className="adm-inp" value={form.kalip_id} onChange={e => setForm((f: any) => ({ ...f, kalip_id: e.target.value }))}><option value="">Kalıpsız</option>{d.kaliplar.map((k: any) => <option key={k.id} value={k.id}>{k.ad} — {k.durum}</option>)}</select></Field>
          <Field label="Bağlı sipariş"><select className="adm-inp" value={form.siparis_id} onChange={e => siparisSec(e.target.value)}><option value="">Yok (stok için)</option>{d.siparisler.filter((s: any) => !['tamamlandi', 'iptal', 'sevk_edildi'].includes(s.durum)).map((s: any) => <option key={s.id} value={s.id}>{s.no}{cari[s.cari_id] ? ` · ${cari[s.cari_id].ad}` : ''}</option>)}</select></Field>
          <Field label="Vardiya"><select className="adm-inp" value={form.vardiya} onChange={e => setForm((f: any) => ({ ...f, vardiya: e.target.value }))}>{VARDIYA.map(v => <option key={v}>{v}</option>)}</select></Field>
          <Field label="Hedef çevrim (sn)"><input type="number" step="0.1" className="adm-inp" value={form.hedef_cevrim} onChange={e => setForm((f: any) => ({ ...f, hedef_cevrim: e.target.value }))} /></Field>
          <Field label="Notlar" span={2}><input className="adm-inp" value={form.notlar} onChange={e => setForm((f: any) => ({ ...f, notlar: e.target.value }))} /></Field>
        </FormGrid>
        {formIhtiyac.length > 0 && planAdet > 0 && (
          <>
            <Divider label={`Hammadde yeterliliği (${fmtInt(planAdet)} adet${fireKat > 1 ? `, %${fmtN((fireKat - 1) * 100, 1)} fire dahil` : ''})`} />
            <table className="adm-tbl compact"><thead><tr><th>Hammadde</th><th style={{ textAlign: 'right' }}>Gerekli</th><th style={{ textAlign: 'right' }}>Stok</th><th style={{ textAlign: 'right' }}>Durum</th></tr></thead>
              <tbody>{formIhtiyac.map(x => { const ek = x.gerekli - x.stok; return <tr key={x.hammadde_id}><td>{x.ad}</td><td style={{ textAlign: 'right' }}>{fmtN(x.gerekli, 1)} {x.birim}</td><td style={{ textAlign: 'right' }}>{fmtN(x.stok, 1)}</td><td style={{ textAlign: 'right' }}>{ek > 0 ? <Badge tone="red">{fmtN(ek, 1)} {x.birim} eksik</Badge> : <Badge tone="green">Yeterli</Badge>}</td></tr> })}</tbody></table>
          </>
        )}
      </Modal>

      {/* MRP */}
      <Modal open={mrp} onClose={() => setMrp(false)} width={780} title={<span style={{ display: 'flex', gap: 8, alignItems: 'center' }}><PackageSearch size={16} />Hammadde İhtiyacı (planlı + üretimdeki emirler)</span>}
        footer={<><button className="adm-btn-ghost" onClick={() => setMrp(false)}>Kapat</button>{eksikler.length > 0 && <button className="adm-btn" disabled={busy} onClick={satinalmaOlustur}><ShoppingCart size={14} />Eksikler için Satınalma Siparişi Oluştur</button>}</>}>
        {ihtiyac.length === 0 ? <Empty icon={<PackageSearch size={28} />} title="Açık emir yok ya da reçeteli emir bulunmuyor" /> : (
          <table className="adm-tbl"><thead><tr><th>Hammadde</th><th style={{ textAlign: 'right' }}>Gerekli</th><th style={{ textAlign: 'right' }}>Stok</th><th style={{ textAlign: 'right' }}>Eksik</th><th>Emirler</th></tr></thead>
            <tbody>{ihtiyac.map(i => <tr key={i.id}><td><b>{i.ad}</b></td><td style={{ textAlign: 'right' }}>{fmtN(i.gerekli, 1)} {i.birim}</td><td style={{ textAlign: 'right' }}>{fmtN(i.stok, 1)}</td><td style={{ textAlign: 'right' }}>{i.eksik > 0 ? <b style={{ color: 'var(--adm-red)' }}>-{fmtN(i.eksik, 1)} {i.birim}</b> : <Badge tone="green">Yeterli</Badge>}</td><td style={{ fontSize: 11, color: 'var(--adm-tx3)' }}>{i.emirler.join(', ')}</td></tr>)}</tbody></table>)}
        <p style={{ fontSize: 11.5, color: 'var(--adm-tx3)', marginTop: 12 }}>Hedef fire oranı dahildir. Sipariş, hammaddenin tedarikçisine göre gruplanır ve “beklemede” olarak açılır; Satış / Lojistik → Satınalma’dan düzenleyebilirsin.</p>
      </Modal>
      <TopluDuzenle rows={toplu} onClose={() => setToplu(null)} onDone={() => { setToplu(null); reload() }} client={erp} table="uretim_emirleri" fields={[
        { key: 'makine_id', label: 'Makine', type: 'select', bosYapilabilir: true, options: d.makineler.map((m: any) => ({ v: m.id, l: `${m.ad} — ${MAKINE_DURUM[m.durum]?.l || m.durum}` })) },
        { key: 'kalip_id', label: 'Kalıp', type: 'select', bosYapilabilir: true, options: d.kaliplar.map((k: any) => ({ v: k.id, l: k.ad })) },
        { key: 'vardiya', label: 'Vardiya', type: 'select', options: VARDIYA.map(v => ({ v, l: v })) },
      ]} />
      {toast.node}
    </div>
  )
}
