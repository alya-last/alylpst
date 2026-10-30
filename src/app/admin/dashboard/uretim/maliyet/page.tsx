'use client'
import { useCallback, useEffect, useMemo, useState } from 'react'
import AdminTopBar from '@/components/admin/TopBar'
import { erp } from '@/lib/erp-client'
import { fmt, fmtN } from '@/lib/fmt'
import { hesapla, hmTlKg, num, type MAyar, type MHammadde, type MMakine, type MUrun } from '@/lib/maliyet'
import { Page, PageHead, Kpi, KpiGrid, Badge, Tabs, Money, Drawer, Modal, Field, FormGrid, Divider, Card, useToast } from '@/components/admin/erp/ui'
import { DataGrid, type Col } from '@/components/admin/erp/DataGrid'
import { Calculator, Coins, TrendingUp, AlertTriangle, Plus, Pencil, Trash2, Info, Save, X } from 'lucide-react'

const AYAR0: MAyar = { kur_usd: 52, eur_parite: 1.1642, genel_gider_pct: 10, kdv_pct: 20, kdv_dahil: false }
const bosUrun = (): any => ({ kod: '', ad: '', litre: '', seri: '', parcalar: [{ ad: 'Gövde', gram: '', hm: 'moblen' }], baski: [{ ad: 'Gövde', goz: '1', cevrim: '', ton: '180 TON', coef: '1' }], ek_tl: '0', koli_tl: '0', etiket_tl: '0', liste_usd: '0' })

