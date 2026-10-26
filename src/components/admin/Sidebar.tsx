'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import SifreDegistir from './SifreDegistir'
import MfaAyar from './MfaAyar'
import { useEffect, useState } from 'react'
import { Calculator, GraduationCap, Target, Scale, Building2, Share2, LayoutDashboard, Package, Tag, MessageSquare, Settings, BarChart2, TrendingUp, Eye, Image, LogOut, ExternalLink, FileText, Bell, Activity, Layers, DollarSign, Receipt, Users2, PieChart, Landmark, FileSignature, Warehouse, Boxes, ArrowLeftRight, Cog, Wrench, FlaskConical, Factory, Zap, ClipboardList, PackageSearch, Truck, ShieldCheck, FlameKindling, UserCog, ScanLine, Sparkles, KeyRound, Palette, BookOpen, Database } from 'lucide-react'

const NAV = [
  { g:'Genel', mod:['dashboard'], items:[
    { href:'/admin/dashboard',              label:'Dashboard',       Icon:LayoutDashboard, mod:['dashboard'] },
    { href:'/admin/dashboard/analytics',    label:'Analitik',        Icon:TrendingUp,      mod:['dashboard'] },
    { href:'/admin/dashboard/istatistik',   label:'İstatistikler',   Icon:BarChart2,       mod:['dashboard'] },
    { href:'/admin/dashboard/asistan',      label:'AI Asistan',      Icon:Sparkles,        mod:['dashboard','muhasebe','stok','uretim','satis','satinalma','sevkiyat','kalite','yonetim','sosyal'] },
    { href:'/admin/dashboard/gunluk-ozet',   label:'Günlük Özet',     Icon:Bell,            mod:['dashboard','muhasebe','stok','uretim','satis','satinalma','sevkiyat','kalite','yonetim','sosyal'] },
    { href:'/admin/dashboard/yardim',       label:'Başlangıç Rehberi', Icon:GraduationCap, mod:['dashboard','muhasebe','muhasebe_cari','stok','uretim','satis','satinalma','sevkiyat','kalite','yonetim','sosyal','personel'] },
    { href:'/admin/dashboard/aktivite',     label:'Aktivite Logu',   Icon:Activity,        mod:['yonetim'] },
  ]},
  { g:'Ürün Yönetimi', mod:['yonetim','sosyal'], items:[
    { href:'/admin/dashboard/urunler',      label:'Ürünler',         Icon:Package, mod:['yonetim'] },
    { href:'/admin/dashboard/kategoriler',  label:'Kategoriler',     Icon:Tag,     mod:['yonetim'] },
    { href:'/admin/dashboard/varyantlar',   label:'Varyantlar',      Icon:Layers,  mod:['yonetim'] },
    { href:'/admin/dashboard/gorseller',    label:'Görseller',       Icon:Image,   mod:['yonetim'] },
    { href:'/admin/dashboard/katalog',      label:'Katalog',         Icon:BookOpen,mod:['yonetim'] },
    { href:'/admin/dashboard/sosyal-medya', label:'Sosyal Medya',    Icon:Share2,  mod:['sosyal','yonetim'] },
  ]},
  { g:'Müşteri', mod:['dashboard','satis','yonetim'], items:[
    { href:'/admin/dashboard/basvurular',   label:'Başvurular',      Icon:MessageSquare, mod:['dashboard'] },
    { href:'/admin/dashboard/potansiyel-musteriler', label:'Potansiyel Müşteriler', Icon:Target, mod:['satis','yonetim'] },
    { href:'/admin/dashboard/ziyaretciler', label:'Ziyaretçiler',    Icon:Eye,           mod:['dashboard'] },
  ]},
  { g:'Muhasebe', mod:['muhasebe','muhasebe_cari'], items:[
    { href:'/admin/dashboard/muhasebe/genel',    label:'Genel Bakış',  Icon:DollarSign,  mod:['muhasebe'] },
    { href:'/admin/dashboard/muhasebe/islemler', label:'Gelir/Gider',  Icon:TrendingUp,  mod:['muhasebe'] },
    { href:'/admin/dashboard/muhasebe/faturalar',label:'Faturalar',    Icon:Receipt,     mod:['muhasebe'] },
    { href:'/admin/dashboard/muhasebe/cari',     label:'Cari Hesaplar',Icon:Users2,      mod:['muhasebe','muhasebe_cari'] },
    { href:'/admin/dashboard/muhasebe/kasa-banka',label:'Kasa/Banka',  Icon:Landmark,    mod:['muhasebe'] },
    { href:'/admin/dashboard/muhasebe/banka-ekstresi',label:'Banka Ekstresi', Icon:Landmark, mod:['muhasebe'] },
    { href:'/admin/dashboard/muhasebe/cek-senet', label:'Çek/Senet',   Icon:FileSignature,mod:['muhasebe'] },
    { href:'/admin/dashboard/muhasebe/fiyat-listeleri', label:'Fiyat Listeleri', Icon:Tag, mod:['muhasebe','satis'] },
    { href:'/admin/dashboard/muhasebe/raporlar', label:'Raporlar',     Icon:PieChart,    mod:['muhasebe'] },
    { href:'/admin/dashboard/muhasebe/ai', label:'Muhasebe AI', Icon:Sparkles, mod:['muhasebe'] },
    { href:'/admin/dashboard/muhasebe/pos-tahsilat', label:'POS Tahsilatları', Icon:Landmark, mod:['muhasebe'] },
    { href:'/admin/dashboard/muhasebe/kira-plani', label:'Kira Planı', Icon:Building2, mod:['muhasebe'] },
    { href:'/admin/dashboard/muhasebe/ai-egit', label:'Yapay Zekayı Eğit', Icon:GraduationCap, mod:['muhasebe'] },
  ]},
  { g:'Personel', mod:['personel'], items:[
    { href:'/admin/dashboard/personel', label:'Giriş-Çıkış / Puantaj', Icon:Users2, mod:['personel'] },
  ]},
  { g:'Stok / Depo', mod:['stok'], items:[
    { href:'/admin/dashboard/stok/depo',       label:'Depolar',           Icon:Warehouse,     mod:['stok'] },
    { href:'/admin/dashboard/stok/hammadde',   label:'Hammadde',          Icon:Boxes,         mod:['stok'] },
    { href:'/admin/dashboard/stok/hareketler', label:'Stok Hareketleri',  Icon:ArrowLeftRight,mod:['stok'] },
    { href:'/admin/dashboard/stok/barkod',     label:'Barkod ile İşlem',  Icon:ScanLine,      mod:['stok'] },
  ]},
  { g:'Üretim', mod:['uretim'], items:[
    { href:'/admin/dashboard/uretim/makine',  label:'Makineler',        Icon:Cog,          mod:['uretim'] },
    { href:'/admin/dashboard/uretim/kalip',   label:'Kalıplar',         Icon:Wrench,       mod:['uretim'] },
    { href:'/admin/dashboard/uretim/recete',  label:'BOM / Reçeteler',  Icon:FlaskConical, mod:['uretim'] },
    { href:'/admin/dashboard/uretim/maliyet', label:'Ürün Maliyeti',    Icon:Calculator,   mod:['uretim'] },
    { href:'/admin/dashboard/uretim/emirler', label:'Üretim Emirleri',  Icon:Factory,      mod:['uretim'] },
    { href:'/admin/dashboard/uretim/canli',   label:'Canlı Üretim',     Icon:Zap,          mod:['uretim'] },
  ]},
  { g:'Satış / Lojistik', mod:['satis','satinalma','sevkiyat'], items:[
    { href:'/admin/dashboard/satis/siparisler',       label:'Satış Siparişleri',    Icon:ClipboardList, mod:['satis'] },
    { href:'/admin/dashboard/satis/teklifler', label:'Fiyat Teklifleri', Icon:FileSignature, mod:['satis'] },
    { href:'/admin/dashboard/satis/ihracat-evraklari', label:'İhracat Evrakları', Icon:FileText, mod:['satis','sevkiyat'] },
    { href:'/admin/dashboard/satinalma/siparisler',   label:'Satınalma Siparişleri',Icon:PackageSearch, mod:['satinalma'] },
    { href:'/admin/dashboard/satinalma/iade-ret', label:'İade / Ret', Icon:PackageSearch, mod:['satinalma'] },
    { href:'/admin/dashboard/satinalma/talepler',     label:'Talepler / Teklifler',Icon:Scale, mod:['satinalma'] },
    { href:'/admin/dashboard/satinalma/tedarikciler',  label:'Tedarikçiler',        Icon:Building2, mod:['satinalma'] },
    { href:'/admin/dashboard/sevkiyat',               label:'Sevkiyat / İhracat',   Icon:Truck,         mod:['sevkiyat','stok'] },
  ]},
  { g:'Site Yönetimi', mod:['yonetim'], items:[
    { href:'/admin/dashboard/icerik',       label:'İçerik',          Icon:FileText, mod:['yonetim'] },
    { href:'/admin/dashboard/tema',         label:'Tema Yönetimi',   Icon:Palette,  mod:['yonetim'] },
    { href:'/admin/dashboard/kullanicilar', label:'Kullanıcılar',    Icon:UserCog,  mod:['yonetim'] },
    { href:'/admin/dashboard/ayarlar',      label:'Ayarlar',         Icon:Settings, mod:['yonetim'] },
    { href:'/admin/dashboard/yedek',        label:'Sistem Yedeği',   Icon:Database, mod:['yonetim'] },
    { href:'/admin/dashboard/bildirimler',  label:'Bildirimler',     Icon:Bell,     mod:['yonetim'] },
  ]},
]

