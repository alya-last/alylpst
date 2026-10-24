// Tedarikçiye giden sipariş / hatırlatma mesajları (saf fonksiyonlar). Metin yalnızca sipariş kayıtlarından üretilir.
export type MesajKalem = { ad: string; birim?: string | null; miktar: number; teslim: number; birim_fiyat: number }
export type MesajSiparis = { no: string; tarih: string; beklenen_teslim: string | null; para_birimi: string; notlar?: string | null }
const tarih = (t: string) => t.slice(0, 10).split('-').reverse().join('.')
const say = (n: number) => new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 3 }).format(n)
const para = (n: number, pb: string) => `${new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)} ${pb}`
const gunFarki = (a: string, b: string) => Math.round((Date.parse(b.slice(0, 10) + 'T00:00:00Z') - Date.parse(a.slice(0, 10) + 'T00:00:00Z')) / 86400000)

/** Türkiye numaralarını wa.me biçimine (90xxxxxxxxxx) çevirir; geçersizse null. */
export function telefonNormalize(t: string | null | undefined): string | null {
  let d = String(t || '').replace(/\D/g, '')
  if (d.startsWith('00')) d = d.slice(2)
  if (d.startsWith('0') && d.length === 11) d = '90' + d.slice(1)
  else if (d.length === 10 && d.startsWith('5')) d = '90' + d
  return /^\d{10,15}$/.test(d) && (d.startsWith('90') ? d.length === 12 : true) ? d : null
}
export const epostaGecerli = (e: string | null | undefined) => !!e && /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/.test(e.trim()) && e.length <= 254

export function siparisMetni(o: { sablon: 'siparis' | 'hatirlatma'; firma: string; tedarikci: string; siparis: MesajSiparis; kalemler: MesajKalem[]; bugun: string }) {
  const { siparis: s, kalemler: ks, firma } = o, pb = s.para_birimi || 'TRY'
  const toplam = ks.reduce((t, k) => t + k.miktar * k.birim_fiyat, 0)
  const satir = (k: MesajKalem, kalanMi: boolean) => { const m = kalanMi ? Math.max(k.miktar - k.teslim, 0) : k.miktar; return `- ${k.ad}: ${say(m)} ${k.birim || ''} × ${para(k.birim_fiyat, pb)}`.replace(/\s+×/, ' ×') }
  if (o.sablon === 'siparis') {
    const konu = `Satınalma siparişi ${s.no} — ${firma}`
    const metin = `Sayın ${o.tedarikci},\n\n${firma} olarak ${tarih(s.tarih)} tarihli ${s.no} numaralı satınalma siparişimizi aşağıda iletiyoruz:\n\n${ks.map(k => satir(k, false)).join('\n')}\n\nToplam (KDV hariç): ${para(toplam, pb)}${s.beklenen_teslim ? `\nBeklenen teslim: ${tarih(s.beklenen_teslim)}` : ''}${s.notlar ? `\n\nNot: ${s.notlar}` : ''}\n\nSiparişi onaylamanızı ve teslim tarihini teyit etmenizi rica ederiz.\n\nSaygılarımızla,\n${firma}`
    return { konu, metin }
  }
  const kalan = ks.filter(k => k.miktar - k.teslim > 1e-9)
  const durum = s.beklenen_teslim ? (s.beklenen_teslim < o.bugun ? `beklenen teslim tarihi (${tarih(s.beklenen_teslim)}) ${gunFarki(s.beklenen_teslim, o.bugun)} gün önce geçmiştir` : `beklenen teslim tarihi ${tarih(s.beklenen_teslim)}'dir`) : 'teslim tarihi netleşmemiştir'
  const konu = `Teslim hatırlatması: ${s.no} — ${firma}`
  const metin = `Sayın ${o.tedarikci},\n\n${tarih(s.tarih)} tarihli ${s.no} numaralı siparişimiz için ${durum}.\n\n${kalan.length ? `Teslim edilmemiş kalemler:\n${kalan.map(k => satir(k, true)).join('\n')}\n\n` : ''}Güncel teslim tarihi hakkında bilgi vermenizi rica ederiz.\n\nSaygılarımızla,\n${firma}`
  return { konu, metin }
}
