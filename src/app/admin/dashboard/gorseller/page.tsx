'use client'
import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import AdminTopBar from '@/components/admin/TopBar'
import { Copy, Package, ExternalLink, Wand2, RotateCcw, ImagePlus } from 'lucide-react'
import { Modal } from '@/components/admin/erp/ui'
import { aiIstek } from '@/lib/ai-client'

const GORSEL_STIL = { studyo: 'Stüdyo', yasam: 'Yaşam alanı' } as const
type GorselStil = keyof typeof GORSEL_STIL
type TopluOge = { key: string; tur: 'urun' | 'varyant'; id: string; ad: string; url: string; durum: 'bekliyor' | 'isleniyor' | 'tamam' | 'hata'; b64: string | null; secili: boolean }
type Toplu = { urunAd: string; stil: GorselStil; ogeler: TopluOge[]; calisiyor: boolean; kaydediyor: boolean; hata: string }
type AiHedef = { tur: 'urun' | 'varyant'; id: string; ad: string; url: string; stil: GorselStil; b64: string | null; busy: boolean; kayit: boolean }

const sb = createClient()

export default function GorsellerPage() {
  const [products, setProducts] = useState<any[]>([])
  const [search, setSearch] = useState('')
  const [variants, setVariants] = useState<any[]>([])
  const [toast, setToast] = useState('')
  const [ai, setAi] = useState<AiHedef | null>(null)
  const [toplu, setToplu] = useState<Toplu | null>(null)
  const iptal = useRef(false)

  useEffect(() => { yukle() }, [])
  function yukle() {
    sb.from('products').select('id,code,name,image_url,category,is_new').order('sort_order').then(({ data }) => setProducts(data || []))
    sb.from('product_variants').select('id,product_id,name,color,hex,gorsel,sort_order').order('sort_order').then(({ data }) => setVariants(data || []))
  }

  async function aiUret(h: AiHedef, stil: GorselStil) {
    setAi({ ...h, stil, b64: null, busy: true })
    try {
      const r: any = await aiIstek('urun_gorsel_tasarim', { url: h.url, stil })
      setAi({ ...h, stil, b64: r.b64, busy: false })
    } catch (e: any) { setToast(e.message || 'AI hatası'); setTimeout(() => setToast(''), 3500); setAi(null) }
  }
  // Ürüne tıklayınca: ana görsel + fotoğrafı olan tüm varyantlar sırayla AI ile yeniden tasarlanır, sonra toplu onay
  function topluBaslat(p: any, stil: GorselStil = 'studyo', onceki?: TopluOge[]) {
    const ogeler: TopluOge[] = onceki ? onceki.map(o => ({ ...o, durum: 'bekliyor', b64: null, secili: false })) : [
      ...(p.image_url ? [{ key: 'u-' + p.id, tur: 'urun' as const, id: p.id, ad: 'Ana görsel', url: p.image_url, durum: 'bekliyor' as const, b64: null, secili: false }] : []),
      ...(varyantlar[p.id] || []).filter(v => v.gorsel).map(v => ({ key: 'v-' + v.id, tur: 'varyant' as const, id: v.id, ad: v.name + (v.color && v.color !== v.name ? ' · ' + v.color : ''), url: v.gorsel, durum: 'bekliyor' as const, b64: null, secili: false })),
    ]
    if (ogeler.length === 0) { setToast('Bu üründe görsel yok'); setTimeout(() => setToast(''), 2500); return }
    iptal.current = false
    setToplu({ urunAd: p.name, stil, ogeler, calisiyor: true, kaydediyor: false, hata: '' })
    topluCalistir(ogeler, stil)
  }
  async function topluCalistir(ogeler: TopluOge[], stil: GorselStil) {
    for (const o of ogeler) {
      if (iptal.current) return
      setToplu(t => t && { ...t, ogeler: t.ogeler.map(x => x.key === o.key ? { ...x, durum: 'isleniyor' } : x) })
      try {
        const r: any = await aiIstek('urun_gorsel_tasarim', { url: o.url, stil })
        if (iptal.current) return
        setToplu(t => t && { ...t, ogeler: t.ogeler.map(x => x.key === o.key ? { ...x, durum: 'tamam', b64: r.b64, secili: true } : x) })
      } catch (e: any) {
        if (iptal.current) return
        const limit = /saatlik sınır/i.test(e.message || '')
        setToplu(t => t && { ...t, hata: limit ? 'Saatlik AI görsel sınırına ulaşıldı; kalanlar işlenmedi, biraz sonra tekrar dene.' : t.hata, ogeler: t.ogeler.map(x => x.key === o.key ? { ...x, durum: 'hata' } : x) })
        if (limit) break
      }
    }
    setToplu(t => t && { ...t, calisiyor: false })
  }
  async function topluKaydet() {
    if (!toplu) return
    setToplu({ ...toplu, kaydediyor: true, hata: '' })
    let hata = 0
    for (const o of toplu.ogeler.filter(x => x.secili && x.b64)) {
      try { await aiIstek(o.tur === 'urun' ? 'urun_gorsel_kaydet' : 'varyant_gorsel_kaydet', o.tur === 'urun' ? { urun_id: o.id, b64: o.b64 } : { variant_id: o.id, b64: o.b64 }) } catch { hata++ }
    }
    yukle()
    if (hata) { setToplu(t => t && { ...t, kaydediyor: false, hata: `${hata} görsel kaydedilemedi.` }); return }
    setToplu(null); setToast('Görseller güncellendi'); setTimeout(() => setToast(''), 2500)
  }
  function topluKapat() { iptal.current = true; setToplu(null) }

  async function aiKaydet() {
    if (!ai?.b64) return
    setAi({ ...ai, kayit: true })
    try {
      await aiIstek(ai.tur === 'urun' ? 'urun_gorsel_kaydet' : 'varyant_gorsel_kaydet', ai.tur === 'urun' ? { urun_id: ai.id, b64: ai.b64 } : { variant_id: ai.id, b64: ai.b64 })
      setAi(null); setToast('Görsel güncellendi'); setTimeout(() => setToast(''), 2500); yukle()
    } catch (e: any) { setToast(e.message || 'Kaydedilemedi'); setTimeout(() => setToast(''), 3500); setAi({ ...ai, kayit: false }) }
  }

  const varyantlar: Record<string, any[]> = {}
  for (const v of variants) (varyantlar[v.product_id] ||= []).push(v)

  function copy(url: string) {
    navigator.clipboard.writeText(url)
    setToast('URL kopyalandı')
    setTimeout(() => setToast(''), 2000)
  }

  const q = search.toLowerCase()
  const filtered = products.filter(p =>
    !search || p.name?.toLowerCase().includes(q) || p.code?.toLowerCase().includes(q) ||
    (varyantlar[p.id] || []).some(v => (v.name || '').toLowerCase().includes(q) || (v.color || '').toLowerCase().includes(q))
  )

  return (
    <div style={{ flex: 1, overflow: 'auto' }}>
      <AdminTopBar title="Ürün Görselleri" />
      <div style={{ padding: 24 }}>
        <div style={{ marginBottom: 20 }}>
          <input className="adm-inp" placeholder="Ürün ara..." value={search}
            onChange={e => setSearch(e.target.value)} style={{ maxWidth: 320 }} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12 }}>
          {filtered.map(p => (
            <div key={p.code} className="adm-card" style={{ padding: 0, overflow: 'hidden' }}>
              <div onClick={() => topluBaslat(p)} title="Tıkla: ana görsel ve tüm varyantlar AI ile yeniden tasarlansın" style={{ aspectRatio: '1', background: 'var(--adm-s2)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, position: 'relative', cursor: 'pointer' }}>
                {p.image_url ? (
                  <img src={p.image_url} alt={p.name}
                    style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                ) : (
                  <Package size={32} style={{ color: 'var(--adm-tx3)' }} />
                )}
                {p.is_new && (
                  <span className="adm-badge badge-green" style={{ position: 'absolute', top: 8, right: 8, fontSize: 9 }}>YENİ</span>
                )}
              </div>
              <div style={{ padding: '10px 12px' }}>
                <p style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--adm-tx)', marginBottom: 2 }}>{p.name}</p>
                <p style={{ fontSize: 10.5, color: 'var(--adm-tx3)', marginBottom: 8 }}>
                  <code style={{ color: 'var(--adm-ac)' }}>{p.code}</code> · {p.category}
                </p>
                {(varyantlar[p.id] || []).length > 0 && (
                  <div style={{ marginBottom: 8 }}>
                    <p style={{ fontSize: 10.5, color: 'var(--adm-tx3)', marginBottom: 4 }}>
                      Varyantlar ({(varyantlar[p.id] || []).filter(v => v.gorsel).length}/{(varyantlar[p.id] || []).length} görselli)
                    </p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                      {(varyantlar[p.id] || []).map(v => v.gorsel ? (
                        <span key={v.id} style={{ position: 'relative', display: 'inline-block' }}>
                          <button onClick={() => copy(v.gorsel)} title={`${v.name}${v.color ? ' · ' + v.color : ''} — URL'yi kopyala`}
                            style={{ width: 38, height: 38, padding: 2, border: '1px solid var(--adm-bdr)', borderRadius: 6, background: 'var(--adm-s2)', cursor: 'pointer' }}>
                            <img src={v.gorsel} alt={v.name} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }} />
                          </button>
                          <button onClick={() => aiUret({ tur: 'varyant', id: v.id, ad: `${p.name} — ${v.name}`, url: v.gorsel, stil: 'studyo', b64: null, busy: true, kayit: false }, 'studyo')} title="AI ile yeniden tasarla" aria-label="AI ile yeniden tasarla"
                            style={{ position: 'absolute', right: -3, bottom: -3, width: 16, height: 16, padding: 0, borderRadius: 8, border: '1px solid var(--adm-bdr2)', background: 'var(--adm-s1)', color: 'var(--adm-ac)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Wand2 size={9} />
                          </button>
                        </span>
                      ) : (
                        <span key={v.id} title={`${v.name}${v.color ? ' · ' + v.color : ''} — görsel yok`}
                          style={{ width: 38, height: 38, border: '1px dashed var(--adm-bdr2)', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', background: v.hex || 'transparent', color: 'var(--adm-tx3)', fontSize: 9 }}>
                          {v.hex ? '' : '—'}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {p.image_url ? (
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button className="adm-btn-ghost" style={{ flex: 1, justifyContent: 'center', fontSize: 11, padding: '5px 0' }}
                      onClick={() => copy(p.image_url)}>
                      <Copy size={11} /> Kopyala
                    </button>
                    <button className="adm-btn-ghost" style={{ padding: '5px 8px' }} title="AI ile yeniden tasarla" aria-label="AI ile yeniden tasarla"
                      onClick={() => aiUret({ tur: 'urun', id: p.id, ad: p.name, url: p.image_url, stil: 'studyo', b64: null, busy: true, kayit: false }, 'studyo')}>
                      <Wand2 size={11} />
                    </button>
                    <a href={p.image_url} target="_blank" rel="noopener noreferrer nofollow"
                      className="adm-btn-ghost" style={{ padding: '5px 8px' }}>
                      <ExternalLink size={11} />
                    </a>
                  </div>
                ) : (
                  <p style={{ fontSize: 11, color: 'var(--adm-tx3)', textAlign: 'center' }}>Görsel yok</p>
                )}
              </div>
            </div>
          ))}
        </div>

        {filtered.length === 0 && (
          <p style={{ textAlign: 'center', color: 'var(--adm-tx3)', padding: 60 }}>Ürün bulunamadı</p>
        )}
      </div>
      <Modal open={!!ai} onClose={() => { if (!ai?.busy && !ai?.kayit) setAi(null) }} width={640} title={ai ? `AI ile Yeniden Tasarla — ${ai.ad}` : 'AI'}
        footer={<>
          <button type="button" className="adm-btn-ghost" disabled={ai?.kayit} onClick={() => setAi(null)}>{ai?.b64 ? 'Vazgeç' : 'İptal'}</button>
          {ai?.b64 && <button type="button" className="adm-btn-ghost" disabled={ai.busy || ai.kayit} onClick={() => ai && aiUret(ai, ai.stil)}><RotateCcw size={13} />Tekrar Dene</button>}
          {ai?.b64 && <button type="button" className="adm-btn" disabled={ai.kayit} onClick={aiKaydet}>{ai.kayit ? 'Kaydediliyor…' : 'Bu Görseli Kullan'}</button>}
        </>}>
        <p style={{ fontSize: 12, color: 'var(--adm-tx3)', margin: '0 0 12px' }}>Ürünün şekli ve rengi korunmaya çalışılır, çevresi AI ile yeniden oluşturulur. Sonucu mutlaka mevcut görselle karşılaştır; ürün değişmişse "Vazgeç" de.</p>
        <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
          {(Object.keys(GORSEL_STIL) as GorselStil[]).map(k => (
            <button key={k} type="button" className={ai?.stil === k ? 'adm-chip on' : 'adm-chip'} disabled={ai?.busy || ai?.kayit} onClick={() => ai && aiUret(ai, k)}>{GORSEL_STIL[k]}</button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 14, alignItems: 'center', justifyContent: 'center', minHeight: 260 }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 11, color: 'var(--adm-tx3)', marginBottom: 6 }}>Mevcut</div>
            {ai && <img src={ai.url} alt="" style={{ width: 220, height: 220, objectFit: 'contain', borderRadius: 12, background: 'var(--adm-s2)', padding: 8 }} />}
          </div>
          <div style={{ fontSize: 20, color: 'var(--adm-tx3)' }}>→</div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 11, color: 'var(--adm-tx3)', marginBottom: 6 }}>AI önerisi</div>
            {ai?.busy ? <div style={{ width: 220, height: 220, borderRadius: 12, background: 'var(--adm-s2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: 'var(--adm-tx3)' }}>Oluşturuluyor…</div>
              : ai?.b64 ? <img src={`data:image/png;base64,${ai.b64}`} alt="" style={{ width: 220, height: 220, objectFit: 'contain', borderRadius: 12, background: 'var(--adm-s2)', padding: 8 }} />
              : <div style={{ width: 220, height: 220, borderRadius: 12, background: 'var(--adm-s2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><ImagePlus size={26} style={{ color: 'var(--adm-tx3)' }} /></div>}
          </div>
        </div>
      </Modal>
      <Modal open={!!toplu} onClose={() => { if (!toplu?.kaydediyor) topluKapat() }} width={760} title={toplu ? `AI ile Tüm Görseller — ${toplu.urunAd}` : 'AI'}
        footer={toplu && <>
          <button type="button" className="adm-btn-ghost" disabled={toplu.kaydediyor} onClick={topluKapat}>{toplu.calisiyor ? 'Durdur ve Kapat' : 'Vazgeç'}</button>
          {!toplu.calisiyor && <button type="button" className="adm-btn-ghost" disabled={toplu.kaydediyor} onClick={() => topluBaslat({ name: toplu.urunAd }, toplu.stil, toplu.ogeler)}><RotateCcw size={13} />Hepsini Yeniden Üret</button>}
          {!toplu.calisiyor && <button type="button" className="adm-btn" disabled={toplu.kaydediyor || !toplu.ogeler.some(o => o.secili && o.b64)} onClick={topluKaydet}>{toplu.kaydediyor ? 'Kaydediliyor…' : `Seçilenleri Kullan (${toplu.ogeler.filter(o => o.secili && o.b64).length})`}</button>}
        </>}>
        {toplu && <>
          <p style={{ fontSize: 12, color: 'var(--adm-tx3)', margin: '0 0 10px' }}>Ürünün ana görseli ve fotoğrafı olan tüm varyantları sırayla yeniden tasarlanır. Üretim bitince her sonucu eskisiyle karşılaştır, bozulanların işaretini kaldır, kalanları kaydet.</p>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            {(Object.keys(GORSEL_STIL) as GorselStil[]).map(k => (
              <button key={k} type="button" className={toplu.stil === k ? 'adm-chip on' : 'adm-chip'} disabled={toplu.calisiyor || toplu.kaydediyor} onClick={() => topluBaslat({ name: toplu.urunAd }, k, toplu.ogeler)}>{GORSEL_STIL[k]}</button>
            ))}
            <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--adm-tx3)', alignSelf: 'center' }}>{toplu.ogeler.filter(o => o.durum === 'tamam' || o.durum === 'hata').length}/{toplu.ogeler.length}</span>
          </div>
          {toplu.hata && <p style={{ fontSize: 12, color: 'var(--adm-red)', margin: '0 0 10px' }}>{toplu.hata}</p>}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10, maxHeight: '55vh', overflowY: 'auto' }}>
            {toplu.ogeler.map(o => (
              <div key={o.key} style={{ border: '1px solid var(--adm-bdr)', borderRadius: 10, padding: 8, background: 'var(--adm-s1)' }}>
                <div style={{ fontSize: 11.5, fontWeight: 600, marginBottom: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.ad}</div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <img src={o.url} alt="" style={{ width: '50%', aspectRatio: '1', objectFit: 'contain', borderRadius: 8, background: 'var(--adm-s2)' }} />
                  {o.b64 ? <img src={`data:image/png;base64,${o.b64}`} alt="" style={{ width: '50%', aspectRatio: '1', objectFit: 'contain', borderRadius: 8, background: 'var(--adm-s2)' }} />
                    : <div style={{ width: '50%', aspectRatio: '1', borderRadius: 8, background: 'var(--adm-s2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10.5, color: o.durum === 'hata' ? 'var(--adm-red)' : 'var(--adm-tx3)', textAlign: 'center' }}>{o.durum === 'isleniyor' ? 'Oluşturuluyor…' : o.durum === 'hata' ? 'Hata' : 'Sırada'}</div>}
                </div>
                {o.b64 && <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, marginTop: 6, cursor: 'pointer' }}>
                  <input type="checkbox" checked={o.secili} disabled={toplu.kaydediyor} onChange={e => setToplu(t => t && { ...t, ogeler: t.ogeler.map(x => x.key === o.key ? { ...x, secili: e.target.checked } : x) })} /> Kullan
                </label>}
              </div>
            ))}
          </div>
        </>}
      </Modal>
      {toast && <div className="adm-toast">✓ {toast}</div>}
    </div>
  )
}
