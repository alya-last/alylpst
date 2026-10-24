import type { SupabaseClient } from '@supabase/supabase-js'

// Yönetici araçları: veri tutarlılık kontrolü, nakit tahmini, kârlılık, hammadde fiyat etkisi.
// Hepsi salt-okunurdur ve kullanıcının KENDİ oturumuyla (RLS) çalışır; hesaplar burada deterministik yapılır, AI yalnızca yorumlar.

const r2 = (n: unknown) => Math.round((Number(n) || 0) * 100) / 100
const nrm = (v: unknown) => String(v ?? '').toLocaleLowerCase('tr').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ı/g, 'i').trim()
const bugunTR = () => new Date(Date.now() + 3 * 3600e3).toISOString().slice(0, 10)
const gunEkle = (t: string, n: number) => new Date(Date.parse(t + 'T00:00:00Z') + n * 86400000).toISOString().slice(0, 10)
const gunFarki = (a: string, b: string) => Math.round((Date.parse(b.slice(0, 10) + 'T00:00:00Z') - Date.parse(a.slice(0, 10) + 'T00:00:00Z')) / 86400000)
const OZEL_KATEGORI = ['Virman', 'Fatura Kapama', 'Bakiye Düzeltme', 'Açılış Bakiyesi', 'Kur Farkı Geliri', 'Kur Farkı Gideri']
const TL = (n: number) => `${new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 0 }).format(Math.round(n || 0))} ₺`

async function al(q: PromiseLike<{ data: any; error: any }>): Promise<any[]> {
  const r = await q
  if (r.error) throw new Error(r.error.message)
  return (r.data || []) as any[]
}

/* ───────────────────────── 1) Veri tutarlılık kontrolü ───────────────────────── */
export type Sorun = { seviye: 'yuksek' | 'orta' | 'bilgi'; konu: string; ozet: string; ornekler?: string[]; oneri?: string }

