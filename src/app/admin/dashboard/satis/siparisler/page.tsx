'use client'
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import AdminTopBar from '@/components/admin/TopBar'
import { useAcParam } from '@/lib/ac-param'
import { erp } from '@/lib/erp-client'
import { web } from '@/lib/web-data'
import { muh } from '@/lib/muhasebe-client'
import { fmt, fmtK, fmtN, fmtInt, fmtDate, todayISO, daysBetween } from '@/lib/fmt'
import { useUretim, byId, sevkEdilen, rezerveMap, SIPARIS_ACIK } from '@/lib/uretim-utils'
import { sum } from '@/lib/muh-utils'
import { Page, PageHead, Kpi, KpiGrid, Badge, Tabs, Money, Drawer, Modal, Field, FormGrid, Divider, useToast } from '@/components/admin/erp/ui'
import { DataGrid, type Col } from '@/components/admin/erp/DataGrid'
import { topluSilCalistir } from '@/lib/toplu-sil'
import { Plus, ClipboardList, Truck, Factory, Receipt, Ban, CheckCircle2, Pencil, Trash2, AlertTriangle, Coins, X, Copy } from 'lucide-react'

const DURUM: Record<string, { l: string; tone: any }> = { beklemede: { l: 'Beklemede', tone: 'muted' }, uretimde: { l: 'Üretimde', tone: 'blue' }, kismen_hazir: { l: 'Kısmen Hazır', tone: 'amber' }, hazir: { l: 'Hazır', tone: 'green' }, sevk_edildi: { l: 'Sevk Edildi', tone: 'ac' }, tamamlandi: { l: 'Tamamlandı', tone: 'green' }, iptal: { l: 'İptal', tone: 'red' } }
type Kalem = { variant_id: string; urun_adi: string; miktar: number; birim_fiyat: number; not?: string }
const bosKalem = (): Kalem => ({ variant_id: '', urun_adi: '', miktar: 1, birim_fiyat: 0 })

