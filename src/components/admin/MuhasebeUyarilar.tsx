'use client'
import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, CheckCircle2 } from 'lucide-react'
import { muh } from '@/lib/muhasebe-client'
import { Modal } from '@/components/admin/erp/ui'

type Kayit = { id: string | null; etiket: string }
type Uyari = { kod: string; seviye: 'hata' | 'uyari' | 'bilgi'; baslik: string; aciklama: string; adet: number; kayitlar: Kayit[] | null }

// Uyarıdaki kaydı düzeltebileceğiniz sayfa (?ac=<id> ile kayıt otomatik açılır)
const SAYFA: Record<string, string> = {
  kasa_fark: 'kasa-banka', kasa_para: 'kasa-banka', kur_eski: 'kasa-banka', cari_fark: 'cari', cari_mukerrer: 'cari', cari_ters: 'cari', cari_vergi: 'cari',
  fatura_bakiye: 'faturalar', fatura_taslak: 'faturalar', kdv_gecersiz: 'faturalar', ay_bos: 'islemler', fatura_toplam: 'faturalar', fatura_odeme: 'faturalar', fatura_vade: 'faturalar',
  islem_doviz: 'islemler', islem_tutar: 'islemler', islem_baglantisiz: 'islemler', cek_vade: 'cek-senet', cek_no: 'cek-senet',
}
const yol = (kod: string, id: string | null) => `/admin/dashboard/${SAYFA[kod] ? 'muhasebe/' + SAYFA[kod] : 'personel'}${id ? `?ac=${id}` : ''}`

const RENK = { hata: 'var(--adm-red)', uyari: '#d99a00', bilgi: 'var(--adm-blue)' } as const
const ETIKET = { hata: 'Hata', uyari: 'Uyarı', bilgi: 'Bilgi' } as const

// Veritabanındaki rpc_muhasebe_kontrol() muhasebe tutarlılığını kontrol eder (kasa/cari bakiyeleri, fatura işlenme durumu, vadesi geçenler, eksik bilgiler).
export default function MuhasebeUyarilar() {
  const [liste, setListe] = useState<Uyari[] | null>(null)
  const [acik, setAcik] = useState(false)
  const [genis, setGenis] = useState<string | null>(null)
  const yukle = useCallback(() => { muh.rpc('rpc_muhasebe_kontrol').then((r: any) => setListe(Array.isArray(r) ? r : [])).catch(() => setListe(null)) }, [])
  useEffect(() => { yukle(); const t = setInterval(yukle, 5 * 60 * 1000); return () => clearInterval(t) }, [yukle])
  useEffect(() => { if (acik) yukle() }, [acik, yukle])

  if (liste === null) return null
  const hata = liste.filter(x => x.seviye === 'hata').length
  const uyari = liste.filter(x => x.seviye === 'uyari').length
  const onemli = hata + uyari
  const renk = hata ? RENK.hata : uyari ? RENK.uyari : 'var(--adm-green)'
  return (
    <>
      <button className="adm-btn-ghost" onClick={() => setAcik(true)} title="Muhasebe kontrolleri" style={{ marginRight: 8, color: renk }}>
        {onemli ? <AlertTriangle size={14} /> : <CheckCircle2 size={14} />}
        {onemli ? `${onemli} uyarı` : 'Kontroller temiz'}
      </button>
      <Modal open={acik} onClose={() => setAcik(false)} title="Muhasebe Kontrolleri" width={760}>
        <p style={{ margin: '0 0 12px', fontSize: 12.5, color: 'var(--adm-tx3)' }}>Sistem kasa ve cari bakiyelerini, faturaların işlenme durumunu, vadeleri ve eksik bilgileri otomatik kontrol eder. Bu pencere açıldığında ve her 5 dakikada bir yenilenir.</p>
        {liste.length === 0 && <div style={{ padding: 20, textAlign: 'center', color: 'var(--adm-green)' }}><CheckCircle2 size={28} /><div style={{ marginTop: 6, fontWeight: 600 }}>Sorun bulunamadı</div></div>}
        {liste.map(x => { const ac = genis === x.kod; return (
          <div key={x.kod} style={{ borderLeft: `3px solid ${RENK[x.seviye]}`, background: 'var(--adm-s2)', borderRadius: 8, padding: '10px 12px', marginBottom: 8 }}>
            <div onClick={() => setGenis(ac ? null : x.kod)} style={{ display: 'flex', gap: 8, alignItems: 'baseline', cursor: 'pointer' }}>
              <span style={{ fontSize: 10.5, fontWeight: 700, color: RENK[x.seviye], textTransform: 'uppercase' }}>{ETIKET[x.seviye]}</span>
              <span style={{ fontWeight: 600, fontSize: 13 }}>{x.baslik}</span>
              <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--adm-tx3)', whiteSpace: 'nowrap' }}>{x.adet} kayıt {ac ? '▴' : '▾'}</span>
            </div>
            <div style={{ fontSize: 12, color: 'var(--adm-tx2)', marginTop: 4 }}>{x.aciklama}</div>
            {ac && x.kayitlar && (
              <div style={{ marginTop: 8, borderTop: '1px solid var(--adm-bd, rgba(0,0,0,.08))' }}>
                {x.kayitlar.map((k, i) => (
                  <a key={i} href={yol(x.kod, k.id)} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '6px 4px', fontSize: 12.5, color: 'inherit', textDecoration: 'none', borderBottom: '1px solid var(--adm-bd, rgba(0,0,0,.06))' }}>
                    <span style={{ flex: 1, minWidth: 0, wordBreak: 'break-word' }}>{k.etiket}</span>
                    <span style={{ color: 'var(--adm-ac)', fontWeight: 600, whiteSpace: 'nowrap' }}>Aç ve düzelt →</span>
                  </a>))}
                {x.adet > x.kayitlar.length && <div style={{ fontSize: 11.5, color: 'var(--adm-tx3)', padding: '6px 4px' }}>İlk {x.kayitlar.length} kayıt gösteriliyor, toplam {x.adet}. Düzelttikçe liste yenilenir.</div>}
              </div>)}
            {!ac && <div onClick={() => setGenis(x.kod)} style={{ fontSize: 11.5, color: 'var(--adm-ac)', marginTop: 4, cursor: 'pointer' }}>Kayıtları göster ve düzelt</div>}
          </div>) })}
      </Modal>
    </>
  )
}
