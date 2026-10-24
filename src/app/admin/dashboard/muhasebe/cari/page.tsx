'use client'
import { useCallback, useEffect, useMemo, useState } from 'react'
import AdminTopBar from '@/components/admin/TopBar'
import { muh } from '@/lib/muhasebe-client'
import { useAcParam } from '@/lib/ac-param'
import { erp } from '@/lib/erp-client'
import { kurlariYukle } from '@/lib/doviz'
import { fmt, fmtK, fmtDate, todayISO, daysBetween, csvDownload } from '@/lib/fmt'
import { sum, kalanTutar, acikFatura } from '@/lib/muh-utils'
import { Page, PageHead, Kpi, KpiGrid, Badge, Tabs, Money, Drawer, Modal, Field, FormGrid, InfoRow, Divider, Empty, useToast } from '@/components/admin/erp/ui'
import Yardim from '@/components/admin/erp/Yardim'
import { DataGrid, type Col } from '@/components/admin/erp/DataGrid'
import { topluSilCalistir } from '@/lib/toplu-sil'
import TopluDuzenle from '@/components/admin/TopluDuzenle'
import {
  ListChecks, Plus, Pencil, Trash2, User, Building2, Phone, Mail, MessageCircle, FileBarChart, HandCoins, Users2, AlertTriangle, Scale, Wallet, Printer, Download, Receipt, FileSignature,
  FileSpreadsheet, Upload, CheckCircle2, XCircle,
} from 'lucide-react'

const TIP: Record<string, { l: string; tone: any; Icon: any }> = {
  musteri: { l: 'Müşteri', tone: 'blue', Icon: User }, tedarikci: { l: 'Tedarikçi', tone: 'amber', Icon: Building2 }, diger: { l: 'Diğer', tone: 'muted', Icon: User },
}
const DURUM: Record<string, { l: string; tone: any }> = { taslak: { l: 'Taslak', tone: 'muted' }, onaylandi: { l: 'Açık', tone: 'blue' }, odendi: { l: 'Ödendi', tone: 'green' }, iptal: { l: 'İptal', tone: 'red' } }
const bosForm = { tip: 'musteri', kod: '', ad: '', vergi_no: '', telefon: '', email: '', adres: '', notlar: '', fiyat_listesi_id: '' }

const vergiGecerli = (v: string) => !v || /^\d{10}$|^\d{11}$/.test(v.replace(/\s/g, ''))
const waNumara = (t: string) => { const d = (t || '').replace(/\D/g, ''); return d.startsWith('90') ? d : d.startsWith('0') ? '9' + d : d.length === 10 ? '90' + d : d }

