'use client'
import { useRef, useState } from 'react'
import { Camera } from 'lucide-react'
import { aiIstek } from '@/lib/ai-client'
import { belgeDataUrl } from '@/lib/belge-dosya'
import { adayYap } from '@/lib/potansiyel'
import { web } from '@/lib/web-data'
import { Drawer, Badge } from '@/components/admin/erp/ui'

type Form = { firma: string; kisi: string; unvan: string; telefon: string; cep: string; eposta: string; website: string; adres: string; ulke: string; notlar: string; guven: 'yuksek' | 'orta' | 'dusuk' }
const BOS: Form = { firma: '', kisi: '', unvan: '', telefon: '', cep: '', eposta: '', website: '', adres: '', ulke: '', notlar: '', guven: 'orta' }
const GUVEN = { yuksek: { l: 'Okuma güveni yüksek', tone: 'green' }, orta: { l: 'Okuma güveni orta — kontrol edin', tone: 'amber' }, dusuk: { l: 'Okuma güveni düşük — mutlaka kontrol edin', tone: 'red' } } as const
const FUAR_ANAHTAR = 'alya_son_fuar'
const oku = () => { try { return localStorage.getItem(FUAR_ANAHTAR) || '' } catch { return '' } }

// Fuar kartvizitini kamerayla (telefonda doğrudan kamera açılır) okur; AI alanları doldurur, kullanıcı kontrol edip kaydeder.
// Kayıt potansiyel müşteriler listesine (gelenveriler, kaynak: kartvizit) düşer.
export default function KartvizitTara({ onKaydedildi, onMesaj }: { onKaydedildi: () => void; onMesaj: (m: string, hata?: boolean) => void }) {
  const ref = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [kaydediyor, setKaydediyor] = useState(false)
  const [acik, setAcik] = useState(false)
  const [f, setF] = useState<Form>(BOS)
  const [fuar, setFuar] = useState(oku)
  const set = (k: keyof Form, v: string) => setF(s => ({ ...s, [k]: v }))

  async function sec(e: React.ChangeEvent<HTMLInputElement>) {
    const dosya = e.target.files?.[0]; e.target.value = ''
    if (!dosya) return
    setBusy(true)
    try {
      const dataUrl = await belgeDataUrl(dosya)
      const r = await aiIstek<{ sonuc: Form }>('kartvizit_oku', { dosya: dataUrl })
      setF({ ...BOS, ...r.sonuc }); setAcik(true)
    } catch (err: any) { onMesaj(err.message || 'Kartvizit okunamadı', true) }
    setBusy(false)
  }

  async function kaydet() {
    const ana = f.cep.trim() || f.telefon.trim()
    const kisiNot = [
      f.kisi && `Kişi: ${f.kisi}`, f.unvan && `Ünvan: ${f.unvan}`,
      f.cep && f.telefon && `Cep: ${f.cep} · Tel: ${f.telefon}`, f.ulke && `Ülke: ${f.ulke}`, fuar.trim() && `Fuar: ${fuar.trim()}`, f.notlar.trim(),
    ].filter(Boolean).join('\n')
    const a = adayYap({ baslik: f.firma.trim() || f.kisi.trim(), telefon: ana, eposta: f.eposta.trim(), website: f.website.trim(), adres: f.adres.trim(), kategori: fuar.trim() ? `Fuar: ${fuar.trim()}` : 'Kartvizit' })
    if (!a) return onMesaj('Firma veya kişi adı gerekli', true)
    setKaydediyor(true)
    try { localStorage.setItem(FUAR_ANAHTAR, fuar.trim()) } catch { /* sorun değil */ }
    const { error } = await web.from('gelenveriler').insert({ ...a, notlar: kisiNot.slice(0, 4000) || null, kaynak: 'kartvizit' })
    setKaydediyor(false)
    if (error) return onMesaj(/duplicate|unique|23505/i.test(`${error.code} ${error.message}`) ? 'Bu firma zaten kayıtlı (aynı web sitesi/telefon).' : error.message, true)
    onMesaj(`${a.baslik} kaydedildi`); setAcik(false); setF(BOS); onKaydedildi()
  }

  return (
    <>
      <button type="button" className="adm-btn" disabled={busy} onClick={() => ref.current?.click()}><Camera size={14} />{busy ? 'Kartvizit okunuyor…' : 'Kartvizit tara'}</button>
      <input ref={ref} type="file" accept="image/*" capture="environment" onChange={sec} style={{ display: 'none' }} />
      <Drawer open={acik} onClose={() => setAcik(false)} width={480} title="Kartvizit bilgileri" sub="Kontrol edin, gerekirse düzeltin, sonra kaydedin"
        footer={<><button className="adm-btn-ghost" onClick={() => setAcik(false)}>Vazgeç</button><button className="adm-btn" disabled={kaydediyor} onClick={kaydet}>{kaydediyor ? 'Kaydediliyor…' : 'Kaydet'}</button></>}>
        <div style={{ padding: 20, display: 'grid', gap: 10 }}>
          <div><Badge tone={GUVEN[f.guven]?.tone || 'amber'}>{GUVEN[f.guven]?.l || GUVEN.orta.l}</Badge></div>
          {([['Fuar adı (sonraki kartlarda hatırlanır)', 'fuar'], ['Firma', 'firma'], ['Kişi', 'kisi'], ['Ünvan', 'unvan'], ['Cep telefonu', 'cep'], ['Telefon', 'telefon'], ['E-posta', 'eposta'], ['Web sitesi', 'website'], ['Adres', 'adres'], ['Ülke', 'ulke']] as const).map(([l, k]) => (
            <label key={k} style={{ display: 'grid', gap: 3, fontSize: 12, color: 'var(--adm-tx3)' }}>{l}
              <input className="adm-inp" value={k === 'fuar' ? fuar : f[k]} onChange={e => (k === 'fuar' ? setFuar(e.target.value) : set(k, e.target.value))} inputMode={k === 'cep' || k === 'telefon' ? 'tel' : k === 'eposta' ? 'email' : undefined} />
            </label>
          ))}
          <label style={{ display: 'grid', gap: 3, fontSize: 12, color: 'var(--adm-tx3)' }}>Not
            <textarea className="adm-inp" rows={3} value={f.notlar} onChange={e => set('notlar', e.target.value)} />
          </label>
        </div>
      </Drawer>
    </>
  )
}
