import ExcelJS from 'exceljs'

// Cari Hesaplar — Excel şablon / içe-dışa aktarma. Tek amaç: muhasebecinin Excel'de tuttuğu
// cari listesini toplu yükleyebilmesi (ekle veya kod eşleşirse güncelle) ve mevcut listeyi
// gerçek .xlsx olarak indirebilmesi. Kayıtları etkileyen bakiye/fatura gibi alanlara dokunulmaz.

export const TIP_ETIKET: Record<string, string> = { musteri: 'Müşteri', tedarikci: 'Tedarikçi', diger: 'Diğer' }
const TIP_TERS: Record<string, string> = { musteri: 'musteri', müşteri: 'musteri', tedarikci: 'tedarikci', tedarikçi: 'tedarikci', diger: 'diger', diğer: 'diger' }
const BASLIKLAR = ['Tip', 'Kod', 'Ad', 'Vergi No', 'Telefon', 'E-posta', 'Adres', 'Notlar', 'Fiyat Listesi']
const vergiGecerli = (v: string) => !v || /^\d{10}$|^\d{11}$/.test(v.replace(/\s/g, ''))

function basligiUygula(ws: ExcelJS.Worksheet) {
  const h = ws.addRow(BASLIKLAR)
  h.font = { bold: true, color: { argb: 'FFFFFFFF' } }
  h.eachCell(c => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2B2F2B' } } })
  ws.columns = [{ width: 12 }, { width: 14 }, { width: 28 }, { width: 14 }, { width: 16 }, { width: 24 }, { width: 30 }, { width: 24 }, { width: 20 }]
}

/** Boş şablon — Tip sütununda açılır liste, örnek satır ve kısa açıklama notu içerir. */
export async function cariSablonOlustur(fiyatListeleriAdlari: string[]): Promise<ExcelJS.Buffer> {
  const wb = new ExcelJS.Workbook(); wb.creator = 'Alya Plastik — Muhasebe'; wb.created = new Date()
  const ws = wb.addWorksheet('Cari Hesaplar')
  basligiUygula(ws)
  ws.addRow(['Müşteri', 'ALY-M001', 'Örnek Ticaret Ltd. Şti.', '1234567890', '+90 555 000 00 00', 'ornek@firma.com', 'Örnek Mah. Örnek Cad. No:1, İstanbul', '', fiyatListeleriAdlari[0] || ''])
  for (let r = 2; r <= 500; r++) ws.getCell(`A${r}`).dataValidation = { type: 'list', allowBlank: false, formulae: ['"Müşteri,Tedarikçi,Diğer"'] }

  const wn = wb.addWorksheet('Notlar')
  wn.getColumn(1).width = 100
  wn.addRow(['Doldurma kuralları']).font = { bold: true, size: 13 }
  for (const t of [
    '• Tip: Müşteri, Tedarikçi veya Diğer olmalı (A sütununda açılır liste var).',
    '• Ad zorunludur, diğer tüm alanlar isteğe bağlıdır.',
    '• Kod girilirse ve sistemde aynı kodlu bir cari varsa, o carinin bilgileri güncellenir; kod boşsa veya eşleşmezse yeni cari eklenir.',
    '• Vergi No / TC Kimlik No girilecekse 10 veya 11 haneli olmalı (boşluksuz).',
    '• Fiyat Listesi girilecekse sistemdeki fiyat listesi adıyla birebir aynı yazılmalı.',
    '• Dosyada tek bir satırda bile hata olursa hiçbir kayıt eklenmez/güncellenmez — hatalar listelenir, düzeltip yeniden yükleyebilirsin.',
    fiyatListeleriAdlari.length ? `Sistemdeki fiyat listeleri: ${fiyatListeleriAdlari.join(', ')}` : 'Sistemde henüz tanımlı fiyat listesi yok.',
  ]) wn.addRow([t])
  return wb.xlsx.writeBuffer()
}

/** Mevcut cari listesini gerçek .xlsx olarak dışa aktarır. */
export async function cariDisaAktarOlustur(cariler: any[]): Promise<ExcelJS.Buffer> {
  const wb = new ExcelJS.Workbook(); wb.creator = 'Alya Plastik — Muhasebe'; wb.created = new Date()
  const ws = wb.addWorksheet('Cari Hesaplar')
  basligiUygula(ws)
  const baslik2 = ws.getRow(1); baslik2.getCell(10).value = 'Bakiye'; baslik2.getCell(10).font = { bold: true, color: { argb: 'FFFFFFFF' } }; baslik2.getCell(10).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2B2F2B' } }
  ws.getColumn(10).width = 16
  for (const c of cariler) ws.addRow([TIP_ETIKET[c.tip] || c.tip, c.kod || '', c.ad, c.vergi_no || '', c.telefon || '', c.email || '', c.adres || '', c.notlar || '', c.fiyat_listesi_adi || '', +c.bakiye || 0])
  return wb.xlsx.writeBuffer()
}

export type CariSatirHata = { satir: number; mesaj: string }
export type CariSatirNormal = { tip: string; kod: string | null; ad: string; vergi_no: string | null; telefon: string | null; email: string | null; adres: string | null; notlar: string | null; fiyat_listesi_id: string | null }

/** Yüklenen .xlsx'i okur ve doğrular. Tek bir hata varsa hiçbir satır dönmez (tüm-ya-da-hiç). */
export async function cariSatirlariOku(buf: Buffer, fiyatListeleri: { id: string; ad: string }[]): Promise<{ hata: CariSatirHata[] } | { satirlar: CariSatirNormal[] }> {
  const wb = new ExcelJS.Workbook()
  try { await wb.xlsx.load(buf as any) } catch { return { hata: [{ satir: 0, mesaj: 'Dosya okunamadı — geçerli bir .xlsx dosyası olmalı.' }] } }
  const ws = wb.worksheets[0]
  if (!ws) return { hata: [{ satir: 0, mesaj: 'Dosyada sayfa bulunamadı.' }] }

  const flMap = new Map(fiyatListeleri.map(f => [f.ad.trim().toLocaleLowerCase('tr'), f.id]))
  const hata: CariSatirHata[] = []
  const satirlar: CariSatirNormal[] = []
  const kodlarBu = new Map<string, number>() // kod(upper) -> ilk göründüğü satır

  for (let r = 2; r <= ws.rowCount; r++) {
    const row = ws.getRow(r)
    const deger = (i: number) => String(row.getCell(i).value ?? '').trim()
    const [tipHam, kodHam, ad, vergiHam, telefon, email, adres, notlar, flAdi] = [1, 2, 3, 4, 5, 6, 7, 8, 9].map(deger)
    if (![tipHam, kodHam, ad, vergiHam, telefon, email, adres, notlar, flAdi].some(Boolean)) continue // tamamen boş satır

    if (!ad) { hata.push({ satir: r, mesaj: 'Ad boş olamaz' }); continue }
    const tip = TIP_TERS[tipHam.toLocaleLowerCase('tr')]
    if (!tip) { hata.push({ satir: r, mesaj: `Tip geçersiz ("${tipHam || 'boş'}") — Müşteri, Tedarikçi veya Diğer olmalı` }); continue }
    const vergi_no = vergiHam.replace(/\s/g, '') || null
    if (vergi_no && !vergiGecerli(vergi_no)) { hata.push({ satir: r, mesaj: `Vergi No / TC "${vergiHam}" 10 veya 11 haneli olmalı` }); continue }
    let fiyat_listesi_id: string | null = null
    if (flAdi) {
      const bulunan = flMap.get(flAdi.trim().toLocaleLowerCase('tr'))
      if (!bulunan) { hata.push({ satir: r, mesaj: `Fiyat listesi bulunamadı: "${flAdi}"` }); continue }
      fiyat_listesi_id = bulunan
    }
    const kod = kodHam.toUpperCase() || null
    if (kod) {
      const ilk = kodlarBu.get(kod)
      if (ilk) { hata.push({ satir: r, mesaj: `Kod "${kod}" ${ilk}. satırla çakışıyor (dosya içinde tekrar ediyor)` }); continue }
      kodlarBu.set(kod, r)
    }
    satirlar.push({ tip, kod, ad, vergi_no, telefon: telefon || null, email: email || null, adres: adres || null, notlar: notlar || null, fiyat_listesi_id })
  }

  if (hata.length) return { hata }
  if (!satirlar.length) return { hata: [{ satir: 0, mesaj: 'Dosyada geçerli satır bulunamadı.' }] }
  return { satirlar }
}
