import crypto from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/notify'
import { istemciIp, oranSiniri } from '@/lib/rate-limit'

export const maxDuration = 15

// Kapıdaki kiosk tabletinin QR okutma ucu. Oturum yerine CİHAZ ANAHTARI kullanılır (x-kiosk-key); anahtarın yalnızca
// SHA-256 özeti veritabanında saklanır ve yönetici panelinden iptal edilebilir. Yazma işlemi service_role ile yapılır.
const QR_RE = /^ALYA1:([a-f0-9]{64})$/
const hash = (k: string) => crypto.createHash('sha256').update(k).digest('hex')

export async function POST(req: NextRequest) {
  const ip = istemciIp(req)
  if (!(await oranSiniri(`kioskip:${ip}`, 300, 600, false))) return NextResponse.json({ error: 'Çok fazla istek.' }, { status: 429 })

  const anahtar = req.headers.get('x-kiosk-key') || ''
  if (!/^[a-f0-9]{64}$/.test(anahtar)) return NextResponse.json({ error: 'Cihaz yetkili değil.' }, { status: 401 })

  const sb = supabaseAdmin()
  const { data: cihaz } = await sb.from('personel_kiosklari').select('id,aktif').eq('anahtar_hash', hash(anahtar)).maybeSingle()
  if (!cihaz || !cihaz.aktif) {
    // Başarısız anahtar denemelerini say (deneme-yanılma koruması)
    if (!(await oranSiniri(`kioskhata:${ip}`, 15, 600, false))) return NextResponse.json({ error: 'Çok fazla hatalı deneme.' }, { status: 429 })
    return NextResponse.json({ error: 'Cihaz yetkili değil.' }, { status: 401 })
  }
  if (!(await oranSiniri(`kiosk:${cihaz.id}`, 90, 60, false))) return NextResponse.json({ error: 'Çok hızlı okutma, biraz bekleyin.' }, { status: 429 })

  let body: any
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Geçersiz istek.' }, { status: 400 }) }
  const m = QR_RE.exec(String(body?.qr || ''))
  if (!m) return NextResponse.json({ durum: 'hata', mesaj: 'Bu bir personel kartı değil.' }, { status: 200 })

  const { data: p } = await sb.from('personel').select('id,ad_soyad,sicil_no,aktif,isten_cikis').eq('qr_token', m[1]).maybeSingle()
  if (!p) return NextResponse.json({ durum: 'hata', mesaj: 'Kart tanınmadı (iptal edilmiş olabilir).' })
  const bugun = new Date(Date.now() + 3 * 3600e3).toISOString().slice(0, 10)
  if (!p.aktif || (p.isten_cikis && p.isten_cikis < bugun)) return NextResponse.json({ durum: 'hata', mesaj: 'Personel kaydı pasif. Yöneticiye başvurun.', ad_soyad: p.ad_soyad })

  const [{ data: ayar }, { data: son }] = await Promise.all([
    sb.from('personel_ayarlari').select('cift_okutma_sn,unutulan_cikis_saat').eq('id', 1).maybeSingle(),
    sb.from('personel_hareketleri').select('yon,zaman').eq('personel_id', p.id).order('zaman', { ascending: false }).limit(1).maybeSingle(),
  ])
  const cooldown = (ayar?.cift_okutma_sn ?? 60) * 1000, unutulan = (ayar?.unutulan_cikis_saat ?? 16) * 3600e3
  const simdi = Date.now()
  if (son && simdi - Date.parse(son.zaman) < cooldown) return NextResponse.json({ durum: 'tekrar', mesaj: 'Az önce okutuldunuz.', ad_soyad: p.ad_soyad, sicil_no: p.sicil_no, yon: son.yon })

  let yon: 'giris' | 'cikis' = !son || son.yon === 'cikis' ? 'giris' : 'cikis'
  let uyari: string | undefined
  if (son && son.yon === 'giris' && simdi - Date.parse(son.zaman) > unutulan) { yon = 'giris'; uyari = 'Önceki çıkışınız kaydedilmemiş; yöneticinize bildirin.' }

  const { error } = await sb.from('personel_hareketleri').insert({ personel_id: p.id, yon, kaynak: 'kiosk', kiosk_id: cihaz.id })
  if (error) { console.error('[kiosk] kayıt hatası', error.message); return NextResponse.json({ durum: 'hata', mesaj: 'Kayıt yapılamadı, tekrar okutun.' }, { status: 500 }) }
  await sb.from('personel_kiosklari').update({ son_gorulme: new Date().toISOString() }).eq('id', cihaz.id)

  return NextResponse.json({ durum: 'ok', yon, ad_soyad: p.ad_soyad, sicil_no: p.sicil_no, zaman: new Date(simdi).toISOString(), mesaj: yon === 'giris' ? 'Hoş geldiniz' : 'İyi günler', uyari })
}
