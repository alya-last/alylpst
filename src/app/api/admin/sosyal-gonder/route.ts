import { NextRequest, NextResponse } from 'next/server'
import { modulGerekli } from '@/lib/yetki'
import { oranSiniri } from '@/lib/rate-limit'
import { gonderiPaketi, guvenliWebhookUrl } from '@/lib/sosyal-webhook'

export const maxDuration = 20

// Panelden tek gönderiyi n8n webhook'una iter. Hedef adres yalnızca ortam değişkeninden gelir (N8N_SOSYAL_WEBHOOK_URL);
// istemciden adres kabul edilmez (SSRF yok). n8n işi bitirince /api/webhooks/sosyal ile "paylaşıldı" işaretler.
export async function POST(req: NextRequest) {
  const y = await modulGerekli(['sosyal', 'yonetim']); if (y.hata) return y.hata
  const url = guvenliWebhookUrl(process.env.N8N_SOSYAL_WEBHOOK_URL), secret = process.env.N8N_SOSYAL_WEBHOOK_SECRET
  if (!url || !secret || secret.length < 16) return NextResponse.json({ error: 'n8n bağlantısı yapılandırılmamış veya geçersiz (N8N_SOSYAL_WEBHOOK_URL, N8N_SOSYAL_WEBHOOK_SECRET).' }, { status: 503 })
  if (!(await oranSiniri(`n8ngonder:${y.user.id}`, 40, 3600, false))) return NextResponse.json({ error: 'Saatlik gönderim sınırına ulaşıldı.' }, { status: 429 })

  let b: any
  try { b = await req.json() } catch { return NextResponse.json({ error: 'Geçersiz istek' }, { status: 400 }) }
  const id = String(b?.id || '')
  if (!/^[0-9a-f-]{36}$/.test(id)) return NextResponse.json({ error: 'id geçersiz' }, { status: 400 })
  const { data: r } = await y.sb.from('sosyal_gonderiler').select('id,baslik,platform,metin,hashtagler,planlanan_tarih,durum,urun_id,products(name,image_url,images)').eq('id', id).maybeSingle()
  if (!r) return NextResponse.json({ error: 'Gönderi bulunamadı' }, { status: 404 })

  try {
    const res = await fetch(url.toString(), { method: 'POST', redirect: 'error', signal: AbortSignal.timeout(12000), headers: { 'Content-Type': 'application/json', 'x-alya-secret': secret }, body: JSON.stringify({ olay: 'sosyal_gonderi', ...gonderiPaketi(r as any, (r as any).products) }) })
    if (!res.ok) { console.error('[sosyal-gonder] n8n yanıt', res.status); return NextResponse.json({ error: `n8n ${res.status} döndürdü. Workflow açık ve webhook adresi doğru mu?` }, { status: 502 }) }
  } catch (e: any) {
    console.error('[sosyal-gonder]', e?.name, e?.message)
    return NextResponse.json({ error: 'n8n\'e ulaşılamadı (adres veya zaman aşımı).' }, { status: 502 })
  }
  return NextResponse.json({ ok: true })
}
