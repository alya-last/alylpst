'use client'
import { useEffect, useMemo, useState } from 'react'
import AdminTopBar from '@/components/admin/TopBar'
import { useAcParam } from '@/lib/ac-param'
import { erp } from '@/lib/erp-client'
import { fmtN, fmtInt, fmtDate, todayISO } from '@/lib/fmt'
import { useUretim, byId, sevkEdilen, SIPARIS_ACIK } from '@/lib/uretim-utils'
import { sum } from '@/lib/muh-utils'
import { Page, PageHead, Kpi, KpiGrid, Badge, Tabs, Drawer, Modal, Field, FormGrid, InfoRow, Divider, useToast } from '@/components/admin/erp/ui'
import { DataGrid, type Col } from '@/components/admin/erp/DataGrid'
import { topluSilCalistir } from '@/lib/toplu-sil'
import { Plus, Truck, Globe, PackageCheck, Boxes, Weight, Printer, Ban, Send, CheckCircle2, Trash2 } from 'lucide-react'

const DURUM: Record<string, { l: string; tone: any }> = { hazirlaniyor: { l: 'Hazırlanıyor', tone: 'muted' }, yola_cikti: { l: 'Yolda', tone: 'blue' }, teslim_edildi: { l: 'Teslim Edildi', tone: 'green' }, iptal: { l: 'İptal', tone: 'red' } }
const INCOTERMS = ['EXW', 'FCA', 'FOB', 'CFR', 'CIF', 'CPT', 'CIP', 'DAP', 'DPU', 'DDP']
const bosIhr = { ulke: '', para_birimi: 'USD', kur: '1', incoterm: '', konteyner_no: '', gumruk_beyan_no: '' }

