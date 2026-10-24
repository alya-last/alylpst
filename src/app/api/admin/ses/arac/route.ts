import { NextRequest, NextResponse } from 'next/server'
import { modulGerekli } from '@/lib/yetki'
import { oranSiniri } from '@/lib/rate-limit'
import { birimAraciCalistir, izinliBirimler, type Birim } from '@/lib/ai-birim'

export const maxDuration = 30

// Sesli asistanın araç çağrısı: model tarayıcıya "şu aracı çalıştır" der, tarayıcı buraya iletir.
// Araç kullanıcının KENDİ oturumuyla ve yalnızca birimin izinli araç listesinden çalışır (RLS/rpc yetkisi aynen geçerli).
export async function POST(req: NextRequest) {
  const y = await modulGerekli(); if (y.hata) return y.hata
  let b: any; try { b = await req.json() } catch { return NextResponse.json({ error: 'Geçersiz istek' }, { status: 400 }) }
  const birim = String(b?.birim || '') as Birim, ad = String(b?.ad || '').slice(0, 60)
  if (!izinliBirimler(y.moduller).includes(birim)) return NextResponse.json({ error: 'Bu birim için yetkiniz yok.' }, { status: 403 })
  if (!(await oranSiniri(`sesarac:${y.user.id}`, 240, 3600, false))) return NextResponse.json({ sonuc: 'HATA: Çok fazla istek, biraz sonra tekrar deneyin.' }, { status: 429 })
  let args: Record<string, any> = {}
  if (b?.args && typeof b.args === 'object') args = b.args
  else if (typeof b?.args === 'string') { try { args = JSON.parse(b.args.slice(0, 8000)) } catch { /* boş */ } }
  return NextResponse.json({ sonuc: await birimAraciCalistir(y.sb, birim, y.moduller, ad, args) }, { headers: { 'Cache-Control': 'no-store' } })
}
