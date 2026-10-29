'use client'
import { useCallback, useEffect, useMemo, useState } from 'react'
import AdminTopBar from '@/components/admin/TopBar'
import { useAcParam } from '@/lib/ac-param'
import { web } from '@/lib/web-data'
import { aiIstek, AiKapali } from '@/lib/ai-client'
import { useUretim, byId } from '@/lib/uretim-utils'
import { Page, PageHead, Kpi, KpiGrid, Badge, Tabs, Modal, Field, FormGrid, Card, useToast } from '@/components/admin/erp/ui'
import { DataGrid, type Col } from '@/components/admin/erp/DataGrid'
import { topluSilCalistir } from '@/lib/toplu-sil'
import TeklifGoruntu from '@/components/admin/teklif/TeklifGoruntu'
import { DURUM, PARA, bosKalem, bugunTR, dogrula, epostaMetni, gecerlilikDurumu, gunEkle, iskontoBul, koliOzet, listeEtiket, listeFiyatiPara, satirNet, teklifHesapla, yuvarla, type Dil, type ListeUrun, type TKalem } from '@/lib/teklif'
import { erp } from '@/lib/erp-client'
import { Plus, Printer, Save, Copy, Sparkles, Trash2, ShoppingCart, FileText, Clock, CheckCircle2, Percent, Tag } from 'lucide-react'

const fmt = (n: number, pb = 'TRY') => `${new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n || 0)} ${pb}`
const tarihTR = (t: string | null) => (t ? t.split('-').reverse().join('.') : '—')
const KOSUL = { tr: 'Fiyatlarımıza KDV dahil değildir.', en: 'Prices exclude VAT.' }
type F = { cari_id: string; musteri_adi: string; musteri_email: string; musteri_tel: string; basvuru_id: string; tarih: string; gecerlilik: string; para_birimi: string; kur: string; kdv_orani: number; dil: Dil; kosullar: string; notlar: string }
type Ed = { id: string | null; no: string; durum: string; siparisId: string | null; f: F; kalemler: TKalem[] }
const bosF = (): F => ({ cari_id: '', musteri_adi: '', musteri_email: '', musteri_tel: '', basvuru_id: '', tarih: bugunTR(), gecerlilik: gunEkle(bugunTR(), 15), para_birimi: 'TRY', kur: '', kdv_orani: 20, dil: 'tr', kosullar: KOSUL.tr, notlar: '' })

