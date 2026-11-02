import type { SupabaseClient } from '@supabase/supabase-js'
import ExcelJS from 'exceljs'

// "ALYA DEPO GİRİŞ FİŞİ" şablonunda stok Excel'i (kullanıcının şablonu):
// STOK KODU | ÜRÜN İSMİ | KOLİ ADETİ | ÜRÜN ADETİ | KOLİ İÇİ ADET | TOPLAM m3 | BİRİM FİYAT | TUTAR | m3, altta GENEL TOPLAM / %10 İSK. / TOPLAM.
// Stok adedi ve koli içi adet satis_kod_stok'tan; koli m3 ve TL birim fiyat fiyat_listesi_urunleri'nden (renkli kodlar ana kodun değerini alır). Yalnızca stoğu > 0 olan kodlar yazılır.
export type StokMekan = 'dis' | 'ic'

async function hepsi(q: (bas: number) => PromiseLike<{ data: any[] | null; error: any }>) {
  const out: any[] = []
  for (let bas = 0; bas < 20000; bas += 1000) {
    const r = await q(bas); if (r.error) throw new Error(r.error.message)
    out.push(...(r.data || [])); if ((r.data || []).length < 1000) break
  }
  return out
}

const ince = { style: 'thin' as const }, kenar = { top: ince, left: ince, bottom: ince, right: ince }

