'use client'
import { useAcParam } from '@/lib/ac-param'
import { useEffect, useMemo, useState } from 'react'
import AdminTopBar from '@/components/admin/TopBar'
import { erp } from '@/lib/erp-client'
import { fmt, fmtK, fmtN, fmtDate, fmtDateTime, todayISO } from '@/lib/fmt'
import { useUretim, byId, gunlukTuketim, rezerveMap, HAREKET_TIP } from '@/lib/uretim-utils'
import { sum } from '@/lib/muh-utils'
import { Page, PageHead, Kpi, KpiGrid, Badge, Tabs, Money, Drawer, Modal, Field, FormGrid, InfoRow, Divider, Empty, useToast } from '@/components/admin/erp/ui'
import { DataGrid, type Col } from '@/components/admin/erp/DataGrid'
import { topluSilCalistir } from '@/lib/toplu-sil'
import TopluDuzenle from '@/components/admin/TopluDuzenle'
import { ListChecks, Plus, Pencil, Trash2, Boxes, AlertTriangle, Coins, Timer, ArrowDownCircle, ArrowUpCircle, ClipboardCheck, ShoppingCart, Power, Package, Layers } from 'lucide-react'

const BIRIMLER = ['kg', 'gr', 'lt', 'adet', 'metre', 'koli', 'palet', 'torba']
const bos = { kod: '', ad: '', aciklama: '', birim: 'kg', acilis: '', min_stok: '0', max_stok: '', ortalama_maliyet: '', tedarikci_id: '', depo_id: '', barkod: '', mekan: 'ortak', kullanim: 'kullanimda' }
const durumu = (h: any) => { const s = +h.mevcut_stok || 0, mn = +h.min_stok || 0; return s <= 0 ? 'tukendi' : s <= mn ? 'kritik' : h.max_stok && s > +h.max_stok ? 'fazla' : 'normal' }
const DURUM: Record<string, { l: string; tone: any }> = { tukendi: { l: 'Tükendi', tone: 'red' }, kritik: { l: 'Kritik', tone: 'red' }, fazla: { l: 'Fazla', tone: 'amber' }, normal: { l: 'Normal', tone: 'green' } }

