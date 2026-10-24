// AI ile üretilen görseller (OpenAI'den) sıkıştırılmamış, ortalama ~1MB'lık PNG olarak geliyor.
// 130+ görsel ile site toplamda 120MB+ resim yüklüyordu — bu da anasayfa/koleksiyon gibi çok
// sayıda görselin aynı anda göründüğü sayfalarda ciddi yavaşlığa yol açıyordu.
// Bu yardımcı, PNG baytlarını WebP'ye çevirip makul bir kenar boyutuna küçültür (görsel kalitesi
// gözle fark edilmeden ~%90-98 boyut kazancı sağlar — bkz. gorsel-optimize eylemi).
import sharp from "sharp";

export type SikistirmaSonucu = { bytes: Buffer; contentType: string };

/**
 * @param maxKenar Görselin en uzun kenarının piksel üst sınırı (büyütme yapılmaz, yalnızca küçültür).
 * @param kalite WebP kalite (0-100).
 */
export async function gorselSikistir(giris: Buffer, maxKenar = 1200, kalite = 82): Promise<SikistirmaSonucu> {
  const bytes = await sharp(giris)
    .rotate() // EXIF yönünü uygula
    .resize(maxKenar, maxKenar, { fit: "inside", withoutEnlargement: true })
    .webp({ quality: kalite })
    .toBuffer();
  return { bytes, contentType: "image/webp" };
}