export default function MaliyetPage() {
  const toast = useToast()
  const [loading, setLoading] = useState(true)
  const [urunler, setUrunler] = useState<MUrun[]>([])
  const [hms, setHms] = useState<MHammadde[]>([])
  const [mks, setMks] = useState<MMakine[]>([])
  const [ayar, setAyar] = useState<MAyar>(AYAR0)
  const [tab, setTab] = useState('urunler')
  const [detay, setDetay] = useState<MUrun | null>(null)
  const [modal, setModal] = useState<any>(null) // { id?: string, f: form }
  const [busy, setBusy] = useState(false)
  const [rehberKod, setRehberKod] = useState('ALY-101')
  const [sadeceListesiz, setSadeceListesiz] = useState(false)
  const git = (t: string, id?: string) => { setTab(t); if (id) setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80) }

  const yukle = useCallback(async () => {
    const [u, h, m, a] = await Promise.all([
      erp.all('maliyet_urun', '*', (q: any) => q.order('sira', { ascending: true })).catch(() => []),
      erp.all('maliyet_hammadde', '*', (q: any) => q.order('sira', { ascending: true })).catch(() => []),
      erp.all('maliyet_makine', '*', (q: any) => q.order('sira', { ascending: true })).catch(() => []),
      erp.all('maliyet_ayar').catch(() => []),
    ])
    setUrunler(u as any); setHms(h as any); setMks(m as any)
    if (a[0]) setAyar({ kur_usd: num(a[0].kur_usd), eur_parite: num(a[0].eur_parite), genel_gider_pct: num(a[0].genel_gider_pct), kdv_pct: num(a[0].kdv_pct), kdv_dahil: !!a[0].kdv_dahil })
    setLoading(false)
  }, [])
  useEffect(() => { yukle() }, [yukle])

  const H = useMemo(() => Object.fromEntries(urunler.map(u => [u.id, hesapla(u, ayar, hms, mks)])), [urunler, ayar, hms, mks])
  const aktifler = urunler.filter(u => u.aktif)
  const marjli = aktifler.filter(u => H[u.id]?.kar !== null && H[u.id]?.kar !== undefined)
  const ortKar = marjli.length ? marjli.reduce((s, u) => s + (H[u.id].kar as number), 0) / marjli.length : 0
  const enDusuk = [...marjli].sort((a, b) => (H[a.id].kar as number) - (H[b.id].kar as number))[0]
  const listesiz = aktifler.filter(u => !num(u.liste_usd)).length

  /* ── Kayıt işlemleri ── */
  const formdan = (f: any) => ({
    kod: f.kod.trim(), ad: f.ad.trim(), litre: f.litre || null, seri: f.seri || null,
    parcalar: f.parcalar.filter((p: any) => p.ad && num(p.gram) > 0).map((p: any) => ({ ad: p.ad, gram: num(p.gram), hm: p.hm })),
    baski: f.baski.filter((b: any) => b.ad && (num(b.cevrim) > 0 || num(b.sabit_tl) > 0)).map((b: any) => ({ ad: b.ad, goz: num(b.goz) || 1, cevrim: num(b.cevrim), ton: b.ton, coef: num(b.coef) || 1, ...(num(b.saat) > 0 ? { saat: num(b.saat) } : {}), ...(num(b.sabit_tl) > 0 ? { sabit_tl: num(b.sabit_tl) } : {}) })),
    ek_tl: num(f.ek_tl), koli_tl: num(f.koli_tl), etiket_tl: num(f.etiket_tl), liste_usd: num(f.liste_usd),
    genel_gider_pct: f.gg === '' || f.gg === undefined || f.gg === null ? null : num(f.gg),
  })
  const acDuzenle = (u: MUrun) => setModal({ id: u.id, f: { kod: u.kod, ad: u.ad, litre: u.litre || '', seri: u.seri || '', parcalar: u.parcalar.map(p => ({ ...p, gram: String(p.gram) })), baski: u.baski.map(b => ({ ...b, goz: String(b.goz), cevrim: String(b.cevrim), coef: String(b.coef), saat: b.saat ? String(b.saat) : '', sabit_tl: b.sabit_tl ? String(b.sabit_tl) : '' })), ek_tl: String(u.ek_tl), koli_tl: String(u.koli_tl), etiket_tl: String(u.etiket_tl), liste_usd: String(u.liste_usd), gg: u.genel_gider_pct === null || u.genel_gider_pct === undefined ? '' : String(u.genel_gider_pct) } })
  async function kaydet(e: React.FormEvent) {
    e.preventDefault(); if (busy || !modal) return
    const p = formdan(modal.f)
    if (!p.kod || !p.ad) return toast.show('Kod ve ürün adı gerekli', true)
    if (!p.parcalar.length) return toast.show('En az bir parça (gram) girin', true)
    setBusy(true)
    const r: any = modal.id ? await erp.from('maliyet_urun').update({ ...p, updated_at: new Date().toISOString() }).eq('id', modal.id) : await erp.from('maliyet_urun').insert({ ...p, sira: urunler.length })
    setBusy(false)
    if (r?.error) return toast.show(String(r.error), true)
    toast.show(modal.id ? 'Ürün güncellendi' : 'Ürün eklendi'); setModal(null); setDetay(null); await yukle()
  }
  async function sil(u: MUrun) {
    if (!confirm(`${u.kod} ${u.ad} maliyet kaydı silinsin mi?`)) return
    const r: any = await erp.from('maliyet_urun').delete().eq('id', u.id)
    if (r?.error) return toast.show(String(r.error), true)
    toast.show('Silindi'); setDetay(null); yukle()
  }
  async function ayarKaydet() {
    setBusy(true)
    const r: any = await erp.from('maliyet_ayar').update({ ...ayar, updated_at: new Date().toISOString() }).eq('id', 1)
    setBusy(false)
    if (r?.error) return toast.show(String(r.error), true)
    toast.show('Ayarlar kaydedildi, tüm maliyetler yeniden hesaplandı')
  }
  async function hmKaydet(h: MHammadde) {
    const r: any = await erp.from('maliyet_hammadde').update({ usd_kg: h.usd_kg === null || (h.usd_kg as any) === '' ? null : num(h.usd_kg), ek_tl: num(h.ek_tl), sabit_tl_kg: h.sabit_tl_kg === null || (h.sabit_tl_kg as any) === '' ? null : num(h.sabit_tl_kg) }).eq('id', h.id)
    if (r?.error) return toast.show(String(r.error), true)
    toast.show(`${h.ad} fiyatı kaydedildi`); yukle()
  }
  async function mkKaydet(m: MMakine) {
    const r: any = await erp.from('maliyet_makine').update({ saat_ucreti: num(m.saat_ucreti) }).eq('id', m.id)
    if (r?.error) return toast.show(String(r.error), true)
    toast.show(`${m.ton} saat ücreti kaydedildi`); yukle()
  }

  /* ── Tablo ── */
  const renkKar = (k: number | null) => k === null ? 'var(--adm-tx3)' : k < 0.3 ? 'var(--adm-red)' : k < 0.6 ? 'var(--adm-amber)' : 'var(--adm-green)'
  const cols: Col<MUrun>[] = [
    { key: 'kod', label: 'Kod', width: 90, sort: u => u.kod, render: u => <b style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: 12 }}>{u.kod}</b> },
    { key: 'ad', label: 'Ürün', sort: u => u.ad, render: u => <div>{u.ad}{u.litre && <div style={{ fontSize: 11, color: 'var(--adm-tx3)' }}>{u.litre} lt</div>}</div>, csv: u => u.ad },
    { key: 'gram', label: 'Gram', align: 'right', hideSm: true, sort: u => H[u.id]?.gram, render: u => fmtN(H[u.id]?.gram, 0) },
    { key: 'ham', label: 'Hammadde', align: 'right', hideSm: true, sort: u => H[u.id]?.hammadde, render: u => fmtN(H[u.id]?.hammadde), csv: u => H[u.id]?.hammadde },
    { key: 'bas', label: 'Baskı', align: 'right', hideSm: true, sort: u => H[u.id]?.baski, render: u => fmtN(H[u.id]?.baski), csv: u => H[u.id]?.baski },
    { key: 'amb', label: 'Koli+Etiket', align: 'right', hideSm: true, sort: u => H[u.id]?.koli + H[u.id]?.etiket, render: u => fmtN(H[u.id]?.koli + H[u.id]?.etiket), csv: u => H[u.id]?.koli + H[u.id]?.etiket },
    { key: 'top', label: ayar.kdv_dahil ? 'Maliyet (KDV dahil)' : 'Maliyet (KDV hariç)', align: 'right', sort: u => H[u.id]?.toplam, render: u => <Money v={H[u.id]?.toplam} />, csv: u => H[u.id]?.toplam },
    { key: 'usd', label: 'USD Maliyet', align: 'right', sort: u => H[u.id]?.usd, render: u => <Money v={H[u.id]?.usd} cur="USD" bold={false} />, csv: u => H[u.id]?.usd },
    { key: 'liste', label: 'USD Liste', align: 'right', sort: u => num(u.liste_usd), render: u => num(u.liste_usd) ? <Money v={num(u.liste_usd)} cur="USD" bold={false} /> : <span style={{ color: 'var(--adm-amber)', fontSize: 11 }}>fiyat yok</span>, csv: u => u.liste_usd },
    { key: 'duz', label: '', width: 44, align: 'right', render: u => <button className="adm-btn-ghost" title="Düzenle" onClick={e => { e.stopPropagation(); acDuzenle(u) }}><Pencil size={12} /></button> },
    { key: 'kar', label: 'Kâr %', align: 'right', sort: u => H[u.id]?.kar ?? -999, render: u => H[u.id]?.kar === null ? '—' : <b style={{ color: renkKar(H[u.id].kar) }}>%{fmtN((H[u.id].kar as number) * 100, 0)}</b>, csv: u => H[u.id]?.kar },
  ]

  const dc = detay ? H[detay.id] : null
  const ornek = urunler.find(u => u.kod === rehberKod) || urunler[0]
  const oc = ornek ? H[ornek.id] : null

  return (
    <div style={{ flex: 1, overflow: 'auto' }}>
      <AdminTopBar title="Ürün Maliyeti" />
      <Page>
        <PageHead title="Ürün Maliyet Hesabı" sub="Hammadde + baskı + ambalaj + genel gider → TL, USD ve EUR maliyet ile kâr"
          actions={<><button className="adm-btn-ghost" onClick={() => setTab('kilavuz')}><Info size={14} />Nasıl kullanılır?</button><button className="adm-btn-ghost" onClick={() => setTab('rehber')}><Calculator size={14} />Nasıl hesaplanır?</button><button className="adm-btn" onClick={() => setModal({ f: bosUrun() })}><Plus size={14} />Ürün Ekle</button></>} />
        <KpiGrid min={190}>
          <Kpi label="Ürün" value={aktifler.length} Icon={Calculator} color="var(--adm-ac)" sub={listesiz ? `${listesiz} ürünün USD liste fiyatı yok` : 'tümünün liste fiyatı var'} />
          <Kpi label="Ortalama Kâr" value={`%${fmtN(ortKar * 100, 0)}`} Icon={TrendingUp} color="var(--adm-green)" sub="maliyet üzerine, USD liste fiyatına göre" />
          <Kpi label="En Düşük Kâr" value={enDusuk ? `%${fmtN((H[enDusuk.id].kar as number) * 100, 0)}` : '—'} Icon={AlertTriangle} color="var(--adm-amber)" sub={enDusuk ? `${enDusuk.kod} ${enDusuk.ad}` : ''} />
          <Kpi label="Kur / Genel Gider" value={`${fmtN(ayar.kur_usd)} ₺`} Icon={Coins} color="var(--adm-blue)" sub={`1 USD · genel gider %${fmtN(ayar.genel_gider_pct, 0)} · ${ayar.kdv_dahil ? 'KDV dahil' : 'KDV hariç'}`} />
        </KpiGrid>
        <div style={{ margin: '0 0 12px' }}><Tabs value={tab} onChange={setTab} tabs={[{ v: 'urunler', l: 'Ürün Maliyetleri', n: urunler.length }, { v: 'ayarlar', l: 'Kur · Hammadde · Makine' }, { v: 'kilavuz', l: 'Adım Adım Kullanım' }, { v: 'rehber', l: 'Nasıl Hesaplanır?' }]} /></div>

        {tab === 'urunler' && <>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', padding: '10px 14px', borderRadius: 10, border: '1px solid var(--adm-bd)', marginBottom: 12 }}>
            <b style={{ fontSize: 12.5, marginRight: 4 }}>Hızlı işlemler</b>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5 }}>USD kuru ₺
              <input className="adm-inp" style={{ width: 90 }} type="number" step="0.01" value={ayar.kur_usd} onChange={e => setAyar({ ...ayar, kur_usd: +e.target.value })} /></label>
            <button className="adm-btn" onClick={ayarKaydet} disabled={busy}><Save size={13} />Kuru kaydet</button>
            <button className="adm-btn-ghost" onClick={() => git('ayarlar', 'kart-hm')}>Hammadde fiyatı</button>
            <button className="adm-btn-ghost" onClick={() => git('ayarlar', 'kart-mk')}>Makine saat ücreti</button>
            <button className="adm-btn-ghost" onClick={() => git('ayarlar', 'kart-genel')}>Genel gider / KDV</button>
            <button className={sadeceListesiz ? 'adm-btn' : 'adm-btn-ghost'} onClick={() => setSadeceListesiz(v => !v)}><AlertTriangle size={13} />Liste fiyatı olmayanlar ({listesiz})</button>
            <button className="adm-btn-ghost" onClick={() => setModal({ f: bosUrun() })}><Plus size={13} />Ürün ekle</button>
          </div>
          <div style={{ padding: '10px 14px', borderRadius: 10, background: 'var(--adm-s2)', fontSize: 12.5, color: 'var(--adm-tx2)', marginBottom: 12, lineHeight: 1.6 }}>
            Tüm tutarlar <b>1 adet ürün</b> içindir. Bir satıra tıklayınca hesap adım adım görünür. Kur, hammadde fiyatı veya makine saat ücreti değişince <b>tüm ürünler otomatik yeniden hesaplanır</b> (Kur · Hammadde · Makine sekmesi).
            <button onClick={() => setTab('rehber')} style={{ background: 'none', border: 'none', color: 'var(--adm-ac)', fontWeight: 600, cursor: 'pointer', marginLeft: 6 }}>Hesap mantığını oku →</button>
          </div>
          <DataGrid rows={sadeceListesiz ? urunler.filter(u => !num(u.liste_usd)) : urunler} cols={cols} rowKey={u => u.id} loading={loading} onRowClick={u => setDetay(u)} activeKey={detay?.id} csvName="urun-maliyet" storageKey="maliyet-urunler"
            searchText={u => `${u.kod} ${u.ad} ${u.seri || ''}`} searchPlaceholder="Kod veya ürün ara..." emptyTitle="Maliyet kaydı yok" emptySub="Ürün Ekle ile gramaj, kalıp ve çevrim bilgilerini gir." />
        </>}

        {tab === 'ayarlar' && <div style={{ display: 'grid', gap: 16 }}>
          <div id="kart-genel"></div><Card title="Genel ayarlar" pad="14px 16px" right={<button className="adm-btn" onClick={ayarKaydet} disabled={busy}><Save size={13} />Kaydet</button>}>
            <FormGrid cols={3}>
              <Field label="USD kuru (₺)" hint="Hammadde USD fiyatını TL'ye ve ürün maliyetini USD'ye çevirirken kullanılır. İstediğin zaman elle değiştir.">
                <input className="adm-inp" type="number" step="0.01" value={ayar.kur_usd} onChange={e => setAyar({ ...ayar, kur_usd: +e.target.value })} /></Field>
              <Field label="EUR paritesi (EUR/USD)" hint="EUR maliyet = USD maliyet ÷ bu değer.">
                <input className="adm-inp" type="number" step="0.0001" value={ayar.eur_parite} onChange={e => setAyar({ ...ayar, eur_parite: +e.target.value })} /></Field>
              <Field label="Genel gider / şirket masrafı (%)" hint="Üretim maliyetinin üzerine eklenir.">
                <input className="adm-inp" type="number" step="0.1" value={ayar.genel_gider_pct} onChange={e => setAyar({ ...ayar, genel_gider_pct: +e.target.value })} /></Field>
              <Field label="KDV (%)">
                <input className="adm-inp" type="number" step="1" value={ayar.kdv_pct} onChange={e => setAyar({ ...ayar, kdv_pct: +e.target.value })} /></Field>
              <Field label="KDV maliyete dahil edilsin mi?" span={2} hint="Kapalı (önerilen): KDV indirilebilir bir vergidir, gerçek maliyet değildir; ihracat fiyatı da KDV'sizdir. Açık: Excel'deki eski mantık, maliyet %20 yüksek çıkar ve kâr olduğundan düşük görünür.">
                <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, paddingTop: 6 }}><input type="checkbox" checked={ayar.kdv_dahil} onChange={e => setAyar({ ...ayar, kdv_dahil: e.target.checked })} />KDV dahil hesapla</label></Field>
            </FormGrid>
          </Card>
          <div id="kart-hm"></div><Card title="Hammadde fiyatları" pad="14px 16px" right={<span style={{ fontSize: 12, color: 'var(--adm-tx3)' }}>TL/kg = USD/kg × kur + ek</span>}>
            <table className="adm-tbl" style={{ width: '100%' }}><thead><tr><th>Hammadde</th><th style={{ textAlign: 'right' }}>USD / kg</th><th style={{ textAlign: 'right' }}>Ek TL/kg</th><th style={{ textAlign: 'right' }}>Sabit TL/kg</th><th style={{ textAlign: 'right' }}>Güncel TL/kg</th><th /></tr></thead><tbody>
              {hms.map((h, i) => <tr key={h.kod}><td><b>{h.ad}</b></td>
                <td style={{ textAlign: 'right' }}><input className="adm-inp" style={{ width: 90, textAlign: 'right' }} type="number" step="0.01" value={h.usd_kg ?? ''} placeholder="—" onChange={e => setHms(hms.map((x, j) => j === i ? { ...x, usd_kg: e.target.value === '' ? null : +e.target.value } : x))} /></td>
                <td style={{ textAlign: 'right' }}><input className="adm-inp" style={{ width: 80, textAlign: 'right' }} type="number" step="0.01" value={h.ek_tl} onChange={e => setHms(hms.map((x, j) => j === i ? { ...x, ek_tl: +e.target.value } : x))} /></td>
                <td style={{ textAlign: 'right' }}><input className="adm-inp" style={{ width: 90, textAlign: 'right' }} type="number" step="0.01" value={h.sabit_tl_kg ?? ''} placeholder="—" onChange={e => setHms(hms.map((x, j) => j === i ? { ...x, sabit_tl_kg: e.target.value === '' ? null : +e.target.value } : x))} /></td>
                <td style={{ textAlign: 'right' }}><Money v={hmTlKg(h, ayar.kur_usd)} /></td>
                <td style={{ textAlign: 'right' }}><button className="adm-btn-ghost" onClick={() => hmKaydet(h)}><Save size={12} />Kaydet</button></td></tr>)}
            </tbody></table>
            <p style={{ fontSize: 11.5, color: 'var(--adm-tx3)', margin: '10px 0 0' }}>USD/kg doluysa TL fiyat kurdan hesaplanır, boşsa "Sabit TL/kg" kullanılır (ör. geri dönüşüm granür). Fiyatı değiştirip Kaydet'e basınca tüm ürünler güncellenir.</p>
          </Card>
          <div id="kart-mk"></div><Card title="Makine saat ücretleri" pad="14px 16px">
            <table className="adm-tbl" style={{ width: '100%' }}><thead><tr><th>Makine</th><th style={{ textAlign: 'right' }}>Saat ücreti (₺/saat)</th><th /></tr></thead><tbody>
              {mks.map((m, i) => <tr key={m.ton}><td><b>{m.ton}</b></td>
                <td style={{ textAlign: 'right' }}><input className="adm-inp" style={{ width: 110, textAlign: 'right' }} type="number" step="50" value={m.saat_ucreti} onChange={e => setMks(mks.map((x, j) => j === i ? { ...x, saat_ucreti: +e.target.value } : x))} /></td>
                <td style={{ textAlign: 'right' }}><button className="adm-btn-ghost" onClick={() => mkKaydet(m)}><Save size={12} />Kaydet</button></td></tr>)}
            </tbody></table>
            <p style={{ fontSize: 11.5, color: 'var(--adm-tx3)', margin: '10px 0 0' }}>Saat ücreti; elektrik, işçilik, makine amortismanı gibi enjeksiyon makinesinin bir saatlik toplam maliyetidir.</p>
          </Card>
        </div>}

        {tab === 'kilavuz' && <div style={{ display: 'grid', gap: 16, maxWidth: 980 }}>
          <Card title="Paneli hiç bilmiyorum, nereden başlayayım?" pad="14px 16px">
            <p style={P}>Bu sayfa her ürünün <b>1 adetinin şirkete kaça mal olduğunu</b> ve satış fiyatına göre <b>ne kadar kâr bıraktığını</b> gösterir. Aşağıda en sık yapılan işler var. Her adımın yanındaki düğme sizi doğru yere götürür. Hiçbir şeyi bozmazsınız: değişiklikler "Kaydet"e basana kadar uygulanmaz ve tüm maliyetler otomatik yeniden hesaplanır.</p>
          </Card>
          <Card title="1) Dolar kuru değişti" pad="14px 16px">
            <ol style={{ ...P, paddingLeft: 20, margin: 0 }}>
              <li>"Ürün Maliyetleri" sekmesinin en üstündeki <b>Hızlı işlemler</b> çubuğunda <b>USD kuru</b> kutusuna yeni kuru yazın (örn. 54,50).</li>
              <li><b>Kuru kaydet</b> düğmesine basın.</li>
              <li>Tüm ürünlerin USD maliyeti ve kâr yüzdesi hemen güncellenir. Yukarıdaki "Kur / Genel Gider" kartından da kontrol edebilirsiniz.</li>
            </ol>
            <div style={{ marginTop: 10 }}><button className="adm-btn-ghost" onClick={() => git('urunler')}>Ürünler sayfasına git</button></div>
          </Card>
          <Card title="2) Hammadde (granür, moblen, kopolimer…) fiyatı değişti" pad="14px 16px">
            <ol style={{ ...P, paddingLeft: 20, margin: 0 }}>
              <li>"Kur · Hammadde · Makine" sekmesinde <b>Hammadde fiyatları</b> tablosunu açın.</li>
              <li>Fiyat <b>dolarla</b> alınıyorsa "USD/kg" kutusuna yeni fiyatı yazın. <b>Liraysa</b> "Sabit TL/kg" kutusuna yazın (ikisinden yalnızca biri dolu olsun).</li>
              <li>O satırın yanındaki <b>Kaydet</b>'e basın. O hammaddeyi kullanan tüm ürünler güncellenir.</li>
            </ol>
            <div style={{ marginTop: 10 }}><button className="adm-btn-ghost" onClick={() => git('ayarlar', 'kart-hm')}>Hammadde fiyatlarına git</button></div>
          </Card>
          <Card title="3) Makinenin saat ücreti değişti" pad="14px 16px">
            <ol style={{ ...P, paddingLeft: 20, margin: 0 }}>
              <li>"Kur · Hammadde · Makine" sekmesinde <b>Makine saat ücretleri</b> tablosuna gidin.</li>
              <li>İlgili makinenin (örn. 220 TON) yeni TL/saat değerini yazıp <b>Kaydet</b>'e basın.</li>
            </ol>
            <div style={{ marginTop: 10 }}><button className="adm-btn-ghost" onClick={() => git('ayarlar', 'kart-mk')}>Makine ücretlerine git</button></div>
          </Card>
          <Card title="4) Bir ürünün gramı, çevrim süresi, koli veya satış fiyatı değişti" pad="14px 16px">
            <ol style={{ ...P, paddingLeft: 20, margin: 0 }}>
              <li>"Ürün Maliyetleri" sekmesinde ürünü arayın (kod veya ad yazın).</li>
              <li>Satırın sağındaki <b>kalem simgesine</b> basın (ya da satıra tıklayıp <b>Düzenle</b>).</li>
              <li><b>Gram:</b> her parçanın (gövde, kapak, tabak…) gramı. <b>Çevrim (sn):</b> makinenin bir baskıyı kaç saniyede yaptığı. <b>Göz:</b> kalıptan bir baskıda kaç parça çıktığı. <b>Koli / etiket:</b> ürün başına TL. <b>Liste fiyatı:</b> USD satış fiyatı.</li>
              <li><b>Kaydet</b>'e basın. Sonucu ürüne tıklayarak adım adım görebilirsiniz.</li>
            </ol>
          </Card>
          <Card title="5) Satış fiyatı girilmemiş ürünleri bulmak" pad="14px 16px">
            <p style={P}>Hızlı işlemler çubuğundaki <b>Liste fiyatı olmayanlar</b> düğmesine basın; yalnızca fiyatsız ürünler görünür. Her birinde kalem simgesiyle <b>Liste fiyatı (USD)</b> alanını doldurun. Fiyat girilmeyen üründe kâr yüzdesi hesaplanamaz.</p>
          </Card>
          <Card title="6) Yeni ürün eklemek" pad="14px 16px">
            <ol style={{ ...P, paddingLeft: 20, margin: 0 }}>
              <li>Sağ üstteki veya Hızlı işlemler'deki <b>Ürün ekle</b>'ye basın.</li>
              <li>Kod ve adı yazın. <b>Parçalar</b> bölümüne her parçanın gramını ve hammaddesini girin.</li>
              <li><b>Baskı</b> bölümüne makineyi (ton), çevrim süresini ve göz sayısını girin; koli, etiket ve liste fiyatını ekleyip kaydedin.</li>
            </ol>
          </Card>
          <Card title="7) Sonucu nasıl okurum?" pad="14px 16px">
            <ul style={{ ...P, paddingLeft: 20, margin: 0 }}>
              <li><b>USD Maliyet:</b> ürünün 1 adedinin dolar maliyeti. <b>USD Liste:</b> satış fiyatımız.</li>
              <li><b>Kâr %:</b> maliyetin üzerine yüzde kaç kazandığımız. <b style={{ color: 'var(--adm-red)' }}>%30 altı kırmızı</b> (fiyat gözden geçirilmeli), <b style={{ color: 'var(--adm-amber)' }}>%30–60 sarı</b>, <b style={{ color: 'var(--adm-green)' }}>%60 üstü yeşil</b>.</li>
              <li>Bir satıra tıklayınca maliyetin hangi kalemlerden (hammadde, baskı, ambalaj, genel gider) oluştuğu adım adım görünür.</li>
              <li>Formülün tamamı için <button onClick={() => setTab('rehber')} style={{ background: 'none', border: 'none', color: 'var(--adm-ac)', fontWeight: 600, cursor: 'pointer', padding: 0 }}>Nasıl Hesaplanır?</button> sekmesine bakın.</li>
            </ul>
          </Card>
          <Card title="Yapay zekâya sorabilirsiniz" pad="14px 16px">
            <p style={P}>Panelin yapay zekâ asistanına ürün adını söyleyerek maliyeti sorabilirsiniz: "ALY-512 maliyeti ne?", "Kur 55 olursa kârım ne olur?", "Granür %10 zamlanırsa hangi ürünler etkilenir?", "En az kârlı 5 ürün hangisi?". Yazarak ya da konuşarak sorabilirsiniz. Asistan değişiklik kaydetmez, yalnızca hesaplar ve önerir.</p>
          </Card>
        </div>}

        {tab === 'rehber' && <div style={{ display: 'grid', gap: 16, maxWidth: 980 }}>
          <Card title="Bu sayfa ne işe yarar?" pad="14px 16px">
            <p style={P}>Bir ürünü <b>1 adet</b> üretip kutulayana kadar şirkete kaç liraya mal olduğunu hesaplar. Sonra bunu USD ve EUR'a çevirir ve <b>USD liste fiyatıyla</b> karşılaştırıp kârı gösterir. Excel'deki "ÜRÜN MALİYET 2026 Ocak–Eylül" tablosunun aynı hesabıdır; 92 üründen 88'i Excel ile kuruşu kuruşuna aynı çıkar. Kalan 4 ürün (ALY-20/01–04) Excel'in %10 genel gideri iki kez eklemesinden farklıdır; panel doğrusunu hesaplar.</p>
          </Card>
          <Card title="Maliyet 4 kalemden oluşur" pad="14px 16px">
            <div style={{ display: 'grid', gap: 12 }}>
              <Adim n="1" t="Hammadde" f="gram × hammadde TL/kg ÷ 1000">Ürünün plastik ağırlığı (gram) ile kullanılan hammaddenin kilo fiyatı çarpılır. Birden çok parça varsa (dış, iç, ayak, tabak, kapak) her parça kendi hammaddesiyle ayrı hesaplanıp toplanır. Hammadde USD ile alınıyorsa TL/kg = USD/kg × kur + ek (nakliye/vergi).</Adim>
              <Adim n="2" t="Baskı (enjeksiyon)" f="makine saat ücreti × çevrim sn ÷ 3600 ÷ kalıp göz sayısı">Plastik makinede basılır. Makinenin saatlik ücreti, tek baskının süresiyle (çevrim, saniye) çarpılır; bir baskıda kalıptan kaç parça çıkıyorsa (göz sayısı) o kadara bölünür. Örn. 2000 ₺/saat makine, 17 sn çevrim, 2 gözlü kalıp → 2000 × 17 ÷ 3600 ÷ 2 = 4,72 ₺/adet. Ayak gibi küçük parçalar bir ürüne birden çok kez girer: <b>katsayı</b> bunu belirtir (4 ayak → katsayı 4).</Adim>
              <Adim n="3" t="Ambalaj" f="koli + etiket">Ürün başına düşen koli ve etiket gideri (TL). Koli maliyetinin koli içindeki adede bölünmüş halidir.</Adim>
              <Adim n="4" t="Genel gider" f="(hammadde + baskı + ambalaj) × genel gider %">Şirket masrafları (kira, ofis, yönetim vb.) için üretim maliyetinin üzerine yüzde olarak eklenir (Ayarlar'da, şu an %{fmtN(ayar.genel_gider_pct, 0)}).</Adim>
            </div>
          </Card>
          <Card title="Sonra: USD, EUR ve kâr" pad="14px 16px">
            <ul style={{ ...P, paddingLeft: 18, margin: 0 }}>
              <li><b>Toplam maliyet (TL)</b> = üretim maliyeti + genel gider. KDV ayarı kapalıysa KDV eklenmez (önerilen).</li>
              <li><b>USD maliyet</b> = toplam TL ÷ USD kuru. <b>EUR maliyet</b> = USD ÷ EUR paritesi.</li>
              <li><b>Kâr %</b> = (USD liste fiyatı − USD maliyet) ÷ USD maliyet. Yani "maliyetin üzerine yüzde kaç kazanıyoruz". Excel'deki "KAR" sütunuyla aynıdır.</li>
              <li><b>Marj %</b> (detayda) = (liste − maliyet) ÷ liste. Yani "satış fiyatının yüzde kaçı kâr".</li>
              <li>Kâr rengi: <b style={{ color: 'var(--adm-red)' }}>%30'un altı kırmızı</b>, <b style={{ color: 'var(--adm-amber)' }}>%30–60 sarı</b>, <b style={{ color: 'var(--adm-green)' }}>%60 üstü yeşil</b>.</li>
            </ul>
          </Card>
          <Card title="Canlı örnek" pad="14px 16px" right={<select className="adm-inp" style={{ width: 260 }} value={ornek?.kod || ''} onChange={e => setRehberKod(e.target.value)}>{urunler.map(u => <option key={u.id} value={u.kod}>{u.kod} · {u.ad}</option>)}</select>}>
            {ornek && oc ? <Dokum u={ornek} c={oc} ayar={ayar} /> : <p style={P}>Ürün yok.</p>}
          </Card>
          <Card title="Neyi nerede değiştiririm?" pad="14px 16px">
            <ul style={{ ...P, paddingLeft: 18, margin: 0 }}>
              <li><b>Kur, genel gider, KDV:</b> Kur · Hammadde · Makine sekmesi → Genel ayarlar.</li>
              <li><b>Hammadde fiyatı değişti:</b> aynı sekmede Hammadde fiyatları → Kaydet. Tüm ürünler güncellenir.</li>
              <li><b>Makine saat ücreti değişti:</b> aynı sekmede Makine saat ücretleri.</li>
              <li><b>Bir ürünün gramı, çevrimi, kalıp gözü, koli/etiketi veya liste fiyatı:</b> ürüne tıkla → Düzenle.</li>
              <li><b>Yeni ürün:</b> sağ üstte Ürün Ekle. Gram, parçalar ve baskı bilgilerini gir; hesap otomatik yapılır.</li>
              <li><b>Not:</b> Excel'deki bazı ürünlerde toplam gram, parçaların toplamından farklı yazılmış (ör. ALY-512'de 1 gr). Burada parçaların toplamı esas alınır; fark çok küçüktür.</li>
            </ul>
          </Card>
        </div>}
      </Page>

      <Drawer open={!!detay} onClose={() => setDetay(null)} width={620}
        title={detay && <span>{detay.kod} · {detay.ad}</span>}
        sub={detay && `${detay.litre ? detay.litre + ' lt · ' : ''}${fmtN(dc?.gram || 0, 0)} gr`}
        footer={detay && <><button className="adm-btn-danger" onClick={() => sil(detay)}><Trash2 size={13} /></button><button className="adm-btn" onClick={() => acDuzenle(detay)}><Pencil size={13} />Düzenle</button></>}>
        {detay && dc && <div style={{ padding: 20 }}>
          <Dokum u={detay} c={dc} ayar={ayar} />
          {detay.excel_maliyet_tl !== null && Math.abs(num(detay.excel_maliyet_tl) - dc.maliyet) > 0.01 && <p style={{ fontSize: 11.5, color: 'var(--adm-amber)', margin: '12px 0 0' }}>Excel'de aynı ürün için üretim maliyeti {fmt(num(detay.excel_maliyet_tl))} idi; kur/fiyat/ayar değişmiş olabilir.</p>}
        </div>}
      </Drawer>

      <Modal open={!!modal} onClose={() => setModal(null)} width={760} title={modal?.id ? 'Ürün maliyetini düzenle' : 'Yeni ürün maliyeti'} onSubmit={kaydet}
        footer={<><button type="button" className="adm-btn-ghost" onClick={() => setModal(null)}>Vazgeç</button><button className="adm-btn" disabled={busy}>{busy ? 'Kaydediliyor…' : 'Kaydet'}</button></>}>
        {modal && <MForm f={modal.f} set={(f: any) => setModal({ ...modal, f })} hms={hms} mks={mks} />}
      </Modal>
      {toast.node}
    </div>
  )
}

