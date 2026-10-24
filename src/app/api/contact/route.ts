import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse, after } from 'next/server'
import { notify, supabaseAdmin } from '@/lib/notify'
import { oranSiniri, istemciIp } from '@/lib/rate-limit'
import { aiAktif } from '@/lib/ai'
import { basvuruAnalizKaydet, type BasvuruAnaliz } from '@/lib/ai-basvuru'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
const SUBJECTS = new Set(['Ürün Bilgisi', 'Fiyat Talebi', 'İhracat', 'Katalog', 'Özel Kalıp', 'Diğer'])

// Yalnızca bilinen alanları alır, tipleri ve uzunlukları doğrular (rastgele kolon/devasa metin yazımını engeller).
function temizle(body: unknown) {
  if (!body || typeof body !== 'object') return { hata: 'Geçersiz istek.' }
  const b = body as Record<string, unknown>
  const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '')

  const name = str(b.name, 120)
  const email = str(b.email, 200)
  const message = str(b.message, 4000)
  if (!name) return { hata: 'Ad Soyad gerekli.' }
  if (!EMAIL_RE.test(email)) return { hata: 'Geçerli bir e-posta girin.' }
  if (!message) return { hata: 'Mesaj gerekli.' }

  const subject = str(b.subject, 60)
  return {
    veri: {
      name,
      company: str(b.company, 160) || null,
      email,
      phone: str(b.phone, 40) || null,
      subject: SUBJECTS.has(subject) ? subject : null,
      product: str(b.product, 160) || null,
      message,
    },
  }
}

export async function POST(req: NextRequest) {
  let body: unknown
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Geçersiz istek.' }, { status: 400 }) }

  const { veri, hata } = temizle(body)
  if (hata || !veri) return NextResponse.json({ error: hata }, { status: 400 })

  // DB tabanlı oran sınırı: aynı IP saatte en fazla 5 gönderim (spam/DDoS koruması).
  if (!(await oranSiniri(`contact:${istemciIp(req)}`, 5, 3600, false))) {
    return NextResponse.json({ error: 'Çok fazla istek gönderildi, lütfen daha sonra tekrar deneyin.' }, { status: 429 })
  }

  // Kayıt id'sini geri almak için service_role ile eklenir (anon için SELECT politikası yok); yoksa anon'a düşer.
  let id: string | null = null
  try {
    const { data, error } = await supabaseAdmin().from('contact_submissions').insert(veri).select('id').single()
    if (error) throw error
    id = data?.id ?? null
  } catch (e: any) {
    console.error('[contact] service_role kaydı başarısız, anon deneniyor:', e?.message)
    const anon = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!)
    const { error } = await anon.from('contact_submissions').insert(veri)
    if (error) {
      console.error('[contact] kayıt hatası:', error.message)
      return NextResponse.json({ error: 'Mesaj kaydedilemedi, lütfen tekrar deneyin.' }, { status: 500 })
    }
  }

  // Yanıtı geciktirmeden: AI analizi (varsa) + bildirim (e-posta / WhatsApp)
  after(async () => {
    let ai: BasvuruAnaliz | null = null
    if (aiAktif() && id) {
      try { ai = await basvuruAnalizKaydet(id, veri) } catch (e: any) { console.error('[contact] AI analiz hatası:', e?.message) }
    }
    await notify(
      'new_contact',
      `${ai?.spam ? '[Şüpheli] ' : ai?.oncelik === 'yuksek' ? '[Öncelikli] ' : ''}Yeni başvuru: ${veri.name}`,
      [
        'Alya Plastik sitesinden yeni iletişim formu geldi.',
        ...(ai ? [`AI özeti: ${ai.ozet} (${ai.kategori}, öncelik: ${ai.oncelik})`] : []),
        `Ad: ${veri.name}`,
        `Firma: ${veri.company ?? '-'}`,
        `E-posta: ${veri.email}`,
        `Telefon: ${veri.phone ?? '-'}`,
        `Konu: ${veri.subject ?? '-'}`,
        ...(veri.product ? [`Ürün: ${veri.product}`] : []),
        `Mesaj: ${veri.message}`,
      ].join('\n'),
      { name: veri.name, email: veri.email, phone: veri.phone },
    )
  })
  return NextResponse.json({ ok: true })
}
