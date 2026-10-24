'use client'
import { useCallback, useEffect, useState } from 'react'
import { Newspaper, Check } from 'lucide-react'
import { web } from '@/lib/web-data'
import { fmtDate } from '@/lib/fmt'
import { Badge, Card, useToast } from '@/components/admin/erp/ui'

/** Resmî kaynaklardan otomatik taranan "yeni mevzuat" haberleri. Bilgi tabanını kendiliğinden değiştirmez; incelemek insana bırakılır. */
export default function MevzuatHaberleri() {
  const toast = useToast()
  const [haberler, setHaberler] = useState<any[]>([])
  const [tarama, setTarama] = useState<any[]>([])
  const yukle = useCallback(async () => {
    const [h, t] = await Promise.all([
      web.from('mevzuat_haberleri').select('*').eq('durum', 'yeni').order('created_at', { ascending: false }).limit(30),
      web.from('mevzuat_tarama').select('*').order('kaynak'),
    ])
    setHaberler(h.data || []); setTarama(t.data || [])
  }, [])
  useEffect(() => { yukle() }, [yukle])
  async function incelendi(id: string) {
    const { error } = await web.from('mevzuat_haberleri').update({ durum: 'incelendi' }).eq('id', id)
    if (error) { toast.show(error.message, true); return }
    yukle()
  }
  const sonTarama = tarama.map(t => t.son_tarama_at).filter(Boolean).sort().pop()
  return (
    <Card>
      <div style={{ padding: 14, display: 'grid', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600, fontSize: 14 }}>
          <Newspaper size={15} />Yeni mevzuat haberleri {haberler.length > 0 && <Badge tone="amber">{haberler.length} yeni</Badge>}
        </div>
        <div style={{ fontSize: 12, color: 'var(--adm-tx3)', lineHeight: 1.6 }}>
          Sistem her sabah Resmî Gazete, GİB ve SGK duyurularına bakar; vergi, SGK, ücret, ihracat gibi konularda yeni düzenleme görürse buraya yazar.
          <b> Bilgi tabanını kendisi değiştirmez</b>: haberi okuyup gerekirse aşağıdaki listeye yeni kayıt eklersiniz.
          {sonTarama ? <> Son tarama: {fmtDate(String(sonTarama).slice(0, 10))}.</> : <> Henüz tarama yapılmadı (ilk tarama bir sonraki sabah).</>}
        </div>
        {haberler.length === 0 && <div style={{ fontSize: 13, color: 'var(--adm-tx3)' }}>Şu an incelenmemiş yeni haber yok.</div>}
        {haberler.map(h => (
          <div key={h.id} style={{ borderTop: '1px solid var(--adm-bdr)', paddingTop: 8, display: 'grid', gap: 3, fontSize: 13, lineHeight: 1.6 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <Badge tone={h.onem === 'yuksek' ? 'red' : 'blue'}>{h.onem === 'yuksek' ? 'Önemli' : 'Bilgi'}</Badge>
              <b>{h.baslik}</b>
              <span style={{ fontSize: 11.5, color: 'var(--adm-tx3)' }}>{h.kaynak} · {fmtDate(String(h.created_at).slice(0, 10))}</span>
            </div>
            <div>{h.ozet}</div>
            {h.konu && <div style={{ fontSize: 12, color: 'var(--adm-tx3)' }}>İlgili konu: {h.konu}</div>}
            <div><button className="adm-btn-ghost" style={{ fontSize: 12 }} onClick={() => incelendi(h.id)}><Check size={12} />İncelendi</button></div>
          </div>
        ))}
        {tarama.some(t => t.hata) && (
          <div style={{ fontSize: 11.5, color: 'var(--adm-amber)' }}>Okunamayan kaynak: {tarama.filter(t => t.hata).map(t => t.kaynak).join(', ')} (site bot erişimine kapalı olabilir; diğer kaynaklar taranmaya devam eder).</div>
        )}
      </div>
    </Card>
  )
}