export async function veriTutarlilik(sb: SupabaseClient): Promise<{ kontrol_tarihi: string; sorun_sayisi: number; yuksek: number; sorunlar: Sorun[]; kontrol_edilemeyen: string[]; not: string }> {
  const bugun = bugunTR()
  const sorunlar: Sorun[] = []
  const atlanan: string[] = []
  const ekle = (s: Sorun) => sorunlar.push(s)
  const dene = async <T,>(ad: string, f: () => Promise<T>, yedek: T): Promise<T> => { try { return await f() } catch { atlanan.push(ad); return yedek } }
  const alti = gunEkle(bugun, -183)

  const [cariler, cekler, kasa, faturalar, hamm, varyant, islemler, bagsiz] = await Promise.all([
    dene('cari_hesaplar', () => al(sb.from('cari_hesaplar').select('id,ad,kod,vergi_no,bakiye,bakiye_usd,bakiye_eur').limit(5000)), [] as any[]),
    dene('cek_senet', () => al(sb.from('cek_senet').select('tip,yon,no,tutar,vade_tarihi,durum,resmiyet,aciklama').limit(3000)), [] as any[]),
    dene('kasa_banka_hesaplari', () => al(sb.from('kasa_banka_hesaplari').select('ad,para_birimi,bakiye,aktif').limit(500)), [] as any[]),
    dene('faturalar', () => al(sb.from('faturalar').select('no,tip,durum,tarih,ara_toplam,kdv_tutari,toplam,bakiye_islendi,kdv_dahil').limit(5000)), [] as any[]),
    dene('hammaddeler', () => al(sb.from('hammaddeler').select('ad,mevcut_stok,aktif').limit(3000)), [] as any[]),
    dene('product_variants', () => al(sb.from('product_variants').select('name,stock').limit(5000)), [] as any[]),
    dene('islemler', () => al(sb.from('islemler').select('tip,kategori,tutar,tarih').gte('tarih', alti).limit(8000)), [] as any[]),
    dene('islemler_bagsiz', async () => { const r = await sb.from('islemler').select('id', { count: 'exact', head: true }).is('cari_id', null).is('fatura_id', null); if (r.error) throw new Error(r.error.message); return r.count || 0 }, 0),
  ])

  // 1) Mükerrer cari
  if (cariler.length) {
    const g = new Map<string, any[]>()
    for (const c of cariler) { const k = nrm(c.ad).replace(/[^a-z0-9]/g, '').slice(0, 12); if (k.length >= 6) { const a = g.get(k) || []; a.push(c); g.set(k, a) } }
    const cift = [...g.values()].filter(a => a.length > 1)
    if (cift.length) ekle({ seviye: 'orta', konu: 'Mükerrer olabilecek cariler', ozet: `${cift.length} grup cari adı birbirine çok benziyor (aynı firma iki ayrı kartta olabilir; bakiye bölünür).`,
      ornekler: cift.slice(0, 8).map(a => a.map(c => `${c.kod || ''} ${c.ad} (${r2(c.bakiye)} ₺${c.bakiye_usd ? `, ${r2(c.bakiye_usd)} USD` : ''}${c.bakiye_eur ? `, ${r2(c.bakiye_eur)} EUR` : ''})`).join('  |  ')), oneri: 'Aynı firmaysa tek kartta birleştirin; ESPAPLAST gibi bilerek ayrı tutulan hesaplar olabilir.' })
    const vNo = cariler.filter(c => !String(c.vergi_no || '').trim() && (Number(c.bakiye) || Number(c.bakiye_usd) || Number(c.bakiye_eur)))
    if (vNo.length) ekle({ seviye: 'bilgi', konu: 'Vergi numarası eksik cariler', ozet: `Bakiyesi olan ${vNo.length} carinin vergi/TC numarası yok (e-fatura ve KDV listesi için gerekir).` })
  }

  // 2) Çek / senet
  if (cekler.length) {
    const elde = cekler.filter(c => c.durum === 'portfoyde' && c.yon === 'alinan')
    const gecmis = elde.filter(c => c.vade_tarihi && c.vade_tarihi < bugun)
    if (gecmis.length) ekle({ seviye: 'yuksek', konu: 'Vadesi geçmiş ama hâlâ "elde" görünen çek/senet', ozet: `${gecmis.length} evrak (${TL(gecmis.reduce((t, c) => t + (+c.tutar || 0), 0))}) vadesi geçtiği halde portföyde duruyor; tahsil edilmiş, verilmiş ya da karşılıksız çıkmış olabilir.`,
      ornekler: gecmis.slice(0, 6).map(c => `${c.tip} ${c.no || '(no yok)'} — ${TL(+c.tutar)}, vade ${c.vade_tarihi}`), oneri: 'Durumlarını güncelleyin (tahsil edildi / ciro edildi / karşılıksız).' })
    const rs = elde.filter(c => !c.resmiyet && c.tip === 'cek')
    if (rs.length) ekle({ seviye: 'orta', konu: 'Resmi / gayri resmi belirtilmemiş çekler', ozet: `Elimizdeki ${rs.length} çekte R/G bilgisi yok (${TL(rs.reduce((t, c) => t + (+c.tutar || 0), 0))}).` })
    const cirosuz = cekler.filter(c => c.durum === 'ciro_edildi' && !/ciro|takas|tahsile/i.test(c.aciklama || ''))
    if (cirosuz.length) ekle({ seviye: 'orta', konu: 'Kime verildiği yazılmamış ciro edilmiş çekler', ozet: `${cirosuz.length} çek "ciro edildi" ama kime verildiği açıklamada yok.` })
    const sayac = new Map<string, number>()
    for (const c of cekler) if (c.no) { const k = `${c.no}|${+c.tutar}`; sayac.set(k, (sayac.get(k) || 0) + 1) }
    const tekrar = [...sayac.entries()].filter(([, n]) => n > 1)
    if (tekrar.length) ekle({ seviye: 'orta', konu: 'Aynı çek no ve tutar iki kez girilmiş', ozet: `${tekrar.length} çek mükerrer kayıtlı olabilir.`, ornekler: tekrar.slice(0, 6).map(([k]) => k.replace('|', ' — ')) })
  }

  // 3) Kasa/banka
  const aktifKasa = kasa.filter(k => k.aktif !== false)
  const eksi = aktifKasa.filter(k => (+k.bakiye || 0) < 0)
  if (eksi.length) ekle({ seviye: 'yuksek', konu: 'Eksi bakiyeli kasa/banka', ozet: `${eksi.length} hesapta bakiye eksi; kasa fiziksel olarak eksi olamaz, giriş eksik ya da çıkış fazla girilmiş olabilir.`, ornekler: eksi.map(k => `${k.ad}: ${r2(k.bakiye)} ${k.para_birimi || 'TRY'}`), oneri: 'Kasaya yapılan para girişlerini (ör. bankadan çekilen nakit) kontrol edin.' })
  const gelir6 = islemler.filter(i => i.tip === 'gelir' && !OZEL_KATEGORI.includes(i.kategori)).reduce((t, i) => t + (+i.tutar || 0), 0)
  if (gelir6 > 0) {
    const sus = aktifKasa.filter(k => (+k.bakiye || 0) * ((k.para_birimi || 'TRY') === 'TRY' ? 1 : 30) > gelir6 * 3)
    if (sus.length) ekle({ seviye: 'yuksek', konu: 'Kasa/banka bakiyesi şirketin gelirine göre aşırı büyük', ozet: `${sus.length} hesabın bakiyesi son 6 aylık toplam gelirin (${TL(gelir6)}) 3 katından fazla. Büyük olasılıkla hatalı "sayım/mutabakat düzeltmesi" girişidir.`,
      ornekler: sus.map(k => `${k.ad}: ${new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 0 }).format(+k.bakiye || 0)} ${k.para_birimi || 'TRY'}`), oneri: 'Banka ekstresiyle karşılaştırın; yanlışsa düzeltme girişlerini ters kayıtla düzeltin. Kasa toplamı ve nakit tahmini bu yüzden güvenilir değildir.' })
  }

  // 4) Faturalar
  if (faturalar.length) {
    const tutarsiz = faturalar.filter(f => Math.abs((+f.ara_toplam || 0) + (+f.kdv_tutari || 0) - (+f.toplam || 0)) > 1)
    if (tutarsiz.length) ekle({ seviye: 'orta', konu: 'Toplamı tutmayan faturalar', ozet: `${tutarsiz.length} faturada ara toplam + KDV ≠ toplam.`, ornekler: tutarsiz.slice(0, 6).map(f => `${f.no}: ${r2(f.ara_toplam)} + ${r2(f.kdv_tutari)} ≠ ${r2(f.toplam)}`) })
    const isleneme = faturalar.filter(f => ['onaylandi', 'odendi'].includes(f.durum) && f.bakiye_islendi === false)
    if (isleneme.length) ekle({ seviye: 'yuksek', konu: 'Onaylı ama cari bakiyesine işlenmemiş fatura', ozet: `${isleneme.length} onaylı faturanın bakiyesi cariye işlenmemiş; cari bakiyeler eksik görünür.`, ornekler: isleneme.slice(0, 6).map(f => f.no) })
    const eskiTaslak = faturalar.filter(f => f.durum === 'taslak' && !f.kdv_dahil && f.tarih && f.tarih < gunEkle(bugun, -30))
    if (eskiTaslak.length) ekle({ seviye: 'orta', konu: 'Uzun süredir taslak kalan faturalar', ozet: `${eskiTaslak.length} fatura 30 günden eski ve hâlâ taslak; resmi bakiye ve KDV'ye girmiyor.` })
  }

  // 5) Eksi stok
  const eksiH = hamm.filter(h => h.aktif !== false && (+h.mevcut_stok || 0) < 0), eksiV = varyant.filter(v => (+v.stock || 0) < 0)
  if (eksiH.length || eksiV.length) ekle({ seviye: 'orta', konu: 'Eksi stok', ozet: `${eksiH.length} hammadde, ${eksiV.length} ürün varyantı eksi stokta (çıkış girilmiş ama giriş girilmemiş olabilir).`, ornekler: [...eksiH.slice(0, 4).map(h => `${h.ad}: ${r2(h.mevcut_stok)}`), ...eksiV.slice(0, 4).map(v => `${v.name}: ${v.stock}`)] })

  // 6) Eksik ay (gelir var gider yok ya da tersi) ve bağlantısız işlem
  const aylar = new Map<string, { g: number; d: number }>()
  for (const i of islemler) { if (OZEL_KATEGORI.includes(i.kategori)) continue; const m = String(i.tarih).slice(0, 7), x = aylar.get(m) || { g: 0, d: 0 }; if (i.tip === 'gelir') x.g += +i.tutar || 0; else x.d += +i.tutar || 0; aylar.set(m, x) }
  const buAy = bugun.slice(0, 7)
  const eksikAy = [...aylar.entries()].filter(([m, x]) => m < buAy && (x.g === 0) !== (x.d === 0)).map(([m, x]) => `${m}: ${x.g ? 'gelir var, gider YOK' : 'gider var, gelir YOK'}`)
  if (eksikAy.length) ekle({ seviye: 'yuksek', konu: 'Eksik girilmiş ay', ozet: 'Bazı ayların geliri ya da gideri hiç girilmemiş; bu aylarda kâr/zarar gerçeği yansıtmaz.', ornekler: eksikAy, oneri: 'Eksik ayın kayıtlarını tamamlamadan kâr/zarar yorumuna güvenmeyin.' })
  if (bagsiz > 0) ekle({ seviye: 'bilgi', konu: 'Cari ya da faturaya bağlı olmayan işlemler', ozet: `${bagsiz} işlem ne bir cariye ne bir faturaya bağlı (maaş, kira gibi genel giderler normal olabilir; ama cari ödemesi/tahsilatı ise bakiyeye yansımaz).` })

  const sira = { yuksek: 0, orta: 1, bilgi: 2 } as const
  sorunlar.sort((a, b) => sira[a.seviye] - sira[b.seviye])
  return { kontrol_tarihi: bugun, sorun_sayisi: sorunlar.length, yuksek: sorunlar.filter(s => s.seviye === 'yuksek').length, sorunlar, kontrol_edilemeyen: atlanan, not: 'Bunlar otomatik şüphe kontrolleridir; her biri gerçek hata olmayabilir. "yuksek" olanlar önce doğrulanmalıdır.' }
}