export default function SatisSiparisleriPage() {
  const toast = useToast()
  const { d, loading, reload } = useUretim(['siparisler', 'siparisKalemleri', 'cariTam', 'variants', 'products', 'fiyatListeleri', 'fiyatKalemleri', 'iskontolar', 'sevkRows', 'rezerveRows', 'sevkiyatlar', 'emirler', 'receteler'])
  const [tab, setTab] = useState('acik')
  const [detay, setDetay] = useState<any>(null)
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [form, setForm] = useState<any>({})
  const [kalemler, setKalemler] = useState<Kalem[]>([bosKalem()])
  const [busy, setBusy] = useState(false)
  const [teklifRef, setTeklifRef] = useState<string | null>(null)   // tekliften açılan sipariş: kaydedilince teklif 'kabul' olur

  const cari = useMemo(() => byId(d.cariTam), [d.cariTam])
  const urun = useMemo(() => byId(d.products), [d.products])
  const varyant = useMemo(() => byId(d.variants), [d.variants])
  const etiket = (v: any) => [urun[v.product_id]?.name, v.name, v.color, v.size].filter(Boolean).filter((a: any, i: number, arr: any[]) => arr.indexOf(a) === i).join(' · ') || v.name
  const vList = useMemo(() => d.variants.map((v: any) => ({ ...v, label: etiket(v) })), [d.variants, urun]) // eslint-disable-line

  const S = useMemo(() => {
    const o: Record<string, any> = {}
    d.siparisler.forEach((s: any) => {
      const ks = d.siparisKalemleri.filter((k: any) => k.siparis_id === s.id)
      const sevk = sevkEdilen(s.id, d.sevkRows)
      const toplamMiktar = sum(ks, (k: any) => k.miktar), sevkMiktar = sum(ks, (k: any) => Math.min(sevk[k.variant_id] || 0, +k.miktar))
      const tutar = sum(ks, (k: any) => (+k.miktar || 0) * (+k.birim_fiyat || 0))
      const kalanTutar = sum(ks, (k: any) => Math.max((+k.miktar || 0) - (sevk[k.variant_id] || 0), 0) * (+k.birim_fiyat || 0))
      o[s.id] = { ks, sevk, tutar, kalanTutar, toplamMiktar, sevkOran: toplamMiktar ? (sevkMiktar / toplamMiktar) * 100 : 0, gereken: sum(ks, (k: any) => k.uretim_gereken_miktar) }
    })
    return o
  }, [d])

  const acik = (s: any) => SIPARIS_ACIK.includes(s.durum)
  const gec = (s: any) => acik(s) && s.teslim_tarihi && s.teslim_tarihi < todayISO()
  const cnt = (f: (s: any) => boolean) => d.siparisler.filter(f).length
  const ay = todayISO().slice(0, 7)
  const liste = d.siparisler.filter((s: any) => tab === 'hepsi' ? true : tab === 'acik' ? acik(s) : tab === 'geciken' ? gec(s) : s.durum === tab)

  /* ── Form ── */
  const sonrakiNo = () => { const y = new Date().getFullYear(), p = `SS-${y}-`; return p + String(Math.max(0, ...d.siparisler.filter((s: any) => s.no?.startsWith(p)).map((s: any) => +s.no.slice(p.length) || 0)) + 1).padStart(4, '0') }
  const openNew = () => { setEditing(null); setForm({ no: sonrakiNo(), cari_id: '', tarih: todayISO(), teslim_tarihi: '', notlar: '' }); setKalemler([bosKalem()]); setModal(true) }
  const openEdit = (s: any) => {
    setEditing(s); setForm({ no: s.no, cari_id: s.cari_id || '', tarih: s.tarih, teslim_tarihi: s.teslim_tarihi || '', notlar: s.notlar || '' })
    setKalemler(S[s.id].ks.map((k: any) => ({ variant_id: k.variant_id || '', urun_adi: k.urun_adi, miktar: +k.miktar, birim_fiyat: +k.birim_fiyat || 0 }))); setModal(true)
  }
  const openKopya = (s: any) => { setEditing(null); setForm({ no: sonrakiNo(), cari_id: s.cari_id || '', tarih: todayISO(), teslim_tarihi: '', notlar: s.notlar || '' }); setKalemler(S[s.id].ks.map((k: any) => ({ variant_id: k.variant_id || '', urun_adi: k.urun_adi, miktar: +k.miktar, birim_fiyat: +k.birim_fiyat || 0 }))); setDetay(null); setModal(true) }

  // Tekliften gelen ?teklif=<id>[&kur=<TL>] bağlantısı: yeni sipariş formunu teklif kalemleriyle (iskonto düşülmüş net fiyatla) açar.
  useEffect(() => {
    if (loading) return
    const sp = new URLSearchParams(window.location.search), tid = sp.get('teklif')
    if (!tid || !/^[0-9a-f-]{36}$/.test(tid)) return
    const kur = +(sp.get('kur') || '1') || 1
    window.history.replaceState(null, '', window.location.pathname)
    ;(async () => {
      const [t, k] = await Promise.all([web.from('teklifler').select('id,no,cari_id,musteri_adi,durum,siparis_id,kdv_orani,kdv_dahil').eq('id', tid).maybeSingle(), web.from('teklif_kalemleri').select('*').eq('teklif_id', tid).order('sira')])
      const tk: any = t.data
      if (!tk || k.error) return toast.show('Teklif okunamadı', true)
      if (tk.durum === 'kabul' || tk.siparis_id) return toast.show(`${tk.no} zaten siparişe çevrilmiş`, true)
      setEditing(null); setTeklifRef(tid)
      setForm({ no: sonrakiNo(), cari_id: tk.cari_id || '', tarih: todayISO(), teslim_tarihi: '', notlar: `Teklif ${tk.no}${tk.cari_id ? '' : ` — müşteri: ${tk.musteri_adi} (cari seçin)`}${kur !== 1 ? ` · fiyatlar ${kur} kuruyla TL'ye çevrildi` : ''}` })
      const kdvBol = tk.kdv_dahil ? 1 + (+tk.kdv_orani || 0) / 100 /* sipariş KDV hariç tutulur */ : 1
      setKalemler((k.data || []).map((x: any) => { const kn = x.birim === 'koli' && +x.koli_ici_adet > 0 ? +x.koli_ici_adet : 1 /* koli satırı: sipariş ADET olarak açılır (miktar × koli içi adet, fiyat ÷ koli içi adet) */; return { variant_id: x.variant_id || '', urun_adi: x.urun_adi, miktar: +x.miktar * kn, birim_fiyat: +(((+x.birim_fiyat / kn) * (1 - (+x.iskonto_yuzde || 0) / 100)) * kur / kdvBol).toFixed(4) } }))
      setModal(true); toast.show('Teklif kalemleri forma aktarıldı; cariyi seçip kaydedin')
    })()
  }, [loading]) // eslint-disable-line
  const varsayilanListe = d.fiyatListeleri.find((l: any) => l.varsayilan)?.id
  function fiyatBul(variantId: string, cariId: string, miktar: number) {
    const lid = cari[cariId]?.fiyat_listesi_id || varsayilanListe
    const it = d.fiyatKalemleri.find((k: any) => k.fiyat_listesi_id === lid && k.variant_id === variantId)
    if (!it) return { fiyat: 0, isk: 0 }
    const isk = Math.max(0, ...d.iskontolar.filter((k: any) => k.aktif !== false && +k.min_miktar <= miktar).map((k: any) => +k.iskonto_yuzdesi))
    return { fiyat: +(+it.fiyat * (1 - isk / 100)).toFixed(4), isk }
  }
  const setK = (i: number, p: Partial<Kalem>) => setKalemler(ks => ks.map((k, j) => j === i ? { ...k, ...p } : k))
  function urunSec(i: number, text: string) {
    const v = vList.find((x: any) => x.label === text)
    if (!v) return setK(i, { urun_adi: text, variant_id: '' })
    const { fiyat, isk } = fiyatBul(v.id, form.cari_id, kalemler[i].miktar)
    setK(i, { variant_id: v.id, urun_adi: v.label, birim_fiyat: fiyat || kalemler[i].birim_fiyat, not: isk ? `Kademe iskontosu %${isk}` : undefined })
  }
  function miktarDegis(i: number, m: number) {
    const k = kalemler[i]
    if (k.variant_id) { const { fiyat, isk } = fiyatBul(k.variant_id, form.cari_id, m); if (fiyat) return setK(i, { miktar: m, birim_fiyat: fiyat, not: isk ? `Kademe iskontosu %${isk}` : undefined }) }
    setK(i, { miktar: m })
  }
  // Açık siparişlerde rezerve edilen miktar (veritabanı görünümü); düzenlenen siparişin kendi payı çıkarılır
  const rez = useMemo(() => {
    const m = { ...rezerveMap(d.rezerveRows) }
    if (editing && S[editing.id]) {
      const sv = sevkEdilen(editing.id, d.sevkRows)
      S[editing.id].ks.forEach((k: any) => { if (k.variant_id) m[k.variant_id] = (m[k.variant_id] || 0) - Math.max((+k.miktar || 0) - (sv[k.variant_id] || 0), 0) })
    }
    return m
  }, [d.rezerveRows, d.sevkRows, editing, S])
  const serbest = (vid: string) => (+varyant[vid]?.stock || 0) - (rez[vid] || 0)
  const formTutar = sum(kalemler, k => k.miktar * k.birim_fiyat)

  async function save(e: React.FormEvent) {
    e.preventDefault(); if (busy) return
    const gecerli = kalemler.filter(k => k.urun_adi && k.miktar > 0)
    if (!gecerli.length) return toast.show('En az bir kalem gir', true)
    if (d.siparisler.some((s: any) => s.no === form.no && s.id !== editing?.id)) return toast.show('Bu sipariş numarası zaten var', true)
    setBusy(true)
    try {
      const payload: any = { no: form.no, cari_id: form.cari_id || null, tarih: form.tarih, teslim_tarihi: form.teslim_tarihi || null, notlar: form.notlar || null }
      let id = editing?.id
      if (editing) {
        const u: any = await erp.from('satis_siparisleri').update(payload).eq('id', id); if (u?.error) throw new Error(u.error)
        for (const k of S[id].ks) await erp.from('satis_siparisi_kalemleri').delete().eq('id', k.id)
      } else {
        const r: any = await erp.from('satis_siparisleri').insert({ ...payload, durum: 'beklemede' }); if (r?.error) throw new Error(r.error); id = r.data?.[0]?.id
      }
      // stoktan karşılanan / üretilmesi gereken miktar (serbest stok = fiziksel − açık siparişlerde rezerve)
      const tuk: Record<string, number> = {}
      const rows = gecerli.map(k => {
        const kalanServ = k.variant_id ? Math.max(serbest(k.variant_id) - (tuk[k.variant_id] || 0), 0) : 0
        const karsilanan = Math.min(k.miktar, kalanServ); if (k.variant_id) tuk[k.variant_id] = (tuk[k.variant_id] || 0) + karsilanan
        return { siparis_id: id, variant_id: k.variant_id || null, urun_adi: k.urun_adi, miktar: k.miktar, birim_fiyat: k.birim_fiyat, karsilanan_miktar: karsilanan, uretim_gereken_miktar: k.miktar - karsilanan }
      })
      const kk: any = await erp.from('satis_siparisi_kalemleri').insert(rows); if (kk?.error) throw new Error(kk.error)
      if (!editing && teklifRef) {
        const u = await web.from('teklifler').update({ durum: 'kabul', siparis_id: id, updated_at: new Date().toISOString() }).eq('id', teklifRef).neq('durum', 'kabul')
        if (u.error) toast.show(`Sipariş oluştu ama teklif durumu güncellenemedi: ${u.error.message}`, true)
        setTeklifRef(null)
      }
      toast.show(editing ? 'Sipariş güncellendi' : 'Sipariş oluşturuldu'); setModal(false); await reload()
      if (detay?.id === id) setDetay((x: any) => ({ ...x, ...payload }))
    } catch (err: any) { toast.show(err.message, true) }
    setBusy(false)
  }

  async function durum(s: any, yeni: string) {
    if (yeni === 'iptal' && !confirm(`${s.no} iptal edilsin mi?${sum(Object.values(S[s.id].sevk), (x: any) => x) ? '\n\nSevk edilmiş kalemler var; sevkiyat kayıtları ayrıca iptal edilmelidir.' : ''}`)) return
    const r: any = await erp.from('satis_siparisleri').update({ durum: yeni }).eq('id', s.id)
    if (r?.error) return toast.show(r.error, true)
    toast.show(`${s.no}: ${DURUM[yeni].l}`); await reload(); setDetay((x: any) => x?.id === s.id ? { ...x, durum: yeni } : x)
  }
  async function topluSil(sel: any[]): Promise<string | void> {
    const { silinen, hata } = await topluSilCalistir(sel, async (r: any) => (!['beklemede', 'iptal'].includes(r.durum) ? `${r.no}: sadece beklemedeki veya iptal siparişler silinebilir` : d.sevkiyatlar.some((x: any) => x.siparis_id === r.id) ? `${r.no}: bağlı sevkiyat var` : (await erp.from('satis_siparisleri').delete().eq('id', r.id))?.error), 'sipariş')
    await reload(); setDetay(null)
    if (hata) return hata
    toast.show(`${silinen} sipariş silindi`)
  }
  async function sil(s: any) {
    if (!['beklemede', 'iptal'].includes(s.durum)) return toast.show('Sadece beklemedeki veya iptal siparişler silinebilir', true)
    if (d.sevkiyatlar.some((x: any) => x.siparis_id === s.id)) return toast.show('Bu siparişe bağlı sevkiyat var — silinemez', true)
    if (!confirm(`${s.no} silinsin mi?`)) return
    const r: any = await erp.from('satis_siparisleri').delete().eq('id', s.id)
    if (r?.error) return toast.show(r.error, true)
    toast.show('Sipariş silindi'); setDetay(null); reload()
  }

  // Eksik miktarlar için üretim emri aç
  async function uretimEmirleri(s: any) {
    setBusy(true)
    try {
      const yil = new Date().getFullYear(), pre = `UE-${yil}-`
      let no = Math.max(0, ...d.emirler.filter((e: any) => e.no?.startsWith(pre)).map((e: any) => +e.no.slice(pre.length) || 0))
      const gruplar: Record<string, number> = {}
      S[s.id].ks.forEach((k: any) => { const v = varyant[k.variant_id]; if (v && +k.uretim_gereken_miktar > 0) gruplar[v.product_id] = (gruplar[v.product_id] || 0) + +k.uretim_gereken_miktar })
      let n = 0
      for (const [pid, miktar] of Object.entries(gruplar)) {
        const varOlan = d.emirler.find((e: any) => e.siparis_id === s.id && e.urun_id === pid && e.durum !== 'iptal')
        if (varOlan) continue
        const rec = d.receteler.find((r: any) => r.urun_id === pid && r.aktif)
        const r: any = await erp.from('uretim_emirleri').insert({ no: pre + String(++no).padStart(4, '0'), urun_id: pid, siparis_id: s.id, recete_id: rec?.id || null, kalip_id: rec?.kalip_id || null, hedef_cevrim: rec?.hedef_cevrim_suresi || null, planlanan_miktar: miktar, uretilen_miktar: 0, fire_miktar: 0, durum: 'planlandi', notlar: `${s.no} siparişi için otomatik oluşturuldu` })
        if (r?.error) throw new Error(r.error); n++
      }
      if (!n) { toast.show(Object.keys(gruplar).length ? 'Bu sipariş için zaten üretim emri var' : 'Üretilecek eksik miktar yok — stok yeterli', !Object.keys(gruplar).length ? false : true); setBusy(false); return }
      if (s.durum === 'beklemede') await erp.from('satis_siparisleri').update({ durum: 'uretimde' }).eq('id', s.id)
      toast.show(`${n} üretim emri oluşturuldu`); await reload(); setDetay((x: any) => x?.id === s.id ? { ...x, durum: x.durum === 'beklemede' ? 'uretimde' : x.durum } : x)
    } catch (err: any) { toast.show(err.message, true) }
    setBusy(false)
  }

  // Sevk edilmemiş kalemler için taslak satış faturası (stok sevkiyatta düşer; faturada variant bağlanmaz → çift düşüm olmaz)
  async function faturaOlustur(s: any) {
    const ks = S[s.id].ks; if (!ks.length) return
    if (!confirm(`${s.no} için taslak satış faturası oluşturulsun mu?\n\nNot: Stok sevkiyatta düşüldüğü için faturaya ürün varyantı bağlanmaz.`)) return
    setBusy(true)
    try {
      const faturalar = await muh.all('faturalar', 'no')
      const y = new Date().getFullYear(), pre = `F-${y}-`
      const no = pre + String(Math.max(0, ...faturalar.filter((f: any) => f.no?.startsWith(pre)).map((f: any) => +f.no.slice(pre.length) || 0)) + 1).padStart(4, '0')
      const ara = S[s.id].tutar, kdv = ara * 0.2
      const r: any = await muh.from('faturalar').insert({ tip: 'satis', no, cari_id: s.cari_id || null, tarih: todayISO(), vade: null, notlar: `${s.no} siparişinden oluşturuldu`, para_birimi: 'TRY', kur: 1, kdv_orani: 20, ara_toplam: ara, kdv_tutari: kdv, toplam: ara + kdv, durum: 'taslak' })
      if (r?.error) throw new Error(r.error)
      const k: any = await muh.from('fatura_kalemleri').insert(ks.map((x: any) => ({ fatura_id: r.data[0].id, urun_adi: x.urun_adi, variant_id: null, miktar: x.miktar, birim: 'adet', birim_fiyat: x.birim_fiyat, kdv_orani: 20, toplam: x.miktar * x.birim_fiyat * 1.2 })))
      if (k?.error) throw new Error(k.error)
      toast.show(`${no} taslak faturası oluşturuldu (Muhasebe → Faturalar)`)
    } catch (err: any) { toast.show(err.message, true) }
    setBusy(false)
  }

  const cols: Col<any>[] = [
    { key: 'no', label: 'Sipariş', sort: s => s.no, render: s => <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}><div style={{ width: 32, height: 32, borderRadius: 9, background: 'var(--adm-ac2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><ClipboardList size={15} style={{ color: 'var(--adm-ac)' }} /></div><div><b style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: 12.5 }}>{s.no}</b><div style={{ fontSize: 11, color: 'var(--adm-tx3)' }}>{cari[s.cari_id]?.ad || 'Müşteri yok'}</div></div></div> },
    { key: 'tarih', label: 'Tarih', width: 96, sort: s => s.tarih, render: s => fmtDate(s.tarih), hideSm: true },
    { key: 'termin', label: 'Termin', sort: s => s.teslim_tarihi || '9999', render: s => s.teslim_tarihi ? <div>{fmtDate(s.teslim_tarihi)}{gec(s) && <div style={{ fontSize: 10.5, color: 'var(--adm-red)', fontWeight: 700 }}>{daysBetween(s.teslim_tarihi)} gün gecikti</div>}</div> : <span style={{ color: 'var(--adm-tx3)' }}>—</span> },
    { key: 'kalem', label: 'Kalem', align: 'right', width: 70, sort: s => S[s.id]?.ks.length, render: s => S[s.id]?.ks.length, hideSm: true },
    { key: 'sevk', label: 'Sevk', width: 130, sort: s => S[s.id]?.sevkOran, render: s => <div><div style={{ height: 5, borderRadius: 3, background: 'var(--adm-s2)', overflow: 'hidden' }}><div style={{ width: `${S[s.id]?.sevkOran}%`, height: '100%', background: 'var(--adm-green)' }} /></div><div style={{ fontSize: 10.5, color: 'var(--adm-tx3)', marginTop: 3 }}>%{fmtN(S[s.id]?.sevkOran, 0)} sevk edildi</div></div>, hideSm: true },
    { key: 'tutar', label: 'Tutar (KDV hariç)', align: 'right', sort: s => S[s.id]?.tutar, render: s => <Money v={S[s.id]?.tutar} />, total: rs => <Money v={sum(rs.filter((s: any) => s.durum !== 'iptal'), (s: any) => S[s.id]?.tutar)} />, csv: s => S[s.id]?.tutar },
    { key: 'durum', label: 'Durum', width: 120, sort: s => s.durum, render: s => gec(s) ? <Badge tone="red">Gecikmiş</Badge> : <Badge tone={DURUM[s.durum]?.tone}>{DURUM[s.durum]?.l}</Badge> },
  ]

  const dS = detay ? d.siparisler.find((s: any) => s.id === detay.id) || detay : null
  const dd = dS ? S[dS.id] : null

  useAcParam(!loading, id => { const r = d.siparisler.find((x: any) => x.id === id); if (r) setDetay(r) })

  return (
    <div style={{ flex: 1, overflow: 'auto' }}>
      <AdminTopBar title="Satış Siparişleri" />
      <Page>
        <PageHead title="Satış Siparişleri" sub="Sipariş → stok karşılama → üretim → sevkiyat → fatura akışı" actions={<button className="adm-btn" onClick={openNew}><Plus size={14} />Yeni Sipariş</button>} />
        <KpiGrid min={180}>
          <Kpi label="Açık Sipariş" value={cnt(acik)} Icon={ClipboardList} color="var(--adm-ac)" sub={fmtK(sum(d.siparisler.filter(acik), (s: any) => S[s.id]?.tutar)) + ' toplam'} onClick={() => setTab('acik')} />
          <Kpi label="Sevk Bekleyen Tutar" value={fmtK(sum(d.siparisler.filter(acik), (s: any) => S[s.id]?.kalanTutar))} Icon={Truck} color="var(--adm-blue)" sub="KDV hariç" />
          <Kpi label="Üretim Gereken" value={fmtInt(sum(d.siparisler.filter(acik), (s: any) => S[s.id]?.gereken))} Icon={Factory} color="var(--adm-amber)" sub="stoktan karşılanamayan adet" />
          <Kpi label="Termini Geçen" value={cnt(gec)} Icon={AlertTriangle} color={cnt(gec) ? 'var(--adm-red)' : 'var(--adm-green)'} sub={cnt(gec) ? 'teslim tarihi geçmiş' : 'Gecikme yok'} onClick={() => setTab('geciken')} />
          <Kpi label="Bu Ay Sipariş" value={fmtK(sum(d.siparisler.filter((s: any) => (s.tarih || '').startsWith(ay) && s.durum !== 'iptal'), (s: any) => S[s.id]?.tutar))} Icon={Coins} color="var(--adm-green)" sub={`${cnt((s: any) => (s.tarih || '').startsWith(ay))} sipariş`} />
        </KpiGrid>
        <div style={{ marginBottom: 12 }}><Tabs value={tab} onChange={setTab} tabs={[{ v: 'acik', l: 'Açık', n: cnt(acik) }, { v: 'beklemede', l: 'Beklemede', n: cnt(s => s.durum === 'beklemede') }, { v: 'uretimde', l: 'Üretimde', n: cnt(s => s.durum === 'uretimde') }, { v: 'hazir', l: 'Hazır', n: cnt(s => s.durum === 'hazir') }, { v: 'geciken', l: 'Geciken', n: cnt(gec) }, { v: 'sevk_edildi', l: 'Sevk edildi', n: cnt(s => s.durum === 'sevk_edildi') }, { v: 'tamamlandi', l: 'Tamamlanan', n: cnt(s => s.durum === 'tamamlandi') }, { v: 'iptal', l: 'İptal', n: cnt(s => s.durum === 'iptal') }, { v: 'hepsi', l: 'Tümü', n: d.siparisler.length }]} /></div>

        <DataGrid rows={liste} cols={cols} rowKey={s => s.id} loading={loading} onBulkDelete={topluSil} deleteNoun="sipariş" deleteNote="Sadece beklemedeki veya iptal edilmiş, sevkiyatı olmayan siparişler silinir." csvName="satis-siparisleri" storageKey="satis" onRowClick={setDetay} activeKey={detay?.id}
          searchText={s => `${s.no} ${cari[s.cari_id]?.ad || ''}`} searchPlaceholder="Sipariş no, müşteri..." emptyTitle="Sipariş bulunamadı" emptySub="Yeni Sipariş ile başla" />
      </Page>

      <Drawer open={!!dS} onClose={() => setDetay(null)} width={680}
        title={dS && <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}><span style={{ fontFamily: 'JetBrains Mono,monospace' }}>{dS.no}</span>{gec(dS) ? <Badge tone="red">Gecikmiş</Badge> : <Badge tone={DURUM[dS.durum]?.tone}>{DURUM[dS.durum]?.l}</Badge>}</span>}
        sub={dS && `${cari[dS.cari_id]?.ad || 'Müşteri yok'} · ${fmtDate(dS.tarih)}${dS.teslim_tarihi ? ` · termin ${fmtDate(dS.teslim_tarihi)}` : ''}`}
        footer={dS && dd && <>
          <button className="adm-btn-ghost" onClick={() => openKopya(dS)}><Copy size={13} /></button>
          {['beklemede', 'iptal'].includes(dS.durum) && <button className="adm-btn-danger" onClick={() => sil(dS)}><Trash2 size={13} /></button>}
          {!['sevk_edildi', 'tamamlandi', 'iptal'].includes(dS.durum) && <button className="adm-btn-ghost" onClick={() => openEdit(dS)}><Pencil size={13} />Düzenle</button>}
          <button className="adm-btn-ghost" disabled={busy} onClick={() => faturaOlustur(dS)}><Receipt size={13} />Fatura</button>
          {dd.gereken > 0 && acik(dS) && <button className="adm-btn-ghost" disabled={busy} onClick={() => uretimEmirleri(dS)}><Factory size={13} />Üretim Emri Aç</button>}
          {acik(dS) && <Link href={`/admin/dashboard/sevkiyat?siparis=${dS.id}`} className="adm-btn" style={{ textDecoration: 'none' }}><Truck size={14} />Sevkiyat Oluştur</Link>}
        </>}>
        {dS && dd && (
          <div style={{ padding: 20 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 14 }}>
              <div style={{ padding: 12, borderRadius: 10, background: 'var(--adm-s2)' }}><div className="adm-kpi-label" style={{ marginBottom: 3 }}>Tutar</div><Money v={dd.tutar} size={16} /><div style={{ fontSize: 10.5, color: 'var(--adm-tx3)' }}>KDV dahil {fmt(dd.tutar * 1.2)}</div></div>
              <div style={{ padding: 12, borderRadius: 10, background: 'var(--adm-s2)' }}><div className="adm-kpi-label" style={{ marginBottom: 3 }}>Sevk</div><b style={{ fontSize: 17, fontFamily: 'JetBrains Mono,monospace' }}>%{fmtN(dd.sevkOran, 0)}</b></div>
              <div style={{ padding: 12, borderRadius: 10, background: dd.gereken ? 'var(--adm-amber2)' : 'var(--adm-green2)' }}><div className="adm-kpi-label" style={{ marginBottom: 3 }}>Üretim gereken</div><b style={{ fontSize: 17, fontFamily: 'JetBrains Mono,monospace' }}>{fmtInt(dd.gereken)}</b></div>
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
              {Object.entries(DURUM).filter(([k]) => k !== dS.durum).map(([k, v]) => <button key={k} className="adm-btn-ghost" style={{ fontSize: 11.5, padding: '4px 10px' }} onClick={() => durum(dS, k)}>{k === 'iptal' ? <Ban size={11} /> : <CheckCircle2 size={11} />} {v.l}</button>)}
            </div>
            <Divider label="Kalemler" />
            <table className="adm-tbl compact"><thead><tr><th>Ürün</th><th style={{ textAlign: 'right' }}>Miktar</th><th style={{ textAlign: 'right' }}>Sevk</th><th style={{ textAlign: 'right' }}>Stok</th><th style={{ textAlign: 'right' }}>Üretim</th><th style={{ textAlign: 'right' }}>Tutar</th></tr></thead>
              <tbody>{dd.ks.map((k: any) => { const sv = dd.sevk[k.variant_id] || 0, st = +varyant[k.variant_id]?.stock || 0; return (
                <tr key={k.id}><td>{k.urun_adi}{!k.variant_id && <Badge tone="amber" style={{ marginLeft: 6, fontSize: 9.5 }}>varyantsız</Badge>}</td><td style={{ textAlign: 'right' }}>{fmtInt(k.miktar)}</td>
                  <td style={{ textAlign: 'right', color: sv >= +k.miktar ? 'var(--adm-green)' : undefined, fontWeight: sv ? 700 : 400 }}>{fmtInt(sv)}</td><td style={{ textAlign: 'right', color: st < +k.miktar - sv ? 'var(--adm-red)' : undefined }}>{k.variant_id ? fmtInt(st) : '—'}</td>
                  <td style={{ textAlign: 'right' }}>{+k.uretim_gereken_miktar > 0 ? <Badge tone="amber">{fmtInt(k.uretim_gereken_miktar)}</Badge> : '—'}</td><td style={{ textAlign: 'right' }}>{fmt((+k.miktar || 0) * (+k.birim_fiyat || 0))}</td></tr>) })}</tbody></table>
            {(() => { const ems = d.emirler.filter((e: any) => e.siparis_id === dS.id); return ems.length > 0 && <><Divider label="Bağlı üretim emirleri" />{ems.map((e: any) => <div key={e.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 12.5, borderBottom: '1px dashed var(--adm-bdr)' }}><b style={{ fontFamily: 'JetBrains Mono,monospace' }}>{e.no}</b><span style={{ color: 'var(--adm-tx3)' }}>{urun[e.urun_id]?.name} · {fmtInt(e.uretilen_miktar)}/{fmtInt(e.planlanan_miktar)}</span><Badge tone={e.durum === 'tamamlandi' ? 'green' : e.durum === 'uretimde' ? 'blue' : 'muted'}>{e.durum}</Badge></div>)}</> })()}
            {(() => { const sv = d.sevkiyatlar.filter((x: any) => x.siparis_id === dS.id); return sv.length > 0 && <><Divider label="Sevkiyatlar" />{sv.map((x: any) => <div key={x.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 12.5, borderBottom: '1px dashed var(--adm-bdr)' }}><b style={{ fontFamily: 'JetBrains Mono,monospace' }}>{x.no}</b><span style={{ color: 'var(--adm-tx3)' }}>{fmtDate(x.tarih)} · {fmtInt(x.toplam_urun_adedi)} adet</span><Badge tone={x.durum === 'teslim_edildi' ? 'green' : x.durum === 'iptal' ? 'red' : 'blue'}>{x.durum.replace('_', ' ')}</Badge></div>)}</> })()}
            {dS.notlar && <><Divider label="Not" /><p style={{ fontSize: 12.5, color: 'var(--adm-tx2)', margin: 0, whiteSpace: 'pre-wrap' }}>{dS.notlar}</p></>}
          </div>
        )}
      </Drawer>

      <Modal open={modal} onClose={() => { setModal(false); setTeklifRef(null) }} width={900} title={editing ? `${editing.no} — Düzenle` : 'Yeni Satış Siparişi'}
        footer={<><span style={{ marginRight: 'auto', fontSize: 13 }}>Tutar {fmt(formTutar)} · KDV dahil <b style={{ color: 'var(--adm-green)', fontSize: 15 }}>{fmt(formTutar * 1.2)}</b></span><button type="button" className="adm-btn-ghost" onClick={() => setModal(false)}>İptal</button><button type="button" className="adm-btn" disabled={busy} onClick={save as any}>{busy ? 'Kaydediliyor...' : 'Kaydet'}</button></>}>
        <FormGrid cols={4}>
          <Field label="Sipariş No"><input className="adm-inp" value={form.no || ''} onChange={e => setForm((f: any) => ({ ...f, no: e.target.value }))} /></Field>
          <Field label="Müşteri" span={2} hint={form.cari_id && +cari[form.cari_id]?.bakiye > 0 ? `Cari bakiye: ${fmt(cari[form.cari_id].bakiye)} (bize borçlu)` : undefined}><select className="adm-inp" value={form.cari_id || ''} onChange={e => setForm((f: any) => ({ ...f, cari_id: e.target.value }))}><option value="">— Seçin —</option>{d.cariTam.filter((c: any) => c.tip !== 'tedarikci').map((c: any) => <option key={c.id} value={c.id}>{c.ad}</option>)}</select></Field>
          <Field label="Tarih"><input type="date" className="adm-inp" value={form.tarih || ''} onChange={e => setForm((f: any) => ({ ...f, tarih: e.target.value }))} /></Field>
          <Field label="Teslim (termin)"><input type="date" className="adm-inp" value={form.teslim_tarihi || ''} onChange={e => setForm((f: any) => ({ ...f, teslim_tarihi: e.target.value }))} /></Field>
        </FormGrid>
        <Divider label="Kalemler" />
        <datalist id="sip-urun">{vList.map((v: any) => <option key={v.id} value={v.label} />)}</datalist>
        <table className="adm-tbl compact"><thead><tr><th style={{ minWidth: 240 }}>Ürün</th><th style={{ width: 100 }}>Miktar</th><th style={{ width: 120 }}>Birim fiyat</th><th style={{ width: 120, textAlign: 'right' }}>Tutar</th><th style={{ width: 30 }} /></tr></thead>
          <tbody>{kalemler.map((k, i) => { const sb = k.variant_id ? serbest(k.variant_id) : null; const eksik = sb != null ? Math.max(k.miktar - Math.max(sb, 0), 0) : 0
            return <tr key={i}>
              <td><input className="adm-inp" list="sip-urun" placeholder="Ürün seç veya yaz" value={k.urun_adi} onChange={e => urunSec(i, e.target.value)} style={{ fontSize: 12.5, padding: '6px 9px' }} />
                {sb != null && <div style={{ fontSize: 10.5, marginTop: 3, color: eksik ? 'var(--adm-amber)' : 'var(--adm-green)' }}>Satılabilir stok: {fmtInt(sb)}{eksik ? ` → ${fmtInt(eksik)} adet üretilmeli` : ' ✓'}{k.not ? ` · ${k.not}` : ''}</div>}</td>
              <td><input type="number" min="0" step="1" className="adm-inp" value={k.miktar} onChange={e => miktarDegis(i, +e.target.value)} style={{ fontSize: 12.5, padding: '6px 9px' }} /></td>
              <td><input type="number" min="0" step="0.01" className="adm-inp" value={k.birim_fiyat} onChange={e => setK(i, { birim_fiyat: +e.target.value })} style={{ fontSize: 12.5, padding: '6px 9px' }} /></td>
              <td style={{ textAlign: 'right' }}><Money v={k.miktar * k.birim_fiyat} bold={false} /></td>
              <td><button type="button" disabled={kalemler.length === 1} onClick={() => setKalemler(ks => ks.filter((_, j) => j !== i))} style={{ background: 'none', border: 'none', color: 'var(--adm-red)' }}><X size={14} /></button></td></tr> })}</tbody></table>
        <button type="button" className="adm-btn-ghost" style={{ marginTop: 10, fontSize: 12 }} onClick={() => setKalemler(ks => [...ks, bosKalem()])}><Plus size={12} />Kalem Ekle</button>
        <div style={{ marginTop: 14 }}><Field label="Notlar"><textarea className="adm-inp" rows={2} value={form.notlar || ''} onChange={e => setForm((f: any) => ({ ...f, notlar: e.target.value }))} /></Field></div>
        <p style={{ fontSize: 11.5, color: 'var(--adm-tx3)', margin: '10px 0 0' }}>Fiyat, müşterinin fiyat listesinden (yoksa varsayılan listeden) ve miktar kademesine göre gelir. Stoktan karşılanan ve üretilmesi gereken miktar kayıt anında hesaplanır.</p>
      </Modal>
      {toast.node}
    </div>
  )
}
