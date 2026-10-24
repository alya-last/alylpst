import { NextRequest, NextResponse } from 'next/server'
import { modulGerekli } from '@/lib/yetki'
import { oranSiniri } from '@/lib/rate-limit'
import { aiAktif, AiHata } from '@/lib/ai'
import { basvuruAnalizKaydet } from '@/lib/ai-basvuru'
import { sosyalIcerikUret, AMACLAR } from '@/lib/ai-sosyal'
import { teklifKalemOner } from '@/lib/ai-teklif'
import { genelAsistanYanit } from '@/lib/ai-birim'
import { belgeOku, kartvizitOku, ekstreOner, gorselAnalizEt, haftalikOzet, urunMetniUret, type Konusma } from '@/lib/ai-admin'
import { gorselTasarla, type GorselStil } from '@/lib/ai-gorsel'
import { gorunum360Uret } from '@/lib/ai-360'
import { TEMA_ALAN_ANAHTARLARI } from '@/data/images'
import { supabaseAdmin } from '@/lib/notify'
import { gorselSikistir } from '@/lib/gorsel-sikistir'

export const maxDuration = 60 // Vercel Hobby plan üst sınırı

// Yönetici paneli AI uçları. Her eylem kendi modül yetkisini ister; veriye erişen eylemler
// kullanıcının kendi oturumuyla (RLS + rpc_* içindeki yetki kontrolü) çalışır.
const YETKI: Record<string, string[]> = {
  urun_metin: ['yonetim'],
  sosyal_icerik: ['sosyal', 'yonetim'],
  teklif_kalem_oner: ['satis', 'yonetim'],
  gorsel_analiz: ['yonetim'],
  urun_gorsel_tasarim: ['yonetim'],
  urun_gorsel_kaydet: ['yonetim'],
  varyant_gorsel_kaydet: ['yonetim'],
  urun_360_uret: ['yonetim'],
  urun_360_kaydet: ['yonetim'],
  tema_gorsel_yukle: ['yonetim'],
  gorsel_toplu_sikistir: ['yonetim'],
  basvuru_analiz: ['dashboard'],
  asistan: [],                      // her personel; veri erişimi zaten RLS ile sınırlı
  ozet: [],                         // yalnızca yetkili olduğu modüllerin verisi kullanılır
  ekstre_oner: ['muhasebe'],
  belge_oku: ['muhasebe', 'satinalma', 'stok'],
  kartvizit_oku: ['satis', 'yonetim'],
}

export async function GET() {
  const y = await modulGerekli(); if (y.hata) return y.hata
  return NextResponse.json({ aktif: aiAktif() })
}

