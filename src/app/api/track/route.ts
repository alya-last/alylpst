import { NextRequest, NextResponse, after } from 'next/server'
import { notify, supabaseAdmin } from '@/lib/notify'
import { istemciIp, oranSiniri } from '@/lib/rate-limit'

const BOT = /bot|crawl|spider|slurp|preview|headless|lighthouse|monitor/i

function isMilestone(n: number) {
  return n === 100 || n === 500 || (n >= 1000 && n % 1000 === 0)
}

export async function POST(req: NextRequest) {
  const ua = req.headers.get('user-agent') || ''
  if (!ua || BOT.test(ua)) return NextResponse.json({ ok: true, skipped: true })

  // Aynı IP saatte en fazla 120 ziyaret kaydı (tablo şişirme / sahte ziyaret eşiği tetikleme koruması)
  if (!(await oranSiniri(`track:${istemciIp(req)}`, 120, 3600))) return NextResponse.json({ ok: true, skipped: true })

  let body: { page?: string; referrer?: string } = {}
  try { body = await req.json() } catch {}

  const sb = supabaseAdmin()
  const { error } = await sb.from('site_visits').insert({
    page: String(body.page || '/').slice(0, 300),
    referrer: String(body.referrer || '').slice(0, 300) || null,
    user_agent: ua.slice(0, 300),
    country: req.headers.get('x-vercel-ip-country'),
  })
  if (error) { console.error('[track]', error.message); return NextResponse.json({ error: 'Kaydedilemedi' }, { status: 500 }) }

  after(async () => {
    const { count } = await sb.from('site_visits').select('id', { count: 'exact', head: true })
    if (count && isMilestone(count)) {
      await notify(
        'new_visit_milestone',
        `Alya Plastik: ${count} ziyarete ulaşıldı`,
        `Site toplam ${count} ziyarete ulaştı.`,
        { count },
      )
    }
  })
  return NextResponse.json({ ok: true })
}
