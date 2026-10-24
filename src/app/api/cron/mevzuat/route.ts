import crypto from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { topluKontrol } from '@/lib/mevzuat-takip'
import { notify } from '@/lib/notify'
import { yeniMevzuatTara } from '@/lib/mevzuat-tarama'

export const maxDuration = 60

const sha = (s: string) => crypto.createHash('sha256').update(s).digest()

// Vercel Cron (vercel.json) her gün çağırır; CRON_SECRET tanımlıysa Vercel "Authorization: Bearer <CRON_SECRET>" gönderir.
// Her çalışmada en uzun süredir kontrol edilmeyen 8 kayıt işlenir (26+ kayıt birkaç günde döner).
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret) return NextResponse.json({ error: 'CRON_SECRET tanımlı değil' }, { status: 503 })
  const m = /^Bearer (.+)$/.exec(req.headers.get('authorization') || '')
  if (!m || !crypto.timingSafeEqual(sha(m[1]), sha(secret))) return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 })

  try {
    const sonuclar = await topluKontrol(8)
    const yeniUyari = sonuclar.filter(s => s.sonuc === 'degismis_olabilir' && s.onceki !== 'degismis_olabilir')
    if (yeniUyari.length) {
      await notify(
        'mevzuat_uyari',
        `Mevzuat uyarısı: ${yeniUyari.length} kayıtta değişiklik olası`,
        ['Alya Plastik Muhasebe AI mevzuat takibi, aşağıdaki kayıtların kaynağında değişiklik olabileceğini tespit etti. Lütfen kontrol edip bilgi tabanını güncelleyin (Muhasebe → Muhasebe AI → Güncel mevzuat).', ...yeniUyari.map(s => `• ${s.baslik}: ${s.not}`)].join('\n'),
        { adet: yeniUyari.length },
      )
    }
    // Yeni mevzuat taraması (kontrolden bağımsız; hata verirse mevcut kontrolü bozmaz)
    let tarama: any = null
    try {
      tarama = await yeniMevzuatTara()
      if (tarama.yeniHaberler.length) {
        await notify('mevzuat_uyari', `Yeni mevzuat haberi: ${tarama.yeniHaberler.length} madde`,
          ['Resmî kaynaklarda muhasebeyi ilgilendiren yeni düzenleme olabilir. İncelemek için: Muhasebe → Muhasebe AI → Güncel mevzuat.', '', ...tarama.yeniHaberler.map((h: any) => `• [${h.kaynak}] ${h.baslik}: ${h.ozet}`)].join('\n'),
          { adet: tarama.yeniHaberler.length })
      }
    } catch (e) { console.error('[cron/mevzuat tarama]', e) }
    return NextResponse.json({ ok: true, tarama: tarama?.durum || null, yeniHaber: tarama?.yeniHaberler?.length || 0, kontrol: sonuclar.length, sonuclar: sonuclar.map(s => ({ baslik: s.baslik, sonuc: s.sonuc })), yeniUyari: yeniUyari.length })
  } catch (e: any) {
    console.error('[cron/mevzuat]', e)
    return NextResponse.json({ error: 'Kontrol başarısız' }, { status: 500 })
  }
}
