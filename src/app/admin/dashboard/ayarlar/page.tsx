'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import AdminTopBar from '@/components/admin/TopBar'
import { Save, Phone, Mail, MapPin, Clock, Globe, BarChart2, ExternalLink } from 'lucide-react'

const sb = createClient()

// Modül seviyesinde tanımlı: render içinde tanımlanırsa her state değişikliğinde
// yeni bir bileşen kimliği oluşur ve React inputu unmount/remount eder (yazarken focus kaybı).
function F({label,k,type='text',obj,setObj,icon:Icon,placeholder}:any) {
  return (
    <div>
      <label className="adm-label">{label}</label>
      <div style={{position:'relative'}}>
        {Icon && <Icon size={13} style={{position:'absolute',left:11,top:'50%',transform:'translateY(-50%)',color:'var(--adm-tx3)',pointerEvents:'none'}}/>}
        <input type={type} className="adm-inp" value={obj[k]||''} onChange={e=>setObj((o:any)=>({...o,[k]:type==='number'?+e.target.value:e.target.value}))} placeholder={placeholder} style={Icon?{paddingLeft:32}:{}}/>
      </div>
    </div>
  )
}

export default function AdminAyarlarPage() {
  const [site, setSite]   = useState<any>({})
  const [stats, setStats] = useState<any>({})
  const [countries, setCountries] = useState<string>('')
  const [saving, setSaving] = useState(false)
  const [toast, setToast]   = useState('')
  const [tab, setTab]       = useState('iletisim')

  useEffect(()=>{
    sb.from('settings').select('key,value').then(({data})=>{
      setSite(data?.find(d=>d.key==='site')?.value||{})
      setStats(data?.find(d=>d.key==='stats')?.value||{})
      const c = data?.find(d=>d.key==='export_countries')?.value
      setCountries(Array.isArray(c)?c.join(', '):c||'')
    })
  },[])

  async function save(e:React.FormEvent){
    e.preventDefault()
    const gecersiz = (['linkedin','instagram','facebook'] as const).find(k=>site[k] && !/^https:\/\/[^\s]+$/.test(String(site[k]).trim()))
    if (gecersiz) { setToast('Sosyal medya bağlantıları https:// ile başlamalı'); setTimeout(()=>setToast(''),4000); return }
    setSaving(true)
    await Promise.all([
      sb.from('settings').upsert({key:'site',value:site}),
      sb.from('settings').upsert({key:'stats',value:stats}),
      countries.trim() && sb.from('settings').upsert({key:'export_countries',value:countries.split(',').map(s=>s.trim()).filter(Boolean)}),
    ])
    setSaving(false); setToast('Ayarlar kaydedildi'); setTimeout(()=>setToast(''),3000)
  }

  const TABS = [
    {id:'iletisim', label:'İletişim'},
    {id:'sayaclar', label:'Sayaçlar'},
    {id:'ihracat',  label:'İhracat'},
  ]

  return (
    <div style={{flex:1,overflow:'auto'}}>
      <AdminTopBar title="Site Ayarları"/>
      <div style={{padding:24,maxWidth:860}}>

        {/* Tab'lar */}
        <div style={{display:'flex',gap:4,marginBottom:20,background:'var(--adm-s2)',padding:4,borderRadius:10,width:'fit-content'}}>
          {TABS.map(t=>(
            <button key={t.id} onClick={()=>setTab(t.id)}
              style={{padding:'6px 16px',borderRadius:8,fontSize:13,fontWeight:tab===t.id?600:400,background:tab===t.id?'var(--adm-s1)':'transparent',color:tab===t.id?'var(--adm-tx)':'var(--adm-tx3)',border:tab===t.id?'1px solid var(--adm-bdr)':'1px solid transparent',cursor:'pointer',transition:'all .15s',fontFamily:'inherit'}}>
              {t.label}
            </button>
          ))}
        </div>

        <form onSubmit={save}>
          {tab==='iletisim' && (
            <div className="adm-card" style={{marginBottom:16}}>
              <div className="adm-card-h" style={{gap:8}}><Phone size={14} style={{color:'var(--adm-ac)'}}/>İletişim Bilgileri</div>
              <div style={{padding:20,display:'grid',gridTemplateColumns:'1fr 1fr',gap:14}}>
                <F label="Şirket Adı"         k="company"       obj={site} setObj={setSite} placeholder="Alya Plastik San. Tic. Ltd. Şti."/>
                <F label="Kuruluş Yılı"       k="founded"       obj={site} setObj={setSite} type="number" placeholder="1968"/>
                <F label="Ana Telefon"         k="phone"         obj={site} setObj={setSite} icon={Phone} placeholder="+90 212 671 85 65"/>
                <F label="WhatsApp"            k="whatsapp"      obj={site} setObj={setSite} icon={Phone} placeholder="+90 535 761 65 24"/>
                <F label="E-posta"             k="email"         obj={site} setObj={setSite} icon={Mail} type="email" placeholder="info@alyaplastik.com"/>
                <F label="İhracat E-posta"     k="export_email"  obj={site} setObj={setSite} icon={Mail} type="email" placeholder="export@alyaplastik.com"/>
                <div style={{gridColumn:'1/-1'}}>
                  <label className="adm-label"><MapPin size={12} style={{display:'inline',marginRight:4}}/>Adres</label>
                  <textarea className="adm-inp" rows={2} value={site.address||''} onChange={e=>setSite((s:any)=>({...s,address:e.target.value}))} placeholder="İkitelli OSB 4B Blok No:26-28 Kat:2, Başakşehir, İstanbul"/>
                </div>
                <F label="LinkedIn (https://…)"  k="linkedin"  obj={site} setObj={setSite} icon={Globe} placeholder="https://www.linkedin.com/company/…"/>
                <F label="Instagram (https://…)" k="instagram" obj={site} setObj={setSite} icon={Globe} placeholder="https://www.instagram.com/…"/>
                <F label="Facebook (https://…)"  k="facebook"  obj={site} setObj={setSite} icon={Globe} placeholder="https://www.facebook.com/…"/>
                <div style={{gridColumn:'1/-1'}}>
                  <label className="adm-label"><Clock size={12} style={{display:'inline',marginRight:4}}/>Çalışma Saatleri</label>
                  <input className="adm-inp" value={site.working_hours||''} onChange={e=>setSite((s:any)=>({...s,working_hours:e.target.value}))} placeholder="Pazartesi - Cuma: 08:30 - 17:30"/>
                </div>
              </div>
            </div>
          )}

          {tab==='sayaclar' && (
            <div className="adm-card" style={{marginBottom:16}}>
              <div className="adm-card-h" style={{gap:8}}><BarChart2 size={14} style={{color:'var(--adm-ac)'}}/>Site İstatistik Sayaçları</div>
              <div style={{padding:20}}>
                <p style={{fontSize:12.5,color:'var(--adm-tx3)',marginBottom:20}}>Bu değerler ana sitedeki animasyonlu sayaçlarda görünür.</p>
                <div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:14}}>
                  <F label="Yıllık Deneyim"    k="years"             obj={stats} setObj={setStats} type="number" placeholder="55"/>
                  <F label="Ürün Modeli"        k="models"            obj={stats} setObj={setStats} type="number" placeholder="200"/>
                  <F label="İhracat Ülkesi"     k="countries"         obj={stats} setObj={setStats} type="number" placeholder="20"/>
                  <F label="Yerli Üretim %"     k="local_production"  obj={stats} setObj={setStats} type="number" placeholder="100"/>
                </div>
              </div>
            </div>
          )}

          {tab==='ihracat' && (
            <div className="adm-card" style={{marginBottom:16}}>
              <div className="adm-card-h" style={{gap:8}}><Globe size={14} style={{color:'var(--adm-ac)'}}/>İhracat Ülkeleri</div>
              <div style={{padding:20}}>
                <p style={{fontSize:12.5,color:'var(--adm-tx3)',marginBottom:14}}>Virgülle ayırarak girin. Ana sitedeki ihracat ticker'ında görünür.</p>
                <textarea className="adm-inp" rows={6} value={countries} onChange={e=>setCountries(e.target.value)} placeholder="Almanya, Fransa, İtalya, Hollanda, Belçika, İngiltere, ..."/>
                <div style={{marginTop:12,display:'flex',flexWrap:'wrap',gap:6}}>
                  {countries.split(',').filter(c=>c.trim()).map((c,i)=>(
                    <span key={i} className="adm-badge adm-badge-muted">{c.trim()}</span>
                  ))}
                </div>
              </div>
            </div>
          )}

          <div style={{display:'flex',gap:10,alignItems:'center'}}>
            <button type="submit" className="adm-btn" disabled={saving} style={{padding:'10px 24px'}}>
              <Save size={14}/>{saving?'Kaydediliyor...':'Kaydet'}
            </button>
            <a href="/" target="_blank" rel="noopener noreferrer nofollow"
              className="adm-btn-ghost" style={{fontSize:12}}>
              <ExternalLink size={13}/>Siteyi Önizle
            </a>
          </div>
        </form>
      </div>
      {toast && <div className="adm-toast">✓ {toast}</div>}
    </div>
  )
}
