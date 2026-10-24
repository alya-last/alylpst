import type { SupabaseClient } from '@supabase/supabase-js'
import ExcelJS from 'exceljs'

export type Sayfa = { ad: string; sutunlar: string[]; satirlar: (string | number | null)[][] }
const SINIR = { sayfa: 12, satir: 5000, sutun: 24, hucre: 150000 }

// Araç çıktısındaki ASCII alan adlarını okunur Türkçeye çevirir ("odeme_kaydi_olmayan" → "Ödeme kaydı olmayan")
const TR_KELIME: Record<string, string> = { plani: 'planı', her: 'her', ayin: 'ayın', odeme: 'ödeme', odemeler: 'ödemeler', kaydi: 'kaydı', katilim: 'katılım', gore: 'göre', musteri: 'müşteri', satirlar: 'satırlar', satir: 'satır', aciklama: 'açıklama', siparis: 'sipariş', urun: 'ürün', urunler: 'ürünler', uretim: 'üretim', yil: 'yıl', yillar: 'yıllar', gelis: 'geliş', yatis: 'yatış', gunu: 'günü', gun: 'gün', edis: 'ediş', ozet: 'özet', cek: 'çek', portfoy: 'portföy', fuar: 'fuar', alinan: 'alınan', alindi: 'alındı', bekleyen: 'bekleyen', bekleyenler: 'bekleyenler', yatanlar: 'yatanlar', dagilimi: 'dağılımı', dagilim: 'dağılım', kisaltildi: 'kısaltıldı', birimi: 'birimi', birimine: 'birimine', tutari: 'tutarı', kayitli: 'kayıtlı', bilgisi: 'bilgisi', olmayan: 'olmayan', sayisi: 'sayısı', adedi: 'adedi', kalan: 'kalan', odenen: 'ödenen', borc: 'borç', ihracat: 'ihracat', hesap: 'hesap', hesaplar: 'hesaplar', sirket: 'şirket', ay: 'ay', hafta: 'hafta', normalden: 'normalden', uzun: 'uzun', son: 'son', satirlari: 'satırları', elden: 'elden', ev: 'ev', sahibi: 'sahibi', odeme_gunu: 'ödeme günü', tarihi: 'tarihi', gecikme: 'gecikme', gecikmis: 'gecikmiş', acik: 'açık', degisim: 'değişim', degeri: 'değeri', miktar: 'miktar', min: 'min', stok: 'stok', birim: 'birim', toplam: 'toplam', genel: 'genel', adet: 'adet' }
const guzel = (k: string) => { const s = String(k).replace(/[_.]+/g, ' ').trim().split(/\s+/).map(w => TR_KELIME[w.toLowerCase()] ?? w).join(' '); return s ? s[0].toLocaleUpperCase('tr-TR') + s.slice(1) : '' }
const duz = (v: unknown): string | number | null => v == null ? null : typeof v === 'number' ? v : typeof v === 'boolean' ? (v ? 'Evet' : 'Hayır') : typeof v === 'object' ? JSON.stringify(v) : String(v)
const tekil = (ad: string, kul: Set<string>) => { let a = guzel(ad).replace(/[\\/?*[\]:]/g, ' ').slice(0, 28) || 'Sayfa', i = 2, b = a; while (kul.has(b.toLowerCase())) b = `${a.slice(0, 26)} ${i++}`; kul.add(b.toLowerCase()); return b }

