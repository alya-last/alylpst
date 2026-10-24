'use client'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { web } from '@/lib/web-data'
import { createClient } from '@/lib/supabase/client'
import { Badge, Modal, Field, FormGrid, Card } from '@/components/admin/erp/ui'
import { ChevronLeft, ChevronRight, Plus, Copy, Trash2, Send } from 'lucide-react'
import { PLATFORM, DURUM, bugunTR, tarihTR, etiketAyikla, etiketMetni, tamMetin, panoyaKopyala, type Platform } from './ortak'

type Toast = { show: (m: string, err?: boolean) => void }
const AYLAR = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık']
const ayEkle = (d: string, n: number) => { const [y, m] = d.split('-').map(Number); return new Date(Date.UTC(y, m - 1 + n, 1)).toISOString().slice(0, 7) }
const bos = { baslik: '', platform: 'linkedin', metin: '', hashtagler: '', urun_id: '', planlanan_tarih: '', durum: 'taslak', paylasim_url: '', notlar: '' }

export default function TakvimTab({ toast, yenile }: { toast: Toast; yenile: number }) {
  const [ay, setAy] = useState(bugunTR().slice(0, 7))
  const [rows, setRows] = useState<any[]>([])
  const [urunler, setUrunler] = useState<any[]>([])
  const [modal, setModal] = useState(false)
  const [edit, setEdit] = useState<any>(null)
  const [form, setForm] = useState<any>(bos)
  const [busy, setBusy] = useState(false)

  const yukle = useCallback(async () => {
    const [g, u] = await Promise.all([web.from('sosyal_gonderiler').select('*').order('planlanan_tarih', { ascending: true, nullsFirst: false }).limit(1500), web.from('products').select('id,name').order('name').limit(1500)])
    if (g.error) toast.show(g.error.message, true)
    setRows(g.data || []); setUrunler(u.data || [])
  }, []) // eslint-disable-line
  useEffect(() => { yukle() }, [yukle, yenile])

  const [y, m] = ay.split('-').map(Number)
  const gunler = useMemo(() => {
    const ilk = new Date(Date.UTC(y, m - 1, 1)), bosluk = (ilk.getUTCDay() + 6) % 7, n = new Date(Date.UTC(y, m, 0)).getUTCDate()
    return [...Array(bosluk).fill(null), ...Array.from({ length: n }, (_, i) => `${ay}-${String(i + 1).padStart(2, '0')}`)]
  }, [ay, y, m])
  const gunGonderi = (t: string) => rows.filter(r => r.planlanan_tarih === t)
  const plansiz = rows.filter(r => !r.planlanan_tarih && r.durum !== 'paylasildi')
  const bugun = bugunTR()

  const ac = (r?: any, tarih?: string) => {
    setEdit(r || null)
    setForm(r ? { ...bos, ...Object.fromEntries(Object.entries(r).map(([k, v]) => [k, v ?? ''])), hashtagler: etiketMetni(r.hashtagler || []) } : { ...bos, planlanan_tarih: tarih || '', durum: tarih ? 'planlandi' : 'taslak' })
    setModal(true)
  }
  async function kaydet(e: React.FormEvent) {
    e.preventDefault(); if (busy) return
    if (form.durum === 'planlandi' && !form.planlanan_tarih) return toast.show('Planlandı durumu için tarih seçin', true)
    if (form.paylasim_url && !/^https:\/\//.test(form.paylasim_url)) return toast.show('Paylaşım bağlantısı https:// ile başlamalı', true)
    setBusy(true)
    const { data: { user } } = await createClient().auth.getUser()
    const p: any = { baslik: form.baslik.trim(), platform: form.platform, metin: form.metin.trim(), hashtagler: etiketAyikla(form.hashtagler), urun_id: form.urun_id || null, planlanan_tarih: form.planlanan_tarih || null, durum: form.durum, paylasim_url: form.paylasim_url || null, notlar: form.notlar || null, updated_at: new Date().toISOString() }
    const { error } = edit ? await web.from('sosyal_gonderiler').update(p).eq('id', edit.id) : await web.from('sosyal_gonderiler').insert({ ...p, created_by: user?.id ?? null })
    setBusy(false)
    if (error) return toast.show(error.message, true)
    setModal(false); toast.show('Kaydedildi'); yukle()
  }
  async function sil() {
    if (!edit || !confirm('Bu gönderi silinsin mi?')) return
    const { error } = await web.from('sosyal_gonderiler').delete().eq('id', edit.id)
    if (error) return toast.show(error.message, true)
    setModal(false); yukle()
  }
  async function n8nGonder(r: any) {
    if (!confirm(`“${r.baslik}” n8n'e gönderilsin mi? (${PLATFORM[r.platform as Platform].l})`)) return
    try {
      const res = await fetch('/api/admin/sosyal-gonder', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: r.id }) })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) return toast.show(j.error || 'Gönderilemedi', true)
      toast.show('n8n’e gönderildi; n8n paylaşınca durum kendiliğinden “Paylaşıldı” olur')
    } catch { toast.show('Sunucuya ulaşılamadı', true) }
  }
  async function hizliDurum(r: any, durum: string) {
    const { error } = await web.from('sosyal_gonderiler').update({ durum, updated_at: new Date().toISOString() }).eq('id', r.id)
    if (error) return toast.show(error.message, true); yukle()
  }
  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }))
  const chip = (r: any) => <button key={r.id} onClick={e => { e.stopPropagation(); ac(r) }} title={`${PLATFORM[r.platform as Platform].l} · ${DURUM[r.durum].l}\n${r.baslik}`}
    style={{ display: 'block', width: '100%', textAlign: 'left', fontSize: 10.5, padding: '2px 5px', marginTop: 3, border: 0, borderLeft: `3px solid ${PLATFORM[r.platform as Platform].renk}`, background: r.durum === 'paylasildi' ? 'rgba(31,157,99,.18)' : 'var(--adm-bg2)', color: 'var(--adm-tx)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', opacity: r.durum === 'paylasildi' ? .7 : 1, cursor: 'pointer' }}>{r.durum === 'paylasildi' ? '✓ ' : ''}{r.baslik}</button>

  return (
    <>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12, flexWrap: 'wrap' }}>
        <button className="adm-btn-ghost" onClick={() => setAy(ayEkle(ay + '-01', -1))}><ChevronLeft size={14} /></button>
        <b style={{ minWidth: 130, textAlign: 'center' }}>{AYLAR[m - 1]} {y}</b>
        <button className="adm-btn-ghost" onClick={() => setAy(ayEkle(ay + '-01', 1))}><ChevronRight size={14} /></button>
        <button className="adm-btn-ghost" onClick={() => setAy(bugun.slice(0, 7))}>Bugün</button>
        <span style={{ marginLeft: 'auto' }}><button className="adm-btn" onClick={() => ac()}><Plus size={14} />Gönderi Ekle</button></span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,minmax(0,1fr))', gap: 1, background: 'var(--adm-bd)', border: '1px solid var(--adm-bd)' }}>
        {['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'].map(g => <div key={g} style={{ background: 'var(--adm-bg2)', padding: '6px 8px', fontSize: 11, color: 'var(--adm-tx3)' }}>{g}</div>)}
        {gunler.map((t, i) => t ? (
          <div key={t} onClick={() => ac(undefined, t)} style={{ background: 'var(--adm-bg)', minHeight: 92, padding: 5, cursor: 'pointer', outline: t === bugun ? '2px solid var(--adm-ac)' : undefined, outlineOffset: -2 }}>
            <div style={{ fontSize: 11.5, color: t === bugun ? 'var(--adm-ac)' : 'var(--adm-tx3)', fontWeight: t === bugun ? 700 : 400 }}>{+t.slice(8)}</div>
            {gunGonderi(t).map(chip)}
          </div>) : <div key={'b' + i} style={{ background: 'var(--adm-bg)', opacity: .4 }} />)}
      </div>
      <p style={{ fontSize: 11.5, color: 'var(--adm-tx3)', margin: '8px 0 16px' }}>Bir güne tıklayarak gönderi ekleyin; gönderiye tıklayarak düzenleyin. Renkli çizgi platformu gösterir: <span style={{ color: PLATFORM.linkedin.renk }}>LinkedIn</span> · <span style={{ color: PLATFORM.instagram.renk }}>Instagram</span> · <span style={{ color: PLATFORM.facebook.renk }}>Facebook</span>.</p>

      <Card title={`Tarihsiz taslaklar (${plansiz.length})`} pad={0}>
        {plansiz.length === 0 ? <p style={{ margin: 0, padding: '12px 18px', fontSize: 12.5, color: 'var(--adm-tx3)' }}>Tarihsiz taslak yok.</p> : plansiz.map(r => (
          <div key={r.id} className="adm-row" style={{ padding: '8px 18px', display: 'flex', gap: 10, alignItems: 'center', fontSize: 13, cursor: 'pointer' }} onClick={() => ac(r)}>
            <Badge tone="blue">{PLATFORM[r.platform as Platform].l}</Badge><span style={{ flex: 1 }}>{r.baslik}</span>
          </div>))}
      </Card>
      <div style={{ marginTop: 16 }}>
        <Card title="Yaklaşan gönderiler" pad={0}>
          {rows.filter(r => r.planlanan_tarih && r.planlanan_tarih >= bugun && r.durum !== 'paylasildi').slice(0, 15).map(r => (
            <div key={r.id} className="adm-row" style={{ padding: '8px 18px', display: 'flex', gap: 10, alignItems: 'center', fontSize: 13 }}>
              <span style={{ width: 80, color: r.planlanan_tarih === bugun ? 'var(--adm-ac)' : undefined, fontWeight: r.planlanan_tarih === bugun ? 700 : 400 }}>{tarihTR(r.planlanan_tarih)}</span>
              <Badge tone="blue">{PLATFORM[r.platform as Platform].l}</Badge>
              <span style={{ flex: 1, cursor: 'pointer' }} onClick={() => ac(r)}>{r.baslik}</span>
              <button className="adm-btn-ghost" style={{ padding: '3px 8px', fontSize: 12 }} onClick={async () => toast.show(await panoyaKopyala(tamMetin(r.metin, r.hashtagler)) ? 'Kopyalandı' : 'Kopyalanamadı')}><Copy size={12} />Kopyala</button>
              <button className="adm-btn-ghost" style={{ padding: '3px 8px', fontSize: 12 }} onClick={() => n8nGonder(r)} title="n8n workflow'una gönder"><Send size={12} />n8n</button>
              <button className="adm-btn-ghost" style={{ padding: '3px 8px', fontSize: 12 }} onClick={() => hizliDurum(r, 'paylasildi')}>Paylaşıldı</button>
            </div>))}
        </Card>
      </div>

      <Modal open={modal} onClose={() => setModal(false)} onSubmit={kaydet} width={720} title={edit ? 'Gönderiyi Düzenle' : 'Yeni Gönderi'}
        footer={<>{edit && <button type="button" className="adm-btn-danger" style={{ marginRight: 'auto' }} onClick={sil}><Trash2 size={13} />Sil</button>}<button type="button" className="adm-btn-ghost" onClick={() => setModal(false)}>İptal</button><button type="submit" className="adm-btn" disabled={busy}>Kaydet</button></>}>
        <FormGrid cols={3}>
          <Field label="Başlık (iç not) *" span={3}><input className="adm-inp" required maxLength={160} value={form.baslik} onChange={e => set('baslik', e.target.value)} /></Field>
          <Field label="Platform"><select className="adm-inp" value={form.platform} onChange={e => set('platform', e.target.value)}>{Object.entries(PLATFORM).map(([k, v]) => <option key={k} value={k}>{v.l}</option>)}</select></Field>
          <Field label="Tarih"><input type="date" className="adm-inp" value={form.planlanan_tarih} onChange={e => set('planlanan_tarih', e.target.value)} /></Field>
          <Field label="Durum"><select className="adm-inp" value={form.durum} onChange={e => set('durum', e.target.value)}>{Object.entries(DURUM).map(([k, v]) => <option key={k} value={k}>{v.l}</option>)}</select></Field>
          <Field label="Metin *" span={3}><textarea className="adm-inp" required rows={8} maxLength={3000} value={form.metin} onChange={e => set('metin', e.target.value)} /></Field>
          <Field label="Hashtagler" span={3}><input className="adm-inp" value={form.hashtagler} onChange={e => set('hashtagler', e.target.value)} placeholder="#plastiksaksi #toptan #ihracat" /></Field>
          <Field label="Ürün" span={2}><select className="adm-inp" value={form.urun_id} onChange={e => set('urun_id', e.target.value)}><option value="">—</option>{urunler.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}</select></Field>
          <Field label="Paylaşım bağlantısı"><input className="adm-inp" value={form.paylasim_url} onChange={e => set('paylasim_url', e.target.value)} placeholder="https://…" /></Field>
          <Field label="Notlar" span={3}><input className="adm-inp" maxLength={1000} value={form.notlar} onChange={e => set('notlar', e.target.value)} /></Field>
        </FormGrid>
        {form.metin && <div style={{ marginTop: 10 }}><button type="button" className="adm-btn-ghost" onClick={async () => toast.show(await panoyaKopyala(tamMetin(form.metin, etiketAyikla(form.hashtagler))) ? 'Kopyalandı' : 'Kopyalanamadı')}><Copy size={13} />Metni + hashtagleri kopyala</button></div>}
      </Modal>
    </>
  )
}