/* ───────────────────────── 2) Nakit tahmini ───────────────────────── */
export async function nakitTahmini(sb: SupabaseClient, gun = 90) {
  const bugun = bugunTR(), son = gunEkle(bugun, Math.min(Math.max(gun, 30), 180))
  const [kasa, cekler, faturalar, islemler] = await Promise.all([
    al(sb.from('kasa_banka_hesaplari').select('ad,para_birimi,bakiye,aktif').limit(500)),
    al(sb.from('cek_senet').select('tip,yon,no,tutar,vade_tarihi,durum,aciklama').in('durum', ['portfoyde', 'ciro_edildi']).limit(3000)),
    al(sb.from('faturalar').select('tip,durum,vade,tarih,toplam,odenen_tutar,para_birimi').eq('durum', 'onaylandi').in('tip', ['satis', 'alis']).limit(5000)),
    al(sb.from('islemler').select('tip,kategori,tutar,tarih').gte('tarih', gunEkle(bugun, -92)).limit(8000)),
  ])
  const kovaAd = (v: string) => { if (v < bugun) return 'gecmis'; const g = gunFarki(bugun, v); return g <= 30 ? 'g0_30' : g <= 60 ? 'g31_60' : g <= 90 ? 'g61_90' : 'g90_ustu' }
  const bos = () => ({ cek_elde_giris: 0, cek_bankada_giris: 0, fatura_tahsilat: 0, cek_verilen_cikis: 0, fatura_odeme: 0 })
  const kova: Record<string, ReturnType<typeof bos>> = { gecmis: bos(), g0_30: bos(), g31_60: bos(), g61_90: bos(), g90_ustu: bos() }
  for (const c of cekler) {
    if (!c.vade_tarihi || c.vade_tarihi > son) continue
    const t = +c.tutar || 0
    if (c.durum === 'portfoyde' && c.yon === 'alinan') kova[kovaAd(c.vade_tarihi)].cek_elde_giris += t
    else if (c.durum === 'portfoyde' && c.yon === 'verilen') kova[kovaAd(c.vade_tarihi)].cek_verilen_cikis += t
    else if (c.durum === 'ciro_edildi' && c.yon === 'alinan' && /takas|tahsile/i.test(c.aciklama || '') && c.vade_tarihi >= bugun) kova[kovaAd(c.vade_tarihi)].cek_bankada_giris += t
  }
  const doviz: Record<string, { alacak: number; borc: number }> = {}
  for (const f of faturalar) {
    const kalan = (+f.toplam || 0) - (+f.odenen_tutar || 0); if (kalan <= 0.01) continue
    const v = f.vade || f.tarih; if (!v || v > son) continue
    const pb = f.para_birimi || 'TRY'
    if (pb !== 'TRY') { const d = doviz[pb] || { alacak: 0, borc: 0 }; if (f.tip === 'satis') d.alacak += kalan; else d.borc += kalan; doviz[pb] = d; continue }
    if (f.tip === 'satis') kova[kovaAd(v)].fatura_tahsilat += kalan; else kova[kovaAd(v)].fatura_odeme += kalan
  }
  const acilis = kasa.filter(k => k.aktif !== false && (k.para_birimi || 'TRY') === 'TRY').reduce((t, k) => t + (+k.bakiye || 0), 0)
  const dovizKasa: Record<string, number> = {}
  kasa.filter(k => k.aktif !== false && (k.para_birimi || 'TRY') !== 'TRY').forEach(k => { dovizKasa[k.para_birimi] = r2((dovizKasa[k.para_birimi] || 0) + (+k.bakiye || 0)) })
  const ozet = (k: ReturnType<typeof bos>) => ({ giris: r2(k.cek_elde_giris + k.cek_bankada_giris + k.fatura_tahsilat), cikis: r2(k.cek_verilen_cikis + k.fatura_odeme), net: r2(k.cek_elde_giris + k.cek_bankada_giris + k.fatura_tahsilat - k.cek_verilen_cikis - k.fatura_odeme), ayrinti: Object.fromEntries(Object.entries(k).map(([a, b]) => [a, r2(b)])) })
  // Kümülatif: vadesi geçmiş ÖDEMELER hemen çıkar sayılır; vadesi geçmiş TAHSİLATLAR/çekler belirsiz olduğu için kümülatife katılmaz.
  let kum = acilis - kova.gecmis.fatura_odeme - kova.gecmis.cek_verilen_cikis
  const donemler = (['g0_30', 'g31_60', 'g61_90'] as const).map(a => { const o = ozet(kova[a]); kum += o.net; return { donem: a === 'g0_30' ? '0-30 gün' : a === 'g31_60' ? '31-60 gün' : '61-90 gün', ...o, tahmini_tl_nakit_donem_sonu: r2(kum) } })
  const ay3 = islemler.filter(i => i.tip === 'gider' && !OZEL_KATEGORI.includes(i.kategori)).reduce((t, i) => t + (+i.tutar || 0), 0)
  return {
    bugun, acilis_tl_kasa_banka: r2(acilis), doviz_kasa_banka: dovizKasa,
    vadesi_gecmis: { tahsil_edilecek_fatura: r2(kova.gecmis.fatura_tahsilat), elde_gorunen_cek_alinan: r2(kova.gecmis.cek_elde_giris), odenecek_fatura: r2(kova.gecmis.fatura_odeme), verilen_cek: r2(kova.gecmis.cek_verilen_cikis) },
    donemler, dovizli_acik_faturalar: doviz,
    son_3_ay_ortalama_aylik_gider_referans: r2(ay3 / 3),
    not: 'Girişler: elimizdeki çekler, bankada tahsildeki çekler (Garanti takas) ve açık satış faturaları; çıkışlar: verilen çekler ve açık alış faturaları. Maaş, kira, SGK, vergi gibi tekrarlayan giderler dahil DEĞİLDİR; son_3_ay_ortalama_aylik_gider_referans yalnızca kıyas içindir (fatura ödemeleriyle çift sayılmış olabilir). Vadesi geçmiş alacaklar ve çekler tahsil edilmiş sayılmadı. Kasa/banka bakiyesi hatalıysa (veri_tutarlilik\'e bakın) tahmin de hatalıdır.',
  }
}

