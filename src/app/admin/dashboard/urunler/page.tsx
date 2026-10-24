'use client'
import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import AdminTopBar from '@/components/admin/TopBar'
import { web, webAll } from '@/lib/web-data'
import { useUretim, byId, receteMaliyet } from '@/lib/uretim-utils'
import { fmt, fmtN, fmtInt, fmtDate } from '@/lib/fmt'
import { sum } from '@/lib/muh-utils'
import { Page, PageHead, Kpi, KpiGrid, Badge, Tabs, Money, Drawer, Modal, Field, FormGrid, InfoRow, Divider, useToast } from '@/components/admin/erp/ui'
import { DataGrid, type Col } from '@/components/admin/erp/DataGrid'
import { Plus, Pencil, Trash2, Copy, Package, Star, Sparkles, Layers, FlaskConical, X, ImageOff, Boxes, Tag, Wand2, ScanEye, ImagePlus, RotateCcw, Box } from 'lucide-react'
import { aiIstek } from '@/lib/ai-client'
import Donus360 from '@/components/urun/Donus360'
import Model3D from '@/components/urun/Model3D'

const GORSEL_STIL = { studyo: 'Stüdyo', yasam: 'Yaşam alanı' } as const
type GorselStil = keyof typeof GORSEL_STIL

const bos = { code: '', name: '', slug: '', category: '', subcategory: '', mekan: 'ic', description: '', image_url: '', images: [] as string[], model_3d_url: '' as string | null, tags: [] as string[], specs: [] as { k: string; v: string }[], paket_bilgisi: [] as { kod: string; adet: string; kutu_hacmi: string; kutu_agirligi: string; olculer: string; hacim: string }[], barkod: '', is_featured: false, is_new: false, sort_order: 0, description_i18n: {} as Record<string, any> }
const BOS_PAKET_SATIRI = { kod: '', adet: '', kutu_hacmi: '', kutu_agirligi: '', olculer: '', hacim: '' }
const MODEL_3D_UZANTILAR = ['glb', 'gltf', 'obj', 'stl', 'fbx']
const slugla = (s: string) => s.toLocaleLowerCase('tr').replace(/ç/g, 'c').replace(/ğ/g, 'g').replace(/ı/g, 'i').replace(/ö/g, 'o').replace(/ş/g, 's').replace(/ü/g, 'u').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')