export default function AdminSidebar({ onClose }: { onClose?: () => void } = {}) {
  const pathname = usePathname()
  const [init, setInit] = useState('AP')
  const [name, setName] = useState('Admin')
  const [email, setEmail] = useState('')
  const [sifreAcik, setSifreAcik] = useState(false)
  const [mfaAcik, setMfaAcik] = useState(false)
  const [moduller, setModuller] = useState<string[]>([])

  useEffect(() => {
    const sb = createClient()
    sb.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return
      const n = user.email?.split('@')[0] || 'Admin'
      setName(n); setInit(n.slice(0,2).toUpperCase()); setEmail(user.email || '')

      const { data: profile } = await sb.from('admin_profiles').select('role_id').eq('id', user.id).single()
      if (profile?.role_id) {
        const { data: role } = await sb.from('roller').select('moduller').eq('id', profile.role_id).single()
        setModuller(role?.moduller || [])
      }
    }).catch(()=>{})
  }, [])

  const hasAccess = (mod: string[]) => moduller.includes('*') || mod.some(m => moduller.includes(m))
  const visibleNav = NAV
    .map(sec => ({ ...sec, items: sec.items.filter(i => hasAccess(i.mod)) }))
    .filter(sec => sec.items.length > 0)

  const active = (href: string) => href === '/admin/dashboard' ? pathname === href : pathname.startsWith(href)

  return (
    <aside className="adm-sb">
      <div className="adm-sb-logo">
        <div style={{ width:34,height:34,borderRadius:9,background:'var(--adm-ac)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0 }}>
          <svg width="16" height="16" fill="none" stroke="#fff" strokeWidth="2.2" viewBox="0 0 24 24">
            <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
          </svg>
        </div>
        <div>
          <p style={{ fontSize:13,fontWeight:700,color:'var(--adm-tx)',letterSpacing:'-.2px',lineHeight:1.2 }}>Alya Plastik</p>
          <p style={{ fontSize:9.5,color:'var(--adm-tx3)',marginTop:2 }}>Admin Panel</p>
        </div>
      </div>

      <nav className="adm-sb-nav">
        {visibleNav.map(sec => (
          <div key={sec.g}>
            <p className="adm-sb-group">{sec.g}</p>
            {sec.items.map(({ href, label, Icon }) => (
              <Link key={href} href={href} className={`adm-sb-item ${active(href)?'active':''}`} onClick={onClose}>
                <span style={{ width:20,display:'flex',justifyContent:'center',flexShrink:0 }}><Icon size={14} strokeWidth={1.8}/></span>
                <span style={{ flex:1 }}>{label}</span>
              </Link>
            ))}
          </div>
        ))}
        <div>
          <p className="adm-sb-group">Site</p>
          <a href="/" target="_blank" rel="noopener noreferrer nofollow" className="adm-sb-item">
            <span style={{ width:20,display:'flex',justifyContent:'center' }}><ExternalLink size={14} strokeWidth={1.8}/></span>
            <span style={{ flex:1 }}>Siteyi Gör</span>
          </a>
        </div>
      </nav>

      <div className="adm-sb-user" style={{ cursor:'default', flexDirection:'column', alignItems:'stretch', gap:8 }}>
        <div style={{ display:'flex', alignItems:'center', gap:9 }}>
          <div className="adm-sb-av">{init}</div>
          <div style={{ flex:1,minWidth:0 }}>
            <p style={{ fontSize:12.5,fontWeight:600,color:'var(--adm-tx)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>{name}</p>
            <p style={{ fontSize:10,color:'var(--adm-tx3)',marginTop:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>{email}</p>
          </div>
        </div>
        <button type="button" className="adm-btn-ghost" style={{ width:'100%', justifyContent:'center', fontSize:11.5, padding:'6px 8px', marginBottom:6 }} onClick={() => setMfaAcik(true)}><ShieldCheck size={12} strokeWidth={1.8}/>İki adımlı doğrulama</button>
        <div style={{ display:'flex', gap:6 }}>
          <button type="button" className="adm-btn-ghost" style={{ flex:1, justifyContent:'center', fontSize:11.5, padding:'6px 8px' }} onClick={() => setSifreAcik(true)}><KeyRound size={12} strokeWidth={1.8}/>Şifre değiştir</button>
          <button type="button" className="adm-btn-ghost" style={{ flex:1, justifyContent:'center', fontSize:11.5, padding:'6px 8px' }} onClick={async () => { await createClient().auth.signOut(); window.location.href = '/admin/login' }}><LogOut size={12} strokeWidth={1.8}/>Çıkış yap</button>
        </div>
        <button type="button" className="adm-btn-ghost" style={{ width:'100%', justifyContent:'center', fontSize:11.5, padding:'6px 8px', marginTop:6 }} onClick={async () => { if (!window.confirm('Tüm cihazlardaki oturumlar kapatılacak (bu cihaz dahil). Devam edilsin mi?')) return; await createClient().auth.signOut({ scope: 'global' }).catch(() => {}); window.location.href = '/admin/login' }}><LogOut size={12} strokeWidth={1.8}/>Tüm oturumları kapat</button>
      </div>
      <SifreDegistir open={sifreAcik} onClose={() => setSifreAcik(false)} email={email} />
      <MfaAyar open={mfaAcik} onClose={() => setMfaAcik(false)} />
    </aside>
  )
}
