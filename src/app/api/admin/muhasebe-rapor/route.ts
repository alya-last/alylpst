import { NextRequest, NextResponse } from 'next/server'
import { modulGerekli } from '@/lib/yetki'
import { AiHata } from '@/lib/ai'
import { raporUret } from '@/lib/muhasebe-rapor'
import { raporExcelBuffer } from '@/lib/muhasebe-rapor-excel'

export const maxDuration = 30

// Muhasebe raporunu Excel (.xlsx) olarak indirir. Yalnızca 'muhasebe' modülü; veri kullanıcının kendi oturumuyla okunur.
export async function GET(req: NextRequest) {
  const y = await modulGerekli(['muhasebe']); if (y.hata) return y.hata
  const sp = new URL(req.url).searchParams
  const tip = sp.get('tip') || '', donem = sp.get('donem') || ''
  try {
    const r = await raporUret(y.sb, tip, donem)
    const buf = await raporExcelBuffer(r)
    const ad = `${tip === 'kdv' ? 'kdv-hazirlik' : tip === 'kdv_liste' ? 'indirilecek-kdv-listesi' : 'aylik-rapor'}-${donem}.xlsx`
    return new NextResponse(buf as ArrayBuffer, { headers: { 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Content-Disposition': `attachment; filename="${ad}"`, 'Cache-Control': 'no-store' } })
  } catch (e: any) {
    if (e instanceof AiHata) return NextResponse.json({ error: e.message }, { status: e.durum })
    console.error('[muhasebe-rapor]', e)
    return NextResponse.json({ error: 'Rapor oluşturulamadı.' }, { status: 500 })
  }
}
