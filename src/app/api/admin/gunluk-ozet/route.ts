import { NextResponse } from 'next/server'
import { modulGerekli } from '@/lib/yetki'
import { oranSiniri } from '@/lib/rate-limit'
import { supabaseAdmin, notify } from '@/lib/notify'
import { gunlukOzet } from '@/lib/gunluk-ozet'

export const maxDuration = 30

// GET: kullanıcının kendi yetkisiyle (RLS) görebildiği veriden özet. POST: özeti (tüm veriyle) bildirim kanallarına şimdi gönderir — yalnızca 'yonetim'.
export async function GET() {
  const y = await modulGerekli(); if (y.hata) return y.hata
  try {
    const o = await gunlukOzet(y.sb)
    return NextResponse.json({ ok: true, ...o }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (e) { console.error('[api/admin/gunluk-ozet]', e); return NextResponse.json({ error: 'Özet hazırlanamadı' }, { status: 500 }) }
}

export async function POST() {
  const y = await modulGerekli(['yonetim']); if (y.hata) return y.hata
  if (!(await oranSiniri(`gunlukozet:${y.user.id}`, 5, 3600, false))) return NextResponse.json({ error: 'Saatlik gönderim sınırına ulaşıldı.' }, { status: 429 })
  const admin = supabaseAdmin()
  const { data: ayar } = await admin.from('notification_settings').select('email_enabled,email_to,whatsapp_enabled,whatsapp_to').eq('event', 'gunluk_ozet').maybeSingle()
  const kanal = !!ayar && ((ayar.email_enabled && ayar.email_to) || (ayar.whatsapp_enabled && ayar.whatsapp_to))
  if (!kanal) return NextResponse.json({ error: 'Günlük Özet için alıcı tanımlı değil. Bildirimler sayfasından e-posta veya WhatsApp numarası ekleyin.' }, { status: 409 })
  try {
    const o = await gunlukOzet(admin)
    await notify('gunluk_ozet', o.baslik + ' (elle gönderildi)', o.metin, { tarih: o.tarih })
    return NextResponse.json({ ok: true, toplamUyari: o.toplamUyari })
  } catch (e) { console.error('[api/admin/gunluk-ozet] gonder', e); return NextResponse.json({ error: 'Gönderilemedi' }, { status: 500 }) }
}
