// Yapay zeka "hazır cevap" testi: sorular doğru cevaba yönleniyor mu, rakamlar kayıtlarla tutuyor mu?
// Çalıştır: node --experimental-strip-types scripts/ai-test.mts
import { soruNiyeti, cekYaniti, kasaYaniti, kiraYaniti, type CekSatir } from '../src/lib/ai-hazir.ts'

const T = 'Garanti Bankası takas'
const rows: CekSatir[] = [
  { tip: 'senet', yon: 'alinan', tutar: 250000, vade_tarihi: '2026-10-10', durum: 'ciro_edildi', banka: 'SENET', aciklama: T, cari: 'GÜRHAN PEYZAJ' },
  { tip: 'cek', yon: 'alinan', tutar: 208560, vade_tarihi: '2026-10-20', durum: 'ciro_edildi', banka: 'ZİRAAT BANKASI', aciklama: T, cari: 'NİL PEYZAJ' },
  { tip: 'cek', yon: 'alinan', tutar: 218147, vade_tarihi: '2026-10-22', durum: 'ciro_edildi', banka: 'QNB BANK', aciklama: T, cari: 'YANKO' },
  { tip: 'cek', yon: 'alinan', tutar: 672225, vade_tarihi: '2026-10-30', durum: 'ciro_edildi', banka: 'ZİRAAT BANKASI', aciklama: T, cari: 'NEMA' },
  { tip: 'cek', yon: 'alinan', tutar: 1152000, vade_tarihi: '2026-12-15', durum: 'ciro_edildi', banka: 'DENİZBANK', aciklama: T, cari: 'KARDEŞLER 2020' },
  { tip: 'cek', yon: 'alinan', tutar: 192360, vade_tarihi: '2026-12-01', durum: 'portfoyde', banka: 'ZİRAAT BANKASI', resmiyet: 'gayri_resmi', cari: 'KOCAMAN BAHRİ' },
  { tip: 'cek', yon: 'alinan', tutar: 350000, vade_tarihi: '2026-12-15', durum: 'portfoyde', banka: 'TÜRKİYE FİNANS', resmiyet: 'gayri_resmi', cari: 'VERDE PEYZAJ' },
  { tip: 'cek', yon: 'alinan', tutar: 49344, vade_tarihi: '2026-12-31', durum: 'portfoyde', banka: 'ZİRAAT BANKASI', resmiyet: 'resmi', cari: 'ACARSAN' },
  { tip: 'cek', yon: 'alinan', tutar: 200000, vade_tarihi: '2027-01-12', durum: 'portfoyde', banka: 'VAKIFBANK', resmiyet: 'gayri_resmi', cari: 'KARDEŞLER 2020' },
  { tip: 'senet', yon: 'alinan', tutar: 125000, vade_tarihi: '2026-07-15', durum: 'karsiliksiz', banka: 'SENET', cari: 'VTK' },
  { tip: 'senet', yon: 'alinan', tutar: 100000, vade_tarihi: '2026-08-15', durum: 'karsiliksiz', banka: 'SENET', cari: 'VTK' },
  { tip: 'cek', yon: 'alinan', tutar: 150000, vade_tarihi: '2026-07-25', durum: 'tahsil_edildi', aciklama: T, resmiyet: 'resmi', cari: 'OSMAN CIRASUN' },
]

// [soru, beklenen niyet]  — null = yapay zekaya bırakılmalı
const sorular: [string, string | null][] = [
  ['Elimizde kalan çekler', 'cek_elde'],
  ['elimde kalan senetler var mı', 'cek_elde'],
  ['kasamızdaki çekler hangileri', 'cek_elde'],
  ['portföydeki çekler', 'cek_elde'],
  ['takas işlemi kapsamında elinizde bulunan çekler ve senetler vadelerine göre ayrı ayrı', 'cek_takas'],
  ['garanti takasta kaç çek var', 'cek_takas'],
  ['bankada tahsilde olan çekler', 'cek_takas'],
  ['takasa çıkan çekler', 'cek_takas'],
  ['takas çek ve senetlerimizin durumu', 'cek_genel'],
  ['çek senet durumu', 'cek_genel'],
  ['çek ve senet özeti', 'cek_genel'],
  ['toplam kaç çek var', 'cek_genel'],
  ['karşılıksız çek var mı', 'cek_karsiliksiz'],
  ['karşılıksız çıkanlar hangileri çek senet', 'cek_karsiliksiz'],
  ['kasa bakiyesi ne kadar', 'kasa_banka'],
  ['banka hesaplarında ne kadar var', 'kasa_banka'],
  ['kasa banka durumu', 'kasa_banka'],
  ['kira ödemelerimi nasıl yapıyorum elden ve bankadan bilgi verirmisin', 'kira_duzeni'],
  ['kira ödeme düzenimiz nedir', 'kira_duzeni'],
  ['kiralar elden mi bankadan mı', 'kira_duzeni'],
  // Bunlar yapay zekaya gitmeli
  ['Eylül kirası ne kadar', null],
  ['kira giderimiz bu yıl ne kadar', null],
  ['bu hafta vadesi gelen çekler', null],
  ['Yanko firmasının çeki var mı', null],
  ['ES POLİMER bakiyesi ne kadar', null],
  ['dolar kuru ne olur', null],
  ['gelecek ay nakit yeter mi', null],
  ['Ekim ciro ne kadar', null],
]

