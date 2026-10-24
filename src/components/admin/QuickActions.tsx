'use client'
import { useEffect, useState, useRef } from 'react'
import { createPortal } from 'react-dom'
import { muh } from '@/lib/muhasebe-client'
import { erp } from '@/lib/erp-client'
import { Plus, X, ArrowDownCircle, ArrowUpCircle, Receipt, UserPlus, FileSignature, ChevronDown } from 'lucide-react'

type Action = 'tahsilat' | 'odeme' | 'fatura' | 'cari' | 'ceksenet' | null

const bosIslem = { tutar:'', kategori:'', aciklama:'', tarih:new Date().toISOString().split('T')[0], cari_id:'', kasa_hesap_id:'' }
const bosFatura = { tip:'satis', cari_id:'', urun_adi:'', miktar:'1', birim_fiyat:'', kdv_orani:'20', tarih:new Date().toISOString().split('T')[0] }
const bosCari = { tip:'musteri', ad:'', vergi_no:'', telefon:'', email:'' }
const bosCekSenet = { tip:'cek', yon:'alinan', cari_id:'', no:'', banka:'', tutar:'', vade_tarihi:new Date().toISOString().split('T')[0] }

export default function QuickActions() {
  const [open, setOpen] = useState(false)
  const [action, setAction] = useState<Action>(null)
  const [cariList, setCariList] = useState<any[]>([])
  const [kasaList, setKasaList] = useState<any[]>([])
  const [kategoriler, setKategoriler] = useState<any[]>([])
  const [toast, setToast] = useState('')
  const [mounted, setMounted] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const [islemForm, setIslemForm] = useState({...bosIslem, tip:'gelir'})
  const [faturaForm, setFaturaForm] = useState(bosFatura)
  const [cariForm, setCariForm] = useState(bosCari)
  const [ceksenetForm, setCeksenetForm] = useState(bosCekSenet)

  useEffect(()=>{ setMounted(true) },[])

  useEffect(() => {
    function onClick(e:MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  async function refData() {
    const [{data:c},{data:k},{data:kat}] = await Promise.all([
      muh.from('cari_hesaplar').select('id,ad,tip').order('ad',{ascending:true}),
      erp.from('kasa_banka_hesaplari').select('id,ad').eq('para_birimi','TRY').order('ad',{ascending:true}),
      muh.from('muhasebe_kategoriler').select('*'),
    ])
    setCariList(c||[]); setKasaList(k||[]); setKategoriler(kat||[])
  }

  function acAction(a:Action) {
    setOpen(false); setAction(a); refData()
  }

  const showToast = (m:string) => { setToast(m); setTimeout(()=>setToast(''),3000) }
  function kapat() {
    setAction(null)
    setIslemForm({...bosIslem, tip:'gelir'}); setFaturaForm(bosFatura); setCariForm(bosCari); setCeksenetForm(bosCekSenet)
  }

  async function islemKaydet(e:React.FormEvent) {
    e.preventDefault()
    await muh.from('islemler').insert({...islemForm, tutar:+islemForm.tutar, cari_id:islemForm.cari_id||null, kasa_hesap_id:islemForm.kasa_hesap_id||null})
    showToast(islemForm.tip==='gelir'?'Tahsilat kaydedildi':'Ödeme kaydedildi'); kapat()
  }

  async function faturaKaydet(e:React.FormEvent) {
    e.preventDefault()
    const miktar = +faturaForm.miktar, birimFiyat = +faturaForm.birim_fiyat, kdv = +faturaForm.kdv_orani
    const araToplam = miktar*birimFiyat, kdvTutari = araToplam*kdv/100, toplam = araToplam+kdvTutari
    const no = `F-${new Date().getFullYear()}-${String(Date.now()).slice(-4)}`
    const { data } = await muh.from('faturalar').insert({
      tip:faturaForm.tip, no, cari_id:faturaForm.cari_id||null, tarih:faturaForm.tarih,
      ara_toplam:araToplam, kdv_tutari:kdvTutari, toplam, kdv_orani:kdv, durum:'taslak',
    })
    const faturaId = (data as any)?.[0]?.id
    if (faturaId) await muh.from('fatura_kalemleri').insert({ fatura_id:faturaId, urun_adi:faturaForm.urun_adi, miktar, birim_fiyat:birimFiyat, kdv_orani:kdv, toplam })
    showToast(`Fatura ${no} oluşturuldu (taslak)`); kapat()
  }

  async function cariKaydet(e:React.FormEvent) {
    e.preventDefault()
    await muh.from('cari_hesaplar').insert(cariForm)
    showToast('Cari eklendi'); kapat()
  }

  async function cekSenetKaydet(e:React.FormEvent) {
    e.preventDefault()
    await muh.from('cek_senet').insert({...ceksenetForm, tutar:+ceksenetForm.tutar, cari_id:ceksenetForm.cari_id||null})
    showToast('Çek/Senet kaydedildi'); kapat()
  }

  const ACTIONS = [
    { key:'tahsilat' as Action, label:'Tahsilat Al',    Icon:ArrowDownCircle, color:'var(--adm-green)' },
    { key:'odeme'    as Action, label:'Ödeme Yap',      Icon:ArrowUpCircle,   color:'var(--adm-red)' },
    { key:'fatura'   as Action, label:'Hızlı Fatura Kes',Icon:Receipt,        color:'var(--adm-ac)' },
    { key:'cari'     as Action, label:'Cari Ekle',      Icon:UserPlus,        color:'var(--adm-blue)' },
    { key:'ceksenet' as Action, label:'Çek/Senet Ekle', Icon:FileSignature,   color:'var(--adm-amber)' },
  ]

  return (
    <>
      <div ref={ref} style={{position:'relative'}}>
        <button className="adm-btn" style={{fontSize:12}} onClick={()=>setOpen(o=>!o)}>
          <Plus size={14}/>Hızlı Ekle<ChevronDown size={13}/>
        </button>
        {open && (
          <div style={{position:'absolute',top:'calc(100% + 6px)',right:0,background:'var(--adm-s1)',border:'1px solid var(--adm-bdr2)',borderRadius:10,boxShadow:'0 12px 32px rgba(0,0,0,.18)',minWidth:200,zIndex:150,overflow:'hidden'}}>
            {ACTIONS.map(a=>(
              <button key={a.key} onClick={()=>acAction(a.key)}
                style={{display:'flex',alignItems:'center',gap:10,width:'100%',padding:'10px 14px',background:'none',border:'none',cursor:'pointer',fontSize:12.5,color:'var(--adm-tx)',textAlign:'left'}}
                onMouseEnter={e=>(e.currentTarget.style.background='var(--adm-s2)')}
                onMouseLeave={e=>(e.currentTarget.style.background='none')}>
                <a.Icon size={15} style={{color:a.color}}/>{a.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {mounted && action && createPortal(
        <div className="adm-modal-bg" onClick={e=>{if(e.target===e.currentTarget)kapat()}}>
          <div className="adm-modal">
            {action==='tahsilat' || action==='odeme' ? (
              <>
                <div className="adm-modal-h">{islemForm.tip==='gelir'?'Tahsilat Al':'Ödeme Yap'}<button onClick={kapat} style={{background:'none',border:'none',cursor:'pointer',color:'var(--adm-tx3)'}}><X size={18}/></button></div>
                <form onSubmit={islemKaydet}>
                  <div className="adm-modal-b" style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14}}>
                    <div style={{gridColumn:'1/-1',display:'flex',gap:6}}>
                      {[['gelir','Tahsilat (Gelir)'],['gider','Ödeme (Gider)']].map(([v,l])=>(
                        <button key={v} type="button" onClick={()=>setIslemForm(f=>({...f,tip:v}))} className={islemForm.tip===v?'adm-btn':'adm-btn-ghost'} style={{fontSize:11,padding:'5px 12px'}}>{l}</button>
                      ))}
                    </div>
                    <div><label className="adm-label">Tutar (₺) *</label><input type="number" step="0.01" required autoFocus className="adm-inp" value={islemForm.tutar} onChange={e=>setIslemForm(f=>({...f,tutar:e.target.value}))}/></div>
                    <div><label className="adm-label">Tarih</label><input type="date" className="adm-inp" value={islemForm.tarih} onChange={e=>setIslemForm(f=>({...f,tarih:e.target.value}))}/></div>
                    <div style={{gridColumn:'1/-1'}}><label className="adm-label">Kategori</label>
                      <input className="adm-inp" list="qa-kategoriler" value={islemForm.kategori} onChange={e=>setIslemForm(f=>({...f,kategori:e.target.value}))} placeholder="Kira, Maaş, Satış Tahsilatı..."/>
                      <datalist id="qa-kategoriler">{kategoriler.filter((k:any)=>k.tip===islemForm.tip).map((k:any)=><option key={k.id} value={k.ad}/>)}</datalist>
                    </div>
                    <div><label className="adm-label">Cari</label>
                      <select className="adm-inp" value={islemForm.cari_id} onChange={e=>setIslemForm(f=>({...f,cari_id:e.target.value}))}>
                        <option value="">Yok</option>
                        {cariList.map((c:any)=><option key={c.id} value={c.id}>{c.ad}</option>)}
                      </select>
                    </div>
                    <div><label className="adm-label">Kasa/Banka</label>
                      <select className="adm-inp" value={islemForm.kasa_hesap_id} onChange={e=>setIslemForm(f=>({...f,kasa_hesap_id:e.target.value}))}>
                        <option value="">Seçin</option>
                        {kasaList.map((k:any)=><option key={k.id} value={k.id}>{k.ad}</option>)}
                      </select>
                    </div>
                    <div style={{gridColumn:'1/-1'}}><label className="adm-label">Açıklama</label><input className="adm-inp" value={islemForm.aciklama} onChange={e=>setIslemForm(f=>({...f,aciklama:e.target.value}))}/></div>
                  </div>
                  <div className="adm-modal-f"><button type="button" className="adm-btn-ghost" onClick={kapat}>İptal</button><button type="submit" className="adm-btn">Kaydet</button></div>
                </form>
              </>
            ) : action==='fatura' ? (
              <>
                <div className="adm-modal-h">Hızlı Fatura Kes<button onClick={kapat} style={{background:'none',border:'none',cursor:'pointer',color:'var(--adm-tx3)'}}><X size={18}/></button></div>
                <form onSubmit={faturaKaydet}>
                  <div className="adm-modal-b" style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14}}>
                    <div style={{gridColumn:'1/-1',display:'flex',gap:6}}>
                      {[['satis','Satış'],['alis','Alış']].map(([v,l])=>(
                        <button key={v} type="button" onClick={()=>setFaturaForm(f=>({...f,tip:v}))} className={faturaForm.tip===v?'adm-btn':'adm-btn-ghost'} style={{fontSize:11,padding:'5px 12px'}}>{l} Faturası</button>
                      ))}
                    </div>
                    <div style={{gridColumn:'1/-1'}}><label className="adm-label">Cari</label>
                      <select className="adm-inp" value={faturaForm.cari_id} onChange={e=>setFaturaForm(f=>({...f,cari_id:e.target.value}))}>
                        <option value="">Seçin</option>
                        {cariList.map((c:any)=><option key={c.id} value={c.id}>{c.ad}</option>)}
                      </select>
                    </div>
                    <div style={{gridColumn:'1/-1'}}><label className="adm-label">Ürün / Hizmet *</label><input required autoFocus className="adm-inp" value={faturaForm.urun_adi} onChange={e=>setFaturaForm(f=>({...f,urun_adi:e.target.value}))}/></div>
                    <div><label className="adm-label">Miktar</label><input type="number" className="adm-inp" value={faturaForm.miktar} onChange={e=>setFaturaForm(f=>({...f,miktar:e.target.value}))}/></div>
                    <div><label className="adm-label">Birim Fiyat *</label><input type="number" step="0.01" required className="adm-inp" value={faturaForm.birim_fiyat} onChange={e=>setFaturaForm(f=>({...f,birim_fiyat:e.target.value}))}/></div>
                    <div><label className="adm-label">KDV %</label><input type="number" className="adm-inp" value={faturaForm.kdv_orani} onChange={e=>setFaturaForm(f=>({...f,kdv_orani:e.target.value}))}/></div>
                    <div><label className="adm-label">Tarih</label><input type="date" className="adm-inp" value={faturaForm.tarih} onChange={e=>setFaturaForm(f=>({...f,tarih:e.target.value}))}/></div>
                    {faturaForm.birim_fiyat && (
                      <p style={{gridColumn:'1/-1',fontSize:12.5,color:'var(--adm-tx3)'}}>
                        Toplam: <b style={{color:'var(--adm-green)'}}>{muh.fmt((+faturaForm.miktar)*(+faturaForm.birim_fiyat)*(1+(+faturaForm.kdv_orani)/100))}</b> (KDV dahil)
                      </p>
                    )}
                  </div>
                  <div className="adm-modal-f"><button type="button" className="adm-btn-ghost" onClick={kapat}>İptal</button><button type="submit" className="adm-btn">Taslak Oluştur</button></div>
                </form>
              </>
            ) : action==='cari' ? (
              <>
                <div className="adm-modal-h">Yeni Cari<button onClick={kapat} style={{background:'none',border:'none',cursor:'pointer',color:'var(--adm-tx3)'}}><X size={18}/></button></div>
                <form onSubmit={cariKaydet}>
                  <div className="adm-modal-b" style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14}}>
                    <div style={{gridColumn:'1/-1',display:'flex',gap:6}}>
                      {[['musteri','Müşteri'],['tedarikci','Tedarikçi'],['diger','Diğer']].map(([v,l])=>(
                        <button key={v} type="button" onClick={()=>setCariForm(f=>({...f,tip:v}))} className={cariForm.tip===v?'adm-btn':'adm-btn-ghost'} style={{fontSize:11,padding:'5px 12px'}}>{l}</button>
                      ))}
                    </div>
                    <div style={{gridColumn:'1/-1'}}><label className="adm-label">Ad / Unvan *</label><input required autoFocus className="adm-inp" value={cariForm.ad} onChange={e=>setCariForm(f=>({...f,ad:e.target.value}))}/></div>
                    <div><label className="adm-label">Vergi No / TC</label><input className="adm-inp" value={cariForm.vergi_no} onChange={e=>setCariForm(f=>({...f,vergi_no:e.target.value}))}/></div>
                    <div><label className="adm-label">Telefon</label><input className="adm-inp" value={cariForm.telefon} onChange={e=>setCariForm(f=>({...f,telefon:e.target.value}))}/></div>
                    <div style={{gridColumn:'1/-1'}}><label className="adm-label">E-posta</label><input type="email" className="adm-inp" value={cariForm.email} onChange={e=>setCariForm(f=>({...f,email:e.target.value}))}/></div>
                  </div>
                  <div className="adm-modal-f"><button type="button" className="adm-btn-ghost" onClick={kapat}>İptal</button><button type="submit" className="adm-btn">Kaydet</button></div>
                </form>
              </>
            ) : action==='ceksenet' ? (
              <>
                <div className="adm-modal-h">Yeni Çek/Senet<button onClick={kapat} style={{background:'none',border:'none',cursor:'pointer',color:'var(--adm-tx3)'}}><X size={18}/></button></div>
                <form onSubmit={cekSenetKaydet}>
                  <div className="adm-modal-b" style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14}}>
                    <div style={{display:'flex',gap:6}}>
                      {[['cek','Çek'],['senet','Senet']].map(([v,l])=>(
                        <button key={v} type="button" onClick={()=>setCeksenetForm(f=>({...f,tip:v}))} className={ceksenetForm.tip===v?'adm-btn':'adm-btn-ghost'} style={{fontSize:11,padding:'5px 12px'}}>{l}</button>
                      ))}
                    </div>
                    <div style={{display:'flex',gap:6}}>
                      {[['alinan','Alınan'],['verilen','Verilen']].map(([v,l])=>(
                        <button key={v} type="button" onClick={()=>setCeksenetForm(f=>({...f,yon:v}))} className={ceksenetForm.yon===v?'adm-btn':'adm-btn-ghost'} style={{fontSize:11,padding:'5px 12px'}}>{l}</button>
                      ))}
                    </div>
                    <div style={{gridColumn:'1/-1'}}><label className="adm-label">Cari</label>
                      <select className="adm-inp" value={ceksenetForm.cari_id} onChange={e=>setCeksenetForm(f=>({...f,cari_id:e.target.value}))}>
                        <option value="">Seçin</option>
                        {cariList.map((c:any)=><option key={c.id} value={c.id}>{c.ad}</option>)}
                      </select>
                    </div>
                    <div><label className="adm-label">No</label><input autoFocus className="adm-inp" value={ceksenetForm.no} onChange={e=>setCeksenetForm(f=>({...f,no:e.target.value}))}/></div>
                    <div><label className="adm-label">Banka</label><input className="adm-inp" value={ceksenetForm.banka} onChange={e=>setCeksenetForm(f=>({...f,banka:e.target.value}))}/></div>
                    <div><label className="adm-label">Tutar (₺) *</label><input type="number" step="0.01" required className="adm-inp" value={ceksenetForm.tutar} onChange={e=>setCeksenetForm(f=>({...f,tutar:e.target.value}))}/></div>
                    <div><label className="adm-label">Vade Tarihi *</label><input type="date" required className="adm-inp" value={ceksenetForm.vade_tarihi} onChange={e=>setCeksenetForm(f=>({...f,vade_tarihi:e.target.value}))}/></div>
                  </div>
                  <div className="adm-modal-f"><button type="button" className="adm-btn-ghost" onClick={kapat}>İptal</button><button type="submit" className="adm-btn">Kaydet</button></div>
                </form>
              </>
            ) : null}
          </div>
        </div>,
        document.body
      )}

      {toast && mounted && createPortal(<div className="adm-toast">✓ {toast}</div>, document.body)}
    </>
  )
}
