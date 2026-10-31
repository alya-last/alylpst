import { NextResponse } from 'next/server'
import { modulGerekli } from '@/lib/yetki'
import { stokFisBuffer, type StokMekan } from '@/lib/stok-fis-excel'

export const maxDuration = 30

// Depo stoğu, "ALYA DEPO GİRİŞ FİŞİ" şablonunda Excel. ?mekan=ic | dis | hepsi — yalnızca 'muhasebe' / 'satis' modülü; veri kullanıcının kendi oturumuyla okunur.
export async function GET(req: Request) {
  const y = await modulGerekli(['muhasebe', 'satis']); if (y.hata) return y.hata
  const m = new URL(req.url).searchParams.get('mekan')
  const mekanlar: StokMekan[] = m === 'dis' ? ['dis'] : m === 'hepsi' ? ['ic', 'dis'] : ['ic']
  try {
    const buf = await stokFisBuffer(y.sb, mekanlar)
    const ad = m === 'dis' ? 'dis-mekan-stok' : m === 'hepsi' ? 'ic-dis-mekan-stok' : 'ic-mekan-stok'
    return new NextResponse(buf as ArrayBuffer, { headers: { 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Content-Disposition': `attachment; filename="${ad}.xlsx"`, 'Cache-Control': 'no-store' } })
  } catch (e: any) {
    console.error('[stok-excel]', e?.message || e)
    return NextResponse.json({ error: 'Excel hazırlanamadı.' }, { status: 500 })
  }
}
