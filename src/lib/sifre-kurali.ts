// Admin paneli şifre kuralı (Supabase'in "sızmış şifre koruması" ücretli planda olduğu için panelde uygulanır).
export const MIN_SIFRE = 12

const YASAKLI = [
  '123456', '1234567', '12345678', '123456789', '1234567890', '111111', '000000', '121212', '654321', '987654',
  '19961996', '19951995', '19971997', '19981998', '12341234', '11223344', '1q2w3e', 'qwerty', 'qwertyuiop', 'asdfgh', 'zxcvbn',
  'password', 'passw0rd', 'parola', 'sifre', 'şifre', 'admin', 'administrator', 'welcome', 'letmein', 'iloveyou', 'master',
  'alya', 'alyaplastik', 'alyaplast', 'istanbul', 'ankara', 'turkiye', 'türkiye', 'fenerbahce', 'galatasaray', 'besiktas',
]

// Geçerliyse null, değilse kullanıcıya gösterilecek hata metni döner.
export function sifreKontrol(sifre: string): string | null {
  const s = sifre || ''
  if (s.length < MIN_SIFRE) return `Şifre en az ${MIN_SIFRE} karakter olmalı.`
  if (/^\d+$/.test(s)) return 'Şifre sadece rakamlardan oluşamaz; harf de ekleyin.'
  if (new Set(s.toLocaleLowerCase('tr')).size < 5) return 'Şifre çok tekrarlı karakterlerden oluşuyor; daha çeşitli bir şifre seçin.'
  const k = s.toLocaleLowerCase('tr').replace(/[^a-z0-9çğıöşü]/g, '')
  const bulunan = YASAKLI.find(y => k.includes(y))
  if (bulunan) return `Şifre kolay tahmin edilen bir ifade içeriyor (“${bulunan}”). Farklı bir şifre seçin.`
  if (!(/[a-zçğıöşü]/i.test(s) && /\d/.test(s)) && s.length < 16) return 'Harf ve rakam birlikte kullanın (veya 16+ karakterlik uzun bir şifre seçin).'
  return null
}

// Şifre internette sızmış listelerde var mı? (Have I Been Pwned, k-anonimlik: şifrenin kendisi değil,
// SHA-1 özetinin ilk 5 karakteri gönderilir.) Servise ulaşılamazsa engellemez (null).
export async function sizdirilmisMi(sifre: string): Promise<boolean> {
  try {
    const buf = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(sifre))
    const hex = Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase()
    const on = hex.slice(0, 5), son = hex.slice(5)
    const r = await fetch(`https://api.pwnedpasswords.com/range/${on}`, { headers: { 'Add-Padding': 'true' }, signal: AbortSignal.timeout(4000) })
    if (!r.ok) return false
    const t = await r.text()
    return t.split('\n').some(l => { const [h, n] = l.trim().split(':'); return h === son && Number(n) > 0 })
  } catch { return false }
}
export const SIZDIRILMIS_HATA = 'Bu şifre internette sızmış şifre listelerinde bulunuyor. Lütfen farklı bir şifre seçin.'
