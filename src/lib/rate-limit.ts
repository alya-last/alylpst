import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/notify'

// Sunucu tarafı oran sınırı. rate_limit_kayitlari tablosunda anon için yalnızca INSERT politikası var
// (SELECT yok), bu yüzden sayım anon anahtarıyla hep 0 dönerdi — bu yüzden service_role ile okunur.
// Tablodaki tetikleyici 24 saatten eski kayıtları kendiliğinden siler; bu yüzden pencere en fazla 24 saattir.

export function istemciIp(req: NextRequest) {
  // Vercel gerçek IP'yi x-real-ip / x-vercel-forwarded-for ile verir; x-forwarded-for'un ilk değeri taklit edilebilir.
  return (
    req.headers.get('x-real-ip') ||
    req.headers.get('x-vercel-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-forwarded-for')?.split(',').pop()?.trim() ||
    'bilinmeyen'
  )
}

/**
 * anahtar için son `pencereSn` saniyede en fazla `limit` kayda izin verir ve bu çağrıyı kaydeder.
 * failOpen=false ise sayım yapılamazsa (ör. service_role yok) istek reddedilir — maliyetli uçlar için.
 */
export async function oranSiniri(anahtar: string, limit: number, pencereSn: number, failOpen = true): Promise<boolean> {
  try {
    const sb = supabaseAdmin()
    const since = new Date(Date.now() - Math.min(pencereSn, 86400) * 1000).toISOString()
    const { count, error } = await sb.from('rate_limit_kayitlari').select('id', { count: 'exact', head: true }).eq('anahtar', anahtar).gte('created_at', since)
    if (error) throw error
    if ((count || 0) >= limit) return false
    await sb.from('rate_limit_kayitlari').insert({ anahtar })
    return true
  } catch (e) {
    console.error('[rate-limit] hata:', e)
    return failOpen
  }
}

/** Anahtar öneki için toplam (ör. tüm 'chat:' istekleri) günlük tavan kontrolü — kaydetmez. */
export async function gunlukTavanAsildi(onek: string, tavan: number): Promise<boolean> {
  try {
    const sb = supabaseAdmin()
    const since = new Date(Date.now() - 86400 * 1000).toISOString()
    const { count, error } = await sb.from('rate_limit_kayitlari').select('id', { count: 'exact', head: true }).like('anahtar', `${onek}%`).gte('created_at', since)
    if (error) throw error
    return (count || 0) >= tavan
  } catch (e) {
    console.error('[rate-limit] tavan hatası:', e)
    return true // emin olamıyorsak maliyetli işi durdur
  }
}
