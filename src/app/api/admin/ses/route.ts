import { NextRequest, NextResponse } from 'next/server'
import { modulGerekli } from '@/lib/yetki'
import { oranSiniri } from '@/lib/rate-limit'
import { aiAktif } from '@/lib/ai'
import { BIRIM_AD, birimAraclari, birimTalimati, izinliBirimler, realtimeAraclar, varsayilanBirim, type Birim } from '@/lib/ai-birim'

export const maxDuration = 30

// Sesli asistan (OpenAI Realtime, WebRTC): tarayıcı doğrudan OpenAI'a bağlanır, ama yalnızca burada üretilen KISA ÖMÜRLÜ anahtarla.
// Gerçek API anahtarı tarayıcıya hiç gitmez. Anahtar; kullanıcının birimine özel talimat ve araç listesiyle oluşturulur.
const MODEL = () => process.env.OPENAI_REALTIME_MODEL || 'gpt-realtime-2.1-mini'
const SES = () => process.env.OPENAI_REALTIME_VOICE || 'cedar'
const MAX_SN = 600        // tek oturum en fazla 10 dk (istemci de kapatır)
const BOS_SN = 90         // konuşma yoksa 90 sn sonra kapanır
const IP_SAAT = 8, GUN = 40   // kullanıcı başına saatlik / günlük oturum başlatma sınırı (maliyet koruması)

export async function GET() {
  const y = await modulGerekli(); if (y.hata) return y.hata
  const b = izinliBirimler(y.moduller)
  return NextResponse.json({ aktif: aiAktif(), birimler: b.map(k => ({ k, ad: BIRIM_AD[k] })), varsayilan: varsayilanBirim(y.moduller) })
}

export async function POST(req: NextRequest) {
  const y = await modulGerekli(); if (y.hata) return y.hata
  if (!aiAktif()) return NextResponse.json({ error: 'AI özelliği henüz yapılandırılmamış (OPENAI_API_KEY).', kapali: true }, { status: 503 })
  let body: any = {}; try { body = await req.json() } catch { /* boş */ }
  const izinli = izinliBirimler(y.moduller)
  const birim = (izinli.includes(body?.birim) ? body.birim : varsayilanBirim(y.moduller)) as Birim
  if (body?.birim && !izinli.includes(body.birim)) return NextResponse.json({ error: 'Bu birim için yetkiniz yok.' }, { status: 403 })

  if (!(await oranSiniri(`ses:${y.user.id}`, IP_SAAT, 3600, false)) || !(await oranSiniri(`sesgun:${y.user.id}`, GUN, 86400, false)))
    return NextResponse.json({ error: 'Sesli asistan kullanım sınırına ulaştınız, daha sonra tekrar deneyin.' }, { status: 429 })

  const kim = String(y.user.email || 'panel kullanıcısı').split('@')[0]
  const key = process.env.OPENAI_API_KEY!, base = (process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '')
  const kalite = body?.kalite === 'ekonomik' ? 'ekonomik' : 'yuksek'
  const model = kalite === 'ekonomik' ? MODEL() : (process.env.OPENAI_REALTIME_MODEL_YUKSEK || 'gpt-realtime-2.1')
  const talimat = await birimTalimati(y.sb, birim, kim), tools = realtimeAraclar(birimAraclari(birim, y.moduller))
  // Konuşma bitişini anlamsal algılama (cümle bitmeden lafı kesmez); reddedilirse klasik ses etkinliği algılamaya düşer.
  const SEMANTIK = { type: 'semantic_vad', eagerness: 'low', create_response: true, interrupt_response: true }
  const KLASIK = { type: 'server_vad', threshold: 0.55, prefix_padding_ms: 300, silence_duration_ms: 900, create_response: true, interrupt_response: true }
  const istek = (turn: Record<string, unknown>) => fetch(`${base}/realtime/client_secrets`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(15000),
    body: JSON.stringify({
      expires_after: { anchor: 'created_at', seconds: 120 },
      session: {
        type: 'realtime', model, instructions: talimat, output_modalities: ['audio'],
        audio: {
          input: {
            // Not: bu yalnızca ekrandaki yazıyı üretir; model sesi kendisi duyar. Alan sözlüğü yazının doğruluğunu artırır.
            transcription: { model: 'gpt-4o-transcribe', language: 'tr', prompt: 'Türkçe iş konuşması. Alya Plastik; saksı, sepet, sandık, hammadde, kasa, banka, cari, fatura, tedarikçi, KDV, TL, dolar, euro, LinkedIn, Instagram, Facebook. Ürün kodları: ALY-601.' },
            turn_detection: turn, noise_reduction: { type: 'far_field' },
          },
          output: { voice: SES() },
        },
        tools, tool_choice: 'auto', max_output_tokens: 4096,
      },
    }),
  })
  let res: Response
  try {
    res = await istek(SEMANTIK)
    if (res.status === 400) res = await istek(KLASIK)
  } catch { return NextResponse.json({ error: 'OpenAI’a ulaşılamadı, tekrar deneyin.' }, { status: 504 }) }
  const j: any = await res.json().catch(() => ({}))
  const token: string | null = j?.value ?? j?.client_secret?.value ?? j?.client_secret?.token ?? (typeof j?.client_secret === 'string' ? j.client_secret : null)
  if (!res.ok || !token) {
    console.error('[ses] client_secret hatası', res.status, JSON.stringify(j).slice(0, 400))
    const ayrinti = String(j?.error?.message || '').slice(0, 160)
    return NextResponse.json({ error: `Sesli asistan başlatılamadı${res.status === 401 ? ' (API anahtarı geçersiz)' : res.status === 404 || res.status === 400 ? ` (model/ayar reddedildi${ayrinti ? ': ' + ayrinti : ''})` : ''}.` }, { status: 502 })
  }
  // Oturum kaydı (kim, hangi birim, ne kadar) — kullanıcının kendi oturumuyla yazılır
  const { data: kayit } = await y.sb.from('ai_ses_oturumlari').insert({ birim, model }).select('id').single()
  return NextResponse.json({ token, sdpUrl: `${base}/realtime/calls`, model, birim, oturum_id: kayit?.id ?? null, maxSn: MAX_SN, bosSn: BOS_SN }, { headers: { 'Cache-Control': 'no-store' } })
}
