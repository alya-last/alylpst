import { NextRequest, NextResponse } from 'next/server'
import { modulGerekli } from '@/lib/yetki'
import { ayAraligi, puantajVerisi, PersonelHata } from '@/lib/personel-veri'
import { puantajExcel } from '@/lib/personel-excel'

export const maxDuration = 30

// Aylık puantajı Excel olarak indirir (yalnızca 'personel' modülü; veri kullanıcının kendi oturumuyla okunur).
export async function GET(req: NextRequest) {
  const y = await modulGerekli(['personel']); if (y.hata) return y.hata
  const donem = new URL(req.url).searchParams.get('donem') || ''
  try {
    const { bas, bit } = ayAraligi(donem)
    const v = await puantajVerisi(y.sb, bas, bit)
    const buf = await puantajExcel(v.satirlar, donem, v.ayar)
    return new NextResponse(buf as ArrayBuffer, { headers: { 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Content-Disposition': `attachment; filename="puantaj-${donem}.xlsx"`, 'Cache-Control': 'no-store' } })
  } catch (e: any) {
    if (e instanceof PersonelHata) return NextResponse.json({ error: e.message }, { status: e.durum })
    console.error('[personel-puantaj]', e); return NextResponse.json({ error: 'Puantaj oluşturulamadı.' }, { status: 500 })
  }
}