const P: React.CSSProperties = { fontSize: 13, lineHeight: 1.7, color: 'var(--adm-tx2)', margin: 0 }

function Adim({ n, t, f, children }: { n: string; t: string; f: string; children: React.ReactNode }) {
  return <div style={{ display: 'flex', gap: 12 }}>
    <div style={{ width: 28, height: 28, borderRadius: 8, background: 'var(--adm-ac2)', color: 'var(--adm-ac)', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{n}</div>
    <div><div style={{ fontWeight: 700, fontSize: 13.5 }}>{t}</div>
      <code style={{ fontSize: 12, background: 'var(--adm-s2)', padding: '2px 8px', borderRadius: 6, display: 'inline-block', margin: '4px 0' }}>{f}</code>
      <p style={P}>{children}</p></div>
  </div>
}

/** Hesap dökümü: her satır formülüyle birlikte, alt toplamlar ve sonuç. */
function Dokum({ u, c, ayar }: { u: MUrun; c: ReturnType<typeof hesapla>; ayar: MAyar }) {
  const gruplar = ['Hammadde', 'Baskı', 'Ambalaj']
  const toplamlar: Record<string, number> = { Hammadde: c.hammadde, Baskı: c.baski, Ambalaj: c.koli + c.etiket }
  return <div>
    {gruplar.map(g => <div key={g}>
      <Divider label={g} />
      {c.satirlar.filter(s => s.grup === g).map((s, i) => <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '6px 0', fontSize: 12.5, borderBottom: '1px dashed var(--adm-bdr)' }}>
        <div><div>{s.ad}</div><div style={{ fontSize: 11, color: 'var(--adm-tx3)', fontFamily: 'JetBrains Mono,monospace' }}>{s.formul}</div></div>
        <span style={{ fontFamily: 'JetBrains Mono,monospace', whiteSpace: 'nowrap' }}>{fmtN(s.tl, 3)} ₺</span></div>)}
      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 12.5, fontWeight: 700 }}><span>{g} toplamı</span><span style={{ fontFamily: 'JetBrains Mono,monospace' }}>{fmtN(toplamlar[g], 3)} ₺</span></div>
    </div>)}
    <Divider label="Sonuç" />
    <div style={{ display: 'grid', gap: 2, fontSize: 13 }}>
      <Satir k="Üretim maliyeti (hammadde + baskı + ambalaj)" v={fmt(c.maliyet)} />
      <Satir k={`+ Genel gider %${fmtN(ayar.genel_gider_pct, 0)}`} v={fmt(c.genelGider)} />
      <Satir k="= KDV hariç maliyet" v={fmt(c.kdvHaric)} b />
      <Satir k={`KDV %${fmtN(ayar.kdv_pct, 0)} ${ayar.kdv_dahil ? '(maliyete dahil)' : '(maliyete dahil değil, bilgi)'}`} v={fmt(c.kdv)} muted={!ayar.kdv_dahil} />
      <Satir k={`Toplam maliyet ${ayar.kdv_dahil ? '(KDV dahil)' : '(KDV hariç)'}`} v={fmt(c.toplam)} b />
      <Satir k={`USD maliyet (÷ ${fmtN(ayar.kur_usd)})`} v={fmt(c.usd, 'USD')} b />
      <Satir k={`EUR maliyet (÷ ${fmtN(ayar.eur_parite, 4)})`} v={fmt(c.eur, 'EUR')} />
      <Satir k="USD liste fiyatı" v={c.liste ? fmt(c.liste, 'USD') : 'girilmemiş'} />
      <Satir k="Kâr (maliyet üzerine)" v={c.kar === null ? '—' : `%${fmtN(c.kar * 100, 1)}`} b />
      <Satir k="Marj (satış fiyatı üzerinden)" v={c.marj === null ? '—' : `%${fmtN(c.marj * 100, 1)}`} />
    </div>
  </div>
}
const Satir = ({ k, v, b, muted }: { k: string; v: string; b?: boolean; muted?: boolean }) =>
  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', fontWeight: b ? 700 : 500, color: muted ? 'var(--adm-tx3)' : undefined }}><span>{k}</span><span style={{ fontFamily: 'JetBrains Mono,monospace' }}>{v}</span></div>

