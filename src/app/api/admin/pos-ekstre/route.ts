import { NextResponse } from 'next/server'
import { modulGerekli } from '@/lib/yetki'
import { posEkstre } from '@/lib/pos-ekstre'
import { posEkstreBuffer } from '@/lib/pos-ekstre-excel'

export const maxDuration = 30

// POS tahsilat ekstresini (Borç / Alacak / Bakiye) Excel olarak indirir. Yalnızca 'muhasebe' modülü; veri kullanıcının kendi oturumuyla okunur.
export async function GET() {
  const y = await modulGerekli(['muhasebe']); if (y.hata) return y.hata
  const { data, error } = await y.sb.from('pos_tahsilat').select('tarih,musteri,tutar,ekstre_vade_gun,beklenen_tarih,durum,yatis_tarihi').order('tarih').limit(5000)
  if (error) { console.error('[pos-ekstre]', error.message); return NextResponse.json({ error: 'Veri okunamadı.' }, { status: 500 }) }
  const buf = await posEkstreBuffer(posEkstre(data || []))
  return new NextResponse(buf as ArrayBuffer, { headers: { 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Content-Disposition': `attachment; filename="pos-tahsilat-ekstre-${new Date().toISOString().slice(0, 10)}.xlsx"`, 'Cache-Control': 'no-store' } })
}
