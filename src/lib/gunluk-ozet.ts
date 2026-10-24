import type { SupabaseClient } from '@supabase/supabase-js'
import { veriTutarlilik } from '@/lib/ai-yonetim'

// Günlük özet: yalnızca veritabanındaki gerçek kayıtlardan, kurallı olarak üretilir (AI yok, uydurma yok).
// Aynı fonksiyon cron'da service_role ile (tüm veri), panelde kullanıcının oturumuyla (RLS: yalnızca yetkili olduğu veri) çalışır.
export type Ton = 'kirmizi' | 'sari' | 'bilgi'
export type Bolum = { anahtar: string; baslik: string; ton: Ton; sayi: number; ozet: string; satirlar: string[] }
export type Ozet = { tarih: string; bolumler: Bolum[]; toplamUyari: number; metin: string; baslik: string }

export const TL = (n: number) => `${new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 0 }).format(Math.round(n || 0))} ₺`
const gunFarki = (a: string, b: string) => Math.round((Date.parse(b.slice(0, 10) + 'T00:00:00Z') - Date.parse(a.slice(0, 10) + 'T00:00:00Z')) / 86400000)
const trTarih = (t: string) => t.slice(0, 10).split('-').reverse().join('.')
const gunEkle = (t: string, n: number) => new Date(Date.parse(t + 'T00:00:00Z') + n * 86400000).toISOString().slice(0, 10)
export const bugunTR = () => new Date(Date.now() + 3 * 3600e3).toISOString().slice(0, 10)
const ILK = 6   // bölüm başına gösterilen satır

export type Veri = {
  faturalar: any[]; cariler: any[]; cekler: any[]; kritikHam: any[]; kritikUrun: any[]
  satinalma: any[]; satis: any[]; basvurular: any[]; talepler: any[]
  kasaEksi?: { ad: string; bakiye: number; pb: string }[]; veriSorun?: { yuksek: number; ornekler: string[] }
  satinalmaYaklasan?: any[]; onayBekleyen?: { no: string; tedarikci_id: string | null; tl: number }[]; onayAyar?: { aktif: boolean; limit: number } | null
}

