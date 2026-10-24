import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/notify'
import { istemciIp, oranSiniri } from '@/lib/rate-limit'
import { n8nYetkili } from '@/lib/sosyal-webhook'
import { adaylar } from '@/lib/potansiyel'

export const maxDuration = 30

// n8n → site: potansiyel müşteri (gelenveriler) kaydı. Authorization: Bearer <N8N_LEAD_API_TOKEN> (yoksa N8N_SOSYAL_API_TOKEN).
//   POST /api/webhooks/potansiyel  {title, phone, emails:[...], website, address, categoryName, url}  ya da bunların dizisi / {items:[...]}
// Aynı işletme (harita adresi/web sitesi/telefon) tekrar gelirse mevcut kayıt DEĞİŞTİRİLMEZ (durum ve notlar korunur).
const yanit = (b: unknown, status = 200) => NextResponse.json(b, { status, headers: { 'Cache-Control': 'no-store' } })
const gizli = () => process.env.N8N_LEAD_API_TOKEN || process.env.N8N_SOSYAL_API_TOKEN

export async function POST(req: NextRequest) {
  const ip = istemciIp(req)
  if (!(await oranSiniri(`n8nlead:${ip}`, 120, 600, false))) return yanit({ error: 'Çok fazla istek.' }, 429)
  const y = n8nYetkili(req.headers.get('authorization'), gizli())
  if (y === 'kapali') return yanit({ error: 'Webhook yapılandırılmamış (N8N_LEAD_API_TOKEN).' }, 503)
  if (y === 'yok') {
    if (!(await oranSiniri(`n8nleadhata:${ip}`, 10, 600, false))) return yanit({ error: 'Çok fazla hatalı deneme.' }, 429)
    return yanit({ error: 'Yetkisiz.' }, 401)
  }
  if (Number(req.headers.get('content-length') || 0) > 1_000_000) return yanit({ error: 'İstek çok büyük.' }, 413)
  let b: any
  try { b = await req.json() } catch { return yanit({ error: 'Geçersiz JSON.' }, 400) }

  const { adaylar: liste, gecersiz } = adaylar(b)
  if (!liste.length) return yanit({ error: 'Geçerli kayıt yok (en az "title" gerekli).', gecersiz }, 400)
  const { data, error } = await supabaseAdmin().from('gelenveriler')
    .upsert(liste.map(a => ({ ...a, kaynak: 'n8n' })), { onConflict: 'tekil_anahtar', ignoreDuplicates: true }).select('id')
  if (error) { console.error('[webhooks/potansiyel]', error.message); return yanit({ error: 'Kaydedilemedi.' }, 500) }
  const eklenen = data?.length ?? 0
  return yanit({ ok: true, gelen: liste.length, eklenen, mevcut_atlanan: liste.length - eklenen, gecersiz })
}
