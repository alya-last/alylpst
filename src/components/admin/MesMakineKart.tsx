'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { erp } from '@/lib/erp-client'
import { fmtN, fmtInt } from '@/lib/fmt'
import { Card, Empty } from '@/components/admin/erp/ui'
import { Cog } from 'lucide-react'

// Fabrika makine sistemi (MES) sayaçlarından BUGÜNÜN çalışma/üretim özeti. Salt okunur; 60 sn'de bir yenilenir.
// MES kaydı = çalışma/duruş bölümü: zaman başlangıç, sure_sn şimdiye kadarki süre. Son sinyal = zaman + sure_sn; ≤ 15 dk ise makine şu an o durumda.
const trGun = (ms = Date.now()) => new Date(ms + 3 * 3600000).toISOString().slice(0, 10)
const dkOnce = (iso: string) => Math.max(0, Math.round((Date.now() - +new Date(iso)) / 60000))
const sureYaz = (dk: number) => (dk < 60 ? `${dk} dk` : `${Math.floor(dk / 60)} sa ${dk % 60} dk`)

export default function MesMakineKart() {
  const [satir, setSatir] = useState<any[] | null>(null)
  const [hata, setHata] = useState('')
  useEffect(() => {
    let iptal = false
    const yukle = async () => {
      try {
        const bugun = trGun()
        const [mk, dk, ug] = await Promise.all([
          erp.all('mes_makine', 'id,ad,kod,aktif', (q: any) => q.order('id', { ascending: true })),
          erp.all('mes_durus_kaydi', 'zaman,sure_sn,durum,makine_id', (q: any) => q.gte('zaman', `${bugun}T00:00:00+03:00`).order('zaman', { ascending: true })),
          erp.all('mes_uretim_gunluk', 'anahtar,tarih,makine_id,uretim_adedi', (q: any) => q.eq('tarih', bugun)),
        ])
        if (iptal) return
        const o = mk.map((m: any) => {
          const k = dk.filter((x: any) => x.makine_id === m.id)
          const cal = k.filter((x: any) => +x.durum === 1).reduce((t: number, x: any) => t + (+x.sure_sn || 0), 0)
          const dur = k.filter((x: any) => +x.durum !== 1).reduce((t: number, x: any) => t + (+x.sure_sn || 0), 0)
          const u = ug.filter((x: any) => x.makine_id === m.id).reduce((t: number, x: any) => t + (+x.uretim_adedi || 0), 0)
          const sonK = k[k.length - 1], sonMs = sonK ? +new Date(sonK.zaman) + (+sonK.sure_sn || 0) * 1000 : null
          return { id: m.id, ad: m.ad || m.kod, kayit: k.length, cal, dur, uretim: u, son: sonMs ? new Date(sonMs).toISOString() : null, durum: sonK ? +sonK.durum : null, taze: !!sonMs && (Date.now() - sonMs) / 60000 <= 15 }
        }).filter((x: any) => x.kayit > 0).sort((a: any, b: any) => (b.son || '').localeCompare(a.son || ''))
        setSatir(o); setHata('')
      } catch (e: any) { if (!iptal) setHata(String(e?.message || e)) }
    }
    yukle()
    const t = setInterval(yukle, 60000)
    return () => { iptal = true; clearInterval(t) }
  }, [])

  return (
    <Card title={<><Cog size={14} />Makine Sistemi (MES) — Bugün</>} right={<Link href="/admin/dashboard/uretim/mes" style={{ fontSize: 11.5 }}>ayrıntı</Link>} pad={14}>
      {hata ? <div style={{ fontSize: 12, color: 'var(--adm-red)' }}>Makine sistemi verisi okunamadı: {hata}</div> : satir === null ? <div style={{ fontSize: 12, color: 'var(--adm-tx3)' }}>Yükleniyor…</div> : satir.length === 0 ? <Empty title="Bugün makine sisteminden kayıt gelmedi" /> : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(150px,1fr))', gap: 8 }}>
            {satir.map((m: any) => {
              const c = !m.taze ? 'var(--adm-tx3)' : m.durum === 1 ? 'var(--adm-green)' : 'var(--adm-amber)'
              return (
                <div key={m.id} style={{ padding: 10, borderRadius: 10, background: `color-mix(in srgb, ${c} 10%, transparent)`, border: `1px solid color-mix(in srgb, ${c} 40%, transparent)` }}>
                  <div style={{ fontSize: 12.5, fontWeight: 700 }}>{m.ad}</div>
                  <div style={{ fontSize: 11, color: c, fontWeight: 600, margin: '2px 0' }}>{!m.taze ? 'Sinyal yok' : m.durum === 1 ? 'Şu an çalışıyor' : 'Şu an duruyor'}</div>
                  <div style={{ fontSize: 10.5, color: 'var(--adm-tx3)' }}>{m.son ? `son sinyal ${sureYaz(dkOnce(m.son))} önce` : '—'}</div>
                  <div style={{ fontSize: 11.5, marginTop: 4, fontFamily: 'JetBrains Mono,monospace' }}>Çalışma {fmtN(m.cal / 3600, 1)} sa · Duruş {fmtN(m.dur / 3600, 1)} sa</div>
                  <div style={{ fontSize: 11.5, fontFamily: 'JetBrains Mono,monospace' }}>Üretim {fmtInt(m.uretim)} adet</div>
                </div>
              )
            })}
          </div>
          <div style={{ fontSize: 10.5, color: 'var(--adm-tx3)', marginTop: 8 }}>Durum, makineden son gelen sinyale göre belirlenir (15 dakikadan eskiyse “Sinyal yok”). Fire bu sistemde girilmez. Yalnızca bugün kayıt gelen makineler gösterilir.</div>
        </>
      )}
    </Card>
  )
}
