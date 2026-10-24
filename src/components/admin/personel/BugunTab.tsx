'use client'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { web } from '@/lib/web-data'
import { createClient } from '@/lib/supabase/client'
import { personelIstek } from '@/lib/personel-client'
import { Kpi, KpiGrid, Badge, Tabs, Card, Modal, Field, FormGrid } from '@/components/admin/erp/ui'
import { DataGrid, type Col } from '@/components/admin/erp/DataGrid'
import { DURUM, saatTR, hhmm } from './ortak'
import { LogIn, LogOut, UserX, CalendarOff, Users2, Plus, Trash2, RefreshCw } from 'lucide-react'

type Toast = { show: (m: string, err?: boolean) => void }

export default function BugunTab({ toast }: { toast: Toast }) {
  const [liste, setListe] = useState<any[]>([])
  const [bugun, setBugun] = useState('')
  const [loading, setLoading] = useState(true)
  const [filtre, setFiltre] = useState('hepsi')
  const [hareketler, setHareketler] = useState<any[]>([])
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState<any>({ personel_id: '', yon: 'giris', zaman: '', aciklama: '' })
  const [busy, setBusy] = useState(false)

  const yukle = useCallback(async () => {
    try {
      const r = await personelIstek<{ bugun: string; liste: any[] }>('bugun'); setListe(r.liste); setBugun(r.bugun)
      const { data } = await web.from('personel_hareketleri').select('id,zaman,yon,kaynak,aciklama,personel(ad_soyad,sicil_no)').order('zaman', { ascending: false }).limit(60)
      setHareketler(data || [])
    } catch (e: any) { toast.show(e.message, true) }
    setLoading(false)
  }, []) // eslint-disable-line
  useEffect(() => { yukle(); const t = setInterval(yukle, 30000); return () => clearInterval(t) }, [yukle])

  const sayi = (d: string[]) => liste.filter(x => d.includes(x.durum)).length
  const filtreli = useMemo(() => liste.filter(x => filtre === 'hepsi' ? true : filtre === 'icerde' ? x.durum === 'icerde' : filtre === 'gelmedi' ? ['gelmedi', 'devamsiz'].includes(x.durum) : filtre === 'sorun' ? (x.durum === 'eksik' || x.uyarilar?.length || x.gec_dk > 0) : x.durum === filtre), [liste, filtre])

  async function manuelKaydet(e: React.FormEvent) {
    e.preventDefault(); if (busy) return
    if (!form.personel_id || !form.zaman || !form.aciklama.trim()) return toast.show('Personel, zaman ve açıklama zorunlu', true)
    setBusy(true)
    const { data: { user } } = await createClient().auth.getUser()
    const zaman = new Date(Date.parse(form.zaman + ':00Z') - 3 * 3600e3).toISOString() // girilen saat İstanbul saatidir
    const { error } = await web.from('personel_hareketleri').insert({ personel_id: form.personel_id, yon: form.yon, zaman, kaynak: 'manuel', aciklama: form.aciklama.trim(), created_by: user?.id ?? null })
    setBusy(false)
    if (error) return toast.show(error.message, true)
    setModal(false); toast.show('Manuel kayıt eklendi'); yukle()
  }
  async function hareketSil(h: any) {
    if (!confirm(`${h.personel?.ad_soyad} — ${h.yon === 'giris' ? 'giriş' : 'çıkış'} (${saatTR(h.zaman)}) kaydı silinsin mi?`)) return
    const { error } = await web.from('personel_hareketleri').delete().eq('id', h.id)
    if (error) return toast.show(error.message, true)
    toast.show('Kayıt silindi'); yukle()
  }

  const cols: Col<any>[] = [
    { key: 'sicil', label: 'Sicil', width: 90, sort: x => x.personel.sicil_no, render: x => x.personel.sicil_no },
    { key: 'ad', label: 'Personel', sort: x => x.personel.ad_soyad, render: x => <div><b>{x.personel.ad_soyad}</b><div style={{ fontSize: 11, color: 'var(--adm-tx3)' }}>{x.personel.departman || ''}</div></div> },
    { key: 'vardiya', label: 'Vardiya', width: 130, sort: x => x.vardiya?.ad || '', render: x => x.vardiya ? <span>{x.vardiya.ad} <span style={{ fontSize: 11, color: 'var(--adm-tx3)' }}>{hhmm(x.vardiya.baslangic)}–{hhmm(x.vardiya.bitis)}</span></span> : '—', hideSm: true },
    { key: 'durum', label: 'Durum', width: 150, sort: x => x.durum, render: x => <div><Badge tone={DURUM[x.durum]?.tone}>{DURUM[x.durum]?.l}</Badge>{x.uyarilar?.map((u: string, i: number) => <div key={i} style={{ fontSize: 10.5, color: 'var(--adm-amber)' }}>⚠ {u}</div>)}</div> },
    { key: 'giris', label: 'Giriş', width: 70, sort: x => x.giris || '', render: x => saatTR(x.giris) },
    { key: 'cikis', label: 'Çıkış', width: 70, sort: x => x.cikis || '', render: x => saatTR(x.cikis) },
    { key: 'gec', label: 'Geç', width: 80, align: 'right', sort: x => x.gec_dk, render: x => x.gec_dk ? <span style={{ color: 'var(--adm-red)', fontWeight: 700 }}>{x.gec_dk} dk</span> : '' },
  ]

  return (
    <>
      <KpiGrid min={150}>
        <Kpi label="Aktif personel" value={liste.length} Icon={Users2} color="var(--adm-blue)" sub={bugun ? `bugün ${bugun.split('-').reverse().join('.')}` : ''} />
        <Kpi label="İçeride" value={sayi(['icerde'])} Icon={LogIn} color="var(--adm-green)" onClick={() => setFiltre('icerde')} />
        <Kpi label="Çıkış yaptı" value={sayi(['calisti'])} Icon={LogOut} color="var(--adm-ac)" onClick={() => setFiltre('calisti')} />
        <Kpi label="Henüz gelmedi" value={sayi(['gelmedi', 'devamsiz'])} Icon={UserX} color={sayi(['devamsiz']) ? 'var(--adm-red)' : 'var(--adm-amber)'} sub={`${sayi(['devamsiz'])} devamsız`} onClick={() => setFiltre('gelmedi')} />
        <Kpi label="İzinli / tatil" value={sayi(['izinli', 'tatil', 'hafta_tatili', 'yarim_tatil'])} Icon={CalendarOff} color="var(--adm-tx3)" />
      </KpiGrid>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 12, alignItems: 'center' }}>
        <Tabs value={filtre} onChange={setFiltre} tabs={[{ v: 'hepsi', l: 'Tümü', n: liste.length }, { v: 'icerde', l: 'İçeride', n: sayi(['icerde']) }, { v: 'gelmedi', l: 'Gelmeyenler', n: sayi(['gelmedi', 'devamsiz']) }, { v: 'sorun', l: 'Dikkat', n: liste.filter(x => x.durum === 'eksik' || x.uyarilar?.length || x.gec_dk > 0).length }]} />
        <span style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <button className="adm-btn-ghost" onClick={yukle}><RefreshCw size={13} />Yenile</button>
          <button className="adm-btn" onClick={() => { setForm({ personel_id: '', yon: 'giris', zaman: `${bugun || ''}T08:00`, aciklama: '' }); setModal(true) }}><Plus size={14} />Manuel giriş/çıkış</button>
        </span>
      </div>
      <DataGrid rows={filtreli} cols={cols} rowKey={x => x.personel.id} loading={loading} csvName="personel-bugun" storageKey="personel-bugun"
        searchText={x => `${x.personel.ad_soyad} ${x.personel.sicil_no} ${x.personel.departman || ''}`} searchPlaceholder="Ad, sicil, departman…" emptyTitle="Personel yok" emptySub="Personel sekmesinden personel ekleyin" />

      <div style={{ marginTop: 16 }}>
        <Card title="Son hareketler" pad={0}>
          {hareketler.length === 0 ? <p style={{ margin: 0, padding: '14px 18px', fontSize: 12.5, color: 'var(--adm-tx3)' }}>Henüz hareket yok. Kioskta kartını okutan personel burada görünür.</p> : hareketler.map(h => (
            <div key={h.id} className="adm-row" style={{ padding: '8px 18px', display: 'flex', gap: 12, alignItems: 'center', fontSize: 13 }}>
              <Badge tone={h.yon === 'giris' ? 'green' : 'ac'}>{h.yon === 'giris' ? 'Giriş' : 'Çıkış'}</Badge>
              <span style={{ flex: 1 }}><b>{h.personel?.ad_soyad}</b> <span style={{ color: 'var(--adm-tx3)', fontSize: 11.5 }}>{h.personel?.sicil_no}{h.kaynak === 'manuel' ? ` · manuel${h.aciklama ? `: ${h.aciklama}` : ''}` : ''}</span></span>
              <span style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: 12 }}>{new Date(Date.parse(h.zaman) + 3 * 3600e3).toISOString().slice(0, 16).replace('T', ' ')}</span>
              <button className="adm-btn-danger" style={{ padding: '3px 7px' }} title="Kaydı sil" onClick={() => hareketSil(h)}><Trash2 size={12} /></button>
            </div>))}
        </Card>
      </div>

      <Modal open={modal} onClose={() => setModal(false)} onSubmit={manuelKaydet} width={480} title="Manuel giriş/çıkış kaydı"
        footer={<><button type="button" className="adm-btn-ghost" onClick={() => setModal(false)}>İptal</button><button type="submit" className="adm-btn" disabled={busy}>Kaydet</button></>}>
        <FormGrid cols={2}>
          <Field label="Personel *" span={2}><select className="adm-inp" required value={form.personel_id} onChange={e => setForm((f: any) => ({ ...f, personel_id: e.target.value }))}><option value="">— Seçin —</option>{liste.map(x => <option key={x.personel.id} value={x.personel.id}>{x.personel.sicil_no} — {x.personel.ad_soyad}</option>)}</select></Field>
          <Field label="Yön *"><select className="adm-inp" value={form.yon} onChange={e => setForm((f: any) => ({ ...f, yon: e.target.value }))}><option value="giris">Giriş</option><option value="cikis">Çıkış</option></select></Field>
          <Field label="Tarih ve saat *" hint="İstanbul saati"><input type="datetime-local" className="adm-inp" required value={form.zaman} onChange={e => setForm((f: any) => ({ ...f, zaman: e.target.value }))} /></Field>
          <Field label="Açıklama * (neden manuel?)" span={2}><input className="adm-inp" required maxLength={200} value={form.aciklama} onChange={e => setForm((f: any) => ({ ...f, aciklama: e.target.value }))} placeholder="Örn. Kartını unuttu, ustabaşı onayıyla" /></Field>
        </FormGrid>
        <p style={{ fontSize: 11.5, color: 'var(--adm-tx3)', margin: '10px 0 0' }}>Manuel kayıtlar "manuel" olarak işaretlenir ve kimin eklediği tutulur; denetimde ayırt edilebilir.</p>
      </Modal>
    </>
  )
}
