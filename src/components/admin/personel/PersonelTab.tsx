'use client'
import { useCallback, useEffect, useState } from 'react'
import { web } from '@/lib/web-data'
import { Badge, Card, Modal, Field, FormGrid } from '@/components/admin/erp/ui'
import { DataGrid, type Col } from '@/components/admin/erp/DataGrid'
import { Plus, Pencil, Printer, RefreshCw, UserMinus } from 'lucide-react'
import { hhmm, tarihTR } from './ortak'

type Toast = { show: (m: string, err?: boolean) => void }
const bos = { sicil_no: '', ad_soyad: '', departman: '', gorev: '', vardiya_id: '', ise_giris: '', isten_cikis: '', yillik_izin_hakki: 14, aktif: true, notlar: '' }
const yeniToken = () => Array.from(crypto.getRandomValues(new Uint8Array(32))).map(b => b.toString(16).padStart(2, '0')).join('')

export default function PersonelTab({ toast }: { toast: Toast }) {
  const [rows, setRows] = useState<any[]>([])
  const [vardiyalar, setVardiyalar] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [form, setForm] = useState<any>(bos)
  const [busy, setBusy] = useState(false)
  const [pasifGoster, setPasifGoster] = useState(false)

  const yukle = useCallback(async () => {
    const [p, v] = await Promise.all([web.from('personel').select('*').order('ad_soyad', { ascending: true }).limit(2000), web.from('vardiyalar').select('*').order('baslangic')])
    if (p.error) toast.show(p.error.message, true)
    setRows(p.data || []); setVardiyalar(v.data || []); setLoading(false)
  }, []) // eslint-disable-line
  useEffect(() => { yukle() }, [yukle])

  const vAd = (id: string) => vardiyalar.find(v => v.id === id)
  const liste = rows.filter(r => pasifGoster || r.aktif)

  function ac(r?: any) {
    setEditing(r || null)
    setForm(r ? { ...bos, ...Object.fromEntries(Object.entries(r).map(([k, v]) => [k, v ?? ''])) } : { ...bos, vardiya_id: vardiyalar[0]?.id || '' })
    setModal(true)
  }
  async function kaydet(e: React.FormEvent) {
    e.preventDefault(); if (busy) return
    setBusy(true)
    const p: any = { sicil_no: String(form.sicil_no).trim(), ad_soyad: String(form.ad_soyad).trim(), departman: form.departman || null, gorev: form.gorev || null, vardiya_id: form.vardiya_id || null, ise_giris: form.ise_giris || null, isten_cikis: form.isten_cikis || null, yillik_izin_hakki: +form.yillik_izin_hakki || 0, aktif: !!form.aktif, notlar: form.notlar || null, updated_at: new Date().toISOString() }
    const { error } = editing ? await web.from('personel').update(p).eq('id', editing.id) : await web.from('personel').insert(p)
    setBusy(false)
    if (error) return toast.show(error.message.includes('duplicate') ? 'Bu sicil numarası zaten kayıtlı' : error.message, true)
    setModal(false); toast.show(editing ? 'Personel güncellendi' : 'Personel eklendi'); yukle()
  }
  async function kartYenile(r: any) {
    if (!confirm(`${r.ad_soyad} için QR kartı yenilensin mi?\n\nEski kart hemen geçersiz olur; yeni kartı yazdırıp teslim etmeniz gerekir.`)) return
    const { error } = await web.from('personel').update({ qr_token: yeniToken(), updated_at: new Date().toISOString() }).eq('id', r.id)
    if (error) return toast.show(error.message, true)
    toast.show('QR kartı yenilendi — yeni kartı yazdırın'); yukle()
  }
  async function pasifYap(r: any) {
    const ac = !r.aktif
    if (!ac && !confirm(`${r.ad_soyad} pasife alınsın mı? Kartı çalışmaz, geçmiş kayıtları korunur.`)) return
    const { error } = await web.from('personel').update({ aktif: ac, ...(ac ? { isten_cikis: null } : { isten_cikis: new Date(Date.now() + 3 * 3600e3).toISOString().slice(0, 10) }), updated_at: new Date().toISOString() }).eq('id', r.id)
    if (error) return toast.show(error.message, true)
    toast.show(ac ? 'Personel aktifleştirildi' : 'Personel pasife alındı'); yukle()
  }
  const yazdir = (ids: string[]) => window.open(`/admin/dashboard/personel/kartlar?ids=${ids.join(',')}`, '_blank')

  const cols: Col<any>[] = [
    { key: 'sicil', label: 'Sicil', width: 90, sort: r => r.sicil_no, render: r => <b>{r.sicil_no}</b> },
    { key: 'ad', label: 'Ad Soyad', sort: r => r.ad_soyad, render: r => <div><b style={{ opacity: r.aktif ? 1 : .5 }}>{r.ad_soyad}</b>{!r.aktif && <Badge tone="muted" style={{ marginLeft: 6 }}>pasif</Badge>}<div style={{ fontSize: 11, color: 'var(--adm-tx3)' }}>{[r.departman, r.gorev].filter(Boolean).join(' · ')}</div></div> },
    { key: 'vardiya', label: 'Vardiya', width: 140, sort: r => vAd(r.vardiya_id)?.ad || '', render: r => { const v = vAd(r.vardiya_id); return v ? <span>{v.ad} <span style={{ fontSize: 11, color: 'var(--adm-tx3)' }}>{hhmm(v.baslangic)}–{hhmm(v.bitis)}</span></span> : <Badge tone="amber">vardiya yok</Badge> }, hideSm: true },
    { key: 'ise', label: 'İşe giriş', width: 100, sort: r => r.ise_giris || '', render: r => r.ise_giris ? tarihTR(r.ise_giris) : '—', hideSm: true },
    { key: 'izin', label: 'Yıllık izin hakkı', width: 120, align: 'right', sort: r => r.yillik_izin_hakki, render: r => `${r.yillik_izin_hakki} gün`, hideSm: true },
    { key: 'act', label: '', width: 170, align: 'right', render: r => <span style={{ display: 'inline-flex', gap: 4 }} onClick={e => e.stopPropagation()}>
      <button className="adm-btn-ghost" style={{ padding: '4px 7px' }} title="QR kartı yazdır" onClick={() => yazdir([r.id])}><Printer size={12} /></button>
      <button className="adm-btn-ghost" style={{ padding: '4px 7px' }} title="QR kartını yenile (eski kart geçersiz olur)" onClick={() => kartYenile(r)}><RefreshCw size={12} /></button>
      <button className="adm-btn-ghost" style={{ padding: '4px 7px' }} onClick={() => ac(r)}><Pencil size={12} /></button>
      <button className="adm-btn-ghost" style={{ padding: '4px 7px' }} title={r.aktif ? 'Pasife al' : 'Aktifleştir'} onClick={() => pasifYap(r)}><UserMinus size={12} /></button></span> },
  ]

  return (
    <>
      <DataGrid rows={liste} cols={cols} rowKey={r => r.id} loading={loading} csvName="personel" storageKey="personel-liste" selectable
        searchText={r => `${r.ad_soyad} ${r.sicil_no} ${r.departman || ''} ${r.gorev || ''}`} searchPlaceholder="Ad, sicil, departman…"
        actions={<><label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 12.5 }}><input type="checkbox" checked={pasifGoster} onChange={e => setPasifGoster(e.target.checked)} />Pasifleri göster</label><button className="adm-btn" onClick={() => ac()}><Plus size={14} />Personel Ekle</button></>}
        bulkActions={(sel, clear) => <button className="adm-btn-ghost" style={{ padding: '3px 10px', fontSize: 12 }} onClick={() => { yazdir(sel.map(s => s.id)); clear() }}><Printer size={12} />Seçilenlerin kartlarını yazdır</button>}
        emptyTitle="Personel yok" emptySub="“Personel Ekle” ile başlayın; sonra QR kartlarını yazdırıp dağıtın" />
      <p style={{ fontSize: 11.5, color: 'var(--adm-tx3)', marginTop: 10 }}>QR kartı kişiye özel gizli bir değer içerir. Kart kaybolursa “QR kartını yenile” ile eskisi geçersiz kılınır.</p>

      <Modal open={modal} onClose={() => setModal(false)} onSubmit={kaydet} width={680} title={editing ? 'Personeli Düzenle' : 'Yeni Personel'}
        footer={<><button type="button" className="adm-btn-ghost" onClick={() => setModal(false)}>İptal</button><button type="submit" className="adm-btn" disabled={busy}>{busy ? 'Kaydediliyor…' : 'Kaydet'}</button></>}>
        <FormGrid cols={3}>
          <Field label="Sicil no *"><input className="adm-inp" required autoFocus value={form.sicil_no} onChange={e => setForm((f: any) => ({ ...f, sicil_no: e.target.value }))} /></Field>
          <Field label="Ad Soyad *" span={2}><input className="adm-inp" required value={form.ad_soyad} onChange={e => setForm((f: any) => ({ ...f, ad_soyad: e.target.value }))} /></Field>
          <Field label="Departman"><input className="adm-inp" list="dep-list" value={form.departman} onChange={e => setForm((f: any) => ({ ...f, departman: e.target.value }))} /><datalist id="dep-list">{Array.from(new Set(rows.map(r => r.departman).filter(Boolean))).map((d: any) => <option key={d} value={d} />)}</datalist></Field>
          <Field label="Görev"><input className="adm-inp" value={form.gorev} onChange={e => setForm((f: any) => ({ ...f, gorev: e.target.value }))} /></Field>
          <Field label="Vardiya"><select className="adm-inp" value={form.vardiya_id} onChange={e => setForm((f: any) => ({ ...f, vardiya_id: e.target.value }))}><option value="">— Yok —</option>{vardiyalar.filter(v => v.aktif || v.id === form.vardiya_id).map(v => <option key={v.id} value={v.id}>{v.ad} ({hhmm(v.baslangic)}–{hhmm(v.bitis)})</option>)}</select></Field>
          <Field label="İşe giriş tarihi"><input type="date" className="adm-inp" value={form.ise_giris} onChange={e => setForm((f: any) => ({ ...f, ise_giris: e.target.value }))} /></Field>
          <Field label="İşten çıkış tarihi"><input type="date" className="adm-inp" value={form.isten_cikis} onChange={e => setForm((f: any) => ({ ...f, isten_cikis: e.target.value }))} /></Field>
          <Field label="Yıllık izin hakkı (gün)"><input type="number" step="0.5" min="0" className="adm-inp" value={form.yillik_izin_hakki} onChange={e => setForm((f: any) => ({ ...f, yillik_izin_hakki: e.target.value }))} /></Field>
          <Field label="Notlar" span={2}><input className="adm-inp" value={form.notlar} onChange={e => setForm((f: any) => ({ ...f, notlar: e.target.value }))} /></Field>
          <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 13 }}><input type="checkbox" checked={!!form.aktif} onChange={e => setForm((f: any) => ({ ...f, aktif: e.target.checked }))} />Aktif</label>
        </FormGrid>
      </Modal>
    </>
  )
}