/* ───────────────────────── 3) Müşteri / ürün kârlılığı ───────────────────────── */
export async function karlilikAnaliz(sb: SupabaseClient, bas: string, bit: string) {
  const [faturalar, kalemler, receteler, rkalem, hamm] = await Promise.all([
    al(sb.from('faturalar').select('tip,cari_id,ara_toplam,para_birimi,cari:cari_hesaplar(ad)').in('tip', ['satis', 'iade']).in('durum', ['onaylandi', 'odendi']).gte('tarih', bas).lte('tarih', bit).limit(5000)),
    al(sb.from('fatura_kalemleri').select('urun_id,urun_adi,miktar,birim_fiyat,toplam,fatura:faturalar!inner(tip,durum,tarih,para_birimi)').limit(8000)),
    al(sb.from('urun_receteleri').select('id,urun_id,aktif,iscilik_maliyeti,genel_gider_maliyeti,amortisman_maliyeti').eq('aktif', true).limit(2000)),
    al(sb.from('recete_kalemleri').select('recete_id,hammadde_id,miktar').limit(20000)),
    al(sb.from('hammaddeler').select('id,ad,ortalama_maliyet').limit(3000)),
  ])
  const tl = (pb: unknown) => !pb || pb === 'TRY'
  const m = new Map<string, { ad: string; net: number; adet: number }>()
  let toplam = 0; const dovizFatura: Record<string, number> = {}
  for (const f of faturalar) {
    if (!tl(f.para_birimi)) { dovizFatura[f.para_birimi] = r2((dovizFatura[f.para_birimi] || 0) + (+f.ara_toplam || 0)); continue }
    const c = Array.isArray(f.cari) ? f.cari[0] : f.cari, x = m.get(f.cari_id) || { ad: c?.ad || 'Cari belirtilmemiş', net: 0, adet: 0 }
    const t = (f.tip === 'iade' ? -1 : 1) * (+f.ara_toplam || 0); x.net += t; x.adet++; toplam += t; m.set(f.cari_id, x)
  }
  const musteriler = [...m.values()].sort((a, b) => b.net - a.net)
  const ilk5 = musteriler.slice(0, 5).reduce((t, x) => t + x.net, 0)
  const hmMaliyet = new Map(hamm.map(h => [h.id, +h.ortalama_maliyet || 0]))
  const rk = new Map<string, any[]>(); for (const k of rkalem) { const a = rk.get(k.recete_id) || []; a.push(k); rk.set(k.recete_id, a) }
  const maliyet = new Map<string, number | null>()
  for (const r of receteler) {
    const ks = rk.get(r.id) || []; let t = 0, tam = ks.length > 0
    for (const k of ks) { const c = hmMaliyet.get(k.hammadde_id) || 0; if (c <= 0) tam = false; t += (+k.miktar || 0) * c }
    maliyet.set(r.urun_id, tam ? r2(t + (+r.iscilik_maliyeti || 0) + (+r.genel_gider_maliyeti || 0) + (+r.amortisman_maliyeti || 0)) : null)
  }
  const urun = new Map<string, { ad: string; miktar: number; ciro: number; urun_id: string | null }>()
  for (const k of kalemler) {
    const f = Array.isArray(k.fatura) ? k.fatura[0] : k.fatura
    if (!f || f.tip !== 'satis' || !['onaylandi', 'odendi'].includes(f.durum) || f.tarih < bas || f.tarih > bit || !tl(f.para_birimi)) continue
    const key = k.urun_id || `ad:${k.urun_adi}`, x = urun.get(key) || { ad: k.urun_adi, miktar: 0, ciro: 0, urun_id: k.urun_id }
    x.miktar += +k.miktar || 0; x.ciro += +k.toplam || (+k.miktar || 0) * (+k.birim_fiyat || 0); urun.set(key, x)
  }
  const urunler = [...urun.values()].sort((a, b) => b.ciro - a.ciro).slice(0, 15).map(u => {
    const bm = u.urun_id ? maliyet.get(u.urun_id) ?? null : null, bf = u.miktar ? u.ciro / u.miktar : 0
    return { urun: u.ad, adet: r2(u.miktar), ciro_kdv_haric: r2(u.ciro), ort_satis_fiyati: r2(bf), birim_maliyet: bm, marj_yuzde: bm && bf ? r2(((bf - bm) / bf) * 100) : null }
  })
  const hesaplanabilir = urunler.filter(u => u.marj_yuzde !== null).length
  return {
    donem: `${bas} → ${bit}`, fatura_adedi: faturalar.length, toplam_net_satis_kdv_haric_tl: r2(toplam), dovizli_faturalar_ayri: dovizFatura,
    musteri_yogunlasma: { ilk5_pay_yuzde: toplam > 0 ? r2((ilk5 / toplam) * 100) : null, en_buyuk_5: musteriler.slice(0, 5).map(x => ({ musteri: x.ad, net_satis: r2(x.net), pay_yuzde: toplam > 0 ? r2((x.net / toplam) * 100) : null })), musteri_sayisi: musteriler.length },
    urunler, maliyeti_hesaplanabilen_urun: hesaplanabilir, maliyetli_hammadde_orani: `${hamm.filter(h => +h.ortalama_maliyet > 0).length}/${hamm.length}`,
    not: 'Yalnızca SİSTEME GİRİLMİŞ onaylı faturalar kapsanır; satışların büyük kısmı aylık tablodan geliyorsa müşteri/ürün kırılımı eksik olur (kırılım için faturaların ürün kalemleriyle girilmesi gerekir). Ürün marjı yalnızca reçetesi olan ve TÜM hammaddelerinin ortalama maliyeti girilmiş ürünlerde hesaplanır; maliyet yoksa marj null döner — marjı UYDURMA, "maliyet girilmediği için hesaplanamıyor" de.',
  }
}

