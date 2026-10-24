import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/notify'
import { istemciIp, oranSiniri } from '@/lib/rate-limit'
import { gonderiPaketi, n8nYetkili } from '@/lib/sosyal-webhook'

export const maxDuration = 20

// n8n (veya başka bir otomasyon) için uç: Authorization: Bearer <N8N_WEBHOOK_SECRET>
//   GET  /api/webhooks/sosyal            → tarihi gelmiş (bugün ve öncesi) "planlandı" gönderiler
//   GET  /api/webhooks/sosyal?tumu=1     → tüm "planlandı" gönderiler (tarihi ne olursa olsun)
//   POST /api/webhooks/sosyal {id, durum:'paylasildi', paylasim_url?}  → paylaşıldı olarak işaretle
//   POST /api/webhooks/sosyal {id, durum:'hata', mesaj}                → gönderi planlandı kalır, notlara hata eklenir
const bugunTR = () => new Date(Date.now() + 3 * 3600e3).toISOString().slice(0, 10)
const yanit = (b: unknown, status = 200) => NextResponse.json(b, { status, headers: { 'Cache-Control': 'no-store' } })

async function kapi(req: NextRequest) {
  const ip = istemciIp(req)
  if (!(await oranSiniri(`n8nip:${ip}`, 240, 600, false))) return yanit({ error: 'Çok fazla istek.' }, 429)
  const y = n8nYetkili(req.headers.get('authorization'))
  if (y === 'kapali') return yanit({ error: 'Webhook yapılandırılmamış (N8N_SOSYAL_API_TOKEN).' }, 503)
  if (y === 'yok') {
    if (!(await oranSiniri(`n8nhata:${ip}`, 10, 600, false))) return yanit({ error: 'Çok fazla hatalı deneme.' }, 429)
    return yanit({ error: 'Yetkisiz.' }, 401)
  }
  return null
}

export async function GET(req: NextRequest) {
  const red = await kapi(req); if (red) return red
  const sb = supabaseAdmin()
  let q = sb.from('sosyal_gonderiler').select('id,baslik,platform,metin,hashtagler,planlanan_tarih,durum,urun_id,notlar,products(name,image_url,images)').eq('durum', 'planlandi').order('planlanan_tarih', { ascending: true }).limit(50)
  if (req.nextUrl.searchParams.get('tumu') !== '1') q = q.lte('planlanan_tarih', bugunTR())
  const { data, error } = await q
  if (error) { console.error('[webhooks/sosyal] okuma', error.message); return yanit({ error: 'Okunamadı.' }, 500) }
  const gonderiler = (data || []).map((r: any) => gonderiPaketi(r, r.products))
  return yanit({ ok: true, bugun: bugunTR(), adet: gonderiler.length, gonderiler })
}

export async function POST(req: NextRequest) {
  const red = await kapi(req); if (red) return red
  if (Number(req.headers.get('content-length') || 0) > 8192) return yanit({ error: 'İstek çok büyük.' }, 413)
  let b: any
  try { b = await req.json() } catch { return yanit({ error: 'Geçersiz JSON.' }, 400) }
  const id = String(b?.id || '')
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(id)) return yanit({ error: 'id geçersiz.' }, 400)
  const sb = supabaseAdmin()

  if (b.durum === 'paylasildi') {
    const url = b.paylasim_url == null || b.paylasim_url === '' ? null : String(b.paylasim_url)
    if (url && (!/^https:\/\/[^\s]+$/.test(url) || url.length > 500)) return yanit({ error: 'paylasim_url https:// ile başlayan geçerli bir adres olmalı.' }, 400)
    const { data, error } = await sb.from('sosyal_gonderiler').update({ durum: 'paylasildi', paylasim_url: url, updated_at: new Date().toISOString() }).eq('id', id).eq('durum', 'planlandi').select('id')
    if (error) { console.error('[webhooks/sosyal] güncelleme', error.message); return yanit({ error: 'Güncellenemedi.' }, 500) }
    if (!data?.length) return yanit({ error: 'Gönderi bulunamadı veya zaten “planlandı” durumunda değil.' }, 409)
    return yanit({ ok: true, id, durum: 'paylasildi' })
  }

  if (b.durum === 'hata') {
    const mesaj = String(b.mesaj || 'bilinmeyen hata').replace(/\s+/g, ' ').slice(0, 300)
    const { data: r } = await sb.from('sosyal_gonderiler').select('notlar').eq('id', id).eq('durum', 'planlandi').maybeSingle()
    if (!r) return yanit({ error: 'Gönderi bulunamadı veya “planlandı” durumunda değil.' }, 409)
    const not = `${r.notlar ? r.notlar + '\n' : ''}n8n hatası (${bugunTR()}): ${mesaj}`.slice(-1000)
    const { error } = await sb.from('sosyal_gonderiler').update({ notlar: not, updated_at: new Date().toISOString() }).eq('id', id)
    if (error) return yanit({ error: 'Güncellenemedi.' }, 500)
    return yanit({ ok: true, id, durum: 'planlandi', not: 'hata notlara eklendi' })
  }
  return yanit({ error: "durum 'paylasildi' veya 'hata' olmalı." }, 400)
}
