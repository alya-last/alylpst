'use client'
import { useEffect, useState } from 'react'
import { Modal, Field, useToast } from '@/components/admin/erp/ui'

export type TopluAlan = {
  key: string; label: string
  type: 'select' | 'text' | 'number' | 'date' | 'bool'
  options?: { v: string; l: string }[]   // select için
  bosYapilabilir?: boolean               // "Boş yap" seçeneği (select/date/text için)
  hint?: string
}

type Client = { from: (t: string) => { update: (d: any) => { eq: (c: string, id: any) => Promise<any> } } }
const BOS = '__bos__'

// Listede seçilen kayıtlara tek seferde aynı değeri atar (ör. depo, tedarikçi, bakım tarihi).
// Her alan için "Değiştir" kutusu işaretlenir; işaretlenmeyen alanlara dokunulmaz.
export default function TopluDuzenle({ rows, onClose, onDone, client, table, fields, title = 'Toplu Düzenle', idKey = 'id' }: {
  rows: any[] | null; onClose: () => void; onDone: () => void; client: Client; table: string; fields: TopluAlan[]; title?: string; idKey?: string
}) {
  const toast = useToast()
  const [on, setOn] = useState<Record<string, boolean>>({})
  const [val, setVal] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  useEffect(() => { if (rows) { setOn({}); setVal({}) } }, [rows])
  if (!rows) return null
  const secili = fields.filter(f => on[f.key])

  function deger(f: TopluAlan): { ok: boolean; v?: any } {
    const x = val[f.key]
    if (f.type === 'bool') return { ok: true, v: x === 'true' }
    if (x === BOS) return { ok: true, v: null }
    if (x === undefined || x === '') return { ok: false }
    if (f.type === 'number') { const n = Number(String(x).replace(',', '.')); return Number.isFinite(n) ? { ok: true, v: n } : { ok: false } }
    return { ok: true, v: x }
  }

  async function uygula(e: React.FormEvent) {
    e.preventDefault()
    if (busy || !rows) return
    if (!secili.length) return toast.show('Değiştirilecek en az bir alanı işaretle', true)
    const payload: Record<string, any> = {}
    for (const f of secili) { const d = deger(f); if (!d.ok) return toast.show(`"${f.label}" için değer seç`, true); payload[f.key] = d.v }
    setBusy(true)
    let hata = 0, ilkHata = ''
    const ids = rows.map(r => r[idKey])
    for (let i = 0; i < ids.length; i += 5) {
      const sonuc = await Promise.all(ids.slice(i, i + 5).map(id => client.from(table).update(payload).eq('id', id).catch((er: any) => ({ error: String(er?.message || er) }))))
      sonuc.forEach((r: any) => { if (r?.error) { hata++; ilkHata ||= String(r.error) } })
    }
    setBusy(false)
    if (hata) toast.show(`${ids.length - hata} kayıt güncellendi, ${hata} kayıt güncellenemedi: ${ilkHata}`, true)
    else toast.show(`${ids.length} kayıt güncellendi`)
    onDone()
  }

  return (
    <Modal open onClose={onClose} onSubmit={uygula} width={520} title={`${title} — ${rows.length} kayıt`}
      footer={<><button type="button" className="adm-btn-ghost" onClick={onClose}>İptal</button><button type="submit" className="adm-btn" disabled={busy || !secili.length}>{busy ? 'Uygulanıyor…' : `${rows.length} kayda uygula`}</button></>}>
      <p style={{ margin: '0 0 12px', fontSize: 12.5, color: 'var(--adm-tx3)' }}>Değiştirmek istediğin alanın kutusunu işaretle, yeni değeri seç. İşaretlemediğin alanlar olduğu gibi kalır.</p>
      {fields.map(f => (
        <div key={f.key} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 12, opacity: on[f.key] ? 1 : .75 }}>
          <input type="checkbox" checked={!!on[f.key]} onChange={e => setOn(o => ({ ...o, [f.key]: e.target.checked }))} style={{ marginTop: 28 }} title="Bu alanı değiştir" />
          <div style={{ flex: 1 }}>
            <Field label={f.label} hint={f.hint}>
              {f.type === 'select' ? (
                <select className="adm-inp" value={val[f.key] ?? ''} onChange={e => { setVal(v => ({ ...v, [f.key]: e.target.value })); setOn(o => ({ ...o, [f.key]: true })) }}>
                  <option value="">Seç…</option>
                  {f.bosYapilabilir && <option value={BOS}>— Boş yap —</option>}
                  {f.options?.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
                </select>
              ) : f.type === 'bool' ? (
                <select className="adm-inp" value={val[f.key] ?? 'true'} onChange={e => { setVal(v => ({ ...v, [f.key]: e.target.value })); setOn(o => ({ ...o, [f.key]: true })) }}>
                  <option value="true">Evet / Aktif</option><option value="false">Hayır / Pasif</option>
                </select>
              ) : (
                <input className="adm-inp" type={f.type === 'number' ? 'number' : f.type === 'date' ? 'date' : 'text'} step={f.type === 'number' ? 'any' : undefined} value={val[f.key] === BOS ? '' : (val[f.key] ?? '')}
                  onChange={e => { setVal(v => ({ ...v, [f.key]: e.target.value })); setOn(o => ({ ...o, [f.key]: true })) }} />
              )}
            </Field>
          </div>
        </div>
      ))}
    </Modal>
  )
}
