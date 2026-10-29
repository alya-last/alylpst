import { NextRequest, NextResponse } from 'next/server'
import { modulGerekli } from '@/lib/yetki'
import { gelirTablosuVeri, gelirTablosuSvg, gelirTablosuSatirlar, ayParse } from '@/lib/gelir-tablosu'
import { excelBuffer } from '@/lib/ai-excel'

export const maxDuration = 30

// Aylık gelir tablosu: varsayılan olarak görüntü (SVG), format=xlsx ile Excel. Yalnızca 'muhasebe' modülü; veri kullanıcının kendi oturumuyla okunur.
export async function GET(req: NextRequest) {
  const y = await modulGerekli(['muhasebe']); if (y.hata) return y.hata
  const sp = new URL(req.url).searchParams, d = ayParse(sp.get('ay') || '')
  if (!d) return NextResponse.json({ error: 'ay=YYYY-AA biçiminde olmalı' }, { status: 400 })
  try {
    const v = await gelirTablosuVeri(y.sb, d.yil, d.ay)
    if (sp.get('format') === 'xlsx') {
      const buf = await excelBuffer(v.baslik, [{ ad: 'Gelir Tablosu', sutunlar: ['Kalem', 'Tutar (TL)'], satirlar: gelirTablosuSatirlar(v) }])
      return new NextResponse(buf as ArrayBuffer, { headers: { 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Content-Disposition': `attachment; filename="gelir-tablosu-${sp.get('ay')}.xlsx"`, 'Cache-Control': 'no-store' } })
    }
    return new NextResponse(gelirTablosuSvg(v), { headers: { 'Content-Type': 'image/svg+xml; charset=utf-8', 'Cache-Control': 'no-store' } })
  } catch (e: any) {
    console.error('[gelir-tablosu]', e)
    return NextResponse.json({ error: 'Gelir tablosu oluşturulamadı.' }, { status: 500 })
  }
}
