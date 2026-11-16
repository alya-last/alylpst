// İmalat analizi: muhasebecinin "İMALAT ANALİZİ" şablonu (ana malzeme: PP, random kopolimer, kristal, boya).
// Şablon formülleri aynen: G = E×F (kapasite/reçete 1 adet malzemesi × üretilen adet), K = I×J (alış kg × birim fiyat), N = I×M (fire).
// Veri: iç mekan üretim (Mikro ÜRETİM giriş fişleri) × reçete; alışlar stok_hareketleri (satinalma). Excel'de canlı formül kullanılır.
import type { SupabaseClient } from '@supabase/supabase-js'
import ExcelJS from 'exceljs'

export const AYLAR = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık']
const KAPASITE = { kg: 60541, adet: 184000 } // şablondaki "kapasite raporuna göre aylık üretim miktarı"
const BOYA_ORAN = 0.02 // reçetede boya yoksa: reçete hammadde ağırlığının %2'si (tahmin)
const FIRE = 0.05

type GrupAd = 'PP' | 'KOP' | 'KRI' | 'BOYA' | 'DIGER' | 'ROT'
const GRUPLAR: { k: GrupAd; ad: string }[] = [
  { k: 'PP', ad: 'POLİPROPİLEN (PP)' }, { k: 'KOP', ad: 'POLİPROPİLEN RANDOM KOPOLİMER' }, { k: 'KRI', ad: 'POLİSİTREN (KRİSTAL)' }, { k: 'BOYA', ad: 'PLASTİK BOYASI' }, { k: 'DIGER', ad: 'DİĞER HAMMADDE (feyat/siyah granür vb.)' }, { k: 'ROT', ad: 'ROTASYON HAM MADDE' },
]
const nrm = (v: unknown) => String(v ?? '').toLocaleLowerCase('tr').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ı/g, 'i')
function grupBul(kod: string, ad: string): GrupAd {
  const a = nrm(ad), k = String(kod || '').replace(/\s+/g, '').toUpperCase()
  if (k.startsWith('15002') || /boya|masterbatch/.test(a)) return 'BOYA'
  if (/copolimer|kopolimer|random|gramaj/.test(a)) return 'KOP'
  if (/kristal|polistiren/.test(a)) return 'KRI'
  if (/moblen|polipropilen|\bpp\b|compakt pp/.test(a)) return 'PP'
  return 'DIGER'
}

/** Gelir tablosu kaydı ("[Aylık tablo] Mart 2026 - KULLANILAN MOBLEN (55.421 KG*1,30 USD)") → malzeme grubu + kg. Malzeme kalemi değilse null. */
function sayiTR(t: string): number {
  const v = t.replace(/\s/g, '')
  if (v.includes('.') && v.includes(',')) return parseFloat(v.replace(/\./g, '').replace(',', '.'))
  if (v.includes(',')) return /,\d{3}$/.test(v) ? parseFloat(v.replace(',', '')) : parseFloat(v.replace(',', '.'))
  if (v.includes('.')) return /\.\d{3}$/.test(v) ? parseFloat(v.replace(/\./g, '')) : parseFloat(v)
  return parseFloat(v)
}
export function gelirKalem(aciklama: string): { g: GrupAd; kg: number } | null {
  const ad = nrm(aciklama.replace(/^\[Aylık tablo\][^-]*-/i, ''))
  let g: GrupAd | null = null
  if (/rotasyon/.test(ad)) g = 'ROT'
  else if (/\bboya/.test(ad)) g = 'BOYA'
  else if (/kristal|krsital/.test(ad)) g = 'KRI'
  else if (/granur/.test(ad)) g = 'DIGER'
  else if (/copolimer|kopolimer/.test(ad)) g = 'KOP'
  else if (/gramaj ek/.test(ad)) g = 'DIGER'
  else if (/moblen|ham ?madde|\bpp\b/.test(ad)) g = 'PP'
  if (!g) return null // koli, poşet vb. malzeme değil
  const m = /([\d.,\s]*\d)\s*(?:kg\s*)*\*/i.exec(aciklama.replace(/^\[Aylık tablo\][^-]*-/i, '').replace(/K\s*G/gi, ' KG '))
  const kg = m ? sayiTR(m[1]) : NaN
  return kg > 0 ? { g, kg } : null
}

