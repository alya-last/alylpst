'use client'
import { useCallback, useEffect, useState } from 'react'
import { Ban, Trash2, RotateCcw } from 'lucide-react'
import { web } from '@/lib/web-data'
import { fmtDate } from '@/lib/fmt'
import { Badge, Card, useToast } from '@/components/admin/erp/ui'

const DURUM: Record<string, { l: string; tone: any }> = { aktif: { l: 'Aktif (kullanılıyor)', tone: 'green' }, kapali: { l: 'Kapalı', tone: 'gray' } }

export function HafizaSekme() {
  const toast = useToast()
  const [l, setL] = useState<any[]>([])
  const [yuk, setYuk] = useState(true)
  const yukle = useCallback(async () => {
    const { data, error } = await web.from('ai_hafiza').select('*').order('created_at', { ascending: false })
    if (error) toast.show(error.message, true)
    setL(data || []); setYuk(false)
  }, []) // eslint-disable-line
  useEffect(() => { yukle() }, [yukle])
  async function durumDegis(id: string, durum: string) {
    const { error } = await web.from('ai_hafiza').update({ durum, updated_at: new Date().toISOString() }).eq('id', id)
    if (error) { toast.show(error.message, true); return }
    yukle()
  }
  async function sil(id: string) {
    if (!confirm('Bu düzeltme kalıcı silinsin mi? (Silmek yerine "Kapat" dersen sonra tekrar açabilirsin.)')) return
    const { error } = await web.from('ai_hafiza').delete().eq('id', id)
    if (error) { toast.show(error.message, true); return }
    yukle()
  }
  return (
    <>
      <div style={{ fontSize: 12.5, color: 'var(--adm-tx3)', marginBottom: 12, lineHeight: 1.7 }}>
        Burası <b>Alya hafızası</b>. Eklediğin dersler hemen kullanılır. Yanlış bir şey öğretildiyse <b>Kapat</b> demen yeter; kayıt silinmez, istersen yeniden açarsın.
        Rakam yazma: rakamlar her zaman güncel kayıttan alınır.
      </div>
      {yuk ? <Card><div style={{ padding: 16, fontSize: 13 }}>Yükleniyor…</div></Card>
        : l.length === 0 ? <Card><div style={{ padding: 16, fontSize: 13, color: 'var(--adm-tx3)' }}>Henüz ders yok. Yukarıdaki kutudan ilk dersi ekleyin.</div></Card>
        : <div style={{ display: 'grid', gap: 10 }}>{l.map(x => (
          <Card key={x.id}>
            <div style={{ padding: 14, display: 'grid', gap: 6, fontSize: 13, lineHeight: 1.6 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <Badge tone={DURUM[x.durum]?.tone}>{DURUM[x.durum]?.l || x.durum}</Badge>
                <span style={{ fontSize: 11.5, color: 'var(--adm-tx3)' }}>{fmtDate(String(x.created_at).slice(0, 10))}</span>
              </div>
              <div><b>Soru:</b> {x.soru}</div>
              {x.yanlis_cevap && <div style={{ color: 'var(--adm-tx3)' }}><b>Verilen (yanlış) cevap:</b> {String(x.yanlis_cevap).slice(0, 300)}{String(x.yanlis_cevap).length > 300 ? '…' : ''}</div>}
              <div><b>Doğrusu:</b> {x.dogru_cevap}</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
                {x.durum === 'kapali' && <button className="adm-btn" style={{ fontSize: 12 }} onClick={() => durumDegis(x.id, 'aktif')}><RotateCcw size={12} />Yeniden aç</button>}
                {x.durum !== 'kapali' && <button className="adm-btn-ghost" style={{ fontSize: 12 }} onClick={() => durumDegis(x.id, 'kapali')}><Ban size={12} />Kapat</button>}
                <button className="adm-btn-ghost" style={{ fontSize: 12 }} onClick={() => sil(x.id)}><Trash2 size={12} />Sil</button>
              </div>
            </div>
          </Card>
        ))}</div>}
    </>
  )
}
