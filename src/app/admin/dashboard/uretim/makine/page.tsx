'use client'
import { useAcParam } from '@/lib/ac-param'
import { useMemo, useState } from 'react'
import Link from 'next/link'
import AdminTopBar from '@/components/admin/TopBar'
import { erp } from '@/lib/erp-client'
import { fmtN, fmtInt, fmtDateTime } from '@/lib/fmt'
import { useUretim, byId, MAKINE_DURUM, EMIR_DURUM, yuzde, fireOrani } from '@/lib/uretim-utils'
import { Page, PageHead, Kpi, KpiGrid, Badge, Tabs, Drawer, Modal, Field, FormGrid, InfoRow, Divider, Empty, useToast } from '@/components/admin/erp/ui'
import { Plus, Pencil, Trash2, Cog, Activity, Wrench, AlertTriangle, Gauge, AlertCircle, ExternalLink } from 'lucide-react'

const bos = { kod: '', ad: '', tonaj: '', kapasite: '', notlar: '' }

export default function MakinePage() {
  const toast = useToast()
  const { d, loading, reload } = useUretim(['makineler', 'emirler', 'hareketler', 'kaliplar', 'products'])
  const [tab, setTab] = useState('hepsi')
  const [detay, setDetay] = useState<any>(null)
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [form, setForm] = useState<any>(bos)
  const [busy, setBusy] = useState(false)

  const kalip = useMemo(() => byId(d.kaliplar), [d.kaliplar])
  const urun = useMemo(() => byId(d.products), [d.products])
  const ay = new Date().toISOString().slice(0, 7)

  // Makine başına canlı özet
  const M = useMemo(() => {
    const o: Record<string, any> = {}
    d.makineler.forEach((m: any) => {
      const emirler = d.emirler.filter((e: any) => e.makine_id === m.id)
      const aktif = emirler.find((e: any) => e.durum === 'uretimde') || null
      const ids = new Set(emirler.map((e: any) => e.id))
      const hay = d.hareketler.filter((h: any) => ids.has(h.uretim_emri_id) && (h.tarih || '').startsWith(ay))
      const uretilen = hay.reduce((s: number, h: any) => s + (+h.uretilen_adet || 0), 0), fire = hay.reduce((s: number, h: any) => s + (+h.fire_adet || 0), 0)
      const saat = emirler.filter((e: any) => e.baslangic && ['uretimde', 'tamamlandi', 'durduruldu'].includes(e.durum) && (e.baslangic || '').startsWith(ay))
        .reduce((s: number, e: any) => s + (((e.bitis ? +new Date(e.bitis) : Date.now()) - +new Date(e.baslangic)) / 3600000), 0)
      o[m.id] = { emirler, aktif, uretilen, fire, saat, tutarsiz: (m.durum === 'uretimde' && !aktif) || (!!aktif && m.durum !== 'uretimde') }
    })
    return o
  }, [d.makineler, d.emirler, d.hareketler, ay])

  const cnt = (k: string) => d.makineler.filter((m: any) => m.durum === k).length
  const aktifMakine = d.makineler.filter((m: any) => !['durduruldu'].includes(m.durum)).length
  const kullanim = aktifMakine ? (cnt('uretimde') / aktifMakine) * 100 : 0
  const tutarsiz = d.makineler.filter((m: any) => M[m.id]?.tutarsiz)
  const liste = d.makineler.filter((m: any) => tab === 'hepsi' || m.durum === tab)

  async function durum(m: any, yeni: string) {
    if (['bakimda', 'arizali', 'durduruldu'].includes(yeni) && M[m.id]?.aktif && !confirm(`${m.ad} üzerinde “${M[m.id].aktif.no}” emri üretimde. Yine de ${MAKINE_DURUM[yeni].l.toLowerCase()} durumuna alınsın mı?\n(Emir otomatik durdurulmaz.)`)) return
    const r: any = await erp.from('makineler').update({ durum: yeni }).eq('id', m.id)
    if (r?.error) return toast.show(r.error, true)
    toast.show(`${m.ad}: ${MAKINE_DURUM[yeni].l}`); await reload(); setDetay((x: any) => (x?.id === m.id ? { ...x, durum: yeni } : x))
  }
  const openNew = () => { setEditing(null); setForm(bos); setModal(true) }
  const openEdit = (m: any) => { setEditing(m); setForm({ kod: m.kod, ad: m.ad, tonaj: m.tonaj ? String(m.tonaj) : '', kapasite: m.kapasite || '', notlar: m.notlar || '' }); setModal(true) }

  async function save(e: React.FormEvent) {
    e.preventDefault(); if (busy) return
    if (d.makineler.some((m: any) => m.kod.toLowerCase() === form.kod.trim().toLowerCase() && m.id !== editing?.id)) return toast.show('Bu makine kodu zaten kullanılıyor', true)
    setBusy(true)
    const payload = { kod: form.kod.trim(), ad: form.ad.trim(), tonaj: form.tonaj ? +form.tonaj : null, kapasite: form.kapasite || null, notlar: form.notlar || null }
    const r: any = editing ? await erp.from('makineler').update(payload).eq('id', editing.id) : await erp.from('makineler').insert({ ...payload, durum: 'musait' })
    setBusy(false)
    if (r?.error) return toast.show(r.error, true)
    setModal(false); toast.show(editing ? 'Makine güncellendi' : 'Makine eklendi'); reload()
  }
  async function del(m: any) {
    if (M[m.id]?.emirler.length && !confirm(`${m.ad} makinesine bağlı ${M[m.id].emirler.length} üretim emri var. Silinirse emirlerde makine boş kalır. Devam?`)) return
    if (!M[m.id]?.emirler.length && !confirm(`${m.ad} silinsin mi?`)) return
    const r: any = await erp.from('makineler').delete().eq('id', m.id)
    if (r?.error) return toast.show(r.error, true)
    toast.show('Makine silindi'); setDetay(null); reload()
  }

  const x = detay ? M[detay.id] : null

  useAcParam(!loading, id => { const m = d.makineler.find((x: any) => x.id === id); if (m) openEdit(m) })

  return (
    <div style={{ flex: 1, overflow: 'auto' }}>
      <AdminTopBar title="Makine Yönetimi" />
      <Page>
        <PageHead title="Makine Parkı" sub="Anlık durum, çalışan iş emri, bu ayki performans" actions={<button className="adm-btn" onClick={openNew}><Plus size={14} />Makine Ekle</button>} />

        <KpiGrid min={170}>
          <Kpi label="Toplam Makine" value={d.makineler.length} Icon={Cog} color="var(--adm-ac)" sub={`${aktifMakine} aktif`} />
          <Kpi label="Üretimde" value={cnt('uretimde')} Icon={Activity} color="var(--adm-blue)" sub={`%${fmtN(kullanim, 0)} kullanım`} onClick={() => setTab('uretimde')} />
          <Kpi label="Müsait" value={cnt('musait')} Icon={Gauge} color="var(--adm-green)" sub="iş atanabilir" onClick={() => setTab('musait')} />
          <Kpi label="Bakım / Arıza" value={cnt('bakimda') + cnt('arizali')} Icon={Wrench} color={cnt('arizali') ? 'var(--adm-red)' : 'var(--adm-amber)'} sub={`${cnt('arizali')} arızalı · ${cnt('bakimda')} bakımda`} />
          <Kpi label="Bu Ay Üretim" value={fmtInt(Object.values(M).reduce((s: number, m: any) => s + m.uretilen, 0))} Icon={Activity} color="var(--adm-green)" sub={`fire %${fmtN(fireOrani(Object.values(M).reduce((s: number, m: any) => s + m.uretilen, 0), Object.values(M).reduce((s: number, m: any) => s + m.fire, 0)), 1)}`} />
        </KpiGrid>

        {tutarsiz.length > 0 && (
          <div className="adm-card" style={{ padding: '11px 16px', marginBottom: 14, display: 'flex', gap: 10, alignItems: 'center', borderColor: 'var(--adm-amber)', fontSize: 13 }}>
            <AlertCircle size={16} style={{ color: 'var(--adm-amber)' }} /><span><b>{tutarsiz.length}</b> makinenin durumu iş emriyle uyuşmuyor ({tutarsiz.map((m: any) => m.ad).join(', ')}). Kartlardaki uyarıdan düzeltebilirsin.</span>
          </div>
        )}

        <div style={{ marginBottom: 14 }}>
          <Tabs value={tab} onChange={setTab} tabs={[{ v: 'hepsi', l: 'Tümü', n: d.makineler.length }, ...Object.entries(MAKINE_DURUM).map(([k, v]) => ({ v: k, l: v.l, n: cnt(k) }))]} />
        </div>

        {loading ? null : liste.length === 0 ? (
          <div className="adm-card"><Empty icon={<Cog size={34} />} title={d.makineler.length ? 'Bu durumda makine yok' : 'Henüz makine tanımlı değil'} sub="Enjeksiyon, üfleme, ekstrüzyon makinelerini ekle; üretim emirlerine ata." action={!d.makineler.length && <button className="adm-btn" onClick={openNew}><Plus size={14} />İlk Makineyi Ekle</button>} /></div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(310px,1fr))', gap: 14 }}>
            {liste.map((m: any) => {
              const s = MAKINE_DURUM[m.durum] || MAKINE_DURUM.musait, y = M[m.id], a = y.aktif
              return (
                <div key={m.id} className="adm-card" style={{ padding: 16, cursor: 'pointer', borderTop: `3px solid ${s.color}` }} onClick={() => setDetay(m)}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                    <div style={{ width: 40, height: 40, borderRadius: 11, background: s.color + '1a', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                      <Cog size={19} style={{ color: s.color, animation: m.durum === 'uretimde' ? 'admSpin 6s linear infinite' : undefined }} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontWeight: 700, fontSize: 14 }}>{m.ad}</div><div style={{ fontSize: 11.5, color: 'var(--adm-tx3)' }}>{m.kod}{m.tonaj ? ` · ${m.tonaj} ton` : ''}{m.kapasite ? ` · ${m.kapasite}` : ''}</div></div>
                    <Badge tone={s.tone}>{s.l}</Badge>
                  </div>

                  {a ? (
                    <div style={{ padding: 10, borderRadius: 10, background: 'var(--adm-blue2)', marginBottom: 10 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 6 }}><b style={{ fontFamily: 'JetBrains Mono,monospace' }}>{a.no}</b><span style={{ color: 'var(--adm-tx2)' }}>{urun[a.urun_id]?.name}</span></div>
                      <div style={{ height: 6, borderRadius: 4, background: 'rgba(0,0,0,.08)', overflow: 'hidden' }}><div style={{ width: `${yuzde(+a.uretilen_miktar, +a.planlanan_miktar)}%`, height: '100%', background: 'var(--adm-blue)' }} /></div>
                      <div style={{ fontSize: 11, color: 'var(--adm-tx3)', marginTop: 5 }}>{fmtInt(a.uretilen_miktar)} / {fmtInt(a.planlanan_miktar)} adet · %{fmtN(yuzde(+a.uretilen_miktar, +a.planlanan_miktar), 0)}{a.kalip_id ? ` · ${kalip[a.kalip_id]?.ad || ''}` : ''}</div>
                    </div>
                  ) : <div style={{ padding: 10, borderRadius: 10, background: 'var(--adm-s2)', marginBottom: 10, fontSize: 12, color: 'var(--adm-tx3)' }}>Çalışan iş emri yok</div>}

                  {y.tutarsiz && (
                    <div onClick={e => e.stopPropagation()} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11.5, color: 'var(--adm-amber)', marginBottom: 10 }}>
                      <AlertTriangle size={13} />{m.durum === 'uretimde' ? 'Durum “Üretimde” ama aktif emir yok' : 'Aktif emir var ama durum farklı'}
                      <button className="adm-btn-ghost" style={{ padding: '2px 8px', fontSize: 11, marginLeft: 'auto' }} onClick={() => durum(m, m.durum === 'uretimde' ? 'musait' : 'uretimde')}>Düzelt</button>
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: 14, fontSize: 11.5, color: 'var(--adm-tx3)' }}>
                    <span>Ay: <b style={{ color: 'var(--adm-tx)' }}>{fmtInt(y.uretilen)}</b> adet</span><span>Fire: <b style={{ color: y.fire ? 'var(--adm-red)' : 'var(--adm-tx)' }}>%{fmtN(fireOrani(y.uretilen, y.fire), 1)}</b></span><span>Çalışma: <b style={{ color: 'var(--adm-tx)' }}>{fmtN(y.saat, 0)}</b> sa</span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </Page>

      <Drawer open={!!detay} onClose={() => setDetay(null)} width={520}
        title={detay && <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>{detay.ad}<Badge tone={(MAKINE_DURUM[detay.durum] || MAKINE_DURUM.musait).tone}>{(MAKINE_DURUM[detay.durum] || MAKINE_DURUM.musait).l}</Badge></span>}
        sub={detay && `${detay.kod}${detay.tonaj ? ` · ${detay.tonaj} ton` : ''}`}
        footer={detay && <><button className="adm-btn-danger" onClick={() => del(detay)}><Trash2 size={13} />Sil</button><button className="adm-btn" onClick={() => openEdit(detay)}><Pencil size={13} />Düzenle</button></>}>
        {detay && x && (
          <div style={{ padding: 20 }}>
            <p className="adm-kpi-label">Durumu değiştir</p>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 18 }}>
              {Object.entries(MAKINE_DURUM).map(([k, v]) => <button key={k} className={detay.durum === k ? 'adm-btn' : 'adm-btn-ghost'} style={{ fontSize: 12, padding: '5px 11px', background: detay.durum === k ? v.color : undefined }} onClick={() => durum(detay, k)}>{v.l}</button>)}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 6 }}>
              {[['Bu ay üretim', fmtInt(x.uretilen)], ['Fire oranı', `%${fmtN(fireOrani(x.uretilen, x.fire), 1)}`], ['Çalışma (saat)', fmtN(x.saat, 0)]].map(([k, v]) => <div key={k} style={{ padding: 12, borderRadius: 10, background: 'var(--adm-s2)' }}><div className="adm-kpi-label" style={{ marginBottom: 4 }}>{k}</div><b style={{ fontSize: 17, fontFamily: 'JetBrains Mono,monospace' }}>{v}</b></div>)}
            </div>
            <InfoRow k="Kapasite" v={detay.kapasite || '—'} />
            <InfoRow k="Şu anki kalıp" v={x.aktif?.kalip_id ? kalip[x.aktif.kalip_id]?.ad : '—'} />
            {detay.notlar && <InfoRow k="Not" v={detay.notlar} />}
            <Divider label={`İş emirleri (${x.emirler.length})`} />
            {x.emirler.length === 0 ? <p style={{ fontSize: 12.5, color: 'var(--adm-tx3)', margin: 0 }}>Bu makineye atanmış emir yok.</p> : x.emirler.slice(0, 12).map((e: any) => (
              <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px dashed var(--adm-bdr)', fontSize: 12.5 }}>
                <b style={{ fontFamily: 'JetBrains Mono,monospace' }}>{e.no}</b><span style={{ flex: 1, color: 'var(--adm-tx3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{urun[e.urun_id]?.name}</span>
                <span style={{ color: 'var(--adm-tx3)' }}>{fmtInt(e.uretilen_miktar)}/{fmtInt(e.planlanan_miktar)}</span><Badge tone={EMIR_DURUM[e.durum]?.tone}>{EMIR_DURUM[e.durum]?.l}</Badge>
              </div>))}
            <div style={{ marginTop: 14 }}><Link href="/admin/dashboard/uretim/emirler" className="adm-btn-ghost" style={{ textDecoration: 'none', fontSize: 12 }}><ExternalLink size={12} />Üretim emirlerine git</Link></div>
            <p style={{ fontSize: 11, color: 'var(--adm-tx3)', marginTop: 16 }}>Kayıt: {fmtDateTime(detay.created_at)}</p>
          </div>
        )}
      </Drawer>

      <Modal open={modal} onClose={() => setModal(false)} onSubmit={save} title={editing ? 'Makineyi Düzenle' : 'Yeni Makine'} width={520}
        footer={<><button type="button" className="adm-btn-ghost" onClick={() => setModal(false)}>İptal</button><button type="submit" className="adm-btn" disabled={busy}>Kaydet</button></>}>
        <FormGrid>
          <Field label="Kod *"><input className="adm-inp" required autoFocus value={form.kod} onChange={e => setForm((f: any) => ({ ...f, kod: e.target.value }))} placeholder="MK-01" /></Field>
          <Field label="Ad *"><input className="adm-inp" required value={form.ad} onChange={e => setForm((f: any) => ({ ...f, ad: e.target.value }))} placeholder="Enjeksiyon 1" /></Field>
          <Field label="Tonaj (ton)"><input type="number" className="adm-inp" value={form.tonaj} onChange={e => setForm((f: any) => ({ ...f, tonaj: e.target.value }))} /></Field>
          <Field label="Kapasite / Model"><input className="adm-inp" value={form.kapasite} onChange={e => setForm((f: any) => ({ ...f, kapasite: e.target.value }))} placeholder="örn. 450 g atım" /></Field>
          <Field label="Notlar" span={2}><textarea className="adm-inp" rows={2} value={form.notlar} onChange={e => setForm((f: any) => ({ ...f, notlar: e.target.value }))} /></Field>
        </FormGrid>
      </Modal>
      {toast.node}
    </div>
  )
}