export default function CariPage() {
  const toast = useToast()
  const [list, setList] = useState<any[]>([])
  const [kurlar, setKurlar] = useState<Record<string, number>>({ TRY: 1 })
  useEffect(() => { kurlariYukle().then(setKurlar).catch(() => {}) }, [])
  const dvz = (v: any, pb: 'USD' | 'EUR') => { const n = +v || 0; const tl = n * (kurlar[pb] || 0); return { n, txt: Math.abs(n).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + (pb === 'USD' ? ' $' : ' €'), tip: kurlar[pb] ? `≈ ${Math.abs(tl).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺ (güncel kur: ${kurlar[pb].toLocaleString('tr-TR', { maximumFractionDigits: 4 })})` : '' } }
  const [ozetRows, setOzetRows] = useState<any[]>([])
  const [dData, setDData] = useState<{ faturalar: any[]; islemler: any[]; cekler: any[] }>({ faturalar: [], islemler: [], cekler: [] })
  const [eski, setEski] = useState<any[]>([])
  const islemler = dData.islemler, faturalar = dData.faturalar, cekler = dData.cekler
  const [kasalar, setKasalar] = useState<any[]>([])
  const [fiyatListeleri, setFiyatListeleri] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const [tab, setTab] = useState('hepsi')
  const [detay, setDetay] = useState<any>(null)
  const [dTab, setDTab] = useState('ozet')
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [form, setForm] = useState<any>(bosForm)
  const [odeme, setOdeme] = useState<any>(null) // tahsilat / ödeme modalı
  const [busy, setBusy] = useState(false)
  const [toplu, setToplu] = useState<any[] | null>(null)
  const [iceAktar, setIceAktar] = useState<{ dosyaAdi: string; b64: string; asama: 'onizle' | 'hata' | 'onay' | 'bitti'; hatalar?: { satir: number; mesaj: string }[]; onizle?: { toplam: number; yeni: number; guncelleme: number }; sonuc?: { eklenen: number; guncellenen: number } } | null>(null)
  const [iceAktarBusy, setIceAktarBusy] = useState(false)

  const load = useCallback(async () => {
    // Cari başına fatura/işlem özetleri veritabanı görünümünden (v_cari_ozet); ekstre/fatura/çek detayı yalnızca seçili cari için çekilir.
    const [c, oz, k, fl] = await Promise.all([
      muh.all('cari_hesaplar', '*', q => q.order('ad', { ascending: true })),
      muh.all('v_cari_ozet'), muh.all('kasa_banka_hesaplari', 'id,ad,tip,aktif,para_birimi'),
      erp.from('fiyat_listeleri').select('id,ad').order('ad', { ascending: true }),
    ])
    setList(c); setOzetRows(oz); setKasalar(k.filter((x: any) => (x.para_birimi || 'TRY') === 'TRY')); setFiyatListeleri(fl.data || []); setLoading(false)
    setDetay((d: any) => (d ? c.find((x: any) => x.id === d.id) || null : null))
  }, [])
  useEffect(() => { load() }, [load])

  useAcParam(!loading, id => { const c = list.find((x: any) => x.id === id); if (c) { setDetay(c); setDTab('ozet') } })

  const bugun = todayISO()
  // Cari başına özet metrikler
  const M = useMemo(() => {
    const m: Record<string, any> = {}
    list.forEach(c => { m[c.id] = { ciro: 0, acik: 0, gecikmis: 0, fatSay: 0, son: null as string | null } })
    ozetRows.forEach(r => { if (m[r.cari_id]) m[r.cari_id] = { ciro: +r.ciro || 0, acik: +r.acik || 0, gecikmis: +r.gecikmis || 0, fatSay: +r.fat_say || 0, son: r.son_tarih || null } })
    return m
  }, [list, ozetRows])
  // Seçili carinin hareketleri (yalnızca o cari için sorgulanır)
  const detayId = detay?.id
  useEffect(() => {
    if (!detayId) { setDData({ faturalar: [], islemler: [], cekler: [] }); setEski([]); return }
    muh.all('cari_eski_hareketler', '*', q => q.eq('cari_id', detayId).order('grup', { ascending: true }).order('sira', { ascending: true })).then(setEski).catch(() => setEski([]))
    Promise.all([muh.all('faturalar', '*', q => q.eq('cari_id', detayId)), muh.all('islemler', '*', q => q.eq('cari_id', detayId)), muh.all('cek_senet', '*', q => q.eq('cari_id', detayId))])
      .then(([faturalar, islemler, cekler]) => setDData({ faturalar, islemler, cekler }))
  }, [detayId, ozetRows])

  const alacak = sum(list.filter(c => +c.bakiye > 0), c => c.bakiye)
  const borc = sum(list.filter(c => +c.bakiye < 0), c => -c.bakiye)
  const gecikmis = sum(Object.values(M), (x: any) => x.gecikmis)

  const filtered = list.filter(c => {
    if (tab === 'musteri' || tab === 'tedarikci') return c.tip === tab
    if (tab === 'bakiyeli') return Math.abs(+c.bakiye) > 0.005
    if (tab === 'gecikmis') return M[c.id]?.gecikmis > 0
    return true
  })

  /* ── Ekstre: fatura + işlem hareketleri, yürüyen bakiye (borç − alacak; + = cari bize borçlu) ── */
  const ekstre = useCallback((cariId: string) => {
    const h: { tarih: string; aciklama: string; tur: string; borc: number; alacak: number }[] = []
    faturalar.filter(f => f.cari_id === cariId && ['onaylandi', 'odendi'].includes(f.durum)).forEach(f => {
      const b = f.tip === 'satis'
      h.push({ tarih: f.tarih, aciklama: `Fatura ${f.no}`, tur: f.tip === 'satis' ? 'Satış faturası' : f.tip === 'alis' ? 'Alış faturası' : 'İade', borc: b ? +f.toplam : 0, alacak: b ? 0 : +f.toplam })
    })
    islemler.filter(i => i.cari_id === cariId).forEach(i => h.push({ tarih: i.tarih, aciklama: i.aciklama || i.kategori || 'İşlem', tur: i.tip === 'gelir' ? 'Tahsilat' : 'Ödeme', borc: i.tip === 'gider' ? +i.tutar : 0, alacak: i.tip === 'gelir' ? +i.tutar : 0 }))
    h.sort((a, b) => a.tarih.localeCompare(b.tarih))
    let b = 0
    return h.map(x => { b += x.borc - x.alacak; return { ...x, bakiye: b } })
  }, [faturalar, islemler])

  // Eski program hareketleri (salt okunur): ekstrede aynı listede görünür, bakiyeye dahil değildir
  type EkSatir = { tarih: string; aciklama: string; tur: string; borc: number; alacak: number; bakiye: number | null; eski?: boolean }
  const eskiSatirlar = useCallback((): EkSatir[] => eski.filter(r => !(r.nakil && !+r.tl_borc && !+r.tl_alacak)).map(r => ({
    tarih: r.tarih, eski: true, bakiye: null, borc: +r.tl_borc || 0, alacak: +r.tl_alacak || 0,
    aciklama: r.nakil ? 'Önceki dönemden devir' : [r.evrak_cinsi, r.evrak_no].filter(Boolean).join(' · ') + (r.aciklama ? ` — ${r.aciklama}` : '') + (r.gib_fatura_no ? ` (${r.gib_fatura_no})` : ''),
    tur: `Eski program · ${r.grup}${r.vade ? ` · vade ${r.vade}` : ''}${+r.usd_borc || +r.usd_alacak ? ` · ${fmt(+r.usd_borc || +r.usd_alacak)} $` : ''}`,
  })), [eski])
  const birlesik = (cariId: string): EkSatir[] => [...ekstre(cariId), ...eskiSatirlar()].sort((a, b) => a.tarih.localeCompare(b.tarih))

  function ekstreYazdir(c: any) {
    const ek = birlesik(c.id)
    const rows = ek.map(h => `<tr><td>${fmtDate(h.tarih)}</td><td>${h.aciklama}</td><td>${h.tur}</td><td style="text-align:right">${h.borc ? fmt(h.borc) : ''}</td><td style="text-align:right">${h.alacak ? fmt(h.alacak) : ''}</td><td style="text-align:right;font-weight:600">${h.bakiye == null ? '' : fmt(h.bakiye)}</td></tr>`).join('')
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>${c.ad} - Ekstre</title><style>
      body{font-family:Arial,sans-serif;color:#0b0e0b;padding:40px;max-width:860px;margin:0 auto}h1{font-size:20px;margin:0 0 4px}.muted{color:#6b7366;font-size:12px}
      table{width:100%;border-collapse:collapse;margin-top:24px}th,td{padding:8px 6px;font-size:12.5px;border-bottom:1px solid #ddd;text-align:left}th{color:#6b7366;font-size:11px;text-transform:uppercase}
      .header{display:flex;justify-content:space-between;border-bottom:2px solid #e55f28;padding-bottom:16px;margin-bottom:16px}.toplam{margin-top:16px;text-align:right;font-size:15px;font-weight:700}@media print{body{padding:0}}</style></head><body>
      <div class="header"><div><h1>ALYA PLASTİK</h1><p class="muted">Cari Hesap Ekstresi</p></div><div style="text-align:right"><h1>${c.ad}</h1><p class="muted">${new Date().toLocaleDateString('tr-TR')} itibarıyla</p></div></div>
      <table><thead><tr><th>Tarih</th><th>Açıklama</th><th>Tür</th><th style="text-align:right">Borç</th><th style="text-align:right">Alacak</th><th style="text-align:right">Bakiye</th></tr></thead><tbody>${rows}</tbody></table>
      <p class="toplam">Güncel Bakiye: ${fmt(+c.bakiye)}</p></body></html>`
    const w = window.open('', '_blank'); if (w) { w.document.write(html); w.document.close(); w.focus(); setTimeout(() => w.print(), 300) }
  }

  /* ── CRUD ── */
  function openNew() { setEditing(null); setForm(bosForm); setModal(true) }
  function openEdit(c: any) { setEditing(c); setForm({ tip: c.tip, kod: c.kod || '', ad: c.ad, vergi_no: c.vergi_no || '', telefon: c.telefon || '', email: c.email || '', adres: c.adres || '', notlar: c.notlar || '', fiyat_listesi_id: c.fiyat_listesi_id || '' }); setModal(true) }

  async function save(e: React.FormEvent) {
    e.preventDefault(); if (busy) return
    if (!vergiGecerli(form.vergi_no)) { toast.show('Vergi no / TC 10 veya 11 haneli olmalı', true); return }
    const dup = list.find(c => c.ad.trim().toLocaleLowerCase('tr') === form.ad.trim().toLocaleLowerCase('tr') && c.id !== editing?.id)
    if (dup && !confirm(`“${dup.ad}” adlı bir cari zaten var. Yine de kaydedilsin mi?`)) return
    setBusy(true)
    const payload = { ...form, kod: form.kod.trim().toUpperCase() || undefined, ad: form.ad.trim(), vergi_no: form.vergi_no.replace(/\s/g, '') || null, fiyat_listesi_id: form.fiyat_listesi_id || null }
    const r: any = editing ? await muh.from('cari_hesaplar').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', editing.id) : await muh.from('cari_hesaplar').insert(payload)
    setBusy(false)
    if (r?.error) { toast.show(/cari_hesaplar_kod_uq|duplicate key/i.test(String(r.error)) ? `“${payload.kod}” kodu başka bir carde kullanılıyor` : r.error, true); return }
    setModal(false); toast.show(editing ? 'Cari güncellendi' : 'Cari eklendi'); load()
  }

  /* ── Excel içe aktarma: dosya seçilince önce önizleme (kaç yeni/güncelleme veya hata listesi), onaylanınca yazma ── */
  function dosyaSecildi(e: React.ChangeEvent<HTMLInputElement>) {
    const dosya = e.target.files?.[0]; e.target.value = ''
    if (!dosya) return
    const okuyucu = new FileReader()
    okuyucu.onload = async () => {
      const b64 = String(okuyucu.result).split(',')[1] || ''
      setIceAktar({ dosyaAdi: dosya.name, b64, asama: 'onizle' })
      setIceAktarBusy(true)
      try {
        const r = await fetch('/api/admin/muhasebe-cari-excel', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ b64 }) }).then(x => x.json())
        if (!r.ok) setIceAktar(f => f && { ...f, asama: 'hata', hatalar: r.hatalar })
        else setIceAktar(f => f && { ...f, asama: 'onay', onizle: r.onizle })
      } catch { toast.show('Dosya işlenemedi', true); setIceAktar(null) }
      setIceAktarBusy(false)
    }
    okuyucu.readAsDataURL(dosya)
  }
  async function iceAktarOnayla() {
    if (!iceAktar) return
    setIceAktarBusy(true)
    try {
      const r = await fetch('/api/admin/muhasebe-cari-excel', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ b64: iceAktar.b64, onayla: true }) }).then(x => x.json())
      if (!r.ok) setIceAktar(f => f && { ...f, asama: 'hata', hatalar: r.hatalar })
      else { setIceAktar(f => f && { ...f, asama: 'bitti', sonuc: { eklenen: r.eklenen, guncellenen: r.guncellenen } }); load() }
    } catch { toast.show('İçe aktarma başarısız oldu', true) }
    setIceAktarBusy(false)
  }

  async function topluSil(sel: any[]): Promise<string | void> {
    const { silinen, hata } = await topluSilCalistir(sel, async (r: any) => (Math.abs(+r.bakiye) > 0.005 ? `${r.ad}: bakiyesi var, silinemez` : M[r.id]?.fatSay ? `${r.ad}: faturası var, silinemez` : (await muh.from('cari_hesaplar').delete().eq('id', r.id))?.error), 'cari')
    load(); setDetay(null)
    if (hata) return hata
    toast.show(`${silinen} cari silindi`)
  }
  async function del(c: any) {
    const x = M[c.id]
    if (Math.abs(+c.bakiye) > 0.005 && !confirm(`${c.ad} hesabının ${fmt(c.bakiye)} bakiyesi var. Yine de silinsin mi?`)) return
    if (x?.fatSay && !confirm(`${x.fatSay} faturası bulunan cari siliniyor. Emin misin?`)) return
    if (!x?.fatSay && Math.abs(+c.bakiye) <= 0.005 && !confirm(`${c.ad} silinsin mi?`)) return
    const r: any = await muh.from('cari_hesaplar').delete().eq('id', c.id)
    if (r?.error) { toast.show('Silinemedi: ' + r.error, true); return }
    toast.show('Cari silindi'); setDetay(null); load()
  }

  function openOdeme(c: any) {
    const b = +c.bakiye
    setOdeme({ cari: c, tip: b < 0 || c.tip === 'tedarikci' ? 'gider' : 'gelir', tutar: Math.abs(b) > 0.005 ? String(Math.abs(b)) : '', kasa: '', yontem: 'havale', tarih: todayISO(), aciklama: '' })
  }
  async function kaydetOdeme(e: React.FormEvent) {
    e.preventDefault(); if (busy || !odeme) return
    if (!(+odeme.tutar > 0)) { toast.show('Tutar gerekli', true); return }
    setBusy(true)
    const r: any = await muh.from('islemler').insert({
      tip: odeme.tip, kategori: odeme.tip === 'gelir' ? 'Cari Tahsilat' : 'Cari Ödeme', tutar: +odeme.tutar, tarih: odeme.tarih, odeme_yontemi: odeme.yontemi ?? odeme.yontem,
      cari_id: odeme.cari.id, kasa_hesap_id: odeme.kasa || null, aciklama: odeme.aciklama || `${odeme.cari.ad} — ${odeme.tip === 'gelir' ? 'tahsilat' : 'ödeme'}`,
    })
    setBusy(false)
    if (r?.error) { toast.show(r.error, true); return }
    toast.show(odeme.tip === 'gelir' ? 'Tahsilat kaydedildi' : 'Ödeme kaydedildi'); setOdeme(null); load()
  }

  /* ── Grid ── */
  const cols: Col<any>[] = [
    {
      key: 'ad', label: 'Cari', sort: c => c.ad, render: c => {
        const T = TIP[c.tip] || TIP.diger
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: 9, background: 'var(--adm-s2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><T.Icon size={15} style={{ color: 'var(--adm-tx2)' }} /></div>
            <div style={{ minWidth: 0 }}><div style={{ fontWeight: 600 }}>{c.ad}</div><div style={{ fontSize: 11, color: 'var(--adm-tx3)' }}>{c.kod && <span style={{ fontFamily: 'JetBrains Mono,monospace', marginRight: 6 }}>{c.kod}</span>}{c.telefon || c.email || '—'}</div></div>
          </div>)
      },
    },
    { key: 'tip', label: 'Tür', width: 96, sort: c => c.tip, render: c => <Badge tone={(TIP[c.tip] || TIP.diger).tone}>{(TIP[c.tip] || TIP.diger).l}</Badge> },
    {
      key: 'bakiye', label: 'Bakiye', align: 'right', sort: c => +c.bakiye,
      render: c => Math.abs(+c.bakiye) < 0.005 && Math.abs(+c.bakiye_usd || 0) < 0.005 && Math.abs(+c.bakiye_eur || 0) < 0.005 ? <span style={{ color: 'var(--adm-tx3)' }}>Kapalı</span> : (
        <div>
          {Math.abs(+c.bakiye) >= 0.005 && <><Money v={Math.abs(+c.bakiye)} tone={+c.bakiye > 0 ? 'green' : 'red'} /><div style={{ fontSize: 10.5, color: 'var(--adm-tx3)' }}>{+c.bakiye > 0 ? 'bize borçlu' : 'biz borçluyuz'}</div></>}
          {(['USD', 'EUR'] as const).map(pb => { const d = dvz(c[pb === 'USD' ? 'bakiye_usd' : 'bakiye_eur'], pb); return Math.abs(d.n) >= 0.005 && <div key={pb} title={d.tip} style={{ fontSize: 12, fontWeight: 600, marginTop: 3, cursor: 'help', color: d.n > 0 ? 'var(--adm-green)' : 'var(--adm-red)' }}>{d.txt} <span style={{ fontWeight: 400, fontSize: 10.5, color: 'var(--adm-tx3)' }}>{d.n > 0 ? 'bize borçlu' : 'biz borçluyuz'}</span></div> })}
        </div>),
      total: rs => <div><Money v={sum(rs, c => c.bakiye)} tone="auto" /><div style={{ fontSize: 11 }}>{sum(rs, c => c.bakiye_usd || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} $</div></div>, csv: c => +c.bakiye,
    },
    { key: 'acik', label: 'Açık Fatura', align: 'right', sort: c => M[c.id]?.acik || 0, render: c => M[c.id]?.acik > 0 ? <Money v={M[c.id].acik} bold={false} /> : <span style={{ color: 'var(--adm-tx3)' }}>—</span>, hideSm: true },
    { key: 'gec', label: 'Vadesi Geçen', align: 'right', sort: c => M[c.id]?.gecikmis || 0, render: c => M[c.id]?.gecikmis > 0 ? <Money v={M[c.id].gecikmis} tone="red" /> : <span style={{ color: 'var(--adm-tx3)' }}>—</span>, hideSm: true },
    { key: 'ciro', label: 'Toplam Ciro', align: 'right', sort: c => M[c.id]?.ciro || 0, render: c => M[c.id]?.ciro > 0 ? <Money v={M[c.id].ciro} bold={false} /> : <span style={{ color: 'var(--adm-tx3)' }}>—</span>, hidden: true },
    { key: 'son', label: 'Son Hareket', sort: c => M[c.id]?.son || '', render: c => M[c.id]?.son ? <span style={{ fontSize: 12 }}>{fmtDate(M[c.id].son)}<span style={{ color: 'var(--adm-tx3)' }}> · {daysBetween(M[c.id].son)}g önce</span></span> : '—', hideSm: true },
    { key: 'vergi', label: 'Vergi No', sort: c => c.vergi_no || '', render: c => c.vergi_no || '—', hidden: true },
    { key: 'act', label: '', width: 100, align: 'right', render: c => (
      <span style={{ display: 'inline-flex', gap: 4 }} onClick={e => e.stopPropagation()}>
        <button className="adm-btn-ghost" style={{ padding: '4px 7px' }} title={+c.bakiye < 0 ? 'Ödeme yap' : 'Tahsilat al'} onClick={() => openOdeme(c)}><HandCoins size={12} /></button>
        <button className="adm-btn-ghost" style={{ padding: '4px 7px' }} onClick={() => openEdit(c)}><Pencil size={12} /></button>
        <button className="adm-btn-danger" style={{ padding: '4px 7px' }} onClick={() => del(c)}><Trash2 size={12} /></button>
      </span>) },
  ]

  const dm = detay ? M[detay.id] : null
  const dEk = detay ? birlesik(detay.id) : []
  const dFat = detay ? faturalar.filter(f => f.cari_id === detay.id).sort((a, b) => b.tarih.localeCompare(a.tarih)) : []
  const dCek = detay ? cekler.filter(c => c.cari_id === detay.id) : []
  const hatirlatma = detay ? `Merhaba ${detay.ad}, Alya Plastik hesabınızda ${fmt(Math.abs(detay.bakiye))} tutarında ${+detay.bakiye > 0 ? 'ödenmemiş bakiye' : 'ödeme bakiyesi'} görünmektedir. Bilginize sunarız.` : ''

  return (
    <div style={{ flex: 1, overflow: 'auto' }}>
      <AdminTopBar title="Cari Hesaplar" />
      <Page>
        <PageHead title="Cari Hesap Yönetimi" sub="Müşteri ve tedarikçi bakiyeleri, ekstre, tahsilat/ödeme takibi"
          actions={<>
            <a className="adm-btn-ghost" style={{ textDecoration: 'none' }} href={`/api/admin/muhasebe-cari-excel?tip=sablon`} title="Boş Excel şablonu indir"><FileSpreadsheet size={13} />Şablon İndir</a>
            <a className="adm-btn-ghost" style={{ textDecoration: 'none' }} href={`/api/admin/muhasebe-cari-excel?tip=disa`} title="Tüm cari listesini Excel olarak indir"><Download size={13} />Excel&apos;e Aktar</a>
            <label className="adm-btn-ghost" style={{ cursor: 'pointer' }}><Upload size={13} />Excel&apos;den İçe Aktar<input type="file" accept=".xlsx" onChange={dosyaSecildi} style={{ display: 'none' }} /></label>
            <button className="adm-btn" onClick={openNew}><Plus size={14} />Yeni Cari</button>
          </>} />

        <Yardim sayfa="cari" sekme={tab} />
        <KpiGrid min={190}>
          <Kpi label="Toplam Alacak" value={fmtK(alacak)} Icon={HandCoins} color="var(--adm-green)" sub={`${list.filter(c => +c.bakiye > 0).length} cari bize borçlu`} />
          <Kpi label="Toplam Borç" value={fmtK(borc)} Icon={Wallet} color="var(--adm-red)" sub={`${list.filter(c => +c.bakiye < 0).length} cariye borçluyuz`} />
          <Kpi label="Net Pozisyon" value={fmtK(alacak - borc)} Icon={Scale} color={alacak - borc >= 0 ? 'var(--adm-blue)' : 'var(--adm-red)'} sub="Alacak − Borç" />
          <Kpi label="Vadesi Geçen" value={fmtK(gecikmis)} Icon={AlertTriangle} color={gecikmis > 0 ? 'var(--adm-red)' : 'var(--adm-green)'} sub={gecikmis > 0 ? `${list.filter(c => M[c.id]?.gecikmis > 0).length} cari gecikmede` : 'Gecikme yok'} />
          <Kpi label="Toplam Cari" value={list.length} Icon={Users2} color="var(--adm-ac)" sub={`${list.filter(c => c.tip === 'musteri').length} müşteri · ${list.filter(c => c.tip === 'tedarikci').length} tedarikçi`} />
        </KpiGrid>

        <div style={{ marginBottom: 12 }}>
          <Tabs value={tab} onChange={setTab} tabs={[
            { v: 'hepsi', l: 'Tümü', n: list.length }, { v: 'musteri', l: 'Müşteriler', n: list.filter(c => c.tip === 'musteri').length },
            { v: 'tedarikci', l: 'Tedarikçiler', n: list.filter(c => c.tip === 'tedarikci').length },
            { v: 'bakiyeli', l: 'Bakiyesi olan', n: list.filter(c => Math.abs(+c.bakiye) > 0.005).length },
            { v: 'gecikmis', l: 'Vadesi geçen', n: list.filter(c => M[c.id]?.gecikmis > 0).length },
          ]} />
        </div>

        <DataGrid rows={filtered} cols={cols} rowKey={c => c.id} loading={loading} onBulkDelete={topluSil} deleteNoun="cari" deleteNote="Bakiyesi veya faturası olan cariler güvenlik için atlanır; onları tek tek silebilirsiniz." csvName="cari-hesaplar" storageKey="cari"
          searchText={c => `${c.kod || ''} ${c.muhasebe_kodu || ''} ${c.ad} ${c.email || ''} ${c.telefon || ''} ${c.vergi_no || ''}`} searchPlaceholder="Kod, muhasebe kodu (120.03.139), ad, telefon, vergi no..."
          onRowClick={c => { setDetay(c); setDTab('ozet') }} activeKey={detay?.id}
          emptyTitle="Cari bulunamadı" emptySub="Yeni Cari butonuyla ilk hesabı ekle" selectable
          bulkActions={sel => <button className="adm-btn-ghost" style={{ padding: '3px 12px', fontSize: 12 }} onClick={() => setToplu(sel)}><ListChecks size={12} />Toplu düzenle</button>} />
      </Page>

      {/* Detay */}
      <Drawer open={!!detay} onClose={() => setDetay(null)} width={640}
        title={detay && <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>{detay.ad}<Badge tone={(TIP[detay.tip] || TIP.diger).tone}>{(TIP[detay.tip] || TIP.diger).l}</Badge></span>}
        sub={detay && [detay.telefon, detay.email].filter(Boolean).join(' · ') || 'İletişim bilgisi yok'}
        footer={detay && <>
          <button className="adm-btn-ghost" onClick={() => openEdit(detay)}><Pencil size={13} />Düzenle</button>
          <button className="adm-btn" onClick={() => openOdeme(detay)}><HandCoins size={14} />{+detay.bakiye < 0 ? 'Ödeme Yap' : 'Tahsilat Al'}</button>
        </>}>
        {detay && (
          <div>
            <div style={{ padding: '18px 20px 0' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(130px,1fr))', gap: 10, marginBottom: 14 }}>
                <div style={{ padding: 12, borderRadius: 10, background: 'var(--adm-s2)' }}>
                  <div className="adm-kpi-label" style={{ marginBottom: 4 }}>Bakiye</div>
                  <Money v={Math.abs(+detay.bakiye)} tone={Math.abs(+detay.bakiye) < 0.005 ? undefined : +detay.bakiye > 0 ? 'green' : 'red'} size={17} />
                  <div style={{ fontSize: 10.5, color: 'var(--adm-tx3)' }}>{Math.abs(+detay.bakiye) < 0.005 ? 'hesap kapalı' : +detay.bakiye > 0 ? 'bize borçlu' : 'biz borçluyuz'}</div>
                </div>
                {(['USD', 'EUR'] as const).map(pb => { const d = dvz(detay[pb === 'USD' ? 'bakiye_usd' : 'bakiye_eur'], pb); return Math.abs(d.n) >= 0.005 && <div key={pb} title={d.tip} style={{ padding: 12, borderRadius: 10, background: 'var(--adm-s2)', cursor: 'help' }}>
                  <div className="adm-kpi-label" style={{ marginBottom: 4 }}>Bakiye ({pb})</div>
                  <div style={{ fontSize: 17, fontWeight: 700, color: d.n > 0 ? 'var(--adm-green)' : 'var(--adm-red)' }}>{d.txt}</div>
                  <div style={{ fontSize: 10.5, color: 'var(--adm-tx3)' }}>{d.tip || (d.n > 0 ? 'bize borçlu' : 'biz borçluyuz')}</div>
                </div> })}
                <div style={{ padding: 12, borderRadius: 10, background: 'var(--adm-s2)' }}><div className="adm-kpi-label" style={{ marginBottom: 4 }}>Açık Fatura</div><Money v={dm?.acik || 0} size={17} /></div>
                <div style={{ padding: 12, borderRadius: 10, background: dm?.gecikmis ? 'var(--adm-red2)' : 'var(--adm-s2)' }}><div className="adm-kpi-label" style={{ marginBottom: 4 }}>Vadesi Geçen</div><Money v={dm?.gecikmis || 0} tone={dm?.gecikmis ? 'red' : undefined} size={17} /></div>
                <div style={{ padding: 12, borderRadius: 10, background: 'var(--adm-s2)' }}><div className="adm-kpi-label" style={{ marginBottom: 4 }}>Toplam Ciro</div><Money v={dm?.ciro || 0} size={17} /></div>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
                {detay.telefon && <a className="adm-btn-ghost" href={`tel:${detay.telefon}`} style={{ textDecoration: 'none' }}><Phone size={13} />Ara</a>}
                {detay.telefon && <a className="adm-btn-ghost" target="_blank" rel="noreferrer" href={`https://wa.me/${waNumara(detay.telefon)}?text=${encodeURIComponent(hatirlatma)}`} style={{ textDecoration: 'none', color: 'var(--adm-green)' }}><MessageCircle size={13} />WhatsApp Hatırlat</a>}
                {detay.email && <a className="adm-btn-ghost" href={`mailto:${detay.email}?subject=${encodeURIComponent('Cari hesap bilgilendirmesi')}&body=${encodeURIComponent(hatirlatma)}`} style={{ textDecoration: 'none' }}><Mail size={13} />E-posta</a>}
                <button className="adm-btn-ghost" onClick={() => ekstreYazdir(detay)}><Printer size={13} />Ekstre Yazdır</button>
              </div>
              <Tabs value={dTab} onChange={setDTab} tabs={[{ v: 'ozet', l: 'Bilgiler' }, { v: 'ekstre', l: 'Ekstre', n: dEk.length }, { v: 'fatura', l: 'Faturalar', n: dFat.length }, { v: 'cek', l: 'Çek/Senet', n: dCek.length }]} />
            </div>

            {dTab === 'ozet' && (
              <div style={{ padding: 20 }}>
                <InfoRow k="Cari kodu" v={detay.kod || '—'} /><InfoRow k="Muhasebe kodu" v={detay.muhasebe_kodu || '—'} /><InfoRow k="Vergi No / TC" v={detay.vergi_no || '—'} />
                <InfoRow k="Telefon" v={detay.telefon || '—'} />
                <InfoRow k="E-posta" v={detay.email || '—'} />
                <InfoRow k="Adres" v={detay.adres || '—'} />
                <InfoRow k="Fiyat listesi" v={fiyatListeleri.find(f => f.id === detay.fiyat_listesi_id)?.ad || 'Varsayılan'} />
                <InfoRow k="Fatura sayısı" v={dm?.fatSay || 0} />
                <InfoRow k="Son hareket" v={dm?.son ? fmtDate(dm.son) : '—'} />
                <InfoRow k="Kayıt tarihi" v={fmtDate(detay.created_at)} />
                {detay.notlar && <><Divider label="Notlar" /><p style={{ fontSize: 13, color: 'var(--adm-tx2)', margin: 0, whiteSpace: 'pre-wrap' }}>{detay.notlar}</p></>}
                <div style={{ marginTop: 22 }}><button className="adm-btn-danger" onClick={() => del(detay)}><Trash2 size={13} />Cariyi Sil</button></div>
              </div>
            )}

            {dTab === 'ekstre' && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '10px 20px 0', gap: 8 }}>
                  <button className="adm-btn-ghost" style={{ fontSize: 12 }} disabled={!dEk.length} onClick={() => csvDownload(`ekstre-${detay.ad}.csv`, dEk.map(h => ({ Tarih: h.tarih, Açıklama: h.aciklama, Tür: h.tur, Borç: h.borc, Alacak: h.alacak, Bakiye: h.bakiye ?? '' })))}><Download size={12} />CSV</button>
                </div>
                {dEk.length === 0 ? <Empty icon={<FileBarChart size={28} />} title="Hareket yok" sub="Bu cariye ait onaylı fatura ya da işlem bulunmuyor" /> : (
                  <div style={{ overflow: 'auto', padding: '8px 0' }}>
                    <table className="adm-tbl">
                      <thead><tr><th>Tarih</th><th>Açıklama</th><th style={{ textAlign: 'right' }}>Borç</th><th style={{ textAlign: 'right' }}>Alacak</th><th style={{ textAlign: 'right' }}>Bakiye</th></tr></thead>
                      <tbody>{[...dEk].reverse().map((h, i) => (
                        <tr key={i}>
                          <td style={{ whiteSpace: 'nowrap' }}>{fmtDate(h.tarih)}</td>
                          <td><div style={{ fontWeight: 500 }}>{h.aciklama}</div><div style={{ fontSize: 11, color: h.eski ? 'var(--adm-ac)' : 'var(--adm-tx3)' }}>{h.tur}</div></td>
                          <td style={{ textAlign: 'right' }}>{h.borc ? <Money v={h.borc} bold={false} /> : ''}</td>
                          <td style={{ textAlign: 'right' }}>{h.alacak ? <Money v={h.alacak} bold={false} /> : ''}</td>
                          <td style={{ textAlign: 'right' }}>{h.bakiye == null ? '' : <Money v={h.bakiye} tone="auto" />}</td>
                        </tr>))}</tbody>
                    </table>
                    {dEk.some(h => h.eski) && <div style={{ padding: '8px 20px', fontSize: 11.5, color: 'var(--adm-tx3)' }}>Turuncu &quot;Eski program&quot; satırları eski programdan aktarılmış geçmiştir; yürüyen bakiyeye dahil değildir, güncel bakiye yukarıdaki kutuda gösterilir.</div>}
                  </div>
                )}
              </div>
            )}

            {dTab === 'fatura' && (dFat.length === 0 ? <Empty icon={<Receipt size={28} />} title="Fatura yok" /> : dFat.map(f => (
              <div key={f.id} className="adm-row">
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{f.no} <span style={{ color: 'var(--adm-tx3)', fontWeight: 400 }}>· {f.tip === 'satis' ? 'Satış' : f.tip === 'alis' ? 'Alış' : 'İade'}</span></div>
                  <div style={{ fontSize: 11.5, color: f.vade && f.vade < bugun && acikFatura(f) ? 'var(--adm-red)' : 'var(--adm-tx3)' }}>{fmtDate(f.tarih)}{f.vade ? ` · vade ${fmtDate(f.vade)}` : ''}</div>
                </div>
                <div style={{ textAlign: 'right' }}><Money v={+f.toplam} bold={false} />{acikFatura(f) && +f.odenen_tutar > 0 && <div style={{ fontSize: 10.5, color: 'var(--adm-tx3)' }}>kalan {fmt(kalanTutar(f))}</div>}</div>
                <Badge tone={DURUM[f.durum]?.tone}>{DURUM[f.durum]?.l}</Badge>
              </div>)))}

            {dTab === 'cek' && (dCek.length === 0 ? <Empty icon={<FileSignature size={28} />} title="Çek/senet yok" /> : dCek.map(c => (
              <div key={c.id} className="adm-row">
                <div style={{ flex: 1 }}><div style={{ fontSize: 13, fontWeight: 600 }}>{c.tip === 'cek' ? 'Çek' : 'Senet'} {c.no || ''}</div><div style={{ fontSize: 11.5, color: 'var(--adm-tx3)' }}>{c.banka || ''} · vade {fmtDate(c.vade_tarihi)}</div></div>
                <Money v={+c.tutar} tone={c.yon === 'alinan' ? 'green' : 'red'} /><Badge tone={c.durum === 'portfoyde' ? 'blue' : c.durum === 'karsiliksiz' ? 'red' : 'green'}>{c.durum.replace('_', ' ')}</Badge>
              </div>)))}
          </div>
        )}
      </Drawer>

      {/* Cari formu */}
      <Modal open={modal} onClose={() => setModal(false)} onSubmit={save} title={editing ? 'Cariyi Düzenle' : 'Yeni Cari Hesap'} width={600}
        footer={<><button type="button" className="adm-btn-ghost" onClick={() => setModal(false)}>İptal</button><button type="submit" className="adm-btn" disabled={busy}>{busy ? 'Kaydediliyor...' : 'Kaydet'}</button></>}>
        <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
          {Object.entries(TIP).map(([k, v]) => <button key={k} type="button" onClick={() => setForm((f: any) => ({ ...f, tip: k }))} className={form.tip === k ? 'adm-btn' : 'adm-btn-ghost'} style={{ flex: 1, justifyContent: 'center' }}><v.Icon size={13} />{v.l}</button>)}
        </div>
        <FormGrid>
          <Field label="Cari Kodu" hint={editing ? 'Benzersiz olmalı; boşaltırsanız eski kod korunur' : 'Boş bırakırsanız otomatik verilir (müşteri MUS-0001, tedarikçi TED-0001)'}><input className="adm-inp" value={form.kod} maxLength={30} onChange={e => setForm((f: any) => ({ ...f, kod: e.target.value.toUpperCase() }))} placeholder={form.tip === 'tedarikci' ? 'TED-0001' : form.tip === 'musteri' ? 'MUS-0001' : 'CAR-0001'} style={{ fontFamily: 'JetBrains Mono,monospace' }} /></Field>
          <Field label="Ad / Unvan *"><input className="adm-inp" required autoFocus value={form.ad} onChange={e => setForm((f: any) => ({ ...f, ad: e.target.value }))} /></Field>
          <Field label="Vergi No / TC" hint={form.vergi_no && !vergiGecerli(form.vergi_no) ? '10 (vergi no) veya 11 (TC) hane olmalı' : undefined}><input className="adm-inp" inputMode="numeric" value={form.vergi_no} onChange={e => setForm((f: any) => ({ ...f, vergi_no: e.target.value.replace(/[^\d\s]/g, '') }))} style={form.vergi_no && !vergiGecerli(form.vergi_no) ? { borderColor: 'var(--adm-red)' } : undefined} /></Field>
          <Field label="Telefon"><input className="adm-inp" value={form.telefon} onChange={e => setForm((f: any) => ({ ...f, telefon: e.target.value }))} placeholder="05xx xxx xx xx" /></Field>
          <Field label="E-posta"><input type="email" className="adm-inp" value={form.email} onChange={e => setForm((f: any) => ({ ...f, email: e.target.value }))} /></Field>
          <Field label="Fiyat Listesi"><select className="adm-inp" value={form.fiyat_listesi_id} onChange={e => setForm((f: any) => ({ ...f, fiyat_listesi_id: e.target.value }))}><option value="">Varsayılan</option>{fiyatListeleri.map(f => <option key={f.id} value={f.id}>{f.ad}</option>)}</select></Field>
          <Field label="Adres" span={2}><input className="adm-inp" value={form.adres} onChange={e => setForm((f: any) => ({ ...f, adres: e.target.value }))} /></Field>
          <Field label="Notlar" span={2}><textarea className="adm-inp" rows={2} value={form.notlar} onChange={e => setForm((f: any) => ({ ...f, notlar: e.target.value }))} /></Field>
        </FormGrid>
      </Modal>

      {/* Tahsilat / Ödeme */}
      <Modal open={!!odeme} onClose={() => setOdeme(null)} onSubmit={kaydetOdeme} width={480}
        title={odeme && <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>{odeme.cari.ad}
          <span style={{ display: 'flex', gap: 4 }}>{(['gelir', 'gider'] as const).map(t => <button key={t} type="button" onClick={() => setOdeme((o: any) => ({ ...o, tip: t }))} style={{ padding: '4px 12px', borderRadius: 7, fontSize: 12, fontWeight: 700, border: 'none', fontFamily: 'inherit', background: odeme.tip === t ? (t === 'gelir' ? 'var(--adm-green)' : 'var(--adm-red)') : 'var(--adm-s3)', color: odeme.tip === t ? '#fff' : 'var(--adm-tx3)' }}>{t === 'gelir' ? 'Tahsilat' : 'Ödeme'}</button>)}</span></span>}
        footer={<><button type="button" className="adm-btn-ghost" onClick={() => setOdeme(null)}>İptal</button><button type="submit" className="adm-btn" disabled={busy} style={{ background: odeme?.tip === 'gelir' ? 'var(--adm-green)' : 'var(--adm-red)' }}>Kaydet</button></>}>
        {odeme && (
          <FormGrid>
            <Field label="Tutar (₺) *"><input type="number" step="0.01" className="adm-inp" required autoFocus value={odeme.tutar} onChange={e => setOdeme((o: any) => ({ ...o, tutar: e.target.value }))} style={{ fontSize: 16, fontWeight: 700 }} /></Field>
            <Field label="Tarih"><input type="date" className="adm-inp" value={odeme.tarih} onChange={e => setOdeme((o: any) => ({ ...o, tarih: e.target.value }))} /></Field>
            <Field label="Kasa / Banka" hint={odeme.kasa ? undefined : 'Seçilmezse hesap bakiyesi değişmez'}><select className="adm-inp" value={odeme.kasa} onChange={e => setOdeme((o: any) => ({ ...o, kasa: e.target.value }))}><option value="">— Seçilmedi —</option>{kasalar.filter(k => k.aktif !== false).map(k => <option key={k.id} value={k.id}>{k.ad}</option>)}</select></Field>
            <Field label="Yöntem"><select className="adm-inp" value={odeme.yontem} onChange={e => setOdeme((o: any) => ({ ...o, yontem: e.target.value }))}><option value="nakit">Nakit</option><option value="havale">Havale/EFT</option><option value="kredi_karti">Kredi Kartı</option><option value="cek">Çek</option><option value="diger">Diğer</option></select></Field>
            <Field label="Açıklama" span={2}><input className="adm-inp" value={odeme.aciklama} onChange={e => setOdeme((o: any) => ({ ...o, aciklama: e.target.value }))} /></Field>
            <div style={{ gridColumn: 'span 2', fontSize: 12, color: 'var(--adm-tx3)' }}>Bakiye: {fmt(odeme.cari.bakiye)} → <b style={{ color: 'var(--adm-tx)' }}>{fmt(+odeme.cari.bakiye + (odeme.tip === 'gelir' ? -1 : 1) * (+odeme.tutar || 0))}</b></div>
          </FormGrid>
        )}
      </Modal>

      <Modal open={!!iceAktar} onClose={() => setIceAktar(null)} width={560} title={`Excel'den İçe Aktar${iceAktar ? ` — ${iceAktar.dosyaAdi}` : ''}`}
        footer={<>
          <button type="button" className="adm-btn-ghost" onClick={() => setIceAktar(null)}>{iceAktar?.asama === 'bitti' ? 'Kapat' : 'İptal'}</button>
          {iceAktar?.asama === 'onay' && <button type="button" className="adm-btn" disabled={iceAktarBusy} onClick={iceAktarOnayla}>{iceAktarBusy ? 'Kaydediliyor…' : 'Onayla ve Kaydet'}</button>}
        </>}>
        {iceAktar?.asama === 'onizle' && <p style={{ fontSize: 13, color: 'var(--adm-tx3)' }}>Dosya kontrol ediliyor…</p>}
        {iceAktar?.asama === 'hata' && (
          <div>
            <p style={{ fontSize: 12.5, color: 'var(--adm-red)', display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10 }}><XCircle size={16} />Dosyada {iceAktar.hatalar?.length} satırda hata var — hiçbir kayıt eklenmedi/güncellenmedi. Düzeltip yeniden yükle.</p>
            <div style={{ maxHeight: 320, overflow: 'auto', border: '1px solid var(--adm-bdr)', borderRadius: 8 }}>
              {iceAktar.hatalar?.map((h, i) => (
                <div key={i} style={{ padding: '8px 12px', fontSize: 12.5, borderBottom: i < (iceAktar.hatalar?.length || 0) - 1 ? '1px solid var(--adm-bdr)' : 'none' }}>
                  {h.satir > 0 && <b style={{ marginRight: 6 }}>Satır {h.satir}:</b>}{h.mesaj}
                </div>
              ))}
            </div>
          </div>
        )}
        {iceAktar?.asama === 'onay' && iceAktar.onizle && (
          <div>
            <p style={{ fontSize: 12.5, color: 'var(--adm-green)', display: 'flex', gap: 8, alignItems: 'center', marginBottom: 14 }}><CheckCircle2 size={16} />Dosya geçerli — kaydetmek için onayla.</p>
            <div style={{ display: 'flex', gap: 12 }}>
              <div className="adm-card" style={{ flex: 1, padding: 14, textAlign: 'center' }}><div style={{ fontSize: 22, fontWeight: 700 }}>{iceAktar.onizle.toplam}</div><div style={{ fontSize: 11.5, color: 'var(--adm-tx3)' }}>Toplam satır</div></div>
              <div className="adm-card" style={{ flex: 1, padding: 14, textAlign: 'center' }}><div style={{ fontSize: 22, fontWeight: 700, color: 'var(--adm-green)' }}>{iceAktar.onizle.yeni}</div><div style={{ fontSize: 11.5, color: 'var(--adm-tx3)' }}>Yeni eklenecek</div></div>
              <div className="adm-card" style={{ flex: 1, padding: 14, textAlign: 'center' }}><div style={{ fontSize: 22, fontWeight: 700, color: 'var(--adm-blue)' }}>{iceAktar.onizle.guncelleme}</div><div style={{ fontSize: 11.5, color: 'var(--adm-tx3)' }}>Güncellenecek (kod eşleşmesi)</div></div>
            </div>
          </div>
        )}
        {iceAktar?.asama === 'bitti' && iceAktar.sonuc && (
          <p style={{ fontSize: 13, color: 'var(--adm-green)', display: 'flex', gap: 8, alignItems: 'center' }}><CheckCircle2 size={16} />{iceAktar.sonuc.eklenen} yeni cari eklendi, {iceAktar.sonuc.guncellenen} cari güncellendi.</p>
        )}
      </Modal>
      <TopluDuzenle rows={toplu} onClose={() => setToplu(null)} onDone={() => { setToplu(null); load() }} client={muh as any} table="cari_hesaplar" fields={[
        { key: 'tip', label: 'Tür', type: 'select', options: Object.entries(TIP).map(([v, t]) => ({ v, l: t.l })) },
        { key: 'fiyat_listesi_id', label: 'Fiyat listesi', type: 'select', bosYapilabilir: true, hint: 'Boş yap = Varsayılan', options: fiyatListeleri.map((f: any) => ({ v: f.id, l: f.ad })) },
        { key: 'notlar', label: 'Notlar', type: 'text', bosYapilabilir: true, hint: 'Mevcut notların yerine yazılır' },
      ]} />
      {toast.node}
    </div>
  )
}