export async function POST(req: NextRequest) {
  let body: any
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Geçersiz istek' }, { status: 400 }) }
  const action = String(body?.action || '')
  if (!(action in YETKI)) return NextResponse.json({ error: 'Geçersiz eylem' }, { status: 400 })

  const y = await modulGerekli(YETKI[action]); if (y.hata) return y.hata
  // gorsel_toplu_sikistir OpenAI kullanmaz (yalnızca Storage'daki mevcut dosyaları sıkıştırır) — AI anahtarı gerektirmez.
  if (action !== 'gorsel_toplu_sikistir' && !aiAktif()) return NextResponse.json({ error: 'AI özelliği henüz yapılandırılmamış (OPENAI_API_KEY).', kapali: true }, { status: 503 })

  // Kullanıcı başına saatlik sınır (maliyet koruması)
  if (!(await oranSiniri(`ai:${y.user.id}`, 80, 3600, false))) return NextResponse.json({ error: 'Saatlik AI kullanım sınırına ulaştın, biraz sonra tekrar dene.' }, { status: 429 })

  try {
    switch (action) {
      case 'urun_metin': {
        const p = body.urun || {}
        if (!p.name || typeof p.name !== 'string') return NextResponse.json({ error: 'Ürün adı gerekli' }, { status: 400 })
        const specs = p.specs && typeof p.specs === 'object' ? Object.fromEntries(Object.entries(p.specs).slice(0, 20).map(([k, v]) => [String(k).slice(0, 60), String(v).slice(0, 120)])) : {}
        const r = await urunMetniUret({
          name: p.name.slice(0, 160), code: String(p.code || '').slice(0, 40), category: String(p.category || '').slice(0, 60), subcategory: String(p.subcategory || '').slice(0, 60),
          specs, tags: Array.isArray(p.tags) ? p.tags.slice(0, 20).map((t: any) => String(t).slice(0, 40)) : [], description: String(p.description || '').slice(0, 1500), image_url: typeof p.image_url === 'string' ? p.image_url : undefined,
        })
        return NextResponse.json({ ok: true, sonuc: r })
      }
      case 'sosyal_icerik': {
        const platform = ['linkedin', 'instagram', 'facebook'].includes(body.platform) ? body.platform : null
        if (!platform) return NextResponse.json({ error: 'Platform geçersiz' }, { status: 400 })
        const amac = typeof body.amac === 'string' && body.amac in AMACLAR ? body.amac : 'urun'
        let urun: any
        if (body.urun_id) {
          if (typeof body.urun_id !== 'string' || !/^[0-9a-f-]{36}$/.test(body.urun_id)) return NextResponse.json({ error: 'Ürün geçersiz' }, { status: 400 })
          const { data } = await y.sb.from('products').select('name,code,category,subcategory,description,specs,tags').eq('id', body.urun_id).maybeSingle()
          if (!data) return NextResponse.json({ error: 'Ürün bulunamadı' }, { status: 404 })
          urun = { ...data, specs: data.specs && typeof data.specs === 'object' ? Object.fromEntries(Object.entries(data.specs).slice(0, 20).map(([k, v]) => [String(k).slice(0, 60), String(v).slice(0, 120)])) : {}, description: String(data.description || '').slice(0, 1200) }
        }
        const { data: st } = await y.sb.from('settings').select('key,value').in('key', ['site', 'stats', 'export_countries'])
        const m = Object.fromEntries((st || []).map((r: any) => [r.key, r.value]))
        const firma = { sirket: m.site?.company, kurulus_yili: m.site?.founded, adres: m.site?.address, e_posta: m.site?.email, ihracat_e_posta: m.site?.export_email, telefon: m.site?.phone, ihracat_ulkeleri: Array.isArray(m.export_countries) ? m.export_countries.slice(0, 30).join(', ') : undefined, model_sayisi: m.stats?.models, ihracat_ulke_sayisi: m.stats?.countries }
        const sonuc = await sosyalIcerikUret({ platform, amac, dil: body.dil === 'en' ? 'en' : 'tr', adet: Number(body.adet) || 1, urun, firma, not: typeof body.not === 'string' ? body.not.slice(0, 600) : undefined })
        return NextResponse.json({ ok: true, sonuc })
      }
      case 'teklif_kalem_oner': {
        let mesaj = typeof body.metin === 'string' ? body.metin.slice(0, 3000) : ''
        if (body.basvuru_id) {
          if (typeof body.basvuru_id !== 'string' || !/^[0-9a-f-]{36}$/.test(body.basvuru_id)) return NextResponse.json({ error: 'Başvuru geçersiz' }, { status: 400 })
          const { data: b } = await y.sb.from('contact_submissions').select('name,company,subject,product,message').eq('id', body.basvuru_id).maybeSingle()
          if (!b) return NextResponse.json({ error: 'Başvuru bulunamadı' }, { status: 404 })
          mesaj = [b.subject && `Konu: ${b.subject}`, b.product && `İlgilendiği ürün: ${b.product}`, b.message].filter(Boolean).join('\n').slice(0, 3000)
        }
        if (mesaj.trim().length < 5) return NextResponse.json({ error: 'Analiz edilecek metin yok' }, { status: 400 })
        const [v, p] = await Promise.all([y.sb.from('product_variants').select('id,product_id,name,color,size').limit(3000), y.sb.from('products').select('id,name').limit(3000)])
        const pn = new Map((p.data || []).map((x: any) => [x.id, x.name]))
        const katalog = (v.data || []).map((x: any) => ({ id: x.id, label: [pn.get(x.product_id), x.name, x.color, x.size].filter(Boolean).filter((a: any, i: number, arr: any[]) => arr.indexOf(a) === i).join(' · ') || x.name }))
        return NextResponse.json({ ok: true, sonuc: await teklifKalemOner(mesaj, katalog), katalogBos: katalog.length === 0 })
      }
      case 'gorsel_analiz': {
        if (typeof body.url !== 'string') return NextResponse.json({ error: 'Görsel adresi gerekli' }, { status: 400 })
        return NextResponse.json({ ok: true, sonuc: await gorselAnalizEt(body.url, body.ad) })
      }
      case 'urun_gorsel_tasarim': {
        if (typeof body.url !== 'string') return NextResponse.json({ error: 'Görsel adresi gerekli' }, { status: 400 })
        const stil: GorselStil = body.stil === 'yasam' ? 'yasam' : 'studyo'
        // Görsel üretimi metin isteklerinden çok daha maliyetli — ayrı, daha dar bir saatlik sınır
        // (toplu tasarım akışı da bu eylemi kullanır, bu yüzden makul bir toplu iş payı bırakılmıştır)
        if (!(await oranSiniri(`ai_gorsel:${y.user.id}`, 30, 3600, false))) return NextResponse.json({ error: 'Görsel üretimi için saatlik sınıra ulaştın, biraz sonra tekrar dene.' }, { status: 429 })
        const b64 = await gorselTasarla(body.url, stil)
        return NextResponse.json({ ok: true, b64, stil })
      }
      case 'urun_gorsel_kaydet': {
        if (typeof body.urun_id !== 'string' || !/^[0-9a-f-]{36}$/.test(body.urun_id)) return NextResponse.json({ error: 'Ürün geçersiz' }, { status: 400 })
        if (typeof body.b64 !== 'string' || body.b64.length < 100) return NextResponse.json({ error: 'Görsel verisi geçersiz' }, { status: 400 })
        // Ürünün bu kullanıcıya görünür olduğunu kendi oturumuyla (RLS) doğrula, sonra service_role ile yaz
        const { data: urun } = await y.sb.from('products').select('id,image_url,images').eq('id', body.urun_id).maybeSingle()
        if (!urun) return NextResponse.json({ error: 'Ürün bulunamadı' }, { status: 404 })
        let bytes: Buffer
        try { bytes = Buffer.from(body.b64, 'base64') } catch { return NextResponse.json({ error: 'Görsel çözümlenemedi' }, { status: 400 }) }
        if (!bytes.length || bytes.length > 15 * 1024 * 1024) return NextResponse.json({ error: 'Görsel boyutu geçersiz' }, { status: 400 })
        const admin = supabaseAdmin()
        const sik = await gorselSikistir(bytes, 1200)
        const yol = `${body.urun_id}/${Date.now()}.webp`
        const up = await admin.storage.from('urun-gorselleri').upload(yol, sik.bytes, { contentType: sik.contentType, upsert: false })
        if (up.error) { console.error('[urun_gorsel_kaydet] upload', up.error.message); return NextResponse.json({ error: 'Görsel depoya yüklenemedi.' }, { status: 502 }) }
        const { data: pub } = admin.storage.from('urun-gorselleri').getPublicUrl(yol)
        const eskiGorsel: string | null = urun.image_url || null
        const yeniImages = eskiGorsel && eskiGorsel !== pub.publicUrl ? Array.from(new Set([...(urun.images || []), eskiGorsel])) : (urun.images || [])
        const { error } = await admin.from('products').update({ image_url: pub.publicUrl, images: yeniImages, updated_at: new Date().toISOString() }).eq('id', body.urun_id)
        if (error) { console.error('[urun_gorsel_kaydet] update', error.message); return NextResponse.json({ error: 'Ürün güncellenemedi.' }, { status: 500 }) }
        return NextResponse.json({ ok: true, url: pub.publicUrl })
      }
      case 'varyant_gorsel_kaydet': {
        // Bir varyantın renk fotoğrafını AI ile yeniden tasarlanmış (stüdyo/yaşam alanı) haliyle değiştirir.
        // Üretim 'urun_gorsel_tasarim' eylemiyle aynıdır (yalnızca arka plan değişir, renk/şekil korunur);
        // burada yalnızca onaylanan sonuç Storage'a yüklenip product_variants.gorsel güncellenir.
        // products.renkler önbelleği trg_urun_renk_senkron trigger'ı ile otomatik senkronlanır.
        if (typeof body.variant_id !== 'string' || !/^[0-9a-f-]{36}$/.test(body.variant_id)) return NextResponse.json({ error: 'Varyant geçersiz' }, { status: 400 })
        if (typeof body.b64 !== 'string' || body.b64.length < 100) return NextResponse.json({ error: 'Görsel verisi geçersiz' }, { status: 400 })
        // Varyantın bu kullanıcıya görünür olduğunu kendi oturumuyla (RLS) doğrula, sonra service_role ile yaz
        const { data: varyant } = await y.sb.from('product_variants').select('id,product_id').eq('id', body.variant_id).maybeSingle()
        if (!varyant) return NextResponse.json({ error: 'Varyant bulunamadı' }, { status: 404 })
        let bytes: Buffer
        try { bytes = Buffer.from(body.b64, 'base64') } catch { return NextResponse.json({ error: 'Görsel çözümlenemedi' }, { status: 400 }) }
        if (!bytes.length || bytes.length > 15 * 1024 * 1024) return NextResponse.json({ error: 'Görsel boyutu geçersiz' }, { status: 400 })
        const admin = supabaseAdmin()
        const sik = await gorselSikistir(bytes, 1200)
        const yol = `renkler/${varyant.product_id}/varyant-${varyant.id}-${Date.now()}.webp`
        const up = await admin.storage.from('urun-gorselleri').upload(yol, sik.bytes, { contentType: sik.contentType, upsert: false })
        if (up.error) { console.error('[varyant_gorsel_kaydet] upload', up.error.message); return NextResponse.json({ error: 'Görsel depoya yüklenemedi.' }, { status: 502 }) }
        const { data: pub } = admin.storage.from('urun-gorselleri').getPublicUrl(yol)
        const { error } = await admin.from('product_variants').update({ gorsel: pub.publicUrl }).eq('id', body.variant_id)
        if (error) { console.error('[varyant_gorsel_kaydet] update', error.message); return NextResponse.json({ error: 'Varyant güncellenemedi.' }, { status: 500 }) }
        return NextResponse.json({ ok: true, url: pub.publicUrl })
      }
      case 'urun_360_uret': {
        if (typeof body.url !== 'string') return NextResponse.json({ error: 'Görsel adresi gerekli' }, { status: 400 })
        const kareSayisi = body.kareSayisi === 4 ? 4 : body.kareSayisi === 16 ? 16 : 8
        // 7-15 kareyi tek istekte paralel üretmek görsel üretiminden de maliyetli — daha dar bir saatlik sınır
        if (!(await oranSiniri(`ai_360:${y.user.id}`, 6, 3600, false))) return NextResponse.json({ error: '360° görünüm üretimi için saatlik sınıra ulaştın, biraz sonra tekrar dene.' }, { status: 429 })
        const sonuc = await gorunum360Uret(body.url, kareSayisi)
        return NextResponse.json({ ok: true, kareler: sonuc.kareler, basarisiz: sonuc.basarisiz })
      }
      case 'urun_360_kaydet': {
        if (typeof body.urun_id !== 'string' || !/^[0-9a-f-]{36}$/.test(body.urun_id)) return NextResponse.json({ error: 'Ürün geçersiz' }, { status: 400 })
        const kareler: string[] = Array.isArray(body.kareler) ? body.kareler : []
        if (kareler.length < 2 || !kareler.every(k => typeof k === 'string' && k.length > 100)) return NextResponse.json({ error: 'Kare verisi geçersiz' }, { status: 400 })
        // Ürünün bu kullanıcıya görünür olduğunu kendi oturumuyla (RLS) doğrula, sonra service_role ile yaz
        const { data: urun } = await y.sb.from('products').select('id').eq('id', body.urun_id).maybeSingle()
        if (!urun) return NextResponse.json({ error: 'Ürün bulunamadı' }, { status: 404 })
        const admin = supabaseAdmin()
        const damga = Date.now()
        const urls: string[] = []
        for (let i = 0; i < kareler.length; i++) {
          let bytes: Buffer
          try { bytes = Buffer.from(kareler[i], 'base64') } catch { return NextResponse.json({ error: `Kare ${i + 1} çözümlenemedi` }, { status: 400 }) }
          if (!bytes.length || bytes.length > 15 * 1024 * 1024) return NextResponse.json({ error: `Kare ${i + 1} boyutu geçersiz` }, { status: 400 })
          const sik = await gorselSikistir(bytes, 1000)
          const yol = `${body.urun_id}/360-${damga}/${i}.webp`
          const up = await admin.storage.from('urun-gorselleri').upload(yol, sik.bytes, { contentType: sik.contentType, upsert: false })
          if (up.error) { console.error('[urun_360_kaydet] upload', i, up.error.message); return NextResponse.json({ error: 'Kareler depoya yüklenemedi.' }, { status: 502 }) }
          const { data: pub } = admin.storage.from('urun-gorselleri').getPublicUrl(yol)
          urls.push(pub.publicUrl)
        }
        const { error } = await admin.from('products').update({ gorunum_360: urls, updated_at: new Date().toISOString() }).eq('id', body.urun_id)
        if (error) { console.error('[urun_360_kaydet] update', error.message); return NextResponse.json({ error: 'Ürün güncellenemedi.' }, { status: 500 }) }
        return NextResponse.json({ ok: true, urls })
      }
      case 'tema_gorsel_yukle': {
        // AI üretimi 'urun_gorsel_tasarim' eylemiyle aynı — burada yalnızca onaylanan sonucu Storage'a yükleyip URL döner.
        // settings.tema_gorselleri güncellemesi istemci tarafında (kendi RLS oturumuyla, ayarlar sayfasındaki gibi) yapılır.
        if (typeof body.alan !== 'string' || !(TEMA_ALAN_ANAHTARLARI as string[]).includes(body.alan)) return NextResponse.json({ error: 'Geçersiz tema alanı' }, { status: 400 })
        if (typeof body.b64 !== 'string' || body.b64.length < 100) return NextResponse.json({ error: 'Görsel verisi geçersiz' }, { status: 400 })
        let bytes: Buffer
        try { bytes = Buffer.from(body.b64, 'base64') } catch { return NextResponse.json({ error: 'Görsel çözümlenemedi' }, { status: 400 }) }
        if (!bytes.length || bytes.length > 15 * 1024 * 1024) return NextResponse.json({ error: 'Görsel boyutu geçersiz' }, { status: 400 })
        const admin = supabaseAdmin()
        const sik = await gorselSikistir(bytes, 1920)
        const yol = `tema/${body.alan}/${Date.now()}.webp`
        const up = await admin.storage.from('urun-gorselleri').upload(yol, sik.bytes, { contentType: sik.contentType, upsert: false })
        if (up.error) { console.error('[tema_gorsel_yukle] upload', up.error.message); return NextResponse.json({ error: 'Görsel depoya yüklenemedi.' }, { status: 502 }) }
        const { data: pub } = admin.storage.from('urun-gorselleri').getPublicUrl(yol)
        return NextResponse.json({ ok: true, url: pub.publicUrl })
      }
      case 'gorsel_toplu_sikistir': {
        // Depoda halihazırda duran (AI ile üretilmiş, sıkıştırılmamış) eski görselleri sıkıştırır.
        // Aynı yol korunur (DB'deki URL referansları bozulmaz) — yalnızca baytlar ve content-type değişir.
        const yollar: string[] = Array.isArray(body.yollar) ? body.yollar.slice(0, 15).filter((x: any) => typeof x === 'string' && x.length < 300) : []
        if (!yollar.length) return NextResponse.json({ error: 'Yol listesi gerekli' }, { status: 400 })
        const admin = supabaseAdmin()
        const sonuclar: { yol: string; eski?: number; yeni?: number; atlandi?: boolean; hata?: string }[] = []
        for (const yol of yollar) {
          try {
            const dl = await admin.storage.from('urun-gorselleri').download(yol)
            if (dl.error || !dl.data) { sonuclar.push({ yol, hata: dl.error?.message || 'indirilemedi' }); continue }
            const giris = Buffer.from(await dl.data.arrayBuffer())
            if (giris.length < 220 * 1024) { sonuclar.push({ yol, eski: giris.length, atlandi: true }); continue }
            const maxKenar = yol.startsWith('tema/') ? 1920 : 1200
            const sik = await gorselSikistir(giris, maxKenar)
            if (sik.bytes.length >= giris.length) { sonuclar.push({ yol, eski: giris.length, atlandi: true }); continue }
            const up = await admin.storage.from('urun-gorselleri').upload(yol, sik.bytes, { contentType: sik.contentType, upsert: true })
            if (up.error) { sonuclar.push({ yol, hata: up.error.message }); continue }
            sonuclar.push({ yol, eski: giris.length, yeni: sik.bytes.length })
          } catch (e: any) { sonuclar.push({ yol, hata: e?.message || 'bilinmeyen hata' }) }
        }
        return NextResponse.json({ ok: true, sonuclar })
      }
      case 'basvuru_analiz': {
        if (typeof body.id !== 'string') return NextResponse.json({ error: 'Başvuru id gerekli' }, { status: 400 })
        // Başvurunun bu kullanıcıya görünür olduğunu kendi oturumuyla doğrula, sonra service_role ile yaz
        const { data } = await y.sb.from('contact_submissions').select('id').eq('id', body.id).maybeSingle()
        if (!data) return NextResponse.json({ error: 'Başvuru bulunamadı' }, { status: 404 })
        return NextResponse.json({ ok: true, sonuc: await basvuruAnalizKaydet(body.id) })
      }
      case 'asistan': {
        const g: Konusma[] = (Array.isArray(body.mesajlar) ? body.mesajlar : []).slice(-10)
          .filter((m: any) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim())
          .map((m: any) => ({ role: m.role, content: m.content.slice(0, 1500) }))
        if (!g.length || g[g.length - 1].role !== 'user') return NextResponse.json({ error: 'Soru gerekli' }, { status: 400 })
        return NextResponse.json({ ok: true, ...(await genelAsistanYanit(y.sb, g, y.moduller)) })
      }
      case 'ozet':
        return NextResponse.json({ ok: true, ...(await haftalikOzet(y.sb, y.moduller)) })
      case 'ekstre_oner': {
        const rows = (Array.isArray(body.satirlar) ? body.satirlar : []).slice(0, 25).map((r: any) => ({ id: String(r.id), tarih: String(r.tarih || ''), yon: r.yon === 'giris' ? 'giris' : 'cikis', tutar: Number(r.tutar) || 0, aciklama: String(r.aciklama || '') }))
        if (!rows.length) return NextResponse.json({ error: 'Satır yok' }, { status: 400 })
        // Cari ve kategori listeleri istemciden değil, kullanıcının oturumundan (RLS) okunur
        const [c, k] = await Promise.all([y.sb.from('cari_hesaplar').select('id,ad').limit(300), y.sb.from('muhasebe_kategoriler').select('tip,ad')])
        const kat = { gelir: (k.data || []).filter((x: any) => x.tip === 'gelir').map((x: any) => x.ad), gider: (k.data || []).filter((x: any) => x.tip === 'gider').map((x: any) => x.ad) }
        return NextResponse.json({ ok: true, sonuc: await ekstreOner(rows, c.data || [], kat) })
      }
      case 'belge_oku': {
        if (typeof body.dosya !== 'string') return NextResponse.json({ error: 'Dosya gerekli' }, { status: 400 })
        return NextResponse.json({ ok: true, sonuc: await belgeOku(body.dosya) })
      }
      case 'kartvizit_oku': {
        if (typeof body.dosya !== 'string') return NextResponse.json({ error: 'Görsel gerekli' }, { status: 400 })
        return NextResponse.json({ ok: true, sonuc: await kartvizitOku(body.dosya) })
      }
    }
  } catch (e: any) {
    if (e instanceof AiHata) return NextResponse.json({ error: e.message }, { status: e.durum })
    console.error('[api/admin/ai]', action, e)
    return NextResponse.json({ error: 'AI işlemi başarısız oldu.' }, { status: 500 })
  }
  return NextResponse.json({ error: 'Geçersiz eylem' }, { status: 400 })
}
