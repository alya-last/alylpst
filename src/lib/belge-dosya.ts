'use client'
// Belge dosyasını sunucu gövde sınırına (~4.5 MB) sığacak biçimde data URL'e çevirir.
async function gorselKucult(f: File): Promise<string> {
  const bmp = await createImageBitmap(f)
  for (const [kenar, kalite] of [[1800, 0.85], [1400, 0.75], [1100, 0.65]] as const) {
    const oran = Math.min(1, kenar / Math.max(bmp.width, bmp.height))
    const c = document.createElement('canvas'); c.width = Math.round(bmp.width * oran); c.height = Math.round(bmp.height * oran)
    c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height)
    const d = c.toDataURL('image/jpeg', kalite)
    if (d.length < 4_000_000) return d
  }
  throw new Error('Görsel çok büyük, daha küçük çözünürlükle deneyin.')
}
const dosyaOku = (f: File) => new Promise<string>((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = () => rej(new Error('Dosya okunamadı')); r.readAsDataURL(f) })

export async function belgeDataUrl(f: File): Promise<string> {
  if (f.type === 'application/pdf') { if (f.size > 3_000_000) throw new Error(`${f.name}: PDF en fazla 3 MB olabilir.`); return dosyaOku(f) }
  if (/^image\/(jpeg|png|webp)$/.test(f.type)) return gorselKucult(f)
  throw new Error(`${f.name}: desteklenen türler JPEG, PNG, WEBP, PDF`)
}
