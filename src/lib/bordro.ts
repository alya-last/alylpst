// Bordro (payroll) hesaplama — saf fonksiyonlar, DB'ye dokunmaz.
// NOT: Bu hesaplama basitleştirilmiştir (asgari ücret istisnası, AGİ gibi özel muafiyetler dahil edilmemiştir).
// Gerçek bordro/ödeme öncesi mali müşavir onayından geçirilmelidir.

export type VergiDilimi = { ust: number | null; oran: number }

/** Kümülatif gelir vergisi matrahına göre birikmiş toplam vergiyi hesaplar (dilim sınırlarına göre). */
export function kumulatifVergi(matrah: number, dilimler: VergiDilimi[]): number {
  if (matrah <= 0 || !dilimler?.length) return 0
  let kalan = matrah, vergi = 0, alt = 0
  for (const d of dilimler) {
    const ust = d.ust ?? Infinity
    const dilimGenisligi = Math.max(0, Math.min(kalan, ust - alt))
    if (dilimGenisligi <= 0) { alt = ust; continue }
    vergi += dilimGenisligi * d.oran
    kalan -= dilimGenisligi
    alt = ust
    if (kalan <= 0) break
  }
  return vergi
}

export type BordroParametre = {
  sgk_isci_orani: number
  issizlik_isci_orani: number
  sgk_isveren_orani: number
  damga_vergisi_orani: number
  gelir_vergisi_dilimleri: VergiDilimi[]
}

export type BordroGirdi = {
  brutMaas: number
  kumulatifMatrahOncesi: number // bu yıl, bu aydan önceki aylarda biriken vergi matrahı toplamı
  avansMahsup?: number
  parametre: BordroParametre
}

export type BordroSonuc = {
  brut_maas: number
  sgk_isci_kesintisi: number
  issizlik_kesintisi: number
  vergi_matrahi: number // bu ayın matrahı (brüt - sgk - işsizlik)
  kumulatif_matrah_sonrasi: number
  gelir_vergisi: number
  damga_vergisi: number
  avans_mahsup: number
  net_maas: number
  sgk_isveren_maliyeti: number
}

export function hesaplaBordroSatiri({ brutMaas, kumulatifMatrahOncesi, avansMahsup = 0, parametre }: BordroGirdi): BordroSonuc {
  const brut = Math.max(0, brutMaas)
  const sgkIsci = +(brut * parametre.sgk_isci_orani).toFixed(2)
  const issizlik = +(brut * parametre.issizlik_isci_orani).toFixed(2)
  const matrah = Math.max(0, brut - sgkIsci - issizlik)
  const kumulatifSonrasi = kumulatifMatrahOncesi + matrah
  const vergiOncesi = kumulatifVergi(kumulatifMatrahOncesi, parametre.gelir_vergisi_dilimleri)
  const vergiSonrasi = kumulatifVergi(kumulatifSonrasi, parametre.gelir_vergisi_dilimleri)
  const gelirVergisi = +Math.max(0, vergiSonrasi - vergiOncesi).toFixed(2)
  const damgaVergisi = +(brut * parametre.damga_vergisi_orani).toFixed(2)
  const avans = +Math.max(0, avansMahsup).toFixed(2)
  const net = +(brut - sgkIsci - issizlik - gelirVergisi - damgaVergisi - avans).toFixed(2)
  const sgkIsveren = +(brut * parametre.sgk_isveren_orani).toFixed(2)
  return {
    brut_maas: brut, sgk_isci_kesintisi: sgkIsci, issizlik_kesintisi: issizlik,
    vergi_matrahi: +matrah.toFixed(2), kumulatif_matrah_sonrasi: +kumulatifSonrasi.toFixed(2),
    gelir_vergisi: gelirVergisi, damga_vergisi: damgaVergisi, avans_mahsup: avans, net_maas: net,
    sgk_isveren_maliyeti: sgkIsveren,
  }
}