export default function AdminUrunlerPage() {
  const toast = useToast()
  const { d, reload: reloadERP } = useUretim(['variants', 'receteler', 'receteKalemleri', 'hammaddeler', 'fiyatListeleri', 'fiyatKalemleri', 'emirler'])
  const [products, setProducts] = useState<any[]>([])
  const [cats, setCats] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('hepsi')
  const [kat, setKat] = useState('')
  const [mekan, setMekan] = useState('')
  const [detay, setDetay] = useState<any>(null)
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [form, setForm] = useState<any>(bos)
  const [slugElle, setSlugElle] = useState(false)
  const [yeniTag, setYeniTag] = useState('')
  const [yeniGorsel, setYeniGorsel] = useState('')
  const [busy, setBusy] = useState(false)
  const [katModal, setKatModal] = useState<any>(null)
  const [aiBusy, setAiBusy] = useState('')
  const [gorselNot, setGorselNot] = useState<any>(null)
  const [gorselAi, setGorselAi] = useState<{ stil: GorselStil; b64: string | null; busy: boolean } | null>(null)
  const [gorsel360, setGorsel360] = useState<{ kareSayisi: 4 | 8 | 16; kareler: string[] | null; busy: boolean } | null>(null)
  const [model3DBusy, setModel3DBusy] = useState(false)
  const [topluAi, setTopluAi] = useState<{
    stil: GorselStil; urunler: any[]; clear: () => void; asama: 'ayar' | 'uretim' | 'onay'; calisiyor: boolean
    durum: Record<string, 'bekliyor' | 'isleniyor' | 'tamam' | 'hata'>; sonuc: Record<string, string>; secili: Record<string, boolean>
  } | null>(null)

  // AI: TR açıklama + 5 dil çevirisi + SEO önerisi (kayıt için Kaydet'e basmak gerekir)
  async function aiYaz() {
    if (!form.name.trim()) return toast.show('Önce ürün adını gir', true)
    setAiBusy('yaz')
    try {
      const r: any = await aiIstek('urun_metin', { urun: { name: form.name, code: form.code, category: catAd[form.category] || form.category, subcategory: form.subcategory, specs: Object.fromEntries(form.specs.filter((x: any) => x.k.trim()).map((x: any) => [x.k, x.v])), tags: form.tags, description: form.description, image_url: form.image_url } })
      const m = r.sonuc
      setForm((f: any) => ({ ...f, description: m.aciklama_tr, description_i18n: { ...m.ceviriler, seo: { baslik: m.seo_baslik, aciklama: m.seo_aciklama } } }))
      toast.show('Metin ve çeviriler hazırlandı — okuyup Kaydet\'e bas')
    } catch (e: any) { toast.show(e.message, true) }
    setAiBusy('')
  }
  // AI: görselden etiket/görünüm önerisi
  async function gorselOner() {
    if (!form.image_url) return toast.show('Önce ana görsel URL\'si gir', true)
    setAiBusy('gorsel')
    try {
      const r: any = await aiIstek('gorsel_analiz', { url: form.image_url, ad: form.name })
      const m = r.sonuc
      setForm((f: any) => ({ ...f, tags: Array.from(new Set([...f.tags, ...(m.etiketler || []).map((t: string) => t.toLocaleLowerCase('tr'))])) }))
      setGorselNot(m); toast.show('Etiketler eklendi')
    } catch (e: any) { toast.show(e.message, true) }
    setAiBusy('')
  }
  // AI: ürün görselini yeniden tasarla (arka plan değişimi) — önce önizleme, onaylanınca Supabase Storage'a kaydedilir
  async function gorselUret(stil: GorselStil) {
    if (!form.image_url) return toast.show('Önce ana görsel URL\'si gir', true)
    setGorselAi({ stil, b64: null, busy: true })
    try {
      const r: any = await aiIstek('urun_gorsel_tasarim', { url: form.image_url, stil })
      setGorselAi({ stil, b64: r.b64, busy: false })
    } catch (e: any) { toast.show(e.message, true); setGorselAi(null) }
  }
  async function gorselKullan() {
    if (!editing?.id || !gorselAi?.b64) return
    setBusy(true)
    try {
      const r: any = await aiIstek('urun_gorsel_kaydet', { urun_id: editing.id, b64: gorselAi.b64 })
      setForm((f: any) => ({ ...f, image_url: r.url }))
      setGorselAi(null); toast.show('Yeni görsel kaydedildi — eski görsel "Ek görseller"e taşındı')
      load()
    } catch (e: any) { toast.show(e.message, true) }
    setBusy(false)
  }
  // AI: ürünün "360° döner galeri" karelerini üret — gerçek 3D model değil, farklı açılardan AI ile türetilmiş görsel dizisi.
  // Önce önizleme (sürükleyerek döndürülebilir), onaylanınca Supabase Storage'a kaydedilir.
  async function uret360(kareSayisi: 4 | 8 | 16) {
    if (!form.image_url) return toast.show('Önce ana görsel URL\'si gir', true)
    setGorsel360({ kareSayisi, kareler: null, busy: true })
    try {
      const r: any = await aiIstek('urun_360_uret', { url: form.image_url, kareSayisi })
      setGorsel360({ kareSayisi, kareler: r.kareler, busy: false })
      if (r.basarisiz > 0) toast.show(`${r.basarisiz} kare üretilemedi, ${r.kareler.length} kare ile devam ediliyor — istersen "Tekrar Dene"yi kullan`, true)
    } catch (e: any) { toast.show(e.message, true); setGorsel360(null) }
  }
  async function kaydet360() {
    if (!editing?.id || !gorsel360?.kareler) return
    setBusy(true)
    try {
      await aiIstek('urun_360_kaydet', { urun_id: editing.id, kareler: gorsel360.kareler })
      setGorsel360(null); toast.show('360° görünüm kaydedildi — ürün sayfasında görünecek')
      load()
    } catch (e: any) { toast.show(e.message, true) }
    setBusy(false)
  }

  // Gerçek 3D model dosyası (glb/gltf/obj/stl/fbx) yükleme — AI ile üretilmez, kullanıcı kendi
  // dosyasını yükler. Dosya büyük olabileceği için doğrudan tarayıcıdan Supabase Storage'a
  // (imzalı adresle) yüklenir; sunucu yalnızca izin verir ve sonucu ürüne kaydeder.
  async function model3DYukle(dosya: File) {
    if (!editing?.id) return
    const uzanti = dosya.name.split('.').pop()?.toLowerCase() || ''
    if (!MODEL_3D_UZANTILAR.includes(uzanti)) return toast.show(`Desteklenmeyen dosya türü (.${uzanti}). İzin verilenler: ${MODEL_3D_UZANTILAR.join(', ')}`, true)
    if (dosya.size > 50 * 1024 * 1024) return toast.show('Dosya çok büyük (50MB üstü)', true)
    setModel3DBusy(true)
    try {
      const imza = await fetch('/api/admin/urun-3d', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ eylem: 'imza', urun_id: editing.id, dosyaAdi: dosya.name, boyut: dosya.size }) }).then(r => r.json())
      if (imza.error) throw new Error(imza.error)
      const up = await web.storage.from('urun-3d-modelleri').uploadToSignedUrl(imza.path, imza.token, dosya)
      if (up.error) throw new Error(up.error.message)
      const kaydet = await fetch('/api/admin/urun-3d', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ eylem: 'kaydet', urun_id: editing.id, path: imza.path }) }).then(r => r.json())
      if (kaydet.error) throw new Error(kaydet.error)
      setForm((f: typeof bos) => ({ ...f, model_3d_url: kaydet.url }))
      toast.show('3D model yüklendi — ürün sayfasında görünecek')
      load()
    } catch (e) { toast.show(e instanceof Error ? e.message : String(e), true) }
    setModel3DBusy(false)
  }
  async function model3DKaldir() {
    if (!editing?.id) return
    setModel3DBusy(true)
    try {
      const r = await fetch('/api/admin/urun-3d', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ urun_id: editing.id }) }).then(x => x.json())
      if (r.error) throw new Error(r.error)
      setForm((f: typeof bos) => ({ ...f, model_3d_url: null }))
      toast.show('3D model kaldırıldı')
      load()
    } catch (e) { toast.show(e instanceof Error ? e.message : String(e), true) }
    setModel3DBusy(false)
  }

  // AI: toplu görsel tasarım — önce hepsi için üretilir, önizleme ızgarasında istenmeyenler seçimden çıkarılır, sonra sadece seçililer kaydedilir.
  function topluAiAc(sel: any[], clear: () => void) {
    const urunler = sel.filter(p => p.image_url)
    if (!urunler.length) return toast.show('Seçili ürünlerin hiçbirinde ana görsel yok', true)
    setTopluAi({ stil: 'studyo', urunler, clear, asama: 'ayar', calisiyor: false, durum: {}, sonuc: {}, secili: {} })
  }
  async function topluAiUret() {
    setTopluAi(t => t && { ...t, asama: 'uretim', calisiyor: true })
    const t0 = topluAi; if (!t0) return
    let limitDoldu = false
    for (const p of t0.urunler) {
      if (limitDoldu) break
      setTopluAi(t => t && { ...t, durum: { ...t.durum, [p.id]: 'isleniyor' } })
      try {
        const r: any = await aiIstek('urun_gorsel_tasarim', { url: p.image_url, stil: t0.stil })
        setTopluAi(t => t && { ...t, durum: { ...t.durum, [p.id]: 'tamam' }, sonuc: { ...t.sonuc, [p.id]: r.b64 }, secili: { ...t.secili, [p.id]: true } })
      } catch (e: any) {
        setTopluAi(t => t && { ...t, durum: { ...t.durum, [p.id]: 'hata' } })
        if (/saatlik sınır/i.test(e.message || '')) { limitDoldu = true; toast.show('Saatlik AI görsel sınırına ulaşıldı — kalan ürünler işlenmedi, bir saat sonra tekrar deneyebilirsin.', true) }
      }
    }
    setTopluAi(t => t && { ...t, asama: 'onay', calisiyor: false })
  }
  async function topluAiKaydet() {
    if (!topluAi) return
    const secilenler = topluAi.urunler.filter(p => topluAi.durum[p.id] === 'tamam' && topluAi.secili[p.id])
    if (!secilenler.length) return toast.show('Kaydedilecek görsel seçmedin', true)
    setTopluAi(t => t && { ...t, calisiyor: true })
    let basarili = 0, hatali = 0
    for (const p of secilenler) {
      try { await aiIstek('urun_gorsel_kaydet', { urun_id: p.id, b64: topluAi.sonuc[p.id] }); basarili++ }
      catch { hatali++ }
    }
    toast.show(hatali ? `${basarili} ürün güncellendi, ${hatali} tanesi kaydedilemedi` : `${basarili} ürünün görseli güncellendi`, !!hatali)
    topluAi.clear(); setTopluAi(null); load()
  }

  const load = useCallback(async () => {
    const [p, c] = await Promise.all([webAll('products', '*', q => q.order('sort_order', { ascending: true })), webAll('categories', '*', q => q.order('sort_order', { ascending: true }))])
    setProducts(p); setCats(c); setLoading(false)
  }, [])
  useEffect(() => { load() }, [load])

  const catAd = useMemo(() => Object.fromEntries(cats.map(c => [c.slug, c.name])), [cats])
  const P = useMemo(() => {
    const o: Record<string, any> = {}
    const hm = byId(d.hammaddeler)
    products.forEach(p => {
      const vs = d.variants.filter((v: any) => v.product_id === p.id)
      const rec = d.receteler.find((r: any) => r.urun_id === p.id && r.aktif)
      const mal = rec ? receteMaliyet(rec, d.receteKalemleri, d.hammaddeler) : null
      const fyt = d.fiyatKalemleri.filter((k: any) => vs.some((v: any) => v.id === k.variant_id))
      const varsListe = d.fiyatListeleri.find((l: any) => l.varsayilan)
      const varsFiyat = fyt.filter((k: any) => k.fiyat_listesi_id === varsListe?.id).map((k: any) => +k.fiyat)
      o[p.id] = { vs, stok: sum(vs, (v: any) => v.stock), rec, mal, fyt, fiyat: varsFiyat.length ? Math.min(...varsFiyat) : null, emir: d.emirler.filter((e: any) => e.urun_id === p.id).length }
      void hm
    })
    return o
  }, [products, d])

  const liste = products.filter(p => (tab === 'hepsi' || (tab === 'one' ? p.is_featured : tab === 'yeni' ? p.is_new : tab === 'varyantsiz' ? !P[p.id]?.vs.length : tab === 'recetesiz' ? !P[p.id]?.rec : tab === 'gorselsiz' ? !p.image_url : true)) && (!kat || p.category === kat) && (!mekan || (p.mekan || 'ic') === mekan))

  /* form */
  const openNew = () => { setEditing(null); setSlugElle(false); setForm({ ...bos, sort_order: products.length + 1, category: cats[0]?.slug || '' }); setModal(true) }
  const openEdit = (p: any) => {
    setEditing(p); setSlugElle(true)
    setForm({ code: p.code || '', name: p.name || '', slug: p.slug || '', category: p.category || '', subcategory: p.subcategory || '', mekan: p.mekan || 'ic', description: p.description || '', image_url: p.image_url || '', images: p.images || [], model_3d_url: p.model_3d_url || null, tags: p.tags || [], specs: Object.entries(p.specs || {}).map(([k, v]) => ({ k, v: String(v) })), paket_bilgisi: (p.paket_bilgisi || []).map((x: any) => ({ kod: x.kod || '', adet: x.adet || '', kutu_hacmi: x.kutu_hacmi || '', kutu_agirligi: x.kutu_agirligi || '', olculer: x.olculer || '', hacim: x.hacim || '' })), barkod: p.barkod || '', is_featured: !!p.is_featured, is_new: !!p.is_new, sort_order: p.sort_order || 0, description_i18n: p.description_i18n || {} })
    setModal(true)
  }
  async function save(e: React.FormEvent) {
    e.preventDefault(); if (busy) return
    if (products.some(p => p.code?.toLowerCase() === form.code.trim().toLowerCase() && p.id !== editing?.id)) return toast.show('Bu ürün kodu zaten var', true)
    if (products.some(p => p.slug === form.slug && p.id !== editing?.id)) return toast.show('Bu slug başka üründe kullanılıyor', true)
    if (form.barkod && products.some(p => p.barkod === form.barkod && p.id !== editing?.id)) return toast.show('Bu barkod başka üründe kayıtlı', true)
    setBusy(true)
    const paketTemiz = form.paket_bilgisi.filter((s: any) => Object.values(s).some((v: any) => String(v).trim()))
    const payload: any = { code: form.code.trim(), name: form.name.trim(), slug: form.slug.trim(), category: form.category, subcategory: form.subcategory || null, mekan: form.mekan || 'ic', description: form.description || null, image_url: form.image_url || '', images: form.images, tags: form.tags, specs: Object.fromEntries(form.specs.filter((s: any) => s.k.trim()).map((s: any) => [s.k.trim(), s.v])), paket_bilgisi: paketTemiz.length ? paketTemiz : null, barkod: form.barkod || null, description_i18n: form.description_i18n || {}, is_featured: form.is_featured, is_new: form.is_new, sort_order: +form.sort_order || 0, updated_at: new Date().toISOString() }
    const { error } = editing ? await web.from('products').update(payload).eq('id', editing.id) : await web.from('products').insert(payload)
    setBusy(false)
    if (error) return toast.show(error.message, true)
    setModal(false); toast.show(editing ? 'Ürün güncellendi' : 'Ürün eklendi'); await load(); if (detay) setDetay((x: any) => x?.id === editing?.id ? { ...x, ...payload } : x)
  }
  async function toggle(p: any, alan: 'is_featured' | 'is_new') {
    setProducts(ps => ps.map(x => x.id === p.id ? { ...x, [alan]: !x[alan] } : x))
    const { error } = await web.from('products').update({ [alan]: !p[alan], updated_at: new Date().toISOString() }).eq('id', p.id)
    if (error) { toast.show(error.message, true); load() }
  }
  async function kopyala(p: any) {
    const { id, created_at, updated_at, ...rest } = p
    const { error } = await web.from('products').insert({ ...rest, code: `${p.code}-KOPYA`, name: `${p.name} (Kopya)`, slug: `${p.slug}-kopya-${Date.now().toString().slice(-4)}`, barkod: null, sort_order: products.length + 1 })
    if (error) return toast.show(error.message, true)
    toast.show('Ürün kopyalandı (varyantlar kopyalanmaz)'); load()
  }
  function silinebilir(p: any) {
    const x = P[p.id]
    if (x?.rec) return `“${p.name}” aktif reçeteye sahip — önce reçeteyi sil/pasifleştir`
    if (x?.emir) return `“${p.name}” için ${x.emir} üretim emri var`
    if (x?.vs.some((v: any) => +v.stock !== 0)) return `“${p.name}” varyantlarında stok var (${fmtInt(x.stok)} adet)`
    return null
  }
  async function sil(p: any) {
    const s = silinebilir(p); if (s) return toast.show(s, true)
    if (!confirm(`${p.name} silinsin mi?${P[p.id]?.vs.length ? `\n\n${P[p.id].vs.length} stok varyantı da silinir.` : ''}`)) return
    const { error } = await web.from('products').delete().eq('id', p.id)
    if (error) return toast.show(error.message, true)
    toast.show('Ürün silindi'); setDetay(null); load(); reloadERP()
  }
  async function topluSil(sel: any[]): Promise<string | void> {
    const engel = sel.map(silinebilir).filter(Boolean)
    if (engel.length) return (engel[0] as string) + (engel.length > 1 ? ` (+${engel.length - 1} ürün daha)` : '')
    let hata = 0, ilk = ''
    for (const p of sel) { const { error } = await web.from('products').delete().eq('id', p.id); if (error) { hata++; ilk ||= error.message } }
    load(); reloadERP()
    if (hata) return `${sel.length - hata} ürün silindi, ${hata} ürün silinemedi: ${ilk}`
    toast.show(`${sel.length} ürün silindi`)
  }
  async function topluKategori(e: React.FormEvent) {
    e.preventDefault(); if (!katModal?.kategori) return
    for (const p of katModal.sel) await web.from('products').update({ category: katModal.kategori, updated_at: new Date().toISOString() }).eq('id', p.id)
    toast.show(`${katModal.sel.length} ürünün kategorisi güncellendi`); katModal.clear(); setKatModal(null); load()
  }
  async function topluAlan(sel: any[], alan: string, deger: boolean, clear: () => void) {
    for (const p of sel) await web.from('products').update({ [alan]: deger, updated_at: new Date().toISOString() }).eq('id', p.id)
    toast.show('Güncellendi'); clear(); load()
  }

  const cnt = (f: (p: any) => boolean) => products.filter(f).length
  const cols: Col<any>[] = [
    { key: 'urun', label: 'Ürün', sort: p => p.name, render: p => <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      {p.image_url ? <img src={p.image_url} alt="" style={{ width: 40, height: 40, objectFit: 'contain', borderRadius: 8, background: 'var(--adm-s2)', padding: 3, flexShrink: 0 }} onError={e => ((e.target as HTMLImageElement).style.visibility = 'hidden')} /> : <div style={{ width: 40, height: 40, borderRadius: 8, background: 'var(--adm-s2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><ImageOff size={15} style={{ color: 'var(--adm-tx3)' }} /></div>}
      <div><div style={{ fontWeight: 600 }}>{p.name}</div><div style={{ fontSize: 11, color: 'var(--adm-tx3)' }}>{p.code}{p.barkod ? ` · ${p.barkod}` : ''}</div></div></div> },
    { key: 'kat', label: 'Kategori', sort: p => catAd[p.category] || p.category, render: p => <div>{catAd[p.category] || p.category}{p.subcategory && <div style={{ fontSize: 11, color: 'var(--adm-tx3)' }}>{p.subcategory}</div>}</div>, hideSm: true },
    { key: 'mekan', label: 'Mekan', width: 100, sort: p => p.mekan || 'ic', render: p => p.mekan === 'dis' ? <Badge tone="green">Dış mekan</Badge> : <Badge tone="blue">İç mekan</Badge>, hideSm: true },
    { key: 'var', label: 'Varyant', align: 'right', width: 80, sort: p => P[p.id]?.vs.length, render: p => P[p.id]?.vs.length ? P[p.id].vs.length : <Badge tone="amber">yok</Badge> },
    { key: 'stok', label: 'Stok', align: 'right', sort: p => P[p.id]?.stok, render: p => P[p.id]?.vs.length ? <b style={{ fontFamily: 'JetBrains Mono,monospace', color: P[p.id].stok <= 0 ? 'var(--adm-red)' : undefined }}>{fmtInt(P[p.id].stok)}</b> : <span style={{ color: 'var(--adm-tx3)' }}>—</span>, total: rs => fmtInt(sum(rs, (p: any) => P[p.id]?.stok)), hideSm: true },
    { key: 'mal', label: 'Birim Maliyet', align: 'right', sort: p => P[p.id]?.mal?.firedahil || 0, render: p => P[p.id]?.mal ? <Money v={P[p.id].mal.firedahil} bold={false} /> : <Badge tone="muted">reçete yok</Badge>, hideSm: true },
    { key: 'fiyat', label: 'Satış Fiyatı', align: 'right', sort: p => P[p.id]?.fiyat || 0, render: p => P[p.id]?.fiyat != null ? <Money v={P[p.id].fiyat} bold={false} /> : <span style={{ color: 'var(--adm-tx3)' }}>—</span>, hideSm: true },
    { key: 'marj', label: 'Marj', align: 'right', sort: p => (P[p.id]?.fiyat && P[p.id]?.mal ? (P[p.id].fiyat - P[p.id].mal.firedahil) / P[p.id].fiyat : -9), render: p => { const x = P[p.id]; if (!x?.fiyat || !x?.mal?.firedahil) return <span style={{ color: 'var(--adm-tx3)' }}>—</span>; const m = ((x.fiyat - x.mal.firedahil) / x.fiyat) * 100; return <span style={{ fontWeight: 700, color: m < 10 ? 'var(--adm-red)' : m < 25 ? 'var(--adm-amber)' : 'var(--adm-green)' }}>%{fmtN(m, 0)}</span> }, hideSm: true },
    { key: 'flag', label: 'Site', width: 100, render: p => <span style={{ display: 'inline-flex', gap: 4 }} onClick={e => e.stopPropagation()}>
      <button title="Öne çıkan" onClick={() => toggle(p, 'is_featured')} style={{ border: 'none', background: p.is_featured ? 'var(--adm-amber2)' : 'var(--adm-s2)', borderRadius: 7, padding: '4px 7px' }}><Star size={13} style={{ color: p.is_featured ? 'var(--adm-amber)' : 'var(--adm-tx3)' }} fill={p.is_featured ? 'currentColor' : 'none'} /></button>
      <button title="Yeni" onClick={() => toggle(p, 'is_new')} style={{ border: 'none', background: p.is_new ? 'var(--adm-green2)' : 'var(--adm-s2)', borderRadius: 7, padding: '4px 7px' }}><Sparkles size={13} style={{ color: p.is_new ? 'var(--adm-green)' : 'var(--adm-tx3)' }} /></button></span> },
    { key: 'sira', label: 'Sıra', align: 'right', width: 60, sort: p => p.sort_order, render: p => p.sort_order, hidden: true },
    { key: 'act', label: '', width: 100, align: 'right', render: p => <span style={{ display: 'inline-flex', gap: 4 }} onClick={e => e.stopPropagation()}><button className="adm-btn-ghost" style={{ padding: '4px 7px' }} title="Kopyala" onClick={() => kopyala(p)}><Copy size={12} /></button><button className="adm-btn-ghost" style={{ padding: '4px 7px' }} onClick={() => openEdit(p)}><Pencil size={12} /></button><button className="adm-btn-danger" style={{ padding: '4px 7px' }} onClick={() => sil(p)}><Trash2 size={12} /></button></span> },
  ]

  const dp = detay ? products.find(p => p.id === detay.id) || detay : null
  const dx = dp ? P[dp.id] : null
  const hm = useMemo(() => byId(d.hammaddeler), [d.hammaddeler])

  return (
    <div style={{ flex: 1, overflow: 'auto' }}>
      <AdminTopBar title="Ürünler" />
      <Page>
        <PageHead title="Ürün Kataloğu" sub="Web sitesi ürünleri + stok, maliyet ve fiyat bilgisi tek yerde" actions={<button className="adm-btn" onClick={openNew}><Plus size={14} />Ürün Ekle</button>} />
        <KpiGrid min={180}>
          <Kpi label="Ürün" value={products.length} Icon={Package} color="var(--adm-ac)" sub={`${cats.length} kategori`} />
          <Kpi label="Stoklu Varyant" value={d.variants.length} Icon={Layers} color="var(--adm-blue)" sub={`${cnt(p => !P[p.id]?.vs.length)} ürün varyantsız`} onClick={() => setTab('varyantsiz')} />
          <Kpi label="Toplam Mamul Stok" value={fmtInt(sum(d.variants, (v: any) => v.stock))} Icon={Boxes} color="var(--adm-green)" sub={`${d.variants.filter((v: any) => +v.stock <= 0).length} varyant tükenmiş`} />
          <Kpi label="Reçetesiz Ürün" value={cnt(p => !P[p.id]?.rec)} Icon={FlaskConical} color={cnt(p => !P[p.id]?.rec) ? 'var(--adm-amber)' : 'var(--adm-green)'} sub="maliyet hesaplanamaz" onClick={() => setTab('recetesiz')} />
          <Kpi label="Öne Çıkan / Yeni" value={`${cnt(p => p.is_featured)} / ${cnt(p => p.is_new)}`} Icon={Star} color="var(--adm-amber)" sub="sitede vurgulanan" />
        </KpiGrid>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 12, alignItems: 'center' }}>
          <Tabs value={tab} onChange={setTab} tabs={[{ v: 'hepsi', l: 'Tümü', n: products.length }, { v: 'one', l: 'Öne çıkan', n: cnt(p => p.is_featured) }, { v: 'yeni', l: 'Yeni', n: cnt(p => p.is_new) }, { v: 'varyantsiz', l: 'Varyantsız', n: cnt(p => !P[p.id]?.vs.length) }, { v: 'recetesiz', l: 'Reçetesiz', n: cnt(p => !P[p.id]?.rec) }, { v: 'gorselsiz', l: 'Görselsiz', n: cnt(p => !p.image_url) }]} />
          <select className="adm-sel" value={kat} onChange={e => setKat(e.target.value)}><option value="">Tüm kategoriler</option>{cats.map(c => <option key={c.slug} value={c.slug}>{c.name} ({cnt(p => p.category === c.slug)})</option>)}</select>
          <select className="adm-sel" value={mekan} onChange={e => setMekan(e.target.value)}><option value="">İç + Dış mekan</option><option value="ic">İç mekan ({cnt(p => (p.mekan || 'ic') === 'ic')})</option><option value="dis">Dış mekan ({cnt(p => p.mekan === 'dis')})</option></select>
        </div>
        <DataGrid rows={liste} cols={cols} rowKey={p => p.id} loading={loading} csvName="urunler" storageKey="urunler" onRowClick={setDetay} activeKey={detay?.id} selectable
          searchText={p => `${p.name} ${p.code} ${p.barkod || ''} ${catAd[p.category] || ''} ${(p.tags || []).join(' ')}`} searchPlaceholder="Ürün adı, kod, barkod, etiket..."
          bulkActions={(sel, clear) => <>
            <button className="adm-btn-ghost" style={{ padding: '3px 10px', fontSize: 12 }} onClick={() => setKatModal({ sel, clear, kategori: '' })}><Tag size={12} />Kategori</button>
            <button className="adm-btn-ghost" style={{ padding: '3px 10px', fontSize: 12 }} onClick={() => topluAiAc(sel, clear)}><ImagePlus size={12} />AI Görsel Tasarımı</button>
            <button className="adm-btn-ghost" style={{ padding: '3px 10px', fontSize: 12 }} onClick={() => topluAlan(sel, 'is_featured', true, clear)}><Star size={12} />Öne çıkar</button>
            <button className="adm-btn-ghost" style={{ padding: '3px 10px', fontSize: 12 }} onClick={() => topluAlan(sel, 'is_new', true, clear)}><Sparkles size={12} />Yeni işaretle</button></>}
          onBulkDelete={topluSil} deleteNoun="ürün"
          emptyTitle="Ürün bulunamadı" />
      </Page>

      <Drawer open={!!dp} onClose={() => setDetay(null)} width={600} title={dp && <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>{dp.name}{dp.is_featured && <Star size={14} style={{ color: 'var(--adm-amber)' }} fill="currentColor" />}{dp.is_new && <Badge tone="green">Yeni</Badge>}</span>} sub={dp && `${dp.code} · ${catAd[dp.category] || dp.category}`}
        footer={dp && <><button className="adm-btn-danger" onClick={() => sil(dp)}><Trash2 size={13} /></button><button className="adm-btn-ghost" onClick={() => kopyala(dp)}><Copy size={13} /></button><Link href="/admin/dashboard/varyantlar" className="adm-btn-ghost" style={{ textDecoration: 'none' }}><Layers size={13} />Varyantlar</Link><button className="adm-btn" onClick={() => openEdit(dp)}><Pencil size={13} />Düzenle</button></>}>
        {dp && dx && <div style={{ padding: 20 }}>
          <div style={{ display: 'flex', gap: 14, marginBottom: 16 }}>
            {dp.image_url ? <img src={dp.image_url} alt="" style={{ width: 120, height: 120, objectFit: 'contain', borderRadius: 12, background: 'var(--adm-s2)', padding: 8 }} /> : <div style={{ width: 120, height: 120, borderRadius: 12, background: 'var(--adm-s2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><ImageOff size={26} style={{ color: 'var(--adm-tx3)' }} /></div>}
            <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, alignContent: 'start' }}>
              {[['Toplam stok', fmtInt(dx.stok)], ['Varyant', dx.vs.length], ['Birim maliyet', dx.mal ? fmt(dx.mal.firedahil) : '—'], ['Satış fiyatı', dx.fiyat != null ? fmt(dx.fiyat) : '—']].map(([k, v]) => <div key={k as string} style={{ padding: 10, borderRadius: 10, background: 'var(--adm-s2)' }}><div className="adm-kpi-label" style={{ marginBottom: 3 }}>{k}</div><b style={{ fontSize: 14.5, fontFamily: 'JetBrains Mono,monospace' }}>{v}</b></div>)}
            </div>
          </div>
          {dp.description && <p style={{ fontSize: 13, color: 'var(--adm-tx2)', lineHeight: 1.6, margin: '0 0 14px' }}>{dp.description}</p>}
          <Divider label={`Varyantlar (${dx.vs.length})`} />
          {dx.vs.length === 0 ? <div style={{ padding: 12, borderRadius: 9, background: 'var(--adm-amber2)', fontSize: 12.5, color: 'var(--adm-amber)' }}>Bu ürünün stok varyantı yok — üretim ve satış stoğu takip edilemez. <Link href="/admin/dashboard/varyantlar" style={{ color: 'var(--adm-ac)', fontWeight: 700 }}>Varyant ekle →</Link></div> : dx.vs.map((v: any) => <div key={v.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', fontSize: 13, borderBottom: '1px dashed var(--adm-bdr)' }}><span>{[v.name, v.color, v.size].filter(Boolean).join(' · ')}</span><b style={{ fontFamily: 'JetBrains Mono,monospace', color: +v.stock <= 0 ? 'var(--adm-red)' : undefined }}>{fmtInt(v.stock)}</b></div>)}
          <Divider label="Reçete & maliyet" />
          {dx.mal ? <>
            <InfoRow k="Aktif reçete" v={`v${dx.rec.versiyon} · ${dx.mal.satirlar.length} kalem`} />
            {dx.mal.satirlar.map((s: any) => <InfoRow key={s.id} k={`  ${s.ad}`} v={`${fmtN(s.miktar, 3)} ${s.birim} · ${fmt(s.tutar)}`} />)}
            <InfoRow k="Hammadde / İşçilik / Gider / Amort." v={`${fmt(dx.mal.hammadde)} / ${fmt(dx.mal.iscilik)} / ${fmt(dx.mal.genel)} / ${fmt(dx.mal.amort)}`} />
            <InfoRow k="Toplam (fire dahil)" v={<b>{fmt(dx.mal.firedahil)}</b>} />
          </> : <p style={{ fontSize: 12.5, color: 'var(--adm-tx3)', margin: 0 }}>Aktif reçete yok. <Link href="/admin/dashboard/uretim/recete" style={{ color: 'var(--adm-ac)', fontWeight: 700 }}>Reçete oluştur →</Link></p>}
          {dx.fyt.length > 0 && <><Divider label="Fiyat listeleri" />{d.fiyatListeleri.map((l: any) => { const f = dx.fyt.filter((k: any) => k.fiyat_listesi_id === l.id); return f.length ? <InfoRow key={l.id} k={l.ad + (l.varsayilan ? ' (varsayılan)' : '')} v={f.map((k: any) => fmt(k.fiyat)).join(' – ')} /> : null })}</>}
          {Object.keys(dp.specs || {}).length > 0 && <><Divider label="Teknik özellikler" />{Object.entries(dp.specs).map(([k, v]) => <InfoRow key={k} k={k} v={String(v)} />)}</>}
          {(dp.paket_bilgisi || []).length > 0 && <><Divider label="Ürün Bilgisi (Kutu/Koli)" />{dp.paket_bilgisi.map((s: any, i: number) => <InfoRow key={s.kod || i} k={s.kod || `Satır ${i + 1}`} v={`${s.adet ? `${s.adet} adet` : ''}${s.olculer ? ` · ${s.olculer} cm` : ''}${s.kutu_hacmi ? ` · ${s.kutu_hacmi} m³` : ''}${s.kutu_agirligi ? ` · ${s.kutu_agirligi} kg` : ''}${s.hacim ? ` · ${s.hacim} L` : ''}`} />)}</>}
          {(dp.tags || []).length > 0 && <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 14 }}>{dp.tags.map((t: string) => <span key={t} className="adm-chip">#{t}</span>)}</div>}
          <p style={{ fontSize: 11, color: 'var(--adm-tx3)', marginTop: 16 }}>Oluşturma: {fmtDate(dp.created_at)}{dp.updated_at ? ` · Güncelleme: ${fmtDate(dp.updated_at)}` : ''}</p>
        </div>}
      </Drawer>

      <Modal open={modal} onClose={() => setModal(false)} onSubmit={save} width={780} title={editing ? 'Ürünü Düzenle' : 'Yeni Ürün'}
        footer={<><button type="button" className="adm-btn-ghost" onClick={() => setModal(false)}>İptal</button><button type="submit" className="adm-btn" disabled={busy}>{busy ? 'Kaydediliyor...' : 'Kaydet'}</button></>}>
        <FormGrid cols={3}>
          <Field label="Ürün kodu *"><input className="adm-inp" required autoFocus value={form.code} onChange={e => setForm((f: any) => ({ ...f, code: e.target.value }))} placeholder="ALY-601" /></Field>
          <Field label="Ürün adı *" span={2}><input className="adm-inp" required value={form.name} onChange={e => setForm((f: any) => ({ ...f, name: e.target.value, ...(slugElle ? {} : { slug: slugla(e.target.value) }) }))} /></Field>
          <Field label="Slug *" hint="Sitedeki adres — ad değişince otomatik üretilir"><input className="adm-inp" required value={form.slug} onChange={e => { setSlugElle(true); setForm((f: any) => ({ ...f, slug: e.target.value })) }} /></Field>
          <Field label="Kategori *"><select className="adm-inp" required value={form.category} onChange={e => setForm((f: any) => ({ ...f, category: e.target.value }))}><option value="">Seçin</option>{cats.map(c => <option key={c.slug} value={c.slug}>{c.name}</option>)}</select></Field>
          <Field label="Kullanım yeri *"><select className="adm-inp" value={form.mekan} onChange={e => setForm((f: any) => ({ ...f, mekan: e.target.value }))}><option value="ic">İç mekan (ofis, mağaza, ev içi)</option><option value="dis">Dış mekan (bahçe, dışarıda)</option></select></Field>
          <Field label="Alt kategori"><input className="adm-inp" value={form.subcategory} onChange={e => setForm((f: any) => ({ ...f, subcategory: e.target.value }))} /></Field>
          <Field label="Barkod"><input className="adm-inp" value={form.barkod} onChange={e => setForm((f: any) => ({ ...f, barkod: e.target.value }))} /></Field>
          <Field label="Sıra"><input type="number" className="adm-inp" value={form.sort_order} onChange={e => setForm((f: any) => ({ ...f, sort_order: e.target.value }))} /></Field>
          <div style={{ gridColumn: 'span 1', display: 'flex', gap: 16, alignItems: 'flex-end', paddingBottom: 8 }}>
            <label style={{ display: 'flex', gap: 6, fontSize: 13, alignItems: 'center' }}><input type="checkbox" checked={form.is_featured} onChange={e => setForm((f: any) => ({ ...f, is_featured: e.target.checked }))} />Öne çıkan</label>
            <label style={{ display: 'flex', gap: 6, fontSize: 13, alignItems: 'center' }}><input type="checkbox" checked={form.is_new} onChange={e => setForm((f: any) => ({ ...f, is_new: e.target.checked }))} />Yeni</label>
          </div>
          <Field label="Ana görsel URL" span={3}><div style={{ display: 'flex', gap: 10, alignItems: 'center' }}><input className="adm-inp" value={form.image_url} onChange={e => setForm((f: any) => ({ ...f, image_url: e.target.value }))} placeholder="https://..." />{form.image_url && <img src={form.image_url} alt="" style={{ height: 44, width: 44, objectFit: 'contain', borderRadius: 8, background: 'var(--adm-s2)', flexShrink: 0 }} />}</div></Field>
          <Field label="Açıklama" span={3}><textarea className="adm-inp" rows={3} value={form.description} onChange={e => setForm((f: any) => ({ ...f, description: e.target.value }))} /></Field>
        </FormGrid>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
          <button type="button" className="adm-btn-ghost" style={{ fontSize: 12 }} disabled={!!aiBusy} onClick={aiYaz}><Wand2 size={13} />{aiBusy === 'yaz' ? 'Yazılıyor…' : 'AI ile açıklama + çeviri yaz'}</button>
          <button type="button" className="adm-btn-ghost" style={{ fontSize: 12 }} disabled={!!aiBusy} onClick={gorselOner}><ScanEye size={13} />{aiBusy === 'gorsel' ? 'İnceleniyor…' : 'Görselden etiket öner'}</button>
          {editing && <button type="button" className="adm-btn-ghost" style={{ fontSize: 12 }} disabled={!form.image_url} onClick={() => setGorselAi({ stil: 'studyo', b64: null, busy: false })}><ImagePlus size={13} />AI ile görseli yeniden tasarla</button>}
          {editing && <button type="button" className="adm-btn-ghost" style={{ fontSize: 12 }} disabled={!form.image_url} onClick={() => setGorsel360({ kareSayisi: 8, kareler: null, busy: false })}><Box size={13} />AI ile 360° görünüm oluştur</button>}
        </div>
        {editing && (
          <div style={{ display: 'flex', gap: 14, alignItems: 'center', marginTop: 10, padding: '10px 12px', background: 'var(--adm-s2)', borderRadius: 10 }}>
            {form.model_3d_url ? (
              <Model3D url={form.model_3d_url} alt="3D model önizleme" style={{ width: 64, height: 64, borderRadius: 8, background: 'var(--adm-s1)', flexShrink: 0 }} />
            ) : <div style={{ width: 64, height: 64, borderRadius: 8, background: 'var(--adm-s1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Box size={20} style={{ color: 'var(--adm-tx3)' }} /></div>}
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 12.5, fontWeight: 600, margin: 0 }}>Gerçek 3D Model</p>
              <p style={{ fontSize: 11, color: 'var(--adm-tx3)', margin: '2px 0 0' }}>
                {form.model_3d_url ? 'Yüklendi — ürün sayfasında AI 360° galerisi yerine bu gösteriliyor.' : `Kendi ürettiğin .glb/.gltf/.obj/.stl/.fbx dosyasını yükle (en fazla 50MB).`}
              </p>
            </div>
            <label className="adm-btn-ghost" style={{ fontSize: 12, cursor: model3DBusy ? 'default' : 'pointer', opacity: model3DBusy ? 0.6 : 1 }}>
              <input type="file" accept={MODEL_3D_UZANTILAR.map(u => `.${u}`).join(',')} disabled={model3DBusy} style={{ display: 'none' }}
                onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) model3DYukle(f) }} />
              {model3DBusy ? 'Yükleniyor…' : form.model_3d_url ? 'Değiştir' : 'Yükle'}
            </label>
            {form.model_3d_url && <button type="button" className="adm-btn-ghost" style={{ fontSize: 12 }} disabled={model3DBusy} onClick={model3DKaldir}><X size={13} />Kaldır</button>}
          </div>
        )}
        {gorselNot && <p style={{ fontSize: 12, color: 'var(--adm-tx3)', margin: '8px 0 0', lineHeight: 1.55 }}><b>Görsel:</b> {gorselNot.tur} — {gorselNot.gorunum} <br /><b>Site uygunluğu:</b> {gorselNot.site_uygunlugu}</p>}
        {Object.keys(form.description_i18n || {}).some(k => k !== 'seo') && <>
          <Divider label="Çeviriler (AI — yayınlamadan önce kontrol et)" />
          {(['en', 'ru', 'zh'] as const).filter(k => form.description_i18n?.[k] != null).map(k => (
            <Field key={k} label={{ en: 'İngilizce', ru: 'Rusça', zh: 'Çince (Basitleştirilmiş)' }[k]}>
              <textarea className="adm-inp" rows={2} value={form.description_i18n[k]} onChange={e => setForm((f: any) => ({ ...f, description_i18n: { ...f.description_i18n, [k]: e.target.value } }))} />
            </Field>))}
          {form.description_i18n?.seo && <p style={{ fontSize: 12, color: 'var(--adm-tx3)', margin: '4px 0 0' }}><b>SEO başlık önerisi:</b> {form.description_i18n.seo.baslik}<br /><b>SEO açıklama önerisi:</b> {form.description_i18n.seo.aciklama}</p>}
        </>}

        <Divider label="Ek görseller" />
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>{form.images.map((u: string, i: number) => <div key={i} style={{ position: 'relative' }}><img src={u} alt="" style={{ width: 56, height: 56, objectFit: 'contain', borderRadius: 8, background: 'var(--adm-s2)' }} /><button type="button" onClick={() => setForm((f: any) => ({ ...f, images: f.images.filter((_: any, j: number) => j !== i) }))} style={{ position: 'absolute', top: -6, right: -6, width: 18, height: 18, borderRadius: 9, border: 'none', background: 'var(--adm-red)', color: '#fff', fontSize: 11, lineHeight: 1 }}>×</button></div>)}</div>
        <div style={{ display: 'flex', gap: 8 }}><input className="adm-inp" placeholder="Görsel URL ekle" value={yeniGorsel} onChange={e => setYeniGorsel(e.target.value)} /><button type="button" className="adm-btn-ghost" onClick={() => { if (yeniGorsel.trim()) { setForm((f: any) => ({ ...f, images: [...f.images, yeniGorsel.trim()] })); setYeniGorsel('') } }}><Plus size={13} /></button></div>

        <Divider label="Etiketler" />
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>{form.tags.map((t: string) => <span key={t} className="adm-chip on">#{t}<button type="button" onClick={() => setForm((f: any) => ({ ...f, tags: f.tags.filter((x: string) => x !== t) }))} style={{ border: 'none', background: 'none', color: 'inherit', padding: 0 }}><X size={11} /></button></span>)}</div>
        <div style={{ display: 'flex', gap: 8 }}><input className="adm-inp" placeholder="Etiket yaz, Enter" value={yeniTag} onChange={e => setYeniTag(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); const t = yeniTag.trim(); if (t && !form.tags.includes(t)) setForm((f: any) => ({ ...f, tags: [...f.tags, t] })); setYeniTag('') } }} /></div>

        <Divider label="Teknik özellikler" />
        {form.specs.map((s: any, i: number) => <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 6 }}><input className="adm-inp" placeholder="Özellik (örn. Hacim)" value={s.k} onChange={e => setForm((f: any) => ({ ...f, specs: f.specs.map((x: any, j: number) => j === i ? { ...x, k: e.target.value } : x) }))} /><input className="adm-inp" placeholder="Değer (örn. 5 lt)" value={s.v} onChange={e => setForm((f: any) => ({ ...f, specs: f.specs.map((x: any, j: number) => j === i ? { ...x, v: e.target.value } : x) }))} /><button type="button" className="adm-btn-danger" style={{ padding: '4px 9px' }} onClick={() => setForm((f: any) => ({ ...f, specs: f.specs.filter((_: any, j: number) => j !== i) }))}><X size={12} /></button></div>)}
        <button type="button" className="adm-btn-ghost" style={{ fontSize: 12 }} onClick={() => setForm((f: any) => ({ ...f, specs: [...f.specs, { k: '', v: '' }] }))}><Plus size={12} />Özellik ekle</button>

        <Divider label="Ürün Bilgisi (Kutu/Koli)" />
        <p style={{ fontSize: 12, color: 'var(--adm-tx3)', margin: '0 0 10px' }}>Ürün sayfasında "Ürün Bilgisi" tablosu olarak gösterilir — her satır aynı modelin farklı bir kutu/beden seçeneğidir (ör. eski sitedeki ALY-111/ALY-112 gibi).</p>
        {form.paket_bilgisi.map((s: any, i: number) => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr) auto', gap: 8, marginBottom: 6 }}>
            <input className="adm-inp" placeholder="Kod (ALY-111)" value={s.kod} onChange={e => setForm((f: any) => ({ ...f, paket_bilgisi: f.paket_bilgisi.map((x: any, j: number) => j === i ? { ...x, kod: e.target.value } : x) }))} />
            <input className="adm-inp" placeholder="Ürün Adedi" value={s.adet} onChange={e => setForm((f: any) => ({ ...f, paket_bilgisi: f.paket_bilgisi.map((x: any, j: number) => j === i ? { ...x, adet: e.target.value } : x) }))} />
            <input className="adm-inp" placeholder="Kutu Hacmi (m³)" value={s.kutu_hacmi} onChange={e => setForm((f: any) => ({ ...f, paket_bilgisi: f.paket_bilgisi.map((x: any, j: number) => j === i ? { ...x, kutu_hacmi: e.target.value } : x) }))} />
            <input className="adm-inp" placeholder="Kutu Ağırlığı (kg)" value={s.kutu_agirligi} onChange={e => setForm((f: any) => ({ ...f, paket_bilgisi: f.paket_bilgisi.map((x: any, j: number) => j === i ? { ...x, kutu_agirligi: e.target.value } : x) }))} />
            <input className="adm-inp" placeholder="Ölçüler (29x16x14.5)" value={s.olculer} onChange={e => setForm((f: any) => ({ ...f, paket_bilgisi: f.paket_bilgisi.map((x: any, j: number) => j === i ? { ...x, olculer: e.target.value } : x) }))} />
            <input className="adm-inp" placeholder="Hacim (L)" value={s.hacim} onChange={e => setForm((f: any) => ({ ...f, paket_bilgisi: f.paket_bilgisi.map((x: any, j: number) => j === i ? { ...x, hacim: e.target.value } : x) }))} />
            <button type="button" className="adm-btn-danger" style={{ padding: '4px 9px' }} onClick={() => setForm((f: any) => ({ ...f, paket_bilgisi: f.paket_bilgisi.filter((_: any, j: number) => j !== i) }))}><X size={12} /></button>
          </div>
        ))}
        <button type="button" className="adm-btn-ghost" style={{ fontSize: 12 }} onClick={() => setForm((f: any) => ({ ...f, paket_bilgisi: [...f.paket_bilgisi, { ...BOS_PAKET_SATIRI }] }))}><Plus size={12} />Kutu/koli satırı ekle</button>
      </Modal>

      <Modal open={!!gorselAi} onClose={() => setGorselAi(null)} width={640} title="AI ile Görseli Yeniden Tasarla"
        footer={<>
          <button type="button" className="adm-btn-ghost" onClick={() => setGorselAi(null)}>{gorselAi?.b64 ? 'Vazgeç' : 'İptal'}</button>
          {gorselAi?.b64 && <button type="button" className="adm-btn-ghost" disabled={gorselAi.busy} onClick={() => gorselUret(gorselAi.stil)}><RotateCcw size={13} />Tekrar Dene</button>}
          {gorselAi?.b64 ? <button type="button" className="adm-btn" disabled={busy} onClick={gorselKullan}>{busy ? 'Kaydediliyor…' : 'Bu Görseli Kullan'}</button>
            : <button type="button" className="adm-btn" disabled={gorselAi?.busy} onClick={() => gorselUret(gorselAi!.stil)}><Wand2 size={13} />{gorselAi?.busy ? 'Oluşturuluyor…' : 'Oluştur'}</button>}
        </>}>
        <p style={{ fontSize: 12, color: 'var(--adm-tx3)', margin: '0 0 12px' }}>Ürünün kendisi değişmez, yalnızca arka planı AI ile yeniden oluşturulur. Sonucu onaylarsan ana görsel olarak kaydedilir; eski görsel otomatik olarak &quot;Ek görseller&quot;e taşınır.</p>
        <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
          {(Object.keys(GORSEL_STIL) as GorselStil[]).map(s => (
            <button key={s} type="button" className={gorselAi?.stil === s ? 'adm-chip on' : 'adm-chip'} disabled={gorselAi?.busy} onClick={() => setGorselAi(f => f && { ...f, stil: s, b64: null })}>{GORSEL_STIL[s]}</button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 14, alignItems: 'center', justifyContent: 'center', minHeight: 260 }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 11, color: 'var(--adm-tx3)', marginBottom: 6 }}>Mevcut</div>
            <img src={form.image_url} alt="" style={{ width: 220, height: 220, objectFit: 'contain', borderRadius: 12, background: 'var(--adm-s2)', padding: 8 }} />
          </div>
          <div style={{ fontSize: 20, color: 'var(--adm-tx3)' }}>→</div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 11, color: 'var(--adm-tx3)', marginBottom: 6 }}>AI önerisi</div>
            {gorselAi?.busy ? <div style={{ width: 220, height: 220, borderRadius: 12, background: 'var(--adm-s2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: 'var(--adm-tx3)' }}>Oluşturuluyor…</div>
              : gorselAi?.b64 ? <img src={`data:image/png;base64,${gorselAi.b64}`} alt="" style={{ width: 220, height: 220, objectFit: 'contain', borderRadius: 12, background: 'var(--adm-s2)', padding: 8 }} />
              : <div style={{ width: 220, height: 220, borderRadius: 12, background: 'var(--adm-s2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><ImagePlus size={26} style={{ color: 'var(--adm-tx3)' }} /></div>}
          </div>
        </div>
      </Modal>

      <Modal open={!!gorsel360} onClose={() => setGorsel360(null)} width={520} title="AI ile 360° Görünüm Oluştur"
        footer={<>
          <button type="button" className="adm-btn-ghost" onClick={() => setGorsel360(null)}>{gorsel360?.kareler ? 'Vazgeç' : 'İptal'}</button>
          {gorsel360?.kareler && <button type="button" className="adm-btn-ghost" disabled={gorsel360.busy} onClick={() => uret360(gorsel360.kareSayisi)}><RotateCcw size={13} />Tekrar Dene</button>}
          {gorsel360?.kareler ? <button type="button" className="adm-btn" disabled={busy} onClick={kaydet360}>{busy ? 'Kaydediliyor…' : 'Bu Görünümü Kullan'}</button>
            : <button type="button" className="adm-btn" disabled={gorsel360?.busy} onClick={() => uret360(gorsel360!.kareSayisi)}><Wand2 size={13} />{gorsel360?.busy ? `Oluşturuluyor… (~${gorsel360?.kareSayisi === 16 ? '1.5' : '1'} dk)` : 'Oluştur'}</button>}
        </>}>
        <p style={{ fontSize: 12, color: 'var(--adm-tx3)', margin: '0 0 12px', lineHeight: 1.55 }}>
          Bu, gerçek bir 3D model değildir — mevcut fotoğraftan AI ile farklı açılardan çekilmiş gibi kareler türetilir ve ürün sayfasında sürükleyerek döndürülebilen bir galeri olarak gösterilir. Sonucu onaylarsan kaydedilir ve halka açık ürün sayfasında görünür.
        </p>
        {!gorsel360?.kareler && !gorsel360?.busy && (
          <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
            <button type="button" className={gorsel360?.kareSayisi === 16 ? 'adm-chip on' : 'adm-chip'} onClick={() => setGorsel360(f => f && { ...f, kareSayisi: 16 })}>16 kare (en akıcı, daha yavaş)</button>
            <button type="button" className={gorsel360?.kareSayisi === 8 ? 'adm-chip on' : 'adm-chip'} onClick={() => setGorsel360(f => f && { ...f, kareSayisi: 8 })}>8 kare (dengeli)</button>
            <button type="button" className={gorsel360?.kareSayisi === 4 ? 'adm-chip on' : 'adm-chip'} onClick={() => setGorsel360(f => f && { ...f, kareSayisi: 4 })}>4 kare (daha hızlı)</button>
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'center', minHeight: 260 }}>
          {gorsel360?.busy ? (
            <div style={{ width: 260, height: 260, borderRadius: 12, background: 'var(--adm-s2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: 'var(--adm-tx3)' }}>Kareler oluşturuluyor…</div>
          ) : gorsel360?.kareler ? (
            <Donus360 kareler={gorsel360.kareler.map(b64 => `data:image/png;base64,${b64}`)} alt="360° önizleme" style={{ width: 260, height: 260, borderRadius: 12, background: 'var(--adm-s2)', padding: 8 }} />
          ) : (
            <div style={{ width: 260, height: 260, borderRadius: 12, background: 'var(--adm-s2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Box size={26} style={{ color: 'var(--adm-tx3)' }} /></div>
          )}
        </div>
      </Modal>

      <Modal open={!!topluAi} onClose={() => { if (!topluAi?.calisiyor) topluAi?.clear(); setTopluAi(null) }} width={720} title={`AI ile Toplu Görsel Tasarımı${topluAi ? ` — ${topluAi.urunler.length} ürün` : ''}`}
        footer={<>
          <button type="button" className="adm-btn-ghost" disabled={topluAi?.calisiyor} onClick={() => { topluAi?.clear(); setTopluAi(null) }}>{topluAi?.asama === 'onay' ? 'Vazgeç' : 'İptal'}</button>
          {topluAi?.asama === 'ayar' && <button type="button" className="adm-btn" onClick={topluAiUret}><Wand2 size={13} />{topluAi.urunler.length} Ürün İçin Oluştur</button>}
          {topluAi?.asama === 'onay' && <button type="button" className="adm-btn" disabled={topluAi.calisiyor} onClick={topluAiKaydet}>{topluAi.calisiyor ? 'Kaydediliyor…' : `Seçilenleri Kaydet (${topluAi.urunler.filter(p => topluAi.durum[p.id] === 'tamam' && topluAi.secili[p.id]).length})`}</button>}
        </>}>
        {topluAi?.asama === 'ayar' && <>
          <p style={{ fontSize: 12, color: 'var(--adm-tx3)', margin: '0 0 12px', lineHeight: 1.55 }}>Seçili {topluAi.urunler.length} ürünün görseli sırayla AI ile yeniden tasarlanacak (yalnızca arka plan değişir). Üretim bitince önce önizleme ızgarasını göreceksin — hiçbir görsel bu ekranda otomatik kaydedilmez.</p>
          <div style={{ display: 'flex', gap: 8 }}>
            {(Object.keys(GORSEL_STIL) as GorselStil[]).map(s => (
              <button key={s} type="button" className={topluAi.stil === s ? 'adm-chip on' : 'adm-chip'} onClick={() => setTopluAi(t => t && { ...t, stil: s })}>{GORSEL_STIL[s]}</button>
            ))}
          </div>
        </>}
        {(topluAi?.asama === 'uretim' || topluAi?.asama === 'onay') && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 10, maxHeight: 440, overflow: 'auto' }}>
            {topluAi.urunler.map(p => {
              const d = topluAi.durum[p.id]
              const secili = !!topluAi.secili[p.id]
              return (
                <div key={p.id} onClick={() => d === 'tamam' && setTopluAi(t => t && { ...t, secili: { ...t.secili, [p.id]: !t.secili[p.id] } })}
                  style={{ border: `2px solid ${d === 'tamam' && secili ? 'var(--adm-ac)' : 'transparent'}`, borderRadius: 10, padding: 4, cursor: d === 'tamam' ? 'pointer' : 'default', opacity: d === 'hata' ? 0.5 : 1 }}>
                  <div style={{ width: '100%', aspectRatio: '1/1', borderRadius: 8, background: 'var(--adm-s2)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                    {d === 'tamam' ? <img src={`data:image/png;base64,${topluAi.sonuc[p.id]}`} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain', padding: 4 }} />
                      : d === 'isleniyor' ? <span style={{ fontSize: 11, color: 'var(--adm-tx3)' }}>Oluşturuluyor…</span>
                      : d === 'hata' ? <span style={{ fontSize: 11, color: 'var(--adm-red)' }}>Hata</span>
                      : <img src={p.image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain', padding: 4, opacity: 0.5 }} />}
                  </div>
                  <div style={{ fontSize: 11, marginTop: 4, textAlign: 'center', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</div>
                </div>
              )
            })}
          </div>
        )}
      </Modal>

      <Modal open={!!katModal} onClose={() => setKatModal(null)} onSubmit={topluKategori} width={420} title={katModal && `${katModal.sel.length} ürünün kategorisini değiştir`}
        footer={<><button type="button" className="adm-btn-ghost" onClick={() => setKatModal(null)}>İptal</button><button type="submit" className="adm-btn">Uygula</button></>}>
        {katModal && <Field label="Yeni kategori"><select className="adm-inp" required autoFocus value={katModal.kategori} onChange={e => setKatModal((k: any) => ({ ...k, kategori: e.target.value }))}><option value="">Seçin</option>{cats.map(c => <option key={c.slug} value={c.slug}>{c.name}</option>)}</select></Field>}
      </Modal>
      {toast.node}
    </div>
  )
}
