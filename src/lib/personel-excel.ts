import ExcelJS from 'exceljs'
import type { PuantajSatiri } from '@/lib/puantaj'

const durumEtiket: Record<string, string> = { calisti: 'Çalıştı', eksik: 'Çıkış kaydı yok', icerde: 'İçeride', devamsiz: 'Devamsız', gelmedi: 'Gelmedi', izinli: 'İzinli', tatil: 'Resmî tatil', yarim_tatil: 'Yarım gün tatil', hafta_tatili: 'Hafta tatili', tatilde_calisti: 'Tatilde çalıştı', kapsam_disi: '—', gelecek: '' }
const izinAd: Record<string, string> = { yillik: 'Yıllık izin', mazeret: 'Mazeret', rapor: 'Rapor', ucretsiz: 'Ücretsiz izin', idari: 'İdari izin' }
const hm = (dk: number) => `${Math.floor(dk / 60)}:${String(dk % 60).padStart(2, '0')}`
const saatTR = (iso: string | null) => iso ? new Date(Date.parse(iso) + 3 * 3600e3).toISOString().slice(11, 16) : ''

export async function puantajExcel(satirlar: PuantajSatiri[], donem: string, ayar: { haftalik_normal_saat: number }) {
  const wb = new ExcelJS.Workbook(); wb.creator = 'Alya Plastik — Personel'; wb.created = new Date()
  const gunler = satirlar[0]?.gunler.map(g => g.tarih) || []

  // 1) Puantaj çizelgesi
  const ws = wb.addWorksheet('Puantaj', { views: [{ state: 'frozen', xSplit: 3, ySplit: 3 }] })
  ws.addRow([`Puantaj Çizelgesi — ${donem}`]).font = { bold: true, size: 14 }
  ws.addRow(['Ç: çalıştı (süre) · D: devamsız · İ: izin · R: rapor · T: resmî tatil · H: hafta tatili · E: çıkış kaydı yok · *: tatilde çalıştı']).font = { color: { argb: 'FF666666' }, size: 9 }
  const baslik = ['Sicil', 'Ad Soyad', 'Vardiya', ...gunler.map(g => String(+g.slice(8))), 'Çalışılan (sa)', 'Fazla mesai (sa)', 'Tatil çalışması (sa)', 'Geç (gün)', 'Geç (dk)', 'Erken çıkış (dk)', 'Devamsız (gün)', 'İzin (gün)', 'Eksik kayıt (gün)', `Haftalık ${ayar.haftalik_normal_saat} sa üstü (sa)`]
  const h = ws.addRow(baslik); h.font = { bold: true, color: { argb: 'FFFFFFFF' } }
  h.eachCell(c => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2B2F2B' } }; c.alignment = { horizontal: 'center', wrapText: true } })
  for (const s of satirlar) {
    const hucre = s.gunler.map(g => {
      switch (g.durum) {
        case 'calisti': return `Ç ${hm(g.calisilan_dk)}`
        case 'icerde': return 'İç'
        case 'eksik': return 'E'
        case 'devamsiz': return 'D'
        case 'izinli': return g.izin_tur === 'rapor' ? 'R' : 'İ'
        case 'tatil': case 'yarim_tatil': return 'T'
        case 'hafta_tatili': return 'H'
        case 'tatilde_calisti': return `*${hm(g.calisilan_dk)}`
        default: return ''
      }
    })
    const o = s.ozet, izinToplam = Object.values(o.izin_gun).reduce((a, b) => a + b, 0)
    const r = ws.addRow([s.personel.sicil_no, s.personel.ad_soyad, s.vardiya?.ad || '—', ...hucre, +(o.calisilan_dk / 60).toFixed(2), +(o.fazla_mesai_dk / 60).toFixed(2), +(o.tatil_calisma_dk / 60).toFixed(2), o.gec_gun, o.gec_dk, o.erken_cikis_dk, o.devamsiz_gun, izinToplam, o.eksik_kayit_gun, +(o.haftalik_fazla_dk / 60).toFixed(2)])
    r.eachCell((c, i) => { if (i > 3) c.alignment = { horizontal: 'center' }; const v = String(c.value ?? ''); if (i > 3 && i <= 3 + gunler.length) { if (v === 'D') c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8D0D0' } }; else if (v === 'E') c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFCE8B2' } }; else if (v === 'H' || v === 'T') c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEDEDED' } } } })
  }
  ws.columns = [{ width: 10 }, { width: 26 }, { width: 10 }, ...gunler.map(() => ({ width: 7 })), ...Array.from({ length: 10 }, () => ({ width: 13 }))]

  // 2) Günlük detay
  const wd = wb.addWorksheet('Günlük detay')
  const hd = wd.addRow(['Sicil', 'Ad Soyad', 'Tarih', 'Durum', 'Giriş', 'Çıkış', 'Çalışılan (dk)', 'Geç (dk)', 'Erken çıkış (dk)', 'Fazla mesai (dk)', 'Tatil çalışma (dk)', 'İzin/Tatil', 'Uyarılar'])
  hd.font = { bold: true, color: { argb: 'FFFFFFFF' } }; hd.eachCell(c => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2B2F2B' } } })
  for (const s of satirlar) for (const g of s.gunler) if (g.durum !== 'kapsam_disi' && g.durum !== 'gelecek') wd.addRow([s.personel.sicil_no, s.personel.ad_soyad, g.tarih, durumEtiket[g.durum] || g.durum, saatTR(g.giris), saatTR(g.cikis), g.calisilan_dk, g.gec_dk, g.erken_cikis_dk, g.fazla_mesai_dk, g.tatil_calisma_dk, g.izin_tur ? izinAd[g.izin_tur] || g.izin_tur : g.tatil_ad || '', g.uyarilar.join('; ')])
  wd.columns = [{ width: 10 }, { width: 26 }, { width: 12 }, { width: 18 }, { width: 8 }, { width: 8 }, { width: 14 }, { width: 10 }, { width: 14 }, { width: 14 }, { width: 16 }, { width: 18 }, { width: 40 }]

  // 3) Notlar
  const wn = wb.addWorksheet('Notlar')
  for (const t of [
    'Hesaplama kuralları', '• Süreler giriş→çıkış çiftlerinden hesaplanır; tek aralıkla çalışılan günlerde vardiyanın planlı molası (4 saati aşan çalışmada) düşülür. Öğle çıkışı okutulduysa mola tekrar düşülmez.',
    '• Geç kalma: vardiya başlangıcından tolerans süresi aşan girişlerde, gecikme dakikasının tamamı sayılır. Erken çıkış aynı toleransla hesaplanır.',
    '• Fazla mesai (günlük): vardiya net süresinin üzerindeki çalışma, vardiyada tanımlı eşiği aşarsa yazılır. Hafta tatili ve resmî tatil çalışmaları ayrıca "tatil çalışması" olarak gösterilir.',
    `• Haftalık ${ayar.haftalik_normal_saat} saat üstü: Pazartesi başlangıçlı haftalık toplam çalışma; ay sınırındaki haftalar kısmidir.`,
    '• Gece yarısını aşan vardiyalar başlangıç gününe yazılır.',
    '• Bu çizelge ön hazırlıktır; ücret ve mesai zammı hesabı için iç yönetmelik ve mevzuata göre İK/mali müşavir kontrolü gerekir.',
  ]) wn.addRow([t])
  wn.getRow(1).font = { bold: true, size: 13 }; wn.getColumn(1).width = 140
  return wb.xlsx.writeBuffer()
}
