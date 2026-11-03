import { NextRequest, NextResponse } from 'next/server'
import { modulGerekli } from '@/lib/yetki'
import { gelirTablosuVeri, gelirTablosuSvg, gelirTablosuSatirlar, ayParse } from '@/lib/gelir-tablosu'
import { excelBuffer } from '@/lib/ai-excel'

export const maxDuration = 30

// Aylık gelir tablosu: varsayılan olarak görüntü (SVG), format=xlsx ile Excel. Yalnızca 'muhasebe' modülü; veri kullanıcının kendi oturumuyla okunur.
export async function GET(req: NextRequest) {
  const y = await modulGerekli(['muhasebe']); if (y.hata) return y.hata
  const sp = new URL(req.url).searchParams, yy = /^(\d{4})$/.exec(sp.get('yil') || '')
  // yil=2026 → Ocak'tan (ay=YYYY-AA verilmişse o aya, yoksa bu ay/Aralık'a) kadar yıllık tablo
  const d = yy ? { yil: +yy[1], ay: ayParse(sp.get('ay') || '')?.ay || (+yy[1] === new Date().getFullYear() ? new Date().getMonth() + 1 : 12) } : ayParse(sp.get('ay') || '')
  if (!d) return NextResponse.json({ error: 'ay=YYYY-AA veya yil=YYYY biçiminde olmalı' }, { status: 400 })
  try {
    const v = await gelirTablosuVeri(y.sb, d.yil, d.ay, yy ? 1 : undefined)
    if (sp.get('format') === 'xlsx') {
      const buf = await excelBuffer(v.baslik, [{ ad: 'Gelir Tablosu', sutunlar: ['Kalem', 'Tutar (TL)'], satirlar: gelirTablosuSatirlar(v) }])
      return new NextResponse(buf as ArrayBuffer, { headers: { 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Content-Disposition': `attachment; filename="gelir-tablosu-${yy ? yy[1] + '-yillik' : sp.get('ay')}.xlsx"`, 'Cache-Control': 'no-store' } })
    }
    return new NextResponse(gelirTablosuSvg(v), { headers: { 'Content-Type': 'image/svg+xml; charset=utf-8', 'Cache-Control': 'no-store' } })
  } catch (e: any) {
    console.error('[gelir-tablosu]', e)
    return NextResponse.json({ error: 'Gelir tablosu oluşturulamadı.' }, { status: 500 })
  }
}
