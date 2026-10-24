'use client'
import { useCallback, useEffect, useState } from 'react'
import AdminTopBar from '@/components/admin/TopBar'
import { web } from '@/lib/web-data'
import { Page, PageHead, Card, Badge, Money, useToast } from '@/components/admin/erp/ui'
import Yardim from '@/components/admin/erp/Yardim'
import { Plus, Trash2, Save, Ban, RotateCcw } from 'lucide-react'

const bos = { ev_sahibi: '', odeme_gunu: '1', banka: '', elden: '', not_: '' }

// Kira ödeme planı: yapay zekanın "kira ödemelerimi nasıl yapıyorum" sorusuna verdiği cevap buradaki kayıtlardan üretilir.
export default function KiraPlaniPage() {
  const toast = useToast()
  const [l, setL] = useState<any[]>([])
  const [f, setF] = useState<any>(bos)
  const [duzen, setDuzen] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const yukle = useCallback(async () => {
    const { data, error } = await web.from('kira_plani').select('*').order('odeme_gunu').order('ev_sahibi')
    if (error) toast.show(error.message, true)
    setL(data || [])
  }, []) // eslint-disable-line
  useEffect(() => { yukle() }, [yukle])
  const aktif = l.filter(x => x.aktif)
  const tB = aktif.reduce((t, x) => t + (+x.banka || 0), 0), tE = aktif.reduce((t, x) => t + (+x.elden || 0), 0)

  function duzenle(x: any) { setDuzen(x.id); setF({ ev_sahibi: x.ev_sahibi, odeme_gunu: String(x.odeme_gunu), banka: String(x.banka), elden: String(x.elden), not_: x.not_ || '' }) }
  async function kaydet(e: React.FormEvent) {
    e.preventDefault()
    const gun = parseInt(f.odeme_gunu, 10), banka = +String(f.banka).replace(',', '.') || 0, elden = +String(f.elden).replace(',', '.') || 0
    if (!f.ev_sahibi.trim() || !(gun >= 1 && gun <= 31) || banka + elden <= 0) { toast.show('Ev sahibi, ödeme günü (1-31) ve en az bir tutar yazın', true); return }
    setBusy(true)
    const kayit = { ev_sahibi: f.ev_sahibi.trim(), odeme_gunu: gun, banka, elden, not_: f.not_.trim() || null, updated_at: new Date().toISOString() }
    const r = duzen ? await web.from('kira_plani').update(kayit).eq('id', duzen) : await web.from('kira_plani').insert(kayit)
    setBusy(false)
    if (r.error) { toast.show(r.error.message, true); return }
    setF(bos); setDuzen(null); toast.show('Kaydedildi, yapay zeka artık yeni planı kullanıyor'); yukle()
  }
  async function aktifDegis(x: any) { const { error } = await web.from('kira_plani').update({ aktif: !x.aktif, updated_at: new Date().toISOString() }).eq('id', x.id); if (error) toast.show(error.message, true); else yukle() }
  async function sil(x: any) {
    if (!confirm(`${x.ev_sahibi} kaydı kalıcı silinsin mi? (Kira bitti ise silmek yerine "Kapat" demek daha iyi.)`)) return
    const { error } = await web.from('kira_plani').delete().eq('id', x.id); if (error) toast.show(error.message, true); else yukle()
  }
  const inp = (k: string, ph: string, type = 'text') => <input className="adm-inp" type={type} value={f[k]} onChange={e => setF((s: any) => ({ ...s, [k]: e.target.value }))} placeholder={ph} />

  return (
    <div style={{ flex: 1, overflow: 'auto' }}>
      <AdminTopBar title="Kira Planı" />
      <Page>
        <PageHead title="Kira Planı" sub="Her ev sahibine kira ne zaman, ne kadar bankadan ne kadar elden ödenir. Yapay zeka kira ödeme düzeni sorusunu buradan cevaplar." />
        <Yardim sayfa="kira-plani" />
        <Card>
          <form onSubmit={kaydet} style={{ padding: 16, display: 'grid', gap: 10 }}>
            <div style={{ fontWeight: 600, fontSize: 14 }}>{duzen ? 'Kaydı düzenle' : 'Yeni kira ekle'}</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 10 }}>
              {inp('ev_sahibi', 'Ev sahibi')}{inp('odeme_gunu', 'Ödeme günü (1-31)', 'number')}{inp('banka', 'Bankadan (TL)')}{inp('elden', 'Elden (TL)')}
            </div>
            {inp('not_', 'Not (isteğe bağlı, örn. sözleşme tarihi)')}
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="adm-btn" type="submit" disabled={busy}>{duzen ? <Save size={14} /> : <Plus size={14} />}{duzen ? 'Güncelle' : 'Ekle'}</button>
              {duzen && <button type="button" className="adm-btn-ghost" onClick={() => { setDuzen(null); setF(bos) }}>Vazgeç</button>}
            </div>
          </form>
        </Card>
        <div style={{ height: 16 }} />
        <div style={{ display: 'grid', gap: 10 }}>
          {l.map(x => (
            <Card key={x.id}>
              <div style={{ padding: 14, display: 'grid', gap: 6, fontSize: 13 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <b style={{ fontSize: 14 }}>{x.ev_sahibi}</b><Badge tone={x.aktif ? 'green' : 'gray'}>{x.aktif ? 'Aktif' : 'Kapalı'}</Badge>
                  <span style={{ color: 'var(--adm-tx3)' }}>Ayın {x.odeme_gunu}'inde</span>
                </div>
                <div>Banka <Money v={+x.banka} /> + Elden <Money v={+x.elden} /> = <b><Money v={(+x.banka) + (+x.elden)} /></b></div>
                {x.not_ && <div style={{ color: 'var(--adm-tx3)' }}>{x.not_}</div>}
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button className="adm-btn-ghost" style={{ fontSize: 12 }} onClick={() => duzenle(x)}>Düzenle</button>
                  <button className="adm-btn-ghost" style={{ fontSize: 12 }} onClick={() => aktifDegis(x)}>{x.aktif ? <><Ban size={12} />Kapat</> : <><RotateCcw size={12} />Yeniden aç</>}</button>
                  <button className="adm-btn-ghost" style={{ fontSize: 12 }} onClick={() => sil(x)}><Trash2 size={12} />Sil</button>
                </div>
              </div>
            </Card>
          ))}
          <Card><div style={{ padding: 14, fontSize: 13.5 }}>Toplam aylık kira (aktifler): Banka <Money v={tB} /> + Elden <Money v={tE} /> = <b><Money v={tB + tE} /></b></div></Card>
        </div>
      </Page>
    </div>
  )
}