/* ───────────────────────── 4) Hammadde fiyat etkisi ───────────────────────── */
export async function hammaddeEtki(sb: SupabaseClient, arama: string, artisYuzde: number) {
  const ar = nrm(arama); if (!ar) throw new Error('arama boş')
  if (!Number.isFinite(artisYuzde) || Math.abs(artisYuzde) > 500) throw new Error('artis_yuzde -500 ile 500 arasında olmalı')
  const [hamm, rkalem, receteler, urunler] = await Promise.all([
    al(sb.from('hammaddeler').select('id,ad,birim,ortalama_maliyet,mevcut_stok').limit(3000)),
    al(sb.from('recete_kalemleri').select('recete_id,hammadde_id,miktar,birim').limit(20000)),
    al(sb.from('urun_receteleri').select('id,urun_id,aktif,notlar').eq('aktif', true).limit(2000)),
    al(sb.from('products').select('id,name,code').limit(2000)),
  ])
  const eslesen = hamm.filter(h => ar.split(/\s+/).every(t => nrm(h.ad).includes(t))).slice(0, 8)
  if (!eslesen.length) return { sonuc: 'Bu adla hammadde bulunamadı.', arama }
  const ids = new Set(eslesen.map(h => h.id)), rid = new Map(receteler.map(r => [r.id, r])), pm = new Map(urunler.map(p => [p.id, p]))
  const etki: any[] = []
  for (const k of rkalem) {
    if (!ids.has(k.hammadde_id) || !rid.has(k.recete_id)) continue
    const h = eslesen.find(x => x.id === k.hammadde_id)!, r = rid.get(k.recete_id)!, p = pm.get(r.urun_id)
    const bm = +h.ortalama_maliyet || 0, ek = (+k.miktar || 0) * bm * (artisYuzde / 100)
    etki.push({ urun: p ? `${p.name}${r.notlar ? ` (${r.notlar})` : ''}` : r.urun_id, hammadde: h.ad, kullanim: `${r2(k.miktar)} ${k.birim || h.birim || ''}`, birim_maliyet_girildi: bm > 0, birim_basina_ek_maliyet_tl: bm > 0 ? r2(ek) : null })
  }
  return {
    hammaddeler: eslesen.map(h => ({ ad: h.ad, birim: h.birim, ortalama_maliyet: +h.ortalama_maliyet || null, stok: r2(h.mevcut_stok) })), artis_yuzde: artisYuzde,
    etkilenen_urun_sayisi: etki.length, etkilenen: etki.slice(0, 25),
    not: 'Birim başına ek maliyet = reçetedeki miktar × hammaddenin sistemdeki ortalama maliyeti × artış yüzdesi. Hammaddenin ortalama maliyeti girilmemişse (birim_maliyet_girildi=false) TL etkisi hesaplanamaz; yalnızca hangi ürünlerin etkilendiği ve kullanım miktarı bilinir. Fiyata yansıtma kararı için güncel satış fiyatı ve marj gerekir.',
  }
}
