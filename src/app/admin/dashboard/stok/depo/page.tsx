'use client'
import { useMemo, useState } from 'react'
import AdminTopBar from '@/components/admin/TopBar'
import { erp } from '@/lib/erp-client'
import { fmtK, fmtN, fmtDate } from '@/lib/fmt'
import { useUretim } from '@/lib/uretim-utils'
import { sum } from '@/lib/muh-utils'
import { Page, PageHead, Kpi, KpiGrid, Badge, Money, Drawer, Modal, Field, FormGrid, Card, Empty, useToast } from '@/components/admin/erp/ui'
import { Plus, Pencil, Trash2, Warehouse, Boxes, Coins, AlertTriangle, MoveRight, Power, MapPin } from 'lucide-react'

const bos = { kod: '', ad: '', lokasyon: '', aktif: true }

export default function DepoPage() {
  const toast = useToast()
  const { d, loading, reload } = useUretim(['depolar', 'hammaddeler', 'depoOzet'])
  const [detay, setDetay] = useState<any>(null)
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [form, setForm] = useState<any>(bos)
  const [tasi, setTasi] = useState<any>(null)
  const [busy, setBusy] = useState(false)

  const D = useMemo(() => {
    const o: Record<string, any> = {}
    d.depolar.forEach((x: any) => {
      const items = d.hammaddeler.filter((h: any) => h.depo_id === x.id)
      o[x.id] = { items, deger: sum(items, (h: any) => (+h.mevcut_stok || 0) * (+h.ortalama_maliyet || 0)), kritik: items.filter((h: any) => (+h.mevcut_stok || 0) <= (+h.min_stok || 0)).length, hareket: +d.depoOzet.find((r: any) => r.depo_id === x.id)?.hareket_sayisi || 0, son: d.depoOzet.find((r: any) => r.depo_id === x.id)?.son_tarih }
    })
    return o
  }, [d])
  const atanmamis = d.hammaddeler.filter((h: any) => !h.depo_id)
  const toplamDeger = sum(Object.values(D), (x: any) => x.deger)
  const dd = detay ? D[detay.id] : null

  const openNew = () => { setEditing(null); setForm(bos); setModal(true) }
  const openEdit = (x: any) => { setEditing(x); setForm({ kod: x.kod, ad: x.ad, lokasyon: x.lokasyon || '', aktif: x.aktif !== false }); setModal(true) }
  async function save(e: React.FormEvent) {
    e.preventDefault(); if (busy) return
    if (d.depolar.some((x: any) => x.kod.toLowerCase() === form.kod.trim().toLowerCase() && x.id !== editing?.id)) return toast.show('Bu depo kodu zaten var', true)
    setBusy(true)
    const p = { kod: form.kod.trim(), ad: form.ad.trim(), lokasyon: form.lokasyon || null, aktif: form.aktif }
    const r: any = editing ? await erp.from('depolar').update(p).eq('id', editing.id) : await erp.from('depolar').insert(p)
    setBusy(false)
    if (r?.error) return toast.show(r.error, true)
    setModal(false); toast.show(editing ? 'Depo güncellendi' : 'Depo eklendi'); reload()
  }
  async function aktifToggle(x: any) { await erp.from('depolar').update({ aktif: x.aktif === false }).eq('id', x.id); toast.show(x.aktif === false ? 'Depo aktif' : 'Depo pasife alındı'); reload() }
  async function del(x: any) {
    if (D[x.id].items.length) return toast.show(`Depoda ${D[x.id].items.length} hammadde var — önce başka depoya taşı`, true)
    if (!confirm(`${x.ad} silinsin mi?${D[x.id].hareket ? `\n\n${D[x.id].hareket} stok hareketi bu depoya bağlı; bağlantı kalkar.` : ''}`)) return
    const r: any = await erp.from('depolar').delete().eq('id', x.id)
    if (r?.error) return toast.show(r.error, true)
    toast.show('Depo silindi'); setDetay(null); reload()
  }
  async function tasiKaydet(e: React.FormEvent) {
    e.preventDefault(); if (busy || !tasi) return
    if (!tasi.ids.length) return toast.show('Taşınacak kalem seç', true)
    setBusy(true)
    for (const id of tasi.ids) await erp.from('hammaddeler').update({ depo_id: tasi.hedef || null }).eq('id', id)
    setBusy(false); toast.show(`${tasi.ids.length} kalem taşındı`); setTasi(null); reload()
  }

  return (
    <div style={{ flex: 1, overflow: 'auto' }}>
      <AdminTopBar title="Depolar" />
      <Page>
        <PageHead title="Depo Yönetimi" sub="Depo bazlı stok değeri, kritik kalemler ve kalem taşıma" actions={<button className="adm-btn" onClick={openNew}><Plus size={14} />Depo Ekle</button>} />
        <KpiGrid min={180}>
          <Kpi label="Depo" value={d.depolar.length} Icon={Warehouse} color="var(--adm-ac)" sub={`${d.depolar.filter((x: any) => x.aktif !== false).length} aktif`} />
          <Kpi label="Toplam Stok Değeri" value={fmtK(toplamDeger)} Icon={Coins} color="var(--adm-blue)" sub="depoya atanmış hammadde" />
          <Kpi label="Kalem" value={d.hammaddeler.length - atanmamis.length} Icon={Boxes} color="var(--adm-green)" sub={`${atanmamis.length} kalem depoya atanmamış`} />
          <Kpi label="Kritik Kalem" value={sum(Object.values(D), (x: any) => x.kritik)} Icon={AlertTriangle} color="var(--adm-red)" sub="min. stok altında" />
        </KpiGrid>

        {!loading && d.depolar.length === 0 ? <Card><Empty icon={<Warehouse size={34} />} title="Henüz depo yok" sub="Hammadde deposu, mamul deposu, kalıp odası gibi depolar tanımla." action={<button className="adm-btn" onClick={openNew}><Plus size={14} />İlk Depoyu Ekle</button>} /></Card> : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))', gap: 14 }}>
            {d.depolar.map((x: any) => { const y = D[x.id]; return (
              <div key={x.id} className="adm-card" style={{ padding: 16, cursor: 'pointer', opacity: x.aktif === false ? 0.6 : 1 }} onClick={() => setDetay(x)}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 11, background: 'var(--adm-ac2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Warehouse size={19} style={{ color: 'var(--adm-ac)' }} /></div>
                  <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontWeight: 700, fontSize: 14 }}>{x.ad}</div><div style={{ fontSize: 11.5, color: 'var(--adm-tx3)' }}>{x.kod}{x.lokasyon ? ` · ${x.lokasyon}` : ''}</div></div>
                  {x.aktif === false && <Badge tone="muted">Pasif</Badge>}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
                  <div style={{ padding: 9, borderRadius: 9, background: 'var(--adm-s2)' }}><div className="adm-kpi-label" style={{ marginBottom: 2 }}>Kalem</div><b style={{ fontSize: 15 }}>{y.items.length}</b></div>
                  <div style={{ padding: 9, borderRadius: 9, background: 'var(--adm-s2)' }}><div className="adm-kpi-label" style={{ marginBottom: 2 }}>Değer</div><b style={{ fontSize: 13, fontFamily: 'JetBrains Mono,monospace' }}>{fmtK(y.deger)}</b></div>
                  <div style={{ padding: 9, borderRadius: 9, background: y.kritik ? 'var(--adm-red2)' : 'var(--adm-s2)' }}><div className="adm-kpi-label" style={{ marginBottom: 2 }}>Kritik</div><b style={{ fontSize: 15, color: y.kritik ? 'var(--adm-red)' : undefined }}>{y.kritik}</b></div>
                </div>
                <div style={{ fontSize: 11, color: 'var(--adm-tx3)', marginTop: 10 }}>{y.hareket} hareket{y.son ? ` · son ${fmtDate(y.son)}` : ''}</div>
              </div>) })}
          </div>
        )}
        {atanmamis.length > 0 && d.depolar.length > 0 && (
          <div className="adm-card" style={{ padding: '11px 16px', marginTop: 16, display: 'flex', gap: 10, alignItems: 'center', fontSize: 13 }}>
            <MapPin size={16} style={{ color: 'var(--adm-amber)' }} /><span style={{ flex: 1 }}><b>{atanmamis.length}</b> hammadde herhangi bir depoya atanmamış.</span>
            <button className="adm-btn-ghost" style={{ fontSize: 12 }} onClick={() => setTasi({ ids: atanmamis.map((h: any) => h.id), hedef: d.depolar[0]?.id || '', kaynakAd: 'Atanmamış' })}><MoveRight size={13} />Depoya ata</button>
          </div>
        )}
      </Page>

      <Drawer open={!!detay} onClose={() => setDetay(null)} width={520} title={detay && detay.ad} sub={detay && `${detay.kod}${detay.lokasyon ? ` · ${detay.lokasyon}` : ''}`}
        footer={detay && <><button className="adm-btn-danger" onClick={() => del(detay)}><Trash2 size={13} /></button><button className="adm-btn-ghost" onClick={() => aktifToggle(detay)}><Power size={13} />{detay.aktif === false ? 'Aktifleştir' : 'Pasife al'}</button><button className="adm-btn-ghost" onClick={() => openEdit(detay)}><Pencil size={13} />Düzenle</button>
          {dd?.items.length > 0 && <button className="adm-btn" onClick={() => setTasi({ ids: [], hedef: '', kaynak: detay.id, kaynakAd: detay.ad })}><MoveRight size={14} />Kalem Taşı</button>}</>}>
        {detay && dd && (
          <div>
            <div style={{ padding: '16px 20px 0', display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 6 }}>
              <div style={{ padding: 12, borderRadius: 10, background: 'var(--adm-s2)' }}><div className="adm-kpi-label" style={{ marginBottom: 3 }}>Kalem</div><b style={{ fontSize: 17 }}>{dd.items.length}</b></div>
              <div style={{ padding: 12, borderRadius: 10, background: 'var(--adm-s2)' }}><div className="adm-kpi-label" style={{ marginBottom: 3 }}>Değer</div><Money v={dd.deger} size={15} /></div>
              <div style={{ padding: 12, borderRadius: 10, background: dd.kritik ? 'var(--adm-red2)' : 'var(--adm-s2)' }}><div className="adm-kpi-label" style={{ marginBottom: 3 }}>Kritik</div><b style={{ fontSize: 17, color: dd.kritik ? 'var(--adm-red)' : undefined }}>{dd.kritik}</b></div>
            </div>
            {dd.items.length === 0 ? <Empty icon={<Boxes size={28} />} title="Depoda kalem yok" sub="Hammadde kartında depo seçerek kalem ata" /> : dd.items.map((h: any) => {
              const k = (+h.mevcut_stok || 0) <= (+h.min_stok || 0)
              return <div key={h.id} className="adm-row"><div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 13, fontWeight: 600 }}>{h.ad}</div><div style={{ fontSize: 11.5, color: 'var(--adm-tx3)' }}>{h.kod}</div></div>
                <div style={{ textAlign: 'right' }}><b style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: 12.5, color: k ? 'var(--adm-red)' : undefined }}>{fmtN(h.mevcut_stok, 1)} {h.birim}</b><div style={{ fontSize: 11, color: 'var(--adm-tx3)' }}>{fmtK((+h.mevcut_stok || 0) * (+h.ortalama_maliyet || 0))}</div></div></div>
            })}
          </div>
        )}
      </Drawer>

      <Modal open={modal} onClose={() => setModal(false)} onSubmit={save} width={460} title={editing ? 'Depoyu Düzenle' : 'Yeni Depo'}
        footer={<><button type="button" className="adm-btn-ghost" onClick={() => setModal(false)}>İptal</button><button type="submit" className="adm-btn" disabled={busy}>Kaydet</button></>}>
        <FormGrid>
          <Field label="Kod *"><input className="adm-inp" required autoFocus value={form.kod} onChange={e => setForm((f: any) => ({ ...f, kod: e.target.value }))} placeholder="DP-01" /></Field>
          <Field label="Ad *"><input className="adm-inp" required value={form.ad} onChange={e => setForm((f: any) => ({ ...f, ad: e.target.value }))} placeholder="Hammadde Deposu" /></Field>
          <Field label="Lokasyon" span={2}><input className="adm-inp" value={form.lokasyon} onChange={e => setForm((f: any) => ({ ...f, lokasyon: e.target.value }))} placeholder="Ana bina, zemin kat" /></Field>
          <label style={{ gridColumn: 'span 2', display: 'flex', gap: 8, alignItems: 'center', fontSize: 13 }}><input type="checkbox" checked={form.aktif} onChange={e => setForm((f: any) => ({ ...f, aktif: e.target.checked }))} />Aktif</label>
        </FormGrid>
      </Modal>

      <Modal open={!!tasi} onClose={() => setTasi(null)} onSubmit={tasiKaydet} width={520} title="Kalemleri Depoya Taşı"
        footer={<><button type="button" className="adm-btn-ghost" onClick={() => setTasi(null)}>İptal</button><button type="submit" className="adm-btn" disabled={busy}>Taşı</button></>}>
        {tasi && <FormGrid cols={1}>
          <Field label="Hedef depo"><select className="adm-inp" required value={tasi.hedef} onChange={e => setTasi((t: any) => ({ ...t, hedef: e.target.value }))}><option value="">Seçin</option>{d.depolar.filter((x: any) => x.id !== tasi.kaynak && x.aktif !== false).map((x: any) => <option key={x.id} value={x.id}>{x.ad}</option>)}</select></Field>
          <Field label={`Kalemler (${tasi.kaynakAd})`}>
            <div style={{ maxHeight: 240, overflow: 'auto', border: '1px solid var(--adm-bdr)', borderRadius: 9 }}>
              {(tasi.kaynak ? D[tasi.kaynak].items : atanmamis).map((h: any) => <label key={h.id} style={{ display: 'flex', gap: 8, padding: '8px 12px', fontSize: 12.5, borderBottom: '1px solid var(--adm-bdr)' }}><input type="checkbox" checked={tasi.ids.includes(h.id)} onChange={e => setTasi((t: any) => ({ ...t, ids: e.target.checked ? [...t.ids, h.id] : t.ids.filter((i: string) => i !== h.id) }))} />{h.ad} <span style={{ color: 'var(--adm-tx3)' }}>({fmtN(h.mevcut_stok, 1)} {h.birim})</span></label>)}
            </div>
          </Field>
          <p style={{ margin: 0, fontSize: 11.5, color: 'var(--adm-tx3)' }}>Taşıma, kalemin varsayılan deposunu değiştirir; stok miktarı aynı kalır.</p>
        </FormGrid>}
      </Modal>
      {toast.node}
    </div>
  )
}