let hata = 0
const kontrol = (ad: string, ok: boolean, detay = '') => { if (!ok) { hata++; console.log('✗', ad, detay) } else console.log('✓', ad) }

for (const [s, b] of sorular) { const n = soruNiyeti(s); kontrol(`niyet: "${s}"`, n === b, `beklenen=${b} gelen=${n}`) }

const tl = (n: number) => n.toLocaleString('tr-TR', { minimumFractionDigits: 2 }) + ' TL'
const takas = cekYaniti('cek_takas', rows), elde = cekYaniti('cek_elde', rows), kars = cekYaniti('cek_karsiliksiz', rows), genel = cekYaniti('cek_genel', rows)
kontrol('takas: 4 çek + 1 senet', takas.includes('4 çek + 1 senet'))
kontrol('takas: toplam 2.500.932,00', takas.includes(tl(2500932)))
kontrol('takas: senet vade sırasında ilk', takas.indexOf('10.10.2026') < takas.indexOf('20.10.2026'))
kontrol('takas: eldeki çek karışmadı', !takas.includes('KOCAMAN') && !takas.includes('ACARSAN'))
kontrol('elde: 4 çek, 791.704,00', elde.includes('4 çek') && elde.includes(tl(791704)))
kontrol('elde: takastaki karışmadı', !elde.includes('NEMA') && !elde.includes('YANKO'))
kontrol('elde: senet yok', !elde.includes('senet —') && !elde.includes('+ 1 senet'))
kontrol('karşılıksız: 2 senet, 225.000', kars.includes('2 senet') && kars.includes(tl(225000)) && !kars.includes('2 çek'))
kontrol('genel: elde+takas+karşılıksız satırları', genel.includes('4 çek — ' + tl(791704)) && genel.includes('4 çek + 1 senet — ' + tl(2500932)) && genel.includes('2 senet — ' + tl(225000)))
const kasa = kasaYaniti([
  { ad: 'GARANTİ TL', para_birimi: 'TRY', bakiye: 1911618.96 }, { ad: 'GARANTİ USD', para_birimi: 'USD', bakiye: 50540.37 },
  { ad: 'GARANTİ EUR', para_birimi: 'EUR', bakiye: 21774.85 }, { ad: 'ESKİ', para_birimi: 'TRY', bakiye: 5, aktif: false },
])
kontrol('kasa: TL 1.911.618,96 ve USD ayrı', kasa.includes('1.911.618,96 TL') && kasa.includes('50.540,37 USD') && !kasa.includes('ESKİ'))
const kira = kiraYaniti([
  { ev_sahibi: 'Adem Gökçel', odeme_gunu: 15, banka: 100000, elden: 185000, not_: 'Sözleşme 15.07.2026' },
  { ev_sahibi: 'Ayten Özyılmaz', odeme_gunu: 1, banka: 230000, elden: 180000 },
  { ev_sahibi: 'Nurettin Aldemir', odeme_gunu: 15, banka: 100000, elden: 120000 },
])
kontrol('kira: Ayten ilk (ayın 1\'i), toplam 915.000', kira.indexOf('Ayten') < kira.indexOf('Nurettin') && kira.includes(tl(915000)) && kira.includes(tl(430000)) && kira.includes(tl(485000)))
kontrol('kira: Ayten 410.000', kira.includes(tl(410000)))
console.log(hata ? `\n${hata} HATA` : '\nTÜM TESTLER GEÇTİ'); process.exit(hata ? 1 : 0)
