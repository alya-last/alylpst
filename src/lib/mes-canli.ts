'use client'
import { useEffect, useState } from 'react'
import { erp } from '@/lib/erp-client'

// Fabrika makine sistemi (MES) → panel makine eşlemesi ve bugünkü/aylık özet. Salt okunur; 60 sn'de bir yenilenir.
// MES kayıtları çalışma/duruş bölümü bitince yazıldığı için "son kayıt" gecikmeli olabilir: TAZE = son kayıt ≤ 90 dk.
export type MesM = { id: number; ad: string; panelId: string | null; son: string | null; durum: number | null; calSn: number; durSn: number; uretimBugun: number; uretimAy: number; calAySn: number; durAySn: number; taze: boolean }
export const TAZE_DK = 90
const trGun = (ms = Date.now()) => new Date(ms + 3 * 3600000).toISOString().slice(0, 10)

export function useMesPanel() {
  const [list, setList] = useState<MesM[]>([])
  const [hazir, setHazir] = useState(false)
  useEffect(() => {
    let iptal = false
    const yukle = async () => {
      try {
        const bugun = trGun(), ayBas = bugun.slice(0, 8) + '01'
        const [mk, dk, ug, dg] = await Promise.all([
          erp.all('mes_makine', 'id,ad,kod,panel_makine_id', (q: any) => q.order('id', { ascending: true })),
          erp.all('mes_durus_kaydi', 'zaman,sure_sn,durum,makine_id', (q: any) => q.gte('zaman', `${bugun}T00:00:00+03:00`).order('zaman', { ascending: true })),
          erp.all('mes_uretim_gunluk', 'anahtar,tarih,makine_id,uretim_adedi', (q: any) => q.gte('tarih', ayBas)),
          erp.all('mes_durum_gunluk', 'anahtar,tarih,makine_id,calisma_sn,durus_sn', (q: any) => q.gte('tarih', ayBas)),
        ])
        if (iptal) return
        const topla = (a: any[], k: string) => a.reduce((t, x) => t + (+x[k] || 0), 0)
        const o: MesM[] = mk.map((m: any) => {
          const k = dk.filter((x: any) => x.makine_id === m.id), s = k[k.length - 1]
          const ugM = ug.filter((x: any) => x.makine_id === m.id), dgM = dg.filter((x: any) => x.makine_id === m.id)
          const son = s?.zaman || null
          return {
            id: m.id, ad: m.ad || m.kod, panelId: m.panel_makine_id || null, son, durum: s ? +s.durum : null,
            calSn: topla(k.filter((x: any) => +x.durum === 1), 'sure_sn'), durSn: topla(k.filter((x: any) => +x.durum !== 1), 'sure_sn'),
            uretimBugun: topla(ugM.filter((x: any) => String(x.tarih) === bugun), 'uretim_adedi'), uretimAy: topla(ugM, 'uretim_adedi'),
            calAySn: topla(dgM, 'calisma_sn'), durAySn: topla(dgM, 'durus_sn'),
            taze: !!son && (Date.now() - +new Date(son)) / 60000 <= TAZE_DK,
          }
        }).filter((x: MesM) => x.son || x.uretimAy > 0 || x.calAySn > 0)
        setList(o); setHazir(true)
      } catch { if (!iptal) setHazir(true) }
    }
    yukle()
    const t = setInterval(yukle, 60000)
    return () => { iptal = true; clearInterval(t) }
  }, [])
  const byPanel: Record<string, MesM> = {}
  list.forEach(m => { if (m.panelId) byPanel[m.panelId] = m })
  return { list, byPanel, hazir, calisan: list.filter(m => m.durum === 1 && m.taze).length, uretimBugun: list.reduce((t, m) => t + m.uretimBugun, 0), uretimAy: list.reduce((t, m) => t + m.uretimAy, 0) }
}
export const dkYaz = (iso: string) => { const dk = Math.max(0, Math.round((Date.now() - +new Date(iso)) / 60000)); return dk < 60 ? `${dk} dk` : `${Math.floor(dk / 60)} sa ${dk % 60} dk` }

// Makine sistemindeki (MES) bu ayın iş emirleri — panel emir listesinde SALT OKUNUR satır olarak gösterilir (panel tablosuna yazılmaz).
// Önceki aylar deneme verisi sayıldığı için yalnız bu ay (Türkiye saatine göre ayın 1'inden itibaren).
export function useMesEmirler() {
  const [rows, setRows] = useState<any[]>([])
  useEffect(() => {
    let iptal = false
    const yukle = async () => {
      try {
        const bugun = trGun(), ayBas = bugun.slice(0, 8) + '01'
        const [em, mk, ur, ug] = await Promise.all([
          erp.all('mes_is_emri_satir', 'id,is_emri_no,makine_id,urun_id,hedef_adet,uretilen_adet,baslangic,bitis', (q: any) => q.gte('baslangic', `${ayBas}T00:00:00+03:00`).order('baslangic', { ascending: false })),
          erp.all('mes_makine', 'id,ad,kod', (q: any) => q.order('id', { ascending: true })),
          erp.all('mes_urun', 'id,kod,ad', (q: any) => q.order('id', { ascending: true })),
          erp.all('mes_uretim_gunluk', 'anahtar,tarih,is_emri_no,uretim_adedi', (q: any) => q.gte('tarih', ayBas)),
        ])
        if (iptal) return
        const mkAd = Object.fromEntries(mk.map((m: any) => [m.id, m.ad || m.kod])), urB = Object.fromEntries(ur.map((u: any) => [u.id, u]))
        const say: Record<string, number> = {}, sayBugun: Record<string, number> = {}
        ug.forEach((x: any) => { if (x.is_emri_no == null) return; say[x.is_emri_no] = (say[x.is_emri_no] || 0) + (+x.uretim_adedi || 0); if (String(x.tarih) === bugun) sayBugun[x.is_emri_no] = (sayBugun[x.is_emri_no] || 0) + (+x.uretim_adedi || 0) })
        const o: Record<string, any> = {}
        em.forEach((r: any) => {
          const x = (o[r.is_emri_no] ||= { _mes: true, id: `mes-${r.is_emri_no}`, no: `MES-${r.is_emri_no}`, mesNo: r.is_emri_no, _makine: mkAd[r.makine_id] || '-', _urun: urB[r.urun_id], planlanan_miktar: 0, uretilen_miktar: 0, fire_miktar: 0, baslangic: r.baslangic, acik: false })
          x.planlanan_miktar = Math.max(x.planlanan_miktar, +r.hedef_adet || 0); x.uretilen_miktar = Math.max(x.uretilen_miktar, +r.uretilen_adet || 0)
          if (r.baslangic && r.baslangic < x.baslangic) x.baslangic = r.baslangic
          if (!r.bitis) x.acik = true
        })
        setRows(Object.values(o).map((x: any) => ({
          ...x, uretilen_miktar: Math.max(x.uretilen_miktar, say[x.mesNo] || 0),
          // Açık ve bugün sayaç üretimi varsa "üretimde"; açık ama bugün üretim yoksa "durduruldu" (gerçek durum olmayabilir); kapalıysa "tamamlandı"
          durum: x.acik ? ((sayBugun[x.mesNo] || 0) > 0 ? 'uretimde' : 'durduruldu') : 'tamamlandi',
        })).sort((a: any, b: any) => String(b.baslangic).localeCompare(String(a.baslangic))))
      } catch { /* sessiz: panel emirleri etkilenmez */ }
    }
    yukle()
    const t = setInterval(yukle, 60000)
    return () => { iptal = true; clearInterval(t) }
  }, [])
  return rows
}