export default function HammaddePage() {
  const toast = useToast()
  const { d, loading, reload } = useUretim(['hammaddeler', 'depolar', 'cariTam', 'lotlar', 'tuketimRows', 'receteKalemleri', 'receteler', 'products', 'variants', 'rezerveRows', 'emirler'])
  const [tab, setTab] = useState('hepsi')
  const [mekan, setMekan] = useState('')
  const [detay, setDetay] = useState<any>(null)
  const [dTab, setDTab] = useState('ozet')
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [form, setForm] = useState<any>(bos)
  const [islem, setIslem] = useState<any>(null)
  const [lot, setLot] = useState({ lot_no: '', miktar: '', giris_tarihi: todayISO(), tedarikci_id: '' })
  const [busy, setBusy] = useState(false)
  const [toplu, setToplu] = useState<any[] | null>(null)
  const [hmHareket, setHmHareket] = useState<any[]>([])

  const cari = useMemo(() => byId(d.cariTam), [d.cariTam])
  const depo = useMemo(() => byId(d.depolar), [d.depolar])
  const urun = useMemo(() => byId(d.products), [d.products])
  const detayH = detay ? d.hammaddeler.find((h: any) => h.id === detay.id) || detay : null
  // Seçili hammaddenin son hareketleri (sunucudan, yalnızca 60 satır)
  useEffect(() => {
    if (!detay?.id) { setHmHareket([]); return }
    erp.from('v_stok_defteri').select('*').eq('hammadde_id', detay.id).order('tarih', { ascending: false }).limit(60).then((r: any) => setHmHareket(r.data || [])).catch(() => setHmHareket([]))
  }, [detay?.id, d.hammaddeler])

  const tuk = useMemo(() => Object.fromEntries(d.hammaddeler.map((h: any) => [h.id, gunlukTuketim(h.id, d.tuketimRows)])), [d.hammaddeler, d.tuketimRows])
  const kullanilmayan = d.hammaddeler.filter((h: any) => h.aktif !== false && h.kullanim === 'kullanilmiyor')
  const aktifler = d.hammaddeler.filter((h: any) => h.aktif !== false && h.kullanim !== 'kullanilmiyor')
  const kritik = aktifler.filter((h: any) => ['kritik', 'tukendi'].includes(durumu(h)))
  const deger = sum(aktifler, (h: any) => (+h.mevcut_stok || 0) * (+h.ortalama_maliyet || 0))
  const tuketim30 = sum(d.tuketimRows, (t: any) => (+t.toplam_30g || 0) * (+d.hammaddeler.find((h: any) => h.id === t.hammadde_id)?.ortalama_maliyet || 0))
  const liste = d.hammaddeler.filter((h: any) => (tab === 'hepsi' ? h.aktif !== false && h.kullanim !== 'kullanilmiyor' : tab === 'kullanilmayan' ? h.aktif !== false && h.kullanim === 'kullanilmiyor' : tab === 'kritik' ? h.aktif !== false && h.kullanim !== 'kullanilmiyor' && ['kritik', 'tukendi'].includes(durumu(h)) : tab === 'fazla' ? durumu(h) === 'fazla' : tab === 'pasif' ? h.aktif === false : true) && (!mekan || (h.mekan || 'ortak') === mekan || (mekan !== 'ortak' && (h.mekan || 'ortak') === 'ortak')))

  // Mamul stok (ürün varyantları)
  const rez = useMemo(() => rezerveMap(d.rezerveRows), [d.rezerveRows])
  const mamul = useMemo(() => d.variants.map((v: any) => {
    const ad = [urun[v.product_id]?.name, v.name, v.color, v.size].filter(Boolean).filter((a: any, i: number, arr: any[]) => arr.indexOf(a) === i).join(' · ')
    const uretimde = sum(d.emirler.filter((e: any) => ['planlandi', 'uretimde', 'durduruldu'].includes(e.durum) && e.urun_id === v.product_id), (e: any) => Math.max((+e.planlanan_miktar || 0) - (+e.uretilen_miktar || 0), 0))
    const stok = +v.stock || 0, r = rez[v.id] || 0
    return { ...v, ad, rezerve: r, serbest: stok - r, uretimde, mekan: urun[v.product_id]?.mekan || 'ic' }
  }), [d, rez, urun])

  /* ── Form / işlemler ── */
  const openNew = () => { setEditing(null); setForm(bos); setModal(true) }
  const openEdit = (h: any) => { setEditing(h); setForm({ kod: h.kod, ad: h.ad, aciklama: h.aciklama || '', birim: h.birim || 'kg', acilis: '', min_stok: String(h.min_stok ?? 0), max_stok: h.max_stok ? String(h.max_stok) : '', ortalama_maliyet: String(h.ortalama_maliyet ?? ''), tedarikci_id: h.tedarikci_id || '', depo_id: h.depo_id || '', barkod: h.barkod || '', mekan: h.mekan || 'ortak', kullanim: h.kullanim || 'kullanimda' }); setModal(true) }

  async function hareket(h: any, yon: 'giris' | 'cikis', miktar: number, tip: string, aciklama: string, opts: { maliyet?: number; depo?: string } = {}) {
    const r: any = await erp.from('stok_hareketleri').insert({ tip, yon, hammadde_id: h.id, miktar, birim_maliyet: opts.maliyet || null, depo_id: opts.depo || h.depo_id || null, kaynak_tablo: 'manuel', aciklama })
    if (r?.error) throw new Error(r.error)
    // Ağırlıklı ortalama maliyet (girişte fiyat biliniyorsa)
    if (yon === 'giris' && opts.maliyet && opts.maliyet > 0) {
      const eski = Math.max(+h.mevcut_stok || 0, 0), yeni = (eski * (+h.ortalama_maliyet || 0) + miktar * opts.maliyet) / (eski + miktar)
      await erp.from('hammaddeler').update({ ortalama_maliyet: +yeni.toFixed(4) }).eq('id', h.id)
    }
  }

  async function save(e: React.FormEvent) {
    e.preventDefault(); if (busy) return
    if (d.hammaddeler.some((h: any) => h.kod.toLowerCase() === form.kod.trim().toLowerCase() && h.id !== editing?.id)) return toast.show('Bu hammadde kodu zaten var', true)
    setBusy(true)
    try {
      const payload: any = { kod: form.kod.trim(), ad: form.ad.trim(), aciklama: form.aciklama || null, birim: form.birim, min_stok: +form.min_stok || 0, max_stok: form.max_stok ? +form.max_stok : null, ortalama_maliyet: +form.ortalama_maliyet || 0, tedarikci_id: form.tedarikci_id || null, depo_id: form.depo_id || null, barkod: form.barkod || null, mekan: form.mekan || 'ortak', kullanim: form.kullanim === 'kullanilmiyor' ? 'kullanilmiyor' : 'kullanimda' }
      if (editing) { const r: any = await erp.from('hammaddeler').update(payload).eq('id', editing.id); if (r?.error) throw new Error(r.error) }
      else {
        const r: any = await erp.from('hammaddeler').insert({ ...payload, mevcut_stok: 0, aktif: true }); if (r?.error) throw new Error(r.error)
        const ac = +form.acilis
        if (ac > 0 && r.data?.[0]) await hareket(r.data[0], 'giris', ac, 'manuel_duzeltme', 'Açılış stoğu')
      }
      setModal(false); toast.show(editing ? 'Hammadde güncellendi' : 'Hammadde eklendi'); await reload()
    } catch (err: any) { toast.show(err.message, true) }
    setBusy(false)
  }

  async function islemKaydet(e: React.FormEvent) {
    e.preventDefault(); if (busy || !islem) return
    const h = islem.h, m = +islem.miktar
    if (!(m >= 0) || (islem.tur !== 'sayim' && !(m > 0))) return toast.show('Miktar gerekli', true)
    setBusy(true)
    try {
      if (islem.tur === 'sayim') {
        const fark = +(m - (+h.mevcut_stok || 0)).toFixed(3)
        if (!fark) throw new Error('Sayım sistem stoğuyla aynı')
        await hareket(h, fark > 0 ? 'giris' : 'cikis', Math.abs(fark), 'sayim', islem.not || 'Sayım düzeltmesi', { depo: islem.depo })
      } else {
        if (islem.tur === 'cikis' && m > (+h.mevcut_stok || 0) && !confirm(`Stok (${fmtN(h.mevcut_stok, 2)} ${h.birim}) çıkış miktarından az; eksiye düşecek. Devam?`)) { setBusy(false); return }
        await hareket(h, islem.tur, m, islem.tur === 'giris' ? 'manuel_duzeltme' : 'manuel_duzeltme', islem.not || (islem.tur === 'giris' ? 'Manuel giriş' : 'Manuel çıkış'), { maliyet: +islem.maliyet || undefined, depo: islem.depo })
      }
      toast.show('Stok hareketi kaydedildi'); setIslem(null); await reload()
    } catch (err: any) { toast.show(err.message, true) }
    setBusy(false)
  }

  const oneri = (h: any) => { const mn = +h.min_stok || 0, mx = +h.max_stok || mn * 3; return Math.max(Math.ceil(mx - (+h.mevcut_stok || 0)), 0) }
  async function satinalmaAc(secili: any[]) {
    setBusy(true)
    try {
      const gruplar: Record<string, any[]> = {}
      secili.forEach(h => { (gruplar[h.tedarikci_id || 'genel'] ||= []).push(h) })
      let n = 0
      for (const [tid, hl] of Object.entries(gruplar)) {
        const r: any = await erp.from('satinalma_siparisleri').insert({ no: `SA-${new Date().getFullYear()}-${Date.now().toString().slice(-5)}${n}`, tedarikci_id: tid === 'genel' ? null : tid, tarih: todayISO(), durum: 'beklemede', notlar: 'Kritik stok listesinden oluşturuldu' })
        if (r?.error) throw new Error(r.error)
        const k: any = await erp.from('satinalma_siparisi_kalemleri').insert(hl.map(h => ({ siparis_id: r.data[0].id, hammadde_id: h.id, miktar: oneri(h) || Math.max(+h.min_stok || 1, 1), birim_fiyat: +h.ortalama_maliyet || 0 })))
        if (k?.error) throw new Error(k.error); n++
      }
      toast.show(`${n} satınalma siparişi oluşturuldu (Beklemede)`)
    } catch (err: any) { toast.show(err.message, true) }
    setBusy(false)
  }

  async function aktifToggle(h: any) { await erp.from('hammaddeler').update({ aktif: h.aktif === false }).eq('id', h.id); toast.show(h.aktif === false ? 'Aktif yapıldı' : 'Pasife alındı'); reload() }
  async function topluSil(sel: any[]): Promise<string | void> {
    const { silinen, hata } = await topluSilCalistir(sel, async (r: any) => (d.receteKalemleri.some((k: any) => k.hammadde_id === r.id) ? `${r.ad}: reçetede kullanılıyor, silinemez` : (await erp.from('hammaddeler').delete().eq('id', r.id))?.error), 'hammadde')
    await reload(); setDetay(null)
    if (hata) return hata
    toast.show(`${silinen} hammadde silindi`)
  }
  async function del(h: any) {
    const cn: any = await erp.from('stok_hareketleri').select('id', { count: 'exact', head: true }).eq('hammadde_id', h.id)
    const n = cn?.count || 0
    const rc = d.receteKalemleri.filter((k: any) => k.hammadde_id === h.id).length
    if (rc) return toast.show(`Bu hammadde ${rc} reçetede kullanılıyor — silinemez, pasife alabilirsin`, true)
    if (!confirm(`${h.ad} silinsin mi?${n ? `\n\n${n} stok hareketi kaydı var; geçmiş kayıtlar kalemsiz kalır. Pasife almak daha güvenli.` : ''}`)) return
    const r: any = await erp.from('hammaddeler').delete().eq('id', h.id)
    if (r?.error) return toast.show(r.error, true)
    toast.show('Hammadde silindi'); setDetay(null); reload()
  }
  async function lotEkle(e: React.FormEvent) {
    e.preventDefault(); if (!detayH) return
    const r: any = await erp.from('hammadde_lotlari').insert({ ...lot, miktar: +lot.miktar, hammadde_id: detayH.id, tedarikci_id: lot.tedarikci_id || null })
    if (r?.error) return toast.show(r.error, true)
    setLot({ lot_no: '', miktar: '', giris_tarihi: todayISO(), tedarikci_id: '' }); toast.show('Lot eklendi'); reload()
  }

  const cols: Col<any>[] = [
    { key: 'ad', label: 'Hammadde', sort: h => h.ad, render: h => <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}><div style={{ width: 32, height: 32, borderRadius: 9, background: 'var(--adm-ac2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Boxes size={15} style={{ color: 'var(--adm-ac)' }} /></div><div><div style={{ fontWeight: 600 }}>{h.ad}{h.aktif === false && <Badge tone="muted" style={{ marginLeft: 6 }}>Pasif</Badge>}{h.kullanim === 'kullanilmiyor' && <Badge tone="amber" style={{ marginLeft: 6 }}>Kullanılmıyor</Badge>}</div><div style={{ fontSize: 11, color: 'var(--adm-tx3)' }}>{h.kod}{h.barkod ? ` · ${h.barkod}` : ''}</div></div></div> },
    { key: 'mekan', label: 'Mekan', width: 100, sort: h => h.mekan || 'ortak', render: h => mekanBadge(h.mekan || 'ortak'), hideSm: true },
    { key: 'depo', label: 'Depo', sort: h => depo[h.depo_id]?.ad || '', render: h => depo[h.depo_id]?.ad || <span style={{ color: 'var(--adm-tx3)' }}>—</span>, hideSm: true },
    {
      key: 'stok', label: 'Stok', width: 190, sort: h => +h.mevcut_stok, render: h => {
        const s = +h.mevcut_stok || 0, mn = +h.min_stok || 0, mx = +h.max_stok || Math.max(mn * 3, s), p = Math.min((s / (mx || 1)) * 100, 100), dr = durumu(h)
        return <div><div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5 }}><b style={{ fontFamily: 'JetBrains Mono,monospace', color: dr === 'normal' ? undefined : dr === 'fazla' ? 'var(--adm-amber)' : 'var(--adm-red)' }}>{fmtN(s, 2)} {h.birim}</b><Badge tone={DURUM[dr].tone}>{DURUM[dr].l}</Badge></div>
          <div style={{ height: 5, borderRadius: 3, background: 'var(--adm-s2)', marginTop: 5, position: 'relative', overflow: 'hidden' }}><div style={{ width: `${Math.max(p, 0)}%`, height: '100%', background: dr === 'normal' ? 'var(--adm-green)' : dr === 'fazla' ? 'var(--adm-amber)' : 'var(--adm-red)' }} /></div>
          <div style={{ fontSize: 10.5, color: 'var(--adm-tx3)', marginTop: 2 }}>min {fmtN(mn, 0)}{h.max_stok ? ` · max ${fmtN(+h.max_stok, 0)}` : ''}</div></div>
      },
    },
    { key: 'kapsam', label: 'Kaç Günlük', align: 'right', sort: h => (tuk[h.id] > 0 ? (+h.mevcut_stok || 0) / tuk[h.id] : 99999), render: h => tuk[h.id] > 0 ? (() => { const g = (+h.mevcut_stok || 0) / tuk[h.id]; return <span style={{ fontWeight: 700, color: g < 7 ? 'var(--adm-red)' : g < 15 ? 'var(--adm-amber)' : undefined }}>{fmtN(g, 0)} gün</span> })() : <span style={{ color: 'var(--adm-tx3)' }}>—</span>, hideSm: true },
    { key: 'maliyet', label: 'Ort. Maliyet', align: 'right', sort: h => +h.ortalama_maliyet, render: h => +h.ortalama_maliyet ? <span>{fmt(h.ortalama_maliyet)}<span style={{ fontSize: 10.5, color: 'var(--adm-tx3)' }}>/{h.birim}</span></span> : <span style={{ color: 'var(--adm-amber)' }}>girilmedi</span>, hideSm: true },
    { key: 'deger', label: 'Stok Değeri', align: 'right', sort: h => (+h.mevcut_stok || 0) * (+h.ortalama_maliyet || 0), render: h => <Money v={(+h.mevcut_stok || 0) * (+h.ortalama_maliyet || 0)} bold={false} />, total: rs => <Money v={sum(rs, (h: any) => (+h.mevcut_stok || 0) * (+h.ortalama_maliyet || 0))} />, csv: h => (+h.mevcut_stok || 0) * (+h.ortalama_maliyet || 0) },
    { key: 'ted', label: 'Tedarikçi', sort: h => cari[h.tedarikci_id]?.ad || '', render: h => cari[h.tedarikci_id]?.ad || '—', hidden: true },
    { key: 'act', label: '', width: 118, align: 'right', render: h => (
      <span style={{ display: 'inline-flex', gap: 4 }} onClick={e => e.stopPropagation()}>
        <button className="adm-btn-ghost" style={{ padding: '4px 8px' }} title="Stok girişi" onClick={() => setIslem({ h, tur: 'giris', miktar: '', maliyet: '', not: '', depo: h.depo_id || '' })}><ArrowDownCircle size={13} style={{ color: 'var(--adm-green)' }} /></button>
        <button className="adm-btn-ghost" style={{ padding: '4px 8px' }} title="Sayım" onClick={() => setIslem({ h, tur: 'sayim', miktar: String(h.mevcut_stok), not: '', depo: h.depo_id || '' })}><ClipboardCheck size={13} /></button>
        <button className="adm-btn-ghost" style={{ padding: '4px 8px' }} onClick={() => openEdit(h)}><Pencil size={12} /></button>
      </span>) },
  ]
  const mekanBadge = (m: string) => m === 'dis' ? <Badge tone="green">Dış mekan</Badge> : m === 'ic' ? <Badge tone="blue">İç mekan</Badge> : <Badge tone="muted">Ortak</Badge>
  const mCols: Col<any>[] = [
    { key: 'ad', label: 'Ürün / Varyant', sort: v => v.ad, render: v => <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}><Package size={15} style={{ color: 'var(--adm-blue)' }} /><b>{v.ad}</b></div> },
    { key: 'mekan', label: 'Mekan', width: 100, sort: v => v.mekan, render: v => mekanBadge(v.mekan), hideSm: true },
    { key: 'stok', label: 'Fiziksel Stok', align: 'right', sort: v => +v.stock, render: v => <b style={{ fontFamily: 'JetBrains Mono,monospace', color: +v.stock <= 0 ? 'var(--adm-red)' : undefined }}>{fmtN(+v.stock, 0)}</b>, total: rs => fmtN(sum(rs, (v: any) => v.stock), 0) },
    { key: 'rez', label: 'Rezerve (siparişte)', align: 'right', sort: v => v.rezerve, render: v => v.rezerve ? <span style={{ color: 'var(--adm-amber)', fontWeight: 600 }}>{fmtN(v.rezerve, 0)}</span> : '—', total: rs => fmtN(sum(rs, (v: any) => v.rezerve), 0) },
    { key: 'serbest', label: 'Satılabilir', align: 'right', sort: v => v.serbest, render: v => <b style={{ fontFamily: 'JetBrains Mono,monospace', color: v.serbest < 0 ? 'var(--adm-red)' : 'var(--adm-green)' }}>{fmtN(v.serbest, 0)}</b> },
    { key: 'uretim', label: 'Üretimde Bekleyen', align: 'right', sort: v => v.uretimde, render: v => v.uretimde ? fmtN(v.uretimde, 0) : '—', hideSm: true },
    { key: 'durum', label: 'Durum', sort: v => v.serbest, render: v => v.serbest < 0 ? <Badge tone="red">Açık: {fmtN(-v.serbest, 0)} eksik</Badge> : +v.stock <= 0 ? <Badge tone="red">Tükendi</Badge> : <Badge tone="green">Yeterli</Badge> },
  ]

  useAcParam(!loading, id => { const h = d.hammaddeler.find((x: any) => x.id === id); if (h) openEdit(h) })

  return (
    <div style={{ flex: 1, overflow: 'auto' }}>
      <AdminTopBar title="Hammadde & Stok" />
      <Page>
        <PageHead title="Stok Yönetimi" sub="Hammadde stokları, kritik seviyeler, maliyet ve mamul stok durumu" actions={<button className="adm-btn" onClick={openNew}><Plus size={14} />Hammadde Ekle</button>} />
        <KpiGrid min={180}>
          <Kpi label="Hammadde" value={aktifler.length} Icon={Boxes} color="var(--adm-ac)" sub={`${d.hammaddeler.filter((h: any) => h.aktif === false).length} pasif · ${kullanilmayan.length} kullanılmayan`} />
          <Kpi label="Kritik / Tükenen" value={kritik.length} Icon={AlertTriangle} color={kritik.length ? 'var(--adm-red)' : 'var(--adm-green)'} sub={kritik.length ? kritik.slice(0, 2).map((h: any) => h.ad).join(', ') : 'Sorun yok'} onClick={() => setTab('kritik')} />
          <Kpi label="Stok Değeri" value={fmtK(deger)} Icon={Coins} color="var(--adm-blue)" sub="ağırlıklı ort. maliyetle" />
          <Kpi label="30 Gün Tüketim" value={fmtK(tuketim30)} Icon={Timer} color="var(--adm-amber)" sub="üretim + fire (₺)" />
          <Kpi label="Maliyeti Girilmemiş" value={aktifler.filter((h: any) => !+h.ortalama_maliyet).length} Icon={Coins} color="var(--adm-amber)" sub="reçete maliyeti eksik hesaplanır" />
        </KpiGrid>

        <div style={{ marginBottom: 12, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <Tabs value={tab} onChange={setTab} tabs={[{ v: 'hepsi', l: 'Aktif', n: aktifler.length }, { v: 'kritik', l: 'Kritik', n: kritik.length }, { v: 'fazla', l: 'Fazla stok', n: aktifler.filter((h: any) => durumu(h) === 'fazla').length }, { v: 'kullanilmayan', l: 'Kullanılmayan', n: kullanilmayan.length }, { v: 'pasif', l: 'Pasif', n: d.hammaddeler.filter((h: any) => h.aktif === false).length }, { v: 'mamul', l: 'Mamul Stok', n: d.variants.length }]} />
          <select className="adm-sel" value={mekan} onChange={e => setMekan(e.target.value)}><option value="">İç + Dış mekan</option><option value="ic">İç mekan (+ ortak)</option><option value="dis">Dış mekan (+ ortak)</option><option value="ortak">Sadece ortak</option></select>
        </div>

        {tab === 'mamul'
          ? <DataGrid rows={mamul.filter((v: any) => !mekan || v.mekan === mekan)} cols={mCols} rowKey={v => v.id} loading={loading} csvName="mamul-stok" storageKey="mamul" searchText={v => v.ad} searchPlaceholder="Ürün ara..." emptyTitle="Ürün varyantı yok" emptySub="Ürünler → Varyantlar'dan stok varyantı ekle"
            footerNote={<span>· Satılabilir = fiziksel stok − açık siparişlerde sevk edilmemiş miktar</span>} />
          : <DataGrid rows={liste} cols={cols} rowKey={h => h.id} loading={loading} onBulkDelete={topluSil} deleteNoun="hammadde" deleteNote="Reçetede kullanılan hammaddeler atlanır. Stok hareketi geçmişi olan hammaddelerin geçmiş kayıtları kalemsiz kalır; pasife almak daha güvenlidir." csvName="hammaddeler" storageKey="hammadde" onRowClick={h => { setDetay(h); setDTab('ozet') }} activeKey={detay?.id}
            searchText={h => `${h.ad} ${h.kod} ${h.barkod || ''} ${cari[h.tedarikci_id]?.ad || ''}`} searchPlaceholder="Ad, kod, barkod, tedarikçi..." selectable
            bulkActions={(sel, clear) => <><button className="adm-btn" style={{ padding: '3px 12px', fontSize: 12 }} disabled={busy} onClick={async () => { await satinalmaAc(sel); clear() }}><ShoppingCart size={12} />Seçilenler için satınalma siparişi</button><button className="adm-btn-ghost" style={{ padding: '3px 12px', fontSize: 12 }} onClick={() => setToplu(sel)}><ListChecks size={12} />Toplu düzenle</button></>}
            actions={kritik.length > 0 ? <button className="adm-btn-ghost" style={{ fontSize: 12, color: 'var(--adm-red)' }} disabled={busy} onClick={() => satinalmaAc(kritik)}><ShoppingCart size={13} />Kritikler için sipariş aç</button> : undefined}
            emptyTitle="Hammadde bulunamadı" emptySub="Hammadde Ekle ile stok kartı aç; açılış stoğu defterde hareket olarak görünür." />}
      </Page>

      <Drawer open={!!detayH} onClose={() => setDetay(null)} width={580}
        title={detayH && <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>{detayH.ad}<Badge tone={DURUM[durumu(detayH)].tone}>{DURUM[durumu(detayH)].l}</Badge></span>}
        sub={detayH && `${detayH.kod} · ${depo[detayH.depo_id]?.ad || 'Depo yok'}`}
        footer={detayH && <><button className="adm-btn-danger" onClick={() => del(detayH)}><Trash2 size={13} /></button><button className="adm-btn-ghost" onClick={() => aktifToggle(detayH)}><Power size={13} />{detayH.aktif === false ? 'Aktifleştir' : 'Pasife al'}</button><button className="adm-btn-ghost" onClick={() => openEdit(detayH)}><Pencil size={13} />Düzenle</button>
          <button className="adm-btn" onClick={() => setIslem({ h: detayH, tur: 'giris', miktar: '', maliyet: '', not: '', depo: detayH.depo_id || '' })}><ArrowDownCircle size={14} />Stok Hareketi</button></>}>
        {detayH && (() => {
          const hm = hmHareket
          let b = +detayH.mevcut_stok || 0
          const hr = hm.map((m: any) => { const s = (m.yon === 'giris' ? 1 : -1) * +m.miktar; const after = b; b -= s; return { ...m, s, after } })
          const lots = d.lotlar.filter((l: any) => l.hammadde_id === detayH.id)
          const rec = Array.from(new Set(d.receteKalemleri.filter((k: any) => k.hammadde_id === detayH.id).map((k: any) => d.receteler.find((r: any) => r.id === k.recete_id)).filter(Boolean))) as any[]
          const t = tuk[detayH.id], kapsam = t > 0 ? (+detayH.mevcut_stok || 0) / t : null
          return (
            <div>
              <div style={{ padding: '18px 20px 0' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 14 }}>
                  <div style={{ padding: 12, borderRadius: 10, background: 'var(--adm-s2)' }}><div className="adm-kpi-label" style={{ marginBottom: 4 }}>Stok</div><b style={{ fontSize: 17, fontFamily: 'JetBrains Mono,monospace' }}>{fmtN(detayH.mevcut_stok, 2)}</b> <span style={{ fontSize: 11, color: 'var(--adm-tx3)' }}>{detayH.birim}</span></div>
                  <div style={{ padding: 12, borderRadius: 10, background: 'var(--adm-s2)' }}><div className="adm-kpi-label" style={{ marginBottom: 4 }}>Değer</div><Money v={(+detayH.mevcut_stok || 0) * (+detayH.ortalama_maliyet || 0)} size={15} /></div>
                  <div style={{ padding: 12, borderRadius: 10, background: kapsam != null && kapsam < 7 ? 'var(--adm-red2)' : 'var(--adm-s2)' }}><div className="adm-kpi-label" style={{ marginBottom: 4 }}>Yeter</div><b style={{ fontSize: 17, fontFamily: 'JetBrains Mono,monospace' }}>{kapsam != null ? `${fmtN(kapsam, 0)} gün` : '—'}</b></div>
                </div>
                <Tabs value={dTab} onChange={setDTab} tabs={[{ v: 'ozet', l: 'Özet' }, { v: 'hareket', l: 'Hareketler', n: hm.length }, { v: 'lot', l: 'Lotlar', n: lots.length }, { v: 'recete', l: 'Reçeteler', n: rec.length }]} />
              </div>
              {dTab === 'ozet' && <div style={{ padding: 20 }}>
                <InfoRow k="Birim" v={detayH.birim} /><InfoRow k="Min / Max stok" v={`${fmtN(detayH.min_stok, 0)} / ${detayH.max_stok ? fmtN(detayH.max_stok, 0) : '—'}`} />
                <InfoRow k="Ort. maliyet" v={+detayH.ortalama_maliyet ? `${fmt(detayH.ortalama_maliyet)} / ${detayH.birim}` : 'Girilmedi'} />
                <InfoRow k="Günlük tüketim (30g)" v={t ? `${fmtN(t, 2)} ${detayH.birim}` : '—'} /><InfoRow k="Tedarikçi" v={cari[detayH.tedarikci_id]?.ad || '—'} /><InfoRow k="Barkod" v={detayH.barkod || '—'} />
                {['kritik', 'tukendi'].includes(durumu(detayH)) && <div style={{ marginTop: 14 }}><button className="adm-btn" disabled={busy} onClick={() => satinalmaAc([detayH])}><ShoppingCart size={14} />Satınalma siparişi aç ({fmtN(oneri(detayH) || detayH.min_stok, 0)} {detayH.birim})</button></div>}
                {detayH.aciklama && <><Divider label="Açıklama" /><p style={{ fontSize: 12.5, color: 'var(--adm-tx2)', margin: 0 }}>{detayH.aciklama}</p></>}
              </div>}
              {dTab === 'hareket' && (hr.length === 0 ? <Empty title="Hareket yok" /> : <div style={{ overflow: 'auto' }}><table className="adm-tbl compact"><thead><tr><th>Tarih</th><th>Tip</th><th style={{ textAlign: 'right' }}>Miktar</th><th style={{ textAlign: 'right' }}>Bakiye</th></tr></thead>
                <tbody>{hr.slice(0, 60).map((m: any) => <tr key={m.id}><td style={{ whiteSpace: 'nowrap' }}>{fmtDateTime(m.tarih)}</td><td>{HAREKET_TIP[m.tip]}<div style={{ fontSize: 10.5, color: 'var(--adm-tx3)' }}>{m.aciklama}</div></td><td style={{ textAlign: 'right', fontWeight: 700, color: m.s > 0 ? 'var(--adm-green)' : 'var(--adm-red)', fontFamily: 'JetBrains Mono,monospace' }}>{m.s > 0 ? '+' : ''}{fmtN(m.s, 2)}</td><td style={{ textAlign: 'right', fontFamily: 'JetBrains Mono,monospace' }}>{fmtN(m.after, 2)}</td></tr>)}</tbody></table></div>)}
              {dTab === 'lot' && <div>
                {lots.length === 0 ? <Empty title="Lot kaydı yok" /> : lots.map((l: any) => <div key={l.id} className="adm-row"><div style={{ flex: 1 }}><div style={{ fontWeight: 600, fontSize: 13 }}>{l.lot_no || 'Lot no yok'}</div><div style={{ fontSize: 11.5, color: 'var(--adm-tx3)' }}>{fmtDate(l.giris_tarihi)} · {cari[l.tedarikci_id]?.ad || '—'}</div></div><b style={{ fontFamily: 'JetBrains Mono,monospace' }}>{fmtN(l.miktar, 2)} {detayH.birim}</b>
                  <button className="adm-btn-danger" style={{ padding: '3px 8px' }} onClick={async () => { if (confirm('Lot silinsin mi?')) { await erp.from('hammadde_lotlari').delete().eq('id', l.id); reload() } }}><Trash2 size={11} /></button></div>)}
                <form onSubmit={lotEkle} style={{ padding: 16, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end', borderTop: '1px solid var(--adm-bdr)' }}>
                  <div style={{ flex: 1, minWidth: 110 }}><Field label="Lot no"><input className="adm-inp" value={lot.lot_no} onChange={e => setLot(l => ({ ...l, lot_no: e.target.value }))} /></Field></div>
                  <div style={{ width: 100 }}><Field label="Miktar"><input type="number" step="0.01" required className="adm-inp" value={lot.miktar} onChange={e => setLot(l => ({ ...l, miktar: e.target.value }))} /></Field></div>
                  <div style={{ width: 140 }}><Field label="Giriş tarihi"><input type="date" className="adm-inp" value={lot.giris_tarihi} onChange={e => setLot(l => ({ ...l, giris_tarihi: e.target.value }))} /></Field></div>
                  <button className="adm-btn" type="submit"><Plus size={13} />Lot</button>
                </form>
                <p style={{ fontSize: 11, color: 'var(--adm-tx3)', padding: '0 16px 14px', margin: 0 }}>Lot kaydı izlenebilirlik içindir; stok bakiyesini değiştirmez. Satınalma teslim alırken lot otomatik yazılır.</p>
              </div>}
              {dTab === 'recete' && (rec.length === 0 ? <Empty icon={<Layers size={28} />} title="Hiçbir reçetede kullanılmıyor" /> : rec.map((r: any) => <div key={r.id} className="adm-row"><div style={{ flex: 1 }}><b style={{ fontSize: 13 }}>{urun[r.urun_id]?.name}</b> <span style={{ color: 'var(--adm-tx3)' }}>v{r.versiyon}</span></div><Badge tone={r.aktif ? 'green' : 'muted'}>{r.aktif ? 'Aktif' : 'Pasif'}</Badge></div>))}
            </div>
          )
        })()}
      </Drawer>

      <Modal open={modal} onClose={() => setModal(false)} onSubmit={save} width={620} title={editing ? 'Hammaddeyi Düzenle' : 'Yeni Hammadde'}
        footer={<><button type="button" className="adm-btn-ghost" onClick={() => setModal(false)}>İptal</button><button type="submit" className="adm-btn" disabled={busy}>Kaydet</button></>}>
        <FormGrid>
          <Field label="Kod *"><input className="adm-inp" required autoFocus value={form.kod} onChange={e => setForm((f: any) => ({ ...f, kod: e.target.value }))} placeholder="HM-PP-01" /></Field>
          <Field label="Ad *"><input className="adm-inp" required value={form.ad} onChange={e => setForm((f: any) => ({ ...f, ad: e.target.value }))} placeholder="Polipropilen granül" /></Field>
          <Field label="Kullanım yeri"><select className="adm-inp" value={form.mekan} onChange={e => setForm((f: any) => ({ ...f, mekan: e.target.value }))}><option value="ortak">Ortak (iç + dış mekan)</option><option value="ic">İç mekan ürünleri</option><option value="dis">Dış mekan ürünleri</option></select></Field>
          <Field label="Birim"><select className="adm-inp" value={form.birim} onChange={e => setForm((f: any) => ({ ...f, birim: e.target.value }))}>{BIRIMLER.map(b => <option key={b}>{b}</option>)}</select></Field>
          {!editing && <Field label={`Açılış stoğu (${form.birim})`} hint="Defterde ‘Açılış stoğu’ hareketi olarak yazılır"><input type="number" step="0.001" min="0" className="adm-inp" value={form.acilis} onChange={e => setForm((f: any) => ({ ...f, acilis: e.target.value }))} /></Field>}
          <Field label="Min stok"><input type="number" step="0.01" min="0" className="adm-inp" value={form.min_stok} onChange={e => setForm((f: any) => ({ ...f, min_stok: e.target.value }))} /></Field>
          <Field label="Max stok"><input type="number" step="0.01" min="0" className="adm-inp" value={form.max_stok} onChange={e => setForm((f: any) => ({ ...f, max_stok: e.target.value }))} /></Field>
          <Field label={`Ort. maliyet (₺/${form.birim})`}><input type="number" step="0.0001" min="0" className="adm-inp" value={form.ortalama_maliyet} onChange={e => setForm((f: any) => ({ ...f, ortalama_maliyet: e.target.value }))} /></Field>
          <Field label="Üretimde kullanım"><select className="adm-inp" value={form.kullanim} onChange={e => setForm((f: any) => ({ ...f, kullanim: e.target.value }))}><option value="kullanimda">Kullanımda</option><option value="kullanilmiyor">Kullanılmıyor (eski kalan)</option></select></Field>
          <Field label="Barkod"><input className="adm-inp" value={form.barkod} onChange={e => setForm((f: any) => ({ ...f, barkod: e.target.value }))} /></Field>
          <Field label="Depo"><select className="adm-inp" value={form.depo_id} onChange={e => setForm((f: any) => ({ ...f, depo_id: e.target.value }))}><option value="">—</option>{d.depolar.filter((x: any) => x.aktif !== false).map((x: any) => <option key={x.id} value={x.id}>{x.ad}</option>)}</select></Field>
          <Field label="Tedarikçi"><select className="adm-inp" value={form.tedarikci_id} onChange={e => setForm((f: any) => ({ ...f, tedarikci_id: e.target.value }))}><option value="">—</option>{d.cariTam.filter((c: any) => c.tip !== 'musteri').map((c: any) => <option key={c.id} value={c.id}>{c.ad}</option>)}</select></Field>
          <Field label="Açıklama" span={2}><input className="adm-inp" value={form.aciklama} onChange={e => setForm((f: any) => ({ ...f, aciklama: e.target.value }))} /></Field>
        </FormGrid>
        {editing && <p style={{ fontSize: 11.5, color: 'var(--adm-tx3)', margin: '10px 0 0' }}>Stok miktarı buradan değiştirilmez; Stok Girişi / Sayım işlemiyle defter üzerinden düzelt.</p>}
      </Modal>

      <Modal open={!!islem} onClose={() => setIslem(null)} onSubmit={islemKaydet} width={480} title={islem && `${islem.h.ad} — Stok Hareketi`}
        footer={<><button type="button" className="adm-btn-ghost" onClick={() => setIslem(null)}>İptal</button><button type="submit" className="adm-btn" disabled={busy}>Kaydet</button></>}>
        {islem && <>
          <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>{[['giris', 'Giriş', ArrowDownCircle], ['cikis', 'Çıkış', ArrowUpCircle], ['sayim', 'Sayım', ClipboardCheck]].map(([k, l, I]: any) => <button type="button" key={k} onClick={() => setIslem((x: any) => ({ ...x, tur: k, miktar: k === 'sayim' ? String(x.h.mevcut_stok) : '' }))} className={islem.tur === k ? 'adm-btn' : 'adm-btn-ghost'} style={{ flex: 1, justifyContent: 'center', background: islem.tur === k ? (k === 'giris' ? 'var(--adm-green)' : k === 'cikis' ? 'var(--adm-red)' : 'var(--adm-blue)') : undefined }}><I size={14} />{l}</button>)}</div>
          <FormGrid>
            <Field label={islem.tur === 'sayim' ? `Sayılan miktar (${islem.h.birim})` : `Miktar (${islem.h.birim})`} hint={islem.tur === 'sayim' ? `Sistem: ${fmtN(islem.h.mevcut_stok, 2)} → fark ${fmtN((+islem.miktar || 0) - (+islem.h.mevcut_stok || 0), 2)}` : `Sonra: ${fmtN((+islem.h.mevcut_stok || 0) + (islem.tur === 'giris' ? 1 : -1) * (+islem.miktar || 0), 2)}`}><input type="number" step="0.001" min="0" required autoFocus className="adm-inp" value={islem.miktar} onChange={e => setIslem((x: any) => ({ ...x, miktar: e.target.value }))} style={{ fontSize: 16, fontWeight: 700 }} /></Field>
            {islem.tur === 'giris' ? <Field label={`Birim fiyat (₺/${islem.h.birim})`} hint="Girilirse ağırlıklı ort. maliyet güncellenir"><input type="number" step="0.0001" min="0" className="adm-inp" value={islem.maliyet} onChange={e => setIslem((x: any) => ({ ...x, maliyet: e.target.value }))} /></Field> : <div />}
            <Field label="Depo"><select className="adm-inp" value={islem.depo} onChange={e => setIslem((x: any) => ({ ...x, depo: e.target.value }))}><option value="">—</option>{d.depolar.map((x: any) => <option key={x.id} value={x.id}>{x.ad}</option>)}</select></Field>
            <Field label="Açıklama"><input className="adm-inp" value={islem.not} onChange={e => setIslem((x: any) => ({ ...x, not: e.target.value }))} /></Field>
          </FormGrid></>}
      </Modal>
      <TopluDuzenle rows={toplu} onClose={() => setToplu(null)} onDone={() => { setToplu(null); reload() }} client={erp} table="hammaddeler" fields={[
        { key: 'depo_id', label: 'Depo', type: 'select', bosYapilabilir: true, options: d.depolar.filter((x: any) => x.aktif !== false).map((x: any) => ({ v: x.id, l: x.ad })) },
        { key: 'tedarikci_id', label: 'Tedarikçi', type: 'select', bosYapilabilir: true, options: d.cariTam.filter((c: any) => c.tip !== 'musteri').map((c: any) => ({ v: c.id, l: c.ad })) },
        { key: 'mekan', label: 'Kullanım yeri', type: 'select', options: [{ v: 'ic', l: 'İç mekan' }, { v: 'dis', l: 'Dış mekan' }, { v: 'ortak', l: 'Ortak' }] },
        { key: 'birim', label: 'Birim', type: 'select', options: BIRIMLER.map(b => ({ v: b, l: b })) },
        { key: 'min_stok', label: 'Min stok', type: 'number' },
        { key: 'max_stok', label: 'Max stok', type: 'number' },
        { key: 'ortalama_maliyet', label: 'Ort. maliyet', type: 'number' },
        { key: 'aktif', label: 'Durum (aktif/pasif)', type: 'bool' },
      ]} />
      {toast.node}
    </div>
  )
}
