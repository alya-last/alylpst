'use client'
import { useAcParam } from '@/lib/ac-param'
import { useMemo, useState } from 'react'
import AdminTopBar from '@/components/admin/TopBar'
import { erp } from '@/lib/erp-client'
import { fmt, fmtK, fmtN, fmtInt, fmtDate, fmtDateTime, todayISO } from '@/lib/fmt'
import { useUretim, byId, fireOrani, receteMaliyet } from '@/lib/uretim-utils'
import { sum, CHART_COLORS, sonAylar, ayAnahtar } from '@/lib/muh-utils'
import { Page, PageHead, Kpi, KpiGrid, Card, Badge, Tabs, Money, Drawer, Modal, Field, FormGrid, InfoRow, Empty, useToast } from '@/components/admin/erp/ui'
import { DataGrid, type Col } from '@/components/admin/erp/DataGrid'
import { topluSilCalistir } from '@/lib/toplu-sil'
import { TrendChart, BarList } from '@/components/admin/erp/charts'
import TopluDuzenle from '@/components/admin/TopluDuzenle'
import { ListChecks, Plus, Trash2, Flame, Coins, Percent, Target, Boxes, Package } from 'lucide-react'

const NEDENLER = ['Kısa atım', 'Çapak', 'Yanık / siyah nokta', 'Renk hatası', 'Çarpılma', 'Boyut hatası', 'Ayar / başlangıç firesi', 'Renk geçişi', 'Hammadde döküntüsü', 'Kalite red']
const bos = { uretim_emri_id: '', makine_id: '', tur: 'hammadde', hammadde_id: '', variant_id: '', miktar: '', fire_nedeni: '', maliyet: '', stok: true }

