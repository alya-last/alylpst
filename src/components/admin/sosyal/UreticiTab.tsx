'use client'
import { useEffect, useState } from 'react'
import { web } from '@/lib/web-data'
import { createClient } from '@/lib/supabase/client'
import { aiIstek, AiKapali } from '@/lib/ai-client'
import { Card, Field, FormGrid, Badge } from '@/components/admin/erp/ui'
import { Sparkles, Copy, CalendarPlus, Image as Img } from 'lucide-react'
import { PLATFORM, AMAC, etiketAyikla, etiketMetni, tamMetin, panoyaKopyala, sonrakiGun, bugunTR, type Platform } from './ortak'

type Toast = { show: (m: string, err?: boolean) => void }
type Tas = { baslik: string; metin: string; hashtagler: string; gorsel_fikri: string; eklendi?: boolean }

export default function UreticiTab({ toast, onGorsel, onKaydedildi }: { toast: Toast; onGorsel: (urunId: string) => void; onKaydedildi: () => void }) {
  const [urunler, setUrunler] = useState<any[]>([])
  const [f, setF] = useState<any>({ platform: 'linkedin', amac: 'urun', urun_id: '', dil: 'tr', adet: 3, not: '' })
  const [busy, setBusy] = useState(false)
  const [kapali, setKapali] = useState(false)
  const [liste, setListe] = useState<Tas[]>([])
  const [sonTarih, setSonTarih] = useState(bugunTR())

  useEffect(() => { web.from('products').select('id,name,code,category').order('name').limit(1500).then(({ data }) => setUrunler(data || [])) }, [])

  async function uret(e: React.FormEvent) {
    e.preventDefault(); if (busy) return
    setBusy(true); setListe([])
    try {
      const r = await aiIstek<{ sonuc: any[] }>('sosyal_icerik', { platform: f.platform, amac: f.amac, urun_id: f.urun_id || undefined, dil: f.dil, adet: +f.adet, not: f.not })
      if (!r.sonuc.length) toast.show('AI içerik üretemedi, tekrar deneyin', true)
      setListe(r.sonuc.map(g => ({ baslik: g.baslik, metin: g.metin, hashtagler: etiketMetni(g.hashtagler), gorsel_fikri: g.gorsel_fikri })))
    } catch (err: any) { if (err instanceof AiKapali) setKapali(true); toast.show(err.message, true) }
    setBusy(false)
  }
  const guncelle = (i: number, p: Partial<Tas>) => setListe(l => l.map((x, j) => j === i ? { ...x, ...p } : x))

  async function takvimeEkle(i: number) {
    const g = liste[i]; if (g.eklendi) return
    const { data: { user } } = await createClient().auth.getUser()
    const tarih = sonrakiGun(sonTarih)
    const { error } = await web.from('sosyal_gonderiler').insert({ baslik: g.baslik.slice(0, 160), platform: f.platform, metin: g.metin, hashtagler: etiketAyikla(g.hashtagler), urun_id: f.urun_id || null, planlanan_tarih: tarih, durum: 'planlandi', notlar: g.gorsel_fikri ? `Görsel fikri: ${g.gorsel_fikri}` : null, ai_uretildi: true, created_by: user?.id ?? null })
    if (error) return toast.show(error.message, true)
    setSonTarih(tarih); guncelle(i, { eklendi: true }); toast.show(`Takvime eklendi: ${tarih.split('-').reverse().join('.')}`); onKaydedildi()
  }
  async function kopyala(i: number) { const g = liste[i]; toast.show(await panoyaKopyala(tamMetin(g.metin, etiketAyikla(g.hashtagler))) ? 'Kopyalandı' : 'Kopyalanamadı', false) }

  const lim = PLATFORM[f.platform as Platform]
  return (
    <>
      <Card title="Paylaşım metni üret (B2B — toptan / ihracat alıcıları)">
        <form onSubmit={uret}>
          <FormGrid cols={3}>
            <Field label="Platform"><select className="adm-inp" value={f.platform} onChange={e => setF((x: any) => ({ ...x, platform: e.target.value }))}>{Object.entries(PLATFORM).map(([k, v]) => <option key={k} value={k}>{v.l}</option>)}</select></Field>
            <Field label="Amaç"><select className="adm-inp" value={f.amac} onChange={e => setF((x: any) => ({ ...x, amac: e.target.value }))}>{Object.entries(AMAC).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
            <Field label="Dil"><select className="adm-inp" value={f.dil} onChange={e => setF((x: any) => ({ ...x, dil: e.target.value }))}><option value="tr">Türkçe</option><option value="en">İngilizce (ihracat)</option></select></Field>
            <Field label="Ürün (isteğe bağlı)" span={2}><select className="adm-inp" value={f.urun_id} onChange={e => setF((x: any) => ({ ...x, urun_id: e.target.value }))}><option value="">— Genel / kurumsal —</option>{urunler.map(u => <option key={u.id} value={u.id}>{u.name}{u.code ? ` (${u.code})` : ''}</option>)}</select></Field>
            <Field label="Kaç öneri"><select className="adm-inp" value={f.adet} onChange={e => setF((x: any) => ({ ...x, adet: e.target.value }))}>{[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n}</option>)}</select></Field>
            <Field label="Not (isteğe bağlı)" span={3} hint="Yalnızca burada yazdığınız bilgiler (fuar tarihi, yeni renk vb.) metne girer; AI kendiliğinden uydurmaz"><input className="adm-inp" maxLength={600} value={f.not} onChange={e => setF((x: any) => ({ ...x, not: e.target.value }))} placeholder="Örn. Yeni sezon saksı renkleri katalogda" /></Field>
          </FormGrid>
          <button className="adm-btn" style={{ marginTop: 12 }} disabled={busy || kapali}><Sparkles size={14} />{busy ? 'Üretiliyor…' : 'Üret'}</button>
          {kapali && <p style={{ fontSize: 12, color: 'var(--adm-amber)' }}>AI henüz yapılandırılmamış (OPENAI_API_KEY).</p>}
        </form>
      </Card>

      <div style={{ display: 'grid', gap: 14, marginTop: 16 }}>
        {liste.map((g, i) => {
          const et = etiketAyikla(g.hashtagler), boy = tamMetin(g.metin, et).length
          return (
            <Card key={i} title={<span style={{ display: 'flex', gap: 8, alignItems: 'center' }}><Badge tone="blue">{lim.l}</Badge><input className="adm-inp" style={{ flex: 1, fontWeight: 600 }} maxLength={160} value={g.baslik} onChange={e => guncelle(i, { baslik: e.target.value })} /></span>}>
              <textarea className="adm-inp" rows={9} value={g.metin} onChange={e => guncelle(i, { metin: e.target.value })} style={{ width: '100%', lineHeight: 1.55 }} />
              <input className="adm-inp" style={{ width: '100%', marginTop: 8 }} value={g.hashtagler} onChange={e => guncelle(i, { hashtagler: e.target.value })} placeholder="#hashtag #hashtag" />
              {g.gorsel_fikri && <p style={{ fontSize: 12, color: 'var(--adm-tx3)', margin: '8px 0 0' }}>Görsel fikri: {g.gorsel_fikri}</p>}
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 10, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 11.5, color: boy > lim.limit ? 'var(--adm-red)' : 'var(--adm-tx3)' }}>{boy} / {lim.limit} karakter</span>
                <span style={{ marginLeft: 'auto', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <button className="adm-btn-ghost" onClick={() => kopyala(i)}><Copy size={13} />Kopyala</button>
                  {f.urun_id && <button className="adm-btn-ghost" onClick={() => onGorsel(f.urun_id)}><Img size={13} />Görsel oluştur</button>}
                  <button className="adm-btn" disabled={g.eklendi || boy > lim.limit} onClick={() => takvimeEkle(i)}><CalendarPlus size={13} />{g.eklendi ? 'Eklendi' : 'Takvime ekle'}</button>
                </span>
              </div>
            </Card>)
        })}
      </div>
      {!!liste.length && <p style={{ fontSize: 11.5, color: 'var(--adm-tx3)', marginTop: 12 }}>AI önerileri taslaktır: yayınlamadan önce bilgileri (ölçü, sertifika, tarih vb.) kontrol edin. “Takvime ekle”, salı/perşembe günlerine sırayla yerleştirir; tarihi Takvim sekmesinden değiştirebilirsiniz. Paylaşım sosyal ağlarda sizin tarafınızdan yapılır (otomatik gönderim yoktur).</p>}
    </>
  )
}
