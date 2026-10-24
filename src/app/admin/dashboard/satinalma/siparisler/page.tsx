'use client'
import { useEffect, useMemo, useState } from 'react'
import AdminTopBar from '@/components/admin/TopBar'
import { useAcParam } from '@/lib/ac-param'
import { erp } from '@/lib/erp-client'
import { web } from '@/lib/web-data'
import { useModuller } from '@/lib/use-moduller'
import { fmt, fmtK, fmtN, fmtDate, fmtDateTime, todayISO, daysBetween } from '@/lib/fmt'
import { useUretim, byId } from '@/lib/uretim-utils'
import { sum } from '@/lib/muh-utils'
import { Page, PageHead, Kpi, KpiGrid, Badge, Tabs, Money, Drawer, Modal, Field, FormGrid, Divider, useToast } from '@/components/admin/erp/ui'
import { DataGrid, type Col } from '@/components/admin/erp/DataGrid'
import { topluSilCalistir } from '@/lib/toplu-sil'
import { Mail, MessageCircle, RotateCcw, ShieldCheck, Settings as AyarIcon, Plus, PackageSearch, PackageCheck, Truck, Printer, Pencil, Trash2, Ban, AlertTriangle, Coins, ShoppingCart, X, CheckCircle2, Send } from 'lucide-react'

const DURUM: Record<string, { l: string; tone: any }> = { beklemede: { l: 'Beklemede', tone: 'muted' }, onaylandi: { l: 'Onaylandı', tone: 'blue' }, yolda: { l: 'Yolda', tone: 'amber' }, teslim_alindi: { l: 'Teslim Alındı', tone: 'green' }, iptal: { l: 'İptal', tone: 'red' } }
type Kalem = { hammadde_id: string; miktar: number; birim_fiyat: number }
const bosKalem = (): Kalem => ({ hammadde_id: '', miktar: 1, birim_fiyat: 0 })

