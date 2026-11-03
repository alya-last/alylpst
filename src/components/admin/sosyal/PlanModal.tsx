'use client'
import { useState } from 'react'
import { web } from '@/lib/web-data'
import { Modal, Field, FormGrid } from '@/components/admin/erp/ui'
import { CalendarRange, ImagePlus, Rocket } from 'lucide-react'
import { bugunTR } from './ortak'

type Toast = { show: (m: string, err?: boolean) => void }
const AYLAR = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık']
const ayListe = () => { const [y, m] = bugunTR().split('-').map(Number); return [0, 1, 2].map(i => { const d = new Date(Date.UTC(y, m - 1 + i, 1)); return { v: d.toISOString().slice(0, 7), l: `${AYLAR[d.getUTCMonth()]} ${d.getUTCFullYear()}` } }) }

// Aylık plan: salı/perşembe günleri için taslakları üretir → görselleri toplu üretir → onaylayınca hepsi takvimdeki tarih/saatte Upload-Post ile kendiliğinden paylaşılır.
export default function PlanModal({ toast, onKapat, onBitti }: { toast: Toast; onKapat: () => void; onBitti: () => void }) {
  const [ay, setAy] = useState(ayListe()[0].v)
  const [li, setLi] = useState(true), [ig, setIg] = useState(true), [dil, setDil] = useState('en')
  const [is, setIs] = useState<string>('')
  const [calisiyor, setCalisiyor] = useState(false)

  async function postJson(url: string, body: any) {
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    const j = await res.json().catch(() => ({})); return { ok: res.ok, j }
  }
  async function planUret() {
    if (calisiyor) return; setCalisiyor(true); setIs('Plan hazırlanıyor (yaklaşık 30-60 sn)…')
    const { ok, j } = await postJson('/api/admin/sosyal-plan', { ay, dil, platformlar: [li && 'linkedin', ig && 'instagram'].filter(Boolean) })
    setCalisiyor(false)
    if (!ok) { setIs(''); return toast.show(j.error || 'Plan üretilemedi', true) }
    setIs(`${j.adet} taslak hazır${j.adet < j.istenen ? ` (${j.istenen - j.adet} gönderi üretilemedi)` : ''}.`); toast.show(`${j.adet} taslak takvime eklendi`); onBitti()
  }
  async function ayGonderileri(durumlar: string[]) {
    const { data } = await web.from('sosyal_gonderiler').select('id,platform,durum,gorsel_yol,gorsel_yonerge,planlanan_tarih').gte('planlanan_tarih', `${ay}-01`).lte('planlanan_tarih', `${ay}-31`).in('durum', durumlar).order('planlanan_tarih')
    return (data || []) as any[]
  }
  async function gorselleriUret() {
    if (calisiyor) return
    const l = (await ayGonderileri(['taslak'])).filter(r => !r.gorsel_yol && (r.gorsel_yonerge || '').length >= 10)
    if (!l.length) return toast.show('Görseli olmayan taslak yok', false)
    if (!confirm(`${l.length} görsel üretilecek (her biri OpenAI'dan ücret keser, yaklaşık ${Math.ceil(l.length * 30 / 60)} dk sürer). Devam?`)) return
    setCalisiyor(true); let tam = 0, hata = 0
    for (const r of l) {
      setIs(`Görsel üretiliyor: ${tam + hata + 1} / ${l.length}`)
      const { ok } = await postJson('/api/admin/sosyal-gorsel', { id: r.id, yonerge: r.gorsel_yonerge, format: r.platform === 'linkedin' ? 'linkedin' : 'kare' })
      if (ok) tam++; else hata++
    }
    setCalisiyor(false); setIs(`${tam} görsel hazır${hata ? `, ${hata} üretilemedi (tekrar deneyin)` : ''}.`); onBitti()
  }
  async function hepsiniOnayla() {
    if (calisiyor) return
    const l = (await ayGonderileri(['taslak'])).filter(r => r.platform === 'linkedin' || r.gorsel_yol)
    if (!l.length) return toast.show('Onaylanacak hazır taslak yok (Instagram için görsel gerekli)', true)
    if (!confirm(`${l.length} gönderi ONAYLANACAK ve takvimdeki tarih/saatte kendiliğinden paylaşılacak. Önce takvimde metinleri kontrol ettiniz mi?`)) return
    setCalisiyor(true); let tam = 0, hata = 0, ilk = ''
    for (const r of l) {
      setIs(`Onaylanıyor: ${tam + hata + 1} / ${l.length}`)
      const { ok, j } = await postJson('/api/admin/sosyal-yayinla', { id: r.id, zamanla: true })
      if (ok) tam++; else { hata++; ilk = ilk || j.error || '' }
    }
    setCalisiyor(false); setIs(`${tam} gönderi zamanlandı${hata ? `, ${hata} başarısız: ${ilk}` : ''}.`); onBitti()
  }

  return (
    <Modal open onClose={onKapat} width={640} title="Aylık plan (otomatik paylaşım)" footer={<button type="button" className="adm-btn-ghost" onClick={onKapat}>Kapat</button>}>
      <p style={{ fontSize: 12.5, color: 'var(--adm-tx3)', marginTop: 0 }}>Seçilen ayın salı ve perşembe günleri için yapay zeka gönderi hazırlar (LinkedIn 10:00, Instagram 13:00 — İstanbul saati). Siz gözden geçirip onaylayınca her gönderi kendi gününde otomatik paylaşılır; onaylamadığınız gönderi yayınlanmaz.</p>
      <FormGrid cols={3}>
        <Field label="Ay"><select className="adm-inp" value={ay} onChange={e => setAy(e.target.value)}>{ayListe().map(a => <option key={a.v} value={a.v}>{a.l}</option>)}</select></Field>
        <Field label="Dil"><select className="adm-inp" value={dil} onChange={e => setDil(e.target.value)}><option value="en">İngilizce (global)</option><option value="tr">Türkçe</option></select></Field>
        <Field label="Platform"><div style={{ display: 'flex', gap: 12, paddingTop: 6 }}><label><input type="checkbox" checked={li} onChange={e => setLi(e.target.checked)} /> LinkedIn</label><label><input type="checkbox" checked={ig} onChange={e => setIg(e.target.checked)} /> Instagram</label></div></Field>
      </FormGrid>
      <div style={{ display: 'grid', gap: 8, marginTop: 14 }}>
        <button type="button" className="adm-btn" disabled={calisiyor || (!li && !ig)} onClick={planUret}><CalendarRange size={14} />1. Planı üret (taslaklar)</button>
        <button type="button" className="adm-btn-ghost" disabled={calisiyor} onClick={gorselleriUret}><ImagePlus size={14} />2. Görselleri üret (ChatGPT)</button>
        <button type="button" className="adm-btn" disabled={calisiyor} onClick={hepsiniOnayla}><Rocket size={14} />3. Tümünü onayla ve zamanla</button>
      </div>
      {is && <p style={{ fontSize: 13, marginTop: 12, fontWeight: 600 }}>{is}</p>}
      <p style={{ fontSize: 11.5, color: 'var(--adm-tx3)', marginTop: 10 }}>Adımlar arasında Takvim sekmesinde her gönderiye tıklayıp metni ve görseli düzenleyebilirsiniz. İptal etmek için gönderide “Onay ve paylaşım…” → “Zamanlamayı iptal et”. Upload-Post bağlantısı kurulmadan 3. adım çalışmaz.</p>
    </Modal>
  )
}