async function sayfala(sb: SupabaseClient, tablo: string, kolon: string, f?: (q: any) => any): Promise<any[]> {
  const out: any[] = []
  for (let bas = 0; bas < 60000; bas += 1000) {
    let q: any = sb.from(tablo).select(kolon).order('id').range(bas, bas + 999)
    if (f) q = f(q)
    const r = await q
    if (r.error) throw new Error(r.error.message)
    out.push(...(r.data || []))
    if ((r.data || []).length < 1000) break
  }
  return out
}

export type ImalatSatir = { grup: GrupAd; ad: string; e: number; f: number; g: number; i: number; j: number; varsayim?: boolean; kaynak?: 'gelir' | 'alis' | 'varsayim' } // varsayim: alış kaydı yok, i = olması gereken miktar, j = hammadde kartı ortalama maliyeti
export type ImalatAy = { ay: number; mukerrer: number; adet: number; adetR: number; kg: number; satirlar: ImalatSatir[]; receteYok: { kod: string; ad: string; adet: number }[]; urunSay: number }
export type ImalatVeri = { yil: number; bas: number; bit: number; urun: string; aylar: ImalatAy[]; toplam: ImalatAy; kayit: boolean }

export async function imalatVeri(sb: SupabaseClient, yil: number, bas: number, bit: number, saksi: boolean): Promise<ImalatVeri> {
  const d0 = `${yil}-${String(bas).padStart(2, '0')}-01`, d1 = bit === 12 ? `${yil + 1}-01-01` : `${yil}-${String(bit + 1).padStart(2, '0')}-01` // sonraki ayın 1'i (hariç)
  const [uret, ps, rs, rk, hm, gl, hr] = await Promise.all([
    sayfala(sb, 'uretim_girisleri', 'tarih,kod,ad,mekan,adet', q => q.eq('mekan', 'ic').gte('tarih', d0).lt('tarih', d1)),
    sayfala(sb, 'products', 'id,code'), sayfala(sb, 'urun_receteleri', 'id,urun_id,aktif,notlar,versiyon'), sayfala(sb, 'recete_kalemleri', 'recete_id,hammadde_id,miktar'),
    sayfala(sb, 'hammaddeler', 'id,kod,ad,ortalama_maliyet'),
    sayfala(sb, 'islemler', 'tarih,tutar,aciklama,kategori', q => q.eq('tip', 'gider').ilike('aciklama', '[Aylık tablo]%').gte('tarih', d0).lt('tarih', d1)),
    sayfala(sb, 'stok_hareketleri', 'hammadde_id,tarih,tip,yon,miktar,birim_maliyet', q => q.eq('tip', 'satinalma').eq('yon', 'giris').gte('tarih', d0).lt('tarih', d1)),
  ])
  const pk = new Map<string, string>(ps.map((p: any) => [p.id, p.code])), hmAd = new Map<string, { kod: string; ad: string }>(hm.map((h: any) => [h.id, { kod: String(h.kod || ''), ad: String(h.ad || '') }]))
  const kal = new Map<string, { g: GrupAd; kg: number }[]>()
  for (const k of rk) { const h = hmAd.get(k.hammadde_id); if (!h) continue; const l = kal.get(k.recete_id) || []; l.push({ g: grupBul(h.kod, h.ad), kg: +k.miktar || 0 }); kal.set(k.recete_id, l) }
  const rec = new Map<string, { g: GrupAd; kg: number }[]>()
  for (const r of [...rs].filter((x: any) => x.aktif !== false && kal.has(x.id)).sort((x: any, y: any) => (+x.versiyon || 0) - (+y.versiyon || 0))) {
    const k = /\[([^\]]+)\]/.exec(r.notlar || '')?.[1] || pk.get(r.urun_id)
    if (k && !rec.has(k)) rec.set(k, kal.get(r.id) as any)
  }
  const fyG: Record<GrupAd, number[]> = { PP: [], KOP: [], KRI: [], BOYA: [], DIGER: [], ROT: [] }
  for (const h of hm) { const f = +h.ortalama_maliyet || 0; if (f > 0) fyG[grupBul(String(h.kod || ''), String(h.ad || ''))].push(f) }
  const fyOrt = (k: GrupAd) => fyG[k].length ? fyG[k].reduce((t, x) => t + x, 0) / fyG[k].length : 0
  const uygun = (ad: string) => !saksi || /saks[ıiİI]/i.test(ad)
  const rows = uret.filter((x: any) => uygun(String(x.ad || ''))).map((x: any) => ({ ay: +String(x.tarih).slice(5, 7), kod: String(x.kod || '').trim(), ad: String(x.ad || '').replace(/\s+/g, ' ').trim(), adet: +x.adet || 0 }))
  const alisVar = new Set<GrupAd>() // dönemde en az bir satın alma kaydı olan malzeme grupları
  for (const x of hr) { const h = hmAd.get(x.hammadde_id); if (h && !h.kod.replace(/\s+/g, '').startsWith('73') && (+x.miktar || 0) > 0) alisVar.add(grupBul(h.kod, h.ad)) }
  const aylar: ImalatAy[] = []
  for (let a = bas; a <= bit; a++) {
    const ar = rows.filter(r => r.ay === a), g: Record<GrupAd, number> = { PP: 0, KOP: 0, KRI: 0, BOYA: 0, DIGER: 0, ROT: 0 }
    const yok = new Map<string, { kod: string; ad: string; adet: number }>(); let adet = 0, adetR = 0, mukerrer = 0
    for (const r of ar) {
      adet += r.adet
      const bk = r.kod.replace(/^((?:ALYG|ALY)-\d+)[A-Z]{1,3}$/, '$1'), parca = /(T|WT)$/.test(r.kod.slice(bk.length)) && bk !== r.kod // tabak/teker parçası: ana ürün reçetesi uygulanmaz
      const k = rec.get(r.kod) || (!parca && bk !== r.kod ? rec.get(bk) : undefined) // renk ekli kodlar (ALY-906A) ana kod reçetesini kullanır
      if (!k) { const o = yok.get(r.kod) || { kod: r.kod, ad: r.ad, adet: 0 }; o.adet += r.adet; yok.set(r.kod, o); continue }
      adetR += r.adet
      for (const p of k) g[p.g] += p.kg * r.adet
    }
    if (!g.BOYA) g.BOYA = (g.PP + g.KOP + g.KRI + g.DIGER) * BOYA_ORAN
    const al: Record<GrupAd, { kg: number; tl: number; pkg: number }> = { PP: { kg: 0, tl: 0, pkg: 0 }, KOP: { kg: 0, tl: 0, pkg: 0 }, KRI: { kg: 0, tl: 0, pkg: 0 }, BOYA: { kg: 0, tl: 0, pkg: 0 }, DIGER: { kg: 0, tl: 0, pkg: 0 }, ROT: { kg: 0, tl: 0, pkg: 0 } }
    const gk: Record<GrupAd, { kg: number; tl: number }> = { PP: { kg: 0, tl: 0 }, KOP: { kg: 0, tl: 0 }, KRI: { kg: 0, tl: 0 }, BOYA: { kg: 0, tl: 0 }, DIGER: { kg: 0, tl: 0 }, ROT: { kg: 0, tl: 0 } }
    for (const x of gl) {
      if (+String(x.tarih).slice(5, 7) !== a || !(String(x.kategori || '') === 'Kullanılan Malzeme' || /\[Üretim\]/.test(String(x.aciklama)))) continue
      const k = gelirKalem(String(x.aciklama || '')); if (!k) continue
      gk[k.g].kg += k.kg; gk[k.g].tl += +x.tutar || 0
    }
    const gorulen = new Set<string>()
    for (const x of hr) {
      if (+String(x.tarih).slice(5, 7) !== a || String(x.tarih).slice(0, 4) !== String(yil)) continue
      const h = hmAd.get(x.hammadde_id); if (!h) continue
      const gk = grupBul(h.kod, h.ad); if (h.kod.replace(/\s+/g, '').startsWith('73')) continue // koli/etiket ana malzeme değil
      const kg = +x.miktar || 0, fy = +x.birim_maliyet || 0, anahtar = `${x.hammadde_id}|${x.tarih}|${kg}|${fy}`
      if (fy > 0 && gorulen.has(anahtar)) { mukerrer++; continue } // aynı gün/miktar/fiyatlı mükerrer satın alma kaydı bir kez sayılır
      gorulen.add(anahtar)
      al[gk].kg += kg; if (fy > 0) { al[gk].tl += kg * fy; al[gk].pkg += kg }
    }
    // Öncelik: gelir tablosundaki kayıtlı kullanım (kg + tutar); yoksa stok alışları; o da yoksa olması gereken miktar (varsayım)
    const satirlar: ImalatSatir[] = GRUPLAR.filter(x => (x.k !== 'DIGER' && x.k !== 'ROT') || g[x.k] > 0 || al[x.k].kg > 0 || gk[x.k].kg > 0).map(x => {
      const base = { grup: x.k, ad: x.ad, e: adetR ? g[x.k] / adetR : 0, f: adetR, g: g[x.k] }
      if (gk[x.k].kg > 0) return { ...base, i: gk[x.k].kg, j: gk[x.k].tl / gk[x.k].kg, kaynak: 'gelir' as const }
      if (alisVar.has(x.k)) return { ...base, i: al[x.k].kg, j: al[x.k].pkg ? al[x.k].tl / al[x.k].pkg : 0, kaynak: 'alis' as const }
      return { ...base, i: g[x.k], j: fyOrt(x.k), varsayim: true, kaynak: 'varsayim' as const }
    })
    aylar.push({ ay: a, adet, adetR, kg: g.PP + g.KOP + g.KRI + g.DIGER, satirlar, mukerrer, receteYok: [...yok.values()].sort((p, q) => q.adet - p.adet), urunSay: new Set(ar.map(r => r.kod)).size })
  }
  // Toplam: miktarlar toplanır, birim fiyat alış kg ağırlıklı
  const adetT = aylar.reduce((t, x) => t + x.adet, 0), adetRT = aylar.reduce((t, x) => t + x.adetR, 0), tl = (gk: GrupAd) => aylar.reduce((t, x) => { const s = x.satirlar.find(y => y.grup === gk); return t + (s ? s.i * s.j : 0) }, 0), pks = (gk: GrupAd) => aylar.reduce((t, x) => { const s = x.satirlar.find(y => y.grup === gk); return t + (s && s.j > 0 ? s.i : 0) }, 0)
  const topSat = GRUPLAR.map(x => {
    const ss = aylar.map(a => a.satirlar.find(y => y.grup === x.k)).filter(Boolean) as ImalatSatir[]
    if (!ss.length) return null
    const g = ss.reduce((t, s) => t + s.g, 0), i = ss.reduce((t, s) => t + s.i, 0)
    return { grup: x.k, ad: x.ad, e: adetRT ? g / adetRT : 0, f: adetRT, g, i, j: pks(x.k) ? tl(x.k) / pks(x.k) : ss.every(z => z.varsayim) ? ss[0].j : 0, ...(ss.some(z => z.varsayim) ? { varsayim: true } : {}), kaynak: ss.every(z => z.kaynak === 'gelir') ? 'gelir' : ss.some(z => z.varsayim) ? 'varsayim' : 'alis' } as ImalatSatir
  }).filter(Boolean) as ImalatSatir[]
  const yokT = new Map<string, { kod: string; ad: string; adet: number }>()
  for (const a of aylar) for (const y of a.receteYok) { const o = yokT.get(y.kod) || { ...y, adet: 0 }; o.adet += y.adet; yokT.set(y.kod, o) }
  const toplam: ImalatAy = { ay: 0, mukerrer: aylar.reduce((t, x) => t + x.mukerrer, 0), adet: adetT, adetR: adetRT, kg: aylar.reduce((t, x) => t + x.kg, 0), satirlar: topSat, receteYok: [...yokT.values()].sort((p, q) => q.adet - p.adet), urunSay: new Set(rows.map(r => r.kod)).size }
  return { yil, bas, bit, urun: saksi ? 'SAKSI' : 'İÇ MEKAN ÜRÜNLERİ', aylar, toplam, kayit: adetT > 0 }
}

