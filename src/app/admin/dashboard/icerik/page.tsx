'use client'
import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import AdminTopBar from '@/components/admin/TopBar'
import { Save, Eye, RefreshCw } from 'lucide-react'

const sb = createClient()

const CONTENT_KEYS = [
  { key:'hero_title',     label:'Hero Ana Başlık',       desc:'Ana sayfanın büyük başlığı', multiline:false },
  { key:'hero_subtitle',  label:'Hero Alt Başlık',        desc:'Hero bölümü açıklama metni', multiline:false },
  { key:'marquee_text',   label:'Kayan Yazı',             desc:'Ortadaki kayan band metni (• ile ayır)', multiline:false },
  { key:'why_quote',      label:'Alıntı Metni',           desc:'Why bölümündeki italik alıntı', multiline:true },
  { key:'contact_title',  label:'İletişim Başlık',        desc:'İletişim formu üstündeki başlık', multiline:false },
]

export default function AdminIcerikPage() {
  const [blocks, setBlocks] = useState<Record<string,string>>({})
  const [saving, setSaving] = useState<string|null>(null)
  const [toast, setToast] = useState('')
  const [loading, setLoading] = useState(true)

  const showToast = (msg:string) => { setToast(msg); setTimeout(()=>setToast(''),3000) }

  const load = useCallback(async () => {
    const { data } = await sb.from('content_blocks').select('key,body').order('key', {ascending:true})
    const map: Record<string,string> = {}
    ;(data||[]).forEach((d:any) => { map[d.key] = d.body })
    setBlocks(map)
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function saveBlock(key: string) {
    setSaving(key)
    await sb.from('content_blocks').upsert({ key, body: blocks[key], updated_at: new Date().toISOString() })
    setSaving(null)
    showToast('Kaydedildi')
  }

  return (
    <div style={{ flex:1, overflow:'auto' }}>
      <AdminTopBar title="İçerik Yönetimi"/>
      <div style={{ padding:24, maxWidth:800 }}>

        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
          <p style={{ fontSize:13, color:'var(--adm-tx3)' }}>
            Site üzerindeki metinleri buradan düzenleyebilirsin. Kaydettiğinde site otomatik güncellenir.
          </p>
          <a href="https://alyatest-alyis.vercel.app" target="_blank" rel="noopener noreferrer nofollow"
            className="adm-btn-ghost" style={{ fontSize:12, flexShrink:0 }}>
            <Eye size={13}/>Siteyi Gör
          </a>
        </div>

        {loading ? (
          <p style={{ textAlign:'center', color:'var(--adm-tx3)', padding:60 }}>Yükleniyor...</p>
        ) : CONTENT_KEYS.map(item => (
          <div key={item.key} className="adm-card" style={{ marginBottom:14 }}>
            <div className="adm-card-h">
              <div>
                <span style={{ fontSize:13.5, fontWeight:700, color:'var(--adm-tx)' }}>{item.label}</span>
                <p style={{ fontSize:11.5, color:'var(--adm-tx3)', marginTop:2 }}>{item.desc}</p>
              </div>
              <button className="adm-btn" style={{ fontSize:12, padding:'6px 14px' }}
                onClick={() => saveBlock(item.key)} disabled={saving===item.key}>
                {saving===item.key ? <RefreshCw size={12} className="spin"/> : <Save size={12}/>}
                {saving===item.key ? 'Kaydediliyor' : 'Kaydet'}
              </button>
            </div>
            <div style={{ padding:16 }}>
              {item.multiline ? (
                <textarea className="adm-inp" rows={4}
                  value={blocks[item.key]||''}
                  onChange={e => setBlocks(b => ({...b, [item.key]:e.target.value}))}/>
              ) : (
                <input className="adm-inp"
                  value={blocks[item.key]||''}
                  onChange={e => setBlocks(b => ({...b, [item.key]:e.target.value}))}/>
              )}
              <p style={{ fontSize:11, color:'var(--adm-tx3)', marginTop:6 }}>
                <code style={{ color:'var(--adm-ac)', fontSize:10 }}>{item.key}</code> · {(blocks[item.key]||'').length} karakter
              </p>
            </div>
          </div>
        ))}
      </div>
      {toast && <div className="adm-toast">✓ {toast}</div>}
    </div>
  )
}