// Bir araç çıktısındaki (JSON) nesne listelerini sayfalara, düz alanları "Özet" sayfasına çevirir. Sayı ve yazıları olduğu gibi taşır.
export function jsonTablolar(veri: unknown): Sayfa[] {
  const out: Sayfa[] = [], ozet: [string, string | number | null][] = []
  const dolas = (v: any, yol: string, derin: number) => {
    if (Array.isArray(v)) {
      if (!v.length) return
      if (v.every(x => x && typeof x === 'object' && !Array.isArray(x))) {
        const anahtar: string[] = []
        const duzles = (o: any, on = ''): Record<string, any> => { const r: Record<string, any> = {}; for (const [k, x] of Object.entries(o)) { if (x && typeof x === 'object' && !Array.isArray(x) && on.split('.').length < 3) Object.assign(r, duzles(x, on + k + '.')); else r[on + k] = x } return r }
        const duzSatirlar = v.map(o => duzles(o))
        duzSatirlar.forEach(r => Object.keys(r).forEach(k => { if (!anahtar.includes(k)) anahtar.push(k) }))
        out.push({ ad: yol || 'Liste', sutunlar: anahtar.map(guzel), satirlar: duzSatirlar.map(r => anahtar.map(k => duz(r[k]))) })
      } else out.push({ ad: yol || 'Liste', sutunlar: ['Değer'], satirlar: v.map(x => [duz(x)]) })
      return
    }
    if (v && typeof v === 'object') {
      for (const [k, x] of Object.entries(v)) {
        if (x && typeof x === 'object' && derin < 3) dolas(x, yol ? `${yol} ${k}` : k, derin + 1)
        else ozet.push([yol ? `${yol} ${k}` : k, duz(x)])
      }
    }
  }
  dolas(veri, '', 0)
  if (ozet.length) out.unshift({ ad: 'Özet', sutunlar: ['Alan', 'Değer'], satirlar: ozet.map(([k, x]) => [guzel(k), x]) })
  return out
}

// Sayfaları sınırlara uydurur ve kaydeder; indirme yolunu döndürür.
export async function excelKaydet(sb: SupabaseClient, baslik: string, sayfalar: Sayfa[]) {
  const ad = new Set<string>(); let hucre = 0
  const temiz = sayfalar.filter(s => s.satirlar.length && s.sutunlar.length).slice(0, SINIR.sayfa).map(s => {
    const sut = s.sutunlar.slice(0, SINIR.sutun).map(x => String(x).slice(0, 80))
    const sat = s.satirlar.slice(0, SINIR.satir).map(r => sut.map((_, i) => { const v = duz(r[i]); return typeof v === 'string' ? v.slice(0, 1000) : v }))
    hucre += sat.length * sut.length
    return { ad: tekil(s.ad, ad), sutunlar: sut, satirlar: sat }
  })
  if (!temiz.length) throw new Error('Excel için tablo verisi yok')
  if (hucre > SINIR.hucre) throw new Error('Tablo çok büyük; tarih aralığı ya da süzgeçle daraltın')
  await sb.from('ai_excel').delete().lt('created_at', new Date(Date.now() - 7 * 86400000).toISOString())
  const { data, error } = await sb.from('ai_excel').insert({ baslik: baslik.slice(0, 120) || 'Rapor', sayfalar: temiz }).select('id').single()
  if (error) throw new Error(error.message)
  return { yol: `/api/admin/ai-excel?id=${data.id}`, sayfalar: temiz.map(s => ({ ad: s.ad, satir: s.satirlar.length })) }
}

const SAYI_YIL = /y[ıi]l|^no$|kod|s[ıi]ra|^id$|telefon|vergi/i
export async function excelBuffer(baslik: string, sayfalar: Sayfa[]) {
  const wb = new ExcelJS.Workbook(); wb.creator = 'Alya Plastik'; wb.created = new Date(); wb.title = baslik
  for (const s of sayfalar) {
    const ws = wb.addWorksheet(s.ad, { views: [{ state: 'frozen', ySplit: 1, showGridLines: false }] })
    const h = ws.addRow(s.sutunlar); h.height = 24
    h.eachCell(c => { c.font = { bold: true, color: { argb: 'FFFFFFFF' } }; c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2B2F2B' } }; c.alignment = { vertical: 'middle', wrapText: true } })
    for (const r of s.satirlar) { const x = ws.addRow(r); x.eachCell(c => { c.border = { bottom: { style: 'hair', color: { argb: 'FFD0D0D0' } } }; if (typeof c.value === 'number') c.alignment = { horizontal: 'right' } }) }
    s.sutunlar.forEach((baslikAd, i) => {
      const col = ws.getColumn(i + 1), ornek = s.satirlar.slice(0, 200).map(r => r[i]), sayisal = ornek.filter(v => typeof v === 'number') as number[]
      if (sayisal.length && !SAYI_YIL.test(baslikAd)) col.numFmt = sayisal.every(Number.isInteger) ? '#,##0' : '#,##0.00'
      col.width = Math.min(48, Math.max(10, baslikAd.length + 2, ...ornek.map(v => String(v ?? '').length + 2)))
    })
  }
  return wb.xlsx.writeBuffer()
}
