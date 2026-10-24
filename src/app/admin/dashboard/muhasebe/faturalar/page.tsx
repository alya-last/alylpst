'use client'
import { useCallback, useEffect, useMemo, useState } from 'react'
import AdminTopBar from '@/components/admin/TopBar'
import { muh } from '@/lib/muhasebe-client'
import { useAcParam } from '@/lib/ac-param'
import { erp } from '@/lib/erp-client'
import { kasaPb, trKasa, islemAlan, paraGoster } from '@/lib/doviz'
import { fmt, fmtK, fmtDate, todayISO, daysBetween } from '@/lib/fmt'
import { kalanTutar, DONEMLER, donemAralik, type Donem } from '@/lib/muh-utils'
import { Page, PageHead, Kpi, KpiGrid, Badge, Tabs, Money, Drawer, Modal, Field, FormGrid, InfoRow, Divider, useToast } from '@/components/admin/erp/ui'
import Yardim from '@/components/admin/erp/Yardim'
import { DataGrid, type Col, type ServerMode } from '@/components/admin/erp/DataGrid'
import { topluSilCalistir } from '@/lib/toplu-sil'
import BelgeOku, { type BelgeSonuc } from '@/components/admin/BelgeOku'
import TopluDuzenle from '@/components/admin/TopluDuzenle'
import { ListChecks, Plus, Receipt, HandCoins, AlertTriangle, FileText, Printer, CheckCircle2, Ban, Copy, Trash2, X, Coins, Wallet } from 'lucide-react'

const DURUM: Record<string, { l: string; tone: any }> = { taslak: { l: 'Taslak', tone: 'muted' }, onaylandi: { l: 'Açık', tone: 'blue' }, odendi: { l: 'Ödendi', tone: 'green' }, iptal: { l: 'İptal', tone: 'red' } }
const TIP: Record<string, { l: string; tone: any }> = { satis: { l: 'Satış', tone: 'green' }, alis: { l: 'Alış', tone: 'amber' }, iade: { l: 'İade', tone: 'muted' } }
type Kalem = { urun_adi: string; variant_id: string | null; miktar: number; birim: string; birim_fiyat: number; kdv_orani: number; not?: string }
const bosKalem = (kdv = 20): Kalem => ({ urun_adi: '', variant_id: null, miktar: 1, birim: 'adet', birim_fiyat: 0, kdv_orani: kdv })

