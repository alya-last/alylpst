import { NextRequest, NextResponse } from 'next/server'
import { modulGerekli } from '@/lib/yetki'
import { oranSiniri } from '@/lib/rate-limit'
import { sosyalIcerikUret } from '@/lib/ai-sosyal'

export const maxDuration = 60

const SAAT: Record<string, string> = { linkedin: '10:00', instagram: '13:00' } // İstanbul saati
const AMAC = ['urun', 'uretim', 'urun', 'ihracat', 'urun', 'kurumsal', 'urun', 'ozel_siparis']
const bugunTR = () => new Date(Date.now() + 3 * 3600e3).toISOString().slice(0, 10)

// POST {ay:'YYYY-MM', platformlar:['linkedin','instagram'], dil:'en'|'tr'} → ayın salı/perşembe günleri için TASLAK gönderi + görsel yönergesi üretir (yayınlamaz).
export async function POST(req: NextRequest) {
  const y = await modulGerekli(['sosyal', 'yonetim']); if (y.hata) return y.hata
  if (!(await oranSiniri(`sosyalplan:${y.user.id}`, 6, 3600, false))) return NextResponse.json({ error: 'Saatlik plan üretim sınırına ulaşıldı.' }, { status: 429 })
  let b: any; try { b = await req.json() } catch { return NextResponse.json({ error: 'Geçersiz istek' }, { status: 400 }) }
  const ay = String(b?.ay || ''); if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(ay)) return NextResponse.json({ error: 'ay=YYYY-AA olmalı' }, { status: 400 })
  const pls: string[] = (Array.isArray(b?.platformlar) ? b.platformlar : []).filter((p: any) => p === 'linkedin' || p === 'instagram')
  if (!pls.length) return NextResponse.json({ error: 'En az bir platform seçin' }, { status: 400 })
  const dil = b?.dil === 'tr' ? 'tr' : 'en', bugun = bugunTR()
  const [yy, mm] = ay.split('-').map(Number), n = new Date(Date.UTC(yy, mm, 0)).getUTCDate()
  const gunler: string[] = []
  for (let g = 1; g <= n; g++) { const t = `${ay}-${String(g).padStart(2, '0')}`, d = new Date(t + 'T00:00:00Z').getUTCDay(); if ((d === 2 || d === 4) && t > bugun) gunler.push(t) }
  if (!gunler.length) return NextResponse.json({ error: 'Bu ay için ileri tarihli salı/perşembe günü kalmadı.' }, { status: 400 })

  const [{ data: urunler }, { data: st }, { data: mevcut }] = await Promise.all([
    y.sb.from('products').select('id,name,code,category,subcategory,description,specs,tags,image_url').not('image_url', 'is', null).limit(300),
    y.sb.from('settings').select('key,value').in('key', ['site', 'stats', 'export_countries']),
    y.sb.from('sosyal_gonderiler').select('planlanan_tarih,platform').gte('planlanan_tarih', `${ay}-01`).lte('planlanan_tarih', `${ay}-31`),
  ])
  const m = Object.fromEntries((st || []).map((r: any) => [r.key, r.value]))
  const firma = { sirket: m.site?.company, kurulus_yili: m.site?.founded, adres: m.site?.address, e_posta: m.site?.email, ihracat_e_posta: m.site?.export_email, telefon: m.site?.phone, ihracat_ulkeleri: Array.isArray(m.export_countries) ? m.export_countries.slice(0, 30).join(', ') : undefined, model_sayisi: m.stats?.models, ihracat_ulke_sayisi: m.stats?.countries }
  const var_ = new Set((mevcut || []).map((r: any) => `${r.planlanan_tarih}|${r.platform}`))
  const havuz = [...(urunler || [])].sort(() => Math.random() - 0.5)
  type Is = { tarih: string; platform: 'linkedin' | 'instagram'; amac: string; urun: any }
  const isler: Is[] = []
  gunler.forEach((t, i) => { const amac = AMAC[i % AMAC.length], urun = amac === 'urun' || amac === 'ozel_siparis' ? havuz[i % Math.max(1, havuz.length)] : undefined; for (const p of pls as ('linkedin' | 'instagram')[]) if (!var_.has(`${t}|${p}`)) isler.push({ tarih: t, platform: p, amac, urun }) })
  if (!isler.length) return NextResponse.json({ error: 'Bu ayın salı/perşembe günlerinde zaten gönderi var.' }, { status: 409 })

  const satirlar: any[] = []
  for (let i = 0; i < isler.length; i += 6) {
    await Promise.all(isler.slice(i, i + 6).map(async is => {
      try {
        const u = is.urun ? { name: String(is.urun.name).slice(0, 160), code: String(is.urun.code || '').slice(0, 40), category: String(is.urun.category || '').slice(0, 60), subcategory: String(is.urun.subcategory || '').slice(0, 60), description: String(is.urun.description || '').slice(0, 1500), specs: is.urun.specs && typeof is.urun.specs === 'object' ? Object.fromEntries(Object.entries(is.urun.specs).slice(0, 20).map(([k, v]) => [String(k).slice(0, 60), String(v).slice(0, 120)])) : {}, tags: Array.isArray(is.urun.tags) ? is.urun.tags.slice(0, 20).map((t: any) => String(t).slice(0, 40)) : [] } : undefined
        const [g] = await sosyalIcerikUret({ platform: is.platform, amac: is.amac, dil, adet: 1, urun: u, firma })
        if (!g) return
        const yonerge = is.urun
          ? `Professional product photo of "${is.urun.name}" by Alya Plastik (plastic planter / basket manufacturer), placed in a bright, tasteful modern home or garden setting, soft natural light, clean composition, premium look suitable for global B2B wholesale marketing on ${is.platform === 'linkedin' ? 'LinkedIn' : 'Instagram'}.`
          : `Clean, modern plastic manufacturing facility in Istanbul with neatly stacked colorful plastic planters and baskets, professional corporate photography, bright daylight, premium look suitable for global B2B wholesale marketing on ${is.platform === 'linkedin' ? 'LinkedIn' : 'Instagram'}.`
        satirlar.push({ baslik: g.baslik.slice(0, 160), platform: is.platform, metin: g.metin, hashtagler: g.hashtagler, urun_id: is.urun?.id || null, planlanan_tarih: is.tarih, planlanan_saat: SAAT[is.platform], durum: 'taslak', ai_uretildi: true, gorsel_yonerge: yonerge, created_by: y.user.id })
      } catch (e: any) { console.error('[sosyal-plan] üretim', e?.message) }
    }))
  }
  if (!satirlar.length) return NextResponse.json({ error: 'AI içerik üretemedi, tekrar deneyin.' }, { status: 502 })
  const { error } = await y.sb.from('sosyal_gonderiler').insert(satirlar)
  if (error) { console.error('[sosyal-plan] kayıt', error.message); return NextResponse.json({ error: 'Plan kaydedilemedi.' }, { status: 500 }) }
  return NextResponse.json({ ok: true, adet: satirlar.length, istenen: isler.length, gunler: gunler.length })
}
