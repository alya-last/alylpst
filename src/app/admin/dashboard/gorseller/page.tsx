'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import AdminTopBar from '@/components/admin/TopBar'
import { Copy, Package, ExternalLink } from 'lucide-react'

const sb = createClient()

export default function GorsellerPage() {
  const [products, setProducts] = useState<any[]>([])
  const [search, setSearch] = useState('')
  const [toast, setToast] = useState('')

  useEffect(() => {
    sb.from('products').select('code,name,image_url,category,is_new').order('sort_order').then(({ data }) => setProducts(data || []))
  }, [])

  function copy(url: string) {
    navigator.clipboard.writeText(url)
    setToast('URL kopyalandı')
    setTimeout(() => setToast(''), 2000)
  }

  const filtered = products.filter(p =>
    !search || p.name?.toLowerCase().includes(search.toLowerCase()) || p.code?.toLowerCase().includes(search.toLowerCase())
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
