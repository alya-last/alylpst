import { NextRequest, NextResponse } from 'next/server'
import { modulGerekli } from '@/lib/yetki'
import { oranSiniri } from '@/lib/rate-limit'
import { sendEmail } from '@/lib/notify'
import { epostaGecerli, siparisMetni, telefonNormalize } from '@/lib/satinalma-mesaj'

export const maxDuration = 30

// Satınalma siparişini / teslim hatırlatmasını tedarikçiye gönderir.
//  kanal 'email'    : SMTP ile tedarikçi carisindeki e-postaya gönderilir (SMTP tanımlı değilse 503).
//  kanal 'whatsapp' : wa.me bağlantısı (hazır metinle) döner; mesajı kullanıcı kendi WhatsApp'ından gönderir.
// Alıcı adresi/numarası istemciden alınmaz; yalnızca siparişin tedarikçi kartından okunur.
export async function POST(req: NextRequest) {
  const y = await modulGerekli(['satinalma']); if (y.hata) return y.hata
  if (!(await oranSiniri(`sagonder:${y.user.id}`, 40, 3600, false))) return NextResponse.json({ error: 'Saatlik gönderim sınırına ulaşıldı.' }, { status: 429 })
  let b: any; try { b = await req.json() } catch { return NextResponse.json({ error: 'Geçersiz istek' }, { status: 400 }) }
  const id = String(b?.id || ''), kanal = b?.kanal, sablon = b?.sablon === 'hatirlatma' ? 'hatirlatma' : 'siparis'
  if (!/^[0-9a-f-]{36}$/.test(id) || !['email', 'whatsapp'].includes(kanal)) return NextResponse.json({ error: 'Geçersiz istek' }, { status: 400 })

  const { data: s } = await y.sb.from('satinalma_siparisleri').select('id,no,tarih,beklenen_teslim,para_birimi,notlar,durum,tedarikci_id').eq('id', id).maybeSingle()
  if (!s) return NextResponse.json({ error: 'Sipariş bulunamadı' }, { status: 404 })
  if (s.durum === 'iptal') return NextResponse.json({ error: 'İptal edilmiş sipariş gönderilemez' }, { status: 409 })
  if (!s.tedarikci_id) return NextResponse.json({ error: 'Siparişte tedarikçi seçili değil' }, { status: 409 })
  const [{ data: c }, { data: ks }, { data: st }] = await Promise.all([
    y.sb.from('cari_hesaplar').select('ad,email,telefon').eq('id', s.tedarikci_id).maybeSingle(),
    y.sb.from('satinalma_siparisi_kalemleri').select('hammadde_id,miktar,birim_fiyat,teslim_alinan_miktar').eq('siparis_id', id),
    y.sb.from('settings').select('value').eq('key', 'site').maybeSingle(),
  ])
  if (!c) return NextResponse.json({ error: 'Tedarikçi kartı okunamadı' }, { status: 404 })
  const ids = (ks || []).map((k: any) => k.hammadde_id).filter(Boolean)
  const { data: hm } = ids.length ? await y.sb.from('hammaddeler').select('id,ad,birim').in('id', ids) : { data: [] as any[] }
  const hh = new Map((hm || []).map((h: any) => [h.id, h]))
  const firma = st?.value?.company || 'Alya Plastik'
  const { konu, metin } = siparisMetni({ sablon, firma, tedarikci: c.ad, siparis: s, bugun: new Date(Date.now() + 3 * 3600e3).toISOString().slice(0, 10),
    kalemler: (ks || []).map((k: any) => ({ ad: hh.get(k.hammadde_id)?.ad || 'Hammadde', birim: hh.get(k.hammadde_id)?.birim, miktar: +k.miktar || 0, teslim: +k.teslim_alinan_miktar || 0, birim_fiyat: +k.birim_fiyat || 0 })) })

  let sonuc: Record<string, unknown> = {}
  if (kanal === 'email') {
    if (!epostaGecerli(c.email)) return NextResponse.json({ error: `“${c.ad}” carisinde geçerli bir e-posta adresi yok; cari kartına ekleyin.` }, { status: 409 })
    if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) return NextResponse.json({ error: 'E-posta gönderimi yapılandırılmamış (SMTP_HOST, SMTP_USER, SMTP_PASS). WhatsApp veya yazdırma kullanabilirsiniz.' }, { status: 503 })
    try { await sendEmail(String(c.email).trim(), konu, metin) } catch (e: any) { console.error('[satinalma-gonder] e-posta', e?.message); return NextResponse.json({ error: 'E-posta gönderilemedi (SMTP hatası).' }, { status: 502 }) }
    sonuc = { alici: String(c.email).trim() }
  } else {
    const tel = telefonNormalize(c.telefon)
    if (!tel) return NextResponse.json({ error: `“${c.ad}” carisinde geçerli bir telefon yok (05xx… biçiminde ekleyin).` }, { status: 409 })
    sonuc = { url: `https://wa.me/${tel}?text=${encodeURIComponent(metin)}` }
  }
  await y.sb.from('satinalma_siparisleri').update({ gonderildi_at: new Date().toISOString(), gonderim_sayisi: 1 + (Number(b?.onceki) || 0) }).eq('id', id)
  return NextResponse.json({ ok: true, ...sonuc })
}
