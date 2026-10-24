'use client'
import { useCallback, useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { web } from '@/lib/web-data'
import { personelIstek } from '@/lib/personel-client'
import { Card, Badge, Modal, Field, FormGrid } from '@/components/admin/erp/ui'
import { Plus, Pencil, Trash2, Copy, Power } from 'lucide-react'
import { GUNLER, hhmm, tarihTR } from './ortak'

type Toast = { show: (m: string, err?: boolean) => void }
const bosV = { ad: '', baslangic: '08:00', bitis: '17:00', mola_dk: 60, gec_tolerans_dk: 10, fazla_mesai_esik_dk: 0, aktif: true }

export default function AyarTab({ toast }: { toast: Toast }) {
  const [ayar, setAyar] = useState<any>(null)
  const [vard, setVard] = useState<any[]>([])
  const [tatil, setTatil] = useState<any[]>([])
  const [kiosk, setKiosk] = useState<any[]>([])
  const [vModal, setVModal] = useState(false)
  const [vForm, setVForm] = useState<any>(bosV)
  const [vEdit, setVEdit] = useState<any>(null)
  const [tForm, setTForm] = useState<any>({ tarih: '', ad: '', yarim_gun: false })
  const [kAd, setKAd] = useState('')
  const [kurulum, setKurulum] = useState<{ url: string; qr: string } | null>(null)
  const [busy, setBusy] = useState(false)

  const yukle = useCallback(async () => {
    const [a, v, t, k] = await Promise.all([
      web.from('personel_ayarlari').select('*').eq('id', 1).maybeSingle(),
      web.from('vardiyalar').select('*').order('baslangic'),
      web.from('resmi_tatiller').select('*').gte('tarih', new Date().getFullYear() + '-01-01').order('tarih'),
      web.from('personel_kiosklari').select('id,ad,aktif,son_gorulme,created_at').order('created_at'),
    ])
    setAyar(a.data); setVard(v.data || []); setTatil(t.data || []); setKiosk(k.data || [])
  }, [])
  useEffect(() => { yukle() }, [yukle])

  async function ayarKaydet(e: React.FormEvent) {
    e.preventDefault()
    const { error } = await web.from('personel_ayarlari').update({
      haftalik_normal_saat: +ayar.haftalik_normal_saat, fazla_mesai_carpani: +ayar.fazla_mesai_carpani, cift_okutma_sn: Math.max(0, +ayar.cift_okutma_sn | 0),
      unutulan_cikis_saat: Math.max(1, +ayar.unutulan_cikis_saat | 0), hafta_tatili: +ayar.hafta_tatili, calisma_gunleri: ayar.calisma_gunleri,
    }).eq('id', 1)
    if (error) return toast.show(error.message, true)
    toast.show('Ayarlar kaydedildi')
  }
  async function vKaydet(e: React.FormEvent) {
    e.preventDefault(); if (busy) return; setBusy(true)
    const p = { ad: vForm.ad.trim(), baslangic: vForm.baslangic, bitis: vForm.bitis, mola_dk: +vForm.mola_dk || 0, gec_tolerans_dk: +vForm.gec_tolerans_dk || 0, fazla_mesai_esik_dk: +vForm.fazla_mesai_esik_dk || 0, aktif: !!vForm.aktif }
    const { error } = vEdit ? await web.from('vardiyalar').update(p).eq('id', vEdit.id) : await web.from('vardiyalar').insert(p)
    setBusy(false)
    if (error) return toast.show(error.message, true)
    setVModal(false); toast.show('Vardiya kaydedildi'); yukle()
  }
  async function vSil(v: any) {
    if (!confirm(`“${v.ad}” vardiyası silinsin mi?`)) return
    const { error } = await web.from('vardiyalar').delete().eq('id', v.id)
    if (error) return toast.show(error.message.includes('foreign') ? 'Bu vardiyaya bağlı personel var; önce pasife alın' : error.message, true)
    yukle()
  }
  async function tEkle(e: React.FormEvent) {
    e.preventDefault()
    const { error } = await web.from('resmi_tatiller').upsert({ tarih: tForm.tarih, ad: tForm.ad.trim(), yarim_gun: !!tForm.yarim_gun })
    if (error) return toast.show(error.message, true)
    setTForm({ tarih: '', ad: '', yarim_gun: false }); yukle()
  }
  async function tSil(t: any) { const { error } = await web.from('resmi_tatiller').delete().eq('tarih', t.tarih); if (error) return toast.show(error.message, true); yukle() }

  async function kioskOlustur(e: React.FormEvent) {
    e.preventDefault(); if (!kAd.trim() || busy) return; setBusy(true)
    try {
      const r = await personelIstek<{ kurulum: string }>('kiosk_olustur', { ad: kAd })
      setKurulum({ url: r.kurulum, qr: await QRCode.toDataURL(r.kurulum, { margin: 1, width: 240 }) }); setKAd(''); yukle()
    } catch (e: any) { toast.show(e.message, true) }
    setBusy(false)
  }
  async function kioskDurum(k: any) {
    const { error } = await web.from('personel_kiosklari').update({ aktif: !k.aktif }).eq('id', k.id)
    if (error) return toast.show(error.message, true); yukle()
  }
  async function kioskSil(k: any) {
    if (!confirm(`“${k.ad}” cihazı silinsin mi? Bu cihaz artık okutma yapamaz.`)) return
    const { error } = await web.from('personel_kiosklari').delete().eq('id', k.id)
    if (error) return toast.show(error.message.includes('foreign') ? 'Bu cihazın geçmiş kayıtları var; silmek yerine pasife alın' : error.message, true); yukle()
  }

  if (!ayar) return <p style={{ color: 'var(--adm-tx3)' }}>Yükleniyor…</p>
  const set = (k: string, v: any) => setAyar((a: any) => ({ ...a, [k]: v }))
  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <Card title="Çalışma kuralları">
        <form onSubmit={ayarKaydet}>
          <FormGrid cols={3}>
            <Field label="Haftalık normal süre (saat)" hint="İş Kanunu md. 63: en çok 45 saat"><input type="number" step="0.5" className="adm-inp" value={ayar.haftalik_normal_saat} onChange={e => set('haftalik_normal_saat', e.target.value)} /></Field>
            <Field label="Fazla mesai çarpanı" hint="Yasal alt sınır 1,5"><input type="number" step="0.05" min="1" className="adm-inp" value={ayar.fazla_mesai_carpani} onChange={e => set('fazla_mesai_carpani', e.target.value)} /></Field>
            <Field label="Hafta tatili günü"><select className="adm-inp" value={ayar.hafta_tatili} onChange={e => set('hafta_tatili', e.target.value)}>{GUNLER.map(g => <option key={g.v} value={g.v}>{g.l}</option>)}</select></Field>
            <Field label="Çift okutma engeli (sn)" hint="Aynı kart bu süre içinde tekrar sayılmaz"><input type="number" min="0" className="adm-inp" value={ayar.cift_okutma_sn} onChange={e => set('cift_okutma_sn', e.target.value)} /></Field>
            <Field label="Unutulan çıkış eşiği (saat)" hint="Girişten sonra bu kadar süre geçtiyse yeni okutma giriş sayılır"><input type="number" min="1" className="adm-inp" value={ayar.unutulan_cikis_saat} onChange={e => set('unutulan_cikis_saat', e.target.value)} /></Field>
            <Field label="Çalışma günleri">
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>{GUNLER.map(g => <label key={g.v} style={{ fontSize: 12.5 }}><input type="checkbox" checked={ayar.calisma_gunleri.includes(g.v)} onChange={e => set('calisma_gunleri', e.target.checked ? [...ayar.calisma_gunleri, g.v] : ayar.calisma_gunleri.filter((x: number) => x !== g.v))} /> {g.l}</label>)}</div>
            </Field>
          </FormGrid>
          <button className="adm-btn" style={{ marginTop: 12 }}>Kaydet</button>
          <p style={{ fontSize: 11.5, color: 'var(--adm-tx3)' }}>Varsayılanlar genel kurallara göredir; iş sözleşmeniz, TİS veya sektör düzenlemesi farklıysa değiştirin ve mali müşavirinizle doğrulayın.</p>
        </form>
      </Card>

      <Card title="Vardiyalar" right={<button className="adm-btn" onClick={() => { setVEdit(null); setVForm(bosV); setVModal(true) }}><Plus size={13} />Vardiya</button>} pad={0}>
        {vard.map(v => <div key={v.id} className="adm-row" style={{ padding: '9px 18px', display: 'flex', gap: 12, alignItems: 'center', fontSize: 13 }}>
          <b style={{ flex: 1, opacity: v.aktif ? 1 : .5 }}>{v.ad} {!v.aktif && <Badge tone="muted">pasif</Badge>}</b>
          <span>{hhmm(v.baslangic)}–{hhmm(v.bitis)}</span><span style={{ color: 'var(--adm-tx3)', fontSize: 12 }}>mola {v.mola_dk} dk · tolerans {v.gec_tolerans_dk} dk</span>
          <button className="adm-btn-ghost" style={{ padding: '4px 7px' }} onClick={() => { setVEdit(v); setVForm({ ...v, baslangic: hhmm(v.baslangic), bitis: hhmm(v.bitis) }); setVModal(true) }}><Pencil size={12} /></button>
          <button className="adm-btn-danger" style={{ padding: '4px 7px' }} onClick={() => vSil(v)}><Trash2 size={12} /></button>
        </div>)}
        {!vard.length && <p style={{ padding: '12px 18px', margin: 0, fontSize: 12.5, color: 'var(--adm-tx3)' }}>Vardiya yok.</p>}
      </Card>

      <Card title={`Resmî tatiller (${new Date().getFullYear()}→)`}>
        <form onSubmit={tEkle} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
          <input type="date" className="adm-inp" required style={{ width: 150 }} value={tForm.tarih} onChange={e => setTForm((f: any) => ({ ...f, tarih: e.target.value }))} />
          <input className="adm-inp" required placeholder="Tatil adı" style={{ flex: 1, minWidth: 160 }} value={tForm.ad} onChange={e => setTForm((f: any) => ({ ...f, ad: e.target.value }))} />
          <label style={{ fontSize: 12.5, display: 'flex', alignItems: 'center', gap: 4 }}><input type="checkbox" checked={tForm.yarim_gun} onChange={e => setTForm((f: any) => ({ ...f, yarim_gun: e.target.checked }))} />Yarım gün</label>
          <button className="adm-btn">Ekle</button>
        </form>
        {tatil.map(t => <div key={t.tarih} style={{ display: 'flex', gap: 10, fontSize: 13, padding: '4px 0', alignItems: 'center' }}><span style={{ width: 90 }}>{tarihTR(t.tarih)}</span><span style={{ flex: 1 }}>{t.ad}{t.yarim_gun ? ' (yarım gün)' : ''}</span><button className="adm-btn-danger" style={{ padding: '2px 6px' }} onClick={() => tSil(t)}><Trash2 size={11} /></button></div>)}
        {!tatil.length && <p style={{ fontSize: 12.5, color: 'var(--adm-tx3)', margin: 0 }}>Kayıtlı tatil yok. Dini bayramların tarihleri her yıl değiştiği için her yıl güncellemeyi unutmayın.</p>}
      </Card>

      <Card title="Kiosk cihazları (kapıdaki tablet)">
        <form onSubmit={kioskOlustur} style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
          <input className="adm-inp" placeholder="Cihaz adı (örn. Ana kapı)" maxLength={60} style={{ flex: 1 }} value={kAd} onChange={e => setKAd(e.target.value)} />
          <button className="adm-btn" disabled={busy || !kAd.trim()}>Kurulum bağlantısı oluştur</button>
        </form>
        {kiosk.map(k => <div key={k.id} style={{ display: 'flex', gap: 10, alignItems: 'center', fontSize: 13, padding: '5px 0' }}>
          <b style={{ flex: 1, opacity: k.aktif ? 1 : .5 }}>{k.ad}</b>
          <span style={{ fontSize: 11.5, color: 'var(--adm-tx3)' }}>{k.son_gorulme ? `son: ${new Date(k.son_gorulme).toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul' })}` : 'hiç kullanılmadı'}</span>
          <button className="adm-btn-ghost" style={{ padding: '4px 8px' }} onClick={() => kioskDurum(k)}><Power size={12} />{k.aktif ? 'Pasife al' : 'Aktifleştir'}</button>
          <button className="adm-btn-danger" style={{ padding: '4px 7px' }} onClick={() => kioskSil(k)}><Trash2 size={12} /></button>
        </div>)}
        <p style={{ fontSize: 11.5, color: 'var(--adm-tx3)', margin: '8px 0 0' }}>Bağlantıyı tabletin tarayıcısında (HTTPS, kamera izni verilerek) bir kez açın; cihaz anahtarı tarayıcıya kaydedilir. Tablet kaybolursa cihazı pasife alın.</p>
      </Card>

      <Modal open={!!kurulum} onClose={() => setKurulum(null)} width={520} title="Kiosk kurulum bağlantısı" footer={<button className="adm-btn" onClick={() => setKurulum(null)}>Tamam</button>}>
        {kurulum && <>
          <p style={{ fontSize: 13, color: 'var(--adm-amber)' }}>Bu bağlantı yalnızca şimdi gösterilir ve gizli anahtar içerir. Tabletle aşağıdaki QR’ı okutun veya bağlantıyı tablete gönderin; kimseyle paylaşmayın.</p>
          <div style={{ textAlign: 'center' }}><img src={kurulum.qr} alt="Kurulum QR" width={240} height={240} style={{ background: '#fff' }} /></div>
          <div style={{ display: 'flex', gap: 6, marginTop: 10 }}><input className="adm-inp" readOnly value={kurulum.url} style={{ flex: 1, fontSize: 11 }} onFocus={e => e.target.select()} /><button type="button" className="adm-btn-ghost" onClick={() => { navigator.clipboard?.writeText(kurulum.url); toast.show('Kopyalandı') }}><Copy size={13} /></button></div>
        </>}
      </Modal>

      <Modal open={vModal} onClose={() => setVModal(false)} onSubmit={vKaydet} width={520} title={vEdit ? 'Vardiyayı Düzenle' : 'Yeni Vardiya'}
        footer={<><button type="button" className="adm-btn-ghost" onClick={() => setVModal(false)}>İptal</button><button type="submit" className="adm-btn" disabled={busy}>Kaydet</button></>}>
        <FormGrid cols={2}>
          <Field label="Ad *" span={2}><input className="adm-inp" required value={vForm.ad} onChange={e => setVForm((f: any) => ({ ...f, ad: e.target.value }))} placeholder="Gündüz / Gece" /></Field>
          <Field label="Başlangıç *"><input type="time" className="adm-inp" required value={vForm.baslangic} onChange={e => setVForm((f: any) => ({ ...f, baslangic: e.target.value }))} /></Field>
          <Field label="Bitiş *" hint="Başlangıçtan küçükse gece vardiyası"><input type="time" className="adm-inp" required value={vForm.bitis} onChange={e => setVForm((f: any) => ({ ...f, bitis: e.target.value }))} /></Field>
          <Field label="Mola (dk)" hint="Tek giriş-çıkışta ve ≥4 saatlik çalışmada düşülür"><input type="number" min="0" className="adm-inp" value={vForm.mola_dk} onChange={e => setVForm((f: any) => ({ ...f, mola_dk: e.target.value }))} /></Field>
          <Field label="Geç kalma toleransı (dk)"><input type="number" min="0" className="adm-inp" value={vForm.gec_tolerans_dk} onChange={e => setVForm((f: any) => ({ ...f, gec_tolerans_dk: e.target.value }))} /></Field>
          <Field label="Günlük fazla mesai eşiği (dk)" hint="0 = vardiya süresi"><input type="number" min="0" className="adm-inp" value={vForm.fazla_mesai_esik_dk} onChange={e => setVForm((f: any) => ({ ...f, fazla_mesai_esik_dk: e.target.value }))} /></Field>
          <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 13 }}><input type="checkbox" checked={!!vForm.aktif} onChange={e => setVForm((f: any) => ({ ...f, aktif: e.target.checked }))} />Aktif</label>
        </FormGrid>
      </Modal>
    </div>
  )
}
