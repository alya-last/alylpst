// Tarayıcıda çalışan, sıkıştırmasız (store) ZIP üretici — ek bağımlılık gerektirmez.
// Yedek dosyası için yeterlidir; dosya adları UTF-8 (Türkçe karakterler) olarak yazılır.

const CRC_TABLO = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()

function crc32(b: Uint8Array) {
  let c = 0xffffffff
  for (let i = 0; i < b.length; i++) c = CRC_TABLO[(c ^ b[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function dosZaman(d: Date) {
  const saat = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1)
  const tarih = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate()
  return { saat, tarih }
}

export class ZipYazici {
  private parcalar: Uint8Array[] = []
  private merkez: Uint8Array[] = []
  private ofset = 0
  private adet = 0
  private enc = new TextEncoder()

  ekle(ad: string, veri: Uint8Array) {
    const adB = this.enc.encode(ad)
    const crc = crc32(veri)
    const { saat, tarih } = dosZaman(new Date())

    const yerel = new Uint8Array(30 + adB.length)
    const y = new DataView(yerel.buffer)
    y.setUint32(0, 0x04034b50, true)
    y.setUint16(4, 20, true)
    y.setUint16(6, 0x0800, true) // UTF-8 dosya adı
    y.setUint16(8, 0, true) // store
    y.setUint16(10, saat, true)
    y.setUint16(12, tarih, true)
    y.setUint32(14, crc, true)
    y.setUint32(18, veri.length, true)
    y.setUint32(22, veri.length, true)
    y.setUint16(26, adB.length, true)
    y.setUint16(28, 0, true)
    yerel.set(adB, 30)

    const mer = new Uint8Array(46 + adB.length)
    const m = new DataView(mer.buffer)
    m.setUint32(0, 0x02014b50, true)
    m.setUint16(4, 20, true)
    m.setUint16(6, 20, true)
    m.setUint16(8, 0x0800, true)
    m.setUint16(10, 0, true)
    m.setUint16(12, saat, true)
    m.setUint16(14, tarih, true)
    m.setUint32(16, crc, true)
    m.setUint32(20, veri.length, true)
    m.setUint32(24, veri.length, true)
    m.setUint16(28, adB.length, true)
    m.setUint32(42, this.ofset, true)
    mer.set(adB, 46)

    this.parcalar.push(yerel, veri)
    this.merkez.push(mer)
    this.ofset += yerel.length + veri.length
    this.adet++
  }

  ekleMetin(ad: string, metin: string) {
    this.ekle(ad, this.enc.encode(metin))
  }

  bitir(): Blob {
    const merBoy = this.merkez.reduce((t, x) => t + x.length, 0)
    const son = new Uint8Array(22)
    const s = new DataView(son.buffer)
    s.setUint32(0, 0x06054b50, true)
    s.setUint16(8, this.adet, true)
    s.setUint16(10, this.adet, true)
    s.setUint32(12, merBoy, true)
    s.setUint32(16, this.ofset, true)
    return new Blob([...this.parcalar, ...this.merkez, son] as unknown as BlobPart[], { type: 'application/zip' })
  }
}
