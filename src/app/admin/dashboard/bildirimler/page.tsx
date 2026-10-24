'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { erp } from '@/lib/erp-client'
import { muh } from '@/lib/muhasebe-client'
import AdminTopBar from '@/components/admin/TopBar'
import { Mail, Phone, Save, Info, AlertTriangle, Boxes, Wrench, FileSignature, Webhook, Copy } from 'lucide-react'

const sb = createClient()

// Modül seviyesinde tanımlı: render içinde tanımlanırsa sayfa her state değişiminde
// (toast, uyarılar, ayarlar...) bu bileşenleri yeniden yaratır ve React gereksiz yere unmount/remount eder.
function Durum({d}:{d?:{ok:boolean;missing:string[]}}) {
  return !d ? <span>…</span> : d.ok ? <b style={{color:'var(--adm-green)'}}>hazır ✓</b> : <b style={{color:'var(--adm-red)'}}>Vercel&apos;de eksik: {d.missing.join(', ')}</b>
}
function Kod({t, onKopyala}:{t:string; onKopyala:(t:string)=>void}) {
  return (
    <span style={{display:'inline-flex',alignItems:'center',gap:6,background:'var(--adm-s2)',border:'1px solid var(--adm-bdr)',borderRadius:6,padding:'3px 8px',fontFamily:'monospace',fontSize:12,wordBreak:'break-all'}}>
      {t}
      <button type="button" onClick={()=>onKopyala(t)} aria-label="Kopyala" style={{background:'none',border:0,cursor:'pointer',color:'var(--adm-tx3)',padding:0}}><Copy size={12}/></button>
    </span>
  )
}

const EVENTS = [
  { event:'new_contact', label:'Yeni Başvuru', desc:'Birisi iletişim formunu doldurduğunda bildirim al' },
  { event:'new_visit_milestone', label:'Ziyaret Kilometre Taşı', desc:'Site 100, 500, 1000 ziyarete ulaştığında bildirim al' },
  { event:'yonetici_olay', label:'Yönetici Güvenlik Olayı', desc:'Şifre/iki adımlı doğrulama değişikliği, kullanıcı ekleme-silme-pasife alma ve rol değişikliklerinde anında bildirim al (önerilir)' },
  { event:'gunluk_ozet', label:'Günlük Özet', desc:'Her sabah 08:30 (Pzt-Cmt): vadesi geçen alacaklar/ödemeler, çek-senet, kritik stok, geciken siparişler, yanıt bekleyen başvurular. Dikkat gerektiren madde yoksa gönderilmez' },
  { event:'mevzuat_uyari', label:'Mevzuat Değişiklik Uyarısı', desc:'Günlük kaynak kontrolünde bir mevzuat kaydında değişiklik olasılığı bulunursa bildirim al' },
]

