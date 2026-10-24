import { NextResponse } from 'next/server'
import { modulGerekli } from '@/lib/yetki'
import { satisExcelBuffer, type Mekan } from '@/lib/satis-excel'

export const maxDuration = 30

// Yıllık satış dosyası düzeninde Excel (dış mekan ALYG, iç mekan ALY). ?mekan=dis | ic | hepsi — yalnızca 'muhasebe' / 'satis' modülü; veri kullanıcının kendi oturumuyla okunur.
export async function GET(req: Request) {
  const y = await modulGerekli(['muhasebe', 'satis']); if (y.hata) return y.hata
  const m = new URL(req.url).searchParams.get('mekan')
  const mekanlar: Mekan[] = m === 'dis' ? ['dis'] : m === 'ic' ? ['ic'] : ['dis', 'ic']
  try {
    const buf = await satisExcelBuffer(y.sb, mekanlar)
    const ad = m === 'dis' ? 'dis-mekan-satislar' : m === 'ic' ? 'ic-mekan-satislar' : 'satislar'
    return new NextResponse(buf as ArrayBuffer, { headers: { 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Content-Disposition': `attachment; filename="${ad}-2026.xlsx"`, 'Cache-Control': 'no-store' } })
  } catch (e: any) {
    console.error('[satis-excel]', e?.message || e)
    return NextResponse.json({ error: 'Excel hazırlanamadı.' }, { status: 500 })
  }
}
