import { NextRequest, NextResponse } from 'next/server'
import { modulGerekli } from '@/lib/yetki'
import { cariSablonOlustur, cariDisaAktarOlustur, cariSatirlariOku } from '@/lib/cari-excel'

export const maxDuration = 30

// Cari Hesaplar Excel şablon indirme + dışa aktarma. Yalnızca 'muhasebe' veya 'muhasebe_cari' modülü;
// veri kullanıcının kendi oturumuyla (RLS) okunur.
export async function GET(req: NextRequest) {
  const y = await modulGerekli(['muhasebe', 'muhasebe_cari']); if (y.hata) return y.hata
  const tip = new URL(req.url).searchParams.get('tip')
  try {
    const { data: fl } = await y.sb.from('fiyat_listeleri').select('id,ad').order('ad', { ascending: true })
    if (tip === 'disa') {
      const { data: cariler } = await y.sb.from('cari_hesaplar').select('*').order('ad', { ascending: true })
      const flAd = new Map((fl || []).map((f: any) => [f.id, f.ad]))
      const zenginlestirilmis = (cariler || []).map((c: any) => ({ ...c, fiyat_listesi_adi: c.fiyat_listesi_id ? flAd.get(c.fiyat_listesi_id) : '' }))
      const buf = await cariDisaAktarOlustur(zenginlestirilmis)
      return new NextResponse(buf as ArrayBuffer, { headers: { 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Content-Disposition': 'attachment; filename="cari-hesaplar.xlsx"', 'Cache-Control': 'no-store' } })
    }
    const buf = await cariSablonOlustur((fl || []).map((f: any) => f.ad))
    return new NextResponse(buf as ArrayBuffer, { headers: { 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Content-Disposition': 'attachment; filename="cari-hesaplar-sablon.xlsx"', 'Cache-Control': 'no-store' } })
  } catch (e: any) {
    console.error('[muhasebe-cari-excel][GET]', e); return NextResponse.json({ error: 'Excel dosyası oluşturulamadı.' }, { status: 500 })
  }
}

// İçe aktarma: önce onayla:false (veya boş) ile önizleme (kaç yeni / kaç güncelleme), sonra onayla:true ile yazma.
// Dosyada TEK bir hatalı satır bile varsa hiçbir kayıt eklenmez/güncellenmez (tüm-ya-da-hiç).
export async function POST(req: NextRequest) {
  const y = await modulGerekli(['muhasebe', 'muhasebe_cari']); if (y.hata) return y.hata
  let body: any
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Geçersiz istek' }, { status: 400 }) }
  if (typeof body?.b64 !== 'string' || body.b64.length < 50) return NextResponse.json({ error: 'Dosya verisi geçersiz' }, { status: 400 })

  let buf: Buffer
  try { buf = Buffer.from(body.b64, 'base64') } catch { return NextResponse.json({ error: 'Dosya çözümlenemedi' }, { status: 400 }) }
  if (buf.length > 8 * 1024 * 1024) return NextResponse.json({ error: 'Dosya çok büyük (8MB üstü)' }, { status: 400 })

  try {
    const { data: fl } = await y.sb.from('fiyat_listeleri').select('id,ad')
    const sonuc = await cariSatirlariOku(buf, fl || [])
    if ('hata' in sonuc) return NextResponse.json({ ok: false, hatalar: sonuc.hata }, { status: 200 })

    if (!body.onayla) {
      const { data: mevcut } = await y.sb.from('cari_hesaplar').select('kod')
      const kodSeti = new Set((mevcut || []).filter((c: any) => c.kod).map((c: any) => String(c.kod).toUpperCase()))
      const guncelleme = sonuc.satirlar.filter(s => s.kod && kodSeti.has(s.kod)).length
      return NextResponse.json({ ok: true, onizle: { toplam: sonuc.satirlar.length, yeni: sonuc.satirlar.length - guncelleme, guncelleme } })
    }

    // Tek bir Postgres fonksiyonu (transaction) içinde toplu ekle/güncelle — herhangi bir satır DB seviyesinde
    // başarısız olursa (örn. kısıt ihlali) TÜM işlem geri alınır, kısmi yazım olmaz.
    const { data, error } = await y.sb.rpc('rpc_cari_toplu_iceaktar', { p_satirlar: sonuc.satirlar })
    if (error) return NextResponse.json({ ok: false, hatalar: [{ satir: 0, mesaj: `İçe aktarma başarısız oldu: ${error.message}` }] }, { status: 200 })
    const r = Array.isArray(data) ? data[0] : data
    return NextResponse.json({ ok: true, eklenen: r?.eklenen ?? 0, guncellenen: r?.guncellenen ?? 0 })
  } catch (e: any) {
    console.error('[muhasebe-cari-excel][POST]', e); return NextResponse.json({ error: 'İçe aktarma başarısız oldu.' }, { status: 500 })
  }
}