function MForm({ f, set, hms, mks }: { f: any; set: (f: any) => void; hms: MHammadde[]; mks: MMakine[] }) {
  const up = (k: string, v: any) => set({ ...f, [k]: v })
  const arr = (k: 'parcalar' | 'baski', i: number, p: any) => up(k, f[k].map((x: any, j: number) => j === i ? { ...x, ...p } : x))
  const mini: React.CSSProperties = { padding: '6px 8px', fontSize: 12.5 }
  return <div>
    <FormGrid cols={3}>
      <Field label="Ürün kodu"><input className="adm-inp" value={f.kod} onChange={e => up('kod', e.target.value)} placeholder="ALY-101" /></Field>
      <Field label="Ürün adı" span={2}><input className="adm-inp" value={f.ad} onChange={e => up('ad', e.target.value)} /></Field>
      <Field label="Hacim (lt)"><input className="adm-inp" value={f.litre} onChange={e => up('litre', e.target.value)} /></Field>
      <Field label="Seri"><input className="adm-inp" value={f.seri} onChange={e => up('seri', e.target.value)} /></Field>
      <Field label="USD liste fiyatı"><input className="adm-inp" type="number" step="0.01" value={f.liste_usd} onChange={e => up('liste_usd', e.target.value)} /></Field>
      <Field label="Genel gider % (özel)" hint="Boşsa genel ayardaki oran kullanılır. Örn. Efes gövdesi için 20."><input className="adm-inp" type="number" step="0.1" value={f.gg ?? ''} placeholder="genel" onChange={e => up('gg', e.target.value)} /></Field>
    </FormGrid>
    <Divider label="Parçalar ve hammadde (gram)" />
    {f.parcalar.map((p: any, i: number) => <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 100px 1fr 28px', gap: 8, marginBottom: 6 }}>
      <input className="adm-inp" style={mini} value={p.ad} placeholder="Parça (Gövde, İç, Ayak…)" onChange={e => arr('parcalar', i, { ad: e.target.value })} />
      <input className="adm-inp" style={mini} type="number" step="0.1" value={p.gram} placeholder="gram" onChange={e => arr('parcalar', i, { gram: e.target.value })} />
      <select className="adm-inp" style={mini} value={p.hm} onChange={e => arr('parcalar', i, { hm: e.target.value })}>{hms.map(h => <option key={h.kod} value={h.kod}>{h.ad}</option>)}</select>
      <button type="button" onClick={() => up('parcalar', f.parcalar.filter((_: any, j: number) => j !== i))} style={{ background: 'none', border: 'none', color: 'var(--adm-tx3)' }}><X size={15} /></button></div>)}
    <button type="button" className="adm-btn-ghost" style={{ fontSize: 12 }} onClick={() => up('parcalar', [...f.parcalar, { ad: '', gram: '', hm: 'moblen' }])}><Plus size={12} />Parça ekle</button>
    <Divider label="Baskı (kalıp ve makine)" />
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 70px 80px 110px 70px 90px 90px 28px', gap: 8, fontSize: 10.5, color: 'var(--adm-tx3)', marginBottom: 4 }}><span>Kalıp / parça</span><span>Göz</span><span>Çevrim sn</span><span>Makine</span><span>Katsayı</span><span>Özel ₺/saat</span><span>Sabit ₺</span><span /></div>
    {f.baski.map((b: any, i: number) => <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 70px 80px 110px 70px 90px 90px 28px', gap: 8, marginBottom: 6 }}>
      <input className="adm-inp" style={mini} value={b.ad} onChange={e => arr('baski', i, { ad: e.target.value })} />
      <input className="adm-inp" style={mini} type="number" value={b.goz} onChange={e => arr('baski', i, { goz: e.target.value })} />
      <input className="adm-inp" style={mini} type="number" step="0.5" value={b.cevrim} onChange={e => arr('baski', i, { cevrim: e.target.value })} />
      <select className="adm-inp" style={mini} value={b.ton} onChange={e => arr('baski', i, { ton: e.target.value })}>{mks.map(m => <option key={m.ton} value={m.ton}>{m.ton}</option>)}</select>
      <input className="adm-inp" style={mini} type="number" step="0.25" value={b.coef} onChange={e => arr('baski', i, { coef: e.target.value })} />
      <input className="adm-inp" style={mini} type="number" step="50" value={b.saat ?? ''} placeholder="genel" title="Boş bırakırsan makinenin genel saat ücreti kullanılır" onChange={e => arr('baski', i, { saat: e.target.value })} />
      <input className="adm-inp" style={mini} type="number" step="0.01" value={b.sabit_tl ?? ''} placeholder="yok" title="Baskı maliyeti elle belliyse TL olarak yaz; makine hesabı yapılmaz" onChange={e => arr('baski', i, { sabit_tl: e.target.value })} />
      <button type="button" onClick={() => up('baski', f.baski.filter((_: any, j: number) => j !== i))} style={{ background: 'none', border: 'none', color: 'var(--adm-tx3)' }}><X size={15} /></button></div>)}
    <button type="button" className="adm-btn-ghost" style={{ fontSize: 12 }} onClick={() => up('baski', [...f.baski, { ad: '', goz: '1', cevrim: '', ton: mks[0]?.ton || '180 TON', coef: '1' }])}><Plus size={12} />Kalıp ekle</button>
    <p style={{ fontSize: 11, color: 'var(--adm-tx3)', margin: '6px 0 0' }}>Göz: kalıpta bir baskıda çıkan parça sayısı. Katsayı: parçanın ürüne kaç kez girdiği (4 ayak = 4; normal parça = 1). Özel ₺/saat: yalnız bu ürüne farklı saat ücreti uygulanacaksa doldurun (örn. 3D set); boşsa makinenin genel ücreti geçerli.</p>
    <Divider label="Ambalaj ve ek" />
    <FormGrid cols={3}>
      <Field label="Koli (₺/adet)"><input className="adm-inp" type="number" step="0.01" value={f.koli_tl} onChange={e => up('koli_tl', e.target.value)} /></Field>
      <Field label="Etiket (₺/adet)"><input className="adm-inp" type="number" step="0.01" value={f.etiket_tl} onChange={e => up('etiket_tl', e.target.value)} /></Field>
      <Field label="Ek sabit hammadde (₺)"><input className="adm-inp" type="number" step="0.01" value={f.ek_tl} onChange={e => up('ek_tl', e.target.value)} /></Field>
    </FormGrid>
  </div>
}
