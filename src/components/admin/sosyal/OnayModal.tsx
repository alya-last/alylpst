'use client'
import { useEffect, useState } from 'react'
import { web } from '@/lib/web-data'
import { Modal, Field, FormGrid } from '@/components/admin/erp/ui'
import { Sparkles, Send, ImagePlus, Rocket } from 'lucide-react'
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
  const [kaynakTur, setKaynakTur] = useState<'ai' | 'urun'>('ai')
  const [hazir, setHazir] = useState<boolean | null>(null)
  const [uretiyor, setUretiyor] = useState(false)
  const [paylasiyor, setPaylasiyor] = useState(false)
  const [tarih, setTarih] = useState<string>(r.planlanan_tarih || '')
  const [saat, setSaat] = useState<string>(r.planlanan_saat || (r.platform === 'linkedin' ? '10:00' : '13:00'))
  const zamanli = r.durum === 'zamanlandi'
  const pl = PLATFORM[r.platform as Platform], desteklenir = r.platform === 'linkedin' || r.platform === 'instagram'
  const urunAd = urunler.find(u => u.id === urunId)?.name as string | undefined

  useEffect(() => {
    fetch(`/api/admin/sosyal-gorsel?id=${r.id}`).then(x => x.json()).then(j => { if (j?.url) setGorsel(j.url); if (j?.yonerge) setYonerge(y => y || j.yonerge) }).catch(() => {})
    fetch('/api/admin/sosyal-yayinla').then(x => x.json()).then(j => setHazir(!!j?.hazir)).catch(() => setHazir(false))
  }, [r.id])

  const onerilen = () => urunAd
    ? `Real-life photo of "${urunAd}" (plastic planter / basket by Alya Plastik) in everyday use on a home balcony, garden or shop display, planted with real plants, authentic documentary-style photo, shot on a smartphone, natural daylight, slightly imperfect framing, real lived-in setting with real plants and everyday objects, true-to-life colors, not a polished catalog render; suitable for a ${pl.l} B2B wholesale post.`
    : `Candid photo inside a working plastic planter factory warehouse in Istanbul, stacks of colorful planters and baskets on pallets, workers' tools nearby, authentic documentary-style photo, shot on a smartphone, natural daylight, slightly imperfect framing, real lived-in setting with real plants and everyday objects, true-to-life colors, not a polished catalog render; suitable for a ${pl.l} B2B wholesale post.`

  async function kaydet() {
    const { error } = await web.from('sosyal_gonderiler').update({ metin: metin.trim(), hashtagler: etiketAyikla(etiket), urun_id: urunId || null, gorsel_yonerge: yonerge.trim() || null, planlanan_tarih: tarih || null, planlanan_saat: saat || null, updated_at: new Date().toISOString() }).eq('id', r.id)
    if (error) { toast.show(error.message, true); return false }
    return true
  }
  async function gorselUret() {
    if (uretiyor) return
    if (kaynakTur === 'urun' && !urunId) return toast.show('Ürünün kendi fotoğrafı için önce ürün seçin', true)
    if (kaynakTur === 'ai' && yonerge.trim().length < 10) return toast.show('Görsel yönergesini yazın (en az 10 karakter) ya da “Yönergeyi öner”e basın', true)
    setUretiyor(true)
    try {
      if (!(await kaydet())) return
      const res = await fetch('/api/admin/sosyal-gorsel', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: r.id, yonerge, format, kaynak: kaynakTur }) })
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

  async function zamanla(iptal = false) {
    if (paylasiyor) return
    if (!iptal) {
      if (!tarih) return toast.show('Zamanlamak için tarih seçin', true)
      if (r.platform === 'instagram' && !gorsel) return toast.show('Instagram için önce görsel üretin', true)
      if (!confirm(`${pl.l} paylaşımı ${tarih.split('-').reverse().join('.')} ${saat} (İstanbul saati) için onaylansın mı? O tarihte kendiliğinden yayınlanır.`)) return
    }
    setPaylasiyor(true)
    try {
      if (!iptal && !(await kaydet())) return
      const res = await fetch('/api/admin/sosyal-yayinla', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(iptal ? { id: r.id, iptal: true } : { id: r.id, zamanla: true }) })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) return toast.show(j.error || 'İşlem başarısız', true)
      toast.show(iptal ? 'Zamanlama iptal edildi (taslağa döndü)' : (j.mesaj || 'Zamanlandı')); onBitti()
    } catch { toast.show('Sunucuya ulaşılamadı', true) } finally { setPaylasiyor(false) }
  }
  const boy = tamMetin(metin, etiketAyikla(etiket)).length
  return (
    <Modal open onClose={onKapat} width={760} title={`Onay ve paylaşım — ${pl.l}`}
      footer={<><button type="button" className="adm-btn-ghost" onClick={onKapat}>Kapat</button>
        {zamanli
          ? <button type="button" className="adm-btn-danger" disabled={paylasiyor} onClick={() => zamanla(true)}>Zamanlamayı iptal et</button>
          : <><button type="button" className="adm-btn-ghost" disabled={!desteklenir || !hazir || paylasiyor || boy > pl.limit || metin.trim().length < 5} onClick={() => zamanla(false)}><Rocket size={13} />Onayla ve zamanla</button>
            <button type="button" className="adm-btn" disabled={!desteklenir || !hazir || paylasiyor || boy > pl.limit || metin.trim().length < 5} onClick={paylas}><Send size={13} />{paylasiyor ? 'Paylaşılıyor…' : 'Şimdi paylaş'}</button></>}</>}>
      {!desteklenir && <p style={{ color: 'var(--adm-amber)', fontSize: 12.5 }}>Otomatik paylaşım yalnızca LinkedIn ve Instagram için açık.</p>}
      {hazir === false && <p style={{ color: 'var(--adm-amber)', fontSize: 12.5 }}>Upload-Post bağlantısı henüz yapılandırılmamış; metin ve görseli hazırlayabilirsiniz, paylaşım butonu bağlantı kurulunca açılır.</p>}
      <FormGrid cols={3}>
        <Field label="Metin" span={3}><textarea className="adm-inp" rows={8} maxLength={3000} value={metin} onChange={e => setMetin(e.target.value)} /></Field>
        <Field label="Hashtagler" span={3} hint={`${boy} / ${pl.limit} karakter`}><input className="adm-inp" value={etiket} onChange={e => setEtiket(e.target.value)} placeholder="#plasticplanters #wholesale" /></Field>
        <Field label="Ürün (isteğe bağlı — seçilirse görsel ürün fotoğrafına göre üretilir)" span={2}><select className="adm-inp" value={urunId} onChange={e => setUrunId(e.target.value)}><option value="">— Ürün yok / genel görsel —</option>{urunler.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}</select></Field>
        <Field label="Paylaşım tarihi"><input type="date" className="adm-inp" value={tarih} onChange={e => setTarih(e.target.value)} /></Field>
        <Field label="Saat (İstanbul)"><input type="time" className="adm-inp" value={saat} onChange={e => setSaat(e.target.value)} /></Field>
        <Field label="Görsel formatı"><select className="adm-inp" value={format} onChange={e => setFormat(e.target.value)}>{Object.entries(FORMATLAR).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
        <Field label="Görsel kaynağı" span={3}><select className="adm-inp" value={kaynakTur} onChange={e => setKaynakTur(e.target.value as 'ai' | 'urun')}><option value="ai">Yapay zeka üretsin (ChatGPT)</option><option value="urun">Ürünün kendi gerçek fotoğrafı (yapay zeka yok)</option></select></Field>
        <Field label="Görsel yönergesi (ChatGPT'ye ne çizeceğini anlatın; İngilizce yazarsanız daha iyi sonuç verir)" span={3}>
          <textarea className="adm-inp" rows={4} maxLength={1500} value={yonerge} onChange={e => setYonerge(e.target.value)} placeholder="Örn: Bright garden terrace with the selected planter, soft morning light, minimal style…" />
        </Field>
      </FormGrid>
      <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
        <button type="button" className="adm-btn-ghost" onClick={() => setYonerge(onerilen())}><Sparkles size={13} />Yönergeyi öner</button>
        <button type="button" className="adm-btn" disabled={uretiyor} onClick={gorselUret}><ImagePlus size={13} />{uretiyor ? (kaynakTur === 'ai' ? 'Görsel üretiliyor (≈30 sn)…' : 'Yükleniyor…') : kaynakTur === 'urun' ? 'Ürün fotoğrafını kullan' : gorsel ? 'Yeniden üret' : 'Görsel üret'}</button>
      </div>
      {gorsel && <div style={{ marginTop: 12 }}><img src={gorsel} alt="Üretilen görsel" style={{ maxWidth: '100%', maxHeight: 420, borderRadius: 8, border: '1px solid var(--adm-bd)' }} /></div>}
      <p style={{ fontSize: 11.5, color: 'var(--adm-tx3)', marginTop: 10 }}>Yapay zeka çıktıları taslaktır: görseldeki ürün ve yazıdaki bilgileri paylaşmadan önce kontrol edin. “Onayla ve paylaş” gönderiyi hemen yayınlar.</p>
    </Modal>
  )
}
