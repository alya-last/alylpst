// Liste ekranlarındaki "Seçilenleri sil" için ortak yürütücü.
// Her kaydı sırayla siler; biri hata verse de diğerlerine devam eder ve sonunda tek bir özet mesaj döndürür.
// `sil` fonksiyonu: başarıda boş/null/undefined, hatada hata metni döndürmeli (veya throw etmeli).
export async function topluSilCalistir<T>(
  rows: T[],
  sil: (r: T) => Promise<string | null | undefined | void>,
  noun = 'kayıt',
): Promise<{ silinen: number; hata: string | null }> {
  let silinen = 0, hata = 0, ilk = ''
  for (const r of rows) {
    try {
      const e = await sil(r)
      if (e) { hata++; ilk ||= String(e) } else silinen++
    } catch (er: any) {
      hata++; ilk ||= String(er?.message || er)
    }
  }
  return {
    silinen,
    hata: hata ? `${silinen} ${noun} silindi, ${hata} ${noun} silinemedi: ${ilk}` : null,
  }
}