export default function FirePage() {
  const toast = useToast()
  const { d, loading, reload } = useUretim(['fire', 'hareketler', 'emirler', 'makineler', 'hammaddeler', 'products', 'variants', 'receteler', 'receteKalemleri'])
  const [tab, setTab] = useState('hepsi')
  const [donem, setDonem] = useState('tumu')
  const [nedenF, setNedenF] = useState('')
  const [detay, setDetay] = useState<any>(null)
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState<any>(bos)
  const [busy, setBusy] = useState(false)
  const [toplu, setToplu] = useState<any[] | null>(null)

  const urun = useMemo(() => byId(d.products), [d.products])
  const emir = useMemo(() => byId(d.emirler), [d.emirler])
  const makine = useMemo(() => byId(d.makineler), [d.makineler])
  const ham = useMemo(() => byId(d.hammaddeler), [d.hammaddeler])
  const varyant = useMemo(() => byId(d.variants), [d.variants])
  const aktifRecete = useMemo(() => Object.fromEntries(d.receteler.filter((r: any) => r.aktif).map((r: any) => [r.urun_id, r])), [d.receteler])
  const birimMaliyet = (urunId: string, receteId?: string) => {
    const r = (receteId && d.receteler.find((x: any) => x.id === receteId)) || aktifRecete[urunId]
    return r ? receteMaliyet(r, d.receteKalemleri, d.hammaddeler).toplam : 0
  }

  // Tüm fire: üretim hattı girişleri + manuel kayıtlar
  const satirlar = useMemo(() => {
    const hat = d.hareketler.filter((h: any) => +h.fire_adet > 0).map((h: any) => {
      const e = emir[h.uretim_emri_id]
      return { id: 'h' + h.id, src: 'hat', tarih: h.tarih, emir_id: h.uretim_emri_id, makine_id: e?.makine_id, urun_id: e?.urun_id, ad: urun[e?.urun_id]?.name || '—', miktar: +h.fire_adet, birim: 'adet', neden: h.fire_nedeni || 'Belirtilmemiş', maliyet: +h.fire_adet * birimMaliyet(e?.urun_id, e?.recete_id), ham: h }
    })
    const man = d.fire.map((f: any) => {
      const e = emir[f.uretim_emri_id]
      const v = f.variant_id ? varyant[f.variant_id] : null
      const kalite = (f.fire_nedeni || '').startsWith('Kalite red')
      return { id: 'f' + f.id, src: kalite ? 'kalite' : 'manuel', tarih: f.tarih, emir_id: f.uretim_emri_id, makine_id: f.makine_id || e?.makine_id, urun_id: v?.product_id || e?.urun_id, ad: f.hammadde_id ? ham[f.hammadde_id]?.ad : v ? [urun[v.product_id]?.name, v.name].filter(Boolean).join(' · ') : urun[e?.urun_id]?.name || '—', miktar: +f.miktar, birim: f.birim || (f.hammadde_id ? ham[f.hammadde_id]?.birim : 'adet') || 'adet', neden: f.fire_nedeni || 'Belirtilmemiş', maliyet: +f.maliyet_etkisi || 0, ham: f }
    })
    return [...hat, ...man].sort((a, b) => (b.tarih || '').localeCompare(a.tarih || ''))
  }, [d, emir, urun, ham, varyant, aktifRecete]) // eslint-disable-line

  const SRC: Record<string, { l: string; tone: any }> = { hat: { l: 'Üretim hattı', tone: 'blue' }, manuel: { l: 'Manuel', tone: 'amber' }, kalite: { l: 'Kalite red', tone: 'red' } }
  const ayBas = todayISO().slice(0, 7)
  const dahil = (r: any) => donem === 'tumu' || (donem === 'ay' && (r.tarih || '').startsWith(ayBas)) || (donem === '30' && r.tarih && Date.now() - +new Date(r.tarih) <= 30 * 86400000)
  const liste = satirlar.filter(r => (tab === 'hepsi' || r.src === tab) && dahil(r) && (!nedenF || r.neden === nedenF))
  const nedenListesi = Array.from(new Set(satirlar.map(r => r.neden))).sort()

  const adetFire = sum(liste.filter(r => r.birim === 'adet'), r => r.miktar)
  const hamFire = liste.filter(r => r.birim !== 'adet')
  const maliyet = sum(liste, r => r.maliyet)

  // Üretim hattı fire oranı — dönem filtresine uygun
  const hh = d.hareketler.filter((h: any) => donem === 'tumu' || (donem === 'ay' && (h.tarih || '').startsWith(ayBas)) || (donem === '30' && h.tarih && Date.now() - +new Date(h.tarih) <= 30 * 86400000))
  const uretilen = sum(hh, (h: any) => h.uretilen_adet), hatFire = sum(hh, (h: any) => h.fire_adet)
  const oran = fireOrani(uretilen, hatFire)

  // Ürün bazlı: gerçek vs hedef
  const urunAnaliz = useMemo(() => {
    const m: Record<string, { u: number; f: number }> = {}
    hh.forEach((h: any) => { const e = emir[h.uretim_emri_id]; if (!e) return; const o = (m[e.urun_id] ||= { u: 0, f: 0 }); o.u += +h.uretilen_adet || 0; o.f += +h.fire_adet || 0 })
    return Object.entries(m).map(([id, v]) => { const hedef = +aktifRecete[id]?.hedef_fire_orani || 0; const g = fireOrani(v.u, v.f); return { id, ad: urun[id]?.name || '—', gercek: g, hedef, u: v.u, f: v.f } }).sort((a, b) => b.gercek - a.gercek)
  }, [hh, emir, aktifRecete, urun])
  const hedefOrt = urunAnaliz.length ? sum(urunAnaliz, x => x.hedef * x.u) / Math.max(sum(urunAnaliz, x => x.u), 1) : 0

  const makineAnaliz = useMemo(() => {
    const m: Record<string, { u: number; f: number }> = {}
    hh.forEach((h: any) => { const e = emir[h.uretim_emri_id]; if (!e?.makine_id) return; const o = (m[e.makine_id] ||= { u: 0, f: 0 }); o.u += +h.uretilen_adet || 0; o.f += +h.fire_adet || 0 })
    return Object.entries(m).map(([id, v]) => ({ label: makine[id]?.ad || '—', value: fireOrani(v.u, v.f), sub: `${fmtInt(v.f)} adet` })).sort((a, b) => b.value - a.value)
  }, [hh, emir, makine])

  const nedenAnaliz = useMemo(() => { const m: Record<string, number> = {}; liste.filter(r => r.birim === 'adet').forEach(r => { m[r.neden] = (m[r.neden] || 0) + r.miktar }); return Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, 7).map(([label, value], i) => ({ label, value, color: CHART_COLORS[i] })) }, [liste])
  const aylar = useMemo(() => sonAylar(12), [])
  const aylikSeri = aylar.map(a => sum(satirlar.filter(r => r.tarih && ayAnahtar(r.tarih) === a.key), r => r.maliyet))

  /* Form */
  const hamSec = ham[form.hammadde_id], vSec = varyant[form.variant_id]
  const otoMaliyet = form.tur === 'hammadde' ? (+form.miktar || 0) * (+hamSec?.ortalama_maliyet || 0) : (+form.miktar || 0) * birimMaliyet(vSec?.product_id || emir[form.uretim_emri_id]?.urun_id, emir[form.uretim_emri_id]?.recete_id)
  const openNew = () => { setForm(bos); setModal(true) }

  async function save(e: React.FormEvent) {
    e.preventDefault(); if (busy) return
    const m = +form.miktar
    if (!(m > 0)) return toast.show('Miktar gerekli', true)
    if (form.tur === 'hammadde' && !form.hammadde_id) return toast.show('Hammadde seç', true)
    if (form.tur === 'urun' && !form.variant_id) return toast.show('Ürün varyantı seç', true)
    if (form.stok && form.tur === 'hammadde' && m > (+hamSec?.mevcut_stok || 0) && !confirm(`${hamSec.ad} stoğu (${fmtN(hamSec.mevcut_stok, 1)} ${hamSec.birim}) fire miktarından az; stok eksiye düşecek. Devam?`)) return
    if (form.stok && form.tur === 'urun' && m > (+vSec?.stock || 0) && !confirm(`Ürün stoğu (${vSec.stock}) fire miktarından az; eksiye düşecek. Devam?`)) return
    setBusy(true)
    try {
      const e = emir[form.uretim_emri_id]
      const r: any = await erp.from('fire_kayitlari').insert({
        uretim_emri_id: form.uretim_emri_id || null, makine_id: form.makine_id || e?.makine_id || null, hammadde_id: form.tur === 'hammadde' ? form.hammadde_id : null, variant_id: form.tur === 'urun' ? form.variant_id : null,
        miktar: m, birim: form.tur === 'hammadde' ? hamSec?.birim || 'kg' : 'adet', fire_nedeni: form.fire_nedeni.trim() || 'Belirtilmemiş', maliyet_etkisi: form.maliyet !== '' ? +form.maliyet : +otoMaliyet.toFixed(2), tarih: new Date().toISOString(),
      })
      if (r?.error) throw new Error(r.error)
      if (form.stok) {
        const s: any = await erp.from('stok_hareketleri').insert({ tip: 'fire', yon: 'cikis', ...(form.tur === 'hammadde' ? { hammadde_id: form.hammadde_id } : { variant_id: form.variant_id }), miktar: m, kaynak_tablo: 'fire_kayitlari', kaynak_id: r.data?.[0]?.id, aciklama: form.fire_nedeni || 'Fire' })
        if (s?.error) throw new Error('Fire kaydedildi ama stok düşülemedi: ' + s.error)
      }
      toast.show('Fire kaydı eklendi'); setModal(false); await reload()
    } catch (err: any) { toast.show(err.message, true); reload() }
    setBusy(false)
  }

  async function topluSil(sel: any[]): Promise<string | void> {
    const { silinen, hata } = await topluSilCalistir(sel, async (r: any) => (r.src === 'hat' ? `${r.ad}: üretim hattı firesi buradan silinemez` : (await erp.from('fire_kayitlari').delete().eq('id', r.ham.id))?.error), 'fire kaydı')
    await reload(); setDetay(null)
    if (hata) return hata
    toast.show(`${silinen} fire kaydı silindi`)
  }
  async function del(r: any) {
    if (r.src === 'hat') return toast.show('Üretim hattı firesi buradan silinemez (üretim hareketi)', true)
    const f = r.ham
    const geri = (f.hammadde_id || f.variant_id) ? confirm('Fire kaydı silinecek.\n\nStoktan düşülen miktar geri eklensin mi?\n(Tamam = stoğa geri ekle, İptal = sadece kaydı sil)') : false
    if (!confirm('Fire kaydı silinsin mi?')) return
    if (geri) await erp.from('stok_hareketleri').insert({ tip: 'fire', yon: 'giris', ...(f.hammadde_id ? { hammadde_id: f.hammadde_id } : { variant_id: f.variant_id }), miktar: +f.miktar, kaynak_tablo: 'fire_kayitlari', kaynak_id: f.id, aciklama: 'Fire iptali' })
    const x: any = await erp.from('fire_kayitlari').delete().eq('id', f.id)
    if (x?.error) return toast.show(x.error, true)
    toast.show('Fire kaydı silindi'); setDetay(null); reload()
  }

  const cols: Col<any>[] = [
    { key: 'tarih', label: 'Tarih', width: 112, sort: r => r.tarih, render: r => <span style={{ whiteSpace: 'nowrap' }}>{fmtDate(r.tarih)}</span> },
    { key: 'src', label: 'Kaynak', width: 110, sort: r => r.src, render: r => <Badge tone={SRC[r.src].tone}>{SRC[r.src].l}</Badge> },
    { key: 'ad', label: 'Kalem', sort: r => r.ad, render: r => <div><div style={{ fontWeight: 600 }}>{r.ad}</div><div style={{ fontSize: 11, color: 'var(--adm-tx3)' }}>{emir[r.emir_id]?.no || ''}{r.makine_id ? ` · ${makine[r.makine_id]?.ad || ''}` : ''}</div></div> },
    { key: 'neden', label: 'Neden', sort: r => r.neden, render: r => r.neden, hideSm: true },
    { key: 'miktar', label: 'Miktar', align: 'right', sort: r => r.miktar, render: r => <b style={{ color: 'var(--adm-red)', fontFamily: 'JetBrains Mono,monospace' }}>{fmtN(r.miktar, r.birim === 'adet' ? 0 : 2)} {r.birim}</b>, csv: r => `${r.miktar} ${r.birim}` },
    { key: 'maliyet', label: 'Maliyet Etkisi', align: 'right', sort: r => r.maliyet, render: r => r.maliyet ? <Money v={r.maliyet} bold={false} /> : <span style={{ color: 'var(--adm-tx3)' }}>—</span>, total: rs => <Money v={sum(rs, (r: any) => r.maliyet)} tone="red" />, csv: r => r.maliyet },
    { key: 'act', label: '', width: 50, align: 'right', render: r => r.src !== 'hat' ? <button className="adm-btn-danger" style={{ padding: '4px 7px' }} onClick={ev => { ev.stopPropagation(); del(r) }}><Trash2 size={12} /></button> : null },
  ]

  useAcParam(!loading, id => { const r = satirlar.find((x: any) => x.id === 'f' + id); if (r) setDetay(r) })

  return (
    <div style={{ flex: 1, overflow: 'auto' }}>
      <AdminTopBar title="Fire Yönetimi" />
      <Page>
        <PageHead title="Fire Analizi" sub="Üretim hattı firesi, manuel fire ve kalite redleri tek yerde · hedef fire ile karşılaştırma" actions={<button className="adm-btn" onClick={openNew}><Plus size={14} />Fire Kaydı Ekle</button>} />

        <KpiGrid min={180}>
          <Kpi label="Hat Fire Oranı" value={`%${fmtN(oran, 2)}`} Icon={Percent} color={hedefOrt && oran > hedefOrt ? 'var(--adm-red)' : 'var(--adm-green)'} sub={hedefOrt ? `hedef %${fmtN(hedefOrt, 1)}` : `${fmtInt(hatFire)} / ${fmtInt(uretilen + hatFire)} adet`} />
          <Kpi label="Fire (adet)" value={fmtInt(adetFire)} Icon={Package} color="var(--adm-red)" sub={`${liste.filter(r => r.birim === 'adet').length} kayıt`} />
          <Kpi label="Hammadde Fire" value={hamFire.length ? hamFire.reduce((s, r) => s + r.miktar, 0).toLocaleString('tr-TR', { maximumFractionDigits: 1 }) : '0'} Icon={Boxes} color="var(--adm-amber)" sub={`${hamFire.length} kayıt (kg/birim)`} />
          <Kpi label="Maliyet Etkisi" value={fmtK(maliyet)} Icon={Coins} color="var(--adm-red)" sub="tahmini toplam" spark={aylikSeri} />
          <Kpi label="Hedefi Aşan Ürün" value={urunAnaliz.filter(x => x.hedef && x.gercek > x.hedef).length} Icon={Target} color="var(--adm-amber)" sub={`${urunAnaliz.length} üründe üretim var`} />
        </KpiGrid>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,420px),1fr))', gap: 16, marginBottom: 16 }}>
          <Card title="Aylık Fire Maliyeti (12 ay)" pad={16}><TrendChart type="bar" height={190} labels={aylar.map(a => a.label)} series={[{ name: 'Fire maliyeti', color: '#e14b4b', data: aylikSeri }]} /></Card>
          <Card title="Fire Nedenleri (adet)" pad={18}>{nedenAnaliz.length === 0 ? <Empty icon={<Flame size={28} />} title="Fire kaydı yok" /> : <BarList items={nedenAnaliz} format={n => `${fmtInt(n)} adet`} />}</Card>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,420px),1fr))', gap: 16, marginBottom: 16 }}>
          <Card title="Ürün — Gerçek vs Hedef Fire" pad={0}>
            {urunAnaliz.length === 0 ? <Empty title="Üretim verisi yok" /> : <table className="adm-tbl compact"><thead><tr><th>Ürün</th><th style={{ textAlign: 'right' }}>Üretilen</th><th style={{ textAlign: 'right' }}>Gerçek</th><th style={{ textAlign: 'right' }}>Hedef</th></tr></thead>
              <tbody>{urunAnaliz.slice(0, 8).map(x => <tr key={x.id}><td>{x.ad}</td><td style={{ textAlign: 'right' }}>{fmtInt(x.u)}</td><td style={{ textAlign: 'right' }}><Badge tone={x.hedef && x.gercek > x.hedef ? 'red' : 'green'}>%{fmtN(x.gercek, 1)}</Badge></td><td style={{ textAlign: 'right', color: 'var(--adm-tx3)' }}>{x.hedef ? `%${fmtN(x.hedef, 1)}` : '—'}</td></tr>)}</tbody></table>}
          </Card>
          <Card title="Makine Bazlı Fire Oranı" pad={18}>{makineAnaliz.length === 0 ? <Empty title="Makineli üretim verisi yok" /> : <BarList items={makineAnaliz} color="var(--adm-red)" format={n => `%${fmtN(n, 2)}`} />}</Card>
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 12, alignItems: 'center' }}>
          <Tabs value={tab} onChange={setTab} tabs={[{ v: 'hepsi', l: 'Tümü', n: satirlar.length }, ...Object.entries(SRC).map(([k, v]) => ({ v: k, l: v.l, n: satirlar.filter(r => r.src === k).length }))]} />
          <Tabs value={donem} onChange={setDonem} tabs={[{ v: 'tumu', l: 'Tümü' }, { v: 'ay', l: 'Bu ay' }, { v: '30', l: 'Son 30 gün' }]} />
          <select className="adm-sel" value={nedenF} onChange={e => setNedenF(e.target.value)}><option value="">Tüm nedenler</option>{nedenListesi.map(n => <option key={n}>{n}</option>)}</select>
        </div>

        <DataGrid rows={liste} cols={cols} rowKey={r => r.id} loading={loading} onBulkDelete={topluSil} deleteNoun="fire kaydı" deleteNote="Sadece fire kayıtları silinir; stoktan düşülen miktarlar stoğa geri eklenmez." csvName="fire" storageKey="fire" onRowClick={setDetay} activeKey={detay?.id}
          searchText={r => `${r.ad} ${r.neden} ${emir[r.emir_id]?.no || ''} ${makine[r.makine_id]?.ad || ''}`} searchPlaceholder="Kalem, neden, emir, makine..." emptyTitle="Fire kaydı yok" selectable
          bulkActions={sel => { const fr = sel.filter(r => r.src !== 'hat'); return <><button className="adm-btn-ghost" style={{ padding: '3px 12px', fontSize: 12 }} disabled={!fr.length} title={fr.length < sel.length ? 'Üretim hattı satırları hariç tutulur' : undefined} onClick={() => setToplu(fr.map(r => ({ id: r.ham.id })))}><ListChecks size={12} />Toplu düzenle ({fr.length})</button></> }} footerNote={<span>· Üretim hattı firesi Canlı Üretim / Emir ekranından girilen fire adetlerinden gelir</span>} />
      </Page>

      <Drawer open={!!detay} onClose={() => setDetay(null)} width={440} title={detay && <span style={{ display: 'flex', gap: 10, alignItems: 'center' }}>{detay.ad}<Badge tone={SRC[detay.src].tone}>{SRC[detay.src].l}</Badge></span>} sub={detay && fmtDateTime(detay.tarih)}
        footer={detay && detay.src !== 'hat' && <button className="adm-btn-danger" onClick={() => del(detay)}><Trash2 size={13} />Sil</button>}>
        {detay && <div style={{ padding: 20 }}>
          <div style={{ textAlign: 'center', padding: '6px 0 16px' }}><b style={{ fontSize: 28, color: 'var(--adm-red)', fontFamily: 'JetBrains Mono,monospace' }}>{fmtN(detay.miktar, detay.birim === 'adet' ? 0 : 2)} {detay.birim}</b></div>
          <InfoRow k="Neden" v={detay.neden} /><InfoRow k="Üretim emri" v={emir[detay.emir_id]?.no || '—'} /><InfoRow k="Makine" v={makine[detay.makine_id]?.ad || '—'} />
          <InfoRow k="Ürün" v={urun[detay.urun_id]?.name || '—'} /><InfoRow k="Maliyet etkisi" v={detay.maliyet ? fmt(detay.maliyet) : '—'} />
        </div>}
      </Drawer>

      <Modal open={modal} onClose={() => setModal(false)} onSubmit={save} width={600} title="Yeni Fire Kaydı"
        footer={<><button type="button" className="adm-btn-ghost" onClick={() => setModal(false)}>İptal</button><button type="submit" className="adm-btn" disabled={busy}>Kaydet</button></>}>
        <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>{[['hammadde', 'Hammadde firesi', Boxes], ['urun', 'Mamul (ürün) firesi', Package]].map(([k, l, I]: any) => <button type="button" key={k} onClick={() => setForm((f: any) => ({ ...f, tur: k, hammadde_id: '', variant_id: '' }))} className={form.tur === k ? 'adm-btn' : 'adm-btn-ghost'} style={{ flex: 1, justifyContent: 'center' }}><I size={14} />{l}</button>)}</div>
        <FormGrid>
          {form.tur === 'hammadde'
            ? <Field label="Hammadde *"><select className="adm-inp" value={form.hammadde_id} onChange={e => setForm((f: any) => ({ ...f, hammadde_id: e.target.value }))}><option value="">Seçin</option>{d.hammaddeler.map((h: any) => <option key={h.id} value={h.id}>{h.ad} ({fmtN(h.mevcut_stok, 1)} {h.birim})</option>)}</select></Field>
            : <Field label="Ürün varyantı *"><select className="adm-inp" value={form.variant_id} onChange={e => setForm((f: any) => ({ ...f, variant_id: e.target.value }))}><option value="">Seçin</option>{d.variants.map((v: any) => <option key={v.id} value={v.id}>{[urun[v.product_id]?.name, v.name].filter(Boolean).join(' · ')} (stok {v.stock})</option>)}</select></Field>}
          <Field label={`Miktar (${form.tur === 'hammadde' ? hamSec?.birim || 'kg' : 'adet'}) *`}><input type="number" step="0.001" min="0" className="adm-inp" required autoFocus value={form.miktar} onChange={e => setForm((f: any) => ({ ...f, miktar: e.target.value }))} style={{ fontWeight: 700 }} /></Field>
          <Field label="Fire nedeni *"><input className="adm-inp" required list="fire-n" value={form.fire_nedeni} onChange={e => setForm((f: any) => ({ ...f, fire_nedeni: e.target.value }))} /><datalist id="fire-n">{NEDENLER.map(n => <option key={n} value={n} />)}</datalist></Field>
          <Field label="Maliyet etkisi (₺)" hint={otoMaliyet ? `Otomatik hesap: ${fmt(otoMaliyet)}` : 'Boşsa otomatik hesaplanır'}><input type="number" step="0.01" min="0" className="adm-inp" value={form.maliyet} onChange={e => setForm((f: any) => ({ ...f, maliyet: e.target.value }))} placeholder={otoMaliyet ? otoMaliyet.toFixed(2) : ''} /></Field>
          <Field label="Üretim emri"><select className="adm-inp" value={form.uretim_emri_id} onChange={e => setForm((f: any) => ({ ...f, uretim_emri_id: e.target.value }))}><option value="">—</option>{d.emirler.slice(0, 60).map((e: any) => <option key={e.id} value={e.id}>{e.no} · {urun[e.urun_id]?.name}</option>)}</select></Field>
          <Field label="Makine"><select className="adm-inp" value={form.makine_id} onChange={e => setForm((f: any) => ({ ...f, makine_id: e.target.value }))}><option value="">{emir[form.uretim_emri_id]?.makine_id ? `Emirdeki: ${makine[emir[form.uretim_emri_id].makine_id]?.ad}` : '—'}</option>{d.makineler.map((m: any) => <option key={m.id} value={m.id}>{m.ad}</option>)}</select></Field>
          <label style={{ gridColumn: 'span 2', display: 'flex', gap: 8, alignItems: 'center', fontSize: 13 }}><input type="checkbox" checked={form.stok} onChange={e => setForm((f: any) => ({ ...f, stok: e.target.checked }))} />Stoktan da düş ({form.tur === 'hammadde' ? 'hammadde stoğu' : 'ürün stoğu'})</label>
        </FormGrid>
        <p style={{ fontSize: 11.5, color: 'var(--adm-tx3)', margin: '12px 0 0' }}>Üretim ekranında girilen fire zaten otomatik stoğa/reçeteye işlenir; buraya sadece üretim dışı firelerini (döküntü, depoda bozulma, kalite red vb.) gir.</p>
      </Modal>
      <TopluDuzenle rows={toplu} onClose={() => setToplu(null)} onDone={() => { setToplu(null); reload() }} client={erp as any} table="fire_kayitlari" fields={[
        { key: 'fire_nedeni', label: 'Fire nedeni', type: 'select', options: NEDENLER.map(n => ({ v: n, l: n })) },
        { key: 'uretim_emri_id', label: 'Üretim emri', type: 'select', bosYapilabilir: true, options: d.emirler.slice(0, 60).map((e: any) => ({ v: e.id, l: `${e.no} · ${urun[e.urun_id]?.name || ''}` })) },
        { key: 'makine_id', label: 'Makine', type: 'select', bosYapilabilir: true, options: d.makineler.map((m: any) => ({ v: m.id, l: m.ad })) },
        { key: 'maliyet_etkisi', label: 'Maliyet etkisi (₺)', type: 'number' },
      ]} />
      {toast.node}
    </div>
  )
}
