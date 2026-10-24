import { NextResponse } from 'next/server'
import { modulGerekli } from '@/lib/yetki'
import { tcmbCozumle } from '@/lib/tcmb'

export const maxDuration = 20

// TCMB'den güncel USD/EUR (döviz satış) kurunu getirir — yalnızca değer döner, kaydetmez (kullanıcı onaylayıp kaydeder).
export async function GET() {
  const y = await modulGerekli(['muhasebe', 'yonetim']); if (y.hata) return y.hata
  try {
    const r = await fetch('https://www.tcmb.gov.tr/kurlar/today.xml', { signal: AbortSignal.timeout(8000), cache: 'no-store' })
    if (!r.ok) throw new Error('TCMB ' + r.status)
    const k = tcmbCozumle(await r.text())
    if (!k.USD && !k.EUR) throw new Error('kur okunamadı')
    return NextResponse.json({ ok: true, ...k })
  } catch (e: any) {
    console.error('[api/admin/kurlar]', e?.message)
    return NextResponse.json({ error: 'TCMB kurlarına ulaşılamadı; kurları elle girebilirsiniz.' }, { status: 502 })
  }
}
