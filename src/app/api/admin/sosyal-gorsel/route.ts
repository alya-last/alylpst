import { NextRequest, NextResponse } from 'next/server'
import { modulGerekli } from '@/lib/yetki'
import { oranSiniri } from '@/lib/rate-limit'
import { supabaseAdmin } from '@/lib/notify'
import { AiHata } from '@/lib/ai'
import { FORMAT, sosyalGorselUret, type SosyalFormat } from '@/lib/sosyal-yayin'

export const maxDuration = 60
const BUCKET = 'sosyal-gorseller'
const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

async function imzali(yol: string | null) {
  if (!yol) return null
  const { data } = await supabaseAdmin().storage.from(BUCKET).createSignedUrl(yol, 3600)
  return data?.signedUrl || null
}

// GET ?id= → kayıtlı görselin 1 saatlik imzalı önizleme adresi (bucket özeldir)
export async function GET(req: NextRequest) {
  const y = await modulGerekli(['sosyal', 'yonetim']); if (y.hata) return y.hata
  const id = req.nextUrl.searchParams.get('id') || ''
  if (!ID.test(id)) return NextResponse.json({ error: 'id geçersiz' }, { status: 400 })
  const { data: r } = await y.sb.from('sosyal_gonderiler').select('gorsel_yol,gorsel_yonerge').eq('id', id).maybeSingle()
  if (!r) return NextResponse.json({ error: 'Gönderi bulunamadı' }, { status: 404 })
  return NextResponse.json({ url: await imzali(r.gorsel_yol), yonerge: r.gorsel_yonerge || '' }, { headers: { 'Cache-Control': 'no-store' } })
}

// POST {id, yonerge, format} → ChatGPT ile görsel üretir, özel bucket'a kaydeder (gönderide ürün seçiliyse ürün fotoğrafı referans alınır)
export async function POST(req: NextRequest) {
  const y = await modulGerekli(['sosyal', 'yonetim']); if (y.hata) return y.hata
  if (!(await oranSiniri(`sosyalgorsel:${y.user.id}`, 25, 3600, false))) return NextResponse.json({ error: 'Saatlik görsel üretim sınırına ulaşıldı.' }, { status: 429 })
  let b: any; try { b = await req.json() } catch { return NextResponse.json({ error: 'Geçersiz istek' }, { status: 400 }) }
  const id = String(b?.id || ''), yonerge = String(b?.yonerge || '').trim().slice(0, 1500), format = String(b?.format || '') as SosyalFormat
  if (!ID.test(id)) return NextResponse.json({ error: 'id geçersiz' }, { status: 400 })
  if (yonerge.length < 10) return NextResponse.json({ error: 'Görsel yönergesi en az 10 karakter olmalı.' }, { status: 400 })
  if (!(format in FORMAT)) return NextResponse.json({ error: 'Format geçersiz' }, { status: 400 })
  const { data: r } = await y.sb.from('sosyal_gonderiler').select('id,gorsel_yol,urun_id,products(image_url,images)').eq('id', id).maybeSingle()
  if (!r) return NextResponse.json({ error: 'Gönderi bulunamadı' }, { status: 404 })
  const p: any = Array.isArray((r as any).products) ? (r as any).products[0] : (r as any).products
  const kaynak = [p?.image_url, ...(p?.images || [])].find((u: any) => typeof u === 'string' && /^https:\/\//.test(u)) || null
  try {
    const png = await sosyalGorselUret(yonerge, format, kaynak)
    const sb = supabaseAdmin(), yol = `${id}/${Date.now()}.png`
    const { error } = await sb.storage.from(BUCKET).upload(yol, png, { contentType: 'image/png', upsert: false })
    if (error) { console.error('[sosyal-gorsel] yükleme', error.message); return NextResponse.json({ error: 'Görsel kaydedilemedi.' }, { status: 500 }) }
    if (r.gorsel_yol) await sb.storage.from(BUCKET).remove([r.gorsel_yol]).catch(() => {})
    const { error: ue } = await y.sb.from('sosyal_gonderiler').update({ gorsel_yol: yol, gorsel_yonerge: yonerge, updated_at: new Date().toISOString() }).eq('id', id)
    if (ue) return NextResponse.json({ error: 'Görsel gönderiye bağlanamadı.' }, { status: 500 })
    return NextResponse.json({ ok: true, url: await imzali(yol), urun_referansli: !!kaynak })
  } catch (e: any) {
    if (e instanceof AiHata) return NextResponse.json({ error: e.message }, { status: e.durum || 502 })
    console.error('[sosyal-gorsel]', e?.message)
    return NextResponse.json({ error: 'Görsel üretilemedi.' }, { status: 500 })
  }
}
