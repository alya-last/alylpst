'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import AdminTopBar from '@/components/admin/TopBar'
import { Copy, Package, ExternalLink } from 'lucide-react'

const sb = createClient()

export default function GorsellerPage() {
  const [products, setProducts] = useState<any[]>([])
  const [search, setSearch] = useState('')
  const [variants, setVariants] = useState<any[]>([])
  const [toast, setToast] = useState('')

  useEffect(() => {
    sb.from('products').select('id,code,name,image_url,category,is_new').order('sort_order').then(({ data }) => setProducts(data || []))
    sb.from('product_variants').select('id,product_id,name,color,hex,gorsel,sort_order').order('sort_order').then(({ data }) => setVariants(data || []))
  }, [])

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
              <div style={{ aspectRatio: '1', background: 'var(--adm-s2)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, position: 'relative' }}>
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
                        <button key={v.id} onClick={() => copy(v.gorsel)} title={`${v.name}${v.color ? ' · ' + v.color : ''} — URL'yi kopyala`}
                          style={{ width: 38, height: 38, padding: 2, border: '1px solid var(--adm-bdr)', borderRadius: 6, background: 'var(--adm-s2)', cursor: 'pointer' }}>
                          <img src={v.gorsel} alt={v.name} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }} />
                        </button>
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
      {toast && <div className="adm-toast">✓ {toast}</div>}
    </div>
  )
}