export default function SatinalmaPage() {
  const toast = useToast()
  const { d, loading, reload } = useUretim(['satinalma', 'satinalmaKalemleri', 'hammaddeler', 'cariTam', 'depolar'])
  const [tab, setTab] = useState('acik')
  const [detay, setDetay] = useState<any>(null)
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [form, setForm] = useState<any>({})
  const [kalemler, setKalemler] = useState<Kalem[]>([bosKalem()])
  const [teslim, setTeslim] = useState<any>(null)
  const [busy, setBusy] = useState(false)
  const { has } = useModuller()
  const [onay, setOnay] = useState<{ aktif: boolean; limit: number }>({ aktif: false, limit: 50000 })
  const [onayModal, setOnayModal] = useState(false)
  const [retler, setRetler] = useState<any[]>([])
  const [iade, setIade] = useState<any>(null)
  useEffect(() => { web.from('settings').select('value').eq('key', 'satinalma_onay').maybeSingle().then(({ data }: any) => { if (data?.value) setOnay({ aktif: !!data.value.aktif, limit: +data.value.limit || 0 }) }) }, [])

  const cari = useMemo(() => byId(d.cariTam), [d.cariTam])
  const ham = useMemo(() => byId(d.hammaddeler), [d.hammaddeler])
  const depo = useMemo(() => byId(d.depolar), [d.depolar])

  const P = useMemo(() => {
    const o: Record<string, any> = {}
    d.satinalma.forEach((s: any) => {
      const ks = d.satinalmaKalemleri.filter((k: any) => k.siparis_id === s.id)
      const tutar = sum(ks, (k: any) => (+k.miktar || 0) * (+k.birim_fiyat || 0))
      const kalanTutar = sum(ks, (k: any) => Math.max((+k.miktar || 0) - (+k.teslim_alinan_miktar || 0), 0) * (+k.birim_fiyat || 0))
      const top = sum(ks, (k: any) => k.miktar), tes = sum(ks, (k: any) => Math.min(+k.teslim_alinan_miktar || 0, +k.miktar))
      const kur = +s.kur || 1; o[s.id] = { ks, tutar, kalanTutar, tl: tutar * kur, kalanTl: kalanTutar * kur, oran: top ? (tes / top) * 100 : 0 }
    })
    return o
  }, [d])
  const onayGerek = (s: any) => onay.aktif && s.durum === 'beklemede' && (P[s.id]?.tl || 0) > onay.limit
  const acik = (s: any) => ['beklemede', 'onaylandi', 'yolda'].includes(s.durum)
  const gec = (s: any) => acik(s) && s.beklenen_teslim && s.beklenen_teslim < todayISO()
  const cnt = (f: (s: any) => boolean) => d.satinalma.filter(f).length
  const ay = todayISO().slice(0, 7)
  const liste = d.satinalma.filter((s: any) => tab === 'hepsi' ? true : tab === 'acik' ? acik(s) : tab === 'geciken' ? gec(s) : s.durum === tab)

  // Kritik hammaddeler: açık siparişte olmayanlar
  const siparisteHam = useMemo(() => new Set(d.satinalma.filter(acik).flatMap((s: any) => (P[s.id]?.ks || []).map((k: any) => k.hammadde_id))), [d.satinalma, P]) // eslint-disable-line
  const kritikSiparissiz = d.hammaddeler.filter((h: any) => h.aktif !== false && (+h.mevcut_stok || 0) <= (+h.min_stok || 0) && !siparisteHam.has(h.id))
  const oneri = (h: any) => Math.max(Math.ceil((+h.max_stok || (+h.min_stok || 0) * 3) - (+h.mevcut_stok || 0)), 1)

  const sonrakiNo = () => { const y = new Date().getFullYear(), p = `SA-${y}-`; return p + String(Math.max(0, ...d.satinalma.filter((s: any) => s.no?.startsWith(p)).map((s: any) => +s.no.slice(p.length) || 0)) + 1).padStart(4, '0') }
  const openNew = (pre?: { tedarikci_id?: string; kalemler?: Kalem[] }) => { setEditing(null); setForm({ no: sonrakiNo(), tedarikci_id: pre?.tedarikci_id || '', tarih: todayISO(), beklenen_teslim: '', notlar: '', para_birimi: 'TRY', kur: '1', masraf_tl: '0', masraf_notu: '' }); setKalemler(pre?.kalemler?.length ? pre.kalemler : [bosKalem()]); setModal(true) }
  const openEdit = (s: any) => { setEditing(s); setForm({ no: s.no, tedarikci_id: s.tedarikci_id || '', tarih: s.tarih, beklenen_teslim: s.beklenen_teslim || '', notlar: s.notlar || '', para_birimi: s.para_birimi || 'TRY', kur: String(+s.kur || 1), masraf_tl: String(+s.masraf_tl || 0), masraf_notu: s.masraf_notu || '' }); setKalemler(P[s.id].ks.map((k: any) => ({ hammadde_id: k.hammadde_id, miktar: +k.miktar, birim_fiyat: +k.birim_fiyat || 0 }))); setModal(true) }
  // Tedarikçi kartından gelen ?yeni=<tedarikçi id> bağlantısı: yeni sipariş formunu tedarikçi seçili açar
  useEffect(() => {
    if (loading) return
    const y = new URLSearchParams(window.location.search).get('yeni')
    if (y && /^[0-9a-f-]{36}$/.test(y)) { openNew({ tedarikci_id: y }); window.history.replaceState(null, '', window.location.pathname) }
  }, [loading]) // eslint-disable-line
  const setK = (i: number, p: Partial<Kalem>) => setKalemler(ks => ks.map((k, j) => j === i ? { ...k, ...p } : k))
  const hamSec = (i: number, id: string) => { const h = ham[id]; setK(i, { hammadde_id: id, birim_fiyat: +h?.ortalama_maliyet || kalemler[i].birim_fiyat, miktar: h ? oneri(h) : kalemler[i].miktar }) }
  const formTutar = sum(kalemler, k => k.miktar * k.birim_fiyat)

  async function save() {
    if (busy) return
    const gecerli = kalemler.filter(k => k.hammadde_id && k.miktar > 0)
    if (!gecerli.length) return toast.show('En az bir kalem gir', true)
    if (new Set(gecerli.map(k => k.hammadde_id)).size !== gecerli.length) return toast.show('Aynı hammadde birden fazla satırda', true)
    if (d.satinalma.some((s: any) => s.no === form.no && s.id !== editing?.id)) return toast.show('Bu sipariş no zaten var', true)
    const pb = form.para_birimi || 'TRY', kurSayi = pb === 'TRY' ? 1 : (+String(form.kur).replace(',', '.') || 0)
    if (!(kurSayi > 0)) return toast.show('Döviz siparişinde kuru girin (1 döviz = ? TL)', true)
    if (!(+form.masraf_tl >= 0)) return toast.show('Ek maliyet 0 veya daha büyük olmalı', true)
    if (editing && P[editing.id].ks.some((k: any) => +k.teslim_alinan_miktar > 0) && (pb !== (editing.para_birimi || 'TRY') || kurSayi !== (+editing.kur || 1))) return toast.show('Teslim alınmış siparişin para birimi/kuru değiştirilemez', true)
    setBusy(true)
    try {
      const payload: any = { no: form.no, tedarikci_id: form.tedarikci_id || null, tarih: form.tarih, beklenen_teslim: form.beklenen_teslim || null, notlar: form.notlar || null, para_birimi: pb, kur: kurSayi, masraf_tl: +form.masraf_tl || 0, masraf_notu: form.masraf_notu || null }
      let id = editing?.id
      if (editing) {
        const u: any = await erp.from('satinalma_siparisleri').update(payload).eq('id', id); if (u?.error) throw new Error(u.error)
        for (const k of P[id].ks) await erp.from('satinalma_siparisi_kalemleri').delete().eq('id', k.id)
      } else { const r: any = await erp.from('satinalma_siparisleri').insert({ ...payload, durum: 'beklemede' }); if (r?.error) throw new Error(r.error); id = r.data?.[0]?.id }
      const kk: any = await erp.from('satinalma_siparisi_kalemleri').insert(gecerli.map(k => {
        const eski = editing ? P[id].ks.find((x: any) => x.hammadde_id === k.hammadde_id) : null
        return { siparis_id: id, hammadde_id: k.hammadde_id, miktar: k.miktar, birim_fiyat: k.birim_fiyat, teslim_alinan_miktar: +eski?.teslim_alinan_miktar || 0 }
      })); if (kk?.error) throw new Error(kk.error)
      toast.show(editing ? 'Sipariş güncellendi' : 'Sipariş oluşturuldu'); setModal(false); await reload()
    } catch (err: any) { toast.show(err.message, true) }
    setBusy(false)
  }

  async function durum(s: any, yeni: string) {
    if (yeni === 'iptal' && !confirm(`${s.no} iptal edilsin mi?`)) return
    const r: any = await erp.from('satinalma_siparisleri').update({ durum: yeni }).eq('id', s.id)
    if (r?.error) return toast.show(r.error, true)
    toast.show(`${s.no}: ${DURUM[yeni].l}`); await reload(); setDetay((x: any) => x?.id === s.id ? { ...x, durum: yeni } : x)
  }
  async function topluSil(sel: any[]): Promise<string | void> {
    const { silinen, hata } = await topluSilCalistir(sel, async (r: any) => (P[r.id]?.ks.some((k: any) => +k.teslim_alinan_miktar > 0) ? `${r.no}: teslim alınmış kalem var, silinemez` : (await erp.from('satinalma_siparisleri').delete().eq('id', r.id))?.error), 'sipariş')
    await reload(); setDetay(null)
    if (hata) return hata
    toast.show(`${silinen} sipariş silindi`)
  }
  async function sil(s: any) {
    if (P[s.id].ks.some((k: any) => +k.teslim_alinan_miktar > 0)) return toast.show('Teslim alınmış kalem var — silinemez, iptal edebilirsin', true)
    if (!confirm(`${s.no} silinsin mi?`)) return
    const r: any = await erp.from('satinalma_siparisleri').delete().eq('id', s.id)
    if (r?.error) return toast.show(r.error, true)
    toast.show('Sipariş silindi'); setDetay(null); reload()
  }

  function openTeslim(s: any) {
    setTeslim({ s, tarih: todayISO(), depo: '', lot: '', fatura: !s.fatura_olusturuldu, kdv: '20', satir: Object.fromEntries(P[s.id].ks.map((k: any) => [k.id, { gelen: String(Math.max((+k.miktar || 0) - (+k.teslim_alinan_miktar || 0), 0)), fiyat: String(+k.birim_fiyat || 0), ret: '', neden: '' }])) })
  }
  async function teslimKaydet(e: React.FormEvent) {
    e.preventDefault(); if (busy || !teslim) return
    const s = teslim.s, ks = P[s.id].ks
    const satirlar = ks.map((k: any) => { const v = teslim.satir[k.id] || {}; return { k, gelen: +v.gelen || 0, ret: +v.ret || 0, fiyat: +v.fiyat || 0, neden: String(v.neden || '') } }).filter((x: any) => x.gelen > 0 || x.ret > 0)
    if (!satirlar.length) return toast.show('Teslim alınan veya reddedilen miktar gir', true)
    const nedensiz = satirlar.find((x: any) => x.ret > 0 && !x.neden.trim()); if (nedensiz) return toast.show(`${ham[nedensiz.k.hammadde_id]?.ad}: ret nedenini yazın`, true)
    const asan = satirlar.find((x: any) => x.gelen > 0 && (+x.k.teslim_alinan_miktar || 0) + x.gelen > +x.k.miktar * 1.1)
    if (asan && !confirm(`${ham[asan.k.hammadde_id]?.ad}: teslim, sipariş miktarının %10'undan fazla aşıyor. Devam?`)) return
    setBusy(true)
    try {
      // Stok girişi, ret kaydı, kalem güncelleme, maliyet (döviz + ithalat masrafı dahil), lot, sipariş durumu ve alış faturası veritabanında TEK işlemde yapılır (yarım kalmaz).
      const r: any = await erp.rpc('rpc_satinalma_teslim_al', { p_siparis_id: s.id, p_tarih: teslim.tarih, p_depo_id: teslim.depo || null, p_lot: teslim.lot || null, p_asim_onay: !!asan, p_fatura: !!teslim.fatura && !s.fatura_olusturuldu, p_kdv: +teslim.kdv || 0,
        p_satirlar: satirlar.map((g: any) => ({ kalem_id: g.k.id, gelen: g.gelen, ret: g.ret, fiyat: g.fiyat, neden: g.neden })) })
      const hepsi = !!r?.tamamlandi
      const parca = [hepsi ? 'Teslim alındı — sipariş tamamlandı' : (satirlar.some((x: any) => x.gelen > 0) ? 'Kısmi teslim alındı, stok güncellendi' : 'Ret kaydedildi; sipariş açık kaldı'), r?.ret ? `${r.ret} kalemde ret kaydı açıldı (İade / Ret sayfası)` : '', r?.fatura_no ? `${r.fatura_no} alış faturası oluşturuldu` : '', r?.fatura_uyari || ''].filter(Boolean)
      toast.show(parca.join(' · '), !!r?.fatura_uyari)
      setTeslim(null); await reload(); setDetay((x: any) => x?.id === s.id ? { ...x, durum: r?.durum || x.durum, fatura_olusturuldu: x.fatura_olusturuldu || !!r?.fatura_no } : x)
    } catch (err: any) { toast.show(err.message, true); reload() }
    setBusy(false)
  }
  async function iadeKaydet(e: React.FormEvent) {
    e.preventDefault(); if (busy || !iade) return
    const m = +iade.miktar; if (!(m > 0)) return toast.show('İade miktarı girin', true)
    if (m > (+iade.k.teslim_alinan_miktar || 0)) return toast.show('İade miktarı teslim alınandan fazla olamaz', true)
    if (!iade.neden.trim()) return toast.show('İade nedenini yazın', true)
    if (!confirm(`${ham[iade.k.hammadde_id]?.ad}: ${fmtN(m, 2)} ${ham[iade.k.hammadde_id]?.birim || ''} tedarikçiye iade edilip stoktan düşülecek. Devam?`)) return
    setBusy(true)
    try {
      const r: any = await erp.rpc('rpc_satinalma_iade', { p_kalem_id: iade.k.id, p_miktar: m, p_neden: iade.neden, p_depo_id: null })
      toast.show(r?.fatura_var ? 'İade kaydedildi ve stoktan düşüldü. Bu sipariş için alış faturası var: tedarikçiden iade faturası/alacak dekontu isteyip Muhasebe → Faturalar\'a işleyin.' : 'İade kaydedildi ve stoktan düşüldü', !!r?.fatura_var)
      setIade(null); await reload()
    } catch (err: any) { toast.show(err.message, true) }
    setBusy(false)
  }
  async function gonder(sp: any, kanal: 'email' | 'whatsapp', sablon: 'siparis' | 'hatirlatma') {
    if (busy) return
    if (kanal === 'email' && !confirm(`${sablon === 'siparis' ? 'Sipariş' : 'Teslim hatırlatması'}, ${cari[sp.tedarikci_id]?.ad || 'tedarikçiye'} e-posta ile gönderilsin mi?`)) return
    setBusy(true)
    try {
      const r = await fetch('/api/admin/satinalma-gonder', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: sp.id, kanal, sablon, onceki: +sp.gonderim_sayisi || 0 }) })
      const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || 'Gönderilemedi')
      if (kanal === 'whatsapp' && j.url) window.open(j.url, '_blank', 'noopener')
      toast.show(kanal === 'email' ? `E-posta gönderildi (${j.alici})` : 'WhatsApp açıldı; mesajı göndermeyi unutmayın'); await reload()
    } catch (err: any) { toast.show(err.message, true) }
    setBusy(false)
  }
  async function onayKaydet(e: React.FormEvent) {
    e.preventDefault(); if (busy) return
    setBusy(true)
    const { error } = await web.from('settings').upsert({ key: 'satinalma_onay', value: { aktif: !!onay.aktif, limit: Math.max(0, +onay.limit || 0) } })
    setBusy(false)
    if (error) return toast.show(error.message, true)
    setOnayModal(false); toast.show('Onay kuralı kaydedildi')
  }

  async function kritikSiparisleri() {
    if (!kritikSiparissiz.length) return
    if (!confirm(`${kritikSiparissiz.length} kritik hammadde için tedarikçi bazlı sipariş taslakları oluşturulsun mu?`)) return
    setBusy(true)
    try {
      const gruplar: Record<string, any[]> = {}; kritikSiparissiz.forEach((h: any) => { (gruplar[h.tedarikci_id || 'genel'] ||= []).push(h) })
      const y = new Date().getFullYear(), pre = `SA-${y}-`; let no = Math.max(0, ...d.satinalma.filter((s: any) => s.no?.startsWith(pre)).map((s: any) => +s.no.slice(pre.length) || 0)); let n = 0
      for (const [tid, hl] of Object.entries(gruplar)) {
        const r: any = await erp.from('satinalma_siparisleri').insert({ no: pre + String(++no).padStart(4, '0'), tedarikci_id: tid === 'genel' ? null : tid, tarih: todayISO(), durum: 'beklemede', notlar: 'Kritik stoktan otomatik oluşturuldu' }); if (r?.error) throw new Error(r.error)
        const k: any = await erp.from('satinalma_siparisi_kalemleri').insert(hl.map(h => ({ siparis_id: r.data[0].id, hammadde_id: h.id, miktar: oneri(h), birim_fiyat: +h.ortalama_maliyet || 0 }))); if (k?.error) throw new Error(k.error); n++
      }
      toast.show(`${n} sipariş taslağı oluşturuldu`); await reload()
    } catch (err: any) { toast.show(err.message, true) }
    setBusy(false)
  }

  function yazdir(s: any) {
    const ks = P[s.id].ks
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>${s.no}</title><style>body{font-family:Arial,sans-serif;color:#0b0e0b;padding:40px;max-width:800px;margin:0 auto}h1{font-size:20px;margin:0 0 4px}.muted{color:#6b7366;font-size:12px}table{width:100%;border-collapse:collapse;margin-top:24px}th,td{padding:8px 6px;font-size:13px;border-bottom:1px solid #ddd;text-align:left}th{color:#6b7366;font-size:11px;text-transform:uppercase}td:not(:first-child),th:not(:first-child){text-align:right}.header{display:flex;justify-content:space-between;border-bottom:2px solid #e55f28;padding-bottom:16px;margin-bottom:16px}@media print{body{padding:0}}</style></head><body>
      <div class="header"><div><h1>ALYA PLASTİK</h1><p class="muted">Satınalma Sipariş Formu</p></div><div style="text-align:right"><h1>${s.no}</h1><p class="muted">${fmtDate(s.tarih)}${s.beklenen_teslim ? ` · Beklenen teslim: ${fmtDate(s.beklenen_teslim)}` : ''}</p></div></div>
      <p><b>Tedarikçi:</b> ${cari[s.tedarikci_id]?.ad || '—'}</p>
      <table><thead><tr><th>Malzeme</th><th>Miktar</th><th>Birim Fiyat</th><th>Tutar</th></tr></thead><tbody>${ks.map((k: any) => `<tr><td>${ham[k.hammadde_id]?.ad || ''}</td><td>${fmtN(k.miktar, 2)} ${ham[k.hammadde_id]?.birim || ''}</td><td>${fmt(k.birim_fiyat, s.para_birimi || 'TRY')}</td><td>${fmt(k.miktar * k.birim_fiyat, s.para_birimi || 'TRY')}</td></tr>`).join('')}</tbody></table>
      <p style="text-align:right;font-size:15px;font-weight:700;margin-top:16px">Toplam (KDV hariç): ${fmt(P[s.id].tutar, s.para_birimi || 'TRY')}</p>${s.notlar ? `<p class="muted">${s.notlar}</p>` : ''}</body></html>`
    const w = window.open('', '_blank'); if (w) { w.document.write(html); w.document.close(); w.focus(); setTimeout(() => w.print(), 300) }
  }

  const cols: Col<any>[] = [
    { key: 'no', label: 'Sipariş', sort: s => s.no, render: s => <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}><div style={{ width: 32, height: 32, borderRadius: 9, background: 'var(--adm-blue2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><PackageSearch size={15} style={{ color: 'var(--adm-blue)' }} /></div><div><b style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: 12.5 }}>{s.no}</b><div style={{ fontSize: 11, color: 'var(--adm-tx3)' }}>{cari[s.tedarikci_id]?.ad || 'Tedarikçi yok'}</div></div></div> },
    { key: 'tarih', label: 'Tarih', width: 96, sort: s => s.tarih, render: s => fmtDate(s.tarih), hideSm: true },
    { key: 'teslim', label: 'Beklenen Teslim', sort: s => s.beklenen_teslim || '9999', render: s => s.beklenen_teslim ? <div>{fmtDate(s.beklenen_teslim)}{gec(s) && <div style={{ fontSize: 10.5, color: 'var(--adm-red)', fontWeight: 700 }}>{daysBetween(s.beklenen_teslim)} gün gecikti</div>}</div> : <span style={{ color: 'var(--adm-tx3)' }}>—</span> },
    { key: 'kalem', label: 'Kalem', align: 'right', width: 70, sort: s => P[s.id]?.ks.length, render: s => P[s.id]?.ks.length, hideSm: true },
    { key: 'oran', label: 'Teslimat', width: 130, sort: s => P[s.id]?.oran, render: s => <div><div style={{ height: 5, borderRadius: 3, background: 'var(--adm-s2)', overflow: 'hidden' }}><div style={{ width: `${P[s.id]?.oran}%`, height: '100%', background: 'var(--adm-green)' }} /></div><div style={{ fontSize: 10.5, color: 'var(--adm-tx3)', marginTop: 3 }}>%{fmtN(P[s.id]?.oran, 0)} teslim alındı</div></div>, hideSm: true },
    { key: 'tutar', label: 'Tutar (KDV hariç)', align: 'right', sort: s => P[s.id]?.tutar, render: s => (s.para_birimi || 'TRY') === 'TRY' ? <Money v={P[s.id]?.tutar} /> : <div style={{ textAlign: 'right' }}><b>{fmt(P[s.id]?.tutar, s.para_birimi)}</b><div style={{ fontSize: 10.5, color: 'var(--adm-tx3)' }}>≈ {fmt(P[s.id]?.tl)}</div></div>, total: rs => <Money v={sum(rs.filter((s: any) => s.durum !== 'iptal'), (s: any) => P[s.id]?.tl)} />, csv: s => P[s.id]?.tutar },
    { key: 'durum', label: 'Durum', width: 120, sort: s => s.durum, render: s => gec(s) ? <Badge tone="red">Gecikmiş</Badge> : onayGerek(s) ? <Badge tone="amber">Onay bekliyor</Badge> : <Badge tone={DURUM[s.durum]?.tone}>{DURUM[s.durum]?.l}</Badge> },
    { key: 'act', label: '', width: 110, align: 'right', render: s => acik(s) ? <button className="adm-btn" style={{ padding: '4px 10px', fontSize: 11.5 }} onClick={ev => { ev.stopPropagation(); openTeslim(s) }}><PackageCheck size={12} />Teslim Al</button> : null },
  ]

  const dS = detay ? d.satinalma.find((s: any) => s.id === detay.id) || detay : null
  const dP = dS ? P[dS.id] : null
  // Teslim alma geçmişi: yalnızca seçili siparişin kalemleri için sunucudan çekilir
  const [dHar, setDHar] = useState<any[]>([])
  useEffect(() => {
    const ids = dP ? dP.ks.map((k: any) => k.id) : []
    if (!ids.length) { setDHar([]); return }
    erp.from('stok_hareketleri').select('*').eq('kaynak_tablo', 'satinalma_siparisi_kalemleri').in('kaynak_id', ids).order('tarih', { ascending: false }).then((r: any) => setDHar(r.data || [])).catch(() => setDHar([]))
  }, [detay?.id, d.satinalmaKalemleri]) // eslint-disable-line

  useEffect(() => {
    if (!detay?.id) { setRetler([]); return }
    web.from('satinalma_ret_kayitlari').select('*').eq('siparis_id', detay.id).order('created_at', { ascending: false }).then(({ data }: any) => setRetler(data || []))
  }, [detay?.id, d.satinalmaKalemleri]) // eslint-disable-line

  useAcParam(!loading, id => { const r = d.satinalma.find((x: any) => x.id === id); if (r) setDetay(r) })

  return (
    <div style={{ flex: 1, overflow: 'auto' }}>
      <AdminTopBar title="Satınalma Siparişleri" />
      <Page>
        <PageHead title="Satınalma" sub="Tedarikçi siparişleri, kısmi teslim alma, ağırlıklı maliyet ve otomatik alış faturası" actions={<>{has('yonetim') && <button className="adm-btn-ghost" onClick={() => setOnayModal(true)} title="Tutar limiti üstündeki siparişler için yönetici onayı"><ShieldCheck size={13} />Onay kuralı{onay.aktif ? ` (${fmtK(onay.limit)} ₺)` : ' (kapalı)'}</button>}<button className="adm-btn" onClick={() => openNew()}><Plus size={14} />Yeni Sipariş</button></>} />
        <KpiGrid min={180}>
          <Kpi label="Açık Sipariş" value={cnt(acik)} Icon={PackageSearch} color="var(--adm-blue)" sub={`${cnt(s => s.durum === 'yolda')} yolda`} onClick={() => setTab('acik')} />
          <Kpi label="Bekleyen Teslimat" value={fmtK(sum(d.satinalma.filter(acik), (s: any) => P[s.id]?.kalanTl))} Icon={Truck} color="var(--adm-amber)" sub="teslim alınmamış tutar (KDV hariç)" />
          <Kpi label="Geciken Teslim" value={cnt(gec)} Icon={AlertTriangle} color={cnt(gec) ? 'var(--adm-red)' : 'var(--adm-green)'} sub={cnt(gec) ? 'beklenen tarih geçmiş' : 'Gecikme yok'} onClick={() => setTab('geciken')} />
          <Kpi label="Bu Ay Alım" value={fmtK(sum(d.satinalma.filter((s: any) => (s.tarih || '').startsWith(ay) && s.durum !== 'iptal'), (s: any) => P[s.id]?.tl))} Icon={Coins} color="var(--adm-green)" sub={`${cnt((s: any) => (s.tarih || '').startsWith(ay))} sipariş`} />
          <Kpi label="Siparişsiz Kritik Stok" value={kritikSiparissiz.length} Icon={ShoppingCart} color={kritikSiparissiz.length ? 'var(--adm-red)' : 'var(--adm-green)'} sub={kritikSiparissiz.length ? 'sipariş açılmalı' : 'Tümü siparişte / yeterli'} />
        </KpiGrid>

        {kritikSiparissiz.length > 0 && (
          <div className="adm-card" style={{ padding: '11px 16px', marginBottom: 14, display: 'flex', gap: 10, alignItems: 'center', borderColor: 'var(--adm-red)', fontSize: 13, flexWrap: 'wrap' }}>
            <AlertTriangle size={16} style={{ color: 'var(--adm-red)' }} /><span style={{ flex: 1, minWidth: 220 }}><b>{kritikSiparissiz.length}</b> hammadde minimum stokta ve açık siparişi yok: {kritikSiparissiz.slice(0, 3).map((h: any) => h.ad).join(', ')}{kritikSiparissiz.length > 3 ? '…' : ''}</span>
            <button className="adm-btn" style={{ padding: '4px 12px', fontSize: 12 }} disabled={busy} onClick={kritikSiparisleri}><ShoppingCart size={12} />Otomatik sipariş taslağı oluştur</button>
          </div>)}

        <div style={{ marginBottom: 12 }}><Tabs value={tab} onChange={setTab} tabs={[{ v: 'acik', l: 'Açık', n: cnt(acik) }, { v: 'beklemede', l: 'Beklemede', n: cnt(s => s.durum === 'beklemede') }, { v: 'onaylandi', l: 'Onaylı', n: cnt(s => s.durum === 'onaylandi') }, { v: 'yolda', l: 'Yolda', n: cnt(s => s.durum === 'yolda') }, { v: 'geciken', l: 'Geciken', n: cnt(gec) }, { v: 'teslim_alindi', l: 'Teslim alındı', n: cnt(s => s.durum === 'teslim_alindi') }, { v: 'iptal', l: 'İptal', n: cnt(s => s.durum === 'iptal') }, { v: 'hepsi', l: 'Tümü', n: d.satinalma.length }]} /></div>
        <DataGrid rows={liste} cols={cols} rowKey={s => s.id} loading={loading} onBulkDelete={topluSil} deleteNoun="sipariş" deleteNote="Teslim alınmış kalemi olan siparişler silinmez; onlar için iptal kullanın." csvName="satinalma" storageKey="satinalma" onRowClick={setDetay} activeKey={detay?.id}
          searchText={s => `${s.no} ${cari[s.tedarikci_id]?.ad || ''}`} searchPlaceholder="Sipariş no, tedarikçi..." emptyTitle="Sipariş bulunamadı" emptySub="Yeni Sipariş ya da kritik stoktan otomatik sipariş oluştur" />
      </Page>

      <Drawer open={!!dS} onClose={() => setDetay(null)} width={640}
        title={dS && <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}><span style={{ fontFamily: 'JetBrains Mono,monospace' }}>{dS.no}</span>{gec(dS) ? <Badge tone="red">Gecikmiş</Badge> : <Badge tone={DURUM[dS.durum]?.tone}>{DURUM[dS.durum]?.l}</Badge>}</span>}
        sub={dS && `${cari[dS.tedarikci_id]?.ad || 'Tedarikçi yok'} · ${fmtDate(dS.tarih)}${dS.beklenen_teslim ? ` · beklenen ${fmtDate(dS.beklenen_teslim)}` : ''}`}
        footer={dS && dP && <>
          <button className="adm-btn-ghost" onClick={() => yazdir(dS)} title="Yazdır"><Printer size={13} /></button>
          {dS.tedarikci_id && dS.durum !== 'iptal' && <>
            <button className="adm-btn-ghost" disabled={busy} onClick={() => gonder(dS, 'email', dS.gonderim_sayisi > 0 && ['onaylandi', 'yolda'].includes(dS.durum) ? 'hatirlatma' : 'siparis')} title={dS.gonderim_sayisi > 0 ? 'Teslim hatırlatması gönder (e-posta)' : 'Siparişi tedarikçiye e-posta ile gönder'}><Mail size={13} />{dS.gonderim_sayisi > 0 ? 'Hatırlat' : 'E-posta'}</button>
            <button className="adm-btn-ghost" disabled={busy} onClick={() => gonder(dS, 'whatsapp', dS.gonderim_sayisi > 0 && ['onaylandi', 'yolda'].includes(dS.durum) ? 'hatirlatma' : 'siparis')} title="WhatsApp ile gönder"><MessageCircle size={13} />WhatsApp</button></>}
          {['beklemede', 'iptal'].includes(dS.durum) && <button className="adm-btn-danger" onClick={() => sil(dS)}><Trash2 size={13} /></button>}
          {acik(dS) && <button className="adm-btn-ghost" onClick={() => openEdit(dS)}><Pencil size={13} />Düzenle</button>}
          {acik(dS) && <button className="adm-btn-ghost" style={{ color: 'var(--adm-red)' }} onClick={() => durum(dS, 'iptal')}><Ban size={13} /></button>}
          {dS.durum === 'beklemede' && <button className="adm-btn-ghost" onClick={() => durum(dS, 'onaylandi')}><CheckCircle2 size={13} />Onayla</button>}
          {dS.durum === 'onaylandi' && <button className="adm-btn-ghost" onClick={() => durum(dS, 'yolda')}><Send size={13} />Yola çıktı</button>}
          {acik(dS) && <button className="adm-btn" onClick={() => openTeslim(dS)}><PackageCheck size={14} />Teslim Al</button>}
        </>}>
        {dS && dP && (
          <div style={{ padding: 20 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 14 }}>
              <div style={{ padding: 12, borderRadius: 10, background: 'var(--adm-s2)' }}><div className="adm-kpi-label" style={{ marginBottom: 3 }}>Tutar</div><b style={{ fontSize: 16, fontFamily: 'JetBrains Mono,monospace' }}>{fmt(dP.tutar, dS.para_birimi || 'TRY')}</b><div style={{ fontSize: 10.5, color: 'var(--adm-tx3)' }}>KDV hariç{(dS.para_birimi || 'TRY') !== 'TRY' ? ` · ≈ ${fmt(dP.tl)}` : ''}</div></div>
              <div style={{ padding: 12, borderRadius: 10, background: 'var(--adm-s2)' }}><div className="adm-kpi-label" style={{ marginBottom: 3 }}>Teslimat</div><b style={{ fontSize: 17, fontFamily: 'JetBrains Mono,monospace' }}>%{fmtN(dP.oran, 0)}</b></div>
              <div style={{ padding: 12, borderRadius: 10, background: 'var(--adm-s2)' }}><div className="adm-kpi-label" style={{ marginBottom: 3 }}>Alış faturası</div><Badge tone={dS.fatura_olusturuldu ? 'green' : 'muted'}>{dS.fatura_olusturuldu ? 'Oluşturuldu' : 'Yok'}</Badge></div>
            </div>
            {((dS.para_birimi || 'TRY') !== 'TRY' || +dS.masraf_tl > 0 || dS.onaylayan || onayGerek(dS) || dS.gonderildi_at) && <div style={{ fontSize: 12.5, marginBottom: 12, display: 'grid', gap: 3 }}>
              {(dS.para_birimi || 'TRY') !== 'TRY' && <div>Para birimi: <b>{dS.para_birimi}</b> · kur <b>{fmtN(+dS.kur, 4)}</b> ₺</div>}
              {+dS.masraf_tl > 0 && <div>Ek maliyet (nakliye/gümrük): <b>{fmt(+dS.masraf_tl)}</b>{dS.masraf_notu ? ` — ${dS.masraf_notu}` : ''} <span style={{ color: 'var(--adm-tx3)' }}>(teslimde maliyete sipariş değeri oranında eklenir)</span></div>}
              {onayGerek(dS) && <div style={{ color: 'var(--adm-amber)', fontWeight: 600 }}>⚠ Tutar onay limitini ({fmt(onay.limit)}) aşıyor; onay yetkisi olan bir yönetici onaylamalı.</div>}
              {dS.gonderildi_at && <div style={{ color: 'var(--adm-tx3)' }}>Tedarikçiye gönderildi: {fmtDateTime(dS.gonderildi_at)}{dS.gonderim_sayisi > 1 ? ` (${dS.gonderim_sayisi}. kez)` : ''}</div>}
              {dS.onaylayan && <div style={{ color: 'var(--adm-green)' }}>✓ Onaylandı{dS.onay_tarihi ? ` · ${fmtDateTime(dS.onay_tarihi)}` : ''}</div>}
            </div>}
            <Divider label="Kalemler" />
            <table className="adm-tbl compact"><thead><tr><th>Malzeme</th><th style={{ textAlign: 'right' }}>Sipariş</th><th style={{ textAlign: 'right' }}>Teslim</th><th style={{ textAlign: 'right' }}>B.Fiyat</th><th style={{ textAlign: 'right' }}>Tutar</th></tr></thead>
              <tbody>{dP.ks.map((k: any) => { const t = +k.teslim_alinan_miktar || 0; return <tr key={k.id}><td>{ham[k.hammadde_id]?.ad || '—'}<div style={{ fontSize: 10.5, color: 'var(--adm-tx3)' }}>stok {fmtN(ham[k.hammadde_id]?.mevcut_stok, 1)} · min {fmtN(ham[k.hammadde_id]?.min_stok, 0)}</div></td><td style={{ textAlign: 'right' }}>{fmtN(k.miktar, 2)} {ham[k.hammadde_id]?.birim}</td><td style={{ textAlign: 'right', fontWeight: 700, color: t >= +k.miktar ? 'var(--adm-green)' : t ? 'var(--adm-amber)' : 'var(--adm-tx3)' }}>{fmtN(t, 2)}</td><td style={{ textAlign: 'right' }}>{fmt(k.birim_fiyat)}</td><td style={{ textAlign: 'right' }}>{fmt(k.miktar * k.birim_fiyat)}</td></tr> })}</tbody></table>
            {dP.ks.some((k: any) => +k.teslim_alinan_miktar > 0) && ['yolda', 'teslim_alindi', 'onaylandi', 'beklemede'].includes(dS.durum) && <div style={{ marginTop: 10, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {dP.ks.filter((k: any) => +k.teslim_alinan_miktar > 0).map((k: any) => <button key={k.id} className="adm-btn-ghost" style={{ fontSize: 11.5, padding: '4px 9px' }} onClick={() => setIade({ k, miktar: '', neden: '' })}><RotateCcw size={11} />{ham[k.hammadde_id]?.ad} iade</button>)}
            </div>}
            {retler.length > 0 && <><Divider label="Ret / iade kayıtları" />{retler.map((r: any) => <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, padding: '6px 0', fontSize: 12.5, borderBottom: '1px dashed var(--adm-bdr)' }}><span><Badge tone={r.tur === 'ret' ? 'amber' : 'blue'}>{r.tur === 'ret' ? 'Ret' : 'İade'}</Badge> {ham[r.hammadde_id]?.ad} · {fmtN(+r.miktar, 2)}{r.neden ? ` — ${r.neden}` : ''}</span><span style={{ color: 'var(--adm-tx3)' }}>{r.durum === 'bekliyor' ? 'iade bekliyor' : r.durum}</span></div>)}</>}
            {dHar.length > 0 && <><Divider label="Teslim alma geçmişi" />{dHar.map((m: any) => <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 12.5, borderBottom: '1px dashed var(--adm-bdr)' }}><span>{fmtDateTime(m.tarih)} · {ham[m.hammadde_id]?.ad}</span><b style={{ color: 'var(--adm-green)', fontFamily: 'JetBrains Mono,monospace' }}>+{fmtN(m.miktar, 2)}{+m.birim_maliyet ? ` @ ${fmt(m.birim_maliyet)}` : ''}</b></div>)}</>}
            {dS.notlar && <><Divider label="Not" /><p style={{ fontSize: 12.5, color: 'var(--adm-tx2)', margin: 0, whiteSpace: 'pre-wrap' }}>{dS.notlar}</p></>}
          </div>
        )}
      </Drawer>

      <Modal open={modal} onClose={() => setModal(false)} width={840} title={editing ? `${editing.no} — Düzenle` : 'Yeni Satınalma Siparişi'}
        footer={<><span style={{ marginRight: 'auto', fontSize: 13 }}>Toplam (KDV hariç) <b style={{ color: 'var(--adm-green)', fontSize: 15 }}>{fmt(formTutar, form.para_birimi || 'TRY')}</b></span><button type="button" className="adm-btn-ghost" onClick={() => setModal(false)}>İptal</button><button type="button" className="adm-btn" disabled={busy} onClick={save}>{busy ? 'Kaydediliyor...' : 'Kaydet'}</button></>}>
        <FormGrid cols={4}>
          <Field label="Sipariş No"><input className="adm-inp" value={form.no || ''} onChange={e => setForm((f: any) => ({ ...f, no: e.target.value }))} /></Field>
          <Field label="Tedarikçi" span={2}><select className="adm-inp" value={form.tedarikci_id || ''} onChange={e => setForm((f: any) => ({ ...f, tedarikci_id: e.target.value }))}><option value="">— Seçin —</option>{d.cariTam.filter((c: any) => c.tip !== 'musteri').map((c: any) => <option key={c.id} value={c.id}>{c.ad}</option>)}</select></Field>
          <Field label="Beklenen teslim"><input type="date" className="adm-inp" value={form.beklenen_teslim || ''} onChange={e => setForm((f: any) => ({ ...f, beklenen_teslim: e.target.value }))} /></Field>
        </FormGrid>
        <FormGrid cols={4}>
          <Field label="Para birimi"><select className="adm-inp" value={form.para_birimi || 'TRY'} onChange={e => setForm((f: any) => ({ ...f, para_birimi: e.target.value }))}>{['TRY', 'USD', 'EUR', 'GBP', 'RUB'].map(p => <option key={p}>{p}</option>)}</select></Field>
          {(form.para_birimi || 'TRY') !== 'TRY' ? <Field label={`Kur (1 ${form.para_birimi} = ? ₺)`}><input type="number" step="0.0001" min="0" className="adm-inp" value={form.kur || ''} onChange={e => setForm((f: any) => ({ ...f, kur: e.target.value }))} /></Field> : <div />}
          <Field label="Ek maliyet (₺)" hint="Nakliye, gümrük, sigorta; teslimde maliyete eklenir"><input type="number" step="0.01" min="0" className="adm-inp" value={form.masraf_tl ?? ''} onChange={e => setForm((f: any) => ({ ...f, masraf_tl: e.target.value }))} /></Field>
          <Field label="Ek maliyet notu"><input className="adm-inp" maxLength={300} value={form.masraf_notu || ''} onChange={e => setForm((f: any) => ({ ...f, masraf_notu: e.target.value }))} /></Field>
        </FormGrid>
        <Divider label="Kalemler" />
        <table className="adm-tbl compact"><thead><tr><th style={{ minWidth: 240 }}>Hammadde</th><th style={{ width: 110 }}>Miktar</th><th style={{ width: 120 }}>Birim fiyat</th><th style={{ width: 120, textAlign: 'right' }}>Tutar</th><th style={{ width: 30 }} /></tr></thead>
          <tbody>{kalemler.map((k, i) => { const h = ham[k.hammadde_id]; return <tr key={i}>
            <td><select className="adm-inp" style={{ fontSize: 12.5, padding: '6px 8px' }} value={k.hammadde_id} onChange={e => hamSec(i, e.target.value)}><option value="">Seçin</option>{d.hammaddeler.filter((x: any) => x.aktif !== false).map((x: any) => <option key={x.id} value={x.id}>{x.ad} ({x.birim})</option>)}</select>
              {h && <div style={{ fontSize: 10.5, marginTop: 3, color: (+h.mevcut_stok || 0) <= (+h.min_stok || 0) ? 'var(--adm-red)' : 'var(--adm-tx3)' }}>Stok {fmtN(h.mevcut_stok, 1)} {h.birim} · min {fmtN(h.min_stok, 0)}{h.max_stok ? ` · max ${fmtN(h.max_stok, 0)}` : ''}</div>}</td>
            <td><input type="number" step="0.001" min="0" className="adm-inp" value={k.miktar} onChange={e => setK(i, { miktar: +e.target.value })} style={{ fontSize: 12.5, padding: '6px 9px' }} /></td>
            <td><input type="number" step="0.0001" min="0" className="adm-inp" value={k.birim_fiyat} onChange={e => setK(i, { birim_fiyat: +e.target.value })} style={{ fontSize: 12.5, padding: '6px 9px' }} /></td>
            <td style={{ textAlign: 'right' }}><Money v={k.miktar * k.birim_fiyat} bold={false} /></td>
            <td><button type="button" disabled={kalemler.length === 1} onClick={() => setKalemler(ks => ks.filter((_, j) => j !== i))} style={{ background: 'none', border: 'none', color: 'var(--adm-red)' }}><X size={14} /></button></td></tr> })}</tbody></table>
        <button type="button" className="adm-btn-ghost" style={{ marginTop: 10, fontSize: 12 }} onClick={() => setKalemler(ks => [...ks, bosKalem()])}><Plus size={12} />Kalem Ekle</button>
        <div style={{ marginTop: 14 }}><Field label="Notlar"><textarea className="adm-inp" rows={2} value={form.notlar || ''} onChange={e => setForm((f: any) => ({ ...f, notlar: e.target.value }))} /></Field></div>
      </Modal>

      <Modal open={!!teslim} onClose={() => setTeslim(null)} onSubmit={teslimKaydet} width={720} title={teslim && `${teslim.s.no} — Teslim Al`}
        footer={<><button type="button" className="adm-btn-ghost" onClick={() => setTeslim(null)}>İptal</button><button type="submit" className="adm-btn" disabled={busy}><PackageCheck size={14} />{busy ? 'İşleniyor...' : 'Teslim Al ve Stoğa İşle'}</button></>}>
        {teslim && <>
          <table className="adm-tbl compact"><thead><tr><th>Malzeme</th><th style={{ textAlign: 'right' }}>Kalan</th><th style={{ width: 130 }}>Gelen miktar</th><th style={{ width: 120 }}>Birim fiyat ({teslim.s.para_birimi || 'TRY'})</th><th style={{ width: 110 }}>Reddedilen</th><th style={{ minWidth: 150 }}>Ret nedeni</th></tr></thead>
            <tbody>{P[teslim.s.id].ks.map((k: any) => { const h = ham[k.hammadde_id], kalan = Math.max((+k.miktar || 0) - (+k.teslim_alinan_miktar || 0), 0); return <tr key={k.id}>
              <td><b>{h?.ad}</b><div style={{ fontSize: 10.5, color: 'var(--adm-tx3)' }}>stok {fmtN(h?.mevcut_stok, 1)} {h?.birim}</div></td><td style={{ textAlign: 'right' }}>{fmtN(kalan, 2)} {h?.birim}</td>
              <td><input type="number" step="0.001" min="0" className="adm-inp" style={{ fontSize: 13, padding: '6px 9px', fontWeight: 700 }} value={teslim.satir[k.id]?.gelen} onChange={e => setTeslim((t: any) => ({ ...t, satir: { ...t.satir, [k.id]: { ...t.satir[k.id], gelen: e.target.value } } }))} /></td>
              <td><input type="number" step="0.0001" min="0" className="adm-inp" style={{ fontSize: 13, padding: '6px 9px' }} value={teslim.satir[k.id]?.fiyat} onChange={e => setTeslim((t: any) => ({ ...t, satir: { ...t.satir, [k.id]: { ...t.satir[k.id], fiyat: e.target.value } } }))} /></td>
              <td><input type="number" step="0.001" min="0" className="adm-inp" style={{ fontSize: 13, padding: '6px 9px' }} value={teslim.satir[k.id]?.ret} onChange={e => setTeslim((t: any) => ({ ...t, satir: { ...t.satir, [k.id]: { ...t.satir[k.id], ret: e.target.value } } }))} /></td>
              <td><input className="adm-inp" maxLength={300} placeholder={+teslim.satir[k.id]?.ret > 0 ? 'zorunlu' : ''} style={{ fontSize: 13, padding: '6px 9px' }} value={teslim.satir[k.id]?.neden} onChange={e => setTeslim((t: any) => ({ ...t, satir: { ...t.satir, [k.id]: { ...t.satir[k.id], neden: e.target.value } } }))} /></td></tr> })}</tbody></table>
          <FormGrid cols={3}>
            <Field label="Teslim tarihi"><input type="date" className="adm-inp" value={teslim.tarih} onChange={e => setTeslim((t: any) => ({ ...t, tarih: e.target.value }))} /></Field>
            <Field label="Depo"><select className="adm-inp" value={teslim.depo} onChange={e => setTeslim((t: any) => ({ ...t, depo: e.target.value }))}><option value="">Hammaddenin deposu</option>{d.depolar.map((x: any) => <option key={x.id} value={x.id}>{x.ad}</option>)}</select></Field>
            <Field label="Lot / irsaliye no" hint="Boşsa sipariş no yazılır"><input className="adm-inp" value={teslim.lot} onChange={e => setTeslim((t: any) => ({ ...t, lot: e.target.value }))} /></Field>
          </FormGrid>
          {!teslim.s.fatura_olusturuldu && <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, marginTop: 14 }}><input type="checkbox" checked={teslim.fatura} onChange={e => setTeslim((t: any) => ({ ...t, fatura: e.target.checked }))} />Sipariş tamamlanınca alış faturası oluştur (KDV %<input type="number" className="adm-inp" style={{ width: 60, padding: '3px 6px', display: 'inline-block' }} value={teslim.kdv} onChange={e => setTeslim((t: any) => ({ ...t, kdv: e.target.value }))} />) ve tedarikçi carisine işle</label>}
          <p style={{ fontSize: 11.5, color: 'var(--adm-tx3)', margin: '12px 0 0' }}>Kısmi teslim alabilirsin. Stok girişi yapılır, hammaddenin ağırlıklı ortalama maliyeti güncellenir ve lot kaydı açılır. Reddedilen mal stoğa girmez ve teslim sayılmaz (yerine yenisi beklenir); İade / Ret sayfasından takip edilir.{(teslim.s.para_birimi || 'TRY') !== 'TRY' || +teslim.s.masraf_tl > 0 ? ` Maliyet TL'ye çevrilir${+teslim.s.masraf_tl > 0 ? ' ve ek maliyet sipariş değeri oranında dağıtılır' : ''}.` : ''}</p>
        </>}
      </Modal>
      <Modal open={!!iade} onClose={() => setIade(null)} onSubmit={iadeKaydet} width={460} title="Tedarikçiye iade"
        footer={<><button type="button" className="adm-btn-ghost" onClick={() => setIade(null)}>İptal</button><button type="submit" className="adm-btn-danger" disabled={busy}>{busy ? 'İşleniyor…' : 'İade et ve stoktan düş'}</button></>}>
        {iade && <FormGrid cols={1}>
          <p style={{ margin: 0, fontSize: 13 }}><b>{ham[iade.k.hammadde_id]?.ad}</b> — teslim alınan {fmtN(+iade.k.teslim_alinan_miktar, 2)} {ham[iade.k.hammadde_id]?.birim}, stok {fmtN(ham[iade.k.hammadde_id]?.mevcut_stok, 2)}</p>
          <Field label="İade miktarı"><input type="number" step="0.001" min="0" className="adm-inp" autoFocus value={iade.miktar} onChange={e => setIade((x: any) => ({ ...x, miktar: e.target.value }))} /></Field>
          <Field label="İade nedeni *"><input className="adm-inp" maxLength={300} value={iade.neden} onChange={e => setIade((x: any) => ({ ...x, neden: e.target.value }))} placeholder="Örn. hatalı parti, kalite uygunsuz" /></Field>
          <p style={{ margin: 0, fontSize: 11.5, color: 'var(--adm-tx3)' }}>Mal stoktan düşülür, sipariş yeniden “yolda” olur (yerine yenisi beklenir). Alış faturası varsa tedarikçiden iade faturası isteyin.</p>
        </FormGrid>}
      </Modal>

      <Modal open={onayModal} onClose={() => setOnayModal(false)} onSubmit={onayKaydet} width={460} title="Sipariş onay kuralı"
        footer={<><button type="button" className="adm-btn-ghost" onClick={() => setOnayModal(false)}>İptal</button><button type="submit" className="adm-btn" disabled={busy}>Kaydet</button></>}>
        <div style={{ display: 'grid', gap: 12 }}>
          <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13.5 }}><input type="checkbox" checked={onay.aktif} onChange={e => setOnay(o => ({ ...o, aktif: e.target.checked }))} />Tutar limitinin üstündeki siparişler yönetici onayı gerektirsin</label>
          <Field label="Limit (₺, KDV hariç)"><input type="number" min="0" step="1" className="adm-inp" value={onay.limit} onChange={e => setOnay(o => ({ ...o, limit: +e.target.value }))} /></Field>
          <p style={{ margin: 0, fontSize: 12, color: 'var(--adm-tx3)' }}>Limit üstündeki sipariş yalnızca <b>yonetim</b> veya <b>satinalma_onay</b> yetkisi olan kullanıcılar tarafından onaylanabilir veya teslim alınabilir; bu kural veritabanında uygulanır, ekranı atlatmak mümkün değildir. Döviz siparişlerinde tutar kurla TL’ye çevrilerek karşılaştırılır.</p>
        </div>
      </Modal>
      {toast.node}
    </div>
  )
}