const ince = { style: 'thin' as const }, kenar = { top: ince, bottom: ince, left: ince, right: ince }
function sayfaYaz(wb: ExcelJS.Workbook, ad: string, baslik: string, urun: string, a: ImalatAy, kapKat: number) {
  const ws = wb.addWorksheet(ad, { views: [{ showGridLines: false }] })
  ws.columns = [{ width: 3 }, { width: 38 }, { width: 11 }, { width: 8 }, { width: 13 }, { width: 14 }, { width: 14 }, { width: 8 }, { width: 14 }, { width: 12 }, { width: 16 }, { width: 11 }, { width: 10 }, { width: 13 }]
  const put = (ref: string, v: any, o: { b?: boolean; fmt?: string; fill?: string; wrap?: boolean; box?: boolean } = {}) => {
    const c = ws.getCell(ref); c.value = v; c.font = { name: 'Arial', size: 10, bold: !!o.b }
    if (o.fmt) c.numFmt = o.fmt; if (o.fill) c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: o.fill } }
    c.alignment = { vertical: 'middle', horizontal: typeof v === 'number' || (typeof v === 'object' && v && 'formula' in v) ? 'right' : 'left', wrapText: !!o.wrap }
    if (o.box !== false) c.border = kenar
  }
  put('B1', baslik, { b: true, box: false }); put('B2', 'ÜRETİLEN ÜRÜN =>', { b: true }); put('C2', urun, { b: true })
  ws.mergeCells('D3:E3'); put('D3', 'KAPASİTE RAPORUNA GÖRE 1 ADET ÜRÜN İÇİN KULLANILMASI GEREKEN MALZEME', { b: true, wrap: true, fill: 'FFF2F2F2' })
  ws.mergeCells('F3:G3'); put('F3', 'ÜRETİLEN ÜRÜN MİKTARINA GÖRE KULLANILMASI GEREKEN MALZEME', { b: true, wrap: true, fill: 'FFF2F2F2' })
  ws.mergeCells('H3:N3'); put('H3', 'YÜKLENİLEN KDV LİSTESİNDE KULLANILAN TOPLAM MALZEME', { b: true, wrap: true, fill: 'FFF2F2F2' }); ws.getRow(3).height = 42
  const bas = ['ANA MALZEME =>', '', 'BİRİM', 'MİKTAR(A)', 'ÜRÜN MİKTARI(B)', 'TOPLAM (A x B)', 'BİRİM', 'MİKTAR', 'BİRİM FİYAT', 'TUTAR', 'YASAL FİRE ORANI', 'FİRE ORANI', 'FİRE MİKTARI']
  bas.forEach((t, i) => put(`${String.fromCharCode(66 + i)}4`, t, { b: true, fill: 'FFF2F2F2', wrap: true }))
  const n = a.satirlar.length, r0 = 5
  a.satirlar.forEach((s, i) => {
    const r = r0 + i
    put(`B${r}`, s.ad, { b: true }); put(`C${r}`, `Malzeme ${i + 1}`); put(`D${r}`, 'Kg')
    put(`E${r}`, s.e, { fmt: '0.0000000' }); put(`F${r}`, s.f, { fmt: '#,##0' }); put(`G${r}`, { formula: `E${r}*F${r}` }, { fmt: '#,##0.00' })
    put(`H${r}`, 'Kg'); put(`I${r}`, Math.round(s.i * 100) / 100, { fmt: '#,##0.00' }); put(`J${r}`, Math.round(s.j * 100) / 100, { fmt: '#,##0.00' })
    put(`K${r}`, { formula: `I${r}*J${r}` }, { fmt: '#,##0.00' }); put(`L${r}`, FIRE, { fmt: '0%' }); put(`M${r}`, FIRE, { fmt: '0%' }); put(`N${r}`, { formula: `I${r}*M${r}` }, { fmt: '#,##0.00' })
  })
  const rs = r0 + n
  for (const [c, fmt] of [['G', '#,##0.00'], ['I', '#,##0.00'], ['K', '#,##0.00'], ['N', '#,##0.00']] as const) put(`${c}${rs}`, { formula: `SUM(${c}${r0}:${c}${rs - 1})` }, { b: true, fmt })
  let r = rs + 2
  put(`B${r}`, 'YARDIMCI MALZEME & SARFLAR =>', { b: true, fill: 'FFF2F2F2' }); ;['BİRİM', 'MİKTAR'].forEach((t, i) => put(`${'DE'[i]}${r}`, t, { b: true, fill: 'FFF2F2F2' })); ;['BİRİM', 'MİKTAR', 'BİRİM FİYAT', 'TUTAR'].forEach((t, i) => put(`${'HIJK'[i]}${r}`, t, { b: true, fill: 'FFF2F2F2' }))
  ;['Adet', 'Kg', 'Mtül', 'M2', 'M3'].forEach((u, i) => { put(`C${r + 1 + i}`, `Malzeme ${i + 1}`); put(`D${r + 1 + i}`, u); put(`H${r + 1 + i}`, u) })
  r += 7
  put(`B${r}`, 'FASON İŞÇİLİK =>', { b: true, fill: 'FFF2F2F2' }); ;['BİRİM', 'MİKTAR'].forEach((t, i) => put(`${'DE'[i]}${r}`, t, { b: true, fill: 'FFF2F2F2' })); ;['BİRİM', 'MİKTAR', 'BİRİM FİYAT', 'TUTAR'].forEach((t, i) => put(`${'HIJK'[i]}${r}`, t, { b: true, fill: 'FFF2F2F2' }))
  for (let i = 1; i <= 6; i++) put(`C${r + i}`, 'işçilik')
  r += 8
  put(`C${r}`, `${urun} (Kg)`, { b: true, fill: 'FFF2F2F2' }); put(`D${r}`, `${urun} (Adet)`, { b: true, fill: 'FFF2F2F2' })
  put(`B${r + 1}`, 'ÜRETİLEN ÜRÜN MİKTARI', { b: true }); put(`C${r + 1}`, { formula: `G${rs}-G${r0 + a.satirlar.findIndex(s => s.grup === 'BOYA')}` }, { fmt: '#,##0.00' }); put(`D${r + 1}`, a.adet, { fmt: '#,##0' })
  put(`B${r + 2}`, 'KAPASİTE RAPORUNA GÖRE AYLIK ÜRETİM MİKTARI', { b: true }); put(`C${r + 2}`, KAPASITE.kg * kapKat, { fmt: '#,##0' }); put(`D${r + 2}`, KAPASITE.adet * kapKat, { fmt: '#,##0' })
  put(`B${r + 3}`, 'KAPASİTE RAPORUNA GÖRE AYLIK ÜRETİM MİKTARINI AŞMA SEBEBİ (FAZLA MESAİ, ÇİFT VARDİYA, ÜÇ VARDİYA V.B.)', { b: true, wrap: true }); put(`C${r + 3}`, 0); put(`D${r + 3}`, 0); ws.getRow(r + 3).height = 40
  ws.getCell(`B${r + 5}`).value = 'Not: Üretim = Mikro ÜRETİM giriş fişleri (iç mekan) × reçete; boya reçetede yoksa hammaddenin %2\'si (tahmin). Alış (I, J) stok hareketlerindeki satın almalardan gelir; kayıtta olmayan alışlar 0 görünür.'
  ws.getCell(`B${r + 5}`).font = { name: 'Arial', size: 9, italic: true }
}