export async function stokFisBuffer(sb: SupabaseClient, mekanlar: StokMekan[]) {
  const [stok, liste] = await Promise.all([
    hepsi(b => sb.from('satis_kod_stok').select('kod,ad,stok,mekan,koli_ici').order('kod').range(b, b + 999)),
    hepsi(b => sb.from('fiyat_listesi_urunleri').select('kod,koli_ici_adet,koli_m3,tl_fiyat,aktif').eq('aktif', true).range(b, b + 999)),
  ])
  const L = new Map<string, any>(); for (const x of liste) L.set(String(x.kod).trim(), x)
  const ana = (kod: string) => L.get(kod) || L.get(kod.replace(/[A-ZÇĞİÖŞÜ]+$/, '')) || null
  const wb = new ExcelJS.Workbook(); wb.creator = 'Alya Plastik'; wb.created = new Date()
  const bugun = new Date()
  for (const mekan of mekanlar) {
    const satirlar = stok.filter((r: any) => r.mekan === mekan && +r.stok > 0).sort((a: any, b: any) => String(a.kod).localeCompare(String(b.kod), 'tr', { numeric: true }))
    const ws = wb.addWorksheet(mekan === 'ic' ? 'İç Mekan Stok' : 'Dış Mekan Stok', { pageSetup: { orientation: 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 0 } })
    ws.columns = [{ width: 14 }, { width: 61 }, { width: 10 }, { width: 12 }, { width: 12 }, { width: 11 }, { width: 11 }, { width: 15 }, { width: 11 }]
    ws.mergeCells('A8:B10')
    const f = ws.getCell('A8'); f.value = 'ALYAPLAS PLASTİK SAN.TİC.LTD.ŞTİ.\nİKİTELLİ OSB MAH.İPKAS 4B BLOK NO:26-28\nPK: 34480 BAŞAKŞEHİR / ISTANBUL / TÜRKİYE\nE-MAİL : info@alyaplastik.com'; f.alignment = { wrapText: true, vertical: 'top', horizontal: 'left' }
    ws.getCell('G11').value = 'TARİH'; ws.getCell('G11').font = { name: 'Arial', size: 11, bold: true }; ws.getCell('G11').border = kenar
    const t = ws.getCell('I11'); t.value = bugun; t.numFmt = 'dd.mm.yyyy'; t.font = { name: 'Arial', size: 12, bold: true }; t.alignment = { horizontal: 'center' }; t.border = kenar
    ws.mergeCells('A13:H14')
    const b = ws.getCell('A13'); b.value = `ALYA DEPO GİRİŞ FİŞİ - ${mekan === 'ic' ? 'İÇ' : 'DIŞ'} MEKAN STOK`; b.font = { name: 'Arial', size: 14, bold: true }; b.alignment = { horizontal: 'center', vertical: 'middle' }
    ws.getRow(15).height = 49.2
    ;['STOK KODU', 'ÜRÜN İSMİ', 'KOLİ ADETİ', 'ÜRÜN ADETİ', 'KOLİ İÇİ ADET', 'TOPLAM m3', 'BİRİM FİYAT', 'TUTAR', 'm3'].forEach((h, i) => {
      const c = ws.getCell(15, i + 1); c.value = h; c.font = { name: 'Arial', size: 12, bold: true }; c.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }; c.border = kenar
    })
    let r = 16
    for (const x of satirlar) {
      const a = ana(String(x.kod).trim()), st = +x.stok, k = +x.koli_ici > 0 ? +x.koli_ici : (+a?.koli_ici_adet > 0 ? +a.koli_ici_adet : 0)
      const v: (string | number | { formula: string } | null)[] = [String(x.kod).trim(), String(x.ad || '').trim(), k ? Math.floor(st / k) : null, st, k || null, { formula: `I${r}*C${r}` }, a && +a.tl_fiyat > 0 ? +a.tl_fiyat : null, { formula: `G${r}*D${r}` }, a && +a.koli_m3 > 0 ? +a.koli_m3 : null]
      v.forEach((val, i) => {
        const c = ws.getCell(r, i + 1); c.value = val as any; c.font = { name: 'Arial', size: 12 }; c.border = kenar
        c.alignment = { horizontal: i === 1 ? 'left' : 'center' }
        if (i === 3 || i === 2 || i === 4) c.numFmt = '#,##0'; if (i === 5 || i === 7) c.numFmt = '#,##0.00'; if (i === 8) c.numFmt = '0.000'
      })
      r++
    }
    const son = r - 1, bas = 16
    const toplam = (satir: number, etiket: string, yazi: string, formul: string, sutun: string) => { const c = ws.getCell(`${sutun}${satir}`); c.value = { formula: formul }; c.numFmt = '#,##0.00'; c.font = { name: 'Arial', size: 12, bold: true }; c.border = kenar; if (etiket) { const e = ws.getCell(`${etiket}${satir}`); e.value = yazi; e.font = { name: 'Arial', size: 12, bold: true }; e.alignment = { horizontal: 'center' } } }
    ws.getCell(`C${r}`).value = 'GENEL TOPLAM'; ws.getCell(`C${r}`).font = { name: 'Arial', size: 12, bold: true }; ws.mergeCells(`C${r}:E${r}`)
    toplam(r, '', '', `SUBTOTAL(9,F${bas}:F${son})`, 'F'); toplam(r, '', '', `SUBTOTAL(9,H${bas}:H${son})`, 'H')
    ws.getCell(`F${r + 1}`).value = '%10 İSK.'; ws.getCell(`F${r + 1}`).font = { name: 'Arial', size: 12, bold: true }; ws.mergeCells(`F${r + 1}:G${r + 1}`); toplam(r + 1, '', '', `(H${r}*10)/100`, 'H')
    ws.getCell(`F${r + 2}`).value = 'TOPLAM'; ws.getCell(`F${r + 2}`).font = { name: 'Arial', size: 12, bold: true }; ws.mergeCells(`F${r + 2}:G${r + 2}`); toplam(r + 2, '', '', `H${r}-H${r + 1}`, 'H')
    ws.getCell(`B${r + 4}`).value = `Toplam ürün adedi: ${satirlar.reduce((t: number, x: any) => t + (+x.stok), 0).toLocaleString('tr-TR')} (${satirlar.length} kod)`; ws.getCell(`B${r + 4}`).font = { name: 'Arial', size: 11, italic: true }
    ws.pageSetup.printArea = `A8:I${r + 2}`
  }
  return wb.xlsx.writeBuffer()
}