/** Saf fonksiyon: ham kayıtlardan bölümleri ve gönderilecek metni üretir. */
export function ozetOlustur(v: Veri, bugun: string): Ozet {
  const cari = new Map(v.cariler.map(c => [c.id, c.ad]))
  const ad = (id: string | null) => (id && cari.get(id)) || 'Cari belirtilmemiş'
  const kalan = (f: any) => (+f.toplam || 0) - (+f.odenen_tutar || 0)
  const bolumler: Bolum[] = []
  const ekle = (b: Omit<Bolum, 'ozet'> & { ozet?: string }) => { if (b.sayi > 0) bolumler.push({ ...b, ozet: b.ozet || '' }) }

  // 1) Tahsilat: vadesi geçmiş, ödenmemiş SATIŞ faturaları (müşteri bazında)
  const tah = v.faturalar.filter(f => f.tip === 'satis' && f.durum === 'onaylandi' && f.vade && f.vade < bugun && kalan(f) > 0.01)
  if (tah.length) {
    const g = new Map<string, { tutar: number; adet: number; enEski: string }>()
    tah.forEach(f => { const x = g.get(f.cari_id) || { tutar: 0, adet: 0, enEski: f.vade }; x.tutar += kalan(f); x.adet++; if (f.vade < x.enEski) x.enEski = f.vade; g.set(f.cari_id, x) })
    const l = [...g.entries()].sort((a, b) => b[1].tutar - a[1].tutar)
    ekle({ anahtar: 'tahsilat', baslik: 'Vadesi geçen alacaklar', ton: 'kirmizi', sayi: tah.length, ozet: `${tah.length} fatura, toplam ${TL(tah.reduce((t, f) => t + kalan(f), 0))}`,
      satirlar: l.slice(0, ILK).map(([id, x]) => `${ad(id)} — ${TL(x.tutar)} (${x.adet} fatura, en eski ${gunFarki(x.enEski, bugun)} gün gecikmiş)`).concat(l.length > ILK ? [`… ve ${l.length - ILK} müşteri daha`] : []) })
  }

  // 2) Ödemeler: vadesi geçmiş veya 7 gün içinde gelecek ALIŞ faturaları
  const son7 = gunEkle(bugun, 7)
  const ode = v.faturalar.filter(f => f.tip === 'alis' && f.durum === 'onaylandi' && f.vade && f.vade <= son7 && kalan(f) > 0.01).sort((a, b) => a.vade.localeCompare(b.vade))
  if (ode.length) {
    const gec = ode.filter(f => f.vade < bugun).length
    ekle({ anahtar: 'odeme', baslik: 'Tedarikçi ödemeleri', ton: gec ? 'kirmizi' : 'sari', sayi: ode.length, ozet: `${ode.length} fatura, toplam ${TL(ode.reduce((t, f) => t + kalan(f), 0))}${gec ? ` (${gec} tanesi vadesi geçmiş)` : ''}`,
      satirlar: ode.slice(0, ILK).map(f => `${ad(f.cari_id)} — ${TL(kalan(f))} (${f.vade < bugun ? `${gunFarki(f.vade, bugun)} gün gecikmiş` : f.vade === bugun ? 'bugün' : `${gunFarki(bugun, f.vade)} gün sonra`})`).concat(ode.length > ILK ? [`… ve ${ode.length - ILK} fatura daha`] : []) })
  }

  // 3) Çek / senet: portföyde, vadesi geçmiş veya 7 gün içinde
  const cek = v.cekler.filter(c => c.durum === 'portfoyde' && c.vade_tarihi && c.vade_tarihi <= son7).sort((a, b) => a.vade_tarihi.localeCompare(b.vade_tarihi))
  if (cek.length) {
    const etiket = (c: any) => `${c.tip === 'senet' ? 'Senet' : 'Çek'} ${c.yon === 'verilen' ? 'ÖDEME' : 'tahsilat'}`
    ekle({ anahtar: 'cek', baslik: 'Çek / senet vadeleri', ton: cek.some(c => c.vade_tarihi < bugun) ? 'kirmizi' : 'sari', sayi: cek.length,
      ozet: `${cek.length} adet: alınan ${TL(cek.filter(c => c.yon !== 'verilen').reduce((t, c) => t + (+c.tutar || 0), 0))}, verilen ${TL(cek.filter(c => c.yon === 'verilen').reduce((t, c) => t + (+c.tutar || 0), 0))}`,
      satirlar: cek.slice(0, ILK).map(c => `${etiket(c)} ${c.no || ''} — ${TL(+c.tutar)}, ${ad(c.cari_id)} (${c.vade_tarihi < bugun ? `${gunFarki(c.vade_tarihi, bugun)} gün geçti` : c.vade_tarihi === bugun ? 'bugün' : trTarih(c.vade_tarihi)})`).concat(cek.length > ILK ? [`… ve ${cek.length - ILK} kayıt daha`] : []) })
  }

  // 4) Kritik stok
  const kh = v.kritikHam.filter(h => h.aktif !== false)
  if (kh.length || v.kritikUrun.length) {
    const oran = (h: any) => (+h.min_stok > 0 ? (+h.mevcut_stok || 0) / +h.min_stok : 0)
    const s = kh.slice().sort((a, b) => oran(a) - oran(b))
    ekle({ anahtar: 'stok', baslik: 'Kritik stok', ton: kh.some(h => (+h.mevcut_stok || 0) <= 0) ? 'kirmizi' : 'sari', sayi: kh.length + v.kritikUrun.length,
      ozet: `${kh.length} hammadde${v.kritikUrun.length ? `, ${v.kritikUrun.length} ürün varyantı` : ''} minimum seviyede veya altında`,
      satirlar: s.slice(0, ILK).map(h => `${h.ad} — stok ${new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 1 }).format(+h.mevcut_stok || 0)} ${h.birim || ''} (min ${+h.min_stok || 0})`).concat(kh.length > ILK ? [`… ve ${kh.length - ILK} hammadde daha`] : []) })
  }

  // 5) Geciken siparişler
  const sg = v.satinalma.filter(s => ['beklemede', 'onaylandi', 'yolda'].includes(s.durum) && s.beklenen_teslim && s.beklenen_teslim < bugun)
  const ss = v.satis.filter(s => ['beklemede', 'uretimde', 'kismen_hazir', 'hazir'].includes(s.durum) && s.teslim_tarihi && s.teslim_tarihi < bugun)
  if (sg.length || ss.length) {
    ekle({ anahtar: 'siparis', baslik: 'Geciken siparişler', ton: 'kirmizi', sayi: sg.length + ss.length, ozet: `${ss.length} satış, ${sg.length} satınalma siparişi teslim tarihini geçti`,
      satirlar: [...ss.slice(0, 4).map(s => `Satış ${s.no} — ${ad(s.cari_id)} (${gunFarki(s.teslim_tarihi, bugun)} gün gecikmiş)`), ...sg.slice(0, 4).map(s => `Satınalma ${s.no} — ${ad(s.tedarikci_id)} (${gunFarki(s.beklenen_teslim, bugun)} gün gecikmiş)`)] })
  }

  // 5b) Yaklaşan satınalma teslimleri (3 gün içinde) ve onay bekleyen siparişler
  const yak = (v.satinalmaYaklasan || []).filter(s => ['beklemede', 'onaylandi', 'yolda'].includes(s.durum) && s.beklenen_teslim && s.beklenen_teslim >= bugun && s.beklenen_teslim <= gunEkle(bugun, 3)).sort((a, b) => a.beklenen_teslim.localeCompare(b.beklenen_teslim))
  if (yak.length) ekle({ anahtar: 'yaklasan', baslik: 'Yaklaşan satınalma teslimleri', ton: 'bilgi', sayi: yak.length, ozet: `${yak.length} sipariş 3 gün içinde teslim edilecek`, satirlar: yak.slice(0, ILK).map(s => `${s.no} — ${ad(s.tedarikci_id)} (${s.beklenen_teslim === bugun ? 'bugün' : `${gunFarki(bugun, s.beklenen_teslim)} gün sonra`})`) })
  const ob = v.onayAyar?.aktif ? (v.onayBekleyen || []).filter(x => x.tl > (v.onayAyar?.limit || 0)) : []
  if (ob.length) ekle({ anahtar: 'onay', baslik: 'Onay bekleyen siparişler', ton: 'sari', sayi: ob.length, ozet: `${ob.length} sipariş limit üstünde; yönetici onayı bekliyor (toplam ${TL(ob.reduce((t, x) => t + x.tl, 0))})`, satirlar: ob.slice(0, ILK).map(x => `${x.no} — ${ad(x.tedarikci_id)}: ${TL(x.tl)}`) })

  // 6) Cevapsız başvurular (24 saatten eski, spam değil)
  const eski = v.basvurular.filter(b => !b.ai_spam)
  if (eski.length) {
    ekle({ anahtar: 'basvuru', baslik: 'Yanıt bekleyen başvurular', ton: eski.some(b => (Date.parse(bugun) - Date.parse(String(b.created_at).slice(0, 10))) / 86400000 >= 3) ? 'kirmizi' : 'sari', sayi: eski.length,
      ozet: `${eski.length} başvuru henüz yanıtlanmadı`,
      satirlar: eski.slice(0, ILK).map(b => `${b.name}${b.company ? ` (${b.company})` : ''} — ${b.subject || 'konu yok'}${b.ai_oncelik === 'yuksek' ? ' [yüksek öncelik]' : ''}, ${gunFarki(String(b.created_at), bugun)} gün önce`).concat(eski.length > ILK ? [`… ve ${eski.length - ILK} başvuru daha`] : []) })
  }

  // 7) Teklif bekleyen satınalma talepleri
  if (v.talepler.length) ekle({ anahtar: 'talep', baslik: 'Satınalma talepleri', ton: 'bilgi', sayi: v.talepler.length, ozet: `${v.talepler.length} talep teklif / karar bekliyor`, satirlar: [] })

  // 8) Eksi kasa/banka ve veri güvenilirliği (yüksek seviyeli tutarsızlıklar)
  const ke = v.kasaEksi || []
  if (ke.length) ekle({ anahtar: 'kasa', baslik: 'Eksi bakiyeli kasa/banka', ton: 'kirmizi', sayi: ke.length, ozet: `${ke.length} hesap eksiye düşmüş`, satirlar: ke.slice(0, ILK).map(k => `${k.ad}: ${new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 0 }).format(k.bakiye)} ${k.pb}`) })
  if (v.veriSorun && v.veriSorun.yuksek > 0) ekle({ anahtar: 'veri', baslik: 'Veri güvenilirliği', ton: 'sari', sayi: v.veriSorun.yuksek, ozet: `${v.veriSorun.yuksek} önemli tutarsızlık var (Muhasebe AI'ya "sistemde hata var mı" diye sorun)`, satirlar: v.veriSorun.ornekler.slice(0, ILK) })

  const toplamUyari = bolumler.reduce((t, b) => t + b.sayi, 0)
  const baslik = toplamUyari ? `Günlük özet ${trTarih(bugun)}: ${toplamUyari} madde dikkat istiyor` : `Günlük özet ${trTarih(bugun)}: dikkat gerektiren madde yok`
  const ic = bolumler.map(b => `▸ ${b.baslik.toLocaleUpperCase('tr-TR')} — ${b.ozet}${b.satirlar.length ? '\n' + b.satirlar.map(s => `   • ${s}`).join('\n') : ''}`).join('\n\n')
  const metin = `Alya Plastik — ${baslik}\n\n${ic || 'Vadesi geçen alacak, ödeme, çek/senet, kritik stok, geciken sipariş veya yanıt bekleyen başvuru yok.'}`
  return { tarih: bugun, bolumler, toplamUyari, metin, baslik }
}

