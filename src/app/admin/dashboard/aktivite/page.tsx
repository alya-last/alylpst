'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import AdminTopBar from '@/components/admin/TopBar'
import { Activity, Package, MessageSquare, Settings, Eye, Tag, Palette, Users } from 'lucide-react'

const sb = createClient()

const ICONS: Record<string,any> = {
  products: Package, contact_submissions: MessageSquare,
  settings: Settings, site_visits: Eye, categories: Tag,
  product_variants: Palette, personel: Users,
}

const ACTION_LABELS: Record<string,{l:string;c:string}> = {
  insert: {l:'Eklendi',    c:'var(--adm-green)'},
  update: {l:'Güncellendi',c:'var(--adm-blue)'},
  delete: {l:'Silindi',    c:'var(--adm-red)'},
  upsert: {l:'Kaydedildi', c:'var(--adm-amber)'},
}

export default function AdminAktivitePage() {
  const [logs, setLogs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({ total:0, today:0 })

  useEffect(() => {
    async function load() {
      const today = new Date().toISOString().split('T')[0]
      const [{ data }, { count:tc }, { count:dc }] = await Promise.all([
        sb.from('admin_activity').select('*').order('created_at', {ascending:false}).limit(100),
        sb.from('admin_activity').select('id', {count:'exact',head:true} as any),
        sb.from('admin_activity').select('id', {count:'exact',head:true} as any).gte('created_at', today+'T00:00:00'),
      ])
      setLogs(data||[])
      setStats({ total:tc||0, today:dc||0 })
      setLoading(false)
    }
    load()
  }, [])

  const relativeTime = (iso: string) => {
    const diff = Date.now() - new Date(iso).getTime()
    const m = Math.floor(diff/60000)
    if (m < 1) return 'Az önce'
    if (m < 60) return `${m} dk önce`
    const h = Math.floor(m/60)
    if (h < 24) return `${h} saat önce`
    return new Date(iso).toLocaleDateString('tr')
  }

  return (
    <div style={{ flex:1, overflow:'auto' }}>
      <AdminTopBar title="Aktivite Logu"/>
      <div style={{ padding:24 }}>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))', gap:12, marginBottom:24 }}>
          {[
            { label:'Toplam İşlem', value:stats.total, color:'var(--adm-ac)' },
            { label:'Bugünkü İşlem', value:stats.today, color:'var(--adm-green)' },
          ].map(s => (
            <div key={s.label} className="adm-kpi" style={{ borderLeft:`2.5px solid ${s.color}` }}>
              <p className="adm-kpi-label">{s.label}</p>
              <p className="adm-kpi-value" style={{ fontSize:28, color:s.color }}>{s.value}</p>
            </div>
          ))}
        </div>

        <div className="adm-card">
          <div className="adm-card-h">
            <span style={{ display:'flex', alignItems:'center', gap:8 }}>
              <Activity size={14} style={{ color:'var(--adm-ac)' }}/>Son 100 İşlem
            </span>
          </div>
          {loading ? (
            <p style={{ padding:40, textAlign:'center', color:'var(--adm-tx3)' }}>Yükleniyor...</p>
          ) : logs.length===0 ? (
            <div style={{ padding:60, textAlign:'center' }}>
              <Activity size={32} style={{ color:'var(--adm-tx3)', marginBottom:12 }}/>
              <p style={{ color:'var(--adm-tx3)', fontSize:13 }}>Henüz aktivite yok</p>
              <p style={{ color:'var(--adm-tx3)', fontSize:12, marginTop:4 }}>Ürün ekle, başvuru güncelle — işlemler burada görünecek</p>
            </div>
          ) : logs.map(log => {
            const Icon = ICONS[log.table_name] || Activity
            const act = ACTION_LABELS[log.action] || {l:log.action, c:'var(--adm-tx3)'}
            return (
              <div key={log.id} className="adm-row">
                <div style={{ width:34, height:34, borderRadius:9, background:'var(--adm-s3)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                  <Icon size={14} style={{ color:'var(--adm-tx3)' }}/>
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <p style={{ fontSize:13, fontWeight:600, color:'var(--adm-tx)' }}>
                    {log.details?.name || log.table_name}
                  </p>
                  <p style={{ fontSize:11.5, color:'var(--adm-tx3)' }}>
                    {log.table_name} · {log.details?.code || log.record_id?.slice(0,8)}
                  </p>
                </div>
                <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:4, flexShrink:0 }}>
                  <span className="adm-badge" style={{ background:act.c+'22', color:act.c }}>{act.l}</span>
                  <span style={{ fontSize:10.5, color:'var(--adm-tx3)' }}>{relativeTime(log.created_at)}</span>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
