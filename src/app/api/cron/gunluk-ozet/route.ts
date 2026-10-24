import crypto from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin, notify } from '@/lib/notify'
import { gunlukOzet } from '@/lib/gunluk-ozet'

export const maxDuration = 60

// Vercel Cron her sabah 08:30 (TR, Pzt–Cmt) çağırır; "Authorization: Bearer <CRON_SECRET>" doğrulanır (zamanlamaya dayanıklı karşılaştırma).
const sha = (s: string) => crypto.createHash('sha256').update(s).digest()
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret) return NextResponse.json({ error: 'CRON_SECRET tanımlı değil' }, { status: 503 })
  const m = /^Bearer (.+)$/.exec(req.headers.get('authorization') || '')
  if (!m || !crypto.timingSafeEqual(sha(m[1]), sha(secret))) return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 })
  try {
    const o = await gunlukOzet(supabaseAdmin())
    if (o.toplamUyari > 0) await notify('gunluk_ozet', o.baslik, o.metin, { tarih: o.tarih, bolumler: o.bolumler.map(b => ({ anahtar: b.anahtar, sayi: b.sayi })) })
    return NextResponse.json({ ok: true, gonderildi: o.toplamUyari > 0, toplamUyari: o.toplamUyari, bolumler: o.bolumler.map(b => ({ anahtar: b.anahtar, sayi: b.sayi })), atlanan: o.atlanan })
  } catch (e: any) {
    console.error('[cron/gunluk-ozet]', e)
    return NextResponse.json({ error: 'Özet hazırlanamadı' }, { status: 500 })
  }
}