/** Veriyi çeker (her bölüm bağımsız; yetki/erişim yoksa o bölüm atlanır) ve özeti üretir. */
export async function gunlukOzet(sb: SupabaseClient, bugun = bugunTR()): Promise<Ozet & { atlanan: string[] }> {
  const atlanan: string[] = []
  const al = async (ad: string, f: () => PromiseLike<{ data: any[] | null; error: any }>) => {
    try { const r = await f(); if (r.error) { atlanan.push(ad); return [] as any[] } return r.data || [] } catch { atlanan.push(ad); return [] as any[] }
  }
  const son7 = gunEkle(bugun, 7), dun = new Date(Date.now() - 24 * 3600e3).toISOString()
  const [kasaHam, veriRap] = await Promise.all([
    al('kasa', () => sb.from('kasa_banka_hesaplari').select('ad,bakiye,para_birimi,aktif').lt('bakiye', 0).limit(100)),
    veriTutarlilik(sb).catch(() => null),
  ])
  const kasaEksi = kasaHam.filter((k: any) => k.aktif !== false).map((k: any) => ({ ad: k.ad, bakiye: +k.bakiye || 0, pb: k.para_birimi || 'TRY' }))
  const veriSorun = veriRap ? { yuksek: veriRap.yuksek, ornekler: veriRap.sorunlar.filter(x => x.seviye === 'yuksek').map(x => `${x.konu}: ${x.ozet}`) } : undefined
  const [faturalar, cariler, cekler, kritikHam, kritikUrun, satinalma, satis, basvurular, talepler, satinalmaYaklasan, onayHam, onayAyarSatir] = await Promise.all([
    al('faturalar', () => sb.from('faturalar').select('tip,durum,cari_id,vade,toplam,odenen_tutar').eq('durum', 'onaylandi').in('tip', ['satis', 'alis']).lte('vade', son7).limit(3000)),
    al('cariler', () => sb.from('cari_hesaplar').select('id,ad').limit(5000)),
    al('cek_senet', () => sb.from('cek_senet').select('tip,yon,cari_id,no,tutar,vade_tarihi,durum').eq('durum', 'portfoyde').lte('vade_tarihi', son7).limit(1000)),
    al('kritik_hammadde', () => sb.from('v_kritik_hammaddeler').select('ad,birim,mevcut_stok,min_stok,aktif').limit(500)),
    al('kritik_urun', () => sb.from('v_kritik_urunler').select('id').limit(500)),
    al('satinalma', () => sb.from('satinalma_siparisleri').select('no,tedarikci_id,durum,beklenen_teslim').in('durum', ['beklemede', 'onaylandi', 'yolda']).lt('beklenen_teslim', bugun).limit(500)),
    al('satis', () => sb.from('satis_siparisleri').select('no,cari_id,durum,teslim_tarihi').in('durum', ['beklemede', 'uretimde', 'kismen_hazir', 'hazir']).lt('teslim_tarihi', bugun).limit(500)),
    al('basvurular', () => sb.from('contact_submissions').select('name,company,subject,created_at,ai_spam,ai_oncelik,status').or('status.is.null,status.in.(new,read)').lt('created_at', dun).order('created_at', { ascending: true }).limit(200)),
    al('talepler', () => sb.from('satinalma_talepleri').select('id').eq('durum', 'beklemede').limit(500)),
    al('satinalma_yaklasan', () => sb.from('satinalma_siparisleri').select('no,tedarikci_id,durum,beklenen_teslim').in('durum', ['beklemede', 'onaylandi', 'yolda']).gte('beklenen_teslim', bugun).lte('beklenen_teslim', gunEkle(bugun, 3)).limit(300)),
    al('onay', () => sb.from('satinalma_siparisleri').select('no,tedarikci_id,kur,satinalma_siparisi_kalemleri(miktar,birim_fiyat)').eq('durum', 'beklemede').limit(300)),
    al('onay_ayar', () => sb.from('settings').select('value').eq('key', 'satinalma_onay').limit(1)),
  ])
  const onayBekleyen = onayHam.map((o: any) => ({ no: o.no, tedarikci_id: o.tedarikci_id, tl: (o.satinalma_siparisi_kalemleri || []).reduce((t: number, k: any) => t + (+k.miktar || 0) * (+k.birim_fiyat || 0), 0) * (+o.kur || 1) }))
  const av = onayAyarSatir[0]?.value
  const onayAyar = av ? { aktif: !!av.aktif, limit: +av.limit || 0 } : null
  return { ...ozetOlustur({ faturalar, cariler, cekler, kritikHam, kritikUrun, satinalma, satis, basvurular, talepler, satinalmaYaklasan, onayBekleyen, onayAyar, kasaEksi, veriSorun }, bugun), atlanan }
}
