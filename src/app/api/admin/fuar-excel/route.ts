import { NextResponse } from 'next/server'
import { modulGerekli } from '@/lib/yetki'
import { fuarBuffer } from '@/lib/fuar-excel'

export const maxDuration = 30

// Fuar listesini (maliyet, katılım bedeli, ödemeler, destek) sade Excel olarak indirir. ?yil=2025 ve ?tesvikli=1 süzgeçleri isteğe bağlı.
export async function GET(req: Request) {
  const y = await modulGerekli(['muhasebe']); if (y.hata) return y.hata
  const q = new URL(req.url).searchParams, yil = Math.floor(+(q.get('yil') || 0)), tesvikli = q.get('tesvikli') === '1'
  const [f, o] = await Promise.all([
    y.sb.from('fuar').select('id,yil,ad,tarih,tur,maliyet_tl,katilim_tutar,para_birimi,destek_tutar,destek_durum,destek_gelis_tarihi').order('tarih').limit(500),
    y.sb.from('fuar_odeme').select('fuar_id,tarih,tutar,para_birimi').order('tarih').limit(2000),
  ])
  if (f.error || o.error) { console.error('[fuar-excel]', f.error?.message || o.error?.message); return NextResponse.json({ error: 'Veri okunamadı.' }, { status: 500 }) }
  const fl = (f.data || []).filter((x: any) => (!yil || x.yil === yil) && (!tesvikli || x.destek_durum === 'alindi' || x.destek_durum === 'bekliyor'))
  const buf = await fuarBuffer(fl as any, (o.data || []) as any)
  return new NextResponse(buf as ArrayBuffer, { headers: { 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Content-Disposition': `attachment; filename="fuarlar${yil ? '-' + yil : ''}${tesvikli ? '-tesvikli' : ''}.xlsx"`, 'Cache-Control': 'no-store' } })
}
