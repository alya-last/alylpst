import { NextRequest, NextResponse } from 'next/server'
import { modulGerekli } from '@/lib/yetki'
import { oranSiniri } from '@/lib/rate-limit'
import { aiAktif, AiHata } from '@/lib/ai'
import { belgedenCikar, kayitOner, muhasebeAsistan } from '@/lib/ai-muhasebe'
import { topluKontrol } from '@/lib/mevzuat-takip'
import { raporUret, raporYorumla } from '@/lib/muhasebe-rapor'
import type { Konusma } from '@/lib/ai-admin'

export const maxDuration = 90

// Muhasebe AI uçları — yalnızca 'muhasebe' modülü (veya tam yetki). Şirket verisi araçları
// kullanıcının kendi oturumuyla (RLS + rpc_* içindeki yetki kontrolü) çalışır.
export async function GET() {
  const y = await modulGerekli(['muhasebe']); if (y.hata) return y.hata
  return NextResponse.json({ aktif: aiAktif() })
}

export async function POST(req: NextRequest) {
  let body: any
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Geçersiz istek' }, { status: 400 }) }
  const action = String(body?.action || '')
  if (!['sor', 'belge_cikar', 'mevzuat_kontrol', 'kayit_oner', 'rapor', 'rapor_yorum'].includes(action)) return NextResponse.json({ error: 'Geçersiz eylem' }, { status: 400 })

  const y = await modulGerekli(['muhasebe']); if (y.hata) return y.hata
  if (action === 'mevzuat_kontrol') {
    // Kaynak kontrolü ucuzdur ve AI olmadan da (deterministik rakam kontrolüyle) çalışır
    if (typeof body.id !== 'string') return NextResponse.json({ error: 'Kayıt id gerekli' }, { status: 400 })
    const { data: kayit } = await y.sb.from('muhasebe_mevzuat').select('id').eq('id', body.id).maybeSingle() // RLS ile erişim doğrulaması
    if (!kayit) return NextResponse.json({ error: 'Kayıt bulunamadı' }, { status: 404 })
    if (!(await oranSiniri(`mk:${y.user.id}`, 40, 3600, false))) return NextResponse.json({ error: 'Saatlik kontrol sınırına ulaştın.' }, { status: 429 })
    try { const r = await topluKontrol(1, body.id); return NextResponse.json({ ok: true, sonuc: r[0] || null }) }
    catch (e: any) { console.error('[mevzuat_kontrol]', e); return NextResponse.json({ error: 'Kontrol başarısız oldu.' }, { status: 500 }) }
  }
  if (action === 'rapor') {
    // Rapor deterministiktir (AI gerektirmez): veri kullanıcının oturumuyla okunur
    try { return NextResponse.json({ ok: true, rapor: await raporUret(y.sb, String(body.tip), String(body.donem)) }) }
    catch (e: any) { if (e instanceof AiHata) return NextResponse.json({ error: e.message }, { status: e.durum }); console.error('[rapor]', e); return NextResponse.json({ error: 'Rapor oluşturulamadı.' }, { status: 500 }) }
  }
  if (!aiAktif()) return NextResponse.json({ error: 'AI özelliği henüz yapılandırılmamış (OPENAI_API_KEY).', kapali: true }, { status: 503 })
  if (!(await oranSiniri(`aim:${y.user.id}`, 120, 3600, false))) return NextResponse.json({ error: 'Saatlik AI kullanım sınırına ulaştın, biraz sonra tekrar dene.' }, { status: 429 })

  try {
    if (action === 'sor') {
      const g: Konusma[] = (Array.isArray(body.mesajlar) ? body.mesajlar : []).slice(-12)
        .filter((m: any) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim())
        .map((m: any) => ({ role: m.role, content: m.content.slice(0, 3000) }))
      if (!g.length || g[g.length - 1].role !== 'user') return NextResponse.json({ error: 'Soru gerekli' }, { status: 400 })
      const belge = typeof body.belge === 'string' && body.belge.trim() ? body.belge.slice(0, 9000) : undefined
      return NextResponse.json({ ok: true, ...(await muhasebeAsistan(y.sb, g, belge)) })
    }
    if (action === 'rapor_yorum') return NextResponse.json({ ok: true, yorum: await raporYorumla(await raporUret(y.sb, String(body.tip), String(body.donem))) })
    if (action === 'kayit_oner') {
      if (!body.belge || typeof body.belge !== 'object' || !Array.isArray(body.belge.alanlar)) return NextResponse.json({ error: 'Belge verisi gerekli' }, { status: 400 })
      return NextResponse.json({ ok: true, ...(await kayitOner(y.sb, body.belge)) })
    }
    if (typeof body.dosya !== 'string') return NextResponse.json({ error: 'Dosya gerekli' }, { status: 400 })
    return NextResponse.json({ ok: true, sonuc: await belgedenCikar(body.dosya, typeof body.istek === 'string' ? body.istek : '') })
  } catch (e: any) {
    if (e instanceof AiHata) return NextResponse.json({ error: e.message }, { status: e.durum })
    console.error('[api/admin/muhasebe-ai]', action, e)
    return NextResponse.json({ error: 'AI işlemi başarısız oldu.' }, { status: 500 })
  }
}
