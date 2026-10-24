'use client'
import { useCallback, useEffect, useState } from 'react'
import { personelIstek } from '@/lib/personel-client'
import { Card, Empty } from '@/components/admin/erp/ui'
import { hm, tarihTR, bugunTR } from './ortak'

type Toast = { show: (m: string, err?: boolean) => void }
const gunEkle = (t: string, n: number) => new Date(Date.parse(t + 'T00:00:00Z') + n * 86400000).toISOString().slice(0, 10)
const fmt = (n: number | null | undefined, d = 0) => n == null ? '—' : n.toLocaleString('tr-TR', { maximumFractionDigits: d })

export default function UretimTab({ toast }: { toast: Toast }) {
  const [bit, setBit] = useState(bugunTR())
  const [bas, setBas] = useState(gunEkle(bugunTR(), -29))
  const [v, setV] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  const yukle = useCallback(async () => {
    setLoading(true)
    try { setV(await personelIstek('uretim_verimlilik', { bas, bit })) } catch (e: any) { toast.show(e.message, true); setV(null) }
    setLoading(false)
  }, [bas, bit]) // eslint-disable-line
  useEffect(() => { yukle() }, [yukle])

  return (
    <>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 14 }}>
        <input type="date" className="adm-inp" style={{ width: 150 }} value={bas} max={bit} onChange={e => e.target.value && setBas(e.target.value)} />
        <span>–</span>
        <input type="date" className="adm-inp" style={{ width: 150 }} value={bit} min={bas} onChange={e => e.target.value && setBit(e.target.value)} />
        <span style={{ fontSize: 12, color: 'var(--adm-tx3)' }}>en fazla 92 gün</span>
      </div>
      {loading ? <p style={{ color: 'var(--adm-tx3)' }}>Yükleniyor…</p> : !v || !v.satirlar.length ? <Empty title="Veri yok" sub="Bu aralıkta puantaj veya üretim kaydı bulunamadı" /> : (
        <>
          <Card title="Vardiya özeti" pad={0} style={{ marginBottom: 16 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead><tr>{['Vardiya', 'Gün', 'Kişi-gün', 'Çalışılan saat', 'Üretilen', 'Adet / kişi-saat'].map(h => <th key={h} style={th}>{h}</th>)}</tr></thead>
              <tbody>{v.ozet.map((o: any) => <tr key={o.vardiya} className="adm-row"><td style={td}><b>{o.vardiya}</b></td><td style={td}>{o.gun}</td><td style={td}>{o.kisi_gun}</td><td style={td}>{fmt(o.saat, 1)}</td><td style={td}>{fmt(o.uretilen)}</td><td style={td}><b>{fmt(o.adet_saat, 1)}</b></td></tr>)}</tbody>
            </table>
          </Card>
          <Card title="Günlük detay" pad={0}>
            <div style={{ maxHeight: 460, overflow: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead><tr>{['Tarih', 'Vardiya', 'Kişi', 'Süre', 'Üretilen', 'Fire', 'Fire %', 'Adet/kişi-saat'].map(h => <th key={h} style={th}>{h}</th>)}</tr></thead>
                <tbody>{v.satirlar.map((r: any) => <tr key={r.tarih + r.vardiya} className="adm-row"><td style={td}>{tarihTR(r.tarih)}</td><td style={td}>{r.vardiya}</td><td style={td}>{r.kisi}</td><td style={td}>{hm(r.dk)}</td><td style={td}>{fmt(r.uretilen)}</td><td style={td}>{fmt(r.fire)}</td><td style={td}>{r.fire_orani == null ? '—' : `%${fmt(r.fire_orani, 1)}`}</td><td style={td}>{fmt(r.adet_saat, 1)}</td></tr>)}</tbody>
              </table>
            </div>
          </Card>
          <p style={{ fontSize: 11.5, color: 'var(--adm-tx3)', marginTop: 10 }}>Üretim kayıtları vardiya adıyla eşleşir; üretim hareketlerinde vardiya alanı bu tanımlarla aynı yazılmazsa satırlar ayrı görünür. Üretim modülü yetkisi yoksa üretim sütunları boş gelir.</p>
        </>
      )}
    </>
  )
}
const th: React.CSSProperties = { padding: '8px 12px', textAlign: 'left', fontSize: 11, color: 'var(--adm-tx3)', borderBottom: '1px solid var(--adm-bd)', position: 'sticky', top: 0, background: 'var(--adm-bg)' }
const td: React.CSSProperties = { padding: '7px 12px', borderBottom: '1px solid var(--adm-bd)' }
