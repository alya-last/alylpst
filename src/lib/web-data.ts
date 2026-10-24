'use client'
import { createClient } from './supabase/client'

const sb = createClient()
// Site tabloları (RLS ile korunur) için 1000 satır sınırını aşan sayfalı okuma
export async function webAll(table: string, select = '*', build?: (q: any) => any): Promise<any[]> {
  const out: any[] = []
  for (let off = 0; off < 20000; off += 1000) {
    let q: any = sb.from(table).select(select)
    if (build) q = build(q)
    const { data, error } = await q.range(off, off + 999)
    if (error) break
    out.push(...(data || []))
    if (!data || data.length < 1000) break
  }
  return out
}
export const web = sb

// Kullanıcı ajanından cihaz / tarayıcı
export function cihaz(ua = '') {
  const u = ua.toLowerCase()
  const tip = /ipad|tablet/.test(u) ? 'Tablet' : /mobi|android|iphone/.test(u) ? 'Mobil' : 'Masaüstü'
  const tarayici = /edg\//.test(u) ? 'Edge' : /opr\/|opera/.test(u) ? 'Opera' : /chrome|crios/.test(u) ? 'Chrome' : /firefox|fxios/.test(u) ? 'Firefox' : /safari/.test(u) ? 'Safari' : 'Diğer'
  return { tip, tarayici }
}
export function kaynakAd(ref?: string | null) {
  if (!ref) return 'Doğrudan'
  try { return new URL(ref).hostname.replace(/^www\./, '') } catch { return ref.slice(0, 30) }
}