export async function imalatExcel(v: ImalatVeri, ayAy: boolean): Promise<ArrayBuffer> {
  const wb = new ExcelJS.Workbook(); wb.creator = 'Alya Plastik'
  const donem = v.bas === v.bit ? `${AYLAR[v.bas - 1].toLocaleUpperCase('tr')}` : `${AYLAR[v.bas - 1].toLocaleUpperCase('tr')}–${AYLAR[v.bit - 1].toLocaleUpperCase('tr')}`
  if (ayAy && v.aylar.length > 1) {
    for (const a of v.aylar) sayfaYaz(wb, AYLAR[a.ay - 1], `${v.yil} ${AYLAR[a.ay - 1].toLocaleUpperCase('tr')} DÖNEMİ İMALAT ANALİZİ`, v.urun, a, 1)
    sayfaYaz(wb, 'TOPLAM', `${v.yil} ${donem} DÖNEMİ İMALAT ANALİZİ (TOPLAM)`, v.urun, v.toplam, v.aylar.length)
  } else sayfaYaz(wb, v.bas === v.bit ? AYLAR[v.bas - 1] : 'Analiz', `${v.yil} ${donem} DÖNEMİ İMALAT ANALİZİ`, v.urun, v.toplam, v.aylar.length)
  return (await wb.xlsx.writeBuffer()) as ArrayBuffer
}