export default function TekliflerPage() {
  const toast = useToast()
  const { d, loading: katYukleniyor, reload: katYenile } = useUretim(['cariTam', 'variants', 'products', 'fiyatListeleri', 'fiyatKalemleri', 'iskontolar', 'fiyatUrunleri'])
  const [fyModal, setFyModal] = useState(false), [fyAra, setFyAra] = useState('')
  const [liste, setListe] = useState<any[]>([])
  const [site, setSite] = useState<any>(null)
  const [yuk, setYuk] = useState(true)
  const [tab, setTab] = useState('acik')
  const [ed, setEd] = useState<Ed | null>(null)
  const [sekme, setSekme] = useState('duzenle')
  const [busy, setBusy] = useState(false)
  const [ai, setAi] = useState<{ metin: string; busy: boolean; sonuc: any | null; kapali: boolean }>({ metin: '', busy: false, sonuc: null, kapali: false })

  const yukle = useCallback(async () => {
    const [t, s] = await Promise.all([web.from('teklifler').select('*').order('created_at', { ascending: false }).limit(1000), web.from('settings').select('value').eq('key', 'site').maybeSingle()])
    if (t.error) toast.show(t.error.message, true)
    setListe(t.data || []); setSite(s.data?.value || null); setYuk(false)
  }, []) // eslint-disable-line
  useEffect(() => { yukle() }, [yukle])

  const cari = useMemo(() => byId(d.cariTam), [d.cariTam])
  const urun = useMemo(() => byId(d.products), [d.products])
  const vList = useMemo(() => d.variants.map((v: any) => ({ id: v.id, label: [urun[v.product_id]?.name, v.name, v.color, v.size].filter(Boolean).filter((a: any, i: number, arr: any[]) => arr.indexOf(a) === i).join(' · ') || v.name })), [d.variants, urun])
  // Katalogdan seçilen kalemlerin resmi: önce renk/varyant görseli, yoksa ürün ana görseli
  const gorseller = useMemo(() => {
    const m: Record<string, string> = {}
    const ad = (x: string) => 'ad:' + String(x || '').toLocaleLowerCase('tr').replace(/\s+/g, ' ').trim()
    for (const p of d.products as any[]) if (p.image_url) m[ad(p.name)] = p.image_url
    for (const v of d.variants as any[]) {
      const g = v.gorsel || urun[v.product_id]?.image_url; if (!g) continue
      m[v.id] = g
      // Kalem katalogdan seçilmeyip adı yazıldıysa (variant_id boş) ad üzerinden de bulunabilsin
      const e = vList.find((x: any) => x.id === v.id)?.label; if (e) m[ad(e)] = g
    }
    return m
  }, [d.variants, d.products, urun, vList]) as Record<string, string>
  const varsayilanListe = d.fiyatListeleri.find((l: any) => l.varsayilan)?.id
  function fiyatBul(variantId: string, cariId: string, miktar: number) {
    const lid = cari[cariId]?.fiyat_listesi_id || varsayilanListe
    const it = d.fiyatKalemleri.find((k: any) => k.fiyat_listesi_id === lid && k.variant_id === variantId)
    if (!it) return null
    const isk = Math.max(0, ...d.iskontolar.filter((k: any) => k.aktif !== false && +k.min_miktar <= miktar).map((k: any) => +k.iskonto_yuzdesi))
    return { fiyat: +it.fiyat, isk }
  }
  const firma = site ? [site.company, site.address, [site.phone, site.email].filter(Boolean).join(' · ')].filter(Boolean).join('\n') : 'Alya Plastik'

  /* ── Proforma fiyat listesi (USD): ürün seçilince fiyat, iskonto ve koli bilgisi otomatik gelir ── */
  const listeUrunleri = useMemo(() => (d.fiyatUrunleri as ListeUrun[]).filter(u => u.aktif !== false), [d.fiyatUrunleri])
  const listeKod = useMemo(() => Object.fromEntries(listeUrunleri.map(u => [u.kod, u])) as Record<string, ListeUrun>, [listeUrunleri])
  const listeEtk = useMemo(() => { const m: Record<string, ListeUrun> = {}; for (const u of listeUrunleri) { m[listeEtiket(u, 'tr')] = u; m[listeEtiket(u, 'en')] = u } return m }, [listeUrunleri])
  const sayi = (x: any) => (x == null ? null : +x)
  function listeKalemi(u: ListeUrun, f: F, miktar: number): Partial<TKalem> {
    const fiyat = listeFiyatiPara(+u.usd_fiyat, f.para_birimi, +f.kur)
    return { variant_id: '', kod: u.kod, urun_adi: listeEtiket(u, f.dil), koli_ici_adet: sayi(u.koli_ici_adet), koli_m3: sayi(u.koli_m3), koli_kg: sayi(u.koli_kg),
      ...(fiyat !== null ? { birim_fiyat: fiyat, iskonto_yuzde: iskontoBul(+cari[f.cari_id]?.iskonto_yuzde || 0, d.iskontolar, miktar) } : {}) }
  }
  const yenidenFiyatla = (f: F, ks: TKalem[]) => ks.map(k => (k.kod && listeKod[k.kod] ? { ...k, ...listeKalemi(listeKod[k.kod], f, +k.miktar) } : k))
  const listeTemizle = { kod: undefined, koli_ici_adet: null, koli_m3: null, koli_kg: null }

  /* ── Başvurudan gelen ?basvuru=ID ── */
  useEffect(() => {
    if (yuk) return
    const id = new URLSearchParams(window.location.search).get('basvuru')
    if (!id || !/^[0-9a-f-]{36}$/.test(id)) return
    window.history.replaceState(null, '', window.location.pathname)
    web.from('contact_submissions').select('id,name,company,email,phone,subject,product,message').eq('id', id).maybeSingle().then(({ data: b }) => {
      if (!b) return toast.show('Başvuru bulunamadı', true)
      const f = { ...bosF(), musteri_adi: b.company || b.name, musteri_email: b.email || '', musteri_tel: b.phone || '', basvuru_id: b.id, notlar: `Başvuru: ${b.subject || ''}${b.product ? ` (${b.product})` : ''}`.trim() }
      setEd({ id: null, no: '', durum: 'taslak', siparisId: null, f, kalemler: [bosKalem()] }); setSekme('duzenle')
      setAi({ metin: [b.subject && `Konu: ${b.subject}`, b.product && `İlgilendiği ürün: ${b.product}`, b.message].filter(Boolean).join('\n'), busy: false, sonuc: null, kapali: false })
    })
  }, [yuk]) // eslint-disable-line

  const yeni = () => { setEd({ id: null, no: '', durum: 'taslak', siparisId: null, f: bosF(), kalemler: [bosKalem()] }); setSekme('duzenle'); setAi({ metin: '', busy: false, sonuc: null, kapali: false }) }
  async function ac(t: any) {
    const { data, error } = await web.from('teklif_kalemleri').select('*').eq('teklif_id', t.id).order('sira')
    if (error) return toast.show(error.message, true)
    setEd({ id: t.id, no: t.no, durum: t.durum, siparisId: t.siparis_id, f: { cari_id: t.cari_id || '', musteri_adi: t.musteri_adi, musteri_email: t.musteri_email || '', musteri_tel: t.musteri_tel || '', basvuru_id: t.basvuru_id || '', tarih: t.tarih, gecerlilik: t.gecerlilik || '', para_birimi: t.para_birimi, kur: t.kur ? String(+t.kur) : '', kdv_orani: +t.kdv_orani, dil: t.dil, kosullar: t.kosullar || '', notlar: t.notlar || '' },
      kalemler: (data || []).map((k: any) => ({ variant_id: k.variant_id || '', urun_adi: k.urun_adi, aciklama: k.aciklama || '', miktar: +k.miktar, birim: k.birim, birim_fiyat: +k.birim_fiyat, iskonto_yuzde: +k.iskonto_yuzde, kod: k.kod || undefined, koli_ici_adet: sayi(k.koli_ici_adet), koli_m3: sayi(k.koli_m3), koli_kg: sayi(k.koli_kg) })) })
    setSekme('duzenle'); setAi({ metin: '', busy: false, sonuc: null, kapali: false })
  }
  const kopya = (t: any) => ac(t).then(() => setEd(e => e && ({ ...e, id: null, no: '', durum: 'taslak', siparisId: null, f: { ...e.f, tarih: bugunTR(), gecerlilik: gunEkle(bugunTR(), 15) } })))

  // Para birimi, kur, dil veya cari değişince listeden gelen kalemlerin fiyatı/iskontosu yeniden hesaplanır
  const setF = (p: Partial<F>) => setEd(e => {
    if (!e) return e
    const f = { ...e.f, ...p }, yeniden = 'para_birimi' in p || 'kur' in p || 'dil' in p || 'cari_id' in p
    return { ...e, f, kalemler: yeniden ? yenidenFiyatla(f, e.kalemler) : e.kalemler }
  })
  const setK = (i: number, p: Partial<TKalem>) => setEd(e => e && ({ ...e, kalemler: e.kalemler.map((k, j) => j === i ? { ...k, ...p } : k) }))
  const kilitli = ed?.durum === 'kabul'

  function urunSec(i: number, text: string) {
    if (!ed) return
    const lu = listeEtk[text]
    if (lu) return setK(i, listeKalemi(lu, ed.f, ed.kalemler[i].miktar))
    const v = vList.find((x: any) => x.label === text)
    if (!v) return setK(i, { urun_adi: text, variant_id: '', ...listeTemizle })
    const fb = ed.f.para_birimi === 'TRY' ? fiyatBul(v.id, ed.f.cari_id, ed.kalemler[i].miktar) : null
    setK(i, { variant_id: v.id, urun_adi: v.label, ...listeTemizle, ...(fb ? { birim_fiyat: fb.fiyat, iskonto_yuzde: fb.isk } : {}) })
  }
  function miktarDegis(i: number, m: number) {
    if (!ed) return
    const lu = ed.kalemler[i].kod ? listeKod[ed.kalemler[i].kod!] : undefined
    if (lu) { const p = listeKalemi(lu, ed.f, m); return setK(i, { miktar: m, ...(p.birim_fiyat !== undefined ? { birim_fiyat: p.birim_fiyat, iskonto_yuzde: p.iskonto_yuzde } : {}) }) }
    const k = ed.kalemler[i]; const fb =k.variant_id && ed.f.para_birimi === 'TRY' ? fiyatBul(k.variant_id, ed.f.cari_id, m) : null
    setK(i, { miktar: m, ...(fb ? { birim_fiyat: fb.fiyat, iskonto_yuzde: fb.isk } : {}) })
  }
  function cariSec(id: string) {
    const c = cari[id]; setF({ cari_id: id, ...(c ? { musteri_adi: c.ad, musteri_email: c.email || '', musteri_tel: c.telefon || '' } : {}) })
  }
  function dilDegis(dil: Dil) { if (!ed) return; setF({ dil, ...(ed.f.kosullar.trim() === '' || ed.f.kosullar === KOSUL[ed.f.dil] ? { kosullar: KOSUL[dil] } : {}) }) }

  async function kaydet() {
    if (!ed || busy || kilitli) return
    const dolu = ed.kalemler.filter(k => k.urun_adi.trim())
    const h = dogrula({ musteri_adi: ed.f.musteri_adi, kalemler: ed.kalemler, para_birimi: ed.f.para_birimi, gecerlilik: ed.f.gecerlilik, tarih: ed.f.tarih })
    const kritik = h.filter(x => !x.includes('0 olan'))
    if (kritik.length) return toast.show(kritik[0], true)
    if (ed.f.para_birimi === 'TRY' && dolu.some(k => k.kod) && !(+ed.f.kur > 0)) return toast.show('TL teklifte liste fiyatları USD’den çevrilir: kuru girin (1 USD = ? TL)', true)
    if (h.length && !confirm(h.join('\n') + '\n\nYine de kaydedilsin mi?')) return
    setBusy(true)
    const { data, error } = await web.rpc('rpc_teklif_kaydet', { p_id: ed.id, p_teklif: { ...ed.f }, p_kalemler: dolu.map(k => ({ ...k })) })
    setBusy(false)
    if (error) return toast.show(error.message, true)
    setEd({ ...ed, id: data.id, no: data.no }); toast.show(`Kaydedildi: ${data.no}`); yukle()
  }
  async function durumDegis(t: { id: string; no: string }, durum: string) {
    if (durum === 'iptal' && !confirm(`${t.no} iptal edilsin mi?`)) return
    const { error } = await web.from('teklifler').update({ durum, updated_at: new Date().toISOString() }).eq('id', t.id).neq('durum', 'kabul')
    if (error) return toast.show(error.message, true)
    setEd(e => e && e.id === t.id ? { ...e, durum } : e); toast.show('Durum güncellendi'); yukle()
  }
  async function topluSil(sel: any[]): Promise<string | void> {
    const { silinen, hata } = await topluSilCalistir(sel, async (r: any) => (r.durum === 'kabul' ? `${r.no}: kabul edilmiş teklif silinemez` : (await web.from('teklifler').delete().eq('id', r.id)).error?.message), 'teklif')
    yukle()
    if (hata) return hata
    toast.show(`${silinen} teklif silindi`)
  }
  async function sil(t: any) {
    if (t.durum === 'kabul') return toast.show('Kabul edilmiş teklif silinemez', true)
    if (!confirm(`${t.no} silinsin mi?`)) return
    const { error } = await web.from('teklifler').delete().eq('id', t.id)
    if (error) return toast.show(error.message, true); yukle()
  }
  function siparisCevir() {
    if (!ed?.id) return toast.show('Önce teklifi kaydedin', true)
    let kur = ''
    if (ed.f.para_birimi !== 'TRY') {
      const g = prompt(`Teklif ${ed.f.para_birimi} cinsinden. Sipariş TL ile açılır: 1 ${ed.f.para_birimi} kaç TL?`, '')
      const k = +(g || '').replace(',', '.'); if (!(k > 0)) return toast.show('Geçerli bir kur girilmedi', true)
      kur = `&kur=${k}`
    }
    window.location.href = `/admin/dashboard/satis/siparisler?teklif=${ed.id}${kur}`
  }
  async function aiOner() {
    if (!ed || ai.busy) return
    setAi(a => ({ ...a, busy: true, sonuc: null }))
    try {
      const r = await aiIstek<{ sonuc: { oneriler: any[]; uyari: string | null }; katalogBos: boolean }>('teklif_kalem_oner', ed.f.basvuru_id && ai.metin.trim() === '' ? { basvuru_id: ed.f.basvuru_id } : { metin: ai.metin })
      setAi(a => ({ ...a, busy: false, sonuc: r.sonuc }))
    } catch (e: any) { setAi(a => ({ ...a, busy: false, kapali: e instanceof AiKapali })); toast.show(e.message, true) }
  }
  function oneriEkle(o: any) {
    if (!ed) return
    const base = { ...bosKalem(), urun_adi: o.urun_adi, variant_id: o.variant_id || '', miktar: o.miktar || 1, birim: o.birim || 'adet' }
    const fb = o.variant_id && ed.f.para_birimi === 'TRY' ? fiyatBul(o.variant_id, ed.f.cari_id, base.miktar) : null
    if (o.variant_id) base.urun_adi = vList.find((v: any) => v.id === o.variant_id)?.label || o.urun_adi
    if (fb) { base.birim_fiyat = fb.fiyat; base.iskonto_yuzde = fb.isk }
    setEd(e => e && ({ ...e, kalemler: [...(e.kalemler.length === 1 && !e.kalemler[0].urun_adi.trim() ? [] : e.kalemler), base] }))
  }
  async function fiyatKaydet(u: ListeUrun, v: number) {
    if (!(v >= 0) || v === +u.usd_fiyat) return
    const r: any = await erp.from('fiyat_listesi_urunleri').update({ usd_fiyat: v, updated_at: new Date().toISOString() }).eq('id', u.id)
    if (r.error) return toast.show(r.error.message, true)
    toast.show(`${u.kod}: ${v} USD olarak kaydedildi`); katYenile()
  }
  function yazdir() { setSekme('onizleme'); setTimeout(() => window.print(), 250) }

  const bugun = bugunTR()
  const acikTeklif = liste.filter(t => t.durum === 'gonderildi')
  const kabul90 = liste.filter(t => t.durum === 'kabul' && t.updated_at >= gunEkle(bugun, -90)), red90 = liste.filter(t => t.durum === 'red' && t.updated_at >= gunEkle(bugun, -90))
  const oran = kabul90.length + red90.length ? (kabul90.length / (kabul90.length + red90.length)) * 100 : null
  const gecen = liste.filter(t => gecerlilikDurumu(t, bugun) === 'doldu')
  const filtreli = liste.filter(t => tab === 'hepsi' ? true : tab === 'acik' ? ['taslak', 'gonderildi'].includes(t.durum) : tab === 'doldu' ? gecerlilikDurumu(t, bugun) === 'doldu' : t.durum === tab)
  const cols: Col<any>[] = [
    { key: 'no', label: 'Teklif', width: 130, sort: t => t.no, render: t => <b>{t.no}</b> },
    { key: 'mus', label: 'Müşteri', sort: t => t.musteri_adi, render: t => <div><b>{t.musteri_adi}</b>{t.basvuru_id && <Badge tone="blue" style={{ marginLeft: 6 }}>başvurudan</Badge>}</div> },
    { key: 'tar', label: 'Tarih', width: 100, sort: t => t.tarih, render: t => tarihTR(t.tarih), hideSm: true },
    { key: 'gec', label: 'Geçerlilik', width: 130, sort: t => t.gecerlilik || '', render: t => { const g = gecerlilikDurumu(t, bugun); return <span>{tarihTR(t.gecerlilik)} {g === 'doldu' && <Badge tone="red">doldu</Badge>}{g === 'yakinda' && <Badge tone="amber">yakında</Badge>}</span> }, hideSm: true },
    { key: 'top', label: 'Toplam', width: 150, align: 'right', sort: t => +t.toplam, render: t => fmt(+t.toplam, t.para_birimi) },
    { key: 'du', label: 'Durum', width: 130, sort: t => t.durum, render: t => <Badge tone={DURUM[t.durum]?.tone}>{DURUM[t.durum]?.l}</Badge> },
    { key: 'act', label: '', width: 90, align: 'right', render: t => <span style={{ display: 'inline-flex', gap: 4 }} onClick={e => e.stopPropagation()}><button className="adm-btn-ghost" style={{ padding: '3px 7px' }} title="Kopyala" onClick={() => kopya(t)}><Copy size={12} /></button>{t.durum !== 'kabul' && <button className="adm-btn-danger" style={{ padding: '3px 7px' }} onClick={() => sil(t)}><Trash2 size={12} /></button>}</span> },
  ]
  const s = ed ? teklifHesapla(ed.kalemler, ed.f.kdv_orani) : null

  useAcParam(!yuk, async id => { let r = liste.find((x: any) => x.id === id); if (!r) r = (await web.from('teklifler').select('*').eq('id', id).maybeSingle()).data; if (r) ac(r) })

  return (
    <div style={{ flex: 1, overflow: 'auto' }}>
      <style>{`@media print { body * { visibility: hidden !important; } #teklif-alani, #teklif-alani * { visibility: visible !important; } #teklif-alani { position: absolute !important; left: 0; top: 0; box-shadow: none !important; width: 100% !important; min-height: 0 !important; } @page { size: A4; margin: 0 } }`}</style>
      <AdminTopBar title="Fiyat Teklifleri" />
      <Page>
        <PageHead title="Fiyat Teklifleri" sub="Başvurudan veya sıfırdan teklif hazırla → PDF/e-posta ile gönder → kabulde satış siparişine çevir" actions={<><button className="adm-btn-ghost" onClick={() => setFyModal(true)}><Tag size={14} />Fiyat listesi</button><button className="adm-btn" onClick={yeni}><Plus size={14} />Yeni Teklif</button></>} />
        <KpiGrid min={180}>
          <Kpi label="Bekleyen teklif" value={acikTeklif.length} Icon={FileText} color="var(--adm-blue)" sub={`TL: ${fmt(acikTeklif.filter(t => t.para_birimi === 'TRY').reduce((a, t) => a + +t.toplam, 0))}`} />
          <Kpi label="Süresi dolan" value={gecen.length} Icon={Clock} color={gecen.length ? 'var(--adm-red)' : 'var(--adm-green)'} sub="gönderildi, geçerliliği bitti" onClick={() => setTab('doldu')} />
          <Kpi label="Kabul oranı (90 gün)" value={oran == null ? '—' : `%${oran.toFixed(0)}`} Icon={Percent} color="var(--adm-ac)" sub={`${kabul90.length} kabul · ${red90.length} red`} />
          <Kpi label="Kabul edilen (90 gün, TL)" value={fmt(kabul90.filter(t => t.para_birimi === 'TRY').reduce((a, t) => a + +t.toplam, 0))} Icon={CheckCircle2} color="var(--adm-green)" valueSize={17} />
        </KpiGrid>
        <div style={{ margin: '12px 0' }}><Tabs value={tab} onChange={setTab} tabs={[{ v: 'acik', l: 'Açık', n: liste.filter(t => ['taslak', 'gonderildi'].includes(t.durum)).length }, { v: 'doldu', l: 'Süresi dolan', n: gecen.length }, { v: 'kabul', l: 'Kabul', n: liste.filter(t => t.durum === 'kabul').length }, { v: 'red', l: 'Red', n: liste.filter(t => t.durum === 'red').length }, { v: 'hepsi', l: 'Tümü', n: liste.length }]} /></div>
        <DataGrid rows={filtreli} cols={cols} rowKey={t => t.id} loading={yuk} onBulkDelete={topluSil} deleteNoun="teklif" deleteNote="Kabul edilmiş teklifler silinmez." csvName="teklifler" storageKey="teklifler" onRowClick={ac} searchText={t => `${t.no} ${t.musteri_adi}`} searchPlaceholder="Teklif no, müşteri…" emptyTitle="Teklif yok" emptySub="“Yeni Teklif” veya Başvurular sayfasındaki “Teklif hazırla” ile başlayın" />
      </Page>

      <Modal open={!!ed} onClose={() => setEd(null)} width={1000} title={ed ? `Fiyat Teklifi ${ed.no ? '· ' + ed.no : '· yeni (kaydedilmedi)'}` : ''}
        footer={ed && s && <>
          {ed.id && !kilitli && <>{ed.durum === 'taslak' && <button type="button" className="adm-btn-ghost" onClick={() => durumDegis({ id: ed.id!, no: ed.no }, 'gonderildi')}>Gönderildi işaretle</button>}
            {ed.durum === 'gonderildi' && <><button type="button" className="adm-btn-ghost" onClick={() => durumDegis({ id: ed.id!, no: ed.no }, 'red')}>Reddedildi</button></>}
            <button type="button" className="adm-btn-ghost" style={{ marginRight: 'auto' }} onClick={() => durumDegis({ id: ed.id!, no: ed.no }, 'iptal')}>İptal et</button></>}
          <button type="button" className="adm-btn-ghost" onClick={() => setEd(null)}>Kapat</button>
          <button type="button" className="adm-btn-ghost" onClick={async () => { try { await navigator.clipboard.writeText(epostaMetni({ no: ed.no || 'TASLAK', musteri_adi: ed.f.musteri_adi, para_birimi: ed.f.para_birimi, kdv_orani: ed.f.kdv_orani, gecerlilik: ed.f.gecerlilik || null, kosullar: ed.f.kosullar || null, dil: ed.f.dil }, ed.kalemler, site?.company || 'Alya Plastik')); toast.show('E-posta metni kopyalandı') } catch { toast.show('Kopyalanamadı', true) } }}><Copy size={13} />E-posta metni</button>
          <button type="button" className="adm-btn-ghost" onClick={yazdir}><Printer size={13} />Yazdır / PDF</button>
          {ed.id && !kilitli && ['taslak', 'gonderildi'].includes(ed.durum) && <button type="button" className="adm-btn-ghost" onClick={siparisCevir}><ShoppingCart size={13} />Kabul → siparişe çevir</button>}
          {!kilitli && <button type="button" className="adm-btn" disabled={busy} onClick={kaydet}><Save size={13} />{busy ? 'Kaydediliyor…' : 'Kaydet'}</button>}</>}>
        {ed && s && <>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10 }}><Badge tone={DURUM[ed.durum]?.tone}>{DURUM[ed.durum]?.l}</Badge>{kilitli && <span style={{ fontSize: 12.5, color: 'var(--adm-tx3)' }}>Kabul edilmiş teklif değiştirilemez{ed.siparisId ? ' (siparişe bağlı)' : ''}. Değişiklik için “Kopyala” ile yeni teklif açın.</span>}</div>
          <Tabs value={sekme} onChange={setSekme} style={{ marginBottom: 12 }} tabs={[{ v: 'duzenle', l: 'Düzenle' }, { v: 'onizleme', l: 'Önizleme' }]} />
          {sekme === 'onizleme' ? <div style={{ overflow: 'auto', background: '#888', padding: 12 }}><TeklifGoruntu no={ed.no} dil={ed.f.dil} firma={firma} musteri={[ed.f.musteri_adi, ed.f.musteri_email, ed.f.musteri_tel].filter(Boolean).join('\n')} tarihi={ed.f.tarih} gecerlilik={ed.f.gecerlilik} paraBirimi={ed.f.para_birimi} kdvOrani={ed.f.kdv_orani} kalemler={ed.kalemler} kosullar={ed.f.kosullar} gorseller={gorseller} /></div> : (
            <fieldset disabled={kilitli} style={{ border: 0, padding: 0, margin: 0, display: 'grid', gap: 12 }}>
              <FormGrid cols={4}>
                <Field label="Kayıtlı cari (isteğe bağlı)" span={2}><select className="adm-inp" value={ed.f.cari_id} onChange={e => cariSec(e.target.value)}><option value="">— Yeni müşteri / potansiyel —</option>{d.cariTam.filter((c: any) => c.tip !== 'tedarikci').map((c: any) => <option key={c.id} value={c.id}>{c.ad}</option>)}</select></Field>
                <Field label="Müşteri adı *" span={2}><input className="adm-inp" value={ed.f.musteri_adi} maxLength={200} onChange={e => setF({ musteri_adi: e.target.value })} /></Field>
                <Field label="E-posta" span={2}><input className="adm-inp" value={ed.f.musteri_email} onChange={e => setF({ musteri_email: e.target.value })} /></Field>
                <Field label="Telefon"><input className="adm-inp" value={ed.f.musteri_tel} onChange={e => setF({ musteri_tel: e.target.value })} /></Field>
                <Field label="Dil"><select className="adm-inp" value={ed.f.dil} onChange={e => dilDegis(e.target.value as Dil)}><option value="tr">Türkçe</option><option value="en">İngilizce</option></select></Field>
                <Field label="Tarih"><input type="date" className="adm-inp" value={ed.f.tarih} onChange={e => setF({ tarih: e.target.value })} /></Field>
                <Field label="Geçerlilik"><input type="date" className="adm-inp" value={ed.f.gecerlilik} onChange={e => setF({ gecerlilik: e.target.value })} /></Field>
                <Field label="Para birimi" hint={ed.f.para_birimi === 'USD' ? 'Liste fiyatı USD: otomatik gelir' : ed.f.para_birimi === 'TRY' ? 'Liste fiyatı USD × kur ile TL’ye çevrilir' : 'Bu para biriminde liste yok; fiyatları elle girin'}><select className="adm-inp" value={ed.f.para_birimi} onChange={e => setF({ para_birimi: e.target.value })}>{PARA.map(p => <option key={p}>{p}</option>)}</select></Field>
                {ed.f.para_birimi === 'TRY' && <Field label="Kur (1 USD = ? TL)" hint={ed.kalemler.some(k => k.kod) && !(+ed.f.kur > 0) ? 'Kur girilmeden liste fiyatı TL’ye çevrilemez' : undefined}><input type="number" min="0" step="any" className="adm-inp" value={ed.f.kur} onChange={e => setF({ kur: e.target.value })} placeholder="örn. 44,50" /></Field>}
                <Field label="KDV %"><input type="number" min="0" max="100" step="any" className="adm-inp" value={ed.f.kdv_orani} onChange={e => setF({ kdv_orani: +e.target.value })} /></Field>
              </FormGrid>

              {!kilitli && <Card title={<span style={{ display: 'flex', gap: 6, alignItems: 'center' }}><Sparkles size={14} />AI ile kalem öner</span>} pad={12}>
                <textarea className="adm-inp" rows={3} style={{ width: '100%' }} placeholder="Müşterinin talep mesajını yapıştırın (başvurudan geldiyse hazır)" value={ai.metin} onChange={e => setAi(a => ({ ...a, metin: e.target.value }))} />
                <button type="button" className="adm-btn-ghost" style={{ marginTop: 6 }} disabled={ai.busy || ai.kapali || (!ai.metin.trim() && !ed.f.basvuru_id)} onClick={aiOner}><Sparkles size={13} />{ai.busy ? 'Analiz ediliyor…' : 'Öner'}</button>
                {ai.kapali && <span style={{ fontSize: 12, color: 'var(--adm-amber)', marginLeft: 8 }}>AI yapılandırılmamış</span>}
                {ai.sonuc && <div style={{ marginTop: 8, display: 'grid', gap: 4 }}>
                  {ai.sonuc.uyari && <div style={{ fontSize: 12, color: 'var(--adm-amber)' }}>⚠ {ai.sonuc.uyari}</div>}
                  {ai.sonuc.oneriler.length === 0 && !ai.sonuc.uyari && <div style={{ fontSize: 12.5, color: 'var(--adm-tx3)' }}>Öneri çıkmadı.</div>}
                  {ai.sonuc.oneriler.map((o: any, i: number) => <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 12.5 }}>
                    <span style={{ flex: 1 }}><b>{o.variant_id ? vList.find((v: any) => v.id === o.variant_id)?.label : o.urun_adi}</b>{!o.variant_id && <Badge tone="amber" style={{ marginLeft: 6 }}>katalogda eşleşmedi</Badge>} {o.miktar ? `· ${o.miktar} ${o.birim || ''}` : <span style={{ color: 'var(--adm-tx3)' }}>· miktar belirtilmemiş</span>}<div style={{ fontSize: 11, color: 'var(--adm-tx3)' }}>{o.gerekce}</div></span>
                    <button type="button" className="adm-btn-ghost" style={{ padding: '3px 9px', fontSize: 12 }} onClick={() => oneriEkle(o)}><Plus size={12} />Ekle</button></div>)}
                  <div style={{ fontSize: 11, color: 'var(--adm-tx3)' }}>Öneriler yalnızca katalogla eşleşme ve müşteri mesajındaki miktarlardır; fiyat listesinden alınır, kontrol edin.</div>
                </div>}
              </Card>}

              <Card title="Kalemler" pad={0}>
                <datalist id="teklif-urunler">{listeUrunleri.map((u: ListeUrun) => <option key={'l' + u.id} value={listeEtiket(u, ed.f.dil)} />)}{vList.map((v: any) => <option key={v.id} value={v.label} />)}</datalist>
                <div style={{ overflowX: 'auto' }}><table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
                  <thead><tr>{['Ürün / hizmet', 'Miktar', 'Birim', 'Birim fiyat', 'İskonto %', 'Tutar', ''].map((h, i) => <th key={i} style={{ padding: '6px 8px', textAlign: 'left', fontSize: 11, color: 'var(--adm-tx3)' }}>{h}</th>)}</tr></thead>
                  <tbody>{ed.kalemler.map((k, i) => <tr key={i}>
                    <td style={{ padding: 4, minWidth: 240 }}><input className="adm-inp" list="teklif-urunler" value={k.urun_adi} onChange={e => urunSec(i, e.target.value)} placeholder="Fiyat listesinden seçin veya yazın" />{k.kod && listeKod[k.kod] && <div style={{ fontSize: 10.5, color: 'var(--adm-tx3)' }}>Liste {fmt(+listeKod[k.kod].usd_fiyat, 'USD')}{ed.f.para_birimi === 'TRY' ? ` × kur ${ed.f.kur || '?'}` : ''}{+k.iskonto_yuzde ? ` · iskonto %${k.iskonto_yuzde}` : ''}{k.koli_ici_adet ? ` · ${k.koli_ici_adet} adet/koli` : ''}</div>}{k.kod && ed.f.para_birimi !== 'USD' && ed.f.para_birimi !== 'TRY' && <div style={{ fontSize: 10.5, color: 'var(--adm-amber)' }}>bu para biriminde liste yok, fiyatı girin</div>}{k.variant_id && d.fiyatKalemleri.length > 0 && !fiyatBul(k.variant_id, ed.f.cari_id, k.miktar) && ed.f.para_birimi === 'TRY' && <div style={{ fontSize: 10.5, color: 'var(--adm-amber)' }}>fiyat listesinde yok</div>}</td>
                    <td style={{ padding: 4 }}><input type="number" min="0" step="any" className="adm-inp" style={{ width: 90 }} value={k.miktar} onChange={e => miktarDegis(i, +e.target.value)} /></td>
                    <td style={{ padding: 4 }}><input className="adm-inp" style={{ width: 70 }} value={k.birim} maxLength={20} onChange={e => setK(i, { birim: e.target.value })} /></td>
                    <td style={{ padding: 4 }}><input type="number" min="0" step="any" className="adm-inp" style={{ width: 110 }} value={k.birim_fiyat} onChange={e => setK(i, { birim_fiyat: +e.target.value })} /></td>
                    <td style={{ padding: 4 }}><input type="number" min="0" max="100" step="any" className="adm-inp" style={{ width: 80 }} value={k.iskonto_yuzde} onChange={e => setK(i, { iskonto_yuzde: +e.target.value })} /></td>
                    <td style={{ padding: 4, textAlign: 'right', whiteSpace: 'nowrap' }}>{fmt(satirNet(k), ed.f.para_birimi)}</td>
                    <td style={{ padding: 4 }}><button type="button" className="adm-btn-danger" style={{ padding: '3px 7px' }} disabled={ed.kalemler.length <= 1} onClick={() => setEd(e => e && ({ ...e, kalemler: e.kalemler.filter((_, j) => j !== i) }))}><Trash2 size={12} /></button></td></tr>)}</tbody>
                </table></div>
                <div style={{ padding: '8px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                  <button type="button" className="adm-btn-ghost" onClick={() => setEd(e => e && ({ ...e, kalemler: [...e.kalemler, bosKalem()] }))}><Plus size={12} />Kalem ekle</button>
                  <span style={{ fontSize: 13, textAlign: 'right' }}>{(() => { const ko = koliOzet(ed.kalemler); return ko.koli > 0 ? <span style={{ display: 'block', fontSize: 11.5, color: 'var(--adm-tx3)' }}>{ko.koli} koli · {ko.m3} m³ · {ko.kg} kg{ko.eksik ? ` (${ko.eksik} kalemin koli bilgisi yok)` : ''}</span> : null })()}Ara {fmt(s.ara, ed.f.para_birimi)} · KDV {fmt(s.kdv, ed.f.para_birimi)} · <b>Toplam {fmt(s.toplam, ed.f.para_birimi)}</b></span>
                </div>
              </Card>
              <Field label="Koşullar (teklifte görünür)"><textarea className="adm-inp" rows={3} maxLength={2000} value={ed.f.kosullar} onChange={e => setF({ kosullar: e.target.value })} placeholder="Ödeme, teslim süresi, teslim yeri…" /></Field>
              <Field label="İç notlar (teklifte görünmez)"><input className="adm-inp" maxLength={1000} value={ed.f.notlar} onChange={e => setF({ notlar: e.target.value })} /></Field>
            </fieldset>)}
        </>}
      </Modal>

      <Modal open={fyModal} onClose={() => setFyModal(false)} width={900} title="Proforma fiyat listesi (USD)" footer={<button type="button" className="adm-btn-ghost" onClick={() => setFyModal(false)}>Kapat</button>}>
        <div style={{ fontSize: 12.5, color: 'var(--adm-tx3)', marginBottom: 8 }}>Tekliflerde ürün seçilince fiyat buradan gelir. Fiyatı değiştirmek yalnızca yeni teklifleri etkiler; kaydedilmiş teklifler değişmez. Koli, hacim ve ağırlık bilgileri “ALYA PLASTIK PRICE LIST USD 2026” dosyasından alınmıştır.</div>
        <input className="adm-inp" style={{ marginBottom: 8, width: '100%' }} placeholder="Kod veya ürün adı ara…" value={fyAra} onChange={e => setFyAra(e.target.value)} />
        <div style={{ maxHeight: '60vh', overflow: 'auto' }}><table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
          <thead><tr>{['Kod', 'Ürün', 'Adet/koli', 'Koli m³', 'Koli kg', '40HC adet', 'USD fiyat'].map((h, i) => <th key={i} style={{ padding: '6px 8px', textAlign: i > 1 ? 'right' : 'left', fontSize: 11, color: 'var(--adm-tx3)', position: 'sticky', top: 0, background: 'var(--adm-bg, #fff)' }}>{h}</th>)}</tr></thead>
          <tbody>{(d.fiyatUrunleri as ListeUrun[]).filter(u => !fyAra.trim() || `${u.kod} ${u.ad_tr} ${u.ad_en || ''}`.toLocaleLowerCase('tr').includes(fyAra.trim().toLocaleLowerCase('tr'))).map(u => <FiyatSatir key={u.id} u={u} kaydet={fiyatKaydet} />)}</tbody>
        </table></div>
      </Modal>
      {toast.node}
    </div>
  )
}

