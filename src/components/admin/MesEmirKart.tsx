'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { erp } from '@/lib/erp-client'
import { fmtInt, fmtDate } from '@/lib/fmt'
import { Card, Empty } from '@/components/admin/erp/ui'
import { Cog } from 'lucide-react'

// Makine sistemindeki (MES) bu ayın iş emirleri. Salt okunur; panelin kendi üretim emirleriyle ilişkili değildir.
const th: React.CSSProperties = { textAlign: 'left', padding: '7px 10px', fontSize: 11.5, color: 'var(--adm-tx3)', fontWeight: 600, borderBottom: '1px solid var(--adm-bd)' }
const thR: React.CSSProperties = { ...th, textAlign: 'right' }
const td: React.CSSProperties = { padding: '7px 10px', fontSize: 12.5, borderBottom: '1px solid var(--adm-bd)' }
const tdR: React.CSSProperties = { ...td, textAlign: 'right', fontFamily: 'JetBrains Mono,monospace' }

export default function MesEmirKart() {
  const [satir, setSatir] = useState<any[] | null>(null)
  const [hata, setHata] = useState('')
  useEffect(() => {
    let iptal = false
    ;(async () => {
      try {
        // Bu ay (Türkiye saatine göre ayın 1'i 00:00'dan itibaren); önceki kayıtlar deneme verisi sayıldığı için gösterilmez
        const ayBas = new Date(Date.now() + 3 * 3600000).toISOString().slice(0, 8) + '01'
        const bas = `${ayBas}T00:00:00+03:00`
        const [em, mk, ur, ug] = await Promise.all([
          erp.all('mes_is_emri_satir', 'id,is_emri_no,makine_id,urun_id,hedef_adet,uretilen_adet,baslangic,bitis', (q: any) => q.gte('baslangic', bas).order('baslangic', { ascending: false })),
          erp.all('mes_makine', 'id,ad,kod', (q: any) => q.order('id', { ascending: true })),
          erp.all('mes_urun', 'id,kod,ad', (q: any) => q.order('id', { ascending: true })),
          erp.all('mes_uretim_gunluk', 'anahtar,is_emri_no,uretim_adedi', (q: any) => q.gte('tarih', ayBas)),
        ])
        if (iptal) return
        const mkAd = Object.fromEntries(mk.map((m: any) => [m.id, m.ad || m.kod])), urB = Object.fromEntries(ur.map((u: any) => [u.id, u]))
        const sayac: Record<string, number> = {}
        ug.forEach((x: any) => { if (x.is_emri_no != null) sayac[x.is_emri_no] = (sayac[x.is_emri_no] || 0) + (+x.uretim_adedi || 0) })
        const o: Record<string, any> = {}
        em.forEach((r: any) => {
          const x = (o[r.is_emri_no] ||= { no: r.is_emri_no, makine: mkAd[r.makine_id] || '-', urun: urB[r.urun_id], hedef: 0, uretilen: 0, bas: r.baslangic, acik: false })
          x.hedef = Math.max(x.hedef, +r.hedef_adet || 0); x.uretilen = Math.max(x.uretilen, +r.uretilen_adet || 0)
          if (r.baslangic && r.baslangic < x.bas) x.bas = r.baslangic
          if (!r.bitis) x.acik = true
        })
        setSatir(Object.values(o).map((x: any) => ({ ...x, sayac: sayac[x.no] || 0 })).sort((a: any, b: any) => String(b.bas).localeCompare(String(a.bas))).slice(0, 30))
      } catch (e: any) { if (!iptal) setHata(String(e?.message || e)) }
    })()
    return () => { iptal = true }
  }, [])
  return (
    <Card title={<><Cog size={14} />Makine Sistemindeki İş Emirleri (MES) — Bu Ay</>} right={<Link href="/admin/dashboard/uretim/mes" style={{ fontSize: 11.5 }}>ayrıntı</Link>} pad={0}>
      {hata ? <div style={{ padding: 14, fontSize: 12, color: 'var(--adm-red)' }}>Makine sistemi verisi okunamadı: {hata}</div> : satir === null ? <div style={{ padding: 14, fontSize: 12, color: 'var(--adm-tx3)' }}>Yükleniyor…</div> : satir.length === 0 ? <Empty title="Bu ay makine sisteminde iş emri yok" /> : (
        <>
          <div style={{ padding: '8px 14px', fontSize: 11.5, color: 'var(--adm-tx3)' }}>Fabrikada makine sisteminden açılan emirlerdir; aşağıdaki panel emirleriyle bağlantılı değildir. “Açık”, sistemde kapatılmamış anlamına gelir; gerçek durumu yansıtmayabilir. Sayaç: bu ayki sayaç üretimi.</div>
          <div style={{ overflowX: 'auto' }}><table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr><th style={th}>Emir no</th><th style={th}>Makine</th><th style={th}>Ürün</th><th style={thR}>Hedef</th><th style={thR}>Üretilen (emir)</th><th style={thR}>Sayaç</th><th style={th}>Başlangıç</th></tr></thead>
            <tbody>{satir.map((e: any) => (
              <tr key={e.no}><td style={td}>{e.no}{e.acik ? ' · açık' : ''}</td><td style={td}>{e.makine}</td><td style={td}>{e.urun?.ad || '-'}<div style={{ fontSize: 11, color: 'var(--adm-tx3)' }}>{e.urun?.kod}</div></td><td style={tdR}>{fmtInt(e.hedef)}</td><td style={tdR}>{fmtInt(e.uretilen)}</td><td style={tdR}>{fmtInt(e.sayac)}</td><td style={td}>{fmtDate(e.bas)}</td></tr>
            ))}</tbody>
          </table></div>
        </>
      )}
    </Card>
  )
}
