'use client'
import Link from 'next/link'
import { fmtN, fmtInt } from '@/lib/fmt'
import { Card, Empty } from '@/components/admin/erp/ui'
import { Cog } from 'lucide-react'
import { useMesPanel, mesDurum } from '@/lib/mes-canli'

// Fabrika makine sistemi (MES) sayaçlarından BUGÜNÜN çalışma/üretim özeti. Salt okunur; 60 sn'de bir yenilenir.
// Durum kuralı tek yerde (mesDurum, src/lib/mes-canli.ts): son sinyal = zaman + sure_sn; ≤ 15 dk ise makine şu an o durumda.
const dkOnce = (iso: string) => Math.max(0, Math.round((Date.now() - +new Date(iso)) / 60000))
const sureYaz = (dk: number) => (dk < 60 ? `${dk} dk` : `${Math.floor(dk / 60)} sa ${dk % 60} dk`)

export default function MesMakineKart() {
  const { list, hazir, senkron } = useMesPanel()
  const satir = list.filter(m => m.son).sort((a, b) => (b.son || '').localeCompare(a.son || ''))
  const senkronSorun = senkron.dk === null || senkron.dk > 10 || !senkron.basarili
  return (
    <Card title={<><Cog size={14} />Makine Sistemi (MES) — Bugün</>} right={<Link href="/admin/dashboard/uretim/mes" style={{ fontSize: 11.5 }}>ayrıntı</Link>} pad={14}>
      {hazir && senkronSorun && <div style={{ fontSize: 11.5, color: 'var(--adm-red)', background: 'var(--adm-red2)', borderRadius: 8, padding: '6px 10px', marginBottom: 8 }}>
        Makine sistemi verisi {senkron.dk === null ? '6 saatten uzun süredir' : `${sureYaz(senkron.dk)}dir`} güncellenmiyor{!senkron.basarili ? ' (son çekim hatalı)' : ''}. Aşağıdaki durumlar eski olabilir.
      </div>}
      {!hazir ? <div style={{ fontSize: 12, color: 'var(--adm-tx3)' }}>Yükleniyor…</div> : satir.length === 0 ? <Empty title="Bugün makine sisteminden kayıt gelmedi" /> : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(150px,1fr))', gap: 8 }}>
            {satir.map(m => {
              const d = mesDurum(m)
              const c = d === 'sinyalyok' ? 'var(--adm-tx3)' : d === 'calisiyor' ? 'var(--adm-green)' : 'var(--adm-amber)'
              return (
                <div key={m.id} style={{ padding: 10, borderRadius: 10, background: `color-mix(in srgb, ${c} 10%, transparent)`, border: `1px solid color-mix(in srgb, ${c} 40%, transparent)` }}>
                  <div style={{ fontSize: 12.5, fontWeight: 700 }}>{m.ad}</div>
                  <div style={{ fontSize: 11, color: c, fontWeight: 600, margin: '2px 0' }}>{d === 'sinyalyok' ? 'Sinyal yok' : d === 'calisiyor' ? 'Şu an çalışıyor' : 'Şu an duruyor'}</div>
                  <div style={{ fontSize: 10.5, color: 'var(--adm-tx3)' }}>{m.son ? `son sinyal ${sureYaz(dkOnce(m.son))} önce` : '—'}</div>
                  <div style={{ fontSize: 11.5, marginTop: 4, fontFamily: 'JetBrains Mono,monospace' }}>Çalışma {fmtN(m.calSn / 3600, 1)} sa · Duruş {fmtN(m.durSn / 3600, 1)} sa</div>
                  <div style={{ fontSize: 11.5, fontFamily: 'JetBrains Mono,monospace' }}>Üretim {fmtInt(m.uretimBugun)} adet</div>
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