function FiyatSatir({ u, kaydet }: { u: ListeUrun; kaydet: (u: ListeUrun, v: number) => void }) {
  const [v, setV] = useState(String(+u.usd_fiyat))
  useEffect(() => { setV(String(+u.usd_fiyat)) }, [u.usd_fiyat])
  const td = { padding: '4px 8px', borderTop: '1px solid var(--adm-bd, #ddd)' } as const
  return <tr>
    <td style={{ ...td, whiteSpace: 'nowrap' }}><b>{u.kod}</b></td><td style={td}>{u.ad_tr}</td>
    <td style={{ ...td, textAlign: 'right' }}>{u.koli_ici_adet ?? '—'}</td><td style={{ ...td, textAlign: 'right' }}>{u.koli_m3 ?? '—'}</td><td style={{ ...td, textAlign: 'right' }}>{u.koli_kg ?? '—'}</td><td style={{ ...td, textAlign: 'right' }}>{u.konteyner_40hc ?? '—'}</td>
    <td style={{ ...td, textAlign: 'right' }}><input type="number" min="0" step="any" className="adm-inp" style={{ width: 90, textAlign: 'right' }} value={v} onChange={e => setV(e.target.value)} onBlur={() => kaydet(u, +v)} onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }} /></td>
  </tr>
}
