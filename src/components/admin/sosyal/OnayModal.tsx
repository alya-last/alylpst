'use client'
import { useEffect, useState } from 'react'
import { web } from '@/lib/web-data'
import { Modal, Field, FormGrid } from '@/components/admin/erp/ui'
import { Sparkles, Send, ImagePlus } from 'lucide-react'
import { PLATFORM, etiketAyikla, etiketMetni, tamMetin, type Platform } from './ortak'

type Toast = { show: (m: string, err?: boolean) => void }
const FORMATLAR: Record<string, string> = { kare: 'Kare 1:1 (Instagram)', dikey: 'Dikey 4:5 (Instagram)', linkedin: 'Yatay (LinkedIn)' }

// Paylaşım onay ekranı: metin/hashtag düzenle → ürün seç (isteğe bağlı) → görsel yönergesi yaz → ChatGPT ile görsel üret → onayla ve paylaş.
export default function OnayModal({ r, urunler, toast, onKapat, onBitti }: { r: any; urunler: any[]; toast: Toast; onKapat: () => void; onBitti: () => void }) {
  const [metin, setMetin] = useState<string>(r.metin || '')
  const [etiket, setEtiket] = useState<string>(etiketMetni(r.hashtagler || []))
  const [urunId, setUrunId] = useState<string>(r.urun_id || '')
  const [format, setFormat] = useState<string>(r.platform === 'linkedin' ? 'linkedin' : 'kare')
  const [yonerge, setYonerge] = useState<string>(r.gorsel_yonerge || '')
  const [gorsel, setGorsel] = useState<string | null>(null)
  const [hazir, setHazir] = useState<boolean | null>(null)
  const [uretiyor, setUretiyor] = useState(false)
  const [paylasiyor, setPaylasiyor] = useState(false)
  const pl = PLATFORM[r.platform as Platform], desteklenir = r.platform === 'linkedin' || r.platform === 'instagram'
  const urunAd = urunler.find(u => u.id === urunId)?.name as string | undefined

  useEffect(() => {
    fetch(`/api/admin/sosyal-gorsel?id=${r.id}`).then(x => x.json()).then(j => { if (j?.url) setGorsel(j.url); if (j?.yonerge) setYonerge(y => y || j.yonerge) }).catch(() => {})
    fetch('/api/admin/sosyal-yayinla').then(x => x.json()).then(j => setHazir(!!j?.hazir)).catch(() => setHazir(false))
  }, [r.id])

  const onerilen = () => urunAd
    ? `Professional product photo of "${urunAd}" by Alya Plastik (plastic planter / basket manufacturer), placed in a bright, tasteful modern home or garden setting, soft natural light, clean composition, premium look suitable for global B2B wholesale marketing on ${pl.l}.`
    : `Clean, modern plastic manufacturing facility in Istanbul with neatly stacked colorful plastic planters and baskets, professional corporate photography, bright daylight, premium look suitable for global B2B wholesale marketing on ${pl.l}.`

  async function kaydet() {
    const { error } = await web.from('sosyal_gonderiler').update({ metin: metin.trim(), hashtagler: etiketAyikla(etiket), urun_id: urunId || null, gorsel_yonerge: yonerge.trim() || null, updated_at: new Date().toISOString() }).eq('id', r.id)
    if (error) { toast.show(error.message, true); return false }
    return true
  }
  async function gorselUret() {
    if (uretiyor) return
    if (yonerge.trim().length < 10) return toast.show('Görsel yönergesini yazın (en az 10 karakter) ya da “Yönergeyi öner”e basın', true)
    setUretiyor(true)
    try {
      if (!(await kaydet())) return
      const res = await fetch('/api/admin/sosyal-gorsel', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: r.id, yonerge, format }) })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) return toast.show(j.error || 'Görsel üretilemedi', true)
      setGorsel(j.url); toast.show(j.urun_referansli ? 'Görsel hazır (ürün fotoğrafı referans alındı)' : 'Görsel hazır')
    } catch { toast.show('Sunucuya ulaşılamadı', true) } finally { setUretiyor(false) }
  }
  async function paylas() {
    if (paylasiyor) return
    if (r.platform === 'instagram' && !gorsel) return toast.show('Instagram için önce görsel üretin', true)
    if (!confirm(`${pl.l}'da paylaşılsın mı? Bu işlem geri alınamaz.\n\n${tamMetin(metin, etiketAyikla(etiket)).slice(0, 300)}…`)) return
    setPaylasiyor(true)
    try {
      if (!(await kaydet())) return
      const res = await fetch('/api/admin/sosyal-yayinla', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: r.id }) })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) return toast.show(j.error || 'Paylaşılamadı', true)
      toast.show(j.mesaj || 'Paylaşıldı'); onBitti()
    } catch { toast.show('Sunucuya ulaşılamadı', true) } finally { setPaylasiyor(false) }
  }

  const boy = tamMetin(metin, etiketAyikla(etiket)).length
  return (
    <Modal open onClose={onKapat} width={760} title={`Onay ve paylaşım — ${pl.l}`}
      footer={<><button type="button" className="adm-btn-ghost" onClick={onKapat}>Kapat</button>
        <button type="button" className="adm-btn" disabled={!desteklenir || !hazir || paylasiyor || boy > pl.limit || metin.trim().length < 5} onClick={paylas}><Send size={13} />{paylasiyor ? 'Paylaşılıyor…' : 'Onayla ve paylaş'}</button></>}>
      {!desteklenir && <p style={{ color: 'var(--adm-amber)', fontSize: 12.5 }}>Otomatik paylaşım yalnızca LinkedIn ve Instagram için açık.</p>}
      {hazir === false && <p style={{ color: 'var(--adm-amber)', fontSize: 12.5 }}>Upload-Post bağlantısı henüz yapılandırılmamış; metin ve görseli hazırlayabilirsiniz, paylaşım butonu bağlantı kurulunca açılır.</p>}
      <FormGrid cols={3}>
        <Field label="Metin" span={3}><textarea className="adm-inp" rows={8} maxLength={3000} value={metin} onChange={e => setMetin(e.target.value)} /></Field>
        <Field label="Hashtagler" span={3} hint={`${boy} / ${pl.limit} karakter`}><input className="adm-inp" value={etiket} onChange={e => setEtiket(e.target.value)} placeholder="#plasticplanters #wholesale" /></Field>
        <Field label="Ürün (isteğe bağlı — seçilirse görsel ürün fotoğrafına göre üretilir)" span={2}><select className="adm-inp" value={urunId} onChange={e => setUrunId(e.target.value)}><option value="">— Ürün yok / genel görsel —</option>{urunler.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}</select></Field>
        <Field label="Görsel formatı"><select className="adm-inp" value={format} onChange={e => setFormat(e.target.value)}>{Object.entries(FORMATLAR).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
        <Field label="Görsel yönergesi (ChatGPT'ye ne çizeceğini anlatın; İngilizce yazarsanız daha iyi sonuç verir)" span={3}>
          <textarea className="adm-inp" rows={4} maxLength={1500} value={yonerge} onChange={e => setYonerge(e.target.value)} placeholder="Örn: Bright garden terrace with the selected planter, soft morning light, minimal style…" />
        </Field>
      </FormGrid>
      <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
        <button type="button" className="adm-btn-ghost" onClick={() => setYonerge(onerilen())}><Sparkles size={13} />Yönergeyi öner</button>
        <button type="button" className="adm-btn" disabled={uretiyor} onClick={gorselUret}><ImagePlus size={13} />{uretiyor ? 'Görsel üretiliyor (≈30 sn)…' : gorsel ? 'Yeniden üret' : 'Görsel üret'}</button>
      </div>
      {gorsel && <div style={{ marginTop: 12 }}><img src={gorsel} alt="Üretilen görsel" style={{ maxWidth: '100%', maxHeight: 420, borderRadius: 8, border: '1px solid var(--adm-bd)' }} /></div>}
      <p style={{ fontSize: 11.5, color: 'var(--adm-tx3)', marginTop: 10 }}>Yapay zeka çıktıları taslaktır: görseldeki ürün ve yazıdaki bilgileri paylaşmadan önce kontrol edin. “Onayla ve paylaş” gönderiyi hemen yayınlar.</p>
    </Modal>
  )
}