export default function AdminBildirimlerPage() {
  const [settings, setSettings] = useState<Record<string,any>>({})
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')
  const [uyarilar, setUyarilar] = useState<any[]>([])
  const [uyariYuklendi, setUyariYuklendi] = useState(false)
  const [durum, setDurum] = useState<Record<'email'|'whatsapp'|'sosyalGelen'|'sosyalGiden'|'potansiyel',{ok:boolean;missing:string[]}>|null>(null)
  const [testing, setTesting] = useState('')

  useEffect(() => {
    fetch('/api/admin/notify').then(r => r.ok ? r.json() : null).then(setDurum).catch(()=>{})
  }, [])

  async function test(channel:'email'|'whatsapp', event:string) {
    const to = channel==='email' ? settings[event]?.email_to : settings[event]?.whatsapp_to
    if (!to) { setToast('Önce adres/numara gir'); setTimeout(()=>setToast(''),3000); return }
    setTesting(`${event}:${channel}`)
    try {
      const r = await fetch('/api/admin/notify', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({channel, to}) })
      const j = await r.json()
      setToast(r.ok ? 'Test bildirimi gönderildi' : `Test başarısız: ${j.error}`)
    } catch { setToast('Test başarısız: bağlantı hatası') }
    setTesting(''); setTimeout(()=>setToast(''),5000)
  }

  useEffect(() => {
    sb.from('notification_settings').select('*').order('event', {ascending:true}).then(({data}:any) => {
      const map: Record<string,any> = {}
      ;(data||[]).forEach((d:any) => { map[d.event] = d })
      setSettings(map)
    })
  }, [])

  useEffect(() => {
    (async () => {
      const [{data:kh},{data:ku},{data:kb},{data:cs}] = await Promise.all([
        erp.from('v_kritik_hammaddeler').select('*'),
        erp.from('v_kritik_urunler').select('*'),
        erp.from('v_kalip_bakim_durumu').select('*'),
        muh.from('cek_senet').select('*').eq('durum','portfoyde'),
      ])
      const list: any[] = []
      ;(kh||[]).forEach((h:any)=>list.push({tip:'stok', icon:'stok', metin:`${h.ad} kritik stokta (${h.mevcut_stok} ${h.birim})`, seviye:'kirmizi'}))
      ;(ku||[]).forEach((u:any)=>list.push({tip:'stok', icon:'stok', metin:`${u.urun_adi} — ${u.name} stokta yok`, seviye:'kirmizi'}))
      ;(kb||[]).filter((k:any)=>['vadesi_gecti','yaklasiyor'].includes(k.bakim_durumu)).forEach((k:any)=>
        list.push({tip:'bakim', icon:'bakim', metin:`${k.ad} kalıbı bakım ${k.bakim_durumu==='vadesi_gecti'?'vadesi geçti':'vadesi yaklaşıyor'} (${k.sonraki_bakim||'-'})`, seviye:k.bakim_durumu==='vadesi_gecti'?'kirmizi':'sari'}))
      const bugun = new Date(); bugun.setHours(0,0,0,0)
      ;(cs||[]).forEach((c:any)=>{
        const v = new Date(c.vade_tarihi)
        if (v <= new Date(bugun.getTime()+7*86400000)) {
          list.push({tip:'cek', icon:'cek', metin:`${c.tip==='cek'?'Çek':'Senet'} ${c.no||''} vadesi ${muh.date(c.vade_tarihi)} (${muh.fmt(c.tutar)})`, seviye:v<bugun?'kirmizi':'sari'})
        }
      })
      setUyarilar(list); setUyariYuklendi(true)
    })()
  }, [])

  async function save(e: React.FormEvent) {
    e.preventDefault(); setSaving(true)
    // event kolonu UNIQUE: onConflict verilmezse upsert id üzerinden INSERT dener ve sessizce hata verir
    const results = await Promise.all(EVENTS.map(ev =>
      sb.from('notification_settings').upsert({
        event: ev.event,
        email_enabled: settings[ev.event]?.email_enabled||false,
        email_to: settings[ev.event]?.email_to||'',
        whatsapp_enabled: settings[ev.event]?.whatsapp_enabled||false,
        whatsapp_to: settings[ev.event]?.whatsapp_to||'',
      }, { onConflict: 'event' })
    ))
    setSaving(false)
    const err = results.find(r => r.error)?.error
    setToast(err ? `Kaydedilemedi: ${err.message}` : 'Bildirim ayarları kaydedildi')
    setTimeout(()=>setToast(''),4000)
  }

  const upd = (event:string, field:string, val:any) =>
    setSettings(s => ({...s, [event]: {...(s[event]||{}), [field]:val}}))

  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  const kopyala = (t:string) => { navigator.clipboard?.writeText(t).then(()=>{ setToast('Kopyalandı'); setTimeout(()=>setToast(''),2500) }).catch(()=>{}) }

  const ICONS: Record<string,any> = { stok: Boxes, bakim: Wrench, cek: FileSignature }

  return (
    <div style={{ flex:1, overflow:'auto' }}>
      <AdminTopBar title="Bildirimler"/>
      <div style={{ padding:24, maxWidth:700 }}>

        <div className="adm-card" style={{marginBottom:20}}>
          <div className="adm-card-h">Aktif Uyarılar {uyariYuklendi && `(${uyarilar.length})`}</div>
          {!uyariYuklendi ? <p style={{padding:30,textAlign:'center',color:'var(--adm-tx3)',fontSize:13}}>Yükleniyor...</p>
          : uyarilar.length===0 ? <p style={{padding:30,textAlign:'center',color:'var(--adm-tx3)',fontSize:13}}>Şu an aktif uyarı yok, her şey yolunda ✓</p>
          : uyarilar.map((u,i)=>{
            const Icon = ICONS[u.icon]||AlertTriangle
            const c = u.seviye==='kirmizi' ? 'var(--adm-red)' : 'var(--adm-amber)'
            const bg = u.seviye==='kirmizi' ? 'var(--adm-red2)' : 'var(--adm-amber2)'
            return (
              <div key={i} className="adm-row">
                <div style={{width:32,height:32,borderRadius:8,background:bg,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                  <Icon size={15} style={{color:c}}/>
                </div>
                <p style={{fontSize:12.5,color:'var(--adm-tx)',flex:1}}>{u.metin}</p>
              </div>
            )
          })}
        </div>

        <div className="adm-card" style={{ marginBottom:20, padding:16, display:'flex', alignItems:'center', gap:12 }}>
          <div style={{ width:36, height:36, borderRadius:9, background:'var(--adm-blue2)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
            <Info size={16} style={{ color:'var(--adm-blue)' }}/>
          </div>
          <div style={{ fontSize:12.5, color:'var(--adm-tx3)', lineHeight:1.7 }}>
            {!durum ? 'Kanal durumu kontrol ediliyor...' : <>
              <div>E-posta (SMTP): {durum.email.ok ? <b style={{color:'var(--adm-green)'}}>hazır ✓</b> : <b style={{color:'var(--adm-red)'}}>kurulmamış — Vercel env: {durum.email.missing.join(', ')}</b>}</div>
              <div>WhatsApp (n8n): {durum.whatsapp.ok ? <b style={{color:'var(--adm-green)'}}>hazır ✓</b> : <b style={{color:'var(--adm-red)'}}>kurulmamış — Vercel env: {durum.whatsapp.missing.join(', ')}</b>}</div>
            </>}
          </div>
        </div>

        <div className="adm-card" style={{ marginBottom:20 }}>
          <div className="adm-card-h"><span style={{display:'flex',alignItems:'center',gap:8,fontWeight:700}}><Webhook size={15}/>n8n / Webhook bağlantıları</span></div>
          <div style={{ padding:18, fontSize:12.5, color:'var(--adm-tx3)', lineHeight:1.8 }}>
            <p style={{marginBottom:12}}>Güvenlik gereği gizli anahtarlar ve giden adresler panelde değil, <b>Vercel → Settings → Environment Variables</b> içinde tutulur (değiştirince yeniden deploy gerekir). Aşağıda n8n tarafına girmeniz gereken adresler ve her bağlantının durumu var.</p>

            <p style={{color:'var(--adm-tx)',fontWeight:700,marginTop:10}}>1) n8n → Site (n8n paylaşımı çeker / sonucu bildirir) — Sosyal medya</p>
            <div>Adres (n8n HTTP Request düğmesine): <Kod t={`${origin}/api/webhooks/sosyal`} onKopyala={kopyala}/></div>
            <div>Yetkilendirme: <b>Header Auth</b> → <Kod t="Authorization: Bearer <N8N_SOSYAL_API_TOKEN değeri>" onKopyala={kopyala}/></div>
            <div>GET: tarihi gelmiş "planlandı" gönderileri verir · POST: paylaşım sonucunu yazar</div>
            <div>Durum: <Durum d={durum?.sosyalGelen}/></div>

            <p style={{color:'var(--adm-tx)',fontWeight:700,marginTop:14}}>2) Site → n8n (Takvim'deki "n8n" düğmesi gönderiyi iter) — Sosyal medya</p>
            <div>n8n'de bir <b>Webhook</b> düğmesi oluşturun, "Production URL"i Vercel'e <Kod t="N8N_SOSYAL_WEBHOOK_URL" onKopyala={kopyala}/> olarak, kendi belirlediğiniz gizli değeri <Kod t="N8N_SOSYAL_WEBHOOK_SECRET" onKopyala={kopyala}/> olarak girin (n8n bunu <code>x-alya-secret</code> başlığında doğrular).</div>
            <div>Durum: <Durum d={durum?.sosyalGiden}/></div>

            <p style={{color:'var(--adm-tx)',fontWeight:700,marginTop:14}}>3) n8n → Site (potansiyel müşteri verisi → Potansiyel Müşteriler tablosu)</p>
            <div>Adres (HTTP Request, POST, JSON): <Kod t={`${origin}/api/webhooks/potansiyel`} onKopyala={kopyala}/></div>
            <div>Yetkilendirme: <Kod t="Authorization: Bearer <N8N_LEAD_API_TOKEN değeri>" onKopyala={kopyala}/> (tanımlı değilse N8N_SOSYAL_API_TOKEN kullanılır)</div>
            <div>Gövde: <Kod t="title, phone, emails, website, address, categoryName, url" onKopyala={kopyala}/> alanlarını olduğu gibi gönderin; tek kayıt, dizi ya da {'{'}items:[…]{'}'} olabilir (en çok 500). Aynı işletme ikinci kez gelirse atlanır.</div>
            <div>Durum: <Durum d={durum?.potansiyel}/></div>

            <p style={{color:'var(--adm-tx)',fontWeight:700,marginTop:14}}>4) Site → n8n (WhatsApp bildirimleri)</p>
            <div>n8n Webhook adresini Vercel'e <Kod t="N8N_WHATSAPP_WEBHOOK_URL" onKopyala={kopyala}/> olarak girin (isteğe bağlı gizli değer: <Kod t="N8N_WEBHOOK_SECRET" onKopyala={kopyala}/>, başlık <code>x-webhook-secret</code>).</div>
            <div>Durum: <Durum d={durum?.whatsapp}/></div>
          </div>
        </div>

        <form onSubmit={save}>
          {EVENTS.map(ev => (
            <div key={ev.event} className="adm-card" style={{ marginBottom:16 }}>
              <div className="adm-card-h">
                <div>
                  <span style={{ fontSize:13.5, fontWeight:700 }}>{ev.label}</span>
                  <p style={{ fontSize:11.5, color:'var(--adm-tx3)', marginTop:2 }}>{ev.desc}</p>
                </div>
              </div>
              <div style={{ padding:20, display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
                {/* E-posta */}
                <div style={{ padding:16, background:'var(--adm-s2)', borderRadius:10, border:'1px solid var(--adm-bdr)' }}>
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
                    <span style={{ display:'flex', alignItems:'center', gap:6, fontSize:13, fontWeight:600, color:'var(--adm-tx)' }}>
                      <Mail size={13} style={{ color:'var(--adm-blue)' }}/>E-posta
                    </span>
                    <label style={{ display:'flex', alignItems:'center', gap:6, cursor:'pointer' }}>
                      <input type="checkbox"
                        checked={settings[ev.event]?.email_enabled||false}
                        onChange={e => upd(ev.event,'email_enabled',e.target.checked)}/>
                      <span style={{ fontSize:12, color:'var(--adm-tx3)' }}>Aktif</span>
                    </label>
                  </div>
                  <label className="adm-label">Gönderilecek Adres</label>
                  <input className="adm-inp" type="email" placeholder="info@alyaplastik.com"
                    value={settings[ev.event]?.email_to||''}
                    onChange={e => upd(ev.event,'email_to',e.target.value)}
                    disabled={!settings[ev.event]?.email_enabled}/>
                  <button type="button" className="adm-btn" onClick={()=>test('email', ev.event)}
                    disabled={!settings[ev.event]?.email_to || testing===`${ev.event}:email`}
                    style={{ marginTop:10, fontSize:12, padding:'6px 12px' }}>
                    {testing===`${ev.event}:email` ? 'Gönderiliyor...' : 'Test Gönder'}
                  </button>
                </div>

                {/* WhatsApp */}
                <div style={{ padding:16, background:'var(--adm-s2)', borderRadius:10, border:'1px solid var(--adm-bdr)' }}>
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
                    <span style={{ display:'flex', alignItems:'center', gap:6, fontSize:13, fontWeight:600, color:'var(--adm-tx)' }}>
                      <Phone size={13} style={{ color:'var(--adm-green)' }}/>WhatsApp
                    </span>
                    <label style={{ display:'flex', alignItems:'center', gap:6, cursor:'pointer' }}>
                      <input type="checkbox"
                        checked={settings[ev.event]?.whatsapp_enabled||false}
                        onChange={e => upd(ev.event,'whatsapp_enabled',e.target.checked)}/>
                      <span style={{ fontSize:12, color:'var(--adm-tx3)' }}>Aktif</span>
                    </label>
                  </div>
                  <label className="adm-label">WhatsApp Numarası</label>
                  <input className="adm-inp" placeholder="+905357616524"
                    value={settings[ev.event]?.whatsapp_to||''}
                    onChange={e => upd(ev.event,'whatsapp_to',e.target.value)}
                    disabled={!settings[ev.event]?.whatsapp_enabled}/>
                  <button type="button" className="adm-btn" onClick={()=>test('whatsapp', ev.event)}
                    disabled={!settings[ev.event]?.whatsapp_to || testing===`${ev.event}:whatsapp`}
                    style={{ marginTop:10, fontSize:12, padding:'6px 12px' }}>
                    {testing===`${ev.event}:whatsapp` ? 'Gönderiliyor...' : 'Test Gönder'}
                  </button>
                </div>
              </div>
            </div>
          ))}

          <button type="submit" className="adm-btn" disabled={saving} style={{ width:'100%', justifyContent:'center', padding:'11px 0' }}>
            <Save size={14}/>{saving?'Kaydediliyor...':'Ayarları Kaydet'}
          </button>
        </form>
      </div>
      {toast && <div className="adm-toast">✓ {toast}</div>}
    </div>
  )
}