export default function SevkiyatPage() {
  const toast = useToast()
  const { d, loading, reload } = useUretim(['sevkiyatlar', 'siparisler', 'siparisKalemleri', 'cariTam', 'ihracat', 'variants', 'products', 'sevkRows'])
  const [tab, setTab] = useState('acik')
  const [detay, setDetay] = useState<any>(null)
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState<any>({})
  const [satirlar, setSatirlar] = useState<Record<string, string>>({})
  const [ihr, setIhr] = useState<any>(null)
  const [busy, setBusy] = useState(false)

  const cari = useMemo(() => byId(d.cariTam), [d.cariTam])
  const siparis = useMemo(() => byId(d.siparisler), [d.siparisler])
  const urun = useMemo(() => byId(d.products), [d.products])
  const varyant = useMemo(() => byId(d.variants), [d.variants])
  const etiket = (v: any) => [urun[v?.product_id]?.name, v?.name, v?.color, v?.size].filter(Boolean).filter((a: any, i: number, arr: any[]) => arr.indexOf(a) === i).join(' · ') || v?.name || '—'
  const ihrBy = useMemo(() => Object.fromEntries(d.ihracat.map((x: any) => [x.sevkiyat_id, x])), [d.ihracat])

  // Sevkiyata bağlı kalemler = stok defterindeki sevkiyat hareketleri (yalnızca ilgili sevkiyat için sunucudan çekilir)
  const ledgerAl = async (sid: string) => { const r: any = await erp.from('stok_hareketleri').select('variant_id,yon,miktar').eq('kaynak_tablo', 'sevkiyatlar').eq('kaynak_id', sid); return r?.data || [] }
  const kalemlerDen = (rows: any[]) => {
    const m: Record<string, number> = {}
    rows.filter(h => h.variant_id).forEach(h => { m[h.variant_id] = (m[h.variant_id] || 0) + (h.yon === 'cikis' ? 1 : -1) * (+h.miktar || 0) })
    return Object.entries(m).filter(([, q]) => q !== 0).map(([vid, q]) => ({ vid, q, ad: etiket(varyant[vid]) }))
  }
  const [dLedger, setDLedger] = useState<any[]>([])

  const cnt = (f: (s: any) => boolean) => d.sevkiyatlar.filter(f).length
  const ay = todayISO().slice(0, 7)
  const acik = (s: any) => ['hazirlaniyor', 'yola_cikti'].includes(s.durum)
  const liste = d.sevkiyatlar.filter((s: any) => tab === 'hepsi' ? true : tab === 'acik' ? acik(s) : tab === 'ihracat' ? !!ihrBy[s.id] : s.durum === tab)
  const ayS = d.sevkiyatlar.filter((s: any) => (s.tarih || '').startsWith(ay) && s.durum !== 'iptal')

  /* ── Yeni sevkiyat ── */
  const sonrakiNo = () => { const y = new Date().getFullYear(), p = `SV-${y}-`; return p + String(Math.max(0, ...d.sevkiyatlar.filter((s: any) => s.no?.startsWith(p)).map((s: any) => +s.no.slice(p.length) || 0)) + 1).padStart(4, '0') }
  function siparisSec(id: string, base?: any) {
    const s = siparis[id]
    const sevk = id ? sevkEdilen(id, d.sevkRows) : {}
    const yeni: Record<string, string> = {}
    d.siparisKalemleri.filter((k: any) => k.siparis_id === id && k.variant_id).forEach((k: any) => {
      const kalan = Math.max((+k.miktar || 0) - (sevk[k.variant_id] || 0), 0), stok = Math.max(+varyant[k.variant_id]?.stock || 0, 0)
      yeni[k.id] = String(Math.min(kalan, stok))
    })
    setSatirlar(yeni)
    setForm((f: any) => ({ ...(base || f), siparis_id: id, cari_id: s?.cari_id || (base || f).cari_id || '' }))
  }
  function openNew(siparisId?: string) {
    const base = { no: sonrakiNo(), siparis_id: '', cari_id: '', tarih: todayISO(), koli_sayisi: '', palet_sayisi: '', net_agirlik: '', brut_agirlik: '', toplam_m3: '', kargo_firmasi: '', takip_no: '', notlar: '', ihracat: false, ...bosIhr }
    setForm(base); setSatirlar({}); setModal(true)
    if (siparisId) siparisSec(siparisId, base)
  }
  useEffect(() => { // ?siparis=ID ile gelindiyse formu aç
    if (loading) return
    const id = new URLSearchParams(window.location.search).get('siparis')
    if (id && siparis[id]) { openNew(id); window.history.replaceState({}, '', window.location.pathname) }
  }, [loading]) // eslint-disable-line

  const seciliKalemler = d.siparisKalemleri.filter((k: any) => k.siparis_id === form.siparis_id)
  const sevkMap = form.siparis_id ? sevkEdilen(form.siparis_id, d.sevkRows) : {}
  const toplamAdet = sum(seciliKalemler, (k: any) => +satirlar[k.id] || 0)

  async function kaydet(e: React.FormEvent) {
    e.preventDefault(); if (busy) return
    if (d.sevkiyatlar.some((s: any) => s.no === form.no)) return toast.show('Bu sevkiyat no zaten var', true)
    for (const k of seciliKalemler) {
      const q = +satirlar[k.id] || 0; if (!q || !k.variant_id) continue
      const kalan = Math.max((+k.miktar || 0) - (sevkMap[k.variant_id] || 0), 0)
      if (q > kalan && !confirm(`${k.urun_adi}: ${fmtInt(q)} adet, siparişte kalan ${fmtInt(kalan)} adedi aşıyor. Devam?`)) return
      if (q > (+varyant[k.variant_id]?.stock || 0) && !confirm(`${k.urun_adi}: stok (${fmtInt(varyant[k.variant_id]?.stock)}) sevk miktarından az; stok eksiye düşecek. Devam?`)) return
    }
    if (form.ihracat && !form.ulke.trim()) return toast.show('İhracat için ülke gir', true)
    setBusy(true)
    try {
      const num = (v: string) => (v ? +v : 0)
      const r: any = await erp.from('sevkiyatlar').insert({ no: form.no, siparis_id: form.siparis_id || null, cari_id: form.cari_id || null, tarih: form.tarih, koli_sayisi: Math.round(num(form.koli_sayisi)), palet_sayisi: Math.round(num(form.palet_sayisi)), toplam_urun_adedi: toplamAdet, net_agirlik: num(form.net_agirlik), brut_agirlik: num(form.brut_agirlik), toplam_m3: num(form.toplam_m3), kargo_firmasi: form.kargo_firmasi || null, takip_no: form.takip_no || null, notlar: form.notlar || null, durum: 'hazirlaniyor' })
      if (r?.error) throw new Error(r.error)
      const sid = r.data[0].id
      const hareketler = seciliKalemler.filter((k: any) => k.variant_id && +satirlar[k.id] > 0).map((k: any) => ({ tip: 'sevkiyat', yon: 'cikis', variant_id: k.variant_id, miktar: +satirlar[k.id], kaynak_tablo: 'sevkiyatlar', kaynak_id: sid, aciklama: `Sevkiyat ${form.no}` }))
      if (hareketler.length) { const h: any = await erp.from('stok_hareketleri').insert(hareketler); if (h?.error) throw new Error('Stok düşülemedi: ' + h.error) }
      if (form.ihracat) await erp.from('ihracat_detaylari').insert({ sevkiyat_id: sid, ulke: form.ulke.trim(), para_birimi: form.para_birimi, kur: +form.kur || 1, incoterm: form.incoterm || null, konteyner_no: form.konteyner_no || null, gumruk_beyan_no: form.gumruk_beyan_no || null, toplam_koli: Math.round(num(form.koli_sayisi)), toplam_m3: num(form.toplam_m3), net_agirlik: num(form.net_agirlik), brut_agirlik: num(form.brut_agirlik) })
      // sipariş tamamen sevk edildiyse durumu güncelle
      if (form.siparis_id) {
        const sevk = { ...sevkMap }; hareketler.forEach((h: any) => { sevk[h.variant_id] = (sevk[h.variant_id] || 0) + h.miktar })
        const hepsi = seciliKalemler.filter((k: any) => k.variant_id).every((k: any) => (sevk[k.variant_id] || 0) >= +k.miktar)
        if (hepsi && SIPARIS_ACIK.includes(siparis[form.siparis_id]?.durum)) await erp.from('satis_siparisleri').update({ durum: 'sevk_edildi' }).eq('id', form.siparis_id)
      }
      toast.show(`Sevkiyat oluşturuldu${hareketler.length ? ` — ${fmtInt(toplamAdet)} adet stoktan düşüldü` : ''}`); setModal(false); await reload()
    } catch (err: any) { toast.show(err.message, true); reload() }
    setBusy(false)
  }

  async function durum(s: any, yeni: string) {
    if (yeni === 'iptal') {
      if (!confirm(`${s.no} iptal edilsin mi?\n\nSevk edilen ürünler stoğa geri eklenir.`)) return
      setBusy(true)
      const ters = kalemlerDen(await ledgerAl(s.id)).map(k => ({ tip: 'sevkiyat', yon: 'giris', variant_id: k.vid, miktar: k.q, kaynak_tablo: 'sevkiyatlar', kaynak_id: s.id, aciklama: `Sevkiyat iptali ${s.no}` }))
      if (ters.length) { const h: any = await erp.from('stok_hareketleri').insert(ters); if (h?.error) { setBusy(false); return toast.show(h.error, true) } }
      if (s.siparis_id && ['sevk_edildi', 'tamamlandi'].includes(siparis[s.siparis_id]?.durum)) await erp.from('satis_siparisleri').update({ durum: 'hazir' }).eq('id', s.siparis_id)
      setBusy(false)
    }
    const r: any = await erp.from('sevkiyatlar').update({ durum: yeni }).eq('id', s.id)
    if (r?.error) return toast.show(r.error, true)
    if (yeni === 'teslim_edildi' && s.siparis_id && siparis[s.siparis_id]?.durum === 'sevk_edildi') await erp.from('satis_siparisleri').update({ durum: 'tamamlandi' }).eq('id', s.siparis_id)
    toast.show(`${s.no}: ${DURUM[yeni].l}`); await reload(); setDetay((x: any) => x?.id === s.id ? { ...x, durum: yeni } : x)
  }
  async function topluSil(sel: any[]): Promise<string | void> {
    const { silinen, hata } = await topluSilCalistir(sel, async (r: any) => (r.durum !== 'iptal' ? `${r.no}: önce sevkiyatı iptal et` : (await erp.from('sevkiyatlar').delete().eq('id', r.id))?.error), 'sevkiyat')
    await reload(); setDetay(null)
    if (hata) return hata
    toast.show(`${silinen} sevkiyat silindi`)
  }
  async function sil(s: any) {
    if (s.durum !== 'iptal') return toast.show('Önce sevkiyatı iptal et (stok geri eklenir), sonra silebilirsin', true)
    if (!confirm(`${s.no} kaydı silinsin mi?`)) return
    const r: any = await erp.from('sevkiyatlar').delete().eq('id', s.id)
    if (r?.error) return toast.show(r.error, true)
    toast.show('Sevkiyat silindi'); setDetay(null); reload()
  }

  async function ihrKaydet(e: React.FormEvent) {
    e.preventDefault(); if (!ihr || busy) return
    setBusy(true)
    const s = ihr.s, p = { ulke: ihr.ulke.trim(), para_birimi: ihr.para_birimi, kur: +ihr.kur || 1, incoterm: ihr.incoterm || null, konteyner_no: ihr.konteyner_no || null, gumruk_beyan_no: ihr.gumruk_beyan_no || null }
    const r: any = ihrBy[s.id] ? await erp.from('ihracat_detaylari').update(p).eq('id', ihrBy[s.id].id) : await erp.from('ihracat_detaylari').insert({ ...p, sevkiyat_id: s.id, toplam_koli: s.koli_sayisi, toplam_m3: s.toplam_m3, net_agirlik: s.net_agirlik, brut_agirlik: s.brut_agirlik })
    setBusy(false)
    if (r?.error) return toast.show(r.error, true)
    setIhr(null); toast.show('İhracat detayı kaydedildi'); reload()
  }

  async function packing(s: any) {
    const ih = ihrBy[s.id], ks = kalemlerDen(await ledgerAl(s.id))
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Packing List ${s.no}</title><style>body{font-family:Arial,sans-serif;color:#0b0e0b;padding:40px;max-width:820px;margin:0 auto}h1{font-size:20px;margin:0 0 4px}.muted{color:#6b7366;font-size:12px}table{width:100%;border-collapse:collapse;margin-top:20px}th,td{padding:8px 6px;font-size:13px;border-bottom:1px solid #ddd;text-align:left}th{color:#6b7366;font-size:11px;text-transform:uppercase}td:last-child,th:last-child{text-align:right}.header{display:flex;justify-content:space-between;border-bottom:2px solid #e55f28;padding-bottom:14px;margin-bottom:14px}.grid{display:grid;grid-template-columns:1fr 1fr;gap:6px 30px;font-size:13px;margin-top:10px}@media print{body{padding:0}}</style></head><body>
      <div class="header"><div><h1>ALYA PLASTİK</h1><p class="muted">${ih ? 'PACKING LIST / ÇEKİ LİSTESİ' : 'SEVK İRSALİYE ÖZETİ'}</p></div><div style="text-align:right"><h1>${s.no}</h1><p class="muted">${fmtDate(s.tarih)}</p></div></div>
      <div class="grid"><div><b>Alıcı:</b> ${cari[s.cari_id]?.ad || '—'}</div><div><b>Sipariş:</b> ${siparis[s.siparis_id]?.no || '—'}</div>${ih ? `<div><b>Ülke:</b> ${ih.ulke}</div><div><b>Incoterm:</b> ${ih.incoterm || '—'}</div><div><b>Konteyner:</b> ${ih.konteyner_no || '—'}</div><div><b>Gümrük beyan no:</b> ${ih.gumruk_beyan_no || '—'}</div>` : `<div><b>Kargo:</b> ${s.kargo_firmasi || '—'}</div><div><b>Takip no:</b> ${s.takip_no || '—'}</div>`}</div>
      <table><thead><tr><th>Ürün</th><th>Adet</th></tr></thead><tbody>${ks.map(k => `<tr><td>${k.ad}</td><td>${fmtInt(k.q)}</td></tr>`).join('')}<tr><td><b>Toplam</b></td><td><b>${fmtInt(sum(ks, x => x.q))}</b></td></tr></tbody></table>
      <div class="grid" style="margin-top:20px"><div><b>Koli:</b> ${s.koli_sayisi || 0}</div><div><b>Palet:</b> ${s.palet_sayisi || 0}</div><div><b>Net ağırlık:</b> ${fmtN(s.net_agirlik, 1)} kg</div><div><b>Brüt ağırlık:</b> ${fmtN(s.brut_agirlik, 1)} kg</div><div><b>Hacim:</b> ${fmtN(s.toplam_m3, 2)} m³</div></div>${s.notlar ? `<p class="muted" style="margin-top:20px">${s.notlar}</p>` : ''}</body></html>`
    const w = window.open('', '_blank'); if (w) { w.document.write(html); w.document.close(); w.focus(); setTimeout(() => w.print(), 300) }
  }

  const cols: Col<any>[] = [
    { key: 'no', label: 'Sevkiyat', sort: s => s.no, render: s => <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}><div style={{ width: 32, height: 32, borderRadius: 9, background: ihrBy[s.id] ? 'var(--adm-blue2)' : 'var(--adm-ac2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{ihrBy[s.id] ? <Globe size={15} style={{ color: 'var(--adm-blue)' }} /> : <Truck size={15} style={{ color: 'var(--adm-ac)' }} />}</div><div><b style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: 12.5 }}>{s.no}</b><div style={{ fontSize: 11, color: 'var(--adm-tx3)' }}>{cari[s.cari_id]?.ad || '—'}</div></div></div> },
    { key: 'siparis', label: 'Sipariş', sort: s => siparis[s.siparis_id]?.no || '', render: s => siparis[s.siparis_id]?.no || '—', hideSm: true },
    { key: 'tarih', label: 'Tarih', width: 96, sort: s => s.tarih, render: s => fmtDate(s.tarih), hideSm: true },
    { key: 'adet', label: 'Adet', align: 'right', sort: s => +s.toplam_urun_adedi, render: s => fmtInt(s.toplam_urun_adedi), total: rs => fmtInt(sum(rs.filter((s: any) => s.durum !== 'iptal'), (s: any) => s.toplam_urun_adedi)) },
    { key: 'koli', label: 'Koli / Palet', align: 'right', sort: s => +s.koli_sayisi, render: s => `${s.koli_sayisi || 0} / ${s.palet_sayisi || 0}`, hideSm: true },
    { key: 'agirlik', label: 'Brüt kg', align: 'right', sort: s => +s.brut_agirlik, render: s => fmtN(s.brut_agirlik, 1), total: rs => fmtN(sum(rs.filter((s: any) => s.durum !== 'iptal'), (s: any) => s.brut_agirlik), 1), hideSm: true },
    { key: 'kargo', label: 'Kargo / Takip', sort: s => s.kargo_firmasi || '', render: s => s.kargo_firmasi ? <div>{s.kargo_firmasi}<div style={{ fontSize: 11, color: 'var(--adm-tx3)' }}>{s.takip_no || ''}</div></div> : '—', hideSm: true },
    { key: 'ihr', label: 'İhracat', sort: s => ihrBy[s.id]?.ulke || '', render: s => ihrBy[s.id] ? <Badge tone="blue"><Globe size={10} style={{ marginRight: 3 }} />{ihrBy[s.id].ulke}</Badge> : <span style={{ color: 'var(--adm-tx3)' }}>—</span>, hideSm: true },
    { key: 'durum', label: 'Durum', width: 120, sort: s => s.durum, render: s => <Badge tone={DURUM[s.durum]?.tone}>{DURUM[s.durum]?.l}</Badge> },
    { key: 'act', label: '', width: 120, align: 'right', render: s => (
      <span onClick={e => e.stopPropagation()}>
        {s.durum === 'hazirlaniyor' && <button className="adm-btn" style={{ padding: '4px 10px', fontSize: 11.5 }} onClick={() => durum(s, 'yola_cikti')}><Send size={12} />Yola çıkar</button>}
        {s.durum === 'yola_cikti' && <button className="adm-btn" style={{ padding: '4px 10px', fontSize: 11.5, background: 'var(--adm-green)' }} onClick={() => durum(s, 'teslim_edildi')}><CheckCircle2 size={12} />Teslim</button>}
      </span>) },
  ]

  const dS = detay ? d.sevkiyatlar.find((s: any) => s.id === detay.id) || detay : null
  useEffect(() => { if (!detay?.id) { setDLedger([]); return } ledgerAl(detay.id).then(setDLedger) }, [detay?.id, d.sevkiyatlar]) // eslint-disable-line
  const dK = dS ? kalemlerDen(dLedger) : []
  const dI = dS ? ihrBy[dS.id] : null

  useAcParam(!loading, id => { const r = d.sevkiyatlar.find((x: any) => x.id === id); if (r) setDetay(r) })

  return (
    <div style={{ flex: 1, overflow: 'auto' }}>
      <AdminTopBar title="Sevkiyat / İhracat" />
      <Page>
        <PageHead title="Sevkiyat & İhracat" sub="Siparişten sevkiyat, otomatik stok düşümü, kargo takibi, ihracat evrakları" actions={<button className="adm-btn" onClick={() => openNew()}><Plus size={14} />Yeni Sevkiyat</button>} />
        <KpiGrid min={180}>
          <Kpi label="Hazırlanan" value={cnt(s => s.durum === 'hazirlaniyor')} Icon={Boxes} color="var(--adm-amber)" sub="yola çıkmamış" />
          <Kpi label="Yolda" value={cnt(s => s.durum === 'yola_cikti')} Icon={Truck} color="var(--adm-blue)" sub="teslim bekliyor" />
          <Kpi label="Bu Ay Sevk" value={fmtInt(sum(ayS, (s: any) => s.toplam_urun_adedi))} Icon={PackageCheck} color="var(--adm-green)" sub={`${ayS.length} sevkiyat`} />
          <Kpi label="İhracat" value={ayS.filter((s: any) => ihrBy[s.id]).length} Icon={Globe} color="var(--adm-blue)" sub={`bu ay · toplam ${d.ihracat.length}`} />
          <Kpi label="Bu Ay Ağırlık" value={`${fmtN(sum(ayS, (s: any) => s.brut_agirlik), 0)} kg`} Icon={Weight} color="var(--adm-ac)" sub={`${fmtInt(sum(ayS, (s: any) => s.koli_sayisi))} koli`} />
        </KpiGrid>
        <div style={{ marginBottom: 12 }}><Tabs value={tab} onChange={setTab} tabs={[{ v: 'acik', l: 'Açık', n: cnt(acik) }, { v: 'hazirlaniyor', l: 'Hazırlanıyor', n: cnt(s => s.durum === 'hazirlaniyor') }, { v: 'yola_cikti', l: 'Yolda', n: cnt(s => s.durum === 'yola_cikti') }, { v: 'teslim_edildi', l: 'Teslim edildi', n: cnt(s => s.durum === 'teslim_edildi') }, { v: 'ihracat', l: 'İhracat', n: d.ihracat.length }, { v: 'iptal', l: 'İptal', n: cnt(s => s.durum === 'iptal') }, { v: 'hepsi', l: 'Tümü', n: d.sevkiyatlar.length }]} /></div>
        <DataGrid rows={liste} cols={cols} rowKey={s => s.id} loading={loading} onBulkDelete={topluSil} deleteNoun="sevkiyat" deleteNote="Sadece iptal edilmiş sevkiyatlar silinir; diğerleri atlanır ve hata olarak bildirilir." csvName="sevkiyatlar" storageKey="sevkiyat" onRowClick={setDetay} activeKey={detay?.id}
          searchText={s => `${s.no} ${cari[s.cari_id]?.ad || ''} ${siparis[s.siparis_id]?.no || ''} ${s.takip_no || ''} ${ihrBy[s.id]?.ulke || ''}`} searchPlaceholder="Sevkiyat no, müşteri, sipariş, takip no..." emptyTitle="Sevkiyat bulunamadı" emptySub="Yeni Sevkiyat ile siparişten ürün sevk et" />
      </Page>

      <Drawer open={!!dS} onClose={() => setDetay(null)} width={600}
        title={dS && <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}><span style={{ fontFamily: 'JetBrains Mono,monospace' }}>{dS.no}</span><Badge tone={DURUM[dS.durum]?.tone}>{DURUM[dS.durum]?.l}</Badge>{dI && <Badge tone="blue"><Globe size={10} style={{ marginRight: 3 }} />{dI.ulke}</Badge>}</span>}
        sub={dS && `${cari[dS.cari_id]?.ad || '—'} · ${fmtDate(dS.tarih)}`}
        footer={dS && <>
          <button className="adm-btn-ghost" onClick={() => packing(dS)}><Printer size={13} />{dI ? 'Packing List' : 'Yazdır'}</button>
          <button className="adm-btn-ghost" onClick={() => setIhr({ s: dS, ...(dI ? { ulke: dI.ulke, para_birimi: dI.para_birimi || 'USD', kur: String(dI.kur || 1), incoterm: dI.incoterm || '', konteyner_no: dI.konteyner_no || '', gumruk_beyan_no: dI.gumruk_beyan_no || '' } : bosIhr) })}><Globe size={13} />{dI ? 'İhracat düzenle' : 'İhracata çevir'}</button>
          {dS.durum === 'iptal' && <button className="adm-btn-danger" onClick={() => sil(dS)}><Trash2 size={13} /></button>}
          {acik(dS) && <button className="adm-btn-ghost" style={{ color: 'var(--adm-red)' }} disabled={busy} onClick={() => durum(dS, 'iptal')}><Ban size={13} />İptal</button>}
          {dS.durum === 'hazirlaniyor' && <button className="adm-btn" onClick={() => durum(dS, 'yola_cikti')}><Send size={14} />Yola Çıkar</button>}
          {dS.durum === 'yola_cikti' && <button className="adm-btn" style={{ background: 'var(--adm-green)' }} onClick={() => durum(dS, 'teslim_edildi')}><CheckCircle2 size={14} />Teslim Edildi</button>}</>}>
        {dS && <div style={{ padding: 20 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8, marginBottom: 14 }}>
            {[['Adet', fmtInt(dS.toplam_urun_adedi)], ['Koli', String(dS.koli_sayisi || 0)], ['Palet', String(dS.palet_sayisi || 0)], ['Brüt kg', fmtN(dS.brut_agirlik, 1)]].map(([k, v]) => <div key={k} style={{ padding: 10, borderRadius: 10, background: 'var(--adm-s2)' }}><div className="adm-kpi-label" style={{ marginBottom: 3 }}>{k}</div><b style={{ fontSize: 15, fontFamily: 'JetBrains Mono,monospace' }}>{v}</b></div>)}
          </div>
          <InfoRow k="Sipariş" v={siparis[dS.siparis_id]?.no || '—'} /><InfoRow k="Kargo firması" v={dS.kargo_firmasi || '—'} /><InfoRow k="Takip no" v={dS.takip_no || '—'} /><InfoRow k="Net ağırlık / hacim" v={`${fmtN(dS.net_agirlik, 1)} kg · ${fmtN(dS.toplam_m3, 2)} m³`} />
          <Divider label="Sevk edilen ürünler" />
          {dK.length === 0 ? <p style={{ fontSize: 12.5, color: 'var(--adm-tx3)', margin: 0 }}>Bu sevkiyata bağlı stok hareketi yok (varyantsız / serbest sevkiyat).</p> : dK.map(k => <div key={k.vid} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', fontSize: 13, borderBottom: '1px dashed var(--adm-bdr)' }}><span>{k.ad}</span><b style={{ fontFamily: 'JetBrains Mono,monospace' }}>{fmtInt(k.q)}</b></div>)}
          {dI && <><Divider label="İhracat" /><InfoRow k="Ülke" v={dI.ulke} /><InfoRow k="Para birimi / kur" v={`${dI.para_birimi || '—'} · ${dI.kur}`} /><InfoRow k="Incoterm" v={dI.incoterm || '—'} /><InfoRow k="Konteyner" v={dI.konteyner_no || '—'} /><InfoRow k="Gümrük beyan no" v={dI.gumruk_beyan_no || '—'} /></>}
          {dS.notlar && <><Divider label="Not" /><p style={{ fontSize: 12.5, color: 'var(--adm-tx2)', margin: 0, whiteSpace: 'pre-wrap' }}>{dS.notlar}</p></>}
        </div>}
      </Drawer>

      <Modal open={modal} onClose={() => setModal(false)} onSubmit={kaydet} width={860} title="Yeni Sevkiyat"
        footer={<><span style={{ marginRight: 'auto', fontSize: 13, color: 'var(--adm-tx3)' }}>Toplam <b style={{ color: 'var(--adm-tx)' }}>{fmtInt(toplamAdet)}</b> adet · oluşturulunca stoktan düşer</span><button type="button" className="adm-btn-ghost" onClick={() => setModal(false)}>İptal</button><button type="submit" className="adm-btn" disabled={busy}>{busy ? 'Kaydediliyor...' : 'Sevkiyatı Oluştur'}</button></>}>
        <FormGrid cols={4}>
          <Field label="Sevkiyat No"><input className="adm-inp" value={form.no || ''} onChange={e => setForm((f: any) => ({ ...f, no: e.target.value }))} /></Field>
          <Field label="Sipariş" span={2}><select className="adm-inp" value={form.siparis_id || ''} onChange={e => siparisSec(e.target.value)}><option value="">— Siparişsiz (serbest) —</option>{d.siparisler.filter((s: any) => SIPARIS_ACIK.includes(s.durum) || s.id === form.siparis_id).map((s: any) => <option key={s.id} value={s.id}>{s.no}{cari[s.cari_id] ? ` · ${cari[s.cari_id].ad}` : ''}</option>)}</select></Field>
          <Field label="Tarih"><input type="date" className="adm-inp" value={form.tarih || ''} onChange={e => setForm((f: any) => ({ ...f, tarih: e.target.value }))} /></Field>
          <Field label="Müşteri" span={2}><select className="adm-inp" value={form.cari_id || ''} onChange={e => setForm((f: any) => ({ ...f, cari_id: e.target.value }))}><option value="">—</option>{d.cariTam.filter((c: any) => c.tip !== 'tedarikci').map((c: any) => <option key={c.id} value={c.id}>{c.ad}</option>)}</select></Field>
          <Field label="Kargo firması"><input className="adm-inp" value={form.kargo_firmasi || ''} onChange={e => setForm((f: any) => ({ ...f, kargo_firmasi: e.target.value }))} /></Field>
          <Field label="Takip no"><input className="adm-inp" value={form.takip_no || ''} onChange={e => setForm((f: any) => ({ ...f, takip_no: e.target.value }))} /></Field>
        </FormGrid>
        {form.siparis_id && (<>
          <Divider label="Sevk edilecek kalemler" />
          <table className="adm-tbl compact"><thead><tr><th>Ürün</th><th style={{ textAlign: 'right' }}>Sipariş</th><th style={{ textAlign: 'right' }}>Sevk edilen</th><th style={{ textAlign: 'right' }}>Stok</th><th style={{ width: 120 }}>Bu sevkiyat</th></tr></thead>
            <tbody>{seciliKalemler.map((k: any) => { const sv = sevkMap[k.variant_id] || 0, st = +varyant[k.variant_id]?.stock || 0; return <tr key={k.id}>
              <td>{k.urun_adi}{!k.variant_id && <Badge tone="amber" style={{ marginLeft: 6, fontSize: 9.5 }}>varyantsız</Badge>}</td><td style={{ textAlign: 'right' }}>{fmtInt(k.miktar)}</td><td style={{ textAlign: 'right' }}>{fmtInt(sv)}</td><td style={{ textAlign: 'right', color: k.variant_id && st < +k.miktar - sv ? 'var(--adm-red)' : undefined }}>{k.variant_id ? fmtInt(st) : '—'}</td>
              <td>{k.variant_id ? <input type="number" min="0" className="adm-inp" style={{ fontSize: 13, padding: '5px 8px', fontWeight: 700 }} value={satirlar[k.id] ?? ''} onChange={e => setSatirlar(x => ({ ...x, [k.id]: e.target.value }))} /> : <span style={{ fontSize: 11, color: 'var(--adm-tx3)' }}>stok düşmez</span>}</td></tr> })}</tbody></table>
        </>)}
        <Divider label="Paketleme" />
        <FormGrid cols={5}>
          {[['koli_sayisi', 'Koli'], ['palet_sayisi', 'Palet'], ['net_agirlik', 'Net kg'], ['brut_agirlik', 'Brüt kg'], ['toplam_m3', 'Hacim m³']].map(([k, l]) => <Field key={k} label={l}><input type="number" step="0.01" min="0" className="adm-inp" value={form[k] || ''} onChange={e => setForm((f: any) => ({ ...f, [k]: e.target.value }))} /></Field>)}
        </FormGrid>
        <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, margin: '14px 0 6px' }}><input type="checkbox" checked={!!form.ihracat} onChange={e => setForm((f: any) => ({ ...f, ihracat: e.target.checked }))} /><Globe size={14} />İhracat sevkiyatı</label>
        {form.ihracat && <FormGrid cols={4}>
          <Field label="Ülke *"><input className="adm-inp" value={form.ulke || ''} onChange={e => setForm((f: any) => ({ ...f, ulke: e.target.value }))} /></Field>
          <Field label="Para birimi"><select className="adm-inp" value={form.para_birimi} onChange={e => setForm((f: any) => ({ ...f, para_birimi: e.target.value }))}>{['USD', 'EUR', 'GBP', 'TRY'].map(p => <option key={p}>{p}</option>)}</select></Field>
          <Field label="Kur"><input type="number" step="0.0001" className="adm-inp" value={form.kur || ''} onChange={e => setForm((f: any) => ({ ...f, kur: e.target.value }))} /></Field>
          <Field label="Incoterm"><select className="adm-inp" value={form.incoterm || ''} onChange={e => setForm((f: any) => ({ ...f, incoterm: e.target.value }))}><option value="">—</option>{INCOTERMS.map(i => <option key={i}>{i}</option>)}</select></Field>
          <Field label="Konteyner no" span={2}><input className="adm-inp" value={form.konteyner_no || ''} onChange={e => setForm((f: any) => ({ ...f, konteyner_no: e.target.value }))} /></Field>
          <Field label="Gümrük beyan no" span={2}><input className="adm-inp" value={form.gumruk_beyan_no || ''} onChange={e => setForm((f: any) => ({ ...f, gumruk_beyan_no: e.target.value }))} /></Field>
        </FormGrid>}
        <div style={{ marginTop: 12 }}><Field label="Notlar"><input className="adm-inp" value={form.notlar || ''} onChange={e => setForm((f: any) => ({ ...f, notlar: e.target.value }))} /></Field></div>
      </Modal>

      <Modal open={!!ihr} onClose={() => setIhr(null)} onSubmit={ihrKaydet} width={520} title={ihr && `${ihr.s.no} — İhracat Detayı`}
        footer={<><button type="button" className="adm-btn-ghost" onClick={() => setIhr(null)}>İptal</button><button type="submit" className="adm-btn" disabled={busy}>Kaydet</button></>}>
        {ihr && <FormGrid>
          <Field label="Ülke *"><input className="adm-inp" required autoFocus value={ihr.ulke} onChange={e => setIhr((x: any) => ({ ...x, ulke: e.target.value }))} /></Field>
          <Field label="Incoterm"><select className="adm-inp" value={ihr.incoterm} onChange={e => setIhr((x: any) => ({ ...x, incoterm: e.target.value }))}><option value="">—</option>{INCOTERMS.map(i => <option key={i}>{i}</option>)}</select></Field>
          <Field label="Para birimi"><select className="adm-inp" value={ihr.para_birimi} onChange={e => setIhr((x: any) => ({ ...x, para_birimi: e.target.value }))}>{['USD', 'EUR', 'GBP', 'TRY'].map(p => <option key={p}>{p}</option>)}</select></Field>
          <Field label="Kur"><input type="number" step="0.0001" className="adm-inp" value={ihr.kur} onChange={e => setIhr((x: any) => ({ ...x, kur: e.target.value }))} /></Field>
          <Field label="Konteyner no"><input className="adm-inp" value={ihr.konteyner_no} onChange={e => setIhr((x: any) => ({ ...x, konteyner_no: e.target.value }))} /></Field>
          <Field label="Gümrük beyan no"><input className="adm-inp" value={ihr.gumruk_beyan_no} onChange={e => setIhr((x: any) => ({ ...x, gumruk_beyan_no: e.target.value }))} /></Field>
        </FormGrid>}
      </Modal>
      {toast.node}
    </div>
  )
}
