'use client'
import { useEffect, useMemo, useState } from 'react'
import { erp } from '@/lib/erp-client'
import { muh } from '@/lib/muhasebe-client'
import { fmt, fmtDate } from '@/lib/fmt'
import { Badge } from '@/components/admin/erp/ui'
import { eslestir, type Aday, type FKalem } from '@/lib/satinalma-eslestir'

export type EslesmeSecim = { siparisId: string; siparisNo: string; otoFatura: { id: string; no: string; durum: string } | null; iptalOto: boolean }

// Belgeden okunan ALIŞ faturasını, aynı tedarikçinin satınalma siparişleriyle karşılaştırır. Yalnızca öneri/uyarı üretir;
// kullanıcı bir siparişi seçerse fatura taslağı o siparişe bağlanır. Hiçbir kayıt kendiliğinden değiştirilmez.
export default function SiparisEslestir({ cariId, araToplamTRY, tarih, kalemler, paraBirimi, kur = 1, secim, onChange }: {
  cariId: string; araToplamTRY: number; tarih: string; kalemler: FKalem[]; paraBirimi: string; kur?: number; secim: EslesmeSecim | null; onChange: (s: EslesmeSecim | null) => void
}) {
  const [adaylar, setAdaylar] = useState<Aday[] | null>(null)
  const [hata, setHata] = useState('')

  useEffect(() => {
    let iptal = false
    setAdaylar(null); setHata('')
    if (!cariId) return
    ;(async () => {
      try {
        const sip: any[] = (await erp.all('satinalma_siparisleri', '*', (q: any) => q.eq('tedarikci_id', cariId).neq('durum', 'iptal').order('tarih', { ascending: false }))).slice(0, 40)
        if (!sip.length) { if (!iptal) setAdaylar([]); return }
        const ids = sip.map(s => s.id)
        const [kal, ham, fat, bagli] = await Promise.all([
          erp.all('satinalma_siparisi_kalemleri', '*', (q: any) => q.in('siparis_id', ids)),
          erp.all('hammaddeler', 'id,ad'),
          muh.all('faturalar', 'id,no,durum,toplam,ara_toplam,kdv_orani', (q: any) => q.in('no', sip.map(s => 'ALIS-' + s.no))),
          muh.all('faturalar', 'no,durum,satinalma_siparis_id', (q: any) => q.in('satinalma_siparis_id', ids)),
        ])
        const kalemIds = kal.map((k: any) => k.id)
        const hr: any[] = kalemIds.length ? await erp.all('stok_hareketleri', 'kaynak_id,tarih', (q: any) => q.in('kaynak_id', kalemIds).eq('tip', 'satinalma')) : []
        const sonTeslim: Record<string, string> = {}; hr.forEach(h => { if (!sonTeslim[h.kaynak_id] || h.tarih > sonTeslim[h.kaynak_id]) sonTeslim[h.kaynak_id] = h.tarih })
        const hAd = Object.fromEntries(ham.map((h: any) => [h.id, h.ad]))
        const list: Aday[] = sip.map(s => {
          const ks = kal.filter((k: any) => k.siparis_id === s.id)
          const t = ks.map((k: any) => sonTeslim[k.id]).filter(Boolean).sort()
          return {
            id: s.id, no: s.no, tarih: s.tarih, durum: s.durum, teslimTarihi: t.length ? t[t.length - 1] : null,
            kalemler: ks.map((k: any) => ({ ad: hAd[k.hammadde_id] || 'Hammadde', miktar: +k.miktar || 0, teslim: +k.teslim_alinan_miktar || 0, birim_fiyat: (+k.birim_fiyat || 0) * (+s.kur || 1) })),   // siparişin para birimi TL'ye çevrilir
            otoFatura: fat.find((f: any) => f.no === 'ALIS-' + s.no) || null,
            bagliFaturalar: bagli.filter((b: any) => b.satinalma_siparis_id === s.id),
          }
        })
        if (!iptal) setAdaylar(list)
      } catch (e: any) { if (!iptal) setHata(e.message || 'Siparişler okunamadı') }
    })()
    return () => { iptal = true }
  }, [cariId])

  const sonuclar = useMemo(() => adaylar ? eslestir({ araToplam: araToplamTRY, tarih, kalemler: kalemler.filter(k => k.urun_adi && k.miktar > 0).map(k => ({ ...k, birim_fiyat: k.birim_fiyat * (kur || 1) })), paraBirimi }, adaylar) : [], [adaylar, araToplamTRY, tarih, kalemler, paraBirimi, kur])
  const aktif = secim ? sonuclar.find(s => s.aday.id === secim.siparisId) : null

  if (!cariId) return <p style={{ fontSize: 12, color: 'var(--adm-tx3)' }}>Siparişle eşleştirmek için yukarıda tedarikçi carisini seçin.</p>
  if (hata) return <p style={{ fontSize: 12.5, color: 'var(--adm-red)' }}>⚠ {hata}</p>
  if (!adaylar) return <p style={{ fontSize: 12, color: 'var(--adm-tx3)' }}>Tedarikçinin siparişleri kontrol ediliyor…</p>
  if (!adaylar.length) return <p style={{ fontSize: 12, color: 'var(--adm-tx3)' }}>Bu tedarikçiye ait satınalma siparişi bulunamadı; eşleştirme yapılmayacak.</p>

  const sec = (s: (typeof sonuclar)[number]) => onChange({ siparisId: s.aday.id, siparisNo: s.aday.no, otoFatura: s.aday.otoFatura ? { id: s.aday.otoFatura.id, no: s.aday.otoFatura.no, durum: s.aday.otoFatura.durum } : null, iptalOto: false })
  const otoAktif = !!aktif?.aday.otoFatura && ['onaylandi', 'odendi'].includes(aktif.aday.otoFatura.durum)
  const ton = (s: string) => s === 'uyumlu' ? 'green' : s === 'kucuk' ? 'amber' : 'red'

  return (
    <div style={{ border: '1px solid var(--adm-bdr)', padding: 12, borderRadius: 9, marginTop: 12 }}>
      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>Satınalma siparişiyle eşleştir</div>
      <div style={{ display: 'grid', gap: 6 }}>
        {sonuclar.slice(0, 5).map((s, i) => (
          <label key={s.aday.id} style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 12.5, padding: '5px 6px', background: secim?.siparisId === s.aday.id ? 'var(--adm-s2)' : undefined, cursor: 'pointer' }}>
            <input type="radio" name="siparis-eslestir" checked={secim?.siparisId === s.aday.id} onChange={() => sec(s)} />
            <b style={{ width: 110 }}>{s.aday.no}</b><span style={{ width: 80, color: 'var(--adm-tx3)' }}>{fmtDate(s.aday.tarih)}</span>
            <span style={{ flex: 1 }}>{fmt(s.karsilastirilan)} {s.farkYuzde != null && <span style={{ color: 'var(--adm-tx3)' }}>(fatura {s.fark >= 0 ? '+' : ''}{fmt(s.fark)})</span>}</span>
            <Badge tone={ton(s.seviye) as any}>{s.seviye === 'uyumlu' ? 'tutar uyumlu' : s.seviye === 'kucuk' ? 'küçük fark' : 'büyük fark'}</Badge>
            {i === 0 && s.puan >= 50 && <Badge tone="blue">önerilen · %{s.puan}</Badge>}
          </label>))}
        <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 12.5, padding: '5px 6px', cursor: 'pointer' }}><input type="radio" name="siparis-eslestir" checked={!secim} onChange={() => onChange(null)} />Eşleştirme yapma</label>
      </div>

      {aktif && (<div style={{ marginTop: 10, fontSize: 12.5 }}>
        {aktif.uyarilar.map((u, j) => <div key={j} style={{ color: u.includes('İKİ KEZ') ? 'var(--adm-red)' : 'var(--adm-amber)', fontWeight: u.includes('İKİ KEZ') ? 700 : 400, marginBottom: 3 }}>⚠ {u}</div>)}
        {aktif.kalemler.map((k, j) => k.uyarilar.length > 0 && <div key={j} style={{ marginBottom: 3 }}><b>{k.fatura.urun_adi}:</b> {k.uyarilar.map((u, x) => <div key={x} style={{ color: 'var(--adm-amber)' }}>⚠ {u}</div>)}</div>)}
        {aktif.uyarilar.length === 0 && aktif.kalemler.every(k => !k.uyarilar.length) && <div style={{ color: 'var(--adm-green)' }}>✓ Tutar, miktar ve fiyatlar siparişle uyumlu.</div>}
        {otoAktif && secim && (
          <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginTop: 8, padding: 8, background: 'rgba(225,75,75,.08)' }}>
            <input type="checkbox" checked={secim.iptalOto} onChange={e => onChange({ ...secim, iptalOto: e.target.checked })} style={{ marginTop: 3 }} />
            <span><b>{aktif.aday.otoFatura!.no}</b> otomatik faturasını, gerçek fatura taslağı oluşturulunca <b>iptal et</b>. Bu, o faturanın cari borcunu geri alır; gerçek fatura onaylanınca borç yeniden yazılır. İşaretlemezseniz gerçek faturayı onaylamadan önce çifte kaydı kendiniz düzeltmelisiniz.</span>
          </label>)}
      </div>)}
      <p style={{ fontSize: 11, color: 'var(--adm-tx3)', margin: '8px 0 0' }}>Karşılaştırma tutar (KDV hariç), miktar ve fiyata bakar; teslim alınan mal esas alınır. Öneri niteliğindedir.</p>
    </div>
  )
}