export default function FaturalarPage() {
  const toast = useToast()
  const [cariler, setCariler] = useState<any[]>([])
  const [kasalar, setKasalar] = useState<any[]>([])
  const [variants, setVariants] = useState<any[]>([])
  const [listeler, setListeler] = useState<any[]>([])
  const [listeKalem, setListeKalem] = useState<any[]>([])
  const [kademeler, setKademeler] = useState<any[]>([])
  const [odemeler, setOdemeler] = useState<any[]>([])

  const [tab, setTab] = useState('hepsi')
  const [tipF, setTipF] = useState('')
  const [donem, setDonem] = useState<Donem>('tumu')
  const [detay, setDetay] = useState<any>(null)
  const [kalemYuk, setKalemYuk] = useState(false)
  const [dKalem, setDKalem] = useState<any[]>([])
  const [modal, setModal] = useState(false)
  const [odeme, setOdeme] = useState<any>(null)
  const [doviz, setDoviz] = useState<any>(null)
  const [busy, setBusy] = useState(false)
  const [toplu, setToplu] = useState<any[] | null>(null)

  const [form, setForm] = useState<any>({})
  const [kalemler, setKalemler] = useState<Kalem[]>([bosKalem()])

  const [ozet, setOzet] = useState<any>(null)
  const [surum, setSurum] = useState(0)

  // Referans tabloları (küçük): cari, kasa, varyant, fiyat listeleri
  useEffect(() => {
    Promise.all([
      muh.all('cari_hesaplar', 'id,ad,tip,fiyat_listesi_id'), muh.all('kasa_banka_hesaplari', 'id,ad,tip,aktif,para_birimi'),
      muh.all('product_variants', 'id,product_id,name,color,size,stock'), muh.all('products', 'id,name,code'),
      erp.from('fiyat_listeleri').select('*'), erp.from('fiyat_listesi_kalemleri').select('*'), erp.from('iskonto_kademeleri').select('*'),
    ]).then(([c, k, v, pr, fl, fk, ik]) => {
      const pm: Record<string, any> = {}; pr.forEach((p: any) => pm[p.id] = p)
      setCariler(c); setKasalar(k.filter((x: any) => x.aktif !== false))
      setVariants(v.map((x: any) => ({ ...x, label: [pm[x.product_id]?.name, x.name, x.color, x.size].filter(Boolean).filter((a, i, arr) => arr.indexOf(a) === i).join(' · ') || x.name })))
      setListeler(fl.data || []); setListeKalem(fk.data || []); setKademeler((ik.data || []).filter((x: any) => x.aktif !== false))
    })
  }, [])
  // Değişiklikten sonra: listeyi ve özeti yenile, açık detayı tazele
  const load = useCallback(async () => {
    setSurum(v => v + 1)
    setDetay((d: any) => { if (d) muh.from('v_faturalar_liste').select('*').eq('id', d.id).then((r: any) => { if (r.data?.[0]) setDetay(r.data[0]) }); return d })
  }, [])

  const bugun = todayISO()
  const cariAd = useMemo(() => Object.fromEntries(cariler.map(c => [c.id, c.ad])), [cariler])
  const R = donemAralik(donem)

  const gecikmis = (f: any) => f.durum === 'onaylandi' && f.tip !== 'iade' && !!f.vade && f.vade < bugun
  const filtre = useCallback((q: any) => {
    if (tipF) q = q.eq('tip', tipF)
    if (R.from) q = q.gte('tarih', R.from)
    if (R.to) q = q.lte('tarih', R.to)
    if (tab === 'gecikmis') q = q.eq('durum', 'onaylandi').neq('tip', 'iade').lt('vade', bugun)
    else if (tab !== 'hepsi') q = q.eq('durum', tab)
    return q
  }, [tipF, R.from, R.to, tab, bugun])
  useEffect(() => { setOzet(null); muh.rpc('rpc_fatura_ozet', { p_from: R.from, p_to: R.to }).then(setOzet).catch(() => setOzet({})) }, [R.from, R.to, surum]) // eslint-disable-line
  const server: ServerMode<any> = {
    deps: [tab, tipF, donem, surum],
    fetch: ({ page, size, q, sort }) => muh.page('v_faturalar_liste', '*', { build: filtre, search: q, searchIn: ['no', 'cari_ad'], sort: sort || { key: 'tarih', dir: 'desc' }, tieBreak: 'created_at', page, size }),
  }
  const oz = ozet || {}
  const acikAlacak = +oz.acik_alacak || 0, acikBorc = +oz.acik_borc || 0, donemSatis = +oz.satis_donem || 0

  /* ── Yardımcılar ── */
  const varsayilanListe = listeler.find(l => l.varsayilan)?.id
  function fiyatBul(variantId: string, cariId: string, miktar: number, tip: string) {
    const cari = cariler.find(c => c.id === cariId)
    const lid = cari?.fiyat_listesi_id || varsayilanListe
    const item = listeKalem.find(k => k.fiyat_listesi_id === lid && k.variant_id === variantId)
    if (!item) return { fiyat: 0, iskonto: 0 }
    const isk = tip === 'satis' ? Math.max(0, ...kademeler.filter(k => +k.min_miktar <= miktar).map(k => +k.iskonto_yuzdesi)) : 0
    return { fiyat: +(+item.fiyat * (1 - isk / 100)).toFixed(4), iskonto: isk }
  }
  // Sıradaki fatura no: yalnızca bu yılın son numaraları sorgulanır
  const sonrakiNo = async () => {
    const y = new Date().getFullYear(), pre = `F-${y}-`
    const r: any = await muh.from('faturalar').select('no').ilike('no', pre).order('no', { ascending: false }).limit(50)
    const max = Math.max(0, ...(r.data || []).filter((f: any) => f.no?.startsWith(pre)).map((f: any) => +f.no.slice(pre.length) || 0))
    return `${pre}${String(max + 1).padStart(4, '0')}`
  }
  const yeniForm = async (o: any = {}) => ({ tip: 'satis', no: await sonrakiNo(), cari_id: '', tarih: todayISO(), vade: '', notlar: '', para_birimi: 'TRY', kur: '1', ...o })

  const araToplam = kalemler.reduce((s, k) => s + k.miktar * k.birim_fiyat, 0)
  const kdvToplam = kalemler.reduce((s, k) => s + (k.miktar * k.birim_fiyat * k.kdv_orani) / 100, 0)
  const kur = form.para_birimi === 'TRY' ? 1 : +form.kur || 1
  const genelDoviz = araToplam + kdvToplam, genel = genelDoviz * kur

  function setKalem(i: number, patch: Partial<Kalem>) { setKalemler(ks => ks.map((k, j) => (j === i ? { ...k, ...patch } : k))) }
  function urunSec(i: number, text: string) {
    const v = variants.find(x => x.label === text)
    if (!v) { setKalem(i, { urun_adi: text, variant_id: null }); return }
    const { fiyat, iskonto } = fiyatBul(v.id, form.cari_id, kalemler[i].miktar, form.tip)
    setKalem(i, { urun_adi: v.label, variant_id: v.id, birim_fiyat: fiyat || kalemler[i].birim_fiyat, not: iskonto ? `Kademe iskontosu %${iskonto} uygulandı` : undefined })
  }
  function miktarDegis(i: number, m: number) {
    const k = kalemler[i]
    if (k.variant_id) { const { fiyat, iskonto } = fiyatBul(k.variant_id, form.cari_id, m, form.tip); if (fiyat) return setKalem(i, { miktar: m, birim_fiyat: fiyat, not: iskonto ? `Kademe iskontosu %${iskonto} uygulandı` : undefined }) }
    setKalem(i, { miktar: m })
  }

  async function save(onayla: boolean) {
    if (busy) return
    if (!form.no) return toast.show('Fatura no gerekli', true)
    if (!kalemler.some(k => k.urun_adi && k.miktar > 0)) return toast.show('En az bir kalem gir', true)
    const dup: any = await muh.from('faturalar').select('id').eq('no', form.no).eq('tip', form.tip).limit(1)
    if (dup.data?.length && !confirm(`${form.no} numaralı bir ${TIP[form.tip].l.toLowerCase()} faturası zaten var. Yine de kaydedilsin mi?`)) return
    if (onayla && !form.cari_id && !confirm('Cari seçilmedi; cari bakiyesi etkilenmeyecek. Devam edilsin mi?')) return
    setBusy(true)
    try {
      const gecerli = kalemler.filter(k => k.urun_adi && k.miktar > 0)
      const r: any = await muh.from('faturalar').insert({
        tip: form.tip, no: form.no, cari_id: form.cari_id || null, tarih: form.tarih, vade: form.vade || null, notlar: form.notlar || null, para_birimi: form.para_birimi, kur,
        kdv_orani: gecerli[0].kdv_orani, ara_toplam: araToplam * kur, kdv_tutari: kdvToplam * kur, toplam: genel, doviz_tutari: form.para_birimi !== 'TRY' ? genelDoviz : null, durum: 'taslak',
      })
      if (r?.error) throw new Error(r.error)
      const id = r.data?.[0]?.id
      const k: any = await muh.from('fatura_kalemleri').insert(gecerli.map(x => ({ fatura_id: id, urun_adi: x.urun_adi, variant_id: x.variant_id, miktar: x.miktar, birim: x.birim, birim_fiyat: x.birim_fiyat, kdv_orani: x.kdv_orani, toplam: x.miktar * x.birim_fiyat * (1 + x.kdv_orani / 100) })))
      if (k?.error) throw new Error(k.error)
      if (onayla) { const u: any = await muh.from('faturalar').update({ durum: 'onaylandi' }).eq('id', id); if (u?.error) throw new Error(u.error) }
      toast.show(onayla ? 'Fatura oluşturuldu ve onaylandı' : 'Taslak kaydedildi'); setModal(false); await load()
    } catch (e: any) { toast.show(e.message, true) }
    setBusy(false)
  }

  async function durumDegis(f: any, d: string) {
    const msg = d === 'iptal' ? `${f.no} iptal edilsin mi? Cari bakiye ve stok hareketleri geri alınır.${odemeler.some(o => o.fatura_id === f.id) ? '\n\nDİKKAT: Faturaya bağlı ödeme kayıtları ayrıca silinmelidir.' : ''}` : `${f.no} onaylansın mı? Cari bakiye ve stok işlenir.`
    if (!confirm(msg)) return
    const r: any = await muh.from('faturalar').update({ durum: d, updated_at: new Date().toISOString() }).eq('id', f.id)
    if (r?.error) return toast.show(r.error, true)
    toast.show(d === 'iptal' ? 'Fatura iptal edildi' : 'Fatura onaylandı'); load()
  }
  async function topluSil(sel: any[]): Promise<string | void> {
    const { silinen, hata } = await topluSilCalistir(sel, async (r: any) => {
        if (r.durum !== 'taslak') return `${r.no}: sadece taslak faturalar silinebilir`
        const { data: ks } = await muh.from('fatura_kalemleri').select('id').eq('fatura_id', r.id)
        for (const k of ks || []) { const e: any = await muh.from('fatura_kalemleri').delete().eq('id', k.id); if (e?.error) return String(e.error) }
        return (await muh.from('faturalar').delete().eq('id', r.id))?.error
      }, 'fatura')
    load(); setDetay(null)
    if (hata) return hata
    toast.show(`${silinen} fatura silindi`)
  }
  async function sil(f: any) {
    if (f.durum !== 'taslak') return toast.show('Sadece taslak faturalar silinebilir', true)
    if (!confirm(`${f.no} taslağı silinsin mi?`)) return
    const { data: ks } = await muh.from('fatura_kalemleri').select('id').eq('fatura_id', f.id)
    for (const k of ks || []) await muh.from('fatura_kalemleri').delete().eq('id', k.id)
    const r: any = await muh.from('faturalar').delete().eq('id', f.id)
    if (r?.error) return toast.show(r.error, true)
    toast.show('Taslak silindi'); setDetay(null); load()
  }

  async function kopyala(f: any) {
    const { data } = await muh.from('fatura_kalemleri').select('*').eq('fatura_id', f.id)
    setForm(await yeniForm({ tip: f.tip, cari_id: f.cari_id || '', para_birimi: f.para_birimi || 'TRY', kur: String(f.kur || 1), notlar: f.notlar || '' }))
    setKalemler((data || []).map((k: any) => ({ urun_adi: k.urun_adi, variant_id: k.variant_id, miktar: +k.miktar, birim: k.birim || 'adet', birim_fiyat: +k.birim_fiyat, kdv_orani: +k.kdv_orani })))
    setDetay(null); setModal(true)
  }

  async function kaydetOdeme(e: React.FormEvent) {
    e.preventDefault(); if (busy || !odeme) return
    const f = odeme.f, t = +odeme.tutar, kalan = kalanTutar(f)
    if (!(t > 0)) return toast.show('Tutar gerekli', true)
    if (t > kalan + 0.01 && !confirm(`Tutar kalan bakiyeyi (${fmt(kalan)}) aşıyor. Devam edilsin mi?`)) return
    setBusy(true)
    try {
      const gelir = f.tip === 'satis'
      const r: any = await muh.from('islemler').insert({ tip: gelir ? 'gelir' : 'gider', kategori: gelir ? 'Fatura Tahsilatı' : 'Fatura Ödemesi', tutar: t, tarih: odeme.tarih, odeme_yontemi: odeme.yontem, cari_id: f.cari_id || null, kasa_hesap_id: odeme.kasa || null, fatura_id: f.id, aciklama: `${f.no} ${gelir ? 'tahsilatı' : 'ödemesi'}` })
      if (r?.error) throw new Error(r.error)
      const yeniOdenen = +(+f.odenen_tutar || 0) + t
      const u: any = await muh.from('faturalar').update({ odenen_tutar: yeniOdenen, ...(yeniOdenen >= +f.toplam - 0.01 ? { durum: 'odendi' } : {}), updated_at: new Date().toISOString() }).eq('id', f.id)
      if (u?.error) throw new Error(u.error)
      toast.show(yeniOdenen >= +f.toplam - 0.01 ? 'Fatura tamamen kapandı' : 'Kısmi ödeme kaydedildi'); setOdeme(null); await load()
    } catch (err: any) { toast.show(err.message, true) }
    setBusy(false)
  }

  // Döviz faturası: güncel kurla tahsilat — gerçek TL girişi + cari kapama + kur farkı (K/Z dışı, bilgi amaçlı)
  async function dovizTahsil(e: React.FormEvent) {
    e.preventDefault(); if (busy || !doviz) return
    const f = doviz.f, D = +f.doviz_tutari || 0, K0 = +f.kur || 1, K1 = +doviz.kur
    const gercek = D * K1, orijinal = D * K0, fark = gercek - orijinal
    setBusy(true)
    try {
      const kasaObj = kasalar.find(k => k.id === doviz.kasa)
      const kasaAlan = kasaPb(kasaObj) === 'TRY' ? { tutar: gercek } : islemAlan(kasaObj, D, K1)   // döviz hesabına: döviz tutarı + kur
      const a: any = await muh.from('islemler').insert({ tip: 'gelir', ...kasaAlan, kategori: 'Döviz Tahsilatı', tarih: todayISO(), kasa_hesap_id: doviz.kasa, fatura_id: f.id, aciklama: `${f.no} — ${D} ${f.para_birimi} × ${K1}` })
      if (a?.error) throw new Error(a.error)
      await muh.from('islemler').insert({ tip: 'gelir', tutar: orijinal, kategori: 'Fatura Kapama', tarih: todayISO(), cari_id: f.cari_id, fatura_id: f.id, aciklama: `${f.no} kapatma (fatura kuru: ${K0})` })
      if (Math.abs(fark) > 0.01) await muh.from('islemler').insert({ tip: fark > 0 ? 'gelir' : 'gider', tutar: Math.abs(fark), kategori: fark > 0 ? 'Kur Farkı Geliri' : 'Kur Farkı Gideri', tarih: todayISO(), fatura_id: f.id, aciklama: `${f.no} — fatura kuru ${K0}, tahsilat kuru ${K1}` })
      await muh.from('faturalar').update({ durum: 'odendi', odenen_tutar: f.toplam, updated_at: new Date().toISOString() }).eq('id', f.id)
      toast.show('Tahsilat ve kur farkı işlendi'); setDoviz(null); await load()
    } catch (err: any) { toast.show(err.message, true) }
    setBusy(false)
  }

  async function yazdir(f: any) {
    const { data: kalem } = await muh.from('fatura_kalemleri').select('*').eq('fatura_id', f.id)
    const satirlar = (kalem || []).map((k: any) => `<tr><td>${k.urun_adi || ''}</td><td style="text-align:right">${k.miktar} ${k.birim || 'adet'}</td><td style="text-align:right">${fmt(k.birim_fiyat)}</td><td style="text-align:right">%${k.kdv_orani ?? 20}</td><td style="text-align:right">${fmt(k.toplam ?? k.miktar * k.birim_fiyat * (1 + (k.kdv_orani ?? 20) / 100))}</td></tr>`).join('')
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>${f.no}</title><style>body{font-family:Arial,sans-serif;color:#0b0e0b;padding:40px;max-width:800px;margin:0 auto}h1{font-size:20px;margin:0 0 4px}.muted{color:#6b7366;font-size:12px}table{width:100%;border-collapse:collapse;margin-top:24px}th,td{padding:8px 6px;font-size:13px;border-bottom:1px solid #ddd;text-align:left}th{color:#6b7366;font-size:11px;text-transform:uppercase}.toplam{margin-top:16px;text-align:right;font-size:15px;font-weight:700}.header{display:flex;justify-content:space-between;border-bottom:2px solid #e55f28;padding-bottom:16px;margin-bottom:16px}@media print{body{padding:0}}</style></head><body>
      <div class="header"><div><h1>ALYA PLASTİK</h1><p class="muted">${TIP[f.tip]?.l} Faturası</p></div><div style="text-align:right"><h1>${f.no}</h1><p class="muted">${fmtDate(f.tarih)}${f.vade ? ` · Vade: ${fmtDate(f.vade)}` : ''}</p></div></div>
      <p><b>${f.tip === 'satis' ? 'Müşteri' : 'Tedarikçi'}:</b> ${cariAd[f.cari_id] || '—'}</p>
      <table><thead><tr><th>Ürün</th><th style="text-align:right">Miktar</th><th style="text-align:right">Birim Fiyat</th><th style="text-align:right">KDV</th><th style="text-align:right">Toplam</th></tr></thead><tbody>${satirlar}</tbody></table>
      <div class="toplam"><p class="muted">Ara Toplam: ${fmt(f.ara_toplam)}</p><p class="muted">KDV: ${fmt(f.kdv_tutari)}</p><p>Genel Toplam: ${fmt(f.toplam)}</p>${f.para_birimi && f.para_birimi !== 'TRY' ? `<p class="muted">(${(+f.doviz_tutari || 0).toFixed(2)} ${f.para_birimi} × kur ${f.kur})</p>` : ''}</div>
      ${f.notlar ? `<p class="muted" style="margin-top:24px">${f.notlar}</p>` : ''}</body></html>`
    const w = window.open('', '_blank'); if (w) { w.document.write(html); w.document.close(); w.focus(); setTimeout(() => w.print(), 300) }
  }

  useAcParam(true, async id => { const r: any = await muh.from('v_faturalar_liste').select('*').eq('id', id); if (r.data?.[0]) openDetay(r.data[0]) })

  async function openDetay(f: any) {
    setDetay(f); setDKalem([]); setOdemeler([]); setKalemYuk(true)
    const [k, o] = await Promise.all([muh.from('fatura_kalemleri').select('*').eq('fatura_id', f.id), muh.from('islemler').select('id,fatura_id,tutar,tip,tarih,kategori,kasa_hesap_id,odeme_yontemi').eq('fatura_id', f.id)])
    setDKalem(k.data || []); setOdemeler(o.data || []); setKalemYuk(false)
  }

  const cols: Col<any>[] = [
    { key: 'no', sortKey: 'no', label: 'Fatura', csv: f => f.no, render: f => <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Badge tone={TIP[f.tip]?.tone}>{TIP[f.tip]?.l}</Badge><b style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: 12 }}>{f.no}</b></div> },
    { key: 'cari', sortKey: 'cari_ad', label: 'Cari', csv: f => f.cari_ad, render: f => f.cari_ad || <span style={{ color: 'var(--adm-tx3)' }}>—</span> },
    { key: 'tarih', sortKey: 'tarih', label: 'Tarih', width: 96, render: f => fmtDate(f.tarih), hideSm: true },
    {
      key: 'vade', sortKey: 'vade', label: 'Vade', width: 120, hideSm: true,
      render: f => !f.vade ? <span style={{ color: 'var(--adm-tx3)' }}>—</span> : <div><div>{fmtDate(f.vade)}</div>{gecikmis(f) && <div style={{ fontSize: 10.5, color: 'var(--adm-red)', fontWeight: 700 }}>{daysBetween(f.vade)} gün gecikti</div>}</div>,
    },
    { key: 'toplam', sortKey: 'toplam', label: 'Toplam', align: 'right', render: f => <div><Money v={+f.toplam} />{f.para_birimi !== 'TRY' && f.doviz_tutari && <div style={{ fontSize: 10.5, color: 'var(--adm-tx3)' }}>{(+f.doviz_tutari).toFixed(2)} {f.para_birimi}</div>}</div>, csv: f => +f.toplam },
    {
      key: 'kalan', label: 'Ödeme', width: 130,
      render: f => {
        if (!['onaylandi', 'odendi'].includes(f.durum)) return <span style={{ color: 'var(--adm-tx3)' }}>—</span>
        const p = Math.min(100, ((+f.odenen_tutar || 0) / (+f.toplam || 1)) * 100)
        return <div><div style={{ height: 5, background: 'var(--adm-s2)', borderRadius: 4, overflow: 'hidden' }}><div style={{ width: `${f.durum === 'odendi' ? 100 : p}%`, height: '100%', background: 'var(--adm-green)' }} /></div><div style={{ fontSize: 10.5, color: 'var(--adm-tx3)', marginTop: 3 }}>{f.durum === 'odendi' ? 'tamamı ödendi' : `kalan ${fmt(kalanTutar(f))}`}</div></div>
      },
    },
    { key: 'durum', sortKey: 'durum', label: 'Durum', width: 110, csv: f => f.durum, render: f => gecikmis(f) ? <Badge tone="red">Gecikmiş</Badge> : <Badge tone={DURUM[f.durum]?.tone}>{DURUM[f.durum]?.l}</Badge> },
  ]

  const dOdemeler = detay ? odemeler.filter(o => o.fatura_id === detay.id) : []
  const kasaAd = Object.fromEntries(kasalar.map(k => [k.id, k.ad]))
  // AI ile okunan belge verisini forma doldurur (kayıt için kullanıcı kontrol edip onaylar)
  const norm = (t: string) => t.toLocaleLowerCase('tr').replace(/\b(a\.?ş\.?|ltd\.?|şti\.?|san\.?|tic\.?|ve|sanayi|ticaret|limited|anonim|şirketi)\b/g, ' ').replace(/[^a-z0-9ğüşıöç]+/g, ' ').trim()
  function belgedenDoldur(b: BelgeSonuc) {
    const kalemDoldur: Kalem[] = b.kalemler.filter(k => k.aciklama).map(k => {
      const kdv = k.kdv_orani ?? 20, miktar = k.miktar && k.miktar > 0 ? k.miktar : 1
      const fiyat = k.birim_fiyat ?? (k.toplam != null ? +(k.toplam / miktar / (1 + kdv / 100)).toFixed(4) : 0)
      return { urun_adi: k.aciklama, variant_id: null, miktar, birim: k.birim || 'adet', birim_fiyat: fiyat, kdv_orani: kdv }
    })
    const aday = norm(b.satici || '')
    const cari = aday ? cariler.find(c => { const n = norm(c.ad); return n && (n === aday || n.includes(aday) || aday.includes(n)) }) : null
    const pb = ['TRY', 'USD', 'EUR', 'GBP', 'RUB'].includes(b.para_birimi) ? b.para_birimi : 'TRY'
    setForm((f: any) => ({ ...f, no: b.belge_no || f.no, tarih: b.tarih || f.tarih, para_birimi: pb, kur: pb === 'TRY' ? '1' : f.kur, cari_id: cari?.id || f.cari_id, notlar: [f.notlar, b.notlar && `AI notu: ${b.notlar}`].filter(Boolean).join('\n') }))
    if (kalemDoldur.length) setKalemler(kalemDoldur)
    const hesap = kalemDoldur.reduce((t, k) => t + k.miktar * k.birim_fiyat * (1 + k.kdv_orani / 100), 0)
    const fark = b.genel_toplam != null && hesap > 0 && Math.abs(hesap - b.genel_toplam) / b.genel_toplam > 0.01
    toast.show(`Belge okundu (güven: ${b.guven}). ${cari ? '' : `Cari eşleşmedi${b.satici ? ` (${b.satici})` : ''}. `}${fark ? `Toplam uyuşmuyor: belge ${fmt(b.genel_toplam!)} / hesaplanan ${fmt(hesap)}. ` : ''}Lütfen kontrol et.`, !cari || fark || b.guven === 'dusuk')
  }

  const cariSec = cariler.filter(c => (form.tip === 'alis' ? c.tip !== 'musteri' : form.tip === 'satis' ? c.tip !== 'tedarikci' : true))

  return (
    <div style={{ flex: 1, overflow: 'auto' }}>
      <AdminTopBar title="Faturalar" />
      <Page>
        <PageHead title="Fatura Yönetimi" sub="Satış, alış ve iade faturaları · kısmi tahsilat/ödeme · vade takibi"
          actions={<button className="adm-btn" onClick={async () => { setForm(await yeniForm()); setKalemler([bosKalem()]); setModal(true) }}><Plus size={14} />Yeni Fatura</button>} />

        <Yardim sayfa="faturalar" sekme={tab} />
        <KpiGrid min={190}>
          <Kpi label="Satış (dönem)" value={fmtK(donemSatis)} Icon={Receipt} color="var(--adm-green)" sub={donem === 'tumu' ? 'Tüm zamanlar' : DONEMLER.find(d => d.v === donem)?.l} />
          <Kpi label="Açık Alacak" value={fmtK(acikAlacak)} Icon={HandCoins} color="var(--adm-blue)" sub={`${oz.acik_alacak_adet || 0} açık satış faturası`} />
          <Kpi label="Ödenecek" value={fmtK(acikBorc)} Icon={Wallet} color="#8b5cf6" sub={`${oz.acik_borc_adet || 0} açık alış faturası`} />
          <Kpi label="Vadesi Geçen" value={fmtK(+oz.gecikmis_tutar || 0)} Icon={AlertTriangle} color={+oz.gecikmis ? 'var(--adm-red)' : 'var(--adm-green)'} sub={`${oz.gecikmis || 0} fatura`} onClick={() => setTab('gecikmis')} />
          <Kpi label="Taslak" value={oz.taslak || 0} Icon={FileText} color="var(--adm-amber)" sub="onay bekliyor" onClick={() => setTab('taslak')} />
        </KpiGrid>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 12, alignItems: 'center' }}>
          <Tabs value={tab} onChange={setTab} tabs={[
            { v: 'hepsi', l: 'Tümü', n: oz.toplam }, { v: 'taslak', l: 'Taslak', n: oz.taslak }, { v: 'onaylandi', l: 'Açık', n: oz.acik },
            { v: 'gecikmis', l: 'Gecikmiş', n: oz.gecikmis }, { v: 'odendi', l: 'Ödendi', n: oz.odendi }, { v: 'iptal', l: 'İptal', n: oz.iptal },
          ]} />
          <Tabs value={tipF} onChange={setTipF} tabs={[{ v: '', l: 'Tüm türler' }, { v: 'satis', l: 'Satış' }, { v: 'alis', l: 'Alış' }, { v: 'iade', l: 'İade' }]} />
          <select className="adm-sel" value={donem} onChange={e => setDonem(e.target.value as Donem)}>{DONEMLER.map(d => <option key={d.v} value={d.v}>{d.l}</option>)}</select>
        </div>

        <DataGrid rows={[]} server={server} cols={cols} rowKey={f => f.id} onBulkDelete={topluSil} deleteNoun="fatura" deleteNote="Sadece taslak faturalar (kalemleriyle birlikte) silinir." csvName="faturalar" storageKey="faturalar-srv" onRowClick={openDetay} activeKey={detay?.id}
          searchPlaceholder="Fatura no, cari..." emptyTitle="Fatura bulunamadı" emptySub="Yeni Fatura ile başla" selectable
          bulkActions={sel => <button className="adm-btn-ghost" style={{ padding: '3px 12px', fontSize: 12 }} onClick={() => setToplu(sel)}><ListChecks size={12} />Toplu düzenle</button>} />
      </Page>

      {/* Detay */}
      <Drawer open={!!detay} onClose={() => setDetay(null)} width={600}
        title={detay && <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}><Badge tone={TIP[detay.tip]?.tone}>{TIP[detay.tip]?.l}</Badge>{detay.no}{gecikmis(detay) ? <Badge tone="red">Gecikmiş</Badge> : <Badge tone={DURUM[detay.durum]?.tone}>{DURUM[detay.durum]?.l}</Badge>}</span>}
        sub={detay && `${cariAd[detay.cari_id] || 'Cari seçilmedi'} · ${fmtDate(detay.tarih)}`}
        footer={detay && <>
          <button className="adm-btn-ghost" onClick={() => yazdir(detay)}><Printer size={13} />Yazdır</button>
          <button className="adm-btn-ghost" onClick={() => kopyala(detay)}><Copy size={13} />Kopyala</button>
          {detay.durum === 'taslak' && <><button className="adm-btn-danger" onClick={() => sil(detay)}><Trash2 size={13} />Sil</button><button className="adm-btn" onClick={() => durumDegis(detay, 'onaylandi')}><CheckCircle2 size={14} />Onayla</button></>}
          {detay.durum === 'onaylandi' && <>
            <button className="adm-btn-ghost" style={{ color: 'var(--adm-red)' }} onClick={() => durumDegis(detay, 'iptal')}><Ban size={13} />İptal Et</button>
            {detay.para_birimi !== 'TRY' && detay.tip === 'satis'
              ? <button className="adm-btn" onClick={() => setDoviz({ f: detay, kur: String(detay.kur || ''), kasa: kasalar.find(trKasa)?.id || '' })}><Coins size={14} />Kurla Tahsil Et</button>
              : detay.tip !== 'iade' && <button className="adm-btn" onClick={() => setOdeme({ f: detay, tutar: String(kalanTutar(detay).toFixed(2)), kasa: kasalar.find(trKasa)?.id || '', tarih: todayISO(), yontem: 'havale' })}><HandCoins size={14} />{detay.tip === 'satis' ? 'Tahsilat Ekle' : 'Ödeme Ekle'}</button>}
          </>}
        </>}>
        {detay && (
          <div style={{ padding: 20 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 16 }}>
              <div style={{ padding: 12, borderRadius: 10, background: 'var(--adm-s2)' }}><div className="adm-kpi-label" style={{ marginBottom: 4 }}>Toplam</div><Money v={+detay.toplam} size={16} /></div>
              <div style={{ padding: 12, borderRadius: 10, background: 'var(--adm-green2)' }}><div className="adm-kpi-label" style={{ marginBottom: 4 }}>{detay.tip === 'satis' ? 'Tahsil Edilen' : 'Ödenen'}</div><Money v={detay.durum === 'odendi' ? +detay.toplam : +detay.odenen_tutar || 0} tone="green" size={16} /></div>
              <div style={{ padding: 12, borderRadius: 10, background: gecikmis(detay) ? 'var(--adm-red2)' : 'var(--adm-s2)' }}><div className="adm-kpi-label" style={{ marginBottom: 4 }}>Kalan</div><Money v={detay.durum === 'onaylandi' ? kalanTutar(detay) : 0} tone={gecikmis(detay) ? 'red' : undefined} size={16} /></div>
            </div>
            <InfoRow k="Vade" v={detay.vade ? `${fmtDate(detay.vade)}${gecikmis(detay) ? ` (${daysBetween(detay.vade)} gün gecikti)` : ''}` : '—'} />
            {detay.para_birimi !== 'TRY' && <InfoRow k="Döviz" v={`${(+detay.doviz_tutari || 0).toFixed(2)} ${detay.para_birimi} × ${detay.kur}`} />}
            <Divider label="Kalemler" />
            {dKalem.length === 0 ? <p style={{ fontSize: 12.5, color: 'var(--adm-tx3)' }}>{kalemYuk ? 'Yükleniyor...' : 'Bu faturada kalem satırı kaydedilmemiş (sadece fatura toplamı var).'}</p> : (
              <table className="adm-tbl compact"><thead><tr><th>Ürün</th><th style={{ textAlign: 'right' }}>Miktar</th><th style={{ textAlign: 'right' }}>B.Fiyat</th><th style={{ textAlign: 'right' }}>KDV</th><th style={{ textAlign: 'right' }}>Toplam</th></tr></thead>
                <tbody>{dKalem.map(k => <tr key={k.id}><td>{k.urun_adi}{k.variant_id && <Badge tone="blue" style={{ marginLeft: 6, fontSize: 9.5 }}>stok</Badge>}</td><td style={{ textAlign: 'right' }}>{k.miktar} {k.birim}</td><td style={{ textAlign: 'right' }}>{fmt(k.birim_fiyat)}</td><td style={{ textAlign: 'right' }}>%{k.kdv_orani}</td><td style={{ textAlign: 'right' }}><b>{fmt(k.toplam)}</b></td></tr>)}</tbody></table>
            )}
            <div style={{ textAlign: 'right', marginTop: 10, fontSize: 12.5, color: 'var(--adm-tx3)' }}>Ara toplam {fmt(detay.ara_toplam)} · KDV {fmt(detay.kdv_tutari)}</div>
            <Divider label={`Ödeme geçmişi (${dOdemeler.length})`} />
            {dOdemeler.length === 0 ? <p style={{ fontSize: 12.5, color: 'var(--adm-tx3)', margin: 0 }}>Bu faturaya bağlı ödeme kaydı yok.</p> : dOdemeler.map(o => (
              <div key={o.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', fontSize: 12.5, borderBottom: '1px dashed var(--adm-bdr)' }}>
                <span>{fmtDate(o.tarih)} · {o.kategori}{o.kasa_hesap_id ? ` · ${kasaAd[o.kasa_hesap_id] || ''}` : ''}</span><Money v={+o.tutar} tone={o.tip === 'gelir' ? 'green' : 'red'} />
              </div>))}
            {detay.notlar && <><Divider label="Not" /><p style={{ fontSize: 12.5, color: 'var(--adm-tx2)', margin: 0, whiteSpace: 'pre-wrap' }}>{detay.notlar}</p></>}
          </div>
        )}
      </Drawer>

      {/* Yeni fatura */}
      <Modal open={modal} onClose={() => setModal(false)} title="Yeni Fatura" width={900}
        footer={<>
          <span style={{ marginRight: 'auto', fontSize: 13 }}>Ara {fmt(araToplam * kur)} · KDV {fmt(kdvToplam * kur)} · <b style={{ color: 'var(--adm-green)', fontSize: 15 }}>{fmt(genel)}</b></span>
          <button type="button" className="adm-btn-ghost" onClick={() => setModal(false)}>İptal</button>
          <button type="button" className="adm-btn-ghost" disabled={busy} onClick={() => save(false)}>Taslak Kaydet</button>
          <button type="button" className="adm-btn" disabled={busy} onClick={() => save(true)}><CheckCircle2 size={14} />Kaydet ve Onayla</button>
        </>}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <BelgeOku onSonuc={belgedenDoldur} onHata={m => toast.show(m, true)} />
          <span style={{ fontSize: 11.5, color: 'var(--adm-tx3)' }}>Fatura/irsaliye fotoğrafı veya PDF'i yükle; alanlar otomatik dolar, sen kontrol edip kaydet.</span>
        </div>
        <FormGrid cols={4}>
          <Field label="Tür"><select className="adm-inp" value={form.tip} onChange={e => setForm((f: any) => ({ ...f, tip: e.target.value, cari_id: '' }))}><option value="satis">Satış</option><option value="alis">Alış</option><option value="iade">İade</option></select></Field>
          <Field label="Fatura No *"><input className="adm-inp" value={form.no || ''} onChange={e => setForm((f: any) => ({ ...f, no: e.target.value }))} /></Field>
          <Field label="Tarih"><input type="date" className="adm-inp" value={form.tarih || ''} onChange={e => setForm((f: any) => ({ ...f, tarih: e.target.value }))} /></Field>
          <Field label="Vade"><input type="date" className="adm-inp" value={form.vade || ''} onChange={e => setForm((f: any) => ({ ...f, vade: e.target.value }))} /></Field>
          <Field label="Cari" span={2}><select className="adm-inp" value={form.cari_id || ''} onChange={e => { const c = cariler.find(x => x.id === e.target.value); setForm((f: any) => ({ ...f, cari_id: e.target.value })); if (c && !form.vade) { /* vade önerisi yok */ } }}><option value="">— Seçin —</option>{cariSec.map(c => <option key={c.id} value={c.id}>{c.ad}</option>)}</select></Field>
          <Field label="Para Birimi"><select className="adm-inp" value={form.para_birimi} onChange={e => setForm((f: any) => ({ ...f, para_birimi: e.target.value, kur: e.target.value === 'TRY' ? '1' : f.kur }))}>{['TRY', 'USD', 'EUR', 'GBP', 'RUB'].map(p => <option key={p}>{p}</option>)}</select></Field>
          {form.para_birimi !== 'TRY' ? <Field label={`Kur (1 ${form.para_birimi} = ₺)`}><input type="number" step="0.0001" className="adm-inp" value={form.kur} onChange={e => setForm((f: any) => ({ ...f, kur: e.target.value }))} /></Field> : <div />}
        </FormGrid>

        <Divider label="Kalemler" />
        <datalist id="urun-list">{variants.map(v => <option key={v.id} value={v.label} />)}</datalist>
        <div style={{ overflow: 'auto' }}>
          <table className="adm-tbl compact">
            <thead><tr><th style={{ minWidth: 220 }}>Ürün / Hizmet</th><th style={{ width: 90 }}>Miktar</th><th style={{ width: 90 }}>Birim</th><th style={{ width: 120 }}>Birim Fiyat</th><th style={{ width: 80 }}>KDV %</th><th style={{ width: 120, textAlign: 'right' }}>Toplam</th><th style={{ width: 30 }} /></tr></thead>
            <tbody>
              {kalemler.map((k, i) => {
                const v = variants.find(x => x.id === k.variant_id)
                const stokUyari = form.tip === 'satis' && v && k.miktar > +v.stock
                return (
                  <tr key={i}>
                    <td>
                      <input className="adm-inp" list="urun-list" placeholder="Stoklu ürün seç ya da serbest yaz" value={k.urun_adi} onChange={e => urunSec(i, e.target.value)} style={{ fontSize: 12.5, padding: '6px 9px' }} />
                      {v && <div style={{ fontSize: 10.5, marginTop: 3, color: stokUyari ? 'var(--adm-red)' : 'var(--adm-tx3)' }}>Stok: {v.stock}{stokUyari ? ' — yetersiz!' : ''}{k.not ? ` · ${k.not}` : ''}</div>}
                    </td>
                    <td><input type="number" step="0.001" min="0" className="adm-inp" value={k.miktar} onChange={e => miktarDegis(i, +e.target.value)} style={{ fontSize: 12.5, padding: '6px 9px' }} /></td>
                    <td><select className="adm-inp" value={k.birim} onChange={e => setKalem(i, { birim: e.target.value })} style={{ fontSize: 12.5, padding: '6px 6px' }}>{['adet', 'kg', 'koli', 'palet', 'metre', 'saat', 'hizmet'].map(b => <option key={b}>{b}</option>)}</select></td>
                    <td><input type="number" step="0.01" min="0" className="adm-inp" value={k.birim_fiyat} onChange={e => setKalem(i, { birim_fiyat: +e.target.value })} style={{ fontSize: 12.5, padding: '6px 9px' }} /></td>
                    <td><select className="adm-inp" value={k.kdv_orani} onChange={e => setKalem(i, { kdv_orani: +e.target.value })} style={{ fontSize: 12.5, padding: '6px 6px' }}>{[0, 1, 10, 20].map(r => <option key={r} value={r}>%{r}</option>)}</select></td>
                    <td style={{ textAlign: 'right' }}><Money v={k.miktar * k.birim_fiyat * (1 + k.kdv_orani / 100)} bold={false} /></td>
                    <td><button type="button" disabled={kalemler.length === 1} onClick={() => setKalemler(ks => ks.filter((_, j) => j !== i))} style={{ background: 'none', border: 'none', color: 'var(--adm-red)' }}><X size={14} /></button></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <button type="button" className="adm-btn-ghost" style={{ marginTop: 10, fontSize: 12 }} onClick={() => setKalemler(ks => [...ks, bosKalem(ks[ks.length - 1]?.kdv_orani ?? 20)])}><Plus size={12} />Kalem Ekle</button>
        <div style={{ marginTop: 14 }}><Field label="Notlar"><textarea className="adm-inp" rows={2} value={form.notlar || ''} onChange={e => setForm((f: any) => ({ ...f, notlar: e.target.value }))} /></Field></div>
        <p style={{ fontSize: 11.5, color: 'var(--adm-tx3)', margin: '10px 0 0' }}>Stoklu ürün seçersen fiyat listesinden birim fiyat ve miktar kademesine göre iskonto otomatik gelir; fatura onaylanınca stok ve cari bakiye otomatik işlenir. DİKKAT: Sevkiyatı yapılmış siparişler için stoklu ürün seçme — stok sevkiyatta zaten düşüyor (siparişten oluşturulan faturalar bu yüzden stoksuz kesilir).</p>
      </Modal>

      {/* Ödeme */}
      <Modal open={!!odeme} onClose={() => setOdeme(null)} onSubmit={kaydetOdeme} width={480} title={odeme && `${odeme.f.no} — ${odeme.f.tip === 'satis' ? 'Tahsilat' : 'Ödeme'}`}
        footer={<><button type="button" className="adm-btn-ghost" onClick={() => setOdeme(null)}>İptal</button><button type="submit" className="adm-btn" disabled={busy}>Kaydet</button></>}>
        {odeme && <FormGrid>
          <Field label="Tutar (₺) *" hint={`Kalan: ${fmt(kalanTutar(odeme.f))}`}><input type="number" step="0.01" required autoFocus className="adm-inp" value={odeme.tutar} onChange={e => setOdeme((o: any) => ({ ...o, tutar: e.target.value }))} style={{ fontSize: 16, fontWeight: 700 }} /></Field>
          <Field label="Tarih"><input type="date" className="adm-inp" value={odeme.tarih} onChange={e => setOdeme((o: any) => ({ ...o, tarih: e.target.value }))} /></Field>
          <Field label="Kasa / Banka"><select className="adm-inp" value={odeme.kasa} onChange={e => setOdeme((o: any) => ({ ...o, kasa: e.target.value }))}><option value="">— Seçilmedi —</option>{kasalar.filter(trKasa).map(k => <option key={k.id} value={k.id}>{k.ad}</option>)}</select></Field>
          <Field label="Yöntem"><select className="adm-inp" value={odeme.yontem} onChange={e => setOdeme((o: any) => ({ ...o, yontem: e.target.value }))}><option value="nakit">Nakit</option><option value="havale">Havale/EFT</option><option value="kredi_karti">Kredi Kartı</option><option value="cek">Çek</option><option value="diger">Diğer</option></select></Field>
          <p style={{ gridColumn: 'span 2', margin: 0, fontSize: 11.5, color: 'var(--adm-tx3)' }}>Ödeme kalan tutarı kapatırsa fatura otomatik “Ödendi” olur; cari ve kasa bakiyeleri güncellenir.</p>
        </FormGrid>}
      </Modal>

      {/* Döviz tahsilat */}
      <Modal open={!!doviz} onClose={() => setDoviz(null)} onSubmit={dovizTahsil} width={500} title={doviz && `${doviz.f.no} — Güncel Kurla Tahsil Et`}
        footer={<><button type="button" className="adm-btn-ghost" onClick={() => setDoviz(null)}>İptal</button><button type="submit" className="adm-btn" disabled={busy}>Tahsil Et</button></>}>
        {doviz && <FormGrid cols={1}>
          <p style={{ margin: 0, fontSize: 12.5, color: 'var(--adm-tx3)' }}>Fatura {doviz.f.doviz_tutari} {doviz.f.para_birimi} olarak kesildi (kur {doviz.f.kur}). Tahsilat günü kurunu gir; gerçek TL girişi, cari kapama ve kur farkı ayrıştırılır.</p>
          <Field label={`Tahsilat Kuru (1 ${doviz.f.para_birimi} = ₺)`}><input type="number" step="0.0001" required className="adm-inp" value={doviz.kur} onChange={e => setDoviz((d: any) => ({ ...d, kur: e.target.value }))} /></Field>
          <Field label="Kasa / Banka *"><select className="adm-inp" required value={doviz.kasa} onChange={e => setDoviz((d: any) => ({ ...d, kasa: e.target.value }))}><option value="">Seçin</option>{kasalar.filter(k => trKasa(k) || kasaPb(k) === doviz.f.para_birimi).map(k => <option key={k.id} value={k.id}>{k.ad}{kasaPb(k) !== 'TRY' ? ` (${kasaPb(k)})` : ''}</option>)}</select></Field>
          {doviz.kur && <p style={{ margin: 0, fontSize: 12.5 }}>Kasaya girecek: <b>{(() => { const ko = kasalar.find(k => k.id === doviz.kasa); return ko && kasaPb(ko) !== 'TRY' ? paraGoster(+doviz.f.doviz_tutari || 0, kasaPb(ko)) : fmt((+doviz.f.doviz_tutari || 0) * +doviz.kur) })()}</b> · Kur farkı: <b style={{ color: +doviz.kur - +doviz.f.kur >= 0 ? 'var(--adm-green)' : 'var(--adm-red)' }}>{fmt(Math.abs((+doviz.f.doviz_tutari || 0) * (+doviz.kur - +doviz.f.kur)))}</b></p>}
        </FormGrid>}
      </Modal>
      <TopluDuzenle rows={toplu} onClose={() => setToplu(null)} onDone={() => { setToplu(null); load() }} client={muh as any} table="faturalar" fields={[
        { key: 'vade', label: 'Vade', type: 'date', bosYapilabilir: true },
        { key: 'notlar', label: 'Notlar', type: 'text', bosYapilabilir: true, hint: 'Mevcut notların yerine yazılır' },
      ]} />
      {toast.node}
    </div>
  )
}
