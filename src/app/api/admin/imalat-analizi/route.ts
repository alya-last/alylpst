import { NextRequest, NextResponse } from 'next/server'
import { modulGerekli } from '@/lib/yetki'
import { imalatVeri, imalatExcel } from '@/lib/imalat-analizi'

export const maxDuration = 30

// Muhasebe şablonlu imalat analizi Excel'i (canlı formüllü). Yalnızca 'muhasebe' modülü; veri kullanıcının kendi oturumuyla okunur.
export async function GET(req: NextRequest) {
  const y = await modulGerekli(['muhasebe']); if (y.hata) return y.hata
  const sp = new URL(req.url).searchParams
  const yil = +(sp.get('yil') || new Date().getFullYear()), bas = +(sp.get('bas') || 1), bit = +(sp.get('bit') || new Date().getMonth() + 1)
  if (!(yil >= 2020 && yil <= 2100) || !(bas >= 1 && bas <= 12) || !(bit >= bas && bit <= 12)) return NextResponse.json({ error: 'yil, bas (1-12), bit (bas-12) geçersiz' }, { status: 400 })
  try {
    const v = await imalatVeri(y.sb, yil, bas, bit, sp.get('urun') === 'saksi')
    const buf = await imalatExcel(v, sp.get('ayay') === '1')
    return new NextResponse(buf, { headers: { 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Content-Disposition': `attachment; filename="imalat-analizi-${yil}-${bas}-${bit}.xlsx"`, 'Cache-Control': 'no-store' } })
  } catch (e: any) {
    console.error('[imalat-analizi]', e)
    return NextResponse.json({ error: 'İmalat analizi oluşturulamadı.' }, { status: 500 })
  }
}
