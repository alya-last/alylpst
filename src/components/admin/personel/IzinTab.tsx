'use client'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { web } from '@/lib/web-data'
import { createClient } from '@/lib/supabase/client'
import { Badge, Modal, Field, FormGrid, Card } from '@/components/admin/erp/ui'
import { DataGrid, type Col } from '@/components/admin/erp/DataGrid'
import { Plus, Trash2 } from 'lucide-react'
import { IZIN_TUR, tarihTR, izinGunu, bugunTR } from './ortak'

type Toast = { show: (m: string, err?: boolean) => void }

export default function IzinTab({ toast }: { toast: Toast }) {
  const [rows, setRows] = useState<any[]>([])
  const [personel, setPersonel] = useState<any[]>([])
  const [tatiller, setTatiller] = useState<any[]>([])
  const [ayar, setAyar] = useState<any>({ calisma_gunleri: [1, 2, 3, 4, 5, 6] })
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState<any>({ personel_id: '', tur: 'yillik', baslangic: '', bitis: '', aciklama: '' })
  const [busy, setBusy] = useState(false)
  const yil = bugunTR().slice(0, 4)

  const yukle = useCallback(async () => {
    const [i, p, t, a] = await Promise.all([
      web.from('personel_izinleri').select('*').order('baslangic', { ascending: false }).limit(2000),
      web.from('personel').select('id,ad_soyad,sicil_no,yillik_izin_hakki,aktif').order('ad_soyad'),
      web.from('resmi_tatiller').select('*'),
      web.from('personel_ayarlari').select('calisma_gunleri').eq('id', 1).maybeSingle(),
    ])
    if (i.error) toast.show(i.error.message, true)
    setRows(i.data || []); setPersonel(p.data || []); setTatiller(t.data || []); if (a.data?.calisma_gunleri) setAyar(a.data); setLoading(false)
  }, []) // eslint-disable-line
  useEffect(() => { yukle() }, [yukle])

  const pAd = useMemo(() => new Map(personel.map(p => [p.id, p])), [personel])
  const gun = (r: any) => izinGunu(r.baslangic, r.bitis, ayar.calisma_gunleri, tatiller)
  const bakiye = useMemo(() => personel.filter(p => p.aktif).map(p => {
    const kullanilan = rows.filter(r => r.personel_id === p.id && r.tur === 'yillik' && r.baslangic.slice(0, 4) === yil).reduce((s, r) => s + gun(r), 0)
    return { ...p, kullanilan, kalan: p.yillik_izin_hakki - kullanilan }
  }), [personel, rows, tatiller, ayar]) // eslint-disable-line

  async function kaydet(e: React.FormEvent) {
    e.preventDefault(); if (busy) return
    if (form.bitis < form.baslangic) return toast.show('Bitiş tarihi başlangıçtan önce olamaz', true)
    if (rows.some(r => r.personel_id === form.personel_id && r.baslangic <= form.bitis && r.bitis >= form.baslangic)) return toast.show('Bu personelin bu tarihlerde zaten izin/rapor kaydı var', true)
    setBusy(true)
    const { data: { user } } = await createClient().auth.getUser()
    const { error } = await web.from('personel_izinleri').insert({ personel_id: form.personel_id, tur: form.tur, baslangic: form.baslangic, bitis: form.bitis, aciklama: form.aciklama || null, created_by: user?.id ?? null })
    setBusy(false)
    if (error) return toast.show(error.message, true)
    setModal(false); toast.show('İzin kaydedildi'); yukle()
  }
  async function sil(r: any) {
    if (!confirm(`${pAd.get(r.personel_id)?.ad_soyad} — ${IZIN_TUR[r.tur]} (${tarihTR(r.baslangic)}–${tarihTR(r.bitis)}) silinsin mi?`)) return
    const { error } = await web.from('personel_izinleri').delete().eq('id', r.id)
    if (error) return toast.show(error.message, true)
    toast.show('Silindi'); yukle()
  }

  const cols: Col<any>[] = [
    { key: 'p', label: 'Personel', sort: r => pAd.get(r.personel_id)?.ad_soyad || '', render: r => <b>{pAd.get(r.personel_id)?.ad_soyad || '—'}</b> },
    { key: 'tur', label: 'Tür', width: 130, sort: r => r.tur, render: r => <Badge tone={r.tur === 'rapor' ? 'amber' : 'blue'}>{IZIN_TUR[r.tur] || r.tur}</Badge> },
    { key: 'b', label: 'Tarih', width: 190, sort: r => r.baslangic, render: r => `${tarihTR(r.baslangic)} – ${tarihTR(r.bitis)}` },
    { key: 'g', label: 'Gün', width: 70, align: 'right', render: r => gun(r) },
    { key: 'a', label: 'Açıklama', render: r => r.aciklama || '', hideSm: true },
    { key: 'x', label: '', width: 50, align: 'right', render: r => <button className="adm-btn-danger" style={{ padding: '3px 7px' }} onClick={() => sil(r)}><Trash2 size={12} /></button> },
  ]

  return (
    <>
      <DataGrid rows={rows} cols={cols} rowKey={r => r.id} loading={loading} csvName="personel-izin" storageKey="personel-izin"
        searchText={r => `${pAd.get(r.personel_id)?.ad_soyad || ''} ${IZIN_TUR[r.tur] || ''} ${r.aciklama || ''}`} searchPlaceholder="Personel, tür…"
        actions={<button className="adm-btn" onClick={() => { setForm({ personel_id: personel.find(p => p.aktif)?.id || '', tur: 'yillik', baslangic: bugunTR(), bitis: bugunTR(), aciklama: '' }); setModal(true) }}><Plus size={14} />İzin / Rapor Ekle</button>}
        emptyTitle="İzin kaydı yok" emptySub="Yıllık izin, mazeret ve sağlık raporlarını buradan girin; puantaja otomatik yansır" />
      <div style={{ marginTop: 16 }}>
        <Card title={`${yil} yıllık izin bakiyesi`} pad={0}>
          {bakiye.map(b => <div key={b.id} className="adm-row" style={{ padding: '8px 18px', display: 'flex', gap: 12, fontSize: 13 }}>
            <span style={{ flex: 1 }}><b>{b.ad_soyad}</b> <span style={{ color: 'var(--adm-tx3)', fontSize: 11.5 }}>{b.sicil_no}</span></span>
            <span>Hak {b.yillik_izin_hakki}</span><span>Kullanılan {b.kullanilan}</span>
            <b style={{ color: b.kalan < 0 ? 'var(--adm-red)' : 'var(--adm-green)', minWidth: 70, textAlign: 'right' }}>Kalan {b.kalan}</b>
          </div>)}
        </Card>
      </div>
      <Modal open={modal} onClose={() => setModal(false)} onSubmit={kaydet} width={520} title="İzin / Rapor Kaydı"
        footer={<><button type="button" className="adm-btn-ghost" onClick={() => setModal(false)}>İptal</button><button type="submit" className="adm-btn" disabled={busy}>Kaydet</button></>}>
        <FormGrid cols={2}>
          <Field label="Personel *" span={2}><select className="adm-inp" required value={form.personel_id} onChange={e => setForm((f: any) => ({ ...f, personel_id: e.target.value }))}>{personel.filter(p => p.aktif).map(p => <option key={p.id} value={p.id}>{p.sicil_no} — {p.ad_soyad}</option>)}</select></Field>
          <Field label="Tür *" span={2}><select className="adm-inp" value={form.tur} onChange={e => setForm((f: any) => ({ ...f, tur: e.target.value }))}>{Object.entries(IZIN_TUR).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
          <Field label="Başlangıç *"><input type="date" className="adm-inp" required value={form.baslangic} onChange={e => setForm((f: any) => ({ ...f, baslangic: e.target.value, bitis: f.bitis < e.target.value ? e.target.value : f.bitis }))} /></Field>
          <Field label="Bitiş *" hint="Bu gün dahil"><input type="date" className="adm-inp" required min={form.baslangic} value={form.bitis} onChange={e => setForm((f: any) => ({ ...f, bitis: e.target.value }))} /></Field>
          <Field label="Açıklama" span={2}><input className="adm-inp" value={form.aciklama} onChange={e => setForm((f: any) => ({ ...f, aciklama: e.target.value }))} placeholder="Örn. e-Rapor no, doktor…" /></Field>
        </FormGrid>
        {form.baslangic && form.bitis >= form.baslangic && <p style={{ fontSize: 12, color: 'var(--adm-tx3)' }}>İş günü sayısı: <b>{izinGunu(form.baslangic, form.bitis, ayar.calisma_gunleri, tatiller)}</b> (hafta tatili ve resmî tatiller düşülür)</p>}
      </Modal>
    </>
  )
}
