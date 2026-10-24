import crypto from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { modulGerekli } from '@/lib/yetki'
import { ayAraligi, puantajVerisi, PersonelHata } from '@/lib/personel-veri'

export const maxDuration = 30

// Personel yönetimi uçları — yalnızca 'personel' modülü (veya tam yetki). Veri kullanıcının kendi oturumuyla (RLS) okunur.
const bugunTR = () => new Date(Date.now() + 3 * 3600e3).toISOString().slice(0, 10)
const gunEkle = (t: string, n: number) => new Date(Date.parse(t + 'T00:00:00Z') + n * 86400000).toISOString().slice(0, 10)
const yerelBasi = (t: string) => new Date(Date.parse(t + 'T00:00:00Z') - 3 * 3600e3).toISOString()
const kucuk = (s: any) => ({ personel: { id: s.personel.id, sicil_no: s.personel.sicil_no, ad_soyad: s.personel.ad_soyad, departman: s.personel.departman || null }, vardiya: s.vardiya ? { id: s.vardiya.id, ad: s.vardiya.ad, baslangic: s.vardiya.baslangic, bitis: s.vardiya.bitis } : null })

export async function POST(req: NextRequest) {
  let body: any
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Geçersiz istek' }, { status: 400 }) }
  const action = String(body?.action || '')
  const y = await modulGerekli(['personel']); if (y.hata) return y.hata

  try {
    if (action === 'puantaj') {
      const { bas, bit } = ayAraligi(String(body.donem))
      const v = await puantajVerisi(y.sb, bas, bit)
      return NextResponse.json({ ok: true, bas, bit, ayar: v.ayar, tatiller: v.tatiller, satirlar: v.satirlar.map(s => ({ ...kucuk(s), gunler: s.gunler, ozet: s.ozet })) })
    }

    if (action === 'bugun') {
      const bugun = bugunTR(), dun = gunEkle(bugun, -1)
      const v = await puantajVerisi(y.sb, dun, bugun)
      const liste = v.satirlar.map(s => {
        const g = s.gunler.find(x => x.tarih === bugun)!, d = s.gunler.find(x => x.tarih === dun)!
        const kaynak = d.durum === 'icerde' ? d : g   // dünün vardiyasından hâlâ içeride olan (gece vardiyası)
        return { ...kucuk(s), durum: kaynak.durum, giris: kaynak.giris, cikis: kaynak.cikis, gec_dk: kaynak.gec_dk, uyarilar: kaynak.uyarilar }
      })
      return NextResponse.json({ ok: true, bugun, liste })
    }

    if (action === 'uretim_verimlilik') {
      const bas = String(body.bas || ''), bit = String(body.bit || '')
      if (!/^\d{4}-\d{2}-\d{2}$/.test(bas) || !/^\d{4}-\d{2}-\d{2}$/.test(bit) || bit < bas) throw new PersonelHata('Tarih aralığı geçersiz.')
      if ((Date.parse(bit) - Date.parse(bas)) / 86400000 > 92) throw new PersonelHata('En fazla 92 günlük aralık seçilebilir.')
      const v = await puantajVerisi(y.sb, bas, bit)
      // Üretim hareketleri (üretim yetkisi yoksa RLS nedeniyle boş döner)
      const uretim: any[] = []
      for (let i = 0; i < 30000; i += 1000) {
        const r = await y.sb.from('uretim_hareketleri').select('tarih,uretilen_adet,fire_adet,vardiya').gte('tarih', yerelBasi(bas)).lt('tarih', yerelBasi(gunEkle(bit, 1))).order('tarih', { ascending: true }).range(i, i + 999)
        if (r.error) throw new PersonelHata('Üretim verisi okunamadı: ' + r.error.message, 500)
        uretim.push(...(r.data || [])); if ((r.data || []).length < 1000) break
      }
      const anahtar = (t: string, vd: string) => `${t}|${vd}`
      const satir = new Map<string, { tarih: string; vardiya: string; kisi: number; dk: number; uretilen: number; fire: number }>()
      const al = (t: string, vd: string) => { const k = anahtar(t, vd); if (!satir.has(k)) satir.set(k, { tarih: t, vardiya: vd, kisi: 0, dk: 0, uretilen: 0, fire: 0 }); return satir.get(k)! }
      for (const s of v.satirlar) for (const g of s.gunler) if (g.calisilan_dk > 0 && s.vardiya) { const r = al(g.tarih, s.vardiya.ad); r.kisi++; r.dk += g.calisilan_dk }
      for (const u of uretim) { const t = new Date(Date.parse(u.tarih) + 3 * 3600e3).toISOString().slice(0, 10); const r = al(t, String(u.vardiya || '—')); r.uretilen += Number(u.uretilen_adet) || 0; r.fire += Number(u.fire_adet) || 0 }
      const satirlar = Array.from(satir.values()).sort((a, b) => a.tarih.localeCompare(b.tarih) || a.vardiya.localeCompare(b.vardiya)).map(r => ({ ...r, saat: +(r.dk / 60).toFixed(2), adet_saat: r.dk > 0 ? +((r.uretilen / (r.dk / 60))).toFixed(2) : null, fire_orani: r.uretilen + r.fire > 0 ? +((r.fire / (r.uretilen + r.fire)) * 100).toFixed(2) : null }))
      const ozet = new Map<string, { vardiya: string; gun: number; kisi_gun: number; dk: number; uretilen: number; fire: number }>()
      for (const r of satirlar) { const o = ozet.get(r.vardiya) || { vardiya: r.vardiya, gun: 0, kisi_gun: 0, dk: 0, uretilen: 0, fire: 0 }; o.gun++; o.kisi_gun += r.kisi; o.dk += r.dk; o.uretilen += r.uretilen; o.fire += r.fire; ozet.set(r.vardiya, o) }
      return NextResponse.json({ ok: true, satirlar, ozet: Array.from(ozet.values()).map(o => ({ ...o, saat: +(o.dk / 60).toFixed(2), adet_saat: o.dk > 0 ? +(o.uretilen / (o.dk / 60)).toFixed(2) : null })), uretimKaydi: uretim.length })
    }

    if (action === 'kiosk_olustur') {
      const ad = String(body.ad || '').trim().slice(0, 60); if (!ad) throw new PersonelHata('Cihaz adı gerekli.')
      const anahtar = crypto.randomBytes(32).toString('hex')     // yalnızca bu yanıtta gösterilir
      const { data, error } = await y.sb.from('personel_kiosklari').insert({ ad, anahtar_hash: crypto.createHash('sha256').update(anahtar).digest('hex') }).select('id').single()
      if (error) throw new PersonelHata('Cihaz oluşturulamadı: ' + error.message, 500)
      return NextResponse.json({ ok: true, id: data.id, kurulum: `${new URL(req.url).origin}/kiosk#k=${anahtar}` })
    }
    return NextResponse.json({ error: 'Geçersiz eylem' }, { status: 400 })
  } catch (e: any) {
    if (e instanceof PersonelHata) return NextResponse.json({ error: e.message }, { status: e.durum })
    console.error('[api/admin/personel]', action, e)
    return NextResponse.json({ error: 'İşlem başarısız oldu.' }, { status: 500 })
  }
}
